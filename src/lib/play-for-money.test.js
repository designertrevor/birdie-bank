// Play for, trying to break the money: a points or reward round must never move a dollar, end a
// carry, take a payment row or change any money figure, whatever else is on the phone. Includes a
// seeded sweep comparing a phone with only money rounds to the same phone with points and reward
// rounds mixed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, leftAt, roundResults } from './round.js';
import { countsMoney, rewardOutcome } from './play-for.js';
import { headToHeadSummary, outstanding, tabBalances, tabWith } from './ledger.js';
import { sharedDebts } from './pair-debts.js';
import { allocatePayment, applyRows, openTransfers, tabCodes } from './shared-tab.js';
import { cardCarry, rolled, sharedOwed } from './carry.js';
import { headToHead, monthGroups, myTab, netSeries, roundsInRange } from './history.js';
import { seasonBoard } from './season.js';
import { myIds, seasonStats } from './format.js';
import { moneyLine } from './hole-fix.js';
import { gamesLine } from './side-games.js';
import { points } from './play-for.js';

const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;
const course = n => ({ id: 'c', name: 'C', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) });
const SET = { hcPct: 100, nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2 }, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'per' } };
const PEOPLE = ['t', 's', 'd', 'a', 'b'];
const baseState = (rounds, extra = {}) => ({
  me: 't', players: Object.fromEntries(PEOPLE.map(id => [id, { id, name: id.toUpperCase() }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, crews: {}, customCourses: {}, favorites: [], settings: {}, ...extra,
});
function skinsRound(id, ids, winners, { daysAgo = 1, playFor, code } = {}) {
  const r = createRound({ id, game: 'skins', course: course(9), holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: structuredClone(SET), hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, winners[h.no] === p ? 3 : 4]));
  r.status = 'done';
  r.createdAt = NOW - daysAgo * DAY;
  r.finishedAt = r.createdAt + 1000;
  if (playFor) r.playFor = playFor;
  if (code) { r.shareCode = code; r.shared = { code }; }
  return r;
}

test('a points or reward round never ends a carry: only a money round together rolls it', () => {
  const owed = skinsRound('m1', ['t', 's'], { 1: 's', 2: 's' }, { daysAgo: 10, code: 'AAAAAA' });
  const carry = { id: 'c1', from: 't', to: 's', amount: 4, status: 'agreed', at: NOW - 9 * DAY, answeredAt: NOW - 9 * DAY };
  for (const playFor of [{ kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }]) {
    const later = skinsRound('p1', ['t', 's'], { 1: 't' }, { daysAgo: 2, playFor });
    const state = baseState([owed, later], { carries: [carry] });
    assert.equal(rolled(carry, state), false, playFor.kind);
    const card = { from: 't', to: 's', amount: 4 };
    assert.equal(cardCarry(state, 't', 's', card, NOW)?.id, 'c1', playFor.kind);
  }
  const money = skinsRound('m2', ['t', 's'], {}, { daysAgo: 2 });
  assert.equal(rolled(carry, baseState([owed, money], { carries: [carry] })), true);
});

test('a payment row on a points round (say from a phone on an older version) never becomes a payment', () => {
  const p = skinsRound('p1', ['t', 's'], { 1: 's', 2: 's' }, { code: 'PPPPPP', playFor: { kind: 'points' } });
  const m = skinsRound('m1', ['t', 's'], { 1: 's' }, { code: 'MMMMMM' });
  const state = baseState([p, m]);
  assert.deepEqual(tabCodes(state, { now: NOW }), ['MMMMMM']);
  const row = { code: 'PPPPPP', id: 'PPPPPP:t>s', kind: 'payment', from: 't', to: 's', amount: 4, status: 'paid', at: NOW, updatedAt: NOW };
  const next = applyRows(state, [row]);
  assert.deepEqual(next.settlements, []);
  assert.deepEqual(tabBalances(next), tabBalances(state));
  // A row on the money round still counts, as always
  const paid = applyRows(state, [{ ...row, code: 'MMMMMM', id: 'MMMMMM:t>s', amount: 2 }]);
  assert.equal(paid.settlements.length, 1);
  assert.ok(Object.values(tabBalances(paid)).every(v => Math.abs(v) < 0.005), 'square once paid');
});

test('fixing a hole in a points round recounts in points, a money round as before', () => {
  const r = skinsRound('p1', ['t', 's'], { 1: 's' }, { playFor: { kind: 'points' } });
  const after = structuredClone(r);
  after.scores[2] = { t: 3, s: 4 };
  assert.equal(moneyLine(r, after), 'Points recount: T +2 pts, S −2 pts');
  const m = { ...structuredClone(r), playFor: undefined };
  const mAfter = { ...structuredClone(after), playFor: undefined };
  assert.equal(moneyLine(m, mAfter), 'Money recounts: T +$2, S −$2');
});

test('the by-game line under each player reads in the round\'s unit', () => {
  const byGame = { main: { label: 'Nassau', balances: { t: 5 } }, skins: { label: 'Skins', balances: { t: -1 } } };
  assert.equal(gamesLine(byGame, 't'), 'Nassau +$5 · Skins −$1');
  assert.equal(gamesLine(byGame, 't', points), 'Nassau +5 pts · Skins −1 pt');
});

test('reward: a player who left before the first hole neither wins nor owes it', () => {
  const r = skinsRound('w1', ['t', 's', 'd'], { 1: 's', 2: 's', 3: 't' }, { playFor: { kind: 'reward', reward: 'A drink', owes: 'everyone' } });
  r.left = { d: 0 };
  const o = rewardOutcome(r, roundResults(r));
  assert.deepEqual(o.winners, ['s']);
  assert.deepEqual(o.owers, ['t']);
  // Everyone who played level: nobody's buying, even with the no-show on 0
  const flat = skinsRound('w2', ['t', 's', 'd'], {}, { playFor: { kind: 'reward', reward: 'Lunch', owes: 'everyone' } });
  flat.left = { d: 0 };
  assert.equal(rewardOutcome(flat, roundResults(flat)).text, 'All square. Nobody’s buying.');
});

// ---------------------------------------------------------------------------
// The sweep

function sweep(seed0, runs) {
  let seed = seed0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const mk = (i, money) => {
    const n = 2 + Math.floor(rnd() * 3);
    const ids = [...PEOPLE].sort(() => rnd() - 0.5).slice(0, n);
    if (!ids.includes('t') && rnd() < 0.8) ids[0] = 't';
    const joined = rnd() < 0.25 && ids.includes('t');
    const seat = x => (joined && x === 't' ? `seat${i}` : x);
    const holes = pick([9, 18]);
    const r = createRound({ id: `r${i}`, game: pick(['skins', 'stroke', 'nassau']), course: course(holes), holesCount: holes, players: ids.map(x => ({ id: seat(x), name: x.toUpperCase(), index: Math.floor(rnd() * 20) })), settings: structuredClone(SET), hcPct: 100, useHandicaps: rnd() < 0.5 });
    if (rnd() < 0.3) r.sideGames = [{ game: 'skins', settings: { value: 1, carryover: true } }];
    for (const h of r.holes) r.scores[h.no] = Object.fromEntries(r.players.map(p => [p.id, h.par - 1 + Math.floor(rnd() * 4)]));
    if (rnd() < 0.15 && n > 2) r.left = { [r.players[n - 1].id]: Math.floor(rnd() * holes) };
    r.status = rnd() < 0.9 ? 'done' : 'active';
    r.createdAt = NOW - Math.floor(rnd() * 60) * DAY;
    r.finishedAt = r.createdAt + 4 * 3600e3;
    if (joined) r.localMe = `seat${i}`;
    if (rnd() < 0.5) { r.shareCode = `C${String(i).padStart(5, '0')}`; r.shared = { code: r.shareCode }; }
    if (money) { const x = rnd(); if (x < 0.2) r.playFor = null; else if (x < 0.3) r.playFor = { kind: 'money' }; }
    else r.playFor = rnd() < 0.5 ? { kind: 'points' } : { kind: 'reward', reward: pick(['Lunch', 'A drink', 'Dinner']), owes: pick(['last', 'everyone']) };
    return r;
  };
  const out = [];
  for (let k = 0; k < runs; k++) {
    const money = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => mk(i, true));
    const others = Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => mk(100 + i, false));
    const settlements = [];
    for (let i = 0; i < Math.floor(rnd() * 4); i++) {
      const [f, t] = [...PEOPLE].sort(() => rnd() - 0.5);
      const r = pick(money);
      settlements.push({ id: `s${i}`, from: f, to: t, amount: Math.round(rnd() * 3000) / 100, at: NOW - Math.floor(rnd() * 30) * DAY, ...(r.shareCode && rnd() < 0.5 ? { code: r.shareCode, roundId: r.id } : {}) });
    }
    const carries = rnd() < 0.5 ? [{ id: 'c1', ...(rnd() < 0.5 ? { from: 't', to: pick(['s', 'd', 'a']) } : { from: pick(['s', 'd', 'a']), to: 't' }), amount: 5, status: pick(['agreed', 'asked', 'declined']), at: NOW - 20 * DAY, answeredAt: NOW - 19 * DAY }] : [];
    out.push({ moneyOnly: baseState(money, { settlements, carries }), mixed: baseState([...money, ...others], { settlements, carries }), others });
  }
  return out;
}

function moneyView(s) {
  const plan = outstanding(s, { now: NOW });
  const range = roundsInRange(s, { kind: 'season', year: 2026 });
  const board = seasonBoard(s, 2026);
  const stats = seasonStats(s, 2026);
  const pairs = {};
  for (const o of ['s', 'd', 'a', 'b']) {
    const card = tabWith(plan, myIds(s), o);
    const owed = card ? (card > 0 ? { from: o, to: 't', amount: card } : { from: 't', to: o, amount: -card }) : null;
    const cc = cardCarry(s, 't', o, owed, NOW);
    let n = 0;
    pairs[o] = [sharedOwed(s, 't', o, NOW), cc && [cc.id, cc.carried], openTransfers(s, 't', o, NOW).map(x => [x.round.id, x.open]),
      allocatePayment(s, { from: 't', to: o, amount: 10 }, { now: NOW, makeId: () => `x${n++}` })];
  }
  return JSON.parse(JSON.stringify({
    tab: tabBalances(s), plan, shared: sharedDebts(s, { now: NOW }), codes: tabCodes(s, { now: NOW }),
    h2hNet: [...headToHeadSummary(s, myIds(s))].map(([k, v]) => [k, v.net]).filter(([, v]) => v !== 0),
    months: monthGroups(range, s, new Date(NOW)).map(g => [g.key, g.net, g.played]).filter(g => g[2] > 0),
    series: netSeries(range, s), hh: headToHead(range, s), myTab: myTab(s),
    season: board && [board.balances, board.rounds], stats: [stats.total, stats.h2h], pairs,
  }));
}

test('sweep: points and reward rounds mixed in never change a single money figure', () => {
  for (const { moneyOnly, mixed } of sweep(11, 250)) {
    const a = moneyView(structuredClone(moneyOnly));
    const b = moneyView(structuredClone(mixed));
    assert.deepEqual(b, a);
    assert.equal(Object.values(b.tab).reduce((x, v) => x + Math.round(v * 100), 0), 0, 'the Tab sums to zero');
  }
});

test('sweep: every reward outcome is well formed', () => {
  let seen = 0;
  for (const { others } of sweep(29, 250)) {
    for (const r of others) {
      if (countsMoney(r) || r.playFor.kind !== 'reward') continue;
      seen++;
      const res = roundResults(r);
      const o = rewardOutcome(r, res);
      const amt = Object.fromEntries(res.standings.map(p => [p.id, p.amount]));
      const inIt = res.standings.filter(p => r.left?.[p.id] !== 0).map(p => p.id);
      const vals = inIt.map(id => amt[id]);
      const level = Math.max(...vals) - Math.min(...vals) < 0.005;
      assert.equal(o.winners.length === 0, level);
      assert.ok(o.winners.every(id => !o.owers.includes(id)), 'nobody wins and owes');
      assert.ok([...o.winners, ...o.owers].every(id => inIt.includes(id)), 'only players who played');
      if (!level) {
        const top = Math.max(...vals);
        assert.ok(o.winners.every(id => Math.abs(amt[id] - top) < 0.005));
        // Anyone who left early is left out of buying
        const buyers = inIt.filter(id => !o.winners.includes(id) && leftAt(r, id) >= r.holes.length);
        const low = Math.min(...buyers.map(id => amt[id]));
        if (r.playFor.owes === 'last') assert.deepEqual([...o.owers].sort(), buyers.filter(id => Math.abs(amt[id] - low) < 0.005).sort());
        else assert.deepEqual([...o.owers].sort(), [...buyers].sort());
        assert.ok(o.owers.every(id => leftAt(r, id) >= r.holes.length), 'nobody who left early owes it');
        assert.equal(o.lines.length, o.owers.length);
      }
    }
  }
  assert.ok(seen > 50, `only ${seen} reward rounds`);
});
