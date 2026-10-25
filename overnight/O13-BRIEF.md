# Overnight 13 brief (night of 2026-10-11)

Branch `overnight13/next`, cut from `origin/main` at `d918302` (splash screen). Integration worktree:
`.claude/worktrees/o13-integrate`. Every agent runs on Opus 5.5. Trevor is asleep: make sensible calls,
write each one down in your branch's notes (see "Hand-off" below), and keep going.

## House rules for every builder

- Start with `git checkout -B o13/<key> overnight13/next` in your worktree, so you build on tonight's base.
  If `node_modules` is missing: `ln -s "/Users/trevor/Projects/Birdie Bank 2/node_modules" node_modules`
  (never commit the symlink).
- Never touch the main checkout at `/Users/trevor/Projects/Birdie Bank 2` (Trevor has uncommitted
  branding work there), and never commit, stash or delete anything in it.
- Do not edit `ROADMAP.md`. The lead does it at the end.
- Nothing labelled Pro, gated or "preview" in the default path. Everything Pro-related stays behind the
  paywall flag (`paywallOn()` in `src/lib/paywall.js`, `?paywall=on`). With the flag off the app must
  behave exactly as it does today for testers.
- Lifetime Pro holders (Pro for life, `src/lib/entitlements.js`) count as Pro everywhere.
- "Birdie Bank" is a codename. Don't bake it into anything hard to rename: use the app name helper
  (`src/lib/app-name.js`) in UI copy, and keep it out of codes, SQL names, URLs and identifiers.
- No em dashes (U+2014) anywhere. An empty value in a table or stat uses an en dash.
- Before your last commit: `npm test`, `npm run lint` and `npm run build` all pass, and the first screen
  stays under its size budget (the build prints it; budget 481 kB, it was 379 kB).
- Add tests in `src/lib/*.test.js` (run with `node --test`) for every rule you add.
- Don't use the browser pane; the QA agent checks every screen in the browser after the merge.
- SQL goes in one dated file, `supabase/2026-10-12-<topic>.sql`, idempotent (`if not exists`,
  `create or replace`, `drop policy if exists`), with a comment at the top saying what it's for and what
  it depends on. Trevor runs it by hand. The app must behave as before until it runs.
- Commit with clear messages (no em dashes). End each commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Hand-off

Write `overnight/o13-notes/<key>.md` on your branch: what you built, the files, how to see it (URL and
steps), decisions you made for Trevor (each with the options and your pick), anything left undone, and
any SQL or Vercel steps. Keep it short.

## The tasks

1. **split** (roadmap area 7, money): Split Pro on the Tab. When an organizer gets Pro (the preview
   purchase behind the flag; nothing is charged), offer to split its cost across the group ("$12.50 each
   for your foursome"), with who's in editable. It puts amounts on the Tab owed to the organizer, using the
   Tab's existing money machinery, in exact cents (the shares sum to the price), with Undo. It never
   changes any round's money, never shows with the flag off, and the purchase stays the organizer's own.
2. **records** (area 8): the Record Book limit. With the flag on and no Pro (trial, Pro and Pro for life
   all count as Pro), History and the record views show the last 10 rounds; older rounds are hidden, never
   deleted, with a calm line that Pro brings back the N older rounds. The Tab, settle-up, carry-overs,
   Season money and payments always use every round. With the flag off, testers see everything.
3. **paywall** (area 11): paywall rules. The trial unlocks everything (every Pro feature reads one
   entitlement check that is true during the trial), a visible trial timeline in Your plan and a reminder
   before the trial ends (in-app, plus a push if push is on), never a paywall or upsell pop-up while a round
   is live (a guard every upsell surface goes through, with a test), never a surprise charge (the end date
   and price are always shown before it, and the reminder lands at least 2 days before). Behind the flag.
4. **shippush** (area 12): push a requester when their idea ships ("The game you asked for is live").
   A daily Vercel cron like `api/push-tee.js`, sending through the existing web push code, respecting the
   push preferences, once per request (a sent timestamp). SQL in a dated file. Add the cron to
   `vercel.json`.
5. **digest** (area 20): a weekly feedback digest for Trevor to approve items onto the roadmap, with no
   email (SMTP isn't set up). Pick the simplest delivery that works today. The lead's suggestion: an
   admin-only Digest screen (Trevor's account only, by the same admin check the roadmap tools use, if one
   exists) listing the last 7 days of "Suggest something" feedback and requests grouped by theme, each
   with Approve or Skip; approved items are stored so the next Claude session can add them to ROADMAP.md
   in the right area. Optionally a Monday push to Trevor through the existing push code. Say what you
   picked and why.
6. **qa** (area 20): two-phone QA after everything merges. Runs on `overnight13/next` itself.
7. **pricing** (area 22): price each creator deal, a doc, not code: `overnight/O13-creator-pricing.md`.
8. **brief** (area 22): the two-minute creator brief, a doc: `overnight/O13-creator-brief.md`.
9. **codes** (area 22): a download code for each creator, using the existing `?ref` attribution
   (`src/lib/attribution.js`): `overnight/O13-creator-codes.md`.
10. **area 2 tidy**: the lead does it in ROADMAP.md.
