import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseHandicap, strokesOffLow, strokesOnHole, rankHoles, settleBankerHole, bankerFor,
  matchStatus, nassauResult, pressOpportunities, minimalTransfers, money,
} from './golf.js';

test('course handicap (WHS)', () => {
  assert.equal(courseHandicap(10, { rating: 72.0, slope: 113 }, 72), 10);
  assert.equal(courseHandicap(10.4, { rating: 70.1, slope: 125 }, 72), 10); // 11.5 - 1.9 = 9.6
  assert.equal(courseHandicap(null, { rating: 70, slope: 120 }, 72), null);
  assert.equal(courseHandicap(10, { rating: null, slope: null }, 72), null);
});

test('strokes off the low player', () => {
  assert.deepEqual(strokesOffLow([6, 2, 8]), [4, 0, 6]);
  assert.deepEqual(strokesOffLow([10, 20], 80), [0, 8]);
});

test('stroke allocation', () => {
  assert.equal(strokesOnHole(5, 5), 1);
  assert.equal(strokesOnHole(5, 6), 0);
  assert.equal(strokesOnHole(20, 1), 2);
  assert.equal(strokesOnHole(20, 3), 1);
  assert.equal(strokesOnHole(-2, 18), -1); // plus 2 gives back on the easiest holes
  assert.equal(strokesOnHole(-2, 17), -1);
  assert.equal(strokesOnHole(-2, 16), 0);
  assert.equal(strokesOnHole(3, 3, 9), 1);
  assert.equal(strokesOnHole(10, 1, 9), 2);
});

test('rank holes', () => {
  assert.deepEqual(rankHoles([7, 1, 17, 3]), [3, 1, 4, 2]);
});

test('banker hole: wins, losses, doubles, ties', () => {
  const ids = ['t', 'b', 'j', 'm'];
  const hole = { banker: 't', bets: { b: 5, j: 4, m: 5 }, doubled: { b: true }, doubleBack: true };
  const { deltas } = settleBankerHole(hole, { t: 4, b: 5, j: 4, m: 3 }, ids);
  // b loses 5×4=20, j pushes, m wins 5
  assert.deepEqual(deltas, { t: 15, b: -20, j: 0, m: 5 });
  const tiesBanker = settleBankerHole(hole, { t: 4, b: 5, j: 4, m: 3 }, ids, { ties: 'banker' }).deltas;
  assert.equal(tiesBanker.j, -4);
  const sum = Object.values(deltas).reduce((a, b) => a + b, 0);
  assert.equal(sum, 0);
});

test('banker rotation', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(bankerFor('rotate', 4, ids), 'b');
  assert.equal(bankerFor('fixed', 4, ids, 2), 'c');
  assert.equal(bankerFor('nine', 9, ids), 'b');
});

test('match status: dormie and closed out', () => {
  const w = { 1: 0, 2: 0, 3: 0, 4: 0, 5: null, 6: null, 7: null };
  const s = matchStatus(w, 1, 9);
  assert.equal(s.leader, 0); assert.equal(s.by, 4); assert.equal(s.left, 2);
  assert.equal(s.closed, true);
  const d = matchStatus({ 1: 1, 2: 1, 3: null, 4: null, 5: null, 6: null, 7: null }, 1, 9);
  assert.equal(d.dormie, true);
});

test('nassau result with a press', () => {
  const w = {};
  for (let h = 1; h <= 18; h++) w[h] = null;
  w[1] = 1; w[2] = 1; w[3] = 0; w[4] = 0; w[5] = 0; // front: p0 +1 overall; press from 3 p0 +3
  const presses = [{ id: 1, leg: 'front', start: 3, by: 0 }];
  const { net, lines } = nassauResult(w, presses, { front: 5, back: 5, total: 5 });
  assert.equal(lines.find(l => l.key === 'front').value, 5);
  assert.equal(lines.find(l => l.key === 'p1').value, 5);
  assert.equal(lines.find(l => l.key === 'back').value, 0);
  assert.equal(lines.find(l => l.key === 'total').value, 5);
  assert.equal(net, 15);
});

test('press opportunities', () => {
  const w = { 1: 1, 2: 1 };
  const ops = pressOpportunities(w, [], { front: 5, back: 5, total: 5 }, 3, 2);
  assert.deepEqual(ops.map(o => o.leg).sort(), ['front', 'total']);
  assert.equal(ops[0].trailing, 0);
  // already pressed front at 3 → only total remains
  const ops2 = pressOpportunities(w, [{ id: 1, leg: 'front', start: 3, by: 0 }], { front: 5, back: 5, total: 5 }, 3, 2);
  assert.deepEqual(ops2.map(o => o.leg), ['total']);
});

test('minimal transfers', () => {
  const t = minimalTransfers({ t: 29, b: -20, j: -4, m: -5 });
  assert.equal(t.length, 3);
  assert.equal(t.reduce((a, x) => a + x.amount, 0), 29);
  const t2 = minimalTransfers({ a: 10, b: -10, c: 5, d: -5 });
  assert.equal(t2.length, 2);
});

test('money formatting', () => {
  assert.equal(money(20), '$20');
  assert.equal(money(-4), '−$4');
  assert.equal(money(4.5, { sign: true }), '+$4.50');
  assert.equal(money(0, { sign: true }), '$0');
});

import { createRound, holesInPlay, roundResults, skinsTable, bankerHoleSetup } from './round.js';

const COURSE = {
  id: 'c', name: 'Test GC', city: 'X',
  holes: Array.from({ length: 18 }, (_, i) => ({ par: i % 3 === 0 ? 3 : 4, hdcp: [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18][i] })),
  tees: [{ name: 'Blue', rating: 70, slope: 120, yards: Array(18).fill(350) }],
};
const S = {
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true }, wolf: { point: 2, loneMultiplier: 2 },
};

test('holes in play: back nine and shotgun start', () => {
  const back = holesInPlay(COURSE, 9, 'back');
  assert.equal(back[0].no, 10); assert.equal(back.length, 9);
  assert.deepEqual(back.map(h => h.rank).sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9]);
  const sg = holesInPlay(COURSE, 18, 'front', 5);
  assert.equal(sg[0].no, 5); assert.equal(sg[17].no, 4);
});

test('nine-hole course played twice splits handicaps odd/even', () => {
  const nine = { ...COURSE, holes: COURSE.holes.slice(0, 9).map((h, i) => ({ ...h, hdcp: i + 1 })) };
  const h = holesInPlay(nine, 18);
  assert.equal(h.length, 18);
  assert.deepEqual(h.map(x => x.hdcp).sort((a, b) => a - b), Array.from({ length: 18 }, (_, i) => i + 1));
});

test('banker round end to end', () => {
  const players = [{ id: 'a', name: 'A', index: 0, tee: 'Blue' }, { id: 'b', name: 'B', index: 0, tee: 'Blue' }, { id: 'c', name: 'C', index: 0, tee: 'Blue' }];
  const r = createRound({ id: 'r', game: 'banker', course: COURSE, holesCount: 9, nine: 'front', players, settings: S, hcPct: 100 });
  const setup = bankerHoleSetup(r, 0);
  assert.equal(setup.banker, 'a');
  r.banker[1] = setup;
  r.scores[1] = { a: 4, b: 3, c: 5 };
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 0, b: 5, c: -5 });
  assert.equal(res.transfers.length, 1);
});

test('skins carry over', () => {
  const players = [{ id: 'a', name: 'A', index: 0 }, { id: 'b', name: 'B', index: 0 }, { id: 'c', name: 'C', index: 0 }];
  const r = createRound({ id: 'r', game: 'skins', course: COURSE, holesCount: 9, nine: 'front', players, settings: S, hcPct: 100 });
  r.scores[1] = { a: 4, b: 4, c: 5 };
  r.scores[2] = { a: 3, b: 4, c: 4 };
  const t = skinsTable(r);
  assert.equal(t.rows[1].skins, 2);
  assert.deepEqual(roundResults(r).balances, { a: 8, b: -4, c: -4 });
});

test('handicaps off the low player feed strokes', () => {
  const players = [{ id: 'a', name: 'A', index: 2, tee: 'Blue' }, { id: 'b', name: 'B', index: 12, tee: 'Blue' }];
  const r = createRound({ id: 'r', game: 'nassau', course: COURSE, holesCount: 18, players, settings: S, hcPct: 100 });
  assert.equal(r.players[0].plays, 0);
  assert.ok(r.players[1].plays >= 10 && r.players[1].plays <= 12);
});

import { outstanding } from './ledger.js';

test('ledger nets rounds and payments', () => {
  const players = [{ id: 'a', name: 'A', index: 0 }, { id: 'b', name: 'B', index: 0 }];
  const mk = (id, sc) => {
    const r = createRound({ id, game: 'nassau', course: COURSE, holesCount: 18, players, settings: S, hcPct: 100 });
    for (const h of r.holes) r.scores[h.no] = sc;
    r.status = 'done';
    return r;
  };
  const r1 = mk('r1', { a: 3, b: 4 }); // a wins all three: b owes a $15
  const r2 = mk('r2', { a: 5, b: 4 }); // b wins all three: a owes b $15
  let st = { rounds: { r1 }, settlements: [] };
  assert.deepEqual(outstanding(st).map(o => [o.from, o.to, o.amount]), [['b', 'a', 15]]);
  st = { rounds: { r1, r2 }, settlements: [] };
  assert.equal(outstanding(st).length, 0);
  st = { rounds: { r1 }, settlements: [{ from: 'b', to: 'a', amount: 10 }] };
  assert.deepEqual(outstanding(st).map(o => [o.from, o.to, o.amount]), [['b', 'a', 5]]);
});

test('9-hole nassau: first 4 / last 5 / all 9 by playing order', () => {
  const players = [{ id: 'a', name: 'A', index: 0 }, { id: 'b', name: 'B', index: 0 }];
  const r = createRound({ id: 'r', game: 'nassau', course: COURSE, holesCount: 9, nine: 'back', players, settings: S, hcPct: 100 });
  r.holes.forEach((h, i) => { r.scores[h.no] = i < 4 ? { a: 3, b: 4 } : { a: 5, b: 4 }; });
  const res = roundResults(r);
  const by = Object.fromEntries(res.detail.lines.map(l => [l.key, l.value]));
  assert.deepEqual(by, { front: 5, back: -5, total: -5 }); // a wins 4, b wins 5
  assert.equal(res.balances.a, -5);
});
