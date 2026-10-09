# Hosting costs: stay on Vercel or move to Cloudflare?

Overnight 12, 2026-10-09. Roadmap area 15, the S3 line "Review hosting costs before launch".

**Short answer: stay on Vercel through the creator test.** The bill is about $20 a month today and
should stay near $20 at the S4 test. At the $10k/mo goal it's roughly $40 to $60 on Vercel against
about $5 on Cloudflare: a real saving, but under 1% of revenue, and the move has one big risk (see
"The catch"). Revisit when the trigger at the bottom fires, or fold it into the rename.

## What runs where today

| Piece | What it is | Where it runs | What it costs us |
|---|---|---|---|
| The app | The built React app (`dist/`, about 3.3 MB, about 1 MB zipped for a first visit) | Vercel's CDN | Requests and data out. Phones keep a copy (the service worker, `public/sw.js`), so a repeat visit only asks for the page, `/version.json` and `sw.js`, plus the changed files after an update |
| Rule pages, terms, roadmap | Plain pages made at build time (`/rules/...`, `/terms`) | Vercel's CDN | Same as the app |
| Link previews | `middleware.js` runs on every visit to `/`. For a chat app's preview bot opening a `?join=`, `?plan=`, `?challenge=` or `?draft=` link, it hands off to `api/join.js`, which reads the round from Supabase and fills in the preview card | Vercel Functions | One small function run per app open (people skip straight through) |
| Course search | `api/courses.js`: proxies GolfCourseAPI so the key stays secret; Vercel's CDN caches answers for a day to a week to save the API quota | Vercel Functions | Tiny |
| Push | `api/push.js`: the app asks for a push (invite, who's in, round done, paid, trash talk); it checks who's asking and sends, with Node's built-in crypto (`src/lib/web-push.js`) | Vercel Functions | Tiny today (push is off until Trevor sets the keys) |
| Tee time reminder | `api/push-tee.js`, run once a day at 15:00 UTC by Vercel Cron (`vercel.json`) | Vercel Cron + Functions | Free |
| Builds | Vercel builds every push to `main`, `overnight*` and `feedback*` that changes code; `scripts/vercel-ignore.sh` skips everything else (docs, SQL, other branches) | Vercel build machines | **This was nearly the whole bill**: about $28 in the September cycle from 724 commits, against about $0.40 of real traffic. The skip script went in on 2026-10-05 |
| Database, sign-in, live scores | Supabase: tables, Google sign-in, realtime, and each phone in a live round also checks every 20 seconds | Supabase (a separate bill) | The same wherever the app is hosted |

## Prices (read on the official pages on 2026-10-09)

- **Vercel Hobby**: free, but "personal, non-commercial use" only, and it can't buy extra usage. Not an option once Birdie Bank charges anyone. ([pricing](https://vercel.com/pricing))
- **Vercel Pro** (what we're on): $20 a month, which comes back as $20 of usage credit. It includes the first CDN tier (1M requests and 1 TB of data a month); the next tiers are $20 (10M requests) and $100 (50M). Functions are about $0.60 per million runs plus CPU time ($0.128 an hour in the US) and memory. Builds about $0.0035 per CPU minute. Cron is included. Each extra team member who can deploy is $20 a month. ([Pro plan](https://vercel.com/docs/plans/pro-plan), [Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn), [functions](https://vercel.com/docs/functions/usage-and-pricing), [builds](https://vercel.com/docs/pricing), [cron](https://vercel.com/docs/cron-jobs/usage-and-pricing))
  - One oddity: the pricing page says Pro includes 10M CDN requests, the docs say 1M. I used 1M to be safe.
- **Cloudflare Workers Free**: static files are free with no limit and no data charge; 100,000 code runs a day; 10 ms of CPU per run; cron included; 3,000 build minutes a month. ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/))
- **Cloudflare Workers Paid**: $5 a month for 10M code runs and 30M CPU ms, then $0.30 per million runs; still no data charge; 6,000 build minutes. Pages is the older product with the same function pricing ([Pages](https://developers.cloudflare.com/pages/functions/pricing/)); a new move would use Workers with static assets.
- **Supabase**: Free pauses a project after a week with nobody using it; Pro is $25 a month with 100,000 monthly users, 250 GB data out and 5M realtime messages included. ([pricing](https://supabase.com/pricing))

## Monthly cost at three sizes

Assumptions, per monthly golfer in season: about 40 app opens (3 requests each, one of them runs the
middleware), about 8 app updates picked up (about 25 changed files and 0.5 MB each), about 25 pushes
and course searches. That's roughly **350 requests, 65 function runs and 5 MB a month**. Builds stay
about where they are now (around 50 to 150 a month, a few cents each).

| | Today (a few test groups, ~30 golfers) | S4 creator test (~2,000 golfers) | $10k/mo goal (~28,000 golfers, ~6,500 rounds on a busy Saturday) |
|---|---|---|---|
| Requests / function runs / data a month | ~10k / ~2k / under 1 GB | ~700k / ~130k / ~10 GB | ~10M / ~1.8M / ~140 GB |
| **Vercel Pro** | **$20** (builds and traffic fit in the credit; it went to ~$28 in September before the skip script) | **$20** (still inside the first CDN tier and the credit) | **~$40 to $60** ($20 plan + $20 CDN tier for 10M requests + a few dollars of functions and builds past the credit). If we land just over 10M requests it's the $100 tier: ~$120 |
| **Cloudflare** | **$0** (Free) | **$0 to $5** (Free fits: ~4k runs a day, ~15k on a Saturday; $5 Paid buys CPU headroom for push) | **$5** (Paid is needed: a busy Saturday is ~390k code runs, over Free's 100k a day; still inside Paid's 10M a month) |
| Difference a month | $20 | $15 to $20 | ~$35 to $55 (up to ~$115 in the worst tier) |
| **Supabase** (either way) | $0 on Free (or $25 if already on Pro) | $25 (Pro: Free's one-week pause is a real risk over the winter, and backups) | ~$35 to $100 (Pro + realtime messages past 5M + likely a bigger database size) |

Supabase will cost more than hosting at every size past today, and doesn't change with this choice.
The 20-second check-in during live rounds is its biggest driver; worth a look before S5.

## What moving would take

About **two to three nights of agent work plus a day of Trevor testing on phones**:

1. **The static site** (easy): a `wrangler.jsonc` with the app as static assets and single-page fallback. The four `vercel.json` rewrites (`/rules`, `/rules/:slug`, `/roadmap`, `/terms`) mostly come free from Cloudflare's `.html` handling; check each one.
2. **`middleware.js`** (small): becomes the front of one Worker that runs only on `/` and calls the join preview code directly. Drops `@vercel/functions`.
3. **`api/join.js`, `api/push.js`, `api/push-tee.js`** (small): already written in the standard `fetch(request)` style, so they mostly move as is. Settings come from Cloudflare's `env` instead of `process.env`, and every secret (VAPID keys, service role key, cron secret, GolfCourseAPI key) gets re-entered.
4. **`api/courses.js`** (medium): written in Vercel's older Node style, so it needs rewriting (about 70 lines), and Cloudflare doesn't cache a Worker's answers on its own, so it needs the Cache API added or every course search spends GolfCourseAPI quota.
5. **The tee time reminder** (small): Vercel Cron becomes a Cloudflare Cron Trigger calling a `scheduled` handler. Cloudflare's cron runs in UTC like Vercel's, so 15:00 UTC stays.
6. **Builds and previews** (medium): Cloudflare Workers Builds has its own branch and path filters to replace `scripts/vercel-ignore.sh`. Preview links get new addresses, so Google sign-in's allowed redirect list in Supabase needs them (preview sign-in already has quirks, see the 2026-10-06 note).

**Risks**

- **The catch: the address.** The app lives at `birdie-bank.vercel.app`, which only Vercel can serve. Moving means a new address, and on a phone everything the app keeps (the saved copy, signed-in state, local rounds and settings) belongs to the old address. Testers who added it to their home screen would have to re-add it and sign in again, and old shared links would break unless the old address forwards. This is the real cost of moving, not the code.
- **Push.** It uses Node's crypto (key exchange, encryption, signing). Cloudflare says it supports all of these with Node compatibility on, but push has to be tested end to end on an iPhone and an Android phone before switching, and the free plan's 10 ms CPU per run may be tight when one push goes to a whole group.
- **Course caching** (point 4): easy to miss, and a missed cache shows up as an API quota problem, not an error.
- **Two dashboards while switching.** Run both side by side for a week, then switch the address.

## Recommendation

**Stay on Vercel Pro for now, and through the S4 test.** The saving is $15 to $20 a month until the
goal, the move risks testers' saved data and links, and the time is better spent on the app.

**Do two cheap things meanwhile:**

- When the new name and domain are picked (the rename is coming anyway, since birdiebank.app is taken),
  point the new domain at Vercel. Moving to our own domain is the step that breaks the address. Once
  we're on our own domain, a later host move is invisible to people, so the hard part is done once.
- Keep setting a spend alert in Vercel (Billing, spend management) at something like $50.

**The trigger to move:** the Vercel bill is **over $60 a month for two months in a row from traffic,
not builds**, or Vercel moves us to the $100 CDN tier, or we add paid teammates who need to deploy
($20 each on Vercel, free on Cloudflare). Any one of those, and we're on our own domain: do the move
over a quiet winter week, not in season.
