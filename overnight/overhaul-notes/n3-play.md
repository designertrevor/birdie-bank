# Night 3: the round and trips (Trevor's review notes 5 to 9)

Branch `n3/play`, from overhaul/next at 4a420cb. Shots in `overnight/n3-shots/play/` (untracked), 390 by
844, light and dark: `<state>-before-*` and `<state>-after-*`, from the audit shot list
(`scripts/audit-shots.mjs`) on the review seed and its fixed clock. "Before" is 4a420cb served from a
scratch copy, so both sides are the same seed and taps.

## Trevor's notes

5. **Round ready: no oval behind the crew.** The crowd drawing stands straight on the page; the art
   fixers' sticker border is what keeps the white flat cap and the black brim readable now. The crew
   keeps its spot and spacing, so the title and card don't move.
6. **Podium: square feet.** Each step's bottom corners are 0px (top stays 16px), so the steps sit
   flush on the foot of the results block. One rule (`.pod-step` in styles.css), so it's the same on
   results, Hall of fame and anywhere else `Podium` shows. The reveal has no podium (race rows), and
   the share card doesn't draw one; the printed sheet's steps were already square.
7. **Scorecard key: no drawings.** The birdie and eagle critters are off the key under the scorecard
   (the marks and words stay). They still pop up beside a score the moment someone makes one
   (`ScoreCritter` in HoleScores.jsx). Centring the birdie drawing is the art fixers'.
8. **Par number: ink from the start.** An untouched box's par is the same ink as a tapped score. Who's
   still to tap stays readable without colour: the Par chip is outlined (not filled) until someone taps
   it, and the score's name ("Birdie", "Bogey") only shows after a tap. Nothing about saving changed:
   `touched` is still tracked in useHoleDraft and every box saves as shown, untouched ones at par
   (useHoleSave, par-chips.js `holeScores`); only a CSS class came off. The read-only "no score yet"
   dash on a watched hole stays grey (it's not a par).
9. **Trips lead with your place, then your money.**
   - The trip's page: the headline is your place ("You’re 2nd", "You’re tied for 2nd", "You finished
     2nd" once it's over; "on the money" added on a cup trip so it never reads as the cup's place).
     Right under it, a size down in the money's colour, your trip money: "Up $45 on the trip". When
     you're in the trip's expenses, that line is the whole trip, all in ("All in, you’re owed
     $1,035.87"), and the golf alone goes under it, quiet ("Down $63 on the golf"). That also ends the
     audit's two headlines that disagreed (trips-9).
   - The Tab's trip card: its corner leads with your place ("2nd") over the amount and "so far" / "all
     in". The card's spoken label says the place first too.
   - Up next's trip card already led with both, place first ("You’re 2nd, up $12"), so it's unchanged;
     it now gets its place from the same helper (`myTripPlace` in Trips.jsx).

## Calls for Trevor

1. A trip played for points (or a cup trip with no money) still leads with its score ("You’re on +15
   pts", "Red leads 2 to 1"), not a place; the pick was about money trips. Say if points trips should
   lead with a place too.
2. On the Tab card a tie reads "Tied 2nd" in the corner.
3. Hall of fame's podium has no block around it, so its square steps stand on the page about 12px above
   the money list card. Left as is; joining them to the list's top edge would need the list card's top
   corners squared too.

## Checked

Round ready, hole 3 (fresh), the scorecard sheet, results (Oct 21 Banker), Hall of fame, the trip page
during Bandon Boys, the Tab with the trip, Up next with the trip, light and dark in the new look; the
hole and results in the classic look, light and dark. npm test (2,688), npm run lint, npm run build and
npm run e2e (a full 18-hole Skins round to Settle up) all pass.
