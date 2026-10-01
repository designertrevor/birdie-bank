// Scramble minimum drives: the quiet shortfall flag (Overnight 6). It names who is still short and how many
// holes are left, only once it is worth saying, and never touches money or blocks a score.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { drivesShortfall, scrambleDrives, shortfallText } from './scramble-drives.js';

const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { a: 'Ann Lee', b: 'Bo Diaz', c: 'Cy', d: 'Di' };
function mk(drives, holesCount = 18) {
  const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: NAMES[id], index: 0 }));
  return createRound({ id: 'r', game: 'scramble', course, holesCount, players, settings: { hcPct: 100, scramble: { stake: 5, drives } }, hcPct: 100, useHandicaps: false, teams: [['a', 'b'], ['c', 'd']] });
}
function tag(r, upto, who) {
  const [t0, t1] = r.teams;
  for (let no = 1; no <= upto; no++) {
    r.marks[no] = { drives: { [t0.id]: who[0](no), [t1.id]: who[1](no) } };
    r.scores[no] = { [t0.id]: 4, [t1.id]: 4 };
  }
  return r;
}

test('shortfall: quiet early, flagged in the last third, with the flag wording', () => {
  // Bo's drive on 1-6 for team A, alternating for team B
  const early = tag(mk(3), 6, [() => 'b', no => (no % 2 ? 'c' : 'd')]);
  assert.deepEqual(drivesShortfall(early, { soon: true }), []);
  // Ann still needs all 3 after 14 holes of Bo: 4 left, so it is flagged (and tight is false: 3 < 4)
  const late = tag(mk(3), 14, [() => 'b', no => (no % 2 ? 'c' : 'd')]);
  const flags = drivesShortfall(late, { soon: true });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].id, 'a');
  assert.equal(flags[0].tight, false);
  assert.equal(shortfallText({ ...flags[0], short: 2 }), 'Ann needs 2 more drives with 4 holes left');
  assert.equal(shortfallText(flags[0]), 'Ann needs 3 more drives with 4 holes left');
  assert.equal(shortfallText({ name: 'Ann', short: 1, left: 1 }), 'Ann needs 1 more drive with 1 hole left');
});

test('shortfall: a tight team is flagged even before the last third', () => {
  // 9 holes, 4 each: Bo on 1-3 leaves Ann owing 4 with 6 left (not tight), Bo on 1-5 owes 4 with 4 left (tight)
  const r = tag(mk(4, 9), 5, [() => 'b', no => (no % 2 ? 'c' : 'd')]);
  const [f] = drivesShortfall(r, { soon: true });
  assert.equal(f.tight, true);
  assert.equal(f.left, 4);
});

test('shortfall: once every hole is tagged the results say who came up short', () => {
  const r = tag(mk(3), 18, [no => (no <= 1 ? 'a' : 'b'), no => (no % 2 ? 'c' : 'd')]);
  const [A, B] = scrambleDrives(r);
  assert.equal(A.left, 0);
  assert.equal(A.tight, false);
  assert.deepEqual(A.players.map(p => [p.drives, p.short]), [[1, 2], [17, 0]]);
  assert.deepEqual(B.players.map(p => p.short), [0, 0]);
  const flags = drivesShortfall(r);
  assert.equal(flags.length, 1);
  assert.equal(shortfallText(flags[0], { done: true }), 'Ann came up 2 drives short');
  // With holes untagged, a finished round still reads as "came up short"
  assert.equal(shortfallText({ name: 'Ann', short: 1, left: 3 }, { done: true }), 'Ann came up 1 drive short');
});

test('shortfall: a player who left early owes nothing, and money never moves', () => {
  const r = tag(mk(3), 18, [() => 'b', no => (no % 2 ? 'c' : 'd')]);
  const before = roundResults(r).balances;
  r.left = { a: 3 };
  assert.deepEqual(drivesShortfall(r), []);
  const off = tag(mk(0), 18, [() => 'b', no => (no % 2 ? 'c' : 'd')]);
  assert.deepEqual(drivesShortfall(off), []);
  assert.deepEqual(roundResults(off).balances, before);
});
