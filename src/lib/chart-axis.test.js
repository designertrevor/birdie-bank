// The chart maths (chart-axis.js): round-number axes with a middle tick, where points sit, which
// bottom labels fit, and the dot limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOX, DOT_MAX, axisFor, labelIndexes, niceStep, pathOf, pointsOn, showDots, xOf, yOf } from './chart-axis.js';

test('niceStep lands on 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(50), 50);
  assert.equal(niceStep(50, 3), 20);
  assert.equal(niceStep(100), 50);
  assert.equal(niceStep(30), 20);
  assert.equal(niceStep(7), 5);
  assert.equal(niceStep(1.7), 1);
  assert.equal(niceStep(0.8), 0.5);
  assert.equal(niceStep(0), 0.5);
});

test('axisFor holds the values, lands on round numbers and has a middle tick', () => {
  const a = axisFor([0, 12, 47, -3], { include: 0 });
  assert.ok(a.lo <= -3 && a.hi >= 47);
  assert.equal(a.ticks.length, 3);
  assert.equal(a.ticks[0], a.lo);
  assert.equal(a.ticks[2], a.hi);
  assert.equal(a.ticks[1], (a.lo + a.hi) / 2);
  // Whole steps: every tick is a multiple of the step the span picked
  const step = niceStep(50, 3);
  for (const t of a.ticks) assert.equal(Math.abs(Number((t / step).toFixed(6)) % 1), 0);
});

test('axisFor always includes the baseline value', () => {
  const a = axisFor([20, 35, 50], { include: 0 });
  assert.ok(a.lo <= 0);
  const b = axisFor([-40, -20], { include: 0 });
  assert.ok(b.hi >= 0);
});

test('axisFor gives a flat line air either side', () => {
  const a = axisFor([12.4, 12.4], { include: 12.4 });
  assert.ok(a.lo < 12.4 && a.hi > 12.4);
  assert.equal(a.ticks[1], (a.lo + a.hi) / 2);
});

test('axisFor keeps decimals tidy for a handicap guide', () => {
  const a = axisFor([12.4, 13.1, 14.1, 11.9], { include: 10.2 });
  assert.ok(a.lo <= 10.2 && a.hi >= 14.1);
  for (const t of a.ticks) assert.equal(t, Number(t.toFixed(6)));
});

test('yOf runs top to bottom with the value, or the other way when inverted', () => {
  const axis = { lo: 0, hi: 100, ticks: [0, 50, 100] };
  assert.equal(yOf(100, axis), BOX.padT);
  assert.equal(yOf(0, axis), BOX.h - BOX.padB);
  assert.equal(yOf(50, axis), (BOX.padT + BOX.h - BOX.padB) / 2);
  // Inverted: a lower handicap (better) goes up
  assert.equal(yOf(0, axis, BOX, true), BOX.padT);
  assert.equal(yOf(100, axis, BOX, true), BOX.h - BOX.padB);
});

test('xOf spaces points evenly and centres a lone point', () => {
  const inner = BOX.w - BOX.padL - BOX.padR;
  assert.equal(xOf(0, 1), BOX.padL + inner / 2);
  assert.equal(xOf(0, 3), BOX.padL);
  assert.equal(xOf(2, 3), BOX.padL + inner);
  assert.equal(xOf(1, 3), BOX.padL + inner / 2);
});

test('pointsOn and pathOf draw a line through every value', () => {
  const axis = axisFor([0, 10, 5], { include: 0 });
  const pts = pointsOn([0, 10, 5], axis);
  assert.equal(pts.length, 3);
  assert.ok(pts[1].y < pts[0].y, 'a higher value sits higher');
  assert.match(pathOf(pts), /^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
});

test('labelIndexes keeps the first and last and never crowds', () => {
  assert.deepEqual(labelIndexes(0), []);
  assert.deepEqual(labelIndexes(3), [0, 1, 2]);
  assert.deepEqual(labelIndexes(5), [0, 1, 2, 3, 4]);
  const many = labelIndexes(40);
  assert.equal(many.length, 5);
  assert.equal(many[0], 0);
  assert.equal(many.at(-1), 39);
  assert.deepEqual(labelIndexes(9, 3), [0, 4, 8]);
});

test('showDots stops at the dot limit', () => {
  assert.equal(showDots(DOT_MAX), true);
  assert.equal(showDots(DOT_MAX + 1), false);
});
