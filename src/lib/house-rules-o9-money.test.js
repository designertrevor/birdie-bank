// Money review of the house rules added 2026-10-05 (overnight 9): the bye, Sixes' auto press and
// Hammer's halved-hole carry checked against a plain worked-out version of each rule over thousands of
// seeded holes, and a team quota round with carried quotas pays the same on a second phone that rebuilt
// it from the server's records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { assemble, buildHoles, buildMeta } from './sync-model.js';

const course = n => ({ id: `c${n}`, name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const sum = a => a.reduce((x, v) => x + v, 0);
function mk(game, ids, holes, rules, teams = null) {
  return createRound({
    id: 'r', game, course: course(holes), holesCount: holes, nine: 'front', players: ids.map(id => ({ id, name: id.toUpperCase(), index: 0 })),
    settings: { hcPct: 100, [game]: rules }, hcPct: 100, useHandicaps: false, teams,
  });
}
// A hole's result for the first side: 1 won, -1 lost, 0 halved
const result = (rnd, lean = 0.4) => { const x = rnd(); return x < lean ? 1 : x < 0.8 ? -1 : 0; };

test('the bye, worked out by hand on thousands of matches: the main match, then the holes left after it closed', () => {
  const rnd = seeded(505);
  for (let t = 0; t < 1500; t++) {
    const holes = rnd() < 0.5 ? 9 : 18;
    const res = Array.from({ length: rnd() < 0.7 ? holes : Math.floor(rnd() * (holes + 1)) }, () => result(rnd, rnd() * 0.7));
    const bye = ['off', 'half', 'full'][Math.floor(rnd() * 3)];
    const r = mk('match', ['a', 'b'], holes, { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best', bye }, [['a'], ['b']]);
    res.forEach((x, i) => { r.scores[r.holes[i].no] = { a: x === 1 ? 3 : 4, b: x === -1 ? 3 : 4 }; });
    let up = 0, closed = -1;
    res.forEach((x, i) => { up += x; if (closed < 0 && Math.abs(up) > holes - (i + 1)) closed = i + 1; });
    let want = sign(up) * 10;
    if (bye !== 'off' && closed > 0 && closed < holes) want += sign(sum(res.slice(closed))) * (bye === 'half' ? 5 : 10);
    assert.equal(roundResults(r).balances.a, want, `${bye} ${JSON.stringify(res)}`);
  }
});

test('sixes auto press, worked out by hand: 2 down in the newest bet starts another, unless it is closed', () => {
  const rnd = seeded(606);
  const pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  const ids = ['a', 'b', 'c', 'd'];
  for (let t = 0; t < 1500; t++) {
    const holes = rnd() < 0.3 ? 9 : 18;
    const len = holes / 3;
    const res = Array.from({ length: rnd() < 0.7 ? holes : Math.floor(rnd() * (holes + 1)) }, () => result(rnd));
    const r = mk('sixes', ids, holes, { stake: 5, mode: 'match', carry: false, teamScore: 'best', press: true });
    res.forEach((x, i) => {
      const [a, b] = pairs[Math.floor(i / len)];
      r.scores[r.holes[i].no] = Object.fromEntries(ids.map((id, k) => [id, (x === 1 && a.includes(k)) || (x === -1 && b.includes(k)) ? 3 : 4]));
    });
    const want = [0, 0, 0, 0];
    for (let m = 0; m < 3; m++) {
      const from = m * len, to = from + len, last = Math.min(to, res.length);
      if (last <= from) continue;
      const starts = [from];
      for (let i = from; i < last && i < to - 1; i++) {
        const down = sum(res.slice(starts.at(-1), i + 1));
        if (Math.abs(down) >= 2 && Math.abs(down) <= to - (i + 1)) starts.push(i + 1);
      }
      const net = sum(starts.map(s => sign(sum(res.slice(s, last))) * 5));
      for (const k of pairs[m][0]) want[k] += net;
      for (const k of pairs[m][1]) want[k] -= net;
    }
    const got = roundResults(r).balances;
    assert.deepEqual(ids.map(id => got[id]), want, JSON.stringify(res));
  }
});

test('hammer halved holes carry, worked out by hand: the value rides on, a win or a fold resets it', () => {
  const rnd = seeded(707);
  for (let t = 0; t < 1500; t++) {
    const r = mk('hammer', ['a', 'b'], 9, { stake: 5, max: 3, who: 'either', birdie: false, carry: true });
    let carry = 0, want = 0;
    for (let i = 0, n = Math.floor(rnd() * 10); i < n; i++) {
      const x = result(rnd, 0.35);
      const hammers = [];
      while (hammers.length < 3 && rnd() < 0.4) hammers.push(hammers.length % 2);
      const conceded = hammers.length && rnd() < 0.2 ? 1 - hammers.at(-1) : null;
      const no = r.holes[i].no;
      r.scores[no] = { a: x === -1 ? 4 : x === 1 ? 3 : 4, b: x === -1 ? 3 : 4 };
      r.marks[no] = { hammers, conceded };
      const base = 5 + carry;
      if (conceded != null) { want += (conceded === 1 ? 1 : -1) * base * 2 ** (hammers.length - 1); carry = 0; continue; }
      const value = base * 2 ** hammers.length;
      if (x === 0) carry = value;
      else { want += x * value; carry = 0; }
    }
    assert.equal(roundResults(r).balances.a, want, JSON.stringify(r.marks));
  }
});

test('a team quota round with carried quotas pays the same on a second phone rebuilt from the server', () => {
  const r = mk('quota', ['a', 'b', 'c', 'd', 'e'], 9, { stake: 10, payout: 'pot', nassau: false, minus: false, split: 'top', table: 'stableford', adjust: 'half', team: true }, [['a', 'b', 'c'], ['d', 'e']]);
  r.quotas = { a: 20, d: 16 };
  r.holes.forEach((h, i) => { r.scores[h.no] = { a: 4, b: i === 0 ? 3 : 4, c: 5, d: 4, e: i < 2 ? 3 : 4 }; });
  r.status = 'done';
  const here = roundResults(r);
  const there = roundResults(assemble(JSON.parse(JSON.stringify(buildMeta(r))), JSON.parse(JSON.stringify(buildHoles(r)))));
  assert.deepEqual(there.balances, here.balances);
  assert.deepEqual(there.pairs, here.pairs);
  assert.deepEqual(there.detail.teamQuota, here.detail.teamQuota);
  // Team one: a -2 against 20, b +1, c -9 (nine bogeys) is -10; team two: d +2 against 16, e +2 is +4
  assert.deepEqual(here.detail.teamQuota.map(t => t.over), [-10, 4]);
  assert.deepEqual(here.balances, { a: -10, b: -10, c: -10, d: 15, e: 15 });
});
