// When a new version of the app may take over (decided 2026-10-01, overnight 6). A phone in the
// middle of a round never reloads by itself: a new version waits until no round is going on
// this phone (one you're playing, one you're only watching, or a finished one you're fixing),
// then applies on its own right at launch, or from a tap on "Update ready" on Up next.
// Plain functions so the rule is tested; sw-update.js does the browser side.

/** A round that keeps an update waiting: still being played or watched, or reopened to fix scores. */
export function roundHoldsUpdate(round) {
  return !!round && (round.status === 'active' || !!round.editing);
}

/** True when nothing on this phone would be interrupted by a reload. */
export function updateSafe(state) {
  return !Object.values(state?.rounds || {}).some(roundHoldsUpdate);
}

/**
 * What to do about a new version: 'apply' (swap now and reload), 'offer' (show the note on Up next),
 * or 'wait' (say nothing until no round is going on). `launching` is true only while the app is
 * just opening and the person hasn't touched anything yet, so a reload then loses nothing.
 */
export function updateAction({ waiting, safe, launching = false }) {
  if (!waiting || !safe) return 'wait';
  return launching ? 'apply' : 'offer';
}
