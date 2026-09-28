// Carry it over: the ask and answer lifecycle, both phones, and money that never moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, personStory, tabBalances } from './ledger.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { applyRows } from './shared-tab.js';
import { CARRY_REASONS, activeCarry, canCarry, carryReducer, carryRows, carrySplit, remindable, rolled } from './carry.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;

function round(id, ids, holes = {}, { code = null, daysAgo = 1, localMe, finishedAt } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = finishedAt ?? NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (localMe !== undefined) r.localMe = localMe;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, ...extra });
// B lost two skins to A: B owes A $4
const twoSkins = { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 } };
const owedBA = { from: 'b', to: 'a', amount: 4 };

test('carry reducer: ask, then agree or decline, or take it back; answers only apply to an open ask', () => {
  const asked = carryReducer(null, { type: 'ask', from: 'b', to: 'a', amount: 4, by: 'b', reason: 'Short till payday', at: 10 });
  assert.equal(asked.status, 'asked');
  assert.equal(asked.id, 'k:b>a:10');
  const agreed = carryReducer(asked, { type: 'agree', at: 20 });
  assert.equal(agreed.status, 'agreed');
  assert.equal(agreed.answeredAt, 20);
  assert.equal(carryReducer(agreed, { type: 'withdraw', at: 30 }), agreed, 'an agreed carry can’t be taken back');
  assert.equal(carryReducer(asked, { type: 'decline', at: 20 }).status, 'declined');
  assert.equal(carryReducer(asked, { type: 'withdraw', at: 20 }).status, 'withdrawn');
  assert.equal(carryReducer(carryReducer(asked, { type: 'withdraw', at: 20 }), { type: 'agree', at: 30 }).status, 'withdrawn');
});

test('carry: the money on the Tab is the same with and without a carry', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA' })]);
  const carry = { ...carryReducer(carryReducer(null, { type: 'ask', from: 'b', to: 'a', amount: 4, by: 'b', at: NOW }), { type: 'agree', at: NOW + 1 }) };
  const withCarry = { ...s, carries: [carry] };
  assert.deepEqual(tabBalances(withCarry), tabBalances(s));
  assert.deepEqual(outstanding(withCarry), outstanding(s));
  // And the person story keeps the same money, with the carry as its own line
  const story = personStory(withCarry, new Set(['a']), 'b');
  const plain = personStory(s, new Set(['a']), 'b');
  assert.equal(story.net, plain.net);
  assert.equal(story.paid, plain.paid);
  const line = story.items.find(it => it.kind === 'carry');
  assert.equal(line.amount, 4, 'B owes me, so it reads on my side');
  assert.equal(line.at, NOW + 1);
  // Only agreed carries get a line
  assert.equal(personStory({ ...s, carries: [{ ...carry, status: 'asked' }] }, new Set(['a']), 'b').items.some(it => it.kind === 'carry'), false);
});

test('carry: two phones, Mike asks and Trevor agrees; both see the same carry', () => {
  const code = 'AAAAAA';
  let trevor = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { code })]);
  let mike = stateOf('zb', [round('r1', ['a', 'b'], twoSkins, { code, localMe: 'b' })]);
  assert.equal(canCarry(mike, 'zb', 'a'), true);
  // Mike (seat b, id zb on his phone) asks to roll his $4
  const split = carrySplit(mike, 'zb', 'a', 4);
  assert.deepEqual(split.map(p => [p.from, p.to, p.cents]), [['b', 'a', 400]]);
  const ask = carryReducer(null, { type: 'ask', from: 'zb', to: 'a', amount: 4, by: 'zb', reason: CARRY_REASONS[0], at: NOW });
  const rows = carryRows(mike, ask, { now: NOW, split });
  assert.deepEqual(rows.map(r => [r.id, r.from, r.to, r.by, r.status]), [['AAAAAA:b>a:carry', 'b', 'a', 'b', 'asked']]);
  mike = applyRows(mike, rows);
  trevor = applyRows(trevor, rows);
  const onTrevor = activeCarry(trevor, 'a', 'b', owedBA);
  assert.equal(onTrevor.status, 'asked');
  assert.equal(onTrevor.by, 'b');
  assert.equal(onTrevor.reason, CARRY_REASONS[0]);
  assert.equal(activeCarry(mike, 'zb', 'a', { from: 'zb', to: 'a', amount: 4 }).by, 'zb', 'Mike sees it as his own ask');
  // Trevor agrees
  const agreed = carryRows(trevor, carryReducer(onTrevor, { type: 'agree', at: NOW + 60e3 }), { now: NOW + 60e3 });
  trevor = applyRows(trevor, agreed);
  mike = applyRows(mike, agreed);
  assert.equal(activeCarry(mike, 'zb', 'a', { from: 'zb', to: 'a', amount: 4 }).status, 'agreed');
  assert.equal(activeCarry(trevor, 'a', 'b', owedBA).carried, 4);
  // Still in the running balance
  assert.deepEqual(outstanding(trevor).map(t => [t.from, t.to, t.amount]), [['b', 'a', 4]]);
  // Both asking at once: the same row id, so the later ask wins
  assert.equal(carryRows(trevor, carryReducer(null, { type: 'ask', from: 'b', to: 'a', amount: 4, by: 'a', at: NOW + 5 }), { split: carrySplit(trevor, 'b', 'a', 4) })[0].id, rows[0].id);
});

test('carry: capped at what’s owed now, and ends when the debt flips', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA' })], {
    carries: [{ id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'agreed', by: 'b', at: NOW, answeredAt: NOW + 1, roundIds: ['r1'], codes: ['AAAAAA'] }],
  });
  assert.equal(activeCarry(s, 'a', 'b', { from: 'b', to: 'a', amount: 2 }).carried, 2, 'a fixed hole shrank the debt');
  assert.equal(activeCarry(s, 'a', 'b', { from: 'a', to: 'b', amount: 2 }), null, 'flipped direction ends it');
  assert.equal(activeCarry(s, 'a', 'b', null), null, 'square ends it');
  // A "rather get paid" answer stands until the amount changes
  const declined = { ...s, carries: [{ ...s.carries[0], status: 'declined' }] };
  assert.equal(activeCarry(declined, 'a', 'b', owedBA).status, 'declined');
  assert.equal(activeCarry(declined, 'a', 'b', { ...owedBA, amount: 6 }), null);
});

test('carry: rolls once the two finish another round together after agreeing', () => {
  const carry = { id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'agreed', by: 'b', at: NOW - 3 * DAY, answeredAt: NOW - 2 * DAY };
  const before = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA', daysAgo: 4 })], { carries: [carry] });
  assert.equal(rolled(carry, before), false);
  // A round without Mike doesn't roll it
  const other = { ...before, rounds: { ...before.rounds, r2: round('r2', ['a', 'c'], {}, { daysAgo: 1 }) } };
  assert.equal(rolled(carry, other), false);
  const next = { ...before, rounds: { ...before.rounds, r3: round('r3', ['a', 'b'], {}, { daysAgo: 1 }) } };
  assert.equal(rolled(carry, next), true);
  assert.equal(activeCarry(next, 'a', 'b', owedBA), null, 'the card goes back to the normal net');
});

test('carry: no reminders while an agreed carry covers the card', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA' })]);
  assert.equal(remindable(s, 'b', owedBA), true);
  // Asked and agreed after the round they cover
  const asked = { ...s, carries: [{ id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'asked', by: 'b', at: NOW }] };
  assert.equal(remindable(asked, 'b', owedBA), true);
  const agreed = { ...s, carries: [{ ...asked.carries[0], status: 'agreed', answeredAt: NOW + 1 }] };
  assert.equal(remindable(agreed, 'b', owedBA), false);
});

test('carry: a pair with no shared round can’t roll it over (the other phone could never answer)', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins)]);
  assert.equal(canCarry(s, 'a', 'b'), false);
  assert.deepEqual(carrySplit(s, 'b', 'a', 4), []);
});

test('carry: a profile doc keeps carries, and one from an older app doesn’t wipe them', () => {
  const carry = { id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'agreed', by: 'b', at: 1, answeredAt: 2 };
  const base = { me: 'a', onboarded: true, settings: {}, favorites: [], players: {}, crews: {}, customCourses: {}, rounds: {}, settlements: [], carries: [carry] };
  const doc = toDocs(base)['profile:me'];
  assert.deepEqual(doc.data.carries, [carry]);
  const fresh = { ...base, carries: [] };
  applyDoc(fresh, 'profile', 'me', doc.data);
  assert.deepEqual(fresh.carries, [carry]);
  const kept = { ...base };
  applyDoc(kept, 'profile', 'me', { me: 'a', onboarded: true, settings: {}, favorites: [] });
  assert.deepEqual(kept.carries, [carry]);
});

test('carry: reason chips never talk about weeks', () => {
  for (const r of CARRY_REASONS) assert.doesNotMatch(r, /week/i);
  assert.ok(CARRY_REASONS.every(r => r.length <= 60), 'fits the server’s reason column');
});
