// House rules added 2026-10-03: Quota's three (double bogey −1, front, back and total, everyone over
// quota shares the pot) and one more for each of the other games. Every one starts off, so each is
// checked three ways where it moves money: a round saved before the rule (no key), the rule off, and on.
// Hand-worked cases on flat courses (par 4s, handicaps off), so every number checks on a napkin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, roundResults, wolfFor, wholeRoundOnly, rabbitTable, totalsPots, bankerPress, sidesNets, sides, greenieCarryBefore } from './round.js';
import { quotaPoints, vegasHole, ninesPoints, settleTotals, snakeHolder } from './games.js';
import { houseRulesLine } from './house-rules.js';
import { houseRulesFor, agreementItems } from './agreed.js';
import { stakeSummary } from './stakes.js';

// The game defaults as a new round gets them (store.js can't load outside the browser)
const DEFAULTS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off', par3Triple: false },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2, turnPress: false, noLastPress: false, teamScore: 'best' },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void', backDouble: false },
  wolf: { point: 2, loneMultiplier: 2, blind: false, blindPlus: 1 },
  match: { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best' },
  hammer: { stake: 5, max: 3, who: 'either', birdie: false },
  vegas: { point: 1, birdieFlip: true, birdieDouble: false, daytona: false },
  sixes: { stake: 5, mode: 'match', carry: false, teamScore: 'best' },
  scramble: { stake: 5, drives: 0, second: false },
  stroke: { stake: 5, payout: 'pot', cap: false, nassau: false },
  stableford: { stake: 5, payout: 'pot', modified: false, nassau: false },
  quota: { stake: 5, payout: 'pot', nassau: false, minus: false, split: 'top' },
  nines: { point: 1, sweep: false, birdie: false },
  aces: { ace: 2, deuce: 1, carry: false },
  bbb: { value: 1, sweep: false, netBongo: false },
  dots: { value: 1, auto: true, greenieCarry: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: false } },
  rabbit: { stake: 5, mode: 'free', tiesFree: false, sixes: false },
  snake: { stake: 5, growth: 'flat', nines: false, cap: 4, fourPutt: false },
};
// Par 4s, except par 3s on holes 3 and 12
const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: i === 2 || i === 11 ? 3 : 4, hdcp: i + 1 })) });
const NAMES = { a: 'Ann', b: 'Bo', c: 'Cy', d: 'Di', e: 'Ed', f: 'Flo' };
function mk(game, ids, { set = {}, teams = null, holes = 9 } = {}) {
  const settings = structuredClone(DEFAULTS);
  settings[game] = { ...settings[game], ...set };
  const players = ids.map(id => ({ id, name: NAMES[id], index: 0 }));
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players, settings, hcPct: 100, useHandicaps: false, teams });
}
/** Par for everyone on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  const units = r.game === 'scramble' ? r.teams : r.players;
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(units.map(p => [p.id, h.par])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
const zero = b => Math.round(Object.values(b).reduce((x, v) => x + v * 100, 0));
/** The same round three ways: saved before the rule existed, rule off, rule on. */
function threeWays(game, ids, key, on, build, opts = {}) {
  const before = build(mk(game, ids, opts));
  delete before.settings[game][key];
  const off = build(mk(game, ids, { ...opts, set: { ...opts.set, [key]: DEFAULTS[game][key] } }));
  const yes = build(mk(game, ids, { ...opts, set: { ...opts.set, [key]: on } }));
  return { before: bal(before), off: bal(off), on: bal(yes) };
}

test('every house rule added 2026-10-03 starts off in the app defaults', () => {
  const src = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
  const line = game => src.split('\n').find(l => l.trim().startsWith(`${game}: {`));
  assert.match(line('banker'), /par3Triple: false/);
  assert.match(line('nassau'), /teamScore: 'best'/);
  assert.match(line('match'), /teamScore: 'best'/);
  assert.match(line('sixes'), /teamScore: 'best'/);
  assert.match(line('skins'), /backDouble: false/);
  assert.doesNotMatch(line('wolf'), /lastWolf: true/);
  assert.match(line('hammer'), /birdie: false/);
  assert.match(line('vegas'), /daytona: false/);
  assert.match(line('scramble'), /second: false/);
  assert.match(line('stroke'), /nassau: false/);
  assert.match(line('stableford'), /nassau: false/);
  assert.match(line('quota'), /nassau: false, minus: false, split: 'top'/);
  assert.match(line('nines'), /birdie: false/);
  assert.match(line('bbb'), /netBongo: false/);
  assert.match(line('dots'), /greenieCarry: false/);
  assert.match(line('rabbit'), /sixes: false/);
  assert.match(line('snake'), /fourPutt: false/);
  for (const [game, gs] of Object.entries(DEFAULTS)) {
    if (game === 'hcPct') continue;
    assert.equal(houseRulesLine(game, gs), '', game);
    for (const h of houseRulesFor(game, gs)) if (['par3Triple', 'teamScore', 'backDouble', 'lastWolf', 'birdie', 'daytona', 'second', 'nassau', 'minus', 'split', 'netBongo', 'greenieCarry', 'sixes', 'fourPutt'].includes(h.id)) assert.equal(h.on, false, `${game} ${h.id}`);
  }
});

// ---------------------------------------------------------------------------
// Quota: double bogey or worse is −1

test('quotaPoints minus: double bogey or worse is -1, everything else the same', () => {
  assert.deepEqual([7, 6, 5, 4, 3, 2].map(g => quotaPoints(g, 4)), [0, 0, 1, 2, 4, 8]);
  assert.deepEqual([7, 6, 5, 4, 3, 2].map(g => quotaPoints(g, 4, { minus: true })), [-1, -1, 1, 2, 4, 8]);
});

test('quota minus: per point, a double bogey costs one point more', () => {
  // Nine holes, quota 18 each. Ann doubles hole 1: 16 points (0) or 15 (−1) against Bo's 18
  const build = r => scores(r, 9, { 1: { a: 6 } });
  const q = threeWays('quota', ['a', 'b'], 'minus', true, build, { set: { payout: 'per', stake: 5 } });
  assert.deepEqual(q.before, { a: -10, b: 10 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: -15, b: 15 });
});

test('quota minus: in a pot the minus point can change the winner', () => {
  // Ann: a birdie (4) and a double (0, or −1 with the rule), pars otherwise: 18 against 18, or 17.
  // Cy: one bogey, pars otherwise: 17, one under. Off, Ann wins; on, they tie and split the pot
  const build = r => scores(r, 9, { 1: { a: 3 }, 2: { a: 6 }, 4: { c: 5 } });
  const q = threeWays('quota', ['a', 'c'], 'minus', true, build);
  assert.deepEqual(q.before, { a: 5, c: -5 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: 0, c: 0 });
});

// ---------------------------------------------------------------------------
// Quota, Stroke play, Stableford: front, back and total

test('quota front, back and total: three pots, the nines against half quota', () => {
  // Ann birdies hole 1 (+2 on the front); Bo birdies 10 and 11 (+4 on the back and the 18)
  const build = r => scores(r, 18, { 1: { a: 3 }, 10: { b: 3 }, 11: { b: 3 } });
  const q = threeWays('quota', ['a', 'b', 'c'], 'nassau', true, build, { holes: 18 });
  // One pot: Bo takes $15. Three: Ann the front, Bo the back and the 18
  assert.deepEqual(q.before, { a: -5, b: 10, c: -5 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: 0, b: 15, c: -15 });
  assert.equal(zero(q.on), 0);
  const r = build(mk('quota', ['a', 'b', 'c'], { holes: 18, set: { nassau: true } }));
  const pots = roundResults(r).detail.pots;
  assert.deepEqual(pots.map(p => p.key), ['front', 'back', 'total']);
  assert.deepEqual(pots[0].totals, { a: 2, b: 0, c: 0 });
});

test('front, back and total: a back nine with nothing played has no pot yet; nine holes is one pot', () => {
  const r = scores(mk('quota', ['a', 'b'], { holes: 18, set: { nassau: true } }), 5, { 1: { a: 3 } });
  const pots = totalsPots(r, ['a', 'b']);
  assert.deepEqual(pots.map(p => p.key), ['front', 'total']);
  // Front and the 18 so far both to Ann: $10
  assert.deepEqual(bal(r), { a: 10, b: -10 });
  const nine = scores(mk('quota', ['a', 'b'], { set: { nassau: true } }), 9, { 1: { a: 3 } });
  assert.deepEqual(bal(nine), { a: 5, b: -5 });
  assert.equal(roundResults(nine).detail.pots, undefined);
  // Per point ignores it: every point is paid once
  const per = scores(mk('quota', ['a', 'b'], { holes: 18, set: { nassau: true, payout: 'per', stake: 1 } }), 18, { 1: { a: 3 } });
  assert.deepEqual(bal(per), { a: 2, b: -2 });
});

test('stroke play front, back and total: low net on each nine and the 18', () => {
  const build = r => scores(r, 18, { 1: { a: 3 }, 2: { a: 3 }, 10: { b: 3 }, 14: { c: 5 } });
  const s = threeWays('stroke', ['a', 'b', 'c'], 'nassau', true, build, { holes: 18 });
  // The 18: Ann −2 wins. Front: Ann. Back: Bo
  assert.deepEqual(s.before, { a: 10, b: -5, c: -5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 15, b: 0, c: -15 });
});

test('stableford front, back and total: a tied nine splits its pot', () => {
  const build = r => scores(r, 18, { 1: { a: 3 }, 2: { b: 3 }, 12: { b: 2 } });
  const s = threeWays('stableford', ['a', 'b'], 'nassau', true, build, { holes: 18 });
  // Front tied (3 + 3 points over par), back and the 18 to Bo
  assert.deepEqual(s.before, { a: -5, b: 5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: -10, b: 10 });
});

// ---------------------------------------------------------------------------
// Quota: everyone over quota shares the pot

test('settleTotals over: the pot is shared by points over, best takes it when nobody is over', () => {
  assert.deepEqual(settleTotals({ a: 2, b: 4, c: -1 }, { stake: 5, lowerWins: false, over: true }), { a: 0, b: 5, c: -5 });
  assert.deepEqual(settleTotals({ a: 0, b: 0, c: -1 }, { stake: 5, lowerWins: false, over: true }), { a: 2.5, b: 2.5, c: -5 });
  assert.deepEqual(settleTotals({ a: 2, b: 4, c: -1 }, { stake: 5, lowerWins: false }), { a: -5, b: 10, c: -5 });
});

test('quota split over: Ann +2 and Bo +4 share the $15 pot a third and two thirds', () => {
  const build = r => scores(r, 9, { 1: { a: 3 }, 2: { b: 3 }, 4: { b: 3 } });
  const q = threeWays('quota', ['a', 'b', 'c'], 'split', 'over', build);
  assert.deepEqual(q.before, { a: -5, b: 10, c: -5 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: 0, b: 5, c: -5 });
  // With front, back and total, each pot is shared the same way
  const both = scores(mk('quota', ['a', 'b'], { holes: 18, set: { split: 'over', nassau: true } }), 18, { 1: { a: 3 }, 2: { b: 3 }, 3: { b: 2 } });
  // Front and the 18: Ann +2, Bo +4 (two birdies), so each $10 pot goes a third and two thirds,
  // −$1.67 and +$1.67. The back is all square: nobody over, a tie, everyone gets theirs back
  assert.deepEqual(bal(both), { a: -3.34, b: 3.34 });
  assert.equal(zero(bal(both)), 0);
});

// ---------------------------------------------------------------------------
// Banker: presses triple on par 3s

test('banker par 3 presses triple: 3× and 9× on a par 3, still 2× and 4× on a par 4', () => {
  const build = r => {
    scores(r, 4, { 3: { b: 2 }, 4: { b: 3 } });
    r.banker = {
      3: { banker: 'a', bets: { b: 5, c: 5 }, doubled: { b: true }, doubleBack: false },
      4: { banker: 'a', bets: { b: 5, c: 5 }, doubled: { b: true }, doubleBack: false },
    };
    return r;
  };
  const b = threeWays('banker', ['a', 'b', 'c'], 'par3Triple', true, build);
  // Bo wins both doubled bets: $10 + $10, or $15 on the par 3 + $10
  assert.deepEqual(b.before, { a: -20, b: 20, c: 0 });
  assert.deepEqual(b.off, b.before);
  assert.deepEqual(b.on, { a: -25, b: 25, c: 0 });
  const r = build(mk('banker', ['a', 'b', 'c'], { set: { par3Triple: true } }));
  r.banker[3].doubleBack = true;
  assert.equal(bal(r).b, 45 + 10);
  assert.equal(bankerPress(r, r.holes[2]), 3);
  assert.equal(bankerPress(r, r.holes[3]), 2);
});

// ---------------------------------------------------------------------------
// Nassau, Match play, Sixes: both balls count

test('nassau both balls: partners add up, so a 3 and a 6 lose to two 4s', () => {
  const build = r => scores(r, 9, { 1: { a: 3, b: 6, c: 4, d: 4 } });
  const n = threeWays('nassau', ['a', 'b', 'c', 'd'], 'teamScore', 'total', build, { teams: [['a', 'b'], ['c', 'd']] });
  // Best ball: Ann's 3 wins hole 1, so the first 4 and the 9 go to Ann and Bo. Both balls: 9 v 8
  assert.deepEqual(n.before, { a: 10, b: 10, c: -10, d: -10 });
  assert.deepEqual(n.off, n.before);
  assert.deepEqual(n.on, { a: -10, b: -10, c: 10, d: 10 });
});

test('both balls: a side missing a partner plays best ball that hole', () => {
  const r = scores(mk('match', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], set: { teamScore: 'total' } }), 2, { 2: { a: 3, b: 6, c: 4, d: 4 } });
  const [s0, s1] = sides(r);
  assert.deepEqual(sidesNets(r, s0, s1, r.holes[1]), [9, 8]);
  r.left = { b: 1 };
  delete r.scores[2].b;
  assert.deepEqual(sidesNets(r, s0, s1, r.holes[1]), [3, 4]);
});

test('match play and sixes both balls: money three ways', () => {
  const m = threeWays('match', ['a', 'b', 'c', 'd'], 'teamScore', 'total', r => scores(r, 9, { 1: { a: 3, b: 6 } }), { teams: [['a', 'b'], ['c', 'd']] });
  assert.deepEqual(m.before, { a: 10, b: 10, c: -10, d: -10 });
  assert.deepEqual(m.off, m.before);
  assert.deepEqual(m.on, { a: -10, b: -10, c: 10, d: 10 });
  // Sixes over nine: holes 1-3 are Ann & Bo v Cy & Di
  const s = threeWays('sixes', ['a', 'b', 'c', 'd'], 'teamScore', 'total', r => scores(r, 9, { 1: { a: 3, b: 6 } }));
  assert.deepEqual(s.before, { a: 5, b: 5, c: -5, d: -5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: -5, b: -5, c: 5, d: 5 });
});

// ---------------------------------------------------------------------------
// Skins: back nine doubles

test('skins back nine doubles: a back nine skin is worth twice, a carried front skin keeps its value', () => {
  const build = r => scores(r, 18, { 2: { a: 3 }, 11: { b: 3 } });
  const s = threeWays('skins', ['a', 'b', 'c'], 'backDouble', true, build, { holes: 18, set: { carryover: false } });
  // No carryovers. $2 a skin from each: Ann +4 (front), Bo +4 or +8 (back)
  assert.deepEqual(s.before, { a: 2, b: 2, c: -4 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 0, b: 6, c: -6 });
  // Nine front skins carried into hole 10: 9 × $2 + $4 from each of two
  const carry = threeWays('skins', ['a', 'b', 'c'], 'backDouble', true, r => scores(r, 10, { 10: { b: 3 } }), { holes: 18 });
  assert.deepEqual(carry.off, { a: -20, b: 40, c: -20 });
  assert.deepEqual(carry.on, { a: -22, b: 44, c: -22 });
});

test('skins back nine doubles: nothing changes in a pot or over nine holes', () => {
  const pot = scores(mk('skins', ['a', 'b', 'c'], { holes: 18, set: { backDouble: true, payout: 'pot' } }), 18, { 2: { a: 3 }, 11: { b: 3 } });
  const potOff = scores(mk('skins', ['a', 'b', 'c'], { holes: 18, set: { payout: 'pot' } }), 18, { 2: { a: 3 }, 11: { b: 3 } });
  assert.deepEqual(bal(pot), bal(potOff));
  const nine = scores(mk('skins', ['a', 'b', 'c'], { set: { backDouble: true, carryover: false } }), 9, { 8: { a: 3 } });
  assert.deepEqual(bal(nine), { a: 4, b: -2, c: -2 });
});

// ---------------------------------------------------------------------------
// Wolf: last place is the wolf on 17 and 18

test('wolf last place: whoever is furthest down is the wolf on 17 and 18', () => {
  const r = scores(mk('wolf', ['a', 'b', 'c', 'd'], { holes: 18 }), 16, { 1: { a: 3 }, 2: { c: 3 } });
  r.wolf = Object.fromEntries(r.holes.slice(0, 16).map((h, i) => [h.no, { wolf: ['a', 'b', 'c', 'd'][i % 4], partner: ['b', 'a', 'd', 'c'][i % 4] }]));
  // Hole 1: Ann & Bo win. Hole 2: Bo & Ann v... Bo is wolf with Ann, Cy birdies: Cy & Di win
  // Hole 2 makes it all square, so add a hole Di loses alone: hole 4, Di lone wolf, Ann birdies
  r.wolf[4] = { wolf: 'd', partner: null };
  r.scores[4] = { a: 3, b: 4, c: 4, d: 4 };
  // Off: the usual turn (Ann on 17, Bo on 18)
  assert.equal(wolfFor(r, 16), 'a');
  assert.equal(wolfFor(r, 17), 'b');
  r.settings.wolf.lastWolf = true;
  // Di lost a lone wolf hole (−$12 on top), so Di is last
  assert.equal(wolfFor(r, 16), 'd');
  assert.equal(wolfFor(r, 17), 'd');
  // Before 17, and on nine holes, the turn is as always
  assert.equal(wolfFor(r, 15), 'd');
  const nine = mk('wolf', ['a', 'b', 'c', 'd'], { set: { lastWolf: true } });
  assert.equal(wolfFor(nine, 8), 'a');
});

test('wolf last place: a tie for last keeps the usual turn when it is one of them', () => {
  const r = scores(mk('wolf', ['a', 'b', 'c', 'd'], { holes: 18, set: { lastWolf: true } }), 16);
  // Nothing won: everyone is tied for last, so the turn stands
  assert.equal(wolfFor(r, 16), 'a');
  assert.equal(wolfFor(r, 17), 'b');
});

// ---------------------------------------------------------------------------
// Hammer: birdie hammer

test('hammer birdie: winning with a real birdie is one more hammer; a fold is not', () => {
  const build = r => {
    scores(r, 3, { 1: { a: 3 }, 2: { a: 3 }, 4: {} });
    r.marks = { 2: { hammers: [1], conceded: null }, 3: { hammers: [0], conceded: 1 } };
    return r;
  };
  const h = threeWays('hammer', ['a', 'b'], 'birdie', true, build);
  // Hole 1: $5 or $10. Hole 2 hammered: $10 or $20. Hole 3 folded by Bo: $5 either way
  assert.deepEqual(h.before, { a: 20, b: -20 });
  assert.deepEqual(h.off, h.before);
  assert.deepEqual(h.on, { a: 35, b: -35 });
});

// ---------------------------------------------------------------------------
// Vegas: Daytona

test('vegasHole daytona: no par or better puts the high number first', () => {
  // A 5 and 6 (no par) is 65 with Daytona; B's 4 and 5 is 45
  assert.equal(vegasHole([[5, 6], [4, 5]], [[5, 6], [4, 5]], 4).diff, -11);
  assert.equal(vegasHole([[5, 6], [4, 5]], [[5, 6], [4, 5]], 4, { daytona: true }).diff, -20);
  // Both teams with a par: nothing changes
  assert.equal(vegasHole([[4, 6], [4, 5]], [[4, 6], [4, 5]], 4, { daytona: true }).diff, -1);
  // A birdie flip still flips
  assert.deepEqual(vegasHole([[3, 4], [5, 6]], [[3, 4], [5, 6]], 4, { daytona: true }).numbers, [34, 65]);
});

test('vegas daytona: money three ways', () => {
  const build = r => scores(r, 2, { 1: { a: 5, b: 6 } });
  const v = threeWays('vegas', ['a', 'b', 'c', 'd'], 'daytona', true, build, { teams: [['a', 'b'], ['c', 'd']] });
  // 56 (or 65) against 44
  assert.deepEqual(v.before, { a: -12, b: -12, c: 12, d: 12 });
  assert.deepEqual(v.off, v.before);
  assert.deepEqual(v.on, { a: -21, b: -21, c: 21, d: 21 });
});

// ---------------------------------------------------------------------------
// Scramble: second gets its money back

test('scramble second: with three teams the runner-up takes back its stake', () => {
  const teams = [['a', 'b'], ['c', 'd'], ['e', 'f']];
  const build = r => { scores(r, 9); const [t0, t1] = r.teams; r.scores[1][t0.id] = 2; r.scores[2][t1.id] = 3; return r; };
  const s = threeWays('scramble', ['a', 'b', 'c', 'd', 'e', 'f'], 'second', true, build, { teams });
  assert.deepEqual(s.before, { a: 10, b: 10, c: -5, d: -5, e: -5, f: -5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 5, b: 5, c: 0, d: 0, e: -5, f: -5 });
  // A tie for second: winner takes all
  const tie = build(mk('scramble', ['a', 'b', 'c', 'd', 'e', 'f'], { teams, set: { second: true } }));
  tie.scores[2][tie.teams[2].id] = 3;
  assert.deepEqual(bal(tie), { a: 10, b: 10, c: -5, d: -5, e: -5, f: -5 });
});

// ---------------------------------------------------------------------------
// Nines: birdie wins 7

test('ninesPoints birdie: an outright win with a birdie is 7-1-1, a sweep still 9', () => {
  assert.deepEqual(ninesPoints([3, 4, 5], { birdies: [true, false, false] }), [7, 1, 1]);
  assert.deepEqual(ninesPoints([3, 3, 5], { birdies: [true, true, false] }), [4, 4, 1]);
  assert.deepEqual(ninesPoints([4, 3, 5], { birdies: [false, false, false] }), [3, 5, 1]);
  assert.deepEqual(ninesPoints([2, 4, 5], { sweep: true, birdies: [true, false, false] }), [9, 0, 0]);
});

test('nines birdie: money three ways', () => {
  const n = threeWays('nines', ['a', 'b', 'c'], 'birdie', true, r => scores(r, 1, { 1: { a: 3, c: 5 } }));
  // 5-3-1 is +2, 0, −2; 7-1-1 is +4, −2, −2
  assert.deepEqual(n.before, { a: 2, b: 0, c: -2 });
  assert.deepEqual(n.off, n.before);
  assert.deepEqual(n.on, { a: 4, b: -2, c: -2 });
});

// ---------------------------------------------------------------------------
// Bingo Bango Bongo: Bongo is low net

test('bbb net bongo: the third point goes to the outright low score, a tie gives nobody it', () => {
  const build = r => {
    scores(r, 2, { 1: { c: 3 } });
    r.marks = { 1: { bingo: 'a', bango: 'b', bongo: 'a' }, 2: { bingo: 'a', bango: 'b', bongo: 'a' } };
    return r;
  };
  const b = threeWays('bbb', ['a', 'b', 'c'], 'netBongo', true, build);
  // Off: Ann 4 points, Bo 2, Cy 0. On: Ann 2, Bo 2, Cy 1 (low net on hole 1; hole 2 all par, nobody)
  assert.deepEqual(b.before, { a: 6, b: 0, c: -6 });
  assert.deepEqual(b.off, b.before);
  assert.deepEqual(b.on, { a: 1, b: 1, c: -2 });
});

// ---------------------------------------------------------------------------
// Dots: greenies carry

test('dots greenies carry: a par 3 with no greenie makes the next one worth two', () => {
  const build = r => {
    scores(r, 12);
    r.marks = { 12: { b: ['greenie'] } };
    return r;
  };
  const d = threeWays('dots', ['a', 'b', 'c'], 'greenieCarry', true, build, { holes: 18 });
  // Hole 3 has no greenie, so Bo's on 12 is 2 dots: $1 a dot from each of two
  assert.deepEqual(d.before, { a: -1, b: 2, c: -1 });
  assert.deepEqual(d.off, d.before);
  assert.deepEqual(d.on, { a: -2, b: 4, c: -2 });
});

test('greenieCarryBefore: what the play screen shows riding on a par 3', () => {
  const r = scores(mk('dots', ['a', 'b', 'c'], { holes: 18, set: { greenieCarry: true } }), 11);
  assert.equal(greenieCarryBefore(r, r.holes[11]), 1);
  assert.equal(greenieCarryBefore(r, r.holes[2]), 0);
  assert.equal(greenieCarryBefore(r, r.holes[10]), 0);
  r.marks = { 3: { a: ['greenie'] } };
  assert.equal(greenieCarryBefore(r, r.holes[11]), 0);
  const off = scores(mk('dots', ['a', 'b', 'c'], { holes: 18 }), 11);
  assert.equal(greenieCarryBefore(off, off.holes[11]), 0);
});

// ---------------------------------------------------------------------------
// Rabbit: three rabbits

test('rabbit three rabbits: one every six holes, and it covers the whole round', () => {
  const build = r => scores(r, 18, { 2: { a: 3 }, 8: { b: 3 }, 14: { c: 3 } });
  const t = threeWays('rabbit', ['a', 'b', 'c'], 'sixes', true, build, { holes: 18, set: { mode: 'steal' } });
  // Steal it. Nines: Bo holds it at the turn (caught on 8), Cy after 18. Sixes: Ann, Bo, Cy one each
  assert.deepEqual(t.before, { a: -10, b: 5, c: 5 });
  assert.deepEqual(t.off, t.before);
  assert.deepEqual(t.on, { a: 0, b: 0, c: 0 });
  const r = build(mk('rabbit', ['a', 'b', 'c'], { holes: 18, set: { sixes: true, mode: 'steal' } }));
  assert.deepEqual(rabbitTable(r).legs.map(l => [l.seg.label, l.holder]), [['Holes 1–6', 'a'], ['Holes 7–12', 'b'], ['Holes 13–18', 'c']]);
  assert.equal(wholeRoundOnly('rabbit', { sixes: false }, { sixes: true }), true);
  assert.equal(wholeRoundOnly('rabbit', { stake: 5 }, { stake: 10 }), false);
});

// ---------------------------------------------------------------------------
// Snake: four-putts count twice

test('snakeHolder counts a four-putt twice', () => {
  assert.deepEqual(snakeHolder([{ putts: ['a'] }, { putts: ['b'], fours: ['b'] }]), { holder: 'b', count: 3, history: ['a', 'b'] });
});

test('snake four-putts: a growing snake gets two units, a flat one is the same', () => {
  const build = r => { r.marks = { 1: { snake: ['a'] }, 2: { snake: ['b'], snake4: ['b'] } }; return r; };
  const s = threeWays('snake', ['a', 'b', 'c'], 'fourPutt', true, build, { set: { growth: 'grow' } });
  // $5 a three-putt: two three-putts is $10 from Bo to each; with the four-putt, three: $15
  assert.deepEqual(s.before, { a: 10, b: -20, c: 10 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 15, b: -30, c: 15 });
  const flat = build(mk('snake', ['a', 'b', 'c'], { set: { fourPutt: true } }));
  assert.deepEqual(bal(flat), { a: 5, b: -10, c: 5 });
});

// ---------------------------------------------------------------------------
// The words

test('the bet line names each rule that is on', () => {
  const s = structuredClone(DEFAULTS);
  Object.assign(s.quota, { minus: true, nassau: true, split: 'over' });
  assert.equal(houseRulesLine('quota', s.quota), 'double bogey −1 · front, back and total · everyone over quota shares');
  assert.match(stakeSummary('quota', s), /front, back and total/);
  assert.equal(houseRulesLine('quota', { ...s.quota, payout: 'per' }), 'double bogey −1');
  assert.equal(houseRulesLine('snake', { ...s.snake, fourPutt: true }), '');
  assert.equal(houseRulesLine('snake', { ...s.snake, fourPutt: true, growth: 'double' }), 'four-putts count twice');
  assert.equal(houseRulesLine('wolf', { ...s.wolf, lastWolf: true }), 'last place is wolf on 17 and 18');
});

test('the first-tee card lists the new rules that are on, and only those', () => {
  const r = mk('quota', ['a', 'b'], { holes: 18, set: { minus: true, nassau: true } });
  const rules = agreementItems(r, {}).filter(i => i.group === 'rules');
  assert.deepEqual(rules.filter(i => i.on).map(i => i.text), ['Double bogey or worse is −1', 'Front, back and total: a pot each, nines against half quota']);
  const bet = agreementItems(r, {}).find(i => i.id === 'bet:main');
  assert.doesNotMatch(bet.text, /front, back/);
});

// ---------------------------------------------------------------------------
// Review fixes (2026-10-03)

test('front, back and total: two players level against their quotas on a nine split it, whatever the quotas', () => {
  // Ann plays off 0 (quota 36, 18 a nine) and Bo off 2 (quota 34, 17 a nine). Both are +2 on the
  // front. Adding up a 34th-of-18 hole by hole used to leave Bo 2.0000000000000004 and hand him the pot
  const players = [{ id: 'a', name: 'Ann', index: 0 }, { id: 'b', name: 'Bo', index: 2 }, { id: 'c', name: 'Cy', index: 0 }];
  const settings = structuredClone(DEFAULTS);
  Object.assign(settings.quota, { nassau: true });
  const r = createRound({ id: 'r', game: 'quota', course: flat(18), holesCount: 18, players, settings, hcPct: 100, useHandicaps: true });
  assert.deepEqual(r.players.map(p => p.courseHc), [0, 2, 0]);
  // Ann: a birdie on 1 (20 points on the front). Bo: a birdie on 1 and a bogey on 2 (19)
  scores(r, 18, { 1: { a: 3, b: 3 }, 2: { b: 5 } });
  const front = roundResults(r).detail.pots.find(p => p.key === 'front');
  assert.deepEqual(front.totals, { a: 2, b: 2, c: 0 });
  assert.deepEqual(front.deltas, { a: 2.5, b: 2.5, c: -5 });
  assert.equal(zero(bal(r)), 0);
});

test('settleTotals over: float dust above zero is not over quota', () => {
  assert.deepEqual(settleTotals({ a: 1e-15, b: 0, c: -1 }, { stake: 5, lowerWins: false, over: true }), { a: 2.5, b: 2.5, c: -5 });
});

test('a 9-hole round never lists the rules that only play over 18', () => {
  const s = structuredClone(DEFAULTS);
  assert.equal(houseRulesLine('wolf', { ...s.wolf, lastWolf: true }, 9), '');
  assert.equal(houseRulesLine('rabbit', { ...s.rabbit, sixes: true }, 9), '');
  assert.equal(houseRulesLine('skins', { ...s.skins, backDouble: true }, 9), '');
  assert.equal(houseRulesLine('stroke', { ...s.stroke, nassau: true }, 9), '');
  assert.equal(houseRulesLine('quota', { ...s.quota, nassau: true, minus: true }, 9), 'double bogey −1');
  assert.doesNotMatch(stakeSummary('wolf', { ...s, wolf: { ...s.wolf, lastWolf: true } }, 9), /last place/);
  for (const [game, set] of [['wolf', { lastWolf: true }], ['rabbit', { sixes: true }], ['skins', { backDouble: true }], ['quota', { nassau: true }], ['stableford', { nassau: true }]]) {
    const ids = game === 'wolf' ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'];
    const nine = mk(game, ids, { set });
    const on = agreementItems(nine, {}).filter(i => i.group === 'rules' && i.on && i.id.endsWith(Object.keys(set)[0]));
    assert.deepEqual(on, [], game);
    const full = mk(game, ids, { set, holes: 18 });
    assert.equal(agreementItems(full, {}).filter(i => i.group === 'rules' && i.on && i.id.endsWith(Object.keys(set)[0])).length, 1, game);
  }
});

test('the first-tee card lists both balls count only for 2 v 2', () => {
  const on = r => agreementItems(r, {}).filter(i => i.group === 'rules' && i.on).map(i => i.text);
  const solo = mk('nassau', ['a', 'b'], { set: { teamScore: 'total' } });
  assert.deepEqual(on(solo), []);
  const four = mk('nassau', ['a', 'b', 'c', 'd'], { set: { teamScore: 'total' }, teams: [['a', 'b'], ['c', 'd']] });
  assert.deepEqual(on(four), ['Both balls count (partners’ scores added up)']);
});
