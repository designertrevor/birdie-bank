import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addMonths, betweenEnds, canStepMonth, clampISO, dateLabel, from24, fromISO, HOURS, inBounds, longDateLabel,
  minuteChoices, monthCells, monthGrid, monthTitle, moveCursor, parseTime, quickDays, rangePresets, rangeTap, rangeText,
  timeTap, to24, toISO, toTime, yearCells,
} from './date-pick.js';

// Monday, October 5, 2026
const MON = new Date(2026, 9, 5, 9, 30);

test('days go to and from the same strings the native inputs used', () => {
  assert.equal(toISO(new Date(2026, 0, 9)), '2026-01-09');
  assert.equal(toISO(fromISO('2026-10-05')), '2026-10-05');
  assert.equal(fromISO('2026-02-31'), null);
  assert.equal(fromISO(''), null);
  assert.equal(fromISO('10/05/2026'), null);
  assert.equal(fromISO('2028-02-29').getDate(), 29);
});

test('adding days and months crosses month and year ends, and a month keeps its day inside the month', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addDays('', 1), '');
});

test('the month grid is six Sunday-first weeks, with the other months’ days marked', () => {
  const g = monthGrid(2026, 9, { today: '2026-10-05' });
  assert.equal(g.length, 6);
  assert.ok(g.every(w => w.length === 7));
  // October 1, 2026 is a Thursday, so the grid starts on Sunday, September 27
  assert.equal(g[0][0].iso, '2026-09-27');
  assert.equal(g[0][0].outside, true);
  assert.equal(g[0][4].iso, '2026-10-01');
  assert.equal(g[0][4].outside, false);
  assert.equal(g[5][6].iso, '2026-11-07');
  assert.equal(g.flat().filter(c => !c.outside).length, 31);
  assert.deepEqual(g.flat().filter(c => c.today).map(c => c.iso), ['2026-10-05']);
  // A month that starts on a Sunday starts the grid on its first
  assert.equal(monthGrid(2026, 2)[0][0].iso, '2026-03-01');
  // February in a leap year
  assert.equal(monthGrid(2028, 1).flat().filter(c => !c.outside).length, 29);
  assert.equal(monthTitle(2026, 9), 'October 2026');
});

test('min and max switch off days, months and years outside them', () => {
  const g = monthGrid(2026, 9, { min: '2026-10-05', max: '2026-10-20' }).flat();
  assert.equal(g.find(c => c.iso === '2026-10-04').disabled, true);
  assert.equal(g.find(c => c.iso === '2026-10-05').disabled, false);
  assert.equal(g.find(c => c.iso === '2026-10-20').disabled, false);
  assert.equal(g.find(c => c.iso === '2026-10-21').disabled, true);
  assert.equal(inBounds('2026-10', '2026-10-05', ''), true);
  assert.equal(inBounds('2026-09', '2026-10-05', ''), false);
  assert.equal(inBounds('2027', '', '2026-12-31'), false);
  assert.equal(inBounds('2026-10-05', '', ''), true);
  assert.equal(inBounds('', '', ''), false);
  assert.deepEqual(monthCells(2026, { min: '2026-10-05' }).filter(c => !c.disabled).map(c => c.label), ['Oct', 'Nov', 'Dec']);
  assert.equal(clampISO('2026-10-01', '2026-10-05', ''), '2026-10-05');
  assert.equal(clampISO('2026-11-01', '', '2026-10-20'), '2026-10-20');
  assert.equal(clampISO('2026-10-10', '2026-10-05', '2026-10-20'), '2026-10-10');
});

test('the arrows stop at the first and last month with an allowed day', () => {
  assert.equal(canStepMonth(2026, 9, -1, '2026-10-05', ''), false);
  assert.equal(canStepMonth(2026, 9, 1, '2026-10-05', ''), true);
  assert.equal(canStepMonth(2026, 11, 1, '', '2026-12-31'), false);
  assert.equal(canStepMonth(2026, 0, -1, '', ''), true);
});

test('the year view pages twelve years at a time and holds the year asked for', () => {
  const ys = yearCells(2026).map(c => c.year);
  assert.equal(ys.length, 12);
  assert.ok(ys.includes(2026));
  assert.equal(ys[0] % 12, 0);
  assert.deepEqual(yearCells(2026, { min: '2025-06-01', max: '2027-01-01' }).filter(c => !c.disabled).map(c => c.year), [2025, 2026, 2027]);
});

test('keys move the cursor by a day, a week, a month or to the ends of the week', () => {
  assert.equal(moveCursor('2026-10-05', 'ArrowLeft'), '2026-10-04');
  assert.equal(moveCursor('2026-10-05', 'ArrowRight'), '2026-10-06');
  assert.equal(moveCursor('2026-10-05', 'ArrowUp'), '2026-09-28');
  assert.equal(moveCursor('2026-10-05', 'ArrowDown'), '2026-10-12');
  assert.equal(moveCursor('2026-10-31', 'PageDown'), '2026-11-30');
  assert.equal(moveCursor('2026-10-05', 'PageUp'), '2026-09-05');
  assert.equal(moveCursor('2026-10-07', 'Home'), '2026-10-04');
  assert.equal(moveCursor('2026-10-07', 'End'), '2026-10-10');
  assert.equal(moveCursor('2026-10-07', 'Enter'), null);
});

test('labels: the short day on the field, the year only when it isn’t this year, and the long day read out', () => {
  assert.equal(dateLabel('2026-10-10', MON), 'Sat, Oct 10');
  assert.equal(dateLabel('2027-01-02', MON), 'Sat, Jan 2, 2027');
  assert.equal(dateLabel('', MON), '');
  assert.equal(longDateLabel('2026-10-10'), 'Saturday, October 10, 2026');
});

test('quick picks: today, tomorrow and the coming weekend, without repeats', () => {
  assert.deepEqual(quickDays(MON).map(q => [q.label, q.iso, q.top, q.bottom]), [
    ['Today', '2026-10-05', 'Today', 'Oct 5'],
    ['Tomorrow', '2026-10-06', 'Tmrw', 'Oct 6'],
    ['Saturday', '2026-10-10', 'Sat', 'Oct 10'],
    ['Sunday', '2026-10-11', 'Sun', 'Oct 11'],
  ]);
  // On a Friday, tomorrow is Saturday, so only Sunday is added
  assert.deepEqual(quickDays(new Date(2026, 9, 9)).map(q => q.label), ['Today', 'Tomorrow', 'Sunday']);
  // On a Saturday, today is Saturday and tomorrow Sunday
  assert.deepEqual(quickDays(new Date(2026, 9, 10)).map(q => q.label), ['Today', 'Tomorrow']);
  // On a Sunday, Saturday is six days out and Sunday is today
  assert.deepEqual(quickDays(new Date(2026, 9, 11)).map(q => [q.label, q.iso]), [['Today', '2026-10-11'], ['Tomorrow', '2026-10-12'], ['Saturday', '2026-10-17']]);
  // min and max drop the ones outside
  assert.deepEqual(quickDays(MON, { min: '2026-10-07' }).map(q => q.label), ['Saturday', 'Sunday']);
  assert.deepEqual(quickDays(MON, { max: '2026-10-05' }).map(q => q.label), ['Today']);
});

test('a range: From moves on to To, and a day on the wrong side starts the range over', () => {
  let s = rangeTap({ from: '', to: '' }, '2026-09-10', 'from');
  assert.deepEqual(s, { range: { from: '2026-09-10', to: '' }, editing: 'to' });
  s = rangeTap(s.range, '2026-09-20', s.editing);
  assert.deepEqual(s, { range: { from: '2026-09-10', to: '2026-09-20' }, editing: 'to' });
  // Another tap on To moves the end
  s = rangeTap(s.range, '2026-09-25', s.editing);
  assert.deepEqual(s.range, { from: '2026-09-10', to: '2026-09-25' });
  // To before From: that day is the new From
  assert.deepEqual(rangeTap({ from: '2026-09-10', to: '2026-09-20' }, '2026-09-01', 'to'), { range: { from: '2026-09-01', to: '' }, editing: 'to' });
  // From after To: start over from it
  assert.deepEqual(rangeTap({ from: '2026-09-10', to: '2026-09-20' }, '2026-09-30', 'from'), { range: { from: '2026-09-30', to: '' }, editing: 'to' });
  // From inside the range keeps To
  assert.deepEqual(rangeTap({ from: '2026-09-10', to: '2026-09-20' }, '2026-09-15', 'from'), { range: { from: '2026-09-15', to: '2026-09-20' }, editing: 'to' });
  // The same day for both is a one-day range
  assert.deepEqual(rangeTap({ from: '2026-09-10', to: '' }, '2026-09-10', 'to').range, { from: '2026-09-10', to: '2026-09-10' });
  assert.equal(betweenEnds('2026-09-15', '2026-09-10', '2026-09-20'), true);
  assert.equal(betweenEnds('2026-09-15', '2026-09-20', '2026-09-10'), true);
  assert.equal(betweenEnds('2026-09-10', '2026-09-10', '2026-09-20'), false);
  assert.equal(betweenEnds('2026-09-15', '2026-09-10', ''), false);
});

test('the range field says both ends, one end, or any dates, like History’s own label', () => {
  assert.equal(rangeText({ from: '2026-09-06', to: '2026-10-05' }, MON), 'Sep 6 to Oct 5');
  assert.equal(rangeText({ from: '2026-10-05', to: '2026-09-06' }, MON), 'Sep 6 to Oct 5');
  assert.equal(rangeText({ from: '2025-12-30', to: '2026-01-02' }, MON), 'Dec 30, 2025 to Jan 2');
  assert.equal(rangeText({ from: '2026-09-06', to: '' }, MON), 'Since Sep 6');
  assert.equal(rangeText({ from: '', to: '2026-10-05' }, MON), 'Up to Oct 5');
  assert.equal(rangeText({ from: '', to: '' }, MON), 'Any dates');
});

test('range presets end today and count today in', () => {
  const p = Object.fromEntries(rangePresets(MON).map(r => [r.key, r]));
  assert.deepEqual([p['7d'].from, p['7d'].to], ['2026-09-29', '2026-10-05']);
  // The same window History's Custom opens on
  assert.deepEqual([p['30d'].from, p['30d'].to], ['2026-09-06', '2026-10-05']);
  assert.equal(p['90d'].from, '2026-07-08');
  assert.equal(p['12m'].from, '2025-10-06');
});

test('times stay "HH:MM" on the 24 hour clock, shown on the 12 hour one', () => {
  assert.deepEqual(parseTime('08:10'), { h: 8, m: 10 });
  assert.deepEqual(parseTime('8:10'), { h: 8, m: 10 });
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('25:00'), null);
  assert.equal(toTime(8, 5), '08:05');
  assert.deepEqual(from24(0), { h12: 12, half: 'am' });
  assert.deepEqual(from24(12), { h12: 12, half: 'pm' });
  assert.deepEqual(from24(13), { h12: 1, half: 'pm' });
  assert.equal(to24(12, 'am'), 0);
  assert.equal(to24(12, 'pm'), 12);
  assert.equal(to24(1, 'pm'), 13);
  assert.equal(to24(7, 'am'), 7);
  assert.equal(HOURS.length, 12);
});

test('minutes follow the step the native input had, and keep a saved minute that’s off it', () => {
  assert.deepEqual(minuteChoices(300), [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  assert.equal(minuteChoices(600).length, 6);
  assert.equal(minuteChoices(60).length, 60);
  assert.equal(minuteChoices(0).length, 60);
  assert.deepEqual(minuteChoices(900, '08:07'), [0, 7, 15, 30, 45]);
  assert.deepEqual(minuteChoices(900, '08:15'), [0, 15, 30, 45]);
});

test('tapping the time: an hour first gives :00, minutes wait for an hour, AM and PM flip the half', () => {
  assert.equal(timeTap('', 'hour', 8, 'am'), '08:00');
  assert.equal(timeTap('', 'hour', 1, 'pm'), '13:00');
  assert.equal(timeTap('', 'hour', 12, 'am'), '00:00');
  assert.equal(timeTap('', 'minute', 10), '');
  assert.equal(timeTap('08:00', 'minute', 10), '08:10');
  // A new hour keeps the minutes and the half
  assert.equal(timeTap('08:10', 'hour', 9, 'pm'), '09:10');
  assert.equal(timeTap('14:30', 'hour', 3, 'am'), '15:30');
  assert.equal(timeTap('08:10', 'half', 'pm'), '20:10');
  assert.equal(timeTap('20:10', 'half', 'am'), '08:10');
  assert.equal(timeTap('12:00', 'half', 'am'), '00:00');
  assert.equal(timeTap('', 'half', 'pm'), '');
});
