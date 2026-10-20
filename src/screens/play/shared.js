// What the round in progress keeps outside React, shared by Play.jsx and its pieces in this folder:
// one copy each for the whole app, made when the Play chunk loads (as when they lived in Play.jsx).
import { useEffect, useState } from 'react';
import { keptMap } from '../../lib/kept.js';
import { isSameTap } from '../../lib/play-screen.js';

// Rounds finished (or fixed) on this phone, so it doesn't follow itself to the results a second time
export const FINISHED_HERE = new Set();
// Keeper handoffs this phone has already announced ("roundId:since"), so a remount doesn't say it twice
export const HANDED = new Set();
// Rounds whose locked-in rules card this phone has closed (a phone that isn't keeping score sees it until then)
export const AGREED_SEEN = new Set();

// Unsaved scores per hole ("roundId:holeNo"), kept while moving between holes so nothing typed is
// lost, and saved with your place so switching to another app (or the phone reloading) keeps them too
export const DRAFTS = keptMap('drafts');
/** Drop every unsaved hole of a round (it finished, here or on the keeper's phone). */
export const dropDrafts = id => { for (const k of DRAFTS.keys()) if (k.startsWith(`${id}:`)) DRAFTS.delete(k); };

// When this phone last saved a hole, per round. The next hole opens under the same button with every
// score at par, so a double tap on Save would save that hole too: a tap that soon after, before any
// score on the new hole is touched, is the same tap
const SAVED_AT = new Map();
const SAVE_GAP_MS = 800;
export const markSaved = (roundId, holeNo) => SAVED_AT.set(roundId, { hole: holeNo, at: Date.now() });
/** A tap on another hole's Save within the gap of the last save, with nothing touched since */
export const sameTap = (roundId, holeNo, dirty) => isSameTap(SAVED_AT.get(roundId), holeNo, dirty, Date.now(), SAVE_GAP_MS);

/** The time now, ticking every `ms` (0: never ticks). */
export function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Keep the screen on while a hole is open, and again whenever the app comes back to the front. */
export function useWakeLock() {
  useEffect(() => {
    let lock = null, dead = false;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } };
    get();
    const vis = () => document.visibilityState === 'visible' && !dead && get();
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}); };
  }, []);
}
