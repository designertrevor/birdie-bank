// The status page's rules (public/status.html, wired up by status.js): what it checks, how each
// answer turns into a green, amber or grey dot, and the one line at the top. Plain browser code
// with no build step, and no DOM in here, so src/lib/status-page.test.js can check it in Node.

/** The project and its publishable key, the same public pair the app and api/push.js ship with. */
export const SUPABASE_URL = 'https://yffribkjqvkncmypexfa.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx';

/** Each check gets this long before it counts as down. */
export const TIMEOUT_MS = 5000;
/** An answer slower than this is up but slow (amber). */
export const SLOW_MS = 2000;

/**
 * What the page checks, top to bottom. Each one is a small GET that costs nothing:
 * - the app: /version.json, the "which build is live" file (the service worker never answers it from
 *   its saved copy, so this is the real server)
 * - the database: a select that can never match a row, so it reads nothing but still goes through
 *   the REST API and Postgres
 * - sign-in: Supabase Auth's own health check
 * - course search and notifications: our functions' health mode, which answers without calling
 *   GolfCourseAPI (so no quota) and without sending anything
 */
export const CHECKS = [
  { id: 'app', name: 'The app', what: 'Opening the app and getting the latest version', url: '/version.json' },
  {
    id: 'db', name: 'Live scoring and accounts', what: 'Shared rounds, plans, the Tab and your saved data',
    url: `${SUPABASE_URL}/rest/v1/live_rounds?select=code&code=eq.status-check&limit=1`, headers: { apikey: SUPABASE_KEY },
  },
  { id: 'auth', name: 'Sign in', what: 'Signing in with email or Google', url: `${SUPABASE_URL}/auth/v1/health`, headers: { apikey: SUPABASE_KEY } },
  { id: 'courses', name: 'Course search', what: 'Finding a course and its scorecard', url: '/api/courses?health=1' },
  { id: 'push', name: 'Notifications', what: 'Invites, who’s in and round results on your lock screen', url: '/api/push?health=1' },
];

/**
 * One check's answer as a row. `res` is { ok, status, body } from the fetch (body parsed when it was
 * JSON), or null when it never answered; `timedOut` when that was the 5 seconds running out.
 * Returns { state: 'up' | 'slow' | 'down', label, detail }.
 */
export function judge(check, res, ms, { timedOut = false } = {}) {
  if (!res) {
    return { state: 'down', label: 'Down', detail: timedOut ? `No answer in ${TIMEOUT_MS / 1000} seconds` : 'Couldn’t reach it' };
  }
  if (!res.ok) {
    return { state: 'down', label: 'Down', detail: res.status >= 500 ? `Server error (${res.status})` : `Unexpected answer (${res.status})` };
  }
  const body = res.body && typeof res.body === 'object' ? res.body : null;
  // Our functions answer even when their key is missing: up, but the feature is off
  if ((check.id === 'courses' || check.id === 'push') && body && body.configured === false) {
    return { state: 'slow', label: 'Off', detail: 'Running, but switched off on the server' };
  }
  const version = check.id === 'app' && body && typeof body.id === 'string' ? ` · version ${body.id.slice(0, 7)}` : '';
  if (ms > SLOW_MS) return { state: 'slow', label: 'Slow', detail: `Working, but slow${version}` };
  return { state: 'up', label: 'Normal', detail: `Working${version}` };
}

const list = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * The line at the top, from the rows ({ name, state } each, state null while still checking).
 * `online`: navigator.onLine, since a phone with no signal sees everything down.
 */
export function summary(rows, { online = true } = {}) {
  if (rows.some(r => !r.state)) return { tone: 'wait', text: 'Checking…' };
  const down = rows.filter(r => r.state === 'down');
  const slow = rows.filter(r => r.state === 'slow');
  if (down.length === rows.length || (!online && down.length)) {
    return { tone: 'down', text: 'Can’t reach anything from here', sub: 'This phone may be offline. Check your signal, then check again.' };
  }
  if (down.length) {
    return { tone: 'down', text: `${list(down.map(r => r.name))} ${down.length === 1 ? 'is' : 'are'} down`, sub: 'Everything else is working. Scores you enter are saved on your phone and sync when it’s back.' };
  }
  if (slow.length) {
    return { tone: 'slow', text: 'All systems up', sub: `${list(slow.map(r => r.name))} ${slow.length === 1 ? 'is' : 'are'} slow or switched off right now.` };
  }
  return { tone: 'up', text: 'All systems normal', sub: 'Everything answered quickly.' };
}

/** "Checked just now", then "Checked 3 min ago". */
export function checkedAgo(at, now = Date.now()) {
  if (!at) return 'Not checked yet';
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return 'Checked just now';
  if (min < 60) return `Checked ${min} min ago`;
  const h = Math.floor(min / 60);
  return `Checked ${h} ${h === 1 ? 'hour' : 'hours'} ago`;
}

/**
 * Run one check: a GET with the 5 second limit and no cache. `fetchImpl` and `clock` for the tests.
 * Resolves to { ms, ...judge() }, never rejects.
 */
export async function runCheck(check, { fetchImpl = fetch, clock = () => performance.now(), timeout = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
  const start = clock();
  let res = null;
  try {
    const sep = check.url.includes('?') ? '&' : '?';
    // A fresh query on our own files so neither the CDN nor the browser hands back an old answer
    const url = check.url.startsWith('/') ? `${check.url}${sep}t=${Date.now()}` : check.url;
    const r = await fetchImpl(url, { method: 'GET', headers: check.headers || {}, cache: 'no-store', signal: ctrl.signal, credentials: 'omit' });
    let body = null;
    try { body = /json/.test(r.headers?.get?.('content-type') || '') ? await r.json() : null; } catch { body = null; }
    res = { ok: r.ok, status: r.status, body };
  } catch {
    res = null;
  } finally {
    clearTimeout(timer);
  }
  const ms = Math.max(0, Math.round(clock() - start));
  return { ms, ...judge(check, res, ms, { timedOut }) };
}
