// Trips: a few rounds played together over some days (a golf trip). Everyone on the trip sees the
// standings. Trip money is in each person's total on the Tab like any other round (folded in, not
// held apart), and the trip is settled once, right after its last round, in the fewest payments
// over just the trip's rounds. Someone leaving early can settle their part first.
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
import { FETCH_DAYS, canonicalOf, codeOf, finishedAt } from './pair-debts.js';
import { tripOfPayment } from './trip-pay.js';
import { daysUntil, isoDate } from './plans.js';
import { meFor } from './format.js';

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
 * The payments that count toward the trip, and what's left to pay on it, in cents:
 * - every payment made from "Settle the trip" for this trip (its id says so, trip-pay.js),
 * - every payment tied to one of the trip's rounds (the round's own settle up, or the shared Tab
 *   rows for that round),
 * - and a payment on the Tab between two people who played the trip together, made once the trip
 *   started and tied to no round, up to what the trip still has the payer owing and the payee
 *   owed. Trip money is in each person's total on the Tab, so paying that total pays the trip too,
 *   and the trip never asks for it again.
 */
function paymentsOf(state, id, rounds, together, bal) {
  const who = canonicalOf(state);
  const roundIds = new Set(rounds.map(r => r.id));
  const codes = new Set(rounds.map(codeOf).filter(Boolean));
  const startAt = rounds.length ? Math.min(...rounds.map(r => r.createdAt || finishedAt(r))) : Infinity;
  const left = { ...bal };
  const pay = (f, t, c) => { left[f] = (left[f] || 0) + c; left[t] = (left[t] || 0) - c; };
  const trip = [], onRounds = [], loose = [];
  for (const s of state.settlements || []) {
    const t = tripOfPayment(s);
    if (t) { if (t === id) trip.push(s); continue; }
    if (roundIds.has(s.roundId) || (s.code && codes.has(s.code))) { onRounds.push(s); continue; }
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
  return { trip, onRounds, counted, left };
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
 * - plan: the fewest payments left over just the trip's rounds, [{ from, to, amount }].
 * - paid: payments made from "Settle the trip"; perRound: how many payments the rounds one by one
 *   would have taken.
 * The trip opens to settle right after its last round: no round still being played, no planned
 * round still to come on this phone, and either the last day has come and a round finished that
 * day, the last day has gone, or someone said they're done playing (`endedAt`).
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
  const bal = balanceCents(state, rounds);
  const { trip: paid, counted, onRounds, left } = paymentsOf(state, id, rounds, together, bal);
  const plan = fewestPayments(Object.fromEntries(Object.entries(left).map(([k, c]) => [k, c / 100])), { canPay: (a, b) => together.has(pairKey(a, b)) });

  const lastDone = done.length ? Math.max(...done.map(finishedAt)) : 0;
  const over = !!trip.endedAt || (!!trip.end && (today > trip.end || (today === trip.end && done.some(r => dayOf(finishedAt(r)) === today))));
  const quiet = !live.length && !planned.length;
  let phase;
  if (!done.length && !live.length) phase = trip.start && today < trip.start ? 'soon' : over ? 'empty' : planned.length ? 'soon' : 'on';
  else if (quiet && over && done.length) phase = plan.length ? 'ready' : 'square';
  else phase = 'on';
  const lastPaid = Math.max(0, ...paid.map(s => s.at || 0), ...counted.map(x => x.settlement.at || 0), ...onRounds.map(s => s.at || 0));
  const who = canonicalOf(state);
  const standings = [...people.entries()].filter(([pid]) => money.some(r => r.players.some(p => who(p.id) === pid)))
    .map(([pid, v]) => ({ id: pid, amount: (bal[pid] || 0) / 100, rounds: v.rounds }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  return {
    trip, phase, rounds, done, live, planned, money, people, standings, plan, paid,
    points: money.length ? null : pointsOf(state, rounds),
    perRound: money.reduce((a, r) => a + roundResults(r).transfers.length, 0),
    lastDone, squareAt: phase === 'square' ? Math.max(lastPaid, lastDone) : null,
    ...tripDay(trip, today),
  };
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
 * The trip a round on `day` (YYYY-MM-DD) could count for: one whose dates take that day, your own
 * trip first, then the newest. Null when no trip is on.
 */
export function tripOnDay(state, day) {
  const list = [...tripsOf(state).values()].filter(t => t.start && t.end && t.start <= day && day <= t.end);
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

/**
 * Where a payment from "Settle the trip" goes on the server: the newest of the trip's rounds that
 * was shared live, that both people played, and that their phones still look up, with each
 * person's id in that round. Its payment rows reach both phones (and everyone else in that round).
 * Null when there's no such round: the payment then stays on this phone and your account.
 */
export function tripPayRoute(state, tripId, from, to, { now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const F = who(from), T = who(to);
  const rounds = tripRounds(state, tripId)
    .filter(r => r.status === 'done' && countsMoney(r) && codeOf(r) && finishedAt(r) >= now - FETCH_DAYS * DAY)
    .sort((a, b) => finishedAt(b) - finishedAt(a));
  for (const r of rounds) {
    const f = r.players.find(p => who(p.id) === F), t = r.players.find(p => who(p.id) === T);
    if (f && t) return { code: codeOf(r), from: f.id, to: t.id, by: meFor(r, state), roundId: r.id };
  }
  return null;
}
