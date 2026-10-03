// Side bets, Trevor's answers from the Overnight 6 review (2026-10-03):
// 1. A new amount reprices the whole bet, the holes already played too, and the editor and the rules
//    card say so.
// 2. On a reward round each bet is played for money (on the Tab, in dollars) or points (toward the
//    reward). Money is the default for a new one; old reward rounds' bets stay points.
// 3. Either player in a bet changes it from their own phone: an ask the keeper's phone applies.
// 4. Side bets on the invite card and the join confirm screen.
// 5. A scramble's match and per-hole bets between players on different teams, on their teams' scores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, livePreview, roundResults } from './round.js';
import {
  SAME_TEAM_REASON, addBet, betPlayFor, betResult, betsOf, changeBet, cleanBet, isCashBet, kindFits, repriceText, setBetWinner, suggestedStrokes, teamOf,
} from './pair-bets.js';
import { betFmt, onTab, points, rewardOutcome, tabResults } from './play-for.js';
import { money } from './golf.js';
import { personStory, tabBalances, headToHeadSummary } from './ledger.js';
import { breakdownWith, pairBreakdown } from './where-from.js';
import { openByPair } from './pair-debts.js';
import { rolled } from './carry.js';
import { revealSteps } from './reveal.js';
import { agreementItems, lockAgreement, noteChanges } from './agreed.js';
import { inviteBetLines } from './join.js';
import {
  applyBetAsk, askSettled, betAskProblem, buildBetAsk, keepAsks, pendingIds, readBetAsk, refusedAsks, waitingAsks, withAsks,
} from './bet-asks.js';
import { buildMeta, readRequest, waitingRequests } from './sync-model.js';
import { holeAllowed } from './keeper-lock.js';
import { oldRounds } from './overnight5-money.fixtures.js';

const PARS = [4, 4, 3, 4, 5, 3, 4, 4, 3];
const course = { id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: PARS.map((par, i) => ({ par, hdcp: i + 1 })) };
const NAMES = { t: 'Trevor N', p: 'Preston', y: 'Tyler', z: 'Zach' };
const LUNCH = { kind: 'reward', reward: 'Lunch', owes: 'last' };

/** A 9-hole Banker round for four, no handicaps, everyone par unless `special` says. */
function banker({ special = {}, upto = 9, playFor = null } = {}) {
  const ids = ['t', 'p', 'y', 'z'];
  const r = createRound({
    id: 'r', game: 'banker', course, holesCount: 9, players: ids.map(id => ({ id, name: NAMES[id], index: null })),
    settings: { hcPct: 100, banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' } }, hcPct: 100, useHandicaps: false,
  });
  r.holes.slice(0, upto).forEach((h, i) => {
    r.scores[h.no] = { ...Object.fromEntries(ids.map(id => [id, h.par])), ...(special[i + 1] || {}) };
    r.banker[h.no] = { banker: ids[i % 4], bets: Object.fromEntries(ids.filter((_, k) => k !== i % 4).map(id => [id, 5])), doubled: {}, doubleBack: false };
  });
  if (playFor) r.playFor = playFor;
  return r;
}
const bet = (kind, sides, stake, more = {}) => ({ id: `${kind}-${sides.join('')}`, kind, sides, stake, ...more });
const withBets = (r, ...bets) => bets.reduce((x, b) => addBet(x, b), r);
const done = r => ({ ...r, status: 'done', finishedAt: 1000 });
const stateOf = (me, rounds, extra = {}) => ({
  me, players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, ...extra,
});
// Preston wins holes 2, 5 and 6 outright; Zach wins hole 4
const SPECIAL = { 2: { p: 3 }, 4: { z: 3 }, 5: { p: 4 }, 6: { p: 2 } };

// ---------------------------------------------------------------------------
// 1. A new amount reprices the whole bet

test('changing a bet’s amount reprices every hole of it, the ones already played too', () => {
  const r = withBets(banker({ special: SPECIAL, upto: 6 }), bet('hole', ['p', 'y'], 2));
  const before = betsOf(r)[0];
  assert.equal(betResult(r, before).amount, 6); // three holes at $2
  const r2 = changeBet(r, before.id, { ...before, stake: 4 });
  const after = betsOf(r2)[0];
  // $4 on all three holes already won, not only from the next hole on
  assert.equal(betResult(r2, after).amount, 12);
  assert.equal(roundResults(r2).detail.byGame.bets.balances.p, 12);
  assert.equal(repriceText(r, before, after, () => money), 'This changes every hole of the bet, so Preston’s $6 becomes $12.');
  // The match follows the same rule: the whole match is for the new amount
  const m = withBets(banker({ special: SPECIAL, upto: 6 }), bet('match', ['p', 'y'], 5));
  const mb = betsOf(m)[0];
  assert.equal(repriceText(m, mb, cleanBet(m, { ...mb, stake: 10 }), () => money), 'This changes every hole of the bet, so Preston’s $5 becomes $10.');
});

test('the reprice note: square stays square, a new leader, nothing played yet, nothing changed', () => {
  const sq = withBets(banker({ upto: 4 }), bet('match', ['p', 'y'], 5));
  const b = betsOf(sq)[0];
  assert.equal(repriceText(sq, b, cleanBet(sq, { ...b, stake: 10 }), () => money), 'This changes every hole of the bet, the holes already played too.');
  // Strokes to Tyler on holes 2, 5 and 6 halve Preston's three wins and leave the match square
  const r = withBets(banker({ special: SPECIAL, upto: 6 }), bet('hole', ['p', 'y'], 2));
  const h = betsOf(r)[0];
  assert.equal(repriceText(r, h, cleanBet(r, { ...h, strokes: { to: 'y', on: [2, 5, 6] } }), () => money), 'This changes every hole of the bet, so Preston’s $6 becomes all square.');
  // Nothing decided yet: nothing to say
  const fresh = withBets(banker({ upto: 0 }), bet('hole', ['p', 'y'], 2));
  assert.equal(repriceText(fresh, betsOf(fresh)[0], cleanBet(fresh, { ...betsOf(fresh)[0], stake: 5 }), () => money), null);
  assert.equal(repriceText(r, h, cleanBet(r, h), () => money), null);
  // A custom bet is one bet, not holes
  const c = withBets(banker({ upto: 3 }), bet('custom', ['p', 'y'], 5, { label: 'Longest drive', winner: 'y', at: 3 }));
  const cb = betsOf(c)[0];
  assert.equal(repriceText(c, cb, cleanBet(c, { ...cb, stake: 10 }), () => money), 'This changes the whole bet, so Tyler’s $5 becomes $10.');
});

test('What we agreed logs a new amount as repricing the whole bet', () => {
  const r0 = withBets(banker({ upto: 0 }), bet('match', ['p', 'y'], 5));
  let r = { ...r0, agreed: lockAgreement(r0, {}, 't', 1) };
  r = { ...banker({ special: SPECIAL, upto: 6 }), bets: r.bets, agreed: r.agreed };
  r = changeBet(r, 'match-py', { ...r.bets[0], stake: 10 });
  assert.equal(noteChanges(r, 2).changes.at(-1).text, 'Match, Preston v Tyler raised to $10 match, every hole of the bet');
});

// ---------------------------------------------------------------------------
// 2. Money or points on a reward round

/** A lunch round: a $2 a hole bet for money (Preston v Tyler) and a 3-point closest to the pin (Zach v Preston). */
function lunch() {
  const r = withBets(banker({ special: SPECIAL, playFor: LUNCH }),
    bet('hole', ['p', 'y'], 2, { playFor: 'money' }),
    bet('ctp', ['z', 'p'], 3, { playFor: 'points', winners: { 3: 'z' } }));
  return r;
}

test('a new side bet on a reward round is for money unless it says points; money and points rounds keep none', () => {
  const reward = banker({ playFor: LUNCH });
  assert.equal(cleanBet(reward, bet('match', ['p', 'y'], 5)).playFor, 'money');
  assert.equal(cleanBet(reward, bet('match', ['p', 'y'], 5, { playFor: 'points' })).playFor, 'points');
  assert.equal('playFor' in cleanBet(banker(), bet('match', ['p', 'y'], 5, { playFor: 'money' })), false);
  assert.equal('playFor' in cleanBet(banker({ playFor: { kind: 'points' } }), bet('match', ['p', 'y'], 5, { playFor: 'money' })), false);
  // What each one is played for
  assert.equal(betPlayFor(reward, { playFor: 'money' }), 'money');
  assert.equal(betPlayFor(reward, {}), 'points'); // an old reward round's bet
  assert.equal(betPlayFor(banker(), { playFor: 'points' }), 'money');
  assert.equal(betPlayFor(banker({ playFor: { kind: 'points' } }), { playFor: 'money' }), 'points');
});

test('a reward round’s money bets stay out of the points and the reward, and come back on their own in dollars', () => {
  const r = lunch();
  const res = roundResults(r);
  // The totals are the games plus the points bet only
  const pointsOnly = withBets(banker({ special: SPECIAL, playFor: LUNCH }), bet('ctp', ['z', 'p'], 3, { playFor: 'points', winners: { 3: 'z' } }));
  assert.deepEqual(res.balances, roundResults(pointsOnly).balances);
  assert.deepEqual(res.pairs, roundResults(pointsOnly).pairs);
  assert.deepEqual(res.detail.byGame.bets.detail.bets.map(b => b.id), ['ctp-zp']);
  // ...so lunch is decided on them
  assert.deepEqual(rewardOutcome(r, res), rewardOutcome(pointsOnly, roundResults(pointsOnly)));
  // The money bet: Preston won three holes at $2
  assert.deepEqual(res.cash.balances, { t: 0, p: 6, y: -6, z: 0 });
  assert.deepEqual(res.cash.transfers, [{ from: 'y', to: 'p', amount: 6 }]);
  assert.equal(res.cash.pairs.p.y, 6);
  assert.equal(res.cash.pairs.y.p, -6);
  assert.equal(res.cash.label, 'Side bets for money');
  // Each in its own unit
  assert.equal(isCashBet(r, r.bets[0]), true);
  assert.equal(betFmt(r, r.bets[0]), money);
  assert.equal(betFmt(r, r.bets[1]), points);
});

test('the Tab counts a reward round’s money bets and nothing else from it', () => {
  const r = done(lunch());
  assert.equal(onTab(r), true);
  const tab = tabResults(r);
  assert.deepEqual(tab.balances, { t: 0, p: 6, y: -6, z: 0 });
  assert.deepEqual(tab.transfers, [{ from: 'y', to: 'p', amount: 6 }]);
  assert.deepEqual(tab.detail.byGame.bets.detail.bets.map(b => b.id), ['hole-py']);
  const s = stateOf('p', [r]);
  const bal = tabBalances(s);
  assert.equal(bal.p, 6);
  assert.equal(bal.y, -6);
  assert.equal(bal.z || 0, 0);
  // Shared round payments: Tyler owes Preston $6
  assert.deepEqual(openByPair(s, [{ ...r, shareCode: 'AAAAAA' }]), [{ from: 'y', to: 'p', cents: 600 }]);
  // Where it comes from, on the Tab: only the money bet, in dollars
  const w = breakdownWith(s, ['p'], 'y');
  assert.equal(w.net, 6);
  assert.deepEqual(w.totals.map(x => [x.group, x.amount]), [['bet:hole', 6]]);
  assert.deepEqual(pairBreakdown(r, 'p', 'y', tab).items.map(x => [x.label, x.amount]), [['Per hole', 6]]);
  // The person card: the round's points stay its own, the money bet adds to net
  const story = personStory(s, new Set(['p']), 'y');
  assert.equal(story.net, 6);
  assert.equal(story.items[0].money, false);
  assert.equal(story.items[0].cash, 6);
  assert.equal(headToHeadSummary(s, ['p']).get('y').net, 6);
  // Zach only had a points bet with Preston: nothing in dollars between them
  assert.equal(personStory(s, new Set(['p']), 'z').net, 0);
  assert.equal('cash' in personStory(s, new Set(['p']), 'z').items[0], false);
});

test('a carry rolls into a reward round only when the two had a side bet for money in it', () => {
  const r = { ...done(lunch()), finishedAt: 5000 };
  const s = stateOf('p', [r]);
  assert.equal(rolled({ status: 'agreed', from: 'y', to: 'p', amount: 4, answeredAt: 10 }, s), true);
  assert.equal(rolled({ status: 'agreed', from: 'z', to: 'p', amount: 4, answeredAt: 10 }, s), false);
  assert.equal(rolled({ status: 'agreed', from: 'y', to: 'p', amount: 4, answeredAt: 9000 }, s), false);
});

test('a reward round with only points bets puts nothing on the Tab', () => {
  const r = done(withBets(banker({ special: SPECIAL, playFor: LUNCH }), bet('hole', ['p', 'y'], 2, { playFor: 'points' })));
  assert.equal(onTab(r), false);
  assert.equal(roundResults(r).cash, undefined);
  assert.deepEqual(tabResults(r).transfers, []);
  assert.deepEqual(tabBalances(stateOf('p', [r])), {});
});

test('the reveal, the money bar and the rules card keep money and points apart', () => {
  const r = lunch();
  const res = roundResults(r);
  const { steps } = revealSteps(r, res);
  const last = steps.at(-1);
  assert.equal(last.money, true);
  assert.equal(last.label, 'Per hole · Preston v Tyler · For money');
  assert.equal(last.amount, 6);
  assert.ok(steps.filter(x => x.money).length === 1);
  // The money bar: the hole being entered moves the money bets in dollars on their own
  const live = livePreview(r, r.holes[5]);
  assert.equal(live.cash.balances.p, 6);
  assert.equal(live.cash.delta.p, 2);
  assert.equal(live.balances.p, res.balances.p);
  // The rules card: the money bet stays in dollars and says so, the points one reads in points
  const items = agreementItems(r).filter(x => x.id.startsWith('bet:pair:'));
  assert.deepEqual(items.map(x => x.text), ['$2 a hole · For money', '3 pts a par 3']);
});

test('switching a bet between money and points on a reward round is a change the rules card logs', () => {
  const r0 = lunch();
  let r = { ...r0, agreed: lockAgreement(r0, {}, 't', 1) };
  r = changeBet(r, 'hole-py', { ...r.bets[0], playFor: 'points' });
  assert.equal(noteChanges(r, 2).changes.at(-1).text, 'Per hole, Preston v Tyler now 2 pts a hole');
  assert.equal(repriceText(r0, betsOf(r0)[0], betsOf(r)[0], b => betFmt(r0, b)), 'This changes every hole of the bet, so Preston’s $6 becomes 6 pts.');
});

// ---------------------------------------------------------------------------
// Old rounds keep their money

test('old reward rounds’ side bets (no money or points on them) stay points, so nothing moves', () => {
  const plain = withBets(banker({ special: SPECIAL }), bet('hole', ['p', 'y'], 2), bet('ctp', ['z', 'p'], 3, { winners: { 3: 'z' } }));
  // A bet saved before the choice existed has no playFor (made on a money round here, so cleanBet gave it none)
  assert.ok(plain.bets.every(b => !('playFor' in b)));
  const old = { ...plain, playFor: LUNCH };
  const res = roundResults(old);
  assert.equal(res.cash, undefined);
  assert.equal(onTab(done(old)), false);
  // The same numbers a points round gives, every bet in them
  assert.deepEqual(res.balances, roundResults({ ...old, playFor: { kind: 'points' } }).balances);
  assert.deepEqual(res.detail.byGame.bets.detail.bets.map(b => b.id), ['hole-py', 'ctp-zp']);
});

test('money rounds ignore a bet’s money or points, and old money rounds give the same money', () => {
  const r = withBets(banker({ special: SPECIAL }), bet('hole', ['p', 'y'], 2), bet('ctp', ['z', 'p'], 3, { winners: { 3: 'z' } }));
  const tagged = { ...r, bets: [{ ...r.bets[0], playFor: 'points' }, { ...r.bets[1], playFor: 'money' }] };
  const money3 = x => { const m = roundResults(x); return { balances: m.balances, pairs: m.pairs, transfers: m.transfers, bets: m.detail.byGame.bets.balances, cash: m.cash }; };
  assert.deepEqual(money3(tagged), money3(r));
  assert.equal(roundResults(r).cash, undefined);
  for (const { name, round } of oldRounds(120, 2026)) {
    const d = done(round);
    assert.equal(onTab(d), d.playFor == null || d.playFor.kind === 'money', name);
    if (onTab(d)) assert.deepEqual(tabResults(d), roundResults(d), name);
    else assert.deepEqual(tabResults(d).transfers, [], name);
  }
});

// ---------------------------------------------------------------------------
// 3. Either player changes their bet: an ask the keeper's phone applies

test('a bet ask goes out and comes back the same, and seat requests never mistake it for one', () => {
  const data = buildBetAsk({ by: 'p', op: 'add', id: 'b1', bet: bet('match', ['p', 'y'], 5) }, 7);
  assert.deepEqual(readBetAsk(JSON.parse(JSON.stringify(data))), { by: 'p', at: 7, op: 'add', id: 'b1', status: 'waiting', bet: { ...bet('match', ['p', 'y'], 5), id: 'b1' } });
  assert.deepEqual(readBetAsk(buildBetAsk({ by: 'y', op: 'winner', id: 'b1', hole: 3, pid: 'y' }, 8)), { by: 'y', at: 8, op: 'winner', id: 'b1', status: 'waiting', hole: 3, pid: 'y' });
  assert.equal(buildBetAsk({ by: 'p', op: 'poke', id: 'b1' }), null);
  assert.equal(buildBetAsk({ by: 'p', op: 'add', id: 'b1' }), null);
  assert.equal(readBetAsk({ request: { name: 'Sam', at: 1, status: 'waiting' } }), null);
  assert.equal(readBetAsk(null), null);
  // A seat request reader skips it
  assert.equal(readRequest(data), null);
  assert.deepEqual(waitingRequests({ '-5': data, '-6': { request: { name: 'Sam', at: 1, status: 'waiting' } } }).map(x => x.name), ['Sam']);
  // It rides under a negative hole number, which any phone with the link may write past the keeper lock
  const meta = { hostDev: 'H', status: 'active', keeper: { id: 't' }, devs: { t: 'T', p: 'P' }, players: [{ id: 't' }, { id: 'p' }] };
  assert.equal(holeAllowed(meta, -12345, 'P'), true);
  assert.equal(holeAllowed(meta, 3, 'P'), false);
});

test('the keeper’s phone applies an ask only from one of the two players in the bet', () => {
  const r = withBets(banker({ upto: 3 }), bet('ctp', ['p', 'y'], 2));
  const ask = f => readBetAsk(buildBetAsk(f, 1));
  // Adding one you're in
  assert.equal(betAskProblem(r, ask({ by: 'z', op: 'add', id: 'n1', bet: bet('match', ['z', 't'], 5) })), null);
  assert.equal(betAskProblem(r, ask({ by: 'z', op: 'add', id: 'n1', bet: bet('match', ['p', 't'], 5) })), 'You can only add a bet you’re in');
  assert.equal(betAskProblem(r, ask({ by: 'ghost', op: 'add', id: 'n1', bet: bet('match', ['ghost', 't'], 5) })), 'Only players in the round can change a side bet');
  // Changing, removing and tapping: only Preston or Tyler
  assert.equal(betAskProblem(r, ask({ by: 'y', op: 'change', id: 'ctp-py', bet: { ...r.bets[0], stake: 4 } })), null);
  assert.equal(betAskProblem(r, ask({ by: 'z', op: 'change', id: 'ctp-py', bet: { ...r.bets[0], stake: 4 } })), 'Only the two players in a bet can change it');
  assert.equal(betAskProblem(r, ask({ by: 'p', op: 'change', id: 'ctp-py', bet: { ...r.bets[0], sides: ['t', 'z'] } })), 'You can’t hand your bet to two other players');
  assert.equal(betAskProblem(r, ask({ by: 'z', op: 'remove', id: 'ctp-py' })), 'Only the two players in a bet can change it');
  assert.equal(betAskProblem(r, ask({ by: 'p', op: 'winner', id: 'ctp-py', hole: 3, pid: 'p' })), null);
  assert.equal(betAskProblem(r, ask({ by: 'p', op: 'winner', id: 'ctp-py', hole: 3, pid: 'z' })), 'The winner has to be one of the two');
  assert.equal(betAskProblem(r, ask({ by: 'p', op: 'winner', id: 'gone', hole: 3, pid: 'p' })), 'That bet is gone');
  assert.equal(betAskProblem({ ...r, status: 'done' }, ask({ by: 'p', op: 'remove', id: 'ctp-py' })), 'The round is finished');
  // A bet the round can't take: teammates' match in a scramble
  const sc = scramble();
  assert.equal(betAskProblem(sc, ask({ by: 'a', op: 'add', id: 'n2', bet: bet('match', ['a', 'b'], 5) })), 'That bet doesn’t fit this round');
});

test('applying an ask: add, change, remove and a winner, and twice is the same as once', () => {
  const r = withBets(banker({ upto: 3 }), bet('ctp', ['p', 'y'], 2));
  const add = readBetAsk(buildBetAsk({ by: 'z', op: 'add', id: 'n1', bet: bet('match', ['z', 't'], 5) }, 1));
  const r1 = applyBetAsk(r, add);
  assert.deepEqual(r1.bets.map(b => b.id), ['ctp-py', 'n1']);
  assert.equal(applyBetAsk(r1, add), r1);
  const ch = readBetAsk(buildBetAsk({ by: 'y', op: 'change', id: 'ctp-py', bet: { ...r.bets[0], stake: 4 } }, 2));
  const r2 = applyBetAsk(r1, ch);
  assert.equal(r2.bets[0].stake, 4);
  assert.deepEqual(applyBetAsk(r2, ch), r2);
  const win = readBetAsk(buildBetAsk({ by: 'p', op: 'winner', id: 'ctp-py', hole: 3, pid: 'p' }, 3));
  const r3 = applyBetAsk(r2, win);
  assert.deepEqual(r3.bets[0].winners, { 3: 'p' });
  const rm = readBetAsk(buildBetAsk({ by: 'p', op: 'remove', id: 'ctp-py' }, 4));
  const r4 = applyBetAsk(r3, rm);
  assert.deepEqual(r4.bets.map(b => b.id), ['n1']);
  assert.equal(applyBetAsk(r4, rm), r4);
  // ...and the money is exactly what the keeper making the change gives
  const byKeeper = setBetWinner(changeBet(addBet(r, bet('match', ['z', 't'], 5, { id: 'n1' })), 'ctp-py', { ...r.bets[0], stake: 4 }), 'ctp-py', 3, 'p');
  assert.deepEqual(roundResults(r3), roundResults(byKeeper));
});

test('the sender’s phone shows its asks as waiting until the round shows them, then lets them go', () => {
  const r = withBets(banker({ upto: 3 }), bet('ctp', ['p', 'y'], 2));
  const add = readBetAsk(buildBetAsk({ by: 'p', op: 'add', id: 'n1', bet: bet('hole', ['p', 'z'], 1) }, 1));
  const win = readBetAsk(buildBetAsk({ by: 'p', op: 'winner', id: 'ctp-py', hole: 3, pid: 'p' }, 2));
  const mine = { ...r, betAsks: [{ no: -2, ask: win, status: 'waiting' }, { no: -1, ask: add, status: 'waiting' }, { no: -3, ask: add, status: 'no', why: 'x' }] };
  assert.deepEqual(waitingAsks(mine).map(x => x.no), [-1, -2]);
  assert.deepEqual(refusedAsks(mine).map(x => x.no), [-3]);
  assert.deepEqual([...pendingIds(mine)], ['n1', 'ctp-py']);
  const shown = withAsks(mine);
  assert.deepEqual(shown.bets.map(b => b.id), ['ctp-py', 'n1']);
  assert.deepEqual(shown.bets[0].winners, { 3: 'p' });
  // Never in the shared round record
  assert.equal('betAsks' in buildMeta(mine), false);
  // The keeper's phone put in the add: that one is done; the tap is still waiting
  const back = { ...applyBetAsk(r, add), betAsks: mine.betAsks };
  assert.equal(askSettled(back, add), true);
  assert.equal(askSettled(back, win), false);
  assert.deepEqual(keepAsks(back).map(x => x.no), [-2, -3]);
  assert.deepEqual(keepAsks({ ...applyBetAsk(back, win), betAsks: mine.betAsks }).map(x => x.no), [-3]);
});

// ---------------------------------------------------------------------------
// 4. The invite card and the join confirm screen

test('side bets on the invite card, and your own on the join confirm screen', () => {
  const r = withBets(banker({ upto: 0 }), bet('match', ['p', 'y'], 5), bet('ctp', ['z', 'p'], 2, { holes: [4, 9] }), bet('custom', ['t', 'z'], 10, { label: 'Longest drive on 7' }));
  assert.deepEqual(inviteBetLines(r), ['Preston v Tyler, $5 match', 'Zach v Preston, $2 a par 3, from hole 4', 'Trevor v Zach, $10 on Longest drive on 7']);
  assert.deepEqual(inviteBetLines(r, 'p'), ['You v Tyler, $5 match', 'You v Zach, $2 a par 3, from hole 4']);
  assert.deepEqual(inviteBetLines(r, 'y'), ['You v Preston, $5 match']);
  assert.deepEqual(inviteBetLines(banker()), []);
  // A points round reads in points; a reward round says which bets are for money
  assert.deepEqual(inviteBetLines({ ...r, playFor: { kind: 'points' } }, 'y'), ['You v Preston, 5 pts match']);
  assert.deepEqual(inviteBetLines(lunch()), ['Preston v Tyler, $2 a hole, for money', 'Zach v Preston, 3 pts a par 3']);
});

// ---------------------------------------------------------------------------
// 5. Scramble: a match or per-hole bet between players on different teams

function scramble() {
  const r = createRound({
    id: 's', game: 'scramble', course, holesCount: 9, players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase(), index: null })),
    teams: [['a', 'b'], ['c', 'd']], settings: { hcPct: 100, scramble: { stake: 5, payout: 'pot', drives: 0 } }, hcPct: 100, useHandicaps: false,
  });
  // Team 2 birdies holes 2 and 4, team 1 birdies hole 6
  r.holes.forEach((h, i) => { r.scores[h.no] = { t0: h.par - (i === 5 ? 1 : 0), t1: h.par - (i === 1 || i === 3 ? 1 : 0) }; });
  return r;
}

test('a scramble match or per-hole bet between players on different teams is played on their teams’ scores', () => {
  const r = withBets(scramble(), bet('match', ['a', 'c'], 10), bet('hole', ['b', 'd'], 2), bet('match', ['a', 'b'], 10), bet('ctp', ['a', 'b'], 1, { winners: { 3: 'a' } }));
  // Teammates' match is left out; their closest to the pin stays
  assert.deepEqual(betsOf(r).map(b => b.id), ['match-ac', 'hole-bd', 'ctp-ab']);
  const res = roundResults(r).detail.byGame.bets.detail.bets;
  assert.equal(res[0].amount, -10); // C's team won two holes to one
  assert.equal(res[1].amount, -2);
  assert.equal(res[2].amount, 1);
  // Strokes in the bet go on the team score for the player who gets them: two for A on holes 2 and 4 square it
  const s = withBets(scramble(), bet('match', ['a', 'c'], 10, { strokes: { to: 'a', on: [2, 4] } }));
  assert.equal(betResult(s, betsOf(s)[0]).amount, 10);
  assert.equal(suggestedStrokes(r, 'a', 'c'), null);
});

test('which pairs a scramble bet fits: the round’s teams, or setup’s lists of players', () => {
  const r = scramble();
  assert.equal(teamOf(r, 'a'), 't0');
  assert.equal(teamOf(r, 'd'), 't1');
  assert.equal(kindFits(r, 'match', ['a', 'c']), true);
  assert.equal(kindFits(r, 'hole', ['a', 'b']), false);
  assert.equal(kindFits(r, 'ctp', ['a', 'b']), true);
  assert.equal(kindFits(r, 'custom', ['c', 'd']), true);
  const setup = { game: 'scramble', teams: [['a', 'b'], ['c', 'd']] };
  assert.equal(kindFits(setup, 'match', ['b', 'd']), true);
  assert.equal(kindFits(setup, 'match', ['c', 'd']), false);
  // No teams yet: the editor can't tell, so it waits
  assert.equal(kindFits({ game: 'scramble' }, 'match', ['a', 'b']), false);
  assert.equal(kindFits(banker(), 'match', ['p', 'y']), true);
  assert.match(SAME_TEAM_REASON, /^Teammates share one score/);
});
