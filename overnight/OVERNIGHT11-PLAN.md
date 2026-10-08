# Overnight 11 plan (written 2026-10-07 night, not started)

Where things stand: the design pass shipped to main on 2026-10-07 (night) as `1c04aea`, a fast-forward of
`feedback/design2`. The production build at birdie-bank.vercel.app reports that id in `version.json`.
Roadmap: 175 of 276 done (63%). Trevor's branding exercise (`BRAND.md`, the illustration brief
screenshots and a two-line roadmap edit for area 16) is uncommitted in his main checkout at the project
root and is his: do not pull, stash or commit it. Work on a fresh branch from `origin/main`.

Ten items Trevor picked from, none needing him, Mobbin or real rounds, none touching money. Build order:

1. **First-screen bundle under budget.** `index-*.js` is 510 kB against the 481 kB budget (3 kB of it from
   the design pass, the rest from before). Move the art components (`Spot`, `GameArt`, `Scenes`,
   `BuddyArt` where it isn't needed on Up next) and anything else the first screen doesn't paint into lazy
   chunks, measure, and keep whatever already flags the budget. Area 24.
2. **The four screens nobody has seen with data.** Seed a crew with rounds, a reminder pile on Up next
   (two or more reminder cards), a year in review and the heads-up sheet (push isn't configured locally,
   so render it with a stub), then check each at 390 by 844 in light and dark and fix what's off. Area 24.
3. **Trip standings before the first round** say "Tees off Fri" instead of dashes. Area 24.
4. **The four review cleanups** from "Review against main" in `DESIGN2-FEEDBACK.md`: `Scorecard` into
   its own component so the Play chunk stops loading the results chunk (`Moments.jsx` imports it from
   `screens/RoundDetail.jsx`); the art palette (declared in `Spot.jsx`, `GameArt.jsx`, `Scenes.jsx`,
   `BuddyArt.jsx` and `lib/art-manifest.js`) into one file; `HouseRulesFold` (NewRound.jsx) and
   `CardStack` (UpNext.jsx) driven by data instead of reading the rendered DOM; the Tab's season sparkline
   memo (`Ledger.jsx`) keyed on the rounds rather than the whole store.
5. **Free trial on monthly and annual plans**, paywall UI only, behind the paywall flag. Area 11.
6. **The age sheet's "Not now" as the close X**, so it has two buttons. Area 24.
7. **Share the rivalry:** a "You v Mike" card for the group text from the face-to-face header on a
   person's screen, built on the existing share-image code (`lib/shareImage.js`, `profile-card-image.js`).
   Area 24.
8. **Notification settings:** a spot in Settings to pick which pushes you get (trash talk, who's in,
   round finished, payments, tee time). Trevor asked for it 2026-10-07. Area 12.
9. **After sending a request, land on the roadmap**, and the hook that tells a requester when their idea
   ships ("The game you asked for is live"). Area 20, two items.
10. **Oura-style pass on the data screens:** the Tab, Your stats, the handicap trend and Hall of fame,
    with Oura's published screens as the reference (web, not Mobbin). This is a design pass, so it is the
    one Trevor most wants to see before it merges. Area 24.

Not for a night run (need Trevor): Sentry and PostHog (accounts and keys), Stripe, the Slack community,
the head-pro talks, the on-brand art set (his other AI tool), custom SMTP, the name and domain.

## Conventions for the run

- Branch `overnight11/next` from `origin/main`; Vercel builds `overnight*` branches, so the preview is
  the hand-over. Docs-only pushes skip the build.
- Every entrance gets its exit (Trevor's rule, 2026-10-07): sheets slide back down (`useExitGhost` in
  `ui.jsx` does it for free), screens go through `Stage.jsx`, a dismissed card folds. Exits run
  `--duration-fast` with `--ease-in`.
- Never an em dash (U+2014); `npm run lint` fails on one. An empty value uses an en dash.
- `npm run lint`, `npm test` (2,219 pass today), `npm run build` before each commit. Commit messages in
  the repo's style: one plain paragraph, ending with the Co-Authored-By line.
- Report as a review queue (progress bar, numbered batches, links, answers saved), as with overnights
  9 and 10. Check items off in `ROADMAP.md` with the date only when they merge to main; until then the
  area 24 and other lines read "(partial) Built on `overnight11/next`".
- One money-touching feature a night at most; none of the ten touch money.
