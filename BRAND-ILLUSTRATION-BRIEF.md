# Illustration brief

How to make the app's illustration family with AI tools (Recraft, Quiver, or whatever works), decided 2026-10-08 after reviewing three test sets. Read `BRAND.md` first for the brand. The full inventory of drawings, sizes, ids and where each shows is `src/lib/art-manifest.js` and `src/art/README.md` on main (pull first). `BRAND-CHATGPT-CONTEXT.md` had the same inventory in prose for an image tool; it was moved out of the repo on 2026-10-08, so don't rely on it being here.

## The direction

**Deliberately dorky.** The drawings look like a person with opinions drew them, not a picture-perfect AI set. Golfers in the app are slightly wrong on purpose: odd proportions, a hunched putter stance, nobody looks athletic, one off detail per drawing. The copy matches ("Clubs packed. Standards low." / "Good company. Questionable golf."). Self-deprecation gives people permission to be bad at golf, which is the opposite of pressure.

**Why not the other two test sets.** The clean sticker set (thick ink outline, white halo) scales well but is the default look of every AI-built app and has nothing golf, warm or retro in it. The hand-drawn crosshatch set is warm but the hatching is an AI tell, drifts across 50 drawings, and turns to mush under 52px.

## Two tiers, one family

| Tier | What | Box | Style |
|---|---|---|---|
| **Big** | scenes, hero empty states, onboarding, trip, recap heroes | 400 by 240 and 120 by 120 at 110px or more | goofy flat humans and props, limited palette, a thin ink line on faces and details only, flat fills, no texture |
| **Small** | game stickers, critters, buddy faces, spots used under 100px | 64 by 64 and 120 by 120 | flat badge style, chunky silhouettes, 2 to 4 colors plus ink, reads at 28px |

What ties them together: the same palette, the same ink line weight at the same scale, the same cream ball #fbf7ec, and the same sense of humor. The small tier is the big tier's objects with the people removed.

**Humans own the scenes. Ball buddies are avatars.** Scenes show people (the group on the tee, at the clubhouse, in the car). The buddies stay as profile pictures and the faces on moments and results. Critters are the other avatar shelf.

## Rules every drawing follows

1. Palette only: ink #0a0a0a, ball #fbf7ec, pink #ff4d8b (one pop per image at most), deep pink #d42a6b, ochre #e8b94a, gold #c99a30, coin #ffd45c, teal #1a3a3a, mint #a4d4c5, coral #ff6b5a, lavender #b8a4ed, peach #ffb084, blush #ffd6e5.
2. Transparent background. SVG where the tool can, otherwise PNG at 3x the box.
3. Must read on a white card and on a #1a1f1e dark card. Scenes get a separate dusk file.
4. No text, no logos, no "Birdie Bank". The name is changing.
5. Warm and a little retro in the look (old golf), modern buddies in the content (bucket hats, snapbacks, a cooler, a cart). No blazers, no country-club wealth.
6. Funny like a friend. A losing face is rueful, never crushed. Jokes live in heroes and empty states, never on the Tab or on results where someone just lost money.
7. Not kiddie, not casino. No treasure chests, confetti explosions, dice (except the Vegas sticker), chips, neon.
8. The white sticker halo is a CSS filter the app can add, not something baked into the drawing.

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
