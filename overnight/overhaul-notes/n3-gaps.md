# Night 3: gaps in the scenes and spots (2026-10-29)

Branch `n3/gaps`, worktree `.claude/worktrees/n3-gaps`. Trevor's note 2 (cut out the gaps) and the scene side of
note 1 (stickers): every pocket where the background shows through a drawing is now transparent, so a die-cut
border can follow the true silhouette. Only `src/art/scenes` and `src/art/spots` changed.

## How

`scripts/art-gaps.mjs` (new, headless Chrome through playwright-core):

- `map`: draws each SVG on magenta, tints every cream shape its own colour with its path number, marks every shut-in
  see-through pocket in green, and reports how far the drawing sits off centre in its box.
- `shots`: `<name>-<tag>-light.png` on the cream page, `-dark.png` on the dark canvas with a 3px white sticker line,
  `-magenta.png` big.
- `crop`: a close look with a grid in the file's own units, for picking points.
- `cut`: from a point, every pixel of that colour up to the ink becomes a clip-path hole (`<clipPath id="<name>-gapN">`,
  the shapes wrapped in `<g clip-path>`). The hole runs under the surrounding ink so no cream rim is left; `--ink` also
  takes any black shape hidden under the cream (the export had big black silhouettes under some pockets), `--any`
  takes every colour under the pocket (grass or a shirt the export ran up behind it), `--walls` shut an open line,
  `--inkwall` inks those walls.
- `fill`: fills a see-through pocket with a new shape at the bottom of the drawing, run under the ink round it.

No path was redrawn by hand and nothing was flood filled across the sky: every cut and fill starts from a point I
picked after looking at the drawing at full size, and stops at the ink. Faces, hands, shirts and balls were left alone
except where they were see-through.

## Every file

| File | What changed |
|---|---|
| scenes/course | Cut: under both of the stretcher's raised arms (cream over a hidden black shape), between the bent golfer's arms, between his shorts and arm, between his legs, between the phone golfer's legs, between the cooler golfer's legs. Filled: the cooler golfer's ear, the head under his cap brim, his neck in the collar. |
| scenes/clubhouse | Cut: under the beer golfer's chair, between his legs, inside his raised mug's handle; between the shrug golfer's legs (the old fill had closed it; the leg lines are inked up to the shorts); under the back golfer's chair and between his shorts' legs; inside the left mug handle on the table. Filled: the back golfer's see-through hat brim (peach, as the crown, the open edge inked). The middle mug's handle now shows the black table behind it, not cream. |
| scenes/scorecard | Cut: between the tall golfer's legs and behind them, everything under the table between its legs and the watch golfer's legs, between the arms-crossed golfer's legs (and the shorts' crotch). Filled: the tall golfer's face (the old fill was a round blob, leaving his neck and the corners under the brim see-through), his ear and his see-through fingers; the arms-crossed golfer's ears, the head under his brim and his neck; the watch golfer's far sleeve (mint, as his shirt). |
| scenes/roadtrip | Cut: the cream strip under the car between the wheels, above the road. Windows stay cream (glass is an object). |
| spots/agreed | **The thumbs-up ball.** Cut the gap between its legs (and between the shoes). Filled its see-through thumb and the top of the fist, with an ink line at the thumb's base. |
| spots/cup | Cut both handle holes. Recentred: viewBox `100 19` to `100.4 29.9` (it sat 1.2% low). |
| spots/podium | Cut both handle holes (the trophy). |
| spots/suitcase | Cut the hole in the handle. |
| spots/whistle | Cut the inside of both cord loops (they read as two cream ears; now a lanyard). |
| spots/buying | Filled the see-through sliver between the first two glasses (the ball shows behind). |
| spots/bragging | Filled a see-through speck by a dimple. |
| spots/hotstreak | Recentred: viewBox `82 119` to `74.2 116` (it sat 1.9% left). |
| spots/coinstack | Recentred: viewBox `118 78` to `116 73.7` (1% high). |

Every viewBox keeps its size. Every other spot is within 0.6% of centre and was left. The four scenes measure 3 to 4%
low, which is the ground strip running to the bottom edge by design; not moved.

Shots: `overnight/n3-shots/gaps/<name>-<before|after>-<light|dark|magenta>.png` for every changed file, and
`overnight/n3-shots/gaps/app/` with the changed drawings on the art sheet (`?art`) at 390 wide, light and dark.

## Calls I made

1. **Pockets above the visible horizon are clear, even where the export ran the grass shape up behind them** (under
   the chairs, between legs). Below the horizon the grass stays. The middle beer mug's handle keeps the table behind it.
2. **Whistle loops and trophy handles are holes.** They're loops, so the background shows through.
3. **Bragging's arms stay line arms.** They're an open V with a floating bicep line, not a hollow shape; filling them
   would redraw the pose. Same for the megaphone ball's arms (the pockets between arm and ball stay clear).
4. **Ears that open to the sky stay open** (phone, bent and stretch golfers on the first tee): a few pixels, and the
   sticker line closes them. Enclosed ears were filled.
5. **The cream fringe left outside some outlines** (the export's halo, a few earlier fills' staircase edges) stays: it
   sits on the silhouette edge, where the white sticker border covers it.
6. **Thin seams** where two grass shapes meet under a cut (a dotted hairline in the 19th hole) are sub-pixel at app
   size and left.

## For the sticker fixer

The clip paths use ids `<name>-gapN` and `<name>-gapNi`, unique per file, so the files can be inlined side by side.
They render as images (checked on the art sheet in Chrome, which draws them through SVG `<image>`); the share
card's data URL path wasn't checked.

## Checks

`npm test` 2688 pass, `npm run lint` clean, `npm run build` ok.
