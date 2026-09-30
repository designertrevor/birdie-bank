// Undoing "Same person as..." after a payment: the payment follows the card it belongs to, and no total moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { allocatePayment } from './shared-tab.js';
import { outstanding, tabBalances, tabWith } from './ledger.js';
import { mergePeople, unmergePerson } from './people-links.js';
import { paymentsAfterSplit } from './unmerge-payments.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 8, 28, 18);

/** A finished 9-hole skins round at $5 a skin; `wins` is [[winner, hole]]. */
function round(id, ids, wins, daysAgo = 1) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: 5, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [w, no] of wins) r.scores[no][w] = 3;
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * 864e5;
  return r;
}
const player = (id, name, createdAt = 1) => ({ id, name, index: null, createdAt });
const sum = o => Math.round(Object.values(o).reduce((a, v) => a + v, 0) * 100) / 100;
let n = 0;
const makeId = () => `t${++n}`;

/** Me (t) with Al's two cards: `a` lost $5 to me, `b` lost $10. Merged, the card owes me $15. */
function merged() {
  const s = {
    me: 't', rounds: { r1: round('r1', ['t', 'a'], [['t', 1]], 3), r2: round('r2', ['t', 'b'], [['t', 1], ['t', 2]], 2) },
    players: { t: player('t', 'T'), a: player('a', 'Al', 1), b: player('b', 'Albert', 5) },
    settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [],
  };
  return { ...s, ...mergePeople(s, 'b', 'a') };
}
/** Record a Tab payment the way the Person card does. */
function pay(s, from, to, amount) {
  const { settlements } = allocatePayment(s, { from, to, amount }, { now: NOW, makeId });
  return { ...s, settlements: [...s.settlements, ...settlements] };
}
/** Undo the merge the way the card's "Undo" does, moving the payment with it. */
function split(s, keep, alias) {
  const next = unmergePerson(s, keep, alias);
  const settlements = paymentsAfterSplit(s, next, keep, alias, { makeId });
  return { ...s, ...next, ...(settlements ? { settlements } : {}) };
}

test('paid in full while merged: after undo both cards are square, not one overpaid and one owing', () => {
  const s = pay(merged(), 'b', 't', 15);
  assert.deepEqual(tabBalances(s), { t: 0, b: 0 });
  // Without moving the payment: b reads $5 overpaid and a still owes $5
  const bare = { ...s, ...unmergePerson(s, 'b', 'a') };
  assert.deepEqual(tabBalances(bare), { t: 0, a: -5, b: 5 });
  const u = split(s, 'b', 'a');
  assert.deepEqual(tabBalances(u), { t: 0, a: 0, b: 0 });
  assert.equal(outstanding(u).length, 0);
  // The $15 payment is now $10 from b and $5 from a: same payee, same total, same time
  const rows = u.settlements.map(x => [x.from, x.to, x.amount, x.at]).sort();
  assert.deepEqual(rows, [['a', 't', 5, NOW], ['b', 't', 10, NOW]]);
});

test('paid in part: what is left open stays on the card that still owes, and the totals never move', () => {
  const s = pay(merged(), 'b', 't', 12);
  const before = tabBalances(s);
  const u = split(s, 'b', 'a');
  const after = tabBalances(u);
  assert.equal(sum(after), 0);
  assert.equal(after.t, before.t, 'my own balance is the same');
  assert.equal(Math.round((after.a + after.b) * 100) / 100, before.b, 'Al in all is the same');
  // b owed $10 and is covered; a owed $5 and has $2 of the payment, so $3 is still open
  assert.deepEqual(after, { t: 3, a: -3, b: 0 });
  assert.equal(tabWith(outstanding(u), new Set(['t']), 'a'), 3);
});

test('money the other way: a payment I made to the merged card goes back to the card that was owed', () => {
  // This time Al won: a won $5 from me, b won $10
  const base = {
    me: 't', rounds: { r1: round('r1', ['t', 'a'], [['a', 1]], 3), r2: round('r2', ['t', 'b'], [['b', 1], ['b', 2]], 2) },
    players: { t: player('t', 'T'), a: player('a', 'Al', 1), b: player('b', 'Albert', 5) },
    settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [],
  };
  const s = pay({ ...base, ...mergePeople(base, 'b', 'a') }, 't', 'b', 15);
  const u = split(s, 'b', 'a');
  assert.deepEqual(tabBalances(u), { t: 0, a: 0, b: 0 });
  assert.deepEqual(u.settlements.map(x => [x.from, x.to, x.amount]).sort(), [['t', 'a', 5], ['t', 'b', 10]]);
});

test('nothing to move: no payment, or a payment that was all one card’s, leaves the settlements alone', () => {
  const s = merged();
  assert.equal(paymentsAfterSplit(s, unmergePerson(s, 'b', 'a'), 'b', 'a'), null);
  const onlyB = pay(s, 'b', 't', 10);
  assert.equal(paymentsAfterSplit(onlyB, unmergePerson(onlyB, 'b', 'a'), 'b', 'a'), null);
  // A payment on a round's own transfer names that round's seat, so it follows the card already
  const onRound = { ...s, settlements: [{ id: 's1', from: 'a', to: 't', amount: 5, at: NOW, roundId: 'r1' }] };
  assert.equal(paymentsAfterSplit(onRound, unmergePerson(onRound, 'b', 'a'), 'b', 'a'), null);
});
