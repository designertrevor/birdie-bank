// The Friends feed: who shows up by each person's one profile setting (the same rules as
// supabase/2026-10-06-friend-feed.sql), what a friend's round shows (money only with Show my money,
// points always), and how the feed puts friends' rounds, plans and Lately together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { buildHoles, buildMeta } from './sync-model.js';
import {
  cleanFeedRow, feedLevel, feedMeta, feedMoney, feedPeople, feedRoundOk, feedSeats, feedWindowOk, followSeatsFor, followerMayWrite,
  friendRoundItem, friendRoundView, friendRounds, friendsLine, groupFeed, matchLine, planItem, statusLine, upNextFriends,
} from './friend-feed.js';
import { normalizePrivacy } from './profile-model.js';
import { tabResults } from './play-for.js';

const HOUR = 36e5;
const NOW = new Date(2026, 9, 6, 15).getTime();
const course = { id: 'c1', name: 'Pebble Creek', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const PLAYERS = [
  { id: 'sam', name: 'Sam Snead', index: 0, payApp: 'venmo', payHandle: '@sam' },
  { id: 'dave', name: 'Dave Pelz', index: 0 },
  { id: 'guest', name: 'Gus Guest', index: 0 },
];
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: false }, match: { stake: 10, pressMode: 'off' } };

/** A shared 9-hole skins round between Sam, Dave and a guest; Sam wins the first `wins` holes. */
function skinsRound({ id = 'r1', code = 'ABC123', wins = 2, played = 5, status = 'active', playFor = null } = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, players: PLAYERS, settings: SETTINGS, hcPct: 100, useHandicaps: false });
  r.holes.slice(0, played).forEach((h, i) => { r.scores[h.no] = { sam: i < wins ? 3 : 4, dave: 4, guest: 4 }; });
  r.status = status;
  if (status === 'done') r.finishedAt = NOW - HOUR;
  if (playFor) r.playFor = playFor;
  r.shareCode = code;
  r.hostDev = 'dev-sam';
  r.devs = { sam: 'dev-sam', dave: 'dev-dave' };
  r.claims = { dave: 'dave-own-id' };
  return r;
}
/** The row friend_rounds() would send for a round. */
function rowOf(r, { code = r.shareCode, people = {}, at = NOW - HOUR } = {}) {
  return { code, meta: feedMeta(buildMeta(r)), holes: buildHoles(r), people, updated_at: new Date(at).toISOString() };
}
const SAM = { friend: true, money: false, account: 'acct-sam' };
const DAVE = { friend: false, money: false, account: null };

// --------------------------- the server's rules ---------------------------

test('feed privacy: the one setting reads as the server reads it, older rows included', () => {
  assert.equal(feedLevel(null), 'played');
  assert.equal(feedLevel({}), 'played');
  assert.equal(feedLevel({ profile: 'everyone' }), 'everyone');
  assert.equal(feedLevel({ profile: 'hidden', stats: 'played' }), 'hidden');
  // A row saved before the one setting: any part hidden is Only you
  assert.equal(feedLevel({ money: 'hidden', stats: 'played', handicap: 'hidden', homeCourse: 'played' }), 'hidden');
  assert.equal(feedLevel({ money: 'everyone', stats: 'played' }), 'played');
  // Money only with Show my money, never for Only you
  assert.equal(feedMoney(null), false);
  assert.equal(feedMoney({ profile: 'played' }), false);
  assert.equal(feedMoney({ profile: 'played', showMoney: true }), true);
  assert.equal(feedMoney({ profile: 'everyone', showMoney: true }), true);
  assert.equal(feedMoney({ profile: 'hidden', showMoney: true }), false);
  assert.equal(feedMoney({ money: 'played' }), true);
  assert.equal(feedMoney({ money: 'hidden' }), false);
  assert.equal(feedMoney({ money: 'everyone', stats: 'hidden' }), false);
});

test('feed privacy: the app’s own saved privacy reads the same in the feed as on the profile', () => {
  for (const profile of ['everyone', 'played', 'hidden']) {
    for (const showMoney of [false, true]) {
      const saved = normalizePrivacy({ profile, showMoney });
      assert.equal(feedLevel(saved), profile);
      assert.equal(feedMoney(saved), profile !== 'hidden' && showMoney);
      // ...and from only the older keys it also writes (a server row from a phone that hasn't updated)
      const { profile: _p, showMoney: _s, ...legacy } = saved;
      assert.equal(feedLevel(legacy) === 'hidden', profile === 'hidden');
      assert.equal(feedMoney(legacy), profile !== 'hidden' && showMoney);
    }
  }
});

const meta = buildMeta(skinsRound());
const accounts = { sam: 'acct-sam', dave: 'acct-dave' }; // the guest has no account
const friends = new Set(['acct-sam']);

test('feed rules: a friend’s round you’re not in comes up by default', () => {
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts }), true);
  assert.deepEqual(feedSeats(meta, { accounts }).map(s => [s.seat, s.level, s.money]), [['sam', 'played', false], ['dave', 'played', false]]);
  // Nobody signed in, or no friend in it: nothing
  assert.equal(feedRoundOk(meta, { me: null, friends, accounts }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends: new Set(['acct-zed']), accounts }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts: {} }), false);
});

test('feed rules: Only you keeps a round out, whoever in it chose it', () => {
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, privacy: { 'acct-sam': { profile: 'hidden' } } }), false);
  // Dave isn't your friend, but his Only you still keeps his round from people outside it
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, privacy: { 'acct-dave': { profile: 'hidden' } } }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, privacy: { 'acct-sam': { profile: 'everyone' }, 'acct-dave': { profile: 'played' } } }), true);
});

test('feed rules: a round you’re in never comes up, by account or by this phone', () => {
  assert.equal(feedRoundOk(meta, { me: 'acct-dave', friends: new Set(['acct-sam']), accounts }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, device: 'dev-dave' }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, device: 'dev-sam' }), false);
  assert.equal(feedRoundOk(meta, { me: 'acct-me', friends, accounts, device: 'dev-other' }), true);
});

test('feed rules: going on in the last 12 hours, or finished in the last 7 days', () => {
  assert.equal(feedWindowOk('active', NOW - 11 * HOUR, NOW), true);
  assert.equal(feedWindowOk('active', NOW - 13 * HOUR, NOW), false);
  assert.equal(feedWindowOk('done', NOW - 6 * 24 * HOUR, NOW), true);
  assert.equal(feedWindowOk('done', NOW - 8 * 24 * HOUR, NOW), false);
  assert.equal(feedWindowOk('setup', NOW, NOW), false);
});

test('feed rules: each seat says friend or not, and money only with Show my money; a guest has nothing', () => {
  const people = feedPeople(meta, { friends, accounts, privacy: { 'acct-sam': { profile: 'played', showMoney: true } } });
  assert.deepEqual(people, {
    sam: { friend: true, money: true, account: 'acct-sam' },
    dave: { friend: false, money: false, account: null },
  });
  assert.equal(people.guest, undefined);
});

test('feed rules: the round goes out without device hashes, claims or anyone’s payment app', () => {
  const m = feedMeta(meta);
  assert.equal(m.devs, undefined);
  assert.equal(m.hostDev, undefined);
  assert.equal(m.claims, undefined);
  assert.ok(m.players.every(p => !('payApp' in p) && !('payHandle' in p)));
  assert.equal(m.players[0].name, 'Sam Snead');
  assert.equal(feedMeta(null), null);
});

test('feed rules: a friend watching writes as their own ids, on the round itself only', () => {
  assert.deepEqual(followSeatsFor({ live: meta, ok: true, ids: ['me', 'me'] }), ['me']);
  assert.equal(followSeatsFor({ live: meta, ok: false, ids: ['me'] }), null);
  assert.equal(followSeatsFor({ live: meta, ok: true, ids: [] }), null);
  // The live round is gone: only a friend who followed it keeps the talk
  assert.deepEqual(followSeatsFor({ live: null, followed: ['me'] }), ['me']);
  assert.equal(followSeatsFor({ live: null, followed: null }), null);
  assert.equal(followerMayWrite({ on: 'round', who: 'me' }, ['me']), true);
  assert.equal(followerMayWrite({ on: 'pay:sam>dave', who: 'me' }, ['me']), false);
  assert.equal(followerMayWrite({ on: 'bet:b1', who: 'me' }, ['me']), false);
  assert.equal(followerMayWrite({ on: 'round', who: 'sam' }, ['me']), false);
  assert.equal(followerMayWrite({ on: 'round', who: 'me' }, null), false);
});

// --------------------------- what a friend's round shows ------------------

test('friend round: scores so far, who’s up and the game, with no dollars unless they chose it', () => {
  const v = friendRoundView(rowOf(skinsRound(), { people: { sam: SAM, dave: DAVE } }));
  assert.equal(v.status, 'live');
  assert.equal(v.title, 'Skins at Pebble Creek');
  assert.equal(v.thru, 5);
  assert.equal(statusLine(v, NOW), 'Live · Hole 6 of 9');
  assert.equal(v.line, 'Sam leads');
  assert.deepEqual(v.friends, ['Sam']);
  assert.equal(friendsLine(v), 'Sam is playing');
  const sam = v.players.find(p => p.id === 'sam');
  assert.equal(sam.toPar, -2);
  assert.equal(sam.played, 5);
  assert.equal(sam.amount, null);
  assert.equal(sam.amountText, null);
  assert.ok(v.players.every(p => p.amountText === null));
  assert.deepEqual(v.target, ['friendRound', { code: 'ABC123' }]);
});

test('friend round: Show my money shows that player’s amount, and only theirs', () => {
  const r = skinsRound();
  const v = friendRoundView(rowOf(r, { people: { sam: { ...SAM, money: true }, dave: DAVE } }));
  const res = roundResults(r);
  assert.equal(v.players.find(p => p.id === 'sam').amount, res.balances.sam);
  assert.equal(v.line, 'Sam leads, +$8');
  assert.equal(v.players.find(p => p.id === 'dave').amountText, null);
  assert.equal(v.players.find(p => p.id === 'guest').amountText, null);
});

test('friend round: a points round reads in points for everyone, never dollars', () => {
  const v = friendRoundView(rowOf(skinsRound({ playFor: { kind: 'points' } }), { people: { sam: SAM } }));
  assert.equal(v.line, 'Sam leads, +8 pts');
  assert.equal(v.players.find(p => p.id === 'dave').amountText, '−4 pts');
  assert.ok(!v.players.some(p => String(p.amountText).includes('$')));
});

test('friend round: a finished one says who took it, a lunch round who’s buying, never the side bets for money', () => {
  const done = friendRoundView(rowOf(skinsRound({ status: 'done', played: 9 }), { people: { sam: SAM } }));
  assert.equal(done.status, 'done');
  assert.equal(done.line, 'Sam took it');
  assert.match(statusLine(done, NOW), /^Finished · /);
  const lunch = skinsRound({ status: 'done', played: 9, playFor: { kind: 'reward', reward: 'Lunch' } });
  lunch.bets = [{ id: 'b1', kind: 'match', sides: ['sam', 'dave'], stake: 20, cash: true }];
  const v = friendRoundView(rowOf(lunch, { people: { sam: { ...SAM, money: true } } }));
  assert.match(v.line, /wins lunch/);
  // The lunch round's money is on the Tab only (tabResults); the feed shows none of it
  assert.ok(tabResults(lunch));
  assert.ok(!v.players.some(p => String(p.amountText).includes('$')));
});

test('friend round: a match says who’s up, a round not started says so', () => {
  const r = createRound({ id: 'm1', game: 'match', course, holesCount: 9, players: PLAYERS.slice(0, 2), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  r.scores[1] = { sam: 3, dave: 4 };
  r.scores[2] = { sam: 3, dave: 4 };
  r.scores[3] = { sam: 5, dave: 4 };
  assert.equal(matchLine(r), 'Sam 1 up');
  r.scores[4] = { sam: 5, dave: 4 };
  assert.equal(matchLine(r), 'All square');
  assert.equal(matchLine(skinsRound()), null);
  const fresh = friendRoundView(rowOf(skinsRound({ played: 0 })));
  assert.equal(fresh.line, 'On the first tee');
  assert.equal(statusLine(fresh, NOW), 'Live · Teeing off');
});

test('friend round: a row that isn’t one is left out', () => {
  assert.equal(cleanFeedRow(null), null);
  assert.equal(cleanFeedRow({ code: 'bad', meta: {} }), null);
  assert.equal(cleanFeedRow({ code: 'ABC123', meta: { players: [] } }), null);
  assert.equal(friendRoundView({ code: 'ABC123', meta: { players: [{ id: 'a', name: 'A' }], holes: [{ no: 1, par: 4 }], game: 'nope' } }), null);
  // Seat requests and side bet asks (negative holes) never come along
  const row = cleanFeedRow({ ...rowOf(skinsRound()), holes: { 1: { scores: { sam: 4 } }, '-5': { request: {} } } });
  assert.deepEqual(Object.keys(row.holes), ['1']);
});

// --------------------------- the feed ---------------------------------------

const baseState = (extra = {}) => ({ me: 'me', players: { me: { id: 'me', name: 'Trevor' } }, rounds: {}, settlements: [], plans: {}, talk: {}, ...extra });

test('feed: friends’ rounds you’re not in, live first, the ones you watch on top', () => {
  const a = rowOf(skinsRound({ code: 'AAA111' }), { at: NOW - 2 * HOUR, people: { sam: SAM } });
  const b = rowOf(skinsRound({ code: 'BBB222' }), { at: NOW - HOUR, people: { sam: SAM } });
  const c = rowOf(skinsRound({ code: 'CCC333', status: 'done', played: 9 }), { at: NOW - 30 * 60e3, people: { sam: SAM } });
  const list = friendRounds(baseState(), { rows: [c, b, a], follows: { AAA111: { since: NOW, row: a } }, status: 'ready', now: NOW });
  assert.deepEqual(list.map(v => v.code), ['AAA111', 'BBB222', 'CCC333']);
  assert.equal(list[0].following, true);
  assert.equal(list[1].following, false);
});

test('feed: a round on this phone is never a friend’s round, but one you only watch from a code shows', () => {
  const mine = skinsRound({ id: 'mine', code: 'MINE11' });
  mine.shared = { code: 'MINE11', host: true };
  const watching = skinsRound({ id: 'w1', code: 'WATCH1' });
  watching.shared = { code: 'WATCH1', host: false };
  watching.localMe = null;
  const state = baseState({ rounds: { mine, w1: watching } });
  const rows = [rowOf(mine, { people: { sam: SAM } }), rowOf(watching, { people: { sam: SAM } })];
  const list = friendRounds(state, { rows, status: 'ready', now: NOW });
  assert.deepEqual(list.map(v => [v.code, v.source]), [['WATCH1', 'watching']]);
  assert.deepEqual(list[0].target, ['play', { id: 'w1' }]);
  // Up next already shows a round you watch, so it isn't there twice
  assert.deepEqual(upNextFriends(list, { now: NOW }), []);
});

test('feed: once the server answers, a round you watch that it no longer sends drops out; with no server the copy stays', () => {
  const a = rowOf(skinsRound({ code: 'AAA111' }), { people: { sam: SAM } });
  const follows = { AAA111: { since: NOW, row: a } };
  assert.deepEqual(friendRounds(baseState(), { rows: [], follows, status: 'ready', now: NOW }), []);
  for (const status of ['off', 'offline', 'signed-out', 'unknown']) {
    assert.deepEqual(friendRounds(baseState(), { rows: [], follows, status, now: NOW }).map(v => v.code), ['AAA111'], status);
  }
  // A copy left over from long ago isn't live news
  const old = { AAA111: { since: NOW, row: { ...a, updated_at: new Date(NOW - 20 * HOUR).toISOString() } } };
  assert.deepEqual(friendRounds(baseState(), { rows: [], follows: old, status: 'off', now: NOW }), []);
});

test('feed: Up next shows live friends’ rounds and ones finished in the last day, three at most', () => {
  const rows = ['AAA111', 'BBB222', 'CCC333', 'DDD444'].map((code, i) => rowOf(skinsRound({ code }), { at: NOW - i * 60e3, people: { sam: SAM } }));
  const old = rowOf(skinsRound({ code: 'OLD111', status: 'done', played: 9 }), { at: NOW - 30 * HOUR, people: { sam: SAM } });
  const list = friendRounds(baseState(), { rows: [...rows, old], status: 'ready', now: NOW });
  assert.equal(list.length, 5);
  assert.deepEqual(upNextFriends(list, { now: NOW }).map(v => v.code), ['AAA111', 'BBB222', 'CCC333']);
  const doneOnly = friendRounds(baseState(), { rows: [old], status: 'ready', now: NOW });
  assert.deepEqual(upNextFriends(doneOnly, { now: NOW }), []);
});

test('feed: the group feed has friends’ live rounds, plans you’re invited to, and Lately', () => {
  const live = rowOf(skinsRound({ code: 'AAA111' }), { people: { sam: SAM } });
  const done = rowOf(skinsRound({ code: 'BBB222', status: 'done', played: 9 }), { at: NOW - 2 * HOUR, people: { sam: { ...SAM, money: true }, dave: DAVE } });
  const plans = {
    p1: { id: 'p1', status: 'planned', host: false, hostName: 'Sam Snead', localMe: 'x', date: '2026-10-10', course: { name: 'Pebble Creek' }, game: 'skins', people: [{ id: 'x', name: 'Trevor' }], answers: { x: { status: 'in', at: NOW - HOUR } } },
    p2: { id: 'p2', status: 'planned', host: true, hostWho: 'host', date: '2026-10-11', course: { name: 'Mine' }, game: 'skins', people: [] },
  };
  const state = baseState({ plans, settlements: [{ id: 's1', from: 'sam', to: 'me', amount: 9, at: NOW - 3 * HOUR }], players: { me: { id: 'me', name: 'Trevor' }, sam: { id: 'sam', name: 'Sam' } } });
  const rounds = friendRounds(state, { rows: [live, done], status: 'ready', now: NOW });
  const feed = groupFeed(state, { rounds, now: NOW });
  assert.deepEqual(feed.live.map(v => v.code), ['AAA111']);
  assert.deepEqual(feed.plans.map(p => p.id), ['plan:p1']);
  assert.equal(feed.plans[0].text, 'Sam invited you · Saturday');
  assert.match(feed.plans[0].sub, /You’re in$/);
  assert.deepEqual(feed.lately.map(i => i.kind), ['friend', 'payment']);
  assert.equal(feed.lately[0].text, 'Skins at Pebble Creek · Sam took it, +$8');
  assert.match(feed.lately[0].sub, /^Sam played · /);
  assert.equal(feed.lately[0].talkKey, 'follow:BBB222');
});

test('feed: a finished round lists only the amounts people chose to show', () => {
  const r = skinsRound({ status: 'done', played: 9 });
  const both = friendRoundView(rowOf(r, { people: { sam: { ...SAM, money: true }, dave: { ...DAVE, money: true } } }));
  assert.match(friendRoundItem(both, NOW).sub, /Dave −\$4/);
  const none = friendRoundView(rowOf(r, { people: { sam: SAM, dave: DAVE } }));
  assert.ok(!friendRoundItem(none, NOW).sub.includes('$'));
  assert.ok(!friendRoundItem(none, NOW).text.includes('$'));
});

test('feed: talk on a round you watch shows the newest comment by someone else', () => {
  const live = rowOf(skinsRound({ code: 'AAA111' }), { people: { sam: SAM } });
  const talk = { 'follow:AAA111': {
    c1: { id: 'c1', on: 'round', kind: 'comment', who: 'sam', name: 'Sam', body: 'Two skins already', at: NOW - 10 * 60e3 },
    c2: { id: 'c2', on: 'round', kind: 'comment', who: 'me', name: 'Trevor', body: 'Mine', at: NOW - 5 * 60e3, mine: true },
  } };
  const state = baseState({ talk });
  const rounds = friendRounds(state, { rows: [live], follows: { AAA111: { since: NOW, row: live } }, status: 'ready', now: NOW });
  const feed = groupFeed(state, { rounds, now: NOW });
  const t = feed.lately.find(i => i.kind === 'talk');
  assert.equal(t.text, 'Sam: “Two skins already”');
  assert.deepEqual(t.target, ['friendRound', { code: 'AAA111' }]);
});

test('feed: a plan you organize isn’t an invite, and a past one is gone', () => {
  const p = { id: 'p3', status: 'planned', host: false, hostName: '', date: '2026-10-08', course: null, game: 'skins', people: [] };
  assert.equal(planItem(p, new Date(NOW)).text, 'A friend invited you · Thursday');
  const feed = groupFeed(baseState({ plans: { p3: { ...p, date: '2026-10-01' } } }), { rounds: [], now: NOW });
  assert.deepEqual(feed.plans, []);
});

test('feed: following friends’ rounds never changes your own rounds or money', () => {
  const mine = skinsRound({ id: 'mine', code: 'MINE11', status: 'done', played: 9 });
  mine.shared = { code: 'MINE11', host: true };
  const state = baseState({ rounds: { mine } });
  const before = JSON.stringify(state);
  const res = JSON.stringify(roundResults(mine));
  friendRounds(state, { rows: [rowOf(skinsRound({ code: 'AAA111' }), { people: { sam: SAM } })], status: 'ready', now: NOW });
  groupFeed(state, { rounds: [], now: NOW });
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(roundResults(mine)), res);
});
