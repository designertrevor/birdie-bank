// The rest of mid-round settings (2026-10-03): teams or sides, the playing order (banker and wolf
// order, Sixes partners, who throws the first hammer) and what the round is played for, each with
// the money it moves, the Tab kept honest, the change listed on the rules card, and old rounds
// keeping their money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankerHoleSetup, createRound, gameView, nassauPressOptions, roundResults, settingsAt, sixesMatches, wolfFor, changeBets } from './round.js';
import {
  changeHammerWho, changeOrder, changePlayFor, changeTeams, lineupKind, lineupLabel, lineupMenuText, nextOpenIdx, orderNow, orderRuns, orderText,
  playForText, replayAutoPresses, sidesText, standingLine, tabLine, teamGroups, teamsChangeProblem, teamsLocked,
} from './lineup.js';
import { moneyLine } from './hole-fix.js';
import { agreementItems, lockAgreement, logChange, noteChanges } from './agreed.js';
import { onTab, tabResults } from './play-for.js';
import { oldRounds } from './overnight5-money.fixtures.js';
import { TEAM_DEFAULTS } from './settings.js';
import { applyHole, assemble, buildHoles, buildMeta } from './sync-model.js';
import { metaToSend } from './keeper.js';

const course = n => ({ id: 'c', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const NAMES = { a: 'Ann Lee', b: 'Bo Ray', c: 'Cy Doe', d: 'Dan Fox' };
const four = ['a', 'b', 'c', 'd'].map(id => ({ id, name: NAMES[id], index: 0 }));
const SETTINGS = {
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off' },
  wolf: { point: 2, loneMultiplier: 2, blind: false, blindPlus: 1 },
  sixes: { stake: 5, mode: 'match', carry: false },
  match: { stake: 10, pressMode: 'off', threshold: 2 },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2, turnPress: false, noLastPress: false },
  hammer: { stake: 5, max: 3, who: 'either' },
  vegas: { point: 1, birdieFlip: false, birdieDouble: false },
  scramble: { stake: 5, drives: 0 },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
};
const mk = (game, { holes = 18, teams = null, settings = {}, players = four } = {}) => createRound({
  id: 'r', game, course: course(holes), holesCount: holes, nine: 'front', players,
  settings: { ...structuredClone(SETTINGS), ...settings }, hcPct: 100, useHandicaps: false, teams,
});
const bal = r => roundResults(r).balances;
/** Score holes 1..n with `fn(pos)` giving { id: gross }. */
function play(r, n, fn) {
  for (let i = 0; i < n; i++) r.scores[r.holes[i].no] = fn(i + 1);
  return r;
}

// ---------------------------------------------------------------------------
// Banker order: from the next hole on

function bankerRound(rotation = 'rotate') {
  const r = mk('banker', { settings: { banker: { ...SETTINGS.banker, rotation } } });
  // Three holes played, each with the banker the rotation gave it, Ann making 3 and the rest 4
  play(r, 3, () => ({ a: 3, b: 4, c: 4, d: 4 }));
  for (let i = 0; i < 3; i++) r.banker[r.holes[i].no] = bankerHoleSetup(r, i);
  return r;
}

test('the banker order reads from the next hole: whoever is first banks it', () => {
  const r = bankerRound();
  assert.equal(nextOpenIdx(r), 3);
  // Rotating through a, b, c, d, hole 4 is Dan's
  assert.deepEqual(orderNow(r).ids, ['d', 'a', 'b', 'c']);
  assert.equal(lineupKind(r), 'order');
  assert.equal(lineupLabel(r), 'Banker order');
});

test('a new banker order counts from the next hole, and the holes played keep their banker and money', () => {
  const r = bankerRound();
  const after = changeOrder(r, ['b', 'd', 'a', 'c']);
  const main = gameView(after, 'main');
  assert.deepEqual([3, 4, 5, 6, 7].map(i => bankerHoleSetup(main, i).banker), ['b', 'd', 'a', 'c', 'b']);
  // Holes 1 to 3 keep Ann, Bo and Cy as banker, so nobody's money moves
  assert.deepEqual([0, 1, 2].map(i => bankerHoleSetup(main, i).banker), ['a', 'b', 'c']);
  assert.deepEqual(bal(after), bal(r));
  assert.equal(moneyLine(r, after), null);
  assert.deepEqual(orderNow(after).ids, ['b', 'd', 'a', 'c']);
  // The round passed in is untouched
  assert.deepEqual(r.players.map(p => p.id), ['a', 'b', 'c', 'd']);
});

test('the same order back is no change at all', () => {
  const r = bankerRound();
  assert.equal(changeOrder(r, orderNow(r).ids), r);
  // Not the same players: nothing changes
  assert.equal(changeOrder(r, ['a', 'b', 'c']), r);
  assert.equal(changeOrder(r, ['a', 'b', 'c', 'x']), r);
});

test('banker each nine: the first in the order banks the rest of this nine, the next the back nine', () => {
  const r = bankerRound('nine');
  assert.deepEqual(orderNow(r).ids, ['a', 'b', 'c', 'd']);
  const after = changeOrder(r, ['c', 'a', 'b', 'd']);
  assert.deepEqual(orderRuns(after), [{ from: 4, to: 9, id: 'c' }, { from: 10, to: 18, id: 'a' }]);
  assert.deepEqual(bal(after), bal(r));
});

test('a fixed banker: the first in the order banks every hole left', () => {
  const r = bankerRound('fixed');
  const after = changeOrder(r, ['d', 'a', 'b', 'c']);
  assert.deepEqual(orderRuns(after), [{ from: 4, to: 18, id: 'd' }]);
  assert.deepEqual(bal(after), bal(r));
});

test('"Low" and "Pick" bankers have no run of bankers to show: the scores or the group decide', () => {
  assert.deepEqual(orderRuns(bankerRound('low')), []);
  assert.deepEqual(orderRuns(bankerRound('choice')), []);
});

test('the rotation runs on in the new order, one hole each', () => {
  const after = changeOrder(bankerRound(), ['b', 'd', 'a', 'c']);
  assert.deepEqual(orderRuns(after).slice(0, 5), [
    { from: 4, to: 4, id: 'b' }, { from: 5, to: 5, id: 'd' }, { from: 6, to: 6, id: 'a' }, { from: 7, to: 7, id: 'c' }, { from: 8, to: 8, id: 'b' },
  ]);
});

// ---------------------------------------------------------------------------
// Wolf order

function wolfRound() {
  const r = mk('wolf');
  play(r, 2, () => ({ a: 3, b: 4, c: 5, d: 5 }));
  r.wolf[1] = { wolf: 'a', partner: 'b' };
  r.wolf[2] = { wolf: 'b', partner: null };
  return r;
}

test('the wolf order counts from the next hole; the holes played keep their wolf and money', () => {
  const r = wolfRound();
  assert.deepEqual(orderNow(r).ids, ['c', 'd', 'a', 'b']);
  const after = changeOrder(r, ['d', 'c', 'a', 'b']);
  const main = gameView(after, 'main');
  assert.deepEqual([2, 3, 4, 5, 6].map(i => wolfFor(main, i)), ['d', 'c', 'a', 'b', 'd']);
  assert.deepEqual(bal(after), bal(r));
  assert.equal(moneyLine(r, after), null);
  assert.equal(lineupLabel(after), 'Wolf order');
});

test('a wolf who has left stays out of the order', () => {
  const r = wolfRound();
  r.left = { d: 2 };
  // Three still playing; hole 3 is the third of the rotation through a, b, c
  assert.deepEqual(orderNow(r).ids, ['c', 'a', 'b']);
  const after = changeOrder(r, ['b', 'c', 'a']);
  const main = gameView(after, 'main');
  assert.deepEqual([2, 3, 4].map(i => wolfFor(main, i)), ['b', 'c', 'a']);
  assert.ok(after.players.some(p => p.id === 'd'));
});

test('a banker who has left stays out of the order, and the order set reads from the next hole', () => {
  const r = bankerRound();
  r.left = { d: 3 };
  // Hole 4 would be Dan's, but he has gone, so the bank passes to Ann and Dan isn't listed
  assert.deepEqual(orderNow(r).ids, ['a', 'b', 'c']);
  assert.equal(lineupMenuText(r), 'Banker order · Ann, Bo, Cy');
  const after = changeOrder(r, ['b', 'a', 'c']);
  const main = gameView(after, 'main');
  assert.deepEqual([3, 4, 5].map(i => bankerHoleSetup(main, i).banker), ['b', 'a', 'c']);
  assert.deepEqual(orderRuns(after)[0], { from: 4, to: 4, id: 'b' });
  assert.deepEqual(orderNow(after).ids, ['b', 'a', 'c']);
  assert.ok(after.players.some(p => p.id === 'd'));
  // The holes played keep their banker and money
  assert.deepEqual(bal(after), bal(r));
  // The same three in the same order is no change
  assert.equal(changeOrder(r, ['a', 'b', 'c']), r);
});

// ---------------------------------------------------------------------------
// Sixes partners: the whole round

test('new Sixes partners count for the whole round, and the sheet says whose money moves', () => {
  const r = mk('sixes');
  // Ann and Cy make 3s on the first six, Bo and Dan 5s
  play(r, 6, () => ({ a: 3, b: 5, c: 3, d: 5 }));
  // As set, Ann and Bo played Cy and Dan: a halved match, so nothing yet
  assert.deepEqual(sixesMatches(r)[0].sides, [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
  assert.equal(orderText(r), '1–6 Ann & Bo v Cy & Dan; 7–12 Ann & Cy v Bo & Dan; 13–18 Ann & Dan v Bo & Cy');
  // Ann and Cy were really partners on the first six
  const after = changeOrder(r, ['a', 'c', 'b', 'd']);
  assert.deepEqual(sixesMatches(after)[0].sides, [['a', 'c'], ['b', 'd']]);
  assert.deepEqual(bal(after), { a: 5, b: -5, c: 5, d: -5 });
  assert.equal(moneyLine(r, after), 'Money recounts: Ann +$5, Cy +$5, Bo −$5, Dan −$5');
  assert.equal(lineupLabel(after), 'Partners');
});

// ---------------------------------------------------------------------------
// Teams and sides: the whole round

test('new sides in match play: every hole is worked out again', () => {
  const r = mk('match', { teams: [['a', 'b'], ['c', 'd']] });
  // Ann makes 3 and Cy 4 on every hole; Bo and Dan make 5s
  play(r, 4, () => ({ a: 3, b: 5, c: 4, d: 5 }));
  assert.equal(lineupKind(r), 'teams');
  assert.equal(lineupLabel(r), 'Sides');
  assert.equal(sidesText(r), 'Ann & Bo v Cy & Dan');
  const before = bal(r);
  assert.ok(before.a > 0 && before.c < 0);
  // Ann and Dan were really on a side against Bo and Cy: still Ann's 3s win, so Dan wins and Cy pays
  const after = changeTeams(r, [['a', 'd'], ['b', 'c']]);
  assert.deepEqual(teamGroups(after), [['a', 'd'], ['b', 'c']]);
  assert.equal(sidesText(after), 'Ann & Dan v Bo & Cy');
  const now = bal(after);
  assert.equal(now.a, before.a);
  assert.equal(now.d, before.a);
  assert.equal(now.b, before.c);
  assert.equal(now.c, before.c);
  assert.equal(moneyLine(r, after), `Money recounts: Dan +$${before.a * 2}, Bo −$${before.a * 2}`);
});

test('the same sides back, or a split that does not work, is no change', () => {
  const r = mk('match', { teams: [['a', 'b'], ['c', 'd']] });
  assert.equal(changeTeams(r, [['b', 'a'], ['d', 'c']]), r);
  assert.equal(teamsChangeProblem(r, [['a', 'b', 'c', 'd'], []]), 'Every team needs at least one player');
  assert.equal(changeTeams(r, [['a', 'b', 'c', 'd'], []]), r);
  const vegas = mk('vegas', { teams: [['a', 'b'], ['c', 'd']] });
  assert.equal(teamsChangeProblem(vegas, [['a'], ['b', 'c', 'd']]), 'Vegas needs teams of 2');
  assert.equal(teamsChangeProblem(vegas, [['a', 'c'], ['b', 'd']]), null);
});

test('Vegas teams change for the whole round', () => {
  const r = mk('vegas', { teams: [['a', 'b'], ['c', 'd']] });
  play(r, 2, () => ({ a: 3, b: 6, c: 4, d: 4 }));
  // 36 against 44: Ann and Bo win 8 a hole
  assert.deepEqual(bal(r), { a: 16, b: 16, c: -16, d: -16 });
  // Ann and Cy (34) against Bo and Dan (46): 12 a hole
  const after = changeTeams(r, [['a', 'c'], ['b', 'd']]);
  assert.deepEqual(bal(after), { a: 24, b: -24, c: 24, d: -24 });
});

test('a Nassau’s auto presses are worked out again for the new sides, hole by hole', () => {
  const r = mk('nassau', { teams: [['a', 'b'], ['c', 'd']] });
  // Ann wins the first four holes for her side as set
  const sc = { a: 3, b: 5, c: 4, d: 5 };
  // As the app plays it: save a hole, then the auto presses for the next one
  for (let i = 0; i < 4; i++) {
    r.scores[r.holes[i].no] = { ...sc };
    for (const o of nassauPressOptions(gameView(r, 'main'), i + 2)) r.presses.push({ id: `auto-${o.leg}-${i + 2}`, leg: o.leg, start: i + 2, by: o.trailing, auto: true });
  }
  assert.ok(r.presses.length > 0);
  // Working them out again with the same sides gives the same presses
  assert.deepEqual(replayAutoPresses(r).presses, r.presses);
  // A press called by hand stays
  r.presses.push({ id: 'm-1', leg: 'back', start: 10, by: 0 });
  // Ann and Cy on one side: every hole is still won by the side with Ann, so the presses are the other side's
  const after = changeTeams(r, [['a', 'c'], ['b', 'd']]);
  assert.ok(after.presses.some(p => p.id === 'm-1'));
  assert.deepEqual(after.presses.filter(p => p.auto).map(p => p.by), r.presses.filter(p => p.auto).map(p => p.by));
  assert.deepEqual(bal(after), { a: bal(r).a, b: bal(r).c, c: bal(r).a, d: bal(r).d });
});

test('Nassau presses that only came up for the old sides are dropped', () => {
  const r = mk('nassau', { teams: [['a', 'b'], ['c', 'd']] });
  // Ann's 3s win holes 1 and 2 for Ann and Bo; Bo's 3s would have tied them with the other side
  const holes = [{ a: 3, b: 5, c: 4, d: 4 }, { a: 3, b: 5, c: 4, d: 4 }];
  for (let i = 0; i < 2; i++) {
    r.scores[r.holes[i].no] = holes[i];
    for (const o of nassauPressOptions(gameView(r, 'main'), i + 2)) r.presses.push({ id: `auto-${o.leg}-${i + 2}`, leg: o.leg, start: i + 2, by: o.trailing, auto: true });
  }
  assert.ok(r.presses.length > 0);
  // Ann and Cy against Bo and Dan: Ann wins each hole, still 2 up, so the presses stand
  assert.ok(changeTeams(r, [['a', 'c'], ['b', 'd']]).presses.length > 0);
  // Ann and Dan against Bo and Cy, and Cy really made 3s: halved holes, nobody 2 down, no presses
  const tied = { ...r, scores: { 1: { a: 3, b: 5, c: 3, d: 4 }, 2: { a: 3, b: 5, c: 3, d: 4 } } };
  assert.deepEqual(changeTeams(tied, [['a', 'd'], ['b', 'c']]).presses, []);
});

test('auto presses replayed for new sides only come up where presses were on: a stretch played with them off gets none', () => {
  const r = mk('nassau', { teams: [['a', 'b'], ['c', 'd']], settings: { nassau: { ...SETTINGS.nassau, pressMode: 'off' } } });
  play(r, 10, () => ({ a: 3, b: 5, c: 4, d: 5 }));
  // Auto presses switched on from hole 11, after ten holes played with none
  const on = changeBets(r, { ...r.settings.nassau, pressMode: 'auto' }, 11);
  const after = changeTeams(on, [['a', 'c'], ['b', 'd']]);
  assert.deepEqual(after.presses, []);
  assert.deepEqual(bal(after), bal(changeTeams(r, [['a', 'c'], ['b', 'd']])));
  // Auto presses on the front nine, switched off from hole 10: the front nine's are worked out again
  const auto = mk('nassau', { teams: [['a', 'b'], ['c', 'd']] });
  play(auto, 9, () => ({ a: 3, b: 5, c: 4, d: 5 }));
  const off = changeBets(replayAutoPresses(auto), { ...auto.settings.nassau, pressMode: 'off' }, 10);
  assert.ok(off.presses.length > 0);
  const moved = changeTeams(off, [['a', 'c'], ['b', 'd']]);
  assert.ok(moved.presses.length > 0 && moved.presses.every(p => p.start <= 10));
  assert.ok(moved.presses.every(p => p.by === 1));
});

test('the same sides listed the other way round are no change, and a side keeps its place with most of its players', () => {
  const r = mk('match', { teams: [['a', 'b'], ['c', 'd']] });
  play(r, 3, () => ({ a: 4, b: 5, c: 3, d: 5 }));
  // Ann and Bo, behind, called a press on hole 3
  r.presses = [{ id: 'm', leg: 'match', start: 3, by: 0 }];
  assert.equal(changeTeams(r, [['c', 'd'], ['a', 'b']]), r);
  assert.equal(changeTeams(r, [['d', 'c'], ['b', 'a']]), r);
  // Cy joins Ann and Bo, listed second: they stay the first side, so the press stays theirs
  const after = changeTeams(r, [['d'], ['a', 'b', 'c']]);
  assert.deepEqual(teamGroups(after), [['a', 'b', 'c'], ['d']]);
  assert.deepEqual(after.presses, r.presses);
  // One from each side swaps: it's as the keeper listed it
  assert.deepEqual(teamGroups(changeTeams(r, [['a', 'd'], ['c', 'b']])), [['a', 'd'], ['c', 'b']]);
});

test('Hammer sides: hammers thrown stay with their side of the card', () => {
  const r = mk('hammer', { teams: [['a', 'b'], ['c', 'd']] });
  play(r, 1, () => ({ a: 3, b: 5, c: 4, d: 5 }));
  // The first side hammered and the second took it: Ann's 3 wins it at $10
  r.marks[1] = { hammers: [0], conceded: null };
  const after = changeTeams(r, [['a', 'c'], ['b', 'd']]);
  assert.deepEqual(after.marks, r.marks);
  assert.deepEqual(bal(after), { a: 10, b: -10, c: 10, d: -10 });
});

test('who throws the first hammer changes for every hole, and the bets played keep their amounts', () => {
  let r = mk('hammer', { teams: [['a', 'b'], ['c', 'd']] });
  r = changeBets(r, { ...r.settings.hammer, stake: 10 }, 5);
  const after = changeHammerWho(r, 'trailing');
  assert.equal(settingsAt(after, 1).hammer.who, 'trailing');
  assert.equal(settingsAt(after, 1).hammer.stake, 5);
  assert.equal(settingsAt(after, 5).hammer.who, 'trailing');
  assert.equal(settingsAt(after, 5).hammer.stake, 10);
  assert.equal(changeHammerWho(after, 'trailing'), after);
  assert.equal(changeHammerWho(r, 'nobody'), r);
});

test('a Hammer round with no first hammer rule plays it as either side, so picking that is no change', () => {
  let r = mk('hammer', { teams: [['a', 'b'], ['c', 'd']] });
  r = changeBets(r, { ...r.settings.hammer, stake: 10 }, 5);
  delete r.settings.hammer.who;
  for (const e of r.betHistory) delete e.settings.who;
  assert.equal(changeHammerWho(r, 'either'), r);
  assert.equal(changeHammerWho(r, 'trailing').settings.hammer.who, 'trailing');
});

test('Best ball sides: auto presses are worked out again for the new sides, and money follows', () => {
  const r = mk('bestball', { teams: [['a', 'c'], ['b', 'd']], settings: { bestball: { ...structuredClone(TEAM_DEFAULTS.bestball), pressMode: 'auto' } } });
  // Ann and Cy make 3 against 5 for five holes, so Bo and Dan press the front and the total
  for (let i = 0; i < 5; i++) {
    r.scores[r.holes[i].no] = { a: 3, b: 5, c: 3, d: 5 };
    for (const o of nassauPressOptions(gameView(r, 'main'), i + 2)) r.presses.push({ id: `auto-${o.leg}-${i + 2}`, leg: o.leg, start: i + 2, by: o.trailing, auto: true });
  }
  assert.ok(r.presses.length > 0);
  // Ann & Bo v Cy & Dan: every hole was halved, so no press ever came up
  const after = changeTeams(r, [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(after.presses, []);
  // Ann & Bo win the next four: the front and the total pay $5 each, with no presses on top
  for (let i = 5; i < 9; i++) { after.scores[after.holes[i].no] = { a: 3, b: 5, c: 4, d: 5 }; r.scores[r.holes[i].no] = { a: 3, b: 5, c: 4, d: 5 }; }
  const stale = { ...after, presses: r.presses };
  assert.ok(bal(stale).a > bal(after).a, 'a press the old sides made would pay on the new ones');
  assert.equal(bal(after).a, 10);
});

test('a Scramble’s teams change only before the first score, with team strokes worked out again', () => {
  const players = four.map((p, i) => ({ ...p, index: [2, 10, 20, 30][i] }));
  const r = createRound({ id: 's', game: 'scramble', course: course(18), holesCount: 18, nine: 'front', players, settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: true, teams: [['a', 'b'], ['c', 'd']] });
  assert.equal(teamsLocked(r), null);
  const after = changeTeams(r, [['a', 'd'], ['b', 'c']]);
  assert.deepEqual(after.teams.map(t => t.players), [['a', 'd'], ['b', 'c']]);
  assert.notDeepEqual(after.teams.map(t => t.courseHc), r.teams.map(t => t.courseHc));
  assert.equal(after.teams[0].name, 'Ann & Dan');
  // Once a team's ball is on the card, the teams stay
  const started = { ...r, scores: { 1: { t0: 4 } } };
  assert.match(teamsLocked(started), /own ball/);
  assert.equal(changeTeams(started, [['a', 'd'], ['b', 'c']]), started);
});

test('Alternate shot and Chapman lock their teams once a score is in; Best ball and Shamble teams can still change', () => {
  const settings = { ...structuredClone(SETTINGS), ...structuredClone(TEAM_DEFAULTS) };
  for (const game of ['altshot', 'chapman']) {
    const r = createRound({ id: game, game, course: course(18), holesCount: 18, nine: 'front', players: four, settings, hcPct: 100, useHandicaps: false, teams: [['a', 'b'], ['c', 'd']] });
    assert.equal(teamsLocked(r), null, game);
    const started = { ...r, scores: { 1: { [r.teams[0].id]: 4 } } };
    assert.match(teamsLocked(started), /own ball/, game);
  }
  for (const game of ['bestball', 'shamble']) {
    const r = createRound({ id: game, game, course: course(18), holesCount: 18, nine: 'front', players: four, settings, hcPct: 100, useHandicaps: false, teams: [['a', 'b'], ['c', 'd']] });
    assert.equal(teamsLocked({ ...r, scores: { 1: { a: 4, b: 5, c: 4, d: 4 } } }), null, game);
  }
});

test('an Alternate shot side bet on scores keeps its two players on different teams', () => {
  const settings = { ...structuredClone(SETTINGS), ...structuredClone(TEAM_DEFAULTS) };
  const r = createRound({ id: 'as', game: 'altshot', course: course(18), holesCount: 18, nine: 'front', players: four, settings, hcPct: 100, useHandicaps: false, teams: [['a', 'b'], ['c', 'd']] });
  r.bets = [{ id: 'x', kind: 'match', sides: ['a', 'c'], stake: 5, holes: [1, 18] }];
  assert.equal(teamsChangeProblem(r, [['a', 'c'], ['b', 'd']]), 'Ann and Cy have a side bet on their scores, so they need to be on different teams.');
  assert.equal(teamsChangeProblem(r, [['a', 'd'], ['b', 'c']]), null);
});

test('a Scramble side bet on scores keeps its two players on different teams', () => {
  const r = mk('scramble', { teams: [['a', 'b'], ['c', 'd']] });
  r.bets = [{ id: 'x', kind: 'match', sides: ['a', 'c'], stake: 5, holes: [1, 18] }];
  assert.equal(teamsChangeProblem(r, [['a', 'c'], ['b', 'd']]), 'Ann and Cy have a side bet on their scores, so they need to be on different teams.');
  assert.equal(teamsChangeProblem(r, [['a', 'd'], ['b', 'c']]), null);
});

// ---------------------------------------------------------------------------
// Play for: the whole round, the Tab kept honest

function moneyBanker() {
  const r = bankerRound();
  r.status = 'active';
  return r;
}

test('money to points: what would have gone on the Tab won’t, and the round reads in points', () => {
  const r = moneyBanker();
  const was = bal(r);
  const pts = changePlayFor(r, { kind: 'points' });
  assert.deepEqual(pts.playFor, { kind: 'points' });
  // The game's numbers don't change, only what they're worth
  assert.deepEqual(bal(pts), was);
  assert.ok(Object.values(tabResults(pts).balances).every(v => v === 0));
  assert.equal(tabLine(r, pts), 'Won’t go on the Tab: so far Ann +$25, Dan −$5, Bo −$10, Cy −$10');
  assert.equal(standingLine(pts), 'Points so far: Ann +25 pts, Dan −5 pts, Bo −10 pts, Cy −10 pts');
  assert.equal(playForText(pts), 'Points (bragging rights)');
  // And back to money: it all goes on the Tab again, the round as it was
  const back = changePlayFor(pts, null);
  assert.deepEqual(back, r);
  assert.equal(tabLine(pts, back), 'Goes on the Tab when the round’s done: so far Ann +$25, Dan −$5, Bo −$10, Cy −$10');
  assert.equal(standingLine(back), null);
});

test('the same play for is no change; before a hole is played nothing moves', () => {
  const r = moneyBanker();
  assert.equal(changePlayFor(r, null), r);
  assert.equal(changePlayFor(r, { kind: 'money' }), r);
  const fresh = mk('banker');
  const lunch = changePlayFor(fresh, { kind: 'reward', reward: 'Lunch', owes: 'last' });
  assert.equal(tabLine(fresh, lunch), null);
  assert.equal(standingLine(lunch), null);
});

test('money to a reward: the games stay off the Tab, so far someone wins it, and side bets for money still go on', () => {
  const r = moneyBanker();
  r.bets = [{ id: 'x', kind: 'custom', sides: ['b', 'c'], stake: 4, holes: [1, 18], winner: 'b', label: 'Longest drive' }];
  const lunch = changePlayFor(r, { kind: 'reward', reward: 'Lunch', owes: 'last' });
  assert.equal(lunch.bets[0].playFor, 'money');
  assert.equal(onTab({ ...lunch, status: 'done' }), true);
  // Only Bo's $4 from Cy is still on the Tab
  assert.deepEqual(tabResults(lunch).balances, { a: 0, b: 4, c: -4, d: 0 });
  // The games' money comes off; what's left is the side bet
  assert.equal(tabLine(r, lunch), 'The Tab moves: Bo +$10, Cy +$10, Dan +$5, Ann −$25. On it when the round’s done, so far: Bo +$4, Cy −$4');
  assert.match(standingLine(lunch), /^So far: Ann wins lunch\./);
  assert.equal(playForText(lunch), 'Lunch, last place buys');
  // Or the side bets go to points too: nothing's left on the Tab
  const all = changePlayFor(r, { kind: 'reward', reward: 'Lunch', owes: 'last' }, { cashBets: false });
  assert.equal('playFor' in all.bets[0], false);
  assert.equal(onTab({ ...all, status: 'done' }), false);
  assert.equal(tabLine(r, all), 'Won’t go on the Tab: so far Ann +$25, Dan −$5, Bo −$6, Cy −$14');
});

test('a reward round to points or money: each bet’s money or points choice goes, the round’s unit counts', () => {
  const r = moneyBanker();
  r.playFor = { kind: 'reward', reward: 'A drink', owes: 'everyone' };
  r.bets = [{ id: 'x', kind: 'custom', sides: ['b', 'c'], stake: 4, holes: [1, 18], winner: 'b', playFor: 'money' }];
  const pts = changePlayFor(r, { kind: 'points' });
  assert.equal('playFor' in pts.bets[0], false);
  assert.equal(tabLine(r, pts), 'Won’t go on the Tab: so far Bo +$4, Cy −$4');
  const cash = changePlayFor(r, null);
  assert.equal(cash.playFor, undefined);
  assert.equal('playFor' in cash.bets[0], false);
  // Lunch instead of a drink keeps each bet's choice
  const lunch = changePlayFor(r, { kind: 'reward', reward: 'Lunch', owes: 'everyone' });
  assert.equal(lunch.bets[0].playFor, 'money');
  assert.equal(tabLine(r, lunch), null);
  assert.equal(playForText(r), 'A drink, everyone else buys one');
});

test('points to a reward: side bets stay points unless they’re played for money', () => {
  const r = moneyBanker();
  r.playFor = { kind: 'points' };
  r.bets = [{ id: 'x', kind: 'custom', sides: ['b', 'c'], stake: 4, holes: [1, 18], winner: 'b' }];
  assert.equal('playFor' in changePlayFor(r, { kind: 'reward', reward: 'Lunch' }).bets[0], false);
  assert.equal(changePlayFor(r, { kind: 'reward', reward: 'Lunch' }, { cashBets: true }).bets[0].playFor, 'money');
});

// ---------------------------------------------------------------------------
// The rules card

test('the card says what it’s played for and the sides or order', () => {
  const byId = items => Object.fromEntries(items.map(x => [x.id, x]));
  const m = byId(agreementItems(mk('match', { teams: [['a', 'b'], ['c', 'd']] })));
  assert.equal(m.playFor.text, 'Money');
  assert.equal(m.sides.label, 'Sides');
  assert.equal(m.sides.text, 'Ann & Bo v Cy & Dan');
  const b = byId(agreementItems(mk('banker')));
  assert.equal(b.order.label, 'Banker order');
  assert.equal(b.order.text, 'Ann, Bo, Cy, Dan');
  assert.equal(b.sides, undefined);
  // A game with neither has just what it's played for
  assert.deepEqual(agreementItems(mk('skins', { settings: {} })).filter(x => x.group === 'lineup').map(x => x.id), ['playFor']);
});

test('a card locked before this takes the new lines in quietly', () => {
  const r = mk('match', { teams: [['a', 'b'], ['c', 'd']] });
  const agreed = lockAgreement(r, {}, 'a', 1);
  // As an older app saved it: no lineup lines
  agreed.seen = agreed.seen.filter(x => !['playFor', 'sides', 'order'].includes(x.id));
  const next = noteChanges({ ...r, agreed }, 2);
  assert.deepEqual(next.changes, []);
  assert.ok(next.seen.some(x => x.id === 'sides'));
});

test('new sides and a new play for are listed once each, against the hole', () => {
  let r = mk('match', { teams: [['a', 'b'], ['c', 'd']] });
  r.sideGames = [{ game: 'skins', settings: structuredClone(SETTINGS.skins) }];
  r.agreed = lockAgreement(r, {}, 'a', 1);
  play(r, 3, () => ({ a: 3, b: 5, c: 4, d: 5 }));
  r.current = 3;
  r = changeTeams(r, [['a', 'c'], ['b', 'd']]);
  r.agreed = noteChanges(r, 2);
  assert.deepEqual(r.agreed.changes.map(c => [c.hole, c.text]), [[4, 'Sides now Ann & Cy v Bo & Dan, every hole']]);
  // Points: one line, not one for each bet that now reads in points
  r = changePlayFor(r, { kind: 'points' });
  r.agreed = noteChanges(r, 3);
  assert.deepEqual(r.agreed.changes.slice(1).map(c => c.text), ['Now playing for points (bragging rights), every hole']);
  r = changePlayFor(r, { kind: 'reward', reward: 'Lunch', owes: 'last' });
  r.agreed = noteChanges(r, 4);
  assert.equal(r.agreed.changes.at(-1).text, 'Now playing for lunch, last place buys, every hole');
  // A bet raised at the same time as a switch is still listed
  r = changePlayFor(changeBets(r, { ...r.settings.match, stake: 20 }), null);
  r.agreed = noteChanges(r, 5);
  assert.deepEqual(r.agreed.changes.slice(-2).map(c => c.text), ['Now playing for money, every hole', 'Match play raised to $20 a player']);
});

test('the Banker and Wolf order is listed by the sheet, with the hole it starts from', () => {
  let r = bankerRound();
  r.agreed = lockAgreement(mk('banker'), {}, 'a', 1);
  r = changeOrder(r, ['b', 'd', 'a', 'c']);
  // The card takes in the new order without a line of its own...
  const noted = noteChanges(r, 2);
  assert.deepEqual(noted?.changes ?? [], []);
  // ...because the sheet lists it
  const logged = logChange({ ...r, agreed: noted }, 'Banker order from hole 4: Bo, Dan, Ann, Cy', 4, 3);
  assert.deepEqual(logged.changes, [{ hole: 4, text: 'Banker order from hole 4: Bo, Dan, Ann, Cy', at: 3 }]);
  // Nothing locked in, nothing listed
  assert.equal(logChange(mk('banker'), 'x', 1), null);
});

test('a Sixes partner change is listed by the card', () => {
  let r = mk('sixes');
  r.agreed = lockAgreement(r, {}, 'a', 1);
  r = changeOrder(r, ['a', 'c', 'b', 'd']);
  assert.equal(noteChanges(r, 2).changes[0].text, 'Partners now 1–6 Ann & Cy v Bo & Dan; 7–12 Ann & Bo v Cy & Dan; 13–18 Ann & Dan v Cy & Bo, every hole');
});

// ---------------------------------------------------------------------------
// Shared rounds: the keeper's phone changes it, every phone sees it

/** The round as a friend's phone puts it back together from the live meta and hole records. */
function overTheWire(r) {
  const back = assemble(buildMeta(r), {});
  for (const [no, data] of Object.entries(buildHoles(r))) applyHole(back, Number(no), data);
  return back;
}

test('new sides, a new order and a new play for ride in the live round, so every phone shows the same money', () => {
  // Sides, with the auto presses worked out again
  const n = mk('nassau', { teams: [['a', 'b'], ['c', 'd']] });
  for (let i = 0; i < 5; i++) {
    n.scores[n.holes[i].no] = { a: 3, b: 5, c: 4, d: 5 };
    for (const o of nassauPressOptions(gameView(n, 'main'), i + 2)) n.presses.push({ id: `auto-${o.leg}-${i + 2}`, leg: o.leg, start: i + 2, by: o.trailing, auto: true });
  }
  const sides = changeTeams(n, [['a', 'c'], ['b', 'd']]);
  const s2 = overTheWire(sides);
  assert.deepEqual(s2.teams, sides.teams);
  assert.deepEqual(s2.presses, sides.presses);
  assert.deepEqual(bal(s2), bal(sides));
  // The banker order, and points
  const b = changePlayFor(changeOrder(bankerRound(), ['b', 'd', 'a', 'c']), { kind: 'points' });
  const b2 = overTheWire(b);
  assert.deepEqual(b2.players.map(p => p.id), b.players.map(p => p.id));
  assert.deepEqual(b2.playFor, { kind: 'points' });
  assert.deepEqual(bankerHoleSetup(b2, 3).banker, 'b');
  assert.deepEqual(bal(b2), bal(b));
});

test('a phone that isn’t keeping score never sends a lineup or play for change of its own', () => {
  const base = buildMeta(mk('match', { teams: [['a', 'b'], ['c', 'd']] }));
  const mine = buildMeta(changePlayFor(changeTeams(mk('match', { teams: [['a', 'b'], ['c', 'd']] }), [['a', 'c'], ['b', 'd']]), { kind: 'points' }));
  const sent = metaToSend(base, mine, { editor: false, me: 'b' });
  assert.deepEqual(sent.teams, base.teams);
  assert.equal(sent.playFor, undefined);
  // The keeper's phone sends its copy as it is
  assert.deepEqual(metaToSend(base, mine, { editor: true, me: 'a' }).teams, mine.teams);
});

// ---------------------------------------------------------------------------
// Old rounds keep their money

test('old rounds: the order and sides as they are change nothing', () => {
  for (const { name, round } of oldRounds(160)) {
    if (lineupKind(round) === 'order') assert.equal(changeOrder(round, orderNow(round).ids), round, name);
    if (lineupKind(round) === 'teams') assert.equal(changeTeams(round, teamGroups(round)), round, name);
    assert.equal(changePlayFor(round, round.playFor ?? null), round, name);
  }
});

test('old Banker and Wolf rounds: any new order keeps every hole played at the money it had', () => {
  let n = 0;
  for (const { name, round } of oldRounds(160)) {
    if (round.game !== 'banker' && round.game !== 'wolf') continue;
    const ids = orderNow(round).ids;
    const shuffled = [...ids.slice(1), ids[0]].reverse();
    const after = changeOrder(round, shuffled);
    assert.deepEqual(bal(after), bal(round), name);
    n++;
  }
  assert.ok(n > 5);
});
