// One privacy setting for your whole profile (o7a privacy, Trevor's answer to the Overnight 7
// review): Everyone, People you've played with (the default) or Only you, plus Show my money (off
// by default). Covers the mapping from the older per-item privacy, what a friend sees for each
// setting (the phone, the server rule and the friend's card together), money only with the switch,
// the shape of the deeper stats that go with a profile, and the SQL that goes with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, roundResults } from './round.js';
import { deepStats } from './deep-stats.js';
import {
  LEGACY_KEYS, PRIVACY_DEFAULTS, PROFILE_LEVELS, SHARED_LINES, applyPeople, fromLegacy, legacyOf, moneyShown,
  normalizePrivacy, profileFor, profileOf, profileShown, profileStats, publicDeep, serverParts, shareableStats, toRow,
} from './profile-model.js';
import { PROFILE_CHOICES, friendMore, friendView, moneyHelp, profileHelp, statsShareLine, whoSees } from './profile-view.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const oak = { ...flat9, id: 'oak', name: 'Oak Hollow', city: 'Bend' };
const SET = { hcPct: 100, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 }, skins: { value: 2, carryover: true } };
const at = d => new Date(2026, 8, d, 15).getTime();
const EM = String.fromCharCode(0x2014);

/** A finished 9-hole round: everyone makes 4 except the scores given ({ hole: { id: score } }). */
function round(id, game, ids, holes = {}, { course = flat9, when = at(5), extra = {} } = {}) {
  const r = createRound({ id, game, course, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: structuredClone(SET), hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.status = 'done';
  r.createdAt = when - 4 * 36e5;
  r.finishedAt = when;
  return Object.assign(r, extra);
}
// A Nassau with a press you win, a skins round where you take two skins, one at Oak Hollow
const rounds = () => [
  round('n1', 'nassau', ['me', 'mike'], { 1: { mike: 3 }, 2: { mike: 3 }, 3: { me: 3 }, 4: { me: 3 }, 5: { me: 3 }, 6: { me: 3 } },
    { extra: { presses: [{ id: 1, leg: 'front', start: 3, by: 0 }] } }),
  round('s1', 'skins', ['me', 'mike', 'sam'], { 1: { me: 3 }, 2: { me: 3 }, 5: { sam: 3 } }, { course: oak, when: at(12) }),
];
/** Your phone, with a handicap, a home course and the privacy given. */
const phone = privacy => ({
  me: 'me', onboarded: true, players: { me: { id: 'me', name: 'Trevor', index: 9.4 } }, crews: {}, customCourses: {},
  rounds: Object.fromEntries(rounds().map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [],
  profile: { homeCourse: { id: 'oak', name: 'Oak Hollow' }, avatar: { kind: 'buddy', id: 'b1' }, privacy }, accountOf: {}, profiles: {},
});
/** What goes up, the same way profiles.js pushMine sends it. */
const pushed = s => toRow(profileOf(s), 'acct-t', { ...profileStats(s), deep: deepStats(s) });

/**
 * people_profiles() for someone you've played with, as the SQL reads the saved row (serverParts).
 * `oldServer` reads it as 2026-10-03-privacy-everyone.sql did: the older keys only.
 */
function serve(row, { oldServer = false } = {}) {
  const saved = oldServer ? Object.fromEntries(LEGACY_KEYS.map(k => [k, row.privacy[k]])) : row.privacy;
  const parts = serverParts(saved);
  let stats = null;
  if (parts.stats) {
    stats = { ...row.stats };
    if (!parts.money) delete stats.money;
  }
  return {
    player_id: 'me', user_id: 'acct-t', visible: true, display_name: row.display_name, avatar: row.avatar,
    handicap_index: parts.handicap ? row.handicap_index : null, home_course: parts.homeCourse ? row.home_course : null,
    pay_app: row.pay_app, pay_handle: row.pay_handle, stats, updated_at: '2026-10-05T12:00:00Z',
  };
}
/** What Sam's phone shows for you, from what the server sent. */
function samSees(row) {
  const d = { me: 'sam', players: { sam: { id: 'sam', name: 'Sam' } }, accountOf: {}, profiles: {}, links: {}, unlinks: [], rounds: {} };
  applyPeople(d, [row], { asked: ['me'], myAccount: 'acct-sam' });
  const prof = profileFor(d, 'me');
  return { prof, view: friendView(prof) };
}

// ------------------------------- the setting --------------------------------

test('setting: three levels, people you’ve played with and money off by default', () => {
  assert.deepEqual(PROFILE_LEVELS, ['everyone', 'played', 'hidden']);
  assert.deepEqual(PROFILE_CHOICES.map(c => c.value), PROFILE_LEVELS, 'the screen offers exactly the levels');
  assert.deepEqual(PROFILE_CHOICES.map(c => c.label), ['Everyone', 'People you’ve played with', 'Only you']);
  assert.equal(PRIVACY_DEFAULTS.profile, 'played');
  assert.equal(PRIVACY_DEFAULTS.showMoney, false);
  assert.deepEqual(normalizePrivacy(undefined), PRIVACY_DEFAULTS);
  assert.deepEqual(normalizePrivacy({ profile: 'nope', showMoney: 'yes' }), PRIVACY_DEFAULTS, 'junk falls back');
  assert.equal(normalizePrivacy({ profile: 'everyone', showMoney: 'true' }).showMoney, false, 'only a real true turns money on');
  for (const level of PROFILE_LEVELS) for (const showMoney of [false, true]) {
    const p = normalizePrivacy({ profile: level, showMoney });
    assert.deepEqual(normalizePrivacy(p), p, `${level}/${showMoney} reads the same again`);
    assert.equal(profileShown(p), level !== 'hidden');
    assert.equal(moneyShown(p), level !== 'hidden' && showMoney, 'money only with the switch, and never for only you');
  }
});

test('setting: the older keys ride along, worked out from the setting', () => {
  assert.deepEqual(legacyOf('played', false), { money: 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' });
  assert.deepEqual(legacyOf('played', true), { money: 'played', stats: 'played', handicap: 'played', homeCourse: 'played' });
  assert.deepEqual(legacyOf('everyone', true), { money: 'everyone', stats: 'played', handicap: 'played', homeCourse: 'played' });
  assert.deepEqual(legacyOf('everyone', false).money, 'hidden');
  assert.deepEqual(legacyOf('hidden', true), { money: 'hidden', stats: 'hidden', handicap: 'hidden', homeCourse: 'hidden' });
  // A saved profile level wins over older keys that disagree
  assert.equal(normalizePrivacy({ profile: 'hidden', stats: 'played', money: 'everyone' }).stats, 'hidden');
  assert.equal(normalizePrivacy({ profile: 'played', showMoney: false, money: 'played' }).money, 'hidden');
});

// ------------------------------- mapping the older privacy -----------------

test('mapping: the older per-item privacy becomes the one setting, never showing what was hidden', () => {
  const map = p => { const n = normalizePrivacy(p); return `${n.profile}/${n.showMoney}`; };
  // Nothing chosen: the default
  assert.equal(map({}), 'played/false');
  assert.equal(map({ money: 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' }), 'played/false');
  // Money shown: the switch is on
  assert.equal(map({ money: 'played' }), 'played/true');
  // Money open to everyone: the switch is on, the rest doesn't widen to everyone
  assert.equal(map({ money: 'everyone' }), 'played/true');
  // Any of record, handicap or home course hidden: only you
  assert.equal(map({ stats: 'hidden' }), 'hidden/false');
  assert.equal(map({ handicap: 'hidden' }), 'hidden/false');
  assert.equal(map({ homeCourse: 'hidden', money: 'played' }), 'hidden/true', 'the switch is kept for when you open the profile again');
  assert.equal(map({ money: 'hidden', stats: 'hidden', handicap: 'hidden', homeCourse: 'hidden' }), 'hidden/false');
  assert.equal(moneyShown({ homeCourse: 'hidden', money: 'played' }), false, 'but money doesn’t show while it’s only you');
  // Junk in the older keys is the older default
  assert.equal(map({ money: 'anyone', stats: 'everyone' }), 'played/false');
  assert.deepEqual(fromLegacy(null), { profile: 'played', showMoney: false });
});

test('mapping: an older profile on this phone reads as the setting, and the next push sends both', () => {
  const s = phone({ money: 'played', stats: 'played', handicap: 'played', homeCourse: 'played' });
  assert.equal(profileOf(s).privacy.profile, 'played');
  assert.equal(profileOf(s).privacy.showMoney, true);
  const row = pushed(s);
  assert.deepEqual(row.privacy, { profile: 'played', showMoney: true, money: 'played', stats: 'played', handicap: 'played', homeCourse: 'played' });
});

// ------------------------------- what a friend sees --------------------------

test('a friend sees: People you’ve played with shows record, stats, handicap and home course, no money', () => {
  const s = phone({ profile: 'played' });
  const { prof, view } = samSees(serve(pushed(s)));
  assert.equal(prof.name, 'Trevor');
  assert.equal(prof.avatar.id, 'b1');
  assert.equal(view.index, 9.4);
  assert.equal(view.homeCourse.name, 'Oak Hollow');
  assert.deepEqual(view.tiles.map(t => t.key), ['rounds', 'record', 'game']);
  assert.ok(view.more, 'the deeper stats show');
  assert.equal(prof.stats.money, undefined);
});

test('a friend sees: Everyone is the same as played-with today', () => {
  const played = samSees(serve(pushed(phone({ profile: 'played' }))));
  const everyone = samSees(serve(pushed(phone({ profile: 'everyone' }))));
  assert.deepEqual(everyone.view, played.view);
});

test('a friend sees: Only you shows the name and avatar and nothing else, money switch or not', () => {
  for (const showMoney of [false, true]) {
    const row = pushed(phone({ profile: 'hidden', showMoney }));
    // Nothing hidden leaves the phone at all
    assert.equal(row.handicap_index, null);
    assert.equal(row.home_course, null);
    assert.deepEqual(row.stats, {});
    assert.equal(row.display_name, 'Trevor');
    assert.equal(row.avatar.id, 'b1', 'people in your rounds still know it’s you');
    const { prof, view } = samSees(serve(row));
    assert.equal(prof.name, 'Trevor');
    assert.equal(prof.avatar.id, 'b1');
    assert.equal(view.index, null);
    assert.equal(view.homeCourse, null);
    assert.deepEqual(view.tiles, []);
    assert.equal(view.more, null);
  }
});

test('a friend sees: money only with Show my money on, and the amounts are the rounds’ own', () => {
  const s = phone({ profile: 'played', showMoney: true });
  const net = Object.values(s.rounds).reduce((a, r) => a + roundResults(r).balances.me, 0);
  const { prof, view } = samSees(serve(pushed(s)));
  assert.equal(prof.stats.money.net, Math.round(net * 100) / 100);
  assert.deepEqual(prof.stats.money, profileStats(s).money, 'exactly what your phone has');
  assert.ok(view.tiles.some(t => t.key === 'net'));
  assert.ok(view.tiles.some(t => t.key === 'best'));
  const off = samSees(serve(pushed(phone({ profile: 'played', showMoney: false }))));
  assert.equal(off.view.tiles.some(t => t.key === 'net'), false);
  assert.equal(off.prof.stats.money, undefined);
  assert.equal(pushed(phone({ profile: 'played', showMoney: false })).stats.money, undefined, 'money off never leaves the phone');
});

test('before the SQL runs: the server from 2026-10-03 shows exactly the same for every setting', () => {
  for (const level of PROFILE_LEVELS) for (const showMoney of [false, true]) {
    const row = pushed(phone({ profile: level, showMoney }));
    assert.deepEqual(samSees(serve(row, { oldServer: true })).view, samSees(serve(row)).view, `${level}/${showMoney}`);
    assert.deepEqual(serverParts(Object.fromEntries(LEGACY_KEYS.map(k => [k, row.privacy[k]]))), serverParts(row.privacy));
  }
});

test('older rows: a row saved without the setting keeps its per-item rule on the new server', () => {
  // As 2026-10-03-privacy-everyone.sql read them
  assert.deepEqual(serverParts({}), { handicap: true, homeCourse: true, stats: true, money: false });
  assert.deepEqual(serverParts({ money: 'everyone' }), { handicap: true, homeCourse: true, stats: true, money: true });
  assert.deepEqual(serverParts({ money: 'played', stats: 'hidden' }), { handicap: true, homeCourse: true, stats: false, money: false });
  assert.deepEqual(serverParts({ handicap: 'hidden', homeCourse: 'hidden' }), { handicap: false, homeCourse: false, stats: true, money: false });
  // The new setting, when the row has it
  assert.deepEqual(serverParts({ profile: 'hidden', showMoney: true }), { handicap: false, homeCourse: false, stats: false, money: false });
  assert.deepEqual(serverParts({ profile: 'everyone', showMoney: true }), { handicap: true, homeCourse: true, stats: true, money: true });
  assert.deepEqual(serverParts({ profile: 'played', money: 'played' }), { handicap: true, homeCourse: true, stats: true, money: false }, 'the setting wins over older keys');
});

// ------------------------------- the deeper stats ----------------------------

test('stats shape: presses, skins and records by game and course go with your profile, no money at all', () => {
  const s = phone({ profile: 'played', showMoney: true });
  const sent = pushed(s).stats.deep;
  assert.deepEqual(Object.keys(sent).sort(), ['courses', 'games', 'presses', 'skins']);
  assert.deepEqual(sent.presses, { rounds: 1, made: { won: 1, lost: 0, halved: 0 }, against: { won: 0, lost: 0, halved: 0 } });
  assert.deepEqual(sent.skins, { rounds: 1, won: 2, best: 2 });
  assert.deepEqual(sent.games.map(g => Object.keys(g)), sent.games.map(() => ['key', 'name', 'rounds', 'record']));
  assert.deepEqual(sent.courses.map(c => c.name).sort(), ['Flat Nine', 'Oak Hollow']);
  for (const c of sent.courses) assert.deepEqual(Object.keys(c).filter(k => k !== 'place'), ['name', 'rounds', 'record']);
  // Even with Show my money on, no dollars, points, biggest wins or round ids go in the deeper stats
  const text = JSON.stringify(sent);
  for (const word of ['dollars', 'points', 'biggest', 'amount', 'net', 'n1', 's1']) assert.equal(text.includes(`"${word}"`), false, word);
  // A record per game matches the full stats on your phone
  const full = deepStats(s);
  for (const g of sent.games) assert.deepEqual(g.record, full.games.find(x => x.key === g.key).record);
});

test('stats shape: checked again on the way in, capped, and an empty one is nothing', () => {
  const many = { games: Array.from({ length: 20 }, (_, i) => ({ key: `g${i}`, name: `G${i}`, rounds: 1, record: { won: 1 }, dollars: { net: 5, rounds: 1 } })) };
  const d = publicDeep(many);
  assert.equal(d.games.length, SHARED_LINES);
  assert.deepEqual(d.games[0], { key: 'g0', name: 'G0', rounds: 1, record: { won: 1, lost: 0, even: 0 } }, 'dollars are dropped');
  assert.deepEqual(publicDeep(d), d, 'the same shape again reads the same');
  assert.equal(publicDeep(null), null);
  assert.equal(publicDeep({ games: [], courses: [], presses: {}, skins: {} }), null);
  assert.equal(shareableStats({ rounds: 0, deep: {} }, {}).deep, undefined);
});

test('a friend’s card: presses, skins, then by game and by course', () => {
  const s = phone({ profile: 'played' });
  const { view } = samSees(serve(pushed(s)));
  assert.deepEqual(view.more.rows.map(r => r.key), ['presses', 'skins']);
  assert.equal(view.more.rows[0].value, '1 won · 100%');
  assert.equal(view.more.rows[1].value, '2 in 1 round');
  assert.deepEqual(view.more.games.map(g => g.name).sort(), ['Nassau', 'Skins']);
  assert.match(view.more.courses[0].sub, /^1 round · \d–\d/);
  // An older friend's phone sends no deeper stats: the card just doesn't show them
  assert.equal(friendMore({ rounds: 3, record: { won: 1, lost: 2, even: 0 } }), null);
});

// ------------------------------- the words ---------------------------------

test('words: honest about who Everyone reaches today, and about the money', () => {
  assert.equal(whoSees({ profile: 'everyone' }), 'Everyone');
  assert.match(profileHelp({ profile: 'everyone' }), /For now that’s people who’ve been in a round with you, the same as People you’ve played with/);
  assert.match(profileHelp({ profile: 'hidden' }), /still see your name and avatar/);
  assert.match(profileHelp({}), /People you’ve played a round with/);
  assert.match(moneyHelp({ profile: 'played', showMoney: true }), /^People you’ve played with see your net/);
  assert.match(moneyHelp({ profile: 'played' }), /Nobody else sees them/);
  assert.equal(statsShareLine({ profile: 'hidden' }), 'Only you see this.');
  assert.match(statsShareLine({}), /Dollars and biggest wins stay with you\.$/);
  assert.match(statsShareLine({ profile: 'played', showMoney: true }), /apart from your net and best round\.$/);
  for (const level of PROFILE_LEVELS) for (const showMoney of [false, true]) {
    for (const line of [profileHelp({ profile: level, showMoney }), moneyHelp({ profile: level, showMoney }), statsShareLine({ profile: level, showMoney })]) {
      assert.equal(line.includes(EM), false, 'no em dashes');
    }
  }
});

// ------------------------------- the SQL -----------------------------------

test('SQL: a new dated file that only replaces people_profiles(), reading the setting and the older keys', () => {
  const read = f => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), 'utf8');
  const file = read('2026-10-05-profile-privacy.sql');
  const fn = sql => sql.slice(sql.indexOf('create or replace function public.people_profiles'), sql.indexOf('$$;', sql.indexOf('create or replace function public.people_profiles')) + 3);
  const head = sql => fn(sql).slice(0, fn(sql).indexOf(' as $$'));
  assert.equal(head(file), head(read('2026-10-03-privacy-everyone.sql')), 'the same signature, so create or replace works');
  assert.match(file, /p\.privacy ->> 'profile' in \('everyone', 'played', 'hidden'\)/);
  assert.match(file, /p\.privacy -> 'showMoney' = 'true'::jsonb/);
  assert.match(file, /s\.lvl is null and p\.privacy ->> 'money' in \('played', 'everyone'\)/, 'older rows keep their money rule');
  assert.match(file, /s\.lvl is null and coalesce\(p\.privacy ->> 'stats', 'played'\) = 'hidden'/);
  assert.match(file, /coalesce\(p\.privacy ->> 'handicap', 'played'\) <> 'hidden'/);
  assert.match(file, /coalesce\(p\.privacy ->> 'homeCourse', 'played'\) <> 'hidden'/);
  assert.match(file, /case when v\.ok then p\.avatar end/, 'the avatar always shows to people in your rounds');
  assert.match(file, /profile_visible_to_me\(a\.user_id\)/, 'still only people who share a round');
  assert.match(file, /grant execute on function public\.people_profiles\(text\[\]\) to authenticated/);
  assert.match(file, /revoke all on function public\.people_profiles\(text\[\]\) from public, anon/);
  assert.doesNotMatch(file, /drop table|alter table|create table|drop function/i, 'no table changes');
  assert.equal(file.includes(EM), false);
});
