// A crew's hall of fame: the season's money list matches the crew's tab to the cent, one person is
// one row, points and reward rounds never add into the money, and the records read the rounds as they are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabResults } from './play-for.js';
import { crewKey, tabOf, tabsOf } from './crew-tabs.js';
import { closeBooks, closePreview, lineKey, openRounds, seasonTotals } from './books.js';
import { applyRows } from './shared-tab.js';
import { mergePeople } from './people-links.js';
import { NOW, OCT, base, skins } from './crew-tabs.fixtures.js';
import { o9Rounds } from './o9-money.fixtures.js';
import { crewHall, crewRounds, crewSeason, hallCrews } from './hall-of-fame.js';

const SAT = crewKey('sat');
/** The money list as { id: cents }, zeros left out. */
const listCents = season => Object.fromEntries(season.money.filter(r => r.cents).map(r => [r.id, r.cents]));

test('the money list adds up to the crew’s tab, person by person, to the cent', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 'a'], [3, 't'], [4, 'b'], [5, 't']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(5), skin: 5 });
  const guest = skins('r3', ['t', 'a', 'c'], [[1, 'c']], { at: OCT(6) });
  const s = base([r1, r2, guest]);
  const season = crewSeason(s, 'sat', { now: NOW });
  assert.deepEqual(listCents(season), tabOf(s, SAT, { now: NOW }).balances);
  assert.deepEqual(season.money.filter(r => r.cents).map(r => ({ id: r.id, cents: r.cents })), seasonTotals(s, openRounds(s, SAT, { now: NOW })));
  assert.equal(season.rounds, 2, 'the guest’s round is on Other rounds, not the crew’s');
  const a = season.money.find(r => r.id === 'a');
  assert.deepEqual([a.rounds, a.wins], [2, 1]);
  assert.equal(season.money.find(r => r.id === 't').wins, 1);
  assert.deepEqual(season.mostWins, { ids: ['a', 't'], wins: 1 });
  assert.equal(season.champion.id, season.money[0].id);
});

test('a payment changes the crew’s tab but not the money list: it is what was won, before anything was paid', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'b']], { at: OCT(3) });
  const s = base([r1]);
  const before = crewSeason(s, 'sat', { now: NOW });
  const paid = { ...s, settlements: [{ id: 'p1', from: 'a', to: 't', amount: 4, at: OCT(4), tab: SAT }] };
  const tab = tabOf(paid, SAT, { now: NOW }).balances;
  assert.deepEqual(crewSeason(paid, 'sat', { now: NOW }), before);
  // The tab plus what was paid on it is the money list again
  const back = { ...tab };
  back.a = (back.a || 0) - 400; back.t = (back.t || 0) + 400;
  for (const k of Object.keys(back)) if (!back[k]) delete back[k];
  assert.deepEqual(back, listCents(before));
});

test('every seeded round of every game matches the crew’s tab exactly', () => {
  const ids = new Set();
  const rounds = [];
  let i = 0;
  for (const { round } of o9Rounds()) {
    // Rounds stopped partway count as finished here: their money is what the Tab would have
    const r = structuredClone(round);
    r.status = 'done';
    r.id = `o9_${i}`;
    r.finishedAt = OCT(1) + i++ * 60e3;
    for (const p of r.players) ids.add(p.id);
    rounds.push(r);
  }
  assert.ok(rounds.length > 100);
  const s = { ...base(rounds), me: 'phone', crews: { all: { id: 'all', name: 'Everybody', playerIds: [...ids] } } };
  const season = crewSeason(s, 'all', { now: NOW });
  const want = {};
  for (const r of rounds) for (const [id, v] of Object.entries(tabResults(r).balances)) want[id] = (want[id] || 0) + Math.round(v * 100);
  for (const k of Object.keys(want)) if (!want[k]) delete want[k];
  assert.deepEqual(listCents(season), want);
  assert.deepEqual(listCents(season), tabsOf(s, { now: NOW }).tabs.find(t => t.key === crewKey('all')).balances);
  assert.equal(season.money.reduce((a, r) => a + r.cents, 0), 0, 'what one wins another loses');
});

test('one person is one row: a merged duplicate’s rounds add into the kept player', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 'a'], [2, 'a']], { at: OCT(3) });
  // The same Adam, saved again as a2 on this phone
  const r2 = skins('r2', ['t', 'a2', 'b'], [[1, 'a2'], [2, 'b']], { at: OCT(5) });
  let s = base([r1, r2]);
  s.players.a2 = { id: 'a2', name: 'A2' };
  assert.equal(crewRounds(s, 'sat', { now: NOW }).length, 1, 'before the merge a2 is a guest');
  s = { ...s, ...mergePeople(s, 'a', 'a2') };
  const season = crewSeason(s, 'sat', { now: NOW });
  assert.deepEqual(season.money.map(r => r.id).sort(), ['a', 'b', 't']);
  const a = season.money.find(r => r.id === 'a');
  assert.deepEqual([a.rounds, a.wins], [2, 2]);
  assert.equal(a.cents, Math.round((tabResults(r1).balances.a + tabResults(r2).balances.a2) * 100));
  assert.deepEqual(listCents(season), tabOf(s, SAT, { now: NOW }).balances);
  const hall = crewHall(s, 'sat', { now: NOW });
  assert.deepEqual(hall.records.streak, { id: 'a', n: 2 });
  assert.ok(hall.biggestWins.every(w => w.id !== 'a2'));
});

test('points and reward rounds are listed on their own and never add into the money', () => {
  const money = skins('r1', ['t', 'a', 'b'], [[1, 't']], { at: OCT(3) });
  const pts = skins('r2', ['t', 'a', 'b'], [[1, 'b'], [2, 'b']], { at: OCT(4) });
  pts.playFor = { kind: 'points' };
  const lunch = skins('r3', ['t', 'a', 'b'], [[1, 'a']], { at: OCT(5) });
  lunch.playFor = { kind: 'reward', reward: 'Lunch', owes: 'last' };
  const s = base([money, pts, lunch]);
  const season = crewSeason(s, 'sat', { now: NOW });
  assert.deepEqual(listCents(season), listCents(crewSeason(base([money]), 'sat', { now: NOW })));
  assert.deepEqual(listCents(season), tabOf(s, SAT, { now: NOW }).balances);
  assert.equal(season.rounds, 1);
  assert.equal(season.points[0].id, 'b');
  assert.equal(season.points[0].points, tabResults({ ...pts, playFor: null }).balances.b);
  assert.deepEqual(season.rewards.names, ['Lunch']);
  assert.deepEqual(season.rewards.rows[0], { id: 'a', won: 1, rounds: 1 });
  // Points never become a biggest win
  const hall = crewHall(s, 'sat', { now: NOW });
  assert.ok(hall.biggestWins.every(w => w.roundId === 'r1'));
});

test('the season is the rounds since the books closed; the hall keeps the closed season’s champion', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 'b'], [2, 'b'], [3, 'b']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a', 'b'], [[1, 't']], { at: OCT(12) });
  let s = base([r1]);
  const prev = closePreview(s, SAT, { now: OCT(10) });
  const res = closeBooks(s, SAT, { picks: Object.fromEntries(prev.lines.map(l => [lineKey(l), 'paid'])), now: OCT(10), makeId: () => 'x' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows);
  s = { ...s, books: { [res.book.id]: res.book }, rounds: { ...s.rounds, r2 } };
  const season = crewSeason(s, 'sat', { now: NOW });
  assert.equal(season.rounds, 1);
  assert.equal(season.since, OCT(10));
  assert.equal(season.champion.id, 't');
  const hall = crewHall(s, 'sat', { now: NOW });
  assert.equal(hall.seasons.length, 1);
  assert.equal(hall.seasons[0].champion.id, 'b');
  assert.equal(hall.biggestWins[0].id, 'b');
  assert.equal(hall.biggestWins[0].roundId, 'r1');
  assert.equal(hall.rounds, 2);
});

test('records: the longest run of wins, the most skins in a round, the low round and the regular', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(1) });
  const r2 = skins('r2', ['t', 'a', 'b'], [[1, 'a']], { at: OCT(2) });
  const r3 = skins('r3', ['t', 'b'], [[1, 'b']], { at: OCT(3) });
  const r4 = skins('r4', ['t', 'a', 'b'], [[1, 'a']], { at: OCT(4) });
  const r5 = skins('r5', ['t', 'a', 'b'], [[1, 'b']], { at: OCT(5) });
  const s = base([r1, r2, r3, r4, r5]);
  const { records } = crewHall(s, 'sat', { now: NOW });
  assert.deepEqual(records.streak, { id: 'a', n: 3 }, 'a round a missed doesn’t break the run');
  assert.equal(records.skins.id, 'a');
  assert.equal(records.skins.skins, 3);
  assert.equal(records.low.id, 'a');
  assert.equal(records.low.strokes, 33);
  assert.equal(records.low.holes, 9);
  assert.equal(records.regular.id, 'b');
  assert.equal(records.regular.n, 5);
});

test('no rounds, no records; only crews with something to show get a hall of fame', () => {
  const s = base([]);
  const hall = crewHall(s, 'sat', { now: NOW });
  assert.deepEqual(hall.biggestWins, []);
  assert.deepEqual(hall.records, { streak: null, skins: null, low: null, regular: null });
  assert.equal(crewSeason(s, 'sat', { now: NOW }).champion, null);
  assert.deepEqual(hallCrews(s, { now: NOW }), []);
  assert.deepEqual(hallCrews(base([skins('r1', ['t', 'a'], [], { at: OCT(1) })]), { now: NOW }).map(c => c.id), ['sat']);
});
