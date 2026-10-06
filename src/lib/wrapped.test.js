// Year in review: the numbers come from your own rounds, money matches Season to the cent and only
// shows with amounts on, points stay points, and a friend whose profile is Only you isn't named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCT, base, skins } from './crew-tabs.fixtures.js';
import { mergePeople } from './people-links.js';
import { seasonBoard } from './season.js';
import { momentText, wrappedCardModel, yearInReview } from './wrapped.js';

const Y = 2026;
const DOLLAR = /\$/;

test('rounds, courses, the low round, favorite game and record come from the rounds you played', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'a']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(5) });
  r2.course = { ...r2.course, name: 'Oak Hollow' };
  const watched = skins('r3', ['a', 'b'], [[1, 'a']], { at: OCT(6) });
  const lastYear = skins('r4', ['t', 'a'], [[1, 't']], { at: new Date(2025, 5, 1).getTime() });
  const y = yearInReview(base([r1, r2, watched, lastYear]), Y);
  assert.equal(y.rounds, 3 - 1, 'a round you only kept score for and last year’s stay out');
  assert.equal(y.holes, 18);
  assert.equal(y.courses.count, 2);
  assert.deepEqual(y.low, { strokes: 34, holes: 9, course: 'Flat Nine', at: OCT(3) });
  assert.deepEqual(y.favoriteGame, { id: 'skins', name: 'Skins', rounds: 2 });
  assert.deepEqual(y.record, { won: 1, lost: 1, even: 0 });
  assert.deepEqual(y.partner, { id: 'a', rounds: 2 });
  assert.equal(y.birdies, 2);
});

test('the money is the Tab’s dollars, the same as Season, and points rounds add none', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'a']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a'], [2, 'a']], { at: OCT(5), skin: 7 });
  const pts = skins('r3', ['t', 'a'], [[1, 't'], [2, 't'], [3, 't']], { at: OCT(6) });
  pts.playFor = { kind: 'points' };
  const s = { ...base([r1, r2, pts]), me: 't' };
  const y = yearInReview(s, Y);
  const season = seasonBoard(s, Y).balances.find(b => b.me);
  assert.equal(y.money.net, season.net);
  assert.equal(y.money.rounds, 2);
  assert.equal(y.money.best.amount, 6);
  assert.equal(y.rounds, 3, 'the points round still counts as a round played');
});

test('amounts are off by default: no dollar figure in the image, its alt text or the text', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't']], { at: OCT(3) });
  const s = base([r1]);
  const y = yearInReview(s, Y);
  const off = wrappedCardModel(s, y);
  assert.ok(!DOLLAR.test(JSON.stringify(off)), JSON.stringify(off));
  const on = wrappedCardModel(s, y, { showAmounts: true });
  assert.match(on.text, /\+\$8 over 1 round/);
  assert.match(on.alt, /The money/);
  assert.equal(on.title, 'T’s 2026 in golf');
});

test('one person is one partner, and a friend whose profile is Only you is never named', () => {
  const r1 = skins('r1', ['t', 'a'], [], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a2'], [], { at: OCT(4) });
  const r3 = skins('r3', ['t', 'b'], [], { at: OCT(5) });
  let s = base([r1, r2, r3]);
  s.players.a = { id: 'a', name: 'Adam Smith' };
  s.players.a2 = { id: 'a2', name: 'Adam S' };
  s = { ...s, ...mergePeople(s, 'a', 'a2') };
  const y = yearInReview(s, Y);
  assert.deepEqual(y.partner, { id: 'a', rounds: 2 });
  assert.match(wrappedCardModel(s, y).text, /Adam, 2 rounds together/);
  // Adam's account came back with no stats: his profile is Only you
  const hidden = { ...s, accountOf: { a: 'acct-a' }, profiles: { 'acct-a': { name: 'Adam Smith', stats: null } } };
  const card = wrappedCardModel(hidden, yearInReview(hidden, Y));
  assert.doesNotMatch(card.text, /Adam/);
  assert.match(card.text, /Your most-played partner, 2 rounds together/);
});

test('the moment of the year: a hole in one beats an eagle beats a run of wins beats birdies', () => {
  const r1 = skins('r1', ['t', 'a'], [[1, 't'], [2, 't']], { at: OCT(3) });
  assert.equal(yearInReview(base([r1]), Y).moment.kind, 'birdies');
  const r2 = skins('r2', ['t', 'a'], [[1, 't']], { at: OCT(4) });
  const r3 = skins('r3', ['t', 'a'], [[1, 't']], { at: OCT(5) });
  assert.deepEqual(yearInReview(base([r1, r2, r3]), Y).moment, { kind: 'streak', n: 3, course: 'Flat Nine', at: OCT(5) });
  const eagle = skins('r4', ['t', 'a'], [], { at: OCT(6) });
  eagle.scores[4].t = 2;
  assert.equal(yearInReview(base([r1, r2, r3, eagle]), Y).moment.kind, 'eagle');
  const ace = skins('r5', ['t', 'a'], [], { at: OCT(7) });
  ace.course = { ...ace.course, name: 'Oak Hollow' };
  ace.holes = ace.holes.map(h => (h.no === 7 ? { ...h, par: 3 } : h));
  ace.scores[7].t = 1;
  const y = yearInReview(base([r1, eagle, ace]), Y);
  assert.equal(momentText(y.moment), 'A hole in one on 7 at Oak Hollow');
});

test('a year with no rounds says so and has no moment or money', () => {
  const y = yearInReview(base([]), Y);
  assert.equal(y.rounds, 0);
  assert.equal(y.moment, null);
  assert.equal(y.money, null);
  assert.equal(wrappedCardModel(base([]), y, { showAmounts: true }).sub, 'No rounds yet');
});
