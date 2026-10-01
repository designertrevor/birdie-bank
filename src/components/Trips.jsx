// The trip's pieces outside its own page: the card on the Tab, the card on Up next (with the
// trip's planned rounds grouped under it), the line on a trip round's results, "Count it for the
// trip?" in setup, and the sheet that starts or edits a trip.
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Sheet, Toggle, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { placeOf } from '../lib/format.js';
import { dayLabel, isoDate, timeLabel } from '../lib/plans.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { TRIP_FORMATS, myTripNet, startsLine, tripChips, tripDates, tripStatus, upDown } from '../lib/trips.js';
import { countsMoney, playForOf } from '../lib/play-for.js';
import { editTrip, makeTrip } from '../lib/trip-store.js';

const first = name => String(name || '').trim().split(/\s+/)[0];

/** "1st", "2nd", "3rd", "4th". */
function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
}

/** Where you stand on the trip in a few words: "You’re 2nd, up $12". */
function standingLine(state, st) {
  const me = canonicalOf(state)(state.me);
  const i = st.standings.findIndex(p => p.id === me);
  if (i < 0) return null;
  const v = st.standings[i].amount;
  const place = placeOf(st.standings, i);
  const tied = st.standings.filter(p => p.amount === v).length > 1;
  const upOrDown = v > 0 ? `up ${money(v)}` : v < 0 ? `down ${money(-v)}` : 'even';
  return `You’re ${tied ? 'tied for ' : ''}${ordinal(place)}, ${upOrDown}`;
}

/** The eyebrow over a trip: where it's at. */
function tripEyebrow(st) {
  if (st.phase === 'soon') return `Trip · ${tripDates(st.trip)}`;
  if (st.phase === 'ready') return 'Trip · ready to settle';
  if (st.phase === 'square') return 'Trip · all square';
  return st.day ? `Trip · Day ${st.day} of ${st.days}` : `Trip · ${tripDates(st.trip)}`;
}

const roundsLine = n => `${n} round${n === 1 ? '' : 's'}`;

/**
 * The trip's card on the Tab. Trip money is already in each person's total below it; the card is
 * the trip's own view of it, one tap from the standings and Settle the trip.
 */
export function TripTabCard({ status: st }) {
  const nav = useNav();
  const state = useStore();
  const net = myTripNet(state, st);
  const n = st.plan.length;
  const sub = st.phase === 'soon' ? startsLine(st.trip.start)
    : st.pointsOnly ? `${roundsLine(st.done.length)}${st.phase === 'on' ? ' so far' : ''} · played for points`
    : st.phase === 'ready' ? `${n} payment${n === 1 ? '' : 's'} square${n === 1 ? 's' : ''} the trip · ${st.payments.length} paid so far`
    : st.phase === 'square' ? `${roundsLine(st.done.length)} · settled`
    : `${roundsLine(st.done.length)} so far · settle after the last round`;
  const played = st.standings.some(p => p.id === canonicalOf(state)(state.me));
  return (
    <button className="trip-card on-tab" onClick={() => nav.push('trip', { id: st.trip.id })} aria-label={`${st.trip.name}. ${sub}${played && st.money.length ? `. ${upDown(net)}` : ''}. See the trip`}>
      <div className="row-main">
        <div className="eyebrow">{tripEyebrow(st)}</div>
        <div className="trip-name d">{st.trip.name}</div>
        <div className="trip-sub">{sub}</div>
      </div>
      {played && st.money.length > 0 && (
        <div className="trip-amt-col">
          <div className={`trip-amt d ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{money(net, { sign: true })}</div>
          <div className="trip-amt-sub">{st.phase === 'square' ? (net > 0 ? 'won' : net < 0 ? 'lost' : 'even') : 'so far'}</div>
        </div>
      )}
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
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
  const line = st.money.length ? standingLine(state, st) : null;
  const next = st.planned[0];
  const title = st.phase === 'soon' ? startsLine(st.trip.start)
    : st.phase === 'ready' ? (line ? `That’s the trip. ${line.replace('You’re ', 'You finished ')}` : 'That’s the trip')
    : st.phase === 'square' ? (st.pointsOnly ? 'That’s the trip' : 'All square on the trip')
    : line || `${roundsLine(st.done.length)} played`;
  return (
    <>
      <div className="sec-label">Your trip</div>
      <button className="trip-card" onClick={() => nav.push('trip', { id: st.trip.id })} aria-label={`${st.trip.name}. ${title}. See the trip`}>
        <div className="row-main">
          <div className="eyebrow">{st.trip.name}{st.day ? ` · Day ${st.day} of ${st.days}` : ` · ${tripDates(st.trip)}`}</div>
          <div className="trip-name d">{title}</div>
          <TripDays status={st} />
          {next && <div className="trip-sub">Next: {dayLabel(next.date)}{next.teeTime ? ` ${timeLabel(next.teeTime)}` : ''} · {next.course?.name || 'Course to be set'}</div>}
          {st.phase === 'ready' && <div className="trip-sub strong">Settle the trip <Icon name="arrow-right" /></div>}
        </div>
        <span className="chevron"><Icon name="caret-right" /></span>
      </button>
      {st.planned.map(renderPlan)}
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
  if (last && st.money.length && countsMoney(round)) {
    return (
      <div className="trip-card wrap-up">
        <div className="eyebrow">That’s the trip</div>
        <div className="trip-name d">{st.trip.name} is in the books</div>
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
  return (
    <button className="trip-card note" onClick={open} aria-label={`Counts for ${st.trip.name}. See the trip`}>
      <div className="row-main">
        <div className="eyebrow">Counts for {st.trip.name}</div>
        <div className="trip-sub">
          {/* A points or reward round's results never show a dollar, even the trip's */}
          {played && st.money.length && countsMoney(round) ? `${upDown(net)} on the trip. ` : ''}
          {playForOf(round).kind === 'reward' ? 'Played for a reward, so it adds nothing to the trip’s money.'
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
 * Start a trip, or edit one (`trip`): its name, first and last day, and where (optional). Rounds
 * started in those dates ask to count for it. `onDone(trip)` after saving.
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
function AtScreen({ children }) {
  const [target, setTarget] = useState(null);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen')); }, []);
  return <><span ref={ref} hidden />{target && createPortal(children, target)}</>;
}

function TripForm({ trip, onDone }) {
  const { showToast } = useUI();
  const today = isoDate();
  const [name, setName] = useState(trip?.name || '');
  const [start, setStart] = useState(trip?.start || today);
  const [end, setEnd] = useState(trip?.end || plusDays(trip?.start || today, 2));
  const [where, setWhere] = useState(trip?.where || '');
  const ok = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  const save = () => {
    if (!ok) return;
    const last = end < start ? start : end;
    if (trip) {
      editTrip(trip.id, { name: name.trim().slice(0, 32), start, end: last, where: where.trim().slice(0, 32) || null });
      showToast('Trip updated');
      onDone?.(trip);
      return;
    }
    const t = makeTrip({ name, start, end: last, where });
    showToast(`${t.name} is on`);
    onDone?.(t);
  };
  return (
    <div className="block trip-form">
      <label className="field-label" htmlFor="trip-name">Name</label>
      <input id="trip-name" className="text-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Bandon 2026" autoFocus={!trip} />
      <div className="trip-form-days">
        <div>
          <label className="field-label" htmlFor="trip-start">First day</label>
          <input id="trip-start" className="text-input" type="date" value={start} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
        </div>
        <div>
          <label className="field-label" htmlFor="trip-end">Last day</label>
          <input id="trip-end" className="text-input" type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <label className="field-label" htmlFor="trip-where">Where <span className="opt">(optional)</span></label>
      <input id="trip-where" className="text-input" value={where} onChange={e => setWhere(e.target.value)} maxLength={32} placeholder="Bandon Dunes Resort" />
      <p className="field-help">{TRIP_FORMATS.money.name}: each round keeps its own games and bets, everyone on the trip sees the standings, and it’s settled once, right after the last round. Rounds started in these dates ask to count for it.</p>
      <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok} onClick={save}>{trip ? 'Save changes' : 'Start the trip'} <Icon name={trip ? 'check' : 'arrow-right'} /></button>
    </div>
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
