# Night 4, the round screens: the final audit's play findings

Branch `n4/round`. Every finding with owner "play" in `overnight/audit/auditor-6.json` (66) and
`auditor-5.json` (5), fixed or why not. Shots in `overnight/n4-shots/round/` (untracked), 390 by 844,
light and dark, from the audit shot list on the review seed and its fixed clock: `before/` is the audit's
own shots (commit 1db6c49, the branch's start), `after/` the same states on this branch.

## The ones the coordinator named

- **Dark podium**: step 1 is the full gold now, steps 2 and 3 two warm greys a notch apart (#3c3b38,
  #302f2d, no red or yellow in them, so no brown) with a gold hairline on top, so the three read as one
  podium. The light podium keeps gold, butter and cream.
- **Wolf tie**: anyone level with the third step's player shares that step, side by side as on the team
  podium ("Sam & Jackson", T3), so nobody tied into the top three is left off.
- **The reveal's headline**: the settle scroll never goes past the course line over "Marcus takes it",
  the "Tap to skip" line folds away when it ends, and the crowned buddy is a size down, so the headline,
  crown and all four rows sit on one screen (the fourth under the buttons' fade).
- **The crown's border**: `outline={false}` is gone from Podium.jsx's Crown, so the crown takes the art
  fixer's sticker border wherever it's on a buddy.

## Calls for Trevor

1. **The hole line and the game's panel scroll with the score rows** (play-10): only the header and the
   money strip stay put, so once you scroll the rows get the screen. On Banker's bets step they stand
   alone as before.
2. **One game colour a screen** (play-26): in a themed round the game panels (Wolf, Snake, Banker,
   Stableford, the skins worth strip) take the round's wash, the same as the money strip over them. In the
   dark every panel, the strip and the keeper's bar are the card with a straight 3px bar of the colour
   across the top (no bent left edge).
3. **A selected Birdie or Eagle chip is ink** like every other score (play-40); the critter is the cheer.
4. **Who pays who has one talk button a row** (history-12, play-59): reacting is in the sheet it opens.
   The Tab's rows keep both.
5. **"Pay up" is the money-mouth face** 🤑 (history-6): money with wings drew grey and read disabled in the
   dark. Saved reactions keep their key, so old ones show the new face.
6. **The results foot**: Run it back full width, Save as our usual and Edit scores two-up under it.
7. **The halfway scorecard** fits the front nine with an Out column, no sideways scroll.
8. **Stroke dots sit under the number** in every scorecard, so the hole is never in doubt.
9. **The bet amounts in Bets** (setup and the round menu) are cards with the label as an eyebrow and the
   "Win a skin: up $6" line inside. The games with several amounts (Nassau, Banker, Aces) keep their one
   line under the last card.

## Every finding

- setup-3: fixed: the Bets step's summary (and the plan's suggestion card) wears the game's pale wash, as Round ready's card does; the dark keeps the card with its edge on top
- setup-4: fixed: Add a side game and Add a side bet (setup and the round menu) are the round add rows with the ochre plus, their sub line kept
- setup-5: fixed: the Handicaps step (and the round menu's Handicaps sheet) use the Players step's No, play even / Yes control
- setup-8: fixed: a row waiting on the game has no chip at all; its sub line says what it waits on
- setup-9: fixed: the name on its own line, the bet under it, one sentence of how it plays (Rules has the rest), the drawing at 48px
- setup-10: fixed: Schedule for later shows once there's a game
- setup-11: fixed: "2 v 2" and "4 v 4" kept whole with non-breaking spaces
- setup-14: fixed: row values in the body face at 17px 600, balanced
- setup-15: fixed: Courses near me's arrow in ink, unfilled, the pill 44px tall (NearYou, also on the plan's picker)
- setup-16: fixed: the filled star is the brand gold with a hairline ink edge in light
- setup-17: fixed: no PLAY FOR eyebrow on the step, the reward chips 44px (in-round sheet too)
- setup-18: fixed: a centred drawing under the card (the ball on a tee for Handicaps when playing even, the coin stack for Play for); added to ART_USES
- setup-19: not changed: the scroll in that shot is the audit script's `tap`, which scrolls the tapped row to the centre; the app keeps its scroll on a pick
- setup-20: fixed: a picked game, course or player is a 1.5px ink hairline, not a 2px frame
- setup-21: fixed: "$2 default bet" (and "$5 a skin" and the like) kept whole in Run it back's line
- setup-22: fixed: "Start a trip" underlined like Set up a Big Game (Trips.jsx's StartTripLink, one line; the Tab's link too)
- setup-23: fixed: Nassau's tiles wear the card hairline
- play-1: fixed: the strip's deeper red and green are set as the strip's own --loss/--win tokens (the colour rules were losing to the shared ones)
- play-3: fixed: in the dark the wolf's and partner's rows are the card with a gold edge, no butter wash
- play-4: fixed: on the dark panel every pick (Lone wolf too) is a chip on the surface with a hairline
- play-5: fixed: no plate or outline behind the panel art; 36px, beside the panel's two lines and centred on them
- play-6: fixed: in the dark the keeper's bar is the card with a mint bar on top and a mint pencil
- play-7: fixed: Add a player's button pinned to the sheet's foot
- play-8: fixed: 12px between the Players card and Strokes given
- play-10: fixed: the hole line and the game panel scroll with the rows (call 1)
- play-11: fixed: a compact scorecard for Halfway: nine columns, 22px marks and an Out column, no sideways scroll
- play-12: fixed: straight 3px bars across the top (a background, so the corners clip it square) on the dark strip, the dark panels and Vegas's panel; the side rows' edge is a straight background bar too
- play-15: fixed: see the dark podium above (history-4 the same)
- play-16: fixed: see the Wolf tie above
- play-17: fixed: see the reveal above
- play-18: fixed: the cheering buddy, arms and crown, and the game's art, are drawn as die-cut stickers on the share image; the game art a little bigger (art-11 in auditor-4 is the same card; the buddy drawing itself is the art fixer's)
- play-19: fixed: the solo results hero shows your buddy, the score in ink
- play-23: fixed: with two sides on the podium the Standings read T1 and T2 by side
- play-24: fixed: a stroke's dot sits under its number in every scorecard
- play-25: fixed: the current hole is an ink header cell over a surface column, in both themes
- play-26: fixed: the panels take the round's wash (call 2)
- play-33: fixed: the start-hole grid is six columns across the full width
- play-36: fixed: side A's tag is mint in the dark
- play-37: fixed: no per-row A/B tag when the rows sit under their side's name
- play-38: fixed: "This hole: Marcus & Dev +11 · $11 each" and "Match: all square" on their own lines
- play-39: fixed: "No strokes here" has no dot
- play-40: fixed: every selected score chip is ink (call 3)
- play-41: fixed: the side bets prompt's icon in the icon colour, not pink
- play-43: fixed: the label is "HCP", the hint "Stroke index. 1 is the hardest hole"
- play-45: fixed: strokes under the name, tees and handicap chips side by side, a row a player
- play-46: fixed: every bet amount is a card with its label as the eyebrow and its meaning inside (call 9)
- play-47: fixed: Banker's bet cards say "Gets 1 stroke here" for this hole, nothing when none
- play-48: fixed: "Step 1 of 2: bets and doubles"
- play-49: fixed: the example uses the round's own bet ("$2 a skin becomes 2 pts a skin")
- play-50: fixed: the Now card and the Halfway sheet use the strip's numerals (the sans in the new look)
- play-51: fixed: 12px under the progress line
- play-53: fixed: the empty paragraph is gone when you can add; the add card's sub line names the kinds
- play-54: fixed: a link icon on Get the link, the footnote cut to "Send it to your group only."
- play-56: fixed: overlap down to 6px, and every podium face wears the same ring (the card's colour in light, cream in the dark)
- play-57: fixed: a tighter double box, and room before it in the key
- play-58: fixed: the viewer's scorecard row reads "You" (results and the reveal's card); the e2e reads it
- play-59: fixed: one talk button a row with a 44px tap (call 4)
- play-60: fixed: the eyebrow first in every hero, the reward's two sentences a line each
- play-61: fixed: in the dark the reward card is the card with a 4px gold bar; Mark it done the cream button
- play-62: fixed: plain words for nobody owes, and no empty key band when the card has no marks
- play-63: fixed: shown on Share, the feedback card doesn't ask again on the results in the same finish
- play-64: fixed: Mark paid wears the 1px hairline in the new look; the paid count and Where it comes from on the 16px gutter
- play-65: fixed: on the reveal (and Halfway) the name is the strong line, the holes the quiet one
- play-66: fixed: the winner row's crown clears the gold edge; no hairline ring on the gold 1 in the dark
- play-67: fixed: the card centred over the buttons; the second button is "Scorecard"
- play-68: fixed: text-wrap balance on the hero's sub line
- history-4 (auditor-5): fixed with the dark podium
- history-6 (auditor-5): fixed: "Pay up" is 🤑 (call 5)
- history-11 (auditor-5): fixed: the same ring on every podium face, the crown seated onto the head
- history-12 (auditor-5): fixed: one talk button a payment row on the results (the Tab keeps both)
- history-13 (auditor-5): fixed: Run it back full width, Save as our usual and Edit scores two-up (call 6)
- auditor-4: no findings for play.

## For the other fixers

- Art: the crown now takes the default sticker border on the podium and crowned faces (outline={false} removed); it looks right in both themes. The share card's cheering buddy is still the hand-drawn ball (auditor-4 art-11); it now has a sticker edge.
- Trips: StartTripLink in Trips.jsx underlines "Start a trip" (one line changed).

## Checks

npm test (2689 pass), npm run lint, npm run build and npm run e2e pass.
