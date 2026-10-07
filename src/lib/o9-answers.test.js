// Trevor's answers to the Overnight 9 review (2026-10-06): the banker presses everyone only after
// someone presses, and "Done playing?" asks first while planned rounds haven't been played.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, bankerPressAll, bankerPressAllNow } from './round.js';
import { settleBankerHole } from './golf.js';
import { doneAsk, newTrip, tripStamp, tripStatus } from './trips.js';

// ---------------------------------------------------------------------------
// Banker: the press back on every bet, only after someone presses

const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: i === 2 ? 3 : 4, hdcp: i + 1 })) });
const BANKER = { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off', par3Triple: false, pressAll: false };
function banker(pressAll, setup, over = { b: 3, c: 5 }) {
  const players = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), index: 0 }));
  const r = createRound({ id: 'r', game: 'banker', course: flat(9), holesCount: 9, players, settings: { hcPct: 100, banker: { ...BANKER, pressAll } }, hcPct: 100, useHandicaps: false });
  r.scores[1] = { a: 4, b: 4, c: 4, ...over };
  r.banker = { 1: { banker: 'a', bets: { b: 5, c: 5 }, doubled: {}, doubleBack: false, ...setup } };
  return r;
}
const bal = r => roundResults(r).balances;

test('a new round with the rule on stamps "after"; off stays off', () => {
  assert.equal(banker(true, {}).settings.banker.pressAll, 'after');
  assert.equal(banker('after', {}).settings.banker.pressAll, 'after');
  assert.equal(banker(false, {}).settings.banker.pressAll, false);
  const r = banker(true, {});
  assert.equal(bankerPressAll(r, r.holes[0]), 'after');
  assert.equal(bankerPressAll(banker(false, {}), r.holes[0]), null);
});

test('settleBankerHole "after": no press back on every bet until someone presses', () => {
  const net = { a: 4, b: 3, c: 5 };
  const ids = ['a', 'b', 'c'];
  // Nobody pressed: a press back does nothing, the bets stay as they are
  const none = { banker: 'a', bets: { b: 5, c: 5 }, doubled: {}, doubleBack: true };
  assert.deepEqual(settleBankerHole(none, net, ids, { pressAll: 'after' }).deltas, { a: 0, b: 5, c: -5 });
  assert.deepEqual(settleBankerHole(none, net, ids, { pressAll: 'after' }).deltas, settleBankerHole(none, net, ids).deltas);
  // Bo pressed: the press back takes Bo to 4× and Cy, who didn't press, to 2×
  const pressed = { ...none, doubled: { b: true } };
  assert.deepEqual(settleBankerHole(pressed, net, ids, { pressAll: 'after' }).deltas, { a: -10, b: 20, c: -10 });
  // No press back: only the press counts
  assert.deepEqual(settleBankerHole({ ...pressed, doubleBack: false }, net, ids, { pressAll: 'after' }).deltas, { a: -5, b: 10, c: -5 });
  // The banker's own entry in doubled never opens it
  assert.deepEqual(settleBankerHole({ ...none, doubled: { a: true } }, net, ids, { pressAll: 'after' }).deltas, { a: 0, b: 5, c: -5 });
  // On a par 3 that triples, after a press: 9× pressed, 3× the rest
  assert.deepEqual(settleBankerHole(pressed, net, ids, { pressAll: 'after', par3Triple: true, par: 3 }).deltas, { a: -30, b: 45, c: -15 });
});

test('banker presses everyone, whole rounds: unavailable before a press, doubling after', () => {
  // A new round, nobody pressed, a press back saved anyway: the same money as with the rule off
  const before = banker(true, { doubleBack: true });
  assert.equal(bankerPressAllNow(before, before.holes[0], before.banker[1]), false);
  assert.deepEqual(bal(before), bal(banker(false, { doubleBack: true })));
  assert.deepEqual(bal(before), { a: 0, b: 5, c: -5 });
  // Bo presses and the banker presses back: every bet doubles, Bo's to 4×
  const after = banker(true, { doubled: { b: true }, doubleBack: true });
  assert.equal(bankerPressAllNow(after, after.holes[0], after.banker[1]), true);
  assert.deepEqual(bal(after), { a: -10, b: 20, c: -10 });
  // Rule off, the same hole: only the pressed bet goes to 4×
  assert.deepEqual(bal(banker(false, { doubled: { b: true }, doubleBack: true })), { a: -15, b: 20, c: -5 });
});

test('a round saved by the 2026-10-05 build (pressAll true, any time) keeps exactly its money', () => {
  // Saved as it was: the press back with nobody pressing doubled every bet
  const old = banker(false, { doubleBack: true });
  old.settings.banker.pressAll = true;
  assert.equal(bankerPressAll(old, old.holes[0]), 'any');
  assert.equal(bankerPressAllNow(old, old.holes[0], old.banker[1]), true);
  assert.deepEqual(bal(old), { a: 0, b: 10, c: -10 });
  // And with a press, as before
  const pressed = banker(false, { doubled: { b: true }, doubleBack: true });
  pressed.settings.banker.pressAll = true;
  assert.deepEqual(bal(pressed), { a: -10, b: 20, c: -10 });
  // A mid-round bet change saved in betHistory keeps its own value too
  const hist = banker(false, { doubleBack: true });
  hist.betHistory = [{ upto: 1, settings: { ...BANKER, pressAll: true } }];
  hist.settings.banker.pressAll = 'after';
  assert.deepEqual(bal(hist), { a: 0, b: 10, c: -10 });
});

// ---------------------------------------------------------------------------
// "Done playing?" asks first while planned rounds haven't been played

const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const TRIP = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });
const plan = (id, date, extra = {}) => ({ id, status: 'planned', date, teeTime: '09:00', trip: tripStamp(TRIP), createdAt: OCT(15), ...extra });
const stateWith = plans => ({ me: 't', players: {}, rounds: {}, settlements: [], carries: [], tabRows: {}, trips: { t_bandon: TRIP }, plans: Object.fromEntries(plans.map(p => [p.id, p])) });
const statusOn = (plans, now = OCT(17, 13)) => tripStatus(stateWith(plans), 't_bandon', { now });

test('doneAsk: no planned rounds left, no question', () => {
  assert.equal(doneAsk(statusOn([])), null);
  assert.equal(doneAsk(null), null);
  // Played (started), gone, or for another trip: not counted
  assert.equal(doneAsk(statusOn([plan('p1', '2026-10-18', { status: 'started', roundId: 'r9' }), plan('p2', '2026-10-18', { gone: true }), plan('p3', '2026-10-18', { trip: null })])), null);
  // A plan from a day gone by no longer holds the trip open, so it isn't asked about either
  assert.equal(doneAsk(statusOn([plan('p4', '2026-10-16')])), null);
});

test('doneAsk: counts the planned rounds nobody played and says so', () => {
  const one = doneAsk(statusOn([plan('p1', '2026-10-18')]));
  assert.equal(one.count, 1);
  assert.equal(one.title, '1 planned round hasn’t been played. Settle now?');
  assert.equal(one.text, 'It comes off the trip, and Settle the trip opens for everyone.');
  assert.equal(one.confirmLabel, 'Settle now');
  const two = doneAsk(statusOn([plan('p1', '2026-10-17', { teeTime: '15:00' }), plan('p2', '2026-10-18'), plan('p3', '2026-10-18', { status: 'started', roundId: 'r9' })]));
  assert.equal(two.count, 2);
  assert.equal(two.title, '2 planned rounds haven’t been played. Settle now?');
  assert.equal(two.text, 'They come off the trip, and Settle the trip opens for everyone.');
  const cup = doneAsk(statusOn([plan('p1', '2026-10-18')]), { cup: true });
  assert.equal(cup.title, '1 planned round hasn’t been played. Decide the cup now?');
  assert.equal(cup.confirmLabel, 'Decide the cup');
  for (const q of [one, two, cup]) assert.ok(!`${q.title}${q.text}`.includes(String.fromCharCode(0x2014)));
});
