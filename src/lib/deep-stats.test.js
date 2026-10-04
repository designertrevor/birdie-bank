// Deeper stats: results and net by game and by course, press win rate, skins won and biggest wins.
// Every number is checked against what the round itself says, and points and lunch rounds never
// turn into dollars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { addBet, setBetWinner } from './pair-bets.js';
import { tabResults } from './play-for.js';
import { profileStats } from './profile-model.js';
import { isLatest, rangeBounds, rangeLabel, rangeOfKind, roundsInRange, shiftRange } from './history.js';
import { bestOf, deepStats, dollarsIn, gameParts, pressCount, pressesIn, seatIn, skinsIn, winRate } from './deep-stats.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const oak = { ...flat9, id: 'oak', name: 'Oak Hollow', city: 'Bend' };
const SET = {
  hcPct: 100,
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
};
const LUNCH = { kind: 'reward', reward: 'Lunch', owes: 'last' };
const at = (m, d) => new Date(2026, m - 1, d, 15).getTime();

/** A finished 9-hole round: everyone makes 4 except the scores given ({ hole: { id: score } }). */
function round(id, game, ids, holes = {}, { course = flat9, when = at(9, 5), extra = {} } = {}) {
  const r = createRound({ id, game, course, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: structuredClone(SET), hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.status = 'done';
  r.createdAt = when - 4 * 36e5;
  r.finishedAt = when;
  return Object.assign(r, extra);
}
const stateOf = (rounds, extra = {}) => ({ me: 'me', players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], ...extra });

// A Nassau where you're behind 2 early, press, and win the press; Mike presses the back and it's halved.
// Front (1-4): Mike 1, 2; you 3, 4. Back (5-9): you 5, 6; the rest halved.
const nassauA = () => round('n1', 'nassau', ['me', 'mike'], {
  1: { mike: 3 }, 2: { mike: 3 }, 3: { me: 3 }, 4: { me: 3 }, 5: { me: 3 }, 6: { me: 3 },
}, { extra: { presses: [{ id: 1, leg: 'front', start: 3, by: 0 }, { id: 2, leg: 'back', start: 7, by: 1 }] } });
// You're the second side here: you press at 3 and lose hole 3, so the press is lost.
const nassauB = () => round('n2', 'nassau', ['mike', 'me'], { 1: { mike: 3 }, 2: { mike: 3 }, 3: { mike: 3 } }, {
  course: oak, when: at(9, 12), extra: { presses: [{ id: 1, leg: 'front', start: 3, by: 1 }] },
});
// Skins: you take holes 1 and 2 ($2 a skin from each of two others)
const skinsA = () => round('s1', 'skins', ['me', 'mike', 'sam'], { 1: { me: 3 }, 2: { me: 3 }, 5: { sam: 3 } }, { when: at(9, 19) });
// Stroke play with a side Skins: you win hole 1's side skin and finish one under
const strokeSide = () => round('s2', 'stroke', ['me', 'mike', 'sam'], { 1: { me: 3 } }, {
  course: oak, when: at(9, 26), extra: { sideGames: [{ game: 'skins', settings: { value: 1, carryover: true } }] },
});
// For points: you take a skin, and it's never dollars
const pointsSkins = () => round('p1', 'skins', ['me', 'mike'], { 1: { me: 3 } }, { when: at(10, 1), extra: { playFor: { kind: 'points' } } });
// For lunch, with a $10 side bet for money you win: the bet is dollars, the game is points
function lunch() {
  const r = round('l1', 'skins', ['me', 'mike'], { 4: { mike: 3 } }, { when: at(10, 2), extra: { playFor: LUNCH } });
  return setBetWinner(addBet(r, { id: 'B1', kind: 'custom', sides: ['me', 'mike'], stake: 10, playFor: 'money' }), 'B1', 1, 'me');
}
const all = () => [nassauA(), nassauB(), skinsA(), strokeSide(), pointsSkins(), lunch()];

test('press win rate: your presses and presses against you, by your side in the match', () => {
  const a = nassauA();
  assert.deepEqual(pressesIn(a, 'me'), { made: { won: 1, lost: 0, halved: 0 }, against: { won: 0, lost: 0, halved: 1 } });
  // Mike sees the same presses the other way round
  assert.deepEqual(pressesIn(a, 'mike'), { made: { won: 0, lost: 0, halved: 1 }, against: { won: 0, lost: 1, halved: 0 } });
  // As the second side, your press is still yours
  assert.deepEqual(pressesIn(nassauB(), 'me').made, { won: 0, lost: 1, halved: 0 });
  const st = deepStats(stateOf(all()));
  assert.equal(st.presses.rounds, 2);
  assert.deepEqual(st.presses.made, { won: 1, lost: 1, halved: 0 });
  assert.equal(winRate(st.presses.made), 50);
  assert.equal(pressCount(st.presses.against), 1);
  assert.equal(winRate({ won: 0, lost: 0, halved: 0 }), null);
  // Games without presses add nothing
  assert.deepEqual(pressesIn(skinsA(), 'me').made, { won: 0, lost: 0, halved: 0 });
});

test('a press whose holes were never played is not counted, so it never drags the win rate', () => {
  // Finished after 7 holes: the press on 8 never started. The press on 3 is won as in nassauA.
  const r = nassauA();
  r.presses.push({ id: 3, leg: 'back', start: 8, by: 0 });
  delete r.scores[8]; delete r.scores[9];
  const money = roundResults(r).balances.me;
  assert.deepEqual(pressesIn(r, 'me').made, { won: 1, lost: 0, halved: 0 });
  assert.equal(winRate(deepStats(stateOf([r])).presses.made), 100);
  // Reading the presses never changes the round's money
  assert.equal(roundResults(r).balances.me, money);
});

test('a team Nassau: your side is your team', () => {
  const r = round('t1', 'nassau', ['me', 'mike', 'sam', 'dave'], { 1: { sam: 3 }, 2: { dave: 3 }, 3: { me: 3 }, 4: { mike: 3 } }, {
    extra: { teams: [{ name: 'Us', players: ['sam', 'dave'] }, { name: 'Them', players: ['me', 'mike'] }], presses: [{ id: 1, leg: 'front', start: 3, by: 1 }] },
  });
  // Your team was 2 down, pressed and won holes 3 and 4
  assert.deepEqual(pressesIn(r, 'me').made, { won: 1, lost: 0, halved: 0 });
  assert.deepEqual(pressesIn(r, 'sam').against, { won: 0, lost: 1, halved: 0 });
});

test('skins won: main game and side Skins together, dollars only from money rounds', () => {
  assert.deepEqual(skinsIn(skinsA(), 'me'), { played: true, skins: 2, dollars: 8 });
  assert.deepEqual(skinsIn(strokeSide(), 'me'), { played: true, skins: 1, dollars: 2 });
  assert.deepEqual(skinsIn(pointsSkins(), 'me'), { played: true, skins: 1, dollars: null });
  assert.equal(skinsIn(nassauA(), 'me').played, false);
  const st = deepStats(stateOf(all()));
  // Skins in four rounds: s1, s2, the points round and the lunch round (where Mike took one)
  assert.equal(st.skins.rounds, 4);
  assert.equal(st.skins.won, 4);
  assert.deepEqual(st.skins.dollars, { net: 10, rounds: 2 });
  assert.equal(st.skins.best.id, 's1');
  assert.equal(st.skins.best.skins, 2);
});

test('results by game: each game on its own line, the same game as a side game counted with it', () => {
  const st = deepStats(stateOf(all()));
  const g = Object.fromEntries(st.games.map(l => [l.key, l]));
  assert.deepEqual(Object.keys(g).sort(), ['bets', 'nassau', 'skins', 'stroke']);
  // Nassau: n1 you win, n2 you lose
  const n1 = roundResults(nassauA()).balances.me, n2 = roundResults(nassauB()).balances.me;
  assert.ok(n1 > 0 && n2 < 0);
  assert.deepEqual(g.nassau.record, { won: 1, lost: 1, even: 0 });
  assert.deepEqual(g.nassau.dollars, { net: Math.round((n1 + n2) * 100) / 100, rounds: 2 });
  // Skins: s1 and the side skins in s2 are dollars; the points round and the lunch round are points
  assert.equal(g.skins.rounds, 4);
  // (the net after Sam's carried skins, not just what your skins brought in)
  const skinNet = roundResults(skinsA()).balances.me + roundResults(strokeSide()).detail.byGame.skins.balances.me;
  assert.deepEqual(g.skins.dollars, { net: skinNet, rounds: 2 });
  const pts = roundResults(pointsSkins()).balances.me + roundResults(lunch()).balances.me;
  assert.deepEqual(g.skins.points, { net: pts, rounds: 2 });
  assert.equal(g.skins.name, 'Skins');
  // The lunch round's money bet is dollars, on the side bets line
  assert.deepEqual(g.bets.dollars, { net: 10, rounds: 1 });
  assert.equal(g.bets.points.rounds, 0);
  assert.deepEqual(g.bets.record, { won: 1, lost: 0, even: 0 });
  // The stroke main game's money is its own line (the side skin isn't in it)
  assert.equal(g.stroke.dollars.net, roundResults(strokeSide()).detail.byGame.main.balances.me);
});

test('results by course: rounds, record and money at each course, newest name kept', () => {
  const st = deepStats(stateOf(all()));
  const c = Object.fromEntries(st.courses.map(l => [l.name, l]));
  assert.deepEqual(Object.keys(c).sort(), ['Flat Nine', 'Oak Hollow']);
  assert.equal(c['Flat Nine'].rounds, 4);
  assert.equal(c['Oak Hollow'].rounds, 2);
  assert.equal(c['Oak Hollow'].place, 'Bend');
  const oakNet = roundResults(nassauB()).balances.me + roundResults(strokeSide()).balances.me;
  assert.deepEqual(c['Oak Hollow'].dollars, { net: Math.round(oakNet * 100) / 100, rounds: 2 });
  // Flat Nine: two money rounds plus the lunch round's $10 bet are dollars; the points round is points
  assert.equal(c['Flat Nine'].dollars.rounds, 3);
  assert.equal(c['Flat Nine'].points.rounds, 2);
  assert.equal(c['Flat Nine'].last, at(10, 2));
  // Most rounds first
  assert.equal(st.courses[0].name, 'Flat Nine');
});

test('a course renamed keeps one line by its id', () => {
  const later = round('x', 'skins', ['me', 'mike'], {}, { course: { ...flat9, name: 'Flat Nine GC' }, when: at(11, 1) });
  const st = deepStats(stateOf([skinsA(), later]));
  assert.equal(st.courses.length, 1);
  assert.equal(st.courses[0].name, 'Flat Nine GC');
  assert.equal(st.courses[0].rounds, 2);
});

test('the dollars add up to what the profile says, and points never do', () => {
  const state = stateOf(all());
  const st = deepStats(state);
  const prof = profileStats(state);
  assert.equal(st.dollars.net, prof.money.net);
  assert.equal(st.dollars.rounds, prof.money.rounds);
  assert.equal(st.lunchDollars, 1);
  assert.equal(st.rounds, prof.rounds);
  assert.deepEqual(st.record, prof.record);
  // Only the points round and the lunch round are points
  assert.equal(st.points.rounds, 2);
  // By game and by course add up to the same dollars
  const sum = lines => Math.round(lines.reduce((a, l) => a + l.dollars.net, 0) * 100) / 100;
  assert.equal(sum(st.games), st.dollars.net);
  assert.equal(sum(st.courses), st.dollars.net);
});

test('biggest wins: dollars only, biggest first, a lunch round’s money bet marked', () => {
  const st = deepStats(stateOf(all()));
  assert.ok(st.biggest.length <= 3);
  for (let i = 1; i < st.biggest.length; i++) assert.ok(st.biggest[i - 1].amount >= st.biggest[i].amount);
  assert.ok(st.biggest.every(w => w.amount > 0));
  assert.ok(!st.biggest.some(w => w.id === 'p1'), 'a points round is never a win in dollars');
  const l = st.biggest.find(w => w.id === 'l1');
  assert.deepEqual(l && { amount: l.amount, lunch: l.lunch }, { amount: 10, lunch: true });
  assert.equal(st.biggest[0].amount, Math.max(...all().map(r => dollarsIn(r, 'me') ?? -Infinity)));
});

test('a lunch round with no money bet of yours has no dollars for you', () => {
  const r = round('l2', 'skins', ['me', 'mike', 'sam'], {}, { extra: { playFor: LUNCH } });
  const withBet = setBetWinner(addBet(r, { id: 'B', kind: 'custom', sides: ['mike', 'sam'], stake: 5, playFor: 'money' }), 'B', 1, 'mike');
  assert.equal(dollarsIn(withBet, 'me'), null);
  assert.equal(dollarsIn(withBet, 'mike'), tabResults(withBet).balances.mike);
  assert.ok(!gameParts(withBet, 'me').some(p => p.key === 'bets'));
  assert.equal(deepStats(stateOf([withBet])).dollars.rounds, 0);
});

test('watched rounds, unfinished rounds and other people’s rounds are left out', () => {
  const watched = round('w', 'skins', ['mike', 'sam'], { 1: { mike: 3 } });
  const live = { ...skinsA(), id: 'live', status: 'active' };
  const st = deepStats(stateOf([watched, live]));
  assert.equal(st.rounds, 0);
  assert.deepEqual(st.games, []);
  assert.equal(st.skins.best, null);
  assert.equal(seatIn(watched, stateOf([watched])), null);
});

test('a seat you took on another phone’s round counts as you', () => {
  const r = { ...skinsA(), localMe: 'me2', players: skinsA().players.map(p => (p.id === 'me' ? { ...p, id: 'me2' } : p)) };
  r.scores = Object.fromEntries(Object.entries(r.scores).map(([no, s]) => [no, Object.fromEntries(Object.entries(s).map(([k, v]) => [k === 'me' ? 'me2' : k, v]))]));
  const st = deepStats(stateOf([r]));
  assert.equal(st.rounds, 1);
  assert.equal(st.skins.won, 2);
});

test('the rounds in a range decide the stats (History’s time control)', () => {
  const state = stateOf(all());
  const sept = roundsInRange(state, { kind: 'month', year: 2026, month: 8 });
  const st = deepStats(state, sept);
  assert.equal(st.rounds, 4);
  assert.equal(st.points.rounds, 0);
  assert.ok(!st.games.some(g => g.key === 'bets'));
});

test('All time is a range that never steps', () => {
  const allTime = rangeOfKind('all', { kind: 'season', year: 2026 });
  assert.deepEqual(allTime, { kind: 'all' });
  assert.deepEqual(rangeBounds(allTime), [-Infinity, Infinity]);
  assert.equal(rangeLabel(allTime), 'All time');
  assert.equal(shiftRange(allTime, -1), allTime);
  assert.equal(isLatest(allTime), true);
  assert.equal(roundsInRange(stateOf(all()), allTime).length, 6);
  // From All time back to a season or month lands on now
  assert.equal(rangeOfKind('season', allTime, new Date(2026, 9, 3)).year, 2026);
  assert.equal(rangeOfKind('month', allTime, new Date(2026, 9, 3)).month, 9);
});

test('best of: the most dollars won, else the best record over two rounds or more', () => {
  const st = deepStats(stateOf(all()));
  const best = bestOf(st.games);
  assert.equal(best.by, 'dollars');
  assert.equal(best.line.dollars.net, Math.max(...st.games.map(g => g.dollars.net)));
  const line = (key, rounds, won, lost) => ({ key, name: key, rounds, record: { won, lost, even: rounds - won - lost }, dollars: { net: 0, rounds: 0 }, points: { net: 0, rounds: 0 } });
  assert.deepEqual(bestOf([line('a', 1, 1, 0), line('b', 3, 2, 1), line('c', 4, 2, 2)]), { line: line('b', 3, 2, 1), by: 'record' });
  assert.equal(bestOf([line('a', 1, 1, 0)]), null);
  assert.equal(bestOf([]), null);
});

test('reading stats never changes a round', () => {
  const rounds = all();
  const before = JSON.stringify(rounds);
  const money = rounds.map(r => JSON.stringify(roundResults(r).balances));
  deepStats(stateOf(rounds));
  assert.equal(JSON.stringify(rounds), before);
  assert.deepEqual(rounds.map(r => JSON.stringify(roundResults(r).balances)), money);
});

test('how the stats read: skins, amounts, records and presses', async () => {
  const { lineAmount, lineSub, pressText, skinsText } = await import('./deep-stats.js');
  const { money } = await import('./golf.js');
  const { points } = await import('./play-for.js');
  const fmt = { money, points };
  assert.deepEqual([4, 4.5, 0.5, 4 / 3].map(skinsText), ['4', '4½', '½', '1.3']);
  const st = deepStats(stateOf(all()));
  const g = Object.fromEntries(st.games.map(l => [l.key, l]));
  assert.deepEqual(lineAmount(g.bets, fmt), { text: '+$10', tone: 'pos', unit: 'dollars' });
  const ptsOnly = { ...g.skins, dollars: { net: 0, rounds: 0 } };
  assert.equal(lineAmount(ptsOnly, fmt).unit, 'points');
  assert.match(lineAmount(ptsOnly, fmt).text, /pts?$/);
  assert.equal(lineAmount({ ...ptsOnly, points: { net: 0, rounds: 0 } }, fmt).text, '–');
  // Skins mixes money and points, so it says how the points went
  assert.match(lineSub(g.skins, fmt), /^4 rounds · \d–\d(–\d)? · .+ in 2 for points$/);
  assert.equal(lineSub(g.nassau, fmt), '2 rounds · 1–1');
  assert.equal(pressText({ won: 2, lost: 0, halved: 1 }), '2 won, 1 halved');
  assert.equal(pressText({ won: 0, lost: 0, halved: 0 }), 'None yet');
  assert.equal(pressText({ won: 0, lost: 3, halved: 0 }), '0 won, 3 lost');
});

test('the best line in a few words', async () => {
  const { bestText } = await import('./deep-stats.js');
  const { money } = await import('./golf.js');
  const line = { name: 'Nassau', rounds: 4, record: { won: 3, lost: 1, even: 0 }, dollars: { net: 40, rounds: 4 }, points: { net: 0, rounds: 0 } };
  assert.equal(bestText({ line, by: 'dollars' }, money), 'Nassau, +$40');
  assert.equal(bestText({ line, by: 'record' }, money), 'Nassau, 3–1');
  assert.equal(bestText({ line: { ...line, record: { won: 2, lost: 1, even: 1 } }, by: 'record' }, money), 'Nassau, 2–1–1');
  assert.equal(bestText(null, money), '–');
});
