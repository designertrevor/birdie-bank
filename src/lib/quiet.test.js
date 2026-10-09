import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUZZ_AFTER_INPUT_MS, buzzOk } from './delight.js';

// The app sits next to the player's music, podcast or GPS voice: it never takes the phone's audio,
// it only buzzes in answer to a tap, and the only sounds are the optional ones (off by default),
// which all go through sound-play.js and its checks (lib/sounds.js).
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

test('nothing in the app plays sound or opens an audio session, except the optional sounds', () => {
  const loud = /new Audio\b|<audio\b|<video\b|createElement\(\s*['"`](audio|video)|HTML(Audio|Video|Media)Element|speechSynthesis|SpeechSynthesis|mediaSession|\.play\(\)|getUserMedia/;
  assert.deepEqual(sources.filter(s => loud.test(s.text)).map(s => s.p), []);
  // Only the optional sounds open Web Audio, as an ambient session that mixes under the player's music
  assert.deepEqual(sources.filter(s => /AudioContext|audioSession/.test(s.text)).map(s => s.p), ['src/lib/sound-play.js']);
  const player = sources.find(s => s.p === 'src/lib/sound-play.js').text;
  assert.match(player, /audioSession\.type = 'ambient'/);
  assert.match(player, /soundOk\(/);
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
