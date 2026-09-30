// Allowances by game and half strokes (ROADMAP area 5, free fairness tools). Old rounds, with
// neither, give exactly the money they always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPlayerToRound, createRound, gameResults, gameView, matchWinners, nassauPressOptions, netFor, popsFor, roundResults, skinsTable, strokesFor,
} from './round.js';
import { netScoreName } from './golf.js';
import {
  gamePct, halfStrokesOffered, halfStrokesOn, netText, pctsDiffer, playsAtPct, strokesRulesLines, strokesWords,
} from './allowances.js';
import { rematchSetup } from './rematch.js';
import { SETTINGS, SIDE_SETTINGS, oldRoundFixtures } from './side-bets.fixtures.js';

const flat = n => ({ id: 'f', name: 'Flat', city: 'Town', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
/** A round on a flat par-4 course where hole n is the n-th hardest. `hcs` are course handicaps by player. */
function mk(game, hcs, { hcPct = 100, half = false, teams = null, sides = {} } = {}) {
  const ids = Object.keys(hcs);
  const r = createRound({
    id: 'r', game, course: flat(18), holesCount: 18, players: ids.map(id => ({ id, name: id.toUpperCase(), courseHcOverride: hcs[id] })),
    settings: structuredClone(SETTINGS), hcPct, useHandicaps: true, teams, halfStrokes: half,
  });
  r.sideGames = Object.entries(sides).map(([g, extra]) => ({ game: g, settings: structuredClone(SIDE_SETTINGS[g]), ...extra }));
  if (!r.sideGames.length) delete r.sideGames;
  return r;
}
/** Score holes by playing position (1-based): { pos: { pid: gross } }. */
function play(r, byPos) {
  for (const [pos, s] of Object.entries(byPos)) r.scores[r.holes[pos - 1].no] = s;
  return r;
}
const cents = v => Math.round(v * 100);
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);

// --------------------------- Old rounds ---------------------------

test('old rounds with side games still give exactly the snapshot money', () => {
  const snap = JSON.parse(readFileSync(new URL('./side-bets.snapshot.json', import.meta.url), 'utf8'));
  for (const { name, round } of oldRoundFixtures()) {
    assert.equal(round.halfStrokes, undefined);
    assert.equal(pctsDiffer(round), false, name);
    const byGame = Object.fromEntries(Object.entries(roundResults(round).detail.byGame).map(([k, g]) => [k, g.balances]));
    assert.deepEqual(byGame, snap[name], name);
    // Every game plays off the round's strokes: the side views keep the very same players
    for (const sg of round.sideGames) assert.equal(gameView(round, sg.game).players, round.players, name);
  }
});

test('a round made without half strokes is saved without the field, and strokes stay whole', () => {
  const r = mk('nassau', { a: 0, b: 20 });
  assert.equal('halfStrokes' in r, false);
  for (const h of r.holes) assert.equal(strokesFor(r, r.players[1], h), popsFor(r, r.players[1], h));
  assert.equal(strokesFor(r, r.players[1], r.holes[0]), 2);
});

test('a side game with its own % equal to the round\'s is the same as none at all', () => {
  for (const { name, round } of oldRoundFixtures()) {
    const same = { ...round, sideGames: round.sideGames.map(sg => ({ ...sg, hcPct: round.hcPct })) };
    assert.deepEqual(roundResults(same).balances, roundResults(round).balances, name);
  }
});

test('half strokes on a game they don\'t apply to change nothing', () => {
  for (const { name, round } of oldRoundFixtures()) {
    if (['nassau', 'skins', 'match'].includes(round.game) || round.sideGames.some(sg => ['skins', 'rabbit'].includes(sg.game))) continue;
    assert.deepEqual(roundResults({ ...round, halfStrokes: true }).balances, roundResults(round).balances, name);
  }
});

// --------------------------- Half strokes ---------------------------

test('a half stroke turns a halved hole into a win for the better player', () => {
  // B gets a stroke on the hardest hole only (hole 1). A 4, B 5: net 4 v 4 halved with full strokes
  const full = play(mk('match', { a: 0, b: 1 }, { teams: [['a'], ['b']] }), { 1: { a: 4, b: 5 } });
  const half = play(mk('match', { a: 0, b: 1 }, { teams: [['a'], ['b']], half: true }), { 1: { a: 4, b: 5 } });
  assert.equal(netFor(full, full.players[1], full.holes[0]), 4);
  assert.equal(netFor(half, half.players[1], half.holes[0]), 4.5);
  assert.equal(matchWinners(full)[1], null);
  assert.equal(matchWinners(half)[1], 0);
});

test('a half stroke still wins a hole the gross scores tie, and a real tie stays a tie', () => {
  const r = play(mk('match', { a: 0, b: 2 }, { teams: [['a'], ['b']], half: true }), {
    1: { a: 5, b: 5 }, // B's pop: 4½ beats 5
    2: { a: 3, b: 4 }, // A's birdie beats B's 3½
    3: { a: 4, b: 4 }, // no pop on hole 3: halved
  });
  assert.deepEqual(matchWinners(r), { 1: 1, 2: 0, 3: null });
});

test('half strokes: skins carry on a tie and pay the right player, to the cent', () => {
  // C gets pops on holes 1 and 2, B on hole 1
  const r = play(mk('skins', { a: 0, b: 1, c: 2 }, { half: true }), {
    1: { a: 4, b: 5, c: 5 }, // A 4, B 4½, C 4½: A wins outright (with full strokes all three tie)
    2: { a: 4, b: 4, c: 5 }, // A 4, B 4, C 4½: A and B tie, the skin carries
    3: { a: 4, b: 3, c: 4 }, // B wins two skins
  });
  const t = skinsTable(r, 'net');
  assert.equal(t.rows[0].winner, 'a');
  assert.equal(t.rows[1].winner, null);
  assert.equal(t.rows[2].winner, 'b');
  assert.equal(t.rows[2].skins, 2);
  const res = gameResults(r);
  // $2 a skin: A takes 1 from each of 2 players, B takes 2 from each
  assert.deepEqual(res.balances, { a: 4 - 4, b: 8 - 2, c: -2 - 4 });
  assert.equal(sumCents(res.balances), 0);

  const fullR = { ...r, halfStrokes: undefined };
  assert.equal(skinsTable(fullR, 'net').rows[0].winner, null);
});

test('half strokes: a Nassau press comes up when the half pops put a side two down', () => {
  const settings = { ...SETTINGS.nassau, pressMode: 'manual', threshold: 2 };
  const r = mk('nassau', { a: 0, b: 2 }, { half: true });
  r.settings.nassau = settings;
  play(r, { 1: { a: 4, b: 5 }, 2: { a: 4, b: 5 } }); // halved with full strokes, A wins both with half
  assert.deepEqual(nassauPressOptions(r, 3).map(o => [o.leg, o.trailing]), [['front', 1], ['total', 1]]);
  const full = { ...r, halfStrokes: undefined };
  assert.deepEqual(nassauPressOptions(full, 3), []);
  assert.equal(sumCents(gameResults(r).balances), 0);
});

test('half strokes only count in the matches and skins: a Birdie pot next to them keeps full strokes', () => {
  const r = mk('nassau', { a: 0, b: 1 }, { half: true, sides: { birdies: {} } });
  play(r, { 1: { a: 4, b: 4 } }); // B: net birdie with a full stroke
  assert.equal(halfStrokesOn(r), true);
  assert.equal(halfStrokesOn(gameView(r, 'birdies')), false);
  assert.equal(netFor(gameView(r, 'birdies'), r.players[1], r.holes[0]), 3);
  assert.equal(netFor(r, r.players[1], r.holes[0]), 3.5);
  // Side Skins on a stroke play round: half in the Skins, full in the stroke play
  const s = mk('stroke', { a: 0, b: 1 }, { half: true, sides: { skins: {} } });
  assert.equal(halfStrokesOn(s), false);
  assert.equal(halfStrokesOn(gameView(s, 'skins')), true);
});

test('a pickup stays a whole number on the card with half strokes', () => {
  const r = play(mk('skins', { a: 0, b: 1 }, { half: true }), { 1: { a: 4, b: 'X' } });
  // Par 4 + 2 + one pop = 7 gross, less a half stroke
  assert.equal(netFor(r, r.players[1], r.holes[0]), 6.5);
});

test('net scores show as 4½ and never 4.5', () => {
  assert.equal(netText(4.5), '4½');
  assert.equal(netText(0.5), '½');
  assert.equal(netText(-0.5), '−½');
  assert.equal(netText(-1.5), '−1½');
  assert.equal(netText(71), '71');
  assert.equal(netText(null), '–');
  assert.equal(netScoreName(3.5, 4), 'net 3½');
  assert.equal(netScoreName(3, 4), 'net birdie');
  assert.equal(strokesWords(1, true), '1 half stroke');
  assert.equal(strokesWords(3, false), '3 strokes');
});

test('half strokes are offered only when a game in the round can use them', () => {
  assert.equal(halfStrokesOffered('stroke', []), false);
  assert.equal(halfStrokesOffered('stroke', [{ game: 'skins' }]), true);
  assert.equal(halfStrokesOffered('nassau', []), true);
  assert.equal(halfStrokesOffered('wolf', [{ game: 'birdies' }]), false);
});

test('handicaps off: half strokes are never saved', () => {
  const r = createRound({ id: 'r', game: 'skins', course: flat(18), holesCount: 18, players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false, halfStrokes: true });
  assert.equal(r.halfStrokes, undefined);
});

// --------------------------- Allowances by game ---------------------------

test('each game plays off its own %: the Skins at 50% gives different strokes from the match at full', () => {
  const r = mk('match', { a: 0, b: 10 }, { teams: [['a'], ['b']], sides: { skins: { hcPct: 50 } } });
  assert.equal(gamePct(r), 100);
  assert.equal(gamePct(r, 'skins'), 50);
  assert.equal(pctsDiffer(r), true);
  const skins = gameView(r, 'skins');
  assert.equal(r.players[1].plays, 10);
  assert.equal(skins.players[1].plays, 5);
  assert.equal(skins.hcPct, 50);
  // Hole 6 (the 6th hardest): a stroke in the match, none in the Skins
  const h6 = r.holes[5];
  assert.equal(strokesFor(r, r.players[1], h6), 1);
  assert.equal(strokesFor(skins, skins.players[1], h6), 0);
  // So B's 5 halves the match hole and loses the skin to A's 4
  play(r, { 6: { a: 4, b: 5 } });
  const res = roundResults(r);
  assert.equal(matchWinners(gameView(r, 'main'))[6], null);
  assert.equal(skinsTable(gameView(r, 'skins'), 'net').rows[5].winner, 'a');
  assert.equal(sumCents(res.balances), 0);
});

test('per-game % with handicaps off changes nothing', () => {
  const r = mk('match', { a: 0, b: 10 }, { teams: [['a'], ['b']], sides: { skins: { hcPct: 50 } } });
  r.useHandicaps = false;
  assert.equal(gameView(r, 'skins').players, r.players);
});

test('playsAtPct: off the low player, and a late joiner placed off the same player as before', () => {
  const players = [{ id: 'a', courseHc: 4, plays: 0 }, { id: 'b', courseHc: 17, plays: 13 }];
  assert.deepEqual(playsAtPct(players, 90).map(p => p.plays), [0, 11]);
  // A late joiner better than everyone plays off the same low player, so gives strokes back
  const r = mk('nassau', { a: 4, b: 17 }, { sides: { skins: { hcPct: 50 } } });
  play(r, { 1: { a: 4, b: 5 } });
  const next = addPlayerToRound(r, { id: 'c', name: 'C', courseHc: 0 }, r.holes[1].no, ['main', 'skins']);
  const skins = gameView(next, 'skins');
  assert.deepEqual(skins.players.map(p => p.plays), [0, 7, -2]);
});

test('the rules sheet names the game\'s % when games differ, and explains half strokes where they count', () => {
  const r = mk('nassau', { a: 0, b: 10 }, { half: true, sides: { skins: { hcPct: 80 }, birdies: {} } });
  assert.deepEqual(strokesRulesLines(r, 'skins').slice(0, 1), ['This game plays off 80% of strokes this round.']);
  assert.match(strokesRulesLines(r, 'main').at(-1), /^Half strokes:/);
  assert.equal(strokesRulesLines(r, 'birdies').some(l => l.startsWith('Half strokes')), false);
  assert.deepEqual(strokesRulesLines(mk('nassau', { a: 0, b: 10 }), 'main'), []);
});

test('a rematch keeps half strokes and each side game\'s %', () => {
  const r = mk('nassau', { a: 0, b: 10 }, { half: true, sides: { skins: { hcPct: 80 } } });
  const state = { players: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } }, courses: {}, me: 'a' };
  const s = rematchSetup(state, r);
  assert.equal(s.halfStrokes, true);
  assert.equal(s.sideGames[0].hcPct, 80);
  const plain = rematchSetup(state, mk('nassau', { a: 0, b: 10 }, { sides: { skins: {} } }));
  assert.equal('halfStrokes' in plain, false);
  assert.equal('hcPct' in plain.sideGames[0], false);
});
