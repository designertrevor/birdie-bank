import test from 'node:test';
import assert from 'node:assert/strict';
import { coursePickerSections, isStarred, toggleStarred } from './courses.js';
import { applyDoc, toDocs } from './cloud-model.js';

const DAY = 86400000;
const round = (id, courseId, daysAgo, status = 'done') => ({
  id, status, course: { id: courseId, name: courseId }, createdAt: 1_000_000 * DAY - daysAgo * DAY - 3600000,
  ...(status === 'done' ? { finishedAt: 1_000_000 * DAY - daysAgo * DAY } : {}),
});
const custom = (id, extra = {}) => ({ id, name: `Course ${id}`, city: 'Ogden, UT', custom: true, holes: [{ par: 4, hdcp: 1 }], tees: [], ...extra });
const state = (over = {}) => ({ customCourses: {}, favorites: [], starredCourses: [], rounds: {}, ...over });
const ids = list => list.map(c => c.id);

test('starred courses come first and recents leave them out', () => {
  const s = state({
    starredCourses: ['preston'],
    rounds: { r1: round('r1', 'preston', 1), r2: round('r2', 'logan-river', 3), r3: round('r3', 'birch-creek', 2) },
  });
  const sec = coursePickerSections(s, '');
  assert.deepEqual(ids(sec.starred), ['preston']);
  assert.deepEqual(ids(sec.recent), ['birch-creek', 'logan-river']);
  assert.deepEqual(ids(sec.all), []);
  assert.equal(sec.hint, false);
});

test('recently played is newest first, one row per course, at most 5, and counts rounds in progress', () => {
  const customCourses = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map(id => [id, custom(id)]));
  const rounds = {
    r1: round('r1', 'a', 10), r2: round('r2', 'b', 9), r3: round('r3', 'a', 1), r4: round('r4', 'c', 8),
    r5: round('r5', 'd', 7), r6: round('r6', 'e', 6), r7: round('r7', 'f', 0, 'active'),
    r8: { ...round('r8', 'birch-creek', 0), status: 'setup' }, // not a real round yet
  };
  const sec = coursePickerSections(state({ customCourses, rounds }), '');
  assert.deepEqual(ids(sec.recent), ['f', 'a', 'e', 'd', 'c']);
  assert.ok(ids(sec.all).includes('b'));
  assert.ok(ids(sec.all).includes('birch-creek'));
});

test('a course picked but never played, like a planned round, tops up recently played', () => {
  const s = state({ favorites: ['logan-river', 'preston'], rounds: { r1: round('r1', 'preston', 2) } });
  assert.deepEqual(ids(coursePickerSections(s, '').recent), ['preston', 'logan-river']);
  // Logan River was never played, so the section doesn't claim it was
  assert.equal(coursePickerSections(s, '').recentLabel, 'Recent');
  const playedOnly = state({ favorites: ['preston'], rounds: { r1: round('r1', 'preston', 2) } });
  assert.equal(coursePickerSections(playedOnly, '').recentLabel, 'Recently played');
});

test('a built-in course with a fixed copy shows as the copy, starred or played', () => {
  const copy = custom('preston-custom', { name: 'Preston G&CC', replaces: 'preston' });
  const s = state({ customCourses: { 'preston-custom': copy }, starredCourses: ['preston'], rounds: { r1: round('r1', 'preston', 1) } });
  const sec = coursePickerSections(s, '');
  assert.deepEqual(ids(sec.starred), ['preston-custom']);
  assert.deepEqual(ids(sec.recent), []);
  assert.ok(!ids(sec.all).includes('preston'));
  assert.ok(isStarred(s, copy));
  // Unstarring the copy takes the old id off too
  assert.deepEqual(toggleStarred(s, 'preston-custom'), []);
});

test('deleted courses drop out of every section', () => {
  const s = state({ starredCourses: ['gone'], favorites: ['gone2'], rounds: { r1: round('r1', 'gone3', 1) } });
  const sec = coursePickerSections(s, '');
  assert.deepEqual(ids(sec.starred), []);
  assert.deepEqual(ids(sec.recent), []);
  assert.deepEqual(ids(sec.all).sort(), ['birch-creek', 'logan-river', 'preston']);
});

test('a search hides the sections and lists every match, starred ones too', () => {
  const s = state({ starredCourses: ['logan-river'], rounds: { r1: round('r1', 'preston', 1) } });
  const sec = coursePickerSections(s, '  LOGAN ');
  assert.deepEqual(sec.starred, []);
  assert.deepEqual(sec.recent, []);
  assert.deepEqual(ids(sec.all), ['logan-river']);
  assert.deepEqual(ids(coursePickerSections(s, 'id').all), ['preston']); // city match
});

test('the star hint shows only with nothing starred and 3 or more courses', () => {
  assert.equal(coursePickerSections(state(), '').hint, true);
  assert.equal(coursePickerSections(state({ starredCourses: ['preston'] }), '').hint, false);
  assert.equal(coursePickerSections(state(), 'pre').hint, false);
});

test('toggleStarred adds to the end and ignores unknown courses', () => {
  const s = state({ starredCourses: ['preston'] });
  assert.deepEqual(toggleStarred(s, 'birch-creek'), ['preston', 'birch-creek']);
  assert.deepEqual(toggleStarred(s, 'preston'), []);
  assert.deepEqual(toggleStarred(s, 'nope'), ['preston']);
  assert.deepEqual(toggleStarred({ customCourses: {} }, 'preston'), ['preston']); // older state with no list
});

test('starred courses ride in the profile, and an older profile keeps the phone list', () => {
  const s = { ...state({ starredCourses: ['preston'] }), me: 'me', onboarded: true, settings: {}, players: {}, crews: {}, settlements: [] };
  const doc = toDocs(s)['profile:me'].data;
  assert.deepEqual(doc.starredCourses, ['preston']);
  const other = structuredClone({ ...s, starredCourses: [] });
  applyDoc(other, 'profile', 'me', doc);
  assert.deepEqual(other.starredCourses, ['preston']);
  applyDoc(other, 'profile', 'me', { me: 'me', onboarded: true, settings: {}, favorites: [] });
  assert.deepEqual(other.starredCourses, ['preston']);
  applyDoc(other, 'profile', 'me', { ...doc, starredCourses: [] });
  assert.deepEqual(other.starredCourses, []);
});
