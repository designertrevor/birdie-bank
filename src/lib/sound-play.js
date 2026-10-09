// Plays the optional sounds (lib/sounds.js says which and when). Off unless the player turns on
// Sounds in Settings; with it off this never opens audio at all. The notes are made by
// sound-synth.js, loaded with import() the first time a sound plays, so the first screen only
// carries this small file.
//
// Being a good neighbour to the player's music, podcast or GPS voice:
// - The audio session is 'ambient' where the browser lets us say so (Safari on iPhone): it mixes
//   under whatever is playing instead of stopping it, and the ringer switch on silent mutes it.
//   Other browsers have no way to see silent mode, so it plays at the media volume, quietly.
// - Phones only start audio inside a tap, so the context opens (or wakes) on the player's own tap,
//   and goes back to sleep a few seconds after the last tap or sound, so it never keeps the
//   phone's audio awake through a round.
import { getState } from './store.js';
import { soundOk, soundsOn } from './sounds.js';

// How long the audio stays awake after a tap or a sound before it sleeps again
const AWAKE_MS = 12000;
let audio = null;
let synth = null;
let sleep = 0;
let lastInput = -Infinity;

const on = () => soundsOn(getState()?.settings);

/** Open or wake the audio, and put it back to sleep `ms` from now. Null where there's no Web Audio. */
function wake(ms = AWAKE_MS) {
  try {
    if (!audio) {
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    if (audio.state === 'suspended') Promise.resolve(audio.resume()).catch(() => {});
    clearTimeout(sleep);
    sleep = setTimeout(() => { if (audio) Promise.resolve(audio.suspend()).catch(() => {}); }, ms);
    return audio;
  } catch {
    return null;
  }
}

if (typeof addEventListener === 'function') {
  const touched = () => {
    lastInput = performance.now();
    if (on()) wake();
  };
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, touched, { capture: true, passive: true }));
}

/**
 * Play one of the sounds in lib/sounds.js ('birdie', 'eagle', 'lead', 'win', 'total', 'paid'), or
 * nothing for a null name. Only with Sounds on, the app on screen and the player's own tap recent
 * (soundOk), so a moment arriving from another phone stays quiet in a pocket.
 */
export function sound(name) {
  if (!name) return;
  try {
    if (!soundOk({ on: on(), now: performance.now(), lastInput, hidden: document.visibilityState === 'hidden' })) return;
    const ctx = wake();
    if (!ctx) return;
    const go = mod => {
      synth = mod;
      const secs = mod.playNotes(ctx, name);
      wake(secs * 1000 + AWAKE_MS);
    };
    if (synth) go(synth);
    else import('./sound-synth.js').then(go).catch(() => { /* offline before it was saved: stay quiet */ });
  } catch { /* no audio here */ }
}
