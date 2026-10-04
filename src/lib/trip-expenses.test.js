// Trip expenses: split to the cent, on the Tab with the bets, in Settle the trip and the trip's
// published plan, the same on every phone, and gone again when deleted. Trips with no expenses keep
// exactly the money they had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { headToHeadSummary, outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { breakdownWith } from './where-from.js';
import { applyRows } from './shared-tab.js';
import { buildPlan, cleanPlan, duePlan, planState, samePlan } from './trip-plan.js';
import { canDeleteTrip, newTrip, tripPayment, tripStamp, tripStatus, tripsOf, currentTrips } from './trips.js';
import {
  allExpenses, cleanExpense, expenseMark, expenseTotals, mergeExpenses, parseAmount, personFor, resolveExpense, shareCents, splitLine, tripExpenses,
} from './trip-expenses.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { makeBackup, mergeBackup, parseBackup } from './backup.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;
const TRIP = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });
const NOW = OCT(18, 13);
const cents = v => Math.round(v * 100);

function round(id, ids, holes = {}, { at = OCT(16), trip = TRIP, code = null, skin = 2 } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * HOUR;
  r.status = 'done';
  r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (code) r.shareCode = code;
  return r;
}
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const stateOf = (me, rounds, extra = {}) => ({
  me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra,
});

/** Five friends over three rounds shared live (as in trip-plan.test.js): Eve plays only the first, Cal skips the second. */
function rounds5() {
  const all = ['t', 'a', 'b', 'c', 'e'];
  const tab = ['t', 'a', 'b'], tabc = ['t', 'a', 'b', 'c'];
  const r1 = round('q1', all, wins(all, [1, 'a'], [2, 'a'], [3, 'c'], [4, 'e'], [5, 't'], [6, 'b'], [7, 't'], [8, 'a'], [9, 'e']), { at: OCT(16, 15), code: 'AAAAAA', skin: 5 });
  const r2 = round('q2', tab, wins(tab, [1, 'b'], [2, 'b'], [3, 'b'], [4, 't'], [5, 'a'], [6, 'b'], [7, 't'], [8, 'b'], [9, 'b']), { at: OCT(17, 11), code: 'BBBBBB', skin: 5 });
  const r3 = round('q3', tabc, wins(tabc, [1, 'c'], [2, 'c'], [3, 'c'], [4, 'a'], [5, 'a'], [6, 't'], [7, 'c'], [8, 'c'], [9, 't']), { at: OCT(18, 12), code: 'CCCCCC', skin: 5 });
  return [r1, r2, r3];
}
/** Each phone holds the rounds its person played; a friend's phone is `z<id>` and knows them by their seat. */
function phonesOf(rounds) {
  const on = (me, list) => stateOf(`z${me}`, list.map(r => ({ ...r, localMe: me })));
  const has = id => rounds.filter(r => r.players.some(p => p.id === id));
  return {
    t: stateOf('t', rounds, { trips: { t_bandon: TRIP } }),
    a: on('a', has('a')), b: on('b', has('b')), c: on('c', has('c')), e: on('e', has('e')),
  };
}
const deliver = (phones, rows) => { for (const k of Object.keys(phones)) phones[k] = applyRows(phones[k], rows); };
const publish = (phones, plan) => { for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripPlans: { t_bandon: plan } }; };
/** The server sends an expense to every phone on the trip. */
const share = (phones, ...list) => { for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripExpenses: mergeExpenses(phones[k].tripExpenses || {}, list) }; };
const idOn = (s, x) => (x === s.me.slice(1) ? s.me : x);
const owes = (s, x, y, now = NOW) => cents(tabWith(outstanding(s, { now }), new Set([idOn(s, y)]), idOn(s, x)));
function myTotal(s, now = NOW) {
  return outstanding(s, { now }).reduce((a, t) => a + (t.to === s.me ? cents(t.amount) : t.from === s.me ? -cents(t.amount) : 0), 0);
}
const PAIRS = [['t', 'a'], ['t', 'b'], ['t', 'c'], ['t', 'e'], ['a', 'b'], ['a', 'c'], ['a', 'e'], ['b', 'c'], ['b', 'e'], ['c', 'e']];
function agree(phones) {
  for (const [x, y] of PAIRS) {
    const seen = [x, y].map(k => owes(phones[k], x, y));
    assert.equal(new Set(seen).size, 1, `${x} and ${y}’s phones agree (${seen})`);
  }
}

/**
 * An expense written on phone `s`: `payer` and `people` are ids as that phone knows them, each part
 * in dollars (amounts) or shares, null for equal.
 */
function expense(s, { id, payer, people, amount, split = 'equal', what = 'Dinner', at = OCT(17, 20), by = s.me }) {
  const person = x => personFor(s, 't_bandon', x, x.toUpperCase());
  return cleanExpense({
    id, tripId: 't_bandon', what, amount, split, payer: person(payer),
    people: people.map(p => (Array.isArray(p) ? { ...person(p[0]), part: p[1] } : { ...person(p), part: null })),
    by, at, updatedAt: at,
  });
}

// ---------------------------------------------------------------------------
// Splits to the cent

test('an equal split shares the odd cents, the payer first, and always adds up', () => {
  const s = stateOf('t', rounds5(), { trips: { t_bandon: TRIP } });
  const e = expense(s, { id: 'x1', payer: 't', people: ['a', 't', 'b'], amount: 100 });
  assert.deepEqual(shareCents(e), [3333, 3334, 3333], 'the payer takes the odd cent, so nobody is asked for more than a third');
  const x = resolveExpense(s, e);
  assert.deepEqual(x.balances, { t: 6666, a: -3333, b: -3333 });
  // Paid for others only: the odd cents go down the list
  const others = expense(s, { id: 'x2', payer: 't', people: ['a', 'b', 'c'], amount: 0.02 });
  assert.deepEqual(shareCents(others), [1, 1, 0]);
  // Any amount, any number of people: the shares add up exactly and differ by a cent at most
  for (let n = 1; n <= 7; n++) for (const amt of [0.01, 0.05, 1, 9.99, 10.01, 333.33, 1234.56, 99999.99]) {
    const ids = ['t', 'a', 'b', 'c', 'e', 'm', 'k'].slice(0, n);
    const parts = shareCents(expense(s, { id: 'x', payer: 'a', people: ids, amount: amt }));
    assert.equal(parts.reduce((a, c) => a + c, 0), cents(amt), `${n} ways of $${amt}`);
    assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
  }
});

test('shares split by weight to the cent, and amounts must add up to the total', () => {
  const s = stateOf('t', [], { trips: { t_bandon: TRIP } });
  // The house: Trevor and Andy had the big room (2 shares), Bob 1
  const house = expense(s, { id: 'h', payer: 'b', people: [['t', 2], ['a', 2], ['b', 1]], amount: 1000.01, split: 'shares', what: 'The house' });
  const parts = shareCents(house);
  assert.deepEqual(parts, [40001, 40000, 20000]);
  assert.equal(parts.reduce((a, c) => a + c, 0), 100001);
  assert.deepEqual(resolveExpense(s, house).balances, { b: 80001, t: -40001, a: -40000 });
  const amounts = expense(s, { id: 'g', payer: 't', people: [['t', 20], ['a', 25.5], ['b', 14.5]], amount: 60, split: 'amounts', what: 'Gas' });
  assert.deepEqual(shareCents(amounts), [2000, 2550, 1450]);
  assert.equal(expense(s, { id: 'bad', payer: 't', people: [['t', 20], ['a', 25]], amount: 60, split: 'amounts' }), null, 'amounts that don’t add up aren’t an expense');
  assert.equal(expense(s, { id: 'bad', payer: 't', people: [['t', 1.5]], amount: 60, split: 'shares' }), null, 'shares are whole');
  assert.equal(cleanExpense({ id: 'z', tripId: 't', amount: 0, split: 'equal', payer: { id: 't' }, people: [{ id: 't' }] }), null, 'nothing to split');
  assert.equal(cleanExpense({ id: 'z', tripId: 't', amount: 1.005, split: 'equal', payer: { id: 't' }, people: [{ id: 't' }] }), null, 'to the cent');
  assert.equal(parseAmount('$1,200.50'), 120050);
  assert.equal(parseAmount('12.'), 1200);
  assert.equal(parseAmount('12.345'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(splitLine(resolveExpense(s, house)), 'Split by shares');
  assert.equal(splitLine(resolveExpense(s, expense(s, { id: 'f', payer: 't', people: ['a'], amount: 5 })), x => x.toUpperCase()), 'For A');
});

// ---------------------------------------------------------------------------
// The Tab and the trip

test('an expense is in each person’s total on the Tab and on the trip, even for someone who never played', () => {
  const rounds = rounds5();
  const base = stateOf('t', rounds, { trips: { t_bandon: TRIP } });
  // Mia came along but doesn't golf: Trevor paid dinner for everyone, Andy the gas for him, Mia and Bob
  const dinner = expense(base, { id: 'x1', payer: 't', people: ['t', 'a', 'b', 'c', 'e', 'm'], amount: 240 });
  const gas = expense(base, { id: 'x2', payer: 'a', people: ['t', 'm', 'b'], amount: 90.01, what: 'Gas' });
  const s = { ...base, tripExpenses: { x1: dinner, x2: gas } };
  const before = tabBalances(base);
  const after = tabBalances(s);
  const add = { t: 20000 - 3001, a: -4000 + 9001, b: -4000 - 3000, c: -4000, e: -4000, m: -4000 - 3000 };
  for (const id of ['t', 'a', 'b', 'c', 'e', 'm']) assert.equal(cents(after[id] || 0) - cents(before[id] || 0), add[id], id);
  assert.equal(Object.values(after).reduce((a, v) => a + cents(v), 0), 0, 'the Tab still adds up to $0');
  // The Tab's payments square everyone, Mia included, and your total is your balance
  const plan = outstanding(s, { now: NOW });
  const got = {};
  for (const t of plan) { got[t.from] = (got[t.from] || 0) - cents(t.amount); got[t.to] = (got[t.to] || 0) + cents(t.amount); }
  for (const [id, v] of Object.entries(after)) assert.equal(got[id] || 0, cents(v), `${id} is squared`);
  assert.ok(plan.some(t => t.from === 'm'), 'Mia pays someone');
  assert.equal(myTotal(s), cents(after.t));
  // The trip: the standings stay the golf, the totals add the expenses
  const st = tripStatus(s, 't_bandon', { now: NOW });
  const st0 = tripStatus(base, 't_bandon', { now: NOW });
  assert.deepEqual(st.standings, st0.standings);
  assert.equal(st.spent, 330.01);
  assert.deepEqual(st.expenses.map(x => x.id).sort(), ['x1', 'x2']);
  const tot = Object.fromEntries(st.totals.map(x => [x.id, x]));
  assert.equal(cents(tot.m.amount), -7000);
  assert.equal(cents(tot.t.amount), cents(st0.standings.find(p => p.id === 't').amount) + 16999);
  assert.equal(st.totals.reduce((a, x) => a + cents(x.amount), 0), 0);
  assert.deepEqual(expenseTotals(st.expenses).get('a'), { paid: 9001, share: 4000, net: 5001 });
  // Settle the trip: everyone's lines are their whole trip
  const lines = {};
  for (const t of st.plan) { lines[t.from] = (lines[t.from] || 0) - cents(t.amount); lines[t.to] = (lines[t.to] || 0) + cents(t.amount); }
  for (const x of st.totals) assert.equal(lines[x.id] || 0, cents(x.amount), `${x.id}’s payments are their whole trip`);
});

test('paying Settle the trip squares the rounds and the expenses together, on the trip and the Tab', () => {
  const base = stateOf('t', rounds5().map(r => ({ ...r, shareCode: undefined })), { trips: { t_bandon: TRIP } });
  let s = { ...base, tripExpenses: { x1: expense(base, { id: 'x1', payer: 'c', people: ['t', 'a', 'b', 'c', 'e'], amount: 500, what: 'The house' }) } };
  const st = tripStatus(s, 't_bandon', { now: NOW });
  assert.equal(st.phase, 'ready');
  for (const t of st.plan) {
    const { settlements } = tripPayment(s, 't_bandon', t.from, t.to, { now: NOW + 1000 });
    s = { ...s, settlements: [...s.settlements, ...settlements] };
  }
  const done = tripStatus(s, 't_bandon', { now: NOW + 2000 });
  assert.equal(done.plan.length, 0);
  assert.equal(done.phase, 'square');
  for (const v of Object.values(tabBalances(s))) assert.equal(cents(v), 0);
});

test('a trip with only expenses opens to settle once its dates are over', () => {
  const s0 = stateOf('t', [], { trips: { t_bandon: TRIP } });
  const s = { ...s0, players: { a: { id: 'a', name: 'Andy' } }, tripExpenses: { x1: expense(s0, { id: 'x1', payer: 't', people: ['t', 'a'], amount: 80, at: OCT(10) }) } };
  assert.equal(tripStatus(s, 't_bandon', { now: OCT(12) }).phase, 'soon');
  assert.equal(tripStatus(s, 't_bandon', { now: OCT(17) }).phase, 'on');
  const after = tripStatus(s, 't_bandon', { now: OCT(20) });
  assert.equal(after.phase, 'ready');
  assert.deepEqual(after.plan.map(t => [t.from, t.to, t.amount]), [['a', 't', 40]]);
  assert.equal(canDeleteTrip(s, after).ok, false, 'its expenses go first');
  assert.equal(canDeleteTrip(s0, tripStatus(s0, 't_bandon', { now: OCT(20) })).ok, true);
  assert.equal(currentTrips(s, { now: OCT(20) }).length, 1);
});

// ---------------------------------------------------------------------------
// The published plan and both phones

test('the published plan counts expenses, and every phone agrees with it', () => {
  const phones = phonesOf(rounds5());
  // Andy adds dinner from his phone (he knows himself as za, the others by their seats)
  const dinner = expense(phones.a, { id: 'x1', payer: 'za', people: ['za', 't', 'b', 'c', 'e'], amount: 250.03 });
  // Trevor adds the house, split by shares
  const house = expense(phones.t, { id: 'x2', payer: 't', people: [['t', 2], ['a', 2], ['b', 1], ['c', 1]], amount: 1200, split: 'shares', what: 'The house' });
  share(phones, dinner, house);
  // Before the plan: every phone has both, with the same people
  for (const s of Object.values(phones)) {
    const x = tripExpenses(s, 't_bandon').find(e => e.id === 'x1');
    assert.equal(x.payer, idOn(s, 'a'), `Andy paid, on ${s.me}’s phone`);
  }
  const totals = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  assert.deepEqual(plan.expenses.map(x => x.id), ['x1', 'x2']);
  assert.deepEqual(cleanPlan(plan).expenses, plan.expenses);
  // Each person's lines are exactly their golf plus their expenses
  const hand = {};
  for (const r of Object.values(phones.t.rounds)) for (const [id, v] of Object.entries(roundResults(r).balances)) hand[id] = (hand[id] || 0) + cents(v);
  for (const x of [dinner, house]) for (const [id, c] of Object.entries(resolveExpense(phones.t, x).balances)) hand[id] = (hand[id] || 0) + c;
  const byPlan = {};
  for (const l of plan.lines) { byPlan[l.from] = (byPlan[l.from] || 0) - cents(l.amount); byPlan[l.to] = (byPlan[l.to] || 0) + cents(l.amount); }
  for (const [id, c] of Object.entries(hand)) assert.equal(byPlan[id] || 0, c, `${id}’s lines`);
  publish(phones, plan);
  for (const [k, s] of Object.entries(phones)) {
    const ps = planState(s, 't_bandon', { now: NOW });
    assert.equal(ps.status, 'live', `${k}’s phone takes the plan`);
    assert.deepEqual([...ps.expenses].sort(), ['x1', 'x2']);
    assert.equal(myTotal(s), totals[k], `${k}’s total on the Tab is unchanged`);
    const st = tripStatus(s, 't_bandon', { now: NOW });
    assert.ok(st.plan.every(t => t.local === 0), 'nothing left on one phone');
  }
  agree(phones);
  // Everyone pays their lines from their own phone: square everywhere
  for (const l of plan.lines) deliver(phones, tripPayment(phones[l.from], 't_bandon', idOn(phones[l.from], l.from), idOn(phones[l.from], l.to), { now: NOW + 5000 }).rows);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(tripStatus(s, 't_bandon', { now: NOW + 9000 }).plan.length, 0, `${k} square`);
    assert.equal(cents(tabBalances(s)[s.me] || 0), 0, `${k}’s balance is zero`);
  }
});

test('a new expense waits with the rest of the Tab until the organizer’s phone republishes', () => {
  const phones = phonesOf(rounds5());
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  const plain = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  // Bob adds the drinks: Trevor and Cal owe him
  const drinks = expense(phones.b, { id: 'x3', payer: 'zb', people: ['t', 'c', 'zb'], amount: 45, what: 'Drinks' });
  share(phones, drinks);
  for (const [k, s] of Object.entries(phones)) {
    const ps = planState(s, 't_bandon', { now: NOW });
    assert.equal(ps.status, 'live', `${k}’s plan still holds`);
    assert.deepEqual(ps.pendingExpenses, ['x3']);
    const add = { t: -1500, b: 3000, c: -1500 }[k] || 0;
    assert.equal(myTotal(s), plain[k] + add, `${k}’s total has the drinks already`);
  }
  const trip = tripsOf(phones.t).get('t_bandon');
  const v2 = duePlan(phones.t, trip, { now: NOW });
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.expenses.map(x => x.id), ['x3']);
  publish(phones, v2);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'live', k);
    assert.equal(myTotal(s), plain[k] + ({ t: -1500, b: 3000, c: -1500 }[k] || 0), `${k}’s total stays the same on version 2`);
  }
  agree(phones);
  assert.equal(duePlan(phones.t, trip, { now: NOW }), null, 'and it holds');
});

test('a changed or deleted expense makes the plan out of date, and the next version follows it', () => {
  const phones = phonesOf(rounds5());
  const plain = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  const dinner = expense(phones.t, { id: 'x1', payer: 't', people: ['t', 'a', 'b', 'c'], amount: 200 });
  share(phones, dinner);
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  // Trevor fixes the amount
  const fixed = { ...dinner, amount: 240, updatedAt: dinner.updatedAt + 1 };
  assert.notEqual(expenseMark(fixed), expenseMark(dinner));
  share(phones, fixed);
  for (const k of Object.keys(phones)) assert.equal(planState(phones[k], 't_bandon', { now: NOW }).status, 'stale', k);
  const trip = tripsOf(phones.t).get('t_bandon');
  publish(phones, duePlan(phones.t, trip, { now: NOW }));
  for (const k of Object.keys(phones)) assert.equal(planState(phones[k], 't_bandon', { now: NOW }).status, 'live', k);
  agree(phones);
  // Then deletes it: the stub reaches every phone, the plan goes out of date, version 3 drops it
  const gone = { id: 'x1', tripId: 't_bandon', by: 't', deleted: true, at: dinner.at, updatedAt: fixed.updatedAt + 1 };
  share(phones, gone);
  for (const k of Object.keys(phones)) {
    assert.deepEqual(tripExpenses(phones[k], 't_bandon'), [], `${k} has no expenses`);
    assert.equal(planState(phones[k], 't_bandon', { now: NOW }).status, 'stale', k);
  }
  const v3 = duePlan(phones.t, trip, { now: NOW });
  assert.equal(v3.version, 3);
  assert.equal(v3.expenses, undefined);
  publish(phones, v3);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'live', k);
    assert.equal(myTotal(s), plain[k], `${k}’s total is back to just the golf`);
  }
  agree(phones);
  // A deleted expense stays deleted when an older copy comes back
  const back = mergeExpenses({ x1: gone }, [fixed]);
  assert.equal(back.x1.deleted, true);
});

test('an expense with someone the trip’s shared rounds don’t reach stays out of the plan', () => {
  const phones = phonesOf(rounds5());
  // Mia doesn't golf and has no phone on the trip: Trevor's dinner with her stays on his Tab
  const dinner = expense(phones.t, { id: 'x1', payer: 't', people: ['t', 'm'], amount: 60 });
  const gas = expense(phones.t, { id: 'x2', payer: 't', people: ['t', 'a'], amount: 30, what: 'Gas' });
  share(phones, dinner, gas);
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  assert.deepEqual(plan.expenses.map(x => x.id), ['x2']);
  publish(phones, plan);
  assert.equal(planState(phones.t, 't_bandon', { now: NOW }).status, 'live');
  const st = tripStatus(phones.t, 't_bandon', { now: NOW });
  const mia = st.plan.find(t => t.from === 'm');
  assert.equal(cents(mia.amount), 3000);
  assert.equal(mia.local, 3000, 'paid on this phone (in cents)');
  assert.equal(owes(phones.t, 'm', 't'), 3000);
  assert.equal(duePlan(phones.t, tripsOf(phones.t).get('t_bandon'), { now: NOW }), null, 'no churn over it');
  agree(phones);
});

test('old rounds and trips without expenses keep exactly the money they had', () => {
  const phones = phonesOf(rounds5());
  const home = round('h1', ['t', 'j'], wins(['t', 'j'], [1, 't'], [2, 't']), { at: OCT(10), trip: null, code: 'HHHHHH' });
  phones.t = { ...phones.t, rounds: { ...phones.t.rounds, h1: home } };
  for (const s of Object.values(phones)) {
    for (const extra of [{ tripExpenses: {} }, { tripExpenses: { junk: { nope: true } } }]) {
      const same = { ...s, ...extra };
      assert.deepEqual(outstanding(same, { now: NOW }), outstanding(s, { now: NOW }));
      assert.deepEqual(tabBalances(same), tabBalances(s));
      const a = tripStatus(same, 't_bandon', { now: NOW }), b = tripStatus(s, 't_bandon', { now: NOW });
      assert.deepEqual(a.plan, b.plan);
      assert.deepEqual(a.standings, b.standings);
      assert.equal(a.phase, b.phase);
    }
  }
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  assert.equal(plan.expenses, undefined, 'a plan with no expenses is just as it was');
  assert.ok(samePlan(plan, buildPlan({ ...phones.t, tripExpenses: {} }, 't_bandon', { now: NOW })));
  assert.equal(cleanPlan(plan).expenses, undefined);
  // An expense on another trip, or one whose trip was deleted, moves none of this money
  const other = { ...phones.t, tripExpenses: { y: { ...expense(phones.t, { id: 'y', payer: 't', people: ['j'], amount: 10 }), tripId: 't_other' } } };
  assert.deepEqual(tabBalances(other), tabBalances(phones.t));
  assert.equal(allExpenses(other).length, 0);
});

// ---------------------------------------------------------------------------
// Your account and the backup

test('expenses ride in your account expense by expense, and in the backup', () => {
  const s = stateOf('t', rounds5(), { trips: { t_bandon: TRIP }, crews: {}, customCourses: {}, settings: {} });
  const a = expense(s, { id: 'x1', payer: 't', people: ['t', 'a'], amount: 20 });
  const b = expense(s, { id: 'x2', payer: 't', people: ['t', 'b'], amount: 30, at: OCT(17, 21) });
  const doc = toDocs({ ...s, tripExpenses: { x1: a } })['profile:me'].data;
  assert.deepEqual(doc.tripExpenses, { x1: a });
  // Another of your phones added x2 meanwhile: taking this profile keeps both
  const draft = { trips: {}, tripExpenses: { x2: b } };
  applyDoc(draft, 'profile', 'me', doc);
  assert.deepEqual(Object.keys(draft.tripExpenses).sort(), ['x1', 'x2']);
  // An older profile with no expenses keeps this phone's
  const keepIt = { trips: {}, tripExpenses: { x2: b } };
  const { tripExpenses: _x, ...older } = doc;
  applyDoc(keepIt, 'profile', 'me', older);
  assert.deepEqual(keepIt.tripExpenses, { x2: b });
  // The newer copy wins, a deleted one wins a tie
  const newer = { ...a, amount: 25, updatedAt: a.updatedAt + 5 };
  assert.equal(mergeExpenses({ x1: a }, [newer]).x1.amount, 25);
  assert.equal(mergeExpenses({ x1: newer }, [a]).x1.amount, 25);
  const stub = { id: 'x1', tripId: 't_bandon', by: 't', deleted: true, updatedAt: newer.updatedAt };
  assert.equal(mergeExpenses({ x1: newer }, [stub]).x1.deleted, true);
  const same = { x1: a };
  assert.equal(mergeExpenses(same, [a]), same, 'nothing changed, nothing written');
  // The backup file keeps them
  const file = parseBackup(JSON.stringify(makeBackup({ ...s, tripExpenses: { x1: a } })));
  assert.ok(file.ok);
  assert.deepEqual(mergeBackup({ ...s, tripExpenses: {} }, file.data).state.tripExpenses, { x1: a });
});

test('the story with a friend and Where it comes from list the expenses between you, apart from the golf', () => {
  const base = stateOf('t', rounds5(), { trips: { t_bandon: TRIP } });
  const dinner = expense(base, { id: 'x1', payer: 't', people: ['t', 'a', 'b'], amount: 90 });
  const gas = expense(base, { id: 'x2', payer: 'a', people: ['t', 'a'], amount: 50, what: 'Gas', at: OCT(18, 8) });
  const s = { ...base, tripExpenses: { x1: dinner, x2: gas } };
  const mine = new Set(['t']);
  const before = personStory(base, mine, 'a');
  const story = personStory(s, mine, 'a');
  assert.equal(story.net, before.net, 'the head to head is still the golf');
  assert.deepEqual(headToHeadSummary(s, mine), headToHeadSummary(base, mine));
  assert.equal(story.spent, 30 - 25, 'Andy owes $30 for dinner, Trevor $25 for gas');
  assert.deepEqual(story.items.filter(it => it.kind === 'expense').map(it => [it.id, it.amount]), [['x2', -25], ['x1', 30]]);
  const w = breakdownWith(s, mine, 'a');
  assert.equal(w.spent, 5);
  assert.equal(cents(w.open), cents(breakdownWith(base, mine, 'a').open) + 500);
  assert.deepEqual(w.expenses.map(x => x.amount), [-25, 30]);
  assert.equal(personStory(s, mine, 'c').spent, 0, 'Cal wasn’t in either');
});
