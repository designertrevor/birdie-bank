# Fix pass 2: Home (Up next, the Tab, History, Players), 2026-10-28 night

Branch `fix2/home`, worktree `.claude/worktrees/fx-home`. Before and after shots at 390 by 844, light
and dark, in `overnight/fix2-shots/home/` (untracked): `<screen>-<before|after>-<theme>.png`, plus
`-full.png` for the whole scroll at 1x. Befores come from an untouched copy of the branch's starting
commit (699b8e3), so they're true befores.

## Trevor's notes

1. **Up next felt busy.** One tinted card at a time: the mint start card when nothing is planned (the
   one next thing), or the Tab tile among the number tiles (1d709c3's intent kept). Everything else is
   white with hairlines and the art carries the colour. Get a round going, Start a trip and Big Game
   are one white card under a "More ways to play" label (rows inside, a hairline between). With a plan,
   "Playing now?" is its own labelled group of buttons on white. Groups open with a label and 30px of
   air; cards inside a group sit 10px apart. The Friends row is white; the trip card lost its pink
   border (the round in progress keeps the only pink edge) and today's chip is ink. Nothing removed.
2. **The Tab's payment app button** is quiet on each person's card: no brand fill, the app's colour on
   its icon and name over the quiet surface (lighter in dark), and it names the app ("Request on
   Venmo", "Pay on Venmo"). Paid and Roll lead. Same on a crew's tab, which also had a filled Venmo
   button beside a black I paid. Sheets keep the filled brand buttons.

## Found in the review and fixed

- Every screen's title is now a real `h1` (shared Header); section labels on Up next, the Tab, the
  person screen and Players are `h2`s.
- The Tab: Everyone else, Payments and a person's story are one card of rows with hairlines instead
  of a stack of cards; "Paid part of it?" and a square card's last line no longer float above an
  empty foot; the tools list has a hairline edge.
- The Tab says when changes haven't reached the group: after 6 seconds waiting for signal, one quiet
  line under the summary ("Not sent yet..."), gone once sent, never shown with payments off.
  Display only (`useTabWaiting` reads the queue's length in tab-sync.js).
- Up next for a new user said "Your first round" twice; the checklist is now "Three steps to get going".
- Players: "New" was on everyone you hadn't played with (16 tags on a 25-person list). It now means
  added in the last two weeks.
- Season: the Best game tile read "+$38" above "Skins"; now Skins, then "+$38 over 2 rounds".
- History in dark mode: the best win of the month was a heavy olive band, often two per screen. It
  keeps the dark card's surface with a soft gold edge. Light mode unchanged.
- 44px targets: the Players money pill, Join a friend's round, How the Tab works.

## Calls I made for Trevor

1. Start a trip and Big Game share one card with Get a round going (rows, not three cards). Easy to split back.
2. The mint start card stays tinted when nothing's planned, since it's the one next thing.
3. History's butter "big day" card is unchanged in light mode (you kept History); only dark changed.
   With 20 rounds two butter cards can share a screen in light too; say if it should go white.
4. "New" on Players = added in the last 14 days and no rounds together.
5. The not-sent note waits 6 seconds so a tap with signal never flashes it.

## Not mine, seen in passing (for the Play fixer)

- Round detail (RoundDetail.jsx): "Who pays who" is a stack of separate cards, each with its own
  reaction row; "Pay or mark paid" and "Roll it on the Tab" wrap to two lines side by side.
- The podium's pastel steps (Podium.jsx) are bright in dark mode on Hall of fame.

## Checks

npm test (2688 pass), npm run lint, npm run build all pass. Money functions untouched; the Tab card
handlers (Paid, Roll, Mark paid) unchanged, `tab-sections.test.js` source guard passes.
