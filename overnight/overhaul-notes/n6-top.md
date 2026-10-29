# N6: the final top of the scoring screen

Trevor picked B ("On the page") with A's money row placement: the hole is the header, the money
sits under it and stays pinned, the hole scrolls away. Branch `n6/top`, built on overhaul/next.

## What it looks like now

- **Order, top to bottom:**
  1. "Hole 3" as a Fraunces headline, with "Scorecard" as a quiet underlined link on its line.
  2. Par, HCP and who gets strokes on one line under it.
  3. The money line: names over big amounts, ruled above and below, caret at the end. A tap opens the
     money sheet, as before.
  4. The game's panel, set flat on the page (B's hairline style).
- **Pinning:** the money line is `position: sticky` inside the rows' scroll. The hole headline
  scrolls away and the money line sticks to the top with the page colour behind it, so the rows pass
  under it. A row brought into view stops below it (`scroll-padding-top`).
- **Banker's bets step:** the same top stands alone above the bets list, as B did.
- **Rounds without money:**
  - A card kept with no game gets the new headline, with the card bar still under the header.
  - A Big Game board round gets the new headline, with the board still under the header.
  - Neither has a money line.
- **Live money view (a phone watching):** unchanged, no top over it.

## What changed

- `PlayTop.jsx`:
  - `HoleMeta` (the big number tile) is replaced by `HoleHead` (the headline).
  - `PlayHeader` lost its money strip. It shows only the card bar or the Big Game board.
- `MoneyBar.jsx`: `MoneyBar` (the boxed strip under the header) is replaced by `MoneyLine`. `CardBar` stays.
- `Play.jsx`:
  - The `?top=` switch and the today's-top path are gone.
  - One `holeHead` for every round: `HoleHead`, `MoneyLine`, then `.hole-game` holding the panels.
  - The banker's panel is always split: its bar in the top, its bets list under it.
- `play.css`:
  - The `.hole-line` and `.money-strip` blocks are replaced by `.hole-head` and `.money-line`.
  - The flat panel rules from `top-shared.css` and `top-b.css` now live here as `.screen.play .hole-game`.
    That selector carries the same weight the trial rules had.
  - Win and loss colours for full sun are `--play-win` / `--play-loss` on `.play`.
- Small fixes over B as shot:
  - The underline is on the word "Scorecard" only, not under its icon.
  - The skins price ("$2 a skin") is a plain underlined link. In B it was a filled chip with an
    underline, because two rules collided.
  - A little more room under the panel before the rows.
- `HolePanels.jsx`: the `noSkins` prop is gone (only D and E used it).
- `main.jsx`: the `?top=` / `bb-top` handling is gone. A phone with `bb-top` left in localStorage
  ignores it.
- `look-new.gen.css` was regenerated. It dropped `.screen.play .tp-amt`, since Play no longer uses
  that class.
- e2e reads the hole's par from `.hole-head .hh-meta`. The Scorecard button no longer holds the par.
- `scripts/audit-list.mjs` taps `.money-line` and looks for `.hole-head`.

## Deleted

- All of `src/screens/play/top/`:
  - `TopA.jsx` to `TopE.jsx` and their css.
  - `top-shared.css`, `index.js`, `stakes.js` and `MoneyNums.jsx`.
- `HoleMeta`, `MoneyBar` and their css.
- `review-shots.mjs`: `--top` and `--variants` are gone.
  - `--top-set` now shoots each game in light and dark, plain and scrolled 420px, into
    `overnight/review-shots/top-final/<game>-<theme>[-scrolled].png`.
  - `--games` still narrows it. `topRounds()` stays.

## Shots

- `overnight/review-shots/top-final/` (untracked): Skins, Nassau, Wolf, Banker and Vegas, light and
  dark, plain and scrolled.
- `top-final/alt-money-last/` holds Skins and Nassau (light) with the money line moved under the
  game's panel instead, which is where A had it. That's a two-line swap in `Play.jsx` if Trevor prefers it.

## Left

- The game panels still carry their boxed styles (pastel washes, dark-mode bars) further down
  `play.css` and in the new look. The flat rules override them with `!important`.
  - Now that the flat panel is the only one, a later cleanup could delete those boxed styles and the
    `!important`s.
  - Check first whether the bets list or other screens use the same classes.
- A themed round's colour only shows on the progress line now. The old strip's tint is gone, as in B.
- The header still says "Hole 3 of 18" under the course, so the hole is said twice. n5 suggested
  dropping it from the header. Not done here.
