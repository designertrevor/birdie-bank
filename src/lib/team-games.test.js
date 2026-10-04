// The team games (2026-10-03): Best ball, Shamble, Alternate shot and Chapman. Hand-worked cases on a
// flat nine or eighteen (par 4s), handicaps off unless a case says otherwise, so the sums are easy to check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES, TEAM_GAMES, createRound, roundResults, teamTable, teamHoleScore, teamBestCount, teamFormatOf, matchScored,
  scorers, nassauPressOptions, changeBets, wholeRoundOnly, leftRule, sideGameChoices, sideGamesOf, livePreview, canLeave, teamCounting,
} from './round.js';
import { stakeSummary, stakeHeadline } from './stakes.js';
import { houseRulesLine } from './house-rules.js';
import { betOf, withBet } from './plans.js';
import { agreementItems } from './agreed.js';
import { revealSteps } from './reveal.js';
import { matchRoundMoment } from './moments.js';
import { bestOf, foursomesTeamHandicap, chapmanTeamHandicap } from './games.js';
import { suggestedAllowance, allowanceHint } from './allowances.js';
import { defaultTeams, teamsProblem } from './teams.js';
import { drivesNeeded, scrambleDrives } from './scramble-drives.js';
import { TEAM_DEFAULTS } from './settings.js';

const DEFAULT_SETTINGS = {
  hcPct: 100,
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2, turnPress: false, noLastPress: false },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  ...TEAM_DEFAULTS,
};
const SETTINGS = structuredClone(DEFAULT_SETTINGS);
const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const PEOPLE = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss', 'Ed Roy', 'Flo Tam', 'Gus Ory', 'Hal Ng'].map((name, i) => ({ id: 'abcdefgh'[i], name, index: null }));

function round(game, teams, { holes = 9, settings = {}, useHandicaps = false, hcs = null } = {}) {
  const s = structuredClone(SETTINGS);
  s[game] = { ...s[game], ...settings };
  const ids = teams.flat();
  const players = ids.map((id, i) => ({ ...PEOPLE.find(p => p.id === id), ...(hcs ? { courseHcOverride: hcs[i] } : {}) }));
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players, settings: s, hcPct: 100, useHandicaps, teams });
}
/** Par for every scorer on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(scorers(r).map(p => [p.id, 4])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
const zero = b => Math.round(Object.values(b).reduce((a, v) => a + v * 100, 0));
const TWO = [['a', 'b'], ['c', 'd']];

// ---------------------------------------------------------------------------
// The games and their shape

test('the four team games are in GAMES, in the Team group, two teams each', () => {
  for (const g of TEAM_GAMES) {
    assert.equal(GAMES[g].group, 'Team');
    assert.equal(GAMES[g].teams.count, 2);
    assert.ok(DEFAULT_SETTINGS[g], `${g} has default bets`);
    assert.equal(DEFAULT_SETTINGS[g].format, 'nassau');
    assert.equal(DEFAULT_SETTINGS[g].scoring, 'match');
  }
  assert.equal(GAMES.altshot.teams.size, 2);
  assert.equal(GAMES.chapman.teams.size, 2);
  assert.deepEqual([GAMES.bestball.min, GAMES.bestball.max], [4, 8]);
});

test('bestOf: the best one, or the best two added up; null when short or missing', () => {
  assert.equal(bestOf([5, 3, 4]), 3);
  assert.equal(bestOf([5, 3, 4, 6], 2), 7);
  assert.equal(bestOf([4, null]), null);
  assert.equal(bestOf([4], 2), null);
});

test('team handicaps: alternate shot is half the pair added up, Chapman 60% low and 40% high', () => {
  assert.equal(foursomesTeamHandicap([10, 20]), 15);
  assert.equal(foursomesTeamHandicap([7, 8]), 8); // 7.5 rounds up
  assert.equal(chapmanTeamHandicap([20, 10]), 14); // 6 + 8
  assert.equal(chapmanTeamHandicap([5, 12]), 8); // 3 + 4.8 = 7.8
});

test('teams: Best ball needs two teams the same size; Alternate shot needs pairs', () => {
  assert.deepEqual(defaultTeams('bestball', ['a', 'b', 'c', 'd', 'e', 'f']), [['a', 'b', 'c'], ['d', 'e', 'f']]);
  assert.equal(teamsProblem('bestball', [['a', 'b', 'c'], ['d', 'e', 'f']], ['a', 'b', 'c', 'd', 'e', 'f']), null);
  assert.match(teamsProblem('bestball', [['a', 'b'], ['c', 'd', 'e']], ['a', 'b', 'c', 'd', 'e']), /same size, so it takes 4, 6 or 8/);
  assert.match(teamsProblem('shamble', [['a'], ['b', 'c', 'd']], ['a', 'b', 'c', 'd']), /same size/);
  assert.match(teamsProblem('altshot', [['a'], ['b', 'c', 'd']], ['a', 'b', 'c', 'd']), /teams of 2/);
  // Three teams left over from a scramble don't make a Best ball round
  assert.equal(teamsProblem('bestball', [['a', 'b'], ['c', 'd'], ['e', 'f']], ['a', 'b', 'c', 'd', 'e', 'f']), 'Best ball is played in two teams');
});

// ---------------------------------------------------------------------------
// Best ball

test('Best ball 2 v 2, Nassau as a match: the team best ball wins the hole', () => {
  // Nine holes: First 4, Last 5, All 9. Ann's birdie wins hole 1; hole 6 goes to Cy's birdie
  const r = scores(round('bestball', TWO), 9, { 1: { a: 3, b: 6 }, 6: { c: 3 } });
  const t = teamTable(r);
  assert.equal(t.rows[0].winner, 0);
  assert.deepEqual(t.rows[0].counted, [['a'], ['c', 'd']]);
  assert.equal(t.rows[5].winner, 1);
  // First 4: A 1 up ($5). Last 5: B 1 up ($5). All 9: halved
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
  const r2 = scores(round('bestball', TWO), 9, { 1: { a: 3 }, 2: { b: 3 } });
  // A wins the first 4 and all 9: $10 each from the other team
  assert.deepEqual(bal(r2), { a: 10, b: 10, c: -10, d: -10 });
});

test('Best ball 2 v 2 as a match pays exactly what a 2 v 2 Nassau does on the same scores', () => {
  const over = { 1: { a: 3 }, 3: { c: 3, d: 5 }, 5: { b: 3 }, 8: { d: 3 } };
  const bb = scores(round('bestball', TWO), 9, over);
  const n = scores(round('nassau', TWO), 9, over);
  assert.deepEqual(bal(bb), bal(n));
  assert.deepEqual(roundResults(bb).pairs, roundResults(n).pairs);
});

test('Best ball 3 v 3 counting the best two: both balls add up', () => {
  const teams = [['a', 'b', 'c'], ['d', 'e', 'f']];
  const r = scores(round('bestball', teams, { settings: { count: 2 } }), 9, { 1: { a: 3, b: 5, c: 6, d: 4, e: 4, f: 3 } });
  assert.equal(teamBestCount(r), 2);
  // A: 3 + 4 (Bo's 5 and Cy's 6 don't count)... the best two are Ann 3 and Bo 5 = 8; B: 3 + 4 = 7
  assert.equal(teamHoleScore(r, 0, r.holes[0]).score, 8);
  assert.equal(teamHoleScore(r, 1, r.holes[0]).score, 7);
  assert.equal(teamTable(r).rows[0].winner, 1);
  // B 1 up on the first 4 and all 9: each of them wins $10, each of A pays $10
  assert.deepEqual(bal(r), { a: -10, b: -10, c: -10, d: 10, e: 10, f: 10 });
});

test('Best two only counts with teams of three or four: 2 v 2 stays best ball', () => {
  const r = round('bestball', TWO, { settings: { count: 2 } });
  assert.equal(teamBestCount(r), 1);
  assert.equal(teamFormatOf(r).count, 1);
});

test('Best ball 4 v 4, best one of four', () => {
  const teams = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']];
  const r = scores(round('bestball', teams, { settings: { format: 'total', stake: 5 } }), 9, { 4: { h: 3 } });
  // One bet on the round: team B 1 up, $5 each
  assert.deepEqual(bal(r), { a: -5, b: -5, c: -5, d: -5, e: 5, f: 5, g: 5, h: 5 });
});

test('Best ball as stroke play: each leg goes to the lower team total', () => {
  // A: birdies on 1 and 2 (front -2). B: birdie on 6, and a 6 on hole 7 doesn't count (partner's 4 does)
  const r = scores(round('bestball', TWO, { settings: { scoring: 'stroke' } }), 9, { 1: { a: 3 }, 2: { b: 3 }, 6: { c: 3 }, 7: { d: 6 } });
  const t = teamTable(r);
  assert.equal(t.scoring, 'stroke');
  const [front, back, total] = t.lines;
  assert.deepEqual(front.status.totals, [14, 16]);
  assert.equal(front.status.leader, 0);
  assert.deepEqual(back.status.totals, [20, 19]);
  assert.equal(back.status.leader, 1);
  assert.deepEqual(total.status.totals, [34, 35]);
  // A wins front and total ($10), B wins the back ($5): A each +5
  assert.deepEqual(bal(r), { a: 5, b: 5, c: -5, d: -5 });
});

test('Stroke play has no presses; a match does', () => {
  const stroke = scores(round('bestball', TWO, { settings: { scoring: 'stroke' } }), 3, { 1: { a: 3 }, 2: { a: 3 } });
  assert.deepEqual(nassauPressOptions(stroke, 4), []);
  assert.equal(matchScored(stroke), false);
  const m = scores(round('bestball', TWO), 2, { 1: { a: 3 }, 2: { a: 3 } });
  assert.equal(matchScored(m), true);
  // B is 2 down on the first 4 and on all 9 going to hole 3
  const opts = nassauPressOptions(m, 3);
  assert.deepEqual(opts.map(o => [o.leg, o.trailing]), [['front', 1], ['total', 1]]);
});

test('A press in Best ball pays like a Nassau press', () => {
  const r = scores(round('bestball', TWO), 9, { 1: { a: 3 }, 2: { a: 3 }, 3: { c: 3 }, 4: { c: 3 } });
  r.presses.push({ id: 'p1', leg: 'front', start: 3, by: 1 });
  // First 4: halved. Press from 3: B 2 up ($5). All 9: halved
  assert.deepEqual(bal(r), { a: -5, b: -5, c: 5, d: 5 });
});

test('Best ball per hole: every hole won pays the bet in force on it', () => {
  const r = scores(round('bestball', TWO, { settings: { format: 'hole', perHole: 2 } }), 9, { 1: { a: 3 }, 2: { b: 3 }, 3: { a: 3 }, 5: { d: 3 } });
  const line = teamTable(r).lines[0];
  assert.deepEqual(line.won, [3, 1]);
  assert.equal(line.played, 9);
  assert.deepEqual(bal(r), { a: 4, b: 4, c: -4, d: -4 });
  // Up to $5 a hole from hole 6: a hole won by A on 7 pays $5
  const up = changeBets(r, { ...r.settings.bestball, perHole: 5 }, 6);
  up.scores[7] = { a: 3, b: 4, c: 4, d: 4 };
  assert.deepEqual(bal(up), { a: 9, b: 9, c: -9, d: -9 });
});

test('Best ball with handicaps: net scores decide the hole', () => {
  // Di gets a stroke on every hole (course handicap 9 over nine holes); Ann plays off 0
  const r = round('bestball', TWO, { useHandicaps: true, hcs: [0, 0, 0, 9] });
  scores(r, 1, { 1: { a: 4, b: 5, c: 5, d: 4 } });
  // A's best is 4; B's best is Di's 4 - 1 = 3
  assert.equal(teamTable(r).rows[0].winner, 1);
});

test('Best ball money sums to zero, and the live preview agrees with the results', () => {
  const r = scores(round('bestball', [['a', 'b', 'c'], ['d', 'e', 'f']], { settings: { count: 2, format: 'hole', perHole: 3 } }), 8, { 2: { a: 3 }, 5: { f: 2 } });
  r.scores[9] = { a: 4, b: 4, c: 4, d: 3, e: 4, f: 4 };
  assert.equal(zero(bal(r)), 0);
  const without = structuredClone(r);
  delete without.scores[9];
  const p = livePreview(without, r.holes[8], { scores: r.scores[9] });
  assert.deepEqual(p.balances, bal(r));
  assert.deepEqual(p.delta, { a: -3, b: -3, c: -3, d: 3, e: 3, f: 3 });
});

test('Best ball can have side games; Alternate shot and Chapman cannot', () => {
  assert.ok(sideGameChoices('bestball').includes('skins'));
  assert.ok(sideGameChoices('shamble').length > 0);
  assert.deepEqual(sideGameChoices('altshot'), []);
  assert.deepEqual(sideGameChoices('chapman'), []);
  const r = round('altshot', TWO);
  r.sideGames = [{ game: 'skins', settings: { ...SETTINGS.skins } }];
  assert.deepEqual(sideGamesOf(r), []);
});

test('Best ball with Skins on the side: one total, each game worked out on its own', () => {
  const r = scores(round('bestball', TWO), 9, { 1: { a: 3 }, 2: { b: 3 } });
  r.sideGames = [{ game: 'skins', settings: { ...SETTINGS.skins, value: 1, carryover: false } }];
  const res = roundResults(r);
  assert.deepEqual(res.detail.byGame.main.balances, { a: 10, b: 10, c: -10, d: -10 });
  // Two skins, one each to Ann and Bo, $1 from each of the other three
  assert.deepEqual(res.detail.byGame.skins.balances, { a: 2, b: 2, c: -2, d: -2 });
  assert.deepEqual(res.balances, { a: 12, b: 12, c: -12, d: -12 });
});

test('Best ball: a player leaving leaves the partner carrying the team', () => {
  const r = scores(round('bestball', TWO), 4);
  r.left = { b: 4 };
  assert.match(leftRule(r, 'b'), /Ann carries on for the team/);
  scores(r, 6, { 5: { a: 3 } });
  delete r.scores[5].b; delete r.scores[6].b;
  assert.equal(teamTable(r).rows[4].winner, 0);
  // Teams of three counting two: two players gone leaves one, so the holes after don't count
  const t3 = round('bestball', [['a', 'b', 'c'], ['d', 'e', 'f']], { settings: { count: 2 } });
  t3.left = { a: 3, b: 3, c: 3 };
  assert.match(leftRule(t3, 'c'), /nobody left/);
  t3.left = { a: 3, b: 3 };
  assert.match(leftRule(t3, 'a'), /can’t make 2 scores/);
});

test('Changing how a team game is played covers the whole round; amounts can change from a hole', () => {
  const s = DEFAULT_SETTINGS.bestball;
  assert.equal(wholeRoundOnly('bestball', s, { ...s, front: 10 }), false);
  assert.equal(wholeRoundOnly('bestball', s, { ...s, format: 'hole' }), true);
  assert.equal(wholeRoundOnly('altshot', s, { ...s, scoring: 'stroke' }), true);
  assert.equal(wholeRoundOnly('shamble', s, { ...s, count: 2 }), true);
});

// ---------------------------------------------------------------------------
// Shamble

test('Shamble scores like best ball and can play for minimum drives', () => {
  const r = scores(round('shamble', TWO, { settings: { drives: 3 } }), 9, { 1: { a: 3 }, 2: { b: 3 } });
  assert.deepEqual(bal(r), { a: 10, b: 10, c: -10, d: -10 });
  assert.equal(drivesNeeded(r), 3);
  r.marks = { 1: { drives: { t0: 'a', t1: 'c' } } };
  const t = scrambleDrives(r);
  assert.equal(t[0].players.find(p => p.id === 'a').drives, 1);
  assert.equal(drivesNeeded(round('bestball', TWO)), 0);
});

// ---------------------------------------------------------------------------
// Alternate shot and Chapman

test('Alternate shot is scored by team, off half the pair’s course handicaps', () => {
  const r = round('altshot', TWO, { useHandicaps: true, hcs: [10, 20, 4, 6] });
  // A: (10 + 20) / 2 = 15. B: (4 + 6) / 2 = 5. B plays off 0, A gets 10 strokes
  assert.deepEqual(r.teams.map(t => [t.courseHc, t.plays]), [[15, 10], [5, 0]]);
  assert.deepEqual(scorers(r).map(u => u.id), ['t0', 't1']);
  // Over nine holes A gets a stroke on every hole and one more on the hardest
  scores(r, 1, { 1: { t0: 5, t1: 4 } });
  // Hole 1 is the hardest: A's 5 is a net 3
  assert.equal(teamTable(r).rows[0].scores[0], 3);
  assert.equal(teamTable(r).rows[0].winner, 0);
});

test('Chapman is scored by team, off 60% of the low handicap and 40% of the high', () => {
  const r = round('chapman', TWO, { useHandicaps: true, hcs: [10, 20, 4, 6] });
  // A: 6 + 8 = 14. B: 2.4 + 2.4 = 4.8, so 5. A gets 9
  assert.deepEqual(r.teams.map(t => [t.courseHc, t.plays]), [[14, 9], [5, 0]]);
});

test('Alternate shot money: one score a team, Nassau as a match', () => {
  const r = scores(round('altshot', TWO), 9, { 1: { t0: 3 }, 6: { t1: 3 }, 7: { t1: 3 } });
  // First 4: A 1 up ($5). Last 5: B 2 up ($5). All 9: B 1 up ($5). B each +5
  assert.deepEqual(bal(r), { a: -5, b: -5, c: 5, d: 5 });
});

test('Chapman as stroke play, one bet on the round', () => {
  const r = scores(round('chapman', TWO, { settings: { format: 'total', scoring: 'stroke', stake: 20 } }), 9, { 2: { t1: 3 }, 4: { t1: 5 }, 8: { t1: 5 } });
  // B: -1 +1 +1 = one over, A level: A wins $20 each
  assert.equal(teamTable(r).lines[0].label, 'Total');
  assert.deepEqual(bal(r), { a: 20, b: 20, c: -20, d: -20 });
});

test('Alternate shot needs both partners: once one leaves, that team has no score and the holes stop counting', () => {
  const r = scores(round('altshot', TWO), 3, { 1: { t0: 3 } });
  r.left = { b: 3 };
  assert.ok(canLeave(round('altshot', TWO), 'b'));
  assert.match(leftRule(r, 'b'), /needs both partners/);
  r.scores[4] = { t1: 3 };
  assert.deepEqual(scorers(r, r.holes[3]).map(u => u.id), ['t1']);
  // Hole 4 isn't played between the teams: A stays 1 up on the first 4 and all 9
  assert.equal(teamTable(r).rows[3].winner, undefined);
  assert.deepEqual(bal(r), { a: 10, b: 10, c: -10, d: -10 });
});

// ---------------------------------------------------------------------------
// Handicap allowances

test('WHS suggestions: four-ball for pairs, best 1 or 2 of 4 for bigger teams, the USGA selected drive guidance for Shamble', () => {
  const pairs = [['a', 'b'], ['c', 'd']];
  const threes = [['a', 'b', 'c'], ['d', 'e', 'f']];
  const fours = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']];
  assert.equal(suggestedAllowance('bestball', { teams: pairs, settings: { scoring: 'match' } }).pct, 90);
  assert.equal(suggestedAllowance('bestball', { teams: pairs, settings: { scoring: 'stroke' } }).pct, 85);
  // Per hole is holes won, so it's the match play number
  assert.equal(suggestedAllowance('bestball', { teams: pairs, settings: { scoring: 'stroke', format: 'hole' } }).pct, 90);
  assert.equal(suggestedAllowance('bestball', { teams: fours, settings: { count: 1 } }).pct, 75);
  assert.equal(suggestedAllowance('bestball', { teams: fours, settings: { count: 2 } }).pct, 85);
  assert.equal(allowanceHint(suggestedAllowance('bestball', { teams: threes, settings: { count: 1 } })), 'Handicap rules suggest 75% for best 1 of 3');
  assert.equal(suggestedAllowance('shamble', { teams: pairs }).pct, 75);
  assert.equal(suggestedAllowance('shamble', { teams: threes }).pct, 70);
  assert.equal(suggestedAllowance('shamble', { teams: fours }).pct, 65);
  assert.equal(suggestedAllowance('bestball', { teams: [['a'], ['b', 'c']] }), null);
  // Alternate shot and Chapman have their allowances built into the team handicap already
  assert.equal(suggestedAllowance('altshot', { teams: pairs }), null);
  assert.equal(suggestedAllowance('chapman', { teams: pairs }), null);
});

// ---------------------------------------------------------------------------
// Bet lines, the rules card, the reveal, the ballot and moments

test('bet lines: a Nassau, one bet, per hole, stroke play and the house rules', () => {
  const s = { ...SETTINGS };
  assert.equal(stakeSummary('bestball', s), '$5 / $5 / $5');
  assert.equal(stakeHeadline('bestball', s), '$5 a side');
  assert.equal(stakeSummary('altshot', { altshot: { ...s.altshot, format: 'total', scoring: 'stroke' } }), '$10 a player · stroke play');
  assert.equal(stakeSummary('chapman', { chapman: { ...s.chapman, format: 'hole', perHole: 3 } }), '$3 a hole');
  assert.equal(stakeSummary('shamble', { shamble: { ...s.shamble, count: 2, drives: 3 } }), '$5 / $5 / $5 · 3 drives each · best two balls');
  assert.equal(houseRulesLine('bestball', s.bestball), '');
});

test('a 2 v 2 round set to best two plays and reads as best ball', () => {
  const r = round('bestball', TWO, { settings: { count: 2 } });
  assert.equal(r.settings.bestball.count, 1);
  assert.equal(stakeSummary('bestball', r.settings), '$5 / $5 / $5');
});

test('the ballot: one number for each team game, whichever way it is bet', () => {
  assert.equal(betOf('bestball', SETTINGS), 5);
  const hole = { altshot: { ...SETTINGS.altshot, format: 'hole', perHole: 2 } };
  assert.equal(betOf('altshot', hole), 2);
  assert.equal(withBet('altshot', hole, 5).altshot.perHole, 5);
  const nassau = withBet('bestball', SETTINGS, 10).bestball;
  assert.deepEqual([nassau.front, nassau.back, nassau.total], [10, 10, 10]);
  assert.equal(withBet('chapman', { chapman: { ...SETTINGS.chapman, format: 'total' } }, 20).chapman.stake, 20);
});

test('the rules card: presses for a match, team strokes for alternate shot, the bet line once', () => {
  const m = round('bestball', TWO);
  const items = agreementItems(m);
  assert.equal(items.find(i => i.id === 'presses')?.text, 'Press when 2 down');
  assert.equal(items.find(i => i.id === 'bet:main').text, '$5 / $5 / $5');
  const stroke = round('bestball', TWO, { settings: { scoring: 'stroke' } });
  assert.equal(agreementItems(stroke).find(i => i.id === 'presses'), undefined);
  const alt = round('altshot', TWO, { useHandicaps: true, hcs: [10, 20, 4, 6] });
  const strokes = agreementItems(alt).filter(i => i.group === 'strokes').map(i => i.label);
  assert.deepEqual(strokes, ['Ann & Bo', 'Cy & Di']);
  const sh = round('shamble', [['a', 'b', 'c'], ['d', 'e', 'f']], { settings: { count: 2, drives: 2 } });
  const rules = agreementItems(sh).filter(i => i.group === 'rules' && i.on).map(i => i.text);
  assert.deepEqual(rules, ['Best two balls count', '2 drives each']);
});

test('the reveal: a match reads leg by leg; stroke play by strokes; per hole by holes won', () => {
  const m = scores(round('bestball', TWO), 9, { 1: { a: 3 }, 2: { b: 3 } });
  const steps = revealSteps(m, roundResults(m)).steps;
  assert.deepEqual(steps.map(x => [x.label, x.text, x.amount ?? 0]), [['First 4', 'Ann & Bo 2 up', 5], ['Last 5', 'Halved', 0], ['All 9', 'Ann & Bo 2 up', 5]]);
  const st = scores(round('bestball', TWO, { settings: { scoring: 'stroke', format: 'total' } }), 9, { 1: { a: 3 }, 2: { b: 3 } });
  const one = revealSteps(st, roundResults(st));
  assert.equal(one.title, 'The match');
  assert.deepEqual(one.steps.map(x => [x.label, x.text, x.amount]), [['Total', 'Ann & Bo by 2 strokes, 34 to 36', 10]]);
  const ph = scores(round('altshot', TWO, { settings: { format: 'hole' } }), 9, { 1: { t0: 3 }, 2: { t1: 3 }, 3: { t1: 3 } });
  assert.deepEqual(revealSteps(ph, roundResults(ph)).steps.map(x => [x.label, x.text, x.amount]), [['Holes won', 'Cy & Di won 2 to 1', 2]]);
});

test('match moments come up in a team match, and not in stroke play', () => {
  // Ann & Bo win the first 4 with a hole to spare: 3 up with 1 to play after hole 3
  const m = scores(round('bestball', TWO), 3, { 1: { a: 3 }, 2: { a: 3 }, 3: { b: 3 } });
  assert.ok(matchRoundMoment(m, 3));
  const st = scores(round('bestball', TWO, { settings: { scoring: 'stroke' } }), 3, { 1: { a: 3 }, 2: { a: 3 }, 3: { b: 3 } });
  assert.equal(matchRoundMoment(st, 3), null);
});

test('the Counts tag: the team’s best ball, every tied one, and nothing until the team is in', () => {
  const r = round('bestball', TWO);
  const h = r.holes[0];
  assert.deepEqual(teamCounting(r, h, { a: 4, b: 4, c: 3, d: 5 }), ['a', 'b', 'c']);
  assert.deepEqual(teamCounting(r, h, { a: 4, c: 3, d: 5 }), ['c']);
  assert.deepEqual(teamCounting(round('altshot', TWO), h, { t0: 4, t1: 5 }), []);
});

test('changing a team match to one bet clears the presses made on the old legs', () => {
  const r = scores(round('bestball', TWO), 3, { 1: { a: 3 }, 2: { a: 3 } });
  r.presses.push({ id: 'p1', leg: 'front', start: 3, by: 1 });
  const next = changeBets(r, { ...r.settings.bestball, format: 'total' });
  assert.deepEqual(next.presses, []);
  assert.deepEqual(bal(next), { a: 10, b: 10, c: -10, d: -10 });
  // A change of amount alone keeps them
  assert.equal(changeBets(r, { ...r.settings.bestball, back: 10 }, 4).presses.length, 1);
  // A hand-made round with a press on a leg that isn't there still adds up
  const odd = structuredClone(next);
  odd.presses = [{ id: 'p2', leg: 'front', start: 3, by: 1 }];
  assert.deepEqual(bal(odd), { a: 10, b: 10, c: -10, d: -10 });
});

// ---------------------------------------------------------------------------
// Review fixes (2026-10-03)

test('review: in alternate shot and Chapman one team keeps both partners, so the holes after always have a score box', () => {
  for (const game of ['altshot', 'chapman']) {
    const r = scores(round(game, TWO), 3);
    // Either team can lose a partner first
    assert.ok(canLeave(r, 'a') && canLeave(r, 'c'), game);
    r.left = { a: 3 };
    // Then nobody else can go: the other team would lose a partner and nobody could score hole 4
    assert.equal(canLeave(r, 'c'), false, game);
    assert.equal(canLeave(r, 'd'), false, game);
    assert.equal(canLeave(r, 'b'), false, game);
    assert.deepEqual(scorers(r, r.holes[3]).map(u => u.id), ['t1']);
  }
  // A scramble team plays on with anyone still there, as before
  const s = scores(round('scramble', [['a', 'b'], ['c', 'd']]), 3);
  s.left = { a: 3 };
  assert.ok(canLeave(s, 'c'));
});
