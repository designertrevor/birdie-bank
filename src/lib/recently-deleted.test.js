// Recently deleted: a deleted round leaves the Tab, History and stats, comes back exactly with
// Restore, goes for good after 30 days, and a delete or a restore reaches your other phones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import { roundsInRange } from './history.js';
import { seasonRounds } from './season.js';
import { applyDoc, hashAll, outgoing, toDocs } from './cloud-model.js';
import { mergeBackup } from './backup.js';
import { KEEP_DAYS, daysLeftLabel, deletedAgoLabel, deletedList, purgeDeleted, restoreRound, softDeleteRound } from './recently-deleted.js';

const DAY = 864e5;
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'pot' } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: id.toUpperCase(), index: 0 }));
const NOW = Date.UTC(2026, 9, 17, 12);

function round(id, ids, holes, at) {
  const r = createRound({ id, game: 'stroke', course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.createdAt = at;
  r.finishedAt = at;
  return r;
}

function phone() {
  const r1 = round('r1', ['me', 'mike'], { 1: { me: 3, mike: 4 } }, NOW - 5 * DAY); // mike owes me 5
  const r2 = round('r2', ['me', 'chris'], { 1: { me: 4, chris: 3 } }, NOW - 2 * DAY); // I owe chris 5
  return {
    me: 'me', players: { me: { id: 'me', name: 'Me' }, mike: { id: 'mike', name: 'Mike' }, chris: { id: 'chris', name: 'Chris' } },
    crews: {}, customCourses: {}, rounds: { r1, r2 }, deletedRounds: {}, activeRoundId: null,
    settlements: [{ id: 's1', from: 'chris', to: 'me', amount: 2, at: NOW - DAY, roundId: 'r2' }],
    talk: { 'round:r2': { t1: { id: 't1', text: 'Nice putt' } } },
  };
}
const ALL = { kind: 'all' };

test('a deleted round adds nothing to the Tab, History or the season', () => {
  const s = phone();
  assert.notDeepEqual(tabBalances(s), {});
  assert.ok(softDeleteRound(s, 'r2', NOW));
  assert.equal(s.rounds.r2, undefined);
  assert.equal(s.deletedRounds.r2.deletedAt, NOW);
  // Exactly the Tab and History with only r1 in them
  const only = phone(); delete only.rounds.r2; only.settlements = [];
  assert.deepEqual(tabBalances(s), tabBalances(only));
  assert.deepEqual(outstanding(s, { now: NOW }), outstanding(only, { now: NOW }));
  assert.deepEqual(roundsInRange(s, ALL).map(r => r.id), ['r1']);
  assert.ok(!seasonRounds(s, 2026).some(r => r.id === 'r2'));
  // Its payment and talk went with it
  assert.deepEqual(s.settlements, []);
  assert.equal(s.talk['round:r2'], undefined);
});

test('restore brings the money back exactly, payments and talk too', () => {
  const s = phone();
  const before = { bal: tabBalances(s), out: outstanding(s, { now: NOW }), hist: roundsInRange(s, ALL).map(r => r.id), pays: structuredClone(s.settlements), talk: structuredClone(s.talk) };
  softDeleteRound(s, 'r2', NOW);
  assert.ok(restoreRound(s, 'r2'));
  assert.deepEqual(tabBalances(s), before.bal);
  assert.deepEqual(outstanding(s, { now: NOW }), before.out);
  assert.deepEqual(roundsInRange(s, ALL).map(r => r.id), before.hist);
  assert.deepEqual(s.settlements, before.pays);
  assert.deepEqual(s.talk, before.talk);
  assert.deepEqual(s.rounds.r2, phone().rounds.r2);
  assert.deepEqual(s.deletedRounds, {});
});

test('a round deleted while still being played comes back in play', () => {
  const s = phone();
  s.rounds.r1.status = 'active';
  s.activeRoundId = 'r1';
  softDeleteRound(s, 'r1', NOW);
  assert.equal(s.activeRoundId, null);
  restoreRound(s, 'r1');
  assert.equal(s.activeRoundId, 'r1');
});

test('the list says when it went and how long is left, and rounds go for good after 30 days', () => {
  const s = phone();
  softDeleteRound(s, 'r1', NOW - 3 * DAY);
  softDeleteRound(s, 'r2', NOW - (KEEP_DAYS + 1) * DAY);
  assert.deepEqual(deletedList(s, NOW).map(r => r.id), ['r1']);
  assert.equal(deletedAgoLabel(s.deletedRounds.r1, NOW), 'Deleted 3 days ago');
  assert.equal(daysLeftLabel(s.deletedRounds.r1, NOW), '27 days left');
  assert.equal(deletedAgoLabel({ deletedAt: NOW }, NOW), 'Deleted today');
  assert.equal(daysLeftLabel({ deletedAt: NOW - 29.5 * DAY }, NOW), '1 day left');
  assert.equal(purgeDeleted(s, NOW), 1);
  assert.deepEqual(Object.keys(s.deletedRounds), ['r1']);
  // Nothing comes back from a purged round
  assert.equal(restoreRound(s, 'r2'), false);
  assert.equal(s.rounds.r2, undefined);
  assert.equal(purgeDeleted(s, NOW), 0);
});

/** Send this phone's changes to the "server" and bring them into another phone, the way cloud.js does. */
function syncAcross(from, to, shadow) {
  const sent = outgoing(toDocs(from), shadow);
  for (const o of sent) {
    applyDoc(to, o.kind, o.id, o.deleted ? null : o.data);
    shadow[o.key] = o.deleted ? 'null' : hashAll({ x: { data: o.data } }).x;
  }
  return sent;
}

test('a delete reaches your other phone and stays deleted, and so does a restore', () => {
  const a = phone(), b = phone();
  const shadow = hashAll(toDocs(a));
  softDeleteRound(a, 'r2', NOW);
  const sent = syncAcross(a, b, shadow);
  // The round goes up as an edit (deletedAt inside), never as a removed row
  const doc = sent.find(o => o.key === 'round:r2');
  assert.equal(doc.deleted, false);
  assert.equal(doc.data.deletedAt, NOW);
  assert.equal(b.rounds.r2, undefined);
  assert.equal(b.deletedRounds.r2.deletedAt, NOW);
  assert.deepEqual(tabBalances(b), tabBalances(a));
  assert.deepEqual(roundsInRange(b, ALL).map(r => r.id), ['r1']);
  // Nothing to send back: the two phones agree
  assert.deepEqual(outgoing(toDocs(b), shadow), []);
  // Restore on the other phone, and it comes back on the first
  restoreRound(b, 'r2');
  syncAcross(b, a, shadow);
  assert.ok(a.rounds.r2);
  assert.equal(a.rounds.r2.deletedAt, undefined);
  assert.deepEqual(a.deletedRounds, {});
  assert.deepEqual(tabBalances(a), tabBalances(phone()));
  assert.deepEqual(a.settlements, phone().settlements);
});

test('a round gone for good is a removed row, and leaves the other phone too', () => {
  const a = phone(), b = phone();
  const shadow = hashAll(toDocs(a));
  softDeleteRound(a, 'r2', NOW - 40 * DAY);
  syncAcross(a, b, shadow);
  purgeDeleted(a, NOW);
  const sent = syncAcross(a, b, shadow);
  assert.ok(sent.some(o => o.key === 'round:r2' && o.deleted));
  assert.equal(b.rounds.r2, undefined);
  assert.equal(b.deletedRounds.r2, undefined);
});

test('a backup keeps Recently deleted, and a round this phone deleted stays deleted', () => {
  const s = phone();
  softDeleteRound(s, 'r2', NOW);
  const { state: merged } = mergeBackup(s, phone());
  assert.equal(merged.rounds.r2, undefined);
  assert.ok(merged.deletedRounds.r2);
  const fresh = phone(); delete fresh.rounds.r2;
  const { state: back } = mergeBackup(fresh, s);
  assert.ok(back.deletedRounds.r2);
  assert.equal(back.rounds.r2, undefined);
});
