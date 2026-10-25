// The paywall flag, read on its own with no imports so the first screen (App.jsx, Up next) can
// check it without loading paywall.js. paywall.js re-exports it.

/**
 * The flag. Off unless turned on: `VITE_PAYWALL=on` at build time, or `?paywall=on` in the
 * address bar on that phone (remembered; `?paywall=off` turns it back off). Local dev follows
 * production, so the paywall doesn't show there until you ask for it.
 * Returns { on, remember } where `remember` is the override to save, if the URL set one.
 */
export function readFlag({ env = {}, search = '', saved = null } = {}) {
  const q = new URLSearchParams(search).get('paywall');
  if (q === 'on' || q === 'off') return { on: q === 'on', remember: q };
  if (saved === 'on' || saved === 'off') return { on: saved === 'on', remember: null };
  const v = String(env.VITE_PAYWALL ?? '').toLowerCase();
  if (v === 'on' || v === '1' || v === 'true') return { on: true, remember: null };
  if (v === 'off' || v === '0' || v === 'false') return { on: false, remember: null };
  return { on: false, remember: null };
}
