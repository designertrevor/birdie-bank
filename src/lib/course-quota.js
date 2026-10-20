// The watch on the GolfCourseAPI quota (ROADMAP area 25). GolfCourseAPI allows a fixed number of
// calls a day (35 on the free plan, 10,000 on Pro, 100,000 on Enterprise) and reports nothing
// about how many are left: no header on its responses and no account endpoint (checked against
// its OpenAPI spec, 1.3.0, 2026-10-20). So api/courses.js counts each call it makes in Supabase
// (course_api_call in supabase/2026-10-20-course-api-usage.sql, one row a day) and emails Trevor
// through Resend when the day is 80% used, when it runs out, and the first time the API answers
// 429 in a day (the count was wrong, or the plan changed). Each email goes out once a day.
// `fetch` is passed in, so tests run it with no network. Server only.
//
// Set in Vercel's environment variables (all but the quota are there already for push and feedback):
//   SUPABASE_SERVICE_ROLE_KEY  writes the day's count (course_api_call)
//   RESEND_API_KEY             sends the email
//   FEEDBACK_EMAIL             where it goes
//   FEEDBACK_FROM              optional sender, once there's a domain
//   GOLFCOURSEAPI_DAILY_QUOTA  the plan's calls a day; 35 (the free plan) when unset. Set 10000 after upgrading to Pro
// Without the service key nothing is counted; without Resend the count still runs and no email goes.
// Counting never blocks or breaks a search: every failure here is swallowed.

export const DEFAULT_QUOTA = 35;
export const WARN_AT = 0.8;
const PRICING = 'https://golfcourseapi.com (Pro is $9.99 a month for 10,000 calls a day)';

/** The plan's GolfCourseAPI calls a day: GOLFCOURSEAPI_DAILY_QUOTA, or the free plan's 35 when it isn't a whole number. */
export function dailyQuota(env = {}) {
  const q = Number.parseInt(env.GOLFCOURSEAPI_DAILY_QUOTA, 10);
  return Number.isInteger(q) && q > 0 ? q : DEFAULT_QUOTA;
}

/** The watch's settings from the environment: { url, serviceKey, quota, warnAt, mail }. mail is null when Resend isn't set. */
export function quotaConfig(env = {}) {
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const quota = dailyQuota(env);
  const mail = env.RESEND_API_KEY && env.FEEDBACK_EMAIL
    ? { key: env.RESEND_API_KEY, to: env.FEEDBACK_EMAIL, from: env.FEEDBACK_FROM || 'Birdie Bank <onboarding@resend.dev>' }
    : null;
  return { url, serviceKey, quota, warnAt: Math.ceil(quota * WARN_AT), mail };
}

/** Today as the API most likely counts it, a UTC date (YYYY-MM-DD). */
export function utcDay(now = new Date()) { return now.toISOString().slice(0, 10); }

/**
 * Which email a call's new count earns, or null: 'warning' at 80% of the quota, 'out' when it
 * reaches the quota, 'limited' the first time the API answers 429 that day.
 */
export function quotaEvent({ calls, limited, limitedBefore }, cfg) {
  if (limited && !limitedBefore) return 'limited';
  if (calls === cfg.quota) return 'out';
  if (calls === cfg.warnAt && cfg.warnAt < cfg.quota) return 'warning';
  return null;
}

/** The email for an event: { subject, text, html }. Exported for a look in tests. */
export function quotaEmail(event, { calls, day }, cfg) {
  const pct = Math.round((calls / cfg.quota) * 100);
  const used = `Course search has used ${calls} of ${cfg.quota} GolfCourseAPI calls today (${day} UTC, ${pct}%).`;
  const heads = {
    warning: { subject: `Birdie Bank: course search is at ${pct}% of today’s GolfCourseAPI calls`, lead: `${used} Searches stop at ${cfg.quota} until the day resets at midnight UTC.` },
    out: { subject: 'Birdie Bank: course search is out of GolfCourseAPI calls for today', lead: `${used} Searches answer "rate limited" until the day resets at midnight UTC. Courses already picked keep working.` },
    limited: { subject: 'Birdie Bank: GolfCourseAPI answered "over the limit" to a course search', lead: `GolfCourseAPI answered 429 (over the limit) to a course search. Our own count says ${calls} of ${cfg.quota} today (${day} UTC), so either the plan’s limit is lower than GOLFCOURSEAPI_DAILY_QUOTA in Vercel or the day resets at another hour.` },
  }[event];
  const lines = [
    heads.lead,
    '',
    `More room: ${PRICING}. After upgrading, set GOLFCOURSEAPI_DAILY_QUOTA in Vercel (Settings, Environment Variables) to the new plan’s calls a day and redeploy.`,
    'Repeats of the same search are answered by Vercel’s cache for a day and don’t use calls; new searches and new scorecards do.',
    'This email comes once a day for each of: 80% used, the quota reached, and the first 429 (api/courses.js, src/lib/course-quota.js).',
  ];
  const text = lines.join('\n');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return { subject: heads.subject, text, html: `<pre style="font: 14px/1.5 -apple-system, sans-serif; white-space: pre-wrap">${esc(text)}</pre>` };
}

/** Add `add` calls (1, or 0 to only note a 429) to the day's row. { calls, limitedBefore } or null when the SQL hasn't run or Supabase can't be reached. */
export async function countCourseCall(cfg, { day, add = 1, limited = false }, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/course_api_call`, {
      method: 'POST',
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_day: day, p_add: add, p_limited: !!limited }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!Number.isInteger(row?.calls)) return null;
    return { calls: row.calls, limitedBefore: !!row.limited_before };
  } catch { return null; }
}

/** Send one quota email through Resend. True when Resend accepted it. */
export async function sendQuotaEmail(cfg, mail, fetchImpl = fetch) {
  if (!cfg.mail) return false;
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.mail.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.mail.from, to: [cfg.mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch { return false; }
}

/**
 * Record one GolfCourseAPI call and email when it crosses a line. api/courses.js starts this
 * beside the upstream call, so it adds no wait, and when the API answers 429 calls it again with
 * { add: 0, limited: true } to note that without counting twice.
 * Never throws. Returns { calls, event, emailed } for logs and tests, or null when the watch is off.
 */
export async function watchCourseQuota(env, { add = 1, limited = false, now = new Date() } = {}, fetchImpl = fetch) {
  const cfg = quotaConfig(env);
  if (!cfg) return null;
  const day = utcDay(now);
  const counted = await countCourseCall(cfg, { day, add, limited }, fetchImpl);
  if (!counted) return null;
  const event = quotaEvent({ calls: counted.calls, limited, limitedBefore: counted.limitedBefore }, cfg);
  const emailed = event ? await sendQuotaEmail(cfg, quotaEmail(event, { calls: counted.calls, day }, cfg), fetchImpl) : false;
  return { calls: counted.calls, event, emailed };
}
