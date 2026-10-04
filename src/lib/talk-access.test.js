// Who may read and write the talk on the server (the rules in supabase/2026-10-04-comments.sql):
// only people in that round or on that plan, each as their own seat, and each changes or deletes
// only their own rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinRows, mayAdd, mayChange, mayDelete, memberKeys, ownsRow, planSeats, roundSeats, seatsFor } from './talk-access.js';

const HOST = 'h'.repeat(64);
const SAM = 's'.repeat(64);
const MIKE = 'm'.repeat(64);
const STRANGER = 'x'.repeat(64);
const meta = {
  hostDev: HOST,
  devs: { sam: SAM, mike: MIKE },
  players: [{ id: 'me' }, { id: 'sam' }, { id: 'mike' }, { id: 'pat' }],
};

test('talk access: each phone in a round speaks as its own seat; the host phone for seats nobody took', () => {
  assert.deepEqual(roundSeats(meta, SAM), ['sam']);
  assert.deepEqual(roundSeats(meta, MIKE), ['mike']);
  assert.deepEqual(roundSeats(meta, HOST), ['me', 'pat']);
});

test('talk access: a watcher or a stranger with the code is not in the round', () => {
  assert.equal(roundSeats(meta, STRANGER), null);
  assert.equal(roundSeats(meta, null), null);
  assert.equal(roundSeats(null, SAM), null);
});

test('talk access: a seat linked to your account lets you in from any phone', () => {
  assert.deepEqual(roundSeats(meta, STRANGER, new Set(['sam'])), ['sam']);
  assert.deepEqual(roundSeats(meta, null, new Set(['nobody'])), null);
});

test('talk access: a round shared before the keeper lock stays open to every seat, as before', () => {
  const old = { players: [{ id: 'me' }, { id: 'sam' }] };
  assert.deepEqual(roundSeats(old, STRANGER), ['me', 'sam']);
});

test('talk access: a plan is everyone on it: the organizer, the people it lists and anyone who answered', () => {
  const plan = { hostWho: 'host', people: [{ id: 'host' }, { id: 'sam' }] };
  assert.deepEqual(planSeats(plan, [{ who: 'g1' }, { who: 'sam' }]).sort(), ['g1', 'host', 'sam']);
  assert.equal(planSeats(null), null);
});

test('talk access: joining remembers the phone and the account with the seats they had', () => {
  assert.deepEqual(memberKeys(SAM, 'u1'), [`d:${SAM}`, 'u:u1']);
  assert.deepEqual(memberKeys(null, null), []);
  assert.deepEqual(joinRows({ scope: 'round', live: meta, w: SAM, user: 'u1' }), [{ member: `d:${SAM}`, seats: ['sam'] }, { member: 'u:u1', seats: ['sam'] }]);
  assert.deepEqual(joinRows({ scope: 'round', live: meta, w: STRANGER }), []);
  assert.deepEqual(joinRows({ scope: 'round', live: null, w: SAM }), []);
});

test('talk access: the talk outlives the live round for those who joined, and only them', () => {
  const joined = joinRows({ scope: 'round', live: meta, w: SAM });
  assert.deepEqual(seatsFor({ scope: 'round', live: null, joined, w: SAM }), ['sam']);
  assert.equal(seatsFor({ scope: 'round', live: null, joined, w: MIKE }), null);
  // While the round is live, a player's phone is in without joining
  assert.deepEqual(seatsFor({ scope: 'round', live: meta, joined: [], w: MIKE }), ['mike']);
});

test('talk access: a plan’s talk is read only after joining with its code', () => {
  const plan = { hostWho: 'host', people: [{ id: 'host' }] };
  assert.equal(seatsFor({ scope: 'plan', plan, joined: [], w: SAM }), null);
  const joined = joinRows({ scope: 'plan', plan, w: SAM });
  assert.deepEqual(seatsFor({ scope: 'plan', plan, rsvps: [{ who: 'g1' }], joined, w: SAM }).sort(), ['g1', 'host']);
  assert.equal(seatsFor({ scope: 'plan', plan: null, joined, w: SAM }), null, 'a deleted plan has no talk');
  assert.equal(seatsFor({ scope: 'nope', joined, w: SAM }), null);
});

test('talk access: you write only as one of your seats', () => {
  const seats = roundSeats(meta, SAM);
  assert.equal(mayAdd({ who: 'sam' }, seats), true);
  assert.equal(mayAdd({ who: 'mike' }, seats), false, 'never as someone else');
  assert.equal(mayAdd({ who: 'sam' }, null), false);
});

test('talk access: only the phone or account that wrote a row changes or deletes it', () => {
  const row = { who: 'sam', on: 'round', kind: 'comment', authorDev: SAM, authorUser: 'u1' };
  assert.equal(ownsRow(row, SAM, null), true);
  assert.equal(ownsRow(row, STRANGER, 'u1'), true, 'your account on another phone');
  assert.equal(ownsRow(row, MIKE, 'u2'), false);
  assert.equal(ownsRow({ who: 'sam' }, null, null), false, 'a row with no writer is nobody’s');
  assert.equal(mayDelete(row, SAM, null), true);
  assert.equal(mayDelete(row, HOST, null), false, 'not even the host phone');
  const seats = roundSeats(meta, SAM);
  assert.equal(mayChange(row, { body: 'Edited' }, { w: SAM, seats }), true);
  assert.equal(mayChange(row, { who: 'mike' }, { w: SAM, seats }), false, 'who wrote it never changes');
  assert.equal(mayChange(row, { on: 'pay:a>b' }, { w: SAM, seats }), false, 'nor what it is about');
  assert.equal(mayChange(row, { body: 'x' }, { w: MIKE, seats: roundSeats(meta, MIKE) }), false);
});
