import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anyTrips, doneCount, lastDoneRound, nextPlan, stripClock } from './upnext-first.js';
import { lastResult } from './history.js';
import { tripsOf } from './trips.js';

const round = (id, status, extra = {}) => ({ id, status, createdAt: 1, players: [], holes: [], scores: {}, game: 'skins', course: { name: 'X' }, ...extra });

test('lastDoneRound names the round lastResult does, and null without one', () => {
  const empty = { rounds: {}, players: {}, me: 'me' };
  assert.equal(lastDoneRound(empty), null);
  assert.equal(lastResult(empty), null);
  const state = { rounds: {
    a: round('a', 'done', { finishedAt: 10 }),
    b: round('b', 'done', { finishedAt: 30 }),
    c: round('c', 'done', { createdAt: 20 }),
    d: round('d', 'active', { createdAt: 99 }),
  }, players: {}, me: 'me' };
  assert.equal(lastDoneRound(state).id, 'b');
  assert.equal(lastResult(state).round.id, 'b');
  assert.equal(lastDoneRound({}), null);
});

test('anyTrips is true wherever tripsOf finds a trip, and false with none', () => {
  const none = { rounds: { a: round('a', 'done') }, plans: { p: { id: 'p' } }, trips: {} };
  assert.equal(anyTrips(none), false);
  assert.equal(tripsOf(none).size, 0);
  const own = { ...none, trips: { t1: { id: 't1', name: 'Bandon' } } };
  assert.equal(anyTrips(own), true);
  assert.equal(tripsOf(own).size, 1);
  const stamped = { ...none, rounds: { a: round('a', 'done', { trip: { id: 't2', name: 'Pinehurst' } }) } };
  assert.equal(anyTrips(stamped), true);
  assert.equal(tripsOf(stamped).size, 1);
  const planned = { ...none, plans: { p: { id: 'p', trip: { id: 't3', name: 'Kohler' } } } };
  assert.equal(anyTrips(planned), true);
  assert.equal(tripsOf(planned).size, 1);
  assert.equal(anyTrips({}), false);
  assert.equal(anyTrips(undefined), false);
});

test('nextPlan skips plans that are off, moved, gone, past or that you are out of', () => {
  const now = new Date(2026, 9, 26, 9, 0); // Monday 26 Oct, 9:00
  const plan = (id, date, extra = {}) => ({ id, status: 'planned', host: true, hostWho: 'host', date, teeTime: '08:10', answers: { host: { status: 'in' } }, ...extra });
  assert.equal(nextPlan([], now), null);
  assert.equal(nextPlan(null, now), null);
  const todayGone = plan('a', '2026-10-26'); // 8:10 today, already gone
  const off = plan('b', '2026-10-27', { status: 'off' });
  const out = plan('c', '2026-10-28', { answers: { host: { status: 'out' } } });
  const moved = plan('d', '2026-10-29', { movedTo: { date: '2026-11-01' } });
  const sat = plan('e', '2026-10-31');
  assert.equal(nextPlan([todayGone, off, out, moved, sat], now).id, 'e');
  // A friend's plan reads your answer under localMe
  assert.equal(nextPlan([plan('f', '2026-10-31', { host: false, localMe: 'me', answers: { me: { status: 'out' } } })], now), null);
  // The clock: days, hours and minutes to the tee time; words without one
  assert.deepEqual(stripClock(sat, now).parts, [['04', 'd'], ['23', 'h'], ['10', 'm']]);
  assert.deepEqual(stripClock(plan('g', '2026-10-26', { teeTime: '10:30' }), now).parts, [['01', 'h'], ['30', 'm']]);
  assert.equal(stripClock(plan('h', '2026-10-27', { teeTime: null }), now).words, 'Tomorrow');
  assert.equal(stripClock(plan('i', '2026-10-30', { teeTime: null }), now).words, '4 days');
  assert.equal(stripClock(todayGone, now), null);
});

test('doneCount counts finished rounds only', () => {
  assert.equal(doneCount({}), 0);
  assert.equal(doneCount({ rounds: { a: round('a', 'done'), b: round('b', 'active'), c: round('c', 'done') } }), 2);
});
