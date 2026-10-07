# Outside art

Drawings made outside the code live here and replace the hand-drawn ones with no code change.
The app's art sheet lists every drawing with its name, file, box and where it shows: open the
app (or a preview) with `?art`, and flip it to dark with the toggle at the top.

## Where a file goes

```
src/art/
  scenes/     course.svg  clubhouse.svg  roadtrip.svg          400 by 240
  spots/      tee.svg  wallet.svg  face-great.svg  crowd.svg …  120 by 120
  games/      banker.svg  skins.svg  wolf.svg …                   64 by 64
  buddies/    bucket.svg  visor.svg  snapback.svg …               64 by 64
  critters/   birdie.svg  eagle.svg  goose.svg …                  64 by 64
  icons/      ball.svg (150 by 150)  bank.svg  coins.svg … (24 by 24)
```

- The file name is the id on the sheet's card (`spots/wallet.svg` is the card that says so).
- `.svg` first: it scales to every size the app shows it at and stays crisp. `.png` or `.webp`
  (at 3x the box, so 360px for a 120 box) when it has to be a bitmap.
- `<id>.dark.svg` (or `.dark.png`) beside a drawing gives the dark theme its own version. Without
  it, the one file shows in both themes, so check it on the dark canvas (`#0f1413`, cards `#1e2524`).
- A kind or id the app doesn't know is ignored. A drawing with no file stays hand-drawn.
- Nothing else to do: Vite finds the files at build time (`src/lib/art-files.js`). Reload the dev
  server's page after adding a file.

## What each kind needs

- **Scenes** run full bleed across the top of a screen. The app crops from the sky down to fit the
  width, so the ground and the people must sit inside the middle 290 units (x 56 to 344). The
  hand-drawn tee and clubhouse were pulled from onboarding on 2026-10-07 and show again as soon as
  their files land.
- **Spots** sit on a white or dark card with no backdrop from the app (an outside file replaces
  the hand-drawn plate too), so give one its own soft blob of colour if it needs it. `crowd` and
  `highfive` are drawn from the group's own buddies by hand; a file is one picture for everyone.
- **Game art** sits on a rounded backdrop the app draws in the group's colour (Classics ochre
  `#e8b94a`, Head to head pink `#ff4d8b`, Team mint `#a4d4c5`, Full round lavender `#b8a4ed`,
  Points and side games peach `#ffb084`). Draw only what goes on it, with a little room at the edges.
- **Buddies and critters** are clipped to a circle on a backdrop colour the player picks, so keep
  the hat and face inside the circle. Birdie and eagle also pop up at 28px on scores under par.
- **Icons** are the Phosphor glyphs the welcome's game tags use (`bank`, `flag-pennant`, `coins`,
  `paw-print`, `dice-five`, `sword`, `star`, `dots-three-circle`) and `ball`, the first ball on a
  tee from the join and link screens.

## The look and the palette

Flat colour, soft rounded shapes, ink outlines on faces and details, the smiley golf ball as the
hero. Ink `#0a0a0a`, ball `#fbf7ec`, pink `#ff4d8b`, deep pink `#d42a6b`, ochre `#e8b94a`, gold
`#c99a30`, coin `#ffd45c`, teal `#1a3a3a`, mint `#a4d4c5`, coral `#ff6b5a`, lavender `#b8a4ed`,
peach `#ffb084`, blush `#ffd6e5`.
