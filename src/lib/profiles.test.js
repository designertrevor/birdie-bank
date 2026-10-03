// Profile foundation: player ids on one account are one person on every phone (no merging by hand),
// the money per round never changes, privacy hides money by default, and the app keeps working
// from the phone's copy while the profiles SQL isn't run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { headToHeadSummary, outstanding, tabBalances } from './ledger.js';
import { linkEdges, linksOf, unmergePerson } from './people-links.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { mergeBackup } from './backup.js';
import {
  PRIVACY_DEFAULTS, applyPeople, cropSquare, fromRow, isNotSetUp, knownPlayerIds, normalizeAvatar,
  normalizeHomeCourse, normalizePrivacy, profileFor, profileOf, profileStats, retryOnLoad, RETRY_OFF_MS,
  serverStateAfter, shareableStats, shows, toRow,
} from './profile-model.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 9, 1, 18);
const DAY = 864e5;

/** A finished 9-hole skins round; `wins` is [[winner, hole], ...], every other hole halved. */
function round(id, ids, wins = [], { daysAgo = 1, localMe, claims, playFor, game = 'skins' } = {}) {
  const settings = { hcPct: 100, skins: { value: 5, carryover: true } };
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [w, no] of wins) r.scores[no][w] = 3;
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (localMe !== undefined) r.localMe = localMe;
  if (claims) r.claims = claims;
  if (playFor) r.playFor = playFor;
  return r;
}
const player = (id, name, createdAt = 1) => ({ id, name, index: null, createdAt });
const stateOf = (me, rounds, extra = {}) => ({
  me, onboarded: true, players: {}, crews: {}, customCourses: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [],
  profile: {}, accountOf: {}, profiles: {}, ...extra,
});
const sum = o => Math.round(Object.values(o).reduce((a, v) => a + v, 0) * 100) / 100;

/**
 * Trevor (t) saved Sam twice by mistake: p_sam on one round, p_sam2 on another. Sam has an
 * account (acct-sam) and claimed both seats on different days, so the server links both ids to his
 * account. Ann (p_ann) has no account.
 */
function organizer(extra = {}) {
  const r1 = round('r1', ['t', 'p_sam', 'p_ann'], [['p_sam', 1], ['p_sam', 2]], { daysAgo: 5 });
  const r2 = round('r2', ['t', 'p_sam2'], [['t', 1]], { daysAgo: 3 });
  const r3 = round('r3', ['t', 'p_ann'], [['p_ann', 4]], { daysAgo: 1, playFor: { kind: 'points' } });
  return stateOf('t', [r1, r2, r3], {
    players: { t: player('t', 'Trevor'), p_sam: player('p_sam', 'Sam', 5), p_sam2: player('p_sam2', 'Sammy', 9), p_ann: player('p_ann', 'Ann', 6) },
    ...extra,
  });
}

// ------------------------------- linking ---------------------------------------

test('accounts: two player records on one account are one person, with no merge by hand', () => {
  const before = organizer();
  assert.notEqual(linksOf(before).personOf('p_sam2'), linksOf(before).personOf('p_sam'), 'apart until the server says');
  const after = organizer({ accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam', t: 'acct-t' } });
  const L = linksOf(after);
  assert.equal(L.personOf('p_sam2'), 'p_sam', 'the older saved player is kept');
  assert.deepEqual(L.groupOf('p_sam'), ['p_sam', 'p_sam2']);
  assert.equal(L.personOf('p_ann'), 'p_ann', 'nobody else moves');
  assert.ok(linkEdges(after).some(e => e.kind === 'account' && e.a === 'p_sam2' && e.b === 'p_sam'));
  assert.equal(after.links && Object.keys(after.links).length, 0, 'nothing was merged by hand');
});

test('accounts: the money per round never changes, and the Tab adds both ids under one person', () => {
  const before = organizer();
  const after = organizer({ accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam' } });
  for (const id of ['r1', 'r2', 'r3']) assert.deepEqual(roundResults(after.rounds[id]).balances, roundResults(before.rounds[id]).balances, `${id} pays the same`);
  const b0 = tabBalances(before), b1 = tabBalances(after);
  assert.equal(sum(b0), 0);
  assert.equal(sum(b1), 0);
  assert.equal(b1.p_sam, Math.round(((b0.p_sam || 0) + (b0.p_sam2 || 0)) * 100) / 100, 'Sam’s two balances add up under one name');
  assert.equal(b1.p_sam2, undefined);
  assert.equal(b1.t, b0.t, 'your own balance is the same');
  const pay = outstanding(after);
  assert.ok(pay.every(p => p.from !== 'p_sam2' && p.to !== 'p_sam2'), 'one payment line for Sam, never two');
  const h2h = headToHeadSummary(after, new Set(['t']));
  assert.equal(h2h.get('p_sam').rounds, 2, 'one record with Sam across both of his records');
});

test('accounts: "Not the same person" breaks an account link and it stays broken', () => {
  const s = organizer({ accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam' } });
  const res = unmergePerson(s, 'p_sam', 'p_sam2');
  assert.ok(res, 'it can be taken apart');
  const next = { ...s, ...res };
  assert.equal(linksOf(next).personOf('p_sam2'), 'p_sam2');
  assert.equal(linksOf(next).personOf('p_sam'), 'p_sam');
  assert.ok(!linkEdges(next).some(e => e.kind === 'account'), 'the broken pair isn’t linked again');
});

test('accounts: two ids on one account that played in the same round stay apart', () => {
  const r = round('r9', ['t', 'x1', 'x2'], [['x1', 1]]);
  const s = stateOf('t', [r], { accountOf: { x1: 'acct-x', x2: 'acct-x' } });
  assert.notEqual(linksOf(s).personOf('x1'), linksOf(s).personOf('x2'));
});

test('accounts: every id on your own account is you, even from a round where you were a guest', () => {
  // You played as g_seat in someone else's round on another phone; the server links it to you
  const r1 = round('r1', ['t', 'p_sam'], [['t', 1]], { daysAgo: 2 });
  const r2 = round('r2', ['host', 'g_seat'], [['g_seat', 1]], { daysAgo: 1 });
  const s = stateOf('t', [r1, r2], { players: { t: player('t', 'Trevor') }, accountOf: { t: 'acct-t', g_seat: 'acct-t' } });
  assert.equal(linksOf(s).personOf('g_seat'), 't');
  assert.equal(profileStats(s).rounds, 2, 'both rounds count as yours');
});

test('accounts: no accountOf (the SQL not run, or an older phone) links exactly as before', () => {
  const plain = organizer();
  const withEmpty = organizer({ accountOf: {} });
  const noKey = organizer();
  delete noKey.accountOf;
  assert.deepEqual(linkEdges(withEmpty), linkEdges(plain));
  assert.deepEqual(linkEdges(noKey), linkEdges(plain));
  assert.deepEqual(tabBalances(noKey), tabBalances(plain));
});

test('accounts: a wrong seat on your own account never gives you two seats in one round', () => {
  // Bob took Dave's seat by mistake, then the right one. If the server still has Dave's seat on
  // Bob's account, Bob's phone must not count both seats as Bob: the round's money would land twice.
  const r = round('r6', ['host', 'z_bob', 'a_dave'], [['a_dave', 1], ['z_bob', 2], ['a_dave', 3]], { localMe: 'z_bob' });
  const plain = stateOf('bobMe', [r], { players: { bobMe: player('bobMe', 'Bob') } });
  const wrong = stateOf('bobMe', [r], { players: { bobMe: player('bobMe', 'Bob') }, accountOf: { bobMe: 'acct-bob', z_bob: 'acct-bob', a_dave: 'acct-bob' } });
  const L = linksOf(wrong);
  assert.equal(L.personOf('z_bob'), 'bobMe', 'the seat you took is you');
  assert.notEqual(L.personOf('a_dave'), 'bobMe', 'Dave’s seat stays Dave');
  assert.deepEqual(tabBalances(wrong), tabBalances(plain), 'the Tab is the same as with no account links');
  assert.equal(profileStats(wrong).money.net, profileStats(plain).money.net);
});

test('accounts: a claim from the round beats a wrong account link on the organizer’s phone', () => {
  // Trevor's phone saw Bob claim z_bob. The server wrongly also has Dave's seat a_dave on Bob's
  // account, and a_dave sorts first. Bob stays Bob and Dave stays Dave.
  const r = round('r5', ['t', 'z_bob', 'a_dave'], [['z_bob', 1], ['a_dave', 2], ['a_dave', 3]], { claims: { z_bob: 'bobMe' } });
  const plain = stateOf('t', [r], { players: { t: player('t', 'Trevor'), z_bob: player('z_bob', 'Bob', 2), a_dave: player('a_dave', 'Dave', 3) } });
  const wrong = { ...plain, accountOf: { bobMe: 'acct-bob', z_bob: 'acct-bob', a_dave: 'acct-bob' } };
  const L = linksOf(wrong);
  assert.equal(L.personOf('bobMe'), 'z_bob', 'Bob’s own id joins the seat he claimed');
  assert.equal(L.personOf('a_dave'), 'a_dave', 'Dave isn’t folded into Bob');
  assert.deepEqual(tabBalances(wrong), tabBalances(plain));
});

// ------------------------------- the server's answer ---------------------------

test('applyPeople: links ids to accounts, keeps profiles you may see, drops ones you may not', () => {
  const d = organizer({ profiles: { 'acct-gone': { name: 'Old' } }, accountOf: { p_old: 'acct-gone' } });
  const rows = [
    { player_id: 'p_sam', user_id: 'acct-sam', visible: true, display_name: 'Sam R.', handicap_index: '8.4', home_course: { id: 'c1', name: 'Pine Hill', place: 'Town' }, avatar: { kind: 'buddy', id: 'buddy-3' }, pay_app: 'venmo', pay_handle: 'samr', stats: { rounds: 4 }, updated_at: '2026-10-01T10:00:00Z' },
    { player_id: 'p_sam2', user_id: 'acct-sam', visible: true, display_name: 'Sam R.' },
    { player_id: 'p_ann', user_id: 'acct-ann', visible: false },
    { player_id: 't', user_id: 'acct-t', visible: false },
  ];
  applyPeople(d, rows, { asked: ['p_sam', 'p_sam2', 'p_ann', 't', 'p_old'], myAccount: 'acct-t' });
  assert.deepEqual(d.accountOf, { p_old: 'acct-gone', p_sam: 'acct-sam', p_sam2: 'acct-sam', p_ann: 'acct-ann', t: 'acct-t' }, 'an id the server stopped linking keeps its link');
  assert.equal(d.profiles['acct-sam'].name, 'Sam R.');
  assert.equal(d.profiles['acct-sam'].index, 8.4);
  assert.equal(d.profiles['acct-sam'].avatar.id, 'buddy-3');
  assert.equal(d.profiles['acct-ann'], undefined, 'not played with: no profile');
  assert.equal(d.profiles['acct-gone'], undefined, 'an account that’s gone loses its profile');
  assert.equal(d.profiles['acct-t'], undefined, 'yours isn’t cached as someone else’s');
  assert.equal(linksOf(d).personOf('p_sam2'), 'p_sam');
});

test('applyPeople: a seat taken off an account that’s still there is unlinked; a gone account stays together', () => {
  const d = organizer({ accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam', p_ann: 'acct-gone' } });
  applyPeople(d, [{ player_id: 'p_sam', user_id: 'acct-sam', visible: true, display_name: 'Sam' }], { asked: ['p_sam', 'p_sam2', 'p_ann', 't'], myAccount: 'acct-t' });
  assert.equal(d.accountOf.p_sam, 'acct-sam');
  assert.equal(d.accountOf.p_sam2, undefined, 'Sam switched off that seat, so it’s its own person again');
  assert.equal(d.accountOf.p_ann, 'acct-gone', 'none of that account came back: it was deleted, so its ids keep their link');
  assert.notEqual(linksOf(d).personOf('p_sam2'), linksOf(d).personOf('p_sam'));
});

test('applyPeople: your own id always maps to your account', () => {
  const d = organizer();
  applyPeople(d, [], { asked: ['t'], myAccount: 'acct-t' });
  assert.equal(d.accountOf.t, 'acct-t');
});

test('profileFor: you, a friend through any of their ids, and a picked avatar for a guest', () => {
  const s = organizer({
    accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam', t: 'acct-t' },
    profiles: { 'acct-sam': fromRow({ display_name: 'Sam R.', avatar: { kind: 'buddy', id: 'b2' } }) },
    profile: { avatar: { kind: 'buddy', id: 'b1' }, homeCourse: { id: 'c1', name: 'Pine Hill' } },
  });
  s.players.p_ann.avatar = { kind: 'buddy', id: 'b9' };
  assert.equal(profileFor(s, 't').mine, true);
  assert.equal(profileFor(s, 't').avatar.id, 'b1');
  assert.equal(profileFor(s, 't').accountId, 'acct-t');
  assert.equal(profileFor(s, 'p_sam2').name, 'Sam R.', 'by either of Sam’s ids');
  assert.equal(profileFor(s, 'p_sam').accountId, 'acct-sam');
  assert.equal(profileFor(s, 'p_ann').avatar.id, 'b9', 'the organizer’s pick for someone with no account');
  assert.equal(profileFor(s, 'nobody'), null);
});

test('knownPlayerIds: saved players, round players and claimers, sorted', () => {
  const s = organizer();
  s.rounds.r1.claims = { p_sam: 'zs' };
  assert.deepEqual(knownPlayerIds(s), ['p_ann', 'p_sam', 'p_sam2', 't', 'zs']);
});

// ------------------------------- privacy ---------------------------------------

test('privacy: money is hidden by default, everything else is seen by people you played with', () => {
  assert.deepEqual(normalizePrivacy(undefined), { money: 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' });
  assert.deepEqual(normalizePrivacy({ money: 'anyone', stats: 'everyone', junk: 1 }), PRIVACY_DEFAULTS, 'unknown levels fall back (everyone is for money only)');
  assert.equal(shows({}, 'money'), false);
  assert.equal(shows({ money: 'played' }, 'money'), true);
  assert.equal(profileOf(organizer()).privacy.money, 'hidden', 'a profile nobody has touched hides money');
});

test('privacy: hidden money never goes to the server; stats hidden sends none', () => {
  const s = organizer();
  const stats = profileStats(s);
  const row = toRow(profileOf(s), 'acct-t', stats);
  assert.equal(row.stats.money, undefined, 'money stays on the phone by default');
  assert.equal(row.stats.rounds, 3);
  assert.deepEqual(row.privacy, PRIVACY_DEFAULTS);
  const shown = toRow(profileOf({ ...s, profile: { privacy: { money: 'played' } } }), 'acct-t', stats);
  assert.deepEqual(shown.stats.money, stats.money);
  assert.deepEqual(shareableStats(stats, { stats: 'hidden', money: 'played' }), {}, 'hidden stats hide money too');
});

test('toRow: no row without a name or account; a photo still on the phone goes up as no avatar', () => {
  const s = organizer({ profile: { avatar: { kind: 'photo', url: 'data:image/jpeg;base64,AAAA' } } });
  assert.equal(toRow(profileOf(s), null), null);
  assert.equal(toRow(profileOf({ ...s, players: {} }), 'acct-t'), null);
  const row = toRow(profileOf(s), 'acct-t');
  assert.equal(row.avatar, null);
  assert.equal(row.display_name, 'Trevor');
  assert.equal(row.player_id, 't');
  const up = toRow(profileOf({ ...s, profile: { avatar: { kind: 'photo', url: 'https://x.test/a.jpg', path: 'acct-t/a.jpg' } } }), 'acct-t');
  assert.deepEqual(up.avatar, { kind: 'photo', url: 'https://x.test/a.jpg', path: 'acct-t/a.jpg' });
});

test('avatars and home course: only clean shapes are kept', () => {
  assert.equal(normalizeAvatar(null), null);
  assert.equal(normalizeAvatar({ kind: 'photo', url: 'http://x.test/a.jpg' }), null, 'never plain http');
  assert.equal(normalizeAvatar({ kind: 'photo', url: 'javascript:alert(1)' }), null);
  assert.deepEqual(normalizeAvatar({ kind: 'photo', url: 'data:image/jpeg;base64,AA' }), { kind: 'photo', url: 'data:image/jpeg;base64,AA', pending: true });
  assert.deepEqual(normalizeAvatar({ kind: 'buddy', id: ' b4 ', bg: 'mint' }), { kind: 'buddy', id: 'b4', bg: 'mint' });
  assert.equal(normalizeAvatar({ kind: 'buddy' }), null);
  assert.deepEqual(normalizeHomeCourse({ id: 'c1', name: ' Pine Hill ', city: 'Town' }), { id: 'c1', name: 'Pine Hill', place: 'Town' });
  assert.equal(normalizeHomeCourse({ id: 'c1' }), null);
  assert.equal(fromRow({ avatar: { kind: 'photo', url: 'data:image/png;base64,AA' } }).avatar, null, 'a photo only on someone else’s phone isn’t shown');
});

// ------------------------------- stats -----------------------------------------

test('profileStats: rounds, record, friends and the favorite game; money from money rounds only', () => {
  const s = organizer({ accountOf: { p_sam: 'acct-sam', p_sam2: 'acct-sam' } });
  const st = profileStats(s);
  assert.equal(st.rounds, 3);
  assert.deepEqual(st.record, { won: 1, lost: 2, even: 0 }, 'lost r1 and the points round r3, won r2');
  assert.equal(st.friends, 2, 'Sam once, whichever record, and Ann');
  assert.deepEqual(st.favoriteGame, { id: 'skins', name: 'Skins', rounds: 3 });
  assert.equal(st.money.rounds, 2, 'the points round isn’t money');
  const r1 = roundResults(s.rounds.r1).balances.t, r2 = roundResults(s.rounds.r2).balances.t;
  assert.equal(st.money.net, Math.round((r1 + r2) * 100) / 100);
  assert.equal(st.money.best, r2);
  assert.equal(st.since, NOW - 5 * DAY);
  assert.equal(st.lastPlayed, NOW - DAY);
});

test('profileStats: for a friend by their ids, and empty for someone with no rounds', () => {
  const s = organizer();
  const sam = profileStats(s, ['p_sam', 'p_sam2']);
  assert.equal(sam.rounds, 2);
  assert.deepEqual(sam.record, { won: 1, lost: 1, even: 0 });
  const none = profileStats(stateOf('z', []));
  assert.deepEqual(none, { rounds: 0, friends: 0, record: { won: 0, lost: 0, even: 0 }, favoriteGame: null, since: null, lastPlayed: null, money: { net: 0, best: null, rounds: 0 } });
});

// ------------------------------- before the SQL is run -------------------------

test('fallback: a missing table, function or bucket means "not set up", anything else doesn’t', () => {
  assert.ok(isNotSetUp({ code: '42P01', message: 'relation "public.profiles" does not exist' }));
  assert.ok(isNotSetUp({ code: 'PGRST205', message: 'Could not find the table' }));
  assert.ok(isNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.link_my_players without parameters in the schema cache' }));
  assert.ok(isNotSetUp({ code: '42883', message: 'function public.people_profiles(text[]) does not exist' }));
  assert.ok(isNotSetUp({ statusCode: '404', message: 'Bucket not found' }));
  assert.ok(!isNotSetUp({ code: '23505', message: 'duplicate key' }));
  assert.ok(!isNotSetUp({ message: 'Failed to fetch' }));
  assert.ok(!isNotSetUp(null));
  assert.equal(serverStateAfter({ code: 'PGRST202' }), 'off');
  assert.equal(serverStateAfter({ message: 'Failed to fetch' }), 'offline');
  assert.equal(serverStateAfter({ message: 'anything' }, false), 'offline');
  assert.equal(serverStateAfter({ code: '500', message: 'boom' }), 'error');
});

test('fallback: a server that said "not set up" is asked again on a later load, not every load', () => {
  assert.equal(retryOnLoad(null, NOW), true);
  assert.equal(retryOnLoad(NOW - 60e3, NOW), false);
  assert.equal(retryOnLoad(NOW - RETRY_OFF_MS, NOW), true);
});

test('fallback: your profile rides in your account’s saved data, and an older profile keeps the phone’s', () => {
  const s = organizer({ profile: { avatar: { kind: 'buddy', id: 'b1' }, privacy: { money: 'played' }, updatedAt: 5 } });
  const doc = toDocs(s)['profile:me'].data;
  assert.deepEqual(doc.profile, s.profile);
  const other = organizer();
  applyDoc(other, 'profile', 'me', doc);
  assert.deepEqual(other.profile, s.profile, 'another phone signed in to the account gets it');
  const older = { ...doc };
  delete older.profile;
  const phone = organizer({ profile: { homeCourse: { id: 'c', name: 'Mine' } } });
  applyDoc(phone, 'profile', 'me', older);
  assert.deepEqual(phone.profile, { homeCourse: { id: 'c', name: 'Mine' } });
});

test('fallback: the account links come along in a backup and merge in without overwriting', () => {
  const cur = organizer({ accountOf: { p_sam: 'acct-sam' } });
  const { state } = mergeBackup(cur, { players: {}, accountOf: { p_sam: 'other', p_sam2: 'acct-sam' } });
  assert.deepEqual(state.accountOf, { p_sam: 'acct-sam', p_sam2: 'acct-sam' });
});

test('photos: the crop is the centered square', () => {
  assert.deepEqual(cropSquare(400, 300), { sx: 50, sy: 0, size: 300 });
  assert.deepEqual(cropSquare(300, 500), { sx: 0, sy: 100, size: 300 });
  assert.deepEqual(cropSquare(0, 10), { sx: 0, sy: 5, size: 0 });
});
