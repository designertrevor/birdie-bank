# Brand brief

The foundation for the name, logo, colors, type, illustrations and voice. Written from Trevor's interview on 2026-10-07. Read this before any design, illustration or copy work. It is deliberately light: after a few months of testers we may learn the audience is different and adjust. The "Never changes" list at the end is the part that stays.

## Who it's for

Jackson and his golf friends. Young professionals in their 30s, a couple in their 40s, well into their careers, happy to try an app. They have a weekly round booked or an annual trip on the calendar. Every round has a wager, because that is what makes it fun. Today the math lives on a paper scorecard that somebody has to add up, the trash talk lives in the group text, and the planning starts days ahead.

Golf is the highlight of their week. For many it is the only time they see friends outside family. They never go to dinner together, but they golf together every Saturday.

## The moment the app is at its best

Before the round and after it, not during.

- **Before:** sitting at work, bored, counting down to Saturday. The app gets to add to that anticipation: the plan, who's in, the game, the trash talk.
- **After:** the math is done, nobody argues over the card, the winner gets to relish it, and everyone can look at the leaderboard and the record.
- **During:** mostly one phone, one scorekeeper, everyone else is trying not to stare at a screen. The app helps them focus on golf by taking the scorecard off their mind. Keep mid-round quick and quiet. Celebrations mid-round are a bonus, not the main event.

## How it should feel

Open it: **anticipation, excitement, competition.** The same feeling as a tournament coming up, minus the nerves, because it is buddies, not a tournament. Not a casual stroll either. These are people who love to compete and have fun doing it.

## What it must never feel like

- **Pressure.** Golf is hard and golfers already stress about getting better. The app never adds to that. It makes an already exciting round better.
- **Cutesy or childish.** Duolingo gamifies well but is over the top, with too many treasure chests and taps. We are more mature than that.
- **A sports betting app.** No NFL or college football betting energy. The money is light.
- **Stuffy, rich, snotty golf.** We borrow the old look of golf, not the old culture.

## Money

It is about bragging rights, not cash. Nobody is getting rich. Bets are small and friends roll balances over for months because wins keep trading hands. Playing against friends takes the pressure off playing against yourself, which is the real reason people love it. Money UI stays calm and never overwhelming. "Roll to next time" is as important as "I paid".

## Humor

A big part of the brand. Humor keeps golf from getting too serious. The jabs can be funny, but never corny, never dad jokes, never over the top or cheesy. Think of a friend who is quick, not a comedian who is trying.

## The buddies (ball characters)

Garnish, not mascot. No Duolingo owl. They live inside the app to make moments feel alive instead of like a stale screen: a face on a win, a sad face on a loss, a little personality and competitive edge. Never over the top, and not on the logo.

## Visual direction

**Warm and a little retro, with modern culture.** Golf is an old sport and the look nods to that (cream, dark green, old scorecard warmth). The culture is modern golf: YouTube golf, buddies going out to have fun, not a sign of wealth.

**Color.** Keep the current palette. The cream canvas, near-black ink, deep teal and especially the hot pink. Pink stands out in a male-skewing sport and reads as modern. The one rule: the hex values must not be copies of Clay's design system, which the theme was first modeled on. See "Palette" below.

**Type.** Bricolage Grotesque for display, Inter for body, for now. Revisit only if the logo leads somewhere else.

**Illustration.** Decided 2026-10-08 after three test sets: deliberately dorky. Drawings look like a person with opinions drew them, golfers are slightly wrong on purpose, and the copy matches ("Clubs packed. Standards low."). Two tiers in one family: goofy flat humans for scenes and big empty states, flat badge-style stickers for anything under 100px (game art, critters, buddy faces). Humans own the scenes; Ball buddies are avatars. AllTrails park stamps remain the reference for the badge tier. Headspace is the maturity floor, not the target. Full rules and the starter batch in `BRAND-ILLUSTRATION-BRIEF.md`.

**Data.** Cal AI and Monarch for mini dashboards and empty states. AllTrails for easy layout and data shown well.

## Brands to borrow from

Notion (aesthetic designers respect), Granola (fresh branding), Truebill before Rocket Money (the fun version of a money app), Monarch (money that is enjoyable to use), AllTrails (layout, park stamps, data), Cal AI (mini dashboards, empty states), Headspace (illustration maturity). Robinhood, maybe, but probably too far.

## Principles

1. **Fun first, never pressure.** If a feature could make a golfer feel judged, soften it or cut it.
2. **The round is the hero.** The app is the caddie: loud before and after, quiet during.
3. **Bragging rights over bankroll.** Money is small and calm; the win is what gets celebrated.
4. **Old golf look, new golf culture.** Warm and retro on the surface, buddies underneath.
5. **Funny like a friend.** Quick jabs, no dad jokes, no cheese.
6. **Characters are garnish.** They add a face to a moment, never a mascot to the brand.
7. **Works for 20 to 50.** Weekly groups and annual trips, whoever shows up.

## Name

Needs to be catchy and memorable, that is the whole bar. Two front-runners:

- **Teetab.** Symmetrical (two three-letter words, both starting with T), so the logo can be a ball on a tee between them. "Tab" says what the app is about. Passed the store, domain and trademark sweep on 2026-09-30.
- **Teepals.** Says it is for friends who play a lot of golf and compete for fun. "Pals" could sound kiddie but people in their 40s do say they golf with their pals. The singular "Teepal" was cut earlier over PayPal's "-pal" enforcement; the plural is being re-vetted.
- **Ball buddies** stays the name of the characters, not the app. It is not golf-specific enough.

See "Name sweep" below for the vetted list.

## Never changes

Even if the audience turns out to be 22 or 55, keep these: it is fun, it is for friends who compete, it never adds pressure, and it gives people more golf to enjoy between rounds.

## Palette

Checked against Clay's live stylesheet on 2026-10-07. None of our 20 tokens is a Clay value. Clay's accent is a blueberry blue, its pinks are red-leaning (pomegranate) or magenta (dragonfruit), and its darks are warm brown. Our pink sits between their two pinks, our ink is neutral, our dark mode is green-tinted. Clay's fonts are Roobert and Canela; we share only Inter, which is generic. "Clay-inspired" in the stylesheet header means the mood (cream, black ink, one hot accent, fruit-colored pops), not the values. No change needed.

Three tokens sit within shouting distance of a Clay swatch. Optional nudges if we ever want more distance, none of them change contrast:

| Token | Now | Nudge | Why |
|---|---|---|---|
| lav | #b8a4ed | #aea4ed | a touch bluer than Clay's ube |
| peach | #ffb084 | #ffa484 | a touch redder than Clay's tangerine |
| ochre | #e8b94a | #e8a94a | a touch deeper than Clay's lemon |

Keep the pink exactly where it is: #ff4d8b on big shapes, #d42a6b behind white text, #c92463 for pink words. Shifting it red-ward moves it toward Clay.

**Working palette (light):** canvas #fffaf0, surface #f5f0e0, card #ffffff, ink #0a0a0a, body #3a3a3a, mute #6a6a6a, pink #ff4d8b, teal #1a3a3a, coral #ff6b5a, ochre #e8b94a, mint #a4d4c5, lav #b8a4ed, peach #ffb084. Dark mode keeps the same accents over #121615 canvas and #1a1f1e cards. Full token list in `src/styles.css`.

**Illustration palette.** Game art and spot illustrations use the AllTrails park stamp recipe: a badge or stamp shape, 3 to 5 flat colors from the palette above (teal, ochre, mint, peach, coral, with pink as the rare pop), chunky silhouettes with no outlines, and a light ink-grain texture so they read as printed, not digital. One accent per stamp, cream or teal as the ground.

## Name sweep

Run 2026-10-07: App Store and Google Play (exact and with "golf"), RDAP for .app, .golf, get- and play- .com, and the Justia trademark search. Every bare one-word .com is taken, so the bar is .app or .golf plus get/play .com.

**Passed**

| Name | Stores | .app | .golf | get/play .com | Trademark | Read |
|---|---|---|---|---|---|---|
| Teetab | clean | open | open | both open | nothing, "tee tab" clean too | the real brand: zero collisions, "tab" is already the money screen, warm bar-tab feel, says golf in one syllable |
| Puttpot | clean | open | open | both open | only an abandoned "2 Putt Pot" from 2016 | fun to say, "pot" is the group kitty; a bit more wager-flavored and a little putt-putt kiddie |
| Needler | no exact app | taken (dead site) | open | both open | comics and candy only | pure trash talk, but names the behavior, not the friendship |
| Bettertab | clean | taken | open | both open | card games only | open but nobody would guess golf |

**Teepals: weak, not cut.** Stores and domains are open and nothing "pals" shows up in golf. Two risks stack: "TEE PAL" is a pending USPTO application (serial 98182789, class 28, a golf tee gadget, filed 2023-09, never examined), and PayPal has a history of opposing PAY- and PAL-formative marks in payments. They have been much less active against bare -PAL names, but an app whose Tab settles who owes whom with pay links sits closer to payments than is comfortable. Usable only if we accept both risks and clear it with a trademark lawyer first.

**Cut this round:** Teepot (teepot.app is a shipping "who owes what for the golf trip" app, our exact pitch), Teeparty (live golf tee-time app mark), Needle, Banter, Heckle, Teebox, Nineteenth, Lipout, Greenside, Divots, Teeup, Sandy, Juice, Pressbox, Stakes, Chirps, Duffers, Hacks, Clubtab, Backnine, Frontnine. Each has an exact-name app, a golf app with the name, or a betting-app read.

**Recommendation:** Teetab. Before buying anything: a proper trademark clearance and a registrar price check (.golf can be premium). Then buy teetab.app, teetab.golf and getteetab.com, set up SMTP on the domain, and start the quick logo (ball on a tee between the two words).
