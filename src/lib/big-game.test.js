// The Big Game (big-game.js, big-money.js): several groups, one pot and one leaderboard. The pot and
// its places, field skins across groups with and without carries, team best ball across groups,
// side bets between players in different groups, the settle-up equal to each person's net, every
// phone agreeing on it, paying a line squaring it on both phones, and rounds from before unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { buildHoles, buildMeta } from './sync-model.js';
import { headToHeadSummary, nameOf, outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { payInfoFor } from './pay.js';
import { breakdownWith } from './where-from.js';
import { allocatePayment } from './shared-tab.js';
import { mergeExpenses } from './trip-expenses.js';
import { canMarkLine, newTrip, tripOnDay, tripPayment, tripStamp, tripStatus } from './trips.js';
import {
  BIG_FORMAT, allot, balanceGroups, balanceTeams, betStrokesFor, bigField, bigLines, bigResults, buyIns, cleanBig, groupCount,
  frozenHoles, groupsProblem, moveTo, payPlaces, placeLabels, potBoard, scoreOn, skinsBoard, skinsMoney, startDay,
} from './big-game.js';
import { allBigMoney, bigMoney, bigOf, bigRoundMoney, bigRoundResults, bigStatus } from './big-money.js';
import { gameLabel, holeMoneyLine } from './format.js';
import { agreementItems } from './agreed.js';
import { lastResult, myMoney, myNet } from './history.js';
import { latelyItems } from './lately.js';
import { seasonBoard } from './season.js';
import { closePreview, ALL } from './books.js';
import { shareCardModel } from './shareImage.js';
import { feedMeta, friendRoundView, friendRounds } from './friend-feed.js';
import { callouts } from './callouts.js';
import { changesReach, codesToRead, handOffs, recordDue, toCard } from './big-sync-model.js';
import { bigInvite, bigWho, myBigMoney, myPlaceLine, toParText } from './big-view.js';
import { money } from './golf.js';
import { owedSince, paymentNudges } from './nudges.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const NOW = OCT(17, 20);
const NAMES = { a: 'Ann', b: 'Bob', c: 'Cal', d: 'Dave', e: 'Eve', f: 'Fay', g: 'Gus', h: 'Hal' };
const G1 = ['a', 'b', 'c', 'd'], G2 = ['e', 'f', 'g', 'h'];
const people = (hc = {}) => Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { name, hc: hc[id] ?? 0 }]));

/** The game: two foursomes, $20 net pot paying 50/30/20, $10 skins, $10 team best ball, two side bets. */
function game(over = {}) {
  return cleanBig({
    v: 2, hcPct: 100, useHandicaps: false, people: people(),
    groups: [
      { id: 'g1', name: 'Group 1', players: G1, keeper: 'b', roundId: 'r1', code: 'BIGAAA' },
      { id: 'g2', name: 'Group 2', players: G2, keeper: 'g', roundId: 'r2', code: 'BIGBBB' },
    ],
    pot: { on: true, kind: 'gross', stake: 20, places: [50, 30, 20] },
    skins: { on: true, kind: 'gross', stake: 10, carry: false },
    teams: { on: true, kind: 'gross', stake: 10, best: 1, places: [100], list: [
      { id: 'T1', name: 'Team 1', players: ['a', 'h'] }, { id: 'T2', name: 'Team 2', players: ['b', 'e'] },
      { id: 'T3', name: 'Team 3', players: ['c', 'f'] }, { id: 'T4', name: 'Team 4', players: ['d', 'g'] },
    ] },
    bets: [
      { id: 'x1', kind: 'match', sides: ['g', 'd'], stake: 10 },
      { id: 'x2', kind: 'hole', sides: ['c', 'f'], stake: 5, strokes: { to: 'c', count: 3 } },
    ],
    ...over,
  });
}
const tripOf = big => newTrip({ id: 't_big', name: 'Saturday Big Game', start: '2026-10-17', end: '2026-10-17', by: 'a', format: BIG_FORMAT, big, now: OCT(10) });

// Everyone a 4 on every hole, but: Ann a 3 on 1, Eve a 3 on 2, Bob a 3 on 3 and a 5 on 9, Fay a 3 on 4,
// Cal a 5 on 5, Gus a 2 on 6. Gross: Gus 34, Ann, Eve and Fay 35, Bob, Dave and Hal 36, Cal 37.
const SCORES = { 1: { a: 3 }, 2: { e: 3 }, 3: { b: 3 }, 4: { f: 3 }, 5: { c: 5 }, 6: { g: 2 }, 9: { b: 5 } };

function groupRound(id, ids, code, trip, { scores = SCORES, done = true, holes = 9, hc = {} } = {}) {
  const r = createRound({ id, game: 'stroke', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x], index: 0, courseHcOverride: hc[x] ?? null })), settings: { stroke: { stake: 0, payout: 'pot', cap: false, nassau: false } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes.slice(0, holes)) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, scores[h.no]?.[p] ?? 4]));
  r.createdAt = OCT(17, 8);
  r.status = done ? 'done' : 'active';
  r.finishedAt = done ? OCT(17, 15) : null;
  r.trip = tripStamp(trip);
  r.shareCode = code;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra });
const cardOfRound = r => toCard(buildMeta(r), buildHoles(r), NOW);

/**
 * Ann's phone (the organizer's, every group's round) and a phone for each friend (`z<id>`): their own
 * group's round, in their seat, and the other group's card as it was read from its live round.
 */
function phonesOf(big = game(), opts = {}) {
  const trip = tripOf(big);
  const r1 = groupRound('r1', G1, 'BIGAAA', trip, opts);
  const r2 = groupRound('r2', G2, 'BIGBBB', trip, opts.r2 || opts);
  const friend = (me, own, other) => stateOf(`z${me}`, [{ ...own, localMe: me, shared: { code: own.shareCode, host: false } }],
    { bigCards: other ? { t_big: { [other.shareCode]: cardOfRound(other) } } : {} });
  return {
    a: stateOf('a', [r1, r2], { trips: { t_big: trip } }),
    d: friend('d', r1, r2), e: friend('e', r2, r1), g: friend('g', r2, r1), h: friend('h', r2, r1),
  };
}
const idOn = (s, x) => (x === s.me.slice(1) ? s.me : x);
const cents = v => Math.round(v * 100);
const owes = (s, x, y) => cents(tabWith(outstanding(s, { now: NOW }), new Set([idOn(s, y)]), idOn(s, x)));
const fieldOn = (s, big = bigOf(s, 't_big')) => bigStatus(s, 't_big').field || bigField(big, () => null);

// --------------------------- setup ------------------------------------------------

test('groups balanced by handicap deal best to worst like a snake, and teams pair the best with the worst', () => {
  const list = [3, 18, 7, 12, 1, 25, 9, 15].map((hc, i) => ({ id: `p${i}`, hc }));
  assert.deepEqual(balanceGroups(list, 2), [['p4', 'p6', 'p3', 'p5'], ['p0', 'p2', 'p7', 'p1']]);
  assert.deepEqual(balanceTeams(list, 2), [['p4', 'p5'], ['p0', 'p1'], ['p2', 'p7'], ['p6', 'p3']]);
  // With the groups balanced the same way, every pair would be in one group: partners go across groups
  const groups = balanceGroups(list, 2);
  const across = balanceTeams(list, 2, { groups });
  const gOf = id => groups.findIndex(g => g.includes(id));
  assert.ok(across.every(([a, b]) => gOf(a) !== gOf(b)), JSON.stringify(across));
  assert.deepEqual(across.flat().sort(), list.map(p => p.id).sort());
  assert.deepEqual([4, 5, 8, 9, 10, 12, 13, 16, 20, 24].map(groupCount), [2, 2, 2, 2, 3, 3, 3, 4, 5, 6]);
  assert.deepEqual(moveTo([['a', 'b'], ['c']], 'b', 1), [['a'], ['c', 'b']]);
});

test('a garbled game is tidied: one group a player, bets and teams only between people in it, places adding to 100', () => {
  const big = cleanBig({
    people: { a: { name: 'Ann', hc: 99 }, b: { name: 'Bob' }, c: { name: 'Cal' } },
    groups: [{ id: 'g1', players: ['a', 'b', 'zz'] }, { id: 'g2', players: ['b', 'c'], code: 'nope' }],
    pot: { kind: 'odd', stake: 9999, places: [50, 40] },
    bets: [{ id: 'x', kind: 'match', sides: ['a', 'zz'], stake: 5 }, { id: 'y', kind: 'hole', sides: ['a', 'c'], stake: 0 }, { id: 'z', kind: 'match', sides: ['a', 'c'], stake: 5, strokes: { to: 'c', count: 2 } }],
    teams: { on: true, list: [{ id: 't', players: ['a', 'zz'] }] },
  });
  assert.deepEqual(big.groups.map(g => g.players), [['a', 'b'], ['c']]);
  assert.equal(big.groups[1].code, null);
  assert.equal(big.people.a.hc, 60);
  assert.deepEqual([big.pot.kind, big.pot.stake, big.pot.places], ['net', 500, [100]]);
  assert.deepEqual(big.bets.map(b => b.id), ['z']);
  assert.equal(big.teams.on, false, 'one team is no team game');
  assert.match(groupsProblem(big), /at least 4 players/);
  const four = cleanBig({ people: people(), groups: [{ id: 'g1', players: ['a', 'b', 'c'] }, { id: 'g2', players: ['d'] }] });
  assert.match(groupsProblem(four), /Group 2 needs at least 2 players/);
  assert.match(groupsProblem(cleanBig({ people: people(), groups: [{ id: 'g1', players: ['a', 'b'] }, { id: 'g2', players: ['c', 'd'] }] })), /Eve, Fay, Gus, Hal aren’t in a group yet/);
  assert.equal(groupsProblem(game()), null);
});

test('side bet strokes are the difference of the two playing handicaps, to the higher one', () => {
  const big = cleanBig({ ...game(), useHandicaps: true, hcPct: 90, people: people({ a: 4, h: 14 }) });
  assert.deepEqual(betStrokesFor(big, 'a', 'h'), { to: 'h', count: 9 });
  assert.equal(betStrokesFor(cleanBig({ ...big, useHandicaps: false }), 'a', 'h'), null);
});

// --------------------------- paying out -----------------------------------------------

test('a split to the cent never makes or loses one, and places tie by sharing what they cover', () => {
  const split = allot(1000, [{ id: 'x', w: 1 }, { id: 'y', w: 1 }, { id: 'z', w: 1 }]);
  assert.deepEqual(split, { x: 334, y: 333, z: 333 });
  // 50/30/20 with two tied for second: they share 30 and 20
  const won = payPlaces([{ id: 'p', value: -2 }, { id: 'q', value: -1 }, { id: 'r', value: -1 }, { id: 's', value: 0 }], 10000, [50, 30, 20]);
  assert.deepEqual(won, { p: 5000, q: 2500, r: 2500 });
  // Only two finished for three places: the third place's share goes to them in proportion
  assert.deepEqual(payPlaces([{ id: 'p', value: 1 }, { id: 'q', value: 2 }], 8000, [50, 30, 20]), { p: 5000, q: 3000 });
  assert.deepEqual(placeLabels([{ value: 1 }, { value: 2 }, { value: 2 }, { value: null }]), ['1', 'T2', 'T2', '–']);
});

// --------------------------- the formats, across both groups ------------------------------------

test('the pot: one leaderboard across both groups, places paid 50/30/20 with a three-way tie for second', () => {
  const s = phonesOf().a;
  const st = bigStatus(s, 't_big');
  assert.equal(st.final, true);
  const board = st.results.pot;
  assert.deepEqual(board.slice(0, 4).map(r => [r.id, r.toPar, r.place]), [['g', -2, '1'], ['a', -1, 'T2'], ['e', -1, 'T2'], ['f', -1, 'T2']]);
  const pot = st.results.money.pot;
  assert.equal(pot.pool, 16000);
  // Gus takes half of $160; Ann, Eve and Fay share second and third ($48 over three, the spare cents in board order)
  assert.deepEqual(pot.balances, { a: 667, b: -2000, c: -2000, d: -2000, e: 667, f: 666, g: 6000, h: -2000 });
});

test('the pot: net with handicaps, Stableford, and a card not finished never placing in stroke play', () => {
  const big = game({ useHandicaps: true, people: people({ c: 9 }), pot: { on: true, kind: 'net', stake: 20, places: [100] } });
  const s = phonesOf(big, { hc: { c: 9 } }).a;
  const field = bigStatus(s, 't_big').field;
  // Cal plays off 9 on nine holes (his course handicap in the round): a stroke a hole
  assert.deepEqual(scoreOn(field, 'c', 5), { gross: 5, net: 4, strokes: 1, par: 4 });
  assert.equal(bigStatus(s, 't_big').results.pot[0].id, 'c', 'Cal’s net 28 wins');
  assert.equal(bigStatus(s, 't_big').results.money.pot.balances.c, 14000);

  const sf = phonesOf(game({ pot: { on: true, kind: 'stableford', stake: 20, places: [100] } })).a;
  const top = bigStatus(sf, 't_big').results.pot[0];
  assert.deepEqual([top.id, top.points], ['g', 20], 'eight pars and an eagle');

  // Hal left after 8: no full card, so no place in stroke play, and his buy-in stays in
  const r2 = { ...phonesOf().a.rounds.r2 };
  r2.left = { h: 8 };
  r2.scores = { ...r2.scores, 9: { e: 4, f: 4, g: 4 } };
  const left = { ...phonesOf().a, rounds: { ...phonesOf().a.rounds, r2 } };
  const hal = bigStatus(left, 't_big').results.pot.find(r => r.id === 'h');
  assert.deepEqual([hal.complete, hal.place], [false, '–']);
  assert.equal(bigStatus(left, 't_big').results.money.pot.balances.h, -2000);
});

test('field skins across groups: a skin only for the lowest score in the whole field, split by skins won', () => {
  const st = bigStatus(phonesOf().a, 't_big');
  const won = st.results.skins.filter(h => h.state === 'won').map(h => [h.no, h.winner]);
  assert.deepEqual(won, [[1, 'a'], [2, 'e'], [3, 'b'], [4, 'f'], [6, 'g']]);
  // Five skins in an $80 pot: $16 each
  assert.deepEqual(st.results.money.skins.balances, { a: 600, b: 600, c: -1000, d: -1000, e: 600, f: 600, g: 600, h: -1000 });
});

test('field skins with carries: a tie carries to the next hole, and what’s carried past the last is shared by every skin', () => {
  const big = game({ skins: { on: true, kind: 'gross', stake: 10, carry: true } });
  const st = bigStatus(phonesOf(big).a, 't_big');
  const six = st.results.skins.find(h => h.no === 6);
  assert.deepEqual([six.winner, six.carry], ['g', 2], 'Gus’s eagle on 6 takes the tie on 5 with it');
  const m = st.results.money.skins;
  assert.equal(m.leftover, 3, '7, 8 and 9 all tied');
  assert.deepEqual(m.balances, { a: 423, b: 422, c: -1000, d: -1000, e: 422, f: 422, g: 1311, h: -1000 });
  assert.equal(Object.values(m.balances).reduce((x, c) => x + c, 0), 0);
});

test('field skins with no skin won give everyone their money back', () => {
  const big = game({ skins: { on: true, kind: 'gross', stake: 10, carry: true } });
  const flat = phonesOf(big, { scores: {} }).a;
  const m = skinsMoney(bigOf(flat, 't_big'), fieldOn(flat), skinsBoard(bigOf(flat, 't_big'), fieldOn(flat)));
  assert.ok(Object.values(m.balances).every(c => c === 0));
});

test('team best ball across groups: partners in different foursomes, the best ball a hole, a tie sharing the pot', () => {
  const st = bigStatus(phonesOf().a, 't_big');
  assert.deepEqual(st.results.teams.map(t => [t.id, t.toPar, t.place]), [['T2', -2, 'T1'], ['T4', -2, 'T1'], ['T1', -1, 'T3'], ['T3', -1, 'T3']]);
  assert.deepEqual(st.results.money.teams.balances, { a: -1000, h: -1000, b: 1000, e: 1000, c: -1000, f: -1000, d: 1000, g: 1000 });
});

test('side bets between players in different groups: a match and a per-hole bet with strokes between the two', () => {
  const st = bigStatus(phonesOf().a, 't_big');
  const [match, perHole] = st.results.bets;
  assert.equal(match.line, 'Gus 1 up');
  assert.equal(match.result.amount, 10);
  // Cal's three strokes fall on holes 1 to 3: he wins those, Fay wins 4 and 5
  assert.deepEqual(perHole.result.wins, [3, 2]);
  assert.deepEqual(st.results.money.bets.balances, { g: 1000, d: -1000, c: 500, f: -500 });
});

// --------------------------- one settle-up ---------------------------------------------

test('the settle-up equals each person’s net, in at most one payment fewer than the players, and adds up to $0', () => {
  const st = bigStatus(phonesOf().a, 't_big');
  const bal = st.results.balances;
  assert.deepEqual(bal, { a: 267, b: -400, c: -3500, d: -3000, e: 2267, f: -234, g: 8600, h: -4000 });
  assert.equal(Object.values(bal).reduce((x, c) => x + c, 0), 0);
  const net = {};
  for (const l of st.lines) { net[l.from] = (net[l.from] || 0) - l.cents; net[l.to] = (net[l.to] || 0) + l.cents; }
  assert.deepEqual(net, bal);
  assert.ok(st.lines.length <= 7);
  // What everyone puts in up front
  assert.deepEqual(buyIns(st.big), { a: 4000, b: 4000, c: 4000, d: 4000, e: 4000, f: 4000, g: 4000, h: 4000 });
});

test('every phone in the game agrees on what each pair owes, the organizer’s and a friend’s in each group', () => {
  const phones = phonesOf();
  const lines = bigStatus(phones.a, 't_big').lines;
  for (const l of lines) {
    const seen = Object.values(phones).filter(s => [l.from, l.to].every(x => x === s.me.slice(1) || bigStatus(s, 't_big').field.players.has(x))).map(s => owes(s, l.from, l.to));
    assert.equal(new Set(seen).size, 1, `${l.from} to ${l.to}: ${seen}`);
    assert.equal(seen[0], l.cents);
  }
  // Each friend's whole Tab is their net from the game
  for (const k of ['d', 'e', 'g', 'h']) {
    const s = phones[k];
    const mine = outstanding(s, { now: NOW }).reduce((x, t) => x + (t.to === s.me ? cents(t.amount) : t.from === s.me ? -cents(t.amount) : 0), 0);
    assert.equal(mine, bigStatus(phones.a, 't_big').results.balances[k], `${k}’s Tab`);
    assert.equal(cents(tabBalances(s, { now: NOW })[s.me]), mine);
  }
});

test('paying a line between two groups on the Tab squares it on both phones and the organizer’s', () => {
  const phones = phonesOf();
  const line = bigStatus(phones.a, 't_big').lines.find(l => l.from === 'd' && l.to === 'e');
  assert.ok(line, 'Dave pays Eve, who played in the other group');
  assert.equal(owes(phones.d, 'd', 'e'), line.cents);
  const res = allocatePayment(phones.d, { from: 'zd', to: 'e', amount: line.cents / 100 }, { now: NOW + 1000, makeId: () => 'x' });
  assert.equal(res.expenses.length, 1, 'a payment for trip money, so it reaches the other phones');
  assert.equal(res.settlements.length, 0);
  for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripExpenses: mergeExpenses(phones[k].tripExpenses || {}, res.expenses) };
  for (const k of ['d', 'e', 'a']) assert.equal(owes(phones[k], 'd', 'e'), 0, `square on ${k}’s phone`);
  // Nobody else's line moved
  for (const l of bigStatus(phones.a, 't_big').lines.filter(l => l.from !== 'd' || l.to !== 'e')) assert.equal(owes(phones.a, l.from, l.to), l.cents);
});

test('Where it comes from and the story with someone name the game’s line', () => {
  const s = phonesOf().d;
  const w = breakdownWith(s, new Set(['zd']), 'e');
  assert.equal(w.expenses.length, 1);
  assert.equal(w.expenses[0].expense.what, 'Saturday Big Game');
  assert.equal(cents(w.spent), -2267);
  const story = personStory(s, new Set(['zd']), 'e', { now: NOW });
  assert.equal(cents(story.spent), -2267);
});

test('until every group is in, the game has no money on any Tab and says which group it waits for', () => {
  // Dave's phone hasn't read Group 2's round yet
  const phones = phonesOf();
  const d = { ...phones.d, bigCards: {} };
  const st = bigStatus(d, 't_big');
  assert.equal(st.final, false);
  assert.deepEqual(st.waiting.map(g => g.name), ['Group 2']);
  assert.deepEqual(allBigMoney(d), []);
  assert.deepEqual(outstanding(d, { now: NOW }), []);
  assert.equal(tripStatus(d, 't_big', { now: NOW }).phase, 'on');
  // Group 2 still playing on Ann's phone: no money yet there either, and the board shows how far they are
  const live = phonesOf(game(), { r2: { done: false, holes: 6 } }).a;
  const ls = bigStatus(live, 't_big');
  assert.equal(ls.final, false);
  assert.deepEqual(ls.field.groups.map(g => [g.status, g.thru]), [['done', 9], ['live', 6]]);
  assert.deepEqual(bigMoney(live, 't_big'), []);
  assert.equal(ls.results.skins.find(h => h.no === 7).state, 'open');
  // Once it's in, Settle the game opens
  assert.equal(tripStatus(phones.a, 't_big', { now: NOW }).phase, 'ready');
});

test('the organizer closing the game counts a group still playing as it stands', () => {
  const live = phonesOf(game(), { r2: { done: false, holes: 6 } }).a;
  const ended = { ...live, trips: { t_big: { ...live.trips.t_big, endedAt: OCT(17, 18) } } };
  const st = bigStatus(ended, 't_big');
  assert.equal(st.final, true);
  // Group 2's players have no full card, so only Group 1 places in the stroke play pot
  assert.ok(st.results.pot.filter(r => r.place !== '–').every(r => G1.includes(r.id)));
  assert.equal(Object.values(st.results.balances).reduce((x, c) => x + c, 0), 0);
});

test('a game closed early counts only the holes each group had scored then: a hole scored after never changes the money', () => {
  const live = phonesOf(game(), { r2: { done: false, holes: 6 } }).a;
  const field = bigStatus(live, 't_big').field;
  const frozen = frozenHoles(field);
  assert.deepEqual(frozen, { g2: [1, 2, 3, 4, 5, 6] });
  const closedBig = cleanBig({ ...game(), v: 3, endedAt: OCT(17, 18), frozen });
  assert.deepEqual(closedBig.frozen, frozen, 'it rides in the game');
  const trip = { ...live.trips.t_big, big: closedBig, endedAt: OCT(17, 18) };
  const at = { ...live, trips: { t_big: trip } };
  const before = bigStatus(at, 't_big');
  assert.equal(before.final, true);
  // Group 2 keeps playing after the close: holes 7 to 9, Hal with a 2 on 7
  const r2 = structuredClone(at.rounds.r2);
  for (const no of [7, 8, 9]) r2.scores[no] = Object.fromEntries(G2.map(id => [id, id === 'h' && no === 7 ? 2 : 4]));
  const later = { ...at, rounds: { ...at.rounds, r2 } };
  const after = bigStatus(later, 't_big');
  assert.deepEqual(after.results.balances, before.results.balances);
  assert.deepEqual(after.lines, before.lines);
  // Without the frozen holes (an older copy of the game), the late holes would count
  const loose = { ...later, trips: { t_big: { ...trip, big: cleanBig({ ...closedBig, frozen: undefined }) } } };
  assert.notDeepEqual(bigStatus(loose, 't_big').results.balances, before.results.balances);
});

test('the newest copy of the game counts: the organizer’s record, the server’s, a round’s stamp or a card', () => {
  const phones = phonesOf();
  const newer = game({ v: 5, bets: [] });
  const d = { ...phones.d, bigRemote: { t_big: { tripId: 't_big', v: 5, big: newer } } };
  assert.equal(bigOf(d, 't_big').v, 5);
  assert.equal(bigStatus(d, 't_big').results.bets.length, 0);
  assert.equal(bigOf(phones.d, 't_big').v, 2);
  assert.equal(recordDue({ v: 3, endedAt: null }, { v: 3, endedAt: null }), false);
  assert.equal(recordDue({ v: 4 }, { v: 3 }), true);
  assert.equal(recordDue({ v: 3, endedAt: 5 }, { v: 3, endedAt: null }), true);
});

test('a phone reads the other group’s round, never its own, and the organizer’s phone hands each card to the scorekeeper picked', () => {
  const phones = phonesOf();
  assert.deepEqual(codesToRead({ ...phones.d, bigCards: {} }, 't_big', { now: NOW }), ['BIGBBB']);
  assert.deepEqual(codesToRead(phones.a, 't_big', { now: NOW }), []);
  // A card round-trips through the live round's meta and holes
  const card = phones.d.bigCards.t_big.BIGBBB;
  assert.deepEqual(card.scores, phones.a.rounds.r2.scores);
  assert.equal(card.trip.big.v, 2);

  const trip = tripOf(game());
  const fresh = groupRound('r2', G2, 'BIGBBB', trip, { done: false, holes: 0 });
  fresh.shared = { code: 'BIGBBB', host: true };
  fresh.keeper = { id: null, since: 1, by: null, lastSaveAt: 1 };
  const a = stateOf('a', [fresh], { trips: { t_big: trip } });
  assert.deepEqual(handOffs(a, 't_big', 5), [], 'Gus isn’t on the round yet');
  const on = { ...a, rounds: { r2: { ...fresh, onApp: { g: 4 } } } };
  assert.deepEqual(handOffs(on, 't_big', 5).map(m => [m.roundId, m.patch.keeper.id]), [['r2', 'g']]);
  const scored = { ...on, rounds: { r2: { ...on.rounds.r2, scores: { 1: { e: 4, f: 4, g: 4, h: 4 } } } } };
  assert.deepEqual(handOffs(scored, 't_big', 5), [], 'someone already started scoring');
});

test('rounds from before and other trips are just as they were: no Big Game money, no Big Game in Count it for the trip', () => {
  const phones = phonesOf();
  const plain = groupRound('old', ['a', 'b'], 'OLDAAA', tripOf(game()));
  delete plain.trip;
  plain.game = 'skins';
  plain.settings = { skins: { value: 2, carryover: true } };
  const before = stateOf('a', [plain]);
  const withGame = { ...phones.a, rounds: { ...phones.a.rounds, old: plain } };
  const big = Object.fromEntries(Object.entries(bigStatus(phones.a, 't_big').results.balances).map(([k, c]) => [k, c / 100]));
  const tb = tabBalances(withGame, { now: NOW }), ob = tabBalances(before, { now: NOW });
  for (const k of new Set([...Object.keys(tb), ...Object.keys(ob)])) assert.equal(cents(tb[k] || 0), cents((ob[k] || 0) + (big[k] || 0)), k);
  assert.equal(tripOnDay(withGame, '2026-10-17'), null);
  assert.deepEqual(allBigMoney(before), []);
});

test('a game set up for another day has no rounds yet: nothing on the board, nothing to pay', () => {
  const trip = tripOf(game({ groups: game().groups.map(g => ({ ...g, roundId: null, code: null })) }));
  const s = stateOf('a', [], { trips: { t_big: trip } });
  const st = bigStatus(s, 't_big');
  assert.equal(st.final, false);
  assert.equal(st.waiting.length, 2);
  assert.deepEqual(potBoard(st.big, st.field).every(r => r.value == null), true);
  assert.equal(tripStatus(s, 't_big', { now: OCT(12) }).phase, 'soon');
  assert.deepEqual(bigLines({}), []);
  assert.ok(bigResults(st.big, st.field));
});

test('the invite card and the bar read a group’s round as the game: its name, the group, the field’s strokes', () => {
  const phones = phonesOf(game({ useHandicaps: true, hcPct: 90 }), { hc: { h: 10 } });
  const r2 = phones.a.rounds.r2;
  const inv = bigInvite(buildMeta(r2), money, 'h');
  assert.equal(inv.title, 'Saturday Big Game · Group 2');
  assert.match(inv.bets, /^\$20 gross pot, 50\/30\/20 · \$10 gross skins · \$10 team best ball · 2 side bets$/);
  assert.equal(inv.strokes, 'You play off 9 across the whole field');
  assert.equal(bigInvite({ ...buildMeta(r2), trip: null }, money), null);
  assert.deepEqual([toParText(-2), toParText(0), toParText(3), toParText(null)], ['−2', 'E', '+3', '–']);
  const bs = bigStatus(phones.g, 't_big');
  const { isMe } = bigWho(phones.g, bs.big);
  assert.equal(myPlaceLine(bs, isMe), 'You’re 1st of 8, −2');
  assert.equal(myBigMoney(bs, isMe), 86);
});

test('Settle the game lists the same payments as the Tab, and marking one there squares it on the other phone', () => {
  const phones = phonesOf();
  const lines = bigStatus(phones.a, 't_big').lines;
  const st = tripStatus(phones.a, 't_big', { now: NOW });
  assert.equal(st.phase, 'ready');
  assert.deepEqual(st.plan.map(l => [l.from, l.to, cents(l.amount)]).sort(), lines.map(l => [l.from, l.to, l.cents]).sort());
  // Gus's phone has Gus's lines as his own
  const gs = tripStatus(phones.g, 't_big', { now: NOW });
  const mine = gs.plan.filter(l => l.to === 'zg').map(l => [l.from, cents(l.amount)]).sort();
  assert.deepEqual(mine, lines.filter(l => l.to === 'g').map(l => [l.from, l.cents]).sort());
  // Hal marks his payment to Gus on Settle the game; Gus's phone gets it and is square with Hal
  const res = tripPayment(phones.h, 't_big', 'zh', 'g', { now: NOW + 5 });
  assert.equal(res.expenses.length, 1);
  for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripExpenses: mergeExpenses(phones[k].tripExpenses || {}, res.expenses) };
  assert.equal(owes(phones.g, 'h', 'g'), 0);
  assert.equal(owes(phones.h, 'h', 'g'), 0);
  assert.ok(!tripStatus(phones.g, 't_big', { now: NOW }).plan.some(l => l.from === 'h'));
  // The standings carry each person's money from the game
  assert.equal(st.standings.find(p => p.id === 'g').big, 86);
});

test('a phone in one group knows the other group’s players by name and payment app, from the card it read', () => {
  const trip = tripOf(game());
  const r2 = groupRound('r2', G2, 'BIGBBB', trip);
  r2.players = r2.players.map(p => (p.id === 'e' ? { ...p, payApp: 'venmo', payHandle: 'eve-golf' } : p));
  const d = stateOf('zd', [{ ...groupRound('r1', G1, 'BIGAAA', trip), localMe: 'd', shared: { code: 'BIGAAA', host: false } }], { bigCards: { t_big: { BIGBBB: cardOfRound(r2) } } });
  assert.equal(nameOf(d, 'e'), 'Eve');
  assert.deepEqual(payInfoFor(d, 'e'), { app: 'venmo', handle: 'eve-golf' });
  assert.equal(nameOf(d, 'nobody'), 'Someone');
});

// --------------------------- review fixes ------------------------------------------

test('equal lines between different pairs are different payments: each pair’s phones agree on its id and both payments count', () => {
  // Winner takes all: everyone pays Gus their $10, seven lines of the same amount
  const phones = phonesOf(game({ skins: { on: false }, teams: { on: false }, bets: [], pot: { on: true, kind: 'gross', stake: 10, places: [100] } }));
  const lines = bigStatus(phones.a, 't_big').lines;
  assert.equal(lines.length, 7);
  assert.ok(lines.every(l => l.to === 'g' && l.cents === 1000));
  const hal = tripPayment(phones.h, 't_big', 'zh', 'g', { now: NOW + 5 }).expenses;
  const dave = tripPayment(phones.d, 't_big', 'zd', 'g', { now: NOW + 9 }).expenses;
  assert.equal(hal.length, 1);
  assert.equal(dave.length, 1);
  assert.notEqual(hal[0].id, dave[0].id, 'two people paying Gus the same amount are two payments');
  // Gus marking Hal's payment on his own phone makes the same payment as Hal marking it on his
  assert.equal(tripPayment(phones.g, 't_big', 'h', 'zg', { now: NOW + 7 }).expenses[0].id, hal[0].id);
  for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripExpenses: mergeExpenses(mergeExpenses(phones[k].tripExpenses || {}, hal), dave) };
  for (const k of ['a', 'g']) {
    assert.equal(owes(phones[k], 'h', 'g'), 0, `Hal square with Gus on ${k}’s phone`);
    assert.equal(owes(phones[k], 'd', 'g'), 0, `Dave square with Gus on ${k}’s phone`);
    assert.equal(owes(phones[k], 'e', 'g'), 1000, `Eve still owes Gus on ${k}’s phone`);
  }
  assert.equal(owes(phones.h, 'h', 'g'), 0);
  assert.equal(owes(phones.d, 'd', 'g'), 0);
});

test('a group’s round read while it was still being played is read again days later, until it’s done', () => {
  const phones = phonesOf(game(), { r2: { done: false, holes: 6 } });
  const later = OCT(17 + 5, 12);
  assert.deepEqual(codesToRead(phones.d, 't_big', { now: NOW }), ['BIGBBB']);
  assert.deepEqual(codesToRead(phones.d, 't_big', { now: later }), ['BIGBBB'], 'still being played: read again');
  const done = phonesOf().d;
  assert.deepEqual(codesToRead(done, 't_big', { now: later }), [], 'finished and days on: final');
  assert.deepEqual(codesToRead(phones.d, 't_big', { now: OCT(17 + 20, 12) }), [], 'given up on after two weeks');
  // A game started after the day it was set for becomes today's
  assert.deepEqual(startDay({ start: '2026-10-10', end: '2026-10-10' }, '2026-10-17'), { start: '2026-10-17', end: '2026-10-17' });
  assert.deepEqual(startDay({ start: '2026-10-17', end: '2026-10-17' }, '2026-10-17'), {});
});

test('an organizer who isn’t playing has no money in the game, never “You broke even”', () => {
  const bs = bigStatus(phonesOf().a, 't_big');
  assert.equal(myBigMoney(bs, id => id === 'someone-else'), null);
  assert.equal(myBigMoney(bs, id => id === 'g'), 86);
  // In it and exactly square: $0, not nothing
  assert.equal(myBigMoney({ ...bs, results: { ...bs.results, balances: { ...bs.results.balances, a: 0 } } }, id => id === 'a'), 0);
});

test('a payment nudge for the game’s money dates from the game, never an older round the two came out of square', () => {
  // Gus's phone: Hal owes him $40 from the game, and they played a square round ten days before
  const old = createRound({ id: 'old', game: 'skins', course: flat9, holesCount: 9, players: [{ id: 'zg', name: 'Gus', index: 0 }, { id: 'h', name: 'Hal', index: 0 }], settings: { skins: { value: 2, carryover: false } }, hcPct: 100, useHandicaps: false });
  for (const h of old.holes) old.scores[h.no] = { zg: 4, h: 4 };
  old.status = 'done'; old.createdAt = OCT(7, 8); old.finishedAt = OCT(7, 12);
  const g = phonesOf().g;
  const s = { ...g, rounds: { ...g.rounds, old } };
  const line = outstanding(s, { now: NOW }).find(l => l.from === 'h');
  assert.equal(line.amount, 40);
  assert.equal(owedSince(s, 'h', 'zg', line.rounds), OCT(17, 15), 'from when the last group finished');
  assert.deepEqual(paymentNudges(s, { now: NOW }), [], 'the game was today');
  // A week on, everyone in the game who owes Gus, in another group or not
  const later = paymentNudges(s, { now: OCT(25, 10) });
  assert.deepEqual(later.map(n => [n.id, n.amount, n.since]), [['h', 40, OCT(17, 15)], ['c', 35, OCT(17, 15)], ['d', 7.33, OCT(17, 15)], ['b', 3.67, OCT(17, 15)]]);
});

test('before the game’s record is on the server, the organizer changes bets or closes the game only while their phone keeps every group’s card', () => {
  const a = phonesOf().a;
  const live = (r, keeper) => ({ ...r, status: 'active', finishedAt: null, shared: { code: r.shareCode, host: true }, keeper: { id: keeper, since: OCT(17, 8) } });
  const kept = { ...a, rounds: { r1: live(a.rounds.r1, null), r2: live(a.rounds.r2, null) } };
  assert.equal(changesReach(kept, 't_big', false), true, 'the organizer’s phone keeps both cards');
  const handed = { ...a, rounds: { r1: live(a.rounds.r1, null), r2: live(a.rounds.r2, 'g') } };
  assert.equal(changesReach(handed, 't_big', false), false, 'Gus has Group 2’s card: a change would never reach it');
  assert.equal(changesReach(handed, 't_big', true), true, 'with the record on, every phone reads the newest copy');
  // Not started yet: nobody else has anything
  const draft = { ...a, rounds: {}, trips: { t_big: tripOf(game({ groups: game().groups.map(g => ({ ...g, roundId: null, code: null })) })) } };
  assert.equal(changesReach(draft, 't_big', false), true);
});

test('a group’s round shows the game: its name and group, and each player’s money from the whole game, counted once a phone', () => {
  const a = phonesOf().a;
  const st = bigStatus(a, 't_big');
  assert.equal(gameLabel(a.rounds.r1), 'Saturday Big Game · Group 1');
  // The whole game's money is on one round on Ann's phone, the one she played, so it counts once
  const on1 = bigRoundMoney(a, a.rounds.r1), on2 = bigRoundMoney(a, a.rounds.r2);
  assert.deepEqual(on2, {});
  for (const [id, c] of Object.entries(st.results.balances)) assert.equal(cents(on1[id] || 0), c, id);
  // Each round's own results show its own players' money from the game
  const g2 = bigRoundResults(a, a.rounds.r2, roundResults(a.rounds.r2));
  for (const id of G2) assert.equal(cents(g2.standings.find(p => p.id === id).amount), st.results.balances[id], id);
  // History, Last time out and the results screen read the game's money, never the round's $0
  const annGame = st.results.balances.a / 100;
  assert.notEqual(annGame, 0);
  assert.equal(myNet(a.rounds.r1, a), annGame);
  assert.equal(myMoney(a.rounds.r1, a), annGame);
  assert.equal(lastResult(a).amount, myNet(lastResult(a).round, a));
  const res = bigRoundResults(a, a.rounds.r1, roundResults(a.rounds.r1));
  assert.equal(res.big.final, true);
  assert.deepEqual(res.transfers, [], 'settled once, on the game’s page');
  assert.equal(res.standings.find(p => p.id === 'a').amount, annGame);
  const card = shareCardModel(a.rounds.r1, res);
  assert.notEqual(card.headline, 'All square');
  assert.match(card.meta, /Saturday Big Game · Group 1/);
  // Lately says the game and the amount
  const item = latelyItems(a, NOW, { withLast: true }).find(i => i.id === 'recap:r1');
  assert.match(item.text, /^Saturday Big Game · Group 1 at /);
  assert.doesNotMatch(item.sub, /broke even/);
  // Season and Close the books add up to the game, like the Tab
  const board = seasonBoard(a, 2026);
  for (const id of ['g', 'h', 'c']) assert.equal(cents(board.balances.find(b => b.id === id)?.net || 0), st.results.balances[id], id);
  const prev = closePreview(a, ALL, { now: NOW });
  for (const t of prev.totals) assert.equal(t.cents, st.results.balances[t.id], t.id);
  assert.equal(prev.totals.length, Object.values(st.results.balances).filter(Boolean).length);
  // Players: the game's payments between two people in the same group are a win and a loss, not even
  const h2h = headToHeadSummary(a, new Set(['a']));
  const line = st.lines.find(l => [l.from, l.to].includes('b') && [l.from, l.to].includes('a'));
  if (line) assert.equal(h2h.get('b').won + h2h.get('b').lost, 1);
  // Not decided yet: nothing from the game, and the screens say it's waiting
  const open = { ...a, rounds: { ...a.rounds, r2: { ...a.rounds.r2, status: 'active', finishedAt: null } } };
  assert.equal(bigRoundMoney(open, open.rounds.r1), null);
  assert.equal(bigRoundResults(open, open.rounds.r1, roundResults(open.rounds.r1)).big.final, false);
  assert.equal(shareCardModel(open.rounds.r1, bigRoundResults(open, open.rounds.r1, roundResults(open.rounds.r1))).sub, 'Waiting on the other groups');
});

test('a friend’s phone with only their own group’s round counts the whole game on it', () => {
  const d = phonesOf().d;
  const st = bigStatus(d, 't_big');
  const on = bigRoundMoney(d, d.rounds.r1);
  for (const [id, c] of Object.entries(st.results.balances)) if (c) assert.equal(cents(on[id] || 0), c, id);
  assert.equal(myNet(d.rounds.r1, d), st.results.balances.d / 100);
});

test('the Friends feed never lists another group of your own Big Game, and a group’s round on a friend’s feed has no $0 money', () => {
  const p = phonesOf();
  const row = r => ({ code: r.shareCode, meta: feedMeta(buildMeta(r)), holes: buildHoles(r), people: { e: { friend: true, money: true } }, updated_at: new Date(NOW - 36e5).toISOString() });
  // Dave plays in Group 1: Group 2's round is his own game
  assert.deepEqual(friendRounds(p.d, { rows: [row(p.a.rounds.r2)], status: 'ready', now: NOW }), []);
  // Someone not in the game sees the group's round by the game's name, with no amounts
  const v = friendRoundView(row(p.a.rounds.r2));
  assert.equal(v.title.startsWith('Saturday Big Game · Group 2 at '), true);
  assert.equal(v.line, 'Their card is in');
  assert.ok(v.players.every(x => x.amountText == null));
});

test('the season callout counts your money from the Big Game', () => {
  const a = phonesOf().a;
  // Two more money rounds for Ann so the season line has enough to go on
  const extra = ['x1', 'x2'].map((id, i) => {
    const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: [{ id: 'a', name: 'Ann', index: 0 }, { id: 'b', name: 'Bob', index: 0 }], settings: { skins: { value: 1, carryover: false } }, hcPct: 100, useHandicaps: false });
    for (const h of r.holes) r.scores[h.no] = { a: 4, b: 4 };
    r.status = 'done'; r.createdAt = OCT(10 + i, 8); r.finishedAt = OCT(10 + i, 12);
    return r;
  });
  const s = { ...a, rounds: { ...a.rounds, ...Object.fromEntries(extra.map(r => [r.id, r])) } };
  const net = bigStatus(s, 't_big').results.balances.a / 100;
  const line = callouts(s, NOW).find(c => c.kind === 'net');
  if (Math.abs(net) >= 1) assert.match(line.text, new RegExp(money(Math.abs(net)).replace('$', '\\$')));
});

test('a group’s round says what’s on the line across the game, and a saved hole counts on its board', () => {
  const r = { ...phonesOf().a.rounds.r1, status: 'active' };
  const bets = agreementItems(r).filter(x => x.group === 'bets');
  assert.equal(bets[0].label, 'Saturday Big Game');
  assert.match(bets[0].text, /pot.*across every group$/);
  assert.doesNotMatch(bets.map(b => b.text).join(' '), /\$0/);
  assert.equal(holeMoneyLine(r, r.holes[0], {}), 'Hole 1 saved. It counts on the board for Saturday Big Game');
});

test('the organizer never marks paid a line between two people that includes their group’s own side bet, which only their phones can settle', () => {
  // Eve and Hal have a $20 match of their own in Group 2, each on their own phone in it
  const phones = phonesOf();
  const withBet = devs => ({ ...phones.a.rounds.r2, bets: [{ id: 'pb1', kind: 'match', sides: ['e', 'h'], stake: 20 }], devs });
  const a = { ...phones.a, rounds: { ...phones.a.rounds, r2: withBet({ e: 'dev-e', h: 'dev-h', g: 'dev-g' }) } };
  const st = tripStatus(a, 't_big', { now: NOW });
  const line = st.plan.find(l => l.from === 'h' && l.to === 'e');
  assert.deepEqual([line.amount, line.local, line.expense], [20, 2000, 0], 'the side bet, which Ann’s phone has from the group’s round');
  assert.equal(line.theirs, true);
  assert.equal(canMarkLine(a, line), false);
  // A mark here would be a payment only Ann's phone has: none is made
  assert.deepEqual(tripPayment(a, 't_big', 'h', 'e', { now: NOW + 5 }), { rows: [], settlements: [], expenses: [] });
  // The game's own lines still travel and can be marked, and every amount is as before
  const game_ = st.plan.find(l => l.from === 'd' && l.to === 'e');
  assert.equal(canMarkLine(a, game_), true);
  assert.equal(tripPayment(a, 't_big', 'd', 'e', { now: NOW + 5 }).expenses.length, 1);
  const before = tripStatus(phones.a, 't_big', { now: NOW }).plan.filter(l => l.from !== 'h' || l.to !== 'e');
  assert.deepEqual(st.plan.filter(l => l.from !== 'h' || l.to !== 'e').map(l => { const c = { ...l }; delete c.theirs; return c; }), before);
  // Nobody in it on a phone of their own (the keeper scored for them): it's only on the phones
  // that kept the round, so marking it on Ann's is still the way to square it
  const kept = { ...phones.a, rounds: { ...phones.a.rounds, r2: withBet({ g: 'dev-g' }) } };
  const kl = tripStatus(kept, 't_big', { now: NOW }).plan.find(l => l.from === 'h' && l.to === 'e');
  assert.equal(kl.theirs, undefined);
  assert.equal(canMarkLine(kept, kl), true);
  assert.equal(tripPayment(kept, 't_big', 'h', 'e', { now: NOW + 5 }).settlements.length, 1);
});
