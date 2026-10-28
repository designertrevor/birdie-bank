# Fix pass 2: art (2026-10-28 night)

Branch `fix2/art`, worktree `.claude/worktrees/fx-art`. Every drawing was edited in its SVG file
(the paths, by script: fill a region up to its ink, recolour the inside of thick ink, add brush
strokes), not regenerated. Before and after shots of each changed drawing, light and dark, are in
`overnight/fix2-shots/art/<name>-<before|after>-<light|dark>.png`; app screens in
`overnight/fix2-shots/art/app/` (and `app-before/` for Round ready without the buddy line).

## Trevor's notes

1. **See-through balls** (agreed, bragging, buying, megaphone, gift, bulb): each ball has a solid
   cream body filled up to its ink line, plus the hollow legs (agreed, bragging, buying) and the
   gift ball's arms. Where the artist left a gap in the line, the body stops on the ball's circle.
2. **Specks**: removed from tees and podium, and both are centred in their boxes again. The same
   check over every file found two more, on the hardhat buddy and the gator critter (removed).
3. **mostrounds**: redrawn by hand as a ball and a tally of five, in a brush line to match. It reads
   at 48px. Still unplaced (see screens below).
4. **Handshake**: the lower hand now has three fingers lying across the other's back, and the
   export's colour fringe (gold, pink and teal slivers along the ink) is gone.
5. **Buddy hats**: a buddy now carries its own thin outline (`.buddy-ring*` in styles.css, set in
   BuddyArt.jsx). Standing on the page (Round ready's crew, the high five) it follows the theme: ink
   in light, cream in dark, so the white flat cap holds on the light card and the snapback's black
   brim on the dark one. On an avatar backdrop it follows the backdrop: ink on the pastels, cream on
   teal (the one dark backdrop, where black brims and the viking helmet disappeared). Critters get
   the same. Checked every hat on white, dark, mint, blush and teal, and on Round ready in both themes.
6. **Crown**: new `spots/goldcrown.svg`, the round 4 crown on its own (no ball), ochre with its
   pink gem and ink line, cropped wide (112 by 92) to sit on a face. In ART_USES and SpotArt's list.
   The play fixer can load it with `artFile('spots', 'goldcrown')` in Podium.jsx's `Crown`.
7. **Dark pass**: every drawing on the art sheet in both themes plus the review screens. Fixed: the
   punch card was see-through (a frame of dots in dark, and its cream holes vanished on a white
   card in light), now an ochre card. Games are fine (their backdrop doesn't change with the theme).

## From the onboarding fixer

- **face-great** looked worried: the brows and open mouth are gone; closed happy eyes and pink
  cheeks (the one face rule: no mouth).
- **Scenes' faces**: filled cream in the first tee, 19th hole and scorecard, one region at a time,
  never the sky (also the shrug guy's arms and two legs on the 19th hole, a forearm on the
  scorecard). Their frowns are now short flat lines.
- **Handshake arms on dark**: the black sleeves melted into the dark card. They're lavender (left)
  and coral (right) now, inside their ink line, with the mint cuffs, so it reads as two people.
- **The cream card behind the scenes in dark can go.** With the faces filled and the cream sticker
  outline, the scenes read on the dark canvas on their own (checked on the welcome in dark).

## Calls I made

1. **Punch card colour: ochre.** Cream and blush were tried; ochre is the only one where the
   unpunched (cream) holes show on both themes. It's a loyalty card now.
2. **Sleeves lavender and coral.** Two colours so the hands read as two people; both from the palette.
3. **Hot streak keeps its hollow ring.** It's a motion swoosh, not a badge disc; filling it made a
   big cream disc in dark.
4. **Ears left hollow** in the scorecard scene (a few pixels at scene size).
5. **Ink line on pastel avatars too**, not only on teal: the white hats were faint on blush and mint.

## For the screen owners (not my files)

- **Drop the cream plates now the balls are solid**:
  `src/screens/RoundDetail.jsx:241` remove `plated` from `<ArtNote spot="bragging" plated ...>`;
  `src/components/Finale.jsx:282` the buying `<Spot>` loses `outline={false}` and `art-plate`.
  Then `.art-plate` (art-places.css), ArtNote's `plated` prop and the "on its cream plate" notes for
  bragging and buying in art-manifest.js can go.
- **agreed** can now go on Round ready's What we agreed without a plate.
- **Most rounds badge**: `src/screens/HallOfFame.jsx:169` `art="punchcard"` to `art="mostrounds"` if
  Trevor likes the tally (and move the line in art-manifest.js).
- **Podium crown**: `goldcrown` (above).

## Checks

`npm test` 2688 pass, `npm run lint` clean (one old warning in scripts/review-seed.js), `npm run build` ok.
