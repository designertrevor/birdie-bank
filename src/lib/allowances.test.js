import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestedAllowance, allowanceHint, strokesGivenOptions, WHS_ALLOWANCE } from './allowances.js';
import { GAMES } from './round.js';
import { strokesOffLow } from './golf.js';

const pct = (game, o) => suggestedAllowance(game, o)?.pct ?? null;

test('every game has an answer, and only the WHS formats get one', () => {
  const want = {
    stroke: 95, stableford: 95, sixes: 90,
    banker: null, skins: null, wolf: null, vegas: null, quota: null, nines: null, aces: null,
    bbb: null, dots: null, rabbit: null, snake: null, scramble: null,
    // Alternate shot and Chapman have their team allowances built in, like Scramble
    altshot: null, chapman: null,
  };
  for (const game of Object.keys(GAMES)) {
    // Best ball and Shamble go by their teams (team-games.test.js)
    if (['match', 'nassau', 'hammer', 'bestball', 'shamble'].includes(game)) continue;
    assert.ok(game in want, `${game} is covered`);
    assert.equal(pct(game, { teams: null, players: 4 }), want[game], game);
  }
  assert.equal(suggestedAllowance('nope'), null);
});

test('match, Nassau and Hammer: singles get full strokes, best ball gets 90%', () => {
  for (const game of ['match', 'nassau', 'hammer']) {
    assert.equal(pct(game, { teams: [['a'], ['b']], players: 2 }), 100, `${game} 1 v 1`);
    assert.equal(pct(game, { teams: [['a', 'b'], ['c', 'd']], players: 4 }), 90, `${game} 2 v 2`);
    // Uneven or bigger sides are not a WHS format
    assert.equal(pct(game, { teams: [['a'], ['b', 'c', 'd']], players: 4 }), null, `${game} 1 v 3`);
    assert.equal(pct(game, { teams: [['a'], ['b', 'c']], players: 3 }), null, `${game} 1 v 2`);
  }
  assert.equal(pct('match', { teams: [['a', 'b', 'c'], ['d', 'e', 'f']], players: 6 }), null);
  // Nassau and Hammer with two players have no teams: that is singles
  assert.equal(pct('nassau', { teams: null, players: 2 }), 100);
  assert.equal(pct('hammer', { players: 2 }), 100);
  assert.equal(pct('nassau', { teams: null, players: 3 }), null);
});

test('the WHS Appendix C (2024) values', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(WHS_ALLOWANCE).map(([k, v]) => [k, v.pct])),
    { stroke: 95, stableford: 95, singlesMatch: 100, fourBallMatch: 90, fourBallStroke: 85, best1of4: 75, best2of4: 85 });
});

test('hint wording', () => {
  assert.equal(allowanceHint(suggestedAllowance('stroke')), 'Handicap rules suggest 95% for stroke play');
  assert.equal(allowanceHint(suggestedAllowance('match', { teams: [['a'], ['b']] })), 'Handicap rules suggest full strokes for singles match play');
  assert.equal(allowanceHint(suggestedAllowance('sixes')), 'Handicap rules suggest 90% for best ball match play');
  assert.equal(allowanceHint(null), '');
});

test('Strokes given adds the suggested % only when it is missing', () => {
  assert.deepEqual(strokesGivenOptions(null), [100, 90, 80]);
  assert.deepEqual(strokesGivenOptions(suggestedAllowance('sixes')), [100, 90, 80]);
  assert.deepEqual(strokesGivenOptions(suggestedAllowance('stroke')), [100, 95, 90, 80]);
  assert.deepEqual(strokesGivenOptions(WHS_ALLOWANCE.fourBallStroke), [100, 90, 85, 80]);
  // A 95% saved from stroke play stays picked when the next game is match play
  assert.deepEqual(strokesGivenOptions(suggestedAllowance('match', { teams: [['a'], ['b']] }), 95), [100, 95, 90, 80]);
  assert.deepEqual(strokesGivenOptions(null, 90), [100, 90, 80]);
  assert.deepEqual(strokesGivenOptions(null, undefined), [100, 90, 80]);
});

test('95% flows through strokesOffLow like any other allowance', () => {
  // 17 × 95% = 16.15 → 16, 4 × 95% = 3.8 → 4, so 12 strokes
  assert.deepEqual(strokesOffLow([17, 4], 95), [12, 0]);
});
