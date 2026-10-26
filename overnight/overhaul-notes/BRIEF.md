# Overhaul builders: shared brief (2026-10-26 night)

Trevor is asleep. Work through to the end without asking; note every call you made for him in your
notes file (`overnight/overhaul-notes/<your-part>.md`). Stop only if truly blocked.

Read first: `overnight/OVERHAUL-KICKOFF.md` (in the main checkout at
`/Users/trevor/Projects/Birdie Bank 2/overnight/OVERHAUL-KICKOFF.md`), your part's section, and
Trevor's picks with his own words in `overnight/overhaul-notes/layout-lab-picks/picks/*.json` and
`overnight/overhaul-notes/plan-picks/picks/*.json`. The wireframes he picked from are in the main
checkout: `overnight/layout-lab.html` (Layout Lab, options A to E per screen) and
`overnight/plan-a-round-simpler.html` (Get a round going). Today's screenshots of each screen:
`overnight/layout-lab-current/` in the main checkout. Read the wireframe for your screens before
building; match the picked option's structure, not its pixels.

## Rules

- Your own git worktree and branch (given in your prompt). Run `npm ci` in it first. Commit there
  in small commits with clear messages ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Never push, never merge to main, never touch other worktrees or the main checkout.
- Never run SQL against Supabase. If you need a schema change, write it to
  `supabase/2026-10-27-<name>.sql` with a header saying what it does, and make the app work
  (with a fallback) before it runs, plus a migration path for data already saved.
- No em dashes (U+2014) anywhere, ever: code, comments, copy, commit messages. En dash for empty values.
  `npm run lint` fails on them.
- Match the surrounding code: its comment density (a short "why" comment per block), naming, idiom.
- Breathing room: each screen's focal point gets generous space. Move secondary stuff down or behind a tap.
- Every entrance has its reverse exit (`src/components/Stage.jsx`, `useExitGhost`).
- Light and dark both. Illustrations already get the cream outline in dark mode.
- Keep every feature that exists today reachable. Restructure, don't delete: if something moves off
  a screen, say where it went in your notes.
- Money logic is not yours to change unless your part says so. Display only.

## The look

The branch has a new look on by default (`<html data-look="new">`), `?look=classic` for today's.
Build new UI with the shared tokens in `src/look.css` so it reads right in both:
`var(--display)` + `font-weight: var(--display-weight)` for headlines, names in big type and money;
`var(--money-weight)` for big numbers; `box-shadow: var(--hair)` for a card's edge (no new shadows);
`border-radius: var(--r-card)` / `var(--r-btn)` / `var(--r-chip)`; `--band-butter`, `--band-mint`,
`--band-lilac`, `--band-peach` for pastel section bands and illustrated cards; `--state-set-*`,
`--state-vote-*`, `--state-not-edge` for Set / Up for a vote / Not yet tags. Existing colour tokens
(`--canvas`, `--card`, `--surface`, `--ink`, `--body`, `--mute`, `--line`, `--pink`, `--pink-fill`,
`--pink-text`, `--teal`, `--mint`, `--ochre`, `--lav`, `--peach`, `--win`, `--loss`) as today.
Pink only on the one thing to tap. Hairlines, not shadows. Smaller radii.

Put your new CSS in your own file next to your screen (for example `src/screens/plan.css`)
imported from your JSX, not at the end of `src/styles.css`, so parallel branches merge cleanly.
Edits to existing rules in `styles.css` are fine when needed; keep them small.

## Art

The new illustrations are being exported tonight by another session (branch `art/round-4`), so
they aren't here yet. Build with today's art through the existing slots (`Spot`, `ArtFile`,
`Scenes`, `GameArt`, `BuddyArt`, ids in `src/lib/art-manifest.js`); a file dropped into
`src/art/<kind>/<id>.svg` later replaces the drawing with no code change. If you place art somewhere
new, add the use to `ART_USES` in `src/lib/art-manifest.js` so the art sheet stays right
(`art-manifest.test.js` checks it).

## Checks before you finish

`npm test`, `npm run lint`, `npm run build` all pass. Run the dev server on your own port
(`npx vite --port <your port> --strictPort`) and look at your screens at 390 by 844 in light and dark,
both looks, with seeded data (`?profile=<name>` gives a clean profile; seed through
`await import('/src/lib/store.js')` and `round.js` `createRound` in the page, or reuse
`scripts/look-shots.mjs` and `overnight/serif-shots/seed-state.json` from
`/Users/trevor/Projects/Birdie Bank 2/.claude/worktrees/serif`). Use headless Chrome
(playwright-core is installed, see `e2e/round.e2e.js` for how it finds Chrome) for screenshots;
save a few to `overnight/overhaul-shots/<your-part>/` (untracked is fine).

## Your final message

Under 300 words: branch and head commit, what you built per screen, where moved features went,
any SQL file, decisions you made for Trevor, anything not done, check results.
