// Shared rounds between two people: both phones work out the same amount for "I paid", "Roll to
// next time" and the who's-square strip, and nothing is passed on through a third person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { fewestPayments, outstanding, roundsTogether, tabBalances, tabWith } from './ledger.js';
import { allocatePayment, applyRows, roundRows, roundStatus, stripRound } from './shared-tab.js';
import { activeCarry, cardCarry, carryReducer, carryRows, carrySplit, sharedOwed, splitCodes, splitRounds } from './carry.js';
import { pairDebt, sharedDebts } from './pair-debts.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;

/** A finished 9-hole skins round at `skin` a skin, every hole halved except the ones given. */
function round(id, ids, holes = {}, { code = null, daysAgo = 1, localMe, skin = 2 } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (localMe !== undefined) r.localMe = localMe;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, ...extra });
const twoSkins = (w, l) => ({ 1: { [w]: 3, [l]: 4 }, 2: { [w]: 3, [l]: 4 } });
const card = (s, me, other) => tabWith(outstanding(s, { now: NOW }), new Set([me]), other);
/** Every payment the Tab asks for, recorded: everyone ends up square. */
const squareAll = s => ({ ...s, settlements: [...s.settlements, ...outstanding(s, { now: NOW }).map((t, i) => ({ id: `x${i}`, ...t, at: NOW }))] });
const allZero = bal => Object.values(bal).every(v => Math.abs(v) < 0.005);

/**
 * Trevor (t) and Sam (s): a round shared live where Sam owes $28, and on Trevor's phone only a
 * round he kept to himself where Sam owes $18 more. Sam joined on his phone (id zs, seat s).
 */
function phones() {
  const shared = () => round('r1', ['t', 's'], twoSkins('t', 's'), { code: 'AAAAAA', daysAgo: 3, skin: 14 });
  const trevor = stateOf('t', [shared(), round('r2', ['t', 's'], twoSkins('t', 's'), { daysAgo: 1, skin: 9 })]);
  const sam = stateOf('zs', [{ ...shared(), localMe: 's' }]);
  return { trevor, sam };
}

test('the $46 and $28 case: both phones offer, agree and show the same carry', () => {
  let { trevor, sam } = phones();
  // The Tab still shows everything each phone knows
  assert.equal(card(trevor, 't', 's'), 46);
  assert.equal(card(sam, 'zs', 't'), -28);
  // What the roll covers is the shared round only, the same on both phones
  assert.deepEqual(sharedOwed(trevor, 't', 's', NOW), { from: 's', to: 't', amount: 28 });
  assert.deepEqual(sharedOwed(sam, 'zs', 't', NOW), { from: 'zs', to: 't', amount: 28 });

  // Trevor asks to roll it: the ask is the shared amount, all of it on the shared round
  const owed = sharedOwed(trevor, 't', 's', NOW);
  const split = carrySplit(trevor, owed.from, owed.to, owed.amount, NOW);
  assert.deepEqual(split.map(p => [p.round.id, p.from, p.to, p.cents]), [['r1', 's', 't', 2800]]);
  const ask = carryReducer(null, { type: 'ask', ...owed, by: 't', at: NOW, roundIds: splitRounds(split), codes: splitCodes(split) });
  const rows = carryRows(trevor, ask, { now: NOW, split });
  trevor = applyRows(trevor, rows);
  sam = applyRows(sam, rows);
  const onSam = cardCarry(sam, 'zs', 't', { from: 'zs', to: 't', amount: 28 }, NOW);
  assert.equal(onSam.carried, 28);
  // Sam agrees
  const agreed = carryRows(sam, carryReducer(onSam, { type: 'agree', at: NOW + 60e3 }), { now: NOW + 60e3 });
  sam = applyRows(sam, agreed);
  trevor = applyRows(trevor, agreed);
  const t = cardCarry(trevor, 't', 's', { from: 's', to: 't', amount: 46 }, NOW);
  const s = cardCarry(sam, 'zs', 't', { from: 'zs', to: 't', amount: 28 }, NOW);
  assert.equal(t.status, 'agreed');
  assert.equal(s.status, 'agreed');
  assert.equal(t.carried, 28);
  assert.equal(s.carried, t.carried, 'both phones show the same carry');
  // The carry moves no money: Trevor's Tab still has all $46
  assert.equal(card(trevor, 't', 's'), 46);
});

test('the $46 and $28 case, as it was saved before: an old $46 carry now reads $28 on both phones', () => {
  let { trevor, sam } = phones();
  // The old way: Trevor asked for his whole Tab, $28 on the transfer and $18 more put on the round
  const old = [
    { code: 'AAAAAA', id: 'AAAAAA:s>t:carry', kind: 'carry', from: 's', to: 't', amount: 46, status: 'agreed', by: 't', reason: null, at: NOW - DAY, updatedAt: NOW - DAY + 5 },
  ];
  trevor = applyRows(trevor, old);
  sam = applyRows(sam, old);
  // Before, Trevor's phone showed $46 and Sam's $28
  assert.equal(activeCarry(trevor, 't', 's', { from: 's', to: 't', amount: 46 }).carried, 46);
  assert.equal(activeCarry(sam, 'zs', 't', { from: 'zs', to: 't', amount: 28 }).carried, 28);
  // Now both read what the shared round has
  assert.equal(cardCarry(trevor, 't', 's', { from: 's', to: 't', amount: 46 }, NOW).carried, 28);
  assert.equal(cardCarry(sam, 'zs', 't', { from: 'zs', to: 't', amount: 28 }, NOW).carried, 28);
});

test('an old carry on a pair with no shared round left still shows against the Tab', () => {
  // The round was shared, but long ago: the other phone no longer looks it up
  const s = stateOf('t', [round('r1', ['t', 's'], twoSkins('t', 's'), { code: 'AAAAAA', daysAgo: 90 })], {
    carries: [{ id: 'k:s>t:1', from: 's', to: 't', amount: 4, status: 'agreed', by: 's', reason: null, at: NOW - 80 * DAY, answeredAt: NOW - 80 * DAY, roundIds: ['r1'], codes: ['AAAAAA'] }],
  });
  const owed = { from: 's', to: 't', amount: 4 };
  assert.equal(sharedOwed(s, 't', 's', NOW), null);
  const c = cardCarry(s, 't', 's', owed, NOW);
  assert.equal(c.status, 'agreed');
  assert.equal(c.carried, 4);
});

test('I paid on the $46 card: the shared round is paid on both phones, the other $18 stays local', () => {
  let { trevor, sam } = phones();
  const { rows, settlements } = allocatePayment(trevor, { from: 's', to: 't', amount: 46 }, { now: NOW, makeId: () => 'l' });
  assert.deepEqual(rows.map(r => [r.id, r.amount, r.status]), [['AAAAAA:s>t', 28, 'paid']]);
  assert.deepEqual(settlements, [{ id: 's_l', from: 's', to: 't', amount: 18, at: NOW }]);
  trevor = applyRows({ ...trevor, settlements }, rows);
  sam = applyRows(sam, rows);
  assert.equal(outstanding(trevor, { now: NOW }).length, 0);
  assert.equal(outstanding(sam, { now: NOW }).length, 0);
  assert.deepEqual(roundStatus(trevor.rounds.r1, roundRows(trevor, trevor.rounds.r1)), { t: 'square', s: 'square' });
  assert.deepEqual(roundStatus(sam.rounds.r1, roundRows(sam, sam.rounds.r1)), { t: 'square', s: 'square' });
});

test('Sam pays his $28 from his phone: Trevor’s card keeps only the $18 from his own round', () => {
  let { trevor, sam } = phones();
  const { rows, settlements } = allocatePayment(sam, { from: 'zs', to: 't', amount: 28 }, { now: NOW, makeId: () => 'x' });
  assert.deepEqual(settlements, []);
  trevor = applyRows(trevor, rows);
  sam = applyRows(sam, rows);
  assert.equal(card(trevor, 't', 's'), 18);
  assert.equal(sharedOwed(trevor, 't', 's', NOW), null, 'nothing left to roll: the $18 is Trevor’s own');
  assert.equal(card(sam, 'zs', 't'), 0);
});

test('rerouted: the Tab no longer passes shared money through a friend, and the strip reads Square after a payment', () => {
  // Round 1, shared with Bo: Bo owes me $4. Round 2, shared with Cy: I owe Cy $4
  const r1 = round('r1', ['a', 'b'], twoSkins('a', 'b'), { code: 'AAAAAA', daysAgo: 3 });
  const r2 = round('r2', ['a', 'b', 'c'], { 1: { c: 3, a: 4, b: 5 }, 2: { c: 3, a: 4, b: 5 }, 3: { a: 3, b: 3, c: 4 } }, { code: 'BBBBBB', daysAgo: 2 });
  let s = stateOf('a', [r1, r2]);
  // Before, the fewest payments across everyone passed Bo's money on
  const before = fewestPayments(tabBalances(s));
  const plan = outstanding(s, { now: NOW });
  // Each shared round's own transfers, pair by pair
  const expected = new Map();
  for (const r of [r1, r2]) for (const t of roundResults(r).transfers) {
    const k = `${t.from}>${t.to}`;
    expected.set(k, Math.round(((expected.get(k) || 0) + t.amount) * 100) / 100);
  }
  const got = new Map(plan.map(t => [`${t.from}>${t.to}`, t.amount]));
  assert.notDeepEqual(before.map(t => `${t.from}>${t.to}`).sort(), [...got.keys()].sort(), 'this case was rerouted before');
  assert.equal(tabWith(plan, new Set(['a']), 'b'), 4, 'Bo pays me directly');
  // Money is the same: paying what the Tab asks squares everyone
  assert.ok(allZero(tabBalances(squareAll(s))));
  // Bo pays me: round 1 reads square
  const pay = allocatePayment(s, { from: 'b', to: 'a', amount: 4 }, { now: NOW, makeId: () => 'p' });
  assert.deepEqual(pay.settlements, []);
  s = applyRows(s, pay.rows);
  assert.deepEqual(roundStatus(r1, roundRows(s, r1)), { a: 'square', b: 'square' });
  const pick = stripRound(s, { now: NOW });
  assert.equal(pick.round.id, 'r2');
  // I pay Cy what the Tab says: round 2 squares for me
  const mine = tabWith(outstanding(s, { now: NOW }), new Set(['c']), 'a');
  assert.ok(mine > 0);
  const pay2 = allocatePayment(s, { from: 'a', to: 'c', amount: mine }, { now: NOW + 1, makeId: () => 'q' });
  assert.deepEqual(pay2.settlements, []);
  s = applyRows(s, pay2.rows);
  assert.equal(roundStatus(r2, roundRows(s, r2)).a, 'square');
});

test('rerouted: the rest of the Tab runs the other way; paying the whole card still squares the shared round', () => {
  // Shared: Bo owes me $4. Only on my phone: I owe Bo $2 (I lost one skin). The card says Bo owes me $2
  const r1 = round('r1', ['a', 'b'], twoSkins('a', 'b'), { code: 'AAAAAA', daysAgo: 3 });
  const r2 = round('r2', ['a', 'b'], { 1: { b: 3, a: 4 } }, { daysAgo: 1 });
  const s = stateOf('a', [r1, r2]);
  assert.equal(card(s, 'a', 'b'), 2);
  const before = tabBalances(s);
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'r' });
  // The shared round is paid in full, and my own round's $2 goes back the other way, locally
  assert.deepEqual(rows.map(r => [r.id, r.amount, r.status]), [['AAAAAA:b>a', 4, 'paid']]);
  assert.deepEqual(settlements, [{ id: 's_r', from: 'a', to: 'b', amount: 2, at: NOW }]);
  const after = applyRows({ ...s, settlements }, rows);
  assert.equal(outstanding(after, { now: NOW }).length, 0);
  assert.deepEqual(roundStatus(r1, roundRows(after, r1)), { a: 'square', b: 'square' });
  // The money moved is exactly the $2 on the card
  const moved = Object.fromEntries(Object.keys(before).map(id => [id, Math.round((tabBalances(after)[id] - before[id]) * 100) / 100]));
  assert.deepEqual(moved, { a: -2, b: 2 });
});

test('a part payment fills the shared rounds first and nets nothing until it covers them', () => {
  const { trevor } = phones();
  const part = allocatePayment(trevor, { from: 's', to: 't', amount: 10 }, { now: NOW, makeId: () => 'p' });
  assert.deepEqual(part.rows.map(r => [r.id, r.amount, r.status]), [['AAAAAA:s>t:p0', 10, 'paid']]);
  assert.deepEqual(part.settlements, []);
  const more = allocatePayment(trevor, { from: 's', to: 't', amount: 30 }, { now: NOW, makeId: () => 'p' });
  assert.deepEqual(more.rows.map(r => [r.id, r.amount]), [['AAAAAA:s>t', 28]]);
  assert.deepEqual(more.settlements, [{ id: 's_p', from: 's', to: 't', amount: 2, at: NOW }]);
});

test('both phones agree on the shared amount, and old data with no shared rounds keeps the same plan', () => {
  const { trevor, sam } = phones();
  assert.equal(pairDebt(trevor, 's', 't', { now: NOW }), 2800);
  assert.equal(pairDebt(sam, 'zs', 't', { now: NOW }), 2800);
  // No shared rounds: the plan is exactly the fewest payments, as before
  const plain = stateOf('a', [
    round('r1', ['a', 'b', 'c'], { 1: { a: 3, b: 4, c: 5 } }),
    round('r2', ['a', 'c', 'd'], { 2: { a: 5, c: 3, d: 4 } }),
    round('r3', ['b', 'd'], { 3: { b: 3, d: 4 } }),
  ], { settlements: [{ id: 's1', from: 'b', to: 'a', amount: 1, at: 5 }] });
  assert.deepEqual(sharedDebts(plain, { now: NOW }), []);
  const together = roundsTogether(plain);
  const canPay = (x, y) => together.has(x < y ? `${x}|${y}` : `${y}|${x}`);
  assert.deepEqual(outstanding(plain, { now: NOW }).map(({ from, to, amount }) => ({ from, to, amount })), fewestPayments(tabBalances(plain), { canPay }));
});

test('review: a carry on the shared rounds that runs against the card does not show on it', () => {
  // Shared: I owe Bo $4, rolled over and agreed. Only on my phone: Bo owes me $6. My card: Bo owes me $2
  const r1 = round('r1', ['a', 'b'], twoSkins('b', 'a'), { code: 'AAAAAA', daysAgo: 3 });
  const r2 = round('r2', ['a', 'b'], { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 }, 3: { a: 3, b: 4 } }, { daysAgo: 1 });
  let s = stateOf('a', [r1, r2]);
  assert.equal(card(s, 'a', 'b'), 2);
  const owed = sharedOwed(s, 'a', 'b', NOW);
  assert.deepEqual(owed, { from: 'a', to: 'b', amount: 4 });
  const split = carrySplit(s, owed.from, owed.to, owed.amount, NOW);
  const ask = carryReducer(null, { type: 'ask', ...owed, by: 'a', at: NOW - 1000, roundIds: splitRounds(split), codes: splitCodes(split) });
  const agreed = carryReducer(ask, { type: 'agree', at: NOW - 500 });
  s = applyRows(s, carryRows(s, agreed, { now: NOW - 500, split }));
  // The card says Bo owes me: the carry (me to Bo) isn't what the card is about, so it doesn't hide Remind
  assert.equal(cardCarry(s, 'a', 'b', { from: 'b', to: 'a', amount: 2 }, NOW), null);
  // Bo's own card (just the shared round, he's owed $4) does show it
  assert.equal(cardCarry(s, 'b', 'a', { from: 'a', to: 'b', amount: 4 }, NOW).carried, 4);
});

test('review: I paid both ways, then both phones sync: they agree about the shared rounds, and each card is right', () => {
  // Shared: Bo owes me $4. Only on my phone: I owe Bo $2. Only on Bo's phone: Bo owes me $6
  const shared = () => round('r1', ['a', 'b'], twoSkins('a', 'b'), { code: 'AAAAAA', daysAgo: 3 });
  let mine = stateOf('a', [shared(), round('r2', ['a', 'b'], { 1: { b: 3, a: 4 } }, { daysAgo: 2 })]);
  let bos = stateOf('zb', [{ ...shared(), localMe: 'b' }, { ...round('r3', ['a', 'b'], { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 }, 3: { a: 3, b: 4 } }, { daysAgo: 1 }), localMe: 'b' }]);
  assert.equal(card(mine, 'a', 'b'), 2);
  assert.equal(card(bos, 'zb', 'a'), -10);
  // Bo hands me the $2 my card says, and I tap it
  const pay = allocatePayment(mine, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'm' });
  mine = applyRows({ ...mine, settlements: [...mine.settlements, ...pay.settlements] }, pay.rows);
  bos = applyRows(bos, pay.rows);
  // The shared round: the same on both phones
  assert.equal(pairDebt(mine, 'a', 'b', { now: NOW }), 0);
  assert.equal(pairDebt(bos, 'zb', 'a', { now: NOW }), 0);
  assert.deepEqual(roundStatus(mine.rounds.r1, roundRows(mine, mine.rounds.r1)), roundStatus(bos.rounds.r1, roundRows(bos, bos.rounds.r1)));
  // What's left is each phone's own round, which the other phone never had: square on mine, $6 on Bo's (all true)
  assert.equal(card(mine, 'a', 'b'), 0);
  assert.equal(card(bos, 'zb', 'a'), -6);
  // Bo pays the $6 from his phone: nothing touches the shared round again
  const pay2 = allocatePayment(bos, { from: 'zb', to: 'a', amount: 6 }, { now: NOW + 1, makeId: () => 'n' });
  assert.deepEqual(pay2.rows, []);
});

test('review: the payments list shows one tap that went both ways as one payment, and undoes it whole', async () => {
  const { paymentGroups } = await import('./shared-tab.js');
  const r1 = round('r1', ['a', 'b'], twoSkins('a', 'b'), { code: 'AAAAAA', daysAgo: 3 });
  const r2 = round('r2', ['a', 'b'], { 1: { b: 3, a: 4 } }, { daysAgo: 1 });
  let s = stateOf('a', [r1, r2], { settlements: [{ id: 'old', from: 'b', to: 'a', amount: 1, at: 5 }] });
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'r' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
  const groups = paymentGroups(s);
  assert.deepEqual(groups.map(g => [g.from, g.to, g.amount, g.settlements.length]), [['b', 'a', 2, 2], ['b', 'a', 1, 1]]);
});

test('review: the home feed shows a both-ways tap as one payment', async () => {
  const { latelyItems } = await import('./lately.js');
  const r1 = round('r1', ['a', 'b'], twoSkins('a', 'b'), { code: 'AAAAAA', daysAgo: 3 });
  const r2 = round('r2', ['a', 'b'], { 1: { b: 3, a: 4 } }, { daysAgo: 1 });
  let s = stateOf('a', [r1, r2]);
  const { rows, settlements } = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW, makeId: () => 'r' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
  const pays = latelyItems(s, NOW + 1000).filter(i => i.kind === 'payment');
  assert.deepEqual(pays.map(p => p.text), ['B paid you $2']);
});

test('linked ids: Sam’s own id and the player Trevor saved are one pair, the split pairs added up', () => {
  // Trevor saved Sam as s; Sam hosted a shared round as zs where Trevor was q_t
  const r1 = round('r1', ['t', 's'], twoSkins('t', 's'), { code: 'AAAAAA', daysAgo: 3, skin: 14 });
  const r2 = round('r2', ['zs', 'q_t'], twoSkins('zs', 'q_t'), { code: 'BBBBBB', daysAgo: 2, skin: 5, localMe: 'q_t' });
  const split = stateOf('t', [r1, r2]);
  const linked = stateOf('t', [{ ...r1, claims: { s: 'zs' } }, r2]);
  const opts = { now: NOW };
  assert.equal(pairDebt(split, 's', 't', opts), 2800);
  assert.equal(pairDebt(split, 't', 'zs', opts), 1000);
  assert.equal(pairDebt(linked, 's', 't', opts), 2800 - 1000);
  assert.equal(pairDebt(linked, 'zs', 't', opts), 1800, 'either id is Sam');
  assert.deepEqual(sharedDebts(linked, opts), [{ from: 's', to: 't', cents: 1800 }]);
  // Money isn't made or lost: the balances are the same, just grouped
  const bs = tabBalances(split), bl = tabBalances(linked);
  assert.equal(Math.round((bs.s + bs.zs) * 100), Math.round(bl.s * 100));
  assert.equal(bl.t, bs.t);
  assert.equal(Math.round(Object.values(bl).reduce((a, v) => a + v, 0) * 100), 0);
});

test('linked ids: Sam’s phone works out the same amount as Trevor’s', () => {
  const r1 = round('r1', ['t', 's'], twoSkins('t', 's'), { code: 'AAAAAA', daysAgo: 3, skin: 14 });
  const r2 = round('r2', ['zs', 'q_t'], twoSkins('zs', 'q_t'), { code: 'BBBBBB', daysAgo: 2, skin: 5 });
  const trevor = stateOf('t', [{ ...r1, claims: { s: 'zs' } }, { ...r2, localMe: 'q_t', claims: { q_t: 't' } }]);
  const sam = stateOf('zs', [{ ...r1, localMe: 's', claims: { s: 'zs' } }, { ...r2, claims: { q_t: 't' } }], { players: { q_t: { id: 'q_t', name: 'Trevor', createdAt: 1 } } });
  assert.equal(pairDebt(trevor, 's', 't', { now: NOW }), pairDebt(sam, 'zs', 'q_t', { now: NOW }));
  assert.equal(pairDebt(sam, 'zs', 't', { now: NOW }), 1800);
});
