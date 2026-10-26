# Look builder notes (overhaul/look, 2026-10-26 night)

The new type and look are the branch's look on every screen. `?look=classic` brings back today's,
`?look=new` undoes it (kept on the phone as `bb-look`). `?type=inter` layers the runner-up pairing
on the new look, `?type=figtree` undoes it (kept as `bb-type`).

## The pairing: Fraunces 500 + Figtree (picked)

- It's the Good Dog study's pairing, the one Trevor liked on 2026-10-26 and asked to push. Fraunces
  at 500 reads like Mackinac: warm, a little old-golf, never stuffy, and confident enough for
  headlines and money without a heavy weight. The soft axis at 50 (the study's setting) rounds its
  corners a touch, which keeps it friendly.
- Figtree is geometric and round like GT Walsheim, so names, rows and buttons feel modern and calm
  next to the serif. Inter next to Fraunces reads more like a news app; Figtree reads more like a
  brand, which is where the app is going.
- Figtree has a real 800, so Play's numbers stay heavy for the sun in the same family.
- Runner-up: Fraunces 400 + Inter (the serif experiment's), at `?type=inter`. Shots:
  `overnight/overhaul-shots/look/new-inter-{light,dark}-{upnext,tab}.png`.

## What the look changes (all scoped under `:root[data-look="new"]`)

- **Type.** Headlines in Fraunces 500, money and big counts in Fraunces 600 with lining tabular
  figures; names, list titles, buttons, chips, tags, inputs and avatar initials in Figtree 600;
  every other 800 comes down to 700. Big heavy headlines that were set in Inter (24px and up) move to
  the serif. Section labels are sentence case at 15px ("Friends", "The Tab", "Last time out"), not
  tracked capitals; eyebrows inside cards keep their capitals.
- **Play (the sun rule).** Inside `.screen.play` and its sheets, everything that was display or heavy
  is Figtree 800 with tabular numbers, the icons stay Phosphor bold, and only the hole title
  (`.play-course`) is the serif, at 600.
- **Edges.** `--card-shadow` is the hairline (`--hair`), so every card has a 1px warm line instead
  of a lift. Talk tray, reveal row and the card pile lose their shadows. Sheets keep a soft shadow
  over the scrim (they float) but lose most of it.
- **Corners.** Cards 14px (`--r-card`), smaller panels 12px, big hero cards 18px, sheets 20px.
  Pill buttons become 10px soft rectangles (`--r-btn`), pill tags and chips 8px (`--r-chip`).
  Avatars, toggles, progress tracks, dots and calendar days stay round.
- **Buttons.** The main button stays ink, 54px, Figtree 600; outline buttons are a card with a
  hairline. Pink stays only where a screen asks for it (`.full-btn.pink`, picks, the play badge),
  plus the empty-state button (`.ec`), which is the one thing to tap on an empty screen: flat pink,
  no pink step. Header and icon buttons are transparent with a hairline. Chips stop tilting.
- **Segmented controls** are a hairline rectangle with the picked side filled.
- **Fields** are white with a hairline, focus ring as before.
- **Bottom nav:** hairline over it, the play button a plain 56px ink circle without the pink step
  (the live ring and hole badge stay), tabs you're not on drawn in outline, the one you're on filled.
- **Icons:** Phosphor regular, loaded by main.jsx only for the new look; the bold class maps onto it
  outside Play.
- **The pink slabs** (resume card, winner hero) become cards with a pink edge, the go button keeps
  the pink. (Up next and results are being restructured by others; these rules only apply if those
  classes survive.)
- **Palette** (light): canvas #f9f5ec, surface #f1ecdf, card #fff, line #e4ddcd, ink #121614,
  body #3c403d, mute #5d615d. Dark: canvas #0f1312, card #181e1d, surface #232a28, line #2b3331,
  ink and greys as today. Bands moved toward the study's butter, mint, lilac. Pink, teal and the
  accents unchanged. theme-color follows `--canvas` already, so Safari's bars match.

## How it's built

- `src/look-new.gen.css`, written by `node scripts/look-new-css.mjs` (ported from the serif
  experiment's generator). It reads styles.css, finale.css and digest.css; Play's class list comes
  from Play.jsx, `src/screens/play/` and the components they import, so the sun rules follow the
  scoring builder's changes. `src/lib/look-new-gen.test.js` fails when the file is stale (after a
  merge that touches styles.css: rerun the script) and when any rule isn't scoped to the new look.
- `src/look-new.css`: tokens for light and dark, the `?type=inter` values, the hand rules. It
  `@import`s the generated file first so hand rules win.
- `styles.css` untouched. `index.html`: Fraunces now loads as a variable font with the SOFT axis
  (both copies of the link). `main.jsx`: the `?type=` switch and the Phosphor regular link.

## Calls I made for Trevor

1. Fraunces 500 + Figtree over Fraunces 400 + Inter (above).
2. Main buttons stay ink rather than turning pink: many screens stack two big buttons, and an
   all-pink default would put pink on more than the one thing to tap. Easy flip if he wants the
   study's pink primary: one rule on `.full-btn`.
3. Section labels in sentence case. Reversible in one rule.
4. Nav tabs in outline unless you're on them.
5. Sheets keep a faint shadow (they float over a scrim); everything else is hairline only.

## Checks

- Contrast walk (scripts/look-shots.mjs --audit, the theme-QA method) over 19 screens: every new-look
  shot passes in light and dark, and the Inter variant too. One miss found and fixed (setup's step
  tags, 4.32:1). Classic has a few old near-misses that aren't from this branch (segmented control
  text 4.43:1, disabled "Pick a game" 3.95:1, a 13px grey 4.43:1).
- Shots: `overnight/overhaul-shots/look/{classic,new}-{light,dark}-<screen>.png` at 390 by 844 for
  welcome, onboarding, Up next, Play, the round menu, Tab, a sheet (Settle up), History, Players,
  round results, setup, Settings, a person, your profile, Stats, Season, Hall of fame, Trip, Paywall.
  Rerun with the dev server on 5181: `node scripts/look-shots.mjs [filter] [--type=inter]`.

## Not done

- Join invite, Plan and the more screens built tonight weren't shot (Join needs a live invite code;
  the others are being rebuilt). They pick the look up through the shared tokens and the generator.
- Season, Hall of fame and Trip were shot in their empty states only (no trip or season in the seed).
- The splash (index.html) still sets the name in Bricolage on the old cream for its moment on screen;
  left alone since the name and logo are changing anyway.
