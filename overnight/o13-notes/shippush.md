# shippush: push a requester when their idea ships (area 12)

## What's built

A daily Vercel cron, `/api/push-ideas` at 17:00 UTC (10am Pacific, two hours after the tee time
reminder). It finds ideas sent in through Suggest something (game, course or feature) that shipped in
the last 14 days and whose sender hasn't been pushed, sends one push per person through the existing
web push code, and stamps each idea `pushed_at` so it never goes twice.

- One idea: "The game you asked for is live" / "Wolf Hammer is ready for your next round."
  Course: "The course you asked for is in" / "Birch Creek is ready to pick for your next round."
  Feature: "The idea you sent in is live" / "Dark mode is in the app now. Thanks for the idea."
  The titles are the same lines as the Up next "It shipped" note (`ASKED_LINE` in roadmap.js, now exported).
- Several on one day for one person: one push ("2 games you asked for are live", "Wolf and Vegas are in the app now.").
- Tapping opens Up next, where the It shipped note is waiting.
- New switch in Settings, Notifications, Which ones: "Your ideas" (on by default), kind `shipped`.
- Protected like push-tee: `Authorization: Bearer <CRON_SECRET>`, 204 and nothing sent until
  CRON_SECRET and the push keys are set, and nothing found until the SQL runs.

An idea counts as shipped when either its feedback row is `roadmap_status = 'shipped'` with
`shipped_on`, or its `roadmap_item` points at a checked ROADMAP.md line (with its date), or at another
idea (`q-…`) that shipped. The cron reads the deployed ROADMAP.md, cuts it to the public list
(roadmap-public.js) and hands the database only shipped public ids, titles and dates.

## Files

- `api/push-ideas.js` (the cron endpoint)
- `src/lib/idea-push.js` + `idea-push.test.js` (which items count, the copy, one push per person)
- `src/lib/push-server.js` (`ideasDue`, `handleIdeas`) + test
- `src/lib/push-events.js` (`shipped` kind, server only), `src/lib/push-prefs.js` (the switch) + test
- `vercel.json` (the cron, and `includeFiles: ROADMAP.md` for the function)
- `supabase/2026-10-12-idea-push.sql`
- `supabase/2026-10-08-push-prefs.sql`: added `'shipped'` to the muted check (that file hasn't run
  yet, so running it alone still lets the new switch save). The new file sets the same check again.

## How to see it

Settings, Notifications, Which ones shows "Your ideas". The push itself needs push set up in Vercel
(VAPID keys, service role key, CRON_SECRET) and the SQL run; then set a test feedback row from your
own account to `roadmap_status = 'shipped'`, `roadmap_title`, `shipped_on = today`, and call
`curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/push-ideas`.

## Decisions for Trevor

1. Window: push only for things shipped in the last **14 days** (picked) vs 45 (the Up next note's
   window) vs no limit. 14 keeps a late first run from pushing old news.
2. Who: **only ideas sent from a signed-in account** (picked; a phone-only idea has no push
   subscription to reach). Voters get no push, only the Up next note (picked), so a push stays personal.
3. No push on: **not stamped** (picked), so if they turn push or the switch on within the 14 days they
   still hear. Tee reminders stamp regardless; this one waits.
4. Several ideas the same day: **one combined push** (picked) vs one each.
5. Time: **17:00 UTC** daily (picked), after the 15:00 tee reminder.
6. Tap opens **Up next** (picked, the It shipped note links on to the roadmap) vs the roadmap directly.

## Heads-up

- `scripts/vercel-ignore.sh` skips a build when only `*.md` changed, and that includes ROADMAP.md.
  So a roadmap-only commit (checking a line off) doesn't redeploy: the public roadmap in the app and
  this push both wait for the next code deploy. Ideas shipped on their own feedback row aren't
  affected. Worth a look if Trevor wants roadmap checks to go live the same day.
- Not tested against a live database (the SQL was written to match push_tee_due's shape).

## SQL / Vercel

- `supabase/2026-10-12-idea-push.sql` needs `2026-10-07-roadmap.sql` (already run). It is safe to
  run before or after `2026-10-08-push-prefs.sql`: the push sends nothing until push_prefs and
  push_subscriptions both exist, so a "Your ideas" switch turned off on a phone is always respected.
- Security check (2026-10-11): the cron answers 401 without the secret; each idea is stamped with
  `pushed_at is null` in the update, so two runs at once (a retried cron) can't both send it.
- Vercel: the cron registers on the next production deploy. Needs `CRON_SECRET` (same as push-tee).
