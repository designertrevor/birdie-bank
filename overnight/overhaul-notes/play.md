# Play: scoring a hole, live money, results (overhaul 2026-10-26)

Branch `overhaul/play`. Screenshots in `overnight/overhaul-shots/play/` (untracked), 390 by 844,
both looks (`new-*`, `classic-*`) and both themes: `hole-fresh`, `hole-edit`, `pad`, `wolf`,
`banker`, `live`, `live-hole`, `results`, `results-2` (scrolled).

## Scoring a hole (Layout Lab C, par chips, with A's folding)

- Every box starts at par. Each row: buddy, name, the big number, then six chips: Eagle, Birdie,
  Par, Bogey, Dbl, and +. On a par 3 the two-under chip reads **Ace**.
- **+ opens the number pad sheet** (option E style): the number huge with − and + beside it, a key
  for every score 1 to 15 (the ones near par labelled Ace, Eagle, Birdie, Par, Bogey, Dbl),
  **Picked up**, and **Next: (name)** to walk through the group. Keys set the score straight away,
  so the money strip moves as it goes in. A score off the chips (a 9, a pickup) shows on the + chip.
- **Hole, par and HCP on one line**: big hole number, "Par 4 · HCP 1", who gets strokes under it,
  and a **Card** button. The whole line opens the scorecard (as the tiles did).
- **Money as a thin strip**: one row of names and amounts. Tap it for the full picture in a sheet
  (thru which hole, what this hole moves per player, by game, side bets for money, just playing).
- **Skins' "worth" card folded** to one slim line: Worth 2 skins · $12, the $2 a skin button, and
  skins won so far quiet under it.
- **The side bet ask is a chip** ("Closest to the pin?") with an ×. The chip opens today's card
  (Add a side bet, Not this hole, Not this round, Don't ask again). The × is Not this hole (or Not
  this round when there's no later hole).
- **Readable in the sun**: the scores, hole number and strip amounts use a heavy face in both looks.
  Classic keeps its display face at 800; the new look's serif tops out at 600, so play numbers use
  Figtree 800 there instead of `--money-weight`. A chip set by a tap is solid ink (or pink for
  under par); the untouched default Par is an outline, with the number muted, as before.

### Where things moved
- The **Picked up** button under each name moved into the pad sheet (and the row says "Picked up,
  counts 6", the + chip shows X).
- The − / + steppers moved into the pad sheet.
- The money bar's "this hole" deltas and by-game table moved into the strip's sheet.
- Every game's extras are untouched and stay where they were: Wolf picks, the Banker's bets phase
  and sheets, Hammer, Snake, junk dots, BBB, scramble drives, closest to the pin and long drive pots,
  side bets, the Calcutta note, the keeper hand-off banners. Checked Wolf and Banker in the browser
  (Banker: bets phase, then chips and a pickup through the pad).

### When a hole counts (unchanged)
"Starts at par" is the same display default the stepper had (muted par). Save writes every box as
shown, untouched boxes at par, exactly as before (`holeScores` in `src/lib/par-chips.js`, now used
by `useHoleSave`), and the double-tap guard is unchanged. No change to scoring math, strokes or money.

## Live money (Layout Lab A's race + C's hole by hole)

A phone watching the round (someone else has the card) now opens on the **live money** instead of
the read-only hole:
- the **money race**: one bar per player around zero, best first, big amounts;
- **Now · Hole 8 · Par 3** with what it's worth in Skins (the carry counted), else "Waiting on
  Trevor's card";
- **Scorecard** (the scorecard sheet) and **This hole** (today's read-only hole, which now has a
  **Live money** button back);
- **Hole by hole**: each scored hole as a line, newest first, from the match moments (moments.js)
  and each hole's money (livePreview). Tap a line to open that hole. Pure logic in
  `src/lib/hole-story.js` with tests (the holes' amounts add up to the round's money, every game).
- A friend's round (FriendRound.jsx) gets the same **Hole by hole** list, but only when every
  player's amount shows there (it names amounts, and Show my money must keep working).
- The keeper's own phone is unchanged (the strip plus the scoring screen). The lock screen Live
  Activity stays a native-app roadmap line.

## Results (Layout Lab A, podium then pay)

- The round's results page (RoundDetail) now leads with one block: **Winner**, "Trevor wins the
  day", the amount, the course line, then the **podium** inside it (the big pink slab is gone).
- Then **Who pays who** with Layout Lab A's two buttons: **Pay or mark paid** (opens Settle up, with
  the pay app buttons and Mark paid, and Back returns here) and **Roll to next time** (opens the
  Tab, where rolling over lives).
- Then the standings list, the notes and the save-to-account row, then **Card / Talk / Details**
  with the **scorecard** showing by default, as Trevor asked.
- The reveal after finishing gets a **Scorecard** button once the totals land, opening the card in
  a sheet.

## Decisions for Trevor

1. Play numbers in the new look use Figtree 800, not Fraunces at `--money-weight` (600 reads thin in
   the sun). Say if you'd rather keep the serif there.
2. "Dbl" is the chip's short label (six chips fit one row at 390 wide); screen readers hear "Double".
3. The two-under chip on a par 3 is "Ace"; there's no separate hole-in-one chip on par 4 and 5 (the
   pad's 1 key, labelled Ace).
4. Watching phones default to the live money; the hole is one tap away. Their choice is kept.
5. Roll to next time on the results opens the Tab rather than rolling in place, so there's one
   place that rolls over (the Tab builder owns it).
6. The strip no longer shows "+$4 this hole" under each name (the amounts pop when they change, the
   save toast says what the hole moved, and the strip's sheet has it). Easy to bring back.

## Money checks

- `src/lib/par-chips.test.js`: the old stepper's code copied in as the oracle. Units: chips, pad
  limits, − / + and Picked up behave as the old buttons; untouched players save at par and stay
  untouched; a hole in one through the pad saves a 1; editing a saved hole starts from the saved
  scores. **2,000 seeded random rounds across all 22 games** (9 and 18 holes, handicaps on and off,
  banker bets, wolf picks, marks, auto presses, pickups, aces, big numbers, untouched boxes and
  edits to saved holes): every hole saves exactly what the stepper saved, the same boxes count as
  touched, the same balances and payments, and every round **sums to zero in whole cents** and
  settles everyone exactly. Coverage asserted: over 500 edits, 200 aces, 500 pickups, 5,000
  untouched boxes, money moved in over 1,500 rounds. Runs in about half a second.
- Existing `money.test.js` zero-sum and settle-up checks pass unchanged.
- `npm run e2e` (Skins, 18 holes, now through the chips and an eagle through the pad, the side bet
  chip, then reveal, Settle up, results page and Tab money checks): passed twice.
