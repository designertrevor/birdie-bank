// Par chips: how a tap on the scoring screen turns into a score (screens/play/HoleScores.jsx).
// Everyone starts the hole at par; a chip (Eagle, Birdie, Par, Bogey, Double) sets a score in one
// tap, and the number pad sheet takes anything else: a hole in one, a 9, a pickup, or one more or
// less. This is input only. What a hole saves is the same as the old − / + stepper saved for the
// same strokes (par-chips.test.js proves it), and when a hole counts as scored is unchanged:
// Save writes every box as shown, so an untouched player saves at par, exactly as before.

/** The lowest and highest score a box takes (the old stepper's limits). */
export const MIN_SCORE = 1;
export const MAX_SCORE = 15;

// The chips, as strokes against par
const CHIPS = [
  { key: 'eagle', off: -2, label: 'Eagle' },
  { key: 'birdie', off: -1, label: 'Birdie' },
  { key: 'par', off: 0, label: 'Par' },
  { key: 'bogey', off: 1, label: 'Bogey' },
  { key: 'double', off: 2, label: 'Double' },
];

/**
 * The chips for a hole of this par: [{ key, label, short, value }]. A chip whose score would be
 * under one is left out, and two under on a par 3 is a hole in one, so it reads "Ace".
 */
export function parChips(par) {
  return CHIPS.map(c => {
    const value = par + c.off;
    const label = value === 1 ? 'Ace' : c.label;
    return { key: c.key, label, short: c.key === 'double' ? 'Dbl' : label, value };
  }).filter(c => c.value >= MIN_SCORE);
}

/** The chip a score shows on, or null when it's off the chips (a 9, a pickup): the pad's chip shows it then. */
export function chipFor(value, par) {
  if (value === 'X' || value == null) return null;
  return parChips(par).find(c => c.value === value)?.key ?? null;
}

/** A box's score when the hole opens: the saved score, else par (shown muted until it's touched). */
export const startScore = (saved, pid, par) => saved?.[pid] ?? par;

/**
 * The score after one input on a box showing `v` (a number or 'X', picked up):
 *   { chip: key }   a par chip
 *   { pad: n }      a number on the pad (kept between MIN_SCORE and MAX_SCORE), or 'X' for a pickup
 *   { step: ±1 }    one more or one less (the pad's − and +; the old stepper's buttons)
 *   { pickup: true} picked up, or back to par if already picked up (the old Picked up button)
 * A step from a pickup lands on par or par + 1, as the old stepper did.
 */
export function scoreAfter(v, input, par) {
  if (input.chip != null) {
    const c = parChips(par).find(x => x.key === input.chip);
    return c ? c.value : v;
  }
  if (input.pad != null) {
    if (input.pad === 'X') return 'X';
    return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(input.pad)));
  }
  if (input.step === -1) return v === 'X' ? par : Math.max(MIN_SCORE, v - 1);
  if (input.step === 1) return v === 'X' ? par + 1 : Math.min(MAX_SCORE, v + 1);
  if (input.pickup) return v === 'X' ? par : 'X';
  return v;
}

/**
 * The fewest taps that put `target` in a box: a chip when one shows it, else the pad. Used by the
 * tests to play the new screen the way a golfer would.
 */
export function tapsFor(target, par) {
  const chip = chipFor(target, par);
  return chip ? [{ chip }] : [{ pad: target }];
}

/** What a hole saves: every box as shown, untouched ones at par (useHoleSave.js). */
export function holeScores(units, draft) {
  return Object.fromEntries(units.map(p => [p.id, draft[p.id]]));
}
