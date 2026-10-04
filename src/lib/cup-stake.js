// A team points trip's stake as trip money (2026-10-04). Once the cup is decided (cup.js, trips.js
// cupStatus), each of its payments (loser to winner, worked out from the teams, so the same on every
// phone) is money between the two of them on the trip, like a trip expense the winner paid for the
// loser: it's in each person's balance on the Tab, Settle the trip, and the published plan when the
// trip's rounds link the two up (trip-plan.js). Paying it from the Tab or Settle the trip is a
// payment for trip money (trip-expenses.js newPayment), which reaches every phone with the trip's
// expenses, so both phones of the pair see it squared.
//
// Whether a line is on the Tab is the same on every phone (2026-10-04 fix): it is when its two people
// sat in a cup round shared live together (cup.js stakeLink), so both their phones tell who's who in a
// payment between them by those seats, and every phone places them the way it places them in a
// payment (trip-expenses.js placedOn). A line between two people who never played together stays off
// the Tab on every phone and is marked paid on the trip, as before, so a mark and a Tab payment are
// never both asked for. The "I paid" marks from before (`state.cupPaid`, cup-sync.js, and a phone not
// up to date still only has them) still count: a line's money here is what the marks leave open, and
// on a line on the Tab they only cover what the pair's payments haven't, so a mark and a payment for
// the same stake count once.
//
// Each person's trip total already has the stake (trips.js standings); it's never in the trip's
// expenses list or their totals, so it counts once. Old trips, and trips without a cup or a stake,
// have none of this. Pure, unit tested.
import { cupOf } from './cup.js';
import { cupStatus, tripOf, tripPeople, tripPlans, tripRounds } from './trips.js';
import { tripPays } from './trip-expenses.js';
import { tripSettleOf } from './trip-pay.js';
import { cleanPlan } from './trip-plan.js';
import { finishedAt } from './pair-debts.js';
import { isoDate } from './plans.js';

const dayOf = t => isoDate(new Date(t || 0));

/** The id the stake's line between two people goes by as trip money: "cup:<tripId>:<loser>><winner>". */
export const stakeMoneyId = (tripId, key) => `cup:${tripId}:${key}`;
export const isStakeMoney = x => !!x?.stake;

/**
 * Whether the cup can be decided on this phone (`over`: the last round is in and nothing is still
 * being played or planned) and whether another group's unfinished round counts as it stood
 * (`close`: the organizer ended the trip, or its last day has gone by). The same rules as the trip's
 * own phase (trips.js tripStatus), from the rounds, plans and payments alone, so the Tab can ask
 * without working out the whole trip.
 */
export function cupTiming(state, trip, { now = Date.now() } = {}) {
  const id = trip.id;
  const today = dayOf(now);
  const rounds = tripRounds(state, id).filter(r => r.status === 'done' || r.status === 'active');
  const done = rounds.filter(r => r.status === 'done');
  const live = rounds.filter(r => r.status === 'active');
  const planned = tripPlans(state, id, new Date(now));
  const endedAt = trip.endedAt || cleanPlan(state.tripPlans?.[id])?.endedAt || null;
  // Someone settled the whole trip (trip-pay.js): every phone in a round hears it
  const closed = [...(state.settlements || []), ...tripPays(state, id)].some(s => {
    const t = tripSettleOf(s);
    return t && t.id === id && !t.part;
  });
  const over = !!endedAt || closed || (!!trip.end && (today > trip.end || (today === trip.end && done.some(r => dayOf(finishedAt(r)) === today))));
  return { over: over && !live.length && !planned.length, close: !!endedAt || (!!trip.end && today > trip.end) };
}

const cache = new WeakMap();

/** The trip's cup on this phone (trips.js cupStatus), or null for a money trip. Kept for the day. */
export function cupStake(state, tripId, { now = Date.now() } = {}) {
  let byState = cache.get(state);
  if (!byState) { byState = new Map(); cache.set(state, byState); }
  const key = `${tripId}|${dayOf(now)}`;
  if (byState.has(key)) return byState.get(key);
  const trip = tripOf(state, tripId);
  const out = trip && cupOf(trip) ? cupStatus(state, trip, tripPeople(state, tripId), cupTiming(state, trip, { now })) : null;
  byState.set(key, out);
  return out;
}

/**
 * The decided stake as trip money on this phone, one a line still open after the marks: shaped like
 * a trip expense as trip-expenses.js resolves one, the winner as the payer and the loser in it, so
 * the Tab, Settle the trip and the plan take it as they take an expense ({ id, tripId, stake: true,
 * what, payer, parts, balances, cents, amount, names, at, mark, key }, ids as this phone knows them).
 */
export function stakeMoney(state, tripId, { now = Date.now() } = {}) {
  const cup = cupStake(state, tripId, { now });
  if (!cup?.final || !cup.lines.length) return [];
  const at = Math.max(0, ...tripRounds(state, tripId).filter(r => r.status === 'done').map(finishedAt), ...cup.entries.map(e => e.at || 0));
  return cup.lines.filter(l => l.onTab && l.open > 0 && l.fromId !== l.toId).map(l => ({
    id: stakeMoneyId(tripId, l.key), tripId, stake: true, what: 'Cup stake', key: l.key,
    payer: l.toId, parts: [{ id: l.fromId, cents: l.open, part: null }],
    balances: { [l.toId]: l.open, [l.fromId]: -l.open }, cents: l.open, amount: l.open / 100,
    names: { [l.fromId]: l.fromName, [l.toId]: l.toName }, at,
    // What the plan checks it against: who won and what's open on the line
    mark: `w${cup.winner}.${l.open.toString(36)}`,
    // Marked paid in part before (cup.js stakeMarks): pair by pair, never on the published plan,
    // since what's open on it then turns on the pair's payments, which not every phone has
    ...(l.paid > 0 ? { marked: true } : {}),
    // The two of them as a trip expense writes them, so a payment between them names them the same way
    raw: { id: stakeMoneyId(tripId, l.key), payer: l.people.to, people: [l.people.from] },
  }));
}

/** A trip's decided stake lines as trip expenses write people (stakeMoney `raw`), for a payment between two of them. */
export function stakeRaw(state, tripId, { now = Date.now() } = {}) {
  return stakeMoney(state, tripId, { now }).map(x => x.raw);
}

/** Trip ids this phone knows that are played for team points. */
function cupTripIds(state) {
  const ids = new Set();
  for (const t of Object.values(state.trips || {})) if (t?.format === 'cup' && t.id) ids.add(t.id);
  for (const r of Object.values(state.rounds || {})) if (r?.trip?.format === 'cup' && r.trip.id) ids.add(r.trip.id);
  for (const p of Object.values(state.plans || {})) if (p?.trip?.format === 'cup' && p.trip.id) ids.add(p.trip.id);
  return [...ids];
}

const allCache = new WeakMap();

/** Every decided stake on this phone as trip money (stakeMoney), for the Tab. */
export function allStakeMoney(state, { now = Date.now() } = {}) {
  let byState = allCache.get(state);
  if (!byState) { byState = new Map(); allCache.set(state, byState); }
  const key = dayOf(now);
  if (byState.has(key)) return byState.get(key);
  const out = cupTripIds(state).flatMap(id => stakeMoney(state, id, { now }));
  byState.set(key, out);
  return out;
}

/**
 * What the decided stakes put between you and one person: [{ expense, amount, at }] newest first,
 * amount in cents, positive when they owe you (you're on the winning team). `isMine` and `isThem`
 * say who's who (ids as this phone knows them), as trip-expenses.js expensesBetween does.
 */
export function stakeBetween(state, isMine, isThem, { now = Date.now() } = {}) {
  const out = [];
  for (const x of allStakeMoney(state, { now })) {
    const p = x.parts[0];
    const c = isMine(x.payer) && isThem(p.id) ? p.cents : isThem(x.payer) && isMine(p.id) ? -p.cents : 0;
    if (c) out.push({ expense: x, amount: c, at: x.at || 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}
