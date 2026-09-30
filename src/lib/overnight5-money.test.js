// Overnight 5 money review. Several builders changed the money on their own the same night (half
// strokes, each game's own %, Canadian and validated skins, eight new house rules, side game bet
// changes, blind wolf), so this file tries them together:
// - Old rounds (none of tonight's keys) give exactly the money main gave before the merge. The
//   snapshot was taken by running main's round.js (45a776f) over overnight5-money.fixtures.js.
// - A seeded sweep lays every new option over those rounds, with bet changes and house rules
//   switched on and off partway: every round and every game adds up to zero, in whole cents, the
//   head to head agrees, and a JSON, sync or backup round trip changes nothing.
// - Hand-worked rounds for the combinations most likely to go wrong.
// - The rules card, its change log and the moments never change money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRound, roundResults, gameResults, changeBets, sideGamesOf, skinsTable, strokesFor, wolfCarryBefore,
} from './round.js';
import { oldRounds } from './overnight5-money.fixtures.js';
import { buildMeta, buildHoles, assemble } from './sync-model.js';
import { backupText, parseBackup, replaceFromBackup, mergeBackup } from './backup.js';
import { tabBalances } from './ledger.js';
import { agreementItems, lockAgreement, noteChanges } from './agreed.js';
import { roundMoment, finalMoment, donePositions } from './moments.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./overnight5-money.snapshot.json', import.meta.url), 'utf8'));
const cents = v => Math.round(v * 100);
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);
const moneyOf = r => {
  const res = roundResults(r);
  const byGame = res.detail.byGame ? Object.fromEntries(Object.entries(res.detail.byGame).map(([k, v]) => [k, v.balances])) : undefined;
  return { balances: res.balances, pairs: res.pairs, ...(byGame ? { byGame } : {}) };
};

test('old rounds give exactly the money main gave before overnight 5, head to head and game by game', () => {
  const rounds = oldRounds(300, 2026);
  assert.equal(rounds.length, Object.keys(SNAPSHOT).length);
  for (const { name, round } of rounds) assert.deepEqual(moneyOf(round), SNAPSHOT[name], name);
});

// ---------------------------------------------------------------------------
// Every new option at once, seeded

const HOUSE_KEYS = ['carry', 'birdieDouble', 'sweep', 'cap', 'canadian', 'validate'];

/** An old round with tonight's options laid over it at random. Returns a new round. */
function withEverything(round, rnd) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  let r = structuredClone(round);
  const s = r.settings;
  if (r.useHandicaps && rnd() < 0.7) r.halfStrokes = true;
  for (const sg of r.sideGames || []) if (['skins', 'rabbit', 'birdies'].includes(sg.game) && rnd() < 0.6) sg.hcPct = pick([50, 80, 85, 90, 100]);
  for (const k of [s.skins, ...(r.sideGames || []).filter(x => x.game === 'skins').map(x => x.settings)]) {
    if (rnd() < 0.6) k.canadian = true;
    if (rnd() < 0.6) k.validate = true;
  }
  Object.assign(s.wolf, { carry: rnd() < 0.6, blindMultiplier: pick([3, 4, undefined]) });
  for (const w of Object.values(r.wolf || {})) if (w.partner === null && rnd() < 0.5) w.blind = true;
  s.vegas.birdieDouble = rnd() < 0.6; s.sixes.carry = rnd() < 0.6; s.nines.sweep = rnd() < 0.6;
  s.aces.carry = rnd() < 0.6; s.bbb.sweep = rnd() < 0.6; s.stroke.cap = rnd() < 0.6;
  // Earlier stretches played with a house rule the other way round
  for (const e of r.betHistory || []) if (rnd() < 0.5) for (const k of HOUSE_KEYS) if (k in (s[r.game] || {})) e.settings[k] = !s[r.game][k];
  // A side game's bet changed from some hole (and Skins' fairness options flipped with it)
  for (const sg of sideGamesOf(r)) {
    if (rnd() >= 0.4) continue;
    const next = Object.fromEntries(Object.entries(sg.settings).map(([k, v]) => [k, typeof v === 'number' && k !== 'cap' && k !== 'eagleShares' ? v + 1 : v]));
    if (sg.game === 'skins' && rnd() < 0.5) Object.assign(next, { validate: !sg.settings.validate, canadian: !sg.settings.canadian });
    r = changeBets(r, next, 1 + Math.floor(rnd() * r.holes.length), sg.game);
  }
  // The main game's house rules switched from some hole
  if (rnd() < 0.3) {
    const g = structuredClone(r.settings[r.game]);
    for (const k of HOUSE_KEYS) if (k in g) g[k] = !g[k];
    r = changeBets(r, g, 1 + Math.floor(rnd() * r.holes.length));
  }
  if (rnd() < 0.2) r.playFor = pick([{ kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }]);
  return r;
}

function checkRound(r, name) {
  const res = roundResults(r);
  const ids = r.players.map(p => p.id);
  for (const v of Object.values(res.balances)) assert.ok(Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `${name}: ${v}`);
  assert.equal(sumCents(res.balances), 0, `${name}: ${JSON.stringify(res.balances)}`);
  // Each game on its own adds up too (before the round's rounding to cents)
  for (const [k, g] of Object.entries(res.detail.byGame || {})) {
    const c = Object.values(g.balances).reduce((a, v) => a + v * 100, 0);
    assert.ok(Math.abs(c) < 0.5, `${name} ${k}: ${JSON.stringify(g.balances)}`);
  }
  // Head to head adds up to each balance, give or take a cent a pair
  for (const a of ids) {
    const h2h = ids.filter(b => b !== a).reduce((acc, b) => acc + cents(res.pairs[a]?.[b] || 0), 0);
    assert.ok(Math.abs(h2h - cents(res.balances[a])) <= ids.length, `${name}: ${a} ${h2h} v ${res.balances[a]}`);
  }
  return res;
}

test('every new option together: zero-sum to the cent, and the same after JSON and sync round trips', () => {
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let n = 0;
  for (const { name, round } of oldRounds(400, 77)) {
    for (let t = 0; t < 2; t++) {
      const r = withEverything(round, rnd);
      const res = checkRound(r, name);
      n++;
      // Saved and read back, or shared as a meta record plus hole records: the same money
      assert.deepEqual(roundResults(JSON.parse(JSON.stringify(r))).balances, res.balances, `${name} json`);
      const synced = { ...assemble(buildMeta(r), buildHoles(r)), shared: r.shared };
      assert.deepEqual(roundResults(synced).balances, res.balances, `${name} sync`);
    }
  }
  assert.equal(n, 800);
});

test('backup and restore: every round gives identical money, and so does the Tab', () => {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rounds = oldRounds(120, 9).map(({ round }, i) => ({ ...(i % 2 ? withEverything(round, rnd) : round), id: `r${i}`, status: 'done' }));
  const fresh = () => ({
    version: 1, onboarded: false, me: null, players: {}, crews: {}, customCourses: {}, favorites: [], starredCourses: [],
    rounds: {}, activeRoundId: null, settlements: [], carries: [], tabRows: {}, plans: {}, usuals: [], links: {}, unlinks: [],
    rewardsDone: {}, settings: { theme: 'system', hcPct: 100, rev: 3 },
  });
  const state = { ...fresh(), me: 'p0', players: { p0: { id: 'p0', name: 'Player 0' }, late: { id: 'late', name: 'Late Larry' } }, rounds: Object.fromEntries(rounds.map(r => [r.id, r])) };
  state.links = { late: 'p1' };
  state.settlements = [{ id: 's1', from: 'p1', to: 'p0', amount: 12.5, at: 1 }];
  const parsed = parseBackup(backupText(state));
  assert.ok(parsed.ok);
  for (const restored of [replaceFromBackup(fresh(), parsed.data), mergeBackup(fresh(), parsed.data).state]) {
    for (const r of rounds) assert.deepEqual(moneyOf(restored.rounds[r.id]), moneyOf(r), r.id);
  }
  const tab = tabBalances(state);
  assert.deepEqual(tabBalances(replaceFromBackup(fresh(), parsed.data)), tab);
  // The Tab adds up to zero, and points and reward rounds put nothing on it
  assert.equal(sumCents(tab), 0);
  const moneyOnly = { ...state, rounds: Object.fromEntries(rounds.filter(r => !r.playFor || r.playFor.kind === 'money').map(r => [r.id, r])) };
  assert.ok(rounds.some(r => r.playFor), 'some points or reward rounds in the mix');
  assert.deepEqual(tabBalances(moneyOnly), tab);
});

// ---------------------------------------------------------------------------
// The rules card and moments only read the round

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}

test('the rules card, its change log and the moments never touch the round or its money', () => {
  let seed = 8;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const { name, round } of oldRounds(80, 3)) {
    const r = withEverything(round, rnd);
    r.status = 'active';
    const before = moneyOf(r);
    const locked = { ...r, agreed: lockAgreement(r, { gimmes: 'leather', mulligans: 'nine' }, 'p0', 1) };
    deepFreeze(locked);
    agreementItems(locked);
    // A bet changed after locking in is logged, and the log itself moves no money
    const changed = changeBets(locked, { ...locked.settings[locked.game] }, null);
    const logged = { ...changed, agreed: noteChanges(changed, 2) || changed.agreed };
    for (const pos of donePositions(locked)) roundMoment(locked, pos);
    finalMoment(locked);
    assert.deepEqual(moneyOf(locked), before, name);
    assert.deepEqual(moneyOf(logged), moneyOf(changed), name);
  }
});

// ---------------------------------------------------------------------------
// Hand-worked, on a flat par-4 nine so every number checks on a napkin

const flat = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
function mk(game, ids, settings, { holes = 9, half = false, hc = true } = {}) {
  return createRound({
    id: 'r', game, course: flat, holesCount: holes, players: ids.map(id => ({ id, name: id.toUpperCase(), index: 0 })),
    settings: { hcPct: 100, ...settings }, hcPct: 100, useHandicaps: hc, halfStrokes: half,
  });
}
const card = (r, rows) => { for (const [no, v] of Object.entries(rows)) r.scores[no] = Object.fromEntries(r.players.map((p, i) => [p.id, v[i]])); return r; };

test('Canadian, validated skins with half strokes and carryovers, hole by hole', () => {
  // B gets 11 strokes on a nine: 2 pops on holes 1 and 2 (a whole shot each at half), 1 pop after (half a shot)
  const r = mk('skins', ['a', 'b', 'c'], { skins: { value: 2, carryover: true, kind: 'net', payout: 'per', lastCarry: 'void', canadian: true, validate: true } }, { half: true });
  r.players[1].plays = 11;
  assert.deepEqual(r.holes.slice(0, 3).map(h => strokesFor(r, r.players[1], h)), [1, 1, 0.5]);
  card(r, {
    1: [4, 5, 5], // A and B tie at net 4: carry
    2: [3, 4, 4], // A's natural 3 beats B's net 3 (Canadian): A takes 2 skins, waiting on hole 3
    3: [5, 4, 4], // A's 5 doesn't hold them: back in, and B's net 3½ wins all 3
    4: [4, 4, 4], // B holds with net 3½ and wins again, waiting on hole 5
    5: [4, 6, 3], // B's net 5½ doesn't hold: back in, C's 3 takes 2
    6: [4, 5, 4], // C holds; A and C tie, and the round ends here with 1 carried, unclaimed
  });
  r.status = 'done';
  const rows = skinsTable(r).rows.slice(0, 6).map(x => [x.winner, x.skins, x.lost ?? null]);
  assert.deepEqual(rows, [[null, 0, null], [null, 0, 'a'], ['b', 3, null], [null, 0, 'b'], ['c', 2, null], [null, 0, null]]);
  // $2 a skin, 2 payers each: B +12, C +8; A pays 6 + 4, B pays 4 to C
  assert.deepEqual(roundResults(r).balances, { a: -10, b: 8, c: 2 });
});

test('half strokes in Hammer: a half pop wins the hole, and the hammer doubles it', () => {
  const r = mk('hammer', ['a', 'b'], { hammer: { stake: 5, max: 3, who: 'either' } }, { half: true });
  r.players[1].plays = 1;
  card(r, { 1: [4, 4], 2: [4, 4] });
  r.marks = { 1: { hammers: [1], conceded: null }, 2: { hammers: [], conceded: null } };
  // Hole 1: B's net 3½ beats 4, hammered once: $10. Hole 2: no pop, halved
  assert.deepEqual(gameResults(r).balances, { a: -10, b: 10 });
});

test('a house rule carry switched off from a hole drops what was riding: Wolf', () => {
  const r0 = card(mk('wolf', ['a', 'b', 'c', 'd'], { wolf: { point: 2, loneMultiplier: 2, carry: true } }, { hc: false }), { 1: [4, 4, 4, 4], 2: [3, 4, 4, 4] });
  r0.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'b', partner: 'a' } };
  // On all round: the tie on 1 rides on 2, which pays 2×
  assert.deepEqual(roundResults(r0).balances, { a: 8, b: 8, c: -8, d: -8 });
  const off = changeBets(r0, { ...r0.settings.wolf, carry: false }, 2);
  assert.equal(wolfCarryBefore(off, off.holes[1]), 0);
  assert.deepEqual(roundResults(off).balances, { a: 4, b: 4, c: -4, d: -4 });
  // Off for a tie on 2 and on again from 3: the tie on 1 is gone, the tie on 2 was played without it
  const r1 = card(mk('wolf', ['a', 'b', 'c', 'd'], { wolf: { point: 2, loneMultiplier: 2, carry: true } }, { hc: false }), { 1: [4, 4, 4, 4], 2: [4, 4, 4, 4], 3: [3, 4, 4, 4] });
  r1.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'b', partner: 'a' }, 3: { wolf: 'c', partner: 'a' } };
  const onOffOn = changeBets(changeBets(r1, { ...r1.settings.wolf, carry: false }, 2), { ...r1.settings.wolf, carry: true }, 3);
  assert.equal(wolfCarryBefore(onOffOn, onOffOn.holes[2]), 0);
  assert.equal(wolfCarryBefore(r1, r1.holes[2]), 2);
});

test('a house rule carry switched off from a hole drops what was riding: Aces & Deuces', () => {
  // Hole 1: A and B tie for low (the ace carries), C alone is high. Hole 2: A alone low, C alone high
  const r0 = card(mk('aces', ['a', 'b', 'c'], { aces: { ace: 2, deuce: 1, carry: true } }, { hc: false }), { 1: [4, 4, 5], 2: [3, 4, 5] });
  assert.deepEqual(roundResults(r0).balances, { a: 10, b: -2, c: -8 });
  // Off from hole 2: the ace on 2 is the plain $2
  assert.deepEqual(roundResults(changeBets(r0, { ...r0.settings.aces, carry: false }, 2)).balances, { a: 6, b: 0, c: -6 });
});

test('a house rule carry switched off from a hole drops what was riding: Sixes', () => {
  // Every match halved except the third, which A's birdie on 13 wins for A's side
  const r0 = card(mk('sixes', ['a', 'b', 'c', 'd'], { sixes: { stake: 5, mode: 'match', carry: true } }, { holes: 18, hc: false }),
    Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, i === 12 ? [3, 4, 4, 4] : [4, 4, 4, 4]])));
  assert.deepEqual(gameResults(r0).detail.matches.map(m => m.net), [0, 0, 15]);
  // The second match played with the rule off: the first match's carry is gone by the third
  const off = changeBets(changeBets(r0, { ...r0.settings.sixes, carry: false }, 7), { ...r0.settings.sixes, carry: true }, 13);
  assert.deepEqual(gameResults(off).detail.matches.map(m => m.net), [0, 0, 5]);
});
