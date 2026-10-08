// The rivalry card: the same numbers as the rivalry on a friend's screen, first names and never
// "You" for the group, no dollar figure unless Show amounts is on, and none at all when their
// profile keeps the money private.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { rivalry } from './rivalry.js';
import { moneyWords, rivalryCard, rivalryCardModel, seriesWords, streakWords } from './rivalry-card.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: false }, stroke: { stake: 5, payout: 'pot' } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: { me: 'Trevor Nielsen', b: 'Mike Diddley', c: 'Cy' }[id] || id.toUpperCase(), index: 0 }));
const DOLLAR = /\$/;

/** A finished 9-hole skins round at `t`, every hole halved except the ones given. */
function round(id, ids, holes = {}, { t = 1000, playFor } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = t;
  if (playFor) r.playFor = playFor;
  return r;
}
const win = (who, ids) => ({ 1: Object.fromEntries(ids.map(p => [p, p === who ? 3 : 4])) });
const state = (rounds, extra = {}) => ({
  me: 'me', players: { me: { id: 'me', name: 'Trevor Nielsen' }, b: { id: 'b', name: 'Mike Diddley' } },
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], settings: {}, ...extra,
});
const T = new Date(2026, 9, 3, 12).getTime();

/** Trevor loses one to Mike, then wins two, all money rounds at $2 a skin. */
const series = (extra = {}) => state([
  round('r1', ['me', 'b'], win('b', ['me', 'b']), { t: T }),
  round('r2', ['me', 'b'], win('me', ['me', 'b']), { t: T + 86400000 }),
  round('r3', ['me', 'b', 'c'], win('me', ['me', 'b', 'c']), { t: T + 2 * 86400000 }),
], extra);

test('the card reads the same record, streak and money as the rivalry on the screen', () => {
  const s = series();
  const card = rivalryCard(s, 'b');
  const rv = rivalry(s, new Set(['me']), 'b');
  assert.deepEqual([card.rounds, card.won, card.lost, card.even, card.net, card.moneyRounds], [rv.rounds, rv.won, rv.lost, rv.even, rv.net, rv.moneyRounds]);
  assert.deepEqual([card.rounds, card.won, card.lost, card.net], [3, 2, 1, 2]);
  assert.deepEqual(card.streak, { result: 'won', count: 2 });
  assert.equal(card.you.name, 'Trevor Nielsen');
  assert.equal(card.them.name, 'Mike Diddley');
  assert.equal(card.last.course, 'Flat Nine');
  assert.equal(card.first.date, 'Oct 3');
  assert.equal(card.last.date, 'Oct 5');
  assert.equal(card.private, false);
  // Nobody picked an avatar: a Ball buddy each, with initials to fall back on
  assert.equal(card.you.avatar.kind, 'buddy');
  assert.equal(card.you.avatar.text, 'TN');
});

test('first names and never "You": the card reads the same to everyone in the group', () => {
  const m = rivalryCardModel(rivalryCard(series(), 'b'));
  assert.equal(m.title, 'Trevor v Mike');
  assert.equal(m.headline, 'Trevor leads 2–1');
  assert.equal(m.sub, 'Trevor has won the last 2');
  assert.equal(m.meta, 'Since Oct 3');
  assert.deepEqual(m.score, { won: 2, lost: 1, even: 0 });
  assert.deepEqual(m.tiles, [{ value: '3', label: 'Rounds together' }, { value: 'Oct 5', label: 'Flat Nine' }]);
  assert.equal(m.you.name, 'Trevor');
  assert.equal(m.them.name, 'Mike');
  assert.doesNotMatch(JSON.stringify(m), /Nielsen|Diddley|\bYou\b/);
  assert.equal(m.text, 'Trevor v Mike\nTrevor leads 2–1 over 3 rounds\nTrevor has won the last 2\nLast played Oct 5 at Flat Nine');
  assert.match(m.alt, /^Rivalry card: Trevor v Mike\. Trevor leads 2–1\. Trevor has won the last 2\. 3 rounds together\. Last played Oct 5 at Flat Nine$/);
  assert.equal(m.brand, 'Birdie Bank');
  assert.equal(m.footer, null);
  assert.equal(rivalryCardModel(rivalryCard(series(), 'b'), { link: 'https://birdie-bank.vercel.app/' }).footer, 'birdie-bank.vercel.app');
});

test('amounts are off by default: no dollar figure in the image, its alt text or the text', () => {
  const off = rivalryCardModel(rivalryCard(series(), 'b'));
  assert.ok(!DOLLAR.test(JSON.stringify(off)), JSON.stringify(off));
  assert.equal(off.sections.length, 0);
  const on = rivalryCardModel(rivalryCard(series(), 'b'), { showAmounts: true });
  assert.deepEqual(on.sections, [{ label: 'The money', lines: ['Trevor is up $2 over 3 money rounds'] }]);
  assert.match(on.text, /\n\nTrevor is up \$2 over 3 money rounds$/);
  assert.match(on.alt, /The money: Trevor is up \$2 over 3 money rounds/);
});

test('the money reads from whoever is up, and square when nobody is', () => {
  const card = rivalryCard(series(), 'b');
  assert.equal(moneyWords({ ...card, net: -14 }, 'Trevor', 'Mike'), 'Mike is up $14 over 3 money rounds');
  assert.equal(moneyWords({ ...card, net: 0 }, 'Trevor', 'Mike'), 'Square over 3 money rounds');
  assert.equal(moneyWords({ ...card, net: 5, moneyRounds: 1 }, 'You', 'Mike'), 'You are up $5 over 1 money round');
  assert.equal(seriesWords({ won: 2, lost: 4 }, 'Trevor', 'Mike'), 'Mike leads 4–2');
  assert.equal(seriesWords({ won: 2, lost: 2 }, 'Trevor', 'Mike'), 'All square 2–2');
  assert.equal(streakWords({ result: 'lost', count: 1 }, 'Trevor', 'Mike'), 'Mike took the last one');
  assert.equal(streakWords({ result: 'lost', count: 3 }, 'Trevor', 'Mike'), 'Mike has won the last 3');
  assert.equal(streakWords({ result: 'even', count: 1 }, 'Trevor', 'Mike'), 'The last one was even');
  assert.equal(streakWords({ result: 'even', count: 2 }, 'Trevor', 'Mike'), 'The last 2 were even');
  assert.equal(streakWords({ result: 'won', count: 2 }, 'You', 'Mike'), 'You’ve won the last 2');
  assert.equal(streakWords(null, 'Trevor', 'Mike'), null);
});

test('their profile is Only you: the money stays off even with the switch on', () => {
  // Mike's account came back with no stats, so he keeps his money private (share.js)
  const s = series({ accountOf: { b: 'acct-b' }, profiles: { 'acct-b': { name: 'Mike Diddley', stats: null } } });
  const card = rivalryCard(s, 'b');
  assert.equal(card.private, true);
  const m = rivalryCardModel(card, { showAmounts: true });
  assert.ok(!DOLLAR.test(JSON.stringify(m)), JSON.stringify(m));
  assert.equal(m.sections.length, 0);
  assert.equal(m.note, null);
  // The record still shows: it was never private
  assert.equal(m.headline, 'Trevor leads 2–1');
});

test('points and reward rounds are in the record, not the money, and the card says so with amounts on', () => {
  const ids = ['me', 'b'];
  const s = state([
    round('r1', ids, win('b', ids), { t: T }),
    round('r2', ids, { 1: { me: 3, b: 4 }, 2: { me: 3, b: 4 } }, { t: T + 86400000, playFor: { kind: 'points' } }),
    round('r3', ids, win('me', ids), { t: T + 2 * 86400000, playFor: { kind: 'reward', reward: 'Lunch' } }),
  ]);
  const card = rivalryCard(s, 'b');
  assert.deepEqual([card.rounds, card.won, card.lost, card.moneyRounds, card.otherRounds], [3, 2, 1, 1, 2]);
  const on = rivalryCardModel(card, { showAmounts: true });
  assert.equal(on.sections[0].lines[0], 'Mike is up $2 over 1 money round');
  assert.equal(on.note, '2 rounds for points or a reward count in the record, not the money.');
  assert.match(on.text, /not the money\.$/);
  assert.equal(rivalryCardModel(card).note, null);
});

test('no name for you yet: "You v Mike", and the lines read to you', () => {
  const s = series();
  delete s.players.me;
  const m = rivalryCardModel(rivalryCard(s, 'b'), { showAmounts: true });
  assert.equal(m.title, 'You v Mike');
  assert.equal(m.headline, 'You lead 2–1');
  assert.equal(m.sub, 'You’ve won the last 2');
  assert.equal(m.sections[0].lines[0], 'You are up $2 over 3 money rounds');
});

test('even rounds show beside the record, and a single round reads in the singular', () => {
  const ids = ['me', 'b', 'c'];
  const s = state([round('r1', ids, win('c', ids), { t: T })]);
  const m = rivalryCardModel(rivalryCard(s, 'b'), { showAmounts: true });
  assert.equal(m.headline, 'All square 0–0');
  assert.deepEqual(m.score, { won: 0, lost: 0, even: 1 });
  assert.equal(m.meta, 'First round together');
  assert.equal(m.tiles[0].label, 'Round together');
  assert.match(m.text, /All square 0–0, 1 even over 1 round/);
  assert.equal(m.sections[0].lines[0], 'Square over 1 money round');
});

test('faces: their buddy is mirrored so the two face each other; a photo and initials never are', () => {
  const s = series();
  const card = rivalryCard(s, 'b');
  const m = rivalryCardModel(card, { youSrc: 'data:image/svg+xml,you', themSrc: 'data:image/svg+xml,them' });
  assert.equal(m.you.avatar.src, 'data:image/svg+xml,you');
  assert.equal(m.you.avatar.mirror, false);
  assert.equal(m.them.avatar.src, 'data:image/svg+xml,them');
  assert.equal(m.them.avatar.mirror, true);
  assert.equal(m.you.avatar.text, 'TN');
  assert.equal(m.them.avatar.text, 'MD');
  assert.match(m.you.avatar.bg, /^#/);
  const photo = rivalryCardModel({ ...card, them: { ...card.them, avatar: { kind: 'photo', url: 'https://x/y.jpg', text: 'MD', bg: 'mint' } } });
  assert.equal(photo.them.avatar.mirror, false);
  const letters = rivalryCardModel({ ...card, them: { ...card.them, avatar: { kind: 'initials', text: 'MD', bg: 'mint' } } });
  assert.equal(letters.them.avatar.mirror, false);
  assert.equal(letters.them.avatar.src, null);
});

test('no rounds together: a card that says so, with nothing to count', () => {
  const s = state([round('r1', ['me', 'c'], win('me', ['me', 'c']), { t: T })]);
  const card = rivalryCard(s, 'b');
  assert.equal(card.rounds, 0);
  const m = rivalryCardModel(card, { showAmounts: true });
  assert.equal(m.headline, 'No rounds together yet');
  assert.equal(m.sub, null);
  assert.deepEqual(m.tiles, [{ value: '0', label: 'Rounds together' }, { value: '–', label: 'Last played' }]);
  assert.equal(m.sections.length, 0);
  assert.equal(m.meta, '');
});
