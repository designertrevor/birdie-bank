# Night 3: stickers (2026-10-29)

Branch `n3/sticker`, worktree `.claude/worktrees/n3-sticker`. Trevor's review notes 1, 3, 4 and the
birdie in 7 (REVIEW-2-ANSWERS.md). Shots are in `overnight/n3-shots/sticker/` (untracked):
`audit-before/` and `audit-after/` are the audit's own recipes (onboarding, home, setup, play,
players, history, trips) in both themes, `artsheet-<before|after>-<theme>.png` the whole art sheet,
`avatars-grid-<before|after>.png` every buddy and critter at 28, 40, 64 and 96px on all eight
backdrops plus white, cream, dark canvas and dark card, `critter-popup-...png` the birdie on a score.

## 1. Illustrations as die-cut stickers

- Every scene, spot, game sticker, the ball icon and the critters popping up on a score now sit on
  the page with an even white border round their silhouette, in both themes. It's an SVG filter in
  the drawing's own box (`src/components/ArtFile.jsx`: blur the shape, cut it low so it grows evenly,
  fill it white), not a CSS drop-shadow: WebKit draws SVG filters on SVG content, a CSS shadow stack
  on an SVG `<image>` is shaky there, and the filter travels with the drawing when a share card turns
  it into a picture. It's drawn once per paint, not per scroll frame.
- Its width follows the size the drawing shows at (`src/lib/sticker.js`): 4px on a scene and on
  spots of 136px and up, about 3px at 96px, 2px on a 44px game sticker, 1.5px on a 28px critter.
- Light vs dark: white in both, as a sticker is. In the light theme a faint hairline (ink at 14%)
  sits just outside the white, so the edge still reads on a white card and looks cut out on the
  cream page; in dark the white alone carries it. The colours are tokens (`--stk-edge`,
  `--stk-hair` in styles.css) if Trevor wants it warmer or the hairline gone.
- Gaps narrower than about twice the border (between legs, an arm and a body) fill white, as on a
  real sticker. Wider gaps show the background once the scenes fixer cuts them out of the files.
- The old dark-only cream outline (`.art-outline`) and the buddies' CSS line (`.buddy-ring*`) are gone.

## 2. No colour shapes behind drawings

- GameArt draws no rounded backdrop anywhere (onboarding's game cards, setup's Game step, the overview,
  round cards, results, moments, the share card). `tint` is ignored now.
- Spots: the hand-drawn colour plate and `plate` prop do nothing (callers still passing
  `plate={false}` are harmless); ArtNote's `plated` cream disc and `.art-plate` are gone.
- The crowd and high five lose their ground shadow (one sticker round the whole group).
- The birdie and eagle popping up on a score: no colour circle or card ring, a sticker on the card
  (`BuddyArt bg={null}`, one line in `play/HoleScores.jsx` and `.sc-critter` in styles.css).
- Buddy and critter avatars keep the backdrop circle the player picked.

## 3. Avatar outlines

All 32 buddies and 16 critters, in the files: an even ink line round the whole silhouette (a stroked
copy of every shape behind the drawing, 2% of the box) and an ink edge on each colour region big
enough to be a hat, a band, glasses or the head (1.6%). Fixes the white hats on white, the red
headband on coral, the pink glasses on pink, the mint bucket on mint. Checked at 28, 40, 64 and 96px
on every backdrop, white and dark (`avatars-grid-after.png`, `avatars-96-after.png`).

## 4. Wizard

The round 4 file again with the whole hat (last night's crop undone), its cone shortened to 68% of its
height and the stars moved with it, then framed like the party hat: whole hat inside the circle, the
ball the same size as the rest of the set.

## 7. Birdie

The golf ball it stood on is gone and the bird is centred in its box (a little right of its box
centre, since the tail is thin), filling it like the eagle. Reads at 28px.

## Calls I made

1. **Pure white border in both themes**, with the light-theme hairline. A cream border vanished on the
   cream page; white with a hairline looks like a real sticker on cream and holds on white cards.
2. **Game cards keep their layout**; only the plate went. The group colour isn't used as a tag yet:
   the cards already sit under group headings, so I didn't add one. Say if you want a coloured edge.
3. **Podium crown** (`Podium.jsx` passes `outline={false}`) stays without a border, since it sits on a
   face. One prop away if you want it stickered.
4. **The results art's buddy** (`ResultsArt.jsx`) stands on its card with its file outline, no white
   border, like the buddies in avatars.

## For the other fixers

- Round ready's crew (`ReadyStep.jsx`) is already a sticker; the ochre oval behind it is the round
  screens fixer's (note 5).
- The scorecard key's birdie and eagle (`Scorecard.jsx`) still draw on their backdrop circle; the
  round screens fixer is taking them off the card (note 7).

## Checks

`npm test` 2688 pass, `npm run lint` clean, `npm run build` ok. Not checked in a real iOS Safari (no
WebKit here); the filter uses only primitives WebKit has had for years (feGaussianBlur,
feComponentTransfer, feFlood, feComposite, feMerge).
