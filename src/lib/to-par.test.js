// The scorecard's running to-par for each player, gross and net (Overnight 6 review)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { toParOf, toParText, toParTone, toParWords } from './to-par.js';

const course = {
  id: 'c9', name: 'Nine', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: i === 0 ? 5 : i === 1 ? 3 : 4, hdcp: i + 1 })),
};
const players = [
  { id: 'a', name: 'Ann', index: 10, tee: 'Red' },
  { id: 'b', name: 'Bo', index: 0, tee: 'Red' },
];
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const mk = extra => createRound({ id: 'r', game: 'skins', course, holesCount: 9, nine: 'front', players, settings: SETTINGS, hcPct: 100, ...extra });
const score = (r, rows) => { rows.forEach((row, i) => { r.scores[r.holes[i].no] = row; }); return r; };
const who = (r, id) => r.players.find(p => p.id === id);

test('text: E for even, a plus over, a minus sign under, halves kept', () => {
  assert.equal(toParText(0), 'E');
  assert.equal(toParText(3), '+3');
  assert.equal(toParText(-1), '−1');
  assert.equal(toParText(1.5), '+1½');
  assert.equal(toParText(-0.5), '−½');
  assert.equal(toParText(null), '–');
  assert.equal(toParWords(3), '3 over par');
  assert.equal(toParWords(0), 'even par');
  assert.equal(toParWords(-1.5), '1½ under par');
  assert.deepEqual([-2, 0, 1].map(toParTone), ['under', 'even', 'over']);
});

test('gross to par counts only the holes each player has a score on', () => {
  const r = score(mk({ useHandicaps: false }), [{ a: 6, b: 4 }, { a: 3, b: 3 }, { a: 5 }]);
  // Ann: +1, E, +1 on the three she has; Bo: -1, E, and hole 3 not in yet
  assert.deepEqual(toParOf(r, who(r, 'a')), { played: 3, gross: 2, net: null });
  assert.deepEqual(toParOf(r, who(r, 'b')), { played: 2, gross: -1, net: null });
  // Nothing scored is even on no holes, and shows nothing to count
  assert.deepEqual(toParOf(mk({ useHandicaps: false }), who(r, 'a')), { played: 0, gross: 0, net: null });
});

test('net to par takes off the strokes on the holes played; a pickup counts as net double bogey', () => {
  const r = score(mk({ useHandicaps: true }), [{ a: 6, b: 5 }, { a: 'X', b: 3 }]);
  const ann = who(r, 'a');
  const t = toParOf(r, ann, { withNet: true });
  // Ann gets a stroke on holes 1 and 2 (HCP 1 and 2 on a 9 with a 10 index): net E on 1, net double on 2
  assert.equal(t.played, 2);
  assert.equal(t.net, 0 + 2);
  assert.equal(t.gross, 1 + 3);
  // Bo gets none, so his net is his gross
  const bo = toParOf(r, who(r, 'b'), { withNet: true });
  assert.equal(bo.net, bo.gross);
});
