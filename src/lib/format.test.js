import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOf } from './format.js';

test('placeOf: equal money shares a place, the next place skips', () => {
  const standings = [{ amount: 5 }, { amount: 5 }, { amount: -5 }, { amount: -5 }];
  assert.deepEqual(standings.map((_, i) => placeOf(standings, i)), [1, 1, 3, 3]);
  const spread = [{ amount: 10 }, { amount: 2 }, { amount: 2 }, { amount: -14 }];
  assert.deepEqual(spread.map((_, i) => placeOf(spread, i)), [1, 2, 2, 4]);
});
