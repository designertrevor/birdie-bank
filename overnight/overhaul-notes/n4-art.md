# Night 4: final art fixes (2026-10-29)

Branch `n4/art`, worktree `.claude/worktrees/n4-art`. Trevor's priority tonight: illustrations that look
good, centred where they're the focal point, with the gaps between arms and legs cut out. Every art finding
in auditor-6.json, auditor-5.json and auditor-4.json, then my own pass over every file in src/art.

Shots (untracked): `overnight/n4-shots/art/pairs/<name>-<before|after>-<light|dark>.png` for every drawing
changed, drawn through the app's own components on the cream page and a white card (light) or the dark
canvas and a dark card (dark); before is commit acd512d. `overnight/n4-shots/art/app/<area>/` is the audit's
own recipes re-shot after the fixes. `overnight/n4-shots/art/lab/` is the page that draws them
(`/overnight/n4-shots/art/lab/index.html?s=spots|games|scenes|avatars|bare|crown&theme=dark` on the dev
server).

## Findings

| Id | Sev | What I did |
|---|---|---|
| setup-2 | broken | rabbit.svg: head and ears filled with the ball cream (art-gaps fill, walls at the three places the line only touches), framed to the set's size. |
| setup-6 | should | High five fists (SpotArt Hand): ink line at 2.4, was 22% grey. Also fixes tab-9. |
| setup-7 | should | Ben's tour cap was the biggest buddy in the set and on the blush disc of its own cap colour: reframed to the set's head size (see Avatars below); tour cap now starts on mint. |
| play-13 | should | Sam's dark teal plate: the teal backdrop is a sea teal #3d7f77 (was #1a3a3a), so the ink outline, the beanie's band and pom read on it and the circle reads on a dark card. The teal-only cream/grey rings are gone (Avatar.jsx `av-teal`, BuddyArt `bd-rim`, styles.css). Also fixes tab-2, players-1, plan-8. |
| play-14 | should | **The crown takes the sticker border now** (Podium.jsx Crown: `sticker` sized for 44px, or 25px for the reveal's row crown; 10 units of room in its box for it). Drawn 0.64 of the face wide (was 0.54) so the crown itself is the same size inside the bigger box, its base on the hat; the grey drop shadow under it is gone (the border does that job). finale.css: the row crown is 25px wide. |
| play-20 | should | Riley's pink glasses on the pink disc: the pink backdrop is #ff8ab0 (was the tap pink #ff4d8b), and Shades starts on lav. Glasses already had an ink outer edge. |
| play-21 | should | bragging.svg: the flexed arms are filled cream with an ink line shut at the shoulder and armpit, so no white island or smudge in the crook in either theme. They're arms, not gaps, so cream, not holes. |
| play-22 | should | buying.svg: the see-through sliver of body between the outline and the first glass is filled cream with its line inked shut. The legs are one shape (no gap); the rest was that sliver under the white border. |
| trips-5 | should | roadtrip.svg: the mint hill and its ink line end in a rounded cut ~7% in from each side (clip path), so the border runs all the way round on the trip screen. The screen still shows the scene edge to edge (trip.css, not mine); with the band ending inside it reads as a sticker. |
| trips-6 | should | Every Ball buddy's outline round the silhouette is 2.8% of the box (was 2%), so the visor's and the red cap's top edges read in the crowd. |
| trips-21 | should | coinflip.svg: the motion ticks are gone (they were the two white ears) and the coin has a gold star with an ink line, so it reads as a coin. |
| setup-12 | polish | Banker already fills its box's height (88%, like every game sticker); it's a tall narrow figure. Rabbit (79%) and Shamble (81%) were the small ones: both now 88%. **The grid tiles' 36px vs the list's 70px is the Game step's CSS (setup's)**, not the art. |
| setup-13 | polish | vegas.svg, shamble.svg: speed lines dropped, drawings recentred. |
| setup-28 | polish | Round ready's crew: see "Checked in the app" below. |
| play-35 | polish | megaphone.svg: the three sound dashes are dropped and it's recentred. **The 8px top and bottom padding and centring on the text is the round menu's CSS (play's).** |
| history-1 | broken | hotstreak.svg: the thin ring round the fireball is dropped (it was the white plate with dark crescents), recentred. |
| history-2 | should | The hall of fame trophy (spots/cup) handles show the card now, at every size: holes (below). Same for the podium trophy, the whistle's loops, the suitcase handle, the thumbs-up ball's legs and the scenes' cut gaps. |
| tab-2 | should | One rule: no ring on a buddy's disc in dark (teal included now), the same faint ring on every disc in light. |
| players-1 | should | Teal backdrop lifted (play-13); the swatch in the picker is the same token so it reads too. |
| players-2 | should | Every critter fits its circle: eagle, albatross, worm burner, tiger, gator, sandbagger, flag, frog, gopher, fried egg, snowman, turtle, goose and banana reframed (viewBox only) so the whole drawing sits within 46% of the box from the centre, centred. Birdie left as night 3 placed it. |
| home-2 | should | Eleven buddies started on their own hat's colour (bucket, shades, sweatband, tour cap, cowboy, backwards, fishing, flower crown, goose, fried egg, turtle): each starts on another backdrop now. Saved picks keep theirs, so the seed's Jackson (bucket on mint) and Tyler (cowboy on lav) still show their picks; the brims are inside the plate after the reframe. |
| tab-3 | should | Ben: setup-7. |
| plan-6 | polish | Quick jabs' flag critter is a bare sticker beside the label (AvatarArt `bare`, `.avatar.av-bare`; Talk.jsx passes it). |
| plan-8 | polish | Sam's beanie on teal: play-13. |
| tab-9 | polish | All square's clinking fists: setup-6. |

### auditor-4

| Id | Sev | What I did |
|---|---|---|
| art-1 | broken | Each scene file's ground is now a rounded island (a clip path on the ground shape: 64 units in from each side, bottom at 950 of 1024, corners r 180), so once the screen stops cropping the scene the border follows a soft-cornered ground, not a slab's hard edge; `svg.scene { overflow: visible }` lets the border show past the box. **The onboarding slot's crop (overflow and radius on the scene wrapper) is the onboarding screen's; the coordinator says that fixer is removing it.** |
| art-2 | broken | rabbit: setup-2. |
| art-3 | should | The sticker filter grows the shape in two steps now: a small dilate (45% of the border) then the blur and a steeper cut (slope 24). Rays, speed lines and cords get a crisp white edge, not a grey glow; straight edges and round corners are as before. The vegas, shamble, megaphone, coin flip ticks and the hot streak ring are gone too (above). |
| art-4 | should | Cup and podium trophy handles are holes (below): the card shows inside each loop at every size, with a fine white lining. |
| art-5 | should | Agreed: its leg gap was already cut in the file; it's a hole now, so the card shows between the legs at every size (checked at 64, 96, 150 on the dark canvas). |
| art-6 | should | bragging: play-21 (arms filled cream, so no grey). |
| art-7 | should | scorecard: the strip under the table is a hole with no lining (scene holes take `holeEdge={0}`); the white dashes were the lining of that thin strip. |
| art-8 | should | Second fit pass after the heavier outline: every buddy and critter within 46.6% of the box from the centre. The traffic cone's tip is cut flat with an ink cap (a real cone's top) so the ball stays a usable size; it's still the smallest ball (38% of the box), since its brim is wide. |
| art-9 | should | Not fixed: the game files already fill 88% on their long side. Match play (two small balls, 45% tall), Vegas and Sixes are wide compositions; evening them out needs redrawn files (match play's balls bigger and stacked). |
| art-10 | should | Not fixed: Stroke play, Nines, Dots, Aces and Deuces, Bingo Bango Bongo, Long drive and Calcutta need new brush-style files (an illustration round). They are stickers now, at least. |
| art-11 | should | Not fixed: the share card's winner is ResultsArt.jsx drawn into a canvas, where an outside file inside an SVG picture doesn't load; it needs the buddy's paths inlined like the crown's (CROWN_PATHS). Left for a share-card pass. |
| art-12 | polish | Teal backdrop: play-13. |
| art-13 | polish | loneball.svg: the 16 gold, teal and pink fringe slivers along the grass are gone. |
| art-14 | polish | hotstreak: history-1 (ring and its speck gone). |
| art-15 | polish | Crowd (SpotArt Crowd): with four or five the back row stands 22 units above the front (was 10) and the group is centred in its box, so every face shows between the hats; the snapback's brim tucks behind the next head. |
| art-16 | polish | The art sheet's header scrolls with the page (`.as-top` not sticky). |

## New: holes in the sticker

The blur that makes the border fills any gap under about 2.5 borders, so the narrow gaps night 3 cut
(handles, loops, between legs) still showed white at card sizes. Now `<id>.holes.svg` beside a drawing
holds the pockets that should show the background (black shapes in the drawing's viewBox). ArtImage
(ArtFile.jsx) draws the border alone under a mask with those holes cut out, shrunk by a quarter of the border
so a thin cord keeps a fine white edge inside the hole (scenes: no lining, `holeEdge={0}`), then the drawing
on top. A holes file that can't
load leaves the border whole. `scripts/art-gaps.mjs` writes them: `cut` adds its pocket, `hole --at x,y`
marks a see-through one, `holes` rebuilds them all (run it after changing a drawing's viewBox). art-files.js
reads `<id>.holes.svg` beside each file. Files with holes: scenes course, clubhouse, scorecard, roadtrip;
spots agreed, cup, podium, suitcase, whistle.

## Avatars

- 20 buddies and 14 critters reframed by viewBox only (no path touched): the whole drawing inside 46% of the
  box from the centre, outline included, and the ball between 44% and 62% of the box wide. Shrunk: tour cap,
  visor, sweatband, beanie, crown, bandana, fishing, viking, cone, halo, propeller, backwards; zoomed in a
  little: captain, hardhat, safari, tam, trucker, beret. Left: the ones already in range (wizard and party
  hat as night 3 framed them, bucket, bowler, chef, earmuffs, shades, snapback, straw, tophat, umbrella).
- Outline round the silhouette 2.8% of the box on every buddy (was 2%). Critters unchanged (theirs is heavier).
- The teal and pink backdrops changed hex, ids kept: every saved avatar keeps its pick.

## Scenes

`svg.scene { overflow: visible }`: the ground runs to the scene box's sides, and the border now shows past
them, so it wraps the whole drawing on onboarding (the box is 16px in from the edge).

## Files changed

- `src/components/ArtFile.jsx`: the sticker filter (dilate, blur, steep cut); holes (border under a mask, `holeEdge`).
- `src/lib/art-files.js`: reads `<id>.holes.svg` beside a drawing.
- `src/components/Scenes.jsx`: scenes' holes have no lining.
- `src/components/SpotArt.jsx`: inked fists; the crowd's two rows.
- `src/components/Podium.jsx`, `src/components/finale.css`: the crown as a sticker.
- `src/components/Avatar.jsx`: `bare` buddy as a sticker; no teal ring. `src/components/BuddyArt.jsx`: no teal rim.
- `src/components/Talk.jsx`: Quick jabs' flag is bare (one prop; plan's file, the finding was art's).
- `src/lib/avatars.js`: teal and pink backdrop hexes, eleven default backdrops. `src/lib/profile-followups.test.js`: the goose's new default.
- `src/styles.css`: teal ring rules gone, `.avatar.av-bare`, the crown's width, `svg.scene` overflow, `.as-top` not sticky.
- `scripts/art-gaps.mjs`: `hole` and `holes` modes; `cut` writes the holes file.
- `src/art/README.md`: holes, framing, game sizes, scene edges.
- `src/art/buddies/*.svg` (all 32): outline 2.8%; 23 reframed by viewBox; cone's tip cut flat.
- `src/art/critters/*.svg` (15): reframed by viewBox.
- `src/art/games/rabbit.svg` (filled, framed), `vegas.svg`, `shamble.svg` (speed lines dropped, framed).
- `src/art/scenes/course.svg`, `clubhouse.svg`, `scorecard.svg` (ground island), `roadtrip.svg` (band ends inside), plus their `.holes.svg`.
- `src/art/spots/bragging.svg`, `buying.svg` (filled), `coinflip.svg` (ticks out, star in), `hotstreak.svg` (ring out), `megaphone.svg` (dashes out), `loneball.svg` (fringe out); `agreed`, `cup`, `podium`, `suitcase`, `whistle` `.holes.svg` (new).

## Calls I made (for Trevor)

1. **Teal backdrop #3d7f77, pink backdrop #ff8ab0.** Rather than rings on the one dark disc. The brand's
   deep teal stays everywhere else; the tap pink stays on buttons only.
2. **Default backdrops never match the hat.** Saved picks are left alone; nothing changes for a person who
   chose a colour.
3. **Crown on a bigger box, no drop shadow.** Same crown size; the white border replaces the grey shadow.
4. **Bragging's arms are cream arms**, not holes: as holes they read as black blobs on dark.
5. **Motion dashes and ticks are gone** from vegas, shamble, megaphone and coin flip; the hot streak ring too.
   At their sizes the border turned each into a white smudge or tab. The hammer's swoosh stays (it joins the head).
6. **Holes keep a quarter-border white edge inside them** (so the whistle's cord still reads on dark), none in scenes.
8. **The scenes' ground is a rounded island**, inset from the box; the ground's colour fills less of the bottom.
9. **The traffic cone's tip is cut flat** so the whole hat fits the circle.
10. **The crowd stands in two clear rows** and sits centred in its box (it used to sit low).
7. **The results image's crown** (ResultsArt.jsx, a picture for sharing) keeps no border, as night 3 left its buddy.

## For the screen fixers

- setup: the Game step's grid tiles draw their art at ~36px vs ~70px in the list (setup-12).
- play: the round menu's megaphone slot wants 8px top and bottom and centring on its text (play-35).
- trips: `.trip-screen .trip-scene` runs edge to edge; 16px side margins would match onboarding's scenes (trips-5).

## Checked in the app

The audit's own recipes re-shot after every fix (`overnight/n4-shots/art/app/`, both themes): the Game step's
rabbit, the Players step (Sam, Riley, Ben), Round ready's crew in two rows with a face showing for each, the
results podium and reveal with the bordered crown on the hat, Sam's reward hero on the sea teal, bragging
rights' arms, the reward card's waiter, the hall of fame trophy and record badges, the trip's road trip
ending inside its box, the draft's coin, all square's fists, Quick jabs' bare flag, and onboarding's three
scenes on their ground islands. Trevor's named items checked at full size on the dark canvas
(`pairs/agreed|cup|podium|bragging|scenes|games-after-dark.png`): the card shows between the thumbs-up
ball's legs and inside both trophies' handles, no grey in the flexed arms, nothing white under the
scorecard's table, the rabbit's face cream.

## Checks

`npm test` 2689 pass, `npm run lint` clean, `npm run build` ok. Not checked in iOS Safari (no WebKit here):
the new filter and mask use feMorphology, feGaussianBlur, feComponentTransfer and an SVG mask with an image,
all long supported in WebKit.
