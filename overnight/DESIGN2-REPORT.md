# Design pass 2: review of the visual design pass, with Mobbin

Run on 2026-10-07 (day), on Trevor's Mac with the Mobbin MCP, on branch `feedback/design2`, which stacks on the cloud session's `main-mb9pod` (the 60-item design pass). Nothing here touches main. Weekly usage was at 91% when the run started, so this report is written to survive a pause.

## What Trevor asked for

1. Look over the cloud session's design pass with real reference screens from Mobbin.
2. The white Ball buddy on a white card in light mode looks cheap. Keep him off white, and try bigger, edge-to-edge scenes (buddies on a course, in a car on a road trip) where an illustration owns the top of the screen, like the Giddy, Orely, mymind and Aaptiv examples.
3. Choose a game: a custom spot drawing per game instead of small black icons, for colour and fun.

## Built this run (3 commits on `feedback/design2`)

### 1. Game art (`src/components/GameArt.jsx`)
Every one of the 22 games and the extra side games (Birdie pot, Closest to the pin, Long drive) has its own small drawing on a rounded backdrop coloured by its group: Classics ochre, Head to head pink, Team mint, Full round lavender, Points peach. Same palette and stroke as the Ball buddies. Used on Choose a game (rows and tiles), the onboarding game tiles and the Add a side game sheet, so they read as a shelf of stickers.

Mobbin references that shaped it: category pickers where each tile carries its own illustration on a tint, [Whatnot](https://mobbin.com/screens/841a33b9-2388-4c53-8c36-c3c48829093f), [Speechify](https://mobbin.com/screens/3efc1b9a-3a6c-4385-bb4a-71dabda1fb04), [Vocabulary](https://mobbin.com/screens/260b6782-1b1a-427d-9c49-096dfb5ad2a4) and [Hypelist](https://mobbin.com/screens/48c546eb-dc9e-42fd-98f5-87127e8324f3).

A few drawings to glance at: Match play (two balls and a bolt), Alternate shot (one ball, two players), Bingo Bango Bongo (three numbered prizes), Nines (the 5-3-1 pie). Any you don't like, say which and what it should show.

### 2. Scenes (`src/components/Scenes.jsx`)
Three full-bleed settings drawn 400 by 240 and cropped from the sky down, so the buddies stay in view at phone width:
- **course**: the first tee, fairway to the green, a bunker, a bag, the group on the tee box.
- **clubhouse**: the 19th hole patio, umbrella table, coins on the table, the group around it.
- **roadtrip**: the car packed with bags on the roof, two buddies in the windows, mountains ahead.

Each uses `--sc-*` tokens, so dark mode gets dusk, a moon and darker grass instead of a pasted-on day.

Where they show: the welcome (the course, edge to edge into the status bar, in place of the ring of buddies on cream), the games and group-size questions (the course), the settle and math questions (the clubhouse), and the Trip screen before anything's played (the road trip).

Mobbin references: full-bleed onboarding scenes with the headline below, [TheFork](https://mobbin.com/screens/241a59fc-4c35-4040-9c09-7066c8a85a69), [Life Reset](https://mobbin.com/screens/e9393bdd-40fa-49df-8820-abc39d86c8f2), [Copilot](https://mobbin.com/screens/9e81c44b-222a-4936-8c60-5f2d7d428e03) and [Liven](https://mobbin.com/screens/3eb0162b-13f1-4f14-9a8b-352b1a14433a).

### 3. Plates on the spots (`Spot.jsx`)
Every spot illustration at card size now has a soft blob of colour behind it (its own colour per scene), so the white ball never sits on a white card: the Plan ahead and Big Game tiles, the empty states, the join steps, the Suggest and What's new screens. The plate is off where the spot already sits on colour (the Up next hero, the results hero, Round ready, callouts) and on anything under 56px.

### 4. Play: first names on the score rows
With the buddy beside the name and the stepper on the right, a full name ("Trevor Nielsen", "Dave Ortiz") wrapped to two lines on every score row. The rows now use the app's short names (first name; a last initial only when two people share one), the same helper the chips use. Teams keep their team name.

### 5. A gallery for checking art
`?gallery` (and `?gallery&theme=dark`) in dev shows every scene, game drawing, card and spot on one page. Not in production builds. (2026-10-07, after the review: it became the art sheet, `?art` on every build, with where each drawing shows, a download per drawing and the import path for outside files. See `DESIGN2-FEEDBACK.md`, group A.)

## Reviewed with the seeded phone (Trevor, Mike, Dave, Sam; five rounds; a Bandon trip)

Looked at in light and dark at 375px: welcome and every onboarding step, Choose a game, Up next, the Tab, Players, History, a round's results and scorecard, the Trip screen, Settings, Play (the Banker bets step and the scores step), Hall of fame for the Saturday crew and What's new. All render without errors with the design pass; lint clean, 2,205 tests pass.

What held up well, no change made: Hall of fame's crowned leader and podium, What's new's hero card, the results podium and crowned winner, the grouped standings, the Tab's "All square with Mike and Sam" line, Players' nemesis card, History's season chart, Settings' profile-first layout.

## Questions for Trevor (answer in any order)

1. **Game art set:** keep the group colours as they are, or one colour per game? Any drawing to redo?
2. **Welcome scene:** the course runs into the status bar. Keep that, or leave the status bar on cream?
3. **Question steps:** the scene is 176px tall on the games and group questions. Shorter (say 140) so the tiles sit higher, or keep?
4. **Payoff steps** ("Banker. Good taste.", "So you're the bank.") still use the small guide ball with no plate, over the cards. Give them a scene too, or keep them quiet since the card carries the message?
5. **Plates:** the colour per scene is fixed (tee mint, suitcase peach, bulb lavender...). Fine, or should the plate pick up the card's section colour?
6. **Trip screen:** the road trip scene shows until the first round is played. Keep it through the trip (with the standings under it), or drop it once play starts as now?

## Still to do (not reached this run)

- The first-tee card and the moments on Play against Mobbin live-score references.
- Round ready and the invite card.
- The heads-up sheet (needs push configured), the piled reminder cards on Up next and the year in review image, which the cloud session couldn't see either. Hall of fame and What's new were seen this run and hold up.
- Oura-style data screens for the Tab, Your stats and the handicap trend (roadmap area 24).
- Trip standings before the first round say "Tees off Fri" instead of dashes (area 24).
