// The art manifest matches the drawings: every scene and spot in the components has a line on the
// sheet, every buddy and critter is drawn, and every game has its art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ART_ICONS, ART_KINDS, ART_USES } from './art-manifest.js';
import { BUDDIES } from './avatars.js';
import { GAMES, SIDE_GAMES } from './round.js';

const src = f => readFileSync(new URL(`../components/${f}`, import.meta.url), 'utf8');
/** The keys of a `const NAME = { id: () => ..., }` table in a component file. */
const keysOf = (file, table) => {
  const body = src(file).split(`const ${table} = {`)[1].split('\n};')[0];
  return [...body.matchAll(/^ {2}'?([a-z-]+)'?: \([^)]*\) =>/gm)].map(m => m[1]);
};

test('every scene and spot has a line on the art sheet, and nothing on the sheet is missing a drawing', () => {
  const drawn = [...keysOf('Scenes.jsx', 'SCENES').map(k => `scenes/${k}`), ...keysOf('SpotArt.jsx', 'SCENES').map(k => `spots/${k}`), 'spots/crowd', 'spots/highfive'];
  assert.deepEqual(Object.keys(ART_USES).sort(), drawn.sort());
  for (const [key, u] of Object.entries(ART_USES)) {
    assert.ok(u.name, `${key} has a name`);
    assert.ok(u.used?.length, `${key} says where it shows`);
  }
});

test('every game and side game has its art, and the art is for games that exist', () => {
  const art = keysOf('GameArt.jsx', 'SCENES');
  const games = new Set([...Object.keys(GAMES), ...Object.keys(SIDE_GAMES)]);
  for (const g of games) assert.ok(art.includes(g), `${g} has game art`);
  for (const a of art) assert.ok(games.has(a), `art ${a} is a game`);
});

test('the buddies and critters drawn are the ones the picker lists', () => {
  assert.deepEqual(keysOf('BuddyArt.jsx', 'ART').sort(), BUDDIES.filter(b => b.shelf === 'buddies').map(b => b.id).sort());
  assert.deepEqual(keysOf('BuddyArt.jsx', 'CRITTERS').sort(), BUDDIES.filter(b => b.shelf === 'critters').map(b => b.id).sort());
});

test('the icons on the sheet are the ones the welcome draws, plus the first ball', () => {
  const welcome = readFileSync(new URL('../screens/Onboarding.jsx', import.meta.url), 'utf8');
  for (const i of ART_ICONS) if (i.id !== 'ball') assert.ok(welcome.includes(`['${i.id}',`), `welcome shows ${i.id}`);
  assert.deepEqual(ART_KINDS.map(k => k.id), ['scenes', 'spots', 'games', 'buddies', 'critters', 'icons']);
});
