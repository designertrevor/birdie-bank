import test from 'node:test';
import assert from 'node:assert/strict';
import { IDEA_PUSH_DAYS, freshShip, ideaPayload, ideaPushes, shippedItems } from './idea-push.js';
import { ASKED_LINE } from './roadmap.js';
import { PUSH_KINDS, cleanPushRequest } from './push-events.js';
import { allowed } from './push-prefs.js';

test('a ship date counts from today back IDEA_PUSH_DAYS days, and a day ahead at most', () => {
  assert.equal(IDEA_PUSH_DAYS, 14);
  assert.equal(freshShip('2026-10-12', '2026-10-12'), true);
  assert.equal(freshShip('2026-10-13', '2026-10-12'), true);
  assert.equal(freshShip('2026-10-14', '2026-10-12'), false);
  assert.equal(freshShip('2026-09-28', '2026-10-12'), true);
  assert.equal(freshShip('2026-09-27', '2026-10-12'), false);
  assert.equal(freshShip(null, '2026-10-12'), false);
  assert.equal(freshShip('2026-13-45', '2026-10-12'), false);
  assert.equal(freshShip('2026-10-12', 'today'), false);
});

test('only shipped public roadmap items with a fresh date go to the database, title and id only', () => {
  const items = [
    { id: 'r-aaa', title: 'Wolf', status: 'shipped', shipped: '2026-10-10', blurb: 'not sent', area: 'Games' },
    { id: 'r-bbb', title: 'Old one', status: 'shipped', shipped: '2026-08-01' },
    { id: 'r-ccc', title: 'No date', status: 'shipped', shipped: null },
    { id: 'r-ddd', title: 'Planned', status: 'planned', shipped: null },
    { id: 'q-123', title: 'Not a roadmap line', status: 'shipped', shipped: '2026-10-11' },
    { id: 'r-eee', title: 'Newer', status: 'shipped', shipped: '2026-10-11' },
    null,
  ];
  assert.deepEqual(shippedItems(items, '2026-10-12'), [
    { id: 'r-eee', title: 'Newer', shipped: '2026-10-11' },
    { id: 'r-aaa', title: 'Wolf', shipped: '2026-10-10' },
  ]);
  assert.deepEqual(shippedItems(null, '2026-10-12'), []);
});

test('one idea says the same line as the It shipped note, with course wording for a course', () => {
  const game = ideaPayload([{ kind: 'game', title: 'Wolf Hammer' }]);
  assert.equal(game.title, 'The game you asked for is live');
  assert.equal(game.title, ASKED_LINE.game);
  assert.equal(game.body, 'Wolf Hammer is ready for your next round.');
  assert.equal(game.url, '/');
  const course = ideaPayload([{ kind: 'course', title: 'Birch Creek' }]);
  assert.equal(course.title, 'The course you asked for is in');
  assert.equal(course.body, 'Birch Creek is ready to pick for your next round.');
  const feature = ideaPayload([{ kind: 'feature', title: '' }]);
  assert.equal(feature.title, 'The idea you sent in is live');
  assert.equal(feature.body, 'It’s in the app now. Thanks for the idea.');
  // An unknown kind reads as an idea, and no title is never "undefined"
  assert.equal(ideaPayload([{ kind: 'bug' }]).title, ASKED_LINE.feature);
  assert.equal(ideaPayload([]), null);
  assert.equal(ideaPayload(null), null);
});

test('several ideas make one push', () => {
  assert.equal(ideaPayload([{ kind: 'game', title: 'Wolf' }, { kind: 'game', title: 'Vegas' }]).title, '2 games you asked for are live');
  assert.equal(ideaPayload([{ kind: 'course', title: 'A' }, { kind: 'course', title: 'B' }]).title, '2 courses you asked for are in');
  const mixed = ideaPayload([{ kind: 'game', title: 'Wolf' }, { kind: 'course', title: 'Birch Creek' }, { kind: 'feature', title: 'Dark mode' }]);
  assert.equal(mixed.title, '3 things you asked for are live');
  assert.equal(mixed.body, 'Wolf, Birch Creek and Dark mode are in the app now.');
  assert.equal(ideaPayload([{ kind: 'game', title: 'Wolf' }, { kind: 'game', title: '' }]).body, 'Tap to see what shipped.');
});

test('the rows from the database become one push per person, to each subscription once', () => {
  const row = (fb, user, ep, kind = 'game', title = 'Wolf') => ({ feedback_id: fb, idea_kind: kind, idea_title: title, to_user: user, push_endpoint: ep, push_p256dh: 'k', push_auth: 'a' });
  const out = ideaPushes([
    row('f1', 'u1', 'https://e/1'),
    row('f1', 'u1', 'https://e/2'),
    row('f2', 'u1', 'https://e/1', 'course', 'Birch Creek'),
    row('f2', 'u1', 'https://e/2', 'course', 'Birch Creek'),
    row('f3', 'u2', 'https://e/3', 'feature', 'Dark mode'),
    { to_user: null, push_endpoint: 'x' },
  ]);
  assert.equal(out.length, 2);
  const u1 = out.find(p => p.user === 'u1');
  assert.equal(u1.rows.length, 2);
  assert.equal(u1.payload.title, '2 things you asked for are live');
  assert.equal(u1.payload.body, 'Wolf and Birch Creek are in the app now.');
  const u2 = out.find(p => p.user === 'u2');
  assert.equal(u2.payload.title, 'The idea you sent in is live');
  assert.deepEqual(ideaPushes(null), []);
});

test('the shipped push is its own kind, server only, with its own switch (on by default)', () => {
  assert.equal(PUSH_KINDS.shipped.server, true);
  assert.equal(cleanPushRequest({ kind: 'shipped', scope: 'idea', code: 'AB12CD' }), null);
  assert.equal(allowed([], 'shipped'), true);
  assert.equal(allowed(['shipped'], 'shipped'), false);
});
