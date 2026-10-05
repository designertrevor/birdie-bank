// The Big Game's module loads first without tripping over its own import circle (big-game.js ->
// ledger.js -> ... -> trips.js, which reads BIG_FORMAT while it loads). Its own file, so
// big-game.js is the very first module this process loads.
import { BIG_FORMAT, BIG_NAME } from './big-game.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIG_FORMAT as LEAF } from './big-format.js';
import { TRIP_FORMATS } from './trips.js';

test('big game: loads first, and the format is one constant', () => {
  assert.equal(BIG_FORMAT, 'big');
  assert.equal(LEAF, BIG_FORMAT);
  assert.ok(BIG_NAME);
  assert.ok(TRIP_FORMATS[BIG_FORMAT]);
});
