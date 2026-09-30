// House rules added 2026-09-30, one to three per game that didn't have them: Wolf ties carry, Vegas
// birdies double, Sixes halved matches carry, Scramble minimum drives, Stroke play's net double bogey
// cap, Nines sweep, Aces & Deuces ties carry, Bingo Bango Bongo sweep doubles. Every one starts off,
// so each game is checked three ways: a round saved before the rule (no key), the rule off, and on.
// Hand-worked cases on a flat nine (par 4s, handicaps off), so every number checks on a napkin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, wolfHoleResult, wolfCarryBefore, changeBets } from './round.js';
import { vegasHole, ninesPoints } from './games.js';
import { readFileSync } from 'node:fs';
import { scrambleDrives, drivesNeeded } from './scramble-drives.js';
import { stakeSummary } from './stakes.js';
import { houseRulesLine } from './house-rules.js';

// The game defaults as a new round gets them (store.js can't load outside the browser)
const DEFAULT_SETTINGS_FOR_TESTS = {
  hcPct: 100,
  wolf: { point: 2, loneMultiplier: 2, blind: true, blindMultiplier: 3 },
  vegas: { point: 1, birdieFlip: true, birdieDouble: false },
  sixes: { stake: 5, mode: 'match', carry: false },
  scramble: { stake: 5, drives: 0 },
  stroke: { stake: 5, payout: 'pot', cap: false },
  nines: { point: 1, sweep: false },
  aces: { ace: 2, deuce: 1, carry: false },
  bbb: { value: 1, sweep: false },
};
const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { a: 'Ann', b: 'Bo', c: 'Cy', d: 'Di', e: 'Ed', f: 'Flo' };
function mk(game, ids, { set = {}, teams = null } = {}) {
  const settings = structuredClone(DEFAULT_SETTINGS_FOR_TESTS);
  settings[game] = { ...settings[game], ...set };
  const players = ids.map(id => ({ id, name: NAMES[id], index: 0 }));
  return createRound({ id: 'r', game, course, holesCount: 9, players, settings, hcPct: 100, useHandicaps: false, teams });
}
/** Par for everyone on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  const units = r.game === 'scramble' ? r.teams : r.players;
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(units.map(p => [p.id, 4])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
const zero = b => Math.round(Object.values(b).reduce((x, v) => x + v * 100, 0));
/** The same round three ways: saved before the rule existed, rule off, rule on. */
function threeWays(game, ids, key, on, build, opts = {}) {
  const before = build(mk(game, ids, opts));
  delete before.settings[game][key];
  const off = build(mk(game, ids, { ...opts, set: { ...opts.set, [key]: DEFAULT_SETTINGS_FOR_TESTS[game][key] } }));
  const yes = build(mk(game, ids, { ...opts, set: { ...opts.set, [key]: on } }));
  return { before: bal(before), off: bal(off), on: bal(yes) };
}

test('every new house rule starts off in the app defaults', () => {
  const src = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
  const line = game => src.split('\n').find(l => l.trim().startsWith(`${game}: {`));
  // Wolf leaves `carry` unset, which reads as off
  assert.doesNotMatch(line('wolf'), /carry: true/);
  assert.match(line('vegas'), /birdieDouble: false/);
  assert.match(line('sixes'), /carry: false/);
  assert.match(line('scramble'), /drives: 0/);
  assert.match(line('stroke'), /cap: false/);
  assert.match(line('nines'), /sweep: false/);
  assert.match(line('aces'), /carry: false/);
  assert.match(line('bbb'), /sweep: false/);
  for (const [game, gs] of Object.entries(DEFAULT_SETTINGS_FOR_TESTS)) if (game !== 'hcPct') assert.equal(houseRulesLine(game, gs), '');
});

// ---------------------------------------------------------------------------
// Wolf: ties carry

test('wolf ties carry: two tied holes make the next win worth 3×', () => {
  const build = r => {
    scores(r, 3, { 3: { a: 3 } });
    // Holes 1 and 2 tie (everyone pars); on 3 Ann (wolf) and Bo beat Cy and Di
    r.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'b', partner: 'c' }, 3: { wolf: 'a', partner: 'b' } };
    return r;
  };
  const w = threeWays('wolf', ['a', 'b', 'c', 'd'], 'carry', true, build);
  // $2 a point, 2 v 2: each winner gets 2 points ($4). With two ties carried: $12
  assert.deepEqual(w.before, { a: 4, b: 4, c: -4, d: -4 });
  assert.deepEqual(w.off, w.before);
  assert.deepEqual(w.on, { a: 12, b: 12, c: -12, d: -12 });
  assert.equal(zero(w.on), 0);
});

test('wolf ties carry: a lone wolf win takes the carry on its own bigger unit, then it resets', () => {
  const r = scores(mk('wolf', ['a', 'b', 'c', 'd'], { set: { carry: true } }), 3, { 2: { c: 3 }, 3: { d: 3 } });
  r.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'c', partner: null }, 3: { wolf: 'd', partner: 'a' } };
  // Hole 1 ties. Hole 2: Cy lone (2×, $4 a point) wins, doubled by the carry: $8 from each, +24.
  // Hole 3: nothing carried, Di and Ann win $2 from each of Bo and Cy.
  assert.equal(wolfCarryBefore(r, r.holes[1]), 1);
  assert.equal(wolfCarryBefore(r, r.holes[2]), 0);
  assert.equal(wolfHoleResult(r, r.holes[1]).carried, 1);
  assert.equal(wolfHoleResult(r, r.holes[0]).carries, true);
  assert.deepEqual(bal(r), { a: -8 + 4, b: -8 - 4, c: 24 - 4, d: -8 + 4 });
  assert.equal(zero(bal(r)), 0);
});

test('wolf ties carry: ties left after the last hole go unclaimed', () => {
  const r = scores(mk('wolf', ['a', 'b', 'c', 'd'], { set: { carry: true } }), 9);
  r.wolf = Object.fromEntries(r.holes.map((h, i) => [h.no, { wolf: ['a', 'b', 'c', 'd'][i % 4], partner: null }]));
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
});

// ---------------------------------------------------------------------------
// Vegas: birdies double

test('vegasHole: a lone birdie doubles the hole, a lone eagle triples it, both birdie no change', () => {
  // A: 3 and 4 (a natural birdie) make 34; B's 4 and 5 flip to 54. 20 points, doubled
  assert.deepEqual(vegasHole([[3, 4], [4, 5]], [[3, 4], [4, 5]], 4, { birdieDouble: true }), { numbers: [34, 54], diff: 40, flipped: [false, true], mult: 2 });
  assert.equal(vegasHole([[3, 4], [4, 5]], [[3, 4], [4, 5]], 4).diff, 20);
  assert.equal(vegasHole([[2, 4], [4, 5]], [[2, 4], [4, 5]], 4, { birdieDouble: true }).mult, 3);
  assert.equal(vegasHole([[3, 4], [3, 5]], [[3, 4], [3, 5]], 4, { birdieDouble: true }).mult, 1);
  // Flip off, the double still works on its own
  assert.equal(vegasHole([[3, 4], [4, 5]], [[3, 4], [4, 5]], 4, { birdieFlip: false, birdieDouble: true }).diff, 22);
});

test('vegas birdies double: money three ways', () => {
  const build = r => scores(r, 2, { 1: { a: 3, d: 5 } });
  const v = threeWays('vegas', ['a', 'b', 'c', 'd'], 'birdieDouble', true, build, { teams: [['a', 'b'], ['c', 'd']] });
  // Hole 1: 34 against a flipped 54, 20 points at $1; hole 2: 44 v 44
  assert.deepEqual(v.before, { a: 20, b: 20, c: -20, d: -20 });
  assert.deepEqual(v.off, v.before);
  assert.deepEqual(v.on, { a: 40, b: 40, c: -40, d: -40 });
});

// ---------------------------------------------------------------------------
// Sixes: halved matches carry

test('sixes halved matches carry: a halved first match adds its bet to the second', () => {
  // Over nine: matches on 1-3 (a,b v c,d), 4-6 (a,c v b,d), 7-9 (a,d v b,c)
  const build = r => scores(r, 9, { 4: { a: 3 } });
  const s = threeWays('sixes', ['a', 'b', 'c', 'd'], 'carry', true, build);
  // Match 1 halved; match 2 Ann & Cy win $5 each; match 3 halved
  assert.deepEqual(s.before, { a: 5, b: -5, c: 5, d: -5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 10, b: -10, c: 10, d: -10 });
  assert.equal(zero(s.on), 0);
});

test('sixes halved matches carry: a halved last match goes unclaimed, and per hole ignores it', () => {
  const r = scores(mk('sixes', ['a', 'b', 'c', 'd'], { set: { carry: true } }), 9);
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
  const holes = scores(mk('sixes', ['a', 'b', 'c', 'd'], { set: { carry: true, mode: 'holes' } }), 9, { 4: { a: 3 } });
  assert.deepEqual(bal(holes), { a: 5, b: -5, c: 5, d: -5 });
});

test('sixes carry: a match in progress plays for the carry too', () => {
  const r = scores(mk('sixes', ['a', 'b', 'c', 'd'], { set: { carry: true } }), 4, { 4: { b: 3 } });
  const m = roundResults(r).detail.matches[1];
  assert.equal(m.carried, 5);
  assert.deepEqual(bal(r), { a: -10, b: 10, c: -10, d: 10 });
});

// ---------------------------------------------------------------------------
// Stroke play: net double bogey cap

test('stroke play net double bogey cap: a 9 on a par 4 counts as a 6', () => {
  const build = r => scores(r, 2, { 1: { a: 9 } });
  const pot = threeWays('stroke', ['a', 'b', 'c'], 'cap', true, build, { set: { payout: 'per', stake: 1 } });
  // Per stroke at $1: Ann is 5 worse than each of the other two, or 2 worse with the cap
  assert.deepEqual(pot.before, { a: -10, b: 5, c: 5 });
  assert.deepEqual(pot.off, pot.before);
  assert.deepEqual(pot.on, { a: -4, b: 2, c: 2 });
});

test('stroke play cap uses net: a player getting a stroke can post 7 before it bites', () => {
  const settings = structuredClone(DEFAULT_SETTINGS_FOR_TESTS);
  settings.stroke = { stake: 1, payout: 'per', cap: true };
  const players = [{ id: 'a', name: 'Ann', index: 0, courseHcOverride: 9 }, { id: 'b', name: 'Bo', index: 0, courseHcOverride: 0 }];
  const r = createRound({ id: 'r', game: 'stroke', course, holesCount: 9, players, settings, hcPct: 100, useHandicaps: true });
  // Ann gets a stroke on every hole. A gross 8 is net 7, capped at net 6; Bo's net 4
  r.scores[1] = { a: 8, b: 4 };
  assert.deepEqual(bal(r), { a: -2, b: 2 });
});

// ---------------------------------------------------------------------------
// Nines: sweep

test('ninesPoints sweep: win by two or more and take all nine', () => {
  assert.deepEqual(ninesPoints([3, 5, 6], { sweep: true }), [9, 0, 0]);
  assert.deepEqual(ninesPoints([3, 5, 5], { sweep: true }), [9, 0, 0]);
  assert.deepEqual(ninesPoints([3, 4, 6], { sweep: true }), [5, 3, 1]);
  assert.deepEqual(ninesPoints([3, 3, 6], { sweep: true }), [4, 4, 1]);
  assert.deepEqual(ninesPoints([3, 5, 6]), [5, 3, 1]);
});

test('nines sweep: money three ways', () => {
  const build = r => scores(r, 1, { 1: { a: 2, b: 4, c: 5 } });
  const n = threeWays('nines', ['a', 'b', 'c'], 'sweep', true, build);
  // 5-3-1 against an average of 3: +2, 0, -2. Swept 9-0-0: +6, -3, -3
  assert.deepEqual(n.before, { a: 2, b: 0, c: -2 });
  assert.deepEqual(n.off, n.before);
  assert.deepEqual(n.on, { a: 6, b: -3, c: -3 });
});

// ---------------------------------------------------------------------------
// Aces & Deuces: ties carry

test('aces ties carry: a tied hole adds its ace and deuce to the next outright ones', () => {
  // Hole 1 all par (no ace, no deuce). Hole 2: Ann low, Di high
  const build = r => scores(r, 2, { 2: { a: 3, d: 5 } });
  const x = threeWays('aces', ['a', 'b', 'c', 'd'], 'carry', true, build);
  // Ace $2 from each (+6), deuce $1 to each (-3). Carried: ace $4 (+12), deuce $2 (-6)
  assert.deepEqual(x.before, { a: 6 + 1, b: -2 + 1, c: -2 + 1, d: -2 - 3 });
  assert.deepEqual(x.off, x.before);
  assert.deepEqual(x.on, { a: 12 + 2, b: -4 + 2, c: -4 + 2, d: -4 - 6 });
  assert.equal(zero(x.on), 0);
});

test('aces ties carry: ace and deuce carry on their own, and the head-to-head matches', () => {
  // Hole 1: Ann low alone, a tie for high (no deuce). Hole 2: Bo high alone, tie for low
  const r = scores(mk('aces', ['a', 'b', 'c', 'd'], { set: { carry: true } }), 2, { 1: { a: 3 }, 2: { b: 5 } });
  const res = roundResults(r);
  // Hole 1: Ann +6, others -2. Hole 2: Bo pays a $2 deuce (his own $1 and the $1 carried) to each
  assert.deepEqual(res.balances, { a: 6 + 2, b: -2 - 6, c: -2 + 2, d: -2 + 2 });
  assert.equal(res.pairs.b.a, -2 - 2);
  assert.equal(res.detail.holes[1].deuceCarried, 1);
});

// ---------------------------------------------------------------------------
// Bingo Bango Bongo: sweep doubles

test('bbb sweep: all three to one player counts six', () => {
  const build = r => { r.marks = { 1: { bingo: 'a', bango: 'a', bongo: 'a' }, 2: { bingo: 'b', bango: 'b', bongo: 'c' } }; return r; };
  const b = threeWays('bbb', ['a', 'b', 'c'], 'sweep', true, build);
  // Points: Ann 3, Bo 2, Cy 1 (pairs at $1: +3, 0, -3). Swept: Ann 6: +9, -3, -6
  assert.deepEqual(b.before, { a: 3, b: 0, c: -3 });
  assert.deepEqual(b.off, b.before);
  assert.deepEqual(b.on, { a: 9, b: -3, c: -6 });
});

// ---------------------------------------------------------------------------
// Scramble: minimum drives (no money)

test('scramble drives: off by default and never moves money', () => {
  const r = scores(mk('scramble', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] }), 9);
  assert.equal(drivesNeeded(r), 0);
  assert.deepEqual(scrambleDrives(r), []);
  const on = scores(mk('scramble', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], set: { drives: 3 } }), 9);
  assert.deepEqual(bal(on), bal(r));
});

test('scramble drives: counts per player, and says when the team has no choice left', () => {
  const r = mk('scramble', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], set: { drives: 3 } });
  const [t0] = r.teams;
  // Ann's drive on holes 1-6: Bo owes 3 with 3 holes left
  for (let no = 1; no <= 6; no++) r.marks[no] = { drives: { [t0.id]: 'a' } };
  const [A, B] = scrambleDrives(r);
  assert.equal(A.left, 3);
  assert.deepEqual(A.players.map(p => [p.drives, p.short]), [[6, 0], [0, 3]]);
  assert.equal(A.tight, true);
  assert.equal(B.left, 9);
  assert.equal(B.tight, false);
});

// ---------------------------------------------------------------------------
// Summaries and a mid-round change

test('the bet line mentions a house rule only when it is on', () => {
  const d = DEFAULT_SETTINGS_FOR_TESTS;
  assert.equal(stakeSummary('vegas', d), '$1 a point');
  assert.equal(stakeSummary('vegas', { ...d, vegas: { ...d.vegas, birdieDouble: true } }), '$1 a point · birdies double');
  assert.equal(houseRulesLine('vegas', d.vegas), '');
  assert.equal(houseRulesLine('vegas', { ...d.vegas, birdieDouble: true }), 'birdies double');
  assert.equal(houseRulesLine('scramble', { ...d.scramble, drives: 3 }), '3 drives each');
  assert.equal(houseRulesLine('wolf', { ...d.wolf, carry: true }), 'ties carry');
});

test('turning ties carry on from hole 3 leaves holes 1 and 2 as they were played', () => {
  const r0 = scores(mk('wolf', ['a', 'b', 'c', 'd']), 3, { 3: { a: 3 } });
  r0.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'b', partner: 'c' }, 3: { wolf: 'a', partner: 'b' } };
  const r = changeBets(r0, { ...r0.settings.wolf, carry: true }, 3);
  // The ties on 1 and 2 were played without the carry, so hole 3 pays its plain $4
  assert.deepEqual(bal(r), { a: 4, b: 4, c: -4, d: -4 });
});
