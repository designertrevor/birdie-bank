// Fix a hole or a tee mid-round: stroke index swaps and re-ranks, the money recounts, fixes survive
// a change of round length, and rounds without fixes are exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayerToRound, createRound, fixHole, fixTee, fixedCourse, holesInPlay, playedTwice, resizeRound, roundResults, strokeChanges, strokesFor } from './round.js';
import { holeFixFeedback, keepsDraft, moneyChanges, moneyLine, playsLine, strokeChangeLines, strokeImpact, teeFixFeedback } from './hole-fix.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: false } };
// Pars 5-4-3 repeating (72), rating 72 and slope 113, so a course handicap is the index
const course18 = {
  id: 'pc', name: 'Pebble Creek', city: 'Town',
  tees: [{ name: 'White', color: '#fff', rating: 72, slope: 113 }, { name: 'Blue', color: '#00f', rating: 74, slope: 130 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: [5, 4, 3][i % 3], hdcp: i + 1 })),
};
const course9 = {
  id: 'n9', name: 'Nine', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 36, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const three = [
  { id: 'd', name: 'Dave Smith', index: 1, tee: 'White' },
  { id: 't', name: 'Trevor N', index: 0, tee: 'White' },
  { id: 'a', name: 'Al B', index: 0, tee: 'White' },
];
const mk = (extra = {}) => createRound({ id: 'r', game: 'skins', course: course18, holesCount: 18, nine: 'front', players: three, settings: SETTINGS, hcPct: 100, ...extra });
const hole = (r, no) => r.holes.find(h => h.no === no);

test('fixHole: a stroke index already on another hole swaps the two and re-ranks', () => {
  const r = mk();
  const f = fixHole(r, 7, { hdcp: 1 }, { at: 5, by: 'd' });
  assert.equal(hole(f, 7).hdcp, 1);
  assert.equal(hole(f, 1).hdcp, 7);
  assert.equal(hole(f, 7).rank, 1);
  assert.equal(hole(f, 1).rank, 7);
  assert.deepEqual(f.holeFixes, { 7: { courseIdx: 6, hdcp: [7, 1], at: 5, by: 'd' }, 1: { courseIdx: 0, hdcp: [1, 7], at: 5, by: 'd' } });
  // The original round is untouched
  assert.equal(hole(r, 7).hdcp, 7);
  assert.equal(r.holeFixes, undefined);
  // Every stroke index is still used once
  assert.deepEqual(f.holes.map(h => h.hdcp).sort((x, y) => x - y), Array.from({ length: 18 }, (_, i) => i + 1));
});

test('fixHole: par changes the round par, never course handicaps or strokes', () => {
  const r = mk();
  const f = fixHole(r, 7, { par: 4 });
  assert.equal(hole(f, 7).par, 4);
  assert.equal(f.par, r.par - 1);
  assert.deepEqual(f.players, r.players);
  assert.deepEqual(f.holeFixes[7].par, [5, 4]);
  // Fixing it back clears the fix
  const back = fixHole(f, 7, { par: 5 });
  assert.equal(back.holeFixes, undefined);
  assert.deepEqual(back.holes, r.holes);
});

test('a stroke index fix moves strokes and the Skins money exactly', () => {
  const r = mk();
  // Dave plays off 1: his stroke is on the hardest hole, hole 1
  const dave = r.players.find(p => p.id === 'd');
  assert.equal(dave.plays, 1);
  assert.equal(strokesFor(r, dave, hole(r, 1)), 1);
  // Hole 1: everyone makes 4, so Dave's net 3 wins the skin ($2 from each: Dave +4, Trevor -2, Al -2).
  // Hole 7: Dave 5 (net 5 before), Trevor 4, Al 4: Trevor and Al tie, no skin.
  r.scores = { 1: { d: 4, t: 4, a: 4 }, 7: { d: 5, t: 4, a: 4 } };
  assert.deepEqual(roundResults(r).balances, { d: 4, t: -2, a: -2 });
  // The card really has hole 7 as stroke index 1: it swaps with hole 1
  const f = fixHole(r, 7, { hdcp: 1 });
  // Now hole 1 is a three-way tie (no skin) and on hole 7 Dave's net 4 ties Trevor and Al (no skin)
  assert.deepEqual(roundResults(f).balances, { d: 0, t: 0, a: 0 });
  assert.deepEqual(strokeChanges(r, f), [
    { id: 'd', name: 'Dave Smith', holeNo: 1, from: 1, to: 0 },
    { id: 'd', name: 'Dave Smith', holeNo: 7, from: 0, to: 1 },
  ]);
  assert.deepEqual(strokeImpact(r, f, 7), ['Dave gets a stroke here now, not on 1.']);
  assert.deepEqual(moneyChanges(r, f).map(c => [c.id, c.delta]), [['t', 2], ['a', 2], ['d', -4]]);
  assert.equal(moneyLine(r, f), 'Money recounts: Trevor +$2, Al +$2, Dave −$4');
});

test('stroke change lines', () => {
  const c = (holeNo, from, to, id = 'd', name = 'Dave Smith') => ({ id, name, holeNo, from, to });
  assert.deepEqual(strokeChangeLines([], 7), []);
  assert.deepEqual(strokeChangeLines([c(7, 0, 1), c(9, 1, 0)], 7), ['Dave gets a stroke here now, not on 9.']);
  assert.deepEqual(strokeChangeLines([c(7, 1, 0), c(9, 0, 1)], 7), ['Dave gets a stroke on 9 now, not here.']);
  assert.deepEqual(strokeChangeLines([c(3, 0, 1), c(7, 0, 1), c(9, 1, 0)], 7), ['Dave gets a stroke here and on 3 now, not on 9.']);
  assert.deepEqual(strokeChangeLines([c(4, 0, 1)], 7), ['Dave gets a stroke on 4 now.']);
  assert.deepEqual(strokeChangeLines([c(7, 1, 0)], 7), ['Dave doesn’t get a stroke here now.']);
  assert.deepEqual(strokeChangeLines([c(7, 0, 1), c(2, 1, 0, 't', 'Trevor')], 7), ['Dave gets a stroke here now.', 'Trevor doesn’t get a stroke on 2 now.']);
  assert.deepEqual(strokeChangeLines([c(7, 0, -1)], 7), ['Dave’s strokes change here.']);
  // No handicaps: nothing moves
  const r = mk({ useHandicaps: false });
  assert.deepEqual(strokeImpact(r, fixHole(r, 7, { hdcp: 1 }), 7), ['No one’s strokes change.']);
});

test('a stroke index nobody else has moves only the ranks', () => {
  // Front 9 of an 18-hole card: stroke indexes 1 to 9 here, so 12 is free
  const r = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 9, nine: 'front', players: three, settings: SETTINGS, hcPct: 100 });
  const f = fixHole(r, 1, { hdcp: 12 });
  assert.equal(hole(f, 1).hdcp, 12);
  assert.equal(hole(f, 1).rank, 9);
  assert.equal(hole(f, 2).rank, 1);
  assert.equal(Object.keys(f.holeFixes).length, 1);
});

test('a resize keeps the fixes', () => {
  const r = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 9, nine: 'front', players: three, settings: SETTINGS, hcPct: 100 });
  const f = fixHole(fixHole(r, 7, { par: 4, hdcp: 1 }), 2, { par: 5 });
  const big = resizeRound(f, course18, 18, 'front');
  assert.equal(hole(big, 7).par, 4);
  assert.equal(hole(big, 7).hdcp, 1);
  assert.equal(hole(big, 1).hdcp, 7);
  assert.equal(hole(big, 2).par, 5);
  assert.equal(hole(big, 7).rank, 1);
  assert.deepEqual(big.holeFixes, f.holeFixes);
  // Course handicaps come from the card's own pars, so the par fix doesn't move them
  const plain = resizeRound(r, course18, 18, 'front');
  assert.deepEqual(big.players, plain.players);
  // And back to 9
  const small = resizeRound(big, course18, 9, 'front');
  assert.equal(hole(small, 7).par, 4);
  assert.equal(hole(small, 7).hdcp, 1);
  assert.deepEqual(small.players, r.players);
});

test('a 9-hole card played twice: par fixes both passes, the stroke index is left alone', () => {
  const r = createRound({ id: 'r', game: 'skins', course: course9, holesCount: 18, nine: 'front', players: three.map(p => ({ ...p, tee: 'Red' })), settings: SETTINGS, hcPct: 100 });
  assert.equal(playedTwice(r), true);
  const f = fixHole(r, 3, { par: 3, hdcp: 1 });
  assert.equal(hole(f, 3).par, 3);
  assert.equal(hole(f, 12).par, 3);
  assert.deepEqual(f.holes.map(h => h.hdcp), r.holes.map(h => h.hdcp));
  assert.equal(f.par, r.par - 2);
  assert.deepEqual(Object.keys(f.holeFixes).sort(), ['12', '3']);
  const back = resizeRound(f, course9, 9);
  assert.equal(hole(back, 3).par, 3);
});

test('rounds without fixes are exactly as before', () => {
  const r = mk();
  r.scores = { 1: { d: 4, t: 4, a: 4 }, 2: { d: 5, t: 4, a: 3 } };
  const before = structuredClone(r);
  assert.equal(fixedCourse(course18, r), course18);
  // A no-change fix leaves the round as it was
  assert.deepEqual(fixHole(r, 7, { par: 5, hdcp: 7 }), before);
  // A resize there and back is the same as it always was
  const r9 = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 9, nine: 'front', players: three, settings: SETTINGS, hcPct: 100 });
  const up = resizeRound(r9, course18, 18, 'front');
  assert.equal('holeFixes' in up, false);
  assert.equal('teeFixes' in up, false);
  assert.deepEqual(up.holes, holesInPlay(course18, 18, 'front'));
  assert.deepEqual(up.players.map(p => [p.courseHc, p.plays]), [[1, 1], [0, 0], [0, 0]]);
  assert.deepEqual(resizeRound(up, course18, 9, 'front').players, r9.players);
  assert.deepEqual(roundResults(r), roundResults(before));
  assert.deepEqual(r, before);
});

test('a tee fix works out course handicaps again and keeps one set by hand', () => {
  const players = [
    { id: 'd', name: 'Dave', index: 10, tee: 'White' },
    { id: 't', name: 'Trevor', index: 20, tee: 'White', courseHcOverride: 15 },
    { id: 'a', name: 'Al', index: 4, tee: 'Blue' },
  ];
  const r = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 18, nine: 'front', players, settings: SETTINGS, hcPct: 100 });
  assert.deepEqual(r.players.map(p => p.courseHc), [10, 15, 7]);
  // White is really rating 73: Dave's course handicap goes 10 → 11; Trevor's is set by hand; Al is on Blue
  const f = fixTee(r, course18, 'White', { rating: 73, slope: 113 }, { at: 1, by: 'd' });
  assert.deepEqual(f.players.map(p => p.courseHc), [11, 15, 7]);
  assert.deepEqual(f.players.map(p => p.plays), [4, 8, 0]);
  assert.deepEqual(f.teeFixes, { White: { rating: [72, 73], at: 1, by: 'd' } });
  assert.equal(playsLine(r, f), 'Strokes: Dave 3 → 4');
  // A resize keeps the tee fix
  const nine = resizeRound(f, course18, 9, 'front');
  assert.equal(nine.players[0].courseHc, Math.round(11 / 2));
  // Handicaps off: strokes stay at 0
  const off = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 18, nine: 'front', players, settings: SETTINGS, hcPct: 100, useHandicaps: false });
  assert.deepEqual(fixTee(off, course18, 'White', { rating: 73 }).players.map(p => p.plays), [0, 0, 0]);
});

test('feedback notes say what changed', () => {
  const r = mk();
  const h = hole(r, 7);
  const fb = holeFixFeedback(r, course18, h, { par: 5, hdcp: 7 }, { par: 4, hdcp: 3 });
  assert.equal(fb.kind, 'course');
  assert.equal(fb.body, 'Hole 7 at Pebble Creek (White): par 5 to 4, stroke index 7 to 3');
  assert.deepEqual(fb.details, {
    fix: 'hole', courseId: 'pc', courseName: 'Pebble Creek', source: 'built in', apiId: null, tee: 'White', hole: 7, courseIdx: 6,
    old: { par: 5, hdcp: 7 }, new: { par: 4, hdcp: 3 },
  });
  const tf = teeFixFeedback(r, { ...course18, custom: true }, 'White', { rating: 72, slope: 113 }, { rating: 72, slope: 120 });
  assert.equal(tf.body, 'White tees at Pebble Creek: slope 113 to 120');
  assert.equal(tf.details.source, 'added by the user');
});

test('fixTee keeps a course handicap set by hand on an older round (no courseHcOverride stored)', () => {
  const players = [{ id: 'd', name: 'Dave Smith', index: 10, tee: 'White' }, { id: 't', name: 'Trevor N', index: 5, tee: 'White' }];
  const r = createRound({ id: 'r', game: 'skins', course: course18, holesCount: 18, nine: 'front', players, settings: SETTINGS, hcPct: 100 });
  // An older round: Dave's 14 was typed in by hand, but only the figure was kept
  r.players[0] = { ...r.players[0], courseHc: 14, courseHcOverride: null, plays: 9 };
  const f = fixTee(r, course18, 'White', { rating: 73, slope: 113 });
  assert.equal(f.players[0].courseHc, 14);
  assert.equal(f.players[1].courseHc, 6);
});

test('fixTee that moves no course handicap leaves strokes and money exactly as they were', () => {
  let r = mk();
  r.scores = { 1: { d: 4, t: 4, a: 4 }, 2: { d: 4, t: 4, a: 5 } };
  // A plus-handicap player joins late: they play off the same low, so they give strokes back
  r = addPlayerToRound(r, { id: 'p', name: 'Pat Q', courseHc: -3 }, 3);
  assert.deepEqual(r.players.map(p => p.plays), [1, 0, 0, -3]);
  r.scores[3] = { d: 3, t: 3, a: 4, p: 4 };
  const before = roundResults(r).balances;
  // Nobody is on Blue: fixing it changes no one's course handicap
  const f = fixTee(r, course18, 'Blue', { rating: 75, slope: 131 });
  assert.deepEqual(f.players, r.players);
  assert.deepEqual(roundResults(f).balances, before);
});

test('a touched score keeps its number when the hole’s par is fixed before saving', () => {
  const kept = { dirty: true, base: { d: 4, t: 4, a: 4 }, draft: { d: 4, t: 5, a: 4 }, touched: { d: true, t: true, a: false } };
  // Par fixed 4 → 5: Dave's confirmed 4 and Trevor's 5 stay; Al's untouched score starts from the new par
  assert.equal(keepsDraft(kept, 'd', {}, 5), true);
  assert.equal(keepsDraft(kept, 't', {}, 5), true);
  assert.equal(keepsDraft(kept, 'a', {}, 5), false);
  // Par unchanged: a score saved on another phone still wins over a draft left at par
  assert.equal(keepsDraft(kept, 'd', { d: 6 }, 4), false);
  assert.equal(keepsDraft(kept, 'd', {}, 4), false);
  assert.equal(keepsDraft(null, 'd', {}, 5), false);
});

test('a hole without a courseIdx only fixes itself', () => {
  const r = mk();
  r.holes = r.holes.map(({ courseIdx, ...h }) => h); // eslint-disable-line no-unused-vars
  assert.equal(playedTwice(r), false);
  const f = fixHole(r, 7, { par: 4 });
  assert.deepEqual(f.holes.filter((h, i) => h.par !== r.holes[i].par).map(h => h.no), [7]);
});

test('hole fix for next time: saved to this phone’s copy of the course, old courses unchanged', async () => {
  const { courseWithHoleFix, findCourse, allCourses } = await import('./courses.js');
  const card = { id: 'c9', name: 'Nine', city: 'Town', tees: [{ name: 'White' }], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
  // Nothing changes: nothing to save
  assert.equal(courseWithHoleFix(card, 2, { par: 4, hdcp: 3 }), null);
  assert.equal(courseWithHoleFix(card, 20, { par: 5 }), null);
  // A course saved on this phone (custom or from the database) is changed in place
  const api = { ...card, source: 'golfcourseapi', apiId: 7, savedAt: 1 };
  const fixed = courseWithHoleFix(api, 2, { par: 5, hdcp: 7 });
  assert.equal(fixed.id, 'c9');
  assert.equal(fixed.course.edited, true);
  assert.deepEqual(fixed.course.holes.map(h => [h.par, h.hdcp]), [[4, 1], [4, 2], [5, 7], [4, 4], [4, 5], [4, 6], [4, 3], [4, 8], [4, 9]], 'stroke index 7 swaps with hole 7');
  assert.deepEqual(api.holes[2], { par: 4, hdcp: 3 }, 'the old copy isn’t mutated');
  // A course that came with the app becomes a corrected copy that hides the original, found by its old id too
  const builtIn = courseWithHoleFix(card, 0, { par: 3 }, { builtIn: true });
  assert.equal(builtIn.id, 'c9-custom');
  assert.equal(builtIn.builtInId, 'c9');
  assert.equal(builtIn.course.replaces, 'c9');
  assert.equal(builtIn.course.custom, true);
  assert.equal(builtIn.course.holes[0].par, 3);
  // The app's own courses: a corrected copy of a real one is found by the old id
  const state = { customCourses: {} };
  const real = allCourses(state)[0];
  assert.equal(findCourse(state, real.id).id, real.id);
  const copy = courseWithHoleFix(real, 0, { par: real.holes[0].par === 3 ? 4 : 3 }, { builtIn: true });
  state.customCourses[copy.id] = copy.course;
  assert.equal(findCourse(state, real.id).id, copy.id);
  assert.equal(findCourse(state, copy.id).id, copy.id);
  assert.equal(allCourses(state).filter(c => c.id === real.id).length, 0);
  // Courses nobody fixed read as before
  const other = allCourses({ customCourses: {} })[1];
  assert.deepEqual(findCourse(state, other.id), other);
  assert.equal(findCourse(state, 'nope'), null);
});
