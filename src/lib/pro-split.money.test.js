// Money check for Split Pro on the Tab (pro-split.js), before it merges: the shares in exact cents
// for real prices across 2 to 8 people, the organizer in and out, Undo, the Tab's balances, settle
// up and Where it comes from before and after a split, two phones (the organizer's two, and a
// friend's on the shared Tab) never counting it twice, round money untouched, nothing with the
// paywall flag off, and a payment that settles a split closing it and nothing else (a trip, a
// crew's tab or a round shared live keep what they had).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { breakdownWith } from './where-from.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { tabsOf } from './crew-tabs.js';
import { tabResults } from './play-for.js';
import { recapTransfers } from './recap.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { newTrip, tripStamp, tripStatus } from './trips.js';
import {
  activeSplit, allSplitMoney, isSplitPayment, newSplit, setSplitsOn, splitOpen, splitShares, undoneSplit,
} from './pro-split.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = new Date(2026, 9, 12, 12).getTime();
const PAID_AT = NOW - 60_000;
const cents = v => Math.round(v * 100);
const PRICES = [4999, 5999, 699];
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** A finished 9-hole skins round at $2 a skin; `winner` takes hole 1. `code` shares it live. */
function round(id, ids, winner = null, { at = NOW - 4 * 36e5, code = null, trip = null } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, p === winner && h.no === 1 ? 3 : 4]));
  r.createdAt = at - 36e5;
  r.status = 'done';
  r.finishedAt = at;
  if (code) r.shareCode = code;
  if (trip) r.trip = tripStamp(trip);
  return r;
}
const players = ids => Object.fromEntries(ids.map(id => [id, { id, name: id.toUpperCase() }]));
const stateOf = (extra = {}) => ({
  me: 't', players: players(['t', ...IDS]), rounds: {}, settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, crews: {}, usuals: [],
  paywall: { choice: 'trial', plan: 'annual', at: PAID_AT, trialEnds: PAID_AT + 14 * 864e5 }, ...extra,
});
const withRounds = (s, rounds) => ({ ...s, rounds: { ...s.rounds, ...Object.fromEntries(rounds.map(r => [r.id, r])) } });
const withSplit = (s, split) => ({ ...s, proSplits: { ...(s.proSplits || {}), [split.id]: split } });
const split = ({ id = `pro:${PAID_AT}`, price = 4999, friends = ['a', 'b', 'c'], organizerIn = true, at = NOW } = {}) =>
  newSplit({ id, purchase: PAID_AT, plan: 'annual', price, by: 't', friends, organizerIn, names: players(['t', ...IDS]), now: at });
const on = fn => { setSplitsOn(true); try { return fn(); } finally { setSplitsOn(false); } };
const balCents = s => Object.fromEntries(Object.entries(tabBalances(s, { now: NOW })).map(([k, v]) => [k, cents(v)]).filter(([, v]) => v));
const planOf = s => outstanding(s, { now: NOW }).map(t => `${t.from}>${t.to}:${cents(t.amount)}`).sort();
const card = (s, other) => cents(tabWith(outstanding(s, { now: NOW }), new Set(['t']), other));
/** Record a payment the way the person card does (tab-sync.js recordPayment), rows applied locally. */
function pay(s, from, to, amount, now = NOW, id = 'x') {
  const res = allocatePayment(s, { from, to, amount }, { now, makeId: () => `${id}${Math.round(now)}` });
  return { state: applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows), res };
}

// --------------------------- exact cents --------------------------------------

test('every price, 2 to 8 people, organizer in and out: the Tab carries each share to the cent', () => on(() => {
  for (const price of PRICES) {
    for (let n = 2; n <= 8; n++) {
      for (const organizerIn of [true, false]) {
        const friends = IDS.slice(0, organizerIn ? n - 1 : n);
        const sp = split({ price, friends, organizerIn });
        assert.ok(sp, `${price} over ${n} ${organizerIn}`);
        const shares = splitShares(price, friends, { organizer: 't', organizerIn });
        assert.equal(shares.reduce((a, x) => a + x.cents, 0), price);
        // Never more than a cent between two shares
        const cs = shares.map(x => x.cents);
        assert.ok(Math.max(...cs) - Math.min(...cs) <= 1);
        const s = withSplit(stateOf(), sp);
        const bal = balCents(s);
        const own = organizerIn ? shares[0].cents : 0;
        assert.equal(bal.t, price - own, `organizer is owed the price less their own share (${price}/${n}/${organizerIn})`);
        for (const x of shares) if (x.id !== 't') assert.equal(bal[x.id], -x.cents, `${x.id} owes their share`);
        assert.equal(Object.values(bal).reduce((a, v) => a + v, 0), 0, 'adds up to zero');
        // Settle up: one line a friend, each to the organizer, for exactly their share
        const plan = outstanding(s, { now: NOW });
        assert.equal(plan.length, friends.length);
        for (const t of plan) assert.equal(t.to, 't');
        assert.equal(plan.reduce((a, t) => a + cents(t.amount), 0), price - own);
        // A friend's odd cent is never more than an even share when the organizer is in
        if (organizerIn) for (const x of shares.slice(1)) assert.ok(x.cents <= Math.ceil(price / n));
      }
    }
  }
}));

test('$49.99, $59.99 and $6.99: the shares as Trevor would read them', () => {
  assert.deepEqual(splitShares(4999, ['a', 'b', 'c'], { organizer: 't' }).map(x => x.cents), [1250, 1250, 1250, 1249]);
  assert.deepEqual(splitShares(5999, ['a', 'b', 'c'], { organizer: 't' }).map(x => x.cents), [1500, 1500, 1500, 1499]);
  assert.deepEqual(splitShares(699, ['a', 'b', 'c'], { organizer: 't' }).map(x => x.cents), [175, 175, 175, 174]);
  assert.deepEqual(splitShares(699, IDS.slice(0, 7), { organizer: 't' }).map(x => x.cents), [88, 88, 88, 87, 87, 87, 87, 87]);
  assert.deepEqual(splitShares(5999, IDS.slice(0, 2), { organizer: 't', organizerIn: false }).map(x => x.cents), [3000, 2999]);
});

// --------------------------- before and after, Undo ---------------------------

test('a split adds exactly its shares to a Tab that already has rounds, and Undo puts it back to the cent', () => on(() => {
  // A round on this phone alone (t wins from a, b) and a round shared live (c wins from t)
  const base = withRounds(stateOf(), [round('r1', ['t', 'a', 'b'], 't'), round('r2', ['t', 'c'], 'c', { code: 'CCCCCC' })]);
  const before = { bal: balCents(base), plan: planOf(base), story: personStory(base, new Set(['t']), 'c', { now: NOW }), wf: breakdownWith(base, new Set(['t']), 'c', { now: NOW }) };
  const sp = split();
  const s = withSplit(base, sp);
  const after = balCents(s);
  const d = { t: 3749, a: -1250, b: -1250, c: -1249 };
  for (const id of ['t', 'a', 'b', 'c']) assert.equal((after[id] || 0) - (before.bal[id] || 0), d[id], id);
  // Where it comes from with c: the shared round as before, plus their share of your Pro
  const wf = breakdownWith(s, new Set(['t']), 'c', { now: NOW });
  assert.equal(cents(wf.net), cents(before.wf.net), 'the golf is the same');
  assert.equal(cents(wf.open) - cents(before.wf.open), 1249);
  assert.equal(wf.expenses.filter(x => x.expense.pro).length, 1);
  const story = personStory(s, new Set(['t']), 'c', { now: NOW });
  assert.equal(cents(story.net), cents(before.story.net), 'the head to head never counts the split');
  assert.equal(cents(story.spent) - cents(before.story.spent), 1249);
  // Undo: everything exactly as it was
  const undone = withSplit(s, undoneSplit(sp, NOW + 1));
  assert.deepEqual(balCents(undone), before.bal);
  assert.deepEqual(planOf(undone), before.plan);
  assert.equal(cents(breakdownWith(undone, new Set(['t']), 'c', { now: NOW }).open), cents(before.wf.open));
}));

test('settle up after a split: each friend paying their card squares the whole Tab, and Where it comes from says square', () => on(() => {
  let s = withSplit(withRounds(stateOf(), [round('r1', ['t', 'a', 'b'], 'a'), round('r2', ['t', 'c'], 'c', { code: 'CCCCCC' })]), split());
  for (const t of outstanding(s, { now: NOW })) s = pay(s, t.from, t.to, t.amount, NOW + 1, t.from).state;
  assert.deepEqual(outstanding(s, { now: NOW + 2 }), []);
  assert.ok(Object.values(tabBalances(s)).every(v => Math.abs(v) < 0.005));
  for (const id of ['a', 'b', 'c']) assert.equal(card(s, id), 0, id);
  // c only played t: Where it comes from has them square, the split paid with the round
  assert.equal(cents(breakdownWith(s, new Set(['t']), 'c', { now: NOW + 2 }).open), 0);
}));

test('Undo after a friend paid: the payment stays, so the organizer owes it back, nothing else moves', () => on(() => {
  const sp = split();
  let s = withSplit(stateOf(), sp);
  s = pay(s, 'a', 't', 12.5).state;
  assert.equal(card(s, 'a'), 0);
  s = withSplit(s, undoneSplit(sp, NOW + 5));
  assert.equal(card(s, 'a'), -1250, 'the organizer owes a back their $12.50');
  assert.equal(card(s, 'b'), 0);
  assert.equal(card(s, 'c'), 0);
}));

// --------------------------- rounds untouched ---------------------------------

test('round money never changes: results, transfers and each round’s settle-up status are the same with a split', () => on(() => {
  const rounds = [round('r1', ['t', 'a', 'b'], 'a'), round('r2', ['t', 'c'], 'c', { code: 'CCCCCC' })];
  const base = withRounds(stateOf(), rounds);
  const s = withSplit(base, split());
  for (const r of rounds) {
    assert.deepEqual(roundResults(s.rounds[r.id]), roundResults(base.rounds[r.id]));
    assert.deepEqual(tabResults(s.rounds[r.id]), tabResults(base.rounds[r.id]));
  }
  // The round shared live keeps its own transfer between t and c, split or not (its status follows
  // the Tab's word, which nets the split against it like any other money between the two)
  const recap = st => recapTransfers(st, st.rounds.r2, { now: NOW }).map(t => [t.from, t.to, t.amount]);
  assert.deepEqual(recap(s), recap(base));
}));

// --------------------------- the paywall flag ---------------------------------

test('with the flag off nothing of it shows anywhere: Tab, settle up, person card, Where it comes from, the tabs', () => {
  setSplitsOn(false);
  const base = withRounds(stateOf({ crews: { k: { id: 'k', name: 'Sat', playerIds: ['a', 'b'] } } }), [round('r1', ['t', 'a', 'b'], 't')]);
  const s = withSplit(base, split());
  assert.deepEqual(allSplitMoney(s), []);
  assert.deepEqual(balCents(s), balCents(base));
  assert.deepEqual(planOf(s), planOf(base));
  assert.equal(personStory(s, new Set(['t']), 'c', { now: NOW }).items.length, 0);
  assert.equal(breakdownWith(s, new Set(['t']), 'a', { now: NOW }).expenses.length, 0);
  assert.deepEqual(tabsOf(s, { now: NOW }).everyone, tabsOf(base, { now: NOW }).everyone);
  // And a payment recorded with the flag off is never put on a split
  const { res } = pay(s, 'a', 't', 4);
  assert.ok(!res.settlements.some(isSplitPayment));
});

// --------------------------- two phones ---------------------------------------

test('the organizer’s two phones: the profile carries the split, both phones show the same Tab, applying it twice adds nothing', () => on(() => {
  const rounds = [round('r1', ['t', 'a', 'b'], 'a')];
  const one = withSplit(withRounds(stateOf(), rounds), split());
  const two = withRounds(stateOf({ paywall: null, proSplits: {} }), rounds);
  const docs = toDocs({ ...one, customCourses: {} });
  applyDoc(two, 'profile', 'me', docs['profile:me'].data);
  applyDoc(two, 'profile', 'me', docs['profile:me'].data);
  assert.deepEqual(planOf(two), planOf(one));
  assert.deepEqual(balCents(two), balCents(one));
  // The second phone has no purchase of its own but still finds the split, so it can undo it
  assert.equal(activeSplit(two)?.id, `pro:${PAID_AT}`);
}));

test('two of the organizer’s phones splitting before they sync (two trial answers) never put it on the Tab twice', () => on(() => {
  const fromOne = split({ id: `pro:${PAID_AT}`, at: NOW });
  const fromTwo = split({ id: `pro:${PAID_AT + 500}`, friends: ['a', 'b'], at: NOW + 1000 });
  const one = withSplit(withSplit(stateOf(), fromOne), fromTwo);
  const two = withSplit(withSplit(stateOf({ paywall: { ...stateOf().paywall, at: PAID_AT + 500 } }), fromTwo), fromOne);
  // One split stands: the newer one, on both phones alike
  assert.equal(allSplitMoney(one).length, 1);
  assert.equal(activeSplit(one).id, fromTwo.id);
  assert.equal(activeSplit(two).id, fromTwo.id);
  assert.deepEqual(planOf(one), planOf(two));
  assert.equal(balCents(one).t, 3332, '$49.99 over three, the organizer keeps their own $16.67');
  // Undo the one standing and the other stands in its place, still once
  const after = withSplit(one, undoneSplit(fromTwo, NOW + 2000));
  assert.equal(allSplitMoney(after).length, 1);
  assert.equal(balCents(after).t, 3749);
}));

test('a friend’s phone on the shared Tab: a payment on a round shared live lands the same on both, the split only on the organizer’s', () => on(() => {
  // t owes c $2 on a round shared live (c took hole 1), and c owes t $12.49 for Pro: c owes t $10.49 net
  const r2 = round('r2', ['t', 'c'], 'c', { code: 'CCCCCC' });
  let org = withSplit(withRounds(stateOf(), [r2]), split());
  let fr = withRounds(stateOf({ me: 'c', paywall: null }), [r2]);
  assert.equal(card(org, 'c'), 1249 - 200);
  // c's own phone has only the round: t owes c $2
  assert.equal(cents(tabWith(outstanding(fr, { now: NOW }), new Set(['c']), 't')), 200);
  // c pays t the whole card ($10.49), marked on t's phone
  const { state, res } = pay(org, 'c', 't', (1249 - 200) / 100);
  org = state;
  fr = applyRows(fr, res.rows); // only rows reach the other phone
  assert.equal(card(org, 'c'), 0, 'square on the organizer’s phone');
  assert.deepEqual(outstanding(fr, { now: NOW }), [], 'square on the friend’s phone: the round was paid both ways');
  // Exactly the split was paid on it, once
  assert.equal(splitOpen(org, 'c', 't'), 0);
  assert.equal(res.settlements.filter(isSplitPayment).reduce((a, x) => a + cents(x.amount), 0), 1249);
}));

// --------------------------- a payment closes the split and nothing else -------

test('paying just the split from the Tab never pays a trip: the trip keeps what it had', () => on(() => {
  const trip = newTrip({ id: 't_trip', name: 'Trip', start: '2026-10-10', end: '2026-10-11', by: 't', now: NOW - 5 * 864e5 });
  // a owes t $2 on the trip's round (this phone alone), and $12.50 for Pro
  const rt = round('rt', ['t', 'a'], 't', { at: NOW - 2 * 864e5, trip });
  const base = withSplit(withRounds(stateOf({ trips: { [trip.id]: trip } }), [rt]), split({ friends: ['a', 'b'] }));
  const before = tripStatus(base, trip.id, { now: NOW });
  assert.equal(before.plan.length, 1);
  assert.equal(card(base, 'a'), 200 + 1666);
  // a hands t their Pro share and t marks it on a's card
  const s = pay(base, 'a', 't', 16.66).state;
  const after = tripStatus(s, trip.id, { now: NOW + 1 });
  assert.deepEqual(after.plan.map(l => [l.from, l.to, cents(l.amount)]), before.plan.map(l => [l.from, l.to, cents(l.amount)]), 'the trip still has a owing its $2');
  assert.equal(after.phase, before.phase);
  assert.equal(splitOpen(s, 'a', 't'), 0, 'the split is paid');
  assert.equal(card(s, 'a'), 200, 'the Tab and the trip agree: $2 left');
}));

test('paying just the split never squares a crew’s tab', () => on(() => {
  const crews = { k: { id: 'k', name: 'Saturday', playerIds: ['t', 'a', 'b'] } };
  const r1 = round('r1', ['t', 'a', 'b'], 't');
  const base = withSplit(withRounds(stateOf({ crews }), [r1]), split());
  const crewTab = st => tabsOf(st, { now: NOW + 1 }).tabs.find(t => t.kind === 'crew');
  const before = crewTab(base);
  const s = pay(base, 'a', 't', 12.5).state;
  assert.deepEqual(crewTab(s).balances, before.balances, 'the crew’s rounds are still owed');
  // And the tabs still add up to Everyone
  const all = tabsOf(s, { now: NOW + 1 });
  const total = {};
  for (const t of all.tabs) for (const [id, c] of Object.entries(t.balances)) total[id] = (total[id] || 0) + c;
  for (const [id, c] of Object.entries(all.everyone.balances)) assert.equal(total[id] || 0, c, id);
}));

test('a part payment fills the round shared live first (both phones see it), then the split, then the rest', () => on(() => {
  // c owes t on a round shared live ($2: t takes hole 1) and $12.49 for Pro
  const r2 = round('r2', ['t', 'c'], 't', { code: 'CCCCCC' });
  const base = withSplit(withRounds(stateOf(), [r2]), split());
  const { state, res } = pay(base, 'c', 't', 5);
  assert.equal(res.rows.filter(r => r.status === 'paid').reduce((a, r) => a + cents(r.amount), 0), 200, 'the shared round first');
  assert.equal(res.settlements.filter(isSplitPayment).reduce((a, x) => a + cents(x.amount), 0), 300, 'then the split');
  assert.equal(splitOpen(state, 'c', 't'), 949);
  assert.equal(card(state, 'c'), 949);
}));

test('a split paid with the flag on, then the flag off: the Tab is as if there was never a split', () => {
  const base = withRounds(stateOf(), [round('r1', ['t', 'a', 'b'], 'a')]);
  setSplitsOn(true);
  let s = withSplit(base, split());
  s = pay(s, 'b', 't', 12.5).state;
  setSplitsOn(false);
  assert.deepEqual(balCents(s), balCents(base), 'b’s payment for the split never leaves t owing it back');
  assert.deepEqual(planOf(s), planOf(base));
  assert.equal(personStory(s, new Set(['t']), 'b', { now: NOW }).items.filter(i => i.kind === 'payment').length, 0);
  assert.equal(cents(breakdownWith(s, new Set(['t']), 'b', { now: NOW }).paid), 0);
  assert.deepEqual(tabsOf(s, { now: NOW }).everyone, tabsOf(base, { now: NOW }).everyone);
});
