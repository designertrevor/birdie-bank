import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameTheme, lighten, GROUP_TINTS } from './game-theme.js';
import { GAMES } from './round.js';

test('every game gets its group tint', () => {
  for (const id of Object.keys(GAMES)) {
    const t = gameTheme(id);
    assert.equal(t.tint, GROUP_TINTS[GAMES[id].group] || GROUP_TINTS.Points, id);
    assert.match(t.soft, /^#[0-9a-f]{6}$/);
  }
});

test('an unknown game falls back to peach', () => {
  assert.equal(gameTheme('nope').tint, GROUP_TINTS.Points);
  assert.equal(gameTheme(undefined).group, null);
});

test('lighten mixes toward white', () => {
  assert.equal(lighten('#000000', 1), '#ffffff');
  assert.equal(lighten('#ff0000', 0), '#ff0000');
  assert.equal(lighten('#000000', 0.5), '#808080');
});
