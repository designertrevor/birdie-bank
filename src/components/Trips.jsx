// The trip's pieces outside its own page: the card on the Tab, the card on Up next (with the
// trip's planned rounds grouped under it), the line on a trip round's results, "Count it for the
// trip?" in setup, and the sheet that starts or edits a trip.
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Segmented, Sheet, Steps, Toggle, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { CupLine, CupRoundNote, TeamsPicker } from './Cup.jsx';
import { getState, uid, update, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { placeOf, sortedPlayers } from '../lib/format.js';
import { dayLabel, isoDate, timeLabel } from '../lib/plans.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { TRIP_FORMATS, myTripAllIn, myTripNet, startsLine, tripChips, tripDates, tripStatus, upDown } from '../lib/trips.js';
import { countsMoney, onTab, playForOf } from '../lib/play-for.js';
import { editTrip, hideTrip, makeScheduledRounds, makeTrip } from '../lib/trip-store.js';
import { CUP_FORMAT, balanceTeams, cleanCup, cupHeadline } from '../lib/cup.js';
import { TEMPLATE_SIZES, plansByDay, ryderTemplate, scheduleProblem, scheduledPlans } from '../lib/trip-templates.js';
import { FLIGHT_NAMES, flightsOf } from '../lib/flights.js';
import { startDraft } from '../lib/draft-sync.js';
import { ScheduleEditor, TemplatePick } from './TripMode.jsx';

const first = name => String(name || '').trim().split(/\s+/)[0];

/** "1st", "2nd", "3rd", "4th". */
function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
}

/**
 * Where you stand on the trip in a few words: "You’re 2nd, up $12". When you're in its expenses,
 * the money is your whole trip, all in, as the trip itself and the Tab's trip card say it: "You’re
 * 2nd. All in, you’re owed $62.66".
 */
function standingLine(state, st) {
  const me = canonicalOf(state)(state.me);
  const i = st.standings.findIndex(p => p.id === me);
  if (i < 0) return null;
  const v = st.standings[i].amount;
  const place = placeOf(st.standings, i);
  const tied = st.standings.filter(p => p.amount === v).length > 1;
  const where = `You’re ${tied ? 'tied for ' : ''}${ordinal(place)}`;
  if (st.spending.has(me)) return `${where}. All in, ${allInText(myTripAllIn(state, st))}`;
  const upOrDown = v > 0 ? `up ${money(v)}` : v < 0 ? `down ${money(-v)}` : 'even';
  return `${where}, ${upOrDown}`;
}

/** Your whole trip, all in, mid-sentence: "you’re owed $40", "you owe $12" or "you’re square". */
const allInText = v => (v > 0 ? `you’re owed ${money(v)}` : v < 0 ? `you owe ${money(-v)}` : 'you’re square');

/** The eyebrow over a trip: where it's at. */
function tripEyebrow(st) {
  if (st.phase === 'soon') return `Trip · ${tripDates(st.trip)}`;
  if (st.phase === 'ready') return 'Trip · ready to settle';
  if (st.phase === 'square') return 'Trip · all square';
  return st.day ? `Trip · Day ${st.day} of ${st.days}` : `Trip · ${tripDates(st.trip)}`;
}

const roundsLine = n => `${n} round${n === 1 ? '' : 's'}`;

/** "Updated" by the eyebrow, when the trip's payments changed since you last looked (trip-plan.js). */
const Updated = ({ st }) => (st.published?.updated ? <span className="trip-updated">Updated</span> : null);

/**
 * A trip card stays on the Tab and Up next until you hide it: the small x, with an undo. It's only
 * off this phone's Tab and Up next; the rounds and their money stay as they are.
 */
function HideX({ st }) {
  const { showToast } = useUI();
  const hide = e => {
    e.stopPropagation();
    hideTrip(st.trip.id);
    showToast(`${st.trip.name} is hidden. Its rounds and money stay as they are.`, { label: 'Undo', run: () => hideTrip(st.trip.id, false) });
  };
  return <button className="trip-hide" onClick={hide} aria-label={`Hide ${st.trip.name}`}><Icon name="x" /></button>;
}

/**
 * The trip's card on the Tab. Trip money is already in each person's total below it; the card is
 * the trip's own view of it, one tap from the standings and Settle the trip. With expenses in it,
 * the amount is your whole trip, all in.
 */
export function TripTabCard({ status: st }) {
  const nav = useNav();
  const state = useStore();
  const me = canonicalOf(state)(state.me);
  const inExpenses = st.spending.has(me);
  const net = inExpenses ? myTripAllIn(state, st) : myTripNet(state, st);
  // A team points trip's stake is paid from the trip, not the Tab: it counts in the trip's payments
  const n = st.plan.length + (st.cup ? st.cup.lines.filter(l => l.open > 0 && !l.onTab).length : 0);
  const spent = st.expenses.length ? ` · ${st.expenses.length} expense${st.expenses.length === 1 ? '' : 's'}` : '';
  const sub = st.phase === 'soon' ? `${startsLine(st.trip.start)}${spent}`
    : st.phase === 'empty' ? 'No rounds were counted for it'
    : st.pointsOnly ? `${roundsLine(st.done.length)}${st.phase === 'on' ? ' so far' : ''} · played for points`
    : st.phase === 'ready' ? `${n} payment${n === 1 ? '' : 's'} square${n === 1 ? 's' : ''} the trip · ${st.payments.length + (st.cup?.marks.length || 0)} paid so far${st.cup?.stakeOn ? ' · the cup stake included' : ''}`
    : st.phase === 'square' ? `${roundsLine(st.done.length)}${spent} · settled`
    : `${roundsLine(st.done.length)}${spent} so far · settle after the last round`;
  const played = st.standings.some(p => p.id === me);
  const showAmt = (played && st.hasMoney) || inExpenses;
  const said = inExpenses ? (net > 0 ? `The trip owes you ${money(net)}` : net < 0 ? `You owe ${money(-net)} on the trip` : 'You’re square on the trip') : upDown(net);
  const cupOn = st.cup && (st.cup.score.done > 0 || st.cup.score.live.length > 0);
  return (
    <div className="trip-card-wrap">
      <button className="trip-card on-tab" onClick={() => nav.push('trip', { id: st.trip.id })} aria-label={`${st.trip.name}. ${sub}${cupOn ? `. ${cupHeadline(st.cup)}` : ''}${showAmt ? `. ${said}` : ''}. See the trip`}>
        <div className="row-main">
          <div className="eyebrow">{tripEyebrow(st)} <Updated st={st} /></div>
          <div className="trip-name d">{st.trip.name}</div>
          {cupOn && <div className="trip-sub"><CupLine cup={st.cup} /></div>}
          <div className="trip-sub">{sub}</div>
        </div>
        {showAmt && (
          <div className="trip-amt-col">
            <div className={`trip-amt d ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{money(net, { sign: true })}</div>
            <div className="trip-amt-sub">{inExpenses ? 'all in' : st.phase === 'square' ? (net > 0 ? 'won' : net < 0 ? 'lost' : 'even') : 'so far'}</div>
          </div>
        )}
        <span className="chevron"><Icon name="caret-right" /></span>
      </button>
      <HideX st={st} />
    </div>
  );
}

/** One chip a round, so the trip reads at a glance: done, being played now, still to come. */
export function TripDays({ status }) {
  const chips = tripChips(status);
  if (!chips.length) return null;
  return (
    <div className="trip-days" aria-hidden="true">
      {chips.map(c => <span key={c.key} className={`trip-day ${c.state}`}>{c.label}</span>)}
    </div>
  );
}

/**
 * The trip on Up next, under any round being played: where you stand, the days at a glance, the
 * next round, and the trip's planned rounds grouped under it (`renderPlan` draws each).
 */
export function TripUpNext({ status: st, renderPlan }) {
  const nav = useNav();
  const state = useStore();
  const line = st.hasMoney ? standingLine(state, st) : null;
  const next = st.planned[0];
  // A team points trip leads with the cup, while it's on and once it's decided
  const cupOn = st.cup && (st.cup.score.done > 0 || st.cup.score.live.length > 0);
  const title = st.phase === 'soon' ? startsLine(st.trip.start)
    : cupOn && (st.phase === 'on' || !line) ? cupHeadline(st.cup)
    // Decided: the cup first, then where your money finished, so a place never reads as the cup's
    : cupOn && st.phase === 'ready' ? `${cupHeadline(st.cup)}. On the money, ${line.replace('You’re ', 'you finished ')}`
    : st.phase === 'ready' ? (line ? `That’s the trip. ${line.replace('You’re ', 'You finished ')}` : 'That’s the trip')
    : st.phase === 'square' ? (st.pointsOnly ? 'That’s the trip' : 'All square on the trip')
    : st.phase === 'empty' ? 'No rounds were counted for it'
    : line || `${roundsLine(st.done.length)} played`;
  return (
    <>
      <div className="sec-label">Your trip</div>
      <div className="trip-card-wrap">
        <button className="trip-card" onClick={() => nav.push('trip', { id: st.trip.id })} aria-label={`${st.trip.name}. ${title}. See the trip`}>
          <div className="row-main">
            <div className="eyebrow">{st.trip.name}{st.day ? ` · Day ${st.day} of ${st.days}` : ` · ${tripDates(st.trip)}`} <Updated st={st} /></div>
            <div className="trip-name d">{title}</div>
            {cupOn && <div className="trip-sub"><CupLine cup={st.cup} />{st.phase === 'on' && line ? ` · ${line}` : ''}</div>}
            <TripDays status={st} />
            {next && <div className="trip-sub">Next: {dayLabel(next.date)}{next.teeTime ? ` ${timeLabel(next.teeTime)}` : ''} · {next.course?.name || 'Course to be set'}</div>}
            {st.phase === 'ready' && <div className="trip-sub strong">Settle the trip <Icon name="arrow-right" /></div>}
          </div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <HideX st={st} />
      </div>
      {/* While the trip is on: gas, dinner, the house, one tap from the trip's own page */}
      {(st.phase === 'on' || st.phase === 'soon') && (
        <button className="trip-line" onClick={() => nav.push('trip', { id: st.trip.id, view: 'expenses', add: st.expenses.length ? false : Date.now() })}>
          <Icon name="receipt" /> {st.expenses.length ? `Trip expenses · ${money(st.spent)} so far` : 'Paid for something? Add an expense'} <Icon name="caret-right" />
        </button>
      )}
      <TripPlanned st={st} renderPlan={renderPlan} />
    </>
  );
}

/**
 * The trip's planned rounds under its card: the next day with any, session by session (a Trip Mode
 * schedule's groups under their session's name), and a line to the rest on the trip's page, so a
 * weekend of 18 rounds doesn't fill Up next.
 */
function TripPlanned({ st, renderPlan }) {
  const nav = useNav();
  const days = plansByDay(st.planned);
  if (!days.length) return null;
  const [next, ...later] = days;
  const more = later.reduce((n, d) => n + d.sessions.reduce((m, x) => m + x.plans.length, 0), 0);
  return (
    <>
      {next.sessions.map(sess => (
        <div key={sess.key} className="tm-upnext-session">
          {sess.label && <div className="tm-upnext-label">{dayLabel(next.date)} · {sess.label}{sess.worth > 1 ? ` · ${sess.worth} points a match` : ''}</div>}
          {sess.plans.map(renderPlan)}
        </div>
      ))}
      {more > 0 && (
        <button className="trip-line" onClick={() => nav.push('trip', { id: st.trip.id, view: 'rounds' })}>
          <Icon name="calendar" /> {more} more round{more === 1 ? '' : 's'} planned after {dayLabel(next.date)} <Icon name="caret-right" />
        </button>
      )}
    </>
  );
}

/**
 * On a trip round's results: what it did for the trip. After the trip's last round it's the
 * wrap-up ("That’s the trip") with the standings and Settle the trip.
 */
export function TripRoundNote({ round }) {
  const nav = useNav();
  const state = useStore();
  if (!round?.trip?.id) return null;
  const st = tripStatus(state, round.trip.id);
  if (!st) return null;
  const me = canonicalOf(state)(state.me);
  const label = id => (id === me ? 'You' : first(nameOf(state, id)));
  const open = () => nav.push('trip', { id: st.trip.id });
  const last = (st.phase === 'ready' || st.phase === 'square') && st.done.at(-1)?.id === round.id;
  const cupNote = st.cup ? <CupRoundNote cup={st.cup} round={round} /> : null;
  if (last && st.hasMoney && (onTab(round) || st.cup?.stakeOn)) {
    return (
      <div className="trip-card wrap-up">
        <div className="eyebrow">That’s the trip</div>
        <div className="trip-name d">{st.trip.name} is in the books</div>
        {cupNote}
        <div className="trip-stand">
          {st.standings.slice(0, 6).map((p, i) => (
            <div key={p.id} className="ts-row">
              <span className="ts-rank">{placeOf(st.standings, i)}</span>
              <span className="ts-name">{label(p.id)}</span>
              <span className={`ts-amt ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{money(p.amount, { sign: true })}</span>
            </div>
          ))}
        </div>
        {st.phase === 'square' && <div className="trip-sub">Everyone’s square on the trip.</div>}
        <div className="pay-acts">
          {st.phase === 'ready' && <button className="pay-btn ink" onClick={() => nav.push('tripSettle', { id: st.trip.id })}><span className="pay-in"><Icon name="hand-coins" fill /><span className="pay-lbl">Settle the trip</span></span></button>}
          <button className="pay-btn" onClick={open}><span className="pay-in"><span className="pay-lbl">See the trip</span></span></button>
        </div>
      </div>
    );
  }
  const net = myTripNet(state, st);
  const played = st.standings.some(p => p.id === me);
  // In the trip's expenses: your whole trip, all in, as the trip and the Tab say it
  const allIn = st.spending.has(me) ? myTripAllIn(state, st) : null;
  return (
    <button className="trip-card note" onClick={open} aria-label={`Counts for ${st.trip.name}. See the trip`}>
      <div className="row-main">
        <div className="eyebrow">Counts for {st.trip.name}</div>
        {cupNote}
        <div className="trip-sub">
          {/* A points or reward round's results never show a dollar, even the trip's, but for a reward round's side bets for money */}
          {played && st.money.length && onTab(round) ? (allIn != null ? `All in, ${allInText(allIn)} on the trip. ` : `${upDown(net)} on the trip. `) : ''}
          {playForOf(round).kind === 'reward' ? (onTab(round) ? 'Its side bets for money count in the trip’s money. The reward doesn’t.' : 'Played for a reward, so it adds nothing to the trip’s money.')
            : !countsMoney(round) ? (st.pointsOnly ? 'It’s in the trip’s points standings.' : 'Played for points, so it adds nothing to the trip’s money.')
            : st.phase === 'ready' ? 'Settle the trip is open.' : st.phase === 'square' ? 'The trip is settled.' : 'Nothing’s paid until the trip is done, then it’s settled once.'}
        </div>
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}

/** "Count it for the trip?" in setup and at the roll call: on by default when it fits. */
export function CountForTrip({ trip, on, onChange }) {
  if (!trip) return null;
  return (
    <div className="trip-count">
      <div className="row-main">
        <div className="toggle-lbl" id="trip-count-lbl">Count it for {trip.name}?</div>
        <div className="toggle-sub">{on ? 'It goes in the trip’s standings and settles with the trip.' : 'It stays a round of its own.'}</div>
      </div>
      <Toggle on={on} onChange={onChange} labelledBy="trip-count-lbl" />
    </div>
  );
}

/** A quiet way in from setup and the Tab when no trip is on. */
export function StartTripLink({ onMade, className = 'text-link' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><Icon name="suitcase-rolling" /> Going on a golf trip? Start a trip</button>
      <TripSheet open={open} onClose={() => setOpen(false)} onDone={t => { setOpen(false); onMade?.(t); }} />
    </>
  );
}

const plusDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};

/**
 * Start a trip, or edit one (`trip`): its name, first and last day and where (optional), then
 * who's going (optional, picked from Players). Rounds started in those dates ask to count for it.
 * `onDone(trip)` after saving.
 */
export function TripSheet({ open, onClose, onDone, trip = null }) {
  return (
    <AtScreen>
      <Sheet open={open} onClose={onClose} title={trip ? 'Edit the trip' : 'Start a trip'}>
        {open && <TripForm trip={trip} onDone={onDone} />}
      </Sheet>
    </AtScreen>
  );
}

/** Opened from inside a card or the scrolling list, the sheet still covers the whole screen (as in TabCard.jsx). */
export function AtScreen({ children }) {
  const [target, setTarget] = useState(null);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen')); }, []);
  return <><span ref={ref} hidden />{target && createPortal(children, target)}</>;
}

function TripForm({ trip, onDone }) {
  const { showToast } = useUI();
  const nav = useNav();
  const state = useStore();
  const today = isoDate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(trip?.name || '');
  const [start, setStart] = useState(trip?.start || today);
  const [end, setEnd] = useState(trip?.end || plusDays(trip?.start || today, 2));
  const [where, setWhere] = useState(trip?.where || '');
  const [people, setPeople] = useState(() => trip?.people || []);
  const [format, setFormat] = useState(trip?.format || 'money');
  const [cup, setCup] = useState(() => cleanCup(trip?.cup));
  // Trip Mode (trip-templates.js): a Ryder Cup weekend's size, and the schedule it starts from
  const [template, setTemplate] = useState(() => trip?.cup?.schedule?.size || null);
  const [schedule, setSchedule] = useState(() => cleanCup(trip?.cup).schedule || null);
  const [flightsOn, setFlightsOn] = useState(() => !!trip?.flights);
  const ok = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  const isCup = format === CUP_FORMAT;
  // Who can be on a team: you and who's going, as this phone has them
  const me = trip?.by || state.me;
  const pool = [me, ...people.filter(id => id !== me)].map(id => state.players[id]).filter(Boolean).map(p => ({ id: p.id, name: p.name, index: p.index ?? null }));
  const going = new Set(pool.map(p => p.id));
  // Someone taken off Who's going comes off their team too
  const teams = cup.teams.map(t => t.filter(p => going.has(p.id)));
  const cupNow = { ...cup, teams, captains: cup.captains.map(c => (going.has(c) ? c : null)) };
  // A live draft (draft.js) starts with just the captains: the rest is picked on their phones
  // Editing: only while that draft is still going (just the captains on the teams); after it, the teams are the trip's like any
  const liveOk = !trip || (!!trip.cup?.draft?.live && cleanCup(trip.cup).teams.flat().length <= 2);
  const live = cupNow.pick === 'draft' && cupNow.draft?.live && liveOk;
  const teamsOk = live ? !!(cupNow.captains[0] && cupNow.captains[1]) : teams[0].length > 0 && teams[1].length > 0;
  const sched = isCup ? schedule : null;
  const perTeam = Math.max(1, Math.floor(pool.length / 2));
  const schedProblem = sched && !live ? scheduleProblem(sched, teams.map(t => t.map(p => p.id))) : null;
  const pickTemplate = size => {
    setTemplate(size);
    if (!size) { setSchedule(null); return; }
    const t = ryderTemplate(size);
    setSchedule(t);
    setFormat(CUP_FORMAT);
    setEnd(plusDays(start, t.days.length - 1));
    if (!name.trim()) setName('Ryder Cup weekend');
  };
  const onSchedule = next => {
    setSchedule(next);
    // The trip runs at least as long as its schedule
    const last = plusDays(start, next.days.length - 1);
    if (end < last) setEnd(last);
  };
  const toTeams = () => {
    // First time on Teams: balanced by handicap to start from
    if (!cup.teams.flat().length) setCup(c => ({ ...c, pick: 'balance', teams: balanceTeams(pool) }));
    setStep(2);
  };
  const save = () => {
    if (!ok || (isCup && !teamsOk)) return;
    const last = end < start ? start : end;
    const cupOut = isCup || trip?.cup ? cleanCup({ ...cupNow, ...(sched ? { schedule: sched } : { schedule: null }) }) : null;
    // Handicap flights (flights.js) are set now, from everyone's index today
    // (an edit keeps them as they were while the same people are going, so a changed index moves nobody)
    const sameFlights = trip?.flights && JSON.stringify(trip.flights.flat().map(p => p.id).sort()) === JSON.stringify(pool.map(p => p.id).sort());
    const flights = !flightsOn || pool.length < 2 ? null : sameFlights ? trip.flights : flightsOf(pool).map(f => f.map(p => ({ id: p.id, name: p.name })));
    if (trip) {
      const before = trip.cup ? JSON.stringify([cleanCup(trip.cup).teams, cleanCup(trip.cup).schedule]) : '';
      editTrip(trip.id, { name: name.trim().slice(0, 32), start, end: last, where: where.trim().slice(0, 32) || null, people, format, flights, ...(cupOut ? { cup: cupOut } : {}) });
      // The teams or the schedule changed: the schedule's rounds not shared yet are planned again
      const after = cupOut ? JSON.stringify([cupOut.teams, cupOut.schedule || null]) : '';
      const r = cupOut?.schedule && before !== after && scheduledPlans(getState(), trip.id).length ? makeScheduledRounds(trip.id, { redo: true }) : null;
      showToast(r && !r.problem ? `Trip updated. ${r.made} round${r.made === 1 ? '' : 's'} planned again from the teams.` : 'Trip updated');
      onDone?.(trip);
      return;
    }
    const t = makeTrip({ name, start, end: last, where, people, format, cup: cupOut, flights });
    if (live) {
      startDraft(t.id, { order: cupOut.draft?.order, first: cupOut.draft?.first, here: cupOut.captains.map(c => c === state.me) });
      showToast(`${t.name} is on. Send each captain their link`);
      onDone?.(t);
      nav.push('draft', { id: t.id });
      return;
    }
    const r = cupOut?.schedule ? makeScheduledRounds(t.id) : null;
    showToast(r?.made ? `${t.name} is on. ${r.made} round${r.made === 1 ? ' is' : 's are'} planned, day by day, with their matches` : `${t.name} is on`);
    onDone?.(t);
  };
  const steps = isCup ? ['Trip', 'Who’s going', 'Teams', ...(sched ? ['Schedule'] : [])] : ['Trip', 'Who’s going'];
  // A step that went away (the schedule taken out, or the format changed) lands on the last one left
  const at = Math.min(step, steps.length - 1);
  const saveBtn = (
    <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok || (isCup && !teamsOk)} onClick={save}>{trip ? 'Save changes' : live ? 'Start the trip and the draft' : 'Start the trip'} <Icon name={trip ? 'check' : 'arrow-right'} /></button>
  );
  return (
    <div className="block trip-form">
      <Steps steps={steps} current={at} canGo={i => i === 0 || (ok && (i < 2 || (pool.length >= 2 && (i < 3 || teamsOk))))} onGo={i => (i === 2 && at < 2 ? toTeams() : setStep(i))} />
      {at === 0 && (
        <>
          {!trip && (
            <>
              <div className="field-label">Start from a template</div>
              <TemplatePick value={template} onPick={pickTemplate} />
            </>
          )}
          <label className="field-label" htmlFor="trip-name">Name</label>
          <input id="trip-name" className="text-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Bandon 2026" autoFocus={!trip && !template} />
          <div className="trip-form-days">
            <div>
              <label className="field-label" htmlFor="trip-start">First day</label>
              <input id="trip-start" className="text-input" type="date" value={start} onChange={e => {
                const v = e.target.value;
                setStart(v);
                const need = sched ? plusDays(v, sched.days.length - 1) : v;
                if (end < need) setEnd(need);
              }} />
            </div>
            <div>
              <label className="field-label" htmlFor="trip-end">Last day</label>
              <input id="trip-end" className="text-input" type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <label className="field-label" htmlFor="trip-where">Where <span className="opt">(optional)</span></label>
          <input id="trip-where" className="text-input" value={where} onChange={e => setWhere(e.target.value)} maxLength={32} placeholder="Bandon Dunes Resort" />
          {!template && (
            <>
              <div className="field-label">How it’s played</div>
              <Segmented label="How the trip is played" className="press-mode-row" btn="pm-btn" value={format} onChange={setFormat}
                options={[{ value: 'money', label: 'Money' }, { value: CUP_FORMAT, label: 'Team points' }]} />
            </>
          )}
          <p className="field-help">{template
            ? `A Ryder Cup weekend for ${template}: two teams of ${template / 2}, ${sched.days.length} days of four-ball, foursomes and singles, 1 point a match. You pick the teams next, then change the schedule if you like, and every round is planned with its matches. Each round keeps its own bets too.`
            : isCup
              ? `${TRIP_FORMATS[CUP_FORMAT].name}: two teams play matches in every round, 1 point a win and ½ a halved match, with a team score and a leaderboard. Each round keeps its own games and bets, and it’s all settled once, right after the last round.`
              : `${TRIP_FORMATS.money.name}: each round keeps its own games and bets, everyone on the trip sees the standings, and it’s settled once, in the fewest payments, right after the last round.`} Rounds started in these dates ask to count for it.</p>
          <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok} onClick={() => setStep(1)}>Next <Icon name="arrow-right" /></button>
        </>
      )}
      {at === 1 && (
        <>
          {template && (
            <p className={`hint-card tm-count ${pool.length === template ? 'ok' : ''}`} role="status">
              <Icon name={pool.length === template ? 'check-circle' : 'users-three'} fill /> {pool.length === template ? `All ${template} picked, you included.` : `The template is for ${template}: you and ${template - 1} friends. You have ${pool.length} so far.`}{pool.length !== template && pool.length >= 2 ? ' Any even number works: the schedule fits the teams you pick.' : ''}
            </p>
          )}
          <WhoGoing picked={people} onChange={setPeople} quickAdd={!!template || isCup} />
          <div className="trip-count tm-flights">
            <div className="row-main">
              <div className="toggle-lbl" id="trip-flights-lbl">Handicap flights</div>
              <div className="toggle-sub">{flightsOn ? `Everyone sorted into ${FLIGHT_NAMES.slice(0, flightsOf(pool).length).join(', ')} by index today, with a net leaderboard for each flight on the trip.` : 'A, B, C and D by handicap index, each with its own net leaderboard, so everyone has someone to beat.'}</div>
            </div>
            <Toggle on={flightsOn} onChange={setFlightsOn} labelledBy="trip-flights-lbl" />
          </div>
          {isCup
            ? <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok || pool.length < 2} onClick={toTeams}>Next: the teams <Icon name="arrow-right" /></button>
            : <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok} onClick={save}>{trip ? 'Save changes' : 'Start the trip'} <Icon name={trip ? 'check' : 'arrow-right'} /></button>}
          {isCup && pool.length < 2 && <p className="field-help">Pick at least one friend to make two teams.</p>}
        </>
      )}
      {at === 2 && isCup && (
        <>
          <TeamsPicker people={pool} value={cupNow} onChange={setCup} live={liveOk} />
          {sched
            ? <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok || !teamsOk} onClick={() => setStep(3)}>Next: the schedule <Icon name="arrow-right" /></button>
            : saveBtn}
          {!teamsOk && <p className="field-help">{live ? 'Pick both captains.' : 'Each team needs at least one player.'}</p>}
          {isCup && !sched && !trip && <button type="button" className="link-btn" onClick={() => { setSchedule(ryderTemplate(TEMPLATE_SIZES.includes(pool.length) ? pool.length : 8)); }}><Icon name="calendar-plus" /> Plan every round from a schedule</button>}
        </>
      )}
      {at === 3 && sched && (
        <>
          <ScheduleEditor schedule={sched} onChange={onSchedule} perTeam={live ? perTeam : Math.max(teams[0].length, teams[1].length) || perTeam} start={start} />
          {schedProblem && <p className="hint-card warn" role="status"><Icon name="warning" fill /> {schedProblem} The trip still starts, and you can plan the rounds from its page once the teams work.</p>}
          {live && <p className="field-help">Every round is planned with its matches as soon as the draft is done.</p>}
          {saveBtn}
          {!trip && <button type="button" className="link-btn center" onClick={() => { setSchedule(null); setTemplate(null); setStep(2); }}>No schedule: plan the rounds yourself</button>}
        </>
      )}
    </div>
  );
}

/**
 * "Who's going?": your players, ticked or not. Optional: anyone who plays a trip round is on it anyway.
 * `quickAdd`: a name box to add someone new to your players and tick them, for a big trip.
 */
function WhoGoing({ picked, onChange, quickAdd = false }) {
  const state = useStore();
  const [newName, setNewName] = useState('');
  const list = sortedPlayers(state).filter(p => p.id !== state.me);
  const on = new Set(picked);
  const flip = id => onChange(on.has(id) ? picked.filter(x => x !== id) : [...picked, id]);
  const add = () => {
    const n = newName.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!n) return;
    const same = list.find(p => p.name.trim().toLowerCase() === n.toLowerCase());
    const id = same?.id || uid('p_');
    if (!same) update(s => { s.players[id] = { id, name: n, index: null, venmo: '', createdAt: Date.now() }; });
    if (!on.has(id)) onChange([...picked, id]);
    setNewName('');
  };
  return (
    <>
      <p className="field-help">Optional. Picked friends show in the standings before anyone plays, and rounds with them in it count for the trip by default. Anyone who plays a round for the trip is on it too.</p>
      {list.length === 0 && !quickAdd && <p className="field-help">Add friends on Players to pick them here, or skip this: whoever plays a trip round is on the trip.</p>}
      <div className="trip-who">
        {list.map(p => (
          <button key={p.id} type="button" className="sheet-item" aria-pressed={on.has(p.id)} onClick={() => flip(p.id)}>
            <span><Icon name={on.has(p.id) ? 'check-square' : 'square'} fill={on.has(p.id)} /><Avatar id={p.id} name={p.name} /> {p.name}</span>
            {p.index != null && <span className="tm-who-hc">{p.index}</span>}
          </button>
        ))}
      </div>
      {quickAdd && (
        <form className="tm-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <label className="sr-only" htmlFor="trip-add-name">Add someone new</label>
          <input id="trip-add-name" className="text-input" value={newName} onChange={e => setNewName(e.target.value)} maxLength={24} placeholder="Add someone new" autoComplete="off" />
          <button type="submit" className="pill-btn" disabled={!newName.trim()}><Icon name="plus" /> Add</button>
        </form>
      )}
      {quickAdd && <p className="field-help">Someone new is saved to your players with no handicap. Add their index on Players to balance the teams by it.</p>}
    </>
  );
}

/** Everyone on a trip, one avatar each, with whether they're square: for the settled trip. */
export function SquareFaces({ ids, state, me }) {
  return (
    <div className="trip-faces">
      {ids.map(id => (
        <div key={id} className="tf-face">
          <Avatar id={id} name={id === me ? (nameOf(state, id) || 'You') : nameOf(state, id)} />
          <span className="tf-tag">{id === me ? 'You' : first(nameOf(state, id))}</span>
        </div>
      ))}
    </div>
  );
}
