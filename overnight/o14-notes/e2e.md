# Overnight 14: the end to end test (roadmap area 25)

"An end to end test of start a round, score it and settle up, run before each ship."

## What it covers

`e2e/round.e2e.js` drives the real app in Google Chrome at iPhone size (390 by 844), on a browser
profile with nothing saved:

1. **First run.** The welcome, the four onboarding questions (Skins, a foursome, a payment app, me),
   the name step with Friendly wagers only and the age question (money comes up, so it's asked), then
   "I'll do it later" onto Up next. It checks localStorage was empty before the app's code ran.
2. **Setup.** Start a round, Skins (picked from the keyboard, since a click in the middle of the row
   lands on its Rules button), 18 holes, Birch Creek GC, handicaps off, three players added from the
   Add a player sheet. It checks the default bet before creating the round: money, $2 a skin, per skin,
   a last carry goes to nobody.
3. **Scoring.** Skips the first tee card and the "Any side bets?" card, then taps every score in with
   the + and - buttons for all 18 holes (each score box is checked after tapping), saves each hole,
   and closes the halfway sheet at the turn. The scores include birdies, an eagle, ties that carry
   (one carry of three skins), four all-par holes and a tie on 17 and 18 that leaves two skins unclaimed.
4. **Settle up, everywhere it shows.**
   - The reveal: the right winner ("Drew takes it"), each player's skins count, "Nobody claimed them".
   - Settle up (Who pays who): the number of payments, and Alex's pair lines add to Alex's total.
   - The results page: the standings equal the numbers the test works out itself from the Skins
     rules (Drew +$24, Blake $0, Casey -$8, Alex -$16), they add to zero, who pays who matches the
     fewest payments (Alex to Drew $16, Casey to Drew $8), the payments cover each total, and the
     scorecard totals match the strokes entered.
   - History lists the round at Alex's -$16, and the Tab shows "you owe Drew $16" and "Casey owes Drew $8".
5. **No console errors** and no page errors from start to finish.

The expected money is worked out in the test file, apart from `src/lib/round.js`, so a change to
the engine can't quietly agree with itself. A mutation check confirmed it: dropping the carryover in
`skinsTable` makes the test fail.

Source changes: two `data-testid`s in `src/screens/RoundDetail.jsx` (`standing` on each standings
line, `payment` on each money payment row), since those rows have no role or label to find them by.
Everything else is found by role, label and visible text.

## How to run it

```
npm run e2e                 # headless
E2E_HEADED=1 npm run e2e    # watch it in a Chrome window
E2E_SLOWMO=150 npm run e2e  # slow it down
E2E_VERBOSE=1 npm run e2e   # print each stage
E2E_BUILD=1 npm run e2e     # on the production build (Trevor's pick 2C, 2026-10-25)
```

**`E2E_BUILD=1`** runs `vite build` first (into `dist/`, with the same keys blanked and the paywall
off) and serves `dist/` with `vite preview` on the chosen port instead of the dev server, so the
test drives the built chunks, the service worker and the build stamp that phones load. It checks the
page's scripts are the hashed ones from `/assets/` and none of the dev server's. The build takes
about a second here, so a run is about 34 s either way (both passed on 2026-10-25: dev 34.7 s, build
33.8 s). The GitHub Action runs the dev server; use the flag before a ship.

It starts its own Vite dev server on the first free port from 5180 to 5189 (checked on both
127.0.0.1 and ::1, so it never shares one with another worktree's server) and closes it at the end.
It blanks the Supabase, Sentry, PostHog, push and course sample keys and turns the paywall off for its
own server, whatever `.env.local` says, so it never reaches the cloud or anyone's data. It uses
`playwright-core` (a new dev dependency, no browser download) with the Chrome in /Applications; with
no Chrome, set `CHROME_PATH` or run `npx playwright-core install chromium` once. On a failure it saves
a screenshot to `$TMPDIR/birdie-bank-e2e-failure.png` (or to `E2E_SCREENSHOT` when set) and prints the path.

**On GitHub (Trevor's pick 1C, 2026-10-25).** `.github/workflows/e2e.yml` runs it on every pull
request and every push to main: checkout, Node 24 with npm's cache, `npm ci`, `npm run e2e`, with a
15 minute timeout. ubuntu-latest has Google Chrome, which the test finds through the `chrome` channel
(else `CHROME_PATH`, `CHROME_BIN`, which the runners set, or `google-chrome` in /usr/bin). On a failure
the screenshot is uploaded with the run as the `e2e-failure` artifact. The same steps were run on a
clean copy of the tracked files on the Mac (npm ci, then the test): passed in 36 s. A forced failure
saved the screenshot to `E2E_SCREENSHOT`, and a bad `CHROME_BIN` fell through to the next Chrome.

Added to the README's command list. There is no ship checklist in the repo (searched ROADMAP.md,
overnight/ and the README for one), so nothing else was updated.

## How long it takes

About 34 seconds a run on this Mac, about 22 of them the 18 holes of tapping.

## How flaky-safe it is

- 5 runs in a row passed (33.5 s to 35.5 s), then 2 copies at the same time (each on its own
  port) passed, then 4 more on the final code (3 of them in a row). 11 of 11.
- No fixed sleeps except one: Save on a hole where nothing was touched within 800 ms of the last save
  is ignored as a double tap (Play.jsx `SAVE_GAP_MS`), so the test waits 900 ms before saving an
  all-par hole. Everything else waits on what's on screen.
- The cards that interrupt scoring (first tee, side bets, halfway) are each expected at a known
  hole and dismissed on purpose, so a change to when they show fails loudly rather than slipping by.
- Full motion is on (not reduced motion), so the reveal's race board is what people see. The
  reveal gets up to 30 seconds.

## What it does not cover

- Only Skins, with no handicaps, one phone, and no side games or side bets.
- Live sharing, accounts, sign-in, sync and the cloud (all switched off for the test).
- The production build only with `E2E_BUILD=1`, and even then the launch-time update swap isn't
  exercised (one build, so nothing newer to swap to).
- Marking a payment paid, Pay buttons, the payment apps, closing the books.
- Only Chrome at one size. No Safari, so not the iOS Safari bars.
- Planning ahead ("Set up your next round" from onboarding) and the paywall.

## Found on the way (not fixed, display only)

The halfway sheet lists skins still carrying at the turn as "Carried over: Nobody claimed them,
2 skins", while the Play screen correctly says hole 10 is worth 3 skins. Mid-round they haven't gone
unclaimed, they're riding. The words come from `revealSteps` in `src/lib/reveal.js` (the
`unclaimed` count from `roundResults` on a round that isn't finished). The money is right.

## Questions for Trevor

1. **Where should it run?**
   - A. By hand: `npm run e2e` before saying ship (as it is now)
   - B. A git pre-push hook, so a push to main runs it first
   - C. A GitHub Action on every pull request and push to main (about a minute, free minutes, no Vercel build minutes)
   - D. In the Vercel build (slower builds, costs build minutes)

   Suggested: **C**, with A still there for a quick check. It runs without anyone remembering.

2. **Dev server or the real build?**
   - A. Dev server only (as now, about 34 s)
   - B. Production build and `vite preview` only (tests the service worker and chunks, about a minute)
   - C. Dev server by default, with `E2E_BUILD=1` for the build before a ship

   Suggested: **C**. Day to day stays quick, and the ship check covers what phones actually load.

3. **Which games next?**
   - A. Skins is enough for now
   - B. Add Nassau with an auto press next (the most money-heavy common game)
   - C. One spec each for Nassau, Wolf and Banker (about 35 s each)
   - D. B, plus handicaps on, so strokes are tested end to end

   Suggested: **D**. Presses and strokes are where money bugs have shown up before.
