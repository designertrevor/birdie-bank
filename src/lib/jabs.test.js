// Reactions and quick jabs on challenges and settle-ups (o9 jabs): the jab picker (lists per
// moment, money jabs only on money, never a casino line), what each thing's jabs can be about, who
// talks on a challenge and where a payment on the Tab talks, the server's rules for a challenge's
// talk, and that none of it shows an amount or changes money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, roundResults } from './round.js';
import { tabResults } from './play-for.js';
import { newChallenge, withMove } from './challenges.js';
import {
  JABS, MAX_BODY, MAX_JABS, challengeTalk, challengeThread, challengeTitle, contextOf, jabArt, jabsFor, latelyTalk, newComment,
  payParts, payTarget, paymentTalk, recentTalkKeys, roundTalk, roundThread, talkToDb,
} from './talk.js';
import { anyBirdie, anyThreePutt, challengeMoments, linePaid, roundMoments, settleMoments } from './jab-moments.js';
import { challengeSeats, joinRows, mayAdd, seatsFor } from './talk-access.js';
import { BUDDIES } from './avatars.js';

const DAY = 864e5;
const NOW = new Date(2026, 9, 7, 12).getTime();
const course = {
  id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'Blue', color: '#00f', rating: 36.0, slope: 120 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const PLAYERS = [
  { id: 'me', name: 'Trevor Nielsen', index: 10, tee: 'Blue' },
  { id: 'sam', name: 'Sam Ortiz', index: 2, tee: 'Blue' },
];

// Sam wins the first two holes' skins, so Trevor owes Sam; `birdie` gives Sam a 3 on hole 1
function skins({ id = 'r1', at = NOW - DAY, birdie = false, playFor = null } = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, nine: 'front', players: PLAYERS, settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  r.holes.forEach((h, i) => { r.scores[h.no] = { me: i < 2 ? 5 : 4, sam: i === 0 && birdie ? 3 : 4 }; });
  return { ...r, status: 'done', createdAt: at, finishedAt: at, ...(playFor ? { playFor } : {}) };
}
const stateWith = ({ rounds = [], settlements = [], challenges = {}, talk = {} } = {}) => ({
  me: 'me', links: {}, unlinks: [],
  players: { me: { id: 'me', name: 'Trevor Nielsen' }, sam: { id: 'sam', name: 'Sam Ortiz' } },
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements, plans: {}, customCourses: { c9: course }, talk, challenges,
});

const ALL = Object.values(JABS).flat();
const keys = list => list.map(j => j.key);

// --------------------------- the jab picker -----------------------------------

test('jabs: every jab is short, friendly and unique, and none sounds like a casino', () => {
  const k = keys(ALL);
  assert.equal(new Set(k).size, k.length, 'a posted jab keeps its key, so each is unique');
  for (const j of ALL) {
    assert.ok(j.key.length <= 32, `${j.key} fits the server column`);
    assert.ok(j.text.length <= 60 && j.text.length <= MAX_BODY, j.text);
    assert.ok(!j.text.includes(String.fromCharCode(0x2014)), 'no em dashes');
    assert.ok(!/\$|\d/.test(j.text), 'never an amount');
    assert.ok(!/casino|jackpot|odds|all in|bookie|house always|gambl|wager/i.test(j.text), j.text);
  }
  // A list for each moment the brief names: a birdie, a three-putt, a loss, a payment, a challenge accepted
  for (const m of ['birdie', 'threePutt', 'loss', 'win', 'owed', 'paid', 'chOpen', 'chAccepted', 'chDeclined', 'challenge']) assert.ok(JABS[m]?.length >= 2, m);
  assert.ok(JABS.owed.some(j => j.text === 'Pay up, partner'), 'a "Pay up" jab on a line still owed');
  // Trevor kept "Double or nothing?" (2026-10-06): golf talk for a rematch on a bet
  assert.equal(JABS.bet.find(j => j.key === 'double')?.text, 'Double or nothing?');
});

test('jabs: a moment’s jabs come first, then the thing’s own, each once and at most eight', () => {
  // No moment: the list as it was (the same list)
  assert.equal(jabsFor('round'), JABS.round);
  assert.equal(jabsFor('challenge'), JABS.challenge);
  assert.equal(contextOf('challenge'), 'challenge');
  const list = jabsFor('round', { moments: ['loss', 'birdie'] });
  assert.deepEqual(keys(list).slice(0, 3), keys(JABS.loss));
  assert.deepEqual(keys(list).slice(3, 6), keys(JABS.birdie));
  assert.equal(list.length, MAX_JABS);
  assert.equal(new Set(keys(list)).size, list.length);
  // A settle-up line still owed leads with "Pay up"; once paid, with the paid ones
  assert.equal(jabsFor(payTarget('me', 'sam'), { moments: ['owed'] })[0].key, 'payUp');
  assert.equal(jabsFor(payTarget('me', 'sam'), { moments: ['paid'] })[0].key, 'finally');
  // An unknown moment changes nothing
  assert.equal(jabsFor('round', { moments: ['nope'] }), JABS.round);
});

test('jabs: on a thing not played for money, no money jab shows, moment or not', () => {
  const list = jabsFor(payTarget('me', 'sam'), { money: false, moments: ['owed'] });
  assert.ok(!keys(list).includes('payUp'));
  assert.ok(keys(list).includes('tabForgets'), 'the rest of the moment stays');
  assert.ok(!jabsFor('round', { money: false, moments: ['win'] }).some(j => j.money));
  assert.ok(!jabsFor('challenge', { money: false, moments: ['chAccepted'] }).some(j => j.money));
});

test('jabs: a friend watching keeps the gallery’s list, whatever happened in the round', () => {
  assert.deepEqual(jabsFor('round', { set: 'gallery', money: false, moments: [] }), JABS.gallery);
});

test('jabs: the critter by the picker follows the first moment, else the kind of thing, and is real Ball buddies art', () => {
  const ids = new Set(BUDDIES.map(b => b.id));
  assert.equal(jabArt('round', { moments: ['birdie'] }).id, 'birdie');
  assert.equal(jabArt('round', { moments: ['loss', 'birdie'] }).id, 'frog');
  assert.equal(jabArt(payTarget('a', 'b'), { moments: ['owed'] }).id, 'gopher');
  assert.equal(jabArt('challenge', { moments: ['chAccepted'] }).id, 'eagle');
  assert.equal(jabArt('plan').id, 'flag');
  for (const on of ['round', 'plan', 'challenge', payTarget('a', 'b'), 'bet:x']) {
    for (const m of [[], ...Object.keys(JABS).map(k => [k])]) assert.ok(ids.has(jabArt(on, { moments: m }).id), `${on} ${m}`);
  }
});

test('jabs: picking one posts its own words and keeps its key, on a challenge too', () => {
  const c = newComment({ id: 'c1', on: 'challenge', who: 'dave', name: 'Dave', jab: 'chGameOn' });
  assert.equal(c.body, 'Game on');
  assert.equal(c.jab, 'chGameOn');
  const row = talkToDb('challenge', 'ABC123', c);
  assert.equal(row.scope, 'challenge');
  assert.equal(row.target, 'challenge');
  assert.equal(row.jab, 'chGameOn');
  // The old keys still read as jabs on rows already sent (moved lists, same keys)
  assert.equal(newComment({ id: 'c2', on: payTarget('a', 'b'), who: 'a', jab: 'finally' }).body, 'Paid in full. Finally');
});

// --------------------------- moments -----------------------------------------------

test('moments: how the round went for you, then a birdie and a three-putt when there was one', () => {
  const plain = skins();
  assert.deepEqual(roundMoments(plain, 'me'), ['loss']);
  assert.deepEqual(roundMoments(plain, 'sam'), ['win']);
  assert.deepEqual(roundMoments(plain, null), [], 'a watcher has no result of their own');
  const birdie = skins({ birdie: true });
  assert.equal(anyBirdie(birdie), true);
  assert.equal(anyBirdie(plain), false);
  assert.deepEqual(roundMoments(birdie, 'me'), ['loss', 'birdie']);
  const putts = { ...plain, marks: { 3: { snake: ['sam'] } } };
  assert.equal(anyThreePutt(putts), true);
  assert.equal(anyThreePutt(plain), false);
  assert.deepEqual(roundMoments(putts, 'sam'), ['win', 'threePutt']);
  // A points round still has a winner and a loser, never in dollars
  assert.deepEqual(roundMoments(skins({ playFor: { kind: 'points' } }), 'me'), ['loss']);
});

test('moments: a settle-up line is owed until it is paid in full, then paid', () => {
  const r = skins();
  const t = tabResults(r).transfers[0];
  assert.deepEqual([t.from, t.to], ['me', 'sam']);
  assert.deepEqual(settleMoments(stateWith({ rounds: [r] }), r, t.from, t.to), ['owed']);
  const part = { id: 's1', from: 'me', to: 'sam', amount: t.amount / 2, at: NOW, roundId: r.id };
  assert.equal(linePaid(stateWith({ rounds: [r], settlements: [part] }), r, 'me', 'sam'), false, 'part of it is still owed');
  const all = { ...part, amount: t.amount };
  assert.deepEqual(settleMoments(stateWith({ rounds: [r], settlements: [all] }), r, 'me', 'sam'), ['paid']);
  assert.equal(linePaid(stateWith({ rounds: [r] }), r, 'sam', 'me'), true, 'a line that is not on the Tab is never asked for');
});

test('moments: a round’s talk knows its moments on the round and on each line', () => {
  const r = skins({ birdie: true });
  const ctx = roundTalk(r, stateWith({ rounds: [r] }));
  assert.deepEqual(ctx.momentsOn('round'), ['loss', 'birdie']);
  assert.deepEqual(ctx.momentsOn(payTarget('me', 'sam')), ['owing'], 'Trevor pays this line, so his jabs are the payer’s');
  assert.deepEqual(ctx.momentsOn('bet:b1'), []);
  assert.deepEqual(payParts(payTarget('me', 'sam')), { from: 'me', to: 'sam' });
  assert.equal(payParts('round'), null);
});

test('moments: a challenge waiting, agreed or passed', () => {
  const ch = newChallenge({ id: 'c1', from: { who: 'dave', name: 'Dave' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, now: NOW });
  assert.deepEqual(challengeMoments(ch), ['chOpen']);
  assert.deepEqual(challengeMoments(withMove(ch, { id: 'm1', side: 'to', move: 'accept', at: NOW + 1 })), ['chAccepted']);
  assert.deepEqual(challengeMoments(withMove(ch, { id: 'm1', side: 'to', move: 'decline', at: NOW + 1 })), ['chDeclined']);
  assert.deepEqual(challengeMoments(withMove(ch, { id: 'm1', side: 'from', move: 'withdraw', at: NOW + 1 })), []);
  assert.deepEqual(challengeMoments(null), []);
});

test('moments: none of it changes a round’s money', () => {
  const r = skins({ birdie: true });
  const before = JSON.stringify(roundResults(r));
  roundMoments(r, 'me');
  settleMoments(stateWith({ rounds: [r] }), r, 'me', 'sam');
  roundTalk(r, stateWith({ rounds: [r] })).momentsOn('round');
  assert.equal(JSON.stringify(roundResults(r)), before);
});

// --------------------------- challenges ----------------------------------------------

const dave = { who: 'dave', name: 'Dave Smith' };
const mike = { who: 'mike', name: 'Mike Jones' };
const made = (o = {}) => ({ ...newChallenge({ id: 'c1', from: dave, to: mike, kind: 'match', stake: 20, now: NOW - DAY, ...o }), code: 'ABC123' });

test('challenge talk: each of the two talks as their own side, by the ids it was made with', () => {
  const mine = challengeTalk(stateWith(), { ...made(), mine: 'from', made: true });
  assert.equal(mine.key, challengeThread({ id: 'c1' }));
  assert.equal(mine.key, 'challenge:c1');
  assert.equal(mine.who, 'dave');
  assert.equal(mine.myName, 'Dave');
  assert.equal(mine.seatName('mike'), 'Mike', 'a challenge keeps first names');
  assert.equal(mine.kind, 'challenge');
  const theirs = challengeTalk(stateWith(), { ...made(), mine: 'to', made: false });
  assert.equal(theirs.who, 'mike');
  assert.equal(mine.moneyOn('challenge'), true);
  assert.equal(challengeTalk(stateWith(), { ...made({ unit: 'points' }), mine: 'from', made: true }).moneyOn('challenge'), false, 'a points challenge never talks money');
  assert.deepEqual(mine.momentsOn('challenge'), ['chOpen']);
});

test('challenge talk: whoever set it up between two others joins in; nobody else does', () => {
  const setUp = { ...made({ setBy: { who: 'me', name: 'Trevor' } }), mine: null, made: true };
  assert.equal(challengeTalk(stateWith(), setUp).who, 'me');
  const stranger = { ...made(), mine: null, made: false };
  assert.equal(challengeTalk(stateWith(), stranger).who, null, 'someone who only has the link is not in it');
  assert.equal(challengeTalk(stateWith(), { id: 'bad' }), null);
});

test('challenge talk: Lately shows the other person’s jab with the challenge, never its amount', () => {
  const ch = { ...made(), mine: 'from', made: true };
  const row = { ...newComment({ id: 'c:1', on: 'challenge', who: 'mike', name: 'Mike', jab: 'chTick', now: NOW - 3600e3 }), mine: false };
  const state = stateWith({ challenges: { c1: ch }, talk: { 'challenge:c1': { [row.id]: row } } });
  const items = latelyTalk(state, NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'Mike: “Tick tock. In or out?”');
  assert.match(items[0].sub, /^Challenge with Mike: match/);
  assert.ok(!/\$|20/.test(items[0].sub), 'no amount');
  assert.deepEqual(items[0].target, ['challenge', { id: 'c1' }]);
  // Your own jab isn't news to you
  const own = { ...row, who: 'dave', mine: true };
  assert.deepEqual(latelyTalk(stateWith({ challenges: { c1: ch }, talk: { 'challenge:c1': { [own.id]: own } } }), NOW), []);
  // Someone who isn't in it gets nothing, even with rows on the phone
  assert.deepEqual(latelyTalk(stateWith({ challenges: { c1: { ...ch, mine: null, made: false } }, talk: { 'challenge:c1': { [row.id]: row } } }), NOW), []);
});

test('challenge talk: its title names the other person and the kind, never the stake', () => {
  const ch = made({ kind: 'ctp' });
  assert.equal(challengeTitle(ch, 'dave'), 'Challenge with Mike: closest to the pin');
  assert.equal(challengeTitle(ch, 'mike'), 'Challenge with Dave: closest to the pin');
  assert.equal(challengeTitle(ch, 'me'), 'Dave v Mike: closest to the pin');
});

test('challenge talk: the phone looks up the challenges you are in that are still going, once they have a code', () => {
  const live = { ...made(), mine: 'from', made: true };
  assert.ok(recentTalkKeys(stateWith({ challenges: { c1: live } }), { now: NOW }).includes('challenge:c1'));
  assert.ok(!recentTalkKeys(stateWith({ challenges: { c1: { ...live, code: null } } }), { now: NOW }).includes('challenge:c1'), 'not sent yet: nothing to look up');
  assert.ok(!recentTalkKeys(stateWith({ challenges: { c1: { ...live, mine: null, made: false } } }), { now: NOW }).includes('challenge:c1'), 'not yours');
  // One that's over is looked up only while its talk is recent
  const over = withMove(live, { id: 'm1', side: 'to', move: 'decline', at: NOW - DAY + 1 });
  assert.ok(!recentTalkKeys(stateWith({ challenges: { c1: over } }), { now: NOW }).includes('challenge:c1'));
  const said = { 'c:1': { id: 'c:1', on: 'challenge', kind: 'comment', who: 'mike', body: 'Next time', at: NOW - DAY, updatedAt: NOW - DAY } };
  assert.ok(recentTalkKeys(stateWith({ challenges: { c1: over }, talk: { 'challenge:c1': said } }), { now: NOW }).includes('challenge:c1'));
});

// --------------------------- a payment on the Tab ------------------------------------

test('paid marks: a payment talks on its round’s settle-up line, the newest round you played', () => {
  const old = skins({ id: 'r0', at: NOW - 5 * DAY });
  const r = skins({ id: 'r1', at: NOW - DAY });
  const t = tabResults(r).transfers[0];
  const pay = { key: 'k', at: NOW, from: 'me', to: 'sam', amount: 2 * t.amount, settlements: [
    { id: 's0', from: 'me', to: 'sam', amount: t.amount, at: NOW, roundId: 'r0' },
    { id: 's1', from: 'me', to: 'sam', amount: t.amount, at: NOW, roundId: 'r1', code: null },
  ] };
  const state = stateWith({ rounds: [old, r], settlements: pay.settlements });
  const pt = paymentTalk(state, pay);
  assert.equal(pt.round.id, 'r1');
  assert.equal(pt.on, payTarget('me', 'sam'));
  assert.equal(roundThread(pt.round), 'round:r1');
  // The same line the round's page shows, so it reads as paid there and here
  assert.deepEqual(roundTalk(pt.round, state).momentsOn(pt.on), ['paid']);
});

test('paid marks: a payment no round of yours explains has no talk', () => {
  const r = skins();
  // Money passed on, with no round
  assert.equal(paymentTalk(stateWith({ rounds: [r] }), { settlements: [{ id: 's_x', from: 'me', to: 'sam', amount: 5, at: NOW }] }), null);
  // A trip's expenses
  assert.equal(paymentTalk(stateWith({ rounds: [r] }), { settlements: [{ id: 'e1', from: 'me', to: 'sam', amount: 5, at: NOW, roundId: 'r1', expensePay: true }] }), null);
  // A round that's gone from this phone, or one you only watched
  assert.equal(paymentTalk(stateWith(), { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 2, at: NOW, roundId: 'r1' }] }), null);
  const watched = { ...r, players: [{ ...PLAYERS[1] }, { id: 'pat', name: 'Pat', index: 3, tee: 'Blue' }] };
  assert.equal(paymentTalk({ ...stateWith({ rounds: [watched] }), me: 'me' }, { settlements: [{ id: 's1', from: 'pat', to: 'sam', amount: 2, at: NOW, roundId: 'r1' }] }), null);
  assert.equal(paymentTalk(stateWith(), null), null);
});

// --------------------------- the server's rules ---------------------------------------

test('talk access: a challenge is its two people and whoever set it up, once a phone has joined with the code', () => {
  const meta = { from: { who: 'dave' }, to: { who: 'mike' } };
  assert.deepEqual(challengeSeats(meta), ['dave', 'mike']);
  assert.deepEqual(challengeSeats({ ...meta, setBy: { who: 'trev' } }), ['dave', 'mike', 'trev']);
  assert.equal(challengeSeats(null), null);
  assert.equal(challengeSeats({}), null);
  const W = 'w'.repeat(64);
  // Not joined: nothing, even with the challenge there
  assert.equal(seatsFor({ scope: 'challenge', challenge: meta, w: W }), null);
  const joined = joinRows({ scope: 'challenge', challenge: meta, w: W, user: 'u1' });
  assert.deepEqual(joined, [{ member: `d:${W}`, seats: ['dave', 'mike'] }, { member: 'u:u1', seats: ['dave', 'mike'] }]);
  assert.deepEqual(seatsFor({ scope: 'challenge', challenge: meta, joined, w: W }), ['dave', 'mike']);
  assert.deepEqual(seatsFor({ scope: 'challenge', challenge: meta, joined, user: 'u1' }), ['dave', 'mike'], 'the account from another phone');
  // The talk outlives the challenge: the people remembered on joining
  assert.deepEqual(seatsFor({ scope: 'challenge', challenge: null, joined, w: W }), ['dave', 'mike']);
  // No challenge, no joining
  assert.deepEqual(joinRows({ scope: 'challenge', challenge: null, w: W }), []);
  // Only as one of its people
  assert.equal(mayAdd({ who: 'dave' }, ['dave', 'mike']), true);
  assert.equal(mayAdd({ who: 'pat' }, ['dave', 'mike']), false);
});

test('talk access: the challenge talk SQL is new, safe to run again, and keeps the code lock', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-07-challenge-talk.sql', import.meta.url), 'utf8');
  assert.ok(!sql.includes(String.fromCharCode(0x2014)));
  assert.match(sql, /create or replace function public\.join_challenge_comments\(p_code text\)/);
  assert.match(sql, /create or replace function public\.comment_seats\(p_scope text, p_code text\)/);
  assert.match(sql, /check \(scope in \('round', 'plan', 'challenge'\)\)/);
  // Read only after joining with the code: the challenge branch needs a membership row
  assert.match(sql, /if p_scope = 'challenge' then\s+if not exists \(select 1 from public\.comment_members/);
  // Every create is repeatable, and the helper isn't callable from outside
  assert.ok(!/create (table|function|policy) (?!if not exists|or replace)/i.test(sql.replace(/create or replace/gi, '')), 'only create or replace');
  assert.match(sql, /revoke all on function public\.comment_challenge_seats\(text\) from public, anon, authenticated/);
  assert.match(sql, /drop constraint if exists/);
  // The round's own rules are kept as they were
  const before = readFileSync(new URL('../../supabase/2026-10-04-comments.sql', import.meta.url), 'utf8');
  const roundPart = s => s.slice(s.indexOf("if p_scope is distinct from 'round'"), s.indexOf('end $$', s.indexOf("if p_scope is distinct from 'round'")));
  assert.equal(roundPart(sql), roundPart(before));
  assert.match(before, /select r\.meta into m from public\.live_rounds/);
});

// --------------------------- review fixes ------------------------------------

test('review: a line you still owe leads with the payer’s jabs, a line owed to you with the payee’s', () => {
  const r = skins();
  const st = stateWith({ rounds: [r] });
  assert.deepEqual(settleMoments(st, r, 'me', 'sam', 'me'), ['owing'], 'Trevor pays Sam: Trevor is the one owing');
  assert.deepEqual(settleMoments(st, r, 'me', 'sam', 'sam'), ['owed'], 'Sam is owed');
  assert.deepEqual(settleMoments(st, r, 'me', 'sam'), ['owed'], 'nobody in particular: owed');
  const paid = stateWith({ rounds: [r], settlements: [{ id: 's1', from: 'me', to: 'sam', amount: tabResults(r).transfers[0].amount, at: NOW, roundId: r.id }] });
  assert.deepEqual(settleMoments(paid, r, 'me', 'sam', 'me'), ['paid'], 'paid is paid, whoever looks');
  // On the round's page Trevor (the payer) never gets "Pay up, partner" first
  const ctx = roundTalk(r, st);
  assert.equal(ctx.who, 'me');
  const list = jabsFor(payTarget('me', 'sam'), { money: true, moments: ctx.momentsOn(payTarget('me', 'sam')) });
  assert.equal(list[0].key, 'owingMail');
  assert.ok(!keys(list).includes('payUp'));
  assert.equal(jabArt(payTarget('me', 'sam'), { moments: ['owing'] }).id, 'goose');
  // Nothing about it moves money
  assert.deepEqual(roundResults(r).balances, roundResults(skins()).balances);
});

test('review: while a challenge waits, the one whose call it is gets their own jabs', () => {
  const ch = newChallenge({ id: 'c1', from: { who: 'dave', name: 'Dave' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, now: NOW });
  assert.deepEqual(challengeMoments(ch, 'to'), ['chAsked'], 'Mike was asked');
  assert.deepEqual(challengeMoments(ch, 'from'), ['chOpen'], 'Dave asked');
  assert.deepEqual(challengeMoments(ch), ['chOpen'], 'whoever set it up');
  const countered = withMove(ch, { id: 'm1', side: 'to', move: 'counter', stake: 30, at: NOW + 1 });
  assert.deepEqual(challengeMoments(countered, 'from'), ['chAsked'], 'a counter puts it back to Dave');
  assert.deepEqual(challengeMoments(countered, 'to'), ['chOpen']);
  const between = newChallenge({ id: 'c2', from: { who: 'dave', name: 'Dave' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, setBy: { who: 'me', name: 'Trevor' }, now: NOW });
  assert.deepEqual(challengeMoments(between, 'from'), ['chAsked'], 'set up between two: both are asked');
  assert.deepEqual(challengeMoments(between, 'to'), ['chAsked']);
  const theirs = challengeTalk(stateWith(), { ...ch, mine: 'to', made: false });
  assert.deepEqual(theirs.momentsOn('challenge'), ['chAsked']);
  assert.equal(jabsFor('challenge', { moments: ['chAsked'] })[0].key, 'chCalendar');
  assert.equal(jabArt('challenge', { moments: ['chAsked'] }).id, 'gopher');
});

test('review: a phone that joined a challenge’s talk keeps it after the challenge is tidied up', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-07-challenge-talk.sql', import.meta.url), 'utf8');
  const join = sql.slice(sql.indexOf('create or replace function public.join_challenge_comments'), sql.indexOf('end $$', sql.indexOf('create or replace function public.join_challenge_comments')));
  assert.ok(!/if s is null then return null/.test(join), 'no early null when the challenge is gone');
  assert.match(join, /if s is not null then[\s\S]*end if;\s*return public\.comment_seats\('challenge', p_code\);/);
  // The same in JavaScript: remembered seats once the challenge is gone, nothing for a stranger
  assert.deepEqual(seatsFor({ scope: 'challenge', challenge: null, joined: [{ member: 'd:w1', seats: ['dave'] }], w: 'w1' }), ['dave']);
  assert.equal(seatsFor({ scope: 'challenge', challenge: null, joined: [], w: 'w1' }), null);
});

test('review: a payment card on the Tab is as wide as the plain rows, and jabs keep a 44px tap target', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('(o9 jabs)'));
  assert.match(block, /\.pay-talk \.ledger-row \{[^}]*width: 100%/);
  assert.ok(!/\.talk-jab \{[^}]*min-height: 40px/.test(block), 'no 40px jabs');
});
