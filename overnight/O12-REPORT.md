# Overnight 12 report (local run on Trevor's Mac, night of 2026-10-09)

**Review queue:** https://claude.ai/artifact/RVL9QrgiBchkmJF67bVpAo (25 decisions in 7 batches; tap answers, they save as you go, then press Finish and say done in chat. Private to you.)

**Roadmap:** 175 of 276 on main (63.4%). 184 (66.7%) if Overnight 11 ships, **194 of 276 (70.3%)** if 11 and 12 ship together. Ten lines from tonight check off when they reach main: the end-of-round scene, the results image, a theme for every game, the Mobbin second pass, Pro for life, the cancel screen, Sentry, PostHog, the hosting review, optional sounds. Two stay partial: the account screen (real plans and receipts wait on Stripe) and attribution (the steps to paying wait on Stripe). Size-weighted (each line weighted 1, 2 or 3 by which third of line lengths it falls in, measured on main): 70.3% now, 72.4% with Overnight 11, 76.3% with both. This differs from the Overnight 11 report's weighted figure because that script wasn't saved; tonight's numbers all use the same method.

**Branch:** `overnight12/next`, branched from `overnight11/next` (Overnight 11 isn't reviewed yet), so the two ship together. Five task branches (`o12/results`, `o12/theme`, `o12/pro`, `o12/ops`, `o12/docs`) built in their own worktrees, every agent on Opus 5.5 (Trevor asked: Fable uses the session limits too fast). Each passed lint, tests and the build before its merge. Nothing touched `main` or Trevor's uncommitted branding work.

**Setup fixes:** `src/lib/game-theme.js` (one place for a game's tint, shared by two agents). The nine Overnight 11 roadmap lines had their built note in front of their own words, which renamed nine public roadmap items and detached their votes; they're back in the house order and the public roadmap test passes again.

**Checks:** 2,273 tests before, 2,351 after, all passing. Lint clean. First screen 379.2 kB of 481 (377.3 before; the ops queues are the difference). Sentry (91 kB) and PostHog (148 kB) are their own chunks, built only when their keys are set. No money maths changed: the race ends exactly on `roundResults` (tested), and the cancel screen reads money for display only, following Show my money.

**Review:** one review agent over the merged diff. No money or security blockers. Four fixes, each committed: usage counts recorded while sharing was off were sent once it came back on; Sentry kept sending session pings after the switch went off; Reset to defaults turned Sounds off; lifetime holders counted as paywall views.

**QA:** the built-in browser at 390 by 844, light and dark, seeded phone (`public/o12-qa.json`, git-excluded, the O11 seed plus two rounds one hole from done). Checked: the skins round in light (progress line, money bar band, Hole tile, leader's cell), the stroke play round in dark (lavender, ring on the leader), the race (player order start, dashes, Adam climbing to first, the crown, totals summing to zero), the share image (ochre band, sticker, crowned buddy cheering, amounts hidden), the podium in dark, Round ready's themed card, Your plan, the trial, the cancel screen, Settings (Sounds, Share usage data), What's new, Hall of fame. Not checked: hearing the sounds, the analytics with real keys, the halfway sheet and moment stickers (needs more holes scored), Match play's pink.

## For Trevor

1. Answer this queue and the Overnight 11 queue, say done, then say ship.
2. After the merge, run in Supabase: `2026-10-08-push-prefs.sql` (Overnight 11, after the push SQL), `2026-10-09-lifetime-pro.sql`, `2026-10-09-attribution.sql`. The lifetime file's top comment has the one line that turns early tester grants off at launch.
3. For data: a Sentry Browser JavaScript project (turn on "Prevent Storing of IP Addresses") and a PostHog US project (turn on "Discard client IP data"). In Vercel, Settings, Environment Variables, add `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` for Production (Preview too if wanted), then redeploy: variables are baked in at build time. Creator links are `https://birdie-bank.vercel.app/?ref=CODE` or a rule page with `?ref=CODE`.
4. Read `overnight/O12-hosting.md` (stay on Vercel; upgrade Supabase to Pro before the creator test).

## Known gaps

- The results image takes about five seconds to draw on a dev server while it renders the buddies; check it on the preview.
- Art files Trevor drops into `src/art` won't draw on the share image yet (an image inside an SVG drawn to canvas doesn't load); handle that when the art set lands.
- iPhone home screen apps keep separate storage from Safari, so a creator code seen in Safari is lost when someone installs to the home screen without signing in first.
- Pro for life is read from the server and cached on the phone; once Pro features are paid, the server has to check `entitlements` itself.
- Erasing everything or restoring a backup from before tonight sets Share usage data back to on.
- `.claude/launch.json` in the main checkout gained `birdie-bank-o12` (port 5177); it stays uncommitted.
