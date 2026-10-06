import test from 'node:test';
import assert from 'node:assert/strict';
import { PUSH_KINDS, cleanPushRequest, paidPushes, pushKey, pushPayload, pushText, pushUrl, weekday } from './push-events.js';

test('each push goes to the right people: invites and results to everyone, who is in to the organizer, paid to the payee', () => {
  assert.equal(PUSH_KINDS.invite.to, 'all');
  assert.equal(PUSH_KINDS.finished.to, 'all');
  assert.equal(PUSH_KINDS.rsvp.to, 'host');
  assert.equal(PUSH_KINDS.tee.to, 'host');
  assert.equal(PUSH_KINDS.paid.to, 'players');
});

test('a request names who it goes to from its kind, never from what the app sent', () => {
  const r = cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'ab12cd', to: 'all', data: { name: 'Dalton', status: 'in' } });
  assert.equal(r.to, 'host');
  assert.equal(r.code, 'AB12CD');
  const all = cleanPushRequest({ kind: 'finished', scope: 'round', code: 'AB12CD', to: 'players', players: ['p1'] });
  assert.equal(all.to, 'all');
  assert.deepEqual(all.players, []);
});

test('only the five kinds, each on its own scope, with a real code', () => {
  assert.equal(cleanPushRequest({ kind: 'talk', scope: 'round', code: 'AB12CD' }), null);
  assert.equal(cleanPushRequest({ kind: 'finished', scope: 'plan', code: 'AB12CD' }), null);
  assert.equal(cleanPushRequest({ kind: 'invite', scope: 'round', code: 'AB' }), null);
  assert.equal(cleanPushRequest({ kind: 'invite', scope: 'round', code: "AB12CD'--" }), null);
  assert.equal(cleanPushRequest(null), null);
  assert.ok(cleanPushRequest({ kind: 'invite', scope: 'plan', code: 'AB12CD' }));
});

test('the tee time reminder only ever comes from the daily job', () => {
  assert.equal(cleanPushRequest({ kind: 'tee', scope: 'plan', code: 'AB12CD' }), null);
  assert.ok(cleanPushRequest({ kind: 'tee', scope: 'plan', code: 'AB12CD' }, { fromServer: true }));
});

test('paid needs a seat, an answer needs its status', () => {
  assert.equal(cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD' }), null);
  assert.equal(cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['bad id!'] }), null);
  assert.deepEqual(cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['p_1', 'p_1'] }).players, ['p_1']);
  assert.equal(cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'AB12CD', data: { status: 'sure' } }), null);
});

test('text from the app is short and plain', () => {
  assert.equal(pushText('  Big\n\tDave  '), 'Big Dave');
  assert.equal(pushText('<script>'), 'script');
  assert.equal(pushText('x'.repeat(50), 24).length, 24);
  const r = cleanPushRequest({ kind: 'invite', scope: 'plan', code: 'AB12CD', data: { name: 'A'.repeat(80), day: 'tomorrow', course: 'Birch Creek' } });
  assert.equal(r.data.name.length, 24);
  assert.equal(r.data.day, undefined);
});

test('weekdays read the date as written', () => {
  assert.equal(weekday('2026-10-10'), 'Saturday');
  assert.equal(weekday('2026-10-12'), 'Monday');
  assert.equal(weekday('soon'), '');
});

test('what each push says, with no amounts on the lock screen', () => {
  const at = { day: '2026-10-10', course: 'Birch Creek' };
  const invite = pushPayload(cleanPushRequest({ kind: 'invite', scope: 'plan', code: 'AB12CD', data: { name: 'Trevor', ...at } }));
  assert.equal(invite.title, 'Trevor invited you to play');
  assert.equal(invite.body, 'Saturday at Birch Creek. Tap to say if you’re in.');
  assert.equal(invite.url, '/?plan=AB12CD');
  const live = pushPayload(cleanPushRequest({ kind: 'invite', scope: 'round', code: 'AB12CD', data: { name: 'Trevor', course: 'Birch Creek' } }));
  assert.equal(live.title, 'Trevor started a round with you');
  assert.equal(live.url, '/?join=AB12CD');
  assert.equal(pushPayload(cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'AB12CD', data: { name: 'Dalton', status: 'maybe', ...at } })).title, 'Dalton is a maybe');
  assert.equal(pushPayload(cleanPushRequest({ kind: 'finished', scope: 'round', code: 'AB12CD', data: { course: 'Birch Creek' } })).body, 'Birch Creek: see how everyone did.');
  const paid = pushPayload(cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['p1'], data: { name: 'Adam' } }));
  assert.equal(paid.title, 'Adam paid you');
  assert.equal(paid.url, '/');
  assert.doesNotMatch(paid.title + paid.body, /\$|\d/);
  const tee = pushPayload(cleanPushRequest({ kind: 'tee', scope: 'plan', code: 'AB12CD', data: at }, { fromServer: true }));
  assert.equal(tee.title, 'Book your tee time');
  assert.equal(tee.body, 'Saturday at Birch Creek. Tee times fill up, so grab one.');
});

test('a push with nothing to name still reads well', () => {
  assert.equal(pushPayload(cleanPushRequest({ kind: 'invite', scope: 'plan', code: 'AB12CD' })).body, 'A round coming up. Tap to say if you’re in.');
  assert.equal(pushPayload(cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['p1'] })).title, 'Someone paid you');
});

test('pushes about the same round or plan share a tag, so the newest replaces the last', () => {
  const a = pushPayload(cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'AB12CD', data: { name: 'A', status: 'in' } }));
  const b = pushPayload(cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'AB12CD', data: { name: 'B', status: 'out' } }));
  assert.equal(a.tag, b.tag);
  assert.equal(pushUrl({ kind: 'finished', scope: 'round', code: 'AB12CD' }), '/?join=AB12CD');
});

test('the same push is only asked for once', () => {
  const a = cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['p1'], topic: 'AB12CD:p2>p1' });
  const b = cleanPushRequest({ kind: 'paid', scope: 'round', code: 'AB12CD', players: ['p1'], topic: 'AB12CD:p2>p1' });
  assert.equal(pushKey(a), pushKey(b));
});

test('paid pushes go to the person paid, once each, only when the payer marked it', () => {
  const row = (over) => ({ kind: 'payment', status: 'paid', code: 'AB12CD', id: 'AB12CD:a>b', from: 'a', to: 'b', by: 'a', ...over });
  const out = paidPushes([row(), row({ id: 'X1' }), row({ code: 'CD34EF', from: 'a', to: 'c', by: 'a', id: 'CD34EF:a>c' })], 'Adam');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(r => r.players[0]), ['b', 'c']);
  assert.equal(out[0].data.name, 'Adam');
  // "I got it" from the payee, a third phone marking two others square, undone payments and carries: nothing
  assert.equal(paidPushes([row({ by: 'b' })]).length, 0);
  assert.equal(paidPushes([row({ by: 'z' })]).length, 0);
  assert.equal(paidPushes([row({ status: 'undone' })]).length, 0);
  assert.equal(paidPushes([row({ kind: 'carry', status: 'asked' })]).length, 0);
  assert.equal(paidPushes([row({ code: null })]).length, 0);
  assert.ok(cleanPushRequest(out[0]));
});
