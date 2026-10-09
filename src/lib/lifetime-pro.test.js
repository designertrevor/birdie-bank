import test from 'node:test';
import assert from 'node:assert/strict';
import { LIFETIME_LINE, NO_PRO, readEntitlement, savedFor, sinceLine, toSaved } from './lifetime-pro.js';

test('a row with lifetime on is Pro for life, with its day', () => {
  const e = readEntitlement({ lifetime: true, lifetime_since: '2026-10-09T15:00:00Z' });
  assert.equal(e.lifetime, true);
  assert.equal(e.since, Date.parse('2026-10-09T15:00:00Z'));
  assert.equal(sinceLine(e), 'Since Oct 9, 2026');
  // A row without a day is still Pro for life
  assert.deepEqual(readEntitlement({ lifetime: true }), { lifetime: true, since: null });
  assert.equal(sinceLine({ lifetime: true, since: null }), null);
});

test('no row, no table or anything odd is nothing Pro', () => {
  for (const row of [null, undefined, {}, { lifetime: false }, { lifetime: 'true' }, { lifetime: 1 }, 'lifetime', []]) {
    assert.deepEqual(readEntitlement(row), NO_PRO);
  }
  assert.equal(sinceLine(NO_PRO), null);
});

test('the phone copy only counts for the account it was saved for', () => {
  const saved = toSaved('u1', { lifetime: true, since: 5 }, 9);
  assert.deepEqual(saved, { uid: 'u1', lifetime: true, since: 5, at: 9 });
  assert.deepEqual(savedFor(saved, 'u1'), { lifetime: true, since: 5 });
  // Another account on the same phone, or signed out: nothing carries over
  assert.deepEqual(savedFor(saved, 'u2'), NO_PRO);
  assert.deepEqual(savedFor(saved, null), NO_PRO);
  assert.deepEqual(savedFor(null, 'u1'), NO_PRO);
  assert.deepEqual(savedFor({ uid: 'u1', lifetime: 'yes' }, 'u1'), NO_PRO);
  // Saved as not Pro stays not Pro
  assert.deepEqual(savedFor(toSaved('u1', NO_PRO), 'u1'), NO_PRO);
  assert.equal(toSaved(null, { lifetime: true }), null);
});

test('the thanks line says early', () => {
  assert.equal(LIFETIME_LINE, 'Pro for life. Thanks for testing early');
});
