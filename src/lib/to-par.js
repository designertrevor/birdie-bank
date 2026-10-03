// Each player's running score against par for the scorecard: +3, E, −1. Only the holes that
// player has a score on count, so a hole not played yet (or after they left) changes nothing.
// A pickup counts as the card shows it (net double bogey). Net uses the main game's strokes,
// the same ones as the dots on the card, so it can end in ½ with half strokes on.
import { grossFor, netFor } from './round.js';

/** { played, gross, net } to par for a scorer (a player, or a scramble team). `net` only when `withNet`. */
export function toParOf(round, scorer, { withNet = false } = {}) {
  let played = 0, gross = 0, net = 0;
  for (const h of round.holes) {
    const g = grossFor(round, scorer, h);
    if (g == null) continue;
    played++;
    gross += g - h.par;
    if (withNet) net += netFor(round, scorer, h) - h.par;
  }
  return { played, gross, net: withNet ? net : null };
}

/** "+3", "E", "−1", "+1½", "−½". The minus is a real minus sign, like net totals elsewhere. */
export function toParText(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  if (n === 0) return 'E';
  const a = Math.abs(n);
  const whole = Math.trunc(a);
  const half = a - whole >= 0.25 ? '½' : '';
  return `${n > 0 ? '+' : '−'}${whole === 0 && half ? '' : whole}${half}`;
}

/** "3 over par", "even par", "1½ under par", for screen readers. */
export function toParWords(n) {
  if (n == null || !Number.isFinite(n)) return 'no holes yet';
  if (n === 0) return 'even par';
  return `${toParText(Math.abs(n)).slice(1)} ${n > 0 ? 'over' : 'under'} par`;
}

/** 'under', 'even' or 'over', for the color. */
export const toParTone = n => (n < 0 ? 'under' : n > 0 ? 'over' : 'even');
