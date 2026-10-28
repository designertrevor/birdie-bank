# Fix pass 2: onboarding (branch fix2/onb)

Shots: `overnight/fix2-shots/onb/` (untracked). `<step>-before-<theme>` is how it was, `-after-` is now,
`-mid-` is 90ms into a step change, `-one-` is the run with one game picked and `?paywall=on`,
`-classic-` is the classic look, `-small-` is a 375 by 667 phone, `paywall-*` is the paywall top to bottom.

## 1. The art "sucked up into the top left corner"

Cause: on every question the scene was an `<svg>` with `width: auto` in a plain block (`.ob-head`), so the
browser sized it from its height and the 400 by 240 viewBox: 347px wide, pinned left, with 43px of nothing
on the right. The welcome looked right only because its scene was a stretched flex child. The new art
made it worse: the outside drawings have no sky, so the progress bar sat across a head.

Fix: one `StepArt` for every step. A scene is drawn whole (the file's own 1792 by 1024 shape, bottom
aligned) on a card 16px in from each side; a spot is centred in a fixed-height box. Steps now sit on a
`Stage` (each page absolutely placed under a fixed back button and progress bar), so the page leaving
and the page coming in overlap in the same spot: nothing is measured or squeezed mid-move. Checked
every step forward and back, light and dark, mid-move and settled: every drawing is at x 16 or centred.

## 2. Dark mode art

- The scene files leave faces, arms and skies see-through, so in dark every face went black. Scenes now
  sit on a warm cream card in dark (`--ob-art-bg`, `#efe8d8`, the same idea as `.art-plate`); in light
  the card is clear, so it looks as before minus the hard cut edges (rounded corners now).
- The hand-drawn high five lost its arms on dark and its plate cropped the balls. The settle payoff now
  shows the answer you picked: the phone with the pay arrow (payment app), the wallet (cash), the receipt
  (running tab), the just-OK face (mostly don't).
- **For the art fixer** (files, not code): `face-great.svg` reads worried, not great (open mouth,
  raised brows), so I stopped using it on "Good taste"; the scene files' see-through faces and skin
  (`course`, `clubhouse`, `scorecard`) should be filled cream so the card isn't needed; `handshake.svg`
  is note 9's two-finger hand.

## 3. First plan is the Get a round going ask

"Set up your next round" is now "Get a round going" and opens `PlanAsk` (no day needed). Carried in:
the games you picked lead the Game and bet ballot (`groupGames` now reads `state.organizer.games` after
played rounds, a test covers it); pick exactly one game and it starts picked ("Skins, bet up for a
vote"), still one tap from Group picks. Sending lands on the plan with the paywall on top, as before.
Small props I added to the plan fixer's file: `PlanAsk({ onboarding, told })` (paywall after send,
`from: 'onboarding'` in analytics). `NewRound` routes `ahead` + `onboarding` to the ask. Onboarding never
learns names, so nobody is pre-asked.

## 4. Design review fixes

- Art owns the top of every step: scenes about 358 by 205, spots 160px (136px on payoffs), 24px under them.
- Questions: the cards for games, the group at the size you pick (2, 4 or 5 balls) for size, the 19th
  hole for settling up, the table for the math. Games and size used to show the same first-tee scene twice.
- Payoffs are centred moments with balanced paragraphs. Good taste gets the shades ball; "So you're the
  bank" gets the crowned coin stack, other math answers the scorecard.
- Progress bar: 4px hairline track, fill animates on transform; fades in after the welcome.
- Long steps no longer squeeze: the handicap button had shrunk to 21px tall. It's now a field like the
  name ("Add your index" with a plus).
- All set: dropped the three "ready" lines (each was said on its payoff and the card ticks the answers);
  the line before the buttons says no day is needed.
- "Live, hole by hole" sticker is ochre, not pink (pink only on what you tap).
- Pages leaving are `inert`, so a quick double tap can't hit the old Continue (and screen readers see one page).
- Paywall: the pink star tile is now the trophy drawing; "Save 40%" is butter, not pink.
- Short phones step the drawings down a size.

## Calls I made for Trevor

1. Cream card behind scenes in dark only (light stays clear). Alternative: fix the files and drop it.
2. Spots instead of a scene on games and size, so no scene shows twice in a row.
3. Payoff art reacts to the answer (settle) rather than one ball face per payoff.
4. Removed the ready list on All set (copy, no feature lost).
5. The IOU picture still uses pink for the payments; left it, since it echoes the pay buttons.

Checks: npm test (2688 pass), npm run lint (0 errors, one old warning in scripts/review-seed.js),
npm run build, npm run e2e all pass.
