import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anyTrips, lastDoneRound } from './upnext-first.js';
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
