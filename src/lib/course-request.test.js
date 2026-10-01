import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRequestCourse, cleanCourseName, courseRequestKey, courseRequestPayload, findCourseRequest,
  courseRequestView, readCourseRequests, rememberCourseRequest, requestCourse,
} from './course-request.js';

const KEY = 'bb-course-requests:test';
function memory() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
}

test('the payload is a missing-course suggestion with what they typed', () => {
  const p = courseRequestPayload({ name: '  Birch   Creek GC ', city: ' Smithfield,  UT ', query: '  Birch   Creek GC ', from: 'Trevor' });
  assert.equal(p.kind, 'course');
  assert.equal(p.body, 'Birch Creek GC, Smithfield, UT');
  assert.deepEqual(p.details, {
    request: 'missing-course', source: 'course-search', name: 'Birch Creek GC', query: '  Birch   Creek GC ',
    key: 'birch creek', from: 'Trevor', city: 'Smithfield, UT',
  });
  assert.equal(p.image, null);
  assert.equal(p.roundId, null);
});

test('city is optional and left out when empty, and the photo rides along', () => {
  const p = courseRequestPayload({ name: 'Wolf Creek', city: '   ', image: 'data:image/jpeg;base64,xx' });
  assert.equal(p.body, 'Wolf Creek');
  assert.equal('city' in p.details, false);
  assert.equal(p.details.query, 'Wolf Creek');
  assert.equal(p.details.from, null);
  assert.equal(p.image, 'data:image/jpeg;base64,xx');
});

test('names that differ only by case, spacing, punctuation or golf words are the same request', () => {
  const same = ['Birch Creek', 'birch creek', 'Birch Creek GC', 'Birch Creek Golf Course', 'BIRCH-CREEK golf club', 'The Birch Creek G&CC', 'Birch Créek'];
  for (const n of same) assert.equal(courseRequestKey(n), 'birch creek', n);
  assert.notEqual(courseRequestKey('Birch Creek North'), courseRequestKey('Birch Creek'));
  // A name that is only golf words keeps its last word, so it never becomes empty
  assert.equal(courseRequestKey('Golf Course'), 'golf');
  assert.equal(courseRequestKey('Country Club'), 'country');
});

test('a name needs two real characters to send', () => {
  assert.equal(canRequestCourse(''), false);
  assert.equal(canRequestCourse('  - '), false);
  assert.equal(canRequestCourse('a'), false);
  assert.equal(canRequestCourse('Ox'), true);
  assert.equal(cleanCourseName('  a\n b  '), 'a b');
});

test('sending remembers the course, and the same phone never sends it twice', async () => {
  const storage = memory();
  const sent = [];
  const submit = async p => { sent.push(p); return 'sent'; };
  const first = await requestCourse({ storage, storageKey: KEY, submit, name: 'Birch Creek', city: 'Smithfield', now: 1000 });
  assert.equal(first.status, 'sent');
  assert.deepEqual(first.entry, { key: 'birch creek', name: 'Birch Creek', at: 1000 });
  const again = await requestCourse({ storage, storageKey: KEY, submit, name: 'birch creek golf course', now: 2000 });
  assert.equal(again.status, 'already');
  assert.equal(again.entry.at, 1000);
  assert.equal(sent.length, 1);
  // A different course still goes
  const other = await requestCourse({ storage, storageKey: KEY, submit, name: 'Wolf Creek', now: 3000 });
  assert.equal(other.status, 'sent');
  assert.equal(sent.length, 2);
  assert.deepEqual(readCourseRequests(storage, KEY).map(x => x.key), ['birch creek', 'wolf creek']);
});

test('a double tap sends one request', async () => {
  const storage = memory();
  let calls = 0;
  const submit = () => { calls++; return new Promise(r => setTimeout(() => r('sent'), 5)); };
  const [a, b] = await Promise.all([
    requestCourse({ storage, storageKey: KEY, submit, name: 'Logan River' }),
    requestCourse({ storage, storageKey: KEY, submit, name: 'Logan River' }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual([a.status, b.status].sort(), ['already', 'sent']);
});

test('no signal: the request is queued and still counts as asked', async () => {
  const storage = memory();
  const queued = await requestCourse({ storage, storageKey: KEY, submit: async () => 'queued', name: 'Eagle Mountain' });
  assert.equal(queued.status, 'queued');
  const thrown = await requestCourse({ storage, storageKey: KEY, submit: async () => { throw new Error('offline'); }, name: 'Fox Hollow' });
  assert.equal(thrown.status, 'queued');
  assert.ok(findCourseRequest(storage, KEY, 'Eagle Mountain GC'));
  assert.ok(findCourseRequest(storage, KEY, 'fox hollow'));
});

test('each dev profile keeps its own memory, and bad storage reads as empty', () => {
  const storage = memory();
  rememberCourseRequest(storage, `${KEY}:a`, 'Birch Creek', 1);
  assert.ok(findCourseRequest(storage, `${KEY}:a`, 'Birch Creek'));
  assert.equal(findCourseRequest(storage, `${KEY}:b`, 'Birch Creek'), null);
  storage.setItem(KEY, '{not json');
  assert.deepEqual(readCourseRequests(storage, KEY), []);
  storage.setItem(KEY, JSON.stringify({ nope: 1 }));
  assert.deepEqual(readCourseRequests(storage, KEY), []);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(findCourseRequest(blocked, KEY, 'Birch Creek'), null);
  assert.deepEqual(rememberCourseRequest(blocked, KEY, 'Birch Creek', 5), { key: 'birch creek', name: 'Birch Creek', at: 5 });
});

test('the memory keeps the newest 100 courses', () => {
  const storage = memory();
  for (let i = 0; i < 105; i++) rememberCourseRequest(storage, KEY, `Course ${i}`, i);
  const list = readCourseRequests(storage, KEY);
  assert.equal(list.length, 100);
  assert.equal(list[0].name, 'Course 5');
  // Asking again moves it to the end rather than adding a second copy
  rememberCourseRequest(storage, KEY, 'Course 5', 200);
  const after = readCourseRequests(storage, KEY);
  assert.equal(after.length, 100);
  assert.equal(after[after.length - 1].at, 200);
});

test('the card shows the send result, then the phone memory, and the already card always has its entry', async () => {
  const storage = memory();
  const name = 'Zzyzx Links';
  assert.equal(courseRequestView({ name, earlier: findCourseRequest(storage, KEY, name) }), null);
  // A second tap that loses the race resolves to 'already' from this card's own send: it still
  // carries the entry, so the card can say when it was asked (this used to read a missing value)
  let release;
  const submit = () => new Promise(r => { release = () => r('sent'); });
  const first = requestCourse({ storage, storageKey: KEY, submit, name, now: 1000 });
  const second = await requestCourse({ storage, storageKey: KEY, submit, name, now: 1001 });
  assert.equal(second.status, 'already');
  const raced = courseRequestView({ done: second, name, earlier: findCourseRequest(storage, KEY, name) });
  assert.equal(raced.status, 'already');
  assert.deepEqual(raced.entry, { key: 'zzyzx', name, at: 1000 });
  release();
  const sent = await first;
  assert.equal(courseRequestView({ done: sent, name, earlier: findCourseRequest(storage, KEY, name) }).status, 'sent');
  // Typed differently later: the phone memory answers, not this card's send
  const later = courseRequestView({ done: sent, name: 'zzyzx links golf course', earlier: findCourseRequest(storage, KEY, 'zzyzx links golf course') });
  assert.equal(later.status, 'already');
  assert.equal(later.entry.at, 1000);
  // A different course starts over with the form
  assert.equal(courseRequestView({ done: sent, name: 'Fox Hollow', earlier: findCourseRequest(storage, KEY, 'Fox Hollow') }), null);
});
