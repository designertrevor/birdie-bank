// Playful feedback: confetti, count-ups, haptics. All respect reduced motion, and all of it is
// silent: nothing that takes the phone's audio, so the player's music or podcast keeps playing.
// The only sounds are the optional ones in sound-play.js, off unless the player turns them on.
const CLAY = ['#ff4d8b', '#e8b94a', '#b8a4ed', '#a4d4c5', '#ffb084', '#ff6b5a'];
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function confetti(x, y, n = 36) {
  if (reduce()) return;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 140;
    c.style.cssText = `left:${x}px;top:${y}px;width:8px;height:${6 + Math.random() * 8}px;background:${CLAY[i % CLAY.length]};`;
    document.body.appendChild(c);
    c.animate([
      { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 50}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 80}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => c.remove();
  }
}

export function confettiFrom(el, n) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, n);
}

// A buzz only answers a tap: within this long of the player's own touch or key press
export const BUZZ_AFTER_INPUT_MS = 1000;
let lastInput = -Infinity;
if (typeof addEventListener === 'function') {
  const touched = () => { lastInput = performance.now(); };
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, touched, { capture: true, passive: true }));
}

/** Whether a buzz may go now: right after the player's own tap, with the app on screen. */
export function buzzOk({ now, lastInput: at, hidden = false }) {
  return !hidden && now - at >= 0 && now - at <= BUZZ_AFTER_INPUT_MS;
}

/**
 * A short vibration for a tap. Never on its own: a moment that comes in from another phone, or a
 * timer, stays still, so the phone only buzzes in the player's hand when they did something.
 */
export function buzz(ms = 10) {
  try {
    if (!buzzOk({ now: performance.now(), lastInput, hidden: document.visibilityState === 'hidden' })) return;
    navigator.vibrate?.(ms);
  } catch { /* unsupported */ }
}
