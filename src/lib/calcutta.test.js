// The Calcutta (overnight 14): the auction's money on its own (calcutta.js), and as a side game in a
// round, through roundResults, the by-game table, the pair debts and the transfers the Tab settles.
// Every round plays a flat course of par 4s with handicaps off, so the finishes are easy to see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcuttaEntries, calcuttaMoney, calcuttaSplits, calcuttaPlace, splitsLine, validSale } from './calcutta.js';
import {
  addPlayerToRound, calcuttaTable, createRound, gameView, joinGames, leftRule, roundResults, sideGameChoices, sideGamesOf, wholeRoundOnly,
} from './round.js';
import { calcuttaBetLine, roundStakeLines } from './stakes.js';
import { sideExample } from './side-games.js';
import { TEAM_DEFAULTS } from './settings.js';

// store.js reads Vite's env, so the defaults these rounds need are here
const DEFAULT_SETTINGS = {
  hcPct: 100,
  ...structuredClone(TEAM_DEFAULTS),
  stroke: { stake: 5, payout: 'pot', cap: false, nassau: false, gross: false },
  skins: { value: 2, carryover: false, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 },
  calcutta: { payout: 'top2', buyBack: false },
};

const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const IDS = 'abcdefgh'.split('');
const NAMES = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss', 'Ed Fox', 'Flo Ng', 'Gus Roy', 'Hal Ito'];
const person = id => ({ id, name: NAMES[IDS.indexOf(id)], index: null });

function round(game, ids, { holes = 9, settings = {}, teams = null } = {}) {
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const [k, v] of Object.entries(settings)) s[k] = { ...s[k], ...v };
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players: ids.map(person), settings: s, hcPct: 100, useHandicaps: false, teams });
}
/** Gross scores for every hole: { a: 36 } spread as a total, or a function of (pid, holeNo). */
function play(r, perHole, upto = r.holes.length) {
  r.holes.slice(0, upto).forEach(h => { r.scores[h.no] = Object.fromEntries(r.players.map(p => [p.id, perHole(p.id, h.no)])); });
  return r;
}
function withCalcutta(r, sales, settings = {}) {
  r.sideGames = [{ game: 'calcutta', settings: { ...DEFAULT_SETTINGS.calcutta, ...settings }, auction: { sales } }];
  return r;
}
const sumCents = o => Math.round(Object.values(o).reduce((a, v) => a + v * 100, 0)) || 0;
const cal = r => roundResults(r).detail.byGame.calcutta;

// ---------------------------------------------------------------------------
// The money on its own

test('the split by place: 70/30 from four sold, all to first under four, 60/30/10 from five', () => {
  assert.deepEqual(calcuttaSplits(1), []);
  assert.deepEqual(calcuttaSplits(2), [100]);
  assert.deepEqual(calcuttaSplits(3), [100]);
  assert.deepEqual(calcuttaSplits(4), [70, 30]);
  assert.deepEqual(calcuttaSplits(8), [70, 30]);
  assert.deepEqual(calcuttaSplits(4, 'top3'), [70, 30]);
  assert.deepEqual(calcuttaSplits(5, 'top3'), [60, 30, 10]);
  assert.equal(splitsLine(3), 'All to first');
  assert.equal(splitsLine(6, 'top3'), '60/30/10');
  assert.equal(calcuttaPlace(1), '1st');
  assert.equal(calcuttaPlace(2, true), 'T2');
  assert.equal(calcuttaPlace(13), '13th');
});

test('a sale counts with a whole dollar bid from a buyer in the Calcutta', () => {
  assert.equal(validSale({ buyer: 'a', bid: 20 }, ['a', 'b']), true);
  assert.equal(validSale({ buyer: 'z', bid: 20 }, ['a', 'b']), false);
  assert.equal(validSale({ buyer: 'a', bid: 0 }, ['a']), false);
  assert.equal(validSale({ buyer: 'a', bid: 12.5 }, ['a']), false);
  assert.equal(validSale({ buyer: 'a', bid: 999999 }, ['a']), false);
  assert.equal(validSale(null, ['a']), false);
});

test('four sold: the owner of first takes 70% and the owner of second 30%', () => {
  const entries = calcuttaEntries({ players: IDS.slice(0, 4).map(person) });
  const sales = { a: { buyer: 'b', bid: 40 }, b: { buyer: 'c', bid: 30 }, c: { buyer: 'd', bid: 20 }, d: { buyer: 'a', bid: 10 } };
  const t = calcuttaMoney({ entries, sales, scores: { a: 5, b: 3, c: 1, d: 0 }, buyers: ['a', 'b', 'c', 'd'] });
  assert.equal(t.pot, 100);
  // b paid $40 for Ann (first, $70); c paid $30 for Bo (second, $30); d and a won nothing
  assert.deepEqual(t.deltas, { a: -10, b: 30, c: 0, d: -20 });
  assert.equal(sumCents(t.deltas), 0);
  assert.deepEqual(t.sold.map(s => [s.id, s.place, s.prize]), [['a', 1, 70], ['b', 2, 30], ['c', 3, 0], ['d', 4, 0]]);
});

test('the pot adds to zero for 3 to 8 players, any bids, any finish', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 3; n <= 8; n++) {
    for (let k = 0; k < 200; k++) {
      const ids = IDS.slice(0, n);
      const entries = calcuttaEntries({ players: ids.map(person) });
      const sales = {};
      for (const id of ids) if (rnd() < 0.9) sales[id] = { buyer: ids[Math.floor(rnd() * n)], bid: 1 + Math.floor(rnd() * 97), back: rnd() < 0.4 };
      // Lots of ties: scores from a small range
      const scores = Object.fromEntries(ids.map(id => [id, rnd() < 0.1 ? null : Math.floor(rnd() * 4) - 1]));
      for (const payout of ['top2', 'top3']) for (const buyBack of [false, true]) {
        const t = calcuttaMoney({ entries, sales, scores, buyers: ids, payout, buyBack });
        assert.equal(sumCents(t.deltas), 0, `n ${n} #${k} ${payout} ${buyBack}`);
        if (t.sold.length >= 2) {
          // Every cent paid in is paid out, and every amount is whole cents
          assert.equal(Math.round(t.pot * 100), sumCents(t.paidIn));
          assert.equal(sumCents(t.paidIn), sumCents(t.paidOut));
          for (const v of Object.values(t.deltas)) assert.ok(Math.abs(v * 100 - Math.round(v * 100)) < 1e-6);
        }
      }
    }
  }
});

test('a tie for first splits first and second; a tie for second splits second', () => {
  const entries = calcuttaEntries({ players: IDS.slice(0, 5).map(person) });
  const sales = Object.fromEntries(IDS.slice(0, 5).map(id => [id, { buyer: id, bid: 20 }])); // $100 pot, everyone owns themselves
  const tieFirst = calcuttaMoney({ entries, sales, scores: { a: 4, b: 4, c: 1, d: 0, e: -2 }, buyers: IDS.slice(0, 5) });
  // ($70 + $30) / 2 each for a and b
  assert.deepEqual(tieFirst.deltas, { a: 30, b: 30, c: -20, d: -20, e: -20 });
  assert.deepEqual(tieFirst.sold.slice(0, 2).map(s => [s.place, s.tied]), [[1, true], [1, true]]);
  const tieSecond = calcuttaMoney({ entries, sales, scores: { a: 4, b: 2, c: 2, d: 2, e: -2 }, buyers: IDS.slice(0, 5) });
  // $30 three ways is $10 each
  assert.deepEqual(tieSecond.deltas, { a: 50, b: -10, c: -10, d: -10, e: -20 });
  // A $31 pot for a three-way tie at first: 3100 cents three ways, the spare cent to the first auctioned
  const odd = calcuttaMoney({ entries: entries.slice(0, 3), sales: { a: { buyer: 'a', bid: 11 }, b: { buyer: 'b', bid: 10 }, c: { buyer: 'c', bid: 10 } }, scores: { a: 1, b: 1, c: 1 }, buyers: ['a', 'b', 'c'] });
  assert.deepEqual(odd.sold.map(s => s.prize), [10.34, 10.33, 10.33]);
  assert.equal(sumCents(odd.deltas), 0);
});

test('a player can buy themselves', () => {
  const entries = calcuttaEntries({ players: IDS.slice(0, 4).map(person) });
  const sales = { a: { buyer: 'a', bid: 50 }, b: { buyer: 'a', bid: 10 }, c: { buyer: 'c', bid: 25 }, d: { buyer: 'd', bid: 15 } };
  const t = calcuttaMoney({ entries, sales, scores: { a: 9, b: 0, c: 5, d: 1 }, buyers: ['a', 'b', 'c', 'd'] });
  // Pot $100: a owns first ($70) and paid $60; c owns second ($30) and paid $25; b bought nobody
  assert.deepEqual(t.deltas, { a: 10, b: 0, c: 5, d: -15 });
});

test('buy-back: half the price for half the winnings, only with the house rule on', () => {
  const entries = calcuttaEntries({ players: IDS.slice(0, 4).map(person) });
  const sales = { a: { buyer: 'b', bid: 40, back: true }, b: { buyer: 'b', bid: 20, back: true }, c: { buyer: 'd', bid: 25 }, d: { buyer: 'c', bid: 15 } };
  const scores = { a: 9, b: 0, c: 5, d: 1 };
  const on = calcuttaMoney({ entries, sales, scores, buyers: ['a', 'b', 'c', 'd'], buyBack: true });
  // Pot $100. a bought half of themselves: a pays $20, b pays $20 + $20 (b on themselves, no buy-back)
  assert.deepEqual(on.paidIn, { a: 20, b: 40, c: 15, d: 25 });
  // a finished first: $70, half each to b and a. b (second? no: c is second) c is owned by d: $30
  assert.deepEqual(on.paidOut, { a: 35, b: 35, c: 0, d: 30 });
  assert.deepEqual(on.deltas, { a: 15, b: -5, c: -15, d: 5 });
  assert.equal(on.sold[0].owners.length, 2);
  // House rule off: the back flag means nothing, b owns all of a
  const off = calcuttaMoney({ entries, sales, scores, buyers: ['a', 'b', 'c', 'd'], buyBack: false });
  assert.deepEqual(off.deltas, { a: 0, b: 10, c: -15, d: 5 });
  // An odd prize: the owner keeps the spare cent
  const odd = calcuttaMoney({ entries: entries.slice(0, 2), sales: { a: { buyer: 'b', bid: 1, back: true }, b: { buyer: 'b', bid: 2 } }, scores: { a: 1, b: 0 }, buyers: ['a', 'b'], buyBack: true });
  assert.deepEqual(odd.sold[0].owners.map(o => o.amount), [1.5, 1.5]);
  assert.equal(sumCents(odd.deltas), 0);
});

test('fewer than two sold, or nothing played yet, and nothing moves', () => {
  const entries = calcuttaEntries({ players: IDS.slice(0, 4).map(person) });
  const one = calcuttaMoney({ entries, sales: { a: { buyer: 'b', bid: 40 } }, scores: { a: 1 }, buyers: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(one.deltas, { a: 0, b: 0, c: 0, d: 0 });
  assert.deepEqual(one.unsold, ['b', 'c', 'd']);
  const before = calcuttaMoney({ entries, sales: { a: { buyer: 'b', bid: 40 }, b: { buyer: 'a', bid: 10 } }, scores: { a: 0, b: 0 }, buyers: ['a', 'b', 'c', 'd'], started: false });
  assert.equal(before.pot, 50);
  assert.deepEqual(before.deltas, { a: 0, b: 0, c: 0, d: 0 });
});

test('entries are teams when the round is played in teams', () => {
  const players = IDS.slice(0, 4).map(person);
  assert.deepEqual(calcuttaEntries({ players, teams: [['a', 'b'], ['c', 'd']] }).map(e => [e.id, e.name, e.players]), [['t0', 'Ann & Bo', ['a', 'b']], ['t1', 'Cy & Di', ['c', 'd']]]);
  // One a side is a player each
  assert.deepEqual(calcuttaEntries({ players: players.slice(0, 2), teams: [['a'], ['b']] }).map(e => e.id), ['a', 'b']);
  assert.deepEqual(calcuttaEntries({ players, teams: null }).map(e => e.id), ['a', 'b', 'c', 'd']);
});

// ---------------------------------------------------------------------------
// As a side game in a round

test('a Calcutta next to Stroke play pays on the net totals, and flows into the totals, pairs and transfers', () => {
  // Ann 36, Bo 38, Cy 40, Di 45 over nine
  const r = round('stroke', ['a', 'b', 'c', 'd']);
  const extra = { a: 0, b: 2, c: 4, d: 9 };
  play(r, (pid, no) => 4 + (no <= extra[pid] ? 1 : 0));
  withCalcutta(r, { a: { buyer: 'c', bid: 40 }, b: { buyer: 'd', bid: 30 }, c: { buyer: 'a', bid: 20 }, d: { buyer: 'b', bid: 10 } });
  const res = roundResults(r);
  const c = res.detail.byGame.calcutta;
  assert.equal(c.label, 'Calcutta');
  // c owns Ann (first, $70, paid $40), d owns Bo (second, $30, paid $30), a paid $20, b paid $10
  assert.deepEqual(c.balances, { a: -20, b: -10, c: 30, d: 0 });
  assert.equal(c.detail.calcutta.pot, 100);
  // The main game's pot: Ann takes $20 (4 x $5)
  assert.deepEqual(res.detail.byGame.main.balances, { a: 15, b: -5, c: -5, d: -5 });
  assert.deepEqual(res.balances, { a: -5, b: -15, c: 25, d: -5 });
  assert.equal(sumCents(res.balances), 0);
  // Pairs are each the other's opposite and add up to each player's balance
  for (const a of ['a', 'b', 'c', 'd']) {
    const sum = Object.values(res.pairs[a]).reduce((x, v) => x + v, 0);
    assert.equal(Math.round(sum * 100), Math.round(res.balances[a] * 100), `pairs for ${a}`);
    for (const b of Object.keys(res.pairs[a])) assert.equal(res.pairs[a][b], -res.pairs[b][a] || 0);
  }
  // The transfers square everyone
  const net = Object.fromEntries(['a', 'b', 'c', 'd'].map(id => [id, 0]));
  for (const t of res.transfers) { net[t.from] -= t.amount; net[t.to] += t.amount; }
  for (const id of Object.keys(net)) assert.equal(Math.round(net[id] * 100), Math.round(res.balances[id] * 100));
});

test('the Calcutta pays on money in a money game, and teams go up together in a team game', () => {
  // Best ball 2 v 2, one bet: Ann & Bo win every hole
  const r = round('bestball', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], settings: { bestball: { format: 'total', stake: 10 } } });
  play(r, (pid) => (pid === 'a' ? 3 : 4));
  withCalcutta(r, { t0: { buyer: 'c', bid: 30 }, t1: { buyer: 'a', bid: 50 } });
  const t = calcuttaTable(gameView(r, 'calcutta'));
  assert.deepEqual(t.entries.map(e => e.name), ['Ann & Bo', 'Cy & Di']);
  assert.equal(t.sold[0].id, 't0');
  // Two entries: all to first. c owns Ann & Bo: +$80 less $30; a paid $50
  assert.deepEqual(cal(r).balances, { a: -50, b: 0, c: 50, d: 0 });
  assert.equal(sumCents(roundResults(r).balances), 0);
});

test('team buy-back: the team buys half of itself, split between its players', () => {
  const r = round('bestball', ['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']], settings: { bestball: { format: 'total', stake: 10 } } });
  play(r, (pid) => (pid === 'c' ? 3 : 4));
  withCalcutta(r, { t0: { buyer: 'c', bid: 30 }, t1: { buyer: 'a', bid: 50, back: true } }, { buyBack: true });
  // Cy & Di win the $80 pot. a paid $25, c and d $12.50 each for half of themselves (and c $30 for Ann & Bo)
  assert.deepEqual(cal(r).balances, { a: 15, b: 0, c: -22.5, d: 7.5 });
  assert.equal(sumCents(cal(r).balances), 0);
});

test('a Calcutta with a player added mid-round: they were never auctioned, so they are not in the pot', () => {
  const r = round('skins', ['a', 'b', 'c', 'd'], { settings: { skins: { value: 2, carryover: false, payout: 'per' } } });
  withCalcutta(r, { a: { buyer: 'b', bid: 40 }, b: { buyer: 'a', bid: 30 }, c: { buyer: 'd', bid: 20 }, d: { buyer: 'c', bid: 10 } });
  play(r, () => 4, 3);
  // Ed joins on hole 4; the Calcutta is for the players who started
  const games = joinGames(r, 'Ed', 4);
  assert.equal(games.find(g => g.key === 'calcutta').disabled, true);
  const r2 = addPlayerToRound(r, person('e'), 4, ['main']);
  // Ed wins every skin from there, so he tops the main game, and the Calcutta pays the auctioned four
  r2.holes.slice(3).forEach(h => { r2.scores[h.no] = { a: 4, b: 4, c: 4, d: 5, e: 3 }; });
  const res = roundResults(r2);
  assert.ok(res.detail.byGame.main.balances.e > 0);
  const c = res.detail.byGame.calcutta;
  assert.equal(c.balances.e, 0);
  assert.equal(c.detail.calcutta.pot, 100);
  assert.deepEqual(c.detail.calcutta.entries.map(e => e.id), ['a', 'b', 'c', 'd']);
  assert.equal(sumCents(c.balances), 0);
  assert.equal(sumCents(res.balances), 0);
  // The four auctioned all paid Ed the same, so they tie for first and share the $100: $25 an entry
  assert.deepEqual(c.detail.calcutta.sold.map(s => s.place), [1, 1, 1, 1]);
  assert.deepEqual(c.balances, { a: -5, b: -15, c: 15, d: 5, e: 0 });
});

test('someone who leaves stays in the Calcutta: their bids stand', () => {
  const r = round('skins', ['a', 'b', 'c', 'd']);
  withCalcutta(r, { a: { buyer: 'b', bid: 40 }, b: { buyer: 'a', bid: 30 } });
  assert.match(leftRule(r, 'a'), /Calcutta their bids stand/);
  assert.doesNotMatch(leftRule(r, 'a'), /out of the Calcutta/);
});

test('a Calcutta is a side game next to any main game but one-ball games, and only once', () => {
  assert.ok(sideGameChoices('nassau', []).includes('calcutta'));
  assert.ok(sideGameChoices('stroke', [{ game: 'skins' }]).includes('calcutta'));
  assert.ok(!sideGameChoices('stroke', [{ game: 'calcutta' }]).includes('calcutta'));
  assert.deepEqual(sideGameChoices('scramble'), []);
  assert.deepEqual(sideGamesOf({ game: 'wolf', sideGames: [{ game: 'calcutta', settings: {} }, { game: 'calcutta', settings: {} }] }).map(s => s.game), ['calcutta']);
  assert.equal(wholeRoundOnly('calcutta'), true);
});

test('old rounds and a Calcutta with no bids: nobody’s money moves', () => {
  const r = round('nassau', ['a', 'b']);
  play(r, (pid) => (pid === 'a' ? 3 : 4));
  const before = roundResults(r);
  withCalcutta(r, {});
  const after = roundResults(r);
  assert.deepEqual(after.balances, before.balances);
  assert.deepEqual(after.detail.byGame.calcutta.balances, { a: 0, b: 0 });
});

test('the bet line and the worked example', () => {
  assert.equal(calcuttaBetLine({ payout: 'top2' }), 'Auction at the first tee · 70/30');
  assert.equal(calcuttaBetLine({ payout: 'top3', buyBack: true }), 'Auction at the first tee · 60/30/10 · buy-backs');
  assert.equal(calcuttaBetLine({ payout: 'top2' }, { sales: { a: { buyer: 'a', bid: 40 }, b: { buyer: 'a', bid: 25 }, c: { buyer: 'b', bid: 0 } } }), '$65 pot · All to first');
  const r = withCalcutta(round('stroke', ['a', 'b', 'c', 'd']), { a: { buyer: 'b', bid: 40 }, b: { buyer: 'a', bid: 30 }, c: { buyer: 'a', bid: 20 }, d: { buyer: 'c', bid: 10 } });
  assert.equal(roundStakeLines(r)[1].line, '$100 pot · 70/30');
  assert.match(sideExample('calcutta', { payout: 'top2' }, 4), /70% of the pot, and second 30%/);
  assert.match(sideExample('calcutta', { payout: 'top2' }, 3), /whole pot/);
  assert.match(sideExample('calcutta', { payout: 'top3', buyBack: true }, 6), /60%, 30% and 10%.*buy half/);
});

test('the rule pages: /rules/calcutta, and the names people type find it and Rolling quota', async () => {
  const { ruleKeyOf, playFromSearch } = await import('./rule-links.js');
  assert.equal(ruleKeyOf('calcutta'), 'calcutta');
  assert.equal(ruleKeyOf('Auction'), 'calcutta');
  assert.equal(ruleKeyOf('Rolling quota'), 'quota');
  assert.deepEqual(playFromSearch('?play=calcutta'), { side: 'calcutta' });
});

test('Rolling quota by name: ?play=rolling-quota opens Quota with the rule on', async () => {
  const { playFromSearch } = await import('./rule-links.js');
  assert.deepEqual(playFromSearch('?play=rolling-quota'), { game: 'quota', rules: { quota: { adjust: 'half' } } });
  assert.deepEqual(playFromSearch('?play=quota'), { game: 'quota' });
});
