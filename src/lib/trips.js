// Trips: a few rounds played together over some days (a golf trip). Everyone on the trip sees the
// standings. Trip money is in each person's total on the Tab like any other round (folded in, not
// held apart), and the trip is settled once, right after its last round, over just the trip's
// rounds. Someone leaving early can settle their part first.
//
// Rounds shared live settle pair by pair, the way the Tab keeps them: each pair nets what's
// between the two of them across the trip, never passed on through a third person. Both phones of
// a pair hold the rounds both played, so they always agree, even when one of them missed a round
// (that phone can't see the whole trip). Rounds only this phone has settle in the fewest payments.
//
// Each round on a trip carries a stamp, `round.trip = { id, name, start, end, format }`, so it
// rides in the live round to every phone. Everything else (the trip's rounds, who's on it, the
// standings, what's left to pay) is worked out from the rounds each phone has. The trip's own
// record (name, dates, "done playing") lives in `state.trips` on the phone that made it and
// syncs through the account. A friend's phone knows the trip from the stamps alone.
// Planned rounds carry the same stamp (`plan.trip`), so they group under the trip on Up next.
//
// Someone who only plays some rounds is on the trip for those rounds only. Pure, unit tested.
import { GAMES, roundResults } from './round.js';
import { countsMoney, playForOf } from './play-for.js';
import { fewestPayments } from './ledger.js';
import { canonicalOf, codeOf, finishedAt, openByPair, sharedRounds } from './pair-debts.js';
import { tripOfPayment, tripPaymentId, tripReason, tripSettleOf } from './trip-pay.js';
import { squareRows } from './shared-tab.js';
import { dayLabel, daysUntil, isoDate } from './plans.js';
import { canEdit, keeperMe } from './keeper.js';
import { money } from './golf.js';

const DAY = 864e5;
/** How a trip is scored. Only money for now; trip formats (team points, a leaderboard) can join later. */
export const TRIP_FORMATS = { money: { name: 'Money across every round' } };
export const TRIP_FORMAT = 'money';
/** A trip that's all square stays on the Tab and Up next this long, then lives on its rounds. */
export const SQUARE_MS = 3 * DAY;
/** A trip left unsettled drops off the Tab card this long after its last round (the money stays on the Tab). */
export const STALE_MS = 30 * DAY;

const cents = v => Math.round((Number(v) || 0) * 100);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const dayOf = t => isoDate(new Date(t || 0));

/** Tidy a trip name typed in: trimmed, single spaces, at most 32 characters. */
export function cleanTripName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

/** A new trip. `start` and `end` are days (YYYY-MM-DD); the last day is never before the first. */
export function newTrip({ id, name, start, end, where = null, by = null, now = Date.now() }) {
  const first = start || dayOf(now);
  const last = end && end >= first ? end : first;
  return {
    id, name: cleanTripName(name) || 'Golf trip', start: first, end: last, where: cleanTripName(where) || null,
    format: TRIP_FORMAT, by, createdAt: now, updatedAt: now,
  };
}

/** What a round or plan carries to say it's on the trip. */
export function tripStamp(trip) {
  return { id: trip.id, name: cleanTripName(trip.name) || 'Golf trip', start: trip.start || null, end: trip.end || null, format: trip.format || TRIP_FORMAT };
}

/**
 * Every trip this phone knows, by id: its own records, and trips it only knows from a round or
 * plan's stamp (`derived: true`, the newest stamp wins). A record always wins over a stamp.
 */
export function tripsOf(state) {
  const stamps = [];
  for (const r of Object.values(state.rounds || {})) if (r?.trip?.id) stamps.push({ s: r.trip, at: r.createdAt || 0 });
  for (const p of Object.values(state.plans || {})) if (p?.trip?.id) stamps.push({ s: p.trip, at: p.createdAt || 0 });
  stamps.sort((a, b) => a.at - b.at);
  const out = new Map();
  for (const { s } of stamps) out.set(s.id, { ...tripStamp(s), derived: true });
  for (const t of Object.values(state.trips || {})) {
    if (t?.id) out.set(t.id, { ...t, format: t.format || TRIP_FORMAT, derived: false });
  }
  return out;
}

export const tripOf = (state, id) => (id ? tripsOf(state).get(id) || null : null);

/** The trip's rounds on this phone (any status), oldest first. */
export function tripRounds(state, id) {
  return Object.values(state.rounds || {}).filter(r => r?.trip?.id === id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/** The trip's planned rounds still to come on this phone, soonest first. */
export function tripPlans(state, id, now = new Date()) {
  return Object.values(state.plans || {})
    .filter(p => p?.trip?.id === id && p.status === 'planned' && !p.gone && (daysUntil(p.date, now) ?? -1) >= 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.teeTime || '').localeCompare(String(b.teeTime || '')));
}

const moneyDone = rounds => rounds.filter(r => r.status === 'done' && countsMoney(r));
const pointsDone = rounds => rounds.filter(r => r.status === 'done' && playForOf(r).kind === 'points');

/**
 * Who's on the trip: everyone who played one of its rounds (one person, whichever id they had),
 * Map(id -> { rounds, live }), where rounds counts their finished rounds on the trip.
 */
export function tripPeople(state, id) {
  const who = canonicalOf(state);
  const out = new Map();
  for (const r of tripRounds(state, id)) {
    if (r.status !== 'done' && r.status !== 'active') continue;
    for (const k of new Set(r.players.map(p => who(p.id)))) {
      const cur = out.get(k) || { rounds: 0, live: false };
      if (r.status === 'done') cur.rounds++;
      else cur.live = true;
      out.set(k, cur);
    }
  }
  return out;
}

/** Pairs who played a finished money round of the trip together: the only ones asked to pay each other. */
function togetherOf(state, rounds) {
  const who = canonicalOf(state);
  const out = new Set();
  for (const r of moneyDone(rounds)) {
    const ids = [...new Set(r.players.map(p => who(p.id)))];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.add(pairKey(ids[i], ids[j]));
  }
  return out;
}

/** Each person's net across the trip's finished money rounds, in cents. */
function balanceCents(state, rounds) {
  const who = canonicalOf(state);
  const bal = {};
  for (const r of moneyDone(rounds)) {
    for (const [pid, v] of Object.entries(roundResults(r).balances)) {
      const k = who(pid);
      bal[k] = (bal[k] || 0) + cents(v);
    }
  }
  return bal;
}

/** Each person's points across the trip's finished points rounds (a trip played only for points). */
function pointsOf(state, rounds) {
  const who = canonicalOf(state);
  const out = {};
  for (const r of pointsDone(rounds)) {
    for (const [pid, v] of Object.entries(roundResults(r).balances)) {
      const k = who(pid);
      out[k] = Math.round(((out[k] || 0) + v) * 100) / 100;
    }
  }
  return out;
}

/**
 * The trip's finished money rounds whose money stays between the two people in them: the shared
 * rounds the Tab keeps pair by pair (pair-debts.js).
 */
export function tripPairRounds(state, id, { now = Date.now() } = {}) {
  const locked = new Set(sharedRounds(state, { now }).map(r => r.id));
  return moneyDone(tripRounds(state, id)).filter(r => locked.has(r.id));
}

/**
 * The payments that count toward the trip, and what's left to pay on the rounds only this phone
 * has (`local`), in cents:
 * - payments from "Settle the trip" for those rounds (their id names the trip, trip-pay.js),
 * - every payment tied to one of the trip's rounds (the round's own settle up, or the shared Tab
 *   rows for that round). The shared rounds' ones (`onPairs`) are already paid on their round
 *   transfers, so they only count toward the pairs.
 * - and a payment on the Tab between two people who played the trip together, made once the trip
 *   started and tied to no round, up to what the local rounds still have the payer owing and the
 *   payee owed. Trip money is in each person's total on the Tab, so paying that total pays the
 *   trip too, and the trip never asks for it again.
 */
function paymentsOf(state, id, rounds, local, together, bal) {
  const who = canonicalOf(state);
  const localIds = new Set(local.map(r => r.id));
  const localCodes = new Set(local.map(codeOf).filter(Boolean));
  const allIds = new Set(rounds.map(r => r.id));
  const allCodes = new Set(rounds.map(codeOf).filter(Boolean));
  const startAt = rounds.length ? Math.min(...rounds.map(r => r.createdAt || finishedAt(r))) : Infinity;
  const left = { ...bal };
  const pay = (f, t, c) => { left[f] = (left[f] || 0) + c; left[t] = (left[t] || 0) - c; };
  const trip = [], onRounds = [], onPairs = [], loose = [];
  for (const s of state.settlements || []) {
    const t = tripOfPayment(s);
    if (t) { if (t === id) trip.push(s); continue; }
    if (localIds.has(s.roundId) || (s.code && localCodes.has(s.code))) { onRounds.push(s); continue; }
    if (allIds.has(s.roundId) || (s.code && allCodes.has(s.code))) { onPairs.push(s); continue; }
    if (s.roundId || s.code) continue; // another round's payment
    if ((s.at || 0) >= startAt && together.has(pairKey(who(s.from), who(s.to)))) loose.push(s);
  }
  for (const s of [...trip, ...onRounds]) pay(who(s.from), who(s.to), cents(s.amount));
  const counted = [];
  for (const s of loose.sort((a, b) => (a.at || 0) - (b.at || 0))) {
    const f = who(s.from), t = who(s.to);
    const c = Math.min(cents(s.amount), Math.max(0, -(left[f] || 0)), Math.max(0, left[t] || 0));
    if (c <= 0) continue;
    pay(f, t, c);
    counted.push({ settlement: s, cents: c });
  }
  return { trip, onRounds, onPairs, counted, left };
}

/**
 * The plan: each pair's net on the shared rounds, then the fewest payments for the rest, one line
 * per pair and way: [{ from, to, amount, shared, local }], with each part in cents.
 */
function mergePlan(pairs, local) {
  const lines = new Map();
  const add = (from, to, part, c) => {
    const k = `${from}>${to}`;
    const line = lines.get(k) || { from, to, amount: 0, shared: 0, local: 0 };
    line[part] += c;
    line.amount = (line.shared + line.local) / 100;
    lines.set(k, line);
  };
  for (const d of pairs) add(d.from, d.to, 'shared', d.cents);
  for (const t of local) add(t.from, t.to, 'local', cents(t.amount));
  return [...lines.values()];
}

/**
 * The trip's payments, one a tap (the same two people at the same moment, since one tap can pay
 * several round transfers), newest first: [{ key, at, from, to, amount, settlements }].
 */
export function tripPaymentGroups(state, list) {
  const who = canonicalOf(state);
  const groups = new Map();
  for (const s of list) {
    const [a, b] = [who(s.from), who(s.to)].sort();
    const key = `${s.at || 0}|${a}|${b}`;
    const g = groups.get(key) || { key, at: s.at || 0, a, b, net: 0, settlements: [] };
    g.net += who(s.from) === a ? cents(s.amount) : -cents(s.amount);
    g.settlements.push(s);
    groups.set(key, g);
  }
  return [...groups.values()].filter(g => g.net)
    .map(g => ({ key: g.key, at: g.at, from: g.net > 0 ? g.a : g.b, to: g.net > 0 ? g.b : g.a, amount: Math.abs(g.net) / 100, settlements: g.settlements }))
    .sort((x, y) => y.at - x.at);
}

/** "Day 2 of 3" numbers for a day (YYYY-MM-DD): { day, days }, day null outside the trip. */
export function tripDay(trip, today) {
  const n = iso => Date.UTC(...iso.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  if (!trip?.start || !trip?.end) return { day: null, days: null };
  const days = Math.round((n(trip.end) - n(trip.start)) / DAY) + 1;
  const day = today >= trip.start && today <= trip.end ? Math.round((n(today) - n(trip.start)) / DAY) + 1 : null;
  return { day, days };
}

/**
 * Everything about one trip on this phone:
 * - phase: 'soon' (nothing played and the first day is still to come), 'on' (being played),
 *   'ready' (the last round is in and there's money to settle), 'square' (settled, or nothing to
 *   pay) or 'empty' (the dates went by with no rounds).
 * - standings: [{ id, amount, rounds }] best first, everyone who played a finished money round.
 * - plan: what's left over just the trip's rounds, [{ from, to, amount, shared, local }]: each
 *   pair's net on the shared rounds (both their phones agree on it) and the fewest payments for
 *   the rounds only this phone has.
 * - paid: every payment that counts for the trip; payments: the same, one a tap; perRound: how
 *   many payments the rounds one by one would have taken.
 * The trip opens to settle right after its last round: no round still being played, no planned
 * round still to come on this phone, and either the last day has come and a round finished that
 * day, the last day has gone, someone said they're done playing (`endedAt`, on the organizer's
 * phone), or someone settled the whole trip (`closed`, which every phone in a round hears about).
 */
export function tripStatus(state, id, { now = Date.now() } = {}) {
  const trip = tripOf(state, id);
  if (!trip) return null;
  const today = dayOf(now);
  const rounds = tripRounds(state, id).filter(r => r.status === 'done' || r.status === 'active');
  const done = rounds.filter(r => r.status === 'done');
  const live = rounds.filter(r => r.status === 'active');
  const planned = tripPlans(state, id, new Date(now));
  const money = moneyDone(rounds);
  const people = tripPeople(state, id);
  const together = togetherOf(state, rounds);
  const pairRounds = tripPairRounds(state, id, { now });
  const local = rounds.filter(r => !pairRounds.includes(r));
  const bal = balanceCents(state, rounds);
  const { trip: tripPaid, onRounds, onPairs, counted, left } = paymentsOf(state, id, rounds, local, together, balanceCents(state, local));
  const rest = fewestPayments(Object.fromEntries(Object.entries(left).map(([k, c]) => [k, c / 100])), { canPay: (a, b) => together.has(pairKey(a, b)) });
  const plan = mergePlan(openByPair(state, pairRounds), rest);
  const paid = [...tripPaid, ...onRounds, ...onPairs, ...counted.map(x => x.settlement)];
  // Payments made from "Settle the trip" (trip-pay.js): `settling` locks the trip's rounds on it
  const settling = paid.filter(s => tripSettleOf(s)?.id === id);
  const closed = settling.some(s => !tripSettleOf(s).part);

  const lastDone = done.length ? Math.max(...done.map(finishedAt)) : 0;
  const over = !!trip.endedAt || closed || (!!trip.end && (today > trip.end || (today === trip.end && done.some(r => dayOf(finishedAt(r)) === today))));
  const quiet = !live.length && !planned.length;
  let phase;
  if (!done.length && !live.length) phase = trip.start && today < trip.start ? 'soon' : over ? 'empty' : planned.length ? 'soon' : 'on';
  else if (quiet && over && done.length) phase = plan.length ? 'ready' : 'square';
  else phase = 'on';
  const lastPaid = Math.max(0, ...paid.map(s => s.at || 0));
  const who = canonicalOf(state);
  const standings = [...people.entries()].filter(([pid]) => money.some(r => r.players.some(p => who(p.id) === pid)))
    .map(([pid, v]) => ({ id: pid, amount: (bal[pid] || 0) / 100, rounds: v.rounds }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  return {
    trip, phase, rounds, done, live, planned, money, people, standings, plan, paid, settling, closed, pairRounds,
    payments: tripPaymentGroups(state, paid),
    points: money.length ? null : pointsOf(state, rounds),
    // Played only for points so far: nothing to pay, and never a dollar
    pointsOnly: !money.length && pointsDone(rounds).length > 0,
    perRound: money.reduce((a, r) => a + roundResults(r).transfers.length, 0),
    lastDone, squareAt: phase === 'square' ? Math.max(lastPaid, lastDone) : null,
    ...tripDay(trip, today),
  };
}

/**
 * One line of "Settle the trip" paid (`part`: someone leaving early settles their part). The shared
 * rounds' part squares the pair on the trip's round transfers, as rows every phone in those rounds
 * gets, so both phones of the pair agree; the part from rounds only this phone has is a payment
 * here (its id names the trip). Returns { rows, settlements }, empty when the line is gone.
 */
export function tripPayment(state, tripId, from, to, { now = Date.now(), part = false } = {}) {
  const st = tripStatus(state, tripId, { now });
  const line = st?.plan.find(t => t.from === from && t.to === to);
  if (!line) return { rows: [], settlements: [] };
  const ids = new Set(st.pairRounds.map(r => r.id));
  const rows = line.shared ? squareRows(state, from, to, ids, { now, reason: tripReason(tripId, part) }).rows : [];
  const settlements = line.local ? [{ id: tripPaymentId(tripId, from, to, now), from, to, amount: line.local / 100, at: now, ...(part ? { tripPart: true } : {}) }] : [];
  return { rows, settlements };
}

/** Your net on the trip so far (you are `state.me` to the trip). */
export function myTripNet(state, status) {
  const me = canonicalOf(state)(state.me);
  return status.standings.find(s => s.id === me)?.amount ?? 0;
}

/** Just one person's payments in the trip's plan: their part, for someone leaving early. */
export function partPlan(plan, person) {
  return plan.filter(t => t.from === person || t.to === person);
}

/**
 * Trips to show on the Tab and Up next, soonest first: coming up (your own, or one with a round
 * planned), being played, ready to settle (until a month after the last round), and square for a
 * few days after.
 */
export function currentTrips(state, { now = Date.now() } = {}) {
  const out = [];
  for (const id of tripsOf(state).keys()) {
    const s = tripStatus(state, id, { now });
    if (!s) continue;
    const show = s.phase === 'on'
      || (s.phase === 'soon' && (!s.trip.derived || s.planned.length > 0))
      || (s.phase === 'ready' && now - s.lastDone < STALE_MS)
      || (s.phase === 'square' && now - s.squareAt < SQUARE_MS);
    if (show) out.push(s);
  }
  return out.sort((a, b) => String(a.trip.start || '').localeCompare(String(b.trip.start || '')));
}

/**
 * The trip a round on `day` (YYYY-MM-DD) could count for: one whose dates take that day and that's
 * still being played, your own trip first, then the newest. Null when no trip is on.
 */
export function tripOnDay(state, day) {
  // A trip someone said they're done playing, or that's been settled as a whole, takes no more rounds
  const open = t => !t.endedAt && !tripStatus(state, t.id)?.closed;
  const list = [...tripsOf(state).values()].filter(t => t.start && t.end && t.start <= day && day <= t.end && open(t));
  list.sort((a, b) => Number(a.derived) - Number(b.derived) || (b.createdAt || 0) - (a.createdAt || 0));
  return list[0] || null;
}

/**
 * "Count it for the trip?" starts on yes, unless the trip already has people and nobody else in
 * this round is one of them (a round with other friends during the trip).
 */
export function countsByDefault(state, tripId, playerIds = []) {
  const who = canonicalOf(state);
  const people = tripPeople(state, tripId);
  const me = who(state.me);
  const others = [...new Set(playerIds.map(who))].filter(id => id !== me);
  if (!people.size || !others.length) return true;
  return others.some(id => people.has(id));
}

/**
 * Whether this phone can count a round for a trip, or take it off, and every phone in it agrees:
 * a round only this phone has, or one being played live that this phone keeps the card for (the
 * stamp rides in the live round). A finished round that was shared live keeps what it was set up
 * with: friends' copies don't hear about a change any more, so their standings and the Tab's
 * pair-by-pair money would stop matching this phone's.
 */
export function canRecount(state, round) {
  if (!codeOf(round)) return true;
  if (round.status !== 'active' || !round.shared || round.shared.ended) return false;
  return canEdit(round, keeperMe(round, state), !!round.shared.host);
}

/**
 * The day a round planned for the trip starts on: today while the trip is on, its first day
 * before then, null once its dates are over.
 */
export function tripPlanDay(trip, today = isoDate()) {
  if (!trip?.start) return null;
  if (today < trip.start) return trip.start;
  return !trip.end || today <= trip.end ? today : null;
}

/** "Starts today", "Starts tomorrow", "Starts Friday" or "Starts Fri, Oct 16". */
export function startsLine(start, now = new Date()) {
  const d = dayLabel(start, now);
  return d ? `Starts ${d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : d}` : 'Coming up';
}

/**
 * Rounds that could be counted for the trip from its page: rounds this phone has from the trip's
 * dates that aren't on another trip, newest first (rounds already on it included, to take out).
 */
export function roundsInDates(state, trip) {
  if (!trip?.start || !trip?.end) return tripRounds(state, trip?.id);
  return Object.values(state.rounds || {})
    .filter(r => (r.status === 'done' || r.status === 'active') && (r.trip?.id === trip.id || (!r.trip?.id && dayOf(r.createdAt) >= trip.start && dayOf(r.createdAt) <= trip.end)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * The money each person made in each game across the trip's finished money rounds, for the
 * Games view: { columns: [game names], rows: Map(id -> { [game]: amount }) }. Read from each
 * round's own results (byGame when it has more than one game), so every bet a round has counts.
 */
export function tripByGame(state, id) {
  const who = canonicalOf(state);
  const columns = [];
  const rows = new Map();
  for (const r of moneyDone(tripRounds(state, id))) {
    const res = roundResults(r);
    const games = res.detail?.byGame && Object.keys(res.detail.byGame).length
      ? Object.values(res.detail.byGame).map(g => ({ label: g.label, balances: g.balances }))
      : [{ label: GAMES[r.game]?.name || 'Game', balances: res.balances }];
    for (const g of games) {
      if (!columns.includes(g.label)) columns.push(g.label);
      for (const p of r.players) {
        const k = who(p.id);
        const row = rows.get(k) || {};
        row[g.label] = Math.round(((row[g.label] || 0) + (g.balances[p.id] || 0)) * 100) / 100;
        rows.set(k, row);
      }
    }
  }
  return { columns, rows };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parts = iso => String(iso || '').split('-').map(Number);

/** "Oct 16 to 18", "Oct 30 to Nov 2" or "Oct 16" for a one-day trip. */
export function tripDates(trip) {
  const [y1, m1, d1] = parts(trip?.start), [y2, m2, d2] = parts(trip?.end);
  if (!y1 || !m1 || !d1) return '';
  const a = `${MONTHS[m1 - 1]} ${d1}`;
  if (!y2 || (y1 === y2 && m1 === m2 && d1 === d2)) return a;
  return m1 === m2 && y1 === y2 ? `${a} to ${d2}` : `${a} to ${MONTHS[m2 - 1]} ${d2}`;
}

/**
 * The trip's days at a glance for Up next: one chip a round, oldest first, from its rounds and
 * planned rounds: [{ key, label, state: 'done' | 'now' | 'planned' }]. A day with two rounds says
 * which is morning and which is afternoon ("Sat AM", "Sat PM").
 */
export function tripChips(status) {
  const items = [
    ...status.done.map(r => ({ key: r.id, at: r.createdAt || finishedAt(r), state: 'done' })),
    ...status.live.map(r => ({ key: r.id, at: r.createdAt || Date.now(), state: 'now' })),
    ...status.planned.map(p => {
      const [y, m, d] = parts(p.date);
      const [h, min] = String(p.teeTime || '09:00').split(':').map(Number);
      return { key: p.id, at: new Date(y, m - 1, d, h || 9, min || 0).getTime(), state: 'planned' };
    }),
  ].sort((a, b) => a.at - b.at);
  const dayKey = t => dayOf(t);
  const perDay = new Map();
  for (const x of items) perDay.set(dayKey(x.at), (perDay.get(dayKey(x.at)) || 0) + 1);
  return items.map(x => {
    const d = new Date(x.at);
    const half = perDay.get(dayKey(x.at)) > 1 ? (d.getHours() < 12 ? ' AM' : ' PM') : '';
    return { key: x.key, label: `${WEEKDAYS[d.getDay()]}${half}`, state: x.state };
  });
}

/** "You’re up $12", "You’re down $5" or "You’re even". */
export function upDown(v) {
  return v > 0 ? `You’re up ${money(v)}` : v < 0 ? `You’re down ${money(-v)}` : 'You’re even';
}
