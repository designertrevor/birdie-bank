// Overnight 6 follow-ups (2026-10-03): the money reviewer's and the QA tester's findings. Every money
// fix here has a test that failed before it and passes after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { addBet, setBetWinner } from './pair-bets.js';
import { tabResults } from './play-for.js';
import { newTrip, tripStamp, tripStatus, tripPayment } from './trips.js';
import { outstanding, tabBalances } from './ledger.js';
import { buildPlan, planState } from './trip-plan.js';
import { allocatePayment, applyRows } from './shared-tab.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;
const LUNCH = { kind: 'reward', reward: 'Lunch', owes: 'last' };
const TRIP = newTrip({ id: 'tp', name: 'Bandon', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });
const NOW = OCT(18, 13);

/** A finished 9-hole Skins round (carryover on), everyone par unless `holes` says, on the trip unless `trip` is null. */
function round(id, ids, holes = {}, { at = OCT(16), code = null, skin = 2, playFor = null, trip = TRIP, names = {} } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: names[x] || x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: skin, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * HOUR; r.status = 'done'; r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (code) r.shareCode = code;
  if (playFor) r.playFor = playFor;
  return r;
}
/** Hole wins: [[holeNo, winnerId], ...], the winner a birdie and everyone else par. */
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const stateOf = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra });
/** A custom side bet for money on a reward round, won by `winner`. */
const cashBet = (r, id, sides, stake, winner) => setBetWinner(addBet(r, { id, kind: 'custom', sides, stake, playFor: 'money' }), id, 1, winner);

// ---------------------------------------------------------------------------------------------
// Money finding 5: a reward round's side bets for money settle between the two players of each bet

test('a reward round’s money side bets pay pair by pair, never through someone outside the bet', () => {
  const ids = ['t', 'a', 'b'];
  let r = round('q', ids, wins(ids, [1, 'a']), { playFor: LUNCH, trip: null });
  r = cashBet(r, 'x', ['a', 'b'], 5, 'a'); // b pays a $5
  r = cashBet(r, 'y', ['b', 't'], 5, 'b'); // t pays b $5
  const c = roundResults(r).cash;
  // b is level overall, but each bet is between its own two players
  assert.deepEqual(c.balances, { t: -5, a: 5, b: 0 });
  assert.deepEqual(c.transfers.map(x => `${x.from}>${x.to} ${x.amount}`).sort(), ['b>a 5', 't>b 5']);
  assert.deepEqual(tabResults(r).transfers, c.transfers);
});

// ---------------------------------------------------------------------------------------------
// Money finding 1: once a trip plan is live, the Tab counts a reward round's side bets in dollars,
// never its points

const lines = plan => plan.map(t => `${t.from}>${t.to} ${t.amount}`).sort();
/** Each person's total on the Tab's plan: what they're owed less what they owe. */
function perPerson(plan) {
  const out = {};
  for (const t of plan) { out[t.to] = Math.round(((out[t.to] || 0) + t.amount) * 100) / 100; out[t.from] = Math.round(((out[t.from] || 0) - t.amount) * 100) / 100; }
  return out;
}

/** The reviewer's trip: Q1 a $2 skins money round, Q2 lunch with a $5 money side bet a beats b. */
function lunchTrip() {
  const ids = ['t', 'a', 'b'];
  const q1 = round('q1', ids, wins(ids, [1, 't'], [2, 't'], [3, 'b']), { at: OCT(16, 15), code: 'AAAAAA' });
  let q2 = round('q2', ids, wins(ids, [1, 'a'], [2, 'a'], [3, 'a'], [4, 't']), { at: OCT(17, 15), code: 'BBBBBB', playFor: LUNCH });
  q2 = cashBet(q2, 'cb', ['a', 'b'], 5, 'a');
  return stateOf('t', [q1, q2], { trips: { tp: TRIP } });
}

test('a live trip plan keeps a reward round’s points off the Tab: the plan matches the Tab without it', () => {
  const s0 = lunchTrip();
  assert.deepEqual(roundResults(s0.rounds.q2).balances, { t: -2, a: 10, b: -8 }); // points
  assert.deepEqual(lines(outstanding(s0, { now: NOW })), ['a>t 6', 'b>a 5']);
  const plan = buildPlan(s0, 'tp', { now: NOW });
  const s1 = { ...s0, tripPlans: { tp: plan } };
  assert.equal(planState(s1, 'tp', { now: NOW }).status, 'live');
  // Before the fix the points went in as dollars: b>a 8, a>t 4
  assert.deepEqual(lines(outstanding(s1, { now: NOW })), ['a>t 6', 'b>a 5']);
  assert.deepEqual(perPerson(outstanding(s1, { now: NOW })), tabBalances(s1));
});
