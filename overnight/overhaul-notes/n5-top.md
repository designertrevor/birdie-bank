# N5: the top of the scoring screen, five ways

Trevor asked for other ways to lay out the top of Play: the money totals, the hole line with Card,
and the worth card. They read as cluttered and hard to take in at a glance. These are five working
layouts in the real Play screen, on branch `n5/top`, built on overhaul/next.

## Try them

- `?top=a`, `?top=b`, `?top=c`, `?top=d` or `?top=e` picks one. The phone keeps it in localStorage
  `bb-top`, the same way `?look=` works.
- `?top=current` goes back to today's top.
- With nothing set, Play is today's layout, unchanged. The e2e runs that way.
- A card kept with no game, a Big Game board and the live money view always keep today's top.

## Where the code is

- `src/screens/play/top/`: `TopA.jsx` to `TopE.jsx`, one file each, each with its own `top-x.css`.
  To delete the four that lose, remove their files and their lines in `top/index.js`.
- Shared pieces:
  - `top-shared.css`: the "flat" game panel and the money numerals.
  - `stakes.js`: the "what's riding" words D and E use.
  - `MoneyNums.jsx`.
- Changes to today's code, so the variants could share it (no visible change):
  - `MoneyBar.jsx` now gets its numbers and sheet from `useMoneyStrip.jsx`.
  - `HoleByHole.jsx` moved into its own file.
  - `strokesHere` and `skinsWorth` moved to `hole-info.js`.
  - `HolePanels` takes `bankerPart` and `noSkins`.
- How Play places a variant: it can export any of three parts.
  - `Header` replaces the header.
  - `Pinned` sits under the header and stays put.
  - `Head` rides at the top of the hole's scroll.
- In every variant the banker's bets list stays under the top, as today.

## Shots

- Folder: `overnight/review-shots/top/`.
  - File names: `<variant>-<game>-<theme>.png`, plus `-scrolled` for the same screen scrolled down 420px.
  - Variants: current, a to e. Games: skins, nassau, wolf, banker, vegas. Themes: light and dark.
  - 120 files in all.
- How to make them again: `node scripts/review-shots.mjs --base http://127.0.0.1:5197/ --top-set`.
  - `--variants` and `--games` narrow it.
  - `--top x` sets `bb-top` for the ordinary shots.
- The rounds come from `topRounds()` in `scripts/review-seed.js`. It adds rounds without touching the
  seeded ones:
  - Nassau 2 v 2 on the 7th, with a press and Skins and Junk as side games. This is the busiest top.
  - Wolf on the 5th, before the pick.
  - Banker on the 4th, on the bets step.
  - Vegas on the 4th.
- Skins on the 3rd is the seed's own round.

## The five

### A. One card

- **Idea:** The hole, what it's worth and everyone's money sit in one card, read top to bottom: the hole,
  the bet, then where it stands. One container replaces three stacked bands of different weights.
- **Pinned:** The card scrolls up with the rows until only its money row is left, and that row stays
  pinned at the top. It is a sticky card lifted by its own height less the money row. The money never
  leaves the screen, and the hole and game details get out of the way.
- **Busiest game (Nassau with a press and side games):**
  - The card holds the sides line, the three tiles as hairline columns (no coloured slabs), the press
    line and the coral Press alert.
  - That makes it about 350px tall before it collapses.
  - With only four rows, the hole can't scroll far enough to collapse the card all the way. Skins
    shows this.

### B. On the page

- **Idea:** No cards at all.
  - The money is a line of names over big amounts, with a hairline under it.
  - The hole is a Fraunces headline ("Hole 3") with "Scorecard" as a quiet link beside it.
  - Par, HCP and strokes sit on one line under it.
  - The game's panel is set flat on the page under one hairline.
- **Pinned:** The money line, as today. The hole and the game's part scroll away.
- **Busiest game:**
  - Nassau's tiles become three text columns split by hairlines, with the leader's score in the win colour.
  - The press line becomes plain text with its chip.
  - Only the Press alert keeps a fill, since it's the thing to tap.
  - Wolf's chips and Banker's Change keep a surface fill so they still read as buttons.

### C. The header is the hole

- **Idea:** The screen's header says the hole instead of the course: "Hole 3 of 18", with "Par 4 · HCP 1"
  under it and Card beside the menu. The money sits in the same full-width band, with the progress line
  as the band's bottom edge.
  - Today "Hole 3" is said twice, in the header and in the hole line. Here it is said once.
  - The course and the games move to a small teal label over the game's panel, with who gets strokes
    under it.
- **Pinned:** The whole band, hole and money together, about 120px. The game's panel, as today's
  cards, scrolls away.
- **Busiest game:** The band stays the same height for every game. Nassau's panel is today's panel
  under the label, so all of its clutter is still there, just lower down.

### D. Scoreboard

- **Idea:** A two-cell scoreboard, like a sports score header.
  - On the left, the hole: a big number, par and HCP, strokes, and a Card chip.
  - On the right, what's riding, in one big number or name: "$6", "3 bets", "Trevor" (the wolf),
    "$10" on the line, or "$1" a point.
  - Under it, the money as a ranked leaderboard: leader first, a place number by each name (ties share
    a place), and the leader's number in ink.
- **Pinned:** The scoreboard and the leaderboard, about 150px. The game's details (Nassau's tiles, the
  wolf's pick, skins won) scroll away.
- **Busiest game:** The riding cell says "3 bets", with "Front 9 · Total · 1 press · $5 each" on two
  lines under it. Today's Nassau panel follows below. Tapping the riding cell on Skins opens Bets to
  change the price.

### E. Say it plainly

- **Idea:** The top is sentences:
  - "Hole 3, par 4." is the headline.
  - The next line says what's riding: "1 skin, $6 riding.", "Front 9, total and a press are live, $5
    each.", "Trevor is the wolf, $2 a point.", "Dev is the bank, $10 on the line."
  - A quiet line gives HCP and who gets a stroke.
  - The money is one line grouped by total: "Dev +$12   Trevor, Jackson and Marcus −$4".
- **Pinned:** All of it: the sentences and the money line. The game's panel scrolls away.
- **Busiest game:** This is the tallest pinned area. On Nassau the stake sentence wraps to two lines and
  so does the money, about 200px in all. Skins won and the price to change it sit as one quiet line
  above the rows.

## Every variant keeps today's behaviour

I checked each one in the browser on Skins, Wolf, Banker, Nassau and Vegas:

- Tapping the money opens the money sheet, with hole by hole.
- Card opens the scorecard.
- The skins price opens Bets.
- Picking the wolf's partner folds the pick to one line.
- The Banker bets step shows the bets list, and "Bets are in" brings back the rows.
- Strokes show on every hole.
- Side games stay where they are today, in the rows (Junk chips) and in the money sheet's by-game
  table.
- Trip Mode doesn't render in this area, so nothing changed there.

No variant adds an entrance animation. The only motion is today's pop when an amount changes.

## Seen in the shots

- Vegas's mint slab with low-contrast "So far" in the dark is today's panel. It shows in current, C, D
  and E. The flat versions in A and B fix it with body-coloured labels.
- A themed round's money strip colour (Vegas pink today) isn't carried into A to E. The progress line
  still carries it.

## My recommendation: B, "On the page"

It does the most about "cluttered and hard to read at a glance" for the least risk:

- **No competing boxes.** The three bands of different weights (tinted money strip, hole line, lilac
  worth card) become type and two hairlines. The eye lands on "Hole 3", then the bet, then the rows.
- **Breathing room.** The focal point, the hole, gets generous room, and the secondary pieces move down
  under one label. That matches the breathing-room rule.
- **Pinning doesn't change.** The money stays put exactly as it does today, so nothing new needs testing
  on the course.
- **Every game reads well flat.** Even the busy Nassau looks calmer with hairline columns than with
  three pastel slabs. The flat rules live in one shared file.

I'd borrow two ideas from the others:

- D's ranked money order (leader first) is a cheap win on B's money line.
- C's "Hole 3 of 18" could replace the header's "Skins · Hole 3 of 18", so the hole isn't said twice.

A is the runner-up if Trevor wants a single container. Its money-row pinning is nice, but the Nassau
card gets very tall.
