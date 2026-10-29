# Night 4: final trips fixer (branch n4/trips), 2026-10-29

Every finding owned by home in the final audit (`overnight/audit/auditor-6.json` in the overhaul
worktree): the trip, Cup, draft and Big Game screens, 53 in all (1 broken, 19 should, 33 polish).
Trips still lead with your place, then your money (REVIEW-2-ANSWERS 9); that's kept as it was.

Shots (untracked): `overnight/n4-shots/trips/before/` is the audit's own set (`audit-shots-4/trips`,
shot from 1db6c49, which is this branch's app code), `overnight/n4-shots/trips/after/trips/` is this
branch, same names, light and dark, from `scripts/audit-shots.mjs --area trips`. The script's Start a
trip shot now taps the template by its new title ("8 players, 2 days").

Money logic untouched: every change is display, copy or CSS.

## Calls I made for Trevor

1. **Settle the trip is Settle up's card.** One card of rows: face, "Dev pays you", the amount, then
   the payee's app as the quiet button ("Request", "Pay on Venmo") and an outline "I got it" / "I paid".
   "To your Venmo" is gone (the button says the app). Everyone else is a second card of one-line rows
   with the outline Mark paid. The cup stake's lines take the same look.
2. **The trip's long explainers moved into folds.** One short line stays; the rest went into "How
   this trip works" at the foot (now a caret fold), a new "How the trip settles" fold on Settle the
   trip, and "How the formats work" under Start a trip's schedule. Nothing was deleted.
3. **Big Game setup wears round setup's look** (the screen has round setup's `setup` class): picked
   players are an ink edge and ink check, the course handicap chip a plain chip, the soft scroll
   edges under the question. Each player leads with their Ball buddy, and their tee is one chip that
   opens the tees sheet (round setup's), not nine chips.
4. **Big Game header**: "New Big Game" while setting one up, "Edit <its name>" after, so it never
   reads "The Big Game" here and "Big Game" on its page.
5. **Start a trip's templates** are titled by size ("8 players, 2 days") under "Start from a Ryder Cup
   weekend", with a plain number tile. A picked template is an ink edge and ink check, not pink (same
   rule as everywhere else this week). Who's going is one card with hairline rows and ink checks.
6. **Handicaps at** shows 100, 90, 85, 80 and Other (opens all nine).
7. **Print with nothing to print** shows the tees drawing and the line; a trip's pairings and cart
   signs offer "Plan the trip's rounds" in place of Print. Added the use to ART_USES.
8. **The trip image** follows the look (Fraunces and Figtree in the new look), as the results image does.
   This is the shared recap, trip and cup card renderer, so the recap and cup images follow too.

## Findings

- trips-1 (broken): the skins rule rows on the Big Game Games step are flush rows with a hairline
  over each (like a side game's options), no card edge, so the text sits in the card's inset. Fixed.
- trips-2: Settle the trip is one card of hairline rows, Settle up's quiet app button and outline
  I got it on one line; Everyone else a second card. Fixed (call 1).
- trips-3: before the trip the eyebrow is "THU TO SUN · NOV 12 TO 15"; Up next's card is
  "BANDON BOYS · THU TO SUN" over "Starts Thu, Nov 12"; Who's going's note only names a planned
  round's tee time, never the trip's first day again. Fixed (`tripWeekdays` in trips.js).
- trips-4: before any round, Who's going is one card of faces and names two by two, no place or
  money columns. Fixed.
- trips-7: Bring the group in, Leaving early? and Done playing? icons are the neutral disc with an
  ink icon, both themes. Fixed.
- trips-8: Add an expense's ticked rows take the ink check (cream in the dark). Fixed.
- trips-9: a non-breaking space before each dot in an expense's line, so a wrap carries the dot with
  the words before it. Fixed (row and the expense's own sheet).
- trips-10: Standings' note one line; Everyone, all in one line; the Expenses foot paragraph gone;
  Settle the trip's foot one line plus a fold; the schedule one line plus a fold; a template one line;
  the Matches empty state one sentence; the trip's hint card shorter. Fixed (call 2).
- trips-11: Print with no groups shows an empty state and no Print button (call 7). Fixed.
- trips-12: in the dark the cup's team tiles and Start a trip's team columns are a 14% wash of the
  team colour on the card; the dot and the numbers carry the colour. Fixed (`--cup-a-bg`, `--cup-b-bg`).
- trips-13: "Each player in skins puts in". Fixed.
- trips-14: Big Game players picked with an ink edge and ink check (call 3). Fixed.
- trips-15: one tee chip a player that opens the tees sheet, the course handicap beside it. Fixed.
- trips-16: Ball buddy at the start of every Big Game player row. Fixed.
- trips-17: the six steps scroll with the ends fading over 16 to 20px, so nothing is sliced. Fixed.
- trips-18: the round setup's scroll fades under the question and over the footer (from `setup`). Fixed.
- trips-19: the group chips are hidden until a group has a hole in, then read "Group 1 · thru 7" /
  "Group 2 · done", all hairlines. Fixed.
- trips-20: a match's edit is an outline icon button like the header's Edit, 44px tap. Fixed.
- trips-22: Mark paid is the outline button, as on Settle up. Fixed.
- trips-23: WHOLE TRIP is teal like the trip's other eyebrows. Fixed.
- trips-24: no empty place or money dashes any more (trips-4 took the columns out). Fixed by trips-4.
- trips-25: `text-wrap: pretty` on the trip's notes and hint cards. Fixed.
- trips-26: the Games table's You row is pink like the other two views; the Trip column is the heavy
  one, in the table's own face. Fixed.
- trips-27: once anyone missed a round, every standings row has the "n of 3 rounds" line, You too. Fixed.
- trips-28: a view's first section label sits as close under the switch as the other views' cards. Fixed.
- trips-29: played rounds end in the caret (a CSS caret on the trip's rows; RoundRow itself is shared
  and untouched). Fixed.
- trips-30: "How this trip works" is a caret fold, the whole row a 44px tap, with even room around
  the foot's hairline. Fixed.
- trips-31: the trip image's meta line stops as short as the title, clear of the ochre dot. Fixed.
- trips-32: the trip image takes the look's faces (call 8). Fixed.
- trips-33: Up next's trip card drops its caret (the card opens the trip, the x hides it), and the
  line to "Paid for something?" is one hairline, not two. Fixed.
- trips-34: **left.** Saturday's card says "SATURDAY, 5 DAYS" (calendar days, countdown.js) while the
  strip says "04d 15h". Both are right in their own terms; changing either is Up next's plan card and
  countdown (UpNextPlans.jsx, countdown.js and its tests), not a trip file. Suggest: when the strip
  shows the same plan, the card's eyebrow drops the count ("SATURDAY · 8:40 AM").
- trips-35: templates titled by size, one plain number tile (call 5). Fixed.
- trips-37: "Draft | By handicap | By flights", equal thirds. Fixed.
- trips-38: team headers read "4 · HCP 14.4 avg" (display only). Fixed.
- trips-40: Add a day spans the Day cards' width. Fixed.
- trips-41: Handicaps at is four chips and Other (call 6). Fixed.
- trips-42: one lead line on Who's going ("For 8: you and 7 friends. Any even number works.", or "All
  8 picked, you included."). Fixed.
- trips-43: Who's going is one card with hairline rows (call 5). Fixed.
- trips-44: Tick / Untick everyone sits on the Split it label's row; the status line under the list. Fixed.
- trips-45: the ink tee chip's dot gets a ring in the chip's text colour (the Big Game no longer uses
  those chips, but they're still in other places). Fixed.
- trips-46: the course handicap chip is a plain chip, as in round setup (from `setup`). Fixed.
- trips-47: Name is an eyebrow like Day and Holes. Fixed.
- trips-48: "New Big Game" / "Edit <name>" (call 4). Fixed.
- trips-49: Balance by handicap is an outline button with the arrows icon (Groups and Teams). Fixed.
- trips-50: Who's in for skins uses the light picked chip (ink edge and check); Keeps score stays ink. Fixed.
- trips-51: the empty Bets step is the add tile and one line under it. Fixed (BetsList `quiet`).
- trips-52: "Waiting on the first hole" until a group has a hole in, and one line in place of the
  board of dashes. Fixed.
- trips-53: before any skin, one note with the pot and the house rules; the "0 skins so far" line
  only once a hole is decided. Fixed.
- trips-54: `text-wrap: balance` on the cup line, "You're on Blue" kept together. Fixed.
- trips-55: shared places read T1, T6. Fixed.
- trips-56: the draft card has the card hairline; the chevron carries it. Fixed.
- trips-57: "Ready to draft?" over the pinned Start the draft. Fixed.
- trips-58: the captains' Link and Pick here are 44px. Fixed.

## Outside my files (small, noted)

- `src/screens/Print.jsx`: the empty state (trips-11). `src/lib/share-cards-image.js`: the trip image
  (trips-31, 32). `src/lib/trips.js`: `tripWeekdays` (trips-3). `src/lib/art-manifest.js`: one use line.
  `src/screens/upnext.css`: the trip card's one divider (trips-33). `scripts/audit-list.mjs`: the tap.
- Not flagged but the same thing: the Big Game's Money view (its Settle the game) takes the same one
  card of rows and outline Mark paid, so all three settle screens match.
