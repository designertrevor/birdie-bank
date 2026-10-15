// The last few errors a golfer saw only as a friendly toast ("Couldn’t start sharing"), kept on the
// phone so the next "Something’s broken" report carries the real cause (feedback.js attaches them).
// Also sent to crash reports when those are on (crash.js).
import { reportError } from './crash.js';

const KEY = 'bb-recent-errors';
const KEEP = 8;

export function recentErrors() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

/** Note an error behind a friendly message. `where` names the action, e.g. 'share-round'. */
export function noteError(where, e) {
  const entry = {
    where,
    at: new Date().toISOString(),
    message: String(e?.message || e || '').slice(0, 300),
    code: e?.code ? String(e.code) : undefined,
    status: e?.status ?? undefined,
    details: e?.details ? String(e.details).slice(0, 300) : undefined,
    hint: e?.hint ? String(e.hint).slice(0, 200) : undefined,
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
  };
  try { localStorage.setItem(KEY, JSON.stringify([...recentErrors(), entry].slice(-KEEP))); } catch { /* storage full */ }
  try { reportError(e instanceof Error ? e : new Error(entry.message), { where }); } catch { /* reports off */ }
}

/** A fetch that never reached the server (weak signal, a dropped connection), as each browser words it. */
export function isNetworkError(e) {
  return /Failed to fetch|Load failed|NetworkError|network connection was lost|timed out|Network request failed/i.test(String(e?.message || ''));
}
