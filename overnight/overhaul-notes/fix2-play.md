# Fix pass 2: the round (setup, Round ready, scoring, results)

Branch `fix2/play` (overhaul/next merged in after the art fixes). Shots in `overnight/fix2-shots/play/`
(untracked), 390 by 844, light and dark: `<state>-before-*` and `<state>-after-*`. The shot script
seeds the review seed plus made-up finished rounds (money, points, reward, all square, a tie, a card
with no game) and live ones (Wolf, Banker, hole 9, hole 18, a fresh round).

## Trevor's notes

1. **Coin stack on scoring**: gone from the money strip and the Worth line, for every game (the art was
   just as small for Wolf or Banker). The strip keeps the game's colour.
2. **The crown**: the winner wears the art fixer's gold crown (`spots/goldcrown.svg`) on the results
   podium, the crowned face, the reveal and its race rows, and Hall of fame. The results image (share
   card) draws the same crown from its paths, kept in `Podium.jsx`, since a canvas can't load a file.
   A tie for top now crowns everyone level on the podium (the reveal already did).
3. **All square**: room under the course line at the foot of the block (4px to 20px).
4. **Reward card**: its text was picking up another card's grey (`.rc-text`), light on the ochre in
   dark. It takes the card's dark text now, both themes. Its buying spot lost its plate (solid balls).
5. **Round ready crew**: they stand on an oval of the game's colour, so the white flat cap reads in
   light and the snapback's black brim in dark. Checked again with the art fixer's hat outlines in.

## From the design review (and the coordinator's notes)

- **Who pays who** is one card with hairlines between payments (each one's reactions under its row).
- **Pay or mark paid** is full width and never wraps; **Roll it on the Tab** is a quiet link under it.
- **Dark podium**: the pastel steps glared; they sink into the card now, first place strongest, light
  numbers on the lower two. Shows on Hall of fame too.
- **Bets step summary** (ochre card): its sub lines were grey on ochre (1.4:1 in dark), now dark.
- **Pink eyebrows** ("Winner", "Run it back") on the dark game wash were under 4.5:1: a lighter pink.
- **First tee card** with handicaps off says "None, it's gross" as one line, not a chip saying Strokes
  under the Strokes heading.
- **Tap areas**: the skin price, Change the banker, the setup step tabs and a side game's rules dot
  take a 44px tap without changing size (the rest already had the app's invisible pad).
- **Headings**: the course name on the scoring screen, Round ready's title, the winner line on results
  and the reveal are h1s; results' and a friend's round's section labels are h2s.

## Calls for Trevor

1. The crew's ground is a solid oval in the game's colour (gold for Skins). Say if you'd rather it was
   paler or a flatter "grass" shape.
2. The reveal still scrolls so the last total shows, which tucks the winner's title above the fold on
   a four-player round with a skins card. Left as built; a tighter row or a shorter skins card would
   let both fit.
3. The reveal's winner row is still a solid pink slab. It's the moment, so I left it, but it is the
   one pink on that screen that isn't a button.
4. Roll it on the Tab moved from a second big button to a link under Pay or mark paid.

## Left alone (not mine, for whoever owns them)

- The other game panels (Rabbit, chips) still show a small game art in their line (`GamePanels.jsx`).
- Sheet headers and screen headers aren't headings (`ui.jsx` Header and Sheet): one change there would
  give every screen its h1.
- The reaction buttons under payments are 36px tall (`Talk.jsx`).
- A sheet's close button is pink everywhere.

Checks: npm test, npm run lint (one old warning in scripts/review-seed.js), npm run build and
npm run e2e (a full 18-hole Skins round to Settle up) all pass.

## Audit fixes (auditor-1 to 3, owner play)

Fixed:
- **A round of one** ends on its own card: the Nice round finish and results (score, to par, the card),
  never "All square $0, nobody owes anybody". Display only; scoring a one-player round is unchanged.
- **In the sun**: the money strip's amounts are a deeper red and green on the light strip (7:1 and up);
  an off switch has a 1.5px edge in the mute colour (app-wide `.tog`); the empty rings on setup rows
  are mute (3:1 and up); every tee dot has an ink ring, so Black shows on a dark chip.
- **Dark bands**: the money strip, Run it back, the Bets summary card, the results winner block and
  the reveal's head are the plain card with the game's colour as an edge (left on the strip, on top
  elsewhere), not olive or brown washes; the Round ready oval is the clear game colour.
- **Setup selection**: a picked game, course or player is the card with a 2px ink edge and an ink
  check (no pink wash, border or check).
- **Ties**: players level on top stand on steps of the same height, and every T1 in Standings wears
  the gold disc.
- **The reveal's winner row**: a gold-edged card with the amount in win green, not a pink slab.
- **Round ready**: Invite the group is an outline button, so Tee off is the one filled button.
- **First tee sheet**: Lock it in and Skip for now are pinned at the sheet's foot.
- **Hole by hole tables**: an empty cell is an en dash, not a middle dot.

Left (bigger changes, or a call for Trevor): the share card's blank game tile (canvas art), team
results on a three-step podium, the reward round's hero and a "Lunch is bought" action, Settle up as
one card and its blue Venmo button, the default par number in grey (kept as built), Delete round's
place in the end-round dialog (the shared ask dialog has no quiet style), setup and scoring fades
under the fixed header, collapsing the Wolf panel, Vegas teams, the Stableford panel, the handicaps
sheet's chip wall, the scorecard's sideways cue, Done landing on History, the overview's entrance.
