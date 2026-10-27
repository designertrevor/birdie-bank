// Up next's number tiles: real numbers only, in twos, and the same money the Tab and the Season show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { homeTiles } from './upnext-tiles.js';
import { myTab } from './history.js';
import { seasonBoard } from './season.js';
import { money } from './golf.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'pot' } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { me: 'Trevor Nielsen', mike: 'Mike Ross', sam: 'Sam Lee' };
const people = ids => ids.map(id => ({ id, name: NAMES[id], index: 0 }));
const NOW = new Date(2026, 9, 26, 12);
const at = (m, d) => new Date(2026, m - 1, d, 15).getTime();

function round(id, ids, holes, when, game = 'skins') {
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.status = 'done';
  r.finishedAt = when;
  return r;
}
const stateWith = rounds => ({
  me: 'me',
  players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
  settlements: [],
});

test('a few money rounds give four tiles that match the Tab and the season', () => {
  const state = stateWith([
    round('r1', ['me', 'mike', 'sam'], { 1: { me: 3 }, 3: { me: 3 } }, at(9, 5)),
    round('r2', ['me', 'mike'], { 2: { mike: 3 } }, at(10, 4)),
    round('r3', ['me', 'mike', 'sam'], { 5: { me: 3 } }, at(10, 18)),
  ]);
  const tiles = homeTiles(state, NOW);
  assert.equal(tiles.length, 4);
  // Bragging rights before bankroll: the Tab, then the days you won and your rival, then the season's money
  assert.deepEqual(tiles.map(t => t.id), ['tab', 'won', 'rival', 'season']);
  const tab = myTab(state);
  assert.equal(tiles[0].big, money(tab.net, { sign: true }));
  // r1 and r3 are yours, r2 is Mike's
  assert.equal(tiles[1].big, '2');
  assert.equal(tiles[1].sub, 'Of 3 rounds this year');
  const board = seasonBoard(state, 2026);
  assert.equal(tiles[2].label, 'You vs Mike');
  assert.equal(tiles[2].big, `${board.rival.won}–${board.rival.lost}`);
  assert.equal(tiles[3].big, money(board.balances.find(b => b.me).net, { sign: true }));
});

test('no day won yet: the rounds played tile stands in', () => {
  // Mike takes every round; the one you play with Sam alone is a tie, so you never top one
  const state = stateWith([
    round('r1', ['me', 'mike'], { 1: { mike: 3 } }, at(10, 4)),
    round('r2', ['me', 'mike'], { 2: { mike: 3 } }, at(10, 5)),
    round('r3', ['me', 'sam'], {}, at(10, 6)),
  ]);
  const tiles = homeTiles(state, NOW);
  assert.ok(!tiles.some(t => t.id === 'won'));
  const played = tiles.find(t => t.id === 'played');
  assert.equal(played.big, '3');
  assert.equal(played.sub, '3 this month');
});

test('never an odd tile out, and never a zero dressed up as a number', () => {
  // Three rounds where everyone tied: square, no season money, no best day
  const state = stateWith([round('a', ['me', 'mike'], {}, at(10, 1)), round('b', ['me', 'mike'], {}, at(10, 2)), round('c', ['me', 'mike'], {}, at(10, 3))]);
  const tiles = homeTiles(state, NOW);
  assert.equal(tiles.length % 2, 0);
  assert.equal(tiles[0].big, 'Square');
  assert.ok(!tiles.some(t => t.id === 'best'));
  for (const t of tiles) assert.notEqual(t.big, '$0');
});

test('rounds from another year count as all time', () => {
  const old = [round('a', ['me', 'mike'], {}, new Date(2025, 5, 1).getTime()), round('b', ['me', 'mike'], {}, new Date(2025, 5, 2).getTime())];
  const tiles = homeTiles(stateWith(old), NOW);
  const played = tiles.find(t => t.id === 'played');
  assert.equal(played.big, '2');
  assert.equal(played.sub, 'All time');
});
