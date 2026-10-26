# Round setup and Round ready (overhaul/setup, 2026-10-26 night)

Screenshots: `overnight/overhaul-shots/setup/` (390 by 844, new look light and dark, classic light):
`*-overview-fresh` (no last round), `*-run-it-back` (fresh with the Run it back card), `*-overview-set`
(everything set, handicaps on), `*-step-from-overview` (the Bets step opened from its row, "Done"),
`*-again-loaded` (after Set it up again), `*-ready` (Round ready).

## Round setup: Layout Lab A, summary first

- New round now opens on one overview: a row for each choice (Game, Course with tees, holes, nine and
  starting hole, Players with just playing and teams, Bets and side games with side bets and house rules,
  Handicaps, Playing for), each with Pick / Change / Fix.
- First time through, the steps run in order as before (the step bar is still there): the main button
  says what's next ("Pick a game", "Pick a course"...), and the Bets step's button is "Next: Look it over",
  which lands on the overview. After that a row opens just its step, its button says Done, and Back goes
  straight to the overview. Screens slide in from the overview and back out to it (Stage.jsx).
- Handicaps and Playing for open on their own small screens from their rows (they're still in the
  Players and Bets steps too).
- A change from the overview is fitted the way the steps fit it: a new game keeps the holes unless it
  can't be played over them, and a new game or new players get their teams fitted on the way back
  (setupTeams, the same code the Bets step uses). If the players no longer fit the game (Wolf with 3),
  the Players row says why and Create round waits; teams that don't fit do the same on the Bets row.
- Run it back is the top card on the overview while nothing is set up (the last round you played).
  When that round matches a saved usual it loads through the usual, so "Last played" still moves.
  Run it back from Up next and from a round's page (`rematch`), a saved usual and a plan's roll call
  (`fromPlan`) all land on the overview with everything filled in, or on the step that still needs
  something (a course or a player not on this phone), as before.
- The money: `src/lib/setup-round.js` now holds the round-building code moved unchanged out of
  `useStartRound`. `setup-round.test.js` builds eleven rounds (Skins, 9-hole back-nine gross skins
  starting on 14, Nassau 2 v 2 at 80% with half strokes, two side games and two side bets, Wolf for
  points, Best ball for lunch with a cash side bet, Banker with someone just playing, Stroke play with
  and without handicaps, Match play with side pots, Vegas at 90%, a trip round from a saved usual) and
  compares them field for field with `setup-round.expected.json`. I checked that file against HEAD's
  original code (ab0beca) before changing any screen: identical. Another test proves a game and
  players changed from the overview save the same round as making the same choices in order.

### Where things moved (setup)

- **Create round**: from the bottom of the Bets step to the overview.
- **Schedule for later**: from the Bets step to the overview (still on the Game step and Round ready).
- **Your usual card ("Set it up again")** on the Game step: now the Run it back card on the overview.
  Saved usuals are still listed on the Game step.
- **Counting it for a trip**: still on the Bets step; also on the overview once it's set up.
- Unchanged and still reachable: the Big Game entry and "Tell us how it's played" (Game step), Start a
  trip (Bets step), house rules (Bets step's House rules fold), More options (Bets step), the course
  editor, and every planning path (`ahead`, `edit`, `reschedule`, onboarding). The `ahead` branch and
  `PlanSteps.jsx` are untouched for the plan builder.

## Round ready: Layout Lab A, trimmed, with C's "What we agreed"

- Smaller scene. What's on the line heads the card next to the game art, then Course, Players (Just
  playing, Playing for when they apply) and Handicaps.
- New at the bottom of the card: "What we agreed", the house rules that are on (up to four, from
  `teeRules` in agreed.js), and a line saying gimmes and mulligans get settled on the first tee card,
  which still opens on Tee off (FirstTee.jsx unchanged).
- Kept: Let the group watch live with Invite the group, Tee off, Save as a usual, Schedule for later,
  the "your other round is saved" note.

### Match preview and Lineup

Neither was on Round ready in the app: they were Layout Lab options (E Match preview, D The lineup).
Their content already lives on the Saturday preview (Preview.jsx): its Strokes section is the lineup
(who gets strokes on which holes) and Head to head is the match preview (records between the people
who are in). I didn't add new cards there so the plan builder's branch merges cleanly.

## Decisions for Trevor

1. **The overview opens first, even for a brand new round.** Option A's point is seeing everything at
   once, and Run it back needs a home on top. It costs a first-timer one tap ("Pick a game"). The other
   way: open on the Game step the first time and only show the overview after the Bets step.
2. **One extra tap at the end of the first pass**: Bets step, then the overview, then Create round. I
   kept it because the overview is where you check everything before money is on the line.
3. **Run it back shows only while nothing is set up**, and only the last round (saved usuals stay on the
   Game step). Option D's list of usuals on the overview is a possible next step.
4. **Handicaps and Playing for are their own small screens** from the overview rows, not a jump into
   the Players or Bets step. Per-player handicaps and tees stay on Players.
5. **Round ready's "What we agreed" is read-only.** C's faces ticking in as each person agrees would
   need everyone's phone at the tee; the first tee card already locks it in on the keeper's phone.

## Not done

- No Run it back card on Up next beyond the existing "Run it back" button there (Up next is another
  builder's screen).
- No new cards on the Saturday preview (see above).
