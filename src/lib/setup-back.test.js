// Back from the course editor in round setup lands on the course step, never the game step (Overnight 6 review)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAP_THROUGH_MS, setupBack } from './setup-back.js';
import { HANDICAPS_STEP, OVERVIEW, PLAY_FOR_STEP } from './setup-overview.js';

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

test('with the overview: Back from it leaves setup, and a step goes back to it once the first pass is done', () => {
  assert.deepEqual(setupBack({ step: OVERVIEW, hub: true }), { to: 'close' });
  // First pass: the game step returns to the overview, the others go one step back as before
  assert.deepEqual(setupBack({ step: 0, hub: true }), { to: 'step', step: OVERVIEW });
  assert.deepEqual(setupBack({ step: 2, hub: true }), { to: 'step', step: 1 });
  // Opened from the overview after the pass: straight back to it
  for (const step of [0, 1, 2, 3, HANDICAPS_STEP, PLAY_FOR_STEP]) assert.deepEqual(setupBack({ step, hub: true, passDone: true }), { to: 'step', step: OVERVIEW });
  assert.deepEqual(setupBack({ step: HANDICAPS_STEP, hub: true }), { to: 'step', step: OVERVIEW });
  // The editor still closes first
  assert.deepEqual(setupBack({ step: 1, hub: true, passDone: true, editorOpen: true }), { to: 'editor' });
  // Planning has no overview: as before
  assert.deepEqual(setupBack({ step: 0 }), { to: 'close' });
});
