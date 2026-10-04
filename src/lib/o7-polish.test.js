// Overnight 7 polish (2026-10-04): History, Season and Lately count a lunch round's side bets for
// money in their dollar totals, like the Tab does, and only for the players who had one. Money
// rounds and reward rounds without a money bet come out exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { addBet, setBetWinner } from './pair-bets.js';
import { hasCashBet, tabMoneyOf, tabResultsFor } from './play-for.js';
import { tabBalances } from './ledger.js';
import { headToHead, monthGroups, myMoney, netSeries, roundsInRange } from './history.js';
import { seasonBoard, seasonRounds } from './season.js';
import { latelyItems } from './lately.js';
import { seasonStats } from './format.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const LUNCH = { kind: 'reward', reward: 'Lunch', owes: 'last' };
const SEASON = { kind: 'season', year: 2026 };

function round(id, ids, holes = {}, { at, playFor = null } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * 36e5; r.status = 'done'; r.finishedAt = at;
  if (playFor) r.playFor = playFor;
  return r;
}
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const stateOf = (me, rounds) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {} });
const cashBet = (r, id, sides, stake, winner) => setBetWinner(addBet(r, { id, kind: 'custom', sides, stake, playFor: 'money' }), id, 1, winner);

const IDS = ['t', 'a', 'b'];
/** A money round t wins $2 from each (+$4), then lunch where a beats t $10 on a side bet for money (b won the skins, in points). */
function lunchWithBet(me = 't', extra = []) {
  const q1 = round('q1', IDS, wins(IDS, [1, 't']), { at: OCT(10) });
  let q2 = round('q2', IDS, wins(IDS, [1, 'b'], [2, 'b']), { at: OCT(11), playFor: LUNCH });
  q2 = cashBet(q2, 'cb', ['a', 't'], 10, 'a');
  return stateOf(me, [q1, q2, ...extra]);
}

test('tabMoneyOf: a money round’s net, a lunch round’s money bets only for who had one', () => {
  const s = lunchWithBet();
  const { q1, q2 } = s.rounds;
  assert.equal(tabMoneyOf(q1, 't'), 4);
  assert.equal(tabMoneyOf(q2, 't'), -10);
  assert.equal(tabMoneyOf(q2, 'a'), 10);
  // b won the lunch in points but had no money bet: nothing of theirs is money
  assert.equal(hasCashBet(q2, 'b'), false);
  assert.equal(tabMoneyOf(q2, 'b'), null);
  assert.equal(tabResultsFor(q2, 'b'), null);
  // A points round is never money
  assert.equal(tabMoneyOf({ ...q2, playFor: { kind: 'points' } }, 't'), null);
});

test('History counts a lunch round’s side bets for money: month total, chart and head to head match the Tab', () => {
  const s = lunchWithBet();
  const shown = roundsInRange(s, SEASON);
  assert.equal(myMoney(s.rounds.q2, s), -10);
  const series = netSeries(shown, s);
  // Before: one point (+$4), the money round alone
  assert.deepEqual(series.map(p => [p.id, p.amount, p.total]), [['q1', 4, 4], ['q2', -10, -6]]);
  assert.equal(series.at(-1).total, tabBalances(s).t);
  assert.deepEqual(monthGroups(shown, s, new Date(OCT(12))).map(g => [g.key, g.count, g.net, g.played]), [['2026-10', 2, -6, 2]]);
  assert.deepEqual(headToHead(shown, s), { a: -8, b: 2 });
});

test('History for a player without a money bet at lunch is the money round alone', () => {
  const s = lunchWithBet('b');
  const shown = roundsInRange(s, SEASON);
  assert.equal(myMoney(s.rounds.q2, s), null);
  assert.deepEqual(netSeries(shown, s).map(p => p.id), ['q1']);
  assert.deepEqual(monthGroups(shown, s, new Date(OCT(12))).map(g => [g.net, g.played]), [[-2, 1]]);
  assert.deepEqual(headToHead(shown, s), { t: -2 });
});

test('Season counts a lunch round’s side bets for money, a round together only with who you bet', () => {
  const s = lunchWithBet();
  assert.deepEqual(seasonRounds(s, 2026).map(r => r.id), ['q1', 'q2']);
  const b = seasonBoard(s, 2026);
  assert.equal(b.rounds, 2);
  assert.deepEqual(b.balances.map(x => [x.id, x.net]), [['a', 8], ['b', -2], ['t', -6]]);
  // You and a: a win and a loss over two rounds; b only played the money round with you for money
  assert.deepEqual([b.rival.id, b.rival.rounds, b.rival.won, b.rival.lost, b.rival.net], ['a', 2, 1, 1, -8]);
  assert.equal(b.biggestDay.id, 'q1');
  const st = seasonStats(s, 2026);
  assert.deepEqual([st.rounds, st.total, st.h2h], [2, -6, { a: -8, b: 2 }]);
  // b had no money bet: their season is the money round alone
  const sb = lunchWithBet('b');
  assert.deepEqual(seasonRounds(sb, 2026).map(r => r.id), ['q1']);
  assert.equal(seasonStats(sb, 2026).total, -2);
});

test('a lunch round’s money bet between two other players adds nothing to your History or Season', () => {
  const q1 = round('q1', IDS, wins(IDS, [1, 't']), { at: OCT(10) });
  const plain = round('q2', IDS, wins(IDS, [1, 'b']), { at: OCT(11), playFor: LUNCH });
  const withBet = cashBet(structuredClone(plain), 'cb', ['a', 'b'], 7, 'a');
  const a = stateOf('t', [q1, plain]), b = stateOf('t', [q1, withBet]);
  const view = s => {
    const shown = roundsInRange(s, SEASON);
    const board = seasonBoard(s, 2026);
    return JSON.parse(JSON.stringify([netSeries(shown, s), monthGroups(shown, s, new Date(OCT(12))).map(g => [g.key, g.net, g.played]), headToHead(shown, s), board.rounds, board.rival, seasonStats(s, 2026).total]));
  };
  assert.deepEqual(view(b), view(a));
});

test('Lately’s lunch recap shows your side bets for money in dollars, and nothing for a player without one', () => {
  // A later money round is the one Up next shows, so the lunch recap lands in Lately
  const q3 = round('q3', IDS, {}, { at: OCT(12) });
  const s = lunchWithBet('t', [q3]);
  const mine = latelyItems(s, OCT(13)).find(i => i.id === 'recap:q2');
  assert.match(mine.sub, /^T and A split it · /, 'who buys lunch comes first');
  assert.match(mine.sub, /You −\$10 on side bets/);
  const theirs = latelyItems(lunchWithBet('b', [q3]), OCT(13)).find(i => i.id === 'recap:q2');
  assert.ok(!/\$/.test(theirs.sub), theirs.sub);
});

test('a points round’s snake reveal says what the holder pays in points, never dollars', async () => {
  const { revealSteps } = await import('./reveal.js');
  const { roundResults } = await import('./round.js');
  const mk = playFor => {
    const r = createRound({ id: 'sn', game: 'snake', course: flat9, holesCount: 9, players: IDS.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, snake: { stake: 5, growth: 'flat', nines: false } }, hcPct: 100, useHandicaps: false });
    for (const h of r.holes) { r.scores[h.no] = Object.fromEntries(IDS.map(p => [p, 4])); r.marks[h.no] = { snake: [] }; }
    r.marks[3] = { snake: ['a'] };
    r.status = 'done';
    if (playFor) r.playFor = playFor;
    return r;
  };
  const text = r => revealSteps(r, roundResults(r)).steps.map(s => s.text).join(' ');
  assert.match(text(mk(null)), /pays \$5 a player/);
  assert.match(text(mk({ kind: 'points' })), /pays 5 pts a player/);
  assert.ok(!/\$/.test(text(mk({ kind: 'points' }))));
});
