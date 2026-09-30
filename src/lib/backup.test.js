// The backup file: a round trip keeps everything (and every round's money), "Add what's missing"
// never duplicates or overwrites, and bad files are turned away with a friendly message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import {
  BACKUP_FORMAT, addedText, BACKUP_VERSION, backupFileName, backupText, countsOf, makeBackup, mergeBackup, parseBackup,
  replaceFromBackup, summaryText,
} from './backup.js';
import { MAX_USUALS } from './usuals.js';

const course = {
  id: 'cc_pebble', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'White', color: '#fff', rating: 70, slope: 120 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, nassau: { front: 5, back: 5, total: 5 }, dots: { value: 1, auto: true, kinds: { greenie: true } } };

function played(id, ids, players) {
  const r = createRound({
    id, game: 'skins', course, holesCount: 18, nine: 'front',
    players: ids.map(p => ({ ...players[p], tee: 'White' })), settings: SETTINGS, hcPct: 100,
  });
  r.holes.forEach((h, i) => { r.scores[h.no] = Object.fromEntries(ids.map((p, k) => [p, 4 + ((i + k) % 3) - 1])); });
  r.status = 'done';
  r.finishedAt = 1_700_000_000_000;
  return r;
}

function fresh() {
  return {
    version: 1, onboarded: false, me: null, players: {}, crews: {}, customCourses: {}, favorites: [], starredCourses: [],
    rounds: {}, activeRoundId: null, settlements: [], carries: [], tabRows: {}, plans: {}, usuals: [], links: {}, unlinks: [],
    rewardsDone: {}, settings: { theme: 'system', hcPct: 100, dots: { value: 1, kinds: { greenie: true, hogan: false } }, rev: 3 },
  };
}

function phone() {
  const players = {
    me: { id: 'me', name: 'Trevor Nielsen', index: 8 },
    dave: { id: 'dave', name: 'Dave Smith', index: 12 },
    al: { id: 'al', name: 'Al Brown', index: 4 },
  };
  return {
    ...fresh(), onboarded: true, me: 'me', players,
    crews: { c1: { id: 'c1', name: 'Saturday', players: ['me', 'dave', 'al'] } },
    customCourses: { cc_pebble: { ...course, holes: course.holes.map((h, i) => (i === 3 ? { ...h, par: 5 } : h)) } },
    rounds: { r1: played('r1', ['me', 'dave', 'al'], players), r2: played('r2', ['me', 'dave'], players) },
    settlements: [{ id: 's1', from: 'dave', to: 'me', amount: 12, at: 1 }],
    carries: [{ id: 'k1', from: 'al', to: 'me', amount: 3, at: 2 }],
    plans: { p1: { id: 'p1', when: '2026-10-04', courseId: 'cc_pebble' } },
    usuals: [{ id: 'u1', name: 'Saturday skins', game: 'skins' }],
    links: { dave2: 'dave' }, unlinks: [['al', 'dave']], favorites: ['cc_pebble'], starredCourses: ['cc_pebble'],
    rewardsDone: { 'r1:dave>me': 5 }, tabRows: { 'X|a': { id: 'a', status: 'paid' } },
    settings: { ...fresh().settings, theme: 'dark', hcPct: 90 },
  };
}

test('the file name carries the date', () => {
  assert.equal(backupFileName(new Date(2026, 8, 30, 21, 5)), 'birdie-bank-backup-2026-09-30.json');
});

test('a backup round trip keeps everything, and every round gives the same money', () => {
  const s = phone();
  const text = backupText(s, { now: new Date('2026-09-30T12:00:00Z') });
  const got = parseBackup(text);
  assert.equal(got.ok, true);
  assert.equal(got.legacy, false);
  assert.equal(got.createdAt, '2026-09-30T12:00:00.000Z');
  assert.deepEqual(got.data, s);
  assert.deepEqual(got.counts, { rounds: 2, players: 3, courses: 1, plans: 1, payments: 1, usuals: 1 });
  const back = replaceFromBackup(fresh(), got.data);
  for (const id of ['r1', 'r2']) assert.deepEqual(roundResults(back.rounds[id]), roundResults(s.rounds[id]));
  assert.deepEqual(back.customCourses, s.customCourses);
  assert.deepEqual(back.settlements, s.settlements);
  assert.equal(back.settings.theme, 'dark');
  assert.equal(back.settings.hcPct, 90);
});

test('the header says what made it', () => {
  const b = makeBackup(phone());
  assert.equal(b.format, BACKUP_FORMAT);
  assert.equal(b.backupVersion, BACKUP_VERSION);
  assert.equal(b.stateVersion, 1);
});

test('the summary reads like a person wrote it', () => {
  assert.equal(summaryText({ rounds: 42, players: 9, courses: 3, plans: 0, payments: 0, usuals: 0 }), '42 rounds, 9 players, 3 courses');
  assert.equal(summaryText({ rounds: 1, players: 1, courses: 0, plans: 2, payments: 1, usuals: 0 }), '1 round, 1 player, 2 planned rounds, 1 payment');
  assert.equal(summaryText(countsOf(fresh())), '0 rounds, 0 players');
  assert.equal(addedText({ rounds: 3, players: 1, courses: 0, plans: 0, payments: 0, usuals: 0 }), '3 rounds, 1 player');
  assert.equal(addedText({ rounds: 0, players: 0, courses: 0, plans: 0, payments: 0, usuals: 0 }), '');
});

test('add what is missing: nothing duplicates and nothing on the phone is overwritten', () => {
  const backup = phone();
  const mine = phone();
  mine.players.dave = { ...mine.players.dave, name: 'Davey' };      // changed on the phone since
  mine.settlements = [{ id: 's1', from: 'dave', to: 'me', amount: 20, at: 1 }];
  mine.settings.theme = 'light';
  delete mine.rounds.r2;
  delete mine.players.al;
  delete mine.customCourses.cc_pebble;
  const { state, added } = mergeBackup(mine, backup);
  assert.deepEqual(Object.keys(state.rounds).sort(), ['r1', 'r2']);
  assert.equal(state.players.dave.name, 'Davey');
  assert.equal(state.players.al.name, 'Al Brown');
  assert.equal(state.settlements.length, 1);
  assert.equal(state.settlements[0].amount, 20);
  assert.equal(state.settings.theme, 'light');
  assert.equal(state.customCourses.cc_pebble.holes[3].par, 5);
  assert.deepEqual(added, { rounds: 1, players: 1, courses: 1, plans: 0, payments: 0, usuals: 0 });
  assert.deepEqual(roundResults(state.rounds.r2), roundResults(backup.rounds.r2));
  // The phone passed in is left alone
  assert.equal(mine.rounds.r2, undefined);

  // Merging the same file twice adds nothing more
  const again = mergeBackup(state, backup);
  assert.deepEqual(again.state, state);
  assert.deepEqual(again.added, { rounds: 0, players: 0, courses: 0, plans: 0, payments: 0, usuals: 0 });
  assert.equal(again.state.favorites.length, 1);
  assert.equal(again.state.unlinks.length, 1);
});

test('add what is missing into a fresh phone takes who you are', () => {
  const { state } = mergeBackup(fresh(), phone());
  assert.equal(state.me, 'me');
  assert.equal(state.onboarded, true);
  assert.equal(state.settings.theme, 'system'); // settings never change on a merge
});

test('a merge keeps usuals under the cap and reversed unlink pairs count as the same', () => {
  const mine = { ...phone(), usuals: Array.from({ length: MAX_USUALS }, (_, i) => ({ id: `m${i}`, name: `U${i}` })), unlinks: [['dave', 'al']] };
  const { state } = mergeBackup(mine, phone());
  assert.equal(state.usuals.length, MAX_USUALS);
  assert.equal(state.unlinks.length, 1);
});

test('replace everything fills keys added since, and never points at a finished round', () => {
  const old = phone();
  delete old.plans; delete old.usuals; delete old.starredCourses; delete old.rewardsDone;
  old.activeRoundId = 'r1';
  old.settings = { theme: 'dark', hcPct: 80, dots: { value: 2, kinds: { greenie: true } } };
  const next = replaceFromBackup(fresh(), old);
  assert.deepEqual(next.plans, {});
  assert.deepEqual(next.usuals, []);
  assert.deepEqual(next.starredCourses, []);
  assert.equal(next.activeRoundId, null);
  assert.equal(next.settings.hcPct, 80);
  assert.equal(next.settings.dots.value, 2);
  assert.equal(next.settings.dots.kinds.hogan, false);
});

test('the old Back up file (the bare state) still restores', () => {
  const got = parseBackup(JSON.stringify(phone()));
  assert.equal(got.ok, true);
  assert.equal(got.legacy, true);
  assert.equal(got.counts.rounds, 2);
});

test('bad files are turned away with a friendly message', () => {
  const bad = [
    'not json at all',
    '[]',
    '"hello"',
    JSON.stringify({ name: 'some other app' }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 1 }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 'x', data: phone() }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 1, data: { ...phone(), rounds: [] } }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 1, data: { ...phone(), rounds: { r1: 'oops' } } }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 1, data: { ...phone(), rounds: { r1: { id: 'r9', players: [] } } } }),
    JSON.stringify({ format: BACKUP_FORMAT, backupVersion: 1, data: { ...phone(), settlements: {} } }),
  ];
  for (const text of bad) {
    const got = parseBackup(text);
    assert.equal(got.ok, false, text.slice(0, 60));
    assert.match(got.error, /backup/i);
    assert.doesNotMatch(got.error, /\u2014|undefined|JSON|Error/);
  }
});

test('a backup from a newer app says to update first', () => {
  const got = parseBackup(JSON.stringify({ ...makeBackup(phone()), backupVersion: BACKUP_VERSION + 1 }));
  assert.equal(got.ok, false);
  assert.match(got.error, /newer version/);
});
