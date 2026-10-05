// A trip: everyone's standings across its rounds, the rounds themselves, money by game and the
// trip's expenses (gas, dinner, the house); then Settle the trip, once, right after the last round
// (or someone's part, for a friend leaving early), for the rounds and the expenses together, from
// the one plan the organizer's phone publishes so every phone shows the same payments. Trip money
// is already in each person's total on the Tab, so paying here pays the Tab too. Only the
// organizer edits, deletes or says "Done playing"; anyone can hide the trip from their own Tab and
// Up next. See trips.js, trip-plan.js and trip-expenses.js for how it's all worked out.
import { useEffect, useState } from 'react';
import { Empty, Header, Icon, PickRow, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton } from '../components/Pay.jsx';
import { RoundRow } from '../components/RoundRow.jsx';
import { SquareFaces, TripDays, TripSheet } from '../components/Trips.jsx';
import { TripExpensesView } from '../components/TripExpenses.jsx';
import { getState, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { useKept } from '../lib/kept.js';
import { holeComplete } from '../lib/round.js';
import { gameLabel, placeOf } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { PAY_APPS, payInfoFor } from '../lib/pay.js';
import { points } from '../lib/play-for.js';
import { dayLabel, whenLabel } from '../lib/plans.js';
import { plansByDay } from '../lib/trip-templates.js';
import { DraftCard, FlightsView, ScheduleCard } from '../components/TripMode.jsx';
import { buzz } from '../lib/delight.js';
import { allTripPays } from '../lib/trip-expenses.js';
import { markTripPayment, undoPayments, usePaymentsOff, useTabSync } from '../lib/tab-sync.js';
import { TRIP_FORMATS, canDeleteTrip, canMarkLine, canRecount, myTripAllIn, myTripNet, partPlan, roundsInDates, tripByGame, tripDates, tripHidden, tripOf, tripStatus, upDown } from '../lib/trips.js';
import { deleteTrip, endTrip, hideTrip, seenTripPlan, setRoundTrip } from '../lib/trip-store.js';
import { plansOn, useTripPlans } from '../lib/trip-plan-sync.js';
import { CupBoard, CupMatches, CupScore, StakeLines } from '../components/Cup.jsx';
import { useCupSync } from '../lib/cup-sync.js';
import { useDraftSync } from '../lib/draft-sync.js';
import { cupHeadline } from '../lib/cup.js';
import { BIG_FORMAT } from '../lib/big-game.js';
import BigGame from './BigGame.jsx';

const first = name => String(name || '').trim().split(/\s+/)[0];
const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

/** Once you've looked, the trip's payments stop saying "Updated" (when you leave the screen). */
function useSeenPlan(id, version) {
  useEffect(() => () => seenTripPlan(id, version), [id, version]);
}

/** Whose phone the trip's payments come from, for the words: "Sam’s phone", or "the organizer’s phone". */
const theirPhone = st => (st.organizer ? 'your phone' : st.published.byName ? `${st.published.byName}’s phone` : 'the organizer’s phone');

/** "You’re owed $40", "You owe $12" or "You’re square": your whole trip, all in. */
const owedLine = v => (v > 0 ? `You’re owed ${money(v)}` : v < 0 ? `You owe ${money(-v)}` : 'You’re square');

/** Who "you" are to the trip, and a name for anyone on it. */
function useWho(state) {
  const me = canonicalOf(state)(state.me);
  return { me, label: id => (id === me ? 'You' : nameOf(state, id)), short: id => (id === me ? 'You' : first(nameOf(state, id))) };
}

// The taps from Up next whose Add an expense sheet has been and gone, so coming back to the trip
// (from a round, say) doesn't open it again
const addsDone = new Set();

/**
 * `view`: which part opens first ('cup', 'standings', 'rounds', 'games' or 'expenses'); a team
 * points trip opens on the cup. `add` (the tap's time) opens Add an expense, once.
 */
export default function Trip(props) {
  // A Big Game is a one-day trip with a page of its own (BigGame.jsx)
  const format = useStore(s => tripOf(s, props.id)?.format);
  if (format === BIG_FORMAT) return <BigGame id={props.id} />;
  return <TripPage {...props} />;
}

function TripPage({ id, view: firstView = null, add = false }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  // Payments from Settle the trip ride on the trip's shared rounds, and its plan on the server: keep them fresh
  useTabSync({ live: true });
  useTripPlans();
  // A team points trip's matches from other groups' phones (cup-sync.js)
  useCupSync();
  const [pickedView, setView] = useKept('trip:view', firstView);
  const [editing, setEditing] = useState(false);
  const [counting, setCounting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Opened to add an expense (from Up next): only the first time the Expenses view shows
  const [adding, setAdding] = useState(() => !!add && !addsDone.has(add));
  const st = tripStatus(state, id);
  const { me, label, short } = useWho(state);
  useSeenPlan(id, st?.published.version || 0);
  // A live captains' draft still going (draft-sync.js): keep up with it here too, so the organizer's
  // phone puts the teams on the trip as soon as the last pick is in
  useDraftSync(st?.cup?.def?.draft?.live && st.cup.def.teams.flat().length <= 2 ? id : null);
  if (!st) {
    return <Screen><Header title="Trip" small onBack={nav.pop} /><div className="scroll"><Empty title="This trip is gone" text="Its rounds and their money are still in History and on the Tab." action={<button className="ec" onClick={nav.pop}>Go back</button>} /></div></Screen>;
  }
  const { trip } = st;
  const cup = st.cup;
  const view = pickedView === 'cup' && !cup ? 'standings' : pickedView || (cup ? 'cup' : 'standings');
  const played = st.standings.some(p => p.id === me);
  const net = myTripNet(state, st);
  const allIn = myTripAllIn(state, st);
  // In an expense: your whole trip, the rounds and the expenses
  const inExpenses = st.spending.has(me);
  const myPoints = st.points?.[me] ?? null;
  // Only the organizer deletes, and only before any trip money is paid. A finished round shared
  // live keeps the trip on friends' phones, so that needs trip plans on the server to tell them
  const del_ = canDeleteTrip(state, st, { plansOn: plansOn() });
  const hidden = tripHidden(state, id);

  const eyebrow = st.phase === 'soon' ? `Starts ${tripDates(trip)}`
    : st.phase === 'ready' ? 'That’s the trip'
    : st.phase === 'square' ? 'All square'
    : `${st.day ? `Day ${st.day} of ${st.days} · ` : ''}${st.done.length} round${st.done.length === 1 ? '' : 's'} done`;
  const cupOn = cup && (cup.score.done > 0 || cup.score.live.length > 0);
  // A cup or a trip played for points keeps its score up top, with the expenses' dollars under it
  const big = st.hasMoney && played ? upDown(net)
    : cupOn ? cupHeadline(cup)
    : myPoints != null ? `You’re on ${points(myPoints, { sign: true })}`
    : inExpenses ? owedLine(allIn)
    : st.phase === 'soon' ? 'Nothing played yet' : st.done.length ? 'No money on it yet' : 'Nothing played yet';
  const scoreUp = cupOn || myPoints != null;
  const bigSign = st.hasMoney && played ? sign(net) : scoreUp ? '' : inExpenses ? sign(allIn) : '';
  // With expenses too, the whole trip under the rounds' money (or the expenses under the score)
  const allInLine = !inExpenses ? null
    : st.hasMoney && played ? `All in with expenses, ${owedLine(allIn).replace(/^You/, 'you')}`
    : scoreUp ? `For the expenses, ${owedLine(allIn).replace(/^You/, 'you')}` : null;
  const settles = st.expenses.length ? 'the rounds and the expenses' : 'the whole trip';
  const askExpenses = !st.expenses.length ? ' Add gas, dinner and the house under Expenses and they settle with it.' : '';
  // The stake's lines with someone this phone can't place are marked paid on the trip; the rest are in the plan (cup-stake.js)
  const stakeOpen = cup ? cup.lines.filter(l => l.open > 0 && !l.onTab).length : 0;
  const settleCount = st.plan.length + stakeOpen;
  const hint = cup && st.phase === 'ready' ? `${cupHeadline(cup)}. ${settleCount} payment${settleCount === 1 ? '' : 's'} square${settleCount === 1 ? 's' : ''} the trip${cup.stakeOn ? ', the cup stake included' : ''}.${st.money.length || st.expenses.length || cup.stakeOn ? ' The trip’s money is already in each person’s total on the Tab, so paying here pays the Tab too.' : ''}`
    : cup && st.phase === 'square' ? `${cupHeadline(cup)}. Everyone’s square on the trip.`
    : cup && (st.phase === 'on' || st.phase === 'soon') && !st.money.length ? `Every round counted for the trip adds its matches to the cup. ${cup.def.stake ? `${money(cup.def.stake)} a person is on the cup, paid once the trip is over.` : 'Each round keeps its own bets, if it has any.'}${askExpenses}`
    : st.pointsOnly ? 'Played for points, so there’s nothing to pay. Everyone on the trip sees the standings.'
    : st.published.status === 'stale' && (st.money.length || st.expenses.length) ? `A round, a score or an expense changed, so the trip’s payments are being worked out again on ${theirPhone(st)}. Until then the Tab keeps the trip’s money pair by pair.`
    : st.phase === 'ready' ? `${st.plan.length} payment${st.plan.length === 1 ? '' : 's'} square${st.plan.length === 1 ? 's' : ''} ${settles}${st.published.status === 'live' ? ', the same on every phone' : ''}. Trip money is already in each person’s total on the Tab, so paying here pays the Tab too.`
    : st.phase === 'square' ? 'Everyone’s square on the trip.'
    : st.phase === 'soon' ? `Rounds you start from ${tripDates(trip)} ask to count for the trip. Plan them now so everyone can answer.${askExpenses}`
    : `Nothing’s paid yet. Settle the trip opens after the last round, once for the whole trip. Trip money is already in each person’s total on the Tab.${askExpenses}`;
  const anyMoney = st.money.length > 0 || st.expenses.length > 0;

  const del = async () => {
    if (!(await ask({ title: `Delete ${trip.name}?`, text: `Its rounds stay in History and their money stays on the Tab. They just stop being a trip${del_.everywhere ? ', on everyone’s phone' : ''}.`, confirmLabel: 'Delete the trip', danger: true }))) return;
    if (await deleteTrip(id, { everywhere: del_.everywhere })) nav.pop();
    else showToast('Couldn’t reach the other phones. Try again with signal.');
  };
  const doneNow = () => {
    endTrip(id);
    showToast(cup && !st.money.length && !cup.def.stake ? 'The cup is decided' : 'Settle the trip is open');
  };
  const hide = () => {
    hideTrip(id, !hidden);
    showToast(hidden ? 'Back on your Tab and Up next' : `${trip.name} is off your Tab and Up next. Your rounds and money stay as they are.`);
  };

  return (
    <Screen>
      <Header title={trip.name} small onBack={nav.pop} right={st.organizer ? <button className="header-btn" onClick={() => setEditing(true)}><Icon name="pencil-simple" /> Edit</button> : null} />
      <div className="scroll">
        <div className="trip-hero">
          <div className="eyebrow pink">{eyebrow}{st.published.updated && <> <span className="trip-updated">Updated</span></>}</div>
          <div className={`tab-big d ${bigSign}`}>{big}</div>
          {allInLine && <div className={`trip-allin ${sign(allIn)}`}>{allInLine}</div>}
          <div className="trip-sub">{[tripDates(trip), trip.where].filter(Boolean).join(' · ')}</div>
          <TripDays status={st} />
        </div>
        <p className="hint-card"><Icon name={st.phase === 'square' ? 'handshake' : 'suitcase-rolling'} fill /> {hint}</p>

        <div className="tab-view">
          <Segmented label="Trip view" className="press-mode-row trip-views" btn="pm-btn" value={view} onChange={setView}
            options={[...(cup ? [{ value: 'cup', label: 'Cup' }] : []), { value: 'standings', label: cup ? (st.points && !st.standings.length ? 'Points' : 'Money') : 'Standings' }, { value: 'rounds', label: 'Rounds' }, { value: 'games', label: 'Games' }, { value: 'expenses', label: 'Expenses' }]} />
        </div>

        {view === 'cup' && cup && (
          <>
            <DraftCard st={st} />
            <CupScore cup={cup} />
            <div className="sec-label">Matches</div>
            <CupMatches cup={cup} />
            <div className="sec-label">Leaderboard</div>
            <CupBoard cup={cup} />
            {cupOn && <button className="text-link" onClick={() => nav.push('share', { kind: 'cup', id })}><Icon name="share-network" /> Share the cup</button>}
            <ScheduleCard st={st} onRounds={() => setView('rounds')} />
            <FlightsView st={st} />
            <p className="field-help pad">{cup.entries.some(e => !e.local) ? 'Other groups’ matches come from their phones. ' : ''}A match is worked out from the round’s own scores and strokes, whatever game the round plays. A round that ends early goes to whoever led on the holes played.</p>
          </>
        )}

        {view === 'standings' && <Standings st={st} state={state} label={label} me={me} />}
        {view === 'standings' && (st.standings.length > 0 || !!st.points) && (
          <button className="text-link" onClick={() => nav.push('share', { kind: 'trip', id })}><Icon name="share-network" /> Share the standings</button>
        )}
        {view === 'standings' && !cup && <FlightsView st={st} />}
        {view === 'rounds' && (
          <>
            {st.rounds.length === 0 && st.planned.length === 0 && <p className="field-help pad">No rounds yet. Start one at the course, or plan the trip’s rounds so everyone can answer.</p>}
            {[...st.done].reverse().map(r => <RoundRow key={r.id} round={r} state={state} className="card" />)}
            {st.live.map(r => <LiveRow key={r.id} round={r} />)}
            {/* Planned rounds day by day, a Trip Mode schedule's groups under their session (trip-templates.js) */}
            {plansByDay(st.planned).map(d => d.sessions.map(sess => (
              <div key={`${d.date}${sess.key}`}>
                {sess.label && <div className="sec-label">{dayLabel(d.date)} · {sess.label}{sess.worth > 1 ? ` · ${sess.worth} points a match` : ''}</div>}
                {sess.plans.map(p => (
                  <button key={p.id} className="ledger-row trip-plan-row" onClick={() => nav.push('plan', { id: p.id })}>
                    <div className="lr-info">
                      <div className="lr-name" style={{ fontSize: 16 }}>{p.session?.line || p.course?.name || 'Course to be set'}</div>
                      <div className="lr-status">{whenLabel(p)}{p.session?.line ? ` · ${p.course?.name || 'Course to be set'}` : ''}</div>
                    </div>
                    <span className="chevron"><Icon name="caret-right" /></span>
                  </button>
                ))}
              </div>
            )))}
            <button className="add-row" onClick={() => nav.push('newRound', { trip: id })}><div className="add-ci"><Icon name="golf" fill /></div><span className="add-lbl">Start a round for the trip</span></button>
            <button className="add-row" onClick={() => nav.push('newRound', { ahead: true, trip: id })}><div className="add-ci"><Icon name="calendar-plus" /></div><span className="add-lbl">Plan a round for the trip</span></button>
            <button className="text-link" onClick={() => setCounting(true)}><Icon name="list-checks" /> Which rounds count?</button>
          </>
        )}
        {view === 'games' && <Games st={st} state={state} label={label} />}
        {view === 'expenses' && <TripExpensesView st={st} me={me} adding={adding} onAdded={() => { if (add) addsDone.add(add); setAdding(false); }} />}

        <p className="field-help pad">{TRIP_FORMATS[trip.format]?.name || TRIP_FORMATS.money.name}. Each round keeps its own games and bets. Someone who plays only some rounds is on the trip for those rounds.</p>
        {/* Only the organizer deletes; everyone else can hide it from their own Tab and Up next */}
        {del_.ok && <button className="text-link danger" onClick={del}><Icon name="trash" /> Delete the trip</button>}
        {st.organizer && !del_.ok && <p className="field-help pad">{!st.paid.length && st.expenses.length ? 'The trip has expenses, so it stays. Once they’re deleted under Expenses, the trip can be too.' : 'Trip money has been paid, so the trip stays.'} You can still edit its name and dates.</p>}
        {(!st.organizer || hidden) && <button className="text-link" onClick={hide}><Icon name={hidden ? 'eye' : 'eye-slash'} /> {hidden ? 'Show it on your Tab and Up next' : 'Hide this trip'}</button>}
        {!st.organizer && !hidden && <p className="field-help pad">Hiding takes it off your own Tab and Up next. Your rounds and money stay as they are.</p>}
      </div>
      <div className="cta-wrap">
        {st.phase === 'ready' && <button className="full-btn pink" onClick={() => nav.push('tripSettle', { id })}>Settle the trip <Icon name="arrow-right" /></button>}
        {st.phase === 'square' && (st.payments.length > 0 || cup?.marks.length > 0) && <button className="full-btn outline" onClick={() => nav.push('tripSettle', { id })}>See the trip’s payments</button>}
        {(st.phase === 'on' || st.phase === 'soon') && anyMoney && (
          <>
            <button className="full-btn outline" onClick={() => setLeaving(true)}><Icon name="sign-out" /> Leaving early? Settle a part</button>
            {/* The organizer's call: it rides in the trip's plan, so every phone opens Settle the trip together */}
            {st.organizer && !st.live.length && <button className="link-btn center" onClick={doneNow}>Done playing? Settle the trip now</button>}
          </>
        )}
        {/* A team points trip with no round money or expenses (a stake or not): the organizer still says when it's over */}
        {(st.phase === 'on' || st.phase === 'soon') && !anyMoney && cup && st.done.length > 0 && st.organizer && !st.live.length && (
          <button className="link-btn center" onClick={doneNow}>Done playing? Decide the cup now</button>
        )}
        {st.organizer && (st.phase === 'ready' || (st.phase === 'square' && cup && !st.paid.length && !cup.marks.length)) && trip.endedAt && !st.settling.length && <button className="link-btn center" onClick={() => endTrip(id, false)}>Still playing? Reopen the trip</button>}
      </div>
      {st.organizer && <TripSheet open={editing} trip={trip} onClose={() => setEditing(false)} onDone={() => setEditing(false)} />}
      <CountSheet open={counting} onClose={() => setCounting(false)} st={st} />
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Who’s leaving?">
        <p className="field-help pad">Their payments for the rounds{st.expenses.length ? ' and expenses' : ''} so far. Everyone else settles after the last round.</p>
        {st.totals.map(p => (
          <button key={p.id} className="sheet-item" onClick={() => { setLeaving(false); nav.push('tripSettle', { id, who: p.id }); }}>
            <span><Avatar id={p.id} name={nameOf(state, p.id)} /> {p.id === me ? 'Settle my part' : `Settle ${short(p.id)}’s part`}</span>
            <span className={`trip-li-amt ${sign(p.amount)}`}>{money(p.amount, { sign: true })}</span>
          </button>
        ))}
      </Sheet>
    </Screen>
  );
}

/** Everyone's net across the trip, best first, with any round still being played under it. */
function Standings({ st, state, label, me }) {
  if (!st.standings.length && st.points) {
    const rows = Object.entries(st.points).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return <p className="field-help pad">The points fill in as soon as a round is finished.</p>;
    return (
      <div className="trip-table">
        {rows.map(([id, v], i) => (
          <div key={id} className={`trip-row ${id === me ? 'me' : ''}`}>
            <span className="tr-rank">{rows.findIndex(r => r[1] === v) + 1 || i + 1}</span>
            <span className="tr-name">{label(id)}</span>
            <span className={`tr-amt ${sign(v)}`}>{points(v, { sign: true })}</span>
          </div>
        ))}
      </div>
    );
  }
  if (!st.standings.length && st.done.length) {
    // Played only for rewards so far: nothing in dollars or points to add up
    return <p className="field-help pad">Played for rewards so far, so there’s no money to add up. Each round’s results say who’s buying.</p>;
  }
  if (!st.standings.length && st.going.length > 1) {
    // Who's going, before anyone has played: everyone even
    return (
      <>
        <div className="trip-table">
          {st.going.map(id => (
            <div key={id} className={`trip-row ${id === me ? 'me' : ''}`}>
              <span className="tr-rank">–</span>
              <Avatar id={id} name={nameOf(state, id)} />
              <span className="tr-main"><span className="tr-name">{label(id)}</span></span>
              <span className="tr-amt">–</span>
            </div>
          ))}
        </div>
        <p className="field-help pad">Who’s going. The standings fill in as soon as a round is finished, and anyone who plays a round for the trip joins them.</p>
      </>
    );
  }
  if (!st.standings.length) return <p className="field-help pad">The standings fill in as soon as a round is finished.</p>;
  const total = st.done.filter(r => st.money.includes(r)).length;
  return (
    <>
      <div className="trip-table">
        {st.standings.map((p, i) => (
          <div key={p.id} className={`trip-row ${p.id === me ? 'me' : ''}`}>
            <span className="tr-rank">{placeOf(st.standings, i)}</span>
            <Avatar id={p.id} name={nameOf(state, p.id)} />
            <span className="tr-main">
              <span className="tr-name">{label(p.id)}</span>
              {p.rounds < st.done.length && <span className="tr-sub">{p.rounds} of {st.done.length} rounds</span>}
              {p.stake != null && <span className="tr-sub">{money(p.stake, { sign: true })} from the cup</span>}
            </span>
            <span className={`tr-amt ${sign(p.amount)}`}>{money(p.amount, { sign: true })}</span>
          </div>
        ))}
      </div>
      {st.live.map(r => <LiveRow key={r.id} round={r} />)}
      <p className="field-help pad">Finished rounds on this phone{total > 1 ? `, all ${total} of them` : ''}. Adds up to $0 across everyone on the trip. Someone who missed a round sees only the rounds they played, but the payments are the same on every phone.{st.expenses.length ? ' The rounds only: everyone’s total with the expenses is under Expenses.' : ''}</p>
    </>
  );
}

/** A trip round still being played: it counts once it's done. */
function LiveRow({ round }) {
  const nav = useNav();
  const n = round.holes.filter(h => holeComplete(round, h)).length;
  return (
    <button className="ledger-row trip-live" onClick={() => nav.push('play', { id: round.id })}>
      <div className="lr-info">
        <div className="eyebrow pink">Live · {n} of {round.holes.length} holes</div>
        <div className="lr-name" style={{ fontSize: 16 }}>{round.course.name} · {gameLabel(round)}</div>
        <div className="lr-status">Counts for the trip when it’s done</div>
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}

/** Each person's money in each game across the trip's finished rounds. A game someone didn't play shows a dash. */
function Games({ st, state, label }) {
  // A team points trip's stake gets its own column once it's decided, so each row adds up to the trip total
  const { columns, rows } = tripByGame(state, st.trip.id, { stake: st.cup?.stakeBy });
  if (!columns.length) return <p className="field-help pad">Money by game shows up once a round with money on it is finished.</p>;
  const order = st.standings.map(p => p.id).filter(id => rows.has(id));
  return (
    <>
      <div className="block trip-games-wrap">
        <table className="trip-games">
          <thead>
            <tr><th scope="col"><span className="sr-only">Player</span></th>{columns.map(c => <th key={c} scope="col">{c}</th>)}<th scope="col">Trip</th></tr>
          </thead>
          <tbody>
            {order.map(id => {
              const row = rows.get(id);
              const tot = st.standings.find(p => p.id === id)?.amount ?? 0;
              return (
                <tr key={id}>
                  <th scope="row">{label(id) === 'You' ? 'You' : first(label(id))}</th>
                  {columns.map(c => <td key={c} className={c in row ? sign(row[c]) : 'none'}>{c in row ? money(row[c], { sign: true }) : '–'}</td>)}
                  <td className={`tot ${sign(tot)}`}>{money(tot, { sign: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="field-help pad">Finished rounds only. A game someone didn’t play shows –.</p>
    </>
  );
}

/** "Which rounds count?": rounds from the trip's dates, on or off the trip. */
function CountSheet({ open, onClose, st }) {
  const state = useStore();
  const list = open ? roundsInDates(state, st.trip) : [];
  // Once payments have been made from Settle the trip, its rounds stay on it, so the money stays squared
  const locked = st.settling.length > 0;
  return (
    <Sheet open={open} onClose={onClose} title="Which rounds count?">
      <p className="field-help pad">Rounds from {tripDates(st.trip)} on this phone. A round on the trip goes in the standings and settles with the trip. A finished round that was shared live stays as it was set up, so everyone’s phone agrees.{locked ? ' Payments have been made for the trip, so its rounds stay on it.' : ''}</p>
      {list.length === 0 && <p className="field-help pad">No rounds in these dates yet.</p>}
      <div className="pick-list sheet-picks">
        {list.map(r => {
          const on = r.trip?.id === st.trip.id;
          // A finished round shared live stays as it was set up, so every phone in it agrees
          const fixed = !canRecount(state, r);
          return (
            <PickRow key={r.id} on={on} disabled={(on && locked) || fixed} onClick={() => setRoundTrip(r.id, on ? null : st.trip)}
              title={`${r.course.name} · ${gameLabel(r)}`}
              sub={`${new Date(r.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${r.status === 'active' ? ' · being played' : ''}${fixed ? ` · shared live, so it stays ${on ? 'on' : 'off'} the trip` : ''}`} />
          );
        })}
      </div>
      <div className="cta-wrap"><button className="full-btn" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

/**
 * Settle the trip: what's left over just the trip's rounds (the published plan's fewest payments,
 * the same on every phone; before there is one, each pair's net on the shared rounds and the
 * fewest payments for the rest), each with the payee's app, marked paid here. `who`: just that
 * person's part, for someone leaving early. While the plan is being worked out again (a round
 * added, a score fixed) nothing can be marked, so no phone pays what the next version changes.
 */
/** "Ann and Bob", "Ann, Bob and Cal". */
const listNames = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export function TripSettle(props) {
  const format = useStore(s => tripOf(s, props.id)?.format);
  if (format === BIG_FORMAT) return <BigGame id={props.id} view="money" />;
  return <TripSettlePage {...props} />;
}

function TripSettlePage({ id, who = null }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  useTabSync({ live: true });
  useTripPlans();
  useCupSync();
  const off = usePaymentsOff();
  const st = tripStatus(state, id);
  const { me, label, short } = useWho(state);
  useSeenPlan(id, st?.published.version || 0);
  if (!st) {
    return <Screen><Header title="Settle the trip" small onBack={nav.pop} /><div className="scroll"><Empty title="This trip is gone" text="Its rounds and their money are still in History and on the Tab." action={<button className="ec" onClick={nav.pop}>Go back</button>} /></div></Screen>;
  }
  const { trip } = st;
  const plan = who ? partPlan(st.plan, who) : st.plan;
  const mineLines = plan.filter(t => t.from === me || t.to === me);
  const others = plan.filter(t => t.from !== me && t.to !== me);
  const paid = st.payments.filter(g => !who || g.from === who || g.to === who);
  // A team points trip's stake is settled with the whole trip, never someone's part
  // Lines with someone this phone can't place are marked paid on the trip; the rest are in the plan (cup-stake.js)
  const stakeOpen = !who && st.cup ? st.cup.lines.filter(l => l.open > 0 && !l.onTab).length : 0;
  const stakePaid = !who && st.cup ? st.cup.lines.filter(l => l.open === 0 && l.paid > 0).length : 0;
  const n = plan.length + stakeOpen;
  // Like with like: the payments the trip takes in all (still to pay and paid) against round by round
  const all = n + paid.length + stakePaid;
  const paidCount = paid.length + stakePaid;
  const note = trip.name;
  const myApp = payInfoFor(state, state.me);

  const mark = t => {
    const { shared, at } = markTripPayment({ tripId: id, from: t.from, to: t.to, part: !!who });
    buzz(15);
    const iPaid = t.from === me, gotIt = t.to === me;
    const text = iPaid ? `You paid ${short(t.to)}` : gotIt ? `${short(t.from)} paid you` : `${short(t.from)} paid ${short(t.to)}`;
    showToast(shared ? `${text}. Everyone in the rounds sees it.` : text, { label: 'Undo', run: () => {
      const kept = canonicalOf(getState());
      const pair = [t.from, t.to].sort().join();
      // Payments for trip expenses (trip-expenses.js) were made in the same tap
      const list = [...getState().settlements, ...allTripPays(getState())].filter(x => x.at === at && [kept(x.from), kept(x.to)].sort().join() === pair);
      if (list.length) undoPayments(list);
    } });
  };
  const undo = g => {
    const redo = undoPayments(g.settlements);
    showToast(`${short(g.from)} ${g.from === me ? 'owe' : 'owes'} ${g.to === me ? 'you' : short(g.to)} again`, { label: 'Undo', run: redo });
  };

  const title = who ? (who === me ? 'Settle your part' : `Settle ${short(who)}’s part`) : `Settle ${trip.name}`;
  const people = st.totals.map(p => p.id);
  const updating = st.published.status === 'stale' && n > 0;
  return (
    <Screen>
      <Header title={title} small onBack={nav.pop} />
      <div className="scroll">
        {n > 0 ? (
          <div className="settle-lede">
            <div className="eyebrow">{who ? 'Leaving early' : 'Whole trip'}{st.published.updated && <> <span className="trip-updated">Updated</span></>}</div>
            <div className="d settle-count">{all} payment{all === 1 ? '' : 's'}{paidCount ? `, ${paidCount} paid` : ''}</div>
            <p>{who
              ? `Just ${who === me ? 'your' : `${short(who)}’s`} payments for the rounds${st.expenses.length ? ' and expenses' : ''} so far. Everyone else settles after the last round.`
              : st.perRound > all ? `Round by round it would have been ${st.perRound}.` : `Every round${st.expenses.length ? ' and expense' : ''} is netted first, so nobody sends money that just comes back to them.`}
              {st.expenses.length > 0 && !who ? ` The trip’s ${st.expenses.length} expense${st.expenses.length === 1 ? ' is' : 's are'} in it too.` : ''}
              {st.published.updated ? ' A round, a score or an expense changed since you last looked, so these are the new payments.' : ''}</p>
          </div>
        ) : (
          <div className="block trip-square">
            <div className="eyebrow">{trip.name}</div>
            <div className="d settle-count">{who ? `${short(who) === 'You' ? 'You’re' : `${short(who)} is`} square` : `${people.length} of ${people.length} square`}</div>
            <SquareFaces ids={who ? [who] : people} state={state} me={me} />
          </div>
        )}

        {updating && (
          <p className="hint-card"><Icon name="arrows-clockwise" /> A round, a score or an expense changed, so the trip’s payments are being worked out again on {theirPhone(st)}. They show here as soon as they’re ready, the same on every phone. Nothing can be marked paid until then.</p>
        )}

        {!updating && mineLines.map((t, i) => {
          const iPay = t.from === me;
          const other = iPay ? t.to : t.from;
          const app = payInfoFor(state, iPay ? other : state.me);
          return (
            <div key={t.from + t.to} className="pay-card" style={{ '--i': i }}>
              <div className="pay-who">
                <Avatar id={other} name={nameOf(state, other)} />
                <span className="trip-pay-name">{iPay ? `You pay ${short(other)}` : `${short(other)} pays you`}</span>
                <span className="pm">{money(t.amount)}</span>
              </div>
              {app && <div className="trip-pay-sub">To {iPay ? `${short(other)}’s` : 'your'} {PAY_APPS[app.app]?.name || 'pay app'}</div>}
              <div className="pay-acts wrap">
                {iPay ? <PayButton info={payInfoFor(state, other)} amount={t.amount} note={note} />
                  : <RequestButton payer={payInfoFor(state, other)} mine={myApp} amount={t.amount} note={note} />}
                <button className="pay-btn ink" onClick={() => mark(t)}><span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">{iPay ? 'I paid' : 'I got it'}</span></span></button>
              </div>
            </div>
          );
        })}

        {!updating && others.length > 0 && (
          <>
            <div className="sec-label">{mineLines.length ? 'Everyone else' : 'Who pays who'}</div>
            {others.map(t => (
              <div key={t.from + t.to} className="ledger-row static trip-other">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{short(t.from)} pays {short(t.to)}</div>
                  {PAY_APPS[payInfoFor(state, t.to)?.app] && <div className="lr-status">{first(nameOf(state, t.to))} picked {PAY_APPS[payInfoFor(state, t.to).app].name}</div>}
                </div>
                <div className="lr-amt" style={{ marginRight: 8 }}>{money(t.amount)}</div>
                {canMarkLine(state, t) && <button className="pill-btn sm" onClick={() => mark(t)}>Mark paid</button>}
              </div>
            ))}
            {others.some(t => !t.theirs && !canMarkLine(state, t)) && (
              <p className="field-help pad">Some of these people are only in the trip’s expenses on your phone, so they mark their payments on their own phones.</p>
            )}
            {others.some(t => t.theirs) && (
              <p className="field-help pad">Some of these include a round the two of them have on their own phones, so they mark those paid there.</p>
            )}
          </>
        )}

        {!who && <StakeLines st={st} />}

        {!who && !updating && st.between.map(r => {
          const kept = canonicalOf(state);
          const names = [...new Set(r.players.map(p => kept(p.id)))].map(short);
          const day = new Date(r.finishedAt || r.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
          return (
            <p key={r.id} className="hint-card"><Icon name="users" /> {listNames(names)} settle {day}’s round between {names.includes('You') ? 'yourselves' : 'themselves'}, since it isn’t on {theirPhone(st)}.{n > 0 ? ' Its payments are in the list above.' : ''}</p>
          );
        })}
        {!who && st.organizer && st.published.status === 'live' && (
          <p className="field-help pad">Rounds you didn’t play aren’t on your phone, so the people in them settle those between themselves.</p>
        )}

        {paid.length > 0 && (
          <>
            <div className="sec-label">Paid</div>
            {paid.map(g => (
              <div key={g.key} className="ledger-row static">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{label(g.from)} paid {g.to === me ? 'you' : label(g.to)}</div>
                  <div className="lr-status">{new Date(g.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                </div>
                <div className="lr-amt" style={{ marginRight: 8 }}>{money(g.amount)}</div>
                <button className="icon-btn sm" onClick={() => undo(g)} aria-label="Undo payment"><Icon name="arrow-counter-clockwise" /></button>
              </div>
            ))}
          </>
        )}

        <p className="field-help pad">Nobody pays someone they didn’t play with{st.expenses.length ? ' or share an expense with' : ''} on the trip. {st.published.status === 'live'
          ? `One plan for the whole trip, worked out on ${theirPhone(st)}, so every phone shows the same payments.`
          : 'Rounds shared live settle between the two people in them, so every phone agrees.'} Money from before the trip stays on the Tab as it is.{off ? '' : ' A payment marked here shows on the phones of everyone in the rounds it’s tied to.'}</p>
      </div>
    </Screen>
  );
}
