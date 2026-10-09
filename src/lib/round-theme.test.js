import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, roundGameIds, roundTheme, themeVars } from './round-theme.js';
import { GROUP_TINTS, gameTheme } from './game-theme.js';
import { GAMES } from './round.js';

const players = [{ id: 'a', name: 'Al' }, { id: 'b', name: 'Bo' }];

test('a round wears its main game theme, side games or not', () => {
  const r = { game: 'nassau', players, sideGames: [{ game: 'skins', settings: {} }] };
  assert.equal(roundTheme(r).tint, GROUP_TINTS.Classics);
  assert.equal(roundTheme({ ...r, game: 'match' }).tint, GROUP_TINTS['Head to head']);
  assert.deepEqual(roundGameIds(r), ['nassau', 'skins']);
});

test('a card only round, an unknown game or no round has no theme', () => {
  const casual = { game: 'stroke', players, justPlaying: { a: true, b: true } };
  assert.equal(roundTheme(casual), null);
  assert.deepEqual(roundGameIds(casual), []);
  // One player betting is still a game
  assert.equal(roundTheme({ ...casual, justPlaying: { a: true } }).tint, GROUP_TINTS['Full round']);
  assert.equal(roundTheme(null), null);
  assert.equal(roundTheme({ game: 'nope', players }), null);
  assert.equal(themeVars(null), undefined);
  assert.deepEqual(roundGameIds(null), []);
});

test('theme vars carry the tint, the wash and the ink', () => {
  const t = gameTheme('wolf');
  assert.deepEqual(themeVars(t), { '--gt': t.tint, '--gt-soft': t.soft, '--gt-ink': t.ink });
});

test('text on every theme colour passes contrast', () => {
  const DARK_CARD = '#1e2524';
  const BODY = '#3a3a3a';
  for (const id of Object.keys(GAMES)) {
    const t = gameTheme(id);
    // Ink on the tint (the hole tile, the art chips, the stickers): AA for small text
    assert.ok(contrast(t.ink, t.tint) >= 4.5, `${id} ink on tint`);
    // Ink and body text on the pale wash (light mode bands and the Round ready card)
    assert.ok(contrast(t.ink, t.soft) >= 4.5, `${id} ink on soft`);
    assert.ok(contrast(BODY, t.soft) >= 4.5, `${id} body on soft`);
    // The money bar's leading cell sits on the wash and is always up, so its amount is the win green.
    // Red only ever lands there as large text (20px, extra bold), so 3:1 is the bar for it
    assert.ok(contrast('#0f6b4f', t.soft) >= 4.5, `${id} win on soft`);
    assert.ok(contrast('#b83226', t.soft) >= 3, `${id} loss on soft`);
    // Dark mode: the tint as an accent on a dark card (the art, a line, a ring), and the money bar's
    // dark band (10% tint in the card) keeps the theme's own cream and grey text
    assert.ok(contrast(t.tint, DARK_CARD) >= 3, `${id} tint on dark card`);
    const band = mix(t.tint, DARK_CARD, 0.1);
    assert.ok(contrast('#f5f0e4', band) >= 4.5, `${id} ink on dark band`);
    assert.ok(contrast('#a8a498', band) >= 4.5, `${id} mute on dark band`);
  }
});

/** color-mix(in srgb, a p, b) */
function mix(a, b, p) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map(i => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0')).join('')}`;
}

test('contrast is symmetric and spans 1 to 21', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#123456', '#123456'), 1);
  assert.equal(contrast('#000000', '#ff4d8b'), contrast('#ff4d8b', '#000000'));
});
