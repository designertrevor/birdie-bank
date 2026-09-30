// Handicaps changed during a round (2026-09-30 playtest): turning them off or fixing a player's
// handicap works every hole out again, played ones included, and nobody without a handicap is
// quietly counted as scratch without it showing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeHandicaps, createRound, noHandicap, roundResults } from './round.js';

// Pars 4, rating 72 and slope 113, so a course handicap is the index
const course = {
  id: 'c', name: 'Flat Creek', city: 'Town',
  tees: [{ name: 'White', color: '#fff', rating: 72, slope: 113 }, { name: 'Blue', color: '#00f', rating: 74, slope: 130 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
// Trevor has an index; the other three never entered one, as in the round that found this
const four = [
  { id: 't', name: 'Trevor', index: 10, tee: 'White' },
  { id: 'p', name: 'Preston', index: null, tee: 'White' },
  { id: 'y', name: 'Tyler', index: null, tee: 'White' },
  { id: 'z', name: 'Zach', index: null, tee: 'White' },
];
const SETTINGS = { banker: { rotation: 'order', defaultBet: 2, min: 1, max: 10, ties: 'push', firstBanker: 0 } };
const mk = (extra = {}) => createRound({ id: 'r', game: 'banker', course, holesCount: 18, nine: 'front', players: four, settings: SETTINGS, hcPct: 100, useHandicaps: true, ...extra });

/** Hole 1 (the hardest): Trevor banks and makes 5, the others make 4 and bet $2 each. */
function playHole1(r) {
  r.scores[1] = { t: 5, p: 4, y: 4, z: 4 };
  r.banker[1] = { banker: 't', bets: { p: 2, y: 2, z: 2 }, doubled: {}, doubleBack: false };
  return r;
}

test('noHandicap names the players who would play off 0', () => {
  assert.deepEqual(noHandicap(mk()).map(p => p.id), ['p', 'y', 'z']);
  const set = changeHandicaps(mk(), course, { players: { z: { courseHc: 6 } } });
  assert.deepEqual(noHandicap(set).map(p => p.id), ['p', 'y']);
});

test('turning handicaps off mid-round works the holes already played out again', () => {
  const r = playHole1(mk());
  // With strokes, Trevor's 5 is a net 4 on the hardest hole: a push with everyone
  assert.equal(r.players.find(p => p.id === 't').plays, 10);
  assert.equal(roundResults(r).balances.t, 0);
  const off = changeHandicaps(r, course, { useHandicaps: false });
  assert.equal(off.useHandicaps, false);
  assert.ok(off.players.every(p => p.plays === 0));
  // Straight up, Trevor's 5 loses to three 4s: he pays $6
  assert.equal(roundResults(off).balances.t, -6);
  // The round passed in is untouched
  assert.equal(r.useHandicaps, true);
});

test('setting a missing handicap mid-round moves strokes off the new low', () => {
  const r = mk();
  const next = changeHandicaps(r, course, { players: { p: { courseHc: 12 }, y: { courseHc: 8 }, z: { courseHc: 14 } } });
  const plays = Object.fromEntries(next.players.map(p => [p.id, p.plays]));
  assert.deepEqual(plays, { t: 2, p: 4, y: 0, z: 6 });
  assert.equal(next.players.find(p => p.id === 'p').courseHcOverride, 12);
  // Back to what their index says (none): 0 again
  const back = changeHandicaps(next, course, { players: { p: { courseHc: null } } });
  assert.equal(back.players.find(p => p.id === 'p').courseHc, 0);
});

test('a tee change works the course handicap out again from the index', () => {
  const next = changeHandicaps(mk(), course, { players: { t: { tee: 'Blue' } } });
  const t = next.players.find(p => p.id === 't');
  assert.equal(t.tee, 'Blue');
  assert.equal(t.courseHc, Math.round(10 * 130 / 113 + 2));
});

test('strokes %, half strokes and a side game\'s own % change with handicaps', () => {
  const r = { ...mk(), sideGames: [{ game: 'skins', settings: { value: 1 } }] };
  const next = changeHandicaps(r, course, { hcPct: 80, halfStrokes: true, sidePcts: { skins: 90 } });
  assert.equal(next.hcPct, 80);
  assert.equal(next.halfStrokes, true);
  assert.equal(next.sideGames[0].hcPct, 90);
  assert.equal(next.players.find(p => p.id === 't').plays, 8);
  // Off drops half strokes, and a null % goes back to the round's
  const off = changeHandicaps(next, course, { useHandicaps: false, sidePcts: { skins: null } });
  assert.equal(off.halfStrokes, undefined);
  assert.equal(off.sideGames[0].hcPct, undefined);
});

test('Banker bets carry over from the last hole each player bet on, last hole\'s banker included', async () => {
  const { bankerHoleSetup } = await import('./round.js');
  const r = mk({ useHandicaps: false });
  r.banker[1] = { banker: 't', bets: { p: 3, y: 5, z: 1 }, doubled: {}, doubleBack: false };
  r.banker[2] = { banker: 'p', bets: { t: 7, y: 4, z: 2 }, doubled: {}, doubleBack: false };
  // Hole 3: Tyler banks. Preston banked hole 2, so his $3 from hole 1 comes back
  const h3 = bankerHoleSetup(r, 2);
  assert.equal(h3.banker, 'y');
  assert.deepEqual(h3.bets, { t: 7, p: 3, z: 2 });
});
