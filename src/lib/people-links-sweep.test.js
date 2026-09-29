// A seeded sweep that tries to break "one friend, one person": random rounds over every kind of
// game (some with side Skins, some shared live, some joined from a link), random payments, and
// each friend showing up under two ids. Linking the two ids must give exactly the money of a
// phone where the friend only ever had one id, and nothing changes when nothing is linked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, GAMES } from './round.js';
import { headToHeadSummary, outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { headToHead, myTab } from './history.js';
import { seasonBoard } from './season.js';
import { myIds } from './format.js';
import { canonicalOf, sharedDebts } from './pair-debts.js';
import { allocatePayment, applyRows } from './shared-tab.js';

const course = { id: 'c', name: 'C', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) };
const SETTINGS = {
  hcPct: 100, banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2 }, skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 }, stroke: { stake: 5, payout: 'pot' }, nines: { point: 1 },
};
const NOW = Date.UTC(2026, 8, 20);
const FRIENDS = ['A', 'B', 'C', 'D', 'E'];
// Each friend: PX1 is the one saved on this phone, PX2 another host's copy of them
const idOf = (f, v) => `P${f}${v}`;

function world(rnd, { joined = false } = {}) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const players = { me: { id: 'me', name: 'Me', createdAt: 0 } };
  for (const f of FRIENDS) players[idOf(f, 1)] = { id: idOf(f, 1), name: f, createdAt: 1 };
  const rounds = {};
  const n = 2 + Math.floor(rnd() * 6);
  for (let k = 0; k < n; k++) {
    const game = pick(['skins', 'stroke', 'nassau', 'banker', 'wolf', 'nines']);
    const g = GAMES[game];
    const size = Math.max(g.min || 2, Math.min(g.max || 4, 2 + Math.floor(rnd() * 3)));
    const fs = [...FRIENDS].sort(() => rnd() - 0.5).slice(0, size - 1);
    const seat = joined && rnd() < 0.3 ? `j${k}` : 'me';
    const ids = [seat, ...fs.map(f => idOf(f, rnd() < 0.5 ? 1 : 2))];
    const r = createRound({ id: `r${k}`, game, course, holesCount: 9, players: ids.map((id, i) => ({ id, name: id, index: i * 3 })), settings: SETTINGS, hcPct: 100, useHandicaps: true });
    if (rnd() < 0.3 && game !== 'skins') r.sideGames = [{ game: 'skins', settings: { value: 1, carryover: true } }];
    for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(id => [id, h.par - 1 + Math.floor(rnd() * 3)]));
    r.status = 'done';
    r.createdAt = r.finishedAt = NOW - Math.floor(rnd() * 50) * 864e5 - k;
    if (rnd() < 0.5) r.shareCode = `C${k}`;
    if (seat !== 'me') r.localMe = seat;
    rounds[r.id] = r;
  }
  const everyone = ['me', ...FRIENDS.flatMap(f => [idOf(f, 1), idOf(f, 2)])];
  const settlements = [];
  for (let k = 0; k < Math.floor(rnd() * 5); k++) {
    const from = pick(everyone), to = pick(everyone);
    if (from !== to) settlements.push({ id: `s${k}`, from, to, amount: Math.round(rnd() * 3000) / 100, at: NOW - k * 1000 });
  }
  return { me: 'me', players, rounds, settlements, carries: [], tabRows: {}, crews: {}, customCourses: {}, links: {}, unlinks: [] };
}
/** The same phone as if each friend only ever had their saved id. */
const flatten = st => {
  let s = JSON.stringify({ ...st, links: {} });
  for (const f of FRIENDS) s = s.split(idOf(f, 2)).join(idOf(f, 1));
  return JSON.parse(s);
};
const linked = st => ({ ...st, links: Object.fromEntries(FRIENDS.map(f => [idOf(f, 2), idOf(f, 1)])) });
const plain = x => JSON.parse(JSON.stringify(x));
const storyMoney = s => ({ ...s, items: s.items.map(x => [x.kind, x.id, x.amount]) });
const cents = bal => Object.values(bal).reduce((a, v) => a + Math.round(v * 100), 0);

test('sweep: with nothing linked, who is who is exactly what it always was', () => {
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const st = world(rnd, { joined: true });
    const mine = myIds(st);
    const who = canonicalOf(st);
    for (const r of Object.values(st.rounds)) for (const p of r.players) assert.equal(who(p.id), mine.has(p.id) ? 'me' : p.id);
  }
});

test('sweep: linking a friend’s two ids is the money of a phone where they had one id, to the cent', () => {
  let seed = 17;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const st = linked(world(rnd, { joined: i % 2 === 1 }));
    const flat = flatten(st);
    const mine = myIds(st);
    assert.equal(cents(tabBalances(st)), 0, 'balances add up to zero');
    assert.deepEqual(plain(tabBalances(st)), plain(tabBalances(flat)));
    assert.deepEqual(plain(outstanding(st, { now: NOW })), plain(outstanding(flat, { now: NOW })));
    assert.deepEqual(plain(sharedDebts(st, { now: NOW })), plain(sharedDebts(flat, { now: NOW })));
    assert.deepEqual(plain([...headToHeadSummary(st, mine)].sort()), plain([...headToHeadSummary(flat, mine)].sort()));
    assert.deepEqual(plain(headToHead(Object.values(st.rounds), st)), plain(headToHead(Object.values(flat.rounds), flat)));
    assert.deepEqual(plain(myTab(st)), plain(myTab(flat)));
    assert.deepEqual(plain(seasonBoard(st, 2026)), plain(seasonBoard(flat, 2026)));
    for (const f of FRIENDS) {
      // The card opened under either id is the same story as the one id
      assert.deepEqual(storyMoney(personStory(st, mine, idOf(f, 2))), storyMoney(personStory(flat, mine, idOf(f, 1))));
    }
    // Paying a whole card under the other id does exactly what paying the one id does
    for (const f of FRIENDS.slice(0, 2)) {
      const kept = idOf(f, 1), alias = idOf(f, 2);
      const card = tabWith(outstanding(st, { now: NOW }), new Set(['me']), kept);
      if (!card) continue;
      const pay = (s, id) => {
        const p = card > 0 ? { from: id, to: 'me', amount: card } : { from: 'me', to: id, amount: -card };
        const { rows, settlements } = allocatePayment(s, p, { now: NOW, makeId: () => `x${f}` });
        return applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
      };
      const a = pay(st, alias), b = pay(flat, kept);
      assert.equal(cents(tabBalances(a)), 0);
      assert.deepEqual(plain(outstanding(a, { now: NOW })), plain(outstanding(b, { now: NOW })));
      assert.deepEqual(plain(outstanding(flatten(a), { now: NOW })), plain(outstanding(b, { now: NOW })), 'the rows it wrote are the one-id rows');
    }
  }
});
