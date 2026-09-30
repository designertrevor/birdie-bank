// The server's keeper lock (keeper-lock.js, mirrored in supabase/2026-09-30-keeper-lock.sql): only the
// keeper's phone writes a round in progress, the handoff and "take the card" still work, any player's
// phone fixes a finished round, and rounds from before the lock stay open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAKE_WAIT_MS, fullWriter, holeAllowed, isLocked, keeperDev, lockTrack, lockedMeta, mergeDevs, removeAllowed,
} from './keeper-lock.js';
import { askForCard, handOff, metaToKeep, metaToSend, registerDevice, takeCard } from './keeper.js';

const HOST = 'h'.repeat(64), DAVE = 'd'.repeat(64), AL = 'a'.repeat(64), OLD_APP = null, STRANGER = 's'.repeat(64);

function meta(extra = {}) {
  return {
    id: 'r1', status: 'active', game: 'skins', bets: { value: 2 },
    players: [{ id: 'me', name: 'Trevor' }, { id: 'dave', name: 'Dave' }, { id: 'al', name: 'Al' }],
    keeper: { id: null, since: 1, by: null, lastSaveAt: 1 },
    onApp: { me: 1, dave: 2 }, hostDev: HOST, devs: { me: HOST, dave: DAVE },
    ...extra,
  };
}

test('the keeper is the host phone, or the phone on the keeper seat', () => {
  assert.equal(keeperDev(meta()), HOST);
  assert.equal(keeperDev(meta({ keeper: { id: 'dave' } })), DAVE);
  assert.equal(keeperDev(meta({ keeper: { id: 'al' } })), null); // Al's phone isn't known
  assert.equal(isLocked(meta()), true);
  assert.equal(isLocked(meta({ status: 'done' })), false);
});

test('a round shared before the lock (or by an older app) stays open to everyone', () => {
  const m = meta(); delete m.hostDev; delete m.devs;
  for (const w of [HOST, DAVE, OLD_APP, STRANGER]) {
    assert.equal(fullWriter(m, w), true);
    assert.equal(holeAllowed(m, 3, w), true);
  }
  const next = { ...m, bets: { value: 5 } };
  assert.deepEqual(lockedMeta(m, next, OLD_APP), next);
});

test('only the keeper phone changes a round in progress', () => {
  const m = meta();
  assert.equal(holeAllowed(m, 3, HOST), true);
  for (const w of [DAVE, AL, OLD_APP, STRANGER]) assert.equal(holeAllowed(m, 3, w), false);
  // Another phone's bet change is left out; the rest of the meta stays as the server has it
  assert.deepEqual(lockedMeta(m, { ...m, bets: { value: 50 }, status: 'done' }, DAVE), m);
  assert.deepEqual(lockedMeta(m, { ...m, bets: { value: 50 } }, OLD_APP), m);
  // The keeper changes what it likes
  assert.equal(lockedMeta(m, { ...m, bets: { value: 5 } }, HOST).bets.value, 5);
});

test('seat requests stay open to anyone with the link', () => {
  assert.equal(holeAllowed(meta(), -123456, STRANGER), true);
  assert.equal(holeAllowed(meta(), -123456, OLD_APP), true);
});

test('handing off the card moves the lock, and the old keeper can still send its last holes', () => {
  const m = meta();
  const handed = { ...m, ...handOff('dave', null, 5, 4) };
  const kept = lockedMeta(m, handed, HOST);
  assert.equal(kept.keeper.id, 'dave');
  const row = lockTrack(m, kept, {});
  assert.equal(row.prevDev, HOST);
  assert.equal(holeAllowed(kept, 4, DAVE, row.prevDev), true);
  assert.equal(holeAllowed(kept, 4, HOST, row.prevDev), true);   // scores saved before the handoff
  assert.equal(holeAllowed(kept, 4, AL, row.prevDev), false);
  // Dave hands to Al's phone once Al has taken his seat
  const withAl = lockedMeta(kept, { ...kept, devs: { ...kept.devs, al: AL }, onApp: { ...kept.onApp, al: 9 } }, AL);
  assert.equal(withAl.devs.al, AL);
  const toAl = lockedMeta(withAl, { ...withAl, ...handOff('al', 'dave', 9) }, DAVE);
  const row2 = lockTrack(withAl, toAl, row);
  assert.equal(keeperDev(toAl), AL);
  assert.equal(row2.prevDev, DAVE);
  assert.equal(holeAllowed(toAl, 5, HOST, row2.prevDev), false);
  // Only the keeper hands it off
  assert.equal(lockedMeta(withAl, { ...withAl, ...handOff('al', 'dave', 9) }, AL).keeper.id, 'dave');
});

test('a player without the card can take their seat, set how they get paid and ask for the card', () => {
  const m = meta();
  const next = structuredClone(m);
  next.devs.al = AL;
  next.onApp.al = 7;
  next.players[2].payApp = 'venmo'; next.players[2].payHandle = 'al-b';
  next.players[1].payHandle = 'hijack';   // someone else's seat: left out
  next.claims = { al: 'al-real' };
  Object.assign(next, askForCard('al', 8));
  const kept = lockedMeta(m, next, AL);
  assert.equal(kept.devs.al, AL);
  assert.equal(kept.onApp.al, 7);
  assert.equal(kept.players[2].payHandle, 'al-b');
  assert.equal(kept.players[1].payHandle, undefined);
  assert.deepEqual(kept.claims, { al: 'al-real' });
  assert.equal(kept.cardAsk.by, 'al');
  assert.deepEqual(kept.bets, m.bets);
});

test('nobody takes over the keeper seat or the host phone, and device entries are only added', () => {
  const m = meta({ keeper: { id: 'dave', since: 1, by: null, lastSaveAt: 1 } });
  const next = structuredClone(m);
  next.devs.dave = STRANGER;
  next.hostDev = STRANGER;
  assert.deepEqual(lockedMeta(m, next, STRANGER), m);
  // The keeper's copy that hasn't heard of Al's phone yet never drops it
  const withAl = { ...m, devs: { ...m.devs, al: AL } };
  const fromKeeper = lockedMeta(withAl, { ...m, bets: { value: 5 } }, DAVE);
  assert.equal(fromKeeper.devs.al, AL);
  assert.equal(fromKeeper.bets.value, 5);
  // A phone can only put its own device on a seat
  assert.equal(lockedMeta(m, { ...m, devs: { ...m.devs, al: STRANGER } }, AL).devs.al, undefined);
});

test('taking the card works once the ask has stood on the server, never before', () => {
  const m = meta({ devs: { me: HOST, dave: DAVE, al: AL } });
  const asked = lockedMeta(m, { ...m, ...askForCard('al', 100) }, AL, { now: 1000 });
  const row = lockTrack(m, asked, {}, 1000);
  assert.equal(row.askSeenAt, 1000);
  const take = { ...asked, ...takeCard(asked, 'al', 200) };
  const early = lockedMeta(asked, take, AL, { askSeenAt: row.askSeenAt, now: 1000 + TAKE_WAIT_MS - 1 });
  assert.equal(early.keeper.id, null);
  const late = lockedMeta(asked, take, AL, { askSeenAt: row.askSeenAt, now: 1000 + TAKE_WAIT_MS });
  assert.equal(late.keeper.id, 'al');
  assert.equal(late.cardAsk, null);
  // Dave can't take the card on Al's ask
  const byDave = { ...asked, ...takeCard(asked, 'dave', 200) };
  assert.equal(lockedMeta(asked, byDave, DAVE, { askSeenAt: 1000, now: 1e9 }).keeper.id, null);
  // A declined ask can't be taken
  const no = { ...asked, cardAsk: { ...asked.cardAsk, no: true } };
  assert.equal(lockedMeta(no, { ...no, ...takeCard(no, 'al', 200) }, AL, { askSeenAt: 1000, now: 1e9 }).keeper.id, null);
});

test('any player fixes a finished round; watchers and older apps do not', () => {
  const m = meta({ status: 'done', keeper: { id: 'dave', since: 1, by: null, lastSaveAt: 1 } });
  for (const w of [HOST, DAVE]) {
    assert.equal(holeAllowed(m, 2, w), true);
    assert.equal(lockedMeta(m, { ...m, bets: { value: 3 } }, w).bets.value, 3);
  }
  for (const w of [AL, STRANGER, OLD_APP]) assert.equal(holeAllowed(m, 2, w), false);
  // Al takes his seat on the new app, then he can fix it too
  const withAl = lockedMeta(m, { ...m, devs: { ...m.devs, al: AL } }, AL);
  assert.equal(holeAllowed(withAl, 2, AL), true);
  // The last keeper, whose phone wasn't known while it was played, can put it on the finished round
  const noDave = { ...m, devs: { me: HOST } };
  assert.equal(lockedMeta(noDave, { ...noDave, devs: { me: HOST, dave: DAVE } }, DAVE).devs.dave, DAVE);
});

test('a keeper on an older app leaves the round open, as before', () => {
  const m = meta({ keeper: { id: 'al', since: 1, by: null, lastSaveAt: 1 } });
  assert.equal(fullWriter(m, OLD_APP), true);
  assert.equal(holeAllowed(m, 1, OLD_APP), true);
});

test('the host phone is set once, and only by itself', () => {
  const m = meta(); delete m.hostDev;
  assert.equal(lockedMeta(m, { ...m, hostDev: HOST }, HOST).hostDev, HOST);
  assert.equal(lockedMeta(m, { ...m, hostDev: HOST }, OLD_APP).hostDev, undefined);
  assert.equal(lockedMeta(null, { ...m, hostDev: HOST }, STRANGER).hostDev, undefined);
  assert.equal(lockedMeta(meta(), { ...meta(), hostDev: STRANGER }, HOST).hostDev, HOST);
});

test('only the host phone or the keeper stops sharing', () => {
  const m = meta({ keeper: { id: 'dave', since: 1, by: null, lastSaveAt: 1 } });
  assert.equal(removeAllowed(m, HOST), true);
  assert.equal(removeAllowed(m, DAVE), true);
  assert.equal(removeAllowed(m, AL), false);
  assert.equal(removeAllowed(m, OLD_APP), false);
});

test('what a phone without the card sends is what the server keeps', () => {
  const base = meta();
  const local = structuredClone(base);
  local.bets = { value: 99 };            // drifted: never sent
  local.devs = { al: AL };               // a stale copy of the list, plus Al's own seat
  Object.assign(local, askForCard('al', 5));
  const sent = metaToSend(base, local, { editor: false, me: 'al' });
  assert.deepEqual(sent.devs, { me: HOST, dave: DAVE, al: AL });
  assert.equal(sent.hostDev, HOST);
  assert.deepEqual(lockedMeta(base, sent, AL), sent);
});

test('a phone keeps the server list of devices when the server copy arrives', () => {
  const base = meta();
  const local = { ...base, devs: { me: HOST, al: AL } };
  const remote = { ...base, devs: { me: HOST, dave: DAVE, x: 'x'.repeat(64) } };
  const kept = metaToKeep(base, local, remote, { editor: true, me: 'al' });
  assert.deepEqual(kept.devs, { me: HOST, dave: DAVE, x: 'x'.repeat(64), al: AL });
  assert.equal(kept.hostDev, HOST);
  assert.equal(mergeDevs(undefined, undefined, 'al'), undefined);
});

test('a phone puts itself on the round once, without taking a seat from another phone', () => {
  const r = { players: [{ id: 'me' }, { id: 'dave' }], devs: { dave: DAVE } };
  assert.deepEqual(registerDevice(r, 'me', HOST, true), { hostDev: HOST, devs: { dave: DAVE, me: HOST } });
  assert.equal(registerDevice(r, 'dave', AL, false), null);
  assert.equal(registerDevice(r, 'watcher', AL, false), null);
  assert.equal(registerDevice(r, 'me', null, true), null);
});
