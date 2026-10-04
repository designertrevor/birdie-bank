// Play for: points (bragging rights) and rewards. The big promise: a points or reward round never
// puts a dollar anywhere money is added up (the Tab, shared rounds, carries, head to head, History,
// Season, Lately), so a mix of rounds gives exactly the money of the money rounds alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import {
  cleanReward, countsMoney, inUnits, wholeByGame, wholeDelta, wholeParts, wholePoints, noMoneyNote, padUnit, openRewards, playForLine, playForOf, points, rewardKey, rewardLineText, rewardNoun,
  rewardOutcome, storedPlayFor, unitFmt,
} from './play-for.js';
import { roundStakeLines } from './stakes.js';
import { headToHeadSummary, outstanding, personStory, roundsTogether, tabBalances } from './ledger.js';
import { pairDebt, sharedDebts, sharedRounds } from './pair-debts.js';
import { stripRound } from './shared-tab.js';
import { sharedOwed } from './carry.js';
import { headToHead, monthGroups, myMoney, myTab, netSeries, roundsInRange } from './history.js';
import { seasonBoard, seasonRounds } from './season.js';
import { latelyItems } from './lately.js';
import { holeMoneyLine, seasonStats, shareText } from './format.js';
import { shareCardModel } from './shareImage.js';
import { rematchSetup } from './rematch.js';
import { sameAs, setupFromUsual, usualFromRound } from './usuals.js';
import { newPlan, planStart } from './plans.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { joinPreview } from './og.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', custom: true, tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;
const NAMES = { t: 'Trevor', s: 'Sam Lee', d: 'Dave', a: 'Ann' };

/** A finished 9-hole skins round at `skin` a skin: every hole halved except the ones given. */
function round(id, ids, holes = {}, { code = null, daysAgo = 1, skin = 2, playFor, localMe } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x] || x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (playFor) r.playFor = playFor;
  if (localMe) r.localMe = localMe;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({
  me, players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name, index: 0 }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, crews: {}, customCourses: { f9: flat9 }, favorites: [], settings: {}, ...extra,
});
/** Skins won on the given holes by `w` (one stroke better than everyone else). */
const wins = (ids, byHole) => Object.fromEntries(Object.entries(byHole).map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));

// ---------------------------------------------------------------------------
// The model

test('old rounds (no playFor) and anything unreadable are money', () => {
  assert.deepEqual(playForOf({}), { kind: 'money' });
  assert.deepEqual(playForOf(null), { kind: 'money' });
  assert.deepEqual(playForOf({ playFor: 'points' }), { kind: 'money' });
  assert.deepEqual(playForOf({ playFor: { kind: 'dinner' } }), { kind: 'money' });
  assert.equal(countsMoney(round('r', ['t', 's'])), true);
  assert.equal(countsMoney({ playFor: { kind: 'points' } }), false);
  assert.equal(countsMoney({ playFor: { kind: 'reward', reward: 'Lunch' } }), false);
  // Stored: nothing for money, so a money round looks like it always did
  assert.equal(storedPlayFor({ kind: 'money' }), null);
  assert.equal(storedPlayFor(null), null);
  assert.deepEqual(storedPlayFor({ kind: 'points', extra: 1 }), { kind: 'points' });
});

test('a reward is tidied: trimmed, one space, 40 characters, Lunch when empty, last place by default', () => {
  assert.equal(cleanReward('  Round   of  beers '), 'Round of beers');
  assert.equal(cleanReward('x'.repeat(60)).length, 40);
  assert.deepEqual(playForOf({ playFor: { kind: 'reward', reward: '   ' } }), { kind: 'reward', reward: 'Lunch', owes: 'last' });
  assert.deepEqual(playForOf({ playFor: { kind: 'reward', reward: 'A drink', owes: 'everyone' } }), { kind: 'reward', reward: 'A drink', owes: 'everyone' });
  assert.equal(rewardNoun('Lunch'), 'lunch');
  assert.equal(rewardNoun('A drink'), 'a drink');
  assert.equal(rewardNoun('IPA'), 'IPA');
  assert.equal(playForLine({ playFor: { kind: 'reward', reward: 'A drink' } }), 'Playing for a drink');
  assert.equal(playForLine({ playFor: { kind: 'points' } }), 'For bragging rights');
  assert.equal(playForLine({}), null);
});

test('points are the engine numbers one for one, and bet lines read in points', () => {
  assert.equal(points(12), '12 pts');
  assert.equal(points(1), '1 pt');
  assert.equal(points(-3, { sign: true }), '−3 pts');
  assert.equal(points(0, { sign: true }), '0 pts');
  // Whole points on screen: a pot's share split across holes reads +17, halves away from zero
  assert.equal(points(16.92, { sign: true }), '+17 pts');
  assert.equal(points(-12.09, { sign: true }), '−12 pts');
  assert.equal(points(2.5, { sign: true }), '+3 pts');
  assert.equal(points(-2.5, { sign: true }), '−3 pts');
  assert.equal(points(-0.04, { sign: true }), '0 pts');
  assert.equal(points(-0.4, { sign: true }), '0 pts');
  assert.equal(points(0.6), '1 pt');
  assert.equal(unitFmt({})(5, { sign: true }), '+$5');
  assert.equal(unitFmt({ playFor: { kind: 'points' } })(5, { sign: true }), '+5 pts');
  const nassau = { game: 'nassau', settings: { nassau: { front: 5, back: 5, total: 5 } } };
  assert.equal(roundStakeLines(nassau)[0].line, '$5 / $5 / $5');
  assert.equal(roundStakeLines({ ...nassau, playFor: { kind: 'points' } })[0].line, '5 pts / 5 pts / 5 pts');
  // Side games follow the round's choice
  const withSide = { game: 'nassau', settings: nassau.settings, sideGames: [{ game: 'skins', settings: { value: 1, carryover: true } }], playFor: { kind: 'reward', reward: 'Lunch' } };
  assert.deepEqual(roundStakeLines(withSide).map(l => l.line), ['5 pts / 5 pts / 5 pts', '1 pt a skin']);
  assert.equal(inUnits({ playFor: { kind: 'points' } }, '$5 a side'), '5 pts a side');
  assert.equal(inUnits({}, '$5 a side'), '$5 a side');
});

test('setup keypads read in points for a points or reward round, dollars for money', () => {
  assert.deepEqual(padUnit({}), { prefix: '$', suffix: '' });
  const pts = padUnit({ playFor: { kind: 'points' } });
  assert.equal(pts.prefix, '');
  assert.deepEqual([1, 5, 10].map(pts.suffix), [' pt', ' pts', ' pts']);
  assert.equal(padUnit({ playFor: { kind: 'reward', reward: 'Lunch' } }).suffix(2), ' pts');
  // Worked examples and side game lines swap every amount
  assert.equal(inUnits({ playFor: { kind: 'points' } }, 'Win a skin: up $6, $2 from each of the other 3.'), 'Win a skin: up 6 pts, 2 pts from each of the other 3.');
});

// ---------------------------------------------------------------------------
// Reward outcomes

const reward = (owes = 'last', r = 'Lunch') => ({ kind: 'reward', reward: r, owes });
const outcome = (ids, byHole, pf) => {
  const r = round('rw', ids, wins(ids, byHole), { playFor: pf });
  return rewardOutcome(r, roundResults(r));
};

test('reward: a clear winner wins it, last place is buying', () => {
  // Sam wins two skins, Trevor one, Dave none: Sam top, Dave bottom
  const o = outcome(['t', 's', 'd'], { 1: 's', 2: 's', 3: 't' }, reward());
  assert.deepEqual(o.winners, ['s']);
  assert.deepEqual(o.owers, ['d']);
  assert.deepEqual(o.lines, [{ from: 'd', to: ['s'], split: false, with: [] }]);
  assert.equal(o.text, 'Sam wins lunch. Dave’s buying.');
});

test('reward: a tie at the top shares the win', () => {
  const o = outcome(['t', 's', 'd'], { 1: 's', 2: 't' }, reward());
  assert.deepEqual(o.winners.sort(), ['s', 't']);
  assert.deepEqual(o.owers, ['d']);
  assert.match(o.text, /^(Sam and Trevor|Trevor and Sam) share lunch\. Dave’s buying\.$/);
});

test('reward: a tie at the bottom splits it', () => {
  const o = outcome(['t', 's', 'd'], { 1: 's' }, reward());
  assert.deepEqual(o.winners, ['s']);
  assert.deepEqual(o.owers.sort(), ['d', 't']);
  assert.ok(o.lines.every(l => l.split && l.with.length === 1));
  assert.match(o.buy, /split it\.$/);
});

test('reward: "Everyone else" has each other player owe one', () => {
  const o = outcome(['t', 's', 'd', 'a'], { 1: 's', 2: 's', 3: 't' }, reward('everyone', 'A drink'));
  assert.deepEqual(o.winners, ['s']);
  assert.deepEqual(o.owers.sort(), ['a', 'd', 't']);
  assert.ok(o.lines.every(l => !l.split && l.to[0] === 's'));
  assert.match(o.text, /^Sam wins a drink\. .* each buy one\.$/);
});

test('reward: a player who left early never ends up buying', () => {
  // Dave is last but leaves after hole 3, so Trevor (last of the players who finished) buys
  const r = round('lv', ['t', 's', 'd'], wins(['t', 's', 'd'], { 1: 's', 2: 's', 3: 't' }), { playFor: reward() });
  r.left = { d: 3 };
  const o = rewardOutcome(r, roundResults(r));
  assert.deepEqual(o.winners, ['s']);
  assert.deepEqual(o.owers, ['t']);
  assert.equal(o.text, 'Sam wins lunch. Trevor’s buying.');
  // "Everyone else" leaves him out too
  r.playFor = reward('everyone');
  assert.deepEqual(rewardOutcome(r, roundResults(r)).owers, ['t']);
  // Two players and the loser left: nobody's buying, the winner still wins it
  const two = round('lv2', ['t', 's'], wins(['t', 's'], { 1: 's' }), { playFor: reward() });
  two.left = { t: 2 };
  assert.equal(rewardOutcome(two, roundResults(two)).text, 'Sam wins lunch. Nobody’s buying.');
});

test('reward: all square means nobody is buying', () => {
  const o = outcome(['t', 's', 'd'], {}, reward());
  assert.deepEqual([o.winners, o.owers, o.lines], [[], [], []]);
  assert.equal(o.text, 'All square. Nobody’s buying.');
});

test('reward: two players, the loser buys, either way you pick', () => {
  for (const owes of ['last', 'everyone']) {
    const o = outcome(['t', 's'], { 1: 't' }, reward(owes, 'A drink'));
    assert.equal(o.text, 'Trevor wins a drink. Sam’s buying.');
  }
  assert.equal(rewardOutcome(round('m', ['t', 's']), { standings: [] }), null, 'no outcome for a money round');
});

// ---------------------------------------------------------------------------
// Money never leaks

/**
 * Trevor's phone: money rounds (one shared live with Sam, one not, one with Dave), and a points
 * round and a reward round where Sam and Dave win big. Money alone vs money plus the rest.
 */
function mixed() {
  const ids = ['t', 's', 'd'];
  const money = [
    round('m1', ['t', 's'], wins(['t', 's'], { 1: 't', 2: 't' }), { code: 'AAAAAA', daysAgo: 3, skin: 7 }),
    round('m2', ids, wins(ids, { 1: 's', 4: 'd', 5: 't' }), { daysAgo: 2, skin: 3 }),
    round('m3', ['t', 'd'], wins(['t', 'd'], { 2: 'd' }), { code: 'BBBBBB', daysAgo: 1, skin: 4 }),
  ];
  const others = [
    round('p1', ids, wins(ids, { 1: 's', 2: 's', 3: 's' }), { code: 'CCCCCC', daysAgo: 1, skin: 50, playFor: { kind: 'points' } }),
    round('w1', ['t', 's', 'a'], wins(['t', 's', 'a'], { 1: 'a', 2: 'a' }), { code: 'DDDDDD', daysAgo: 0.5, skin: 20, playFor: reward() }),
  ];
  return { moneyOnly: stateOf('t', money), all: stateOf('t', [...money, ...others]) };
}

test('points and reward rounds never change the Tab, shared debts, pair debts or carries', () => {
  const { moneyOnly, all } = mixed();
  assert.deepEqual(tabBalances(all), tabBalances(moneyOnly));
  assert.deepEqual(outstanding(all, { now: NOW }), outstanding(moneyOnly, { now: NOW }));
  assert.deepEqual(sharedDebts(all, { now: NOW }), sharedDebts(moneyOnly, { now: NOW }));
  assert.deepEqual(sharedRounds(all, { now: NOW }).map(r => r.id), ['m1', 'm3']);
  for (const other of ['s', 'd', 'a']) {
    assert.equal(pairDebt(all, 't', other, { now: NOW }), pairDebt(moneyOnly, 't', other, { now: NOW }));
    assert.deepEqual(sharedOwed(all, 't', other, NOW), sharedOwed(moneyOnly, 't', other, NOW));
  }
  assert.deepEqual([...roundsTogether(all)], [...roundsTogether(moneyOnly)]);
  // Balances still sum to zero, and Ann (only ever in the reward round) is nowhere on the Tab
  assert.ok(Math.abs(Object.values(tabBalances(all)).reduce((a, v) => a + v, 0)) < 0.005);
  assert.equal(tabBalances(all).a, undefined);
  // The who's-square strip follows money rounds, and knows a later points round is newer
  assert.deepEqual(stripRound(moneyOnly, { now: NOW }), { round: moneyOnly.rounds.m3, latest: true });
  assert.deepEqual(stripRound(all, { now: NOW }), { round: all.rounds.m3, latest: false });
});

test('head to head keeps the record but counts only money', () => {
  const { moneyOnly, all } = mixed();
  const h = headToHeadSummary(all, new Set(['t']));
  const m = headToHeadSummary(moneyOnly, new Set(['t']));
  for (const id of ['s', 'd']) assert.equal(h.get(id).net, m.get(id).net);
  // The points round counts as a round with Sam (and a loss), just not in dollars
  assert.equal(h.get('s').rounds, m.get('s').rounds + 2);
  assert.equal(h.get('a').net, 0);
  assert.ok(h.get('a').lost >= 1);
  const story = personStory(all, new Set(['t']), 's');
  assert.equal(story.net, personStory(moneyOnly, new Set(['t']), 's').net);
  assert.deepEqual(story.items.filter(i => i.kind === 'round' && i.money === false).map(i => i.id).sort(), ['p1', 'w1']);
});

test('History, Season and seasonStats count only money rounds', () => {
  const { moneyOnly, all } = mixed();
  const range = { kind: 'season', year: 2026 };
  const shown = roundsInRange(all, range);
  assert.equal(shown.length, 5, 'every round is still listed');
  const now = new Date(NOW);
  assert.deepEqual(monthGroups(shown, all, now).map(g => [g.key, g.net, g.played]), monthGroups(roundsInRange(moneyOnly, range), moneyOnly, now).map(g => [g.key, g.net, g.played]));
  assert.deepEqual(netSeries(shown, all), netSeries(roundsInRange(moneyOnly, range), moneyOnly));
  assert.deepEqual(headToHead(shown, all), headToHead(roundsInRange(moneyOnly, range), moneyOnly));
  assert.equal(myMoney(all.rounds.p1, all), null);
  assert.deepEqual(myTab(all), myTab(moneyOnly));
  assert.deepEqual(seasonRounds(all, 2026).map(r => r.id), ['m1', 'm2', 'm3']);
  const a = seasonBoard(all, 2026), b = seasonBoard(moneyOnly, 2026);
  assert.deepEqual([a.balances, a.rival, a.biggestDay, a.bestGame, a.rounds], [b.balances, b.rival, b.biggestDay, b.bestGame, b.rounds]);
  const x = seasonStats(all, 2026), y = seasonStats(moneyOnly, 2026);
  assert.deepEqual([x.rounds, x.total, x.h2h], [y.rounds, y.total, y.h2h]);
});

test('Lately shows points and rewards without a dollar sign', () => {
  const { all } = mixed();
  const items = latelyItems(all, NOW + DAY);
  const p1 = items.find(i => i.id === 'recap:p1');
  assert.ok(p1 && /pts/.test(p1.sub) && !/\$/.test(p1.sub), p1?.sub);
  // The reward round is the newest, so Up next shows it; here it only has to never show money
  for (const i of items.filter(i => /recap:(p1|w1)/.test(i.id))) assert.ok(!/\$/.test(i.text + i.sub));
});

test('a mixed set of money rounds, with and without playFor, returns exactly the old money', () => {
  const plain = round('o1', ['t', 's'], wins(['t', 's'], { 1: 't' }), { skin: 5 });
  const tagged = { ...structuredClone(plain), playFor: { kind: 'money' } };
  assert.deepEqual(roundResults(tagged), roundResults(plain));
  assert.deepEqual(tabBalances(stateOf('t', [tagged])), tabBalances(stateOf('t', [plain])));
});

// ---------------------------------------------------------------------------
// Reward lines on the Tab

test('open rewards: yours only, marked done per phone, never between two other people', () => {
  const ids = ['t', 's', 'd'];
  const r1 = round('w1', ids, wins(ids, { 1: 's', 2: 's', 3: 't' }), { playFor: reward('last') }); // Sam wins, Dave buys
  const r2 = round('w2', ids, wins(ids, { 1: 't', 2: 's' }), { playFor: reward('everyone', 'A drink'), daysAgo: 0.5 }); // Trevor and Sam share, Dave owes both
  const r3 = round('w3', ids, wins(ids, { 1: 't', 2: 't', 3: 's' }), { playFor: reward('last'), daysAgo: 0.2 }); // Trevor wins, Dave buys
  const state = stateOf('t', [r1, r2, r3]);
  const open = openRewards(state, { ids: new Set(['t']) });
  // Dave owes Trevor a drink (w2) and lunch (w3); Dave owes Sam in w1 is not yours
  assert.deepEqual(open.map(l => l.key), [rewardKey('w3', 'd', 't'), rewardKey('w2', 'd', 't')]);
  assert.equal(rewardLineText(open[0], id => NAMES[id]), 'Dave owes you lunch');
  const done = openRewards({ ...state, rewardsDone: { [rewardKey('w3', 'd', 't')]: 1 } }, { ids: new Set(['t']) });
  assert.deepEqual(done.map(l => l.key), [rewardKey('w2', 'd', 't')]);
  // From Dave's side, with a split
  const tie = round('w4', ['t', 's', 'd'], wins(ids, { 1: 's' }), { playFor: reward('last') }); // Sam wins, Trevor and Dave split
  const line = openRewards(stateOf('t', [tie]), { ids: new Set(['t']) })[0];
  assert.equal(rewardLineText(line, id => NAMES[id]), 'You and Dave owe Sam lunch');
  // Owed to you, a split bill is one line (on the first ower's card), and Done clears every share
  const split = round('w6', ids, wins(ids, { 1: 't' }), { playFor: reward('last') }); // Trevor wins, Sam and Dave split
  const owed = openRewards(stateOf('t', [split]), { ids: new Set(['t']) });
  assert.equal(owed.length, 1);
  assert.equal(owed[0].keys.length, 2);
  assert.match(rewardLineText(owed[0], id => NAMES[id]), /^(Sam and Dave|Dave and Sam) owe you lunch$/);
  const marks = Object.fromEntries(owed[0].keys.map(k => [k, 1]));
  assert.deepEqual(openRewards({ ...stateOf('t', [split]), rewardsDone: marks }, { ids: new Set(['t']) }), []);
  // A mark on either share (an older phone marked one) clears the line too
  assert.deepEqual(openRewards({ ...stateOf('t', [split]), rewardsDone: { [owed[0].keys[1]]: 1 } }, { ids: new Set(['t']) }), []);
  // A watched round is not yours
  const watched = round('w5', ['s', 'd'], wins(['s', 'd'], { 1: 's' }), { playFor: reward() });
  assert.deepEqual(openRewards(stateOf('t', [watched]), { ids: new Set(['t']) }), []);
  // And rewards never touch money
  assert.deepEqual(tabBalances(state), {});
});

test('reward done marks ride in the profile doc; an older profile keeps this phone\'s', () => {
  const s = stateOf('t', [], { rewardsDone: { 'w1:d>t': 5 }, usuals: [] });
  const doc = toDocs(s)['profile:me'].data;
  assert.deepEqual(doc.rewardsDone, { 'w1:d>t': 5 });
  const draft = { ...stateOf('t', []), rewardsDone: { 'w9:d>t': 1 } };
  applyDoc(draft, 'profile', 'me', { me: 't', settings: {}, favorites: [] });
  assert.deepEqual(draft.rewardsDone, { 'w9:d>t': 1 });
  applyDoc(draft, 'profile', 'me', { me: 't', settings: {}, favorites: [], rewardsDone: doc.rewardsDone });
  assert.deepEqual(draft.rewardsDone, { 'w1:d>t': 5 });
});

// ---------------------------------------------------------------------------
// Words and images

test('share text and image: points show as points, a reward says who is buying, no dollars', () => {
  const ids = ['t', 's', 'd'];
  const w = round('w1', ids, wins(ids, { 1: 's', 2: 's', 3: 't' }), { playFor: reward() });
  const res = roundResults(w);
  const text = shareText(w, res, { amounts: false });
  assert.ok(/pts/.test(text) && !/\$/.test(text) && !/Settle up/.test(text), text);
  assert.ok(text.includes('Sam wins lunch. Dave’s buying.'));
  const m = shareCardModel(w, res, { showAmounts: false });
  assert.equal(m.reward, 'Sam wins lunch. Dave’s buying.');
  assert.ok(!JSON.stringify(m).includes('$'));
  const p = round('p1', ids, wins(ids, { 1: 's' }), { playFor: { kind: 'points' } });
  assert.ok(!shareText(p, roundResults(p)).includes('$'));
  assert.equal(holeMoneyLine(p, p.holes[0], { s: 4, t: -2, d: -2 }), 'Hole 1: Sam +4 pts');
  // A money round is unchanged
  const money = round('m1', ids, wins(ids, { 1: 's' }));
  assert.ok(shareText(money, roundResults(money)).includes('$'));
  assert.equal(shareCardModel(money, roundResults(money)).reward, null);
});

test('join link previews say what the round is played for', () => {
  const p = round('p1', ['t', 's'], {}, { playFor: reward('last', 'A drink') });
  const { description } = joinPreview({ ...p, status: 'active' });
  assert.ok(description.includes('Playing for a drink') && description.includes('follow the scores') && !description.includes('$'), description);
});

// ---------------------------------------------------------------------------
// Carried along: rematch, usuals and plans

test('rematch and usuals keep playFor; money usuals keep their old key', () => {
  const r = round('w1', ['t', 's'], {}, { playFor: reward('everyone', 'A drink') });
  const state = stateOf('t', [r]);
  assert.deepEqual(rematchSetup(state, r).playFor, { kind: 'reward', reward: 'A drink', owes: 'everyone' });
  assert.equal('playFor' in rematchSetup(state, round('m1', ['t', 's'])), false);
  const u = usualFromRound(state, r, { id: 'u1', now: 1 });
  assert.deepEqual(u.playFor, { kind: 'reward', reward: 'A drink', owes: 'everyone' });
  assert.deepEqual(setupFromUsual(state, u).playFor, u.playFor);
  // Same setup played for money is a different usual
  const moneyU = usualFromRound(state, { ...r, playFor: undefined }, { id: 'u2', now: 1 });
  assert.equal('playFor' in moneyU, false);
  assert.equal(sameAs(u, moneyU), false);
  assert.equal(sameAs(moneyU, { ...moneyU, id: 'old' }), true);
});

test('a plan carries playFor to the round it starts', () => {
  const people = [{ id: 'me', name: 'Trevor' }, { id: 'sam', name: 'Sam' }];
  const plan = newPlan({ id: 'pl', hostWho: 'me', hostName: 'Trevor', game: 'skins', holesCount: 9, date: '2026-10-03', course: flat9, people, ballot: {}, suggestedBet: 2, settings: { hcPct: 100, skins: { value: 2, carryover: true } }, playFor: { kind: 'points' }, now: 1 });
  assert.deepEqual(plan.playFor, { kind: 'points' });
  const s = stateOf('me', [], { players: { me: { id: 'me', name: 'Trevor' } }, settings: { hcPct: 100 } });
  assert.deepEqual(planStart(s, plan, ['me', 'sam'], { course: flat9 }).playFor, { kind: 'points' });
  const moneyPlan = newPlan({ id: 'pl2', hostWho: 'me', hostName: 'Trevor', game: 'skins', holesCount: 9, date: '2026-10-03', course: flat9, people, ballot: {}, suggestedBet: 2, now: 1 });
  assert.equal('playFor' in moneyPlan, false);
  assert.equal(planStart(s, moneyPlan, ['me', 'sam'], { course: flat9 }).playFor, null);
});

test('the friendly-wagers note says what a no-money round is played for', () => {
  assert.equal(noMoneyNote({}), null);
  assert.equal(noMoneyNote({ playFor: { kind: 'points' } }), 'No money on this one, just bragging rights.');
  assert.equal(noMoneyNote({ playFor: { kind: 'reward', reward: 'A drink' } }), 'No money on this one, just a drink.');
});

test('points show whole, the exact values stay underneath, and the parts on screen add up to the total on screen', () => {
  assert.equal(wholePoints(16.92), 17);
  assert.equal(wholePoints(-2.5), -3);
  assert.ok(Object.is(wholePoints(-0.2), 0));
  // Already whole: nothing moves
  assert.deepEqual(wholeParts([5, -3, 12]), [5, -3, 12]);
  // 5.4 and 5.4 make 10.8, shown 11: one of them reads 6
  assert.deepEqual(wholeParts([5.4, 5.4]), [6, 5]);
  // 0.5 and 0.5 make 1: plain rounding would show 1 and 1 under a 1
  assert.deepEqual(wholeParts([0.5, 0.5]), [0, 1]);
  // A third of a pot each way still adds up
  const thirds = wholeParts([16.666, 16.666, -3.332]);
  assert.equal(thirds.reduce((a, v) => a + v, 0), wholePoints(30));
  // The part nudged is the one closest to the other side of a half
  assert.deepEqual(wholeParts([2.4, 1.1, 0.3], 3.8), [3, 1, 0]);
  assert.deepEqual(wholeParts([-2.4, -1.1, -0.3]), [-3, -1, 0]);
  // A by-game table: each player's games add up to their own whole total
  const byGame = { main: { balances: { a: 16.92, b: -16.92 } }, skins: { balances: { a: 0.4, b: -0.4 } } };
  const shown = wholeByGame(byGame, ['a', 'b']);
  assert.equal(shown.main.a + shown.skins.a, wholePoints(17.32));
  assert.equal(shown.main.b + shown.skins.b, wholePoints(-17.32));
  // A hole's change is the difference of the whole totals, so it always agrees with the running total
  assert.equal(wholeDelta(17.3, 0.4), 0);
  assert.equal(wholeDelta(17.6, 0.4), 1);
  assert.equal(wholeDelta(-3, -3), -3);
});

test('whole points are for the screen only: a points round’s results are exactly as before', () => {
  const ids = ['t', 's', 'd'];
  const make = playFor => roundResults(round('r', ids, wins(ids, { 1: 't' }), { skin: 1.25, playFor })).balances;
  const money = make(undefined);
  const pts = make({ kind: 'points' });
  assert.deepEqual(pts, money);
  // One skin at 1.25 from each of two: 2.5 exact underneath, shown +3, and the others −1 each
  assert.equal(pts.t, 2.5);
  assert.equal(pts.s, -1.25);
  assert.equal(points(pts.s, { sign: true }), '−1 pt');
  assert.equal(points(pts.t, { sign: true }), '+3 pts');
});

test('a player’s games line in points adds up to their whole total; in money it’s exactly as before', async () => {
  const { gamesLine } = await import('./side-games.js');
  const { money } = await import('./golf.js');
  const byGame = { main: { label: 'Stroke play', balances: { a: 5.4 } }, skins: { label: 'Skins', balances: { a: 5.4 } } };
  assert.equal(gamesLine(byGame, 'a', points), 'Stroke play +6 pts · Skins +5 pts');
  assert.equal(points(10.8, { sign: true }), '+11 pts');
  assert.equal(gamesLine(byGame, 'a', money), 'Stroke play +$5.40 · Skins +$5.40');
});
