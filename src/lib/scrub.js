// What a crash report may carry, and nothing more. Sentry (sentry-client.js) runs every event and
// breadcrumb through here before it leaves the phone: no emails, phone numbers, names, courses,
// amounts or round contents, and addresses keep their path only (a ?join=, ?plan= or sign-in code
// never goes). The user is never set, so there's nothing to say who it was. Pure, so it's tested.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A dollar amount ("$12", "$1,250.50", "-$5")
const MONEY = /-?\$\s?\d[\d,]*(\.\d+)?/g;
// Phone numbers and other long runs of digits (a 7+ digit run, with the usual separators)
const LONG_NUMBER = /\+?\(?\d[\d\s().-]{6,}\d/g;
// Text in double or curly quotes, which is where an app message would put a name or a course
// ("No player "Bob""); engine messages quote property names in single quotes, which stay
const QUOTED = /"[^"\n]{1,200}"|“[^”\n]{1,200}”/g;
// Postgres error details name the row's values: Key (code)=(AB12CD)
const PG_DETAIL = /=\([^)]{0,200}\)/g;
const URLS = /\bhttps?:\/\/[^\s"'<>)]+/g;
const MAX_TEXT = 500;

/** An address with its query and hash taken off ("https://x.app/?join=AB12" → "https://x.app/"). */
export function cleanUrl(u) {
  const s = String(u ?? '');
  if (!s) return s;
  return s.replace(/[?#].*$/, '');
}

/** A message with the personal bits taken out, short enough to read. */
export function scrubText(text) {
  if (text == null) return text;
  return String(text)
    .replace(URLS, m => cleanUrl(m))
    .replace(EMAIL, '[email]')
    .replace(MONEY, '[amount]')
    .replace(LONG_NUMBER, '[number]')
    .replace(QUOTED, '"…"')
    .replace(PG_DETAIL, '=(…)')
    .slice(0, MAX_TEXT);
}

// The breadcrumbs worth keeping: which screen-ish address the app was on and which requests went
// out (method, address without its query, status). Console lines and taps are never kept.
const CRUMB_KINDS = new Set(['navigation', 'fetch', 'xhr']);
const CRUMB_DATA = ['method', 'status_code', 'url', 'from', 'to'];

/** A breadcrumb fit to send, or null to drop it. */
export function scrubBreadcrumb(crumb) {
  if (!crumb || !CRUMB_KINDS.has(crumb.category)) return null;
  const data = {};
  for (const k of CRUMB_DATA) {
    const v = crumb.data?.[k];
    if (v == null) continue;
    data[k] = typeof v === 'string' ? cleanUrl(v) : typeof v === 'number' ? v : undefined;
  }
  const out = { type: crumb.type, category: crumb.category, level: crumb.level, timestamp: crumb.timestamp, data };
  if (crumb.message) out.message = scrubText(cleanUrl(crumb.message));
  return out;
}

// Context Sentry adds by itself that's safe: the browser, the OS and the device type
const KEEP_CONTEXTS = ['browser', 'os', 'device', 'culture', 'trace'];

/**
 * A Sentry event fit to send: the error's type, message (scrubbed) and stack, the release, tags
 * the app set, browser and OS. No user, no request query, no extras beyond the React component
 * stack (component names only).
 */
export function scrubEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const e = { ...event };
  delete e.user;
  delete e.server_name;
  if (e.message) e.message = scrubText(e.message);
  if (e.logentry) e.logentry = { message: scrubText(e.logentry.message) };
  if (e.exception?.values) {
    e.exception = {
      ...e.exception,
      values: e.exception.values.map(v => ({
        ...v,
        value: scrubText(v.value),
        stacktrace: v.stacktrace ? {
          ...v.stacktrace,
          frames: (v.stacktrace.frames || []).map(f => {
            const g = { ...f };
            if (g.filename) g.filename = cleanUrl(g.filename);
            if (g.abs_path) g.abs_path = cleanUrl(g.abs_path);
            delete g.vars;
            return g;
          }),
        } : v.stacktrace,
      })),
    };
  }
  if (e.request) {
    const ua = e.request.headers?.['User-Agent'] || e.request.headers?.['user-agent'];
    e.request = { url: cleanUrl(e.request.url), ...(ua ? { headers: { 'User-Agent': ua } } : {}) };
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
  if (e.contexts) {
    const contexts = {};
    for (const k of KEEP_CONTEXTS) if (e.contexts[k]) contexts[k] = e.contexts[k];
    // The component stack from the error boundary: component names, nothing typed in
    if (typeof e.contexts.react?.componentStack === 'string') contexts.react = { componentStack: e.contexts.react.componentStack.slice(0, 4000) };
    e.contexts = contexts;
  }
  delete e.extra;
  return e;
}

/**
 * Usage event properties with every address cut back to its path (PostHog adds the page's address
 * and the referrer by itself, and those can carry a ?join= or sign-in code). Nested objects too.
 */
export function cleanUrlProps(props, depth = 0) {
  if (!props || typeof props !== 'object' || depth > 3) return props;
  const out = Array.isArray(props) ? [] : {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) out[k] = cleanUrl(v);
    else if (typeof v === 'string' && /search|query/i.test(k)) continue;
    else if (v && typeof v === 'object') out[k] = cleanUrlProps(v, depth + 1);
    else out[k] = v;
  }
  return out;
}
