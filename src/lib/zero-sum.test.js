// Every settle-up adds to zero (ROADMAP area 25, Hardening). One seeded sweep over every game in
// GAMES, every side game, two-player side bets, points and reward rounds, the Big Game and trip
// expenses: random lineups (the fewest to the most players), 9 and 18 holes, handicaps on and off,
// random settings and house rules, scores from 1 to 10 with pickups, skipped holes, half-entered
// holes and unfinished rounds, players leaving, bets changed partway. For every case:
//  • each player's net is whole cents, and the nets add up to exactly 0 in integer cents
//  • each game on its own (byGame) adds up to 0 too
//  • the settle-up payments (who pays whom) reproduce every player's net exactly, to the cent
// Every case has its own seed, printed on failure. To rerun one case alone:
//   ZERO_SUM_CASE="game:nassau#17" node --test src/lib/zero-sum.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES, SIDE_GAMES, TEAM_GAMES, POT_NONE, createRound, roundResults, changeBets, sideGameChoices, sideGamesOf,
  scorers, bankerHoleSetup, wolfFor, hammerOptions, nassauPressOptions, canLeave,
} from './round.js';
import { REV2_DEFAULTS, TEAM_DEFAULTS } from './settings.js';
import { DOT_KINDS } from './games.js';
import { teamsCfg, teamsProblem } from './teams.js';
import { addBet, setBetWinner } from './pair-bets.js';
import { minimalTransfers } from './golf.js';
import { fewestPayments } from './ledger.js';
import { cleanExpense, shareCents } from './trip-expenses.js';
import { bigField, bigLines, bigResults, cleanBig } from './big-game.js';
import { buildHoles, buildMeta } from './sync-model.js';
import { stakeBalances, stakeLines } from './cup.js';
import { toCard } from './big-sync-model.js';

// ---------------------------------------------------------------------------
// Seeds: every case gets its own, from its name, so one failing case reruns on its own

/** FNV-1a, so a case name ("nassau#17") is a seed. */
function seedOf(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** mulberry32: small, fast, the same numbers on every machine. */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const ONLY = process.env.ZERO_SUM_CASE || null;

/**
 * Run `count` cases named `${tag}#${k}`, each with its own seeded random numbers. A failure says the
 * case name and seed. Returns how many cases ran (a case returns false when it was skipped).
 */
function sweep(tag, count, fn) {
  let ran = 0;
  for (let k = 0; k < count; k++) {
    const name = `${tag}#${k}`;
    if (ONLY && ONLY !== name) continue;
    const seed = seedOf(name);
    let ok;
    try {
      ok = fn(rng(seed), name);
    } catch (e) {
      throw new Error(`[case ${name}, seed ${seed}] ${e.message}\nRerun it alone: ZERO_SUM_CASE="${name}" node --test src/lib/zero-sum.test.js`, { cause: e });
    }
    if (ok !== false) ran++;
  }
  return ran;
}

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (rnd, p) => rnd() < p;
const cents = v => Math.round(v * 100);
const isWholeCents = v => Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const shuffle = (rnd, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------------------
// The checks

/**
 * Nets add up to 0 in integer cents, each is whole cents, and the payments square everyone exactly.
 * `amount` reads a payment's dollars; `fewest` says the payments are a fewest-payments plan (at most n - 1).
 */
function checkSettle(balances, transfers, ids, label, { fewest = true, amountOf = t => t.amount } = {}) {
  for (const id of ids) {
    const v = balances[id] ?? 0;
    assert.ok(isWholeCents(v), `${label}: ${id}'s net ${v} is not whole cents`);
  }
  for (const id of Object.keys(balances)) assert.ok(ids.includes(id), `${label}: a net for ${id}, who isn't in it`);
  const sum = ids.reduce((a, id) => a + cents(balances[id] ?? 0), 0);
  assert.equal(sum, 0, `${label}: nets add up to ${sum} cents, not 0 (${JSON.stringify(balances)})`);
  const left = Object.fromEntries(ids.map(id => [id, cents(balances[id] ?? 0)]));
  for (const t of transfers) {
    const amt = amountOf(t);
    assert.ok(ids.includes(t.from) && ids.includes(t.to), `${label}: payment between people in it (${JSON.stringify(t)})`);
    assert.notEqual(t.from, t.to, `${label}: nobody pays themself`);
    assert.ok(amt > 0 && isWholeCents(amt), `${label}: payment ${amt} is a positive whole-cent amount`);
    left[t.from] += cents(amt);
    left[t.to] -= cents(amt);
  }
  for (const id of ids) assert.equal(left[id], 0, `${label}: ${id} is off by ${left[id]} cents after the payments (${JSON.stringify(balances)} / ${JSON.stringify(transfers)})`);
  if (fewest) assert.ok(transfers.length <= Math.max(0, ids.length - 1), `${label}: ${transfers.length} payments for ${ids.length} people`);
}

/** How many checked rounds and Big Games moved any money, so the sweep can't pass on all-square cases alone. */
const MOVED = { rounds: 0, big: 0 };

/** Everything roundResults says about money, checked: the round, each game in it, and a reward round's money bets. */
function checkRound(round, label) {
  const res = roundResults(round);
  if (res.transfers.length) MOVED.rounds++;
  const ids = round.players.map(p => p.id);
  checkSettle(res.balances, res.transfers, ids, label);
  // The group-wide plan agrees with the plain one on what everyone nets
  checkSettle(res.balances, fewestPayments(res.balances), ids, `${label} (fewestPayments)`);
  for (const [key, g] of Object.entries(res.detail?.byGame || {})) {
    const sum = ids.reduce((a, id) => a + cents(g.balances[id] ?? 0), 0);
    assert.equal(sum, 0, `${label}: ${key} alone adds up to ${sum} cents (${JSON.stringify(g.balances)})`);
    for (const id of ids) assert.ok(isWholeCents(g.balances[id] ?? 0), `${label}: ${key} ${id} ${g.balances[id]} is whole cents`);
  }
  // Head to head: two sides of one number
  for (const a of ids) for (const b of ids) if (a !== b) assert.equal(cents(res.pairs[a][b]) + cents(res.pairs[b][a]), 0, `${label}: ${a} v ${b}`);
  if (res.cash) checkSettle(res.cash.balances, res.cash.transfers, ids, `${label} (side bets for money)`, { fewest: false });
  return res;
}

// ---------------------------------------------------------------------------
// Random rounds

const STAKES = [1, 2, 2.5, 5, 7.5, 10, 3.33, 0.25, 1.01];
const DOTS = Object.keys(DOT_KINDS);

/** Every game's settings with random amounts and random house rules, as setup or the round menu could make them. */
function randomSettings(rnd) {
  const s = () => pick(rnd, STAKES);
  const b = p => chance(rnd, p);
  const payout = () => pick(rnd, ['pot', 'per']);
  const team = game => ({
    ...TEAM_DEFAULTS[game], format: pick(rnd, ['nassau', 'total', 'hole']), scoring: pick(rnd, ['match', 'stroke']),
    front: s(), back: s(), total: s(), stake: s(), perHole: s(), pressMode: pick(rnd, ['off', 'manual', 'auto']), threshold: pick(rnd, [1, 2, 3]),
    turnPress: b(0.3), noLastPress: b(0.3), ...(game === 'bestball' || game === 'shamble' ? { count: pick(rnd, [1, 2]), lowTotal: b(0.3) } : {}),
    ...(game === 'shamble' ? { drives: pick(rnd, [0, 0, 2, 3]) } : {}),
  });
  return {
    hcPct: pick(rnd, [100, 90, 85]),
    banker: { defaultBet: 5, min: 1, max: 20, ties: pick(rnd, ['push', 'banker']), rotation: pick(rnd, ['rotate', 'fixed', 'nine', 'low', 'choice']), birdies: b(0.4), par3Triple: b(0.3), pressAll: b(0.3), firstBanker: int(rnd, 0, 3) },
    nassau: { front: s(), back: s(), total: s(), pressMode: pick(rnd, ['off', 'manual', 'auto']), threshold: pick(rnd, [1, 2, 3]), bye: pick(rnd, ['off', 'half', 'full']), turnPress: b(0.3), noLastPress: b(0.3) },
    skins: { value: s(), carryover: b(0.6), kind: pick(rnd, ['net', 'gross', 'both']), payout: payout(), stake: s(), lastCarry: pick(rnd, ['void', 'split']), birdieDouble: b(0.3), validate: b(0.2), canadian: b(0.2) },
    wolf: { point: s(), loneMultiplier: pick(rnd, [2, 3]), birdieDouble: b(0.3), blindPlus: pick(rnd, [undefined, 1, 2]) },
    match: { stake: s(), pressMode: pick(rnd, ['off', 'manual', 'auto']), threshold: pick(rnd, [1, 2]), bye: pick(rnd, ['off', 'half', 'full']) },
    vegas: { point: s(), birdieFlip: b(0.6), birdieDouble: b(0.3), daytona: b(0.3), max9: b(0.3) },
    sixes: { stake: s(), mode: pick(rnd, ['match', 'holes']), press: b(0.3), carry: b(0.3) },
    scramble: { stake: s(), second: b(0.3) },
    stroke: { stake: s(), payout: payout(), gross: b(0.3), cap: b(0.3), nassau: b(0.3) },
    stableford: { ...REV2_DEFAULTS.stableford, stake: s(), payout: payout(), modified: b(0.4), table: pick(rnd, ['standard', 'chicago']) },
    quota: { ...REV2_DEFAULTS.quota, stake: s(), payout: payout(), table: pick(rnd, ['chicago', 'stableford']), adjust: pick(rnd, ['off', 'one', 'half']), split: pick(rnd, [undefined, 'over']), team: b(0.4), nassau: b(0.3) },
    nines: { point: s(), sweep: b(0.3), birdie: b(0.3) },
    aces: { ace: s(), deuce: s() },
    bbb: { value: s(), sweep: b(0.3), netBongo: b(0.3), bingoDrive: b(0.2) },
    dots: { value: s(), auto: b(0.6), greenieCarry: b(0.3), kinds: Object.fromEntries(DOTS.map(k => [k, b(0.7)])) },
    rabbit: { ...REV2_DEFAULTS.rabbit, stake: s(), mode: pick(rnd, ['free', 'steal']), tiesFree: b(0.5), backDouble: b(0.3) },
    hammer: { stake: s(), max: pick(rnd, [0, 2, 3]), who: pick(rnd, ['either', 'trailing']), carry: b(0.3) },
    snake: { stake: s(), growth: pick(rnd, ['flat', 'double', 'grow']), nines: b(0.4), cap: pick(rnd, [0, 4]), split: b(0.3) },
    birdies: { stake: s(), eagleShares: pick(rnd, [2, 3]) },
    ctp: { stake: s(), unclaimed: pick(rnd, ['carry', 'split']) },
    drive: { stake: s(), unclaimed: pick(rnd, ['carry', 'split']) },
    ...Object.fromEntries(TEAM_GAMES.map(g => [g, team(g)])),
  };
}

/** A team split the app would accept for `game` (teamsProblem says none), or null when the game has no teams. */
function randomTeams(rnd, game, ids, settings) {
  const cfg = teamsCfg(game, settings, ids.length);
  if (!cfg) return { ok: true, teams: null };
  if (cfg.optional && ids.length <= 2) return { ok: true, teams: null };
  const order = shuffle(rnd, ids);
  const [lo, hi] = Array.isArray(cfg.count) ? cfg.count : [cfg.count, cfg.count];
  const count = int(rnd, lo, Math.min(hi, ids.length));
  let teams;
  if (cfg.size || cfg.even || cfg.pairs) {
    teams = Array.from({ length: count }, () => []);
    order.forEach((pid, i) => teams[Math.floor(i * count / order.length)].push(pid));
  } else {
    // Random cut points, every team at least one player ("one against the field" included)
    const cuts = shuffle(rnd, Array.from({ length: order.length - 1 }, (_, i) => i + 1)).slice(0, count - 1).sort((a, b) => a - b);
    teams = [0, ...cuts, order.length].slice(1).map((end, i, arr) => order.slice(i ? arr[i - 1] : 0, end));
  }
  return teamsProblem(game, teams, ids, cfg) ? { ok: false } : { ok: true, teams };
}

/** A score from 1 to 10: mostly believable, some anything at all, the odd pickup. */
function grossScore(rnd, par) {
  const r = rnd();
  if (r < 0.06) return 'X';
  if (r < 0.4) return int(rnd, 1, 10);
  return Math.max(1, Math.min(10, par + pick(rnd, [-2, -1, 0, 0, 0, 1, 1, 1, 2, 3])));
}

/** What the scorekeeper taps on a hole besides scores: the main game's extras and the side games' marks. */
function holeExtras(round, idx, rnd) {
  const hole = round.holes[idx];
  const ids = round.players.map(p => p.id);
  const marks = {};
  if (round.game === 'banker') {
    const setup = structuredClone(bankerHoleSetup(round, idx));
    for (const pid of Object.keys(setup.bets || {})) {
      setup.bets[pid] = pick(rnd, [1, 2, 2.5, 5, 10, 20]);
      if (chance(rnd, 0.25)) setup.doubled[pid] = true;
    }
    setup.doubleBack = Object.values(setup.doubled || {}).some(Boolean) && chance(rnd, 0.4);
    round.banker[hole.no] = setup;
  }
  if (round.game === 'wolf') {
    const wolf = wolfFor(round, idx);
    const lone = chance(rnd, 0.3);
    round.wolf[hole.no] = { wolf, partner: lone ? null : pick(rnd, ids.filter(id => id !== wolf)), ...(lone && chance(rnd, 0.3) ? { blind: true } : {}) };
  }
  if (round.game === 'bbb') {
    const who = () => (chance(rnd, 0.15) ? null : pick(rnd, ids));
    Object.assign(marks, { bingo: who(), bango: who(), bongo: who() });
  }
  const games = new Set([round.game, ...sideGamesOf(round).map(sg => sg.game)]);
  if (games.has('dots')) for (const pid of ids) { const k = DOTS.filter(() => chance(rnd, 0.1)); if (k.length) marks[pid] = k; }
  if (games.has('snake')) marks.snake = ids.filter(() => chance(rnd, 0.15));
  if (games.has('ctp') || games.has('drive')) {
    for (const key of ['ctp', 'drive']) if (games.has(key) && chance(rnd, 0.7)) marks[key] = chance(rnd, 0.2) ? POT_NONE : pick(rnd, ids);
  }
  if (round.game === 'hammer') {
    const mark = { hammers: [], conceded: null };
    for (let k = 0; k < 4 && chance(rnd, 0.4); k++) {
      const can = hammerOptions(round, hole, mark);
      const side = can[0] && can[1] ? (chance(rnd, 0.5) ? 0 : 1) : can.indexOf(true);
      if (side < 0) break;
      mark.hammers.push(side);
    }
    if (mark.hammers.length && chance(rnd, 0.3)) mark.conceded = 1 - mark.hammers.at(-1);
    Object.assign(marks, mark);
  }
  if (Object.keys(marks).length) round.marks[hole.no] = marks;
}

/** Bump every money figure in a game's block (not thresholds or multipliers). */
const raise = (block, by) => Object.fromEntries(Object.entries(block || {}).map(([k, v]) => [k, typeof v === 'number' && !['threshold', 'loneMultiplier', 'firstBanker', 'cap', 'eagleShares', 'drives', 'count', 'min', 'max'].includes(k) ? Math.round((v * 1.5 + by) * 100) / 100 : v]));

/** Some side bets between two players: matches, per hole, closest to the pin and custom, some decided. */
function addSideBets(round, rnd) {
  const ids = round.players.map(p => p.id);
  const n = int(rnd, 1, 4);
  let r = round;
  for (let i = 0; i < n; i++) {
    const [a, b] = shuffle(rnd, ids);
    const kind = pick(rnd, ['match', 'hole', 'ctp', 'custom']);
    const len = r.holes.length;
    const from = chance(rnd, 0.6) ? 1 : int(rnd, 1, len);
    const raw = {
      id: `b${i}`, kind, sides: [a, b], stake: pick(rnd, STAKES),
      ...(chance(rnd, 0.4) ? { holes: [from, int(rnd, from, len)] } : {}),
      ...(chance(rnd, 0.3) ? { strokes: { to: a, count: int(rnd, 1, 6) } } : {}),
      ...(r.playFor?.kind === 'reward' ? { playFor: pick(rnd, ['money', 'points']) } : {}),
      label: 'Longest drive',
    };
    r = addBet(r, raw);
    if (kind === 'ctp') for (const h of r.holes) if (h.par === 3 && chance(rnd, 0.6)) r = setBetWinner(r, `b${i}`, h.no, pick(rnd, [a, b]));
    if (kind === 'custom' && chance(rnd, 0.6)) r = setBetWinner(r, `b${i}`, r.holes[int(rnd, 0, len - 1)].no, pick(rnd, [a, b]));
  }
  return r;
}

const course = (n, pars) => ({ id: `c${n}`, name: 'Zero Sum Links', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: pars[i % pars.length], hdcp: ((i * 7) % n) + 1 })) });
const PARS = [[4, 3, 5], [4, 4, 3, 5, 4, 4, 3, 4, 5], [3, 3, 4]];

/**
 * A random round of `game`, or null when the random lineup isn't one the app allows. Options:
 * n (players), side (side game keys to try to add), bets (side bets between two), playFor.
 */
function randomRound(rnd, game, { n = null, side = null, bets = null, playFor = null } = {}) {
  const g = GAMES[game];
  const count = n ?? int(rnd, g.min || 2, g.max || 8);
  const ids = Array.from({ length: count }, (_, i) => `p${i}`);
  const settings = randomSettings(rnd);
  const t = randomTeams(rnd, game, ids, settings);
  if (!t.ok) return null;
  const holes = chance(rnd, 0.5) ? 9 : 18;
  let r = createRound({
    id: 'r', game, course: course(holes, pick(rnd, PARS)), holesCount: holes,
    players: ids.map((id, i) => ({ id, name: `Player ${i}`, index: chance(rnd, 0.1) ? -int(rnd, 0, 3) : int(rnd, 0, 36) })),
    settings, hcPct: settings.hcPct, useHandicaps: chance(rnd, 0.5), teams: t.teams, halfStrokes: chance(rnd, 0.15),
  });
  // Side games: the ones asked for, if this main game can have them; or a random few
  const wanted = side ?? (chance(rnd, 0.4) ? shuffle(rnd, Object.keys(SIDE_GAMES)).slice(0, int(rnd, 1, 3)) : []);
  const sideGames = [];
  for (const key of wanted) {
    if (!sideGameChoices(game, sideGames).includes(key)) { if (side) return null; continue; }
    const extra = key === 'drive' && chance(rnd, 0.5) ? { holes: r.holes.filter(() => chance(rnd, 0.3)).map(h => h.no) } : {};
    sideGames.push({ game: key, settings: { ...structuredClone(settings[key]), ...extra } });
  }
  if (sideGames.length) r.sideGames = sideGames;
  if (playFor) r.playFor = playFor;
  if (bets ?? chance(rnd, 0.25)) r = addSideBets(r, rnd);

  // Play it: some holes skipped, some half entered, often stopped early
  const upto = chance(rnd, 0.5) ? r.holes.length : int(rnd, 0, r.holes.length);
  const changeAt = chance(rnd, 0.3) ? int(rnd, 1, r.holes.length) : -1;
  for (let idx = 0; idx < upto; idx++) {
    const hole = r.holes[idx];
    // A player heads in now and then, when the app would let them
    if (chance(rnd, 0.02)) { const pid = pick(rnd, ids); if (canLeave(r, pid)) r.left = { ...r.left, [pid]: idx === 0 ? 0 : r.holes[idx - 1].no }; }
    if (idx + 1 === changeAt) r = changeBets(r, raise(r.settings[game], 1), idx + 1);
    if (chance(rnd, 0.08)) continue; // skipped, to come back to
    holeExtras(r, idx, rnd);
    const who = scorers(r, hole).map(s => s.id);
    const sc = Object.fromEntries(who.map(id => [id, grossScore(rnd, hole.par)]));
    if (who.length > 1 && chance(rnd, 0.06)) delete sc[pick(rnd, who)]; // half entered
    r.scores[hole.no] = sc;
    r.current = Math.min(idx + 1, r.holes.length - 1);
    const next = idx + 2;
    if ((game === 'nassau' || game === 'match' || TEAM_GAMES.includes(game)) && next <= r.holes.length) {
      const mode = r.settings[game]?.pressMode;
      for (const o of nassauPressOptions(r, next)) {
        if (mode === 'auto' || (mode === 'manual' && chance(rnd, 0.3))) r.presses.push({ id: `p-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: mode === 'auto' });
      }
    }
  }
  if (upto === r.holes.length && chance(rnd, 0.7)) { r.status = 'done'; r.finishedAt = 1; }
  return r;
}

/** Player counts from the game's fewest to its most, every one of them, round robin over the cases. */
const countFor = (game, k) => { const g = GAMES[game]; const lo = g.min || 2, hi = g.max || 8; return lo + (k % (hi - lo + 1)); };

// ---------------------------------------------------------------------------
// Rounds: every game, every side game, side bets, points and reward rounds

const PER_GAME = 400;

test('every game in GAMES: random rounds add up to $0.00 and the payments reproduce every net', () => {
  let total = 0;
  for (const game of Object.keys(GAMES)) {
    const ran = sweep(`game:${game}`, PER_GAME, (rnd, name) => {
      const r = randomRound(rnd, game, { n: countFor(game, Number(name.split('#')[1])), side: [], bets: false });
      if (!r) return false;
      checkRound(r, name);
    });
    if (!ONLY) assert.ok(ran >= PER_GAME * 0.5, `${game}: only ${ran} cases ran`);
    total += ran;
  }
  if (!ONLY) assert.ok(total > 6000, `${total} cases`);
  // The random rounds aren't all-square ones: most move money
  if (!ONLY) assert.ok(MOVED.rounds > total * 0.8, `only ${MOVED.rounds} of ${total} rounds moved money`);
});

test('every side game, on every main game it can ride with: still $0.00, game by game and in all', () => {
  for (const key of Object.keys(SIDE_GAMES)) {
    const mains = Object.keys(GAMES).filter(g => sideGameChoices(g, []).includes(key));
    assert.ok(mains.length, `${key} rides with some main game`);
    const ran = sweep(`side:${key}`, 300, (rnd, name) => {
      const k = Number(name.split('#')[1]);
      const main = mains[k % mains.length];
      const others = chance(rnd, 0.5) ? shuffle(rnd, Object.keys(SIDE_GAMES).filter(x => x !== key)).slice(0, int(rnd, 1, 2)) : [];
      const r = randomRound(rnd, main, { n: countFor(main, Math.floor(k / mains.length)), side: [key], bets: chance(rnd, 0.3) });
      if (!r) return false;
      // Then a second and third side game where they fit
      for (const o of others) if (sideGameChoices(main, r.sideGames).includes(o)) r.sideGames.push({ game: o, settings: structuredClone(r.settings[o]) });
      assert.ok(sideGamesOf(r).some(sg => sg.game === key), `${name}: ${key} is on`);
      checkRound(r, `${name} (${main} + ${sideGamesOf(r).map(sg => sg.game)})`);
    });
    if (!ONLY) assert.ok(ran >= 200, `${key}: only ${ran} cases ran`);
  }
});

test('two-player side bets on every game, in money, points and reward rounds: $0.00, and a reward round’s money bets settle pair by pair', () => {
  const kinds = [null, { kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }, { kind: 'reward', reward: 'A drink', owes: 'everyone' }];
  for (const game of Object.keys(GAMES)) {
    sweep(`bets:${game}`, 100, (rnd, name) => {
      const k = Number(name.split('#')[1]);
      const r = randomRound(rnd, game, { n: countFor(game, k), bets: true, playFor: kinds[k % kinds.length] });
      if (!r) return false;
      checkRound(r, name);
    });
  }
});

test('multi-game rounds with everything at once: main game, up to three side games, side bets, bets changed', () => {
  const games = Object.keys(GAMES);
  sweep('mixed', 1500, (rnd, name) => {
    const game = pick(rnd, games);
    const r = randomRound(rnd, game, { side: shuffle(rnd, Object.keys(SIDE_GAMES)).filter(k => sideGameChoices(game, []).includes(k)).slice(0, 3), bets: chance(rnd, 0.6) });
    if (!r) return false;
    checkRound(r, `${name} (${game})`);
  });
});

// ---------------------------------------------------------------------------
// The settle-up functions on their own: any nets that add to zero, any odd cents

test('minimalTransfers and fewestPayments reproduce any zero-sum nets exactly, cent for cent', () => {
  sweep('settle', 1000, (rnd, name) => {
    const n = int(rnd, 2, 24);
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const c = ids.map(() => (chance(rnd, 0.2) ? 0 : int(rnd, -50000, 50000)));
    c[n - 1] -= c.reduce((a, x) => a + x, 0);
    const balances = Object.fromEntries(ids.map((id, i) => [id, c[i] / 100]));
    checkSettle(balances, minimalTransfers(balances), ids, `${name} minimalTransfers`);
    checkSettle(balances, fewestPayments(balances), ids, `${name} fewestPayments`);
    // Only between people who can pay each other (a ring, so everyone reaches everyone): passed along, still exact
    const canPay = (a, b) => Math.abs(Number(a.slice(1)) - Number(b.slice(1))) % (n - 1) <= 1;
    checkSettle(balances, fewestPayments(balances, { canPay }), ids, `${name} fewestPayments(canPay)`, { fewest: false });
  });
});

// ---------------------------------------------------------------------------
// Trip expenses: every split to the cent, and the trip settles in the fewest payments

test('trip expenses: every split adds up to its amount, the trip nets to $0.00, and the fewest payments square it', () => {
  sweep('expenses', 500, (rnd, name) => {
    const n = int(rnd, 2, 12);
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const net = Object.fromEntries(ids.map(id => [id, 0]));
    const count = int(rnd, 1, 15);
    for (let i = 0; i < count; i++) {
      const total = int(rnd, 1, 250000); // cents
      const split = pick(rnd, ['equal', 'amounts', 'shares']);
      const people = shuffle(rnd, ids).slice(0, int(rnd, 1, n));
      const payer = pick(rnd, ids);
      let parts = people.map(() => null);
      if (split === 'shares') parts = people.map(() => int(rnd, 1, 5));
      if (split === 'amounts') {
        const c = people.map(() => 0);
        for (let left = total; left > 0;) { const take = Math.min(left, int(rnd, 1, Math.max(1, Math.ceil(total / 2)))); c[int(rnd, 0, c.length - 1)] += take; left -= take; }
        parts = c.map(x => x / 100);
      }
      const e = cleanExpense({
        id: `e${i}`, tripId: 't', what: 'Dinner', amount: total / 100, split,
        payer: { id: payer, name: payer }, people: people.map((id, j) => ({ id, name: id, part: parts[j] })), by: payer,
      });
      assert.ok(e, `${name}: expense ${i} is one`);
      const share = shareCents(e);
      assert.equal(share.reduce((a, x) => a + x, 0), total, `${name}: expense ${i} (${split}) shares ${JSON.stringify(share)} add up to ${total}`);
      assert.ok(share.every(x => Number.isInteger(x) && x >= 0), `${name}: whole cents`);
      net[payer] += total;
      e.people.forEach((p, j) => { net[p.id] -= share[j]; });
    }
    const balances = Object.fromEntries(ids.map(id => [id, net[id] / 100]));
    checkSettle(balances, fewestPayments(balances), ids, name);
  });
});

// ---------------------------------------------------------------------------
// A team points trip's stake: losers pay it, winners split the pot to the cent

test('team points stake: uneven teams and odd stakes still pay out exactly what the losers put in', () => {
  sweep('cup', 400, (rnd, name) => {
    const sizes = [int(rnd, 1, 12), int(rnd, 1, 12)];
    let next = 0;
    const teams = sizes.map(n => Array.from({ length: n }, () => { const id = `c${next++}`; return { id, name: id }; }));
    const cup = { stake: pick(rnd, STAKES.concat([20, 13.37, 0.01])), teams };
    const winner = int(rnd, 0, 1);
    const ids = teams.flat().map(p => p.id);
    const lines = stakeLines(cup, winner);
    checkSettle(stakeBalances(cup, winner), lines, ids, name, { fewest: false });
    // Every loser pays exactly the stake
    for (const p of teams[1 - winner]) assert.equal(cents(stakeBalances(cup, winner)[p.id]), -cents(cup.stake), `${name}: ${p.id} pays the stake`);
  });
});

// ---------------------------------------------------------------------------
// The Big Game: pot, field skins, teams and side bets across groups, all in cents

test('Big Game: random fields of groups add up to $0.00 and its settle-up lines square everyone', () => {
  const ran = sweep('big', 600, (rnd, name) => {
    const groupsN = int(rnd, 2, 4);
    const groups = [];
    let next = 0;
    for (let gi = 0; gi < groupsN; gi++) groups.push(Array.from({ length: int(rnd, 2, 5) }, () => `q${next++}`));
    const ids = groups.flat();
    if (ids.length < 4) return false;
    const holes = chance(rnd, 0.5) ? 9 : 18;
    const crs = course(holes, pick(rnd, PARS));
    const people = Object.fromEntries(ids.map(id => [id, { name: `P${id}`, hc: int(rnd, 0, 30) }]));
    const teamSize = int(rnd, 1, 3);
    const order = shuffle(rnd, ids);
    const teamList = [];
    for (let i = 0; i + teamSize <= order.length; i += teamSize) teamList.push({ id: `T${i}`, name: `Team ${i}`, players: order.slice(i, i + teamSize) });
    const bets = Array.from({ length: int(rnd, 0, 5) }, (_, i) => {
      const [a, b] = shuffle(rnd, ids);
      return { id: `x${i}`, kind: pick(rnd, ['match', 'hole']), sides: [a, b], stake: pick(rnd, STAKES), ...(chance(rnd, 0.3) ? { strokes: { to: a, count: int(rnd, 1, 8) } } : {}) };
    });
    const code = gi => `BIG${String.fromCharCode(65 + gi)}${String.fromCharCode(65 + gi)}${String.fromCharCode(65 + gi)}`;
    const big = cleanBig({
      v: 2, hcPct: pick(rnd, [100, 95, 80]), useHandicaps: chance(rnd, 0.6), people,
      groups: groups.map((players, gi) => ({ id: `g${gi}`, name: `Group ${gi + 1}`, players, keeper: players[0], roundId: `r${gi}`, code: code(gi) })),
      pot: { on: chance(rnd, 0.85), kind: pick(rnd, ['net', 'gross', 'stableford']), stake: pick(rnd, STAKES.concat([20, 13.37])), places: pick(rnd, [[100], [60, 40], [50, 30, 20], [40, 30, 20, 10]]) },
      skins: {
        on: chance(rnd, 0.8), kind: pick(rnd, ['net', 'gross']), stake: pick(rnd, STAKES.concat([10, 6.66])), carry: chance(rnd, 0.5),
        out: ids.filter(() => chance(rnd, 0.1)), leftover: pick(rnd, [undefined, 'split', 'back']), canadian: chance(rnd, 0.2), validate: chance(rnd, 0.2), birdieDouble: chance(rnd, 0.2), exact: chance(rnd, 0.6),
      },
      teams: { on: chance(rnd, 0.5), kind: pick(rnd, ['net', 'gross']), stake: pick(rnd, STAKES), best: pick(rnd, [1, 2]), list: teamList, places: pick(rnd, [[100], [60, 40]]) },
      bets,
    });
    // Each group's card: scores 1 to 10, some holes missing, some groups still out there or not started
    const cards = {};
    for (const [gi, g] of big.groups.entries()) {
      if (chance(rnd, 0.08)) continue; // not started yet
      const r = createRound({ id: g.roundId, game: 'stroke', course: crs, holesCount: holes, players: g.players.map(id => ({ id, name: people[id].name, index: 0, courseHcOverride: people[id].hc })), settings: { stroke: { stake: 0, payout: 'pot' } }, hcPct: 100, useHandicaps: false });
      const upto = chance(rnd, 0.6) ? holes : int(rnd, 0, holes);
      for (const h of r.holes.slice(0, upto)) {
        if (chance(rnd, 0.05)) continue;
        const sc = Object.fromEntries(g.players.map(id => [id, grossScore(rnd, h.par)]));
        if (chance(rnd, 0.05)) delete sc[pick(rnd, g.players)];
        r.scores[h.no] = sc;
      }
      r.createdAt = 1; r.status = upto === holes && chance(rnd, 0.8) ? 'done' : 'active'; r.finishedAt = r.status === 'done' ? 2 : null; r.shareCode = code(gi);
      cards[g.id] = toCard(buildMeta(r), buildHoles(r), 3);
    }
    const ended = chance(rnd, 0.3);
    const field = bigField(big, g => cards[g.id] || null, { ended });
    const res = bigResults(big, field);
    for (const [part, m] of Object.entries(res.money)) {
      const sum = Object.values(m.balances).reduce((a, c) => a + c, 0);
      assert.ok(Object.values(m.balances).every(Number.isInteger), `${name}: ${part} is in whole cents`);
      assert.equal(sum, 0, `${name}: ${part} adds up to ${sum} cents (${JSON.stringify(m.balances)})`);
    }
    const all = Object.fromEntries(ids.map(id => [id, (res.balances[id] || 0) / 100]));
    const lines = bigLines(res.balances);
    if (lines.length) MOVED.big++;
    checkSettle(all, lines, ids, name, { amountOf: t => t.cents / 100 });
  });
  if (!ONLY) assert.ok(MOVED.big > ran * 0.6, `only ${MOVED.big} of ${ran} Big Games moved money`);
});
