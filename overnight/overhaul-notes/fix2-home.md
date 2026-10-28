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

## Audit fixes (2026-10-28 night, on 295f610)

Before shots `<screen>-abefore-<theme>.png` (from an untouched copy of 295f610), after shots
`<screen>-aafter-<theme>.png`, in `overnight/fix2-shots/home/` (untracked).

### Shared (ui.jsx, sheets, toasts, look CSS)
- Sheet and confirm titles are h2s; a sheet's title row and X are sticky while it scrolls (play-11).
- Card eyebrows app-wide use a new teal `--eyebrow-ink` instead of pink (Up next cards, the plan
  ticket, trips, recap, reminders, results, round in progress); the sheet close X is neutral.
- Good-news toasts are ink (mint vanished on mint cards); Paid's toast says who paid (tab-11).
- Small talk reactions are 44 wide; off switches have a ~3:1 fill and edge (play-12, trips-1).
- Dark `--pick-tint` is a neutral lift, not maroon, for every picked card or row (onboarding-2).
- Pinned buttons step out while a sheet is up (play-10); a fade above the share buttons (more-5).
- Pushed screens start at 40% opacity, never a blank frame (shared-1); focus rings are 2px ink
  (players-5); the join code's example is faint (home-13); trip and Big Game step bars keep the gutter (trips-5).

### Up next (home-1 to 10, 12, 14 to 22)
- Shorter: the next round, Playing now? (two buttons on the canvas), Heads up (one label for the
  pile), Your golf (or the Tab box before the tiles), the recap, a friend's live round, Lately, More
  ways to play (three equal rows), then **More**, one fold for friends' rounds and the group feed,
  lines for the group text and the last round out. Nothing removed; the More row lists what's inside.
- Colour only from art: cream group-text bubbles, neutral Lately icons, ink binoculars. Callout cards
  have the hairline; the recap's actions fit one line; the live dot is inline with a pink ring;
  two rounds going get a Going now label and only the first is pink; the strip is a card in dark;
  long tile numbers shrink; the checklist doesn't repeat Start a round; the tee art sits inside;
  trip card eyebrow fixed, days labelled as Rounds in plain words, expenses joined to its foot;
  Heads up buttons line up under their words; What's new's button is quiet.

### The Tab (tab-1 to 7)
- Rows in one-card lists no longer notch (the look's own radius won before: tab-1, broken).
- Person cards are three short rows (~180px from ~236): Paid (and Roll), then the app with Paid
  part of it? The reminder bell is on the person screen, which keeps the full set.
- One section heading style; all square for you leads with the high five; square people are rows of
  one card; Season's subtitle scrolls; tool icons align with titles. Source guard test updated for `compact`.

### History, Stats, Hall of fame (history-1, 3, 5 to 8, 11 to 13)
- Ink switch thumb, right-edge fades on sideways rows, no chart for one round, month names in the
  body face, big-day art the same size. Stats: game art on By game rows; empty state has Start a
  round and no second empty card. Hall of fame: the cup leads (crowned face only on the podium),
  You bold not pink, record holders ink, empty crew copy and button.

### Players, trips, Big Game (players-1, 3; trips-3, 6, 10 to 12, 15; more-3)
- New on the three newest adds; money as coloured text with the chevron on every row.
- Settle-up rows lead with I got it / I paid (ink outline), the app quiet; neutral expense icons;
  Big Game status pink only while scoring; Start the groups is ink like Start the trip; the trip
  card's chevron clear of the hide X; a trip's rounds in one card. Player not found for a gone person.

### Left, with reasons
- history-9 Year in review card restyle: it's the share image renderer, a design job of its own.
- history-7 podium palette in dark, history-17, history-16 (status word on tiles), history-18,
  tab-8 to 10, 12 to 14, players-2, 4, 6 to 8, home-11, home-23, classic-1, 2, history-10: polish,
  left for usage (coordinator: broken and should first).
- trips-2: Mark paid already has a 44px target (the shared ::before pad), so nothing to change.
- trips-4, 7, 8, 9, 13, 14 (Big Game skins empty state, dark red team tint, trip hero art crop,
  trip hero leading with the all-in number, draft captain slot, Cup trip hero): not reached. trips-9
  and 14 change which number a trip leads with, a call for Trevor.
- more-4 one not-found layout for every gone screen: spans onboarding, plan and play screens; Person
  now matches the Empty pattern, the rest left for their owners.
- plan-11 (sheet labels are PlanParts' own `.pd-sub-label`) and plan-12 (the Where sheet's selected
  row): plan's markup; not changed to avoid restyling other pickers blind.
