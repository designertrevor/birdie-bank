// The shared Tab: payment rows from two phones, undo, who's square, and old data unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import { buildMeta } from './sync-model.js';
import { allocatePayment, applyRows, codeOf, lastPayment, nettedFor, paymentId, roundRows, roundStatus, stripRound, tabCodes, undoRows } from './shared-tab.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  skins: { value: 2, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
};
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: id.toUpperCase(), index: 0 }));
const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;

/** A finished 9-hole skins round ($2 a skin) with every hole halved except the ones given. */
function round(id, ids, holes = {}, { code = null, daysAgo = 1, localMe } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (localMe !== undefined) r.localMe = localMe;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, ...extra });
const row = (over = {}) => ({ code: 'AAAAAA', id: 'AAAAAA:b>a', kind: 'payment', from: 'b', to: 'a', amount: 2, status: 'paid', by: 'b', reason: null, at: NOW, updatedAt: NOW, ...over });
const money = s => ({ bal: tabBalances(s), plan: outstanding(s) });

// B lost one skin to A: B pays A $2
const oneSkin = { 1: { a: 3, b: 4 } };

test('shared round: a round keeps its code after sharing stops, and meta carries it', () => {
  const r = round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA' });
  assert.equal(codeOf(r), 'AAAAAA');
  assert.equal(buildMeta(r).shareCode, 'AAAAAA');
  // Older rounds only have the live code
  assert.equal(codeOf({ shared: { code: 'BBBBBB' } }), 'BBBBBB');
  assert.equal(codeOf({ shared: null }), null);
});

test('applyRows: a paid row is a settlement, applying it twice changes nothing, undone removes it', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA' })]);
  const once = applyRows(s, [row()]);
  assert.equal(once.settlements.length, 1);
  assert.deepEqual(once.settlements[0], { id: 'AAAAAA:b>a', from: 'b', to: 'a', amount: 2, at: NOW, roundId: 'r1', code: 'AAAAAA', by: 'b', shared: true });
  const twice = applyRows(once, [row()]);
  assert.deepEqual(twice.settlements, once.settlements);
  assert.deepEqual(twice.tabRows, once.tabRows);
  const undone = applyRows(twice, [row({ status: 'undone', updatedAt: NOW + 1 })]);
  assert.equal(undone.settlements.length, 0);
  // An older copy of the row arriving late doesn't bring the payment back
  assert.equal(applyRows(undone, [row()]).settlements.length, 0);
});

test('an old shared round the other phone no longer looks up takes no payment rows: it stays on this phone', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA', daysAgo: 90 })]);
  const before = money(s);
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'old' });
  assert.deepEqual(rows, []);
  assert.deepEqual(settlements, [{ id: 's_old', from: 'b', to: 'a', amount: 2, at: NOW }]);
  assert.deepEqual(before, money(s));
});

test('applyRows: rows for rounds this phone doesn’t have are ignored; netted rows move no money', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA' })]);
  const next = applyRows(s, [row({ code: 'ZZZZZZ', id: 'ZZZZZZ:b>a' }), row({ id: 'AAAAAA:b>a:net', status: 'netted' })]);
  assert.equal(next.settlements.length, 0);
  assert.deepEqual(money(next), money(s));
  assert.equal(Object.keys(next.tabRows).length, 1);
});

test('two phones: a payment marked on one shows on the other, and either side can take it back', () => {
  const code = 'AAAAAA';
  // Trevor hosted (his id is a); Mike joined on his own phone, where his id is zb and his seat is b
  let host = stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code })]);
  let mike = stateOf('zb', [round('r1', ['a', 'b'], oneSkin, { code, localMe: 'b' })]);
  // Mike taps "I paid" on his card for Trevor
  const mine = allocatePayment(mike, { from: 'zb', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'x' });
  assert.deepEqual(mine.settlements, [], 'the whole payment is the round transfer');
  assert.equal(mine.rows[0].id, paymentId(code, 'b', 'a'));
  mike = applyRows(mike, mine.rows);
  host = applyRows(host, mine.rows); // what the server hands Trevor's phone
  assert.equal(tabBalances(host).b || 0, 0);
  assert.equal(outstanding(host).length, 0);
  assert.equal(outstanding(mike).length, 0);
  // Trevor didn't get it: one tap on his phone, and Mike's phone sees it too
  const back = undoRows(host, lastPayment(host, 'a', 'b'), { now: NOW + 5 });
  host = applyRows(host, back.rows);
  mike = applyRows(mike, back.rows);
  assert.deepEqual(outstanding(host).map(t => [t.from, t.to, t.amount]), [['b', 'a', 2]]);
  assert.equal(mike.settlements.length, 0);
});

test('deterministic ids: both phones marking the same transfer count it once', () => {
  const code = 'AAAAAA';
  const host = stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code })]);
  const mike = stateOf('zb', [round('r1', ['a', 'b'], oneSkin, { code, localMe: 'b' })]);
  const fromHost = allocatePayment(host, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'h' }).rows;
  const fromMike = allocatePayment(mike, { from: 'zb', to: 'a', amount: 2 }, { now: NOW + 3, makeId: () => 'm' }).rows;
  assert.equal(fromHost[0].id, fromMike[0].id);
  const both = applyRows(applyRows(host, fromHost), fromMike);
  assert.equal(both.settlements.length, 1);
  assert.equal(tabBalances(both).a || 0, 0);
});

test('allocatePayment: fills the pair’s shared transfers oldest first, then keeps the rest local', () => {
  // B owes A $2 in each of two shared rounds, and $2 more from a round that was never shared
  const s = stateOf('a', [
    round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA', daysAgo: 5 }),
    round('r2', ['a', 'b'], oneSkin, { code: 'BBBBBB', daysAgo: 2 }),
    round('r3', ['a', 'b'], oneSkin, { daysAgo: 1 }),
  ]);
  // A $3 payment: all of the older round, $1 of the newer
  const part = allocatePayment(s, { from: 'b', to: 'a', amount: 3 }, { now: NOW, makeId: () => 'p1' });
  assert.deepEqual(part.rows.map(r => [r.id, r.amount, r.status]), [['AAAAAA:b>a', 2, 'paid'], ['BBBBBB:b>a:p0', 1, 'paid']]);
  assert.deepEqual(part.settlements, []);
  // Paying all $6 at once squares both shared rounds and leaves $2 as a plain local payment
  const all = allocatePayment(s, { from: 'b', to: 'a', amount: 6 }, { now: NOW, makeId: () => 'p2' });
  assert.deepEqual(all.rows.map(r => [r.id, r.amount]), [['AAAAAA:b>a', 2], ['BBBBBB:b>a', 2]]);
  assert.deepEqual(all.settlements, [{ id: 's_p2', from: 'b', to: 'a', amount: 2, at: NOW }]);
  const after = applyRows({ ...s, settlements: all.settlements }, all.rows);
  assert.equal(outstanding(after).length, 0);
});

test('allocatePayment: squaring the whole Tab nets the transfers going the other way too', () => {
  // Round 1: B owes A $4. Round 2: A owes B $2. On the Tab, B owes A $2
  const s = stateOf('a', [
    round('r1', ['a', 'b'], { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 } }, { code: 'AAAAAA', daysAgo: 5 }),
    round('r2', ['a', 'b'], { 1: { a: 4, b: 3 } }, { code: 'BBBBBB', daysAgo: 2 }),
  ]);
  assert.deepEqual(outstanding(s).map(t => [t.from, t.to, t.amount]), [['b', 'a', 2]]);
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'n' });
  assert.deepEqual(settlements, []);
  assert.deepEqual(rows.map(r => [r.id, r.amount, r.status]), [
    ['AAAAAA:b>a:p0', 2, 'paid'],
    ['AAAAAA:b>a:net', 2, 'netted'],
    ['BBBBBB:a>b:net', 2, 'netted'],
  ]);
  const after = applyRows(s, rows);
  assert.equal(outstanding(after).length, 0, 'the money is square');
  // And both rounds read square for status
  for (const r of Object.values(after.rounds)) assert.deepEqual(roundStatus(r, roundRows(after, r)), { a: 'square', b: 'square' });
});

test('roundStatus: owes, waiting, square and carried; a partial payment below the transfer still owes', () => {
  // Skins: A wins hole 1, so B, C and D each pay A $2
  const r = round('r1', ['a', 'b', 'c', 'd'], { 1: { a: 3, b: 4, c: 4, d: 4 } }, { code: 'AAAAAA' });
  const t = roundResults(r).transfers;
  assert.equal(t.length, 3);
  assert.deepEqual(roundStatus(r, []), { a: 'waiting', b: 'owes', c: 'owes', d: 'owes' });
  const paidB = { ...row({ id: 'AAAAAA:b>a', from: 'b', to: 'a', amount: 2 }) };
  const partC = { ...row({ id: 'AAAAAA:c>a:x', from: 'c', to: 'a', amount: 1 }) };
  const carryD = { ...row({ id: 'AAAAAA:d>a:carry', kind: 'carry', from: 'd', to: 'a', amount: 2, status: 'agreed' }) };
  assert.deepEqual(roundStatus(r, [paidB, partC, carryD]), { a: 'waiting', b: 'square', c: 'owes', d: 'carried' });
  const fullC = { ...row({ id: 'AAAAAA:c>a:y', from: 'c', to: 'a', amount: 1 }) };
  assert.deepEqual(roundStatus(r, [paidB, partC, fullC, carryD]), { a: 'carried', b: 'square', c: 'square', d: 'carried' });
  // An ask that isn't agreed yet is still owed
  assert.equal(roundStatus(r, [{ ...carryD, status: 'asked' }]).d, 'owes');
});

test('roundStatus: payments recorded on this phone before the table count for the round', () => {
  const r = round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA' });
  const s = stateOf('a', [r], { settlements: [{ id: 's_old', from: 'b', to: 'a', amount: 2, at: NOW, roundId: 'r1' }] });
  assert.deepEqual(roundStatus(r, roundRows(s, r)), { a: 'square', b: 'square' });
});

test('strip: follows your newest shared round with a payment, labelled latest only when it is', () => {
  const s = stateOf('a', [
    round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA', daysAgo: 6 }),
    round('r2', ['a', 'b'], oneSkin, { daysAgo: 2 }),
  ]);
  const pick = stripRound(s, { now: NOW });
  assert.equal(pick.round.id, 'r1');
  assert.equal(pick.latest, false);
  // A watcher's copy never shows the strip
  const watcher = stateOf('zz', [round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA', localMe: null })]);
  assert.equal(stripRound(watcher, { now: NOW }), null);
  assert.deepEqual(tabCodes(watcher, { now: NOW }), []);
  // Too old, or everyone even: no strip
  assert.equal(stripRound(stateOf('a', [round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA', daysAgo: 40 })]), { now: NOW }), null);
  assert.equal(stripRound(stateOf('a', [round('r1', ['a', 'b'], {}, { code: 'AAAAAA' })]), { now: NOW }), null);
});

test('old saved data: the Tab reads exactly the same after the shared layer runs', () => {
  // The ledger.test.js shapes: several rounds, local payments with and without a roundId
  const rounds = [
    round('r1', ['a', 'b', 'c'], { 1: { a: 3, b: 4, c: 5 } }),
    round('r2', ['a', 'c', 'd'], { 2: { a: 5, c: 3, d: 4 } }),
    round('r3', ['b', 'd'], { 3: { b: 3, d: 4 } }),
  ];
  const old = { me: 'a', players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [
    { id: 's1', from: 'b', to: 'a', amount: 1, at: 5 },
    { id: 's2', from: 'c', to: 'a', amount: 2, at: 6, roundId: 'r1' },
  ] };
  const before = money(old);
  const after = applyRows(old, []);
  assert.deepEqual(money(after), before);
  assert.deepEqual(after.settlements, old.settlements);
  // A settlement with the new optional fields reads the same money as one without
  const tagged = { ...old, settlements: old.settlements.map(s => ({ ...s, code: 'AAAAAA', by: 'a', shared: true })) };
  assert.deepEqual(money(tagged), before);
});

test('old shared rounds: a payment recorded before the table (roundId, no code) counts as paid for the shared layer', () => {
  // An old round that was shared live keeps only shared.code, and was marked paid at the end of the round
  const old = round('r1', ['a', 'b'], oneSkin, { daysAgo: 5 });
  old.shared = { code: 'AAAAAA', host: true, since: 0, ended: true };
  // A newer round, never shared: B owes A $2 there
  const s = stateOf('a', [old, round('r2', ['a', 'b'], oneSkin, { daysAgo: 1 })], {
    settlements: [{ id: 's_old', from: 'b', to: 'a', amount: 2, at: NOW - 5 * DAY, roundId: 'r1' }],
  });
  const before = money(s);
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'q' });
  // The old round is already paid, so nothing may be sent against it
  assert.deepEqual(rows.filter(r => r.status === 'paid'), []);
  assert.deepEqual(settlements, [{ id: 's_q', from: 'b', to: 'a', amount: 2, at: NOW }]);
  assert.deepEqual(money(applyRows(s, [])), before);
});

test('applyRows: a cached row does not bring back a settlement removed elsewhere when other rows arrive', () => {
  const s = stateOf('a', [
    round('r1', ['a', 'b'], oneSkin, { code: 'AAAAAA' }),
    round('r2', ['a', 'b'], oneSkin, { code: 'BBBBBB' }),
  ]);
  const paid = applyRows(s, [row()]);
  assert.equal(paid.settlements.length, 1);
  // Your other phone took it back and the account sync removed the settlement here, before the undone row arrived
  const synced = { ...paid, settlements: [] };
  const next = applyRows(synced, [row({ code: 'BBBBBB', id: 'BBBBBB:b>a' })]);
  assert.deepEqual(next.settlements.map(x => x.id), ['BBBBBB:b>a']);
});

test('undo from the payments list also takes back what that payment netted', () => {
  const s = stateOf('a', [
    round('r1', ['a', 'b'], { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 } }, { code: 'AAAAAA', daysAgo: 5 }),
    round('r2', ['a', 'b'], { 1: { a: 4, b: 3 } }, { code: 'BBBBBB', daysAgo: 2 }),
  ]);
  const { rows } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'n' });
  const after = applyRows(s, rows);
  const one = after.settlements[0];
  const back = undoRows(after, { settlements: [one], netted: nettedFor(after, [one]) }, { now: NOW + 1 });
  const undone = applyRows(after, back.rows);
  assert.equal(Object.values(undone.tabRows).filter(r => r.status === 'netted').length, 0);
  for (const r of Object.values(undone.rounds)) assert.notDeepEqual(roundStatus(r, roundRows(undone, r)), { a: 'square', b: 'square' });
});

test('two phones offline: both marking the same netted payment count it once', () => {
  // Round 1: B owes A $4. Round 2: A owes B $2. On the Tab, B owes A $2, which only part-pays round 1
  const rounds = localMe => [
    round('r1', ['a', 'b'], { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 } }, { code: 'AAAAAA', daysAgo: 5, localMe }),
    round('r2', ['a', 'b'], { 1: { a: 4, b: 3 } }, { code: 'BBBBBB', daysAgo: 2, localMe }),
  ];
  const host = stateOf('a', rounds());
  const mike = stateOf('zb', rounds('b'));
  const fromHost = allocatePayment(host, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'h' }).rows;
  const fromMike = allocatePayment(mike, { from: 'zb', to: 'a', amount: 2 }, { now: NOW + 3, makeId: () => 'm' }).rows;
  for (const s of [host, mike]) {
    const both = applyRows(applyRows(s, fromHost), fromMike);
    assert.equal(both.settlements.length, 1);
    assert.equal(outstanding(both).length, 0);
  }
});
