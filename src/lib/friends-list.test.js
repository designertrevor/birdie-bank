// Friends (friends-list.js): everyone you've played with across your crews, one person per friend,
// and people one step out from the feed, suggested only when they have an account and their
// setting let the round reach you.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { buildHoles, buildMeta } from './sync-model.js';
import { feedHole, feedMeta, feedPeople, feedRoundOk, feedSeats, friendRounds } from './friend-feed.js';
import { MAX_SUGGESTED, playedWith, recordLine, shortName, suggestedFriends, togetherLine, viaLine } from './friends-list.js';

const HOUR = 36e5;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 20, 15).getTime();
const flat = n => ({ id: 'f', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const NAMES = { me: 'Trevor Nielsen', sam: 'Sam Snead', dalton: 'Dalton Reed', dave: 'Dave Pelz', gus: 'Gus Guest', mia: 'Mia Hall', zoe: 'Zoe Park', sam2: 'Sam S' };
let n = 0;
/** A finished skins round between `ids`; the first one wins the first `wins` holes. */
function mk(ids, { wins = 1, at = NOW - DAY, status = 'done' } = {}) {
  n++;
  const players = ids.map(id => ({ id, name: NAMES[id] || id, index: 0 }));
  const r = createRound({ id: `r${n}`, game: 'skins', course: flat(9), holesCount: 9, players, settings: { skins: { value: 2, carryover: false } }, hcPct: 100, useHandicaps: false });
  r.holes.forEach((h, i) => { r.scores[h.no] = Object.fromEntries(ids.map((id, j) => [id, j === 0 && i < wins ? 3 : 4])); });
  r.status = status;
  r.createdAt = at - 4 * HOUR;
  r.finishedAt = at;
  r.shareCode = `S${String(n).padStart(5, '0')}`;
  return r;
}
const state = (rounds, extra = {}) => ({
  me: 'me', players: Object.fromEntries(Object.keys(NAMES).map(id => [id, { id, name: NAMES[id] }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), crews: {}, settlements: [], plans: {}, talk: {}, ...extra,
});

test('played with: everyone from your finished rounds, across crews, one person per friend', () => {
  const a = mk(['me', 'sam', 'dalton'], { at: NOW - 3 * DAY });
  const b = mk(['sam', 'me'], { at: NOW - DAY }); // Sam wins one skin off you
  const c = mk(['me', 'sam2'], { at: NOW - 2 * DAY }); // the same Sam under another id
  const live = mk(['me', 'mia'], { status: 'active' }); // not finished: not yet
  const watched = mk(['zoe', 'dave']); // a round you only watched
  const s = state([a, b, c, live, watched], {
    links: { sam2: 'sam' },
    crews: { c1: { id: 'c1', name: 'Saturday group', playerIds: ['sam', 'dalton'] }, c2: { id: 'c2', name: 'Work', playerIds: ['sam2'] } },
  });
  const list = playedWith(s);
  assert.deepEqual(list.map(f => [f.id, f.rounds]), [['sam', 3], ['dalton', 1]]);
  const sam = list[0];
  assert.equal(sam.lastAt, b.finishedAt);
  assert.equal(sam.lastRoundId, b.id);
  assert.deepEqual(sam.crews, ['Saturday group', 'Work']);
  // Your record from the bets: you won round a and c, Sam won b
  assert.deepEqual([sam.record.won, sam.record.lost], [2, 1]);
  assert.equal(recordLine(sam), 'You’re 2 and 1 against Sam');
  assert.equal(togetherLine(sam, NOW), '3 rounds · last played yesterday');
  assert.equal(togetherLine({ rounds: 1, lastAt: NOW - 3 * DAY }, NOW), '1 round · last played 3 days ago');
  assert.equal(recordLine({ name: 'Dalton Reed', record: { rounds: 2, won: 1, lost: 1, even: 0 } }), 'Even with Dalton, 1 and 1');
  assert.equal(recordLine({ name: 'Dalton', record: null }), null);
});

test('names: a first name and an initial, and who they played with', () => {
  assert.equal(shortName('Dalton Reed'), 'Dalton R.');
  assert.equal(shortName('Cher'), 'Cher');
  assert.equal(shortName(''), 'Someone');
  assert.equal(viaLine(['Dalton']), 'Played with Dalton');
  assert.equal(viaLine(['Dalton', 'Sam']), 'Played with Dalton and Sam');
  assert.equal(viaLine(['Dalton', 'Sam', 'Mia']), 'Played with Dalton and 2 others');
});

// --------------------------- suggested, from the feed ----------------------

// The server's rules in JavaScript (friend-feed.js). You're acct-me; Sam and Dalton are your friends
const ACCOUNTS = { sam: 'acct-sam', dalton: 'acct-dalton', mia: 'acct-mia', zoe: 'acct-zoe', dave: 'acct-dave' }; // Gus is a guest
const FRIENDS = new Set(['acct-sam', 'acct-dalton']);
function serve(r, { privacy = {} } = {}) {
  const m = buildMeta(r);
  if (!feedRoundOk(m, { me: 'acct-me', friends: FRIENDS, accounts: ACCOUNTS, privacy })) return null;
  const keep = feedSeats(m, { accounts: ACCOUNTS, privacy }).every(x => x.money && FRIENDS.has(x.account));
  const meta = feedMeta(m, { money: keep });
  const holes = Object.fromEntries(Object.entries(buildHoles(r)).map(([no, d]) => [no, feedHole(d, meta)]));
  return { code: keep ? r.shareCode : null, ref: keep ? null : `F${r.shareCode.slice(1)}`, meta, holes, people: feedPeople(m, { friends: FRIENDS, accounts: ACCOUNTS, privacy }), updated_at: new Date(r.finishedAt).toISOString() };
}
const mine = () => [mk(['me', 'sam', 'dalton'], { at: NOW - 10 * DAY })];
const suggest = (rows, s = state(mine(), { accountOf: { sam: 'acct-sam', dalton: 'acct-dalton', me: 'acct-me' } })) =>
  suggestedFriends(s, friendRounds(s, { rows: rows.filter(Boolean), status: 'ready', now: NOW }), { now: NOW });

test('suggested: a friend of a friend from a round that reached your feed, never a guest', () => {
  const r = mk(['dalton', 'mia', 'gus'], { at: NOW - 2 * HOUR });
  const list = suggest([serve(r)]);
  assert.equal(list.length, 1, 'Mia only: Gus has no account');
  assert.deepEqual({ name: list[0].name, viaText: list[0].viaText, rounds: list[0].rounds }, { name: 'Mia H.', viaText: 'Played with Dalton', rounds: 1 });
  assert.equal(list[0].target[0], 'friendRound');
  assert.equal(list[0].sub, 'Skins at Pebble Creek · 2h ago');
});

test('suggested: most friends in common first, then most rounds', () => {
  const rows = [
    serve(mk(['dalton', 'zoe'], { at: NOW - 3 * HOUR })),
    serve(mk(['sam', 'zoe', 'mia'], { at: NOW - 2 * HOUR })),
  ];
  const list = suggest(rows);
  assert.deepEqual(list.map(x => [x.name, x.viaText]), [['Zoe P.', 'Played with Sam and Dalton'], ['Mia H.', 'Played with Sam']]);
  assert.equal(list[0].rounds, 2);
});

test('suggested: Only you never shows up, whoever in the round chose it', () => {
  const r = mk(['dalton', 'mia'], { at: NOW - HOUR });
  assert.equal(serve(r, { privacy: { 'acct-mia': { profile: 'hidden' } } }), null);
  assert.deepEqual(suggest([serve(r, { privacy: { 'acct-mia': { profile: 'hidden' } } })]), []);
  // Dalton choosing Only you keeps Mia's round from you too
  assert.deepEqual(suggest([serve(r, { privacy: { 'acct-dalton': { profile: 'hidden' } } })]), []);
  // Everyone and People you've played with both let it through
  assert.equal(suggest([serve(r, { privacy: { 'acct-mia': { profile: 'everyone' } } })]).length, 1);
  assert.equal(suggest([serve(r, { privacy: { 'acct-mia': { profile: 'played' } } })]).length, 1);
});

test('suggested: never you, a friend, or someone you’ve already played with', () => {
  // Dave played with you on this phone, so he's a friend already, whatever the feed says
  const s = state([...mine(), mk(['me', 'dave'], { at: NOW - 20 * DAY })], { accountOf: { sam: 'acct-sam', dalton: 'acct-dalton', me: 'acct-me' } });
  const r = mk(['dalton', 'dave', 'sam'], { at: NOW - HOUR });
  assert.deepEqual(suggest([serve(r)], s), []);
  // No feed (signed out, or nothing yet): nothing to suggest
  assert.deepEqual(suggest([]), []);
});

test('suggested: a round this phone only watches from a code says nothing about accounts', () => {
  const s = state(mine());
  const watching = mk(['dalton', 'mia'], { status: 'active', at: NOW - HOUR });
  watching.shared = { code: watching.shareCode, host: false };
  watching.localMe = null;
  s.rounds[watching.id] = watching;
  const rounds = friendRounds(s, { rows: [], status: 'ready', now: NOW });
  assert.equal(rounds.length, 1);
  assert.deepEqual(suggestedFriends(s, rounds, { now: NOW }), []);
});

test('suggested: at most ten', () => {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const id = `p${i}`;
    NAMES[id] = `Pal ${i}`;
    ACCOUNTS[id] = `acct-${id}`;
    return serve(mk(['dalton', id], { at: NOW - (i + 1) * HOUR }));
  });
  assert.equal(suggest(rows).length, MAX_SUGGESTED);
});
