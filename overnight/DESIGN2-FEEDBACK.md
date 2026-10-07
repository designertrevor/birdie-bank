# Trevor's review of the design pass (2026-10-07, preview of feedback/design2)

Raw notes as sent, screen by screen. Analysis and the build list come after the whole walk-through.

## Batch 1: onboarding

- Lots to like, lots to work on.
- **Welcome hero illustration:** subpar, looks cheap. Remove it until there's a better-designed one. Much of the art should be custom made in a different AI tool, not drawn by Claude.
- **Asset sheet request:** a web link (or sheet) that shows every illustration, icon, avatar character, scene and spot illustration from the whole app in one organized place, scrollable, with a light / dark toggle, so it can be handed to another AI tool and the results brought back as an on-brand set.
- **Welcome layout:** a little crammed; the illustration may be too big. Title and some content could sit on top of the illustration if it's designed for that.
- **Game tags on the welcome:** like them, but they're static. Want some floaty movement, or a wiggle on tap; they look tappable but aren't. Not a big interactive moment, just not static.
- **Welcome scrolls** left to right and shows a scroll bar. Should not scroll in either direction; fit every phone size without scrolling.
- **Set up my group (question steps):** top illustration isn't good. Wish it ran up behind the progress bar and all the way to the top edge of the phone, behind the status bar (open sky up there so the bar stays legible). Don't like it cropped.
- **Game spot illustrations:** fun, but the colouring is off. Build these in a separate tool and bring them in. Skins: coins are the same colour as the backdrop. Same with Banker. Stableford: the star has poor contrast on the purple. Wolf: very poorly drawn.
- **"Nice" payoff step:** eyebrow "Nice" is lackluster, should say something more useful. The guide ball is almost the same colour as the background and disappears; this is exactly the moment it shouldn't. The money-on-the-hole graphic below looks like a UI piece you're supposed to interact with; make it a mock-up (a scorecard on an illustrated phone in the chosen illustration style, or another scene). Doesn't say much about the app and is a little confusing.
- **How many usually play:** scene shows five golfers; most groups are four at most, show four.
- **Settling up payoff:** hard to tell the two are high fiving, and the lines above the high five have zero contrast on that background. Work on that illustration separately. The graphic below (6 debts to 3 payments) is trying to say the app makes it easier but isn't that helpful; find a better way to explain it.
- **Who ends up doing the math:** same illustration as the previous step. Don't reuse one illustration in multiple spots; give this its own.
- **"So you're the bank" payoff:** eyebrow "About that" isn't useful, update it. The card below repeating "Birdie Bank, Birdie Bank, Birdie Bank" is a plain UI component; should be a fun, stylized moment.
- **Final review step:** the green check marks are nearly black; use a brighter, more playful green (that colour is used elsewhere too, adjust everywhere). "Your group" with the "You're the bank" tag floating at the top is confusing; say something else, and the tag placement makes no sense. Look on Mobbin for review-screen examples; this screen can be a lot better.

## Batch 2: Plan a round, Round ready, Up next, light and dark mode

- **Plan a round, course search:** after typing "B", finding Birch Creek and picking it, the input still shows the typed text and isn't active any more. Confusing; the input should clear once a course is picked.
- **"When are you playing?" step:** should they be able to skip it? What if they don't have a tee time or anything planned, and don't know how to advance? Check whether requiring it is worth it (maybe they already said they were planning ahead, can't remember).
- **Who's invited screen:** the link icon is a poor way to show it: tiny, inside a square, wrapped in a circle, and the circle isn't lined up with the text beside it. Needs a visual pass.
- **Your round (after advancing):** the screen and the flow are good, but at the bottom ("Invite the group", "Playing now", "Roll call") there's no safe way out into the app. Back should go to the previous screen. Needs an "I'm done" or similar; it feels like you can't leave to the main app.
- **Up next, Friends row at the bottom** ("Friends' rounds and the group feed"): the illustration is super squished and doesn't hug left in that banner.
- **Light mode:** white cards are very hard to see against the cream background. Doesn't want an outline (too many lines), unsure about darkening the background. Look on Mobbin at other light-mode examples for a fix. Dark mode is a little better but card-vs-background contrast could improve there too; look at Mobbin's dark-mode options.

## Batch 3: in a round and the results

- **Scoring step, birdie critter:** tapped a birdie and only just noticed the critter pop up next to the tapped score; another and it's an eagle. Hard to tell it's a birdie. Fun to have it pop up when you mark a birdie, but it should probably go away afterwards rather than stay. May improve once the illustrations are reworked.
- **"Any side bets?" pop-up:** the options are yes, "Not this round", and don't show again. Wants "Not this hole" too (want to do it later in the round, just not on this par 3), or "Yes, remind me later in the round".
- **Mid-round milestones:** after nine holes (on 18), a milestone moment: "you're halfway, here's how things stand", a nice bottom sheet with a detailed view of all the scores and standings. Unsure how it works on nine-hole rounds; may depend on the game.
- **Finishing a round, Skins results:** the title at the top starts large as it spells out, then suddenly shrinks small. Feels glitchy, like a design flaw. Either small from the start, or a smoother transition: show it large, give more time, then animate the shrink as the content below comes in.
- **Final results screen:** likes the screen. The two buttons at the bottom, "Who pays who" and "See the full breakdown": Who pays who can be backed out of, but the full breakdown has no way back, so you can't return and finish the end-of-round flow. Missing a back button. Has bothered him across several real rounds.

## To-do list from the review (2026-10-07)

Order within each group is build order. "Mobbin" marks items to research there first.

### A. Art, first (unblocks the rest)
1. [x] (2026-10-07) **Asset sheet:** one web page showing every illustration in the app, organized by kind (scenes, spot illustrations, game art, Ball buddies, critters, icons used as art), with a light / dark toggle, scrollable, each item labelled with where it's used and its size. Trevor hands it to another AI tool and brings back an on-brand set. Start from the dev gallery (`?gallery`), then publish it as a standalone page (artifact or a route on the preview). **Built:** `?art` on any build, so the Vercel preview serves it (`?gallery` still works). 80 drawings in six kinds, each with where it shows, how big, the file it maps to, a status (hand-drawn, pulled, outside file in) and a Download SVG; the palette and the surfaces at the top; light / dark toggle.
2. [x] (2026-10-07) Define the import path for outside art: SVG or PNG per asset, file names matching the gallery labels, so new art drops in without code changes. **Built:** `src/art/<kind>/<id>.svg` (or `.png` / `.webp`), plus `<id>.dark.svg` for the dark theme, found at build time by `src/lib/art-files.js`; the app's SVG boxes, clipping and layout stay. `src/art/README.md` says what each kind needs.
3. [x] (2026-10-07) Until the new art lands: take the welcome hero scene off (it looks cheap), and keep the question-step scenes only if they're not embarrassing; otherwise go back to no illustration there too. **Done:** the tee and clubhouse scenes draw nothing on the welcome and the four questions (the same drawing he called cheap on the welcome); each shows again as its outside file the moment it lands. The road trip scene stays on the Trip screen, which the review didn't reach.
4. [x] (2026-10-07) Game art colour fixes meanwhile (or wait for the outside set): Skins and Banker coins on the ochre backdrop, Stableford star on lavender, Wolf redrawn. **Done meanwhile:** coins a shade lighter (`#ffd45c`) with an ink edge on Banker and Skins, the Stableford star the same, Wolf redrawn as a wolf's head under the moon. All replaceable by files.

### B. Onboarding
5. [ ] Welcome: no scrolling in any direction on any phone size (a horizontal scroll bar shows now); less crammed; illustration smaller or the title over it once the art allows.
6. [ ] Welcome game tags: floaty idle motion and a wiggle on tap (they look tappable).
7. [ ] Question steps: the scene runs to the very top of the phone, behind the status bar and the progress bar (open sky up there), not cropped under them.
8. [ ] Group-size scene shows four golfers, not five.
9. [ ] Payoff "Nice": better eyebrow; the guide ball must not vanish into the background; replace the money-on-the-hole UI block with a mock-up (illustrated phone with a scorecard, in the chosen art style) or a scene.
10. [ ] Payoff "Settling up": fix the high five (hard to read, the motion lines have no contrast); rethink the "6 debts to 3 payments" graphic.
11. [ ] Payoff "Math": its own illustration, not the clubhouse again.
12. [ ] Payoff "So you're the bank": better eyebrow than "About that"; the "Birdie Bank x4" card becomes a fun stylized moment, not a plain list.
13. [ ] Green check marks (review step and everywhere the same colour is used): a bright, playful green, not near-black.
14. [ ] Final review step ("Your group", floating "You're the bank" tag): Mobbin review-screen examples, then redesign; drop or reword the tag.

### C. Setup and Round ready
15. [ ] Course search: clear the input once a course is picked.
16. [ ] "When are you playing?": decide if it can be skipped when nothing's planned; make the way forward obvious.
17. [ ] Who's invited: redraw the link icon (no square inside a circle, aligned with the text).
18. [ ] Your round / Round ready: an obvious "I'm done" way into the app; back goes to the previous screen.

### D. Up next and themes
19. [ ] Friends row: the crowd illustration is squished and not flush left; fix the banner layout.
20. [ ] Light mode: white cards are hard to see on cream. Mobbin light-mode references, then pick a fix (surface tone, soft shadow, warmer card, not outlines).
21. [ ] Dark mode: card vs background contrast; Mobbin dark-mode references.
22. [ ] Sign out as a visible row in the account section; a "Start over" row to re-run onboarding; the sign-in sheet on a Vercel preview says sign-in isn't available there instead of bouncing to main.

### E. In a round and results
23. [ ] Birdie / eagle critter: pop up when marked, then fade out instead of staying on the score.
24. [ ] "Any side bets?" prompt: add "Not this hole" (or "Remind me later in the round") beside "Not this round" and "Don't show again".
25. [ ] Mid-round milestone after nine on an 18-hole round: a bottom sheet with "halfway, here's where things stand", every score and the standings. Decide per game and for nine-hole rounds.
26. [ ] Results reveal: the title spells out large then snaps small. Either small from the start or a longer, smoother shrink timed with the content arriving.
27. [ ] Results: "See the full breakdown" has no way back; add a back button so the end-of-round flow can be finished.

## Group A notes (2026-10-07)

- **The sheet** is the app itself at `?art` (`src/screens/ArtSheet.jsx`, its own chunk), so it stays current as drawings change and the preview link is the hand-over: `https://<the design2 preview>/?art`. The data behind the labels is `src/lib/art-manifest.js`, and `art-manifest.test.js` fails if a drawing is added without a line on the sheet (or the other way round).
- **Download SVG** writes the theme's colours into the file, so each one stands on its own as a reference for the outside tool.
- **Files replace, never mix:** an outside spot replaces the plate too, an outside scene replaces the dusk tokens (add a `.dark.svg` for dusk), an outside buddy sits on the backdrop the player picked. `crowd` and `highfive` are hand-drawn from the group's own buddies; a file is one picture for everyone, which is fine for the empty states and payoffs they're on.
- **First screen JS:** 508.6 kB, up 2.7 kB from 506.0 kB before this (the hooks in Spot, Scenes, GameArt and BuddyArt); both over the 481 kB budget the design pass already passed. Worth a look before merge, not caused here.
- **Open for Trevor:** keep the road trip scene on the Trip screen, or pull it too? The small guide balls on the payoff steps (the "Nice" ball that vanishes, the high five) stay for group B.
