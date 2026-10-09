# Overnight 12 plan (night of 2026-10-09)

Built on top of Overnight 11 (`overnight11/next`, not yet reviewed), on `overnight12/next`, so the two
ship together once Trevor answers both queues. Roadmap before: 175 of 276 on main, 184 if Overnight 11
ships. Every agent runs on Opus 5.5 (Trevor, 2026-10-09: Fable uses the session limits too fast).

Five agents, each in its own worktree from `overnight12/next`, brief in `overnight/O12-BRIEF.md`:

1. **results** (`o12/results`): the full end-of-round scene (buddies racing up the leaderboard as the
   totals land), the winner's buddy reaction on the results image, the game's theme on the reveal and
   the share card.
2. **theme** (`o12/theme`): the game's theme carried into the round (money bar, hole header, big
   moments, Round ready), and the Mobbin second pass on Play and Round ready.
3. **pro** (`o12/pro`): Pro for life for early testers (SQL), the account screen and the cancel screen
   with the group's own numbers (behind the paywall flag), the Mobbin pass on Hall of fame and What's new.
4. **ops** (`o12/ops`): Sentry and PostHog behind env vars, loaded after first paint, a Share usage data
   switch, creator attribution from `?ref=` (SQL).
5. **docs** (`o12/docs`): the Vercel vs Cloudflare hosting review (`overnight/O12-hosting.md`) and
   optional sounds for big moments, off by default.

Setup done by the orchestrator: `src/lib/game-theme.js` (shared by results and theme), and the nine
Overnight 11 roadmap lines put back in the house order (own words first, built note after), which
fixes the public roadmap's titles and vote ids.

Dropped from the list: the terms draft, since Overnight 10 already built `/terms.html`
(`src/lib/terms-page.js`); its roadmap line only needed its note updated.

Money: none of the five changes money maths. The reveal race and the cancel screen read money for
display only, with tests pinning the amounts to `roundResults`.

Merge order: docs, ops, pro, theme, results (each lint, test, build), then a review agent over the
merged diff, browser QA at 390 by 844 light and dark, the report as a review queue, push the branch.
