// A trip: everyone's standings across its rounds, the rounds themselves, and money by game; then
// Settle the trip, once, right after the last round (or someone's part, for a friend leaving
// early). Trip money is already in each person's total on the Tab, so paying here pays the Tab
// too. See trips.js for how it's all worked out.
import { useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton } from '../components/Pay.jsx';
import { RoundRow } from '../components/RoundRow.jsx';
import { SquareFaces, TripDays, TripSheet } from '../components/Trips.jsx';
import { getState, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { holeComplete } from '../lib/round.js';
import { gameLabel, placeOf } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { PAY_APPS, payInfoFor } from '../lib/pay.js';
import { points } from '../lib/play-for.js';
import { whenLabel } from '../lib/plans.js';
import { buzz } from '../lib/delight.js';
import { markTripPayment, undoPayments, usePaymentsOff, useTabSync } from '../lib/tab-sync.js';
import { TRIP_FORMATS, canRecount, myTripNet, partPlan, roundsInDates, tripByGame, tripDates, tripRounds, tripStatus, upDown } from '../lib/trips.js';
import { deleteTrip, endTrip, setRoundTrip } from '../lib/trip-store.js';

const first = name => String(name || '').trim().split(/\s+/)[0];
const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

/** Who "you" are to the trip, and a name for anyone on it. */
function useWho(state) {
  const me = canonicalOf(state)(state.me);
  return { me, label: id => (id === me ? 'You' : nameOf(state, id)), short: id => (id === me ? 'You' : first(nameOf(state, id))) };
}

/** `view`: which part opens first ('standings', 'rounds' or 'games'). */
export default function Trip({ id, view: firstView = 'standings' }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  // Payments from Settle the trip ride on the trip's shared rounds: keep them fresh
  useTabSync({ live: true });
  const [view, setView] = useState(firstView);
  const [editing, setEditing] = useState(false);
  const [counting, setCounting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const st = tripStatus(state, id);
  const { me, label, short } = useWho(state);
  if (!st) {
    return <Screen><Header title="Trip" small onBack={nav.pop} /><div className="scroll"><Empty title="This trip is gone" text="Its rounds and their money are still in History and on the Tab." /></div></Screen>;
  }
  const { trip } = st;
  const played = st.standings.some(p => p.id === me);
  const net = myTripNet(state, st);
  const myPoints = st.points?.[me] ?? null;
  const settling = st.settling.length > 0;
  // A round shared live keeps the trip it was set up with on everyone's phone, so a trip with one
  // can't be deleted here (friends' phones would keep it, and its payments would land on a trip
  // this phone no longer has)
  const deletable = !settling && !trip.derived && tripRounds(state, id).every(r => canRecount(state, r));

  const eyebrow = st.phase === 'soon' ? `Starts ${tripDates(trip)}`
    : st.phase === 'ready' ? 'That’s the trip'
    : st.phase === 'square' ? 'All square'
    : `${st.day ? `Day ${st.day} of ${st.days} · ` : ''}${st.done.length} round${st.done.length === 1 ? '' : 's'} done`;
  const big = st.money.length && played ? upDown(net)
    : myPoints != null ? `You’re on ${points(myPoints, { sign: true })}`
    : st.phase === 'soon' ? 'Nothing played yet' : st.done.length ? 'No money on it yet' : 'Nothing played yet';
  const hint = st.pointsOnly ? 'Played for points, so there’s nothing to pay. Everyone on the trip sees the standings.'
    : st.phase === 'ready' ? `${st.plan.length} payment${st.plan.length === 1 ? '' : 's'} square${st.plan.length === 1 ? 's' : ''} the whole trip. Trip money is already in each person’s total on the Tab, so paying here pays the Tab too.`
    : st.phase === 'square' ? 'Everyone’s square on the trip.'
    : st.phase === 'soon' ? `Rounds you start from ${tripDates(trip)} ask to count for the trip. Plan them now so everyone can answer.`
    : 'Nothing’s paid yet. Settle the trip opens after the last round, once for the whole trip. Trip money is already in each person’s total on the Tab.';

  const del = async () => {
    if (!(await ask({ title: `Delete ${trip.name}?`, text: 'Its rounds stay in History and their money stays on the Tab. They just stop being a trip.', confirmLabel: 'Delete the trip', danger: true }))) return;
    deleteTrip(id);
    nav.pop();
  };
  const doneNow = () => {
    endTrip(id);
    showToast('Settle the trip is open');
  };

  return (
    <Screen>
      <Header title={trip.name} small onBack={nav.pop} right={<button className="header-btn" onClick={() => setEditing(true)}><Icon name="pencil-simple" /> Edit</button>} />
      <div className="scroll">
        <div className="trip-hero">
          <div className="eyebrow pink">{eyebrow}</div>
          <div className={`tab-big d ${st.money.length && played ? sign(net) : ''}`}>{big}</div>
          <div className="trip-sub">{[tripDates(trip), trip.where].filter(Boolean).join(' · ')}</div>
          <TripDays status={st} />
        </div>
        <p className="hint-card"><Icon name={st.phase === 'square' ? 'handshake' : 'suitcase-rolling'} fill /> {hint}</p>

        <div className="tab-view">
          <Segmented label="Trip view" className="press-mode-row" btn="pm-btn" value={view} onChange={setView}
            options={[{ value: 'standings', label: 'Standings' }, { value: 'rounds', label: 'Rounds' }, { value: 'games', label: 'Games' }]} />
        </div>

        {view === 'standings' && <Standings st={st} state={state} label={label} me={me} />}
        {view === 'rounds' && (
          <>
            {st.rounds.length === 0 && st.planned.length === 0 && <p className="field-help pad">No rounds yet. Start one at the course, or plan the trip’s rounds so everyone can answer.</p>}
            {[...st.done].reverse().map(r => <RoundRow key={r.id} round={r} state={state} className="card" />)}
            {st.live.map(r => <LiveRow key={r.id} round={r} />)}
            {st.planned.map(p => (
              <button key={p.id} className="ledger-row trip-plan-row" onClick={() => nav.push('plan', { id: p.id })}>
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{p.course?.name || 'Course to be set'}</div>
                  <div className="lr-status">{whenLabel(p)}</div>
                </div>
                <span className="chevron"><Icon name="caret-right" /></span>
              </button>
            ))}
            <button className="add-row" onClick={() => nav.push('newRound', { trip: id })}><div className="add-ci"><Icon name="golf" fill /></div><span className="add-lbl">Start a round for the trip</span></button>
            <button className="add-row" onClick={() => nav.push('newRound', { ahead: true, trip: id })}><div className="add-ci"><Icon name="calendar-plus" /></div><span className="add-lbl">Plan a round for the trip</span></button>
            <button className="text-link" onClick={() => setCounting(true)}><Icon name="list-checks" /> Which rounds count?</button>
          </>
        )}
        {view === 'games' && <Games st={st} state={state} label={label} />}

        <p className="field-help pad">{TRIP_FORMATS[trip.format]?.name || TRIP_FORMATS.money.name}. Each round keeps its own games and bets. Someone who plays only some rounds is on the trip for those rounds.</p>
        {deletable && <button className="text-link danger" onClick={del}><Icon name="trash" /> Delete the trip</button>}
      </div>
      <div className="cta-wrap">
        {st.phase === 'ready' && <button className="full-btn pink" onClick={() => nav.push('tripSettle', { id })}>Settle the trip <Icon name="arrow-right" /></button>}
        {st.phase === 'square' && st.payments.length > 0 && <button className="full-btn outline" onClick={() => nav.push('tripSettle', { id })}>See the trip’s payments</button>}
        {(st.phase === 'on' || st.phase === 'soon') && st.money.length > 0 && (
          <>
            <button className="full-btn outline" onClick={() => setLeaving(true)}><Icon name="sign-out" /> Leaving early? Settle a part</button>
            {!st.live.length && <button className="link-btn center" onClick={doneNow}>Done playing? Settle the trip now</button>}
          </>
        )}
      </div>
      <TripSheet open={editing} trip={trip} onClose={() => setEditing(false)} onDone={() => setEditing(false)} />
      <CountSheet open={counting} onClose={() => setCounting(false)} st={st} />
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Who’s leaving?">
        <p className="field-help pad">Their payments for the rounds so far. Everyone else settles after the last round.</p>
        {st.standings.map(p => (
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
    return rows.length ? (
      <div className="trip-table">
        {rows.map(([id, v], i) => (
          <div key={id} className={`trip-row ${id === me ? 'me' : ''}`}>
            <span className="tr-rank">{rows.findIndex(r => r[1] === v) + 1 || i + 1}</span>
            <span className="tr-name">{label(id)}</span>
            <span className={`tr-amt ${sign(v)}`}>{points(v, { sign: true })}</span>
          </div>
        ))}
      </div>
    ) : null;
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
            </span>
            <span className={`tr-amt ${sign(p.amount)}`}>{money(p.amount, { sign: true })}</span>
          </div>
        ))}
      </div>
      {st.live.map(r => <LiveRow key={r.id} round={r} />)}
      <p className="field-help pad">Finished rounds only{total > 1 ? `, all ${total} of them` : ''}. Adds up to $0 across everyone on the trip.</p>
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
  const { columns, rows } = tripByGame(state, st.trip.id);
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
      {list.map(r => {
        const on = r.trip?.id === st.trip.id;
        // A finished round shared live stays as it was set up, so every phone in it agrees
        const fixed = !canRecount(state, r);
        return (
          <button key={r.id} className="sheet-item" disabled={(on && locked) || fixed} aria-pressed={on} onClick={() => setRoundTrip(r.id, on ? null : st.trip)}>
            <span>
              <Icon name={on ? 'check-square' : 'square'} fill={on} />
              <span className="trip-li">
                <span className="trip-li-name">{r.course.name} · {gameLabel(r)}</span>
                <span className="trip-li-sub">{new Date(r.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{r.status === 'active' ? ' · being played' : ''}{fixed ? ` · shared live, so it stays ${on ? 'on' : 'off'} the trip` : ''}</span>
              </span>
            </span>
          </button>
        );
      })}
      <div className="cta-wrap"><button className="full-btn" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}

/**
 * Settle the trip: what's left over just the trip's rounds (each pair's net on the shared rounds,
 * the fewest payments for the rest), each with the payee's app, marked paid here. `who`: just
 * that person's part, for someone leaving early.
 */
export function TripSettle({ id, who = null }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  useTabSync({ live: true });
  const off = usePaymentsOff();
  const st = tripStatus(state, id);
  const { me, label, short } = useWho(state);
  if (!st) {
    return <Screen><Header title="Settle the trip" small onBack={nav.pop} /><div className="scroll"><Empty title="This trip is gone" /></div></Screen>;
  }
  const { trip } = st;
  const plan = who ? partPlan(st.plan, who) : st.plan;
  const mineLines = plan.filter(t => t.from === me || t.to === me);
  const others = plan.filter(t => t.from !== me && t.to !== me);
  const paid = st.payments.filter(g => !who || g.from === who || g.to === who);
  const n = plan.length;
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
      const list = getState().settlements.filter(x => x.at === at && [kept(x.from), kept(x.to)].sort().join() === pair);
      if (list.length) undoPayments(list);
    } });
  };
  const undo = g => {
    const redo = undoPayments(g.settlements);
    showToast(`${short(g.from)} ${g.from === me ? 'owe' : 'owes'} ${g.to === me ? 'you' : short(g.to)} again`, { label: 'Undo', run: redo });
  };

  const title = who ? (who === me ? 'Settle your part' : `Settle ${short(who)}’s part`) : `Settle ${trip.name}`;
  const people = st.standings.map(p => p.id);
  return (
    <Screen>
      <Header title={title} small onBack={nav.pop} />
      <div className="scroll">
        {n > 0 ? (
          <div className="settle-lede">
            <div className="eyebrow">{who ? 'Leaving early' : 'Whole trip'}</div>
            <div className="d settle-count">{n} payment{n === 1 ? '' : 's'}</div>
            <p>{who
              ? `Just ${who === me ? 'your' : `${short(who)}’s`} payments for the rounds so far. Everyone else settles after the last round.`
              : st.perRound > n ? `Round by round it would have been ${st.perRound}.` : 'Every round is netted first, so nobody sends money that just comes back to them.'}</p>
          </div>
        ) : (
          <div className="block trip-square">
            <div className="eyebrow">{trip.name}</div>
            <div className="d settle-count">{who ? `${short(who) === 'You' ? 'You’re' : `${short(who)} is`} square` : `${people.length} of ${people.length} square`}</div>
            <SquareFaces ids={who ? [who] : people} state={state} me={me} />
          </div>
        )}

        {mineLines.map((t, i) => {
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

        {others.length > 0 && (
          <>
            <div className="sec-label">{mineLines.length ? 'Everyone else' : 'Who pays who'}</div>
            {others.map(t => (
              <div key={t.from + t.to} className="ledger-row static trip-other">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{short(t.from)} pays {short(t.to)}</div>
                  {PAY_APPS[payInfoFor(state, t.to)?.app] && <div className="lr-status">{first(nameOf(state, t.to))} picked {PAY_APPS[payInfoFor(state, t.to).app].name}</div>}
                </div>
                <div className="lr-amt" style={{ marginRight: 8 }}>{money(t.amount)}</div>
                <button className="pill-btn sm" onClick={() => mark(t)}>Mark paid</button>
              </div>
            ))}
          </>
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

        <p className="field-help pad">Nobody pays someone they didn’t play with on the trip. Rounds shared live settle between the two people in them, so every phone agrees. Money from before the trip stays on the Tab as it is.{off ? '' : ' A payment marked here shows on the phones of everyone in the rounds it’s tied to.'}</p>
      </div>
    </Screen>
  );
}
