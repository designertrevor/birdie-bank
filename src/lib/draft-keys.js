// A captains' draft's row keys and the trip id in a draft link. Split out of draft.js (which
// re-exports them) so the cup and the app's start don't load the draft itself. Pure, no imports.

export const DRAFT_KEY = 'Ldraft';

/** Whether a trip_cup row is part of a draft (never a round's matches). */
export const isDraftKey = key => key === DRAFT_KEY || String(key).startsWith(`${DRAFT_KEY}-`);

/** A trip id from a draft link, or null. */
export function cleanTripId(v) {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}
