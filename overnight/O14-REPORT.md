# Overnight 14 report

Built the night of 2026-10-20 on `overnight14/next` from main `47e25cb`. Not on main. The review queue with screenshots and your questions is the artifact linked in chat; this file is the written record.

## What this run was

The roadmap items that needed nothing from Trevor: no name, no accounts, no partners, no product call. Seven builders ran in parallel in their own worktrees, each merged into the branch with tests, lint and the new end to end test green, then the Play and NewRound split ran on the merged result, then a merged-diff review with security checks and a QA pass with screenshots.

Roadmap: 214 of 313 on main (68.4%, weighted 75.6%). 215 now with the PostHog funnel checked off. 225 of 313 (71.9%, weighted 77.4%) when this ships.

## Built

1. **End to end test** (area 25). `npm run e2e` drives the installed Chrome at 390 by 844 through onboarding, an 18-hole Skins round for four, every score, the reveal, Settle up, the results, History and the Tab. It checks the standings and payments against its own Skins sum and that they add to zero, and any console error fails it. About 35 seconds. It passed after every merge tonight. Files: `e2e/round.e2e.js`, `playwright-core` in devDependencies. Note: `overnight/o14-notes/e2e.md`.
2. **Rate limits** (area 25). `src/lib/rate-limit.js`: a token bucket per IP in each function, then a shared Supabase counter `rate_hit` (service role only, fails open). Course search 30 a minute per IP plus an hourly ceiling of an eighth of the GolfCourseAPI daily quota; join previews 60 a minute per IP; feedback emails 20 an hour; CSP reports 20 a minute per IP and 100 an hour. Over the limit answers 429 with Retry-After, and the course picker, Home course sheet and Near you say "Lots of course searches just now. Try again in a minute." and retry on their own. SQL: `supabase/2026-10-20-rate-limits.sql`. Note: `ratelimit.md`.
3. **Tee time reminders in each person's time zone** (area 25). The phone saves its IANA zone with its push subscription and again when it changes. The cron in `vercel.json` runs hourly and `push_tee_due` sends at 8 in each organizer's own morning (newest phone's zone), once per plan as before. `src/lib/push-zones.js` with 11 tests. SQL: `supabase/2026-10-20-push-timezones.sql`. Note: `tz.md`.
4. **Calcutta and Rolling quota** (area 5). Calcutta is a side game beside any main game: `src/lib/calcutta.js`, `src/components/AuctionSheet.jsx` (lazy). One lot at a time, chips or typed whole dollars, buy yourself, 70/30 with 4 or more sold and all to first below, house rules for 60/30/10 and buy-backs, ties share, a mid-round joiner is never in the pot, bids live on the side game entry so Run it back never carries them. Its own `byGame.calcutta` line, pairs and transfers through `roundResults`. Rolling quota is the renamed "Quota moves after the round" rule with a cap (3 by default) and "Your quota is 38, up 2 from last time" at setup; `/?play=rolling-quota`. Money review: 198,000 pot cases and 16,800 full rounds to zero, one bug fixed (see Fixed in review). Note: `games.md`.
5. **Friends list and feed brags** (area 9). `src/lib/friends-list.js`, `src/lib/feed-brags.js`. A Feed | Friends toggle on the Friends screen; Played with lists everyone across your crews; Suggested lists friends of friends from rounds that reached your feed, accounts only. Brags in Lately: hole in one, eagle, 3 or more birdies, birdies in 3 straight rounds, a big win ($20 or 10 points), a lone or blind Wolf beating the pack, a Nassau sweep, 3 hammered holes in a row; 2 per round, 12 in all, 7 days. Hidden money never shows an amount. No SQL. Note: `social.md`.
6. **Printable sheets** (area 10). `src/screens/Print.jsx` (lazy), `src/lib/print-sheets.js`. From a trip, a Big Game and a finished round's share sheet: pairings, cart signs (one per cart) and a results sheet on Letter pages from the same helpers the app uses. On iPhone, Print opens Save to PDF. Note: `print.md`.
7. **Status page** (area 25). `public/status.html` at `/status`: five checks from the phone (the app, Supabase REST and Auth, `/api/courses?health=1`, `/api/push?health=1`), a dot and ms each, "All systems normal" or what is down, follows the theme. Linked from Settings under Help; the uptime workflow checks it too. Note: `status.md`.
8. **Content security policy, report-only** (area 25). `Content-Security-Policy-Report-Only` in `vercel.json` covering Supabase (https and wss), Sentry, PostHog, fonts, icons, the geocoder, the service worker, the manifest and data and blob images. The two inline scripts are allowed by hash; styles still allow inline. Reports go to `api/csp-report.js`, which forwards to Sentry. Flip to enforced after a week of clean reports. Note: `status.md`.
9. **The Play and NewRound split** (area 25). `Play.jsx` is 266 lines (was 1,604) with twelve pieces in `src/screens/play/`; `NewRound.jsx` is 193 (was 1,510) with ten in `src/screens/newround/`; pure helpers in `src/lib/play-screen.js` and `setup-screen.js` with tests. 104 before and after screenshots match; the e2e test passed after every step; the reviewer diffed the moved code function by function and found it byte-identical. Note: `split.md`.
10. **PostHog funnel** (area 15) checked off: built in PostHog 2026-10-20 (funnel vT7RN9gn).

## Fixed in review

- Calcutta ties in money games: rounding to cents broke real ties, so a three-way tie paid one owner $70 and the other two $15. Ties now compare before rounding. Test: "money review: players who won the same in a money game tie, even when the cents split them".
- `api/csp-report.js` took unlimited posts of any size and forwarded each to Sentry. Now rate limited, never reads a body over 64 KB, trims every field, drops over-limit reports with a quiet 204.
- The printed results sheet showed everyone's money and who pays who even when someone keeps their money private. It now follows the share card's rule.

Security verdicts (`review.md`): both SQL files and every endpoint OK. `rate_hit`, its cleanup, `push_tee_zones` and `push_tee_due(jsonb)` are service role only; the rate limit table has RLS on; a phone writes only its own zone and the zone is checked; both health modes return only `{ ok, configured }`; every inline script matches a CSP hash.

## Not built

- Sharing reviewed hole fixes across groups (area 6): wants the `app_admins` table that is still on `overnight13/next`.
- Calcutta on one-ball games (Scramble, Alternate shot, Chapman) and Calcutta moments.
- The e2e test covers Skins only.

## Rolled to the next run (copy and display)

- The Halfway sheet says carrying skins were "Nobody claimed them" though they carry on to hole 10 (`revealSteps` in `src/lib/reveal.js`). Money is right.
- Until the time zone SQL runs, each return to the app makes two extra Supabase writes that fail quietly.
- Stripe's hosts will need adding to the CSP when real payments land.

## At ship

1. Merge `overnight14/next` to main (Overnight 13 is separate and still waiting on its own review).
2. Run in Supabase, any order: `supabase/2026-10-20-rate-limits.sql`, `supabase/2026-10-20-push-timezones.sql`.
3. Vercel: `SUPABASE_SERVICE_ROLE_KEY` for Preview too (Production has it), so previews get the shared rate limit layer. The hourly cron needs a plan that allows crons more often than daily; if the deploy refuses the schedule, set it back to `0 15 * * *`.
4. Check off the nine built lines and the split line in `ROADMAP.md` with the date.
5. Watch the CSP console during Google sign-in and push setup on a real iPhone; after a week of clean Sentry reports, rename the header to `Content-Security-Policy`.

## Checks

2,545 tests pass (2,403 before). Lint clean, no em dashes. `npm run e2e` passes in about 34 seconds. First screen 416 kB of 481. Index chunk 262.67 kB (262.65 before). Screenshots: `overnight/o14-shots/` (untracked), QA note `o14-notes/qa.md`.

## How it ran

Seven Opus builders in parallel (about 1.8M subagent tokens), one money reviewer before the games merge, one refactor builder after all merges, one merged-diff reviewer and one QA agent. About 3.6M subagent tokens in all, no fix loops. The 5-hour usage window was checked before each wave.

## QA fixes (after the queue was built)

From `o14-notes/qa.md`: the results sheet for a 4-player 9-hole round now fits one Letter page (the pagination estimate matched a Chrome render); `sw.js` sends the status page's files straight to the network so they never go stale; the first-tee card says "$105 pot · 70/30" once bids exist; print standings use the real minus sign (which also fixes the share card and finale); Quota's house rules summary counts Rolling quota. Left as is: the status page shows green on the dev server (dev has no /api) and the Home course hint has no info icon.
