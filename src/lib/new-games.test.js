// Snake, Hammer, the skins house rules and the Nassau press house rules: hand-worked cases.
// Every case plays the flat nine (par 4s, handicaps off) or a flat eighteen so the sums are easy to check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRound, roundResults, livePreview, snakeTable, hammerTable, hammerOptions, skinsTable, nassauPressOptions,
  changeBets, wholeRoundOnly, leftRule,
} from './round.js';
import { snakeValue, snakeHolder, canHammer, hammerHole } from './games.js';
import { pressOpportunities, nassauLegs } from './golf.js';
import { revealSteps } from './reveal.js';
import { stakeSummary } from './stakes.js';
import { migrateSettings, SNAKE_CAP_DEFAULT } from './settings.js';
import { readFileSync } from 'node:fs';

const SETTINGS = {
  hcPct: 100,
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2, turnPress: false, noLastPress: false },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  hammer: { stake: 5, max: 3, who: 'either' },
  snake: { stake: 5, growth: 'flat', nines: false },
};
const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const PEOPLE = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss'].map((name, i) => ({ id: 'abcd'[i], name, index: i * 6 }));

function round(game, ids, { holes = 9, settings = {}, teams = null, useHandicaps = false } = {}) {
  const s = structuredClone(SETTINGS);
  for (const [k, v] of Object.entries(settings)) s[k] = { ...s[k], ...v };
  return createRound({
    id: 'r', game, course: flat(holes), holesCount: holes, players: ids.map(id => PEOPLE.find(p => p.id === id)),
    settings: s, hcPct: 100, useHandicaps, teams,
  });
}
/** Par for everyone on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
const zero = b => Math.round(Object.values(b).reduce((a, v) => a + v * 100, 0));

// ---------------------------------------------------------------------------
// Snake

test('snakeValue: fixed, growing and doubling', () => {
  assert.equal(snakeValue(0, 5, 'flat'), 0);
  assert.equal(snakeValue(4, 5, 'flat'), 5);
  assert.equal(snakeValue(4, 1, 'grow'), 4); // $1 a three-putt, four of them: $4
  assert.equal(snakeValue(4, 1, 'double'), 8); // 1, 2, 4, 8
});

test('snakeHolder: the last three-putt holds it, and it counts every three-putt', () => {
  const { holder, count, history } = snakeHolder([{ putts: ['a'] }, { putts: [] }, { putts: ['b', 'c'] }, { putts: undefined }]);
  assert.equal(holder, 'c');
  assert.equal(count, 3);
  assert.deepEqual(history, ['a', 'a', 'c', 'c']);
});

test('snake: the holder at the end pays each other player the snake', () => {
  const r = scores(round('snake', ['a', 'b', 'c', 'd']), 9);
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  r.marks[2] = { snake: ['a'] };
  r.marks[6] = { snake: ['b'] };
  // Bo holds it at the end: $5 to each of the other three
  assert.deepEqual(bal(r), { a: 5, b: -15, c: 5, d: 5 });
  const t = snakeTable(r);
  assert.equal(t.legs.length, 1);
  assert.equal(t.legs[0].holder, 'b');
});

test('snake: a growing snake adds the stake for every three-putt', () => {
  const r = scores(round('snake', ['a', 'b', 'c'], { settings: { snake: { stake: 1, growth: 'grow' } } }), 9);
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  r.marks[1] = { snake: ['a'] };
  r.marks[3] = { snake: ['b', 'c'] }; // Cy three-putted last on the 3rd
  r.marks[8] = { snake: ['c'] };
  // Four three-putts at $1: Cy pays $4 to each of the other two
  assert.deepEqual(bal(r), { a: 4, b: 4, c: -8 });
});

test('snake: each nine is its own snake, and a doubling snake doubles', () => {
  const r = scores(round('snake', ['a', 'b'], { holes: 18, settings: { snake: { stake: 1, growth: 'double', nines: true } } }), 18);
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  r.marks[2] = { snake: ['a'] };
  r.marks[4] = { snake: ['b'] };
  r.marks[5] = { snake: ['a'] }; // front: three three-putts, Ann holds a $4 snake
  r.marks[12] = { snake: ['b'] }; // back: one three-putt, Bo holds a $1 snake
  const t = snakeTable(r);
  assert.equal(t.legs.length, 2);
  assert.deepEqual(t.legs.map(l => [l.holder, l.value]), [['a', 4], ['b', 1]]);
  assert.deepEqual(bal(r), { a: -3, b: 3 });
});

// Snake cap (decided 2026-09-28): a doubling snake stops after `cap` doubles, 4 for new rounds.
// A round saved before the cap existed has no cap setting and keeps doubling, so its money never moves.

/** Three-putts on holes 1..n of a round, passed back and forth between the players in `ids`. */
function passSnake(r, n, ids) {
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  for (let i = 0; i < n; i++) r.marks[r.holes[i].no] = { snake: [ids[i % ids.length]] };
  return r;
}

test('snakeValue: a capped doubling snake stops at the cap and stays there', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(k => snakeValue(k, 5, 'double', 4)), [5, 10, 20, 40, 80, 80, 80]);
  assert.deepEqual([1, 2, 3, 4].map(k => snakeValue(k, 5, 'double', 2)), [5, 10, 20, 20]);
  // No cap (0 or unset) keeps doubling
  assert.equal(snakeValue(7, 5, 'double', 0), 320);
  assert.equal(snakeValue(7, 5, 'double'), 320);
  // The cap only touches a doubling snake
  assert.equal(snakeValue(7, 5, 'grow', 4), 35);
  assert.equal(snakeValue(7, 5, 'flat', 4), 5);
});

test('snake cap: reached and held, the holder pays the capped amount', () => {
  // Seven three-putts on a $5 snake capped at 4 doubles: 5, 10, 20, 40, 80, then it stays at $80
  const r = passSnake(scores(round('snake', ['a', 'b', 'c'], { settings: { snake: { stake: 5, growth: 'double', cap: 4 } } }), 9), 7, ['a', 'b']);
  const t = snakeTable(r);
  assert.equal(t.legs[0].count, 7);
  assert.equal(t.legs[0].holder, 'a');
  assert.equal(t.legs[0].value, 80);
  assert.equal(t.legs[0].cap, 4);
  assert.deepEqual(bal(r), { a: -160, b: 80, c: 80 });
  assert.equal(zero(bal(r)), 0);
  assert.equal(stakeSummary('snake', r.settings), '$5 a snake, doubling to $80');
});

test('snake cap: no cap keeps doubling', () => {
  const r = passSnake(scores(round('snake', ['a', 'b'], { settings: { snake: { stake: 5, growth: 'double', cap: 0 } } }), 9), 7, ['a', 'b']);
  assert.equal(snakeTable(r).legs[0].value, 320);
  assert.deepEqual(bal(r), { a: -320, b: 320 });
  assert.equal(stakeSummary('snake', r.settings), '$5 a snake, doubling');
});

test('snake cap: each nine has its own snake, each capped', () => {
  const r = scores(round('snake', ['a', 'b'], { holes: 18, settings: { snake: { stake: 1, growth: 'double', nines: true, cap: 2 } } }), 18);
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  for (const no of [1, 2, 3, 4, 5]) r.marks[no] = { snake: [no % 2 ? 'a' : 'b'] }; // front: five three-putts, Ann last
  r.marks[12] = { snake: ['b'] }; // back: one three-putt, a fresh $1 snake
  const t = snakeTable(r);
  // Front: $1, $2, $4, then held at $4 (2 doubles). Back starts over at $1.
  assert.deepEqual(t.legs.map(l => [l.holder, l.count, l.value]), [['a', 5, 4], ['b', 1, 1]]);
  assert.deepEqual(bal(r), { a: -3, b: 3 });
});

test('snake cap: a holder who leaves still pays the capped snake', () => {
  const r = passSnake(scores(round('snake', ['a', 'b', 'c', 'd'], { settings: { snake: { stake: 5, growth: 'double', cap: 4 } } }), 9), 6, ['a', 'b', 'c', 'd']);
  r.marks[6] = { snake: ['d'] }; // Di takes it on the 6th: the sixth three-putt, capped at $80
  r.left = { d: 7 };
  for (const h of r.holes.slice(7)) delete r.scores[h.no].d;
  assert.equal(snakeTable(r).legs[0].value, 80);
  assert.deepEqual(bal(r), { a: 80, b: 80, c: 80, d: -240 });
});

test('snake cap: new rounds default to 4 doubles', () => {
  assert.equal(SNAKE_CAP_DEFAULT, 4);
  // The app's game defaults start a snake with the 4-double cap
  const store = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
  assert.match(store, /snake: \{[^}]*cap: SNAKE_CAP_DEFAULT/);
  // Saved defaults from before the cap pick it up, so the next round starts capped
  const saved = migrateSettings({ rev: 2, snake: { stake: 5, growth: 'double', nines: false } });
  assert.equal(saved.snake.cap, 4);
  const r = passSnake(scores(round('snake', ['a', 'b'], { settings: { snake: saved.snake } }), 9), 7, ['a', 'b']);
  assert.equal(snakeTable(r).legs[0].value, 80);
  // A cap someone picked, No cap included, is kept
  assert.equal(migrateSettings({ rev: 2, snake: { stake: 5, growth: 'double', cap: 0 } }).snake.cap, 0);
  assert.equal(migrateSettings({ rev: 2, snake: { stake: 5, growth: 'double', cap: 2 } }).snake.cap, 2);
});

test('snake cap: a round saved before the cap existed keeps doubling, money unchanged', () => {
  // Saved round settings with no cap key at all
  const r = passSnake(scores(round('snake', ['a', 'b', 'c'], { settings: { snake: { stake: 5, growth: 'double', nines: false } } }), 9), 7, ['a', 'b']);
  assert.equal('cap' in r.settings.snake, false);
  assert.equal(snakeTable(r).legs[0].value, 320);
  assert.deepEqual(bal(r), { a: -640, b: 320, c: 320 });
  assert.equal(stakeSummary('snake', r.settings), '$5 a snake, doubling');
});

test('snake: an unfinished round pays whoever holds it now, and nobody three-putting pays nothing', () => {
  const r = scores(round('snake', ['a', 'b', 'c']), 4);
  r.holes.slice(0, 4).forEach(h => { r.marks[h.no] = { snake: [] }; });
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0 });
  r.marks[3] = { snake: ['c'] };
  assert.deepEqual(bal(r), { a: 5, b: 5, c: -10 });
});

test('snake: a holder who leaves still pays it to the players still there', () => {
  const r = scores(round('snake', ['a', 'b', 'c', 'd']), 9);
  r.holes.forEach(h => { r.marks[h.no] = { snake: [] }; });
  r.marks[3] = { snake: ['d'] };
  r.left = { d: 4 };
  for (const h of r.holes.slice(4)) delete r.scores[h.no].d;
  assert.deepEqual(bal(r), { a: 5, b: 5, c: 5, d: -15 });
  assert.match(leftRule(r, 'd'), /still pay/);
});

test('snake: the live money bar shows the three-putt as it is tapped', () => {
  const r = scores(round('snake', ['a', 'b']), 1);
  r.marks[1] = { snake: [] };
  const p = livePreview(r, r.holes[1], { scores: { a: 4, b: 4 }, marks: { snake: ['a'] } });
  assert.deepEqual(p.delta, { a: -5, b: 5 });
});

// ---------------------------------------------------------------------------
// Hammer

test('canHammer: either side throws first, then it alternates, up to the cap', () => {
  assert.equal(canHammer([], 0), true);
  assert.equal(canHammer([], 1), true);
  assert.equal(canHammer([0], 0), false); // no hammering twice in a row
  assert.equal(canHammer([0], 1), true);
  assert.equal(canHammer([0, 1, 0], 1, { max: 3 }), false); // cap reached
  assert.equal(canHammer([0, 1, 0], 1, { max: 0 }), true); // no limit
  assert.equal(canHammer([], 0, { who: 'trailing', behind: 1 }), false);
  assert.equal(canHammer([], 1, { who: 'trailing', behind: 1 }), true);
  assert.equal(canHammer([], 0, { who: 'trailing', behind: null }), true); // level: either side
  assert.equal(canHammer([0], 1, { conceded: 1 }), false);
});

test('hammerHole: played out doubles per hammer, a concession pays the value before the last hammer', () => {
  assert.deepEqual(hammerHole({ hammers: [] }, 0, 5), { winner: 0, value: 5, hammers: [], conceded: null });
  assert.equal(hammerHole({ hammers: [0, 1] }, 1, 5).value, 20);
  assert.equal(hammerHole({ hammers: [0, 1] }, null, 5).value, 0); // halved
  // Ann hammers to $10, Bo hammers back to $20, Ann folds: Bo wins $10
  assert.deepEqual(hammerHole({ hammers: [0, 1], conceded: 0 }, undefined, 5), { winner: 1, value: 10, hammers: [0, 1], conceded: 0 });
  // A side can't fold its own hammer
  assert.equal(hammerHole({ hammers: [0], conceded: 0 }, 1, 5).winner, 1);
});

test('hammer: 1 v 1 hole by hole', () => {
  const r = scores(round('hammer', ['a', 'b']), 3, { 1: { a: 3 }, 2: { b: 3 }, 3: { a: 5 } });
  r.marks[1] = { hammers: [1], conceded: null }; // Bo hammers, Ann wins anyway: $10
  r.marks[2] = { hammers: [0, 1], conceded: null }; // Bo wins at $20
  r.marks[3] = { hammers: [], conceded: null }; // Bo wins at $5
  assert.deepEqual(bal(r), { a: -15, b: 15 });
  const rows = hammerTable(r);
  assert.deepEqual(rows.slice(0, 3).map(x => x.net), [10, -20, -5]);
});

test('hammer: 2 v 2 pays each player, and a folded hole counts without scores', () => {
  const r = round('hammer', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  r.marks[1] = { hammers: [0], conceded: 1 }; // A hammers, B folds at $5
  assert.deepEqual(bal(r), { a: 5, b: 5, c: -5, d: -5 });
  const p = livePreview(round('hammer', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] }), { no: 1 }, { scores: {}, marks: { hammers: [0, 1, 0], conceded: 1 } });
  assert.deepEqual(p.balances, { a: 20, b: 20, c: -20, d: -20 });
});

test('hammer: only the side behind throws first with that option', () => {
  const r = scores(round('hammer', ['a', 'b'], { settings: { hammer: { who: 'trailing' } } }), 1, { 1: { a: 3 } });
  r.marks[1] = { hammers: [], conceded: null };
  // Ann won the 1st, so Bo is behind and throws first on the 2nd
  assert.deepEqual(hammerOptions(r, r.holes[1], { hammers: [] }), [false, true]);
  assert.deepEqual(hammerOptions(r, r.holes[1], { hammers: [1] }), [true, false]);
  // Level on the first hole: either side
  assert.deepEqual(hammerOptions(r, r.holes[0], { hammers: [] }), [true, true]);
});

test('hammer: a bet changed from the next hole on leaves earlier holes alone', () => {
  let r = scores(round('hammer', ['a', 'b']), 2, { 1: { a: 3 }, 2: { a: 3 } });
  r = changeBets(r, { ...r.settings.hammer, stake: 10 }, 2);
  assert.deepEqual(bal(r), { a: 15, b: -15 });
});

test('hammer and snake: reveal steps and bet summaries', () => {
  const h = scores(round('hammer', ['a', 'b']), 2, { 1: { a: 3 }, 2: { b: 3 } });
  h.marks[2] = { hammers: [0, 1], conceded: null };
  const hs = revealSteps(h, roundResults(h));
  assert.ok(hs.steps.some(x => x.label === 'Hole 2' && x.amount === 20));
  assert.equal(stakeSummary('hammer', h.settings), '$5 a hole · up to 3 hammers');
  const s = scores(round('snake', ['a', 'b']), 3);
  s.marks[2] = { snake: ['b'] };
  const ss = revealSteps(s, roundResults(s));
  assert.equal(ss.steps[0].text, 'Bo holds it, so pays $5 a player');
  assert.equal(ss.steps[0].amount, 5);
  assert.equal(stakeSummary('snake', s.settings), '$5 a snake');
});

test('hammer reveal: a lone player against two wins or pays for both, like the money', () => {
  const h = round('hammer', ['a', 'b', 'c'], { teams: [['a'], ['b', 'c']] });
  scores(h, 2, { 1: { a: 3 }, 2: { b: 3 } });
  h.marks[1] = { hammers: [1], conceded: null }; // Bo & Cy hammer, Ann wins the $10 hole: Ann +$20, Bo and Cy -$10 each
  h.marks[2] = { hammers: [0, 1], conceded: 0 }; // Ann folds the second hammer: $10 hole to Bo & Cy
  assert.deepEqual(bal(h), { a: 0, b: 0, c: 0 });
  const steps = revealSteps(h, roundResults(h)).steps;
  assert.equal(steps.find(x => x.label === 'Hole 1').amount, 20);
  assert.equal(steps.find(x => x.label === 'Hole 2').amount, 10);
});

// ---------------------------------------------------------------------------
// Skins house rules

test('skins: a round saved before the house rules plays as it did (net, per skin, carries void)', () => {
  const r = scores(round('skins', ['a', 'b', 'c']), 9, { 1: { a: 3 }, 9: { a: 5 } });
  r.settings.skins = { value: 2, carryover: true };
  assert.deepEqual(bal(r), { a: 4, b: -2, c: -2 });
  assert.equal(roundResults(r).detail.skins.unclaimed, 8); // holes 2 to 9 tied and nobody claims them
  assert.equal(stakeSummary('skins', r.settings), '$2 a skin · carryovers');
});

test('skins: split carries and pot shares come out in whole cents that sum to zero', () => {
  // Holes 1 to 8 tie, Di bogeys 9: Ann, Bo and Cy split the 9 carried skins, $9 a player, so Di pays $9
  const r = scores(round('skins', ['a', 'b', 'c', 'd'], { settings: { skins: { lastCarry: 'split', value: 1 } } }), 9, { 9: { d: 5 } });
  assert.deepEqual(bal(r), { a: 3, b: 3, c: 3, d: -9 });
  // Pot of $10 each with three players: Ann 2 skins, Bo 1, Cy 0 of a $30 pot
  const p = scores(round('skins', ['a', 'b', 'c'], { settings: { skins: { payout: 'pot', stake: 10 } } }), 9, { 1: { a: 3 }, 2: { b: 3 }, 3: { a: 3 } });
  assert.deepEqual(bal(p), { a: 10, b: 0, c: -10 });
  // $10 each with four players and three skins won one each: $40 / 3 does not split evenly
  const q = scores(round('skins', ['a', 'b', 'c', 'd'], { settings: { skins: { payout: 'pot', stake: 10 } } }), 9, { 1: { a: 3 }, 2: { b: 3 }, 3: { c: 3 } });
  const qb = bal(q);
  assert.equal(zero(qb), 0);
  for (const v of Object.values(qb)) assert.equal(Math.round(v * 100), v * 100);
  const won = roundResults(q).detail.skinsWon;
  for (const w of Object.values(won)) assert.equal(Math.round(w.amount * 100), w.amount * 100);
});

test('skins: gross and net together are two skins a hole', () => {
  // Handicaps on: Di (index 18) gets strokes. On hole 1 Ann makes 3 gross; Di makes 4 with a stroke (net 3) too
  const r = round('skins', ['a', 'd'], { useHandicaps: true, settings: { skins: { kind: 'both' } } });
  scores(r, 1, { 1: { a: 3, d: 4 } });
  const d = r.players.find(p => p.id === 'd');
  assert.ok(d.plays >= 9, 'Di gets a stroke on every hole of the nine');
  // Net: Ann 3, Di 3, tied (carries). Gross: Ann 3 beats Di 4: Ann wins the gross skin, $2
  assert.deepEqual(bal(r), { a: 2, d: -2 });
  assert.equal(skinsTable(r, 'gross').rows[0].winner, 'a');
  assert.equal(skinsTable(r, 'net').rows[0].winner, null);
});

test('skins: a pot is split by skins won', () => {
  // Four players put in $10 each. Ann wins 2 skins, Bo 1 (carryovers off): Ann takes 2/3 of $40
  const r = round('skins', ['a', 'b', 'c', 'd'], { settings: { skins: { payout: 'pot', carryover: false } } });
  scores(r, 9, { 1: { a: 3 }, 2: { a: 3 }, 5: { b: 3 } });
  const b = bal(r);
  assert.equal(zero(b), 0);
  assert.deepEqual(b, { a: 16.67, b: 3.33, c: -10, d: -10 });
  // No skins won: nobody pays
  const q = scores(round('skins', ['a', 'b'], { settings: { skins: { payout: 'pot' } } }), 9);
  assert.deepEqual(bal(q), { a: 0, b: 0 });
  assert.equal(wholeRoundOnly('skins', { payout: 'per' }, { payout: 'pot' }), true);
  assert.equal(stakeSummary('skins', r.settings), '$10 each in the pot');
});

test('skins: carryovers after the last hole are void, split or go to a playoff', () => {
  // Ann wins hole 7 (1 skin). Holes 8 and 9 tie between Ann and Bo, Cy worse on 9: two skins carried, worth $4
  const make = lastCarry => {
    const r = round('skins', ['a', 'b', 'c'], { settings: { skins: { lastCarry } } });
    return scores(r, 9, { 1: { c: 5 }, 7: { a: 3 }, 9: { a: 3, b: 3 } });
  };
  // Holes 1 to 6 tie (Cy's 5 on the 1st still leaves Ann and Bo tied), so 7 skins go to Ann on hole 7
  const v = make('void');
  assert.deepEqual(bal(v), { a: 28, b: -14, c: -14 });
  assert.equal(skinsTable(v).unclaimed, 2);
  // Split: Cy pays the $4 carry, shared by Ann and Bo
  const s = make('split');
  assert.deepEqual(bal(s), { a: 30, b: -12, c: -18 });
  assert.equal(skinsTable(s).unclaimed, 0);
  // Playoff: nothing moves until the winner is picked, then they take it as if they won the 9th
  const p = make('playoff');
  assert.deepEqual(bal(p), bal(v));
  p.skinsPlayoff = { net: 'b' };
  assert.deepEqual(bal(p), { a: 24, b: -6, c: -18 });
  // Only someone tied on the last hole can win the playoff
  p.skinsPlayoff = { net: 'c' };
  assert.deepEqual(bal(p), bal(v));
  // Reveal names the carry
  const steps = revealSteps(s, roundResults(s)).steps;
  assert.ok(steps.some(x => x.label === 'Ann' && x.amount === 30));
});

test('skins: the last-hole rule waits for the last hole, unless the round was finished early', () => {
  const r = round('skins', ['a', 'b'], { settings: { skins: { lastCarry: 'split' } } });
  scores(r, 5);
  assert.equal(skinsTable(r).end, null);
  r.status = 'done';
  assert.equal(skinsTable(r).end.skins, 5);
  // Split between the only two players: nobody else pays
  assert.deepEqual(bal(r), { a: 0, b: 0 });
});

test('skins: a player who leaves is out of the pot', () => {
  const r = round('skins', ['a', 'b', 'c'], { settings: { skins: { payout: 'pot', carryover: false } } });
  scores(r, 9, { 1: { c: 3 }, 2: { a: 3 } });
  r.left = { c: 1 };
  for (const h of r.holes.slice(1)) delete r.scores[h.no].c;
  // Cy's skin doesn't count and he doesn't put in: Ann and Bo's $20 pot goes to Ann
  assert.deepEqual(bal(r), { a: 10, b: -10, c: 0 });
  assert.match(leftRule(r, 'c'), /out of the pot/);
});

// ---------------------------------------------------------------------------
// Nassau press house rules

test('no press on the last hole of a leg', () => {
  const legs = nassauLegs(18);
  // Player 1 lost the 1st and halved the rest of the front: 1 down going to the 9th, with a 1-hole threshold
  const winners = { 1: 0, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null };
  const amounts = { front: 5, back: 5, total: 5 };
  assert.ok(pressOpportunities(winners, [], amounts, 9, 1, legs).some(o => o.leg === 'front'));
  assert.ok(!pressOpportunities(winners, [], amounts, 9, 1, legs, { noLast: true }).some(o => o.leg === 'front'));
  // The total can still be pressed on the 9th: it isn't its last hole
  assert.ok(pressOpportunities(winners, [], amounts, 9, 1, legs, { noLast: true }).some(o => o.leg === 'total'));
  // And nothing at all on the 18th
  const all = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, i === 0 ? 0 : null]));
  assert.deepEqual(pressOpportunities(all, [], amounts, 18, 1, legs, { noLast: true }), []);
});

test('press at the turn: the side that lost the front can press the back, however far down', () => {
  const r = round('nassau', ['a', 'b'], { holes: 18, settings: { nassau: { pressMode: 'off', turnPress: true } } });
  scores(r, 9, { 4: { a: 3 } }); // Ann wins the front 1 up
  const opts = nassauPressOptions(r, 10);
  assert.deepEqual(opts, [{ leg: 'back', trailing: 1, by: 1, turn: true }]);
  // Take it: a new $5 bet on the back from hole 10
  r.presses.push({ id: 't', leg: 'back', start: 10, by: 1 });
  assert.deepEqual(nassauPressOptions(r, 10), []);
  scores(r, 18, { 4: { a: 3 }, 12: { b: 3 } });
  // Front: Ann +5. Back: Bo 1 up, +5 and the press +5. Total: halved
  assert.deepEqual(bal(r), { a: -5, b: 5 });
  // Off without the house rule, and nothing on a halved front
  const off = scores(round('nassau', ['a', 'b'], { holes: 18, settings: { nassau: { pressMode: 'off' } } }), 9, { 4: { a: 3 } });
  assert.deepEqual(nassauPressOptions(off, 10), []);
  const halved = scores(round('nassau', ['a', 'b'], { holes: 18, settings: { nassau: { turnPress: true } } }), 9);
  assert.deepEqual(nassauPressOptions(halved, 10), []);
});
