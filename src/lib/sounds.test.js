import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, SOUNDS_DEFAULT, SOUND_AFTER_INPUT_MS, VOLUME, momentSound, scoreSound, soundLength, soundOk, soundsOn } from './sounds.js';

test('sounds are off unless the player turned them on', () => {
  assert.equal(SOUNDS_DEFAULT, false);
  assert.equal(soundsOn(undefined), false);
  assert.equal(soundsOn({}), false);
  assert.equal(soundsOn({ sounds: false }), false);
  assert.equal(soundsOn({ sounds: 'yes' }), false);
  assert.equal(soundsOn({ sounds: true }), true);
});

test('a sound answers the player\'s own tap, with the app on screen', () => {
  assert.equal(soundOk({ on: true, now: 20000, lastInput: 19900 }), true);
  assert.equal(soundOk({ on: true, now: 20000, lastInput: 20000 - SOUND_AFTER_INPUT_MS }), true); // the reveal landing after Finish
  assert.equal(soundOk({ on: true, now: 20000, lastInput: 20000 - SOUND_AFTER_INPUT_MS - 1 }), false); // another phone's moment, a pocket
  assert.equal(soundOk({ on: true, now: 20000, lastInput: -Infinity }), false);
  assert.equal(soundOk({ on: true, now: 20000, lastInput: 19990, hidden: true }), false);
  assert.equal(soundOk({ on: false, now: 20000, lastInput: 19990 }), false);
});

test('a birdie chirps, an eagle or better gets the eagle, anything else is quiet', () => {
  assert.equal(scoreSound(3, 4), 'birdie');
  assert.equal(scoreSound(2, 4), 'eagle');
  assert.equal(scoreSound(1, 3), 'eagle'); // an ace on a par 3
  assert.equal(scoreSound(1, 4), 'eagle'); // an albatross
  assert.equal(scoreSound(4, 4), null);
  assert.equal(scoreSound(6, 4), null);
  assert.equal(scoreSound('X', 4), null);
  assert.equal(scoreSound(3, undefined), null);
});

test('a match won and a lead change get a sound; the other moments keep quiet', () => {
  assert.equal(momentSound({ kind: 'won', level: 'big' }), 'win');
  assert.equal(momentSound({ kind: 'won', level: 'medium' }), 'win'); // a nine won
  assert.equal(momentSound({ kind: 'sixwon', level: 'medium' }), 'win');
  assert.equal(momentSound({ kind: 'change', level: 'medium' }), 'lead');
  assert.equal(momentSound({ kind: 'lead', level: 'medium' }), 'lead');
  assert.equal(momentSound({ kind: 'money', level: 'medium' }), 'lead');
  for (const kind of ['skin', 'bigskin', 'lonewolf', 'swing', 'hammer', 'dormie', 'square', 'halved', 'final', 'bankbirdie']) {
    assert.equal(momentSound({ kind, level: 'medium' }), null, kind);
  }
  assert.equal(momentSound(null), null);
});

test('every sound is short, quiet and well formed', () => {
  assert.deepEqual(Object.keys(SOUNDS).sort(), ['birdie', 'eagle', 'lead', 'paid', 'total', 'win']);
  assert.ok(VOLUME > 0 && VOLUME <= 0.2);
  for (const [name, notes] of Object.entries(SOUNDS)) {
    assert.ok(notes.length > 0, name);
    assert.ok(soundLength(notes) < 1, `${name} lasts under a second`);
    // Notes ringing at once never add up past full volume
    const peak = Math.max(...notes.map(n => notes.filter(m => m.t <= n.t && m.t + m.d > n.t).reduce((a, m) => a + m.g, 0)));
    assert.ok(peak <= 1, `${name} peaks at ${peak}`);
    for (const n of notes) {
      assert.ok(n.f >= 200 && n.f <= 4000 && (n.to == null || (n.to >= 200 && n.to <= 4000)), `${name} pitch`);
      assert.ok(n.t >= 0 && n.d > 0 && n.g > 0 && n.g <= 1, `${name} timing and loudness`);
      assert.ok(['sine', 'triangle'].includes(n.w), `${name} soft waveform`);
    }
  }
  assert.equal(soundLength([]), 0);
});

test('the synth schedules each note once, quietly, and is done inside a second', async () => {
  const { playNotes } = await import('./sound-synth.js');
  const made = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v, t) { this.last = t; } });
  const ctx = {
    currentTime: 5,
    destination: {},
    createGain: () => ({ gain: param(), connect() {} }),
    createOscillator: () => { const o = { frequency: param(), connect() {}, start(t) { o.at = t; }, stop(t) { o.end = t; } }; made.push(o); return o; },
  };
  for (const name of Object.keys(SOUNDS)) {
    made.length = 0;
    const secs = playNotes(ctx, name);
    assert.equal(made.length, SOUNDS[name].length, name);
    assert.ok(secs < 1 && made.every(o => o.at >= 5 && o.end - 5 < 1.05), name);
  }
  assert.equal(playNotes(ctx, 'nope'), 0);
  assert.equal(playNotes(null, 'birdie'), 0);
});
