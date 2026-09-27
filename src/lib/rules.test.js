// The money rules Trevor decided on 2026-09-27 (#1 to #9), each checked by hand, including the
// worked examples from the rules check (Mike +$12 in skins, the unfinished rabbit leg, and so on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, changeBets, settingsAt, wholeRoundOnly, rabbitTable, totalsTable, betsChanged } from './round.js';
import { rabbitHolder, scrambleTeamHandicap, roundCents, SCRAMBLE_ALLOWANCE } from './games.js';
import { strokesOffLow } from './golf.js';
import { migrateSettings, REV2_DEFAULTS, SETTINGS_REV } from './settings.js';

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
  stableford: { ...REV2_DEFAULTS.stableford },
  quota: { ...REV2_DEFAULTS.quota },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { ...REV2_DEFAULTS.rabbit },
};

// Flat par-4 courses: no handicaps needed, easy to add up
const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'Town', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const NAMES = { m: 'Mike Ross', t: 'Trevor N', d: 'Dave Po', s: 'Sam Ek', a: 'Al Bee', b: 'Bo Cee', c: 'Cy Dee' };

function mk(game, ids, { holes = 18, settings = SETTINGS, ...extra } = {}) {
  const players = ids.map(id => ({ id, name: NAMES[id] || id }));
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players, settings: structuredClone(settings), hcPct: 100, useHandicaps: false, ...extra });
}
/** Score holes by playing position (1-based): { pos: { pid: gross } }, everyone else on the card gets par. */
function play(round, upto, special = {}, skip = []) {
  round.holes.slice(0, upto).forEach((h, i) => {
    if (skip.includes(i + 1)) return;
    round.scores[h.no] = { ...Object.fromEntries(round.players.map(p => [p.id, 4])), ...(special[i + 1] || {}) };
  });
  return round;
}
const money = r => roundResults(r).balances;
const sum = b => Math.round(Object.values(b).reduce((a, v) => a + v, 0) * 100);

// ---------------------------------------------------------------------------
// #1 A bet changed mid-round applies from the next hole by default, "Whole round" as an option

test('#1 skins: Mike wins 2 skins at $2, the bet goes to $5 on the 10th tee, Mike stays +$12', () => {
  const r = play(mk('skins', ['t', 'm', 'd', 's']), 18, { 1: { m: 3 }, 2: { m: 3 } });
  assert.equal(money(r).m, 12);
  // From hole 10 on (the default): the front was played for $2
  const from10 = changeBets(r, { value: 5, carryover: true }, 10);
  assert.deepEqual(money(from10), { t: -4, m: 12, d: -4, s: -4 });
  assert.equal(settingsAt(from10, 9).skins.value, 2);
  assert.equal(settingsAt(from10, 10).skins.value, 5);
  // Whole round: the old behaviour, every skin at $5
  const whole = changeBets(r, { value: 5, carryover: true }, null);
  assert.deepEqual(money(whole), { t: -10, m: 30, d: -10, s: -10 });
  assert.equal(betsChanged(whole), false);
});

test('#1 skins: skins carried into the change keep their value, the new hole is at the new bet', () => {
  // Holes 8 and 9 tie at $2 and carry; the bet goes to $5 from 10 and Mike wins 10: 2 + 2 + 5 = $9 from each
  const r = changeBets(play(mk('skins', ['t', 'm', 'd', 's']), 18, { 10: { m: 3 } }), { value: 5, carryover: true }, 10);
  // Holes 1 to 9 all tied, so nine $2 skins carry into hole 10: 9 × 2 + 5 = $23 from each of three
  assert.deepEqual(money(r), { t: -23, m: 69, d: -23, s: -23 });
});

test('#1 history: later changes, an earlier change and whole round', () => {
  let r = mk('skins', ['t', 'm']);
  r = changeBets(r, { value: 5, carryover: true }, 10); // 1–9 at $2, 10+ at $5
  r = changeBets(r, { value: 10, carryover: true }, 15); // 10–14 at $5, 15+ at $10
  assert.deepEqual([1, 9, 10, 14, 15, 18].map(p => settingsAt(r, p).skins.value), [2, 2, 5, 5, 10, 10]);
  r = changeBets(r, { value: 1, carryover: false }, 5); // 1–4 at $2, 5+ at $1
  assert.deepEqual([4, 5, 12, 18].map(p => settingsAt(r, p).skins.value), [2, 1, 1, 1]);
  assert.deepEqual(r.betHistory.map(e => e.upto), [4]);
  // Changing back to what the earlier holes were played for leaves one bet for the whole round
  r = changeBets(r, { value: 2, carryover: true }, 5);
  assert.equal(betsChanged(r), false);
  r = changeBets(r, { value: 7, carryover: true }, 12);
  r = changeBets(r, { value: 3, carryover: true }, null);
  assert.equal(betsChanged(r), false);
  assert.equal(settingsAt(r, 1).skins.value, 3);
});

test('#1 nassau: a leg already under way keeps its bet, the back nine and later presses use the new one', () => {
  // Trevor wins holes 1 and 11; the back and total go from $5 to $10 on the 10th tee
  const r = play(mk('nassau', ['t', 'm']), 18, { 1: { t: 3 }, 11: { t: 3 } });
  const from10 = changeBets(r, { ...SETTINGS.nassau, back: 10, total: 10 }, 10);
  assert.deepEqual(money(from10), { t: 20, m: -20 }); // front 5 + back 10 + total 5 (started on hole 1)
  assert.deepEqual(money(changeBets(r, { ...SETTINGS.nassau, back: 10, total: 10 }, null)), { t: 25, m: -25 });
  // A press on the back made on hole 13 is for the new $10
  from10.presses = [{ id: 1, leg: 'back', start: 13, by: 1 }];
  play(from10, 18, { 1: { t: 3 }, 11: { t: 3 }, 14: { m: 3 } });
  const lines = roundResults(from10).detail.lines;
  assert.equal(lines.find(l => l.press).amount, 10);
});

test('#1 per-hole games price each hole at its own bet: stroke, wolf, vegas, nines, bingo bango bongo, dots, aces', () => {
  // Stroke play per stroke: Mike is 1 better on hole 2 ($1) and on hole 12 ($3)
  const st = play(mk('stroke', ['t', 'm'], { settings: { ...SETTINGS, stroke: { stake: 1, payout: 'per' } } }), 18, { 2: { m: 3 }, 12: { m: 3 } });
  assert.deepEqual(money(changeBets(st, { stake: 3, payout: 'per' }, 10)), { t: -4, m: 4 });

  // Nines: Al low on hole 1 at $1 (+2 vs the 3-point average) and on hole 10 at $2 (+4)
  const n = play(mk('nines', ['a', 'b', 'c']), 18, { 1: { a: 3, c: 5 }, 10: { a: 3, c: 5 } });
  assert.deepEqual(money(changeBets(n, { point: 2 }, 10)), { a: 6, b: 0, c: -6 });

  // Bingo bango bongo: Al takes all three on hole 1 ($1) and on hole 10 ($2), pairwise
  const bb = play(mk('bbb', ['a', 'b', 'c']), 18);
  bb.marks = { 1: { bingo: 'a', bango: 'a', bongo: 'a' }, 10: { bingo: 'a', bango: 'a', bongo: 'a' } };
  assert.deepEqual(money(changeBets(bb, { value: 2 }, 10)), { a: 18, b: -9, c: -9 });

  // Dots: a sandy on hole 1 ($1 from each) and one on hole 10 ($2 from each)
  const d = play(mk('dots', ['a', 'b', 'c']), 18);
  d.marks = { 1: { a: ['sandy'] }, 10: { a: ['sandy'] } };
  assert.deepEqual(money(changeBets(d, { ...SETTINGS.dots, value: 2 }, 10)), { a: 6, b: -3, c: -3 });

  // Aces & deuces: Al low and Cy high on holes 1 and 10; the ace goes to $4 from 10
  const ac = play(mk('aces', ['a', 'b', 'c']), 18, { 1: { a: 3, c: 5 }, 10: { a: 3, c: 5 } });
  // Hole 1: a +4, b −2+1, c −2−2. Hole 10: a +8+1... worked per hole below
  const acm = money(changeBets(ac, { ace: 4, deuce: 1 }, 10));
  // Hole 1: a +2+2 +1 = 5, b −2 +1 = −1, c −2 −2 = −4. Hole 10: a +8 +1 = 9, b −4 +1 = −3, c −4 −2 = −6
  assert.deepEqual(acm, { a: 14, b: -4, c: -10 });

  // Wolf: the lone wolf wins hole 1 at $2 and hole 10 at $4 (2× each of three)
  const w = play(mk('wolf', ['t', 'm', 'd', 's']), 18, { 1: { t: 3 }, 10: { m: 3 } });
  w.wolf = { 1: { wolf: 't', partner: null }, 10: { wolf: 'm', partner: null } };
  assert.deepEqual(money(changeBets(w, { point: 4, loneMultiplier: 2 }, 10)), { t: 12 - 8, m: -4 + 24, d: -4 - 8, s: -4 - 8 });

  // Vegas: team A wins hole 1 by 1 point at $1, and hole 10 by 1 point at $3
  const v = play(mk('vegas', ['t', 'm', 'd', 's'], { teams: [['t', 'm'], ['d', 's']] }), 18, { 1: { d: 5 }, 10: { d: 5 } });
  assert.deepEqual(money(changeBets(v, { point: 3, birdieFlip: true }, 10)), { t: 4, m: 4, d: -4, s: -4 });
});

test('#1 pot games always change for the whole round', () => {
  assert.equal(wholeRoundOnly('stroke', { payout: 'pot' }, { payout: 'pot' }), true);
  assert.equal(wholeRoundOnly('stableford', { payout: 'per' }, { payout: 'pot' }), true);
  assert.equal(wholeRoundOnly('scramble', {}, {}), true);
  assert.equal(wholeRoundOnly('stroke', { payout: 'per' }, { payout: 'per' }), false);
  assert.equal(wholeRoundOnly('skins', {}, {}), false);
  const r = play(mk('stroke', ['t', 'm']), 18, { 2: { m: 3 } });
  const changed = changeBets(r, { stake: 10, payout: 'pot' }, 10);
  assert.equal(betsChanged(changed), false);
  assert.deepEqual(money(changed), { t: -10, m: 10 });
});

// ---------------------------------------------------------------------------
// #2 "Per point" stays pairwise; Nines is every point above or below 54; Stableford and Quota default to a pot

test('#2 per point is pairwise, Nines is against the average of 3 a hole (54 over 18)', () => {
  // Bingo bango bongo, 4 players, $1 a point, Al takes all three points on one hole: +$9, the others −$3
  const bb = play(mk('bbb', ['a', 'b', 'c', 'd']), 1);
  bb.marks = { 1: { bingo: 'a', bango: 'a', bongo: 'a' } };
  assert.deepEqual(money(bb), { a: 9, b: -3, c: -3, d: -3 });
  // Nines over 18: Al scores 64 points, Bo 54, Cy 44, so Al +$10, Cy −$10
  const n = play(mk('nines', ['a', 'b', 'c']), 18, { 1: { a: 3, c: 5 }, 2: { a: 3, c: 5 }, 3: { a: 3, c: 5 }, 4: { a: 3, c: 5 }, 5: { a: 3, c: 5 } });
  const pts = roundResults(n).detail.points;
  assert.deepEqual(pts, { a: 64, b: 54, c: 44 });
  assert.deepEqual(money(n), { a: 10, b: 0, c: -10 });
});

test('#2 Stableford and Quota default to a pot', () => {
  assert.equal(REV2_DEFAULTS.stableford.payout, 'pot');
  assert.equal(REV2_DEFAULTS.quota.payout, 'pot');
  // Four players put in $5; Mike's birdie wins the Stableford pot
  const r = play(mk('stableford', ['t', 'm', 'd', 's']), 18, { 3: { m: 3 } });
  assert.deepEqual(money(r), { t: -5, m: 15, d: -5, s: -5 });
});

// ---------------------------------------------------------------------------
// #3 Every unfinished leg pays on the holes played, like Nassau

test('#3 rabbit: hole 4 never entered, the front rabbit still pays (+$20, not +$10)', () => {
  // 3 players, $5 rabbit, Al wins every hole but hole 4 was never scored
  const special = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, { a: 3 }]));
  const r = play(mk('rabbit', ['a', 'b', 'c']), 18, special, [4]);
  const t = rabbitTable(r);
  assert.equal(t.legs[0].done, false);
  assert.equal(t.legs[0].holder, 'a');
  assert.deepEqual(money(r), { a: 20, b: -10, c: -10 });
  // Finished early after hole 12: the back rabbit pays on the holes played too
  const early = play(mk('rabbit', ['a', 'b', 'c']), 12, special);
  assert.deepEqual(money(early), { a: 20, b: -10, c: -10 });
  // Nothing played on the back: that leg pays nothing
  assert.deepEqual(money(play(mk('rabbit', ['a', 'b', 'c']), 9, special)), { a: 10, b: -5, c: -5 });
});

test('#3 sixes: a match with hole 6 skipped pays whoever is 1 up', () => {
  // Holes 1–6: AB v CD. Al wins hole 2, hole 6 is never entered
  const r = play(mk('sixes', ['a', 'b', 'c', 'd']), 6, { 2: { a: 3 } }, [6]);
  const m = roundResults(r).detail.matches[0];
  assert.equal(m.status.done, false);
  assert.equal(m.net, 5);
  assert.deepEqual(money(r), { a: 5, b: 5, c: -5, d: -5 });
  // A match level on the holes played pays nothing
  assert.deepEqual(money(play(mk('sixes', ['a', 'b', 'c', 'd']), 5)), { a: 0, b: 0, c: 0, d: 0 });
});

// ---------------------------------------------------------------------------
// #4 Rabbit defaults to "set free"; ties change nothing; the old rules are options

test('#4 rabbit set free: a new winner frees it, the next winner catches it, ties change nothing', () => {
  // The rules check example: A wins 1, B wins 2, hole 3 tied
  const rows = [{ winner: 'a' }, { winner: 'b' }, { winner: null }];
  assert.deepEqual(rabbitHolder(rows).history, ['a', null, null]);
  assert.deepEqual(rabbitHolder([...rows, { winner: 'c' }]).history, ['a', null, null, 'c']);
  // Holes 1 then 3 with no hole 2: a tie keeps it with A
  assert.deepEqual(rabbitHolder([{ winner: 'a' }, { winner: null }]).history, ['a', 'a']);
  // The holder winning again keeps it
  assert.deepEqual(rabbitHolder([{ winner: 'a' }, { winner: 'a' }]).history, ['a', 'a']);
  // Old rules as options: steal, and ties set it loose
  assert.deepEqual(rabbitHolder(rows, { mode: 'steal', tiesFree: true }).history, ['a', 'b', null]);
  assert.deepEqual(rabbitHolder([{ winner: 'a' }, { winner: null }], { mode: 'free', tiesFree: true }).history, ['a', null]);
  // A holder who leaves sets it loose
  assert.deepEqual(rabbitHolder([{ winner: 'a' }, { winner: null, gone: ['a'] }]).history, ['a', null]);
});

test('#4 rabbit rounds: new rounds set free, old rounds with no mode keep steal', () => {
  // 9 holes: A wins 1, B wins 5, then ties. Set free: loose at the end, nobody paid. Steal: B holds it
  const r = play(mk('rabbit', ['a', 'b', 'c'], { holes: 9 }), 9, { 1: { a: 3 }, 5: { b: 3 } });
  assert.deepEqual(money(r), { a: 0, b: 0, c: 0 });
  r.settings = { ...r.settings, rabbit: { stake: 5, tiesFree: false } }; // saved before the change: no mode
  assert.deepEqual(money(r), { a: -5, b: 10, c: -5 });
});

// ---------------------------------------------------------------------------
// #5 Quota scales to holes played on a short round

test('#5 quota: a round stopped after 9 compares against half the quota', () => {
  const players = [{ id: 'a', name: 'Al Bee', courseHcOverride: 10 }, { id: 'b', name: 'Bo Cee', courseHcOverride: 0 }];
  const r = createRound({ id: 'q', game: 'quota', course: flat(18), holesCount: 18, players, settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: true });
  // Nine pars each: 18 points. Quotas 26 and 36 scale to 13 and 18 over nine holes, so Al is +5, Bo is level
  play(r, 9);
  const t = totalsTable(r);
  assert.deepEqual(t.map(x => [x.quota, x.target, x.vsQuota]), [[26, 13, 5], [36, 18, 0]]);
  assert.deepEqual(money(r), { a: 5, b: -5 }); // Al takes the $5 pot
  // Per point: Al is 5 better against quota, $1 a point
  r.settings = { ...r.settings, quota: { stake: 1, payout: 'per' } };
  assert.deepEqual(money(r), { a: 5, b: -5 });
  // The full round compares against the full quota: 36 points each, Al +10, Bo 0
  play(r, 18);
  assert.deepEqual(money(r), { a: 10, b: -10 });
  // An odd number of holes still sums to zero to the cent
  const odd = play(createRound({ id: 'q', game: 'quota', course: flat(18), holesCount: 18, players, settings: { ...SETTINGS, quota: { stake: 1, payout: 'per' } }, hcPct: 100, useHandicaps: true }), 5);
  assert.equal(sum(money(odd)), 0);
  assert.deepEqual(money(odd), { a: 2.78, b: -2.78 }); // 10 × 5/18 = 2.777…
});

// ---------------------------------------------------------------------------
// #6 Player-left rules are kept (covered in left.test.js); with set free, a holder who leaves frees it

test('#6 rabbit: the holder leaving sets it loose and the next winner catches it', () => {
  const r = play(mk('rabbit', ['a', 'b', 'c'], { holes: 9 }), 9, { 1: { a: 3 }, 7: { c: 3 } });
  r.left = { a: 4 };
  assert.deepEqual(money(r), { a: 0, b: -5, c: 5 });
});

// ---------------------------------------------------------------------------
// #7 The spare cent on a 3-way split is paid by the first-listed player

test('#7 spare cent: on a three-way split the first-listed player takes the odd cent', () => {
  // Three tied winners of a $20 pot: $6.666… each, so one gets a cent less, and it's the first listed
  const r = play(mk('stroke', ['a', 'b', 'c', 'd']), 1, { 1: { d: 5 } });
  assert.deepEqual(money(r), { a: 1.66, b: 1.67, c: 1.67, d: -5 });
  // $10 won three ways: one cent short, so the first listed is the one rounded up
  assert.deepEqual(roundCents({ a: 10 / 3, b: 10 / 3, c: 10 / 3, d: -10 }), { a: 3.34, b: 3.33, c: 3.33, d: -10 });
  // $10 owed three ways: the first listed pays the spare cent
  assert.deepEqual(roundCents({ a: -10 / 3, b: -10 / 3, c: -10 / 3, d: 10 }), { a: -3.34, b: -3.33, c: -3.33, d: 10 });
});

// ---------------------------------------------------------------------------
// #8 The handicap percentage goes on each player first, like WHS

test('#8 handicap percentage per player: 17 and 4 at 90% get 11 strokes, not 12', () => {
  assert.deepEqual(strokesOffLow([17, 4], 90), [11, 0]);
  const players = [{ id: 'a', name: 'Al Bee', courseHcOverride: 17 }, { id: 'b', name: 'Bo Cee', courseHcOverride: 4 }];
  const r = createRound({ id: 'h', game: 'match', course: flat(18), holesCount: 18, players, settings: SETTINGS, hcPct: 90, useHandicaps: true });
  assert.deepEqual(r.players.map(p => p.plays), [11, 0]);
});

// ---------------------------------------------------------------------------
// #9 The 3-person scramble allowance is WHS 30/20/10

test('#9 scramble allowances match WHS Appendix C (2024)', () => {
  assert.deepEqual(SCRAMBLE_ALLOWANCE[2], [0.35, 0.15]);
  assert.deepEqual(SCRAMBLE_ALLOWANCE[3], [0.3, 0.2, 0.1]);
  assert.deepEqual(SCRAMBLE_ALLOWANCE[4], [0.25, 0.2, 0.15, 0.1]);
  // The rules check example: 10, 20 and 30 is 3 + 4 + 3 = 10 strokes
  assert.equal(scrambleTeamHandicap([10, 20, 30]), 10);
  const players = [10, 20, 30, 8, 16].map((hc, i) => ({ id: `p${i}`, name: `P${i} X`, courseHcOverride: hc }));
  const r = createRound({ id: 's', game: 'scramble', course: flat(18), holesCount: 18, players, settings: SETTINGS, hcPct: 100, useHandicaps: true, teams: [['p0', 'p1', 'p2'], ['p3', 'p4']] });
  assert.deepEqual(r.teams.map(t => t.courseHc), [10, 5]); // pair: 8 × 35% + 16 × 15% = 2.8 + 2.4 = 5.2
  assert.deepEqual(r.teams.map(t => t.plays), [5, 0]);
});

// ---------------------------------------------------------------------------
// Saved defaults move to the new rules once

test('saved settings from before rev 2 move to the new defaults once', () => {
  const old = { hcPct: 100, stableford: { stake: 1, payout: 'per', modified: true }, quota: { stake: 1, payout: 'per' }, rabbit: { stake: 10, tiesFree: true } };
  const m = migrateSettings(old);
  assert.equal(m.rev, SETTINGS_REV);
  assert.deepEqual(m.stableford, { stake: 5, payout: 'pot', modified: true });
  assert.deepEqual(m.quota, { stake: 5, payout: 'pot' });
  assert.deepEqual(m.rabbit, { stake: 10, mode: 'free', tiesFree: false });
  // A stake someone picked is kept
  assert.deepEqual(migrateSettings({ quota: { stake: 2, payout: 'per' } }).quota, { stake: 2, payout: 'per' });
  // Already migrated: left alone, so a later choice of per point sticks
  const now = { ...m, quota: { stake: 1, payout: 'per' } };
  assert.equal(migrateSettings(now), now);
  assert.equal(migrateSettings(null), null);
});
