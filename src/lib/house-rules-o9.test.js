// House rules added 2026-10-05 (overnight 9). Every one starts off, so rounds from before give exactly
// the money they always did: o9-money.snapshot.json was taken with round.js before any of them went in,
// over seeded rounds of every game with the earlier house rules on at random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roundResults } from './round.js';
import { o9Rounds } from './o9-money.fixtures.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./o9-money.snapshot.json', import.meta.url), 'utf8'));
const moneyOf = r => {
  const res = roundResults(r);
  const byGame = res.detail.byGame ? Object.fromEntries(Object.entries(res.detail.byGame).map(([k, v]) => [k, v.balances])) : undefined;
  return { balances: res.balances, pairs: res.pairs, ...(byGame ? { byGame } : {}) };
};

test('rounds saved before tonight give exactly the money they did, head to head and game by game', () => {
  const rounds = o9Rounds();
  assert.equal(rounds.length, Object.keys(SNAPSHOT).length);
  for (const { name, round } of rounds) assert.deepEqual(moneyOf(round), SNAPSHOT[name], name);
});
