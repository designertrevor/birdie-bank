# Overnight 10 brief (2026-10-05 night run, in a cloud session)

Trevor is away for about 5 hours and has not reviewed Overnight 9 yet. He asked to keep building without waiting on that review and to get as far as possible. Nobody will answer questions: make the call, write it down as a decision for the review, keep going.

## Branches
- Repo: github.com/designertrevor/birdie-bank. React + Vite in `src/`, money logic in `src/lib/*.js`, tests `src/lib/*.test.js` (`npm test`), `npm run lint`, `npm run build`.
- Work on `overnight10/next`. It starts at `overnight9/next` (a479449), which is built and waiting for Trevor's review, so Overnight 10 stacks on top of it. Never commit to or push `main`. Never rewrite `overnight9/next`.
- If Trevor's Overnight 9 review later changes something, he will merge it in; keep each task in its own commits so that stays easy.
- One branch per task off `overnight10/next` (`o10/<key>`), merged back into `overnight10/next` only after its tests, lint, build and (for money tasks) the money check pass. Builders do not merge themselves.
- Vercel only builds `main`, `overnight*` and `feedback*` branches, and skips pushes that only touch `*.md` or `supabase/`. Each push is a paid build, so push `overnight10/next` in batches (after a few merges, and at the end), never `o10/*` branches.

## Hard rules
- No em dashes (U+2014) anywhere: code, comments, copy, commit messages, the report. Empty values in tables use an en dash. `npm run lint` checks.
- Builders never edit ROADMAP.md. The lead updates it once at the end, but only the "built, waiting for review" note: do NOT check items off. Items get checked off when Trevor ships.
- Nothing labelled Pro, no trial buttons, no gating. Everything open to everyone (the paywall stays behind `?paywall=on`).
- "Birdie Bank" is a codename that will change. Don't add it to new copy, table names, storage buckets, RPC names or keys.
- Old rounds must produce exactly the same money as before. Add tests that prove it for anything touching money.
- Commit messages: plain sentences that say what changed for the user, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Match the surrounding code: naming, comment density, component style, CSS tokens in src/styles.css (light and dark). New CSS goes in an appended block with a comment header naming the task.
- SQL goes in a NEW dated file `supabase/2026-10-08-<name>.sql`; never edit an earlier file. Idempotent (`if not exists`, `create or replace`, `drop policy if exists`). The app must work fully before it is run (detect a missing table or function and fall back quietly). After `2026-10-06-round-codes.sql` runs, live_rounds, live_holes, round_payments, planned_rounds, plan_rsvps, plan_votes, challenges and challenge_moves are only readable with their code header (x-round-code / x-plan-code / x-challenge-code, see cloud.js): never rely on listing those tables. Realtime on locked tables is data-free broadcast pokes plus a refetch; follow that pattern for anything live.
- No new accounts, API keys, payments or third-party sign-ups. Anything that needs a key (push, analytics) is built so it switches on from an env var and does nothing without it.
- Anything that shows a person's data to others follows the one profile privacy setting (profile-model.js). Never add a per-feature visibility toggle, and don't ask visibility questions in the review.

## Identity, language, design
- "One person": `src/lib/people-links.js` (`linksOf(state).personOf(id)`, `canonicalOf`). `format.js keptId()` already uses it.
- The money screen is "the Tab", the home tab is "Up next". Never "this week" or "next week". Points rounds read in points, reward rounds in the reward.
- Selection uses the shared chip / selectable row look from Overnight 9 (no raw checkboxes). Sections get breathing room, 16px side gutter, avatars centered, light and dark mode, 375px phones first.

## Where to look first
- ROADMAP.md "Current focus" and the area for your task.
- src/lib/round.js, pair-debts.js, ledger.js, settle*.js, people-links.js, moments.js, cloud.js, cloud-model.js, join.js, supabase/schema.sql and the dated SQL files. Screens in src/screens, components in src/components, App.jsx, nav.jsx, styles.css.
- Overnight 9 added: rule pages and branded link landings, the public roadmap (votes, requests, shipped notes), jabs on challenges and settle-ups, Cash App/PayPal/Zelle request links and the 18+ age check, the just-playing seat (nopressure), house rules for all games incl. Quota, the date picker, selection chips. Read them before building near them.

## Tonight's tasks (in this order; at most one money-heavy one)
1. **version**: a new-build check. When a newer build is live, offer a gentle "Update ready" refresh, never mid-round and never forced (see "no forced update" from Overnight 6). Fixes the known Overnight 9 risk that older phones miscount just-playing seats and new house rules until they reload. Small, do first.
2. **whatsnew** (area 20, S4 "What's new" screen): release notes in the app, fed from the shipped notes the public roadmap already has, shown once after an update, and reachable from Settings.
3. **notify** (area 17, S3 "Ask for notification permission at the right moment" and the push items): ask at a moment that earns it (after planning a round or joining one), never on first launch. Build web push end to end (service worker push handler, subscriptions table in a new SQL file, a server function in api/ that sends round invites, who's in, round finished, someone paid you, tee time reminder), switched on only when VAPID env vars exist and silent without them. List the env vars Trevor must add.
4. **legal** (area 14, S3): a terms of service page next to /privacy.html, clearly marked as a draft for legal review, friendly-wagers wording, no app name hard-coded beyond the existing constant. Plus a Help link in Settings (support email placeholder Trevor can change in one place).
5. **halloffame** (area 9, S5 "Group champions and a hall of fame" and "A money list for each crew's season"): each crew's season money list, champions, biggest wins and records, read from existing results (display only, use tabResults/onTab, respect privacy and Show my money). Write tests that the totals match the Tab exactly.
6. **wrapped** (area 9/12, S5 "Year in review" and "Year in review cards sized for Instagram Stories"): a free shareable season card for everyone, money hidden by default like the results image, using the share helper.
7. **trend** (area 9, S5 "Handicap trend from your rounds"): a simple trend from your own rounds next to the official index, labelled as a guide.
8. **polish10**: bug and polish pass on the Overnight 9 screens (trip flow, date picker, roadmap, rules pages, jabs, request links, just-playing): a11y labels, 44px targets, spacing, copy, dark mode, anything that reads wrong.
9. **fieldskins** (the one money-heavy task, only if time is left after 1 to 8 are merged; area 7, S5 "field skins across several groups"): skins across several groups, built on the Big Game machinery. Money check required before merge: old rounds unchanged, an oracle sim, ties and carryovers. If it isn't clean by the end, leave it unmerged on `o10/fieldskins` and say so.
10. **research** (no code, can run in parallel any time): (a) store keyword research for the listing and subtitle (area 13), (b) a list of 50 to 100 golf creators on TikTok, Instagram and YouTube with 10k to 100k followers who film money matches with friends (area 22), with links, follower counts and median views where public. Write both to `overnight/` as markdown. Public info only.

## Checks
- Every task: `npm test`, `npm run lint`, `npm run build` pass before merge. Money-touching tasks: run the money check (old-money diffs zero, new tests) before merge, not after.
- After merging: if a headless browser works in this environment, do a 375px light and dark pass of each new screen and save screenshots under `overnight/o10-shots/`; otherwise say QA was tests and build only.
- Only real money, privacy or security bugs block. Copy and display issues go in the report.

## Usage
- Trevor is close to his weekly limit. Prefer one strong builder per task over many agents, avoid review loops that re-run the same check, and stop starting new tasks when about 4.5 hours have passed. Finished and merged beats half done.

## The report (end of run)
- Push `overnight10/next`. Write `overnight/O10-REPORT.md`: roadmap % at the top (plain count of `- [x]` vs `- [ ]` in ROADMAP.md, before the run and projected if Overnight 9 and 10 both ship, and a size-weighted %), what's built per task, test count, SQL files to run and in what order, env vars to add, the Vercel preview link if you can find it, and every decision as a numbered question with options and your pick marked "Suggested", grouped in batches. If the Artifact tool is available, also publish it as a review queue page (sticky progress bar, numbered batches, tappable answers saved with the db capability, Finish button) and put its link at the top of the report.
- Add a short line to ROADMAP.md "Current focus" that Overnight 10 is built on `overnight10/next` waiting for review (no check-offs).
