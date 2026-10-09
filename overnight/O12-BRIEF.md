# Overnight 12: the brief every task agent reads first

Birdie Bank is a React 19 + Vite web app (installable PWA) for golf groups: it keeps score for side
games (Nassau, Skins, Wolf and 20 more), does the money maths and settles up. Source in `src/`
(`screens/`, `components/`, pure logic in `lib/` with `lib/*.test.js`), serverless functions in
`api/`, link pages in `middleware.js`, SQL in `supabase/`. Product plan: `ROADMAP.md`. Brand brief:
`BRAND.md` may not be in your tree; voice is friendly trash talk among friends, never casino.

## Where you work

- Your own git worktree and branch (named in your task). Work, build and commit only there.
- Never touch `main`, the main checkout at the project root, other worktrees, or push anything.
  The orchestrator merges your branch into `overnight12/next` (which already holds Overnight 11,
  not yet reviewed by Trevor).
- Don't edit `ROADMAP.md` or `.claude/launch.json`; the orchestrator does the roadmap.
- No browser or dev server for you (other agents share the machine's ports). The orchestrator does
  browser QA at 390 by 844 in light and dark after merging, so tell it exactly where to look.

## House rules

- Never an em dash (U+2014) anywhere: UI copy, comments, docs, commit messages. Use a comma, colon,
  period or "so". An empty value in a table or stat is an en dash. `npm run lint` fails on an em dash.
- Plain, friendly copy in golfer talk. Short sentences. Phosphor icons (see existing `<i className="ph...">`
  use), no emoji.
- Motion rule (Trevor): every entrance gets its reverse exit. Sheets get it free from `useExitGhost`
  (in `src/components/ui.jsx`); screens go through `src/components/Stage.jsx`; a dismissed card folds
  its row shut (`useFoldAway` in ui.jsx). Exits use `--duration-fast` and `--ease-in`. Pushed screens
  slide in 12px from the right. Respect `prefers-reduced-motion`.
- Light and dark both: use the CSS tokens in `src/styles.css`, never hard-coded greys.
- First-screen JS budget is 481 kB (it's about 377 kB now; `npm run build` prints it). Don't add to
  the first screen: anything new loads with `import()` or inside an existing lazy screen.
- Money maths never changes tonight. Reading money for display is fine. Amounts on share images stay
  hidden unless Show amounts is on, and a person's privacy setting always wins.
- No Pro labels for testers until launch (Trevor): anything about plans, Pro or paywalls shows only
  with the paywall flag on (`?paywall=on`, see `src/lib/paywall.js`).
- New SQL goes in `supabase/2026-10-09-<name>.sql`: idempotent (`if not exists`, `create or replace`),
  row level security like the existing files, comments saying what it's for and the run order. The
  app must behave exactly as before until Trevor runs it (handle a missing table or column quietly).
- New logic goes in a pure `src/lib/*.js` module with a `*.test.js` next to it.

## Before every commit

`npm run lint`, `npm test` (about 2,278 pass) and `npm run build` all pass, and the build's first
screen line stays under budget. Commit messages follow the repo's style (`git log -5`): one plain
paragraph saying what changed for a person using the app, then a blank line and
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit as you finish each part.

## Your final message (the orchestrator reads it, Trevor doesn't)

1. What you built, part by part, with the main files.
2. Anything you couldn't do or left rough, plainly.
3. Exactly where QA should look: the screen, how to reach it, any `?switch`, what to tap.
4. Two to five open calls for Trevor's review queue: the question, your pick (what you built) and
   one or two alternatives, in plain words.
5. Final test count and first-screen kB.
