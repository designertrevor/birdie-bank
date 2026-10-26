// The par chips (par-chips.js) are input only: for the same strokes, a hole saves exactly what the old
// − / + stepper and Picked up button saved, untouched players included, and the money comes out the
// same to the cent. 2,000 seeded random rounds across every game in GAMES, each played twice (old
// stepper, new chips and pad) with edits to saved holes along the way, then settled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, bankerHoleSetup, createRound, hammerOptions, nassauPressOptions, roundResults, scorers, TEAM_GAMES, wolfFor } from './round.js';
import { TEAM_DEFAULTS } from './settings.js';
import { DOT_KINDS } from './games.js';
import { MAX_SCORE, MIN_SCORE, chipFor, holeScores, parChips, scoreAfter, startScore, tapsFor } from './par-chips.js';

// ---------------------------------------------------------------------------
// The old input, copied from HoleScores.jsx before the par chips (2026-10-26): the oracle

const OLD = {
  minus: (v, par) => (v === 'X' ? par : Math.max(1, v - 1)),
  plus: (v, par) => (v === 'X' ? par + 1 : Math.min(15, v + 1)),
  pickup: (v, par) => (v === 'X' ? par : 'X'),
};

/** The old taps from `v` to `target`: Picked up for a pickup, else − or + until it reads right. */
function oldTaps(v, target) {
  if (target === 'X') return v === 'X' ? [] : ['pickup'];
  const taps = [];
  let at = v;
  if (at === 'X') { taps.push('minus'); at = null; } // a pickup steps back to par first
  return { taps, from: at, target };
}

/**
 * One hole's entry as useHoleDraft keeps it: the draft and who's been touched. `set` is setScore
 * (every input marks the box touched, as the hook does).
 */
function entry(units, saved, par) {
  const draft = Object.fromEntries(units.map(u => [u.id, startScore(saved, u.id, par)]));
  const touched = Object.fromEntries(units.map(u => [u.id, saved?.[u.id] != null]));
  return { draft, touched, set(pid, v) { this.draft[pid] = v; this.touched[pid] = true; } };
}

/** Put `target` in a box the old way. */
function enterOld(e, pid, target, par) {
  const plan = oldTaps(e.draft[pid], target);
  if (Array.isArray(plan)) { for (const t of plan) e.set(pid, OLD[t](e.draft[pid], par)); return; }
  for (const t of plan.taps) e.set(pid, OLD[t](e.draft[pid], par));
  while (e.draft[pid] !== target) e.set(pid, OLD[e.draft[pid] > target ? 'minus' : 'plus'](e.draft[pid], par));
}

/**
 * Put `target` in a box the new way. `how`: 'fewest' (a chip, else the pad), 'step' (the nearest
 * chip, then the pad's − / + the rest of the way), or 'pad' (straight to the pad).
 */
function enterNew(e, pid, target, par, how = 'fewest') {
  // Already showing it: the golfer leaves it, as with the stepper (tapping Par anyway saves the same, see below)
  if (e.draft[pid] === target) return;
  if (how === 'pad' || target === 'X') { e.set(pid, scoreAfter(e.draft[pid], { pad: target }, par)); return; }
  if (how === 'step') {
    const chips = parChips(par);
    const near = chips.reduce((a, c) => (Math.abs(c.value - target) < Math.abs(a.value - target) ? c : a));
    e.set(pid, scoreAfter(e.draft[pid], { chip: near.key }, par));
    while (e.draft[pid] !== target) e.set(pid, scoreAfter(e.draft[pid], { step: e.draft[pid] > target ? -1 : 1 }, par));
    return;
  }
  for (const input of tapsFor(target, par)) e.set(pid, scoreAfter(e.draft[pid], input, par));
}

// ---------------------------------------------------------------------------
// Rounds (the lineups and settings money.test.js plays)

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const cents = v => Math.round(v * 100);

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 10, pressMode: 'auto', threshold: 2 },
  skins: { value: 1.5, carryover: true },
  wolf: { point: 2.5, loneMultiplier: 3 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'per' },
  stableford: { stake: 0.5, payout: 'per', modified: true },
  quota: { stake: 1, payout: 'per' },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { stake: 5, tiesFree: true },
  hammer: { stake: 2.5, max: 0, who: 'trailing' },
  snake: { stake: 1.5, growth: 'grow', nines: true },
  ...TEAM_DEFAULTS,
};
const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 5, 3, 4, 4];
const HDCPS = [7, 3, 17, 1, 11, 5, 15, 9, 13, 8, 2, 18, 4, 12, 6, 16, 10, 14];
const COURSE = {
  id: 'c18', name: 'Pine Hills', city: 'Town',
  tees: [{ name: 'Blue', color: '#00f', rating: 71.8, slope: 131 }, { name: 'White', color: '#fff', rating: 69.4, slope: 124 }],
  holes: PARS.map((par, i) => ({ par, hdcp: HDCPS[i] })),
};
const PEOPLE = [
  { id: 'a', name: 'Ann Lee', index: 12.4, tee: 'White' },
  { id: 'b', name: 'Bo Diaz', index: 3.1, tee: 'Blue' },
  { id: 'c', name: 'Cy Park', index: 18.0, tee: 'White' },
  { id: 'd', name: 'Di Moss', index: 7.5, tee: 'Blue' },
  { id: 'e', name: 'Ed Ford', index: 24.2, tee: 'White' },
  { id: 'f', name: 'Flo Tan', index: 0.0, tee: 'Blue' },
];
const LINEUPS = {
  banker: { n: 5 }, nassau: { n: 4, teams: [['a', 'b'], ['c', 'd']] }, skins: { n: 6 }, wolf: { n: 4 },
  match: { n: 4, teams: [['a', 'b'], ['c', 'd']] }, vegas: { n: 4, teams: [['a', 'b'], ['c', 'd']] }, sixes: { n: 4 },
  scramble: { n: 6, teams: [['a', 'b', 'c'], ['d', 'e', 'f']] }, stroke: { n: 5 }, stableford: { n: 5 }, quota: { n: 4 },
  nines: { n: 3 }, aces: { n: 4 }, bbb: { n: 4 }, dots: { n: 4 }, rabbit: { n: 5 },
  hammer: { n: 4, teams: [['a', 'b'], ['c', 'd']] }, snake: { n: 4 },
  bestball: { n: 6, teams: [['a', 'b', 'c'], ['d', 'e', 'f']] }, shamble: { n: 4, teams: [['a', 'b'], ['c', 'd']] },
  altshot: { n: 4, teams: [['a', 'b'], ['c', 'd']] }, chapman: { n: 4, teams: [['a', 'b'], ['c', 'd']] },
};

function newRound(game, rand) {
  const line = LINEUPS[game] || { n: 4 };
  return createRound({
    id: 'r', game, course: COURSE, holesCount: rand() < 0.5 ? 9 : 18, nine: rand() < 0.5 ? 'front' : 'back',
    players: PEOPLE.slice(0, line.n), settings: SETTINGS, hcPct: 100, useHandicaps: rand() < 0.6,
    teams: GAMES[game].teams ? line.teams ?? null : null,
  });
}

/** The hole's extras besides scores (banker bets, the wolf's pick, marks), the same on both rounds. */
function extras(round, idx, rand) {
  const hole = round.holes[idx];
  const ids = round.players.map(p => p.id);
  const out = {};
  if (round.game === 'banker') {
    const setup = structuredClone(bankerHoleSetup(round, idx));
    for (const pid of Object.keys(setup.bets)) { setup.bets[pid] = pick(rand, [1, 2, 5, 10]); if (rand() < 0.25) setup.doubled[pid] = true; }
    out.banker = setup;
  }
  if (round.game === 'wolf') {
    const wolf = wolfFor(round, idx);
    out.wolf = { wolf, partner: rand() < 0.3 ? null : pick(rand, ids.filter(id => id !== wolf)) };
  }
  if (round.game === 'bbb') { const who = () => (rand() < 0.1 ? null : pick(rand, ids)); out.marks = { bingo: who(), bango: who(), bongo: who() }; }
  if (round.game === 'dots') {
    const m = {};
    for (const pid of ids) { const kinds = Object.keys(DOT_KINDS).filter(() => rand() < 0.12); if (kinds.length) m[pid] = kinds; }
    out.marks = m;
  }
  if (round.game === 'snake') out.marks = { snake: ids.filter(() => rand() < 0.15) };
  if (round.game === 'hammer') {
    const mark = { hammers: [], conceded: null };
    for (let k = 0; k < 3 && rand() < 0.4; k++) {
      const can = hammerOptions(round, hole, mark);
      const side = can[0] && can[1] ? (rand() < 0.5 ? 0 : 1) : can.indexOf(true);
      if (side < 0) break;
      mark.hammers.push(side);
    }
    out.marks = mark;
  }
  return out;
}

/** A golfer's strokes: mostly pars and bogeys, some birdies and doubles, the odd ace, blow-up or pickup. */
function strokes(rand, par) {
  const r = rand();
  if (r < 0.05) return 'X';
  if (r < 0.065) return 1; // a hole in one, on any par
  if (r < 0.09) return Math.min(MAX_SCORE, par + 3 + Math.floor(rand() * 8)); // a big number, off the chips
  if (r < 0.11) return par - 2;
  return par + pick(rand, [-1, 0, 0, 0, 1, 1, 1, 2, 2]);
}

/** Save a hole into a round as useHoleSave does (scores, then the extras, then auto presses). */
function save(round, hole, scores, ex) {
  round.scores[hole.no] = scores;
  if (ex.banker) round.banker[hole.no] = ex.banker;
  if (ex.wolf) round.wolf[hole.no] = ex.wolf;
  if (ex.marks) round.marks[hole.no] = ex.marks;
}

/** Balances sum to zero in whole cents and the transfers settle everyone exactly. */
function checkMoney(res, ids, label) {
  for (const [id, v] of Object.entries(res.balances)) assert.ok(Math.abs(v * 100 - cents(v)) < 1e-6, `${label}: ${id} ${v} is whole cents`);
  assert.equal(Object.values(res.balances).reduce((a, v) => a + cents(v), 0), 0, `${label}: sums to zero`);
  const left = Object.fromEntries(ids.map(id => [id, cents(res.balances[id] || 0)]));
  for (const t of res.transfers) { left[t.from] += cents(t.amount); left[t.to] -= cents(t.amount); }
  for (const [id, v] of Object.entries(left)) assert.equal(v, 0, `${label}: ${id} square after settling`);
}

// ---------------------------------------------------------------------------

test('the chips: two under to two over, an Ace on a par 3, nothing under one', () => {
  assert.deepEqual(parChips(4).map(c => [c.key, c.value]), [['eagle', 2], ['birdie', 3], ['par', 4], ['bogey', 5], ['double', 6]]);
  assert.equal(parChips(3)[0].label, 'Ace');
  assert.equal(parChips(3)[0].value, 1);
  assert.deepEqual(parChips(2).map(c => c.value), [1, 2, 3, 4]);
  assert.equal(chipFor(4, 4), 'par');
  assert.equal(chipFor(7, 4), null, 'a triple is on the pad');
  assert.equal(chipFor('X', 4), null, 'a pickup is on the pad');
  assert.equal(chipFor(1, 5), null, 'a hole in one on a par 5 is on the pad');
});

test('the pad keeps a score between 1 and 15, and − / + behave as the old stepper', () => {
  assert.equal(scoreAfter(4, { pad: 0 }, 4), MIN_SCORE);
  assert.equal(scoreAfter(4, { pad: 22 }, 4), MAX_SCORE);
  assert.equal(scoreAfter(4, { pad: 'X' }, 4), 'X');
  for (const par of [3, 4, 5]) {
    for (const v of ['X', 1, 2, par, 14, 15]) {
      assert.equal(scoreAfter(v, { step: -1 }, par), OLD.minus(v, par), `− from ${v} on a par ${par}`);
      assert.equal(scoreAfter(v, { step: 1 }, par), OLD.plus(v, par), `+ from ${v} on a par ${par}`);
      assert.equal(scoreAfter(v, { pickup: true }, par), OLD.pickup(v, par), `Picked up from ${v} on a par ${par}`);
    }
  }
});

test('untouched players save at par, the same as before, and stay untouched', () => {
  const units = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const old = entry(units, {}, 4);
  const now = entry(units, {}, 4);
  enterOld(old, 'b', 3, 4);
  enterNew(now, 'b', 3, 4);
  assert.deepEqual(holeScores(units, now.draft), holeScores(units, old.draft));
  assert.deepEqual(holeScores(units, now.draft), { a: 4, b: 3, c: 4 });
  assert.deepEqual(now.touched, { a: false, b: true, c: false });
  assert.deepEqual(now.touched, old.touched);
  // Tapping Par on an untouched box confirms it: it saves the same par
  enterNew(now, 'a', 4, 4, 'step');
  now.set('a', scoreAfter(now.draft.a, { chip: 'par' }, 4));
  assert.deepEqual(holeScores(units, now.draft), holeScores(units, old.draft));
});

test('a hole in one through the pad saves a 1, as eleven − taps did', () => {
  const units = [{ id: 'a' }];
  for (const par of [3, 4, 5]) {
    const old = entry(units, {}, par);
    const now = entry(units, {}, par);
    enterOld(old, 'a', 1, par);
    enterNew(now, 'a', 1, par, 'pad');
    assert.deepEqual(holeScores(units, now.draft), { a: 1 });
    assert.deepEqual(holeScores(units, now.draft), holeScores(units, old.draft));
  }
});

test('editing a saved hole starts from the saved scores and saves the same as before', () => {
  const units = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const saved = { a: 5, b: 'X', c: 3 };
  const old = entry(units, saved, 4);
  const now = entry(units, saved, 4);
  assert.deepEqual(now.draft, saved, 'the saved scores show');
  enterOld(old, 'b', 6, 4); enterOld(old, 'c', 'X', 4);
  enterNew(now, 'b', 6, 4); enterNew(now, 'c', 'X', 4);
  assert.deepEqual(holeScores(units, now.draft), { a: 5, b: 6, c: 'X' });
  assert.deepEqual(holeScores(units, now.draft), holeScores(units, old.draft));
});

test('2,000 random rounds across every game: chips save what the stepper saved, and the money sums to zero', () => {
  const games = Object.keys(GAMES);
  let edits = 0, aces = 0, pickups = 0, untouched = 0, moved = 0;
  for (let n = 0; n < 2000; n++) {
    const rand = rng(9000 + n);
    const game = games[n % games.length];
    const label = `${game} round ${n}`;
    const oldRound = newRound(game, rand);
    const newRoundCopy = structuredClone(oldRound);
    const holes = oldRound.holes;
    const ways = ['fewest', 'fewest', 'step', 'pad'];
    const playHole = idx => {
      const hole = oldRound.holes[idx];
      const units = scorers(oldRound, hole);
      const ex = extras(oldRound, idx, rand);
      const was = oldRound.scores[hole.no];
      const old = entry(units, was, hole.par);
      const now = entry(units, newRoundCopy.scores[hole.no], hole.par);
      for (const u of units) {
        // Some boxes are left alone (at par on a fresh hole, or as saved on an edit)
        if (rand() < (was ? 0.6 : 0.3)) { untouched++; continue; }
        const target = strokes(rand, hole.par);
        if (target === 1) aces++;
        if (target === 'X') pickups++;
        enterOld(old, u.id, target, hole.par);
        enterNew(now, u.id, target, hole.par, pick(rand, ways));
      }
      const before = holeScores(units, old.draft);
      const after = holeScores(units, now.draft);
      assert.deepEqual(after, before, `${label} hole ${hole.no}: the chips save what the stepper saved`);
      assert.deepEqual(now.touched, old.touched, `${label} hole ${hole.no}: the same boxes count as touched`);
      save(oldRound, hole, before, ex);
      save(newRoundCopy, hole, after, structuredClone(ex));
    };
    for (let idx = 0; idx < holes.length; idx++) {
      playHole(idx);
      // Now and then, back to an earlier hole to fix a score (the extras are entered again too)
      if (idx > 1 && rand() < 0.12) { edits++; playHole(Math.floor(rand() * idx)); }
      const next = idx + 2;
      if ((game === 'nassau' || game === 'match' || TEAM_GAMES.includes(game)) && next <= holes.length) {
        for (const r of [oldRound, newRoundCopy]) for (const o of nassauPressOptions(r, next)) r.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
      }
    }
    assert.deepEqual(newRoundCopy.scores, oldRound.scores, `${label}: every hole saved the same`);
    const a = roundResults(oldRound);
    const b = roundResults(newRoundCopy);
    assert.deepEqual(b.balances, a.balances, `${label}: the same money`);
    assert.deepEqual(b.transfers, a.transfers, `${label}: the same payments`);
    checkMoney(b, oldRound.players.map(p => p.id), label);
    if (b.transfers.length) moved++;
  }
  // The fixtures are only worth something if they cover the cases
  assert.ok(edits > 500, `edits to saved holes: ${edits}`);
  assert.ok(aces > 200, `holes in one: ${aces}`);
  assert.ok(pickups > 500, `pickups: ${pickups}`);
  assert.ok(untouched > 5000, `untouched boxes: ${untouched}`);
  assert.ok(moved > 1500, `rounds where money moved: ${moved}`);
});
