import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUZZ_AFTER_INPUT_MS, buzzOk } from './delight.js';

// The app sits next to the player's music, podcast or GPS voice: it never makes a sound or takes
// the phone's audio, and it only buzzes in answer to a tap.
const root = fileURLToPath(new URL('../..', import.meta.url));
function files(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(jsx?|html)$/.test(f) && !/\.test\.js$/.test(f) ? [p] : [];
  });
}
const sources = [...files(join(root, 'src')), join(root, 'index.html'), join(root, 'public', 'sw.js')]
  .map(p => ({ p: p.slice(root.length), text: readFileSync(p, 'utf8') }));

test('nothing in the app plays sound or opens an audio session', () => {
  const loud = /new Audio\b|AudioContext|<audio\b|<video\b|createElement\(\s*['"`](audio|video)|HTML(Audio|Video|Media)Element|speechSynthesis|SpeechSynthesis|mediaSession|\.play\(\)|getUserMedia/;
  const found = sources.filter(s => loud.test(s.text)).map(s => s.p);
  assert.deepEqual(found, []);
});

test('only delight.js calls the vibration API, so every buzz goes through the tap check', () => {
  const found = sources.filter(s => /navigator\.vibrate/.test(s.text)).map(s => s.p);
  assert.deepEqual(found, ['src/lib/delight.js']);
});

test('a buzz goes right after a tap, and never on its own, late, or with the app in the background', () => {
  assert.equal(buzzOk({ now: 5000, lastInput: 4900 }), true);
  assert.equal(buzzOk({ now: 5000, lastInput: 5000 - BUZZ_AFTER_INPUT_MS }), true);
  assert.equal(buzzOk({ now: 5000, lastInput: 5000 - BUZZ_AFTER_INPUT_MS - 1 }), false); // a timer or another phone's moment
  assert.equal(buzzOk({ now: 5000, lastInput: -Infinity }), false); // nobody has touched the app yet
  assert.equal(buzzOk({ now: 5000, lastInput: 4990, hidden: true }), false);
});
