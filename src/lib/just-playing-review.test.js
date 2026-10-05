// Money review of "Just playing, no bet": the places outside the engine that name people or list them
// in standings. Someone just playing is never named for a bet they weren't in, and never takes a row
// with a $0 or 0 pts next to it in a money or points standings list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { roundMoment } from './moments.js';
import { recapMoments } from './recap.js';
import { seasonBoard } from './season.js';
import { newTrip, tripStamp, tripStatus } from './trips.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();

/** A two-player Nassau with a friend just playing listed first, as setup lists them when they're picked first. */
function nassauWithFriend() {
  const r = createRound({
    id: 'n1', game: 'nassau', course: flat9, holesCount: 9,
    players: [{ id: 'sam', name: 'Sam Friend', index: 0 }, { id: 'al', name: 'Al Ames', index: 0 }, { id: 'bo', name: 'Bo Burr', index: 0 }],
    settings: { hcPct: 100, nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 } }, hcPct: 100, useHandicaps: false,
    justPlaying: ['sam'],
  });
  // Bo wins the first five holes (the front is a nine-hole round's only leg, so it's won 5&4)
  for (const h of r.holes.slice(0, 5)) r.scores[h.no] = { sam: 3, al: 5, bo: 4 };
  return r;
}

test('a match moment names the betting player who won, never the friend just playing', () => {
  const r = nassauWithFriend();
  const titles = [1, 2, 3, 4, 5].map(pos => roundMoment(r, pos)).filter(Boolean).map(m => `${m.title} ${m.text}`);
  assert.ok(titles.length, 'there is a moment');
  for (const t of titles) {
    assert.ok(!/Sam/.test(t), `no moment names Sam: ${t}`);
    assert.ok(!/\bAl\b wins|\bAl\b goes/.test(t), `Al didn't win anything: ${t}`);
  }
  assert.ok(titles.some(t => /\bBo\b/.test(t)), `Bo is named: ${titles.join(' | ')}`);
  // The recap's moments read the same
  r.status = 'done'; r.finishedAt = OCT(5);
  for (const m of recapMoments(r)) assert.ok(!/Sam/.test(`${m.title} ${m.text}`), `recap: ${m.title} ${m.text}`);
});

/** A finished 9-hole skins round with `jp` just playing; `win` takes every hole. */
function skins(id, ids, jp, win, { at = OCT(16), playFor = null, trip = null } = {}) {
  const r = createRound({
    id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })),
    settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false, justPlaying: jp,
  });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, p === win ? 3 : 4]));
  r.status = 'done'; r.createdAt = at - 4 * 36e5; r.finishedAt = at;
  if (playFor) r.playFor = playFor;
  if (trip) r.trip = tripStamp(trip);
  return r;
}

test('the season board lists the betting players only, with no $0 row for a friend just playing', () => {
  const r = skins('s1', ['me', 'mike', 'sam'], ['sam'], 'mike', { at: new Date(2026, 8, 5, 15).getTime() });
  const st = { me: 'me', players: {}, rounds: { s1: r }, settlements: [], carries: [], tabRows: {}, plans: {}, trips: {} };
  const b = seasonBoard(st, 2026);
  assert.deepEqual(b.balances.map(x => x.id).sort(), ['me', 'mike']);
});

test('a trip played for points lists the betting players only in its points, never a friend just playing', () => {
  const trip = newTrip({ id: 't1', name: 'Bandon', start: '2026-10-16', end: '2026-10-18', by: 'me', now: OCT(1) });
  const r = skins('s2', ['me', 'mike', 'sam'], ['sam'], 'me', { playFor: { kind: 'points' }, trip });
  const st = { me: 'me', players: {}, rounds: { s2: r }, settlements: [], carries: [], tabRows: {}, plans: {}, trips: { t1: trip } };
  const ts = tripStatus(st, 't1', { now: OCT(17) });
  assert.deepEqual(Object.keys(ts.points).sort(), ['me', 'mike']);
  // Nine skins at 2 from Mike alone: the same as the round without Sam
  assert.equal(ts.points.me, 18);
});

test('a won match counts the holes left for the bets, not a hole the friend just playing has no score on', () => {
  const r = nassauWithFriend();
  // Bo has the match won after five; the betting players finish hole 6, the friend's box is empty there
  r.scores[6] = { al: 4, bo: 4 };
  const m = [1, 2, 3, 4, 5, 6].map(pos => roundMoment(r, pos)).find(x => x?.level === 'big');
  assert.ok(m, 'the match is won');
  assert.equal(m.left, 3);
});
