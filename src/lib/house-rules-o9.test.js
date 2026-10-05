// House rules added 2026-10-05 (overnight 9). Every one starts off, so rounds from before give exactly
// the money they always did: o9-money.snapshot.json was taken with round.js before any of them went in,
// over seeded rounds of every game with the earlier house rules on at random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roundResults, createRound, wholeRoundOnly, addPlayerProblem, hammerTable, vegasScore, teamQuotaTable, nextQuotas, snakeTable, rabbitTable, skinsTable, changeBets } from './round.js';
import { quotaPoints, quotaAdjusted, stablefordPoints } from './games.js';
import { byeBets, autoPressStarts, settleBankerHole } from './golf.js';
import { houseRulesLine } from './house-rules.js';
import { houseRulesFor, agreementItems } from './agreed.js';
import { stakeSummary } from './stakes.js';
import { carriedQuotas, carriedLine } from './quota-carry.js';
import { o9Rounds } from './o9-money.fixtures.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./o9-money.snapshot.json', import.meta.url), 'utf8'));
const moneyOf = r => {
  const res = roundResults(r);
  const byGame = res.detail.byGame ? Object.fromEntries(Object.entries(res.detail.byGame).map(([k, v]) => [k, v.balances])) : undefined;
  return { balances: res.balances, pairs: res.pairs, ...(byGame ? { byGame } : {}) };
};

test('rounds saved before tonight give exactly the money they did, head to head and game by game', () => {
  const rounds = o9Rounds();
  assert.equal(rounds.length, Object.keys(SNAPSHOT).length);
  for (const { name, round } of rounds) assert.deepEqual(moneyOf(round), SNAPSHOT[name], name);
});

// ---------------------------------------------------------------------------
// The same rounds with every new rule's key saved as off: still exactly the same money


/** Every rule added tonight, as its off value. */
const OFF = {
  banker: { pressAll: false }, nassau: { bye: 'off' }, match: { bye: 'off' }, skins: { birdieDouble: false }, wolf: { birdieDouble: false },
  hammer: { carry: false }, vegas: { max9: false }, sixes: { press: false }, stroke: { gross: false }, stableford: { table: 'standard' },
  quota: { table: 'chicago', adjust: 'off', team: false }, rabbit: { backDouble: false }, snake: { split: false },
};
const offBlock = (game, block) => {
  if (!block || typeof block !== 'object') return block;
  const out = { ...block, ...(OFF[game] || {}) };
  if (game === 'dots') out.kinds = { ...(block.kinds || {}), threeputt: false, water: false, ob: false };
  return out;
};

test('the same rounds with every new rule saved as off give exactly the same money', () => {
  for (const { name, round } of o9Rounds()) {
    const r = structuredClone(round);
    r.settings = Object.fromEntries(Object.entries(r.settings).map(([g, b]) => [g, offBlock(g, b)]));
    for (const e of r.betHistory || []) e.settings = offBlock(r.game, e.settings);
    for (const sg of r.sideGames || []) { sg.settings = offBlock(sg.game, sg.settings); for (const e of sg.betHistory || []) e.settings = offBlock(sg.game, e.settings); }
    assert.deepEqual(moneyOf(r), SNAPSHOT[name], name);
  }
});

// ---------------------------------------------------------------------------
// Hand-worked rounds: flat courses (par 4s, par 3s on holes 3 and 12), handicaps off unless said

const DEFAULTS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off', par3Triple: false, pressAll: false },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2, turnPress: false, noLastPress: false, teamScore: 'best', bye: 'off' },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void', backDouble: false, birdieDouble: false },
  wolf: { point: 2, loneMultiplier: 2, blind: false, blindPlus: 1, birdieDouble: false },
  match: { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best', bye: 'off' },
  hammer: { stake: 5, max: 3, who: 'either', birdie: false, carry: false },
  vegas: { point: 1, birdieFlip: true, birdieDouble: false, daytona: false, max9: false },
  sixes: { stake: 5, mode: 'match', carry: false, teamScore: 'best', press: false },
  stroke: { stake: 5, payout: 'pot', cap: false, nassau: false, gross: false },
  stableford: { stake: 1, payout: 'per', modified: false, nassau: false, table: 'standard' },
  quota: { stake: 1, payout: 'per', nassau: false, minus: false, split: 'top', table: 'chicago', adjust: 'off', team: false },
  dots: { value: 1, auto: true, greenieCarry: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: false } },
  rabbit: { stake: 5, mode: 'free', tiesFree: false, sixes: false, backDouble: false },
  snake: { stake: 5, growth: 'flat', nines: false, cap: 4, fourPutt: false, split: false },
};
const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: i === 2 || i === 11 ? 3 : 4, hdcp: i + 1 })) });
const NAMES = { a: 'Ann', b: 'Bo', c: 'Cy', d: 'Di' };
function mk(game, ids, { set = {}, teams = null, holes = 9, index = {}, useHandicaps = false } = {}) {
  const settings = structuredClone(DEFAULTS);
  settings[game] = { ...settings[game], ...set };
  const players = ids.map(id => ({ id, name: NAMES[id], index: index[id] ?? 0 }));
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players, settings, hcPct: 100, useHandicaps, teams });
}
function scores(r, upto, over = {}) {
  r.holes.slice(0, upto).forEach(h => { r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, h.par])), ...(over[h.no] || {}) }; });
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
  return { before: bal(before), off: bal(off), on: bal(yes), round: yes };
}

test('every house rule added 2026-10-05 starts off in the app defaults', () => {
  const src = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
  const line = game => src.split('\n').find(l => l.trim().startsWith(`${game}: {`));
  assert.match(line('banker'), /pressAll: false/);
  assert.match(line('nassau'), /bye: 'off'/);
  assert.match(line('match'), /bye: 'off'/);
  assert.match(line('skins'), /birdieDouble: false/);
  assert.doesNotMatch(line('wolf'), /birdieDouble: true/);
  assert.match(line('hammer'), /carry: false/);
  assert.match(line('vegas'), /max9: false/);
  assert.match(line('sixes'), /press: false/);
  assert.match(line('stroke'), /gross: false/);
  assert.match(line('stableford'), /table: 'standard'/);
  assert.match(line('quota'), /table: 'chicago', adjust: 'off', team: false/);
  assert.doesNotMatch(line('dots'), /threeputt: true|water: true|ob: true/);
  assert.match(line('rabbit'), /backDouble: false/);
  assert.match(line('snake'), /split: false/);
  for (const [game, gs] of Object.entries(DEFAULTS)) if (game !== 'hcPct') assert.equal(houseRulesLine(game, gs), '', game);
});

// ---------------------------------------------------------------------------
// Banker: the banker presses everyone

test('settleBankerHole pressAll: the press back doubles the bets nobody pressed too', () => {
  const hole = { banker: 'a', bets: { b: 5, c: 5 }, doubled: { b: true }, doubleBack: true };
  const net = { a: 4, b: 3, c: 5 };
  assert.deepEqual(settleBankerHole(hole, net, ['a', 'b', 'c']).deltas, { a: -15, b: 20, c: -5 });
  assert.deepEqual(settleBankerHole(hole, net, ['a', 'b', 'c'], { pressAll: true }).deltas, { a: -10, b: 20, c: -10 });
  // No press back, nothing changes
  assert.deepEqual(settleBankerHole({ ...hole, doubleBack: false }, net, ['a', 'b', 'c'], { pressAll: true }).deltas, { a: -5, b: 10, c: -5 });
});

test('banker presses everyone: money three ways', () => {
  const build = r => { scores(r, 1, { 1: { b: 3, c: 5 } }); r.banker = { 1: { banker: 'a', bets: { b: 5, c: 5 }, doubled: { b: true }, doubleBack: true } }; return r; };
  const b = threeWays('banker', ['a', 'b', 'c'], 'pressAll', true, build);
  assert.deepEqual(b.before, { a: -15, b: 20, c: -5 });
  assert.deepEqual(b.off, b.before);
  assert.deepEqual(b.on, { a: -10, b: 20, c: -10 });
});

// ---------------------------------------------------------------------------
// Nassau and Match play: the bye

test('byeBets: a leg closed out early makes the holes left a bet, half or all of the leg', () => {
  const legs = { match: { start: 1, end: 9 } };
  const w = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 };
  assert.deepEqual(byeBets(w, { match: 10 }, legs, 'off'), []);
  assert.deepEqual(byeBets(w, { match: 10 }, legs, 'half'), [{ id: 'bye-match', leg: 'match', start: 6, amount: 5, by: null, bye: true }]);
  assert.equal(byeBets(w, { match: 10 }, legs, 'full')[0].amount, 10);
  // Not closed yet: no bye
  assert.deepEqual(byeBets({ 1: 0, 2: 0 }, { match: 10 }, legs, 'full'), []);
});

test('match play bye: closed 5&4, then the bye is played over the last four holes', () => {
  const build = r => scores(r, 9, { 1: { a: 3 }, 2: { a: 3 }, 3: { a: 2 }, 4: { a: 3 }, 5: { a: 3 }, 6: { b: 3 }, 7: { b: 3 } });
  const m = threeWays('match', ['a', 'b'], 'bye', 'full', build);
  assert.deepEqual(m.before, { a: 10, b: -10 });
  assert.deepEqual(m.off, m.before);
  assert.deepEqual(m.on, { a: 0, b: 0 });
  const half = build(mk('match', ['a', 'b'], { set: { bye: 'half' } }));
  assert.deepEqual(bal(half), { a: 5, b: -5 });
  const bye = roundResults(half).detail.lines.find(l => l.bye);
  assert.equal(bye.start, 6);
  assert.equal(bye.status.leader, 1);
  // The bye is for the whole match: changing it mid-round counts every hole
  assert.equal(wholeRoundOnly('match', { bye: 'off' }, { bye: 'half' }), true);
  assert.equal(wholeRoundOnly('nassau', { bye: 'off' }, { bye: 'off' }), false);
});

test('nassau bye: the first 4 closed after three holes plays hole 4 as a bye', () => {
  const build = r => scores(r, 9, { 1: { a: 3 }, 2: { a: 3 }, 3: { a: 2 }, 4: { b: 3 } });
  const n = threeWays('nassau', ['a', 'b'], 'bye', 'half', build);
  // First 4 and all 9 to Ann ($5 each). The bye on hole 4 goes to Bo for half the first 4's bet
  assert.deepEqual(n.before, { a: 10, b: -10 });
  assert.deepEqual(n.off, n.before);
  assert.deepEqual(n.on, { a: 7.5, b: -7.5 });
  assert.equal(zero(n.on), 0);
});

// ---------------------------------------------------------------------------
// Skins: birdies win two skins

test('skins birdie double: a birdie skin counts two, a carried skin keeps its value', () => {
  const build = r => scores(r, 2, { 2: { a: 3 } });
  const s = threeWays('skins', ['a', 'b', 'c'], 'birdieDouble', true, build);
  // Hole 1 ties and carries. Ann's birdie takes the carried $2 and her own skin at $4, from each of two
  assert.deepEqual(s.before, { a: 8, b: -4, c: -4 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 12, b: -6, c: -6 });
  const t = skinsTable(s.round);
  assert.equal(t.rows[1].birdie, true);
  assert.equal(t.rows[1].skins, 3);
  // A par that wins the hole is one skin as usual
  const par = threeWays('skins', ['a', 'b', 'c'], 'birdieDouble', true, r => scores(r, 1, { 1: { b: 5, c: 5 } }));
  assert.deepEqual(par.on, par.off);
});

test('skins birdie double in a pot: the birdie skin is two shares', () => {
  const build = r => scores(r, 4, { 2: { a: 3 }, 4: { a: 5, c: 5 } });
  const s = threeWays('skins', ['a', 'b', 'c'], 'birdieDouble', true, build, { set: { payout: 'pot', carryover: false } });
  // $30 pot. Off: a skin each for Ann and Bo, $15 each. On: Ann 2 shares, Bo 1
  assert.deepEqual(s.off, { a: 5, b: 5, c: -10 });
  assert.deepEqual(s.on, { a: 10, b: 0, c: -10 });
});

test('skins birdie double with validate: a birdie skin lost on the next hole goes back as one skin', () => {
  const r = scores(mk('skins', ['a', 'b', 'c'], { set: { birdieDouble: true, validate: true } }), 4, { 1: { a: 3 }, 2: { a: 5 }, 3: { b: 2 } });
  // Ann's birdie on 1 isn't validated (bogey on 2): one skin goes back. Hole 2 ties, so Bo's birdie on the
  // par 3 takes the returned skin, hole 2's and his own at double: 2 + 2 + 4 from each of two. His par on 4 keeps it
  const t = skinsTable(r);
  assert.equal(t.rows[0].lost, 'a');
  assert.deepEqual(bal(r), { a: -8, b: 16, c: -8 });
});

// ---------------------------------------------------------------------------
// Wolf: birdies double

test('wolf birdie double: a hole won with a real birdie pays double, lone or with a partner', () => {
  const build = r => {
    scores(r, 2, { 1: { a: 3 }, 2: { b: 3 } });
    r.wolf = { 1: { wolf: 'a', partner: 'b' }, 2: { wolf: 'b', partner: null } };
    return r;
  };
  const w = threeWays('wolf', ['a', 'b', 'c', 'd'], 'birdieDouble', true, build);
  // Hole 1: Ann & Bo win $2 from each of two. Hole 2: Bo lone (2×) wins $4 from each of three
  assert.deepEqual(w.before, { a: 0, b: 16, c: -8, d: -8 });
  assert.deepEqual(w.off, w.before);
  assert.deepEqual(w.on, { a: 0, b: 32, c: -16, d: -16 });
  // The pack winning with pars pays as usual
  const pack = threeWays('wolf', ['a', 'b', 'c', 'd'], 'birdieDouble', true, r => { scores(r, 1, { 1: { a: 5 } }); r.wolf = { 1: { wolf: 'a', partner: null } }; return r; });
  assert.deepEqual(pack.on, pack.off);
});

// ---------------------------------------------------------------------------
// Hammer: halved holes carry

test('hammer carry: a halved hammered hole rides on the next, and a win resets it', () => {
  const build = r => {
    scores(r, 3, { 2: { a: 3 }, 3: { a: 5 } });
    r.marks = { 1: { hammers: [0], conceded: null }, 2: { hammers: [1], conceded: null } };
    return r;
  };
  const h = threeWays('hammer', ['a', 'b'], 'carry', true, build);
  // Off: hole 2 hammered, $10 to Ann; hole 3 $5 to Bo. On: hole 1's $10 rides on, so hole 2 starts
  // at $15 and the hammer makes it $30; hole 3 is back to $5
  assert.deepEqual(h.before, { a: 5, b: -5 });
  assert.deepEqual(h.off, h.before);
  assert.deepEqual(h.on, { a: 25, b: -25 });
  const rows = hammerTable(h.round);
  assert.equal(rows[1].carried, 10);
  assert.equal(rows[1].base, 15);
  assert.equal(rows[2].carried, undefined);
});

test('hammer carry: a fold takes the carry with it, and switched off mid-round it is dropped', () => {
  const r = scores(mk('hammer', ['a', 'b'], { set: { carry: true } }), 3, { 3: { b: 2 } });
  r.marks = { 2: { hammers: [0], conceded: 1 } };
  // Hole 1 halved ($5 rides on). Hole 2: Ann hammers and Bo folds at the $10 it was worth. Hole 3: $5
  assert.deepEqual(bal(r), { a: 5, b: -5 });
  const off = changeBets(scores(mk('hammer', ['a', 'b'], { set: { carry: true } }), 2, { 2: { a: 3 } }), { ...DEFAULTS.hammer, carry: false }, 2);
  assert.deepEqual(bal(off), { a: 5, b: -5 });
});

// ---------------------------------------------------------------------------
// Vegas: no double digits

test('vegas no double digits: a 10 counts as 9, so 4 and 11 make 49, not 114', () => {
  assert.equal(vegasScore(11, true), 9);
  assert.equal(vegasScore(11, false), 11);
  assert.equal(vegasScore(5, true), 5);
  const build = r => scores(r, 1, { 1: { b: 11, d: 5 } });
  const v = threeWays('vegas', ['a', 'b', 'c', 'd'], 'max9', true, build, { teams: [['a', 'b'], ['c', 'd']] });
  assert.deepEqual(v.before, { a: -69, b: -69, c: 69, d: 69 });
  assert.deepEqual(v.off, v.before);
  assert.deepEqual(v.on, { a: -4, b: -4, c: 4, d: 4 });
});

// ---------------------------------------------------------------------------
// Sixes: auto press at 2 down

test('autoPressStarts: 2 down starts a press, and a press 2 down is pressed again', () => {
  assert.deepEqual(autoPressStarts({ 1: 0, 2: 0, 3: 1, 4: 1, 5: null, 6: null }, 1, 6), [3, 5]);
  assert.deepEqual(autoPressStarts({ 1: 0, 2: null }, 1, 6), []);
  // 2 down with one to play is closed out, so nothing to press
  assert.deepEqual(autoPressStarts({ 1: null, 2: 0, 3: 0 }, 1, 3), []);
});

test('sixes auto press: the press wins a halved match for the side that came back', () => {
  const build = r => scores(r, 18, { 1: { a: 3 }, 2: { a: 3 }, 3: { c: 2 }, 4: { c: 3 } });
  const s = threeWays('sixes', ['a', 'b', 'c', 'd'], 'press', true, build, { holes: 18 });
  // Holes 1-6, Ann & Bo v Cy & Di: halved 2-2, so nobody wins the match. The press from hole 3 goes 2-0 to Cy & Di
  assert.deepEqual(s.before, { a: 0, b: 0, c: 0, d: 0 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: -5, b: -5, c: 5, d: 5 });
  const m = roundResults(s.round).detail.matches[0];
  assert.deepEqual(m.presses.map(p => p.start), [3, 5]);
  // Per hole, there are no presses
  const holes = build(mk('sixes', ['a', 'b', 'c', 'd'], { holes: 18, set: { press: true, mode: 'holes' } }));
  const holesOff = build(mk('sixes', ['a', 'b', 'c', 'd'], { holes: 18, set: { mode: 'holes' } }));
  assert.deepEqual(bal(holes), bal(holesOff));
});

// ---------------------------------------------------------------------------
// Stroke play: low gross too

test('stroke play low gross too: a second pot for the low gross total', () => {
  const build = r => scores(r, 9, Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(no => [no, { b: (no === 3 ? 3 : 4) + 1, ...(no === 1 ? { c: 5 } : {}) }])));
  // Bo gets a stroke a hole: net 36 with Ann, Cy 37. Gross: Ann 35, Bo 44, Cy 36
  const s = threeWays('stroke', ['a', 'b', 'c'], 'gross', true, build, { useHandicaps: true, index: { b: 18 } });
  assert.deepEqual(s.before, { a: 2.5, b: 2.5, c: -5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 12.5, b: -2.5, c: -10 });
  assert.deepEqual(roundResults(s.round).detail.pots.map(p => p.label), ['Total', 'Low gross']);
  // Per stroke, there's no pot to add
  const per = threeWays('stroke', ['a', 'b', 'c'], 'gross', true, build, { useHandicaps: true, index: { b: 18 }, set: { payout: 'per' } });
  assert.deepEqual(per.on, per.off);
});

// ---------------------------------------------------------------------------
// Stableford: big birdies

test('stablefordPoints chicago: bogey 1, par 2, birdie 4, eagle 8', () => {
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(n => stablefordPoints(n, 4, 'chicago')), [0, 1, 2, 4, 8, 16]);
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(n => stablefordPoints(n, 4, true)), [-3, -1, 0, 2, 5, 8]);
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(n => stablefordPoints(n, 4)), [0, 1, 2, 3, 4, 5]);
});

test('stableford big birdies: money three ways', () => {
  const s = threeWays('stableford', ['a', 'b'], 'table', 'chicago', r => scores(r, 2, { 1: { a: 3 } }));
  assert.deepEqual(s.before, { a: 1, b: -1 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 2, b: -2 });
});

// ---------------------------------------------------------------------------
// Quota: Stableford points, the quota moving after the round, team quota

test('quotaPoints stableford table: birdie 3 and eagle 4 instead of 4 and 8, and the minus point still works', () => {
  assert.deepEqual([7, 6, 5, 4, 3, 2, 1].map(g => quotaPoints(g, 4, { table: 'stableford' })), [0, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual([7, 6, 5, 4, 3, 2, 1].map(g => quotaPoints(g, 4)), [0, 0, 1, 2, 4, 8, 16]);
  assert.equal(quotaPoints(6, 4, { table: 'stableford', minus: true }), -1);
});

test('quota stableford points: money three ways', () => {
  const q = threeWays('quota', ['a', 'b'], 'table', 'stableford', r => scores(r, 9, { 1: { a: 3 } }));
  assert.deepEqual(q.before, { a: 2, b: -2 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: 1, b: -1 });
});

test('quotaAdjusted: one point either way, or half the difference', () => {
  assert.equal(quotaAdjusted(18, 6, 'one'), 19);
  assert.equal(quotaAdjusted(18, -3, 'one'), 17);
  assert.equal(quotaAdjusted(18, 0, 'one'), 18);
  assert.equal(quotaAdjusted(18, 6, 'half'), 21);
  assert.equal(quotaAdjusted(18, 5, 'half'), 21);
  assert.equal(quotaAdjusted(18, -1, 'half'), 17);
  assert.equal(quotaAdjusted(18, 6, 'off'), null);
});

test('quota moves after the round: next quotas for a finished round, and they carry into the next one', () => {
  const r = scores(mk('quota', ['a', 'b', 'c'], { set: { adjust: 'half' } }), 9, { 1: { a: 2 }, 2: { c: 5 } });
  // Not finished: nothing moves yet
  assert.deepEqual(nextQuotas({ ...r, status: 'active', scores: { 1: r.scores[1] } }), {});
  r.status = 'done'; r.finishedAt = 10;
  // Ann +6 (an eagle), Bo level, Cy −1
  assert.deepEqual(nextQuotas(r), { a: { quota: 18, next: 21, over: 6 }, b: { quota: 18, next: 18, over: 0 }, c: { quota: 18, next: 17, over: -1 } });
  assert.deepEqual(roundResults(r).detail.nextQuotas.a, { quota: 18, next: 21, over: 6 });
  // Money for the round itself doesn't change
  const off = scores(mk('quota', ['a', 'b', 'c']), 9, { 1: { a: 2 }, 2: { c: 5 } });
  assert.deepEqual(bal(r), bal(off));
  // Carried: the same nine, or doubled for 18
  const state = { me: 'a', players: { a: { id: 'a', name: 'Ann' }, b: { id: 'b', name: 'Bo' } }, rounds: { r } };
  assert.deepEqual(carriedQuotas(state, ['a', 'b', 'x'], 9), { a: { quota: 21, from: 18, roundId: 'r' }, b: { quota: 18, from: 18, roundId: 'r' } });
  assert.equal(carriedQuotas(state, ['a'], 18).a.quota, 42);
  assert.equal(carriedLine(carriedQuotas(state, ['a', 'b'], 9), id => NAMES[id]), 'Ann 21 · Bo 18');
  // A round with the rule off carries nothing
  assert.deepEqual(carriedQuotas({ ...state, rounds: { r: { ...r, settings: { ...r.settings, quota: { ...r.settings.quota, adjust: 'off' } } } } }, ['a'], 9), {});
  // A carried quota is the one the round plays to
  const next = scores(mk('quota', ['a', 'b']), 9, { 1: { a: 3 } });
  next.quotas = { a: 21 };
  const t = roundResults(next).detail.totals;
  assert.equal(t.find(x => x.id === 'a').quota, 21);
  assert.equal(t.find(x => x.id === 'b').quota, 18);
  assert.deepEqual(bal(next), { a: -1, b: 1 });
});

test('team quota: partners add up their points against their quotas, and the best team takes the pot', () => {
  const teams = [['a', 'b'], ['c', 'd']];
  const build = r => scores(r, 9, { 1: { a: 3 }, 2: { c: 3 }, 3: { d: 4 } });
  const q = threeWays('quota', ['a', 'b', 'c', 'd'], 'team', true, build, { teams, set: { payout: 'pot', stake: 5 } });
  // Alone, Ann and Cy tie at +2 and split the $20 pot. As teams, Ann and Bo are +2, Cy and Di +1
  assert.deepEqual(q.before, { a: 5, b: -5, c: 5, d: -5 });
  assert.deepEqual(q.off, q.before);
  assert.deepEqual(q.on, { a: 5, b: 5, c: -5, d: -5 });
  assert.deepEqual(teamQuotaTable(q.round).map(t => [t.points, t.quota, t.over]), [[38, 36, 2], [37, 36, 1]]);
  assert.equal(roundResults(q.round).detail.teamQuota.length, 2);
  // Nobody joins a team quota partway, and turning it on or off counts the whole round
  assert.ok(addPlayerProblem(q.round));
  assert.equal(addPlayerProblem(build(mk('quota', ['a', 'b', 'c', 'd'], { teams, set: { payout: 'pot' } }))), null);
  assert.equal(wholeRoundOnly('quota', { team: false, payout: 'per' }, { team: true, payout: 'per' }), true);
  // Per point, or without teams, it's the usual game
  const per = threeWays('quota', ['a', 'b', 'c', 'd'], 'team', true, build, { teams });
  assert.deepEqual(per.on, per.off);
  const none = threeWays('quota', ['a', 'b', 'c', 'd'], 'team', true, build, { set: { payout: 'pot', stake: 5 } });
  assert.deepEqual(none.on, none.off);
});

// ---------------------------------------------------------------------------
// Dots: penalty dots

test('penalty dots: water costs a dot from each player, and only when switched on', () => {
  const build = r => { scores(r, 1); r.marks = { 1: { a: ['water'], b: ['sandy'] } }; return r; };
  const off = build(mk('dots', ['a', 'b', 'c']));
  assert.deepEqual(bal(off), { a: -1, b: 2, c: -1 });
  const on = build(mk('dots', ['a', 'b', 'c'], { set: { kinds: { ...DEFAULTS.dots.kinds, water: true } } }));
  assert.deepEqual(bal(on), { a: -3, b: 3, c: 0 });
  assert.equal(zero(bal(on)), 0);
  // Set to false, the mark doesn't count either
  const no = build(mk('dots', ['a', 'b', 'c'], { set: { kinds: { ...DEFAULTS.dots.kinds, water: false } } }));
  assert.deepEqual(bal(no), bal(off));
});

// ---------------------------------------------------------------------------
// Rabbit: the back nine rabbit doubles

test('rabbit back nine doubles: the back rabbit is worth twice the bet', () => {
  const build = r => scores(r, 18, { 1: { a: 3 }, 10: { b: 3 } });
  const rb = threeWays('rabbit', ['a', 'b', 'c'], 'backDouble', true, build, { holes: 18 });
  assert.deepEqual(rb.before, { a: 5, b: 5, c: -10 });
  assert.deepEqual(rb.off, rb.before);
  assert.deepEqual(rb.on, { a: 0, b: 15, c: -15 });
  assert.equal(rabbitTable(rb.round).legs[1].doubled, true);
  // Three rabbits, or nine holes: nothing doubles
  const three = threeWays('rabbit', ['a', 'b', 'c'], 'backDouble', true, build, { holes: 18, set: { sixes: true } });
  assert.deepEqual(three.on, three.off);
  const nine = threeWays('rabbit', ['a', 'b', 'c'], 'backDouble', true, r => scores(r, 9, { 1: { a: 3 } }));
  assert.deepEqual(nine.on, nine.off);
});

// ---------------------------------------------------------------------------
// Snake: split the snake

test('snake split: the holder pays the snake once, shared by everyone else', () => {
  const build = r => { scores(r, 3); r.marks = { 1: { snake: [] }, 2: { snake: ['b'] }, 3: { snake: [] } }; return r; };
  const s = threeWays('snake', ['a', 'b', 'c'], 'split', true, build);
  assert.deepEqual(s.before, { a: 5, b: -10, c: 5 });
  assert.deepEqual(s.off, s.before);
  assert.deepEqual(s.on, { a: 2.5, b: -5, c: 2.5 });
  assert.equal(snakeTable(s.round).legs[0].amount, 5);
  // A growing snake split four ways
  const grow = build(mk('snake', ['a', 'b', 'c', 'd'], { set: { split: true, growth: 'grow' } }));
  grow.marks[3] = { snake: ['b'] };
  assert.deepEqual(bal(grow), { a: 3.34, b: -10, c: 3.33, d: 3.33 });
});

// ---------------------------------------------------------------------------
// Words: the bet line and the first-tee card

test('the bet line names each new rule that is on', () => {
  const on = {
    banker: { pressAll: true }, nassau: { bye: 'half' }, match: { bye: 'full' }, skins: { birdieDouble: true }, wolf: { birdieDouble: true },
    hammer: { carry: true }, vegas: { max9: true }, sixes: { press: true }, stroke: { gross: true }, stableford: { table: 'chicago' },
    quota: { table: 'stableford', adjust: 'one', team: true, payout: 'pot' }, rabbit: { backDouble: true }, snake: { split: true },
    dots: { kinds: { ...DEFAULTS.dots.kinds, water: true } },
  };
  const want = {
    banker: 'banker presses everyone', nassau: 'a bye for half', match: 'a bye', skins: 'birdies win two skins', wolf: 'birdies double',
    hammer: 'halved holes carry', vegas: 'no double digits', sixes: 'auto press at 2 down', stroke: 'low gross too', stableford: 'big birdies',
    quota: 'Stableford points · quota moves 1 after · team quota', rabbit: 'back nine rabbit doubles', snake: 'snake split', dots: 'penalty dots',
  };
  for (const [game, set] of Object.entries(on)) {
    assert.equal(houseRulesLine(game, { ...DEFAULTS[game], ...set }), want[game], game);
    assert.ok(stakeSummary(game, { ...DEFAULTS, [game]: { ...DEFAULTS[game], ...set } }).endsWith(want[game]), game);
  }
  // Rules that only play over 18 holes, or one way, say nothing otherwise
  assert.equal(houseRulesLine('rabbit', { ...DEFAULTS.rabbit, backDouble: true }, 9), '');
  assert.equal(houseRulesLine('sixes', { ...DEFAULTS.sixes, press: true, mode: 'holes' }), '');
  assert.equal(houseRulesLine('stroke', { ...DEFAULTS.stroke, gross: true, payout: 'per' }), '');
  // Team quota leaves out the pot rules it replaces
  assert.equal(houseRulesLine('quota', { ...DEFAULTS.quota, payout: 'pot', team: true, split: 'over', nassau: true }), 'team quota');
});

test('the first-tee card lists the new rules that are on, and only those', () => {
  for (const game of Object.keys(OFF)) for (const h of houseRulesFor(game, DEFAULTS[game])) if (Object.keys(OFF[game]).includes(h.id)) assert.equal(h.on, false, `${game} ${h.id}`);
  const r = mk('quota', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], set: { payout: 'pot', team: true, adjust: 'half', table: 'stableford' } });
  const rules = agreementItems(r).filter(x => x.group === 'rules' && x.on).map(x => x.text);
  assert.deepEqual(rules, ['Stableford points: bogey 1, par 2, birdie 3, eagle 4', 'Quotas move half the difference for next time', 'Team quota: partners’ points against their quotas added up']);
  const d = mk('dots', ['a', 'b'], { set: { kinds: { ...DEFAULTS.dots.kinds, water: true, ob: true } } });
  assert.ok(agreementItems(d).some(x => x.on && x.text === 'Penalty dots: water and out of bounds cost a dot'));
  const n = mk('nassau', ['a', 'b'], { set: { bye: 'half' } });
  assert.ok(agreementItems(n).some(x => x.on && x.id === 'rule:main:bye'));
});

// ---------------------------------------------------------------------------
// Every new rule on at random over the seeded rounds: still zero-sum, whole cents, honest head to head

test('every new rule on at random: every round adds up to zero in whole cents, and the head to head agrees', () => {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const ON = () => ({
    banker: { pressAll: rnd() < 0.5 }, nassau: { bye: pick(['off', 'half', 'full']) }, match: { bye: pick(['off', 'half', 'full']) },
    skins: { birdieDouble: rnd() < 0.5 }, wolf: { birdieDouble: rnd() < 0.5 }, hammer: { carry: rnd() < 0.5 }, vegas: { max9: rnd() < 0.5 },
    sixes: { press: rnd() < 0.5 }, stroke: { gross: rnd() < 0.5 }, stableford: { table: pick(['standard', 'chicago']) },
    quota: { table: pick(['chicago', 'stableford']), adjust: pick(['off', 'one', 'half']), team: rnd() < 0.5 }, rabbit: { backDouble: rnd() < 0.5 }, snake: { split: rnd() < 0.5 },
  });
  for (const { name, round } of o9Rounds()) {
    const r = structuredClone(round);
    const on = ON();
    r.settings = Object.fromEntries(Object.entries(r.settings).map(([g, b]) => [g, b && typeof b === 'object' && on[g] ? { ...b, ...on[g] } : b]));
    if (r.settings.dots) r.settings.dots = { ...r.settings.dots, kinds: { ...r.settings.dots.kinds, water: rnd() < 0.5, threeputt: rnd() < 0.5 } };
    for (const sg of r.sideGames || []) if (on[sg.game]) sg.settings = { ...sg.settings, ...on[sg.game] };
    // Team quota needs teams: half the quota rounds get two
    if (r.game === 'quota' && r.players.length >= 4 && rnd() < 0.5) r.teams = [{ id: 't0', name: 'A', players: r.players.slice(0, 2).map(p => p.id) }, { id: 't1', name: 'B', players: r.players.slice(2).map(p => p.id) }];
    // Penalty dots and the other marks, now and then
    for (const no of Object.keys(r.marks || {})) if (rnd() < 0.3) { const pid = pick(r.players).id; r.marks[no] = { ...r.marks[no], [pid]: [...(Array.isArray(r.marks[no][pid]) ? r.marks[no][pid] : []), pick(['water', 'threeputt', 'ob'])] }; }
    const { balances, pairs } = roundResults(r);
    const cents = Object.values(balances).map(v => v * 100);
    assert.ok(cents.every(c => Number.isFinite(c) && Math.abs(c - Math.round(c)) < 1e-6), `${name}: ${JSON.stringify(balances)}`);
    assert.equal(Math.round(cents.reduce((a, c) => a + c, 0)) + 0, 0, `${name}: ${JSON.stringify(balances)}`);
    const ids = r.players.map(p => p.id);
    for (const a of ids) {
      const sum = ids.filter(b => b !== a).reduce((acc, b) => acc + Math.round(pairs[a][b] * 100), 0);
      assert.ok(Math.abs(sum - Math.round(balances[a] * 100)) <= ids.length, `${name}: ${a} head to head ${sum} v ${balances[a]}`);
    }
  }
});
