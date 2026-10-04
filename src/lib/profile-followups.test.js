// Profile follow-ups (Trevor's answers to the Overnight 6 review): the critters shelf and more
// Ball buddies, "Everyone" for who sees your money (and the SQL that goes with it), and a friend's
// own profile name and payment app winning over what this phone saved for them. No money changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, roundResults } from './round.js';
import { nameOf, outstanding, tabBalances } from './ledger.js';
import { payInfoFor, profilePayInfo, savedPayInfo } from './pay.js';
import { theirName, theirProfile } from './their-profile.js';
import {
  applyPeople, fromRow, moneyShown, normalizeAvatar, normalizePrivacy, profileOf, profileStats, shareableStats, toRow,
} from './profile-model.js';
import { friendView, moneyHelp, privacySummary, statTiles, whoSees } from './profile-view.js';
import { BACKDROPS, BUDDIES, SHELVES, avatarLabel, avatarModel, buddyAvatar, noTwins, shelfOf } from './avatars.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 9, 3, 18);
const DAY = 864e5;

/** A finished 9-hole skins round; `wins` is [[winner, hole], ...], every other hole halved. */
function round(id, players, wins = [], daysAgo = 1) {
  const settings = { hcPct: 100, skins: { value: 5, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players, settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(players.map(p => [p.id, 4]));
  for (const [w, no] of wins) r.scores[no][w] = 3;
  r.status = 'done';
  r.createdAt = r.finishedAt = NOW - daysAgo * DAY;
  return r;
}
const stateOf = (rounds, extra = {}) => ({
  me: 't', onboarded: true, players: {}, crews: {}, customCourses: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
  settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [], profile: {}, accountOf: {}, profiles: {}, ...extra,
});

// Trevor, Sam (saved as "Sammy" with Cash App, and on a second id from a joined round), and Ann
function phone(extra = {}) {
  const r1 = round('r1', [{ id: 't', name: 'Trevor' }, { id: 'sam', name: 'Sammy', payApp: 'cashapp', payHandle: 'sam-cash' }, { id: 'ann', name: 'Ann' }], [['sam', 1], ['t', 2]], 3);
  const r2 = round('r2', [{ id: 't', name: 'Trevor' }, { id: 'sam2', name: 'Sam from the link' }, { id: 'ann', name: 'Ann' }], [['ann', 4], ['sam2', 5]], 1);
  return stateOf([r1, r2], {
    players: {
      t: { id: 't', name: 'Trevor', payApp: 'venmo', payHandle: 'trev' },
      sam: { id: 'sam', name: 'Sammy', payApp: 'cashapp', payHandle: 'sam-cash' },
      ann: { id: 'ann', name: 'Ann', payApp: 'paypal', payHandle: 'annp' },
    },
    ...extra,
  });
}
const linked = (profiles = {}, extra = {}) => phone({ accountOf: { t: 'acct-t', sam: 'acct-sam', sam2: 'acct-sam', ann: 'acct-ann' }, profiles, ...extra });
const SAM = { name: 'Sam Rivera', payApp: 'venmo', payHandle: 'samr', avatar: null, stats: null };

// ------------------------------- avatars: shelves ----------------------------

test('shelves: Ball buddies and critters, every buddy on one, and each shelf fills whole rows of four', () => {
  assert.deepEqual(SHELVES.map(s => s.id), ['buddies', 'critters']);
  const known = new Set(SHELVES.map(s => s.id));
  for (const b of BUDDIES) assert.ok(known.has(b.shelf), `${b.id} is on a shelf`);
  assert.equal(new Set(BUDDIES.map(b => b.id)).size, BUDDIES.length, 'ids are unique across shelves');
  for (const s of SHELVES) assert.equal(shelfOf(s.id).length % 4, 0, `${s.name} fills its rows`);
  assert.deepEqual(shelfOf('critters').slice(0, 3).map(b => b.name), ['Birdie', 'Eagle', 'Goose'], 'the design study’s three lead the critters');
  assert.ok(shelfOf('buddies').length >= 16, 'more Ball buddies than before');
  assert.ok(shelfOf('critters').length >= 8);
});

test('shelves: every buddy and critter has its own drawing', () => {
  const art = readFileSync(new URL('../components/BuddyArt.jsx', import.meta.url), 'utf8');
  for (const b of BUDDIES) assert.match(art, new RegExp(`\\n  ${b.id}: \\(\\) => \\(`), `${b.id} is drawn`);
});

test('critters: saved like any buddy, survive the server round trip, and draw on their backdrop', () => {
  const bgs = new Set(BACKDROPS.map(b => b.id));
  for (const b of shelfOf('critters')) assert.ok(bgs.has(b.bg), `${b.id} starts on a known backdrop`);
  assert.deepEqual(buddyAvatar('eagle'), { kind: 'buddy', id: 'eagle', bg: 'teal' });
  assert.deepEqual(buddyAvatar('goose', 'mint'), { kind: 'buddy', id: 'goose', bg: 'mint' });
  const back = fromRow({ display_name: 'Sam', avatar: buddyAvatar('birdie', 'peach') }).avatar;
  assert.deepEqual(back, { kind: 'buddy', id: 'birdie', bg: 'peach' });
  assert.deepEqual(avatarModel(back, { name: 'Sam' }), { kind: 'buddy', buddy: 'birdie', bg: 'peach' });
  assert.equal(avatarLabel(back), 'Birdie');
  assert.deepEqual(normalizeAvatar(buddyAvatar('tam')), { kind: 'buddy', id: 'tam', bg: 'peach' });
});

test('critters: an app that doesn’t know one yet shows initials on its backdrop, and twins still split', () => {
  // What an older app does with a buddy it has never heard of (the same rule this app uses)
  assert.deepEqual(avatarModel({ kind: 'buddy', id: 'albatross', bg: 'teal' }, { name: 'Sam' }), { kind: 'initials', text: 'S', bg: 'teal' });
  assert.equal(avatarLabel({ kind: 'buddy', id: 'albatross' }), 'A character');
  const two = noTwins([avatarModel(buddyAvatar('goose')), avatarModel(buddyAvatar('goose'))]);
  assert.equal(two[0].bg, 'lav');
  assert.notEqual(two[1].bg, 'lav', 'the second goose moves to another backdrop');
});

// ------------------------------- privacy: Everyone ---------------------------

// Money's 'everyone' from Overnight 6 is now the profile-wide setting (o7a privacy): these hold
// what a profile saved with it reads as today.
test('everyone: money saved as everyone becomes Show my money on a played-with profile', () => {
  const p = normalizePrivacy({ money: 'everyone' });
  assert.equal(p.profile, 'played', 'the rest of the profile doesn’t widen');
  assert.equal(p.showMoney, true);
  assert.equal(p.money, 'played', 'the older key now says played, the same people today');
  assert.equal(normalizePrivacy({}).showMoney, false, 'money still hidden by default');
  assert.equal(normalizePrivacy({ profile: 'everyone', showMoney: true }).money, 'everyone', 'Everyone with money on keeps the older key at everyone');
});

test('everyone: money goes out with your profile; only you keeps it in; hidden money never leaves', () => {
  const s = phone();
  const stats = profileStats(s);
  const row = toRow(profileOf({ ...s, profile: { privacy: { profile: 'everyone', showMoney: true } } }), 'acct-t', stats);
  assert.equal(row.privacy.money, 'everyone');
  assert.equal(row.privacy.profile, 'everyone');
  assert.deepEqual(row.stats.money, stats.money);
  assert.deepEqual(shareableStats(stats, { profile: 'hidden', showMoney: true }), {});
  assert.equal(toRow(profileOf(s), 'acct-t', stats).stats.money, undefined, 'the default still keeps money on the phone');
});

test('everyone: the words say who that is today, honestly', () => {
  assert.equal(whoSees({ profile: 'everyone' }), 'Everyone');
  assert.equal(whoSees({}), 'People you’ve played with');
  assert.equal(whoSees({ profile: 'hidden' }), 'Only you');
  assert.match(moneyHelp({ profile: 'everyone', showMoney: true }), /Anyone who opens your profile/);
  assert.match(moneyHelp({}), /Nobody else sees them/);
  assert.equal(moneyShown({ profile: 'hidden', showMoney: true }), false);
  const tiles = statTiles(profileStats(phone()), { mine: true, privacy: { profile: 'everyone', showMoney: true } });
  assert.equal(tiles.find(t => t.key === 'net').onlyYou, false, 'your own money isn’t marked Only you');
  assert.match(privacySummary({ profile: 'everyone', showMoney: true }), /^Anyone who opens your profile sees/);
});

test('everyone: an old server leaves money out, and the app shows a friend without it', () => {
  // Before 2026-10-03-privacy-everyone.sql runs, people_profiles() strips money for anything but
  // 'played': the friend's row comes back with stats and no money
  const d = { me: 't', accountOf: {}, profiles: {} };
  applyPeople(d, [{ player_id: 'sam', user_id: 'acct-sam', visible: true, display_name: 'Sam', stats: { rounds: 4, record: { won: 2, lost: 2, even: 0 } } }], { asked: ['sam'], myAccount: 'acct-t' });
  const fv = friendView({ ...d.profiles['acct-sam'], mine: false });
  assert.deepEqual(fv.tiles.map(t => t.key), ['rounds', 'record', 'game'], 'no money tiles, nothing breaks');
  // After it runs, money comes back too
  applyPeople(d, [{ player_id: 'sam', user_id: 'acct-sam', visible: true, display_name: 'Sam', stats: { rounds: 4, money: { net: 12, best: 10, rounds: 3 } } }], { asked: ['sam'], myAccount: 'acct-t' });
  assert.ok(friendView({ ...d.profiles['acct-sam'], mine: false }).tiles.some(t => t.key === 'net'));
});

test('everyone SQL: a new dated file that changes only the money rule of people_profiles()', () => {
  const read = f => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), 'utf8');
  const fn = sql => sql.slice(sql.indexOf('create or replace function public.people_profiles'), sql.indexOf('$$;', sql.indexOf('create or replace function public.people_profiles')) + 3);
  const old = fn(read('2026-10-01-profiles.sql'));
  const next = fn(read('2026-10-03-privacy-everyone.sql'));
  const oldLine = "when p.privacy ->> 'money' = 'played' or a.user_id = (select auth.uid()) then p.stats";
  const newLine = "when p.privacy ->> 'money' in ('played', 'everyone') or a.user_id = (select auth.uid()) then p.stats";
  assert.ok(old.includes(oldLine), 'the run file is untouched');
  assert.equal(next, old.replace(oldLine, newLine), 'everything else is the same function');
  const file = read('2026-10-03-privacy-everyone.sql');
  assert.match(file, /grant execute on function public\.people_profiles\(text\[\]\) to authenticated/);
  assert.doesNotMatch(file, /drop table|alter table|create table/i, 'no table changes');
});

// ------------------------------- their profile wins --------------------------

test('names: a friend’s own profile name wins over what you saved and what a round says, by any of their ids', () => {
  const s = linked({ 'acct-sam': SAM });
  assert.equal(nameOf(s, 'sam'), 'Sam Rivera');
  assert.equal(nameOf(s, 'sam2'), 'Sam Rivera', 'the seat from the link too');
  assert.equal(nameOf(phone(), 'sam'), 'Sammy', 'no profile: what you saved');
  assert.equal(nameOf(phone(), 'sam2'), 'Sam from the link', 'no profile and not saved: the round’s name');
  assert.equal(nameOf(s, 'ann'), 'Ann', 'Ann’s profile isn’t on this phone (not visible): what you saved');
  assert.equal(nameOf(linked({ 'acct-sam': { ...SAM, name: null } }), 'sam'), 'Sammy', 'a profile with no name falls back');
  assert.equal(nameOf(linked({ 'acct-sam': { ...SAM, name: '   ' } }), 'sam'), 'Sammy', 'a blank name falls back');
});

test('names: never your own from a profile, and a merged duplicate goes by the profile name too', () => {
  const s = linked({ 'acct-sam': SAM, 'acct-t': { name: 'Someone else', payApp: 'zelle', payHandle: 'x' } });
  assert.equal(nameOf(s, 't'), 'Trevor', 'your name is your player card');
  assert.equal(theirProfile(s, 't'), null);
  assert.deepEqual(payInfoFor(s, 't'), { app: 'venmo', handle: 'trev' });
  const merged = linked({ 'acct-sam': SAM });
  merged.players.dup = { id: 'dup', name: 'S.R.', mergedInto: 'sam' };
  assert.equal(nameOf(merged, 'dup'), 'Sam Rivera');
  assert.equal(theirName(merged, 'nobody'), null);
});

test('pay: a friend’s own app wins everywhere; their profile with none falls back to what you saved', () => {
  const s = linked({ 'acct-sam': SAM });
  assert.deepEqual(payInfoFor(s, 'sam'), { app: 'venmo', handle: 'samr' });
  assert.deepEqual(payInfoFor(s, 'sam2'), { app: 'venmo', handle: 'samr' });
  assert.deepEqual(profilePayInfo(s, 'sam'), { app: 'venmo', handle: 'samr' });
  assert.deepEqual(savedPayInfo(s, 'sam'), { app: 'cashapp', handle: 'sam-cash' }, 'what you saved is kept as the fallback');
  const none = linked({ 'acct-sam': { ...SAM, payApp: null, payHandle: null } });
  assert.deepEqual(payInfoFor(none, 'sam'), { app: 'cashapp', handle: 'sam-cash' });
  const noHandle = linked({ 'acct-sam': { ...SAM, payApp: 'venmo', payHandle: null } });
  assert.deepEqual(payInfoFor(noHandle, 'sam'), { app: 'cashapp', handle: 'sam-cash' }, 'an app with no handle can’t pay, so it falls back');
  assert.deepEqual(payInfoFor(linked({ 'acct-sam': SAM }), 'ann'), { app: 'paypal', handle: 'annp' });
  assert.equal(profilePayInfo(phone(), 'sam'), null);
});

test('money: their profile changes names and pay buttons only, never an amount', () => {
  const before = phone({ accountOf: { t: 'acct-t', sam: 'acct-sam', sam2: 'acct-sam', ann: 'acct-ann' } });
  const after = linked({ 'acct-sam': SAM, 'acct-ann': { name: 'Annie', payApp: 'zelle', payHandle: 'ann@x.com' } });
  for (const id of ['r1', 'r2']) assert.deepEqual(roundResults(after.rounds[id]).balances, roundResults(before.rounds[id]).balances, `${id} pays the same`);
  assert.deepEqual(tabBalances(after), tabBalances(before));
  assert.deepEqual(outstanding(after, { now: NOW }), outstanding(before, { now: NOW }));
  assert.equal(nameOf(after, 'ann'), 'Annie');
  // And with no profiles at all, the names are the ones this phone saved, as before
  const plain = phone();
  assert.deepEqual(['t', 'sam', 'ann'].map(id => nameOf(plain, id)), ['Trevor', 'Sammy', 'Ann']);
});
