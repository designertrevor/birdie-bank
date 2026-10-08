import test from 'node:test';
import assert from 'node:assert/strict';
import { PUSH_GROUPS, allowed, cleanMuted, groupOn, mergePrefs, picksLine, setGroup } from './push-prefs.js';
import { PUSH_KINDS } from './push-events.js';

test('every push kind sits in exactly one switch, and every switch only names real kinds', () => {
  const seen = PUSH_GROUPS.flatMap(g => g.kinds);
  assert.deepEqual([...seen].sort(), Object.keys(PUSH_KINDS).sort());
  assert.equal(new Set(seen).size, seen.length);
  assert.deepEqual(PUSH_GROUPS.map(g => g.id), ['in', 'talk', 'finished', 'pay', 'tee']);
});

test('all on by default: nothing muted means every switch is on and every kind gets through', () => {
  for (const g of PUSH_GROUPS) assert.equal(groupOn([], g.id), true);
  for (const k of Object.keys(PUSH_KINDS)) assert.equal(allowed([], k), true);
  assert.equal(allowed(undefined, 'talk'), true);
  assert.equal(picksLine([]), 'All of them');
});

test('a muted list only keeps real kinds, once each, in a fixed order', () => {
  assert.deepEqual(cleanMuted(['talk', 'invite', 'talk', 'nope', 7, null]), ['invite', 'talk']);
  assert.deepEqual(cleanMuted('talk'), []);
  assert.deepEqual(cleanMuted(null), []);
});

test('flipping a switch mutes or clears all of its kinds, and leaves the others alone', () => {
  const off = setGroup([], 'pay', false);
  assert.deepEqual(off, ['paid', 'carry', 'carried']);
  assert.equal(groupOn(off, 'pay'), false);
  assert.equal(groupOn(off, 'talk'), true);
  assert.equal(allowed(off, 'paid'), false);
  assert.equal(allowed(off, 'finished'), true);
  const both = setGroup(off, 'in', false);
  assert.deepEqual(both, ['invite', 'rsvp', 'paid', 'carry', 'carried']);
  assert.deepEqual(setGroup(both, 'pay', true), ['invite', 'rsvp']);
  // A group nobody knows changes nothing
  assert.deepEqual(setGroup(both, 'weather', false), both);
  assert.equal(groupOn(both, 'weather'), false);
});

test('a switch shows off as soon as any of its kinds is muted, and turning it on clears them all', () => {
  assert.equal(groupOn(['carry'], 'pay'), false);
  assert.deepEqual(setGroup(['carry', 'talk'], 'pay', true), ['talk']);
});

test('the line under Which ones says what is off in plain words', () => {
  assert.equal(picksLine(['talk']), 'Trash talk off');
  assert.equal(picksLine(['talk', 'paid']), 'Trash talk and payments off');
  assert.equal(picksLine(['invite', 'talk', 'tee']), 'Who’s in, trash talk and tee time reminder off');
  assert.equal(picksLine(Object.keys(PUSH_KINDS)), 'None of them');
});

test('this phone and the account merge by whichever was saved last, the account winning a tie', () => {
  const local = { muted: ['talk'], at: Date.UTC(2026, 9, 8, 12) };
  const cloud = { muted: ['paid'], updated_at: '2026-10-08T11:00:00Z' };
  assert.deepEqual(mergePrefs(local, cloud), { muted: ['talk'], at: local.at, from: 'local' });
  assert.deepEqual(mergePrefs(local, { ...cloud, updated_at: '2026-10-08T13:00:00Z' }), { muted: ['paid'], at: Date.UTC(2026, 9, 8, 13), from: 'cloud' });
  assert.deepEqual(mergePrefs(local, { ...cloud, updated_at: '2026-10-08T12:00:00Z' }), { muted: ['paid'], at: local.at, from: 'cloud' });
});

test('either side may be missing or broken, and nothing at all means all on', () => {
  assert.deepEqual(mergePrefs(null, null), { muted: [], at: 0, from: 'cloud' });
  assert.deepEqual(mergePrefs({ muted: ['tee'], at: 5 }, null), { muted: ['tee'], at: 5, from: 'local' });
  assert.deepEqual(mergePrefs(null, { muted: ['tee', 'junk'], updated_at: 'not a date' }), { muted: ['tee'], at: 0, from: 'cloud' });
  assert.deepEqual(mergePrefs({ muted: 'talk' }, { muted: ['talk'] }), { muted: ['talk'], at: 0, from: 'cloud' });
  // The phone's copy with no time still beats nothing from the account
  assert.deepEqual(mergePrefs({ muted: ['talk'] }, undefined), { muted: ['talk'], at: 0, from: 'local' });
});
