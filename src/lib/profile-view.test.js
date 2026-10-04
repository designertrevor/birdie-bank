// Profile screens: the privacy rules (money hidden by default, your own phone always shows yours,
// someone else's numbers only when their profile carries them) and the basic stats a profile shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { money as fmtMoney } from './golf.js';
import { PRIVACY_DEFAULTS, profileStats, shareableStats, toRow } from './profile-model.js';
import { friendView, privacySummary, profileSubline, recordText, sinceText, statTiles, whoSees } from './profile-view.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 9, 1, 18);
const DAY = 864e5;

/** A finished 9-hole round; `wins` is [[winner, hole], ...], every other hole halved. */
function round(id, ids, wins = [], { daysAgo = 1, playFor, game = 'skins' } = {}) {
  const settings = { hcPct: 100, skins: { value: 5, carryover: true }, nassau: { front: 5, back: 5, total: 5, pressMode: 'off' } };
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [w, no] of wins) r.scores[no][w] = 3;
  r.status = 'done';
  r.createdAt = r.finishedAt = NOW - daysAgo * DAY;
  if (playFor) r.playFor = playFor;
  return r;
}
const stateOf = (rounds, extra = {}) => ({
  me: 't', onboarded: true, players: { t: { id: 't', name: 'Trevor' } }, crews: {}, customCourses: {},
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [],
  profile: {}, accountOf: {}, profiles: {}, ...extra,
});
const fmtIndex = v => (v < 0 ? `+${-v}` : String(v));
const tile = (tiles, key) => tiles.find(t => t.key === key);

// Trevor wins a skins round (+$10, two skins), loses one (three carried skins, -$15), and loses a points round
function season() {
  return stateOf([
    round('r1', ['t', 'sam'], [['t', 1], ['t', 2]], { daysAgo: 30 }),
    round('r2', ['t', 'sam', 'ann'], [['sam', 3]], { daysAgo: 10 }),
    round('r3', ['t', 'ann'], [['ann', 1]], { daysAgo: 2, playFor: { kind: 'points' } }),
  ]);
}

// ------------------------------- privacy rules ---------------------------------

test('privacy: money is hidden by default, and the screen says only you see it', () => {
  assert.equal(PRIVACY_DEFAULTS.showMoney, false);
  assert.equal(PRIVACY_DEFAULTS.money, 'hidden');
  assert.equal(whoSees({}), 'People you’ve played with');
  assert.match(privacySummary({}), /Your money is only for you/);
  assert.equal(privacySummary({}), 'People you’ve played with see your name, avatar, record, stats, handicap and home course. Your money is only for you.');
  assert.equal(privacySummary({ profile: 'played', showMoney: true }), 'People you’ve played with see your name, avatar, record, stats, handicap, home course and money.');
  assert.equal(privacySummary({ profile: 'hidden' }), 'Everything on your profile is only for you, except your name and avatar in rounds you play.');
  assert.equal(privacySummary({ money: 'hidden', stats: 'hidden', handicap: 'hidden', homeCourse: 'hidden' }), privacySummary({ profile: 'hidden' }), 'everything hidden before reads as only you');
});

test('privacy: your own phone always shows your own money, marked only you while it’s hidden', () => {
  const stats = profileStats(season());
  const hidden = statTiles(stats, { mine: true, privacy: {} });
  assert.ok(tile(hidden, 'net'), 'net shows on your phone');
  assert.ok(tile(hidden, 'best'), 'best round shows on your phone');
  assert.equal(tile(hidden, 'net').onlyYou, true);
  assert.equal(tile(hidden, 'best').onlyYou, true);
  assert.equal(tile(hidden, 'rounds').onlyYou, false, 'your record is seen by default');
  const shown = statTiles(stats, { mine: true, privacy: { profile: 'played', showMoney: true } });
  assert.equal(tile(shown, 'net').onlyYou, false);
  // Only you: everything is marked, money too even with the switch left on
  const onlyYou = statTiles(stats, { mine: true, privacy: { profile: 'hidden', showMoney: true } });
  assert.equal(tile(onlyYou, 'rounds').onlyYou, true, 'a hidden record is marked too');
  assert.equal(tile(onlyYou, 'net').onlyYou, true);
  assert.equal(tile(onlyYou, 'best').onlyYou, true);
});

test('privacy: hidden money never reaches anyone else, so their card has no money tiles', () => {
  const stats = profileStats(season());
  // What goes to the server with the default privacy, and what a friend's phone then shows
  const row = toRow({ name: 'Trevor', playerId: 't', privacy: {} }, 'acct-t', stats);
  assert.equal(row.stats.money, undefined, 'money never left the phone');
  const theirs = friendView({ name: 'Trevor', stats: row.stats, mine: false });
  assert.ok(tile(theirs.tiles, 'rounds'));
  assert.equal(tile(theirs.tiles, 'net'), undefined);
  assert.equal(tile(theirs.tiles, 'best'), undefined);
  // Shown on purpose: it's on their card
  const open = toRow({ name: 'Trevor', playerId: 't', privacy: { money: 'played' } }, 'acct-t', stats);
  const view = friendView({ name: 'Trevor', stats: open.stats, mine: false });
  assert.equal(tile(view.tiles, 'net').value, fmtMoney(stats.money.net, { sign: true }));
  assert.equal(tile(view.tiles, 'best').value, '+$10');
});

test('privacy: a hidden record sends no stats, and a friend’s card then shows none, even with money set to show', () => {
  const stats = profileStats(season());
  assert.deepEqual(shareableStats(stats, { stats: 'hidden', money: 'played' }), {});
  assert.deepEqual(friendView({ stats: {}, mine: false }).tiles, []);
  assert.deepEqual(friendView({ stats: null, mine: false }).tiles, []);
});

test('privacy: a friend’s handicap and home course show only when their profile has them', () => {
  const v = friendView({ index: 8.2, homeCourse: { id: 'c', name: 'Birch Creek' }, stats: null, mine: false });
  assert.equal(v.index, 8.2);
  assert.equal(v.indexFromProfile, true);
  assert.equal(v.homeCourse.name, 'Birch Creek');
  const hidden = friendView({ index: null, homeCourse: null, mine: false });
  assert.equal(hidden.index, null);
  assert.equal(hidden.homeCourse, null);
  // The handicap you saved for them on this phone wins
  const own = friendView({ index: 8.2, mine: false }, { index: 11 });
  assert.equal(own.index, 11);
  assert.equal(own.indexFromProfile, false);
  assert.equal(friendView({ mine: true }), null, 'your own card isn’t a friend view');
  assert.equal(friendView(null), null);
});

// ------------------------------- the stats ---------------------------------------

test('stats: rounds, record, favorite game, best round and net, from the rounds on this phone', () => {
  const s = season();
  const stats = profileStats(s);
  const tiles = statTiles(stats, { mine: true, privacy: {} });
  assert.equal(tile(tiles, 'rounds').value, '3');
  assert.equal(tile(tiles, 'record').value, '1\u20132', 'won one, lost two (the points round counts in the record)');
  assert.equal(tile(tiles, 'game').value, 'Skins');
  assert.equal(tile(tiles, 'best').value, '+$10');
  // Net is the money rounds only, and matches the rounds' own results exactly
  const money = ['r1', 'r2'].reduce((a, id) => a + roundResults(s.rounds[id]).balances.t, 0);
  assert.equal(money, -5, 'two skins won, then three carried skins lost');
  assert.equal(tile(tiles, 'net').value, fmtMoney(-5, { sign: true }));
  assert.equal(tile(tiles, 'net').sub, '2 rounds for money');
  assert.equal(tile(tiles, 'net').tone, 'neg');
});

test('stats: nothing played shows nothing, and no money rounds reads as a dash', () => {
  assert.deepEqual(statTiles(profileStats(stateOf([])), { mine: true }).map(t => t.value), ['0', '0\u20130', '–', '–', '–']);
  const pts = stateOf([round('p1', ['t', 'ann'], [['t', 1]], { playFor: { kind: 'points' } })]);
  const tiles = statTiles(profileStats(pts), { mine: true });
  assert.equal(tile(tiles, 'net').value, '–', 'a points round is never money');
  assert.equal(tile(tiles, 'net').sub, 'No money rounds yet');
  assert.equal(tile(tiles, 'best').value, '–');
  assert.deepEqual(statTiles(null), []);
});

test('stats: the words around them', () => {
  assert.equal(recordText({ won: 4, lost: 2, even: 1 }), '4\u20132\u20131');
  assert.equal(recordText({ won: 4, lost: 2, even: 0 }), '4\u20132');
  assert.equal(recordText(null), '–');
  assert.equal(sinceText(Date.UTC(2026, 8, 15)), 'Playing since Sep 2026');
  assert.equal(sinceText(null), null);
  assert.equal(profileSubline({ index: 12.4, homeCourse: { name: 'Birch Creek' } }, fmtIndex), 'Index 12.4 · Birch Creek');
  assert.equal(profileSubline({ index: null, homeCourse: null }, fmtIndex), 'No handicap index');
  // A favorite game this app doesn't know keeps the name it came with
  assert.equal(tile(statTiles({ rounds: 2, record: { won: 1, lost: 1, even: 0 }, favoriteGame: { id: 'future', name: 'Bingo Bango' } }), 'game').value, 'Bingo Bango');
});
