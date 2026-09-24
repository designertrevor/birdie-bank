// Playful feedback: confetti, count-ups, haptics. All respect reduced motion.
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

export function buzz(ms = 10) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
