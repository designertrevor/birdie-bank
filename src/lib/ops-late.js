// The rest of crash reports, usage counts and attribution, loaded after the first paint by ops.js.
// Each part is off without its key: no DSN, no Sentry; no PostHog key, no PostHog. Both libraries
// load only while "Share usage data" is on in Settings, and that switch turns both off at once.
import { attachTracker, trackingOff } from './analytics.js';
import { attachReporter, crashReportsOff } from './crash.js';
import { createTracker, openProps, REOPEN_AFTER } from './analytics-core.js';
import { createCrashReporter } from './crash-core.js';
import { attributionProps, captureAttribution, readAttribution } from './attribution.js';
import { BUILD_ID } from './build-info.js';
import { SITE_URL } from './app-name.js';
import { getState, subscribe } from './store.js';
import { LAST_OPEN } from './ops.js';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

/** Share usage data (Settings): on unless switched off. */
const sharingUsage = () => getState().settings?.shareUsage !== false;

const environment = () => {
  if (import.meta.env.DEV) return 'development';
  try { return location.hostname === new URL(SITE_URL).hostname ? 'production' : 'preview'; } catch { return 'production'; }
};

/** When the last round on this phone finished, and how many have. */
function roundsSoFar() {
  let last = 0;
  let done = 0;
  for (const r of Object.values(getState().rounds || {})) {
    if (r?.status !== 'done') continue;
    done += 1;
    last = Math.max(last, r.finishedAt || r.createdAt || 0);
  }
  return { lastRoundAt: last || null, roundsDone: done };
}

/** Start whatever has a key. `launch`: what ops.js noted at launch. */
export function startOps(launch) {
  let attribution = null;
  try {
    attribution = launch.search
      ? captureAttribution({ storage: localStorage, search: launch.search, path: launch.path, now: launch.now, fresh: launch.fresh })
      : readAttribution(localStorage);
  } catch { /* storage blocked */ }
  launch.search = '';

  const parts = [];
  if (SENTRY_DSN) {
    const crashes = createCrashReporter();
    crashes.start({
      allowed: sharingUsage,
      load: () => import('./sentry-client.js').then(m => m.startSentry({
        dsn: SENTRY_DSN, release: `birdie-bank@${BUILD_ID}`, environment: environment(), allowed: sharingUsage,
      })),
    });
    attachReporter(crashes);
    parts.push(crashes);
  } else crashReportsOff();

  if (POSTHOG_KEY) {
    const tracker = createTracker();
    tracker.start({
      key: POSTHOG_KEY,
      allowed: sharingUsage,
      context: () => attributionProps(attribution),
      load: () => import('./posthog-client.js').then(m => m.startPostHog({ key: POSTHOG_KEY, host: POSTHOG_HOST, enabled: sharingUsage() })),
    });
    // This launch's open goes first, then anything a screen counted while this loaded
    const first = openProps({ lastOpenAt: launch.lastOpenAt, now: launch.now || Date.now(), ...roundsSoFar() });
    if (first) tracker.track('app_opened', first);
    attachTracker(tracker);
    parts.push(tracker);
    // Coming back to the app after half an hour away is another open
    let lastOpenAt = launch.now || Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastOpenAt < REOPEN_AFTER) return;
      const props = openProps({ lastOpenAt, now, ...roundsSoFar() });
      lastOpenAt = now;
      try { localStorage.setItem(LAST_OPEN, String(now)); } catch { /* storage blocked */ }
      if (props) tracker.track('app_opened', props);
    });
  } else trackingOff();

  // Share usage data switched in Settings
  let was = sharingUsage();
  subscribe(() => {
    const on = sharingUsage();
    if (on === was) return;
    was = on;
    parts.forEach(p => p.sharingChanged(on));
  });

  // Signed in: the account gets the creator code once, and usage counts follow the account
  if (POSTHOG_KEY || attribution) import('./ops-account.js').then(m => m.watchAccount({ withAnalytics: !!POSTHOG_KEY })).catch(() => {});
}
