// The Record Book limit (record-book.js): only with the paywall flag on and no Pro, only in the
// record views, never in the stored state, and never in the money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { headToHeadSummary, outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { rivalry } from './rivalry.js';
import { linksOf } from './people-links.js';
import { currentPlan } from './entitlements.js';
import { paywallAnswer } from './paywall.js';
import { FREE_ROUNDS, recordBookLimited, recordBookLine, recordBookView } from './record-book.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  skins: { value: 2, carryover: false },
  stroke: { stake: 5, payout: 'pot' },
};
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: id.toUpperCase(), index: 0 }));

/** A skins round where `winner` takes hole 1 (+$6, the other three -$2); finished at `at`. */
function round(id, ids, winner, at, status = 'done') {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  if (winner) r.scores[1] = Object.fromEntries(ids.map(p => [p, p === winner ? 3 : 4]));
  r.status = status;
  r.createdAt = at - 1;
  if (status === 'done') r.finishedAt = at;
  return r;
}

/**
 * Fourteen finished rounds, oldest first: the first four are all won by `a` (so hiding them changes
 * the record), the next ten are won by b, c, d and a in turn. One round is still being played.
 * An old round also has a claimed seat: `x` (the organizer's card for b) taken by b from a link.
 */
function group() {
  const rounds = {};
  const four = ['a', 'b', 'c', 'd'];
  for (let i = 1; i <= 4; i++) rounds[`old${i}`] = round(`old${i}`, four, 'a', 1000 + i);
  const turn = ['b', 'c', 'd', 'a'];
  for (let i = 1; i <= 10; i++) rounds[`new${i}`] = round(`new${i}`, four, turn[(i - 1) % 4], 2000 + i);
  // b's seat in an old round was saved as x, and b claimed it from the round link
  rounds.oldx = round('oldx', ['a', 'x', 'c', 'd'], 'x', 1010);
  rounds.oldx.claims = { x: 'b' };
  rounds.live = round('live', four, null, 3000, 'active');
  return {
    me: 'a',
    players: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' }, x: { id: 'x', name: 'B' } },
    rounds,
    settlements: [{ id: 's1', from: 'c', to: 'a', amount: 4, at: 1500 }],
    links: {},
    unlinks: [],
  };
}

const done = s => Object.values(s.rounds).filter(r => r.status === 'done');

test('record book: off with the flag off, and off with Pro (trial, paid or Pro for life)', () => {
  const s = group();
  assert.equal(recordBookLimited({ gated: false, pro: false }), false);
  assert.equal(recordBookLimited({ gated: true, pro: true }), false);
  assert.equal(recordBookLimited({ gated: true, pro: false }), true);
  const off = recordBookView(s, { gated: false, pro: false });
  assert.equal(off.state, s, 'flag off: the very same state, nothing copied or hidden');
  assert.equal(off.hidden, 0);
  assert.equal(off.limited, false);
  const pro = recordBookView(s, { gated: true, pro: true });
  assert.equal(pro.state, s);
  assert.equal(pro.hidden, 0);
});

test('record book: the trial and Pro for life both count as Pro', () => {
  const s = group();
  const now = Date.now();
  s.paywall = paywallAnswer({ variant: 'c', choice: 'trial', plan: 'annual', now });
  assert.equal(currentPlan(s, { now }).pro, true);
  assert.equal(recordBookView(s, { gated: true, pro: currentPlan(s, { now }).pro }).hidden, 0);
  const free = group();
  assert.equal(currentPlan(free).pro, false);
  assert.equal(currentPlan(free, { lifetime: true }).pro, true);
  assert.equal(recordBookView(free, { gated: true, pro: currentPlan(free, { lifetime: true }).pro }).hidden, 0);
  // A trial that's over is free again
  const over = group();
  over.paywall = paywallAnswer({ variant: 'c', choice: 'trial', plan: 'annual', now: now - 30 * 86400000 });
  assert.equal(recordBookView(over, { gated: true, pro: currentPlan(over, { now }).pro }).hidden, 5);
});

test('record book: flag on and free, the last 10 finished rounds; live rounds stay; nothing is deleted', () => {
  const s = group();
  const before = JSON.stringify(s);
  const v = recordBookView(s, { gated: true, pro: false });
  assert.equal(FREE_ROUNDS, 10);
  assert.equal(v.limited, true);
  assert.equal(v.total, 15);
  assert.equal(v.hidden, 5);
  assert.deepEqual(done(v.state).map(r => r.id).sort(), Array.from({ length: 10 }, (_, i) => `new${i + 1}`).sort());
  assert.ok(v.state.rounds.live, 'a round still being played is never hidden');
  // The stored state is untouched: same rounds, same everything
  assert.equal(JSON.stringify(s), before);
  assert.equal(Object.keys(s.rounds).length, 16);
  assert.notEqual(v.state, s);
  // Ten or fewer finished rounds: nothing to hide
  const few = { ...s, rounds: Object.fromEntries(Object.entries(s.rounds).filter(([k]) => k.startsWith('new'))) };
  const fv = recordBookView(few, { gated: true, pro: false });
  assert.equal(fv.state, few);
  assert.equal(fv.hidden, 0);
  assert.equal(fv.limited, true);
});

test('record book: the Tab is the same with the limit on or off (money always uses every round)', () => {
  const s = group();
  const v = recordBookView(s, { gated: true, pro: false });
  // The money screens read the real state, whatever the flag. Pinned amounts:
  // a wins old1-4 (+24), new4 and new8 (+12), loses 8 other rounds (-16), x's round (-2), c paid $4.
  // x is b (the claimed seat), so b's +6 in that round adds to b's own
  const bal = tabBalances(s);
  assert.deepEqual(bal, { a: 14, b: 2, c: -2, d: -14 });
  const plan = outstanding(s);
  assert.equal(tabWith(plan, ['a'], 'c'), tabWith(outstanding(s), ['a'], 'c'));
  const total = plan.reduce((t, p) => t + Math.round(p.amount * 100), 0);
  assert.equal(total, 1600, 'everything owed, across every round: $16');
  // Limit on versus off: the state the Tab reads is the same object either way
  const off = recordBookView(s, { gated: false, pro: false });
  assert.deepEqual(tabBalances(off.state), bal);
  assert.deepEqual(tabBalances(s), bal, 'limit on: the Tab still reads the stored state, unchanged');
  assert.deepEqual(outstanding(s), plan);
  // And the view really is different, so reading it for money would be wrong (why the Tab never does)
  assert.notDeepEqual(tabBalances(v.state), bal);
  // The money between two people on a Player card uses every round too
  const story = personStory(s, new Set(['a']), 'b');
  const shown = personStory(v.state, new Set(['a']), 'b');
  assert.ok(story.rounds > shown.rounds, 'the story list shows fewer rounds');
  assert.equal(story.net, personStory(s, new Set(['a']), 'b').net);
});

test('record book: the record views read only the last 10', () => {
  const s = group();
  const v = recordBookView(s, { gated: true, pro: false });
  const all = rivalry(s, new Set(['a']), 'b');
  const ten = rivalry(v.state, new Set(['a']), 'b');
  assert.equal(all.rounds, 15, 'a and b: old1-4, oldx (b in seat x) and new1-10');
  assert.equal(ten.rounds, 10);
  const h2h = headToHeadSummary(v.state, new Set(['a']));
  assert.equal(h2h.get('b').rounds, 10);
});

test('record book: who is who carries over from the hidden rounds', () => {
  const s = group();
  // x is only linked to b by a claim in a hidden round; x also has a newer round of their own
  s.rounds.newx = round('newx', ['a', 'x', 'c', 'd'], 'c', 2500);
  assert.equal(linksOf(s).personOf('x'), 'b');
  const v = recordBookView(s, { gated: true, pro: false });
  assert.ok(!v.state.rounds.oldx, 'the round with the claim is hidden');
  assert.ok(v.state.rounds.newx);
  assert.equal(linksOf(v.state).personOf('x'), 'b', 'still one person in the view');
  assert.deepEqual(s.links, {}, 'the stored links are untouched');
});

test('record book: the same rounds hide on every phone, even with a tie on time', () => {
  const s = group();
  s.rounds.new10.finishedAt = s.rounds.new9.finishedAt;
  const a = recordBookView(s, { gated: true, pro: false, keep: 9 });
  const b = recordBookView({ ...s, rounds: Object.fromEntries(Object.entries(s.rounds).reverse()) }, { gated: true, pro: false, keep: 9 });
  assert.deepEqual(Object.keys(a.state.rounds).sort(), Object.keys(b.state.rounds).sort());
});

test('record book line: calm, counts the older rounds, and never during a live round', () => {
  assert.equal(recordBookLine({ hidden: 0 }), null);
  assert.equal(recordBookLine({ hidden: 4, live: true }), null);
  const one = recordBookLine({ hidden: 1 });
  assert.match(one.text, /the 1 older round\./);
  const many = recordBookLine({ hidden: 12 });
  assert.equal(many.title, 'Your last 10 rounds');
  assert.match(many.text, /Pro brings back the 12 older rounds/);
  assert.match(many.text, /Nothing is deleted/);
  assert.ok(!/\u2014/.test(many.text + many.title));
});

test('record book: the money screens never read the limited view', async () => {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const read = p => readFileSync(new URL(p, root), 'utf8');
  // The Tab, Season, trips, settle-up and the round itself read the stored state only
  const money = [
    'screens/Ledger.jsx', 'screens/Season.jsx', 'screens/Trip.jsx', 'screens/Play.jsx', 'screens/RoundDetail.jsx',
    'screens/BigGame.jsx', 'screens/Books.jsx', 'components/TabCard.jsx', 'components/Pay.jsx',
    'components/WhereFrom.jsx', 'components/TripExpenses.jsx', 'components/CrewTabs.jsx',
  ];
  for (const f of money) assert.ok(!/useRecordBook|recordBookView/.test(read(f)), `${f} must not use the Record Book view`);
  // Only the record views do
  for (const f of ['screens/History.jsx', 'screens/People.jsx', 'screens/Person.jsx', 'screens/Stats.jsx', 'screens/HallOfFame.jsx']) {
    assert.ok(/useRecordBook\(\)/.test(read(f)), `${f} reads the Record Book view`);
  }
});
