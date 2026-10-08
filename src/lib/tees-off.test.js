// The trip standings' line before the first round: which day it points at and how it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTHING_PLAYED, teesOffAt, teesOffLine } from './tees-off.js';

// A Wednesday
const NOW = new Date(2026, 9, 14, 9);
const plan = (date, teeTime = null) => ({ id: `p_${date}`, status: 'planned', date, teeTime });

test('tees off: the first planned round wins, then the trip’s first day, then nothing', () => {
  assert.deepEqual(teesOffAt({ planned: [plan('2026-10-16', '07:40'), plan('2026-10-17')], start: '2026-10-15' }, NOW), { date: '2026-10-16', teeTime: '07:40' });
  assert.deepEqual(teesOffAt({ planned: [], start: '2026-10-16' }, NOW), { date: '2026-10-16', teeTime: null });
  // A plan already gone by is skipped for the next one
  assert.deepEqual(teesOffAt({ planned: [plan('2026-10-12'), plan('2026-10-18')] }, NOW), { date: '2026-10-18', teeTime: null });
  assert.equal(teesOffAt({ planned: [], start: '2026-10-10' }, NOW), null, 'the trip has started with nothing planned');
  assert.equal(teesOffAt({}, NOW), null);
  assert.equal(teesOffAt({ planned: [{ id: 'x' }], start: null }, NOW), null, 'a plan with no date is nothing to point at');
});

test('tees off: the short line for the money column', () => {
  assert.equal(teesOffLine({ planned: [plan('2026-10-14', '07:40')] }, NOW), 'Tees off today');
  assert.equal(teesOffLine({ planned: [plan('2026-10-15')] }, NOW), 'Tees off tomorrow');
  assert.equal(teesOffLine({ planned: [plan('2026-10-16', '07:40')] }, NOW), 'Tees off Fri', 'no tee time in the column: it has to fit');
  assert.equal(teesOffLine({ planned: [plan('2026-10-20')] }, NOW), 'Tees off Tue');
  assert.equal(teesOffLine({ planned: [plan('2026-10-21')] }, NOW), 'Tees off Oct 21', 'a week or more out says the date');
  assert.equal(teesOffLine({ planned: [], start: '2026-10-16' }, NOW), 'Tees off Fri');
  assert.equal(teesOffLine({ planned: [], start: '2026-10-10' }, NOW), NOTHING_PLAYED);
  assert.equal(teesOffLine({}, NOW), 'Nothing played yet');
});

test('tees off: the long line under the table has the whole day and the tee time', () => {
  const long = { long: true };
  assert.equal(teesOffLine({ planned: [plan('2026-10-16', '07:40')] }, NOW, long), 'Tees off Friday at 7:40 AM');
  assert.equal(teesOffLine({ planned: [plan('2026-10-16')] }, NOW, long), 'Tees off Friday');
  assert.equal(teesOffLine({ planned: [plan('2026-10-14', '13:10')] }, NOW, long), 'Tees off today at 1:10 PM');
  assert.equal(teesOffLine({ planned: [plan('2026-10-23', '08:00')] }, NOW, long), 'Tees off Fri, Oct 23 at 8:00 AM');
  assert.equal(teesOffLine({ planned: [], start: '2026-10-16' }, NOW, long), 'Tees off Friday', 'the trip’s day has no tee time');
});
