// Stroke dots stay the main game's strokes; a side game that counts strokes differently gets its own key
// line and a per-hole note (Overnight 6). Nothing here touches money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { holeStrokeNotes, holeStrokeNoteText, otherStrokeGames, strokeKey } from './stroke-key.js';
import { SETTINGS, SIDE_SETTINGS } from './side-bets.fixtures.js';

const flat = n => ({ id: 'f', name: 'Flat', city: 'Town', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
function mk(game, hcs, { hcPct = 100, half = false, sides = {}, hc = true } = {}) {
  const names = { a: 'Ann Lee', b: 'Bo Diaz', c: 'Cy' };
  const ids = Object.keys(hcs);
  const r = createRound({
    id: 'r', game, course: flat(18), holesCount: 18, players: ids.map(id => ({ id, name: names[id], courseHcOverride: hcs[id] })),
    settings: structuredClone(SETTINGS), hcPct, useHandicaps: hc, halfStrokes: half,
  });
  r.sideGames = Object.entries(sides).map(([g, extra]) => ({ game: g, settings: structuredClone(SIDE_SETTINGS[g]), ...extra }));
  if (!r.sideGames.length) delete r.sideGames;
  return r;
}
const hole = (r, pos) => r.holes[pos - 1];

test('stroke key: nothing to say when every game counts the same strokes', () => {
  assert.deepEqual(strokeKey(mk('stroke', { a: 0, b: 10 }, { sides: { skins: {} } })), { dots: '', lines: [] });
  assert.deepEqual(strokeKey(mk('stroke', { a: 0, b: 10 }, { sides: { skins: { hcPct: 80 } }, hc: false })), { dots: '', lines: [] });
  // A side game with the same % as the round is the same strokes
  assert.deepEqual(otherStrokeGames(mk('stroke', { a: 0, b: 10 }, { hcPct: 90, sides: { skins: { hcPct: 90 } } })), []);
});

test('stroke key: a side game on its own % says so, with each player’s strokes', () => {
  const r = mk('stroke', { a: 0, b: 10 }, { sides: { skins: { hcPct: 80 } } });
  const k = strokeKey(r);
  assert.equal(k.dots, 'Dots are strokes in Stroke play');
  assert.deepEqual(k.lines.map(l => l.text), ['Skins plays off 80% of strokes: Bo 8']);
  // Hole 9 is Bo's 9th hardest: a stroke in stroke play, none in the Skins
  assert.deepEqual(holeStrokeNotes(r, r.players[1], hole(r, 9)), [{ key: 'skins', label: 'Skins', n: 0, half: false }]);
  assert.equal(holeStrokeNoteText(holeStrokeNotes(r, r.players[1], hole(r, 9))[0]), 'Skins: none');
  // Hole 1: a stroke in both, so nothing to note
  assert.deepEqual(holeStrokeNotes(r, r.players[1], hole(r, 1)), []);
});

test('stroke key: half strokes in the skins next to a full-stroke main game', () => {
  const r = mk('stroke', { a: 0, b: 4 }, { half: true, sides: { skins: {} } });
  assert.deepEqual(strokeKey(r).lines.map(l => l.text), ['Skins counts each stroke as half']);
  assert.equal(holeStrokeNoteText(holeStrokeNotes(r, r.players[1], hole(r, 2))[0]), 'Skins: 1 half stroke');
  // No stroke on hole 10 in either game: nothing to note
  assert.deepEqual(holeStrokeNotes(r, r.players[1], hole(r, 10)), []);
  // Half strokes on a Nassau: the Skins is half too, so the dots already tell it
  assert.deepEqual(strokeKey(mk('nassau', { a: 0, b: 4 }, { half: true, sides: { skins: {} } })).lines, []);
});

test('stroke key: the birdie pot on full strokes next to a half-stroke match', () => {
  const r = mk('match', { a: 0, b: 4 }, { half: true, sides: { birdies: {} } });
  assert.deepEqual(strokeKey(r).lines.map(l => l.text), ['Birdie pot counts full strokes']);
  assert.equal(holeStrokeNoteText({ label: 'Birdie pot', n: 1, half: false }), 'Birdie pot: 1 stroke');
  assert.equal(holeStrokeNoteText({ label: 'Skins', n: -2, half: false }), 'Skins: gives back 2 strokes');
});

test('stroke key never changes the money', () => {
  const r = mk('stroke', { a: 0, b: 10 }, { sides: { skins: { hcPct: 80 } } });
  for (const h of r.holes.slice(0, 9)) r.scores[h.no] = { a: 4, b: 5 };
  const before = JSON.stringify(roundResults(r).balances);
  strokeKey(r); holeStrokeNotes(r, r.players[1], hole(r, 3));
  assert.equal(JSON.stringify(roundResults(r).balances), before);
});
