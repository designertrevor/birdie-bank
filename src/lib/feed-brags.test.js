// Brags in the Friends feed (feed-brags.js): eagles, hot rounds, birdie streaks, big wins, lone
// wolves, Nassau sweeps and hammer runs, from rounds the feed already has, and never past anyone's
// profile setting: Only you never shows, and hidden money shows the win without the amount.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { buildHoles, buildMeta } from './sync-model.js';
import { feedHole, feedMeta, feedPeople, feedRoundOk, feedSeats, friendRounds } from './friend-feed.js';
import {
  BIG_WIN, MAX_BRAGS, PER_ROUND, bragLook, feedBrags, hammerRun, loneWolfWins, nassauSweep, roundBrags, scoringOf,
} from './feed-brags.js';

const HOUR = 36e5;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 20, 15).getTime();
const flat = n => ({ id: 'f', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const PEOPLE = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss'].map((name, i) => ({ id: 'abcd'[i], name, index: 0 }));
const SETTINGS = {
  skins: { value: 5, carryover: false, kind: 'net', payout: 'per' },
  wolf: { point: 2, loneMultiplier: 2 },
  hammer: { stake: 5, max: 3, who: 'either' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off' },
};

let n = 0;
/** A finished round: `ids` play, everyone makes par unless `over` says ({ 1: { a: 3 } }). */
function mk(game, { ids = 'abcd', holes = 9, over = {}, at = NOW - HOUR, playFor = null, code = null } = {}) {
  n++;
  const r = createRound({ id: `r${n}`, game, course: flat(holes), holesCount: holes, players: [...ids].map(id => PEOPLE.find(p => p.id === id)), settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false });
  r.holes.forEach(h => { r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...(over[h.no] || {}) }; });
  r.status = 'done';
  r.createdAt = at - 4 * HOUR;
  r.finishedAt = at;
  if (playFor) r.playFor = playFor;
  r.shareCode = code || `C${String(n).padStart(5, '0')}`;
  return r;
}
/** Skins where `who` wins the first `wins` holes with birdies: $5 from each of the other three a skin. */
const skins = (who, wins, opts = {}) => mk('skins', { ...opts, over: Object.fromEntries(Array.from({ length: wins }, (_, i) => [i + 1, { [who]: 3 }])) });

const state = (rounds = [], extra = {}) => ({
  me: 'a', players: Object.fromEntries(PEOPLE.map(p => [p.id, { id: p.id, name: p.name }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), crews: {}, settlements: [], plans: {}, talk: {}, ...extra,
});

// The server's rules in JavaScript (friend-feed.js), to make the rows friend_rounds() would send
const ACCOUNTS = { a: 'acct-ann', b: 'acct-bo', c: 'acct-cy' }; // Di is a guest with no account
function serve(r, { me = 'acct-me', friends = new Set(['acct-ann']), privacy = {}, at = r.finishedAt } = {}) {
  const m = buildMeta(r);
  if (!feedRoundOk(m, { me, friends, accounts: ACCOUNTS, privacy })) return null;
  const keep = feedSeats(m, { accounts: ACCOUNTS, privacy }).every(s => s.money && friends.has(s.account));
  const meta = feedMeta(m, { money: keep });
  const holes = Object.fromEntries(Object.entries(buildHoles(r)).map(([no, d]) => [no, feedHole(d, meta)]));
  return {
    code: keep ? r.shareCode : null, ref: keep ? null : `F${r.shareCode.slice(1)}`, meta, holes,
    people: feedPeople(m, { friends, accounts: ACCOUNTS, privacy }), updated_at: new Date(at).toISOString(),
  };
}
/** A phone (you're Trevor, 'me', in none of these rounds) with the feed's rows. */
function feedFor(rows, extra = {}) {
  const s = { me: 'me', players: { me: { id: 'me', name: 'Trevor' } }, rounds: {}, settlements: [], plans: {}, talk: {}, crews: {}, ...extra };
  const rounds = friendRounds(s, { rows: rows.filter(Boolean), status: 'ready', now: NOW });
  return feedBrags(s, { rounds, now: NOW });
}
const SHOWS = { profile: 'played', showMoney: true };

// --------------------------- detectors -------------------------------------

test('scoring: birdies, eagles and holes in one, never a pickup', () => {
  const r = mk('skins', { over: { 1: { a: 3 }, 2: { a: 2 }, 3: { a: 1 }, 4: { a: 'X' }, 5: { b: 3 } } });
  const s = scoringOf(r, 'a');
  // A 1 on a par 4 is a hole in one, not an eagle
  assert.deepEqual({ birdies: s.birdies, eagles: s.eagles, aces: s.aces, best: s.best }, { birdies: 1, eagles: 1, aces: [3], best: 3 });
  assert.equal(scoringOf(r, 'b').best, 1);
  assert.equal(scoringOf(r, 'zed').played, 0);
});

test('detectors: a lone wolf beating the pack, a Nassau swept, a hammer run', () => {
  const w = mk('wolf', { over: { 1: { a: 3 }, 2: { b: 5 } } });
  w.wolf[1] = { wolf: 'a', partner: null };
  w.wolf[2] = { wolf: 'b', partner: null, blind: true }; // Bo goes blind and loses: not a brag
  w.wolf[3] = { wolf: 'c', partner: 'd' };
  assert.deepEqual([...loneWolfWins(w)], [['a', { holes: [1], blind: false }]]);
  // Ann wins every hole of a 9-hole Nassau: front, back and total
  assert.equal(nassauSweep(mk('nassau', { ids: 'ab', over: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => [h, { a: 3 }])) })), 0);
  // Bo wins the back: no sweep
  assert.equal(nassauSweep(mk('nassau', { ids: 'ab', over: { 1: { a: 3 }, 6: { b: 3 } } })), null);
  const h = mk('hammer', { ids: 'ab', over: { 1: { a: 3 }, 2: { a: 3 }, 3: { a: 3 } } });
  [1, 2, 3].forEach(no => { h.marks[no] = { conceded: null, hammers: [0] }; });
  assert.deepEqual(hammerRun(h), { side: 0, holes: 3 });
  // Two hammered holes in a row isn't a run
  delete h.marks[3];
  assert.equal(hammerRun(h), null);
});

test('look: the game’s own art for its own moments, in its group’s colour', () => {
  assert.deepEqual(bragLook('wolf', 'lonewolf'), { icon: 'paw-print', tint: 'ochre' });
  assert.deepEqual(bragLook('hammer', 'hammer'), { icon: 'hammer', tint: 'pink' });
  assert.deepEqual(bragLook('bestball', 'birdies'), { icon: 'fire', tint: 'mint' });
  assert.equal(bragLook('nope', 'eagle').tint, 'peach');
});

// --------------------------- your own rounds --------------------------------

test('your rounds: your big win shows its amount, someone else’s says “won big” with none', () => {
  // You win three skins: $45. Bo wins three in another round
  const mine = skins('a', 3);
  const bos = skins('b', 3, { at: NOW - 2 * HOUR });
  const items = feedBrags(state([mine, bos]), { now: NOW });
  const texts = items.map(i => i.text);
  assert.ok(texts.includes('You won $45 at Pebble Creek'), texts.join(' | '));
  assert.ok(texts.includes('Bo won big at Pebble Creek'));
  assert.ok(texts.includes('You made 3 birdies at Pebble Creek. Hot putter'));
  // Money between two other people never shows in the feed
  assert.ok(!items.some(i => /Bo/.test(i.text) && /\$/.test(i.text)));
  // Under the bar is no big win
  const small = skins('a', 1);
  assert.ok(!feedBrags(state([small]), { now: NOW }).some(i => i.brag === 'bigwin'), `less than ${BIG_WIN}`);
  // Each one opens its round, in the game's colour
  const win = items.find(i => i.text === 'You won $45 at Pebble Creek');
  assert.deepEqual(win.target, ['roundDetail', { id: mine.id }]);
  assert.equal(win.tint, 'ochre');
  assert.match(win.sub, /^Skins · 1h ago$/);
});

test('your rounds: points are bragging rights and show for everyone', () => {
  const r = skins('b', 3, { playFor: { kind: 'points' } });
  const texts = feedBrags(state([r]), { now: NOW }).map(i => i.text);
  assert.ok(texts.includes('Bo won 45 pts at Pebble Creek'), texts.join(' | '));
  assert.ok(!texts.some(t => /\$/.test(t)));
});

test('your rounds: an eagle, a hole in one, a lone wolf, a sweep and a hammer run', () => {
  const eagle = mk('skins', { over: { 2: { b: 2 }, 5: { b: 3 } } });
  const ace = mk('skins', { over: { 7: { c: 1 } } });
  const wolf = mk('wolf', { over: { 4: { a: 3 } } });
  wolf.wolf[4] = { wolf: 'a', partner: null };
  const nassau = mk('nassau', { ids: 'ab', over: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => [h, { b: h % 2 ? 3 : 4 }])) });
  const hammer = mk('hammer', { ids: 'ab', over: { 4: { b: 3 }, 5: { b: 3 }, 6: { b: 3 } } });
  [4, 5, 6].forEach(no => { hammer.marks[no] = { conceded: null, hammers: [1] }; });
  const texts = feedBrags(state([eagle, ace, wolf, nassau, hammer]), { now: NOW }).map(i => i.text);
  for (const t of [
    'Bo made an eagle on 2 and 1 birdie at Pebble Creek',
    'Cy made a hole in one on 7 at Pebble Creek. Drinks are on Cy',
    'You went lone wolf on 4 and beat the pack',
    'Bo swept the Nassau at Pebble Creek: front, back and total',
    'Bo won 3 hammered holes in a row at Pebble Creek',
  ]) assert.ok(texts.includes(t), `${t} in: ${texts.join(' | ')}`);
});

test('your rounds: nobody just playing is spotlighted, and a round you only watched isn’t yours', () => {
  const r = skins('b', 3);
  r.justPlaying = { b: true };
  assert.ok(!feedBrags(state([r]), { now: NOW }).some(i => /Bo/.test(i.text)));
  const watched = skins('b', 3);
  watched.players = watched.players.filter(p => p.id !== 'a');
  watched.localMe = null;
  const s = state([watched]);
  s.me = 'zed';
  assert.deepEqual(feedBrags(s, { now: NOW }), []);
});

test('birdie streak: a birdie in three straight rounds, and a round without one breaks it', () => {
  const one = mk('skins', { over: { 1: { c: 3 } }, at: NOW - 3 * DAY });
  const two = mk('skins', { over: { 2: { c: 3 } }, at: NOW - 2 * DAY });
  const three = mk('skins', { over: { 3: { c: 3 } }, at: NOW - DAY });
  const items = feedBrags(state([one, two, three]), { now: NOW });
  const streak = items.find(i => i.brag === 'streak');
  assert.equal(streak.text, 'Cy has made a birdie in 3 straight rounds');
  assert.deepEqual(streak.target, ['roundDetail', { id: three.id }]);
  // A par round in the middle: the last two only
  const par = mk('skins', { at: NOW - 1.5 * DAY });
  assert.ok(!feedBrags(state([one, two, par, three]), { now: NOW }).some(i => i.brag === 'streak'));
  // Your own streak reads as yours
  const mine = [3, 2, 1].map(d => mk('skins', { over: { 1: { a: 3 } }, at: NOW - d * DAY }));
  assert.ok(feedBrags(state(mine), { now: NOW }).some(i => i.text === 'You’ve made a birdie in 3 straight rounds'));
});

test('the window: rounds from the last 7 days, two brags a round at most, and a cap on the feed', () => {
  const old = skins('a', 3, { at: NOW - 8 * DAY });
  assert.deepEqual(feedBrags(state([old]), { now: NOW }), []);
  // A round with an eagle, a hot round and a big win keeps the best two
  const busy = mk('skins', { over: { 1: { a: 2 }, 2: { b: 3 }, 3: { b: 3 }, 4: { b: 3 }, 5: { b: 3 } } });
  assert.equal(roundBrags(busy, { key: 'k', who: id => id, name: id => id }).length, PER_ROUND);
  const lots = Array.from({ length: 20 }, (_, i) => skins('a', 3, { at: NOW - (i + 1) * 60e3 }));
  assert.equal(feedBrags(state(lots), { now: NOW }).length, MAX_BRAGS);
});

// --------------------------- friends' rounds, by everyone's setting ---------

test('friends’ rounds: a friend’s brag shows, with their amount only when everyone’s money may reach you', () => {
  // Ann is your friend; Bo and Cy have accounts, Di is a guest. Ann wins three skins
  const r = skins('a', 3);
  // Everyone with a setting shows their money to you only if they're your friend too
  const all = new Set(['acct-ann', 'acct-bo', 'acct-cy']);
  const open = feedFor([serve(r, { friends: all, privacy: { 'acct-ann': SHOWS, 'acct-bo': SHOWS, 'acct-cy': SHOWS } })]);
  assert.ok(open.some(i => i.text === 'Ann won $45 at Pebble Creek'), open.map(i => i.text).join(' | '));
  assert.ok(open.every(i => i.target[0] === 'friendRound'));
});

test('privacy: hidden money shows the win without the amount, or no amount at all', () => {
  // Ann shows her money, Bo doesn't: the round's money stays back from you, all or none
  const r = mk('wolf', { over: { 1: { a: 3 }, 2: { a: 3 }, 3: { a: 3 }, 4: { a: 3 } } });
  r.wolf[1] = { wolf: 'a', partner: null };
  const items = feedFor([serve(r, { privacy: { 'acct-ann': SHOWS } })]);
  const texts = items.map(i => i.text);
  assert.ok(texts.includes('Ann went lone wolf on 1 and beat the pack'), texts.join(' | '));
  assert.ok(texts.includes('Ann made 4 birdies at Pebble Creek. Hot putter'));
  assert.ok(!texts.some(t => /\$|pts/.test(t)), 'no amount anywhere');
  // With the money kept back there are no results on this phone, so no big win either
  assert.ok(!items.some(i => i.brag === 'bigwin'));
});

test('privacy: Only you never shows, whoever in the round chose it', () => {
  const r = skins('a', 3);
  r.scores[5] = { a: 2, b: 4, c: 4, d: 4 };
  for (const hidden of ['acct-ann', 'acct-bo', 'acct-cy']) {
    const row = serve(r, { privacy: { [hidden]: { profile: 'hidden' } } });
    assert.equal(row, null, `${hidden} keeps the round from you`);
    assert.deepEqual(feedFor([row]), []);
  }
  // Saved before the one setting: a hidden part reads as Only you too
  assert.equal(serve(r, { privacy: { 'acct-bo': { stats: 'hidden' } } }), null);
});

test('privacy: in a friend’s round, only your friends get a brag, never a friend of a friend or a guest', () => {
  // Bo (an account, not your friend) eagles 2, Di (a guest) eagles 3, Ann (your friend) makes par
  const r = mk('skins', { over: { 2: { b: 2 }, 3: { d: 2 } } });
  const items = feedFor([serve(r)]);
  assert.deepEqual(items, []);
  // Once Bo is your friend too, his shows
  const both = feedFor([serve(r, { friends: new Set(['acct-ann', 'acct-bo']) })]);
  assert.deepEqual(both.map(i => i.text), ['Bo made an eagle on 2 at Pebble Creek']);
});

test('friends’ rounds: a friend who is you on another phone reads as you, and a streak spans your phone and the feed', () => {
  // Bo is on this phone as 'b' (the same account as the feed's), with birdies in two of your rounds
  const two = [3, 2].map(d => mk('skins', { over: { 1: { b: 3 } }, at: NOW - d * DAY }));
  const s = state(two, { accountOf: { b: 'acct-bo' } });
  // ...and one more in a round of his you weren't in
  const theirs = mk('skins', { ids: 'bcd', over: { 4: { b: 3 } }, at: NOW - DAY });
  const row = serve(theirs, { friends: new Set(['acct-bo']) });
  const rounds = friendRounds(s, { rows: [row], status: 'ready', now: NOW });
  const items = feedBrags(s, { rounds, now: NOW });
  const streak = items.find(i => i.brag === 'streak');
  assert.equal(streak?.text, 'Bo has made a birdie in 3 straight rounds');
  assert.equal(streak.target[0], 'friendRound');
});
