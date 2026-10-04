// Saving where you are (see place.js): the open screens and anything a screen keeps with useKept,
// written to localStorage as it changes and right away when the app goes to the background, then
// read back once at launch. Nothing here ever blocks the app: blocked storage just means no restore.
import { createContext, useContext, useEffect, useState } from 'react';
import { PLACE_KEY, keptFor, placeToSave, readPlace } from './place.js';

let kept = {};   // "<scope>|<name>" -> value, scope being a screen's key or "tab:<tab>"
const maps = { drafts: {} }; // shared lists that aren't one screen's (unsaved scores by "roundId:holeNo")
let where = { tab: 'upnext', stack: [] };
let timer = null;
let off = false; // a crash cleared the place: nothing more is written until the next screen change

/** The open screen's scope, for useKept. App sets it around each screen it shows. */
export const KeptScope = createContext(null);

function write() {
  clearTimeout(timer);
  timer = null;
  if (off) return;
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(placeToSave({ ...where, kept, maps, at: Date.now() })));
  } catch { /* storage full or blocked */ }
}
function soon() {
  if (off || timer) return;
  timer = setTimeout(write, 400);
}

if (typeof document !== 'undefined') {
  // Switching to another app: the last chance to save before the phone may drop the page
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') write(); });
  addEventListener('pagehide', write);
}

/**
 * At launch: the place to come back to ({ tab, stack } or null), and its kept values ready for the
 * screens. `screens` and `tabs` are the names App can show.
 */
export function startPlace(state, { screens, tabs }) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLACE_KEY)); } catch { /* nothing saved */ }
  const back = readPlace(saved, state, { now: Date.now(), screens, tabs });
  if (!back) return null;
  kept = back.kept;
  maps.drafts = back.maps.drafts;
  return back.stack.length || back.tab ? { tab: back.tab || 'upnext', stack: back.stack } : null;
}

/** The screens open now. Kept values of screens that closed go with them. */
export function notePlace(tab, stack) {
  off = false;
  where = { tab, stack: stack.map(({ name, params, key }) => ({ name, params, key })) };
  kept = keptFor(kept, [...stack.map(e => e.key), `tab:${tab}`]);
  soon();
}

/** Forget the saved place (a screen crashed: the next launch starts fresh on Up next). */
export function forgetPlace() {
  off = true;
  clearTimeout(timer);
  timer = null;
  kept = {};
  try { localStorage.removeItem(PLACE_KEY); } catch { /* ignore */ }
}

/** Drop this screen's kept values whose names start with `prefix` (but not `keep`: an old hole's sheets, not this one's). */
export function dropKept(scope, prefix, keep) {
  let changed = false;
  for (const k of Object.keys(kept)) {
    const [s, name] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
    if (s === String(scope) && name.startsWith(prefix) && !(keep && name.startsWith(keep))) { delete kept[k]; changed = true; }
  }
  if (changed) soon();
}

/**
 * useState that comes back after the page is reloaded: what's typed, the step a setup is on, which
 * sheet is open. Values must be plain JSON. Outside a screen it's plain useState.
 */
export function useKept(name, initial) {
  const scope = useContext(KeptScope);
  const k = scope != null ? `${scope}|${name}` : null;
  const [v, setV] = useState(() => (k && Object.prototype.hasOwnProperty.call(kept, k) ? kept[k] : typeof initial === 'function' ? initial() : initial));
  useEffect(() => {
    if (!k) return;
    kept[k] = v;
    soon();
  }, [k, v]);
  return [v, setV];
}

/** The open screen's scope (its key), for dropKept. */
export function useKeptScope() {
  return useContext(KeptScope);
}

/** A Map-like list kept with the place (unsaved scores), shared by every screen. */
export function keptMap(name) {
  const m = () => maps[name] || (maps[name] = {});
  return {
    get: k => m()[k],
    has: k => Object.prototype.hasOwnProperty.call(m(), k),
    set(k, v) { m()[k] = v; soon(); return this; },
    delete(k) { const had = k in m(); delete m()[k]; if (had) soon(); return had; },
    keys: () => Object.keys(m()),
  };
}
