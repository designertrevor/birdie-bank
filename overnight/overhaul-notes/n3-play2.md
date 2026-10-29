# Night 3, round polish: the audit's play findings still open

Branch `n3/play2` (overhaul/next merged in at bda9789 partway, for the stickers, gaps and polish). Shots
in `overnight/n3-shots/play2/` (untracked), 390 by 844, light and dark: `<state>-before-*` (the branch's
start, fb2e0b0, served from a frozen copy) and `<state>-after-*`, from the audit shot list on the review
seed and its fixed clock. The audit's Vegas round now has its two teams (`scripts/audit-list.mjs`), since
setup always asks for them.

## The should items the coordinator named

- **Settle up** is one card of rows with hairlines (like Who pays who). The payment app is the Tab's
  quiet button (its colour on the name over the quiet surface, no Venmo-blue slab), Mark paid the outline
  button. You're "You" in the rows. Opened from a saved round's results it ends with **Done** (back to
  the results), not Share results.
- **Team podium**: a 2 v 2 stands on two steps, each side's buddies side by side over its name, the
  winners on the taller step in crowns. The eyebrow says Winners, not Top of the table.
- **Reward round**: the results hero leads with the reward ("Sam wins lunch", or for a reward typed as a
  sentence "Sam wins. Loser buys lunch"), no points number or You chip; the points stay in Standings. The
  reward card under it starts at who's buying and carries **Mark it done** (the Tab's own Done mark, with
  Undo), then says "Marked done".
- **Wolf panel** folds to one line once the wolf picks ("Trevor + Jackson v Marcus, Dev", or "alone,
  3×"), with Change to open it again. The partner's row wears a Partner tag like the Wolf's.
- **Vegas**: the rows sit by side under each side's name (A Trevor & Jackson, B Marcus & Dev), each with
  its side's colour down the edge; the panel shows the hole's numbers live from the first look ("So far"
  until every score's tapped) and is a game panel (the card with the game's colour as an edge).
- **Handicaps sheet**: the group's tees once at the top, then one card with a row a player: name,
  strokes, handicap to edit, and the player's tees as one chip that opens their own choice. No pink edge
  on the chips. From 36 chips to 8 for four players.
- **Scroll fades**: the score rows, and every setup step, meet a short fade under the panels or title and
  over Save or Next, only while there's something under it (scroll-driven; no fade on a list that
  doesn't scroll). The polish pass's always-on footer fade stays the fallback.
- **Delete round** in End this round? is a quiet red link under Keep playing (a new `quiet` action in the
  shared ask dialog, ui.jsx), with its own confirm as before.

## Calls for Trevor

1. **The podium is gold, butter and cream everywhere** (Hall of fame and every round's results), not the
   game's colour, so gold always means the winner (history-7). In the dark the lower steps are warm
   greys. The results block keeps the game's wash. Say if you want the game colour back on the steps.
2. **Podium amounts are gone on the results** (play-74): the hero says the winner's, Standings everyone's.
3. **Share's Done lands on the round's results** with History under it (play-31), not the top of History.
4. **Trip page drops the day chips** (trips-28): they read as a second tab bar, and Rounds lists the days.
5. **"Save as our usual"** (was "Save as a usual").
6. **The scorecard's birdies and eagles are ink rings** (one and two), not pink; under-par to-par is ink.
7. Vegas and Hammer keep the head-to-head group's pink as their colour (play-51): changing a group's
   colour moves the game picker and the art too, so it's yours to call.
8. The results image follows the look: Fraunces for the winner, amount and course and Figtree for the rest
   in the new look; the classic look keeps its grotesque (play-21).

## Every finding (owner play, plus the ones handed over)

- history-2: part: on the results you're "You" in Who pays who and Standings (and Settle up). The moment
  line is History's (round-story.js), not a round screen: left for its owner
- history-4: fixed earlier (fix2, en dashes in the hole by hole tables)
- history-7: fixed: one gold, butter and cream podium everywhere, warm greys in the dark (the crown only on
  the podium was the polish pass's)
- history-14: fixed: the results' tables and the scorecard wear the card's hairline; HCP shaded across its row
- history-15: fixed: reactions at the end of each payment row; Where it comes from is one card, sub line
  just the game when there's one
- classic-3: fixed earlier (n3/play: par in ink from the start, both looks)
- setup-1: not fixed: the blank frame is App.jsx's Suspense fallback the first time a lazy screen opens
  (the dev server compiling it; the built app warms every screen at idle). Fixing it is App's nav
  (startTransition, or keeping the old screen as the fallback), not the overview
- setup-2, setup-3, setup-4, setup-5, setup-6, setup-7, setup-11: fixed earlier (fix2, n3/play)
- setup-8: fixed: soft fades on every step; picking a course goes back to the top so Holes and Tee off
  stay whole
- setup-9: part: Pick a course waits disabled like Pick a game. The order stays holes first: Trevor's
  2026-10-14 call (a back-nine round is set before anything else)
- setup-12: fixed: the dark game colour is a straight bar across the top (Round ready, the results
  block, the reveal's head, Run it back), not an inset edge bent round the corners
- setup-13: fixed: a picked player's ⋯ is a chip
- setup-14: part: a line under the count names who's in ("In: you, Jackson, Marcus and Dev"). Picked rows
  stay put rather than jump to the top under a tap
- setup-15: fixed: grid game tiles take the hairline
- setup-17: fixed: "Birdie pot · $5 each"
- setup-18: fixed: each side game's add is the round add button
- setup-19: fixed: a pencil on every bet amount tile
- setup-20: part: the Add a side game line is short ("Junk, a Birdie pot, Snake and more"). The skin
  example stays under its card: for Banker and Nassau one example covers several amount rows
- setup-21: part: "Players" in the Handicaps step is a link to the Players step. Handicaps and Play for
  stay steps on setup's stage (with Done), not sheets
- setup-22: fixed: locked rows stay readable and say what they wait on ("Pick the game first"); Schedule
  for later shows once there's a game
- setup-23: fixed: Or start fresh is a section heading under Run it back
- setup-24: fixed earlier (the polish pass's teal eyebrows)
- setup-26: fixed: None. Straight up. only when there are no rules and no presses
- setup-27: fixed: room under the high five; the segment says "In the leather"
- setup-29: fixed: Look it over has no lede over its Change chips
- setup-30: fixed: Save as our usual
- setup-31: fixed: "Wolf takes exactly 4." under Who's in (a step opens at the top already)
- play-3, play-4, play-6, play-13, play-22, play-23: fixed earlier (fix2, n3/play)
- play-5: fixed: dark Wolf, Banker, Hammer, Snake, Rabbit, Stableford and points panels are the card with
  the game's colour as an edge; Nassau's leading tile is the win colour on its dark wash
- play-7: fixed: the fade under the panels, and a scroll margin so a row scrolled to keeps its name
- play-8: fixed: the Wolf panel folds once picked. Hammer doesn't fold: its buttons are the hole's action
  until it's played
- play-9: fixed: it was the Birdie! toast fading out with its words gone; the toast keeps its words while
  it fades (ui.jsx)
- play-14: fixed: tees once for the group, a row a player
- play-15: fixed: no lone dash beside the stepper; the strokes show once there's a name
- play-16: fixed: rows by side under their names, live numbers in the panel
- play-17: part: the panel's standings are plain text, not chips. The strip keeps its unit (pts) with no
  extra label: there's no room on it, and the panel already says Stableford points
- play-18, play-33: fixed: a right-edge fade while more holes are off to the side, and the hole being
  played starts in view
- play-19: fixed: Delete round is a quiet link after Keep playing
- play-20: fixed: with the money off and scores on, the image says "In order of the Skins result"
- play-21: fixed: the image takes the look's faces
- play-24: fixed: the two-step team podium
- play-25, play-26, play-27: fixed: the reward leads; a sentence reward reads after the winner; Mark it done
- play-28: fixed: the react and comment buttons sit at the end of each payment row
- play-29, play-30: fixed: Settle up is one card, the quiet payment app button
- play-31: fixed: Share's Done opens the round's results over History
- play-32: fixed: stroke play's Standings say each score ("73 (+1)")
- play-34: fixed: the hint balances its lines
- play-35: fixed: "Trevor 1 up" a size down; "From hole 10"
- play-36: fixed: HCP shaded across, en dashes for holes not played, a neutral current column in the dark
- play-37: fixed: "Fix hole 3" is the underlined part
- play-38: fixed: the money sheet shows each hole's money (from roundResults, display only) and has one way out
- play-39: fixed: Bets and Invite are tiles only
- play-40: fixed: every round-menu sheet says No changes yet (the enabled labels say what the save covers)
- play-41: kept: the sheets follow the app's rule (sentence-case section headings, caps eyebrows for labels
  inside a card), which the polish pass set app-wide
- play-44: fixed: the side bets chip and its × are 44px
- play-45: no change: the whole hole line is the Card button (its tap is the full row)
- play-46: fixed: Gets 1 stroke in the body colour with its pink dot, score names and an under-par number in ink
- play-47: fixed: the fade over Save
- play-48: fixed: the Partner tag
- play-49: fixed: the banker's labels and values level; a Back arrow on the bets step
- play-50: fixed: the big amount shows only once a press changes it; a locked Double back reads in the body colour
- play-51: part: the hammer buttons share the row. The pink strip is the game group's colour (call 7)
- play-52: fixed: the Now card is a hairline card; "Jackson's last save: 2 min ago" under it
- play-53: fixed: the live dot's ring is its own colour and stays in the pill
- play-54: fixed: the halfway sheet's names bold over their holes, amounts in the strip's numerals
- play-56: fixed: the pad's key names in the body colour, a touch bigger
- play-57: fixed: no Play for or Side games label under a sheet with that title
- play-58: fixed: the handicap chip has a hairline, not pink
- play-59: fixed: ink birdie and eagle rings, quiet stroke dots, net and to par in ink and body
- play-60: fixed: the HCP row shaded like Par
- play-61: fixed: the key lists only the marks on the card, double or worse too
- play-62: fixed: the winner's ring is cream in the dark
- play-63: not fixed: the crown is being redrawn as a sticker tonight; its seat on the avatar is worth
  tuning once that file lands
- play-64: fixed: no game badge in the reveal's eyebrow
- play-67: fixed earlier (the polish pass's teal eyebrows)
- play-68: fixed: "Off: only the order and the bets, no money"
- play-69: part: "Not great" fits on one line. The three faces' sizes are the art's (face-ok has its tee)
- play-71: fixed: the sub line is the game alone when there's one
- play-72: fixed: Mark paid is the outline button
- play-73: fixed: Done from a saved round's Settle up
- play-74: fixed: no amounts on the results podium (call 2)
- play-75: fixed: "Trevor and Dev" kept together, the title balanced
- play-76: fixed: Standings sits a normal section gap under Roll it on the Tab
- play-77: kept: in-card labels (Skins won, Totals) are caps eyebrows and section headings sentence case,
  the app-wide rule
- play-78: fixed: the reveal's place discs have a hairline ring in the dark
- tab-8: part: no line starts with "· settle after the last round" (a non-breaking space before each
  dot). The +3 was the polish pass's; cents stay as money() writes them app-wide
- trips-8: fixed: the road trip scene at its own shape, the car whole under the header
- trips-23, trips-26: part: a longer, softer fade over Start a trip's pinned button. A row under a pinned
  button at first view is the sheet scrolling, not something padding can end. The Day card was the
  polish pass's
- trips-28: fixed: no day chips on the trip page (call 4)
- trips-29: fixed: an en dash for money before the trip; the tee-off is said once in the note
- trips-30: fixed: an expense's date stays on one line
- trips-31: fixed: the foot's links share one edge
- trips-32: fixed: See the rounds full width, planning again a link under it
- trips-34: fixed earlier (the expense line is a row of the trip card, upnext.css)
- trips-37: fixed: the image's rows share the card's height (up to 124px), so a short list fills it;
  the switch wording was the polish pass's

## Where things moved

- The round menu's Bets and Live/Invite rows: the tiles at its top (the Live code is in the Live sheet).
- The money sheet's Close: its X.
- The trip page's day chips: the Rounds view.
- Podium amounts on the results: the hero and Standings.

## Checked

Every setup, play, history and trips state in the audit list, light and dark, before and after. npm test
(2,689), npm run lint, npm run build and npm run e2e (a full 18-hole Skins round to Settle up, now
reading "You" as Alex) all pass.
