// Rate limits for the public api functions (ROADMAP area 25): api/join.js, api/courses.js,
// api/csp-report.js and the emails api/feedback-notify.js sends. Two layers, checked in order:
//   1. A token bucket in this function instance's memory, per IP (and one for everyone). Free and
//      instant, but Vercel runs many instances and starts fresh ones often, so it only stops a
//      flood that keeps landing on one warm instance.
//   2. A counter shared by every instance, in Supabase: rate_hit(key, max, window_seconds) in
//      supabase/2026-10-20-rate-limits.sql, a fixed window per key. It needs
//      SUPABASE_SERVICE_ROLE_KEY (only the service role may call it, so nobody with the app's
//      public key can fill up the counters and lock everyone else out). Without the key the
//      memory layer still runs.
// Fail open: when Supabase can't be reached, or the SQL hasn't run, the request goes through and
// the problem is logged once (again only after a call has worked in between). A limiter that
// breaks course search would be worse than the abuse it stops.
// Server only. `fetch` and the clock are passed in, so the tests run with no network.

import { dailyQuota } from './course-quota.js';

// Every limit lives here. max is requests per window; windowSeconds is the window's length.
export const LIMITS = {
  join: {
    // Link previews (api/join.js). Middleware sends only link-preview bots there and the CDN keeps
    // each link's answer for 5 minutes, so this is generous on purpose: WhatsApp's and Facebook's
    // fetchers come from a few shared IPs for everyone's links, and a tight limit would break
    // real previews long before it slowed anyone guessing codes. See api/join.js before lowering.
    ip: { max: 60, windowSeconds: 60 },
  },
  courses: {
    // Course search and scorecards (api/courses.js), per IP. The picker debounces typing (350 ms)
    // and the phone caches each search, so one person setting up a round makes a handful of
    // calls; 30 a minute is a fast typist on a bad day, and also room for a group on one wifi.
    ip: { max: 30, windowSeconds: 60 },
    // Everyone together, an hour at a time: an eighth of the plan's daily GolfCourseAPI calls
    // (GOLFCOURSEAPI_DAILY_QUOTA), and never under 10. So no single bad hour can spend the day's
    // quota, and the 80% email (src/lib/course-quota.js) has hours of warning to work with.
    // Free plan (35 a day): 10 an hour. Pro (10,000 a day): 1,250 an hour.
    global: { share: 1 / 8, floor: 10, windowSeconds: 3600 },
  },
  cspReport: {
    // Content security policy reports (api/csp-report.js), which go on to Sentry. Anyone can POST
    // there, so without a cap a script could fill Sentry's quota with junk. A page that breaks the
    // policy sends one report per thing it blocks, so 20 a minute from one phone is plenty, and
    // 100 an hour for everyone is far above what a handful of testers make. Past it the report is
    // dropped (still a 204, so browsers never retry).
    ip: { max: 20, windowSeconds: 60 },
    all: { max: 100, windowSeconds: 3600 },
  },
  feedback: {
    // Feedback emails (api/feedback-notify.js), everyone together. Every call comes from Supabase's
    // webhook, so there's no IP worth counting. A busy testing day is a few dozen messages; 20 an
    // hour keeps a flood of inserts from emptying Resend's free 100 a day or Trevor's inbox.
    all: { max: 20, windowSeconds: 3600 },
  },
};

// How many IPs one instance remembers before it forgets the oldest
const MEMORY_KEYS = 5000;
// A shared check that takes longer than this lets the request through
const SHARED_TIMEOUT_MS = 800;

/** The global course search limit for a plan's daily quota: { max, windowSeconds }. */
export function courseGlobalLimit(quota) {
  const g = LIMITS.courses.global;
  return { max: Math.max(g.floor, Math.ceil(quota * g.share)), windowSeconds: g.windowSeconds };
}

/** The course search rules for this environment: per IP, then everyone. */
export function courseRules(env = {}) {
  return [
    { scope: 'ip', ...LIMITS.courses.ip },
    { scope: 'all', ...courseGlobalLimit(dailyQuota(env)) },
  ];
}

export const joinRules = () => [{ scope: 'ip', ...LIMITS.join.ip }];
export const feedbackRules = () => [{ scope: 'all', ...LIMITS.feedback.all }];
export const cspReportRules = () => [{ scope: 'ip', ...LIMITS.cspReport.ip }, { scope: 'all', ...LIMITS.cspReport.all }];

// ---------------------------------------------------------------------------
// Layer 1: a token bucket. Full at the start (max tokens), one token per request, refilling
// evenly so a full window's worth comes back over windowSeconds.

/**
 * Take one token from a bucket at `now` (ms). Returns { allowed, bucket, retryAfter } where
 * bucket is the new state ({ tokens, at }) and retryAfter the whole seconds until a token is back
 * (0 when allowed). `bucket` null or undefined is a full one.
 */
export function takeToken(bucket, now, { max, windowSeconds }) {
  const rate = max / windowSeconds; // tokens a second
  const prev = bucket || { tokens: max, at: now };
  const elapsed = Math.max(0, (now - prev.at) / 1000);
  const tokens = Math.min(max, prev.tokens + elapsed * rate);
  if (tokens >= 1) return { allowed: true, bucket: { tokens: tokens - 1, at: now }, retryAfter: 0 };
  return { allowed: false, bucket: { tokens, at: now }, retryAfter: Math.max(1, Math.ceil((1 - tokens) / rate)) };
}

/** Buckets by key, forgetting the least recently used past maxKeys. */
export function memoryBuckets(maxKeys = MEMORY_KEYS) {
  const map = new Map();
  return {
    take(key, now, limit) {
      const r = takeToken(map.get(key), now, limit);
      map.delete(key); // re-insert so the Map's order is least recently used first
      map.set(key, r.bucket);
      if (map.size > maxKeys) map.delete(map.keys().next().value);
      return r;
    },
    get size() { return map.size; },
  };
}

// ---------------------------------------------------------------------------
// Layer 2: the shared counter in Supabase.

/** Whole seconds until the fixed window rate_hit counts in ends (windows start on the epoch, as in the SQL). */
export function windowLeft(nowMs, windowSeconds) {
  const s = Math.floor(nowMs / 1000);
  return windowSeconds - (s % windowSeconds);
}

/** The shared counter's settings from the environment, or null when there's no service key. */
export function sharedConfig(env = {}) {
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { url, key } : null;
}

/**
 * Count one request against `key` in Supabase. Resolves true (under the limit), false (over it),
 * or null when it couldn't tell (Supabase down or slow, the SQL not run yet, an odd answer).
 */
export async function sharedHit(cfg, { key, max, windowSeconds }, fetchImpl = (...a) => fetch(...a)) {
  try {
    const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/rate_hit`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: key, p_max: max, p_window_seconds: windowSeconds }),
      signal: AbortSignal.timeout(SHARED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const v = await res.json();
    return typeof v === 'boolean' ? v : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// The client's address.

/** An IPv6 address written out in full (8 groups of 4 hex digits), or null when it isn't one. */
export function expandIpv6(ip) {
  let s = String(ip).toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  // An IPv4 tail (::ffff:1.2.3.4) becomes two hex groups
  const v4 = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    s = s.slice(0, v4.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  const [head, tail] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail == null ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail == null && h.length !== 8)) return null;
  const groups = [...h, ...Array(fill).fill('0'), ...t];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => g.padStart(4, '0')).join(':');
}

/**
 * Who's asking, as a rate limit key: an IPv4 address as it is, an IPv6 address by its /64 (one
 * home or phone gets a whole /64 and can hop around inside it), or 'unknown'. Vercel sets
 * x-real-ip and x-forwarded-for itself, so a caller can't pick their own. `headers` is a fetch
 * Headers or Node's plain lower-case object.
 */
export function clientIp(headers) {
  const get = n => (typeof headers?.get === 'function' ? headers.get(n) : headers?.[n]);
  const raw = String(get('x-real-ip') || String(get('x-forwarded-for') || '').split(',')[0] || '').trim();
  if (!raw) return 'unknown';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return raw;
  const full = expandIpv6(raw);
  if (!full) return 'unknown';
  // An IPv4 address written as IPv6 (::ffff:1.2.3.4) is that IPv4 address
  if (full.startsWith('0000:0000:0000:0000:0000:ffff:')) {
    const [x, y] = full.split(':').slice(6).map(g => parseInt(g, 16));
    return [x >> 8, x & 255, y >> 8, y & 255].join('.');
  }
  return `${full.split(':').slice(0, 4).join(':')}::/64`;
}

// ---------------------------------------------------------------------------
// The limiter.

/**
 * A limiter for one function. rules: [{ scope: 'ip' | 'all', max, windowSeconds }], checked in
 * order, so a flood from one IP is turned away before it counts against everyone.
 * `rules` and `env` may each be a function, read on every check, so a function's limiter follows
 * process.env as it is now (and tests can change it between requests).
 * check(ip) resolves { allowed: true } or { allowed: false, retryAfter, scope, layer }.
 * It never throws.
 */
export function createLimiter(name, rules, { env = {}, fetchImpl = (...a) => fetch(...a), now = Date.now, log = console.warn, buckets = memoryBuckets() } = {}) {
  let logged = false;
  const keyOf = (scope, ip) => (scope === 'ip' ? `${name}:ip:${ip}` : `${name}:all`);
  return {
    async check(ip = 'unknown') {
      try {
        const t = now();
        const shared = sharedConfig(typeof env === 'function' ? env() : env);
        for (const rule of typeof rules === 'function' ? rules() : rules) {
          const key = keyOf(rule.scope, ip);
          const mem = buckets.take(key, t, rule);
          if (!mem.allowed) return { allowed: false, retryAfter: mem.retryAfter, scope: rule.scope, layer: 'memory' };
          if (!shared) continue;
          const ok = await sharedHit(shared, { key, max: rule.max, windowSeconds: rule.windowSeconds }, fetchImpl);
          if (ok === null) {
            if (!logged) { logged = true; log(`rate-limit: the shared counter did not answer for ${name}, letting requests through (supabase/2026-10-20-rate-limits.sql run?)`); }
            continue;
          }
          logged = false;
          if (!ok) return { allowed: false, retryAfter: windowLeft(now(), rule.windowSeconds), scope: rule.scope, layer: 'shared' };
        }
        return { allowed: true };
      } catch {
        return { allowed: true };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The answer when it's over.

/** The one-line body of a 429. */
export function tooManyText(retryAfter) {
  const s = Math.max(1, Math.round(retryAfter));
  const when = s <= 60 ? 'in a minute' : s < 3600 ? `in ${Math.ceil(s / 60)} minutes` : 'in an hour';
  return `Too many requests. Try again ${when}.\n`;
}

/** The headers of a 429. */
export function tooManyHeaders(retryAfter) {
  return { 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
}

/** A 429 as a fetch Response, for the functions written as `fetch(request)`. */
export function tooManyResponse(retryAfter) {
  return new Response(tooManyText(retryAfter), { status: 429, headers: tooManyHeaders(retryAfter) });
}
