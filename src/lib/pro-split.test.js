// Split Pro on the Tab (pro-split.js): the shares to the cent, the organizer in or out, Undo, the
// paywall flag, and the money on the Tab: owed to the organizer, settled through the Tab like any
// other money, never touching a round, never on a friend's phone, never twice on a second phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { breakdownWith } from './where-from.js';
import { allocatePayment } from './shared-tab.js';
import { tabsOf } from './crew-tabs.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { makeBackup, parseBackup } from './backup.js';
import {
  MAX_SPLIT, activeSplit, allSplitMoney, cleanSplit, eachCents, sharesVary, groupWord, mergeSplits, newSplit, setSplitsOn, splitCandidates,
  splitIdFor, splitShares, splitsBetween, undoneSplit,
} from './pro-split.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = new Date(2026, 9, 12, 12).getTime();
const PAID_AT = NOW - 60_000;
const sum = list => list.reduce((a, s) => a + s.cents, 0);
const cents = v => Math.round(v * 100);

function round(id, ids, winner = null) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, p === winner && h.no === 1 ? 3 : 4]));
  r.createdAt = NOW - 5 * 36e5;
  r.status = 'done';
  r.finishedAt = NOW - 4 * 36e5;
  return r;
}
const players = ids => Object.fromEntries(ids.map(id => [id, { id, name: id.toUpperCase() }]));
const stateOf = (extra = {}) => ({
  me: 't', players: players(['t', 'a', 'b', 'c']), rounds: {}, settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, crews: {}, usuals: [],
  paywall: { choice: 'trial', plan: 'annual', at: PAID_AT, trialEnds: PAID_AT + 14 * 864e5 }, ...extra,
});
const withSplit = (s, split) => ({ ...s, proSplits: { ...(s.proSplits || {}), [split.id]: split } });
const foursome = (s, { price = 4999, organizerIn = true, friends = ['a', 'b', 'c'] } = {}) =>
  newSplit({ id: splitIdFor(s), purchase: PAID_AT, plan: 'annual', price, by: 't', friends, organizerIn, names: { t: 'T', a: 'A', b: 'B', c: 'C' }, now: NOW });
const on = fn => { setSplitsOn(true); try { return fn(); } finally { setSplitsOn(false); } };

// --------------------------- the shares ---------------------------------------

test('shares add up to the price exactly, 2 to 8 people, organizer in', () => {
  for (const price of [4999, 699, 5000, 1, 7, 9999, 12345]) {
    for (let n = 2; n <= 8; n++) {
      const friends = Array.from({ length: n - 1 }, (_, i) => `f${i}`);
      const shares = splitShares(price, friends, { organizer: 'o', organizerIn: true });
      if (price < n) { assert.equal(sum(shares), price); continue; }
      assert.equal(shares.length, n);
      assert.equal(sum(shares), price, `${price} over ${n}`);
      const lo = Math.floor(price / n);
      assert.ok(shares.every(s => s.cents === lo || s.cents === lo + 1));
      assert.equal(shares[0].id, 'o', 'the organizer goes first');
    }
  }
});

test('odd cents go to the organizer first, then friends by id, whatever order they were picked in', () => {
  // $49.99 for a foursome: 1249 each and 3 cents over
  const s = splitShares(4999, ['c', 'a', 'b'], { organizer: 't', organizerIn: true });
  assert.deepEqual(s, [{ id: 't', cents: 1250 }, { id: 'a', cents: 1250 }, { id: 'b', cents: 1250 }, { id: 'c', cents: 1249 }]);
  assert.deepEqual(splitShares(4999, ['b', 'c', 'a'], { organizer: 't' }), s);
  // The headline names the share most people pay ($12.50), not the one odd share
  assert.equal(eachCents(s), 1250);
  assert.equal(sharesVary(s), true);
  // The three friends: two at $12.50, one at $12.49, so the lines say "about $12.50 each"
  assert.equal(eachCents(s.slice(1)), 1250);
  // Two shares that differ: the larger one, and an even split doesn't vary
  assert.equal(eachCents([{ id: 'a', cents: 350 }, { id: 'b', cents: 349 }]), 350);
  assert.equal(sharesVary(splitShares(5000, ['a', 'b', 'c'], { organizer: 't' })), false);
  // $50 for a foursome: the roadmap's "$12.50 each"
  assert.ok(splitShares(5000, ['a', 'b', 'c'], { organizer: 't' }).every(x => x.cents === 1250));
  // $6.99 over 2: the organizer keeps the odd cent
  assert.deepEqual(splitShares(699, ['a'], { organizer: 't' }), [{ id: 't', cents: 350 }, { id: 'a', cents: 349 }]);
});

test('organizer out: the friends split the whole price, still to the cent', () => {
  const s = splitShares(4999, ['b', 'a', 'c'], { organizer: 't', organizerIn: false });
  assert.deepEqual(s, [{ id: 'a', cents: 1667 }, { id: 'b', cents: 1666 }, { id: 'c', cents: 1666 }]);
  assert.equal(sum(s), 4999);
  assert.ok(!s.some(x => x.id === 't'));
  for (let n = 2; n <= 8; n++) {
    const friends = Array.from({ length: n }, (_, i) => `f${i}`);
    assert.equal(sum(splitShares(4999, friends, { organizer: 'o', organizerIn: false })), 4999);
  }
});

test('what cannot be split', () => {
  assert.equal(splitShares(4999, [], { organizer: 't' }), null, 'nobody else in it');
  assert.equal(splitShares(4999, ['a'], { organizer: 't', organizerIn: false }), null, 'one person is not a split');
  assert.equal(splitShares(4999, ['t'], { organizer: 't' }), null, 'the organizer is not their own friend');
  assert.equal(splitShares(4999, Array.from({ length: MAX_SPLIT }, (_, i) => `f${i}`), { organizer: 't' }), null, 'nine with the organizer');
  assert.ok(splitShares(4999, Array.from({ length: MAX_SPLIT }, (_, i) => `f${i}`), { organizer: 't', organizerIn: false }));
  assert.equal(splitShares(49.99, ['a'], { organizer: 't' }), null, 'cents, never dollars');
  assert.equal(splitShares(0, ['a'], { organizer: 't' }), null);
  assert.equal(splitShares(-100, ['a'], { organizer: 't' }), null);
  // Someone ticked twice is one person
  assert.equal(splitShares(1000, ['a', 'a'], { organizer: 't' }).length, 2);
});

test('a split is checked when it comes back from an account or a backup', () => {
  const s = foursome(stateOf());
  assert.deepEqual(cleanSplit(s), s);
  assert.equal(cleanSplit({ ...s, price: 5000 }), null, 'shares that do not add up');
  assert.equal(cleanSplit({ ...s, people: [...s.people, s.people[1]] }), null, 'someone twice');
  assert.equal(cleanSplit({ ...s, organizerIn: false }), null, 'says the organizer is out while they pay a share');
  assert.equal(cleanSplit({ ...s, people: [{ id: 't', name: 'T', cents: 4999 }] }), null, 'nobody but the organizer');
  assert.equal(cleanSplit({ ...s, people: s.people.map(p => ({ ...p, cents: p.cents + 0.5 })) }), null, 'whole cents only');
  assert.deepEqual(cleanSplit(undoneSplit(s, NOW + 1)), { id: s.id, by: 't', undone: true, at: NOW, updatedAt: NOW + 1 });
  assert.equal(groupWord(4), 'your foursome');
  assert.equal(groupWord(6), 'the 6 of you');
});

// --------------------------- on the Tab ---------------------------------------

test('with the flag off a split puts nothing on the Tab, even one made while it was on', () => {
  const s = withSplit(stateOf(), foursome(stateOf()));
  setSplitsOn(false);
  assert.deepEqual(allSplitMoney(s), []);
  assert.deepEqual(outstanding(s, { now: NOW }), []);
  assert.deepEqual(tabBalances(s, { now: NOW }), {});
});

test('each friend owes the organizer their share; the organizer keeps their own', () => on(() => {
  const s = withSplit(stateOf(), foursome(stateOf()));
  const plan = outstanding(s, { now: NOW });
  assert.deepEqual(plan.map(t => [t.from, t.to, cents(t.amount)]).sort(), [['a', 't', 1250], ['b', 't', 1250], ['c', 't', 1249]]);
  const bal = tabBalances(s, { now: NOW });
  assert.equal(cents(bal.t), 3749, 'the price less the organizer’s own share');
  assert.equal(cents(bal.a + bal.b + bal.c + bal.t), 0);
  // Organizer out: the friends owe the whole price
  const out = withSplit(stateOf(), foursome(stateOf(), { organizerIn: false }));
  assert.equal(cents(tabBalances(out, { now: NOW }).t), 4999);
}));

test('it never touches a round, and the rounds keep their money', () => on(() => {
  const r = round('r1', ['t', 'a', 'b'], 'a');
  const base = stateOf({ rounds: { r1: r } });
  const before = JSON.stringify(r);
  const before$ = tabBalances(base, { now: NOW });
  const s = withSplit(base, foursome(base));
  const after$ = tabBalances(s, { now: NOW });
  assert.equal(JSON.stringify(s.rounds.r1), before);
  // The difference is exactly the split, person by person
  const split = { t: 3749, a: -1250, b: -1250, c: -1249 };
  for (const id of ['t', 'a', 'b', 'c']) assert.equal(cents((after$[id] || 0) - (before$[id] || 0)), split[id], id);
}));

test('a friend the organizer never played with can still pay them directly', () => on(() => {
  // Nobody has a round: without the split's pairs the Tab could not put a line between them
  const s = withSplit(stateOf(), foursome(stateOf()));
  for (const t of outstanding(s, { now: NOW })) assert.equal(t.to, 't');
}));

test('it settles through the Tab: a payment squares it, and the person card says where it comes from', () => on(() => {
  let s = withSplit(stateOf(), foursome(stateOf()));
  const res = allocatePayment(s, { from: 'a', to: 't', amount: 12.5 }, { now: NOW, makeId: () => 'x1' });
  assert.equal(res.rows.length, 0, 'no round rows: nothing shared live');
  s = { ...s, settlements: [...s.settlements, ...res.settlements] };
  const plan = outstanding(s, { now: NOW });
  assert.equal(tabWith(plan, new Set(['t']), 'a'), 0);
  assert.equal(cents(tabWith(plan, new Set(['t']), 'b')), 1250);
  const story = personStory(s, new Set(['t']), 'b', { now: NOW });
  assert.equal(story.items.find(i => i.kind === 'expense')?.expense.pro, true);
  assert.equal(cents(story.spent), 1250);
  const w = breakdownWith(s, new Set(['t']), 'c', { now: NOW });
  assert.equal(cents(w.open), 1249);
  assert.equal(w.expenses[0].expense.pro, true);
}));

test('the crews’ tabs still add up to Everyone, the split on Other rounds', () => on(() => {
  const s = withSplit(stateOf({ crews: { k: { id: 'k', name: 'Saturday', playerIds: ['a', 'b'] } }, rounds: { r1: round('r1', ['t', 'a', 'b'], 'b') } }), foursome(stateOf()));
  const all = tabsOf(s, { now: NOW });
  const total = {};
  for (const t of all.tabs) for (const [id, c] of Object.entries(t.balances)) total[id] = (total[id] || 0) + c;
  for (const [id, c] of Object.entries(all.everyone.balances)) assert.equal(total[id] || 0, c, id);
}));

test('Undo takes it all back off, and splitting again writes over the same purchase', () => on(() => {
  const s0 = stateOf();
  const split = foursome(s0);
  const s1 = withSplit(s0, split);
  assert.ok(activeSplit(s1));
  const s2 = withSplit(s1, undoneSplit(split, NOW + 1000));
  assert.equal(activeSplit(s2), null);
  assert.deepEqual(outstanding(s2, { now: NOW }), []);
  const again = { ...foursome(s0, { friends: ['a', 'b'] }), at: NOW + 2000, updatedAt: NOW + 2000 };
  const s3 = withSplit(s2, again);
  assert.equal(Object.keys(s3.proSplits).length, 1);
  assert.equal(outstanding(s3, { now: NOW }).length, 2);
}));

test('never twice on a second phone: the same purchase is one split, the newer copy wins', () => on(() => {
  const s = stateOf();
  const fromA = foursome(s);
  const fromB = { ...foursome(s, { friends: ['a', 'b'] }), updatedAt: NOW + 5 };
  assert.equal(fromA.id, fromB.id);
  const merged = mergeSplits(mergeSplits({}, [fromA]), [fromB]);
  assert.equal(Object.keys(merged).length, 1);
  assert.equal(merged[fromA.id].people.length, 3);
  // An older copy never undoes a newer one, and an undone stub wins a tie
  assert.equal(mergeSplits(merged, [fromA]), merged);
  const undone = undoneSplit(fromB, NOW + 5);
  const tie = mergeSplits(merged, [{ ...undone, updatedAt: fromB.updatedAt }]);
  assert.equal(tie[fromA.id].undone, true);
  // Through the account: the profile carries it, and applying it twice changes nothing
  const docs = toDocs({ ...withSplit(s, fromA), customCourses: {} });
  const other = { ...stateOf(), proSplits: {} };
  applyDoc(other, 'profile', 'me', docs['profile:me'].data);
  applyDoc(other, 'profile', 'me', docs['profile:me'].data);
  assert.equal(Object.keys(other.proSplits).length, 1);
  assert.equal(outstanding(other, { now: NOW }).length, 3);
}));

test('a friend’s phone never counts it, even with the split on it', () => on(() => {
  const split = foursome(stateOf());
  const friend = withSplit(stateOf({ me: 'a' }), split);
  assert.deepEqual(allSplitMoney(friend), []);
  assert.deepEqual(outstanding(friend, { now: NOW }), []);
  assert.deepEqual(splitsBetween(friend, id => id === 'a', id => id === 't'), []);
}));

test('a backup keeps splits', () => {
  const s = withSplit({ ...stateOf(), customCourses: {} }, foursome(stateOf()));
  const back = parseBackup(JSON.stringify(makeBackup(s)));
  assert.ok(back.ok);
  assert.ok(back.data.proSplits[splitIdFor(s)]);
});

test('who you can split with: the latest usual first, you never in the list', () => {
  const s = stateOf({
    players: { ...players(['t', 'a', 'b', 'c', 'd', 'e']), x: { id: 'x', name: 'Old A', mergedInto: 'a' } },
    usuals: [
      { id: 'u1', players: ['t', 'd', 'e'], names: {}, createdAt: 1, lastPlayedAt: 5 },
      { id: 'u2', players: ['t', 'a', 'x', 'b'], names: {}, createdAt: 2, lastPlayedAt: 9 },
    ],
    crews: { k: { id: 'k', name: 'Big', playerIds: ['c', 'd'] } },
  });
  const c = splitCandidates(s);
  assert.deepEqual(c.picked, ['a', 'b'], 'the latest usual, a merged player as the one they were merged into');
  assert.ok(!c.people.some(p => p.id === 't'));
  assert.equal(new Set(c.people.map(p => p.id)).size, c.people.length);
  assert.deepEqual(c.people.map(p => p.id).sort(), ['a', 'b', 'c', 'd', 'e']);
  // Nobody saved: nothing to offer
  assert.deepEqual(splitCandidates(stateOf({ players: players(['t']) })), { people: [], picked: [] });
  // No usual or crew: the first three people
  assert.equal(splitCandidates(stateOf({ players: players(['t', 'a', 'b', 'c', 'd']) })).picked.length, 3);
});

test('one split stands at a time: a second trial answer finds the first split, not a new offer', () => {
  const s0 = stateOf();
  const first = foursome(s0);
  const later = withSplit({ ...s0, paywall: { ...s0.paywall, at: PAID_AT + 864e5 } }, first);
  assert.notEqual(splitIdFor(later), first.id);
  assert.equal(activeSplit(later)?.id, first.id);
  // Undone, it's gone, and a new purchase can be split
  assert.equal(activeSplit(withSplit(later, undoneSplit(first, NOW + 1))), null);
  // Someone else's split is never yours
  assert.equal(activeSplit({ ...later, me: 'a' }), null);
});

test('no purchase, no split', () => {
  assert.equal(splitIdFor(stateOf({ paywall: null })), null);
  assert.equal(splitIdFor(stateOf()), `pro:${PAID_AT}`);
});
