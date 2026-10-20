# Overnight 14: rate limits (roadmap area 25)

Branch `o14/ratelimit`, commit dc3e641 (code) plus this note. Not pushed.

## What was built

- **`src/lib/rate-limit.js`**: the limiter, in two layers checked in order.
  1. A token bucket per IP in each function instance's memory. Free and instant, but Vercel runs many instances, so it only slows a flood that lands on one warm instance.
  2. A shared counter in Supabase, `rate_hit(key, max, window_seconds)`, a fixed window per key that every instance sees. Called with `SUPABASE_SERVICE_ROLE_KEY` (already in Vercel for push and the course quota). Without the key, only the memory layer runs.
  - **Fails open**: if Supabase is down, slow (over 800 ms), or the SQL hasn't run, the request goes through and the function logs `rate-limit: the shared counter did not answer...` once per instance (again only after a good call in between).
  - All the numbers are in one `LIMITS` object, with a comment on each.
  - IPs come from Vercel's `x-real-ip` / `x-forwarded-for` (Vercel sets these, so callers can't fake them). IPv6 addresses are grouped by their /64, since one home or phone gets a whole /64 and can hop around inside it.
  - Over the limit, the endpoint answers **429** with `Retry-After`, `Cache-Control: no-store`, and one plain line: `Too many requests. Try again in a minute.`
- **`api/courses.js`**: limited after validation and before any GolfCourseAPI call. Repeats that the CDN answers never reach the function, so they never count.
- **`api/join.js`**: limited first thing. The header comment explains why it's low risk and generous on purpose, so nobody over-tightens it later.
- **`api/feedback-notify.js`**: the URL is no use without the secret header (401 before anything happens). But the `feedback` table takes inserts from anyone with the public key, and each insert triggers an email through this function. So there's now a ceiling on **emails sent**, checked after the secret. Rows past the ceiling still save; only their email is skipped.
- **The app**: a 429 from `/api/courses` used to look like "not set up" (a non-JSON answer turned course search off for the session). Now:
  - `searchCourses` returns `{ status: 'limited', retryAfter }`, and `getCourse` throws a `CourseLimitError`. Neither is cached.
  - The course picker (NewRound), the Home course sheet and Near you show a calm hint card: "Lots of course searches just now. Try again in a minute." The "Request this course" card stays hidden meanwhile.
  - The search reruns by itself once the wait is over (capped at 2 minutes).
  - Picking a database course that hits the limit shows the same line as a toast.
- `src/lib/course-quota.js` gained `dailyQuota(env)`, so the global ceiling reads the same `GOLFCOURSEAPI_DAILY_QUOTA` the quota emails use.

Tests: 19 new in `src/lib/rate-limit.test.js` and 1 new client test in `courseApi.test.js`. The new tests cover the bucket math, LRU eviction, window math, IP parsing, the shared call, fail-open with log-once, rule order, the 429 shape, and courses, join and feedback end to end. `course-quota.test.js` now also checks the shared limit is asked per IP and then for everyone. Full suite: 2423 pass, lint clean, `vite build` ok.

## Limits and why

| Where | Limit | Why |
|---|---|---|
| `/api/courses` per IP | 30 a minute | The picker debounces typing (350 ms) and caches each search on the phone, so one person setting up a round makes a handful of calls. 30 leaves room for a fast typist or a group on one wifi. |
| `/api/courses` everyone | an eighth of the daily quota per hour, at least 10 | No single bad hour can spend the day, and the 80% email gets hours of warning. Free plan (35 a day): 10 an hour. Pro (10,000): 1,250 an hour. |
| `/api/join` per IP | 60 a minute | Only link-preview bots get here. WhatsApp's and Facebook's fetchers share a few IPs across everyone's links, and the CDN keeps each answer 5 minutes. Guessing codes is hopeless: 31^6, about 887 million codes, takes one IP about 28 years at 60 a minute. |
| feedback emails, everyone | 20 an hour | All calls come from Supabase's webhook, so an IP means nothing. A busy test day is a few dozen messages, and Resend's free plan stops at 100 a day. |

## SQL to run

There's one file and no ordering constraint with other files:

1. `supabase/2026-10-20-rate-limits.sql`: paste it into the Dashboard SQL Editor and Run. Safe to run again.
   - It creates the `rate_limits` table (unlogged, service role only), `rate_hit` and `rate_limits_cleanup` (both service role only), and turns on pg_cron with an hourly cleanup job at :17.
   - If pg_cron can't be turned on, the output says so and `rate_hit` cleans up after itself (about 1 call in 500).
   - It can run before or after the deploy. Until it runs, the functions fail open and log once per instance.
   - I checked it twice in a row in PGlite (Postgres 16 in WASM): limits at max, new windows reset, bad arguments return true, cleanup deletes, and anon is refused.

Also check in Vercel that `SUPABASE_SERVICE_ROLE_KEY` is set for **Preview** as well as Production, or previews only get the memory layer.

## Testing by hand with curl

First, two cautions:

- Vercel previews behind Deployment Protection need a bypass header (`-H "x-vercel-protection-bypass: <token>"`), or you can test on production after ship.
- Each `/api/courses` request that gets through spends a real GolfCourseAPI call, and the preview shares the Supabase counter (and the API key) with production.

```sh
URL=https://<preview>.vercel.app

# Join previews: the 61st distinct URL in a minute is 429 (the &n= busts the CDN cache, which would answer repeats)
for i in $(seq 1 62); do curl -s -o /dev/null -w "%{http_code} " "$URL/api/join?join=ABC234&n=$i"; done; echo
curl -i "$URL/api/join?join=ABC234&n=999"   # shows 429, Retry-After and the one line

# Course search: on the free plan the hourly ceiling for everyone (10) trips first.
# This spends about 10 of the day's 35 calls.
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " "$URL/api/courses?q=pine%20$i"; done; echo
curl -i "$URL/api/courses?q=pine%20zz"      # 429 with Retry-After up to 3600
```

Then in Supabase: `select * from public.rate_limits order by hits desc limit 20;`

In the app, after tripping the course ceiling: search a new course name. You should see the hint card instead of "Request this course", and the search should come back by itself once the hour turns.

Fail-open check: before the SQL runs, the same curls still work (the memory layer still trips at 61 on one warm instance), and the Vercel function logs show the "did not answer" line once.

## Risks

- **Preview and production share the counters** (same Supabase), so testing on a preview spends production's hourly course ceiling. That's correct for protecting the shared API quota, but surprising.
- **10 searches an hour on the free plan is tight** if a few testers set up rounds in the same hour. Repeats served from the CDN don't count, but new searches do. On Pro it's 1,250.
- **The memory layer is per instance**, so a distributed flood is only caught by the shared layer. If Supabase is down, the limit is effectively per instance (fail open by design).
- **IP rows are kept about an hour** (key plus count, no other data), then the cleanup deletes them.
- **Each limited course request adds up to 2 Supabase round trips** (per IP, then everyone), about 50 to 100 ms on a call that already waits on GolfCourseAPI. Each is capped at 800 ms.
- **Feedback rows are still unlimited**: only the email is capped. See question 3.
- **Not checked in a real browser**: the hint card is an existing `hint-card` style. Vite dev has no `/api`, so the limited state needs a preview to see.

## Questions for Trevor

1. **Who may call `rate_hit`?** The brief said "callable with the anon key". I made it service role only, because with the public key anyone could fill `courses:all` and lock course search for everyone, or fill the table with junk keys.
   - A. Service role only, as built **(suggested)**
   - B. Anon too, as the brief said
   - C. Anon, with the limits fixed per key prefix inside the SQL so callers can't pick their own max
2. **What should a link-preview bot get when join is over its limit?**
   - A. 429, as built **(suggested: bots retry, and 60 a minute is far above real use)**
   - B. The plain page with the default preview card, so a busy moment never shows a broken preview
   - C. No limit on join at all
3. **Should feedback inserts be capped too?** Today anyone with the public key can add rows to `feedback` without limit. The email is capped now, but the table and screenshot storage are not.
   - A. Leave it until it's abused
   - B. A database trigger that refuses more than about 200 rows an hour for everyone **(suggested, small SQL for a later run)**
   - C. A per-device cap using the app's device id (stronger, but more work and easy to fake)
