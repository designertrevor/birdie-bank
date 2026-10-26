# Tab and History (overhaul, 2026-10-26 night)

Branch `overhaul/tab`, worktree `.claude/worktrees/oh-tab`. Screenshots (390 by 844, light and dark,
plus `classic-*` in ?look=classic) in `overnight/overhaul-shots/tab/`, untracked.

## The Tab (Layout Lab E, with Trevor's notes)

- A summary card leads: "People still owe you" with the total big, "You owe Jackson $34" under it,
  and a line with the faces and your net ("You're down $14 across 3 people").
- Then two sections, **Owes you** and **You owe**, each with a count and its total. A card per
  person: name, rounds together, amount, and **Paid** and **Roll to next time** side by side at the
  same size and weight (both ink outline). No batch ticks.
- The payment app button (Request / Pay on Venmo) and the reminder bell sit in a quieter row under
  them, then "Paid part of it?".
- A **Square** section: people squared lately (with Undo / Didn't get it), rewards with someone
  square on money ("Square on money"), and "All square with ...".
- Everything else stays: crew and trip tabs (the chips at the top, OneTab unchanged, Close the books
  per crew), trip cards under the summary, the who's square strip, Everyone else / Who owes who,
  How the Tab works, Payments with undo and talk, Close the books, Start a trip, the free promise
  (paywall flag), All square and Nothing owed yet.

### Where things moved

- **The chart and the "Up this season" headline**: off the Tab (Trevor's note). History has the chart;
  Season has its own.
- **Season**: was the "By person / Season" switch at the top. Now the first row of the tools list at
  the bottom of the Tab ("Season: your net over the season, the standings and records"), Pro tag
  with the paywall flag as before. This gives the summary card the top of the screen.
- **Who's square strip**: from above the list to under the two sections (it's context, not the focal point).
- **Where it comes from**: unchanged, on the person screen (tap a person's card).
- **Paid / Roll layout on the person screen**: PersonActions is shared, so the person screen gets
  the same side-by-side Paid and Roll.

## History (A's chart and months, C's round cards)

- Compact range bar: "‹ 2026 ›" (or "Oct 2026") on the left, a small Season / Month / Custom switch
  on the right. The game filter is one scrolling row of small chips.
- Compact chart card: Your net and the round count on one line, the big number, a shorter chart
  (SeasonChart takes an optional `box`, History passes a 104-unit tall one), and the stats link
  inside the card's foot.
- Head to head as a strip of small tiles, then Closed seasons, then the months.
- Each round is a card: the game's art, day and course, the game, who came out on top ("You won",
  "Mike won", "You and Mike tied for the top", "All square", a lunch round's line), your money or
  points, the faces of who played, and the round's best moment when it had one ("Mike takes 4
  skins · Hole 4", from recap.js recapMoments, only moments ranked above an early money lead).
- Your best win of each month (months with 2+ rounds) gets the bigger card on the butter band.
- Recently deleted: a quiet link at the end of History when there's anything in it (it still lives
  in Settings too).
- RoundRow (Up next, Trip, Books) is unchanged on screen; its logic moved to `round-story.js
  roundFacts` so the card and the row read the same.

## Decisions for Trevor

1. **Summary leads with what's owed to you**, even when you owe more overall (E's wireframe). The net
   line under it says "You're down $14". Alternative: lead with whichever side is bigger.
2. **Paid and Roll are both ink-outline buttons**, same size, so neither wins. The Venmo / Cash App
   button below is still in its brand colour, so it's the loudest thing on a card. Say if Paid should
   be filled and Roll outline instead, or the app button quieter.
3. **Roll label shortened** for the part from shared rounds: "Roll $10 to next time" (was "Roll $10
   from your shared rounds to next time"); the sheet still explains the shared part, and the button's
   screen reader label keeps the long words.
4. **Season moved to the tools list** (see above). Easy to put back as a chip at the top.
5. **Big days**: best win of the month. Could be "any win over $X" or the season's top 3 instead.
6. History had **no search** before, so none was added. With cards a month filter or search may be
   worth it later.
7. Moment lines use the round's names ("Trevor takes 4 skins"), as the recap does, not "You take".

## Money check

`src/lib/tab-sections.js` builds the sections from `outstanding()` only (no new money maths);
`src/lib/tab-sections.test.js` sweeps 80 seeded states (random skins, stroke and Nassau rounds,
some points or lunch rounds, some in a seat of your own, random full and part payments) and asserts:
each person's amount equals `tabWith(outstanding())` to the cent and sits on the right side; nobody
is on both sides; everyone with money on the plan is listed; owes-you total minus you-owe total
equals your net, equals the plan's lines with you, and is within 1 cent of `tabBalances` (the plan's
whole-cent rounding); square people are in neither section and owe nothing; every amount is whole
cents; reward-only people (money that isn't dollars) carry no amount; points and lunch rounds move
no section's amounts; paying every line leaves both sections empty. **All pass.**

Paid and Roll: the handlers in `TabCard.jsx PersonActions` are untouched (only the buttons' layout
and the Roll label changed): Paid still calls `markPaid(owed)` with `owed` built the same way and
the same Undo (`undoLastPayment(meId, other)`); Roll still opens the same sheet and calls
`askCarry({ ...shared, by: meId, reason })` with `shared = sharedOwed(state, meId, other)`, shown in
the same cases (`canRoll`); the Tab passes `net={p.net}` and the same `meId`. A source guard test in
`tab-sections.test.js` holds those lines. Nothing written or synced changed.

## Tests changed

- `history.test.js`: the season memo test checked the Tab's chart memo; the Tab no longer draws the
  line, so it now asserts the Tab doesn't call `seasonSeries` (the SEASON_READS check stays).
- New: `tab-sections.test.js`, `round-story.test.js`.

## Not done

- ROADMAP.md lines left for the integration lead (parallel branches would conflict on it).
- The new art isn't in yet: cards use today's GameArt through the existing slot.
