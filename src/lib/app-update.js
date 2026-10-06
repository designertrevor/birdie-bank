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
 * True when the app was opened from a link (a join or plan invite, a sign-in link). The app tidies
 * those out of the address bar as soon as it reads them, so a reload at launch would lose them.
 */
export function openedFromLink(search = '', hash = '') {
  return search.length > 1 || hash.length > 1;
}

/**
 * What to do about a new version: 'apply' (swap now and reload), 'offer' (show the note on Up next),
 * or 'wait' (say nothing until no round is going on). `launching` is true only while the app is
 * just opening and the person hasn't touched anything yet, so a reload then loses nothing.
 * `fromLink` (see openedFromLink) never reloads at launch: the note on Up next offers it instead.
 */
export function updateAction({ waiting, safe, launching = false, fromLink = false }) {
  if (!waiting || !safe) return 'wait';
  return launching && !fromLink ? 'apply' : 'offer';
}

// ---------- Is a newer build live? (overnight 10, version) ----------
// The service worker only looks for a new version now and then, so a phone (an iPhone home-screen
// app most of all) can sit on an old build for days. Each build stamps when it was built into the
// app and into a tiny /version.json beside it. The app reads that file at launch and when it comes
// back to the screen, and a newer stamp makes the service worker fetch the new version right away.
// It still only takes over by the rules above: never forced, never mid-round.

/** How often coming back to the screen may read /version.json. */
export const VERSION_CHECK_MS = 10 * 60000;

/** The build time in a /version.json, or null for anything that isn't one (a missing file, an HTML page). */
export function readBuilt(json) {
  const built = json?.built;
  return Number.isFinite(built) && built > 0 ? built : null;
}

/**
 * True when `theirs` is a later build than this one. `mine` is 0 in dev and in tests, which is never
 * behind, so a dev server or a build with no stamp says nothing.
 */
export function isNewerBuild(theirs, mine) {
  return mine > 0 && Number.isFinite(theirs) && theirs > mine;
}

/** True when it's time to read /version.json again: at launch (never read yet) or after the gap. */
export function versionCheckDue(now, last, gap = VERSION_CHECK_MS) {
  return !last || now - last >= gap;
}

/**
 * A shared round's meta with the newest build that has kept its score. Phones on different builds
 * only ever raise it (never lower it), so two copies never trade it back and forth, and a phone on an
 * older build sees the round came from a newer one and offers the update (see sync.js).
 */
export function stampBuild(meta, mine) {
  if (!meta || !(mine > 0) || (meta.appBuilt ?? 0) >= mine) return meta;
  return { ...meta, appBuilt: mine };
}
