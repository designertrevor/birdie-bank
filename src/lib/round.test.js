import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, defaultNine, livePreview, resizeRound, scoredHolesDropped } from './round.js';

const DEFAULT_SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
};

const course18 = {
  id: 'c18', name: 'Eighteen', city: 'Town',
  tees: [{ name: 'White', color: '#fff', rating: 70.0, slope: 113 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3, hdcp: i + 1 })),
};
const course9 = {
  id: 'c9', name: 'Nine', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const players = [
  { id: 'a', name: 'Ann', index: 10, tee: 'White' },
  { id: 'b', name: 'Bo', index: 2, tee: 'White' },
];
const mk = (course, holesCount, extra = {}) => createRound({ id: 'r', game: 'skins', course, holesCount, nine: 'front', players, settings: DEFAULT_SETTINGS, hcPct: 100, ...extra });

test('resize 9 → 18 keeps scores and doubles course handicaps', () => {
  const r = mk(course18, 9);
  r.scores[1] = { a: 4, b: 5 }; r.scores[2] = { a: 3, b: 3 }; r.current = 2;
  assert.deepEqual(r.players.map(p => p.courseHc), [4, 0]); // 9-hole HC: (10 - 2 par diff)/2 style rounding
  const out = resizeRound(r, course18, 18, 'front');
  assert.equal(out.holesCount, 18);
  assert.equal(out.holes.length, 18);
  assert.equal(out.nine, null);
  assert.deepEqual(out.scores, r.scores);
  assert.deepEqual(out.players.map(p => p.courseHc), [8, 0]);
  assert.deepEqual(out.players.map(p => p.plays), [8, 0]);
  assert.equal(out.current, 2); // still on hole 3
  assert.equal(r.holesCount, 9); // input untouched
});

test('resize 9 → 18 from a late start hole continues into the other nine', () => {
  const r = mk(course18, 9, { startHole: 5 });
  assert.deepEqual(r.holes.map(h => h.no), [5, 6, 7, 8, 9, 1, 2, 3, 4]);
  const out = resizeRound(r, course18, 18);
  assert.deepEqual(out.holes.map(h => h.no), [5, 6, 7, 8, 9, 1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(out.holes.map(h => h.rank), out.holes.map(h => h.hdcp)); // 18-hole ranks are the card's
  const back = resizeRound(out, course18, 9, 'back');
  assert.deepEqual(back.holes.map(h => h.no), [10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(resizeRound(out, course18, 9, 'front').holes.map(h => h.no), [5, 6, 7, 8, 9, 1, 2, 3, 4]);
});

test('resize 18 → 9 picks a nine, drops the other and keeps per-hole data', () => {
  const r = mk(course18, 18);
  for (let n = 10; n <= 14; n++) r.scores[n] = { a: 4, b: 4 };
  r.current = 14; // hole 15
  assert.equal(defaultNine(r), 'back');
  const out = resizeRound(r, course18, 9, defaultNine(r));
  assert.deepEqual(out.holes.map(h => h.no), [10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.equal(out.nine, 'back');
  assert.equal(out.current, 5); // hole 15 is now index 5
  assert.deepEqual(out.players.map(p => p.courseHc), [4, 0]);
  assert.deepEqual(scoredHolesDropped(r, out.holes), []);
  const front = resizeRound(r, course18, 9, 'front');
  assert.deepEqual(scoredHolesDropped(r, front.holes).map(h => h.no), [10, 11, 12, 13, 14]);
  assert.equal(front.current, 0); // hole 15 gone: first unscored hole in the front nine
});

test('resize scales a hand-set course handicap instead of recomputing it', () => {
  const r = mk(course18, 9, { players: [{ ...players[0], courseHcOverride: 7 }, players[1]] });
  assert.equal(r.players[0].courseHc, 7);
  const out = resizeRound(r, course18, 18);
  assert.equal(out.players[0].courseHc, 14);
  assert.equal(out.players[0].courseHcOverride, 14);
  const back = resizeRound(out, course18, 9);
  assert.equal(back.players[0].courseHc, 7);
});

test('resize on a 9-hole course plays it twice for 18 and clears Nassau presses', () => {
  const r = mk(course9, 9, { game: 'nassau', startHole: 4 });
  assert.deepEqual(r.holes.map(h => h.no), [4, 5, 6, 7, 8, 9, 1, 2, 3]);
  r.presses.push({ id: 'p1', leg: 'front', start: 3, by: 0 });
  const out = resizeRound(r, course9, 18);
  assert.deepEqual(out.holes.map(h => h.no), [4, 5, 6, 7, 8, 9, 1, 2, 3, 13, 14, 15, 16, 17, 18, 10, 11, 12]);
  assert.deepEqual(resizeRound(out, course9, 9).holes.map(h => h.no), [4, 5, 6, 7, 8, 9, 1, 2, 3]);
  assert.equal(out.par, 72);
  assert.deepEqual(out.presses, []);
  assert.equal(resizeRound(r, course9, 9), r); // no-op returns the same object
});

test('livePreview counts the hole being entered before it is saved', () => {
  const r = mk(course9, 9, { useHandicaps: false });
  r.scores[1] = { a: 4, b: 4 }; // tie, skin carries
  const hole2 = r.holes[1];
  const none = livePreview(r, hole2);
  assert.deepEqual(none.balances, { a: 0, b: 0 });
  assert.deepEqual(none.delta, { a: 0, b: 0 });
  const p = livePreview(r, hole2, { scores: { a: 3, b: 4 } });
  assert.deepEqual(p.balances, { a: 4, b: -4 }); // two skins at $2
  assert.deepEqual(p.delta, { a: 4, b: -4 });
  assert.equal(r.scores[2], undefined); // the round itself is untouched
});
