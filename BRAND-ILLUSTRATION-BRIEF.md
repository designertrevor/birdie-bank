# Illustration brief

How to make the app's illustration family with AI tools (Recraft, Quiver, or whatever works), decided 2026-10-08 after reviewing three test sets. Read `BRAND.md` first for the brand. The full inventory of drawings, sizes, ids and where each shows is `src/lib/art-manifest.js` and `src/art/README.md` on main (pull first). `BRAND-CHATGPT-CONTEXT.md` had the same inventory in prose for an image tool; it was moved out of the repo on 2026-10-08, so don't rely on it being here.

## The direction

**Deliberately dorky, drawn with one line.** Decided 2026-10-26 after four rounds in Recraft (the notes are in `overnight/ILLUSTRATION-COMMENTS-OCT26.md` and `overnight/ILLUSTRATION-ROUND-4.html`). The drawings look like a person with opinions drew them, not a picture-perfect AI set: golfers are slightly wrong on purpose, one wide with a belly, one pencil-thin with a tiny head, one pear-shaped, one with a big head on a stocky body, nobody athletic, silly stiff poses. The copy matches ("Clubs packed. Standards low."). Self-deprecation gives people permission to be bad at golf, which is the opposite of pressure.

**The look.** One confident brush ink line, flat fills, lots of the drawing left white, no texture, no hatching, no wobbly lines, no gradients, no shadows. It came from a farmer's-market poster Trevor supplied (orange and black on lime) and the two first-tee drawings made from it, not from the cut-paper car the first brief named. The banker sticker is the reference for every face.

**Why not the other test sets.** The cut-paper car was charming but the model drifted back to its house style every pass. The clean sticker set with the thick outline and white halo is the default look of every AI-built app. The crosshatch set was warm but the hatching is an AI tell and turns to mush under 52px. Trevor's words on the hatched and dark-featured tries: "makes me feel like I have to squint".

## Two tiers, one family

| Tier | What | Box | Style |
|---|---|---|---|
| **Big** | scenes, hero empty states, onboarding, trip, recap heroes | 400 by 240 and 120 by 120 at 110px or more | the four friends in brush ink with flat fills, lots of white, a flat ground strip and a low hill, open sky |
| **Small** | game stickers, critters, buddy faces, spots used under 100px | 64 by 64 and 120 by 120 | the same line with fewer fills: one chunky object, one or two colours plus ink, reads at 28px |

What ties them together: the same brush line at the same weight, the same palette, the same white ball with dimple dots, and the same sense of humour. The small tier is the big tier's objects with the people removed.

**Humans own the scenes. Ball buddies are avatars.** Scenes show people (the group on the tee, at the clubhouse, in the car). The buddies stay as profile pictures and the faces on moments and results. Critters are the other avatar shelf.

## Rules every drawing follows

1. **One face everywhere.** Two dot eyes, one tiny nose stroke, and no mouth or one short flat line. Same on balls and on people. Nobody frowns unless the moment is sad, nobody grins. Noses stay small and the same shape across a sheet.
2. **Props have no faces.** A ball inside a prop drawing (dice, a star, crossed clubs, a trophy) is a plain white ball with dimples. The ball only gets a face when it is the character.
3. **Drop the ball when the prop carries it.** The megaphone, the scorecard, the gift box, the calendar and the phone are drawn as the object. No ball holding it.
4. **Balls are white** (#fbf7ec with ink dimples), never lime, never a colour.
5. **Hats get a full ink outline.** One skin colour per sheet (peach). Arms stay down unless they do something.
6. **Marks stay small.** Dots, pins and dimples are a hint, never a blob.
7. Palette only: ink #0a0a0a, ball #fbf7ec, pink #ff4d8b (one pop per image at most), deep pink #d42a6b, ochre #e8b94a, gold #c99a30, coin #ffd45c, teal #1a3a3a, mint #a4d4c5, coral #ff6b5a, lavender #b8a4ed, peach #ffb084, blush #ffd6e5. The model's lime is snapped on export: mint for grass, cream for balls, ochre for coins and cups.
8. Transparent background, SVG. The sky is cut out completely, including the pockets between arms and legs, so the dark theme's outline hugs the drawing. Gaps over grass or another object stay filled. Never flood-fill.
9. One file for both themes. In the dark theme the app draws a thin cream outline around scenes and spots, like a sticker (a CSS drop-shadow filter, `.art-outline` in `styles.css`). Buddies, critters and game art sit on a colour backdrop and skip it. No dusk files, no recolouring.
10. No text, no logos, no "Birdie Bank". The name is changing.
11. Warm and a little retro in the look (old golf), modern buddies in the content (bucket hats, snapbacks, a cooler, a cart). No blazers, no country-club wealth.
12. Funny like a friend. A losing face is rueful, never crushed. Jokes live in heroes and empty states, never on the Tab or on results where someone just lost money.
13. Not kiddie, not casino. No treasure chests, confetti explosions, dice (except the Vegas sticker), chips, neon.

## How the set was made (so the next one matches)

Recraft Studio, model Recraft V4.1 Vector, the saved brand palette on, and three style references attached to every prompt: the banker sticker, the first-tee pick and the birdie-and-eagle pair (`overnight/illustration-run-2/trevor-pick-11.png`, `-1.png`, `-13.png`). The prompt describes only the subject, the bodies and the pose, plus "drawn in the same brush ink line and flat fills as the references" and the face rule. Two candidates per prompt, judged at full size, never from thumbnails. Exported as SVG and run through the export script (strip the canvas fill, split sheets, snap colours, crop), which is what `src/art/` holds now.

## The starter batch (make these first, in this order)

The point of the first batch is to lock the family before making 60 drawings. Approve each before moving on; the approved one becomes the reference for the next.

1. `scenes/course`, the first tee: four golfers, one bent over a tee, one checking a phone, one stretching badly, one with a cooler. Day version.
2. `spots/wallet`: the empty wallet, 120 box, goofy enough to be funny at 150px, still clear at 84px.
3. `spots/face-great`, `spots/face-ok`, `spots/face-off`: the ball's three faces, since they set the face style for every buddy.
4. `games/wolf`, `games/skins`, `games/nassau`, `games/banker`: four Classics stickers on nothing (the app draws the ochre backdrop), to lock the small tier.
5. `buddies/bucket` and `critters/birdie`: one of each, the birdie checked at 28px.
6. `scenes/course` dusk version, to lock dark mode.

Then the rest of the manifest, scenes and spots first (they are what people see), game stickers next, buddies and critters last.

## Reference images

Trevor supplies these at the start of the thread:

- The goofy set (the road-trip car with two heads in the windows; the hunched putter in the pink shirt). The point of view.
- The sticker set, for the small tier's silhouette weight only, not its look.
- AllTrails park stamps, for the badge feel of game stickers.
- Screenshots of the app in light and dark mode so the tool sees the cards the art sits on. A set already exists in `screenshots-for-illustration-brief/` (welcome, onboarding, home, round ready, scoring, plus `extras/`), taken 2026-10-07.

## Tool notes

- **Recraft:** build a custom style from the approved starter drawings (it takes a handful of reference images) and generate the rest inside that style; ask for vector output so files land as SVG. Check its current docs for how many references a style needs and whether vector export is on the plan.
- **Quiver:** check its current docs at the start of the thread for how it builds a style family and what it exports; do not assume.
- Whichever tool: generate one drawing per prompt, name files by the id, and keep an approved folder as the style anchor.

## Where files go

`src/art/<kind>/<id>.svg` (or `.png`), `<id>.dark.svg` for a dark variant. Vite picks them up with no code change. The art sheet at `?art` on a dev server shows every drawing in place; flip it to dark with the toggle at the top. The art folders and `src/art/README.md` shipped to main with design pass 2 on 2026-10-07; this checkout may need `git pull` to see them.
