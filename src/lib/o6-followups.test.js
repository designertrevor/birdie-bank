// Overnight 6 follow-ups (2026-10-03): the money reviewer's and the QA tester's findings. Every money
// fix here has a test that failed before it and passes after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { addBet, betsOf, changeBet, setBetWinner } from './pair-bets.js';
import { applyBetAsk, askSettled, betAskProblem, buildBetAsk } from './bet-asks.js';
import { tabResults } from './play-for.js';
import { newTrip, tripStamp, tripStatus, tripPayment } from './trips.js';
import { headToHeadSummary, outstanding, personStory, tabBalances } from './ledger.js';
import { nemesis } from './rivalry.js';
import { profileStats } from './profile-model.js';
import { buildPlan, planRows, planState } from './trip-plan.js';
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

// ---------------------------------------------------------------------------------------------
// QA Q1: the tester's two-phone trip. Tab totals equal each person's net across the rounds, before
// and after a payment on the trip's plan

const ANN_TRIP = newTrip({ id: 'tp', name: 'Bandon', start: '2026-10-16', end: '2026-10-18', by: 'ann', now: OCT(1) });
function qaTrip() {
  const ids = ['ann', 'bob', 'cal', 'dee'];
  const opt = (at, code, extra = {}) => ({ at, code, trip: ANN_TRIP, ...extra });
  // A money round: Ann +45, Cal +15, Dee −15, Bob −45 ($7.50 skins)
  const r1 = round('r1', ids, wins(ids, [1, 'ann'], [2, 'ann'], [3, 'ann'], [4, 'cal'], [5, 'cal'], [6, 'dee']), opt(OCT(16, 15), 'CODE01', { skin: 7.5 }));
  // Lunch, with a $5 side bet for money Cal pays Ann (the points decide lunch)
  let r2 = round('r2', ids, wins(ids, [1, 'dee'], [2, 'bob']), opt(OCT(17, 11), 'CODE02', { playFor: LUNCH }));
  r2 = cashBet(r2, 'cb', ['ann', 'cal'], 5, 'ann');
  // A 9-hole Skins money round: Bob +28, Ann −4, Cal −12, Dee −12 ($2 skins)
  const r3 = round('r3', ids, wins(ids, [1, 'bob'], [2, 'bob'], [3, 'bob'], [4, 'bob'], [5, 'bob'], [6, 'ann']), opt(OCT(17, 17), 'CODE03'));
  return [r1, r2, r3];
}

test('QA trip: with the plan published, every phone’s Tab total is that person’s net, before and after a trip payment', () => {
  const rounds = qaTrip();
  assert.deepEqual(roundResults(rounds[0]).balances, { ann: 45, bob: -45, cal: 15, dee: -15 });
  assert.deepEqual(roundResults(rounds[2]).balances, { ann: -4, bob: 28, cal: -12, dee: -12 });
  const net = { ann: 46, bob: -17, cal: -2, dee: -27 };
  const organizer = stateOf('ann', rounds, { trips: { tp: { ...ANN_TRIP, endedAt: NOW - HOUR } } });
  const plan = buildPlan(organizer, 'tp', { now: NOW, endedAt: NOW - HOUR });
  assert.equal(plan.rounds.length, 3);
  const phone = me => (me === 'ann' ? { ...organizer, tripPlans: { tp: plan } } : { ...stateOf(me, rounds), tripPlans: { tp: plan } });
  const total = (s, me) => perPerson(outstanding(s, { now: NOW }))[me] || 0;
  for (const me of Object.keys(net)) {
    const s = phone(me);
    assert.equal(planState(s, 'tp', { now: NOW }).status, 'live', me);
    // Before the fix Ann showed up $56 and Dee was asked for $33
    assert.equal(total(s, me), net[me], `${me}'s Tab`);
    assert.equal(tripStatus(s, 'tp', { now: NOW }).standings.find(x => x.id === me).amount, net[me], `${me}'s trip`);
  }
  // Ann marks $4 from Bob paid on the trip's plan (the line between them, whichever way it goes)
  const line = plan.lines.find(l => [l.from, l.to].includes('ann') && [l.from, l.to].includes('bob'));
  const [payer, payee] = [line.from, line.to];
  const rows = planRows(phone('ann'), payer, payee, { amount: 400, now: NOW, trip: 'tp' }).rows;
  assert.equal(rows.length, 1);
  for (const me of Object.keys(net)) {
    const s = applyRows(phone(me), rows);
    const want = net[me] + (me === payer ? 4 : me === payee ? -4 : 0);
    assert.equal(planState(s, 'tp', { now: NOW }).status, 'live', me);
    assert.equal(total(s, me), want, `${me}'s Tab after the payment`);
  }
});

// ---------------------------------------------------------------------------------------------
// Money finding 6: an ask that comes back again changes nothing the second time

test('a replayed side bet ask can’t bring back a bet taken off or undo a later change', () => {
  const ids = ['t', 'a', 'b'];
  let r = round('q', ids, wins(ids, [1, 'a'], [3, 'b']), { playFor: LUNCH, trip: null });
  r.status = 'active';
  const apply = (round, ask) => (betAskProblem(round, ask) ? round : applyBetAsk(round, ask));
  const add = buildBetAsk({ by: 'a', op: 'add', id: 'B1', bet: { kind: 'hole', sides: ['a', 'b'], stake: 3, playFor: 'money' } }, 1).betAsk;
  const change = buildBetAsk({ by: 'b', op: 'change', id: 'B1', bet: { kind: 'hole', sides: ['a', 'b'], stake: 6, playFor: 'money' } }, 2).betAsk;
  const remove = buildBetAsk({ by: 'a', op: 'remove', id: 'B1' }, 3).betAsk;
  // The add's answer never got through, so the keeper's phone hears it again after the remove
  let done = [add, change, remove].reduce(apply, r);
  assert.equal(betsOf(done).length, 0);
  done = apply(done, add);
  assert.equal(betsOf(done).length, 0, 'the removed bet stays gone');
  assert.equal(askSettled(done, add), true);
  // A change applied once, then the keeper edits the bet; the same change heard again does nothing
  let k = [add, change].reduce(apply, r);
  k = changeBet(k, 'B1', { ...betsOf(k)[0], stake: 9 });
  assert.equal(betsOf(apply(k, change))[0].stake, 9, 'the later edit stands');
  // And the keeper taking a bet off directly keeps an add heard again from bringing it back
  const gone = apply(apply(r, add), { ...remove, at: 4, by: 'b' });
  assert.equal(betsOf(apply({ ...gone, betAsksDone: [] }, add)).length, 0);
});

// ---------------------------------------------------------------------------------------------
// Note and QA Q11: the nemesis card and the profile's All time count a reward round's side bets for
// money like the Tab and the person card do

function cashLunch() {
  const ids = ['t', 'a', 'b'];
  // A money round t wins $2 from each; lunch, where a beats t $10 on a side bet for money
  const q1 = round('q1', ids, wins(ids, [1, 't']), { at: OCT(10), trip: null });
  let q2 = round('q2', ids, wins(ids, [1, 'b'], [2, 'b']), { at: OCT(11), playFor: LUNCH, trip: null });
  q2 = cashBet(q2, 'cb', ['a', 't'], 10, 'a');
  return stateOf('t', [q1, q2]);
}

test('the nemesis head to head counts a reward round’s side bets for money, only with who you bet', () => {
  const s = cashLunch();
  const me = new Set(['t']);
  const story = personStory(s, me, 'a');
  assert.equal(story.net, -8);
  const h = headToHeadSummary(s, me, { moneyOnly: true });
  // Before: only the money round, so t looked $2 up on a and a was never the nemesis
  assert.equal(h.get('a').net, story.net);
  assert.deepEqual([h.get('a').rounds, h.get('a').won, h.get('a').lost], [2, 1, 1]);
  // b had no money bet with t at lunch: just the money round
  assert.deepEqual([h.get('b').rounds, h.get('b').net], [1, 2]);
  assert.equal(nemesis(s, me)?.id, 'a');
  assert.equal(nemesis(s, me).net, -8);
});

test('the profile’s All time net counts a reward round’s side bets for money, as the Tab does', () => {
  const s = cashLunch();
  const st = profileStats(s, ['t']);
  // Before: $4, the money round alone
  assert.equal(st.money.net, tabBalances(s).t);
  assert.equal(st.money.net, -6);
  assert.equal(st.money.rounds, 2);
});
