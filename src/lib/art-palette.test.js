// The art palette is one file: the four drawing components take their colours from it, and the
// values are pinned here so a stray edit can't shift a buddy's hat or a spot's plate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as palette from './art-palette.js';
import { PALETTE as fromManifest } from './art-manifest.js';

const COMPONENTS = ['BuddyArt.jsx', 'GameArt.jsx', 'Scenes.jsx', 'Spot.jsx'];
const src = f => readFileSync(new URL(`../components/${f}`, import.meta.url), 'utf8');

test('the palette values are the ones the drawings were made with', () => {
  assert.deepEqual(palette.PALETTE, [
    ['Ink', '#0a0a0a'], ['Ball', '#fbf7ec'], ['Pink', '#ff4d8b'], ['Deep pink', '#d42a6b'], ['Ochre', '#e8b94a'], ['Gold', '#c99a30'],
    ['Coin', '#ffd45c'], ['Teal', '#1a3a3a'], ['Mint', '#a4d4c5'], ['Coral', '#ff6b5a'], ['Lavender', '#b8a4ed'], ['Peach', '#ffb084'], ['Blush', '#ffd6e5'],
  ]);
  const named = { INK: '#0a0a0a', BALL: '#fbf7ec', PINK: '#ff4d8b', DEEP: '#d42a6b', OCHRE: '#e8b94a', GOLD: '#c99a30', COIN: '#ffd45c', TEAL: '#1a3a3a', MINT: '#a4d4c5', CORAL: '#ff6b5a', LAV: '#b8a4ed', PEACH: '#ffb084', BLUSH: '#ffd6e5' };
  for (const [n, hex] of Object.entries(named)) assert.equal(palette[n], hex, n);
  // Every named colour is on the sheet, and the manifest shows the same list
  assert.deepEqual(palette.PALETTE.map(([, hex]) => hex).sort(), Object.values(named).sort());
  assert.equal(fromManifest, palette.PALETTE);
});

test('the drawings import the palette rather than declaring their own', () => {
  const hexes = new Set(palette.PALETTE.map(([, hex]) => hex));
  for (const f of COMPONENTS) {
    const s = src(f);
    assert.match(s, /from '\.\.\/lib\/art-palette\.js'/, `${f} imports the palette`);
    for (const m of s.matchAll(/^const ([A-Z_]+) = '(#[0-9a-f]{6})';/gm)) assert.ok(!hexes.has(m[2]), `${f} declares ${m[1]} as ${m[2]}, a palette colour, on its own`);
    for (const m of s.matchAll(/="(#[0-9a-f]{3,6})"/g)) assert.ok(!hexes.has(m[1]), `${f} writes ${m[1]} by hand instead of its palette name`);
  }
});
