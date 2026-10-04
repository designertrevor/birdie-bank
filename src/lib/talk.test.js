// Trash talk: comments, reactions and jabs, how rows merge from the server, what Lately and the
// player card show, and that none of it changes a round's money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { latelyItems } from './lately.js';
import { tabResults } from './play-for.js';
import {
  JABS, MAX_BODY, REACTIONS, betTarget, cleanBody, commentsOn, contextOf, countsLine, jabsFor, latelyTalk, mergeRows,
  newComment, payTarget, personTalk, planWho, reactionRowId, reactionsOn, removedRow, roundThread, talkCounts, talkFromDb,
  talkName, talkToDb, talkWho, toggleReaction, unsentRows, validRow, withTalk,
} from './talk.js';

const course = {
  id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'Blue', color: '#00f', rating: 36.0, slope: 120 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const PLAYERS = [
  { id: 'me', name: 'Trevor Nielsen', index: 10, tee: 'Blue' },
  { id: 'sam', name: 'Sam Ortiz', index: 2, tee: 'Blue' },
  { id: 'mike', name: 'Mike', index: 5, tee: 'Blue' },
];
const DAY = 864e5;
const NOW = new Date(2026, 9, 3, 12).getTime();

function skins(id, at) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, nine: 'front', players: PLAYERS, settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  r.holes.forEach((h, i) => { r.scores[h.no] = Object.fromEntries(PLAYERS.map(p => [p.id, i < 2 && p.id !== 'sam' ? 5 : 4])); });
  return { ...r, status: 'done', createdAt: at, finishedAt: at };
}
function stateWith({ rounds = [], talk = {}, plans = {}, links = {} } = {}) {
  return {
    me: 'me', links, unlinks: [],
    players: { me: { id: 'me', name: 'Trevor Nielsen' }, sam: { id: 'sam', name: 'Sam Ortiz' }, mike: { id: 'mike', name: 'Mike' } },
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], plans, customCourses: { c9: course }, talk,
  };
}
const comment = (id, who, body, at, extra = {}) => ({ id, on: 'round', kind: 'comment', who, name: who, body, jab: null, emoji: null, at, updatedAt: at, deleted: false, ...extra });

test('talk: a comment is tidied, capped and needs words', () => {
  assert.equal(cleanBody('  Nice\n\n putt,   finally  '), 'Nice putt, finally');
  assert.equal(cleanBody('x'.repeat(400)).length, MAX_BODY);
  assert.equal(newComment({ id: 'c1', on: 'round', who: 'me', body: '   ' }), null);
  const c = newComment({ id: 'c1', on: 'round', who: 'me', name: '  Trevor  ', body: 'Rematch?', now: 5 });
  assert.deepEqual(c, { id: 'c1', on: 'round', kind: 'comment', who: 'me', name: 'Trevor', body: 'Rematch?', jab: null, emoji: null, at: 5, updatedAt: 5, deleted: false, mine: true });
});

test('talk: a jab posts its own words and keeps its key; an unknown jab is just the text typed', () => {
  const j = newComment({ id: 'c2', on: 'round', who: 'me', jab: 'chip', body: 'ignored' });
  assert.equal(j.body, 'Who taught you to chip?');
  assert.equal(j.jab, 'chip');
  const k = newComment({ id: 'c3', on: 'round', who: 'me', jab: 'nope', body: 'Mine' });
  assert.equal(k.jab, null);
  assert.equal(k.body, 'Mine');
});

test('talk: jabs fit what they are about, and every key is unique', () => {
  assert.equal(contextOf('round'), 'round');
  assert.equal(contextOf(payTarget('sam', 'me')), 'settle');
  assert.equal(contextOf(betTarget('b1')), 'bet');
  assert.equal(contextOf('plan'), 'plan');
  assert.equal(jabsFor('plan'), JABS.plan);
  assert.ok(JABS.round.some(j => j.text === 'Nice putt, finally'));
  assert.ok(JABS.round.some(j => j.text === 'Who taught you to chip?'));
  const keys = Object.values(JABS).flat().map(j => j.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const j of Object.values(JABS).flat()) {
    assert.ok(j.key.length <= 32, 'fits the server column');
    assert.ok(j.text.length <= MAX_BODY);
    assert.ok(!j.text.includes(String.fromCharCode(0x2014)));
  }
});

test('talk: a reaction toggles on and off as one row per person per emoji', () => {
  const on = payTarget('sam', 'me');
  const a = toggleReaction({}, { on, who: 'me', name: 'Trevor', emoji: 'fire', now: 10 });
  assert.equal(a.id, reactionRowId(on, 'me', 'fire'));
  assert.equal(a.deleted, false);
  const b = toggleReaction({ [a.id]: a }, { on, who: 'me', emoji: 'fire', now: 10 });
  assert.equal(b.id, a.id);
  assert.equal(b.deleted, true);
  assert.ok(b.updatedAt > a.updatedAt, 'a change always moves the clock on');
  assert.equal(toggleReaction({}, { on, who: 'me', emoji: 'poop' }), null);
});

test('talk: reactions count each person once, linked seats included, and say which are yours', () => {
  const rows = {};
  for (const [who, emoji] of [['me', 'fire'], ['sam', 'fire'], ['sam2', 'fire'], ['mike', 'laugh'], ['mike', 'clap']]) {
    const r = toggleReaction(rows, { on: 'round', who, emoji, now: 1 });
    rows[r.id] = r;
  }
  rows[reactionRowId('round', 'mike', 'clap')].deleted = true;
  const canon = id => (id === 'sam2' ? 'sam' : id);
  const list = reactionsOn(rows, 'round', { me: 'me', canon });
  assert.deepEqual(list.map(r => [r.key, r.count, r.mine]), [['fire', 2, true], ['laugh', 1, false]]);
  assert.deepEqual(REACTIONS.map(r => r.key), ['clap', 'fire', 'laugh', 'yikes', 'money']);
  assert.deepEqual(talkCounts(rows), { comments: 0, reactions: 4 });
});

test('talk: comments read oldest first and a deleted one is gone, words and all', () => {
  const rows = { a: comment('a', 'sam', 'Second', 20), b: comment('b', 'me', 'First', 10), c: comment('c', 'mike', 'Gone', 15) };
  rows.c = removedRow(rows.c, 30);
  assert.equal(rows.c.body, '');
  assert.equal(rows.c.deleted, true);
  assert.deepEqual(commentsOn(rows).map(c => c.body), ['First', 'Second']);
  assert.equal(countsLine(talkCounts(rows)), '2 comments');
  assert.equal(countsLine({ comments: 1, reactions: 3 }), '1 comment · 3 reactions');
  assert.equal(countsLine({}), null);
});

test('talk: rows from the server merge by the newer edit, and a row waiting to go up stays', () => {
  const mine = { ...comment('a', 'me', 'Mine, edited', 50), mine: true, sent: 40 };
  const theirs = comment('b', 'sam', 'Theirs', 30);
  const local = { a: mine, b: { ...theirs, sent: 30 } };
  // The server's copy of mine is older: mine stays. Theirs was deleted on their phone: it goes.
  const next = mergeRows(local, [{ ...mine, body: 'Mine', updatedAt: 40, mine: true }, { ...theirs, deleted: true, body: '', updatedAt: 60 }]);
  assert.equal(next.a.body, 'Mine, edited');
  assert.equal(next.b.deleted, true);
  assert.equal(next.b.sent, 60);
  // Nothing new: the same object back, so nothing is saved
  assert.equal(mergeRows(next, [{ ...theirs, deleted: true, body: '', updatedAt: 60 }]), next);
  // Junk from the server is left out
  assert.equal(mergeRows({}, [{ id: 'x', on: 'round', who: 'sam', kind: 'reaction', emoji: 'poop' }]).x, undefined);
  assert.equal(validRow({ id: 'x', on: 'round', who: 'sam', kind: 'comment', body: '  ' }), false);
});

test('talk: only your own rows that the server hasn’t taken go up', () => {
  const rows = {
    a: { ...comment('a', 'me', 'New', 5), mine: true },
    b: { ...comment('b', 'me', 'Sent', 5), mine: true, sent: 5 },
    c: { ...comment('c', 'sam', 'Theirs', 5) },
    d: { ...comment('d', 'me', 'Refused', 5), mine: true, refused: true },
  };
  assert.deepEqual(unsentRows(rows).map(r => r.id), ['a']);
});

test('talk: server rows go out without who wrote them and come back marked yours by device or account', () => {
  const r = { ...comment('c1', 'me', 'Hi', 1000), mine: true, on: payTarget('me', 'sam') };
  const db = talkToDb('round', 'ABC123', r);
  assert.equal(db.target, 'pay:me>sam');
  assert.equal('author_dev' in db, false);
  assert.equal('author_user' in db, false);
  assert.equal(db.emoji, null);
  const back = talkFromDb({ ...db, author_dev: 'dev1', author_user: null }, { device: 'dev1' });
  assert.equal(back.on, 'pay:me>sam');
  assert.equal(back.at, 1000);
  assert.equal(back.mine, true);
  assert.equal(talkFromDb({ ...db, author_dev: 'dev2', author_user: 'u1' }, { device: 'dev1', user: 'u1' }).mine, true);
  assert.equal(talkFromDb({ ...db, author_dev: 'dev2', author_user: 'u2' }, { device: 'dev1', user: 'u1' }).mine, false);
});

test('talk: you talk as your seat in a round you played, never as a watcher; a plan uses your id on it', () => {
  const r = skins('r1', NOW);
  const s = stateWith({ rounds: [r] });
  assert.equal(talkWho(r, s), 'me');
  assert.equal(talkWho({ ...r, localMe: 'sam' }, s), 'sam');
  assert.equal(talkWho(r, { ...s, me: 'nobody' }), null);
  assert.equal(planWho({ host: true, hostWho: 'host' }), 'host');
  assert.equal(planWho({ host: false, localMe: 'g1' }), 'g1');
  assert.equal(planWho({ host: false }), null);
});

test('talk: names read You for you and the kept name for a linked friend', () => {
  const r = skins('r1', NOW);
  const s = stateWith({ rounds: [r] });
  const seatName = id => r.players.find(p => p.id === id)?.name;
  assert.equal(talkName(s, comment('a', 'me', 'x', 1), { me: 'me', seatName }), 'You');
  assert.equal(talkName(s, comment('a', 'sam', 'x', 1), { me: 'me', seatName }), 'Sam');
  assert.equal(talkName(s, { ...comment('a', 'zed', 'x', 1), name: 'Zed Q' }, { me: 'me', seatName }), 'Zed');
});

test('talk: Lately shows the newest comment by someone else and who reacted, never your own', () => {
  const r = skins('r1', NOW - DAY);
  const rows = {
    a: comment('a', 'sam', 'Nice putt, finally', NOW - 3 * 3600e3),
    b: comment('b', 'mike', 'Who taught you to chip?', NOW - 2 * 3600e3),
    c: { ...comment('c', 'me', 'My own', NOW - 3600e3), mine: true },
  };
  for (const who of ['sam', 'mike']) {
    // Theirs, from the server (toggleReaction makes rows written on this phone)
    const x = toggleReaction(rows, { on: 'round', who, emoji: who === 'sam' ? 'fire' : 'laugh', now: NOW - 3600e3 });
    rows[x.id] = { ...x, mine: false };
  }
  const s = stateWith({ rounds: [r], talk: { [roundThread(r)]: rows } });
  const items = latelyTalk(s, NOW);
  assert.equal(items.length, 2);
  const talk = items.find(i => i.kind === 'talk');
  assert.equal(talk.text, 'Mike: “Who taught you to chip?”');
  assert.equal(talk.sub, 'Skins at Pebble Creek · 1 more · 2h ago');
  assert.deepEqual(talk.target, ['roundDetail', { id: 'r1' }]);
  const re = items.find(i => i.kind === 'react');
  assert.equal(re.text, 'Sam and Mike reacted 🔥😂');
  // Mixed into Lately, newest first, without moving what was there
  const base = latelyItems(s, NOW);
  const all = withTalk(base, s, NOW);
  assert.equal(all.length, base.length + 2);
  assert.ok(all.every((x, i) => i === 0 || all[i - 1].at >= x.at));
});

test('talk: Lately leaves out old talk and rounds that are gone', () => {
  const r = skins('r1', NOW - 40 * DAY);
  const s = stateWith({ rounds: [r], talk: { [roundThread(r)]: { a: comment('a', 'sam', 'Old', NOW - 40 * DAY) }, 'round:gone': { a: comment('a', 'sam', 'Gone', NOW) } } });
  assert.deepEqual(latelyTalk(s, NOW), []);
});

test('talk: a plan’s talk shows in Lately and opens the plan', () => {
  const plan = { id: 'p1', status: 'planned', host: true, hostWho: 'host', hostName: 'Trevor', date: '2026-10-08', course: { name: 'Pebble Creek' }, people: [{ id: 'host', name: 'Trevor' }, { id: 'sam', name: 'Sam' }], answers: {} };
  const s = stateWith({ plans: { p1: plan }, talk: { 'plan:p1': { a: { ...comment('a', 'sam', 'Bring your wallet', NOW - 600e3), on: 'plan' } } } });
  const [it] = latelyTalk(s, NOW);
  assert.equal(it.text, 'Sam: “Bring your wallet”');
  assert.deepEqual(it.target, ['plan', { id: 'p1' }]);
  assert.match(it.sub, /^Plan for Thursday at Pebble Creek/);
});

test('talk: the player card shows what the two of you said in rounds together, newest first', () => {
  const r1 = skins('r1', NOW - 2 * DAY);
  const r2 = { ...skins('r2', NOW - DAY), players: PLAYERS.filter(p => p.id !== 'sam') };
  const s = stateWith({
    rounds: [r1, r2],
    talk: {
      [roundThread(r1)]: { a: comment('a', 'sam', 'Rematch', NOW - 2 * DAY), b: comment('b', 'me', 'Any time', NOW - DAY), c: comment('c', 'mike', 'Not about you two', NOW - DAY) },
      [roundThread(r2)]: { a: comment('a', 'mike', 'Sam wasn’t here', NOW) },
    },
  });
  const list = personTalk(s, 'sam');
  assert.deepEqual(list.map(x => [x.name, x.body]), [['You', 'Any time'], ['Sam', 'Rematch']]);
  assert.deepEqual(list[0].target, ['roundDetail', { id: 'r1' }]);
});

test('talk: comments and reactions never change a round’s money', () => {
  const r = skins('r1', NOW);
  const before = JSON.stringify([roundResults(r), tabResults(r, roundResults(r))]);
  const s = stateWith({ rounds: [r] });
  const rows = { a: comment('a', 'sam', 'Pay up', NOW) };
  const x = toggleReaction(rows, { on: payTarget('me', 'sam'), who: 'sam', emoji: 'money', now: NOW });
  rows[x.id] = x;
  s.talk = { [roundThread(r)]: rows };
  latelyTalk(s, NOW);
  personTalk(s, 'sam');
  assert.equal(JSON.stringify([roundResults(r), tabResults(r, roundResults(r))]), before);
});
