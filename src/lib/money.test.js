// Money math for every game: zero-sum balances, exact settle-ups, the live money bar and edge cases.
// Each game gets a hand-worked scenario (the working is in the comments) plus seeded "realistic"
// rounds, 9 and 18 holes, with handicaps, pickups, presses, bets and marks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES, createRound, roundResults, livePreview, bankerHoleSetup, wolfFor, scorers, nassauPressOptions, strokesFor,
} from './round.js';
import { pickupGross } from './golf.js';
import { DOT_KINDS } from './games.js';
import { holeMoneyLine } from './format.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'off', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'pot' },
  stableford: { stake: 1, payout: 'per', modified: false },
  quota: { stake: 1, payout: 'per' },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { stake: 5, tiesFree: true },
};

// A realistic 18: pars 4-4-3-5-4-4-3-4-5 each nine, card handicaps spread across the nines
const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 5, 3, 4, 4];
const HDCPS = [7, 3, 17, 1, 11, 5, 15, 9, 13, 8, 2, 18, 4, 12, 6, 16, 10, 14];
const course18 = {
  id: 'c18', name: 'Pine Hills', city: 'Town',
  tees: [{ name: 'Blue', color: '#00f', rating: 71.8, slope: 131 }, { name: 'White', color: '#fff', rating: 69.4, slope: 124 }],
  holes: PARS.map((par, i) => ({ par, hdcp: HDCPS[i] })),
};
// A flat nine of par 4s for the hand-worked cases: no handicaps, easy to add up
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };

const PEOPLE = [
  { id: 'a', name: 'Ann Lee', index: 12.4, tee: 'White' },
  { id: 'b', name: 'Bo Diaz', index: 3.1, tee: 'Blue' },
  { id: 'c', name: 'Cy Park', index: 18.0, tee: 'White' },
  { id: 'd', name: 'Di Moss', index: 7.5, tee: 'Blue' },
  { id: 'e', name: 'Ed Ford', index: 24.2, tee: 'White' },
  { id: 'f', name: 'Flo Tan', index: 0.0, tee: 'Blue' },
  { id: 'g', name: 'Gus Kim', index: 15.3, tee: 'White' },
  { id: 'h', name: 'Hal Roe', index: -1.2, tee: 'Blue' }, // plus handicap: gives strokes back
];

// ---------------------------------------------------------------------------
// Helpers

/** Small seeded random numbers so every "realistic" round is the same on every run. */
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
const clone = x => structuredClone(x);

/** Players and teams a game is usually played with. */
const LINEUPS = {
  banker: { n: 5 },
  nassau: { n: 4, teams: [['a', 'b'], ['c', 'd']] },
  skins: { n: 6 },
  wolf: { n: 4 },
  match: { n: 4, teams: [['a', 'b'], ['c', 'd']] },
  vegas: { n: 4, teams: [['a', 'b'], ['c', 'd']] },
  sixes: { n: 4 },
  scramble: { n: 6, teams: [['a', 'b', 'c'], ['d', 'e', 'f']] },
  stroke: { n: 5 },
  stableford: { n: 5 },
  quota: { n: 4 },
  nines: { n: 3 },
  aces: { n: 4 },
  bbb: { n: 4 },
  dots: { n: 4 },
  rabbit: { n: 5 },
};

/** Settings with presses on and odd stakes, so the random rounds exercise presses and cents. */
const BUSY = {
  ...SETTINGS,
  nassau: { front: 5, back: 5, total: 10, pressMode: 'auto', threshold: 2 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  skins: { value: 1.5, carryover: true },
  wolf: { point: 2.5, loneMultiplier: 3 },
  stroke: { stake: 5, payout: 'per' },
  stableford: { stake: 0.5, payout: 'per', modified: true },
};

function newRound(game, { holesCount = 18, nine = 'front', n, teams, players, settings = SETTINGS, useHandicaps = true, course = course18, startHole = null } = {}) {
  const line = LINEUPS[game];
  const who = players || PEOPLE.slice(0, n ?? line.n);
  const sides = teams !== undefined ? teams : line.teams ?? null;
  return createRound({
    id: 'r', game, course, holesCount, nine, startHole, players: who, settings, hcPct: settings.hcPct,
    useHandicaps, teams: GAMES[game].teams ? sides : null,
  });
}

/** Everything the scorekeeper enters on one hole besides scores: banker bets, wolf pick, marks. */
function holeExtras(round, idx, rand) {
  const hole = round.holes[idx];
  const ids = round.players.map(p => p.id);
  if (round.game === 'banker') {
    const setup = clone(bankerHoleSetup(round, idx));
    for (const pid of Object.keys(setup.bets)) {
      setup.bets[pid] = pick(rand, [1, 2, 5, 5, 10, 20]);
      if (rand() < 0.25) setup.doubled[pid] = true;
    }
    setup.doubleBack = Object.values(setup.doubled).some(Boolean) && rand() < 0.4;
    round.banker[hole.no] = setup;
  }
  if (round.game === 'wolf') {
    const wolf = wolfFor(round, idx);
    round.wolf[hole.no] = { wolf, partner: rand() < 0.3 ? null : pick(rand, ids.filter(id => id !== wolf)) };
  }
  if (round.game === 'bbb') {
    const who = () => (rand() < 0.1 ? null : pick(rand, ids));
    round.marks[hole.no] = { bingo: who(), bango: who(), bongo: who() };
  }
  if (round.game === 'dots') {
    const m = {};
    for (const pid of ids) {
      const kinds = Object.keys(DOT_KINDS).filter(() => rand() < 0.12);
      if (kinds.length) m[pid] = kinds;
    }
    round.marks[hole.no] = m;
  }
}

/** A believable gross score: mostly pars and bogeys, some birdies and doubles, the odd pickup. */
function grossScore(rand, par) {
  const r = rand();
  if (r < 0.06) return 'X';
  if (r < 0.08) return par - 2;
  return par + pick(rand, [-1, 0, 0, 0, 1, 1, 1, 2, 2, 3]);
}

/** Play the round hole by hole like the app does: extras, scores, then any auto presses. */
function play(round, rand, upto = round.holes.length) {
  for (let idx = 0; idx < upto; idx++) {
    const hole = round.holes[idx];
    holeExtras(round, idx, rand);
    round.scores[hole.no] = Object.fromEntries(scorers(round).map(s => [s.id, grossScore(rand, hole.par)]));
    round.current = Math.min(idx + 1, round.holes.length - 1);
    const next = idx + 2;
    if ((round.game === 'nassau' || round.game === 'match') && next <= round.holes.length) {
      for (const o of nassauPressOptions(round, next)) round.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
    }
  }
  return round;
}

/** Balances sum to zero to the cent, are whole cents, and the transfers settle every one exactly. */
function checkMoney(round, label = round.game) {
  const res = roundResults(round);
  const ids = round.players.map(p => p.id);
  assert.deepEqual(Object.keys(res.balances).sort(), [...ids].sort(), `${label}: a balance for every player`);
  for (const [id, v] of Object.entries(res.balances)) {
    assert.ok(Number.isFinite(v), `${label}: ${id} balance is a number`);
    assert.ok(Math.abs(v * 100 - cents(v)) < 1e-6, `${label}: ${id} balance ${v} is whole cents`);
  }
  const sum = Object.values(res.balances).reduce((a, v) => a + cents(v), 0);
  assert.equal(sum, 0, `${label}: balances sum to zero (${JSON.stringify(res.balances)})`);
  const left = Object.fromEntries(Object.entries(res.balances).map(([id, v]) => [id, cents(v)]));
  for (const t of res.transfers) {
    assert.notEqual(t.from, t.to, `${label}: no self-transfer`);
    assert.ok(t.amount > 0, `${label}: transfer amounts are positive`);
    assert.ok(ids.includes(t.from) && ids.includes(t.to), `${label}: transfers are between players`);
    assert.ok(res.balances[t.from] < 0 && res.balances[t.to] > 0, `${label}: only losers pay and only winners get paid`);
    left[t.from] += cents(t.amount);
    left[t.to] -= cents(t.amount);
  }
  for (const [id, v] of Object.entries(left)) assert.equal(v, 0, `${label}: ${id} is square after the transfers`);
  assert.ok(res.transfers.length <= Math.max(0, ids.length - 1), `${label}: at most n - 1 payments`);
  return res;
}

/** The round with one hole's entries taken back out, as it was before the hole was saved. */
function withoutHole(round, no) {
  const r = clone(round);
  delete r.scores[no];
  delete r.banker[no];
  delete r.wolf[no];
  if (r.marks) delete r.marks[no];
  return r;
}
const pendingFor = (round, no) => ({ scores: round.scores[no], banker: round.banker[no], wolf: round.wolf[no], marks: round.marks?.[no] });
const diff = (now, before) => Object.fromEntries(Object.keys(now).map(id => [id, Math.round((now[id] - before[id]) * 100) / 100]));

/** livePreview agrees with roundResults for a hole being entered, a hole half-entered and a hole already saved. */
function checkLive(round, idx, label = round.game) {
  const hole = round.holes[idx];
  const saved = roundResults(round).balances;
  const before = withoutHole(round, hole.no);
  const base = roundResults(before).balances;
  const snapshot = JSON.stringify(before);

  // Hole fully entered but not saved yet
  const p = livePreview(before, hole, pendingFor(round, hole.no));
  assert.deepEqual(p.balances, saved, `${label} hole ${hole.no}: preview matches the saved round`);
  assert.deepEqual(p.delta, diff(saved, base), `${label} hole ${hole.no}: delta is what the hole adds`);
  assert.equal(JSON.stringify(before), snapshot, `${label}: livePreview leaves the round alone`);

  // Hole already saved, nothing pending: same totals, same delta
  const snap2 = JSON.stringify(round);
  const q = livePreview(round, hole);
  assert.deepEqual(q.balances, saved, `${label} hole ${hole.no}: saved hole counts`);
  assert.deepEqual(q.delta, diff(saved, base), `${label} hole ${hole.no}: saved hole delta`);
  assert.equal(JSON.stringify(round), snap2, `${label}: livePreview leaves the saved round alone`);

  // Half entered: only the first scorer has a score so far
  const first = scorers(round)[0].id;
  const half = { ...pendingFor(round, hole.no), scores: { [first]: round.scores[hole.no][first] } };
  const halfRound = clone(before);
  halfRound.scores[hole.no] = half.scores;
  if (half.banker) halfRound.banker[hole.no] = half.banker;
  if (half.wolf) halfRound.wolf[hole.no] = half.wolf;
  if (half.marks) halfRound.marks[hole.no] = half.marks;
  const h = livePreview(before, hole, half);
  const expect = roundResults(halfRound).balances;
  assert.deepEqual(h.balances, expect, `${label} hole ${hole.no}: half-entered preview matches saving it half-entered`);
  assert.deepEqual(h.delta, diff(expect, base), `${label} hole ${hole.no}: half-entered delta`);
  assert.equal(JSON.stringify(before), snapshot, `${label}: livePreview leaves the round alone (half)`);
}

/** A round on the flat nine with handicaps off, for hand-worked cases. */
function flat(game, ids, extra = {}) {
  const players = ids.map(id => PEOPLE.find(p => p.id === id));
  return createRound({ id: 'h', game, course: flat9, holesCount: 9, players, settings: SETTINGS, hcPct: 100, useHandicaps: false, ...extra });
}
/** Scores for holes 1.. from rows like { a: 4, b: 5 }. */
function card(round, rows) { rows.forEach((s, i) => { round.scores[round.holes[i].no] = s; }); return round; }
const withSettings = (round, key, patch) => { round.settings = { ...round.settings, [key]: { ...round.settings[key], ...patch } }; return round; };

// ---------------------------------------------------------------------------
// Every game: realistic rounds, 9 and 18 holes, handicaps on and off, settled exactly

for (const game of Object.keys(GAMES)) {
  test(`${game}: realistic rounds balance to zero and settle exactly`, () => {
    let seed = 1, moved = 0, presses = 0;
    for (const holesCount of [9, 18]) {
      for (const settings of [SETTINGS, BUSY]) {
        for (const useHandicaps of [true, false]) {
          const label = `${game} ${holesCount} holes ${useHandicaps ? 'net' : 'gross'} seed ${seed}`;
          const round = play(newRound(game, { holesCount, settings, useHandicaps, nine: seed % 2 ? 'front' : 'back' }), rng(seed++));
          const res = checkMoney(round, label);
          if (res.transfers.length) moved++;
          presses += round.presses.length;
          for (const idx of [0, Math.floor(round.holes.length / 2), round.holes.length - 1]) checkLive(round, idx, label);
        }
      }
    }
    // The fixtures are only worth something if money actually changes hands (and presses happen)
    assert.ok(moved >= 4, `${game}: money moved in ${moved} of 8 rounds`);
    if (game === 'nassau' || game === 'match') assert.ok(presses > 0, `${game}: auto presses were made`);
  });

  test(`${game}: a round finished early still settles`, () => {
    for (const upto of [1, 4, 11]) {
      const round = play(newRound(game), rng(100 + upto), upto);
      checkMoney(round, `${game} after ${upto} holes`);
      checkLive(round, upto - 1, `${game} after ${upto} holes`);
      // The live bar on the next, untouched hole shows the same money and no change yet
      const next = livePreview(round, round.holes[upto]);
      assert.deepEqual(next.balances, roundResults(round).balances);
      assert.ok(Object.values(next.delta).every(v => v === 0), `${game}: an empty hole changes nothing`);
    }
    // Nothing played at all: everyone is at $0 and nobody pays
    const empty = newRound(game);
    const res = checkMoney(empty, `${game} unplayed`);
    assert.ok(Object.values(res.balances).every(v => v === 0));
    assert.deepEqual(res.transfers, []);
  });

  test(`${game}: everyone tying every hole is all square`, () => {
    for (const holesCount of [9, 18]) {
      // Same gross on every hole with handicaps off
      const round = newRound(game, { holesCount, useHandicaps: false });
      round.holes.forEach((h, idx) => {
        holeExtras(round, idx, () => 0.99); // partner picks and bets, but no marks (random 0.99 skips them)
        if (round.marks[h.no]) round.marks[h.no] = game === 'bbb' ? { bingo: null, bango: null, bongo: null } : {};
        round.scores[h.no] = Object.fromEntries(scorers(round).map(s => [s.id, h.par]));
      });
      const res = checkMoney(round, `${game} all square ${holesCount}`);
      assert.ok(Object.values(res.balances).every(v => v === 0), `${game}: all square (${JSON.stringify(res.balances)})`);
      assert.deepEqual(res.transfers, []);
    }
    if (game === 'quota') return; // quota scores gross points against a handicap target, so equal nets are not a tie
    // Equal nets with handicaps on: each player shoots net par (gross par plus their strokes)
    const net = newRound(game, { holesCount: 18, useHandicaps: true, players: PEOPLE.slice(0, LINEUPS[game].n).filter(p => p.index >= 0) });
    net.holes.forEach((h, idx) => {
      holeExtras(net, idx, () => 0.99);
      if (net.marks[h.no]) net.marks[h.no] = game === 'bbb' ? { bingo: null, bango: null, bongo: null } : {};
      net.scores[h.no] = Object.fromEntries(scorers(net).map(s => [s.id, h.par + strokesFor(net, s, h)]));
    });
    const res = checkMoney(net, `${game} net all square`);
    assert.ok(Object.values(res.balances).every(v => v === 0), `${game}: net all square (${JSON.stringify(res.balances)})`);
  });

  test(`${game}: a pickup counts exactly as net double bogey`, () => {
    const round = play(newRound(game, { holesCount: 18 }), rng(7));
    const spelled = clone(round);
    let pickups = 0;
    for (const h of spelled.holes) {
      for (const s of scorers(spelled)) {
        if (spelled.scores[h.no][s.id] !== 'X') continue;
        spelled.scores[h.no][s.id] = pickupGross(h.par, strokesFor(spelled, s, h));
        pickups++;
      }
    }
    assert.ok(pickups > 0, 'the seeded round has pickups');
    assert.deepEqual(roundResults(round).balances, roundResults(spelled).balances);
  });
}

// ---------------------------------------------------------------------------
// Hand-worked scenarios, one or more per game (flat nine of par 4s, handicaps off unless noted)

test('banker by hand: bets, doubles and pushes', () => {
  const r = flat('banker', ['a', 'b', 'c']);
  // Hole 1, banker Ann. Bo 3 beats her 4: Bo +5, Ann -5. Cy 5 loses: Cy -5, Ann +5. Ann nets 0.
  r.banker[1] = { banker: 'a', bets: { b: 5, c: 5 }, doubled: {}, doubleBack: false };
  // Hole 2, banker Bo. Ann ties him (push). Cy bet 5 and doubled (x2 = 10) and wins: Cy +10, Bo -10.
  r.banker[2] = { banker: 'b', bets: { a: 10, c: 5 }, doubled: { c: true }, doubleBack: false };
  // Hole 3, banker Cy. Ann bets 2, doubled and doubled back (x4 = 8) and loses: Ann -8, Cy +8. Bo bet 1 and wins: Bo +1, Cy -1.
  r.banker[3] = { banker: 'c', bets: { a: 2, b: 1 }, doubled: { a: true }, doubleBack: true };
  card(r, [{ a: 4, b: 3, c: 5 }, { a: 4, b: 4, c: 3 }, { a: 5, b: 3, c: 4 }]);
  // Ann 0 + 0 - 8 = -8. Bo 5 - 10 + 1 = -4. Cy -5 + 10 + 8 - 1 = 12.
  assert.deepEqual(checkMoney(r).balances, { a: -8, b: -4, c: 12 });
  // Ties to the banker: Ann's hole 2 push becomes a $10 loss to Bo
  withSettings(r, 'banker', { ties: 'banker' });
  assert.deepEqual(checkMoney(r).balances, { a: -18, b: 6, c: 12 });
});

test('nassau by hand: 9 holes, legs of 4 and 5, with a press', () => {
  const r = flat('nassau', ['a', 'b']);
  const A = { a: 3, b: 4 }, B = { a: 4, b: 3 }, H = { a: 4, b: 4 };
  // Winners by hole: A A B H | B B B A A
  card(r, [A, A, B, H, B, B, B, A, A]);
  // First 4: Ann 2-1, +5. Last 5: Bo 3-2, Bo +5. All 9: 4-4, halved.
  assert.deepEqual(checkMoney(r).balances, { a: 0, b: 0 });
  // Ann was 2 down on the back after holes 5 and 6 and pressed from hole 7: holes 7-9 she wins 2-1, +5
  r.presses.push({ id: 'p1', leg: 'back', start: 7, by: 0 });
  assert.deepEqual(checkMoney(r).balances, { a: 5, b: -5 });
});

test('nassau by hand: uneven sides, 1 v 2', () => {
  const r = flat('nassau', ['a', 'b', 'c'], { teams: [['a'], ['b', 'c']] });
  // Ann wins hole 1 against the best ball of Bo and Cy, everything else halved: Ann wins the first 4 and all 9 (2 bets).
  card(r, [{ a: 3, b: 4, c: 5 }, ...Array.from({ length: 8 }, () => ({ a: 4, b: 4, c: 5 }))]);
  // $5 a bet, per player, bigger side is 2: $10 a bet at risk. Ann +20, Bo and Cy -10 each.
  assert.deepEqual(checkMoney(r).balances, { a: 20, b: -10, c: -10 });
});

test('skins by hand: carryover, then a skin each', () => {
  const r = flat('skins', ['a', 'b', 'c']);
  // Hole 1 tied (carries). Hole 2 Ann wins 2 skins at $2 from each: +8, Bo -4, Cy -4.
  // Hole 3 Bo wins 1 skin: +4, Ann -2, Cy -2. Hole 4 tied at the end: nobody wins it.
  card(r, [{ a: 4, b: 4, c: 5 }, { a: 3, b: 4, c: 4 }, { a: 5, b: 4, c: 5 }, { a: 4, b: 4, c: 4 }]);
  const res = checkMoney(r);
  assert.deepEqual(res.balances, { a: 6, b: 0, c: -6 });
  assert.equal(res.detail.skins.unclaimed, 1);
  // Without carryovers hole 2 is worth one skin: Ann +4 - 2 = 2, Bo -2 + 4 = 2, Cy -2 - 2 = -4
  withSettings(r, 'skins', { carryover: false });
  assert.deepEqual(checkMoney(r).balances, { a: 2, b: 2, c: -4 });
});

test('wolf by hand: partner, lone wolf, tie', () => {
  const r = flat('wolf', ['a', 'b', 'c', 'd']);
  // Hole 1: Ann is wolf, takes Bo; best 3 beats 4. Each loser pays each winner $2: Ann +4, Bo +4, Cy -4, Di -4.
  r.wolf[1] = { wolf: 'a', partner: 'b' };
  // Hole 2: Bo goes lone ($2 x 2 = $4 a man) and loses 5 to 4: Bo -12, others +4.
  r.wolf[2] = { wolf: 'b', partner: null };
  // Hole 3: Cy takes Di, best balls tie: nothing.
  r.wolf[3] = { wolf: 'c', partner: 'd' };
  card(r, [{ a: 3, b: 5, c: 4, d: 4 }, { a: 4, b: 5, c: 5, d: 5 }, { a: 4, b: 4, c: 4, d: 5 }]);
  assert.deepEqual(checkMoney(r).balances, { a: 8, b: -8, c: 0, d: 0 });
});

test('match play by hand: 2 v 2 best ball, 1 v 3 and 3 v 5', () => {
  const r = flat('match', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  // Ann & Bo win holes 1-3 on best ball, Cy & Di win hole 4, rest halved: 2 up, $10 each.
  card(r, [
    { a: 3, b: 5, c: 4, d: 4 }, { a: 5, b: 3, c: 4, d: 5 }, { a: 3, b: 3, c: 4, d: 4 }, { a: 5, b: 5, c: 4, d: 6 },
    ...Array.from({ length: 5 }, () => ({ a: 4, b: 4, c: 4, d: 4 })),
  ]);
  assert.deepEqual(checkMoney(r).balances, { a: 10, b: 10, c: -10, d: -10 });

  const lone = flat('match', ['a', 'b', 'c', 'd'], { teams: [['a'], ['b', 'c', 'd']] });
  card(lone, [{ a: 3, b: 4, c: 4, d: 5 }]);
  // One against three: the loner plays for 3 x $10 and each of the three for $10
  assert.deepEqual(checkMoney(lone).balances, { a: 30, b: -10, c: -10, d: -10 });

  // 3 v 5 at $5: $25 at risk. Winners split it three ways, $8.33 and a penny. Must still settle to the cent.
  const big = flat('match', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { teams: [['a', 'b', 'c'], ['d', 'e', 'f', 'g', 'h']] });
  withSettings(big, 'match', { stake: 5 });
  card(big, [{ a: 3, b: 4, c: 4, d: 4, e: 4, f: 4, g: 4, h: 4 }]);
  const res = checkMoney(big);
  for (const id of ['a', 'b', 'c']) assert.ok(Math.abs(res.balances[id] - 25 / 3) < 0.011, `${id} gets a third of $25`);
  for (const id of ['d', 'e', 'f', 'g', 'h']) assert.equal(res.balances[id], -5);
});

test('vegas by hand: numbers, a birdie flip and a double-digit score', () => {
  const r = flat('vegas', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  card(r, [
    { a: 4, b: 5, c: 5, d: 6 },  // 45 v 56: Ann & Bo +11
    { a: 3, b: 5, c: 4, d: 5 },  // Ann's birdie flips them: 35 v 54, +19
    { a: 10, b: 4, c: 4, d: 4 }, // a 10 goes first: 104 v 44, -60
  ]);
  // 11 + 19 - 60 = -30 a man at $1 a point
  assert.deepEqual(checkMoney(r).balances, { a: -30, b: -30, c: 30, d: 30 });
});

test('sixes by hand: three 3-hole matches over 9, match and holes modes', () => {
  const r = flat('sixes', ['a', 'b', 'c', 'd']);
  card(r, [
    // Holes 1-3, Ann & Bo v Cy & Di: A&B win 1 and 2, hole 3 halved (closed out 2&1)
    { a: 3, b: 5, c: 4, d: 5 }, { a: 5, b: 3, c: 4, d: 4 }, { a: 4, b: 4, c: 4, d: 4 },
    // Holes 4-6, Ann & Cy v Bo & Di: all halved
    { a: 4, b: 4, c: 4, d: 4 }, { a: 4, b: 4, c: 4, d: 4 }, { a: 4, b: 4, c: 4, d: 4 },
    // Holes 7-9, Ann & Di v Bo & Cy: B&C win hole 7, rest halved
    { a: 5, b: 3, c: 5, d: 5 }, { a: 4, b: 4, c: 4, d: 4 }, { a: 4, b: 4, c: 4, d: 4 },
  ]);
  // Match mode, $5 a match: A&B +5, B&C +5. Ann 5 - 5 = 0, Bo +10, Cy -5 + 5 = 0, Di -10.
  assert.deepEqual(checkMoney(r).balances, { a: 0, b: 10, c: 0, d: -10 });
  // Holes mode, $5 a hole up: match 1 is 2 up (+10), match 3 is 1 up the other way (+5 to B&C)
  withSettings(r, 'sixes', { mode: 'holes' });
  assert.deepEqual(checkMoney(r).balances, { a: 5, b: 15, c: -5, d: -15 });
});

test('scramble by hand: two teams, and uneven teams splitting a pot in thirds', () => {
  const r = flat('scramble', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  card(r, [{ t0: 3, t1: 4 }, { t0: 4, t1: 4 }]);
  // Four $5 antes, Ann & Bo's team is 1 better: they split $20, +5 each
  assert.deepEqual(checkMoney(r).balances, { a: 5, b: 5, c: -5, d: -5 });

  // Seven players in teams of 3, 2 and 2 at $5: a $35 pot for the three winners is $11.67 less a penny
  const odd = flat('scramble', ['a', 'b', 'c', 'd', 'e', 'f', 'g'], { teams: [['a', 'b', 'c'], ['d', 'e'], ['f', 'g']] });
  card(odd, [{ t0: 3, t1: 4, t2: 5 }]);
  const res = checkMoney(odd);
  for (const id of ['a', 'b', 'c']) assert.ok(Math.abs(res.balances[id] - 20 / 3) < 0.011, `${id} wins about $6.67`);
  for (const id of ['d', 'e', 'f', 'g']) assert.equal(res.balances[id], -5);
});

test('stroke play by hand: pot, per stroke, and a three-way tie in a pot of seven', () => {
  const r = flat('stroke', ['a', 'b', 'c']);
  card(r, [{ a: 4, b: 5, c: 5 }, { a: 4, b: 4, c: 5 }]); // totals 8, 9, 10
  // Pot: three $5 antes, Ann's 8 takes $15: +10, -5, -5
  assert.deepEqual(checkMoney(r).balances, { a: 10, b: -5, c: -5 });
  // Per stroke at $1: Ann beats Bo by 1 and Cy by 2 (+3), Bo beats Cy by 1 (-1 + 1 = 0), Cy -3
  withSettings(r, 'stroke', { stake: 1, payout: 'per' });
  assert.deepEqual(checkMoney(r).balances, { a: 3, b: 0, c: -3 });

  const tie = flat('stroke', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  card(tie, [{ a: 3, b: 3, c: 3, d: 4, e: 4, f: 5, g: 6 }]);
  const res = checkMoney(tie);
  for (const id of ['a', 'b', 'c']) assert.ok(Math.abs(res.balances[id] - 20 / 3) < 0.011);
});

test('stableford by hand: points per point and modified', () => {
  const r = flat('stableford', ['a', 'b', 'c']);
  // Ann 3,4,4 = 3+2+2 = 7 pts. Bo 4,4,4 = 6. Cy 5,6,4 = 1+0+2 = 3.
  card(r, [{ a: 3, b: 4, c: 5 }, { a: 4, b: 4, c: 6 }, { a: 4, b: 4, c: 4 }]);
  // $1 a point between every pair: Ann +1 +4 = 5, Bo -1 +3 = 2, Cy -4 -3 = -7
  assert.deepEqual(checkMoney(r).balances, { a: 5, b: 2, c: -7 });
  // Modified: Ann 2+0+0 = 2, Bo 0, Cy -1-3+0 = -4. Ann +2 +6 = 8, Bo -2 +4 = 2, Cy -10
  withSettings(r, 'stableford', { modified: true });
  assert.deepEqual(checkMoney(r).balances, { a: 8, b: 2, c: -10 });
});

test('quota by hand: points against 18 less the course handicap', () => {
  // Hand-set course handicaps for 9 holes: Ann 0 (quota 18), Bo 4 (quota 14)
  const r = flat('quota', ['a', 'b'], { useHandicaps: true, players: [{ ...PEOPLE[0], courseHcOverride: 0 }, { ...PEOPLE[1], courseHcOverride: 4 }] });
  // Ann: 8 pars and a birdie = 16 + 4 = 20, +2 on her quota. Bo: 9 pars = 18, +4 on his.
  card(r, Array.from({ length: 9 }, (_, i) => ({ a: i === 0 ? 3 : 4, b: 4 })));
  // $1 a point: Bo beats Ann by 2
  assert.deepEqual(checkMoney(r).balances, { a: -2, b: 2 });
});

test('nines by hand: 5-3-1 with ties', () => {
  const r = flat('nines', ['a', 'b', 'c']);
  // 3,4,5 → 5,3,1. 4,4,5 → 4,4,1. 4,4,4 → 3,3,3. Totals 12, 10, 5; average 9.
  card(r, [{ a: 3, b: 4, c: 5 }, { a: 4, b: 4, c: 5 }, { a: 4, b: 4, c: 4 }]);
  assert.deepEqual(checkMoney(r).balances, { a: 3, b: 1, c: -4 });
});

test('aces and deuces by hand', () => {
  const r = flat('aces', ['a', 'b', 'c', 'd']);
  // Hole 1: Ann low alone (+2 from 3 = +6), Di high alone (-1 to 3 = -3): a +7, b +1-2 = -1, c -1, d -2-3 = -5
  // Hole 2: all tied, nothing. Hole 3: low tied (no ace), Ann high alone: a -3, others +1.
  card(r, [{ a: 3, b: 4, c: 4, d: 6 }, { a: 4, b: 4, c: 4, d: 4 }, { a: 5, b: 4, c: 4, d: 4 }]);
  assert.deepEqual(checkMoney(r).balances, { a: 4, b: 0, c: 0, d: -4 });
});

test('bingo bango bongo by hand', () => {
  const r = flat('bbb', ['a', 'b', 'c']);
  card(r, [{ a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }]);
  r.marks[1] = { bingo: 'a', bango: 'a', bongo: 'b' };
  r.marks[2] = { bingo: 'c', bango: 'b', bongo: 'b' };
  // Points a 2, b 3, c 1, settled between every pair at $1: a -1 +1 = 0, b +1 +2 = 3, c -1 -2 = -3
  assert.deepEqual(checkMoney(r).balances, { a: 0, b: 3, c: -3 });
});

test('dots by hand: automatic birdies, marked dots, and a kind that is switched off', () => {
  const r = flat('dots', ['a', 'b', 'c']);
  card(r, [{ a: 3, b: 4, c: 5 }]);
  r.marks[1] = { a: ['sandy'], c: ['chipin', 'polie'] }; // polie is off
  // Ann 2 dots (birdie + sandy), Cy 1. Every dot is paid by each other player at $1:
  // Ann +2 +2 -1 = 3, Bo -2 -1 = -3, Cy +1 +1 -2 = 0
  assert.deepEqual(checkMoney(r).balances, { a: 3, b: -3, c: 0 });
});

test('rabbit by hand: 9 holes, loose on a tie, held at the end', () => {
  const r = flat('rabbit', ['a', 'b', 'c']);
  const T = { a: 4, b: 4, c: 4 };
  // Ann catches it, a tie sets it loose, Bo catches it, ... Cy wins the 9th and holds it
  card(r, [{ a: 3, b: 4, c: 4 }, T, { a: 4, b: 3, c: 4 }, T, T, T, T, T, { a: 4, b: 4, c: 3 }]);
  assert.deepEqual(checkMoney(r).balances, { a: -5, b: -5, c: 10 });
  // Stop after 8 holes: the leg isn't finished, nobody is paid
  delete r.scores[9];
  assert.deepEqual(checkMoney(r).balances, { a: 0, b: 0, c: 0 });
});

// ---------------------------------------------------------------------------
// Uneven sides and odd splits

test('team games with uneven sides still settle to the cent', () => {
  const cases = [
    ['match', [['a'], ['b', 'c']]],
    ['match', [['a'], ['b', 'c', 'd']]],
    ['match', [['a', 'b', 'c'], ['d', 'e', 'f', 'g', 'h']]],
    ['match', [['a', 'b'], ['c', 'd', 'e']]],
    ['nassau', [['a'], ['b', 'c']]],
    ['nassau', [['a'], ['b', 'c', 'd']]],
    ['scramble', [['a', 'b', 'c'], ['d', 'e'], ['f', 'g']]],
    ['scramble', [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]],
    ['scramble', [['a'], ['b', 'c']]],
  ];
  let seed = 300;
  for (const [game, teams] of cases) {
    for (const holesCount of [9, 18]) {
      const n = teams.flat().length;
      const round = play(newRound(game, { holesCount, n, teams, settings: { ...BUSY, match: { ...BUSY.match, stake: 5 } } }), rng(seed++));
      const label = `${game} ${teams.map(t => t.length).join('v')} ${holesCount}`;
      checkMoney(round, label);
      checkLive(round, 2, label);
    }
  }
});

test('pots and points that split into thirds keep every cent', () => {
  // Stableford pot among 7, three tied for the most points
  const s = flat('stableford', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  withSettings(s, 'stableford', { payout: 'pot', stake: 5 });
  card(s, [{ a: 3, b: 3, c: 3, d: 4, e: 4, f: 5, g: 6 }]);
  checkMoney(s, 'stableford pot three-way tie');
  // Skins at a third of a dollar
  const k = play(newRound('skins', { settings: { ...SETTINGS, skins: { value: 1 / 3, carryover: true } } }), rng(41));
  checkMoney(k, 'skins at a third');
  // Wolf at $0.35 a point, lone wolf triple
  const w = play(newRound('wolf', { settings: { ...SETTINGS, wolf: { point: 0.35, loneMultiplier: 3 } } }), rng(42));
  checkMoney(w, 'wolf at 35 cents');
});

test('9 holes on the back nine and from a shotgun start', () => {
  for (const game of Object.keys(GAMES)) {
    const back = play(newRound(game, { holesCount: 9, nine: 'back' }), rng(500));
    assert.equal(back.holes[0].no, 10);
    checkMoney(back, `${game} back nine`);
    const shotgun = play(newRound(game, { holesCount: 18, startHole: 14 }), rng(501));
    assert.equal(shotgun.holes[0].no, 14);
    checkMoney(shotgun, `${game} shotgun`);
    checkLive(shotgun, 5, `${game} shotgun`);
  }
});

// ---------------------------------------------------------------------------
// The live money bar

test('livePreview: editing a saved marks hole does not double count its marks', () => {
  // Bingo bango bongo points come from marks alone, so "without the hole" has to drop the marks too
  const r = flat('bbb', ['a', 'b', 'c']);
  card(r, [{ a: 4, b: 4, c: 4 }]);
  r.marks[1] = { bingo: 'a', bango: 'a', bongo: 'a' };
  const p = livePreview(r, r.holes[0]);
  // Ann 3 points, others 0: pairwise at $1, Ann +6, Bo -3, Cy -3, all of it from hole 1
  assert.deepEqual(p.balances, { a: 6, b: -3, c: -3 });
  assert.deepEqual(p.delta, { a: 6, b: -3, c: -3 });
  // Changing the marks before saving: the delta is the new marks, not new minus old
  const q = livePreview(r, r.holes[0], { scores: r.scores[1], marks: { bingo: 'b', bango: null, bongo: null } });
  assert.deepEqual(q.delta, { a: -1, b: 2, c: -1 });
});

test('holeMoneyLine names everyone who won the most on the hole', () => {
  const r = flat('match', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  const hole = r.holes[0];
  assert.equal(holeMoneyLine(r, hole, { a: 10, b: 10, c: -10, d: -10 }), 'Hole 1: Ann & Bo +$10');
  assert.equal(holeMoneyLine(r, hole, { a: 0, b: 0, c: 0, d: 0 }), 'Hole 1 saved. No money changed hands');
  const s = flat('skins', ['a', 'b', 'c']);
  assert.equal(holeMoneyLine(s, hole, { a: -2, b: 4, c: -2 }), 'Hole 1: Bo +$4');
  assert.equal(holeMoneyLine(s, hole, { a: 2.5, b: 2.5, c: -5 }), 'Hole 1: Ann & Bo +$2.50');
  const t = flat('scramble', ['a', 'b', 'c', 'd', 'e', 'f'], { teams: [['a', 'b', 'c'], ['d', 'e', 'f']] });
  assert.equal(holeMoneyLine(t, hole, { a: 5, b: 5, c: 5, d: -5, e: -5, f: -5 }), 'Hole 1: Team A +$5');
});
