// A 3-player Nassau: the match tiles ("1 up") and the money always tell the same story.
// Overnight 4 saw "1 up" with $0 on a test fixture that made a 3-player Nassau with no sides, a
// round the app can't make: setup, usuals and plans always split 3 players into 2 v 1, and nobody
// can join a Nassau once it's set. With no sides only the first two play, so the third reads $0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayerProblem, createRound, nassauWinners, roundLegs, roundResults, sideNames } from './round.js';
import { matchStatus } from './golf.js';
import { defaultTeams, teamsProblem } from './teams.js';

const S = { hcPct: 100, nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 } };
const course = { id: 'c', name: 'C', city: 'T', tees: [], holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const players = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase() }));
const mk = teams => createRound({ id: 'r', game: 'nassau', course, holesCount: 18, nine: 'front', players, settings: S, hcPct: 100, useHandicaps: false, teams });

/** What the tiles show for each leg, and each player's money. */
function view(r) {
  const w = nassauWinners(r);
  const legs = roundLegs(r);
  const names = sideNames(r);
  const tiles = Object.fromEntries(Object.entries(legs).map(([k, l]) => {
    const s = matchStatus(w, l.start, l.end);
    return [k, s.leader == null ? 'All square' : `${names[s.leader]} ${s.by} up`];
  }));
  return { tiles, balances: roundResults(r).balances };
}

test('3 players always get sides: 2 v 1, and a round without them is flagged', () => {
  assert.deepEqual(defaultTeams('nassau', ['a', 'b', 'c']), [['a', 'b'], ['c']]);
  assert.equal(teamsProblem('nassau', null, ['a', 'b', 'c']), 'Split the players into teams');
  assert.equal(teamsProblem('nassau', null, ['a', 'b']), null);
});

test('2 v 1: 1 up on the tiles is money on both sides, the lone player playing for double', () => {
  const r = mk(defaultTeams('nassau', ['a', 'b', 'c']));
  r.scores[1] = { a: 3, b: 4, c: 4 }; r.current = 1;
  const v = view(r);
  assert.deepEqual(v.tiles, { front: 'A & B 1 up', back: 'All square', total: 'A & B 1 up' });
  // Front and total $5 a player: A and B win $10 each, C pays $20
  assert.deepEqual(v.balances, { a: 10, b: 10, c: -20 });
  // The lone player winning the hole: the other way round
  r.scores[1] = { a: 4, b: 4, c: 3 };
  assert.deepEqual(view(r).tiles.total, 'C 1 up');
  assert.deepEqual(view(r).balances, { a: -10, b: -10, c: 20 });
});

test('nobody can be slotted into a Nassau once it is set, so a third never joins a 2-player match', () => {
  const two = createRound({ id: 'r', game: 'nassau', course, holesCount: 18, nine: 'front', players: players.slice(0, 2), settings: S, hcPct: 100, useHandicaps: false });
  assert.match(addPlayerProblem(two), /set sides/);
  two.scores[1] = { a: 3, b: 4 };
  assert.match(addPlayerProblem(two), /nobody can join/);
});

test('the old fixture shape (3 players, no sides): the tiles and the money are the same two players', () => {
  const r = mk(null);
  r.scores[1] = { a: 3, b: 4, c: 2 }; r.current = 1;
  const v = view(r);
  // C's birdie doesn't count: C isn't in the match, so C's $0 is right and the tile names A
  assert.equal(v.tiles.total, 'A 1 up');
  assert.deepEqual(v.balances, { a: 10, b: -10, c: 0 });
});
