# Overnight 14: printable sheets (roadmap area 10)

Branch `o14/print`. Not pushed, not merged. Roadmap not edited.

## What was built

A print view with three sheets for a trip, a Big Game or a finished round:

1. **Pairings.** Every group with its tee time or start hole, the players, handicaps when the event uses them, the game and the bets. For a cup, each group's match ("Four-ball: Trevor & Sam v Mike & Dave").
2. **Cart signs.** One page a cart, two names to a cart (a group with an odd number has one cart with one name), the group, "Cart 1 of 2", where it starts and a one-line "On the line".
3. **Results.** The headline, a podium for the top three, the standings, who pays who, then the tables: money by game, the cup and its leaderboard, all in with the expenses, flight boards, and for a Big Game the money by part.

The results never work money out again. They read the same helpers as the screens: `roundResults` / `bigRoundResults` / `tabResults` for a round (the same branches as RoundDetail), `tripStatus` + `tripByGame` for a trip (Settle the trip's `st.plan` lines, plus the cup stake lines marked paid on the trip), and `bigStatus` + `st.plan` for a Big Game. Tests check the sheet against those numbers.

Where the groups come from:
- **Trip:** a Trip Mode schedule's groups when the teams are picked (tee time and course from the round's plan when this phone has it). Otherwise the rounds planned for the trip plus any being played, grouped by day. Otherwise its flights, in groups of up to four.
- **Big Game:** its groups. A started group starts where its card does.
- **Round:** its one group.

When no group has a start yet (flights, a Big Game not started), the screen offers **Where groups start**: Write in (a blank line), Tee times (a first time and 8, 10 or 12 minutes apart) or Shotgun (one time, groups spread around the course).

## How to reach each sheet

- **Trip:** a "Print pairings, cart signs and results" link on the trip's page, above the foot, in every view.
- **Big Game:** the same link on its page, under the groups and boards.
- **Finished round:** Share (header) opens the share sheet, which has "Print the results sheet" under Show scores. It's also on the finale's share step.

Each one opens the Print screen with a Pairings / Cart signs / Results switch. A finished round opens on Results and the others on Pairings. The pages preview at phone width, then "Print the pairings, 2 pages" calls `window.print()`. On iPhone Safari that opens the print options, and Share in there saves a PDF. A line under the button says so. Back is the header arrow.

## What it looks like

- **On screen:** the app's dark or light canvas with white Letter pages stacked down the screen, each with a soft shadow, like a PDF viewer. In dark mode the pages stay white, as paper does.
- **Pairings page:** "PAIRINGS" kicker, the event name big in the display face, then the date and course under a heavy rule. Next comes "On the line" and a handicap note, then a session heading ("Day 1 · Morning four-ball · Fri, Oct 16, 2026 · Pacific Dunes"). Groups are cards two across and up to six a page. Each card has a black hairline border, "Group 1 · Flight A" with the start on the right (or a "Tee time" blank), players with a right-aligned Hcp column, then the match, the bets and who keeps score in small type.
- **Cart sign:** "Group 2" huge at top left, "Cart 1 of 2" on the right, "Hole 7 · 8:10 AM" large under it. Two names in ~67pt bold display type fill the middle (long names step down a size). A ruled box at the bottom holds the match and "ON THE LINE · $20 net pot · Gus v Trevor: $10 match".
- **Results:** a headline ("Bob Diaz wins the day" / "Final results"), a three-step podium (first a solid black block, second and third outlined), and a standings table (Place, Player with a small line under, Score, Money). After that come "Who pays who" rows ("Sam Ray pays Trevor Nielsen $12") and the tables. Long tables split onto the next page with "(continued)".
- **Every page:** the app name small at the bottom left, the event, date and course in the middle, and "Page 1 of 3" (or the print date) on the right. No app chrome on paper: the printed copy is a portal on `<body>`, and `@media print` hides everything else, only while the Print screen is open.

## Files

- `src/lib/print-sheets.js`: pure. Events, groups, carts, starts, results and pagination.
- `src/lib/print-sheets.test.js`: 19 tests.
- `src/screens/Print.jsx` and `src/screens/print.css`: the lazy screen and its CSS, which is its own chunk.
- `src/App.jsx` (route), `src/screens/Trip.jsx`, `src/screens/BigGame.jsx`, `src/components/Finale.jsx` (the links).

Checks: `npm run lint` clean, `npm test` 2422 pass, first screen JS 410.24 kB of 481 kB. Previewed in the browser pane with a seeded trip, round and Big Game, light and dark. The print CSS was checked by applying its rules on screen: app hidden, pages 7.5 in wide. Nothing was printed to a real printer.

## Risks

- **Not tested on a real iPhone or printer.** Safari may add its own margins, so pages are 9.85 in tall (not 10) with overflow hidden. If Safari still spills, a blank page could follow each page. Worth one test print and one Save to PDF from the phone.
- **`window.print()` in the installed home screen app (standalone PWA)** has been flaky on some iOS versions. In Safari itself it works.
- **Pagination is estimated.** Rows are measured in "table rows" calibrated on the preview, with slack. A very long name or a wrapped line could clip at the bottom of a page rather than flow on.
- **Trip pairings with no schedule** come from rounds planned on this phone. A friend's phone may not have every group's plan, so their sheet can show fewer groups. The organizer's phone is the one to print from.
- Cup and flight handicaps show the **index** saved on this phone (blank when unknown), and round and Big Game handicaps show the **course handicap**. The note at the top says which.

## Questions for Trevor

1. **Where should Print live on a round?** (a) In the share sheet only, as now. (b) Also as a header button next to Share. (c) In a ⋯ menu on the results screen. *Suggested: (a)*, since printing a single round is rare and the share sheet is where "get this out of the app" already lives.
2. **Cart signs: one cart a page, or two to a page to cut in half?** (a) One a page (built). (b) Two half-page signs a page, to save paper. (c) A switch on the print screen. *Suggested: (c)* later if anyone asks. Keep (a) for now, since it's bigger to read from a few feet.
3. **Start times when nobody set them:** (a) Leave a blank line by default with a picker (built). (b) Default to tee times from 8:00, 10 minutes apart. (c) Save the pick on the Big Game or trip so every phone prints the same. *Suggested: (c)* once leagues land, and (a) until then.
