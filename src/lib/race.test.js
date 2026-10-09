import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { revealSteps, revealTiming } from './reveal.js';
import { movedUp, racePlan, raceFrame, raceOrders } from './race.js';

const SETTINGS = {
  nassau: { front: 5, back: 5, total: 10, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  nines: { point: 1 },
  stroke: { stake: 5 },
};
const course9 = {
  id: 'c9', name: 'Nine', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const players = [
  { id: 'a', name: 'Ann Lee', index: 10 },
  { id: 'b', name: 'Bo Diaz', index: 2 },
  { id: 'c', name: 'Cy Park', index: 5 },
  { id: 'd', name: 'Di Ono', index: 8 },
];
const mk = (game, n) => createRound({ id: 'r', game, course: course9, holesCount: 9, players: players.slice(0, n), settings: SETTINGS, hcPct: 100, useHandicaps: false });
const play = (r, rows) => rows.forEach((s, i) => { r.scores[i + 1] = s; });

/** The race the reveal runs for a round: its timing, lined up in the round's player order. */
function raceFor(r) {
  const res = roundResults(r);
  const t = revealTiming(revealSteps(r, res).steps.length, res.standings.length);
  return { res, t, plan: racePlan(res.standings, { start: r.players.map(p => p.id), ...t }) };
}

/** Rounds of each kind: money with a clear winner, money with a tie, points, and a skins tie for top. */
function rounds() {
  const skins = mk('skins', 4);
  // Di (last in the line-up) wins two skins, Bo one, Ann and Cy none
  play(skins, [{ a: 4, b: 4, c: 4, d: 3 }, { a: 4, b: 3, c: 4, d: 4 }, { a: 4, b: 4, c: 4, d: 3 }]);
  const tie = mk('skins', 3);
  play(tie, [{ a: 3, b: 4, c: 4 }, { a: 4, b: 3, c: 4 }]);
  const nassau = mk('nassau', 2);
  play(nassau, Array.from({ length: 9 }, (_, i) => ({ a: 4, b: i < 4 ? 3 : 4 })));
  const nines = mk('nines', 3);
  play(nines, [{ a: 5, b: 4, c: 3 }, { a: 5, b: 3, c: 4 }, { a: 4, b: 4, c: 3 }]);
  return { skins, tie, nassau, nines };
}

test('the board ends on roundResults exactly: the order, every amount and every place', () => {
  for (const [name, r] of Object.entries(rounds())) {
    const { res, t, plan } = raceFor(r);
    for (const at of [plan.end, t.landed, Infinity]) {
      const f = raceFrame(plan, at);
      assert.deepEqual(f.order, res.standings.map(p => p.id), `${name} order at ${at}`);
      // The amounts shown at the end are the results' own numbers, cents and all
      assert.deepEqual(f.order.map(id => f.rows[id].shown), res.standings.map(p => p.amount), `${name} amounts at ${at}`);
      assert.deepEqual(f.order.map(id => f.rows[id].place), res.standings.map(p => 1 + res.standings.filter(q => q.amount > p.amount).length), `${name} places`);
      assert.ok(f.done);
      assert.ok(Object.values(f.rows).every(x => x.phase === 'done'));
    }
  }
});

test('the race fits the reveal: it ends when the last total lands, never later', () => {
  for (const r of Object.values(rounds())) {
    const { t, plan } = raceFor(r);
    assert.equal(plan.end, t.landed);
  }
});

test('the rows line up in the round order, nothing counted and no places yet', () => {
  const { skins } = rounds();
  const { plan } = raceFor(skins);
  const f = raceFrame(plan, 0);
  assert.deepEqual(f.order, ['a', 'b', 'c', 'd']);
  assert.ok(Object.values(f.rows).every(x => x.shown === 0 && x.place === null && x.phase === 'wait'));
});

test('the winner races up from the back of the line-up and lands on top last', () => {
  const { skins } = rounds();
  const { res, plan } = raceFor(skins);
  const seq = raceOrders(plan);
  assert.deepEqual(seq[0].order, ['a', 'b', 'c', 'd']);
  assert.deepEqual(seq.at(-1).order, res.standings.map(p => p.id));
  assert.equal(res.standings[0].id, 'd');
  // Di takes the top spot in the last order change, after Bo has led for a while
  const firstTop = seq.findIndex(s => s.order[0] === 'd');
  assert.ok(seq.slice(0, firstTop).some(s => s.order[0] === 'b'), 'Bo leads before Di passes');
  assert.ok(seq.slice(firstTop).every(s => s.order[0] === 'd'), 'once on top, Di stays there');
  // Orders only change while totals are counting, and the times only go forward
  assert.ok(seq.every((s, i) => i === 0 || s.at > seq[i - 1].at));
  assert.ok(seq.at(-1).at <= plan.end);
});

test('ties: level rows keep the line-up while counting and take the results order once landed', () => {
  const { tie } = rounds();
  const { res, plan } = raceFor(tie);
  assert.equal(res.standings[0].amount, res.standings[1].amount);
  const f = raceFrame(plan, Infinity);
  assert.deepEqual(f.order, res.standings.map(p => p.id));
  assert.equal(f.rows[res.standings[0].id].place, 1);
  assert.equal(f.rows[res.standings[1].id].place, 1);
  // Results that list a tie the other way round than the line-up still end in the results' order
  const flipped = [res.standings[1], res.standings[0], res.standings[2]];
  const plan2 = racePlan(flipped, { start: ['a', 'b', 'c'], stepsEnd: 0, stagger: 100, count: 500 });
  assert.deepEqual(raceFrame(plan2, plan2.end).order, flipped.map(p => p.id));
});

test('points rounds race in points, the same way', () => {
  const { nines } = rounds();
  const { res, plan } = raceFor(nines);
  const seq = raceOrders(plan);
  assert.deepEqual(seq.at(-1).order, res.standings.map(p => p.id));
  const mid = raceFrame(plan, plan.lanes[0].delay + plan.lanes[0].duration / 2);
  assert.equal(mid.rows[res.standings[0].id].phase, 'count');
  assert.ok(Number.isInteger(mid.rows[res.standings[0].id].shown), 'whole numbers while counting');
});

test('all square: nobody moves', () => {
  const plan = racePlan([{ id: 'a', amount: 0 }, { id: 'b', amount: 0 }], { start: ['a', 'b'], stepsEnd: 0, stagger: 180, count: 1000 });
  const seq = raceOrders(plan);
  assert.equal(seq.length, 1);
  assert.deepEqual(raceFrame(plan, Infinity).rows.a, { value: 0, shown: 0, phase: 'done', place: 1 });
});

test('cents land exactly, not rounded', () => {
  const plan = racePlan([{ id: 'a', amount: 33.34 }, { id: 'b', amount: -16.67 }, { id: 'c', amount: -16.67 }], { start: ['c', 'b', 'a'], stepsEnd: 300, stagger: 120, count: 800 });
  const f = raceFrame(plan, plan.end);
  assert.deepEqual(f.order, ['a', 'b', 'c']);
  assert.deepEqual(f.order.map(id => f.rows[id].shown), [33.34, -16.67, -16.67]);
});

test('movedUp names the rows that passed someone', () => {
  assert.deepEqual(movedUp(['a', 'b', 'c'], ['c', 'a', 'b']), ['c']);
  assert.deepEqual(movedUp(['a', 'b'], ['a', 'b']), []);
});
