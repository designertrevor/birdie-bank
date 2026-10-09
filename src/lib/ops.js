// Crash reports (Sentry), usage counts (PostHog) and where someone came from (attribution.js): the
// part on the first screen, kept tiny. At launch it notes the address (a creator's ?ref= code goes
// before the app tidies the address bar) and starts catching errors; after the first paint it loads
// the rest (ops-late.js), and only when there's something to do: a Sentry DSN, a PostHog key
// (VITE_SENTRY_DSN, VITE_POSTHOG_KEY in Vercel) or a creator code to keep. With none, nothing loads.
import { crashReportsOff, windowError } from './crash.js';
import { trackingOff } from './analytics.js';
import { getState } from './store.js';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
export const LAST_OPEN = 'bb-last-open';

let launch = null;

/** Right at launch, before the first render (main.jsx). */
export function opsAtLaunch() {
  const search = typeof location !== 'undefined' ? location.search : '';
  launch = {
    // Only an address with a creator code in it is kept, and only until ops-late.js reads the code
    search: /[?&](ref|via)=/i.test(search) ? search : '',
    path: typeof location !== 'undefined' ? location.pathname : '/',
    now: Date.now(),
    fresh: !getState().onboarded,
    lastOpenAt: 0,
  };
  if (SENTRY_DSN) {
    addEventListener('error', e => windowError(e.error || e.message, 'window'));
    addEventListener('unhandledrejection', e => windowError(e.reason, 'promise'));
  }
  if (POSTHOG_KEY) {
    try {
      launch.lastOpenAt = Number(localStorage.getItem(LAST_OPEN)) || 0;
      localStorage.setItem(LAST_OPEN, String(launch.now));
    } catch { /* storage blocked */ }
  }
}

/** After the first paint (main.jsx): load the rest, or turn it all off when there's nothing to do. */
export function opsAfterPaint() {
  let unsaved = false;
  try { unsaved = !!localStorage.getItem('bb-ref') && !localStorage.getItem('bb-ref-saved'); } catch { /* storage blocked */ }
  if (!SENTRY_DSN && !POSTHOG_KEY && !launch?.search && !unsaved) {
    crashReportsOff();
    trackingOff();
    return;
  }
  import('./ops-late.js').then(m => m.startOps(launch || {})).catch(() => {});
}
