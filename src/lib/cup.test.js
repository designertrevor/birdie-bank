// Team points, Ryder Cup style (cup.js, trips.js): picking the teams, each round's matches, match
// results hole by hole, the team score across the trip (other groups' rounds from the server
// too), the leaderboard, and the stake on the team result, which folds into each person's trip
// total and, once decided, the Tab (cup-stake.test.js has the stake as trip money), never the
// rounds' own money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import {
  balanceTeams, cleanCup, cleanEntry, cupEntries, cupEntry, cupLeaderboard, cupPoints, cupScore, defaultRoundCup, matchResult,
  moveTo, pairMatches, pickingTeam, roundCupResults, stakeBalances, stakeLines, stakeMarks, stakeOpen, teamOf, cleanStake, cupPosts, cupHeadline,
  closeEntry, cupCounts, cleanRoundCup,
} from './cup.js';
import { CUP_COLUMN, TRIP_FORMATS, newTrip, tripByGame, tripStamp, tripStatus, tripsOf, myTripNet } from './trips.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;
const NAMES = { t: 'Trevor', s: 'Sam', m: 'Mike', d: 'Dave', a: 'Al', b: 'Bo', c: 'Cy', e: 'Ed' };

const CUP = { names: ['Blue', 'Red'], teams: [[{ id: 't', name: 'Trevor' }, { id: 's', name: 'Sam' }], [{ id: 'm', name: 'Mike' }, { id: 'd', name: 'Dave' }]], stake: 20 };
const TRIP = newTrip({ id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', by: 't', format: 'cup', cup: CUP, now: OCT(1) });
const MONEY_TRIP = newTrip({ id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });

/**
 * A 9-hole round (skins at $2 a skin, no handicaps) with scores by hole: `holes[no]` is { pid: gross },
 * everyone else 4. `cup` sets its matches; `status` 'active' leaves holes after `upto` unscored.
 */
function round(id, ids, holes = {}, { at = OCT(16), trip = TRIP, cup = null, status = 'done', upto = 9, code = null, skin = 2 } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x] || x, index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) if (h.no <= upto) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.createdAt = at - 4 * HOUR;
  r.status = status;
  if (status === 'done') r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (cup) r.cup = cup;
  if (code) r.shareCode = code;
  return r;
}
/** `pid` makes a 3 on each hole given (everyone else a 4). */
const birdies = (pid, ...nos) => Object.fromEntries(nos.map(no => [no, { [pid]: 3 }]));
const merge = (...maps) => {
  const out = {};
  for (const m of maps) for (const [no, v] of Object.entries(m)) out[no] = { ...(out[no] || {}), ...v };
  return out;
};
const stateOf = (me, rounds, extra = {}) => ({
  me, players: Object.fromEntries(['t', 's', 'm', 'd'].map(id => [id, { id, name: NAMES[id], index: null }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: { t_cup: TRIP }, ...extra,
});
const FOURBALL = { kind: 'fourball', sides: [['t', 's'], ['m', 'd']] };
const SINGLES = { kind: 'singles', sides: [['t', 's'], ['m', 'd']] };

// ---------------------------------------------------------------------------
// The format and the teams

test('the cup sits beside the money format, which stays exactly as it was', () => {
  assert.equal(TRIP_FORMATS.money.name, 'Money across every round');
  assert.ok(TRIP_FORMATS.cup.name.includes('Ryder Cup'));
  assert.equal(MONEY_TRIP.format, 'money');
  assert.equal(MONEY_TRIP.cup, undefined, 'a money trip carries no cup');
  assert.deepEqual(tripStamp(MONEY_TRIP), { id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', format: 'money' });
  const stamp = tripStamp(TRIP);
  assert.equal(stamp.format, 'cup');
  assert.deepEqual(stamp.cup.names, ['Blue', 'Red']);
  assert.equal(stamp.cup.teams[1][0].name, 'Mike');
  // A friend's phone knows the teams from a round's stamp alone
  const friend = { me: 'x', players: {}, rounds: { r1: round('r1', ['t', 's', 'm', 'd']) }, trips: {}, plans: {} };
  assert.equal(tripsOf(friend).get('t_cup').cup.stake, 20);
});

test('a cup is tidied: names, nobody on both teams, captains on their own team, a whole-dollar stake', () => {
  const c = cleanCup({ names: ['  The   Boys ', ''], teams: [[{ id: 'a', name: 'Al' }, { id: 'b' }], [{ id: 'a', name: 'Al' }, { id: 'c', name: 'Cy' }, 'junk']], captains: ['a', 'a'], stake: '12.6', pick: 'nope' });
  assert.deepEqual(c.names, ['The Boys', 'Red']);
  assert.deepEqual(c.teams.map(t => t.map(p => p.id)), [['a', 'b'], ['c']]);
  assert.equal(c.teams[0][1].name, 'Player');
  assert.deepEqual(c.captains, ['a', null]);
  assert.equal(c.stake, 13);
  assert.equal(c.pick, 'hand');
  assert.equal(cleanStake(-5), 0);
  assert.equal(cleanStake(9999), 500);
});

test('balancing by handicap snakes the picks so neither team gets every low handicap', () => {
  const people = [
    { id: 'a', name: 'A', index: 2 }, { id: 'b', name: 'B', index: 8 }, { id: 'c', name: 'C', index: 14 }, { id: 'd', name: 'D', index: 20 },
    { id: 'e', name: 'E', index: null }, { id: 'f', name: 'F', index: 5 },
  ];
  const teams = balanceTeams(people);
  // Sorted 2, 5, 8, 14, 20, none: A to Blue, F and B to Red, C and D to Blue, E to Red
  assert.deepEqual(teams.map(t => t.map(p => p.id)), [['a', 'c', 'd'], ['f', 'b', 'e']]);
});

test('a captains’ draft picks in turn, and anyone can be moved across', () => {
  let teams = [[{ id: 'a', name: 'A' }], [{ id: 'b', name: 'B' }]];
  assert.equal(pickingTeam(teams), 0);
  teams = moveTo(teams, { id: 'c', name: 'C' }, 0);
  assert.equal(pickingTeam(teams), 1);
  teams = moveTo(teams, { id: 'c', name: 'C' }, 1);
  assert.deepEqual(teams.map(t => t.map(p => p.id)), [['a'], ['b', 'c']]);
  assert.deepEqual(moveTo(teams, { id: 'c', name: 'C' }, null).map(t => t.length), [1, 1]);
});

test('a player’s team: the same person, or the same name on a phone that has other ids', () => {
  const s = stateOf('t', []);
  const cup = cleanCup(CUP);
  assert.equal(teamOf(s, cup, { id: 'm', name: 'Mike' }), 1);
  assert.equal(teamOf(s, cup, { id: 'zz', name: ' sam ' }), 0, 'another phone’s id for Sam, by name');
  assert.equal(teamOf(s, cup, { id: 'zz', name: 'Nobody' }), null);
});

test('a round’s matches start from the teams, with anyone not picked on the shorter side', () => {
  const s = stateOf('t', []);
  const four = defaultRoundCup(s, TRIP, [{ id: 'm', name: 'Mike' }, { id: 't', name: 'Trevor' }, { id: 'd', name: 'Dave' }, { id: 's', name: 'Sam' }]);
  assert.deepEqual(four, { kind: 'fourball', sides: [['t', 's'], ['m', 'd']] });
  const three = defaultRoundCup(s, TRIP, [{ id: 't', name: 'Trevor' }, { id: 's', name: 'Sam' }, { id: 'x', name: 'Guest' }]);
  assert.deepEqual(three, { kind: 'singles', sides: [['t', 's'], ['x']] });
  assert.equal(defaultRoundCup(s, MONEY_TRIP, [{ id: 't', name: 'Trevor' }]), null, 'a money trip has no matches');
  assert.equal(defaultRoundCup(s, TRIP, [{ id: 't', name: 'T' }, { id: 's', name: 'S' }, { id: 'm', name: 'M' }, { id: 'd', name: 'D' }], 'singles').kind, 'singles');
});

test('partners and opponents rotate from round to round', () => {
  const s = stateOf('t', []);
  const four = [{ id: 't', name: 'Trevor' }, { id: 's', name: 'Sam' }, { id: 'm', name: 'Mike' }, { id: 'd', name: 'Dave' }];
  // Singles: the second round swaps opponents
  const r1 = pairMatches(defaultRoundCup(s, TRIP, four, 'singles')).matches.map(m => m.sides.flat().join('v'));
  const r2 = pairMatches(defaultRoundCup(s, TRIP, four, 'singles', { rotate: 1 })).matches.map(m => m.sides.flat().join('v'));
  assert.deepEqual(r1, ['tvm', 'svd']);
  assert.deepEqual(r2, ['tvd', 'svm']);
  // Four-ball with four a side: partners change
  const cup8 = { ...CUP, teams: [[{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], [{ id: 'e', name: 'E' }, { id: 'f', name: 'F' }, { id: 'g', name: 'G' }, { id: 'h', name: 'H' }]] };
  const trip8 = newTrip({ id: 't8', name: 'Eight', start: '2026-10-16', end: '2026-10-18', by: 'a', format: 'cup', cup: cup8, now: OCT(1) });
  const eight = 'abcdefgh'.split('').map(id => ({ id, name: id.toUpperCase() }));
  const pairs = n => pairMatches(defaultRoundCup({ me: 'a', players: {}, rounds: {} }, trip8, eight, 'fourball', { rotate: n })).matches.map(m => m.sides[0].join(''));
  assert.deepEqual(pairs(0), ['ab', 'cd']);
  assert.deepEqual(pairs(1), ['bc', 'da']);
});

test('matches pair off in order: four-ball while both sides have two, then singles; the rest sit out', () => {
  const { matches, out } = pairMatches({ kind: 'fourball', sides: [['a', 'b', 'c'], ['d', 'e', 'f']] });
  assert.deepEqual(matches, [{ kind: 'fourball', sides: [['a', 'b'], ['d', 'e']] }, { kind: 'singles', sides: [['c'], ['f']] }]);
  assert.deepEqual(out, []);
  const two = pairMatches({ kind: 'singles', sides: [['a', 'b'], ['c']] });
  assert.deepEqual(two.matches, [{ kind: 'singles', sides: [['a'], ['c']] }]);
  assert.deepEqual(two.out, ['b']);
});

// ---------------------------------------------------------------------------
// Match results

test('singles: closed out early reads 3&2 and stops there; a later hole can’t change it', () => {
  // Trevor wins 1 to 5, then Mike wins 6 to 9: 5 up with 4 to play is closed after hole 5
  const r = round('r1', ['t', 'm'], merge(birdies('t', 1, 2, 3, 4, 5), birdies('m', 6, 7, 8, 9)), { cup: { kind: 'singles', sides: [['t'], ['m']] } });
  const res = roundCupResults(r).matches[0].result;
  assert.equal(res.closed, true);
  assert.equal(res.label, '5&4');
  assert.equal(res.winner, 0);
  assert.deepEqual(res.points, [1, 0]);
  assert.equal(res.thru, 5);
});

test('four-ball is best ball of each side, and a halved match is half a point each', () => {
  // Hole 1: Sam's 3 beats the Reds' best 4; hole 2: Dave's 3 beats Blue's 4. All square after 9
  const r = round('r1', ['t', 's', 'm', 'd'], merge(birdies('s', 1), birdies('d', 2)), { cup: FOURBALL });
  const [m] = roundCupResults(r).matches;
  assert.equal(m.kind, 'fourball');
  assert.equal(m.result.label, 'Halved');
  assert.deepEqual(m.result.points, [0.5, 0.5]);
  // Both partners make a 3 on hole 3: still one hole
  const r2 = round('r2', ['t', 's', 'm', 'd'], merge(birdies('t', 3), birdies('s', 3)), { cup: FOURBALL });
  const m2 = roundCupResults(r2).matches[0].result;
  assert.equal(m2.label, '1 up');
  assert.equal(m2.winner, 0);
});

test('singles in a foursome: two matches from one round', () => {
  // Trevor beats Mike 1 up; Dave wins 7 and 8 to close out Sam 2&1
  const r = round('r1', ['t', 's', 'm', 'd'], merge(birdies('t', 4), birdies('d', 7, 8)), { cup: SINGLES });
  const res = roundCupResults(r).matches.map(m => [m.sides, m.result.label, m.result.winner]);
  assert.deepEqual(res, [[[['t'], ['m']], '1 up', 0], [[['s'], ['d']], '2&1', 1]]);
});

test('a live match shows where it stands and isn’t counted until the round is done', () => {
  const r = round('r1', ['t', 'm'], birdies('t', 1, 2), { cup: { kind: 'singles', sides: [['t'], ['m']] }, status: 'active', upto: 4 });
  const res = roundCupResults(r).matches[0].result;
  assert.equal(res.done, false);
  assert.equal(res.points, null);
  assert.equal(res.thru, 4);
  assert.equal(res.label, '2 up');
  assert.equal(res.left, 5);
});

test('a round ended early: whoever led on the holes played wins; nothing played counts for nothing', () => {
  const early = round('r1', ['t', 'm'], birdies('m', 2), { cup: { kind: 'singles', sides: [['t'], ['m']] }, upto: 6 });
  const res = matchResult(early, { sides: [['t'], ['m']] });
  assert.equal(res.winner, 1);
  assert.equal(res.label, '1 up');
  const none = round('r2', ['t', 'm'], {}, { cup: { kind: 'singles', sides: [['t'], ['m']] }, upto: 0 });
  const n = matchResult(none, { sides: [['t'], ['m']] });
  assert.equal(n.void, true);
  assert.equal(n.points, null);
  assert.deepEqual(cupScore([cupEntry(stateOf('t', [none]), none)]).points, [0, 0]);
});

test('a player who leaves is carried by their partner in four-ball', () => {
  const r = round('r1', ['t', 's', 'm', 'd'], birdies('s', 8), { cup: FOURBALL });
  r.left = { t: 3 }; // Trevor stopped after hole 3
  for (const no of [4, 5, 6, 7, 8, 9]) delete r.scores[no].t;
  const m = roundCupResults(r).matches[0].result;
  assert.equal(m.winner, 0, 'Sam’s birdie on 8 still wins it for Blue');
  assert.equal(m.thru, 9);
});

test('the matches never change a round’s own money', () => {
  const plain = round('r1', ['t', 's', 'm', 'd'], merge(birdies('t', 1), birdies('m', 2, 3)));
  const withCup = { ...structuredClone(plain), cup: FOURBALL };
  assert.deepEqual(roundResults(withCup).balances, roundResults(plain).balances);
  assert.deepEqual(roundResults(withCup).transfers, roundResults(plain).transfers);
});

// ---------------------------------------------------------------------------
// The team score, other groups' rounds and the leaderboard

/** Day one four-ball (Blue wins 1 up), day two singles (split), day three singles (Red sweeps). */
function cupRounds({ day3 = true } = {}) {
  const list = [
    round('r1', ['t', 's', 'm', 'd'], birdies('t', 4), { at: OCT(16, 15), cup: FOURBALL }),
    round('r2', ['t', 's', 'm', 'd'], merge(birdies('t', 4), birdies('d', 7, 8)), { at: OCT(17, 15), cup: SINGLES }),
  ];
  if (day3) list.push(round('r3', ['t', 's', 'm', 'd'], merge(birdies('m', 1), birdies('d', 2)), { at: OCT(18, 12), cup: { kind: 'singles', sides: [['t', 's'], ['m', 'd']] } }));
  return list;
}
/** The same rounds on a money trip: no matches, no stake. */
const plainOf = (me, rounds, extra = {}) => stateOf(me, rounds.map(r => { const x = structuredClone(r); delete x.cup; x.trip = tripStamp(MONEY_TRIP); return x; }), { trips: { t_cup: MONEY_TRIP }, ...extra });

test('the team score adds up every match on the trip, and the leaderboard each player’s points', () => {
  const s = stateOf('t', cupRounds());
  const entries = cupEntries(s, 't_cup');
  const score = cupScore(entries);
  // r1: Blue 1. r2: Blue 1, Red 1. r3: Red 2. Blue 2, Red 3
  assert.deepEqual(score.points, [2, 3]);
  assert.equal(score.done, 5);
  assert.equal(score.matches[0].entry.key, 'Lr3', 'newest round first');
  const board = cupLeaderboard(s, entries);
  const row = id => board.find(r => r.id === id);
  assert.deepEqual([row('t').played, row('t').won, row('t').lost, row('t').halved, row('t').points], [3, 2, 1, 0, 2]);
  assert.deepEqual([row('d').won, row('d').points], [2, 2]);
  assert.equal(row('s').points, 1);
  assert.equal(board.length, 4);
  assert.equal(cupPoints(2.5), '2½');
  assert.equal(cupPoints(0.5), '½');
  assert.equal(cupPoints(3), '3');
});

test('a round taken off the trip, or not on it, adds nothing', () => {
  const [r1, r2] = cupRounds({ day3: false });
  const off = { ...r2 };
  delete off.trip;
  const s = stateOf('t', [r1, off]);
  assert.deepEqual(cupScore(cupEntries(s, 't_cup')).points, [1, 0]);
});

test('another group’s round comes from the server; this phone’s own copy of a round always wins', () => {
  const [r1] = cupRounds();
  const other = round('o1', ['a', 'b'], birdies('b', 1), { cup: { kind: 'singles', sides: [['a'], ['b']] }, code: 'OTHER1' });
  const remoteOther = cupEntry({ accountOf: { b: 'acct-bo' } }, other);
  // An out-of-date server copy of r1 that says Red won: this phone's r1 is what counts
  const stale = { ...cupEntry({}, r1), matches: [{ kind: 'fourball', sides: [['t', 's'], ['m', 'd']], result: { done: true, winner: 1, label: '1 up', thru: 9 } }] };
  const s = stateOf('t', [r1], { cupRemote: { t_cup: { OTHER1: remoteOther, Lr1: stale } } });
  const entries = cupEntries(s, 't_cup');
  // Oldest first: the other group teed off earlier
  assert.deepEqual(entries.map(e => [e.key, e.local]), [['OTHER1', false], ['Lr1', true]]);
  assert.deepEqual(cupScore(entries).points, [1, 1]);
  // Someone known only from another group's round is on the leaderboard by name
  const board = cupLeaderboard(s, entries);
  assert.ok(board.some(r => r.id === null && r.name === 'Bo' && r.points === 1));
  // Once this phone knows Bo's account, the same person
  const s2 = { ...s, accountOf: { bo_here: 'acct-bo' }, players: { ...s.players, bo_here: { id: 'bo_here', name: 'Bo' } } };
  assert.ok(cupLeaderboard(s2, cupEntries(s2, 't_cup')).some(r => r.id === 'bo_here' && r.points === 1));
});

test('a server entry is tidied: junk left out, points from the result, never more than it says', () => {
  assert.equal(cleanEntry(null), null);
  assert.equal(cleanEntry({ key: 'X', players: 'no', matches: [] }), null);
  const e = cleanEntry({
    key: 'ABCDEF', status: 'done', at: 5, day: 'bad', course: 'C',
    players: [{ id: 'a', name: 'A', team: 0 }, { id: 'b', name: 'B', team: 7 }, 'junk'],
    matches: [
      { kind: 'singles', sides: [['a'], ['b']], result: { done: true, winner: 0, points: [5, 0], label: '2&1', thru: 8 } },
      { kind: 'fourball', sides: [['zz'], ['b']], result: { done: true, winner: 1 } },
    ],
  });
  assert.equal(e.players.length, 2);
  assert.equal(e.players[1].team, null);
  assert.equal(e.day, null);
  assert.equal(e.matches.length, 1, 'a match with nobody known on a side is left out');
  assert.deepEqual(e.matches[0].result.points, [1, 0]);
});

// ---------------------------------------------------------------------------
// The stake

test('the stake: each loser pays it, winners split the pot, in a few payments every phone agrees on', () => {
  const cup = cleanCup(CUP);
  assert.deepEqual(stakeLines(cup, 1).map(l => [l.from, l.to, l.amount]), [['t', 'm', 20], ['s', 'd', 20]]);
  assert.deepEqual(stakeLines(cup, null), [], 'a halved cup pays nothing');
  assert.deepEqual(stakeLines({ ...cup, stake: 0 }, 0), []);
  // Three against two at $10: the pot of $30 is $15 a winner
  const odd = cleanCup({ teams: [[{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ id: 'd' }, { id: 'e' }]], stake: 10 });
  assert.deepEqual(stakeLines(odd, 1).map(l => [l.from, l.to, l.amount]), [['a', 'd', 10], ['b', 'd', 5], ['b', 'e', 5], ['c', 'e', 10]]);
  assert.deepEqual(stakeBalances(odd, 1), { a: -10, b: -10, c: -10, d: 15, e: 15 });
  // Two against three at $10: $20 over three winners, the odd cent to the first
  const thin = cleanCup({ teams: [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }, { id: 'd' }, { id: 'e' }]], stake: 10 });
  const bal = stakeBalances(thin, 1);
  assert.deepEqual([bal.c, bal.d, bal.e], [6.67, 6.67, 6.66]);
  assert.equal(Math.round(Object.values(bal).reduce((x, v) => x + v, 0) * 100), 0);
});

test('stake marks: this phone’s and other phones’, each once, and what’s left on each line', () => {
  const cup = cleanCup(CUP);
  const lines = stakeLines(cup, 1);
  const s = {
    cupPaid: { t_cup: [{ id: 'cup:t_cup:t>m:1', key: 't>m', from: 't', to: 'm', amount: 20, at: 10 }] },
    cupRemote: { t_cup: { Pabc: { byName: 'Sam', pays: [{ id: 'cup:t_cup:s>d:2', key: 's>d', from: 's', to: 'd', amount: 5, at: 11 }, { id: 'cup:t_cup:t>m:1', key: 't>m', from: 't', to: 'm', amount: 20, at: 10 }] } } },
  };
  const marks = stakeMarks(s, 't_cup');
  assert.equal(marks.length, 2);
  assert.equal(marks.find(m => m.key === 't>m').mine, true);
  assert.equal(marks.find(m => m.key === 's>d').byName, 'Sam');
  const open = stakeOpen(lines, marks);
  assert.deepEqual(open.map(l => [l.key, l.paid, l.open]), [['t>m', 2000, 0], ['s>d', 500, 1500]]);
});

test('the stake folds into each person’s trip total and the Tab once the trip is over, and not before', () => {
  // Shared live, so every phone on the trip can tell who's who in a payment for it (cup.js stakeLink)
  const rounds = cupRounds().map((r, i) => ({ ...r, shareCode: `CUP${i}XX` }));
  const s = stateOf('t', rounds);
  // Mid-trip (the last day, before its round is in): no stake in anyone's total yet
  const mid = tripStatus(stateOf('t', cupRounds({ day3: false })), 't_cup', { now: OCT(17, 18) });
  assert.equal(mid.cup.final, false);
  assert.equal(mid.cup.stakeOn, false);
  assert.ok(mid.standings.every(p => p.stake === undefined));
  // After the last round: Red won 3 to 2, so Trevor and Sam pay $20 each
  const st = tripStatus(s, 't_cup', { now: OCT(18, 20) });
  assert.equal(st.cup.final, true);
  assert.equal(st.cup.winner, 1);
  assert.deepEqual(st.cup.lines.map(l => [l.fromId, l.toId, l.amount]), [['t', 'm', 20], ['s', 'd', 20]]);
  const money = Object.fromEntries(Object.keys(NAMES).slice(0, 4).map(id => [id, 0]));
  for (const r of rounds) for (const [id, v] of Object.entries(roundResults(r).balances)) money[id] = Math.round((money[id] + v) * 100) / 100;
  const total = id => st.standings.find(p => p.id === id).amount;
  assert.equal(total('t'), Math.round((money.t - 20) * 100) / 100);
  assert.equal(total('m'), Math.round((money.m + 20) * 100) / 100);
  assert.equal(st.standings.find(p => p.id === 'd').stake, 20);
  assert.equal(myTripNet(s, st), total('t'));
  assert.equal(st.phase, 'ready', 'the stake is still to pay');
  // The Tab: the rounds' money, and the stake on top of it once the cup is decided
  const plain = plainOf('t', rounds);
  const now = OCT(18, 20);
  const bal = tabBalances(s, { now }), plainBal = tabBalances(plain, { now });
  for (const id of ['t', 's', 'm', 'd']) assert.equal(Math.round(bal[id] * 100), Math.round((plainBal[id] + st.cup.stakeBy[id]) * 100), id);
  // Mid-trip it's exactly what the rounds alone make, with or without the cup
  assert.deepEqual(tabBalances(s, { now: OCT(17, 18) }), tabBalances(plain, { now: OCT(17, 18) }));
  assert.deepEqual(outstanding(s, { now: OCT(17, 18) }), outstanding(plain, { now: OCT(17, 18) }));
  // Settle the trip: each person's lines add up to their whole trip, the stake in it once
  const netOf = (plan, id) => plan.reduce((a, t) => a + (t.to === id ? 1 : t.from === id ? -1 : 0) * Math.round(t.amount * 100), 0);
  for (const id of ['t', 's', 'm', 'd']) assert.equal(netOf(st.plan, id), Math.round(total(id) * 100), id);
  // The money trip's own standings are the cup trip's without the stake
  const ms = tripStatus(plain, 't_cup', { now: OCT(18, 20) });
  assert.equal(ms.cup, null);
  // Rounds kept on this phone alone: the other phones never have them, so the stake is marked paid
  // on the trip, off the Tab (as before it went on the Tab), and still in each person's trip total
  const solo = stateOf('t', cupRounds());
  const so = tripStatus(solo, 't_cup', { now });
  assert.ok(so.cup.lines.length && so.cup.lines.every(l => !l.onTab));
  assert.deepEqual(tabBalances(solo, { now }), tabBalances(plainOf('t', cupRounds()), { now }));
  assert.equal(so.standings.find(p => p.id === 't').stake, -20);
  assert.equal(so.phase, 'ready');
  for (const id of ['t', 's', 'm', 'd']) assert.equal(netOf(ms.plan, id), Math.round(money[id] * 100), id);
  assert.deepEqual(ms.standings.map(p => [p.id, p.amount]).sort(), Object.entries(money).sort());
});

test('a stake marked paid squares the trip; a halved cup or no stake pays nothing', () => {
  const rounds = cupRounds();
  // Every round's own money paid, and the stake marked paid the way it was before it went on the Tab
  const st0 = tripStatus(stateOf('t', rounds), 't_cup', { now: OCT(18, 20) });
  const roundsOnly = tripStatus(plainOf('t', rounds), 't_cup', { now: OCT(18, 20) }).plan;
  const paidRounds = roundsOnly.map((t, i) => ({ id: `trip:t_cup:${t.from}>${t.to}:${i}`, from: t.from, to: t.to, amount: t.amount, at: OCT(18, 19) + i }));
  const marks = st0.cup.lines.map((l, i) => ({ id: `cup:t_cup:${l.key}:${i}`, key: l.key, from: l.from, to: l.to, amount: l.amount, at: OCT(18, 19) + i }));
  const paidState = stateOf('t', rounds, { settlements: paidRounds, cupPaid: { t_cup: marks } });
  const done = tripStatus(paidState, 't_cup', { now: OCT(18, 21) });
  assert.equal(done.phase, 'square');
  assert.deepEqual(done.plan, []);
  assert.deepEqual(outstanding(paidState, { now: OCT(18, 21) }), [], 'the marks square the Tab too');
  // Halved: on day three Trevor and Mike halve, Dave beats Sam, so 2½ to 2½
  const halved = cupRounds({ day3: false });
  halved.push(round('r3', ['t', 's', 'm', 'd'], birdies('d', 2), { at: OCT(18, 12), cup: SINGLES }));
  const h = tripStatus(stateOf('t', halved), 't_cup', { now: OCT(18, 20) });
  assert.deepEqual(h.cup.score.points, [2.5, 2.5]);
  assert.equal(h.cup.halved, true);
  assert.deepEqual(h.cup.lines, []);
  assert.equal(h.hasMoney, true, 'the rounds’ own money still shows');
});

test('a points-only cup trip with a stake has money to settle once it’s decided', () => {
  const rounds = cupRounds().map(r => ({ ...r, playFor: { kind: 'points' } }));
  const st = tripStatus(stateOf('t', rounds), 't_cup', { now: OCT(18, 20) });
  assert.equal(st.money.length, 0);
  assert.equal(st.pointsOnly, false);
  assert.equal(st.hasMoney, true);
  assert.deepEqual(st.standings.map(p => [p.id, p.amount]).sort(), [['d', 20], ['m', 20], ['s', -20], ['t', -20]]);
  assert.equal(st.phase, 'ready');
});

test('a friend’s phone with other ids for the teams finds who’s who by the rounds it has', () => {
  // Mike's phone: he joined Trevor's round, so the round's ids are Trevor's; Mike is "me" there
  const rounds = cupRounds().map(r => ({ ...r, localMe: 'm' }));
  const s = { me: 'mike_own', players: { mike_own: { id: 'mike_own', name: 'Mike' } }, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {} };
  const st = tripStatus(s, 't_cup', { now: OCT(18, 20) });
  assert.equal(st.cup.myTeam, 1);
  const mine = st.cup.lines.find(l => l.toId === 'mike_own');
  assert.ok(mine, 'Mike’s phone knows the line to him is his');
  assert.equal(mine.amount, 20);
  assert.equal(st.standings.find(p => p.id === 'mike_own').stake, 20);
});

// ---------------------------------------------------------------------------
// What goes to the server

test('a phone posts the rounds it keeps, a joined round only when the server’s copy is missing or older, and its own marks', () => {
  const local = round('r1', ['t', 's', 'm', 'd'], birdies('t', 4), { cup: FOURBALL });
  const hosted = { ...round('r2', ['t', 's', 'm', 'd'], birdies('m', 2), { cup: FOURBALL, code: 'HOST01' }), shared: { code: 'HOST01', host: true } };
  const joined = { ...round('r3', ['t', 'a', 'm', 'b'], {}, { cup: { kind: 'singles', sides: [['t', 'a'], ['m', 'b']] }, code: 'JOIN01', status: 'active', upto: 3 }), shared: { code: 'JOIN01', host: false } };
  const s = stateOf('t', [local, hosted, joined], { cupPaid: { t_cup: [{ id: 'x', key: 't>m', from: 't', to: 'm', amount: 20, at: 1 }] } });
  const keys = cupPosts(s, TRIP, {}, 'Pabc').map(p => p.key);
  assert.deepEqual(keys.sort(), ['HOST01', 'JOIN01', 'Lr1', 'Pabc']);
  // Once the server has them all as they are, nothing to post
  const remote = Object.fromEntries(cupPosts(s, TRIP, {}, 'Pabc').map(p => [p.key, JSON.parse(JSON.stringify(p.data))]));
  assert.deepEqual(cupPosts(s, TRIP, remote, 'Pabc'), []);
  // The joined round's server copy is further along (its keeper's phone): this phone leaves it
  const ahead = { ...remote, JOIN01: { ...remote.JOIN01, status: 'done' } };
  const scored = structuredClone(s);
  scored.rounds.r3.scores[4] = { t: 3, a: 4, m: 4, b: 4 };
  assert.deepEqual(cupPosts(scored, TRIP, ahead, 'Pabc'), []);
  // Behind it: this phone's newer copy goes up
  assert.deepEqual(cupPosts(scored, TRIP, remote, 'Pabc').map(p => p.key), ['JOIN01']);
  // A round of its own taken off the trip is posted as gone
  const off = structuredClone(s);
  delete off.rounds.r1.trip;
  assert.deepEqual(cupPosts(off, TRIP, remote, 'Pabc'), [{ key: 'Lr1', data: { gone: true } }]);
  // And a gone round counts for nothing on another phone
  const friend = stateOf('x', [], { cupRemote: { t_cup: { Lr1: { gone: true }, HOST01: remote.HOST01 } } });
  assert.deepEqual(cupEntries(friend, 't_cup').map(e => e.key), ['HOST01']);
});

test('the cup in a few words', () => {
  const st = tripStatus(stateOf('t', cupRounds()), 't_cup', { now: OCT(18, 20) });
  assert.equal(cupHeadline(st.cup), 'Red wins the cup 3 to 2');
  const mid = tripStatus(stateOf('t', cupRounds({ day3: false })), 't_cup', { now: OCT(17, 18) });
  assert.equal(cupHeadline(mid.cup), 'Blue leads 2 to 1');
  const none = tripStatus(stateOf('t', []), 't_cup', { now: OCT(15) });
  assert.equal(cupHeadline(none.cup), 'No matches played yet');
});

test('stake marks sync with your account, and an older profile without them keeps this phone’s', async () => {
  const { applyDoc, toDocs } = await import('./cloud-model.js');
  const marks = { t_cup: [{ id: 'cup:t_cup:t>m:1', key: 't>m', from: 't', to: 'm', amount: 20, at: 1 }] };
  const s = { ...stateOf('t', []), crews: {}, customCourses: {}, cupPaid: marks };
  const doc = toDocs(s)['profile:me'];
  assert.deepEqual(doc.data.cupPaid, marks);
  const draft = { ...stateOf('t', []), settings: {}, cupPaid: {} };
  applyDoc(draft, 'profile', 'me', doc.data);
  assert.deepEqual(draft.cupPaid, marks);
  const older = { ...doc.data };
  delete older.cupPaid;
  applyDoc(draft, 'profile', 'me', older);
  assert.deepEqual(draft.cupPaid, marks);
});

// ---------------------------------------------------------------------------
// Review fixes: rows that outlive their round, a group that never finished, the Games view

test('a round posted before it was shared live goes by its code after, and its first copy is taken back', () => {
  const before = round('r1', ['t', 's', 'm', 'd'], birdies('t', 4), { cup: FOURBALL });
  const s0 = stateOf('t', [before]);
  const first = cupPosts(s0, TRIP, {}, 'Pme');
  assert.deepEqual(first.map(p => p.key), ['Lr1']);
  assert.equal(first[0].data.by, 'Pme', 'the phone that posted it is on the row');
  const server = { Lr1: first[0].data };
  // Shared live now: the same round goes by its code
  const shared = { ...structuredClone(before), shareCode: 'SHARE1', shared: { code: 'SHARE1', host: true } };
  const s1 = stateOf('t', [shared], { cupRemote: { t_cup: server } });
  // This phone counts it once, even before the server hears
  assert.deepEqual(cupEntries(s1, 't_cup').map(e => e.key), ['SHARE1']);
  assert.deepEqual(cupScore(cupEntries(s1, 't_cup')).points, [1, 0]);
  const posts = cupPosts(s1, TRIP, server, 'Pme');
  assert.deepEqual(posts.map(p => p.key).sort(), ['Lr1', 'SHARE1']);
  assert.deepEqual(posts.find(p => p.key === 'Lr1').data, { gone: true });
  // A friend in another group then counts it once too
  const after = Object.fromEntries(posts.map(p => [p.key, p.data]));
  const friend = stateOf('x', [], { cupRemote: { t_cup: { ...server, ...after } } });
  assert.deepEqual(cupScore(cupEntries(friend, 't_cup')).points, [1, 0]);
  // A friend who joined the round leaves the host's first copy alone (it isn't theirs to take back)
  const joined = { ...structuredClone(shared), shared: { code: 'SHARE1', host: false } };
  const fs = stateOf('m', [joined], { cupRemote: { t_cup: server } });
  assert.ok(!cupPosts(fs, TRIP, server, 'Pmike').some(p => p.key === 'Lr1'));
  assert.deepEqual(cupScore(cupEntries(fs, 't_cup')).points, [1, 0], 'and counts the round once meanwhile');
});

test('a round deleted on the phone that posted it stops counting; another phone’s rounds are left alone', () => {
  const mine = round('r1', ['t', 's', 'm', 'd'], birdies('t', 4), { cup: FOURBALL });
  const posted = cupPosts(stateOf('t', [mine]), TRIP, {}, 'Pme')[0].data;
  const theirs = { ...cupEntry({}, round('o1', ['a', 'b'], birdies('b', 1), { cup: { kind: 'singles', sides: [['a'], ['b']] } })), by: 'Pother' };
  const server = { Lr1: posted, Lo1: theirs };
  const gone = stateOf('t', [], { cupRemote: { t_cup: server } });
  assert.deepEqual(cupPosts(gone, TRIP, server, 'Pme'), [{ key: 'Lr1', data: { gone: true } }]);
  // With no device key this phone can't tell its rows from anyone's, so it leaves them all
  assert.deepEqual(cupPosts(gone, TRIP, server, null), []);
  // Once taken back, only the other group's round counts
  const friend = stateOf('x', [], { cupRemote: { t_cup: { ...server, Lr1: { gone: true } } } });
  assert.deepEqual(cupEntries(friend, 't_cup').map(e => e.key), ['Lo1']);
});

test('once the trip is over, another group’s round left unfinished counts as it stood, and the cup is decided', () => {
  const [r1, r2] = cupRounds({ day3: false });
  // Day three: the other group's phone posted Mike 2 up thru 5 on Trevor, Sam and Dave not started, then went quiet
  const other = round('o3', ['t', 's', 'm', 'd'], merge(birdies('m', 1), birdies('m', 2)), { at: OCT(18, 12), cup: SINGLES, status: 'active', upto: 5, code: 'GRP002' });
  const stuck = cupEntry({}, other);
  stuck.matches[1].result = { ...stuck.matches[1].result, thru: 0, leader: null, by: 0, label: 'All square' };
  const s = stateOf('t', [r1, r2], { cupRemote: { t_cup: { GRP002: stuck } } });
  // The last day, still being played: not decided
  const lastDay = tripStatus(s, 't_cup', { now: OCT(18, 20) });
  assert.equal(lastDay.cup.final, false);
  assert.equal(lastDay.cup.score.live.length, 2);
  // The day after: Mike's lead stands and the match never started counts for nothing, so Blue 2, Red 1 + 1
  const next = tripStatus(s, 't_cup', { now: OCT(19, 9) });
  assert.equal(next.cup.final, true);
  assert.deepEqual(next.cup.score.points, [2, 2]);
  assert.equal(next.cup.halved, true);
  assert.deepEqual(next.cup.lines, [], 'a halved cup pays nothing');
  // Or the organizer says it's over, on the last day
  const ended = tripStatus({ ...s, trips: { t_cup: { ...TRIP, endedAt: OCT(18, 19) } } }, 't_cup', { now: OCT(18, 20) });
  assert.equal(ended.cup.final, true);
  // Done playing with a round still planned (the template plans every session): decided all the same
  const plan = { id: 'pl9', status: 'planned', date: '2026-10-18', teeTime: '21:00', trip: tripStamp(TRIP), createdAt: OCT(15) };
  const endedPlanned = tripStatus({ ...s, plans: { pl9: plan }, trips: { t_cup: { ...TRIP, endedAt: OCT(18, 19) } } }, 't_cup', { now: OCT(18, 20) });
  assert.equal(endedPlanned.cup.final, true);
  assert.notEqual(endedPlanned.phase, 'on');
  // A finished entry is left as it is
  const fin = cupEntry({}, r1);
  assert.equal(closeEntry(fin), fin);
  const closed = closeEntry(cleanEntry(stuck));
  assert.equal(closed.status, 'done');
  assert.deepEqual(closed.matches.map(m => [m.result.winner, m.result.label, m.result.void || false]), [[1, '2 up', false], [null, 'Not played', true]]);
});

test('the Games view gives the stake its own column, so each row adds up to the trip total', () => {
  const rounds = cupRounds();
  const s = stateOf('t', rounds);
  const st = tripStatus(s, 't_cup', { now: OCT(18, 20) });
  const { columns, rows } = tripByGame(s, 't_cup', { stake: st.cup.stakeBy });
  assert.equal(columns.at(-1), CUP_COLUMN);
  for (const p of st.standings) {
    const sum = Object.values(rows.get(p.id)).reduce((a, v) => a + Math.round(v * 100), 0);
    assert.equal(sum, Math.round(p.amount * 100), `${p.id}'s games and stake add up to their trip total`);
  }
  // Without a decided stake (or on a money trip) the view is exactly as before
  const plain = tripByGame(s, 't_cup');
  assert.ok(!plain.columns.includes(CUP_COLUMN));
  assert.deepEqual(tripByGame(s, 't_cup', { stake: {} }), plain);
});

test('a scramble or Chapman never has cup matches (nor Alternate shot without its two pairs), and one posted before goes', () => {
  // Four-ball and singles use each player's own scores, which a one-ball game doesn't have; Alternate shot is foursomes
  for (const g of ['scramble', 'chapman']) assert.equal(cupCounts(g), false, g);
  for (const g of ['skins', 'nassau', 'bestball', 'shamble', 'match', 'altshot']) assert.equal(cupCounts(g), true, g);
  const r = round('r1', ['t', 's', 'm', 'd'], birdies('t', 4), { cup: FOURBALL });
  assert.ok(cleanRoundCup(r));
  // `r` has no teams, so as Alternate shot it has no pairs to play foursomes
  for (const game of ['scramble', 'altshot', 'chapman']) {
    const one = { ...r, game };
    assert.equal(cleanRoundCup(one), null, game);
    assert.equal(cupEntry(stateOf('t', [one]), one), null, game);
    assert.deepEqual(cupEntries(stateOf('t', [one]), 't_cup'), [], game);
    // A copy this phone posted before it was a one-ball game is taken back
    assert.deepEqual(cupPosts(stateOf('t', [one]), TRIP, { Lr1: { ...cupEntry(stateOf('t', [r]), r), by: 'Pabc' } }, 'Pabc'), [{ key: 'Lr1', data: { gone: true } }]);
  }
  // A friend's copy of a shared round from before can't bring it back on a phone that has the round
  const shared = { ...round('r2', ['t', 's', 'm', 'd'], birdies('t', 4), { cup: FOURBALL, code: 'ALTS01' }), game: 'altshot', shared: { code: 'ALTS01', host: false } };
  const before = cupEntry(stateOf('t', [r]), { ...shared, game: 'skins' });
  assert.deepEqual(cupEntries(stateOf('t', [shared], { cupRemote: { t_cup: { ALTS01: before } } }), 't_cup'), []);
});
