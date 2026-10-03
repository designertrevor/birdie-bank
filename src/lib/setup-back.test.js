// Back from the course editor in round setup lands on the course step, never the game step (Overnight 6 review)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAP_THROUGH_MS, setupBack } from './setup-back.js';

test('Back with the course editor open only closes the editor, on any step and when editing a plan', () => {
  assert.deepEqual(setupBack({ step: 1, editorOpen: true }), { to: 'editor' });
  assert.deepEqual(setupBack({ step: 1, editing: true, editorOpen: true }), { to: 'editor' });
  assert.deepEqual(setupBack({ step: 0, editorOpen: true }), { to: 'editor' });
});

test('a second tap right after the editor closes stays on the course step', () => {
  assert.deepEqual(setupBack({ step: 1, closedAt: 1000, now: 1000 }), { to: 'stay' });
  assert.deepEqual(setupBack({ step: 1, closedAt: 1000, now: 1000 + TAP_THROUGH_MS - 1 }), { to: 'stay' });
  // Once the moment has passed, Back goes to the game step as usual
  assert.deepEqual(setupBack({ step: 1, closedAt: 1000, now: 1000 + TAP_THROUGH_MS }), { to: 'step', step: 0 });
});

test('without the editor: one step back, and out of setup from the first step or a plan edit', () => {
  assert.deepEqual(setupBack({ step: 3 }), { to: 'step', step: 2 });
  // Never opened: no closing time, so nothing to wait out
  assert.deepEqual(setupBack({ step: 1, now: 5 }), { to: 'step', step: 0 });
  assert.deepEqual(setupBack({ step: 1 }), { to: 'step', step: 0 });
  assert.deepEqual(setupBack({ step: 0 }), { to: 'close' });
  assert.deepEqual(setupBack({ step: 1, editing: true }), { to: 'close' });
});
