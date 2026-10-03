// Overnight 6 follow-ups (2026-10-03): the money reviewer's and the QA tester's findings. Every money
// fix here has a test that failed before it and passes after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { addBet, betsOf, changeBet, setBetWinner } from './pair-bets.js';
import { applyBetAsk, buildBetAsk } from './bet-asks.js';
import { tabResults } from './play-for.js';
import { newTrip, tripStamp, tripStatus, tripPayment } from './trips.js';
import { outstanding, tabBalances } from './ledger.js';
import { buildPlan, planState } from './trip-plan.js';
import { allocatePayment, applyRows, pairRounds } from './shared-tab.js';
import { canCarry, cardCarry, carryReducer } from './carry.js';

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

/** The reviewer's trip: Q1 a $2 skins money round on it, then lunch with a $5 money side bet a beats b. */
function lunchTrip({ lunchOnTrip = true } = {}) {
  const ids = ['t', 'a', 'b'];
  const q1 = round('q1', ids, wins(ids, [1, 't'], [2, 't'], [3, 'b']), { at: OCT(16, 15), code: 'AAAAAA' });
  let q2 = round('q2', ids, wins(ids, [1, 'a'], [2, 'a'], [3, 'a'], [4, 't']), lunchOnTrip
    ? { at: OCT(17, 15), code: 'BBBBBB', playFor: LUNCH }
    : { at: OCT(17, 15), playFor: LUNCH, trip: null });
  q2 = cashBet(q2, 'cb', ['a', 'b'], 5, 'a');
  return stateOf('t', [q1, q2], { trips: { tp: TRIP } });
}

test('a live trip plan keeps a reward round’s points off the Tab: the plan matches the Tab without it', () => {
  // The lunch round off the trip and only on this phone: its money is in the balances the plan leaves
  const s0 = lunchTrip({ lunchOnTrip: false });
  assert.deepEqual(roundResults(s0.rounds.q2).balances, { t: -2, a: 10, b: -8 }); // points
  assert.deepEqual(lines(outstanding(s0, { now: NOW })), ['a>t 6', 'b>a 5']);
  const plan = buildPlan(s0, 'tp', { now: NOW });
  const s1 = { ...s0, tripPlans: { tp: plan } };
  assert.equal(planState(s1, 'tp', { now: NOW }).status, 'live');
  // Before the fix the points went in as dollars: b>a 8, a>t 4
  assert.deepEqual(lines(outstanding(s1, { now: NOW })), ['a>t 6', 'b>a 5']);
  assert.deepEqual(perPerson(outstanding(s1, { now: NOW })), tabBalances(s1));
});

// ---------------------------------------------------------------------------------------------
// Money findings 2 and 3 (decided: a reward round's side bets for money are in the trip, like the
// Tab): the standings, the trip's plan and Settle the trip all count them, in dollars

/** Pay the Tab between two people the way the person card does, rows and all. */
function payTab(state, from, to, amount) {
  const pay = allocatePayment(state, { from, to, amount }, { now: NOW });
  const s = applyRows(state, pay.rows);
  return { ...s, settlements: [...s.settlements, ...pay.settlements] };
}
/** Settle every line of the trip, the way Settle the trip does. */
function settleTrip(state, id) {
  let s = state;
  for (const line of tripStatus(s, id, { now: NOW }).plan) {
    const p = tripPayment(s, id, line.from, line.to, { now: NOW });
    s = applyRows(s, p.rows);
    s = { ...s, settlements: [...s.settlements, ...p.settlements] };
  }
  return s;
}
const tripLines = st => st.plan.map(t => `${t.from}>${t.to} ${t.amount}`).sort();

test('a trip counts a reward round’s side bets for money: standings and plan match the Tab', () => {
  const s0 = lunchTrip();
  const st = tripStatus(s0, 'tp', { now: NOW });
  // Before: t +6, a -6, b 0 (the $5 lunch bet left out of the trip but on the Tab)
  assert.deepEqual(st.standings.map(x => [x.id, x.amount]), [['t', 6], ['a', -1], ['b', -5]]);
  assert.deepEqual(Object.fromEntries(st.standings.map(x => [x.id, x.amount])), tabBalances(s0));
  // Pair by pair until there's a plan: each pair's money stays between them, as on the Tab
  assert.deepEqual(tripLines(st), ['a>t 6', 'b>a 5']);
  assert.deepEqual(tripLines(st), lines(outstanding(s0, { now: NOW })));
  assert.equal(st.perRound, 2);
});

test('paying a reward round’s side bet on the Tab never invents a trip line nobody owes', () => {
  const s = payTab(lunchTrip(), 'b', 'a', 5);
  const st = tripStatus(s, 'tp', { now: NOW });
  // Before the fix the trip asked a to pay b $5
  assert.deepEqual(tripLines(st), ['a>t 6']);
  assert.deepEqual(lines(outstanding(s, { now: NOW })), ['a>t 6']);
});

test('with the trip’s plan published, the Tab, the trip and Settle the trip agree, and settling squares everyone', () => {
  const s0 = lunchTrip();
  const plan = buildPlan(s0, 'tp', { now: NOW });
  // The plan covers the lunch round too, in dollars
  assert.equal(plan.rounds.length, 2);
  const s1 = { ...s0, tripPlans: { tp: plan } };
  assert.equal(planState(s1, 'tp', { now: NOW }).status, 'live');
  const st = tripStatus(s1, 'tp', { now: NOW });
  const want = { t: 6, a: -1, b: -5 };
  assert.deepEqual(perPerson(st.plan), want);
  assert.deepEqual(perPerson(outstanding(s1, { now: NOW })), want);
  assert.deepEqual(tripLines(st), lines(outstanding(s1, { now: NOW })));
  // a's and b's phones see the same plan, and their own lines match
  for (const me of ['a', 'b']) {
    const sp = { ...stateOf(me, Object.values(s0.rounds)), tripPlans: { tp: plan } };
    assert.equal(planState(sp, 'tp', { now: NOW }).status, 'live', me);
    const mine = l => l.filter(x => x.includes(me));
    assert.deepEqual(mine(lines(outstanding(sp, { now: NOW }))), mine(lines(outstanding(s1, { now: NOW }))), me);
  }
  const done = settleTrip(s1, 'tp');
  assert.deepEqual(outstanding(done, { now: NOW }), []);
  assert.equal(tripStatus(done, 'tp', { now: NOW }).plan.length, 0);
});

// ---------------------------------------------------------------------------------------------
// Note: changing a bet without saying what it's played for keeps what it was

test('changing an old reward round’s bet without a playFor keeps it points, never money', () => {
  const ids = ['t', 'a', 'b'];
  let r = round('q', ids, wins(ids, [1, 'a']), { playFor: LUNCH, trip: null });
  // An old saved bet: no playFor, which is points
  r = { ...r, bets: [{ id: 'old', kind: 'custom', sides: ['a', 'b'], stake: 5, label: 'Side bet', winner: 'a', at: 1 }] };
  assert.equal(roundResults(r).cash, undefined);
  const raw = { id: 'old', kind: 'custom', sides: ['a', 'b'], stake: 8, label: 'Side bet' };
  const changed = changeBet(r, 'old', raw);
  assert.equal(betsOf(changed)[0].playFor, 'points');
  assert.equal(roundResults(changed).cash, undefined);
  // The same through a change asked from the other player's phone
  const ask = buildBetAsk({ by: 'b', op: 'change', id: 'old', bet: raw }, 2).betAsk;
  assert.equal(roundResults(applyBetAsk(r, ask)).cash, undefined);
  // A money bet changed without saying stays money, and saying so still switches it
  const m = cashBet(round('m', ids, {}, { playFor: LUNCH, trip: null }), 'x', ['a', 'b'], 5, 'a');
  assert.equal(betsOf(changeBet(m, 'x', { ...raw, id: 'x' }))[0].playFor, 'money');
  assert.equal(betsOf(changeBet(r, 'old', { ...raw, playFor: 'money' }))[0].playFor, 'money');
});

// ---------------------------------------------------------------------------------------------
// Money finding 4: a carry two people agreed on stays when a shared lunch round has a money side bet
// between two other people

test('an agreed carry stays when a shared reward round’s money bet is between two other people', () => {
  const ids = ['t', 'a', 'b'];
  // A money round only this phone has: a owes t $6
  const q1 = round('q1', ids, wins(ids, [1, 't'], [2, 't'], [3, 'b']), { at: NOW - 2 * 864e5, trip: null });
  const lunch = round('q2', ids, wins(ids, [1, 'a'], [4, 't']), { at: NOW - 864e5, code: 'BBBBBB', playFor: LUNCH, trip: null });
  const ab = cashBet(lunch, 'cb', ['a', 'b'], 5, 'a');
  const s = stateOf('t', [q1, ab]);
  const owed = outstanding(s, { now: NOW }).find(x => x.from === 'a' && x.to === 't');
  assert.equal(owed.amount, 6);
  const carry = carryReducer(carryReducer(null, { type: 'ask', from: 'a', to: 't', amount: 6, by: 'a', at: NOW - 500 }), { type: 'agree', at: NOW - 400 });
  // Before the fix the lunch round counted as t and a's shared round, so the carry read 0 there and vanished
  assert.equal(pairRounds(s, 'a', 't', { now: NOW }).length, 0);
  assert.equal(canCarry(s, 'a', 't', NOW), false);
  assert.equal(cardCarry({ ...s, carries: [carry] }, 't', 'a', owed, NOW)?.carried, 6);
  // a and b had a money bet together, so the lunch round is theirs
  assert.deepEqual(pairRounds(s, 'a', 'b', { now: NOW }).map(r => r.id), ['q2']);
  // With a money bet between t and a too, it's t and a's shared round as well
  const ta = cashBet(ab, 'ct', ['t', 'a'], 2, 't');
  assert.deepEqual(pairRounds(stateOf('t', [q1, ta]), 'a', 't', { now: NOW }).map(r => r.id), ['q2']);
});
