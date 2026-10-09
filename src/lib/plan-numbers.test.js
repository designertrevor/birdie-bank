// The cancel screen's numbers: rounds you played, rivalries, what was settled (dollars only when your
// privacy shows your money) and the group's best moment, from the rounds on this phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OCT, base, skins } from './crew-tabs.fixtures.js';
import { RIVALRY_ROUNDS, bestMomentTile, groupNumbers, numbersLine, settledText } from './plan-numbers.js';

const SHOW = { profile: 'played', showMoney: true };

test('rounds count what you played, and rivalries are friends with enough rounds together', () => {
  assert.equal(RIVALRY_ROUNDS, 2);
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[2, 'a']], { at: OCT(5) });
  const r3 = skins('r3', ['t', 'a', 'c'], [[3, 'c']], { at: OCT(6) });
  // A round you only watched: never counts
  const watched = skins('w1', ['b', 'd'], [[1, 'b']], { at: OCT(7) });
  const live = skins('l1', ['t', 'b'], [], { at: OCT(8) });
  live.status = 'live';
  const n = groupNumbers(base([r1, r2, r3, watched, live]));
  assert.equal(n.rounds, 3);
  // a played 3 rounds with you, b and c one each
  assert.equal(n.rivalries, 1);
});

test('one person is one rival, whichever id a round has', () => {
  const r1 = skins('r1', ['t', 'a'], [], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a2'], [], { at: OCT(4) });
  const s = base([r1, r2], { links: { a2: 'a' } });
  assert.equal(groupNumbers(s).rivalries, 1);
  assert.equal(groupNumbers(base([r1, r2])).rivalries, 0);
});

test('money settled shows in dollars only when your privacy shows your money', () => {
  const s = base([], { settlements: [{ id: 'p1', from: 'a', to: 't', amount: 12.5, at: 1 }, { id: 'p2', from: 'b', to: 'a', amount: 30, at: 2 }, { id: 'bad', from: 'b', to: 'a', amount: 0 }] });
  const hidden = groupNumbers(s).settled;
  assert.deepEqual(hidden, { count: 2, cents: 4250, shown: false });
  assert.equal(settledText(hidden), '2 payments settled');
  const shown = groupNumbers(s, { privacy: SHOW }).settled;
  assert.equal(settledText(shown), '$42.50 settled');
  // Only you, even with the money switch on: hidden
  assert.equal(groupNumbers(s, { privacy: { profile: 'hidden', showMoney: true } }).settled.shown, false);
  // Reads your saved profile privacy when none is passed
  assert.equal(groupNumbers({ ...s, profile: { privacy: SHOW } }).settled.shown, true);
  assert.equal(settledText({ count: 1, cents: 500, shown: false }), '1 payment settled');
  assert.equal(settledText({ count: 0, cents: 0, shown: true }), null);
});

test('the headline reads like Strava’s and leaves out zeros', () => {
  assert.equal(numbersLine({ rounds: 12, rivalries: 4, settled: { count: 9, cents: 64000, shown: true } }), '12 rounds, 4 rivalries and $640 settled');
  assert.equal(numbersLine({ rounds: 1, rivalries: 1, settled: { count: 0, cents: 0, shown: true } }), '1 round and 1 rivalry');
  assert.equal(numbersLine({ rounds: 3, rivalries: 0, settled: { count: 0, cents: 0 } }), '3 rounds');
  assert.equal(numbersLine({ rounds: 0, rivalries: 0, settled: { count: 0 } }), null);
});

test('the best moment is the low full round, never money', () => {
  const r1 = skins('r1', ['t', 'a'], [[1, 't'], [2, 't']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(5) });
  const n = groupNumbers(base([r1, r2]));
  assert.equal(n.best.kind, 'low');
  assert.equal(n.best.id, 'a');
  assert.equal(n.best.strokes, 33);
  assert.equal(n.best.holes, 9);
  const tile = bestMomentTile(n.best);
  assert.equal(tile.value, 'A’s 33');
  assert.match(tile.sub, /^Low 9 · Flat Nine, Oct 5$/);
  // Yours says "Your"
  const mine = groupNumbers(base([r1]));
  assert.equal(bestMomentTile(mine.best).value, 'Your 34');
});

test('with no full card, the most skins in one round; with nothing, no moment', () => {
  const r1 = skins('r1', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 't']], { at: OCT(3) });
  delete r1.scores[9].t; // a hole missing: no full card for anyone but a
  delete r1.scores[9].a;
  const n = groupNumbers(base([r1]));
  assert.equal(n.best.kind, 'skins');
  assert.equal(n.best.id, 'a');
  assert.equal(bestMomentTile(n.best).value, 'A’s 2 skins');
  assert.equal(groupNumbers(base([])).best, null);
  assert.equal(bestMomentTile(null), null);
});
