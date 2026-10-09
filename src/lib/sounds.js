// Optional sounds for a few big moments (roadmap S5): off unless the player turns on Sounds in
// Settings. This file is the pure part (which moment gets which sound, when one may play, and the
// notes of each), so it's tested; delight.js plays them and sound-synth.js turns the notes into
// Web Audio, loaded only the first time a sound plays. No audio files: every sound is a few short
// synthesized notes, under a second and quiet, so it sits under the player's music, not over it.

/** Sounds start off: a player has to turn them on. */
export const SOUNDS_DEFAULT = false;

/** Whether the player has Sounds on. Anything but a saved yes (older phones, a missing setting) is off. */
export const soundsOn = settings => (settings?.sounds ?? SOUNDS_DEFAULT) === true;

/**
 * A sound only answers something the player did on this phone a moment ago: a score they tapped,
 * the round they finished, a payment they marked. A moment that arrives from another phone while
 * this one sits in a pocket stays quiet. Longer than a buzz's window, since the end-of-round
 * reveal lands a few seconds after the tap that opened it.
 */
export const SOUND_AFTER_INPUT_MS = 10000;

/** Whether a sound may play now: Sounds on, the app on screen, and the player's own tap recent. */
export function soundOk({ on, now, lastInput, hidden = false }) {
  return !!on && !hidden && now - lastInput >= 0 && now - lastInput <= SOUND_AFTER_INPUT_MS;
}

/** The sound for a score just tapped: 'eagle' for two under or better, 'birdie' for one under, else none. */
export function scoreSound(score, par) {
  if (typeof score !== 'number' || typeof par !== 'number') return null;
  if (score <= par - 2) return 'eagle';
  if (score === par - 1) return 'birdie';
  return null;
}

// The moments that get a sound (lib/moments.js): a match or a Sixes match won, and the lead changing
// hands. Skins, wolves, hammers and the rest keep their banner and buzz only, so a sound stays rare.
const WIN_KINDS = new Set(['won', 'sixwon', 'sixsweep', 'sixtriple']);
const LEAD_KINDS = new Set(['change', 'lead', 'money']);

/** The sound for a round moment: 'win' for the match-won screen or a match won, 'lead' for a lead change, else none. */
export function momentSound(moment) {
  if (!moment) return null;
  if (moment.level === 'big' || WIN_KINDS.has(moment.kind)) return 'win';
  if (LEAD_KINDS.has(moment.kind)) return 'lead';
  return null;
}

/** How loud the loudest moment of any sound gets, out of 1. Quiet on purpose. */
export const VOLUME = 0.14;

/**
 * Each sound's notes: f the pitch in Hz (to: where it glides to), t when it starts and d how long it
 * rings, in seconds, g its loudness against the others (0 to 1, times VOLUME), w the waveform.
 * Bright and friendly, never a slot machine.
 */
export const SOUNDS = {
  // Two quick chirps, up like a bird
  birdie: [
    { f: 1568, to: 1976, t: 0, d: 0.07, g: 0.55, w: 'sine' },
    { f: 1760, to: 2349, t: 0.09, d: 0.1, g: 0.55, w: 'sine' },
  ],
  // Three chirps climbing, then a held note
  eagle: [
    { f: 1568, to: 1976, t: 0, d: 0.06, g: 0.5, w: 'sine' },
    { f: 1760, to: 2349, t: 0.08, d: 0.06, g: 0.5, w: 'sine' },
    { f: 1976, to: 2637, t: 0.16, d: 0.08, g: 0.5, w: 'sine' },
    { f: 1318.5, t: 0.26, d: 0.32, g: 0.45, w: 'triangle' },
  ],
  // Two notes stepping up: someone new on top
  lead: [
    { f: 784, t: 0, d: 0.16, g: 0.5, w: 'triangle' },
    { f: 1046.5, t: 0.11, d: 0.26, g: 0.5, w: 'triangle' },
  ],
  // A match won: a quick rising arpeggio that lands and rings
  win: [
    { f: 523.25, t: 0, d: 0.14, g: 0.45, w: 'triangle' },
    { f: 659.25, t: 0.09, d: 0.14, g: 0.45, w: 'triangle' },
    { f: 784, t: 0.18, d: 0.16, g: 0.45, w: 'triangle' },
    { f: 1046.5, t: 0.27, d: 0.55, g: 0.5, w: 'triangle' },
  ],
  // The reveal's final totals land: a soft bell
  total: [
    { f: 1046.5, t: 0, d: 0.6, g: 0.45, w: 'sine' },
    { f: 1318.5, t: 0, d: 0.6, g: 0.35, w: 'sine' },
    { f: 2093, t: 0, d: 0.3, g: 0.12, w: 'sine' },
  ],
  // A payment marked paid: two light notes, done
  paid: [
    { f: 1174.7, t: 0, d: 0.1, g: 0.5, w: 'sine' },
    { f: 1568, t: 0.08, d: 0.22, g: 0.5, w: 'sine' },
  ],
};

/** How long a sound lasts in seconds, from its first note to the last one's end. */
export const soundLength = notes => Math.max(0, ...(notes || []).map(n => n.t + n.d));
