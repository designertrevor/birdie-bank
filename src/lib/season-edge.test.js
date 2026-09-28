// The Season preview must agree, cent for cent, with what the free screens already show for the same rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { seasonBoard, seasonRounds } from './season.js';
import { seasonStats } from './format.js';
import { tabBalances } from './ledger.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  skins: { value: 3, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
};
const hole = i => ({ par: 4, hdcp: ((i * 7) % 18) + 1 });
const c18 = { id: 'c18', name: 'Long', city: 'T', tees: [], holes: Array.from({ length: 18 }, (_, i) => hole(i)) };
const YEAR = 2026;
const at = (m, d) => new Date(YEAR, m - 1, d, 15).getTime();

function play(id, game, ids, { holesCount = 18, when = at(9, 1), scores = {}, extra = {}, index = {} } = {}) {
  const players = ids.map(p => ({ id: p, name: p[0].toUpperCase() + p.slice(1) + ' X', index: index[p] ?? 0 }));
  const r = createRound({ id, game, course: c18, holesCount, players, settings: SETTINGS, hcPct: 100, useHandicaps: true });
  Object.assign(r, extra);
  r.holes.forEach((h, i) => {
    const row = {};
    for (const p of ids) row[p] = 4 + ((i + p.length) % 3) - 1;
    r.scores[h.no] = { ...row, ...(scores[h.no] || {}) };
  });
  r.status = 'done';
  r.finishedAt = when;
  return r;
}

function fixture() {
  return [
    // A 9-hole round with odd skins that split three ways
    play('a', 'skins', ['me', 'mike', 'sam'], { holesCount: 9, when: at(3, 2), index: { sam: 12 } }),
    // Stroke play with a pot that doesn't divide evenly
    play('b', 'stroke', ['me', 'mike', 'sam', 'dave'], { when: at(4, 2), index: { dave: 7 } }),
    // Someone left after 5 and someone joined on 4
    play('c', 'skins', ['me', 'mike', 'sam', 'dave'], { when: at(5, 2), extra: { left: { sam: 5 }, joined: { dave: 4 } } }),
    // A joined round on this phone: you sat as 'guest7'
    play('d', 'skins', ['guest7', 'mike', 'zed'], { when: at(6, 2), extra: { localMe: 'guest7' } }),
    // A round you watched: you're not a player in it
    play('e', 'skins', ['mike', 'zed'], { when: at(7, 2), extra: { localMe: 'watch1' } }),
  ];
}

const stateOf = rounds => ({
  me: 'me',
  players: { me: { id: 'me', name: 'Trevor' } },
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
  settlements: [],
});
const c = v => Math.round(v * 100);

test('your season total is the same number History and Players already show', () => {
  const st = stateOf(fixture());
  const b = seasonBoard(st, YEAR);
  const s = seasonStats(st, YEAR);
  assert.equal(b.rounds, s.rounds);
  assert.equal(c(b.balances.find(x => x.me).net), c(s.total));
});

test('each friend: the Season net matches the free head-to-head for this season', () => {
  const st = stateOf(fixture());
  const b = seasonBoard(st, YEAR);
  const s = seasonStats(st, YEAR);
  assert.ok(b.rival);
  assert.equal(c(b.rival.net), c(s.h2h[b.rival.id]));
  // A round you only watched never counts toward a record
  assert.equal(b.rival.won + b.rival.lost + b.rival.even, b.rival.rounds);
  assert.equal(b.rival.rounds, seasonRounds(st, YEAR).filter(r => r.players.some(p => p.id === b.rival.id)).length);
});

test('everyone in the rounds you played sums to zero, and matches the Tab before payments', () => {
  const rounds = fixture();
  const st = stateOf(rounds);
  const b = seasonBoard(st, YEAR);
  assert.equal(b.balances.reduce((a, x) => a + c(x.net), 0), 0);
  // Only the rounds you played: build the Tab from just those
  const mineOnly = stateOf(seasonRounds(st, YEAR));
  mineOnly.rounds = Object.fromEntries(Object.entries(mineOnly.rounds));
  const tab = tabBalances(mineOnly);
  for (const x of b.balances) assert.equal(c(x.net), c(tab[x.id] || 0), x.id);
  // Payments never change the season (it's what was won, not what's owed)
  const paid = { ...st, settlements: [{ id: 's1', from: 'mike', to: 'me', amount: 7, at: at(8, 1) }] };
  assert.deepEqual(seasonBoard(paid, YEAR).balances, b.balances);
  // Per round, each round's money is what roundResults says
  for (const r of seasonRounds(st, YEAR)) assert.equal(Object.values(roundResults(r).balances).reduce((a, v) => a + c(v), 0), 0);
});

test('a phone that only watched a round from a link is not an organizer, so it never sees the Season preview', async () => {
  const { seasonAccess } = await import('./entitlements.js');
  const { isOrganizer } = await import('./paywall.js');
  // joinShared stores a watched round with localMe null and shared.host false
  const watched = { rounds: { w1: { id: 'w1', localMe: null, shared: { code: 'ABCD', host: false }, players: [] } } };
  assert.equal(isOrganizer(watched), false);
  assert.deepEqual(seasonAccess(watched), { access: 'none' });
  // Your own round that you then shared live is still yours
  const hosted = { rounds: { h1: { id: 'h1', shared: { code: 'WXYZ', host: true }, players: [] } } };
  assert.equal(isOrganizer(hosted), true);
});
