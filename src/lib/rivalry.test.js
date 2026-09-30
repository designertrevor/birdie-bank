// Rivalry cards: you against one friend, all time, and your nemesis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { headToHeadSummary, outstanding, personStory, recordText, tabWith } from './ledger.js';
import { headToHead } from './history.js';
import { NEMESIS_LINES, leftEarly, nemesis, nemesisLine, rivalry, seriesLine, streakLine } from './rivalry.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: false }, stroke: { stake: 5, payout: 'pot' } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: { me: 'Me', b: 'Bo Diddley', c: 'Cy', d: 'Di', zb: 'Bo D' }[id] || id.toUpperCase(), index: 0 }));

/** A finished 9-hole skins round, finished at `t`, every hole halved except the ones given. */
function round(id, ids, holes = {}, { t = 1000, game = 'skins', playFor } = {}) {
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = t;
  if (playFor) r.playFor = playFor;
  return r;
}
/** Hole 1 to whoever is named (one skin, $2 from each other player), the rest halved. */
const win = (who, ids) => ({ 1: Object.fromEntries(ids.map(p => [p, p === who ? 3 : 4])) });
const state = (rounds, extra = {}) => ({ me: 'me', players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], ...extra });
const ME = new Set(['me']);

test('no rounds together: nothing to show, no nemesis', () => {
  const s = state([round('r1', ['me', 'c'], win('me', ['me', 'c']))]);
  const rv = rivalry(s, ME, 'b');
  assert.equal(rv.rounds, 0);
  assert.equal(rv.net, 0);
  assert.equal(rv.streak, null);
  assert.equal(rv.best, null);
  assert.equal(rv.worst, null);
  assert.equal(rv.first, null);
  assert.equal(rv.last, null);
  assert.equal(streakLine(rv.streak, 'Bo'), null);
  assert.equal(nemesis(state([]), ME), null);
});

test('record, streak, biggest win and loss, first and last', () => {
  const ids = ['me', 'b', 'c'];
  const rounds = [
    round('r1', ids, win('b', ids), { t: 100 }), // lost 2
    round('r2', ['me', 'b'], { 1: { me: 3, b: 4 }, 2: { me: 3, b: 4 }, 3: { me: 3, b: 4 } }, { t: 200 }), // won 6
    round('r3', ids, win('c', ids), { t: 300 }), // even with Bo (both paid Cy)
    round('r4', ids, win('me', ids), { t: 400 }), // won 2
    round('r5', ['me', 'b'], win('me', ['me', 'b']), { t: 500 }), // won 2
  ];
  const rv = rivalry(state(rounds), ME, 'b');
  assert.deepEqual([rv.rounds, rv.won, rv.lost, rv.even, rv.net], [5, 3, 1, 1, 8]);
  assert.deepEqual(rv.rows.map(r => [r.id, r.amount, r.result]), [['r5', 2, 'won'], ['r4', 2, 'won'], ['r3', 0, 'even'], ['r2', 6, 'won'], ['r1', -2, 'lost']]);
  assert.deepEqual(rv.streak, { result: 'won', count: 2 });
  assert.equal(rv.best.id, 'r2');
  assert.equal(rv.best.amount, 6);
  assert.equal(rv.worst.id, 'r1');
  assert.equal(rv.first.id, 'r1');
  assert.equal(rv.last.id, 'r5');
  assert.equal(rv.moneyRounds, 5);
  assert.equal(rv.otherRounds, 0);
  assert.equal(streakLine(rv.streak, 'Bo Diddley'), 'You’ve won the last 2');
  assert.equal(seriesLine(rv, 'Bo Diddley'), 'You lead 3–1');
});

test('biggest win: two equal wins, the newest one shows', () => {
  const ids = ['me', 'b'];
  const rv = rivalry(state([round('r1', ids, win('me', ids), { t: 100 }), round('r2', ids, win('me', ids), { t: 200 })]), ME, 'b');
  assert.equal(rv.best.id, 'r2');
  assert.equal(rv.worst, null);
});

test('points and reward rounds count in the record and the streak, never in dollars', () => {
  const ids = ['me', 'b'];
  const rounds = [
    round('r1', ids, win('b', ids), { t: 100 }), // lost $2
    round('r2', ids, { 1: { me: 3, b: 4 }, 2: { me: 3, b: 4 }, 3: { me: 3, b: 4 }, 4: { me: 3, b: 4 } }, { t: 200, playFor: { kind: 'points' } }),
    round('r3', ids, win('me', ids), { t: 300, playFor: { kind: 'reward', reward: 'Lunch' } }),
  ];
  const rv = rivalry(state(rounds), ME, 'b');
  assert.deepEqual([rv.rounds, rv.won, rv.lost], [3, 2, 1]);
  assert.equal(rv.net, -2, 'only the money round');
  assert.deepEqual(rv.streak, { result: 'won', count: 2 });
  assert.equal(rv.best, null, 'an 8 point win is not a biggest win in dollars');
  assert.equal(rv.worst.id, 'r1');
  assert.equal(rv.moneyRounds, 1);
  assert.equal(rv.otherRounds, 2);
});

test('ties: even rounds make an even streak, and an even series is all square', () => {
  const ids = ['me', 'b'];
  const rounds = [
    round('r1', ids, win('me', ids), { t: 100 }),
    round('r2', ids, win('b', ids), { t: 200 }),
    round('r3', ids, {}, { t: 300 }),
    round('r4', ids, {}, { t: 400 }),
  ];
  const rv = rivalry(state(rounds), ME, 'b');
  assert.deepEqual([rv.won, rv.lost, rv.even, rv.net], [1, 1, 2, 0]);
  assert.deepEqual(rv.streak, { result: 'even', count: 2 });
  assert.equal(streakLine(rv.streak, 'Bo'), 'The last 2 were even');
  assert.equal(seriesLine(rv, 'Bo'), 'All square 1–1');
  assert.equal(recordText(rv), '1–1–2');
  assert.equal(streakLine({ result: 'lost', count: 1 }, 'Bo Diddley'), 'Bo took the last one');
  assert.equal(streakLine({ result: 'lost', count: 4 }, 'Bo'), 'Bo has won the last 4');
  assert.equal(seriesLine({ won: 1, lost: 3 }, 'Bo Diddley'), 'Bo leads 3–1');
});

test('left early: the round counts on the holes you both played, and the row says who left', () => {
  const ids = ['me', 'b', 'c'];
  const r = round('r1', ids, {
    1: { me: 4, b: 3, c: 4 }, // Bo wins a skin from you
    2: { me: 4, b: 5, c: 4 },
    3: { me: 3, c: 4 }, 4: { me: 3, c: 4 }, // after Bo left: only you and Cy
  });
  r.left = { b: 2 };
  for (const h of r.holes.slice(2)) delete r.scores[h.no].b;
  const s = state([r]);
  const rv = rivalry(s, ME, 'b');
  assert.equal(rv.rows[0].left, 'them');
  assert.equal(rv.leftEarly, 1);
  assert.equal(rv.net, roundResults(r).pairs.me.b, 'the round pairs, holes after he left square');
  assert.equal(rv.net, -2);
  assert.equal(leftEarly(r, s, ME, 'c'), null);
  const r2 = round('r2', ['me', 'b', 'c'], {});
  r2.left = { me: 4, b: 5 };
  assert.equal(leftEarly(r2, state([r2]), ME, 'b'), 'both');
  r2.left = { me: 0 };
  assert.equal(leftEarly(r2, state([r2]), ME, 'b'), 'you');
});

test('a watched round is not a round together', () => {
  const r = round('r1', ['c', 'b'], win('b', ['c', 'b']));
  assert.equal(rivalry(state([r]), ME, 'b').rounds, 0);
});

test('one friend with two ids is one rival, and you with two ids are one you', () => {
  const r1 = round('r1', ['me', 'b'], win('me', ['me', 'b']), { t: 100 });
  const r2 = round('r2', ['me', 'zb'], win('zb', ['me', 'zb']), { t: 200 });
  const r3 = round('r3', ['seat', 'zb'], win('zb', ['seat', 'zb']), { t: 300 });
  r3.localMe = 'seat';
  const s = state([r1, r2, r3], { players: { b: { id: 'b', name: 'Bo Diddley' } }, links: { zb: 'b' } });
  const mine = new Set(['me', 'seat']);
  const a = rivalry(s, mine, 'b'), z = rivalry(s, mine, 'zb');
  assert.deepEqual([a.rounds, a.won, a.lost, a.net], [3, 1, 2, -2]);
  assert.deepEqual([z.rounds, z.won, z.lost, z.net], [a.rounds, a.won, a.lost, a.net]);
  assert.deepEqual(a.streak, { result: 'lost', count: 2 });
  const n = nemesis(s, mine);
  assert.equal(n.id, 'b');
  assert.equal(n.net, -2);
});

test('agrees with the story, the head to head on Players and History, and the Tab', () => {
  const ids = ['me', 'b', 'c', 'd'];
  const rounds = [
    round('r1', ids, { 1: { me: 3, b: 4, c: 4, d: 4 }, 2: { me: 4, b: 3, c: 4, d: 4 }, 3: { me: 4, b: 3, c: 4, d: 4 } }, { t: 100 }),
    round('r2', ['me', 'b', 'c'], { 1: { me: 4, b: 4, c: 3 }, 5: { me: 3, b: 5, c: 4 } }, { t: 200 }),
    round('r3', ['me', 'b'], win('b', ['me', 'b']), { t: 300, playFor: { kind: 'points' } }),
    round('r4', ['me', 'b', 'd'], { 7: { me: 5, b: 3, d: 5 } }, { t: 400, game: 'stroke' }),
    round('r5', ['me', 'b', 'c'], { 1: { me: 4, b: 3, c: 4 } }, { t: 500 }),
  ];
  rounds[4].left = { b: 3 };
  for (const h of rounds[4].holes.slice(3)) delete rounds[4].scores[h.no].b;
  const s = state(rounds);
  for (const other of ['b', 'c', 'd']) {
    const rv = rivalry(s, ME, other);
    const story = personStory(s, ME, other);
    const h = headToHeadSummary(s, ME).get(other);
    const hist = headToHead(Object.values(s.rounds), s)[other] || 0;
    assert.equal(rv.net, story.net, `${other}: story`);
    assert.equal(rv.net, h.net, `${other}: Players`);
    assert.equal(rv.net, hist, `${other}: History`);
    assert.deepEqual([rv.rounds, rv.won, rv.lost, rv.even], [h.rounds, h.won, h.lost, h.even], `${other}: record`);
    // Every money row adds up to the net, to the cent
    assert.equal(Math.round(rv.rows.filter(r => r.money).reduce((a, r) => a + r.amount * 100, 0)), Math.round(rv.net * 100));
  }
  // Just you and Bo: the Tab between you is the rivalry's money, less what's been paid
  const two = state([
    round('t1', ['me', 'b'], win('me', ['me', 'b']), { t: 100 }),
    round('t2', ['me', 'b'], { 1: { me: 3, b: 4 }, 2: { me: 3, b: 4 } }, { t: 200 }),
    round('t3', ['me', 'b'], win('b', ['me', 'b']), { t: 300 }),
    round('t4', ['me', 'b'], win('b', ['me', 'b']), { t: 400, playFor: { kind: 'points' } }),
  ]);
  const rv = rivalry(two, ME, 'b');
  assert.equal(rv.net, 4);
  assert.equal(tabWith(outstanding(two), ME, 'b'), rv.net);
  const paid = { ...two, settlements: [{ id: 's1', from: 'b', to: 'me', amount: 1.5, at: 500 }] };
  assert.equal(rivalry(paid, ME, 'b').net, 4, 'payments settle the Tab, never the all-time money');
  assert.equal(tabWith(outstanding(paid), ME, 'b'), 2.5);
});

test('nemesis: the friend you are down the most to, money rounds only', () => {
  const rounds = [
    round('r1', ['me', 'b'], win('b', ['me', 'b']), { t: 100 }), // -2 to Bo
    round('r2', ['me', 'c'], { 1: { me: 4, c: 3 }, 2: { me: 4, c: 3 } }, { t: 200 }), // -4 to Cy
    round('r3', ['me', 'd'], { 1: { me: 4, d: 3 }, 2: { me: 4, d: 3 }, 3: { me: 4, d: 3 } }, { t: 300, playFor: { kind: 'points' } }),
  ];
  const n = nemesis(state(rounds), ME);
  assert.equal(n.id, 'c');
  assert.equal(n.net, -4);
  assert.equal(n.name, 'Cy');
  assert.ok(NEMESIS_LINES.map(l => l.replaceAll('{n}', 'Cy')).includes(n.line));
  // Up on everyone: no nemesis
  assert.equal(nemesis(state([round('r1', ['me', 'b'], win('me', ['me', 'b']))]), ME), null);
  // A tie on money goes to more rounds together
  const tie = state([
    round('a1', ['me', 'b'], { 1: { me: 4, b: 3 }, 2: { me: 4, b: 3 } }, { t: 100 }),
    round('a2', ['me', 'c'], win('c', ['me', 'c']), { t: 200 }),
    round('a3', ['me', 'c'], win('c', ['me', 'c']), { t: 300 }),
  ]);
  assert.equal(nemesis(tie, ME).id, 'c');
});

test('nemesis line: steady for the same record, first name only, no em dashes', () => {
  assert.equal(nemesisLine('b', 'Bo Diddley', 3), nemesisLine('b', 'Bo Diddley', 3));
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const l = nemesisLine(`p${i}`, 'Bo Diddley', i);
    assert.ok(l.includes('Bo') && !l.includes('Diddley') && !l.includes('{n}') && !l.includes(String.fromCharCode(0x2014)));
    seen.add(l);
  }
  assert.ok(seen.size > 1, 'the lines vary');
});
