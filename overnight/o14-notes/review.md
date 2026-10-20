# Overnight 14: merged-diff review

Reviewer pass over `overnight14/next` (all eight pieces merged on main). After the fixes below:
`npm run lint` is clean, `npm test` has 2,540 passing and `npm run e2e` passes (one round, about 34 s).

## Bugs found and fixed

1. **`api/csp-report.js` was an open pipe into Sentry** (commit 91090f1). Anyone could POST to it,
   with no limit. Each POST passed up to 10 reports on to Sentry's security endpoint, and every
   field went through at any length, made-up keys included. A script could spend the Sentry quota
   or fill Issues with junk, and with no DSN set it could flood the function log the same way.
   - Each report now counts against `LIMITS.cspReport` in `src/lib/rate-limit.js`: 20 a minute per
     IP, then 100 an hour for everyone. It uses the same memory layer and shared Supabase counter
     as the other endpoints.
   - Reports over the limit are dropped. The answer is still 204, so browsers don't retry.
   - A body whose `Content-Length` is over 64 KB is never read.
   - Only the standard report fields go on, each cut to 2,048 characters. Non-text values other
     than numbers are dropped.
   - Tests are in `src/lib/csp-report.test.js`. If real reports ever hit 100 an hour, raise
     `LIMITS.cspReport.all`.
2. **The printed results sheet showed private money** (commit 5b85122). `print-sheets.js` printed
   everyone's money, who pays who and the dollar tables, even when someone on the sheet keeps their
   money private (`share.js keepsMoneyPrivate`, the one profile setting). In that case the share
   card keeps every amount off (`amountsRule`), and a sheet on a clubhouse wall is the same kind of
   sharing.
   - `printEvent` now runs the results through `holdPrivateMoney`. Places, scores, headline and
     points stay.
   - The money column reads "–". Tables with dollars in them, who pays who, and lines under a name
     with dollars in them all go.
   - A note says who kept the amounts off.
   - Pairings and cart signs still show the stakes ("On the line"), the same as the share card
     does.
   - Tests are in `src/lib/print-sheets.test.js`.

## Checked and fine

- **Play / NewRound split.** Every moved component and helper is byte-identical to the
  pre-split monolith, apart from the added `export`. Hook bodies and every effect dependency array
  are unchanged, and all state stays in `PlayRound` and `NewRound`. Destructured props match each
  call site, and eslint finds no undefined names. The other branches' edits all landed in the
  split files: the rate limit copy in `CourseStep.jsx`, the Calcutta auction hint and sales
  filter, and the rolling quota line.
  One fragile spot: `NewRound.jsx` spreads `{...setup, ...trip, ...bets}` into the action hooks, so
  a future key clash would silently shadow a value. No key clashes today.
- **Rate limiter vs course search.** A 429 never sets `off`, so search isn't hidden as "not set
  up". `useCourseSearch` retries after Retry-After (at most 120 s). `CourseStep` and
  `HomeCourseSheet` show `LIMITED_COPY`, and a scorecard lookup that gets a 429 says the same in its
  toast. 429s are `no-store`, so the CDN never caches one.
- **Feed brags and Friends list.** Friends' amounts come only from `roundView`'s players, which
  already follow the feed's money rule. A round whose money stays back has no `sideGames` or
  settings (`feed_meta` strips them), so it can't make a big win and its Calcutta bids never
  arrive. In your own rounds, someone else's big win carries no amount. Only you is excluded by
  the server.
- **Calcutta bids on shared rounds.** Bids live in `sideGames[].auction.sales`, which `feed_meta`
  drops when the money stays back. In a points round, bids are points.
- **Hourly cron vs once per plan.** `push_sends` still marks each plan once, under an advisory
  lock. Each zone's clock reads 8 exactly once a day, half-hour zones included. Before the SQL
  runs, the job falls back to `push_tee_due(text)`, in Utah's 8 o'clock hour only. The old daily
  code keeps working after the SQL runs.
- **e2e** asserts through `data-testid="standing"` and `"payment"` on `RoundDetail`, and passes on
  the merged screens.
- **No em dashes** in any added line, `overnight/` notes included. The only `console.log` lines
  are the CSP log fallback, the e2e `E2E_VERBOSE` step log and the roadmap script.

## Security verdicts

- **`supabase/2026-10-20-rate-limits.sql`: OK.**
  - Access: `rate_hit` and `rate_limits_cleanup` are revoked from public, anon and authenticated
    and granted to `service_role` only. Both are `security definer` with `search_path = ''`.
  - The table: RLS is on with no policies and all grants are revoked, so only the service role
    can touch it.
  - Bad arguments return true, but every argument comes from server code, never from a client.
  - Cleanup: the pg_cron job is scheduled by whoever runs the file (postgres in the SQL Editor) and
    only deletes rows, so it needs no superuser. If pg_cron is missing, `rate_hit`'s 1-in-500
    sweep covers cleanup.
  - Fail-open can't be forced by a client. The service key is server-only. Vercel overwrites
    `x-real-ip` and `x-forwarded-for`. A request that times out the shared check after 800 ms
    still meets the memory bucket.
- **`supabase/2026-10-20-push-timezones.sql`: OK.**
  - Who can write: `time_zone` is a column of `push_subscriptions`, which is already covered by
    "own push subscriptions add/change", so a phone writes only its own rows.
  - Validation: a trigger bounds the value to 64 characters and a zone-name shape. A bad value
    falls back to the row's old zone or America/Denver.
  - `push_tee_zones` and `push_tee_due(jsonb)` are service role only.
- **`api/csp-report.js`: OK after fix 1.**
  - What goes out: query strings, hashes and code samples are stripped. Extension reports are
    dropped.
  - Rate limited, with a body cap and a field allowlist.
- **`/api/courses?health=1`: OK.** It answers before the key check, the limiter and any upstream
  call. All it says is `{ ok, configured }`, with `no-store`.
- **`/api/push?health=1`: OK.** GET only, it sends nothing, and all it says is `{ ok, configured }`.
- **`api/join.js` and `api/feedback-notify.js` limiters: OK.** The limiter runs before any
  Supabase read or Resend call.

## CSP (report-only): what could break once enforced

I built the app and checked every inline `<script>` in every built HTML page (rules pages, terms,
privacy, status and index) against the hashes in `vercel.json`. All match, and no page has an
inline handler. Allowed: Supabase REST, auth, storage and realtime (wss), Sentry in all three
ingest regions, PostHog (slim build, `disable_external_dependency_loading`, so no scripts from
PostHog), Google Fonts, jsDelivr icons, the geocoder, the service worker and the manifest. Google
sign-in is a full-page redirect, which CSP doesn't cover. Share images are canvas `data:` and
`blob:`.

Not settled, so check these on the preview with the console open (Report-Only logs each violation):
- **Sign in with Google on a real iPhone.** Make sure no `connect-src` report shows for
  `accounts.google.com` or `*.googleusercontent.com`. Avatars are drawn by the app, but a future
  `avatar_url` from Google would need `img-src`.
- **Push subscribe on iPhone and Android.** The browser talks to the push service itself, not
  the page, so nothing should report.
- **Sentry's `/security/` endpoint itself.** Make sure one test report shows up under Issues.
- **Payments later:** Stripe (`js.stripe.com`, `api.stripe.com`, a frame) is not in the policy.
  It must be added when the paywall is wired.
- **Vercel preview toolbar:** `vercel.live` and Pusher are listed. Feedback screenshots or
  comments in the toolbar could need more hosts. Those reports will come from preview only.

## Concerns not settled (check on the preview)

- **The hourly cron** needs a Vercel Pro team. Hobby rejects more than one run a day. I believe
  the project is on Pro (it had a Turbo build machine). Confirm the first deploy of this branch
  isn't refused.
- **Before `2026-10-20-push-timezones.sql` runs**, each time the app comes back to the front,
  `zoneMoved` sees no saved zone and calls `refreshSubscription`. That is two upserts, the first of
  which fails. It's harmless and stops once the SQL runs, so run that SQL with the ship.
- **CSP report volume:** watch Sentry for a day after shipping. If real violations go over 100 an
  hour, the cap will hide the rest. Raise `LIMITS.cspReport.all` if needed.
