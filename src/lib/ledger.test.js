// The Tab: fewest payments across the group, honest head-to-head, and each person's story.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, headToHead } from './round.js';
import { fewestPayments, headToHeadSummary, outstanding, personStory, recordText, tabBalances, tabWith } from './ledger.js';

const DEFAULT_SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  skins: { value: 2, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
};

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: id.toUpperCase(), index: 0 }));

/** A finished 9-hole round with every hole halved except the ones given. */
function round(id, game, ids, holes = {}, settings = DEFAULT_SETTINGS) {
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: people(ids), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = 1000 + Number(id.replace(/\D/g, '') || 0);
  return r;
}

const sum = plan => plan.reduce((a, t) => a + Math.round(t.amount * 100), 0);
/** Apply a plan to balances in cents: everyone should end on zero. */
function settles(balances, plan) {
  const left = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, Math.round(v * 100)]));
  for (const t of plan) { left[t.from] += Math.round(t.amount * 100); left[t.to] -= Math.round(t.amount * 100); }
  return Object.values(left).every(v => v === 0);
}

// ---------------------------------------------------------------------------
// Fewest payments

test('fewest payments: balances sum to zero and every plan squares everyone', () => {
  const cases = [
    { a: 10, b: 5, c: -5, d: -10 },
    { a: 30, b: -10, c: -10, d: -10 },
    { a: 7.25, b: -3.1, c: -4.15 },
    { a: 12, b: 8, c: -3, d: -6, e: -11 },
    { a: 0, b: 0 },
  ];
  for (const b of cases) {
    const plan = fewestPayments(b);
    assert.ok(settles(b, plan), JSON.stringify(b));
    assert.ok(plan.every(t => t.amount > 0 && t.from !== t.to));
    assert.ok(plan.length <= Math.max(0, Object.keys(b).length - 1), 'never more than n - 1 payments');
  }
});

test('fewest payments: matching amounts pay each other directly', () => {
  const plan = fewestPayments({ a: 10, b: 5, c: -5, d: -10 });
  assert.deepEqual(plan, [{ from: 'd', to: 'a', amount: 10 }, { from: 'c', to: 'b', amount: 5 }]);
  // One big winner: everyone pays them once
  assert.equal(fewestPayments({ a: 30, b: -10, c: -10, d: -10 }).length, 3);
});

test('fewest payments: whole group, not pair by pair', () => {
  // A owes B $10 from one round, B owes C $10 from another: A pays C once, B is out of it
  const plan = fewestPayments({ a: -10, b: 0, c: 10 });
  assert.deepEqual(plan, [{ from: 'a', to: 'c', amount: 10 }]);
});

test('fewest payments: cent rounding still squares exactly', () => {
  // A $10 pot split three ways: 3.33 + 3.33 + 3.34, and one player paying it all
  const b = { a: 10 / 3, b: 10 / 3, c: 10 / 3, d: -10 };
  const plan = fewestPayments(b);
  assert.equal(sum(plan), 1000, 'the payer sends exactly $10');
  assert.ok(plan.every(t => Number.isInteger(Math.round(t.amount * 100)) && Math.abs(t.amount * 100 - Math.round(t.amount * 100)) < 1e-9));
  // Balances that drift a cent after rounding: the spare cent comes off the biggest balance
  const drifted = fewestPayments({ a: 3.333, b: 3.333, c: -6.666 });
  assert.equal(drifted.length, 2);
  assert.equal(sum(drifted), 666);
});

test('fewest payments: only between people who can pay each other, passed along when needed', () => {
  // Mike only played with Trevor, Chris only with Trevor. Mike owes $10, Chris is owed $10.
  const canPay = (x, y) => [x, y].includes('trevor');
  const plan = fewestPayments({ mike: -10, trevor: 0, chris: 10 }, { canPay });
  assert.deepEqual(plan.map(t => [t.from, t.to, t.amount]).sort(), [['mike', 'trevor', 10], ['trevor', 'chris', 10]]);
  // When they can pay directly it's one payment
  assert.equal(fewestPayments({ mike: -10, trevor: 0, chris: 10 }).length, 1);
});

// ---------------------------------------------------------------------------
// Honest head-to-head

test('head to head: 4-player skins, A and B each win a skin, so A and B are even with each other', () => {
  // $2 a skin, no carryover needed: A wins hole 1, B wins hole 2, everything else halved
  const r = round('r1', 'skins', ['a', 'b', 'c', 'd'], {
    1: { a: 3, b: 4, c: 4, d: 4 },
    2: { a: 4, b: 3, c: 4, d: 4 },
  });
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 4, b: 4, c: -4, d: -4 });
  // The fewest payments pair people up (C pays one winner, D the other), which says nothing about A v B
  assert.equal(res.transfers.length, 2);
  // Head to head from the skins themselves: A and B each won $2 from the other
  assert.equal(headToHead(r, 'a', 'b'), 0);
  assert.equal(headToHead(r, 'b', 'a'), 0);
  assert.equal(headToHead(r, 'a', 'c'), 2);
  assert.equal(headToHead(r, 'a', 'd'), 2);
  assert.equal(headToHead(r, 'c', 'b'), -2);
  assert.equal(headToHead(r, 'c', 'd'), 0);
});

test('head to head: banker is each player against the banker, not the rest of the table', () => {
  const r = round('r1', 'banker', ['a', 'b', 'c'], { 1: { a: 4, b: 3, c: 5 } });
  // a banks hole 1: b beats the bank, c loses to it
  r.banker = { 1: { banker: 'a', bets: { b: 5, c: 5 }, doubled: {}, doubleBack: false } };
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 0, b: 5, c: -5 });
  assert.equal(res.pairs.b.a, 5);
  assert.equal(res.pairs.c.a, -5);
  assert.equal(res.pairs.b.c, 0, 'b and c never bet each other');
});

// ---------------------------------------------------------------------------
// The Tab across rounds

test('tab: balances across rounds less payments, and the plan squares the group', () => {
  const s = { ...DEFAULT_SETTINGS, skins: { value: 2, carryover: false } };
  const r1 = round('r1', 'skins', ['a', 'b', 'c', 'd'], { 1: { a: 3, b: 4, c: 4, d: 4 } }, s); // a +6, others -2
  const r2 = round('r2', 'skins', ['a', 'b', 'c', 'd'], { 1: { a: 4, b: 3, c: 4, d: 4 } }, s); // b +6, others -2
  const state = { players: {}, rounds: { r1, r2 }, settlements: [{ id: 's1', from: 'c', to: 'a', amount: 4, at: 5 }] };
  const bal = tabBalances(state);
  assert.deepEqual(bal, { a: 0, b: 4, c: 0, d: -4 });
  const plan = outstanding(state);
  assert.deepEqual(plan.map(t => [t.from, t.to, t.amount]), [['d', 'b', 4]]);
  assert.deepEqual(plan[0].rounds, ['r1', 'r2']);
});

test('tab: friends from different groups are never asked to pay each other', () => {
  const r1 = round('r1', 'stroke', ['me', 'mike'], { 1: { me: 3, mike: 4 } });       // mike pays me
  const r2 = round('r2', 'stroke', ['me', 'chris'], { 1: { me: 4, chris: 3 } });     // I pay chris
  const state = { players: {}, rounds: { r1, r2 }, settlements: [] };
  const plan = outstanding(state);
  assert.ok(!plan.some(t => (t.from === 'mike' && t.to === 'chris') || (t.from === 'chris' && t.to === 'mike')));
  assert.equal(tabWith(plan, ['me'], 'mike'), 5);
  assert.equal(tabWith(plan, ['me'], 'chris'), -5);
});

test('person story: rounds with honest head-to-head, payments, record, newest first', () => {
  const s = { ...DEFAULT_SETTINGS, skins: { value: 2, carryover: false } };
  const r1 = round('r1', 'skins', ['a', 'b', 'c', 'd'], { 1: { a: 3, b: 4, c: 4, d: 4 }, 2: { a: 4, b: 3, c: 4, d: 4 } }, s);
  const r2 = round('r2', 'skins', ['a', 'b', 'c', 'd'], { 1: { a: 3, b: 4, c: 4, d: 4 } }, s);
  const state = { me: 'a', players: {}, rounds: { r1, r2 }, settlements: [{ id: 's1', from: 'b', to: 'a', amount: 2, at: 5000 }] };
  const st = personStory(state, new Set(['a']), 'b');
  assert.equal(st.rounds, 2);
  assert.equal(st.even, 1);
  assert.equal(st.won, 1);
  assert.equal(st.net, 2);
  assert.equal(st.paid, 2);
  assert.deepEqual(st.items.map(i => [i.kind, i.id, i.amount]), [['payment', 's1', 2], ['round', 'r2', 2], ['round', 'r1', 0]]);
});

test('head to head summary: record and net with everyone you have played', () => {
  const s = { ...DEFAULT_SETTINGS, skins: { value: 2, carryover: false } };
  const r1 = round('r1', 'skins', ['a', 'b', 'c'], { 1: { a: 3, b: 4, c: 4 } }, s);
  const r2 = round('r2', 'skins', ['a', 'b'], { 1: { a: 5, b: 4 } }, s);
  const r3 = round('r3', 'skins', ['a', 'b'], {}, s);
  const sum = headToHeadSummary({ me: 'a', players: {}, rounds: { r1, r2, r3 }, settlements: [] }, new Set(['a']));
  assert.deepEqual(sum.get('b'), { rounds: 3, won: 1, lost: 1, even: 1, net: 0 });
  assert.deepEqual(sum.get('c'), { rounds: 1, won: 1, lost: 0, even: 0, net: 2 });
  assert.equal(recordText(sum.get('b')), '1\u20131\u20131');
  assert.equal(recordText(sum.get('c')), '1\u20130');
});

test('rounds carry each player\'s payment app, so friends who join can pay them', () => {
  const r = createRound({ id: 'r', game: 'skins', course: flat9, holesCount: 9, settings: DEFAULT_SETTINGS, hcPct: 100,
    players: [{ id: 'a', name: 'A', index: 0, payApp: 'cashapp', payHandle: 'ann' }, { id: 'b', name: 'B', index: 0, venmo: 'bo' }, { id: 'c', name: 'C', index: 0 }] });
  assert.deepEqual([r.players[0].payApp, r.players[0].payHandle], ['cashapp', 'ann']);
  assert.deepEqual([r.players[1].payApp, r.players[1].payHandle], ['venmo', 'bo']);
  assert.ok(!('payApp' in r.players[2]));
});

test('tab: your own id and your seat in a joined round are one person', () => {
  // A joined round where you sat as "seat": you owe Mike 5. You pay him and record it against your own id.
  const r1 = round('r1', 'stroke', ['seat', 'mike'], { 1: { seat: 4, mike: 3 } });
  r1.localMe = 'seat';
  const r2 = round('r2', 'stroke', ['me', 'chris'], {});
  const before = { me: 'me', players: {}, rounds: { r1, r2 }, settlements: [] };
  assert.deepEqual(outstanding(before).map(t => [t.from, t.to, t.amount]), [['me', 'mike', 5]]);
  const after = { ...before, settlements: [{ id: 's1', from: 'me', to: 'mike', amount: 5, at: 1 }] };
  assert.deepEqual(outstanding(after), []);
  // Old payments recorded against the seat id count too
  const legacy = { ...before, settlements: [{ id: 's1', from: 'seat', to: 'mike', amount: 5, at: 1 }] };
  assert.deepEqual(outstanding(legacy), []);
});

test('tab: old saved data without settlements or rounds does not crash', () => {
  assert.deepEqual(outstanding({ players: {}, rounds: {} }), []);
  assert.deepEqual(tabBalances({ players: {}, rounds: {}, settlements: [] }), {});
});
