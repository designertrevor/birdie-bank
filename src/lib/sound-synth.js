// Turns a sound's notes (lib/sounds.js) into Web Audio on the context sound-play.js opened: one
// oscillator per note with a quick fade in and a soft ring out, all through one quiet volume.
// Loaded with import() the first time a sound plays, so none of it is on the first screen.
import { SOUNDS, VOLUME, soundLength } from './sounds.js';

/** Schedule the named sound on `ctx`. Returns how long it lasts in seconds (0 for an unknown name). */
export function playNotes(ctx, name) {
  const notes = SOUNDS[name];
  if (!ctx || !notes) return 0;
  const start = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = VOLUME;
  out.connect(ctx.destination);
  for (const n of notes) {
    const at = start + n.t, end = at + n.d;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = n.w;
    osc.frequency.setValueAtTime(n.f, at);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, at + n.d * 0.8);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.linearRampToValueAtTime(n.g, at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp);
    amp.connect(out);
    osc.start(at);
    osc.stop(end + 0.02);
  }
  return soundLength(notes);
}
