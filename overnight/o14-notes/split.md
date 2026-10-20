# Overnight 14: splitting Play.jsx and NewRound.jsx (roadmap area 25)

Branch `o14/split`. A refactor only: no copy, layout, order, animation, state shape, saved-data shape
or URL flag changed. `Play.jsx` (1,604 lines) and `NewRound.jsx` (1,510 lines) are now short
screens that put pieces together, with the pieces in `src/screens/play/` and `src/screens/newround/`.
Two commits: `bff9947` (Play) and `22ece7e` (NewRound). Both default exports and their props are the
same, so `src/App.jsx` and its lazy loading did not change.

## The new file map

### The round in progress

| File | Lines | What's in it |
|---|---|---|
| `src/screens/Play.jsx` | 266 | `Play` (unchanged: leaving a round the keeper finished, Round not found, the moments) and `PlayRound`, which holds the hole's state and puts the pieces below together |
| `play/shared.js` | 50 | What lives outside React: unsaved drafts, the finished and handed sets, the double tap guard, `useNow`, `useWakeLock` |
| `play/useHoleDraft.js` | 70 | The scores and marks being entered: draft, touched, side game marks, `setScore` (the birdie toast, confetti and sound) |
| `play/useHoleCards.js` | 82 | `useFirstTee` (the first-tee rules card) and `useBetPrompt` ("Any side bets on this hole?") |
| `play/useKeeperCard.js` | 67 | Keeping score in a shared round: asking for the card, taking it, handing it over, the toasts |
| `play/useHoleSave.js` | 145 | Save & next hole, auto presses, Finish round, Done fixing scores, End round |
| `play/PlayTop.jsx` | 123 | The header and progress line, the money bar slot, the banners, the hole tile |
| `play/MoneyBar.jsx` | 117 | `MoneyBar` (and its By game sheet) and `CardBar` |
| `play/HolePanels.jsx` | 223 | The main game's panel (Banker, Skins, Wolf, and the shared panels) and the banker's two sheets |
| `play/HoleScores.jsx` | 182 | The scroll: the Calcutta note, the side bet card, the pickers, the score rows, the birdie critter |
| `play/RoundMenu.jsx` | 129 | The round menu and its rows |
| `play/RoundSheets.jsx` | 180 | Round length, A player left, Hand off the card |
| `play/BetsSheets.jsx` | 205 | Side games mid-round, and the Bets sheet |
| `src/lib/play-screen.js` | 53 | Pure: `holeMountKey`, `nextHoleIdx`, `isSameTap`, `ownMoney`, `onTheLine` (+ 81 lines of tests) |

### Setting up a round

| File | Lines | What's in it |
|---|---|---|
| `src/screens/NewRound.jsx` | 193 | `NewRound`: its props, "Play this now", the course editor's history entry, Back and Close, the step bar, which step shows. Still exports `CourseStep` and `QuickAddPlayer` for the Big Game's setup |
| `newround/useSetupState.js` | 138 | `useSetupState` (every kept pick, as before) and `useSetupBets` (side bets plus agreed challenges) |
| `newround/useSetupTrip.js` | 43 | Counting it for a trip, and a team points trip's matches |
| `newround/useSetupActions.js` | 288 | `usePlanActions` (Plan it, save a plan, schedule for later), `useStartRound` (Create round), `useLoadSetup` (last time's setup, a usual) |
| `newround/GameStep.jsx` | 97 | The game step |
| `newround/CourseStep.jsx` | 168 | The course step (and the course editor over it) |
| `newround/PlayersStep.jsx` | 212 | The players step, a player's ⋯ menu, Add a player |
| `newround/SetupStep.jsx` | 174 | The bets step |
| `newround/PlanSteps.jsx` | 150 | Who's invited, and the vote |
| `newround/ReadyStep.jsx` | 82 | Round ready |
| `newround/Pickers.jsx` | 87 | Holes, tee off on, the starting hole sheet, day and tee time |
| `src/lib/setup-screen.js` | 77 | Pure: `withBets`, `listNames`, `nextSaturday`, `nearbyBets`, `planSetup`, `challengeNote`, `dayName`, `teeCount`, `plainHoles` (+ 89 lines of tests) |

## How it was moved

- Components moved whole, by line range, with only `function` turned into `export function`. The
  only edits inside moved code: sheet setters passed in as callbacks (`setLive(true)` became
  `onLive()` in the header, `setMenu(false); setCard(true)` became `onClose(); onCard()` in the menu),
  `planSetup` takes the id maker as an argument (`() => uid('p_')` from setup, as before) so node can
  test it, and the two "drop this round's drafts" loops became one `dropDrafts(id)`.
- Hooks were cut where the old code already had a `// ---` section. Each hook destructures the same
  names the old code used, so the bodies read exactly as before. Hooks that wrote to the store in
  effects still run in the same order (drafts, then the agreed card's changes, then the keeper's).
- `onTheLine` and `ownMoney` lost nothing; `sameTap` is now `isSameTap(last, hole, dirty, now, gap)`
  in the lib, called with the same Map and 800 ms.
- Comments that pointed at `Play.jsx` (styles.css twice, the e2e test once) now point at the new file.

## Left in place, on purpose

- `PlayRound` stays in `Play.jsx`: it's where the hole's state lives and every sheet is mounted, so
  one file still shows what a hole is made of. Its kept sheet flags (`useHole('menu')` and the rest)
  stay together so their names, and so what a reload brings back, are untouched.
- The CTA row (Save & next hole) stays inline in `PlayRound`: 17 lines that only read its state.
- No context: the deepest bundle (`entry`, `prompt`, `card`) goes one level down, so props stay plain.
- `NewRound.jsx`'s step routing and JSX stay as they were, line for line.
- `BigGameSetup.jsx` still imports `CourseStep` and `QuickAddPlayer` from `NewRound.jsx`, which keeps
  every module in its old chunk (importing them from the new files directly would have made a new
  shared chunk between NewRound and BigGameSetup).
- `NewRound.jsx` imports `ReadyStep` first among the steps. That only fixes the order modules sit in
  the shared chunk, which keeps its old name (`PlayFor-*.js`) instead of `round-theme-*.js`.

## How it was proved unchanged

- `npm run lint`: clean, no em dashes. `npm test`: 2,537 pass (2,524 before, plus 13 new tests for the
  two lib files). `npm run e2e` (the full Skins round): passes after each commit.
- Source-scanning tests (`a11y-copy-audit`, `selection-pattern`, `date-pick`) read only top-level
  `screens/*.jsx`, so they would have quietly skipped the new files. They now read `screens/`
  recursively, and the checks that named `Play.jsx` or `NewRound.jsx` name the new file that holds
  that code (the money bar's label, the tee time picker, the files that must use PickRow/PickChip).
- Screenshots: a throwaway script (in the scratchpad, not committed) seeds a phone with Alex and three
  players, then drives headless Chrome at 390 by 844 through 52 points, light and dark (104 shots):
  every setup step, players with handicaps and a player's ⋯ menu, the bets step and More options,
  Round ready, the first-tee card, the side bet card, a hole before and after scoring (pickups,
  bogeys, a double), the round menu top and bottom, Bets, Round length (and 9 holes), A player left
  (and Drew picked), Side games, Handicaps, the scorecard, Save and the next hole with and without the
  toast, back a hole, End round's question, Banker's bets and pick sheet and scores, Wolf and lone
  wolf, planning a Nassau (When, course, Who, invite, Vote), a Wolf setup turned into a plan, Plan it,
  Edit and Save changes, a reschedule from End round, saving a usual, setting up from it and planning
  ahead from it. A pixel compare against `git archive b54e8e4` (the commit before the split, built
  with the same node_modules) found every shot identical except the Round ready crowd art, which
  draws differently from run to run on the same code (the buddy avatars load after the first paint),
  and a 2 pixel blip once on the players step that didn't repeat. The page text matched in all 104.
- Build: the source maps put every module that existed before in the same chunk as before; the new
  files are all in the `Play` and `NewRound` chunks. Chunk list unchanged.

| Chunk | Before | After |
|---|---|---|
| `index-*.js` (first screen entry) | 262.65 kB | 262.67 kB (the build stamp, and the order of the lazy screens' preload lists) |
| First screen JS (entry and its imports) | 415.83 kB | 415.85 kB of the 481 kB budget |
| `Play-*.js` | 148.36 kB | 152.16 kB |
| `NewRound-*.js` | 73.16 kB | 76.64 kB |

Play and NewRound each grew about 3.6 kB minified (about 1.5 kB gzipped): the props and hook
objects passed between the pieces, and the exports Rollup now has to keep between modules. Both
still load only when opened.

## Risks

- Shared rounds weren't screenshot: the keeper banners, asking for the card, seat requests and a
  watching phone need the cloud, which the harness keeps off. That code moved verbatim (into
  `PlayTop.jsx`, `useKeeperCard.js`, `HoleScores.jsx`) and the line check below covers it, but a
  two-phone round on the preview is the real test.
- Not exercised in the browser: a trip's cup matches in setup, "Run it back", a plan's roll call
  ("Change the setup"), the age question at Create round and Junk or pot pickers on a hole. All moved
  verbatim.
- A line-by-line check listed every non-blank line of the old two files that isn't in the new ones:
  only imports, the `function` lines that gained `export`, and the callback edits described above.
- Effects now live in hooks, so within a hole they run in the order the hooks are called. That order
  matches the old one where any two touch the store.
