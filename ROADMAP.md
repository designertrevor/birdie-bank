# Birdie Bank roadmap

The plan for growing Birdie Bank into a $10k/mo business, and the checklist we work through to get there.

## How to use this file

- **Every new thread:** read "Current focus" first, then the step it points to.
- **When something ships:** change `[ ]` to `[x]`, add the date in parentheses, and update "Current focus" and the progress log at the bottom.
- **Partly done:** the item stays `[ ]` and starts with `(partial)` plus a note on what exists.
- **Step tags:** `S1` to `S5` say which step an item belongs to. Work the current step's items before later ones.
- **New ideas:** add them to the right area with a step tag. If none fits, add a new area at the end.
- **Gates:** don't move to the next step until the current step's gate is met. Record when it is.
- **Build what's asked for:** big features nobody has requested wait until the feedback (area 20) shows people want them.
- **Quality is ongoing, not a gate:** bugs, a fluid experience, and the right features and games for each kind of user get attention in every step. Playing real rounds is how we find them, not something to wait on.

---

## Current focus

**Step 1: Foundation, nearly done. Step 2 is well under way.** Accounts, cloud data, invites, the live money bar, the simpler setup and the end-of-round settle-up are built, and Google sign-in is open to anyone. All SQL is run in Supabase (feedback, reactions and the upcoming-rounds tables, 2026-09-28), so "Suggest something", reactions and the group plan link are live. Left for S1: custom email (SMTP) so sign-in emails reach anyone, waiting on the app's final name and a domain. Real rounds keep going alongside as testing: fix bugs, smooth rough spots, and check each kind of user has what they need.

**Shipped to main 2026-10-07 (overnights 9 and 10, with Trevor's review answers):** house rules for every game, Just playing, request links for every app, the age check, 25 game rule pages, branded link pages, the public roadmap with votes, comments and jabs, the trip page polish, a version check with Update ready, What's new, push notifications and the ask at the right moment, the tee time reminder, the handicap trend, the year in review and profile cards, each crew's hall of fame and season money list, field skins house rules for the Big Game, draft terms and a Help link, and the store keyword and creator research. All three SQL files (`2026-10-07-challenge-talk.sql`, `2026-10-07-roadmap.sql`, `2026-10-08-push.sql`) are run in Supabase (2026-10-07), so roadmap votes and requests and challenge trash talk are live. Left for Trevor: the push env vars in Vercel (see `overnight/O10-REPORT.md`); push stays silent until they're added.

**Shipped overnight 2026-09-27 (wave 1):** the nine money rules, Snake and Hammer (18 games), skins and Nassau house rules, the Up next home tab and new nav, History by month with a chart, Run it back, the Tab by person with payment apps for everyone and honest head-to-head, Player cards, several rounds in progress, fixing a finished round without reopening it, the invite card with seat tiles and "Add me", adding a player mid-round, and the approved copy audit (the money screen is now the Tab).

**Shipped overnight 2026-09-28:** upcoming rounds (area 21): plan ahead, who's in with a nudge, the group vote on the game and the bet, the RSVP link for friends, the morning text and the roll call. The SQL is run, so the group link is on.

**Shipped overnight 2026-09-28 (onboarding):** organizer onboarding: four questions one a screen with payoffs, "Here's your group", then "Set up your next round" straight into the plan flow (the first game they play is suggested, the others go on the ballot). The paywall (option C, trial with a free way out) is built as a preview behind a flag: open the app with `?paywall=on` to see it, `?paywall=off` to hide it. Placeholder prices, nothing charged.

**Shipped to main 2026-09-29 (built overnight on `overnight3/next`):** several games in one round (a main game plus Skins, Junk or a Birdie pot, one money total with a by-game table, one settle-up); adding a player picks their games; one scorekeeper per shared round who can hand off the card; up to 5 named usuals; "Fix this hole" and "Course and tee" mid-round; one shared Tab for shared rounds ("I paid" and "Didn't get it?" on both phones, the who's square strip, "Roll to next time"); the free promise on the Tab and a Season preview behind the paywall flag; "Lately" on Up next; and report fixes a to g. The round payments SQL is run, so the shared Tab and carry-overs sync between phones.

**Feedback fixes, shipped to main 2026-09-29:** add a side game mid-round, Snake and Rabbit as side games with clashing pairs blocked, Banker's "Low" rotation and Birdies double, the round menu in groups with feedback first, and the scorecard key kept on one line per mark.

**Follow-ups, shipped to main 2026-09-29:** the shared Tab and carry-overs count only rounds both phones have, so both phones show the same amounts; "Paid part of it?" on each Tab card; a side Skins game's house rules in one line; side games on the planned-round ballot; asking for the card with a 2-minute countdown; the free list held behind the paywall flag in production; hole fixes saved to your copy of the course for next time.

**Nothing is held back until launch (2026-09-29):** testers get every feature, Pro included, with no Pro labels. The Season view on the Tab is open to everyone who has played. The free and Pro split below is the plan for launch day, not something to gate now, and early testers get Pro for life. The paywall, the free promise and the Pro preview stay built behind the flag (`?paywall=on`) for when launch gets close.

**Fixed 2026-09-30 (from Trevor):** planning a round now asks 9 or 18 holes on the When step, and the organizer can edit a plan's day, tee time, course or holes instead of deleting it and starting over.

**Fixed 2026-09-30 (from Trevor):** "Schedule for later" now sits at the end of setup too (Bets step, Round ready, and End round before any holes are scored), carrying the game, course, bets, side games and players into a plan the group can open from the link.

**Fixed 2026-09-30 (from Trevor):** duplicate players (two Adams, two Daltons) can be merged from the player's edit screen, with Undo, and people from joined rounds can be edited.

**Shipped to main 2026-09-30 (overnights 4 and 5, Trevor's Banker round, and his review answers, `ea35f1a`):** one friend is one person (seat claims, "Same person as...", and merging duplicates from the edit screen all run on one linking system); side bets change mid-round; play for Money, Points or a reward (lunch, a drink, your own); usuals fill in planned rounds; the handicap % hint and a % for each game; half strokes; blind wolf (off by default, always more than lone) and a Hogan dot; house rules for every game but Quota; Canadian and validated skins; the first-tee rules card with "What we agreed"; big moments in every game; favorite courses and Courses near me; rivalry cards and "Your nemesis"; a backup file in Settings; handicaps as a choice that can change mid-round; Banker bet chips; and what's on the line kept at the top. The keeper lock SQL is run (2026-09-30), so only the scorekeeper's phone changes a live round. All open to everyone, nothing labelled Pro.

**Shipped to main 2026-10-03 (overnight 6, built the night of 2026-09-30):** the profile foundation (a profile for each account, claimed seats linked to the account so nobody merges by hand, Ball buddies avatars and photos, home course, privacy with money hidden by default, profile stats, Delete your account), two-player side bets (match, per hole, closest to the pin, custom, with strokes only between the two) and "Where it comes from" on the settle-up and the Tab, the trip tab (Trip card on the Tab, the trip's rounds on Up next, standings, "Count it for the trip?", Settle the trip), moments for Sixes, Banker and Hammer, five small fixes, "Request this course", and no forced update while a round is going on. `supabase/2026-10-01-profiles.sql` is run (2026-10-01), so profiles reach other phones and Delete your account works.

**Shipped to main 2026-10-03 (Trevor's overnight 6 answers):** critters and more Ball buddies, "Everyone" for who sees your money, a friend's own profile name and payment app on your phone; side bets reprice the whole bet when changed, lunch rounds pick money or points per bet (money bets pay between the two players and count in trips), either player changes their bet, side bets on the invite card, scramble matches across teams; Settle the trip in the fewest payments from one plan the organizer's phone publishes, Who's going, trip cards until you hide them, only the organizer deletes (before any trip money) and others Hide this trip; each player's score to par on the scorecard, Back from Add a course fixed, Courses near me at 2 searches. Both SQL files (`2026-10-03-privacy-everyone.sql`, `2026-10-03-trip-plans.sql`) are run.

**Shipped to main 2026-10-04 (overnight 7 and Trevor's review answers):** the rest of mid-round settings; challenges (also set up by the organizer for two others, moving with a rescheduled plan); "Any side bets on this hole?"; plans keep the whole setup, and plans and seat links are locked down; the countdown and preview card; the day-after recap and callouts; trash talk and reactions; Best ball, Shamble, Alternate shot and Chapman; closest to the pin and long drive pots; Ryder Cup trips with foursomes and a stake on the Tab; trip expenses; Your stats; Quota and 16 more house rules; one profile privacy setting. Six 2026-10-04 SQL files are run, and `2026-10-05-profile-privacy.sql` is now run too.

**Shipped to main 2026-10-05 (overnight 8, `97fc006`):** the Big Game (several groups, one game, one pot and one settle-up), following friends' rounds live with friends' rounds and the group in the feed, a tab per crew or trip with Close the books, the tee time reminder and gentle payment nudges, Trip Mode templates, flights and a live captains' draft, easy sharing into the group text, and keeping your place after switching apps. The profile privacy, Big Game and friend feed SQL is run. `supabase/2026-10-06-round-codes.sql` (locks live rounds, payments, plans and challenges behind their codes) runs about a day after the ship, once phones have reloaded the new build.

**Polish 2026-10-06 (from Trevor, on `feedback/floating-sheets`):** sheets float as rounded cards inset from the screen edges, with a raised surface that reads clearly against the page in dark mode.

**Next in S2:** real payments for the paywall test (Stripe, area 11), talks with the three head pros (area 23), the rest of mid-round settings (teams, order, play for), "Any side bets on this hole?", and the quick logo once the name is picked (area 16).

**The big date:** the creator test (S4) runs February to April 2027, when golf season starts back up. Everything before it is about being ready: a product groups keep using, a smooth path from video to paying, and an App Store app.

Last updated: 2026-10-06 (floating sheets)

---

## The vision: $10k/mo, about 12 to 18 months out

These are illustrative targets based on typical consumer subscription apps, not a forecast. The prices and plans below are placeholders until testing shows what people will pay for (see open questions). Paid creator marketing (S4 onward) is what makes it roughly a year instead of 2 to 3.

- **Money:** about $11.6k/mo before fees, about $10k after Apple, Google and Stripe fees
- **Payers:** about 2,100
- **Monthly active golfers:** about 28,000
- **Signed up all time:** about 90,000
- **Rounds on a busy Saturday:** about 6,500

**The organizer model.** Every group has one person who sets up the game, keeps the card, does the math and chases people on Venmo. That person pays. Everyone else joins free from a link. The number that matters is the share of organizers who pay, with a target of 20% or more.

**A reason to open it every day.** Cal AI gets used daily by one person. Birdie Bank's round is once a week, so the days between rounds have to be fun too: setting up Saturday's game, who's in, the bets, trash talk, settling last week's tab, and watching friends' rounds. See area 21.

**Revenue mix**

| Stream | Price | Count | Monthly |
|---|---|---|---|
| Pro (organizer), mostly annual | $49.99/yr or $6.99/mo | ~1,750 | ~$7,100 |
| League / Club | $19/mo per league | ~120 | ~$2,300 |
| Event Pass (trips, member-guests) | $14.99 one time | ~150/mo in season | ~$2,200 |

**Free forever:** join any round by link, live scores, all games, settle-up with pay links and the Tab for what's owed, carry-overs between two people, trash talk in your group's rounds. Invited players never see a paywall.
**Pro (organizer), with a 7 to 14 day free trial that covers their first real round:** the season-long tab across every round, "our usual game" one-tap setup, setting up upcoming rounds, every course, season stats, results images, unlimited rounds at once.

**Positioning:** "The bank for your golf game. Play any game, settle every bet, keep the tab all season."

**The killer moment:** the end of the round. Every game and press totals up in one animated moment, then the fewest payments appear, each with a one-tap Venmo link. This is the "wait, do that again" feature, and what creators will film.

**What makes it different**
1. Built around the games, not the scorecard, with every game's rules and money right
2. A season-long tab, not just one round's settle-up
3. Friends join from a link with no download
4. Fun all week, not just on the course
5. A designer's taste: fast, calm, no ads, no GPS clutter
6. Every feature judged by whether it saves the organizer time or makes the group's week more fun

**Not doing:** GPS, swing tracking, booking tee times (reminders and links to the course's booking page are fine), holding or moving money, ads or sponsor placements inside the app.

**When people ask for GPS:** the answer is "keep your GPS app, Birdie Bank plays nicely next to it." Golf GameBook's GPS draws more angry reviews than anything except its paywall (wrong yardages, greens in the wrong place, only center of the green on the watch). A half-built GPS would cost more stars than it earns. Revisit only if the feedback table shows it's the top reason groups leave, and even then look at partnering or linking out before building.

**Team at $10k:** Trevor at 15 to 25 hrs/week with Claude Code, one part-time helper (~10 hrs/week) for support, community and creator deals, and 8 to 15 "club captains" who get a free League plan.

**Metrics to watch**
- Rounds per week (the main one)
- Days per week people open the app between rounds
- Rounds per organizer per month
- The share of invited players who start their own rounds
- Organizer to Pro conversion (target 20%+)
- The share of paid plans that are annual (target 70%+)
- Spring renewal rate
- **Creator benchmarks** (from Jake Castillo, Cal AI): more than 5 downloads per 1,000 views, more than 75% of installs reaching the paywall, more than 10% of those paying

**Risks**
- Golf's off-season: lean on annual plans, and time creator spending for spring
- How app stores and clubs see betting: never hold money, say "friendly games," tag paid posts #ad, get one legal review
- Paying creators before groups keep using the app burns the budget, so the S2 gate comes first
- Big competitors copying the tab
- Organizers not wanting to be "the one who charges"

---

## Lessons from Golf GameBook

Golf GameBook is the app golf YouTubers use (about 19,000 App Store ratings, mostly 4 and 5 stars). We read its 1 and 2 star reviews on 2026-09-25 (109 of about 1,175 recent reviews in the US, UK, Canada and Australia). What people hate, and the rule we take from each:

1. **Taking free things away.** In 2023 they moved adding friends, Stableford, match play, stats and hole maps behind Gold, and raised prices from about $24 to $35 a year up to $80. Loyal 5 to 10 year users left in anger. **Rule:** publish what's free forever and never take it back. Early payers keep their price.
2. **Everyone in the group has to pay.** "Asking 30+ in a society to pay £20 each ain't gonna happen." **Rule:** the organizer model. Invited players never see a paywall.
3. **Paying blind.** No trial except on the annual plan, and you can't look around first ("Hostage Taker"). **Rule:** a free trial on every plan that covers a real round, and a Pro preview before paying.
4. **Ads and creator promotion inside the app.** "One giant ad for brands and Good Good." Viewers who came from YouTube felt sold to. **Rule:** no ads, no merch, no sponsor placements. Creators promote us outside the app, and the app just has to be good.
5. **Breaking on the course.** Scores that can't be entered, a 5-round trip locked out on day 2, deleted groups, logouts, forced updates, rounds that won't end, needing signal. **Rule:** round day is sacred. Offline first, never lose a score, never block a round for an update, and ending a round is one forgiving tap.
6. **Wrong course data.** Wrong pars and handicaps, missing courses. **Rule:** the organizer can fix a hole for their group on the spot.
7. **Games too shallow.** "You can't fine tune formats," "could use more games." **Rule:** every game has the house rules real groups use.
8. **Organizer tools removed.** The desktop game manager, printed pairings and cart signs, easy multi-group setup, scoring for guests. **Rule:** the organizer is the customer, so never cut what saves them time.
9. **Confusing design** for more than 10 years, and slow or missing support and refunds. **Rule:** calm and obvious, and a real person answers.

What they don't do at all: money. No settle-up, no tab, no payment links. That's the opening.

---

## The steps

Each step has a gate. Don't move on until it's met.

### S1: Foundation (now to November 2026)
Accounts, cloud data, invites turned on in production, joining from a link, claiming your seat, the simple feedback form, a quick logo.
- **Gate:** anyone can sign in (Google or email), and "Suggest something" saves to Supabase in production. Real rounds and bug fixing carry on through S2 rather than holding it up (changed 2026-09-26; it was 8+ real rounds with zero hand math).
- **Gate met:** not yet

### S2: Proof and the path to paying (fall and winter 2026)
10 groups you don't know, playing in the Sun Belt if the north is out of season. Several games at once, "our usual game," the shared tab, every course, setting up rounds ahead of time, carry over proposals, the killer end-of-round moment, organizer onboarding questions with a paywall and free trial. Slack community and the feedback automation. Finish the brand foundations.
- **Gate:** 5+ of those groups still using it after 4 weeks without nudging, organizers opening it on days they don't play, and some of them paying when the paywall turns on.
- **Gate met:** not yet

### S3: Launch ready (winter 2026 to 2027)
App Store and Google Play apps, in-app purchases, push notifications, trash talk and the group's weekly feed, results images and link previews, store screenshots and video, a simple website with the game rule pages, analytics that show which creator sent each download, legal pages. Build the creator list and price each deal.
- **Gate:** live in both app stores, the path from download to paying tracked end to end, and 20+ people outside the test groups getting through onboarding with 75%+ reaching the paywall.
- **Gate met:** not yet

### S4: Creator test (February to April 2027)
$5k: $4k on 10 creators at $300 to $500 each (flat fee, paid upfront, reuse rights included), $1k held back. Two-minute brief, then let them make the video. Start with creators in warm-weather states.
- **Gate:** at least 2 creators hit the benchmarks: more than 5 downloads per 1,000 views, more than 75% reaching the paywall, more than 10% of those paying.
- **Gate met:** not yet

### S5: Scale to $10k/mo (spring 2027 onward)
Put more money into the winning creators and copy their video formats with others. Then leagues, events, the wider friends feed, year in review, referrals, club captains, a part-time hire, pricing tuning, growth outside the US.
- **Gate:** $10k/mo after fees.
- **Gate met:** not yet

---

## The checklist by area

### 1. Accounts and cloud data
- [x] `S1` Data saved on the phone, with a backup file you can export in Settings. Built 2026-09-30 (overnight 5): "Back up your data" saves one versioned file; "Restore from a backup" adds what's missing or replaces everything
- [ ] `S1` (partial) Sign in with Apple, Google, or a phone number or email link. Google and email link work (2026-09-25), and Google sign-in is public. Email only reaches Supabase team members until custom SMTP is set up. Apple comes with the App Store app (S3); phone numbers are skipped for now.
- [x] `S1` Rounds, crews and the tab saved to the cloud and shared across devices (2026-09-25)
- [x] `S1` Claim your seat: a guest player becomes the real person when they sign up, and their history and tab come with them. A guest who joins from a link plays as their seat in that round, and signing up saves those rounds to their account. The organizer's copy of that player is linked to the real person too (2026-09-30): taking a seat from the link records a claim, every phone in the round links its copy to that person, and "Same person as..." on a Player card merges two cards by hand, with "Not the same person" and Undo. The Tab, History, head to head, Season, Lately and Players treat linked ids as one person, and each round's money never changes. No SQL needed.
- [x] `S1` Move each phone's existing local data into the account (2026-09-25)
- [x] `S1` Offline first: scoring keeps working with no signal, changes queue and sync when signal returns, and a score is never lost or overwritten (2026-09-25)
- [x] `S3` Delete your account (Apple requires it). Built 2026-10-01 (overnight 6, shipped 2026-10-03): "Delete your account" under Sign out in Settings, with a warning, a server check and a final confirm; it removes your profile, links, photos and saved data, and friends keep your name and every amount in their rounds. `supabase/2026-10-01-profiles.sql` is run (2026-10-01).

### 2. Profiles
- [x] `S1` Players have a name, handicap index and Venmo username, saved to your account when signed in (2026-09-25)
- [x] `S3` Your own profile: photo, home course, handicap, which payment apps you use. Payment app and handle since 2026-09-27; your profile screen (from the top of Settings or your Players row) with name, handicap, payment app, avatar or photo and home course from saved courses, the course database or a typed name (2026-10-01, overnight 6, shipped 2026-10-03)
- [x] `S2` Player cards: each person shows your record and honest net with them, and opens a card with Request, Remind, Settle up and the round-by-round story. Crews sit in a small section below (2026-09-27)
- [x] `S2` Merge duplicate players: "Same person as someone else? Merge" on a player's edit screen folds a second copy (a saved duplicate, or the copy from a round you joined) into the one you keep. Rounds are never rewritten, the record, the Tab and payments add up under one name, the kept player picks up a missing handicap or payment app, and "Merged in · Undo" splits them again. People from joined rounds can now be edited too (from Trevor, 2026-09-30)
- [ ] `S2` (partial) When a player signs up, offer to merge their account into the organizer's copy of them, using the same merge (see "Claim your seat" in area 1). Test rounds stay out because they're deleted from History, not merged Replaced by automatic linking (2026-10-01, overnight 6, shipped 2026-10-03): a claimed seat links to the account on the server, and two player records on one account are one person on every phone. The profiles SQL is run (2026-10-01).
- [x] `S2` Profile foundation (from Trevor, 2026-09-30): a profile on the server for each account, seen the same on every phone by people you've played with, and every player record linked to an account when that person claims their seat, so nobody gets merged by hand. Includes Ball buddies avatars and photo upload, home course, privacy settings with money hidden by default, and basic profile stats from what player cards already work out. Needs one SQL run. Unlocks one Tab per person across groups, the friends feed, push, leagues and reputation, so it comes before them Built 2026-10-01 (overnight 6, shipped 2026-10-03): a profiles table that people you've played with read through privacy, an account_players table so a claimed seat is the same person everywhere, an avatars bucket and Delete your account, all in `supabase/2026-10-01-profiles.sql`, run 2026-10-01, so people you've played with see your profile on their phones.
- [ ] `S5` (partial) Profile stats: rounds, net winnings, record against each friend, favorite game Basic stats are on your profile (2026-10-01, overnight 6): rounds, record, favorite game, best round and all-time net, money only to you unless you choose to show it.
- [x] `S3` Privacy settings, with money hidden by default Built 2026-10-01 (overnight 6, shipped 2026-10-03): your money shows to Only you (the default) or People you've played with, plus switches for your record, handicap and home course. Hidden money never leaves your phone. Now one setting for your whole profile (2026-10-04, from Trevor): Everyone, People you've played with or Only you, with "Show my money" off by default (`supabase/2026-10-05-profile-privacy.sql`).
- [x] `S3` Avatars: a library of illustrated avatars to pick from, in the app's own style, or upload any photo you like. Shown on player cards, seat tiles, the Tab and share cards (from Trevor, 2026-09-30) Built 2026-10-01 (overnight 6, shipped 2026-10-03): 12 Ball buddies on 8 backdrops (direction A), a photo, or your initials on a color; initials as the fallback; on Players, player cards, seat tiles, the Tab, the reveal, the avatar button and onboarding's name step. Not yet on the share image.

### 3. Onboarding
- [x] Three-step first run: welcome, the "friendly wagers" disclaimer, your name and handicap
- [x] `S1` Two paths: the organizer setting up a game, and the invited player arriving from a link (pick your name, you're in) (2026-09-25)
- [x] `S1` Guests play without an account, then "You won $22. Save it to your tab" leads to sign-up (2026-09-25)
- [x] `S2` Organizer onboarding as a series of questions that sells as it goes: what games your group plays, how many of you, how you settle up now, who ends up doing the math (2026-09-28)
- [x] `S2` Onboarding ends with "Set up your next round" and inviting the group, so a new organizer gets value on day one, not on Saturday (2026-09-28)
- [ ] `S2` (partial) The paywall and free trial at the end of organizer onboarding (see area 11). The screen is built (option C) and shows after planning the next round, but it's UI only and off unless the flag is on; nothing is charged yet
- [x] `S3` Ask for notification permission at the right moment, not on first launch Shipped 2026-10-07 (overnight 10).

### 4. Invites and joining
- [x] `S1` Live shared rounds with a code and link (2026-09-23)
- [x] `S1` Turn on live sharing in production (2026-09-23)
- [x] `S1` Join from the web without installing anything (2026-09-25)
- [x] `S2` Joining from a link starts on an invite card (who invited you, the game, the bets, the course and who's in), then seat tiles, then your strokes, then the round. "Not on the list? Add me" sends your name to the scorekeeper, who lets you in from a note on the Play screen (2026-09-27)
- [x] `S2` One scorekeeper who can hand off the card (decided 2026-09-29, in place of every phone entering scores): "You're keeping score · Hand off" to any player whose phone is on the round, the other players and watchers follow read-only, a player can "Ask for it" and the keeper answers Yes or No; with no answer in 2 minutes (a countdown on the button, "Take the card in 1:42") one tap takes it and the old keeper's phone says who took it (2026-09-29, in place of "take it after 10 quiet minutes"). Seat requests go to the keeper's phone. Rounds already in progress keep any-player editing until the organizer's phone opens them (2026-09-29)
- [x] `S3` A link preview card for group texts (course, game, players). Join links show the game, course and first names; other links show a static card (2026-09-26). Per-round previews work in production since 2026-09-28: Routing Middleware sends preview bots to the function, and the function has the public Supabase values built in.

### 5. Setting up and playing a round
- [x] 16 games with the setup wizard, game defaults, crews, bets that change mid-round, 9 or 18 holes
- [x] `S2` Rules check fixes: every money rule from the rules check built and tested (bets changed mid-round count from the next hole, unfinished legs pay on the holes played, Rabbit set free, Quota scaled to holes played, WHS allowances) (2026-09-27)
- [x] `S2` Snake (three-putts, fixed, growing or doubling, each nine) and Hammer (double the hole, play on or fold, with a cap and who throws first), with rules, money bar and reveal: 18 games (2026-09-27)
- [x] `S1` Money on screen from the first hole of every game, starting at $0 and moving as each score is tapped, with what the hole adds and a toast when it's saved (2026-09-26)
- [x] `S1` Setup asks one question per step, puts the stakes up front with the rest under "More options," and ends on a "Round ready" screen to invite the group before hole 1 (2026-09-26)
- [x] `S2` Several games at once in one round (Nassau plus skins plus greenies): a main game plus up to two side games (Skins, Junk, Birdie pot; up to three with Snake and Rabbit since 2026-09-29), each with its own bet and worked example; Junk chips under each player; one money bar total you tap for a by-game table; the reveal nets every game into the fewest payments. Old rounds show the same money (2026-09-29)
- [x] `S2` Side games on planned rounds: the organizer puts Skins, Junk or a Birdie pot on the ballot, everyone says yes or no to each, and the roll call starts the round with the ones the group wants that fit the winning game. No SQL: they ride in the plan and inside each person's game vote (2026-09-29)
- [x] `S2` Change a side game's bet mid-round: the Bets sheet has a switcher for each game, the same "From hole N on" or "Whole round" choice, pots always change for the whole round, and a Snake or Rabbit under way keeps its bet. The round detail and by-game table say which holes each bet covered. Old rounds give the same money (2026-09-30). A bet changed mid-round stays with that round and never becomes next time's default (2026-09-30, Trevor's review)
- [x] `S2` Add a side game mid-round: "Add a side game" in the round menu keeps the course, players and scores, and the new game counts every hole already scored, so you never set the round up again (2026-09-29)
- [x] `S2` Snake and Rabbit as side games, up to three side games a round. Pairs that pay for the same thing twice are kept apart, from Trevor's research ask: Skins with Rabbit, Junk with Bingo Bango Bongo, a game with itself, and anything on a Scramble (2026-09-29)
- [x] `S2` "Our usual game": saved crew, games and stakes, set up in one tap. "Your usual" on the first setup step repeats the last round's game, course, group and bets (2026-09-26), and up to 5 named usuals (side games included) are saved from Round ready or a finished round, listed first in setup with Rename and Delete (2026-09-29)
- [x] `S2` Usuals when planning ahead: a saved usual fills in the plan (game, holes, course, who's invited, bet, handicap %, side games and what it's played for), the game and bet go to the group vote as the organizer's suggestion, and a round started from the roll call counts as that usual's "Last played" (2026-09-30). Putting usuals behind Pro is part of the launch split (area 11), not before.
- [x] `S2` Skins house rules: net, gross or both, a pot split by skins won, and what carryovers after the last hole do (nobody, split, or a playoff) (2026-09-27). As a side game, a one-line summary of them in setup opens the same options for that round (2026-09-29)
- [x] `S2` Nassau house rules: press at the turn, and no press on a leg's last hole (2026-09-27)
- [x] `S2` Banker house rules: "Low" rotation (lowest score on the last hole banks the next, a tie stays with the banker) and Birdies double (Off, Real birdie or Net birdie: the winner's birdie doubles that bet, an eagle doubles it again, stacking with doubles) (2026-09-29)
- [x] `S2` Round menu in groups (This hole, Games and bets, Players, Round) that scrolls on a small phone instead of running off the top (2026-09-29)
- [x] `S2` More house rules: blind wolf (called before anyone tees off, off by default; always one or two more than a lone wolf, so lone 2x gives blind 3x or 4x, from Trevor's review 2026-09-30), a Hogan dot (off by default) and clearer Arnie wording, both only on par 4s and 5s. Old rounds give the same money (2026-09-30)
- [x] `S2` Bragging-rights mode: play any game for Points (bets count as points, nothing goes on the Tab), with results, records and head-to-head counting it and dollar totals leaving it out (2026-09-30). Setup's bets, worked examples, keypads and the Banker bet chips read in points too (2026-09-30, Trevor's review)
- [x] `S2` Play for a reward: lunch, a drink or a custom reward for the winner. Last place buys by default (a tie splits it), or everyone else owes one; the Tab shows "Dave owes you lunch" with Done and Undo, never in dollars (2026-09-30). Anyone who left early never ends up buying, and the reveal's headline says "Ann wins lunch" (2026-09-30, Trevor's review)
- [x] `S2` Only the players in a round (and the scorekeeper) can edit its scores. Built on the phone (2026-09-29): only the keeper's phone edits a round in progress and sends scores, watchers never edit, and any player can still fix a finished round. Enforced on the server (2026-09-30): `supabase/2026-09-30-keeper-lock.sql` is run, so only the keeper's phone changes a live round, and any player can fix a finished one. Rounds shared before it, or by an older copy of the app, stay open as before.
- [x] `S2` Suggested handicap % for each game (the WHS recommended allowances), shown as a hint next to the Strokes given choice ("Handicap rules suggest 95%"), with a one-tap pill and a 95% button for stroke play and Stableford (2026-09-30)
- [x] `S2` Handicaps are a choice, from Trevor's Banker round (2026-09-30): "Play with handicaps?" is the first thing on the Players step, off for a brand new setup (Run it back, a usual or a plan keeps the group's choice). With it on, each player's handicap shows, anyone without one is flagged "none, plays as 0", and Create round stops to say who would play as scratch, with Add handicaps or Play them as scratch. A missing handicap never quietly plays as 0 again (2026-09-30, on `feedback/sept30`)
- [x] `S2` Handicaps mid-round: "Handicaps" in the round menu turns them on or off and changes each player's tee or course handicap, the Strokes given %, a side game's own % and half strokes. The change counts for every hole, the ones already played too, and the sheet says whose strokes and money move before you save. It syncs to everyone on the link (2026-09-30, on `feedback/sept30`)
- [x] `S2` Every setup setting changeable once the round has started (Trevor, 2026-09-30). In the round menu now: bets and house rules, side games, round length, course and tee, hole par and HCP, add or remove a player, and handicaps (2026-09-30). Still to do: teams or sides, playing order (banker and wolf order), and play for (money, points or a reward) Built 2026-10-04 (overnight 7, shipped 2026-10-04). Play for, sides or teams, Banker and Wolf order, Sixes partners and who throws the first hammer are in the round menu now, each with what money moves before you save.
- [x] `S2` Faster Banker bets (Trevor, 2026-09-30): four common amounts as chips on each player ($1, $2, $5, $10 by default, inside the game's min and max, the default bet always one), then Other, which opens the keypad with $1 to $10 at a tap above the keys. Ten chips a player was too much, and tip and payment apps (Uber Eats, Venmo, PayPal, Revolut) show three or four. Each bet carries over from the last hole that player bet on, last hole's banker included (2026-09-30, on `feedback/sept30`)
- [x] `S2` What's on the line stays in view: "On the line $13" sits in the banker bar at the top, on the bets step and the scoring step (2026-09-30, on `feedback/sept30`)
- [x] `S3` New games: closest to the pin and long drive pots Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [x] `S3` New game: team best ball, best 1 or 2 scores of 4 on each hole Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [x] `S3` New games: Alternate shot, Shamble and Chapman Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [x] `S3` New game: Ryder Cup team points across matches Built 2026-10-04 (overnight 7, shipped 2026-10-04). A trip format with four-ball, singles and foursomes, a leaderboard, and a stake that goes on the Tab between people who played a cup round together.
- [ ] `S5` New games: field skins across several groups, Calcutta, and rolling quota
- [x] `S2` House rules for every game, the variations real groups play. Some exist (modified Stableford, skins carryovers, Rabbit steal or set free and ties, 2026-09-27; skins net and gross together, skins pot split by skins won, what last-hole carryovers do, Nassau press at the turn and no press on the last hole, 2026-09-27; a skins carry stays with the players who built it when someone joins late, 2026-09-28; blind wolf and a Hogan dot, 2026-09-30; wolf and Aces & Deuces ties carry, Vegas birdies double, Sixes halved matches carry, scramble minimum drives, stroke play net double bogey max, Nines win by 2 takes all 9, Bingo Bango Bongo sweep doubles, 2026-09-30 overnight 5). Every game has at least one now except Quota. Go through all 18 games, and add the variations people ask for in "Suggest something." Shipped 2026-10-07 (overnight 9).
- [x] `S2` Ending a round is one tap and forgiving: stopping early, a missing score or a player who left never traps the round open. "A player left" in the round menu, holes with a missing score aren't counted (and the results say so), and finished rounds can't get stuck as active (2026-09-26)
- [x] `S2` The killer end-of-round moment: every game and press totals up in one animated moment, then the fewest payments with one-tap pay links. Each bet resolves in turn (legs, presses, skins, biggest holes), then the totals land, then settle up with Venmo links and Mark paid, then a results image to share (2026-09-26)
- [x] `S2` Big moments during a match, from Trevor's round: in Match play and Nassau a banner drops in for a lead change, all square, dormie, taking the lead and a nine won or halved, with a little confetti and a buzz; the match tile pops when the score moves and a single match names the leader ("Trevor 1 up", not "T 1 up"). A match won before the last hole gets a full "Match over" screen (like finishing a Duolingo lesson) with Keep playing, or Finish the round here when no presses or side games are left. Every phone following the round sees them; a fixed score on an earlier hole never does (2026-09-29)
- [x] `S2` Moments for the other games (2026-09-30, overnight 5): a skin won (bigger when it ends a carry of 3 or more), a lone or blind wolf that wins or loses, a big Vegas swing, the money lead changing hands in any game (and the round's first lead, from Trevor's review), and who won when a skipped last hole is filled in. One banner per hole, none on edits or when a phone catches up. Sixes, Banker and Hammer got their own (2026-10-01, overnight 6, shipped 2026-10-03): a six won, halved or swept and "3 for 3"; the banker sweeping the table, the table beating the bank, a big banker hole and birdie doubles; a hammer accepted and won, a fold, and a hammer back.
- [x] `S3` A no-pressure way in for friends who don't want to compete (Trevor's friend skipped the app on 2026-09-29): be on the card with no bet and no moments aimed at them, or just keep your own score. Needs thought before building Shipped 2026-10-07 (overnight 9).
- [x] `S2` More than one round in progress: starting a round never deletes the one you're in, and "Rounds in progress" in the round menu switches between them. Fixing scores on a finished round keeps it counting on the tab (2026-09-27)
- [x] `S2` "Add a player" in the round menu: their money counts from the hole they join, nobody else's strokes move, and the results say so. Games with fixed sides or an exact head count (Nassau, match play, Vegas, Sixes, Wolf, Nines, scramble, Hammer, Snake) never take a new player, not even before the first score (2026-09-27)
- [x] `S2` Adding a player picks their games: after letting someone in, the scorekeeper switches each game on or off with a reason under it, one start hole for all of them. A late joiner can play the side games when the main game has set sides or is full (up to 8 in the round), sits out a pot that started without them, and never joins a wolf rotation, banker's bets, Sixes pairings or a match's sides (2026-09-29)
- [x] `S2` Side bets between two players inside a bigger round, asked for after Trevor's Banker round (2026-09-30), moved up from S3: a match or per-hole wager between just two players (Preston vs Tyler), closest to the pin and custom bets where you tap the winner, and player-to-player strokes that count only between those two, never in the group game. Each bet is worked out on its own two-player view of the round, like a side game. Data model agreed 2026-09-30: `round.bets = [{ id, kind, sides, stake, holes, strokes, winner }]` Built 2026-10-01 (overnight 6, shipped 2026-10-03): "Add a side bet" on the Bets step and "Side bets" in the round menu, for a match, per hole, closest to the pin or a custom bet, over any run of holes, with strokes between the two only. The keeper's phone records winners, everyone sees them, they ride in the live round (no SQL), sit on the first-tee card, show as one "Side bets" row in the by-game table and a reveal step each. Old rounds keep their money.
- [x] `S2` "Any side bets on this hole?": a light prompt on each hole to help people find two-player bets, easy to dismiss or turn off. Test it for annoyance (Trevor, 2026-09-30) Built 2026-10-04 (overnight 7, shipped 2026-10-04). On hole 1, the first par 3 and the turn, with Not this round and Don't ask again.
- [x] `S3` Several groups, one game ("the Big Game", a Pro headliner idea, see area 11): a weekly game of 8 to 20 players across several foursomes feeding one pot and one leaderboard, team formats, side bets between any members, strokes worked out for each match, a live board for every group and one settle-up. A GolfWRX group says its bets take 90 minutes to figure each week, and only pricey club software does it today (moved up from S5, 2026-09-27; widened 2026-09-30) (2026-10-05)
- [x] `S3` Allowances by format, free for everyone: a handicap percentage for each game (for example 85% in four-ball, full in singles), set once for the round or the whole trip (from the Reddit research, 2026-09-30). Built 2026-09-30 (overnight 5): "Set by game" in setup gives the main game and each side game (Skins, Rabbit, Birdie pot) its own % with the WHS hint. Whole-trip allowances wait for Trip Mode.
- [x] `S3` Half-pops, free: a stroke counts as half, as an option for skins and matches, so big handicap gaps stay fair. Built 2026-09-30 (overnight 5): "Half strokes" in setup, off by default, counts in Match play, Nassau, Hammer, Sixes, Skins and Rabbit; nets show as 4½.
- [x] `S3` Skins fairness options, free: Canadian skins (a natural birdie beats a net birdie) and validating a skin with a net par on the next hole Built 2026-09-30 (overnight 5), for Skins as a main or side game.
- [x] `S3` First-tee rules card, free: strokes, allowances, gimmes, mulligans and presses agreed and locked before hole 1, so nobody argues about them on 18 (Reddit: trips that argue on day one "argued about it all weekend"). Built 2026-09-30 (overnight 5): one screen before hole 1 with "Lock it in" or "Skip for now"; gimmes and mulligans are recorded, not scored; "What we agreed" in the round menu lists every later change by hole.

### 6. Courses
- [ ] `S1` (partial) Three bundled courses plus custom courses you can edit
- [ ] `S2` (partial) Search every course (GolfCourseAPI Pro was the pick after researching providers). Built (2026-09-26) behind a server function, and live since 2026-09-28 on the free plan (35 requests a day across everyone). Upgrade to Pro before the group uses it. Checked against the verified cards: Birch Creek and Logan River match; the database's Preston G&CC hole handicaps are swapped by nines.
- [x] `S2` Courses from the database show a soft "From course database" tag instead of a warning, and players start on the middle tee (2026-09-27)
- [x] `S2` Favorite courses and courses near you. Built (2026-09-30): a star on every course keeps it at the top under Favorites (synced with the profile), then "Courses near me" (asked only on tap, closest first with the distance, cached a day; overnight 5), then "Recently played" (up to 5, never a round you only watched), then All courses. It finds courses by the nearest town's name, so a course not named for its town can be missed. Courses near me now also searches other place names and the towns of courses it finds, up to 5 searches (2026-10-01, overnight 6).
- [x] `S2` Fix a hole on the spot: the organizer can correct a par, stroke index or tee rating mid-round for their group, and the fix goes to the feedback table so the course gets corrected for everyone. "Fix this hole" in the round menu and "Wrong par or HCP?" under the scorecard (the Hole/Par/HCP strip still opens the scorecard), "Course and tee" for rating and slope, a plain line on whose strokes move, the money recounts, and a Fixed tag (2026-09-29). A par or stroke index fix is also saved to the fixing phone's own copy of the course, so the next round there starts right (2026-09-29)
- [x] `S3` "Request this course" when a search finds nothing (see area 20) Built 2026-10-01 (overnight 6, shipped 2026-10-03): an empty search shows "Can't find it? Request this course" with the name filled in, an optional city and scorecard photo, one tap to send (offline too, once per course per phone), and "Add it yourself for now" opens the course editor over setup.
- [ ] `S5` Share reviewed hole fixes with every group, so our course data ends up better than the API's (data a new app can't copy)

### 7. The tab and settling up
- [x] Debts netted across every round, recording payments (including partial ones), Venmo pay links
- [x] `S1` Settle up right from the end of the round: Venmo pay or request links and Mark paid, without leaving for the Tab (2026-09-26)
- [x] `S2` One shared tab for the group: both players see the same numbers, and a recorded payment shows up for the other person. On a round that was shared live, "I paid" or "Mike paid me" on the person card shows on both phones, and the other side can take it back ("Didn't get it?"), one tap with an Undo toast. Money from rounds both phones have stays between the two people (never passed on through a friend), so both phones agree on it; rounds only one phone has still show on the Tab and are paid the old local way. "Paid part of it?" on each person card. Linking the organizer's copy of a player to the real person is in area 1 (2026-09-29)
- [x] `S2` The group can see who's settled up between rounds: a strip on the Tab for your latest shared round ("Last round · Sat, Sep 26", "3 of 5 square") with Square, Owes, Waiting or Carried for each player, status only, never amounts (2026-09-29)
- [x] `S2` **Carry it over:** instead of "I paid," either person can propose rolling the balance into the next round. Once the other person agrees, it's no longer pending or overdue; it stays in the running tab as an agreed carry-over. On the person card: "Roll to next time" with optional reasons, Agree or "I'd rather get paid" ("I'll just pay" when the payer answers), Take it back, "Carried over" with Remind and Request hidden, its own line in the person's story, and it rolls once the two finish another round. Only offered for pairs with a shared round, and it covers only those rounds, so both phones show the same amount ("Roll $28 from your shared rounds to next time" when the card has more) (2026-09-29)
- [x] `S2` Where each amount comes from: the settle-up keeps the fewest payments, and tapping a person shows your breakdown with them by game and side bet ("Zach and you: +$4 Banker, +$2 Closest to the pin"). Trevor's call, 2026-09-30 Built 2026-10-01 (overnight 6, shipped 2026-10-03): "Where it comes from" on each person in the settle-up and on the Tab person card, per round and across rounds, by game and side bet, ending on what the Tab has between you. Linked players are one person.
- [x] `S2` Fewest payments for the whole group, not just pair by pair. Only ever between people who have played together; money is passed along through a mutual friend when needed (2026-09-27)
- [x] `S2` Cash App, PayPal and Zelle alongside Venmo. Each person picks their app; pay buttons use the payee's app (Zelle shows the handle with a copy button) and only show to the person paying or owed. Handles ride along on shared rounds (2026-09-27)
- [x] `S2` The Tab by person: your net with each friend, Settle up and Remind on every row, Venmo request links, and tap a person for the round-by-round story (2026-09-27)
- [x] `S3` Request links on the Tab for every app. Venmo requests are built (2026-09-27); Cash App, PayPal and Zelle have no prefilled request link, so Remind (with your pay link) covers them for now. Shipped 2026-10-07 (overnight 9).
- [x] `S2` A trip tab: one tab across the rounds of a golf trip, settled once at the end Built 2026-10-01 (overnight 6, shipped 2026-10-03): "Start a trip" on the Tab, in setup or on Up next; a Trip card on the Tab and the trip's rounds grouped on Up next; "Count it for the trip?" (yes by default) when starting a round; standings on every phone in the trip's rounds; trip money folded into each person's total; "Settle the trip" after the last round, with early settling for someone leaving. Rounds shared live settle pair by pair so both phones agree. No SQL: the trip rides on each round. A format field is saved for trip formats later.
- [x] `S3` Gentle payment reminders ("Mike still owes $18 from Saturday"). A Remind button sends a friendly text with the amount and your pay link (2026-09-27); automatic reminders still to do. (2026-10-05)
- [x] `S3` A separate tab for each crew or trip, and "close the books" at season's end (2026-10-05)
- [x] `S3` Trip expenses on the same Tab as the bets: gas, dinner, the house, split any way, and one settle-up for everything at the end. Trip organizers juggle Squabbit, Splitwise and Venmo today (from the Reddit research, 2026-09-30) Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [ ] `S3` Split Pro on the Tab: when an organizer buys Pro, offer to split its cost across the group ("$12.50 each for your foursome"). The purchase stays the organizer's own
- [ ] `S5` The Bank collects for you (Pro idea): friendly automatic nudges for what's still owed, so nobody has to be the one asking for $20

### 8. History and stats
- [x] Round history, season stats, head-to-head
- [x] `S2` Honest head-to-head: each pair's result comes from the bets and holes between them, not from who happened to pay whom (2026-09-27)
- [x] `S2` History by month: each month shows its round count and your net, one line per round, and a Season, Month or Custom range that also drives a chart of your net over time (2026-09-27)
- [x] `S3` Deeper stats for Pro: press win rate, results by game and by course Built 2026-10-04 (overnight 7, shipped 2026-10-04). Open to everyone as "Your stats"; the non-money ones show to friends under your profile setting.
- [x] `S5` Handicap trend from your rounds, as a guide next to your official index (GameBook users ask for handicap tracking). The official index still comes from GHIN or your club. Shipped 2026-10-07 (overnight 10).
- [x] `S5` Year in review ("Birdie Bank Wrapped"): a free card everyone can share, with the deeper season story for Pro (Strava got backlash for gating the whole recap) Shipped 2026-10-07 (overnight 10).
- [x] `S3` Rivalry cards: for every pair, all-time money won or lost, record, current streak, biggest win and "your nemesis" (the Record Book, a Pro headliner idea). Built 2026-09-30 (overnight 5) on each Player card, with "Your nemesis" on Players; open to everyone, no Record Book limit yet.
- [ ] `S3` The Record Book limit: free groups see their last 10 or so rounds, and older ones are hidden, never deleted, so Pro brings everything back (the UDisc model; one Redditor keeps 18Birdies Premium for his 160 logged rounds)
- [x] `S5` Group champions and a hall of fame: each season's winner, biggest wins and records, the group's own history Shipped 2026-10-07 (overnight 10).

### 9. Social and community
- [x] `S3` The group's feed between rounds: upcoming round, trash talk, settle-ups, last round's recap (see area 21). "Lately" on Up next (2026-09-29) lists settle-ups, agreed carry-overs, shared-Tab payments, who answered an upcoming round and round recaps from the last 30 days, with amounts only between the two people in them. Still to do: trash talk and reactions in it (2026-10-05)
- [x] `S3` Follow friends' rounds live, even ones you're not in (someone's Tuesday round), with reactions and comments (2026-10-05)
- [ ] `S5` Friends list beyond your groups, suggested from people you've played with
- [ ] `S5` Wider activity feed: big wins, birdie streaks, lone Wolf wins
- [x] `S5` A money list for each crew's season Shipped 2026-10-07 (overnight 10).
- [ ] `S5` A reputation that travels with you: "pays within a day, 142 rounds settled", "plays to his handicap". Only earned from real rounds, so a new app can't copy it
- [ ] `S5` Find a game: join an open spot in a vetted money game, at home or when traveling, using that reputation (strangers betting is "insane" on Reddit today because there's no trust)
- Design rule: dollar amounts are private by default. Feeds show results and bragging rights; only people in the round or the group see the money.

### 10. Leagues and events
- [ ] `S5` League: season, weekly schedule, sign-ups, standings, flights, league handicaps, weekly pots, dues, admin roles
- [ ] `S5` Event or trip: multiple days and rounds, team formats (Ryder Cup style), one tab for the trip's bets and expenses, a leaderboard view for a clubhouse TV
- [x] `S3` Trip Mode set up in minutes (a Pro headliner idea): templates for a Ryder Cup of 8, 12, 16 or 24, a live captains' draft or handicap flights (A, B, C, D) to pick teams, each day's games ready to go, allowances agreed before anyone leaves. Squabbit's weak spot is that setup is all on you (2026-10-05)
- [x] `S3` Trip formats: day-by-day team points (Ryder Cup style), rotating partners and a trip leaderboard, on top of the trip tab (area 7) Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [ ] `S5` An organizer dashboard on the web for league and event admins
- [ ] `S5` Printable pairings, cart signs and results sheets for events and leagues

### 11. Upgrading and paywalls
Nothing is gated before launch (2026-09-29). Testers use everything; this area is ready for launch day.

**Pro at launch (the plan, not gated today):** the season tab and Season view, planning rounds ahead (friends still RSVP and vote free), usuals, every course (search), season stats and results images, unlimited rounds at once. Keep in step with `PRO_FEATURES` in `src/lib/paywall.js`.

**Pro headliner ideas from the 2026-09-29 research (not decided):** features an organizer can't give up after a trial, like a Tesla FSD trial. Trip Mode with trip expenses on the same Tab (area 10, 7), the Record Book of all-time history and rivalries (area 8), the Big Game across several foursomes (area 5), and splitting Pro on the Tab (area 7). Games, rules and fairness tools stay free: Squabbit, WhyGolf and 18Birdies give games away, and Yahoo Fantasy dropped its paid rule formats.

- [ ] `S3` Early testers get Pro for life: everyone who tests with Trevor before launch keeps Pro free, forever (a lifetime flag on their account, set before the paywall turns on)
- [ ] `S3` Decide the free and Pro split at launch, using what testers used most and what organizers say they'd pay for
- [ ] `S2` Test what's free and what's Pro with the S2 groups, and talk to them about price (see open questions)
- [ ] `S2` (partial) Publish the free promise: a short list of what's free forever, shown on the pricing page and in the app. Nothing on it ever moves to Pro. In the app it's at the top of the paywall and one tap away on the Tab ("The Tab is free, always", 2026-09-29), and now names the Tab and carry-overs; no pricing page yet. Held in production until Trevor says so: it only shows with the paywall preview flag (dev, `?paywall=on`) (2026-09-29)
- [ ] `S2` (partial) Paywall with a free trial (test 14 days against "30 days or 3 rounds, whichever is later": 17 to 32 day trials convert best in RevenueCat's data, and golf is played weekly at most) at the end of organizer onboarding. Invited players never see it. Option C (14 days, a trial timeline, both plans, "Keep scoring for free") is built as a preview behind a flag, with variants by weight ready for an A/B test; it needs real payments (Stripe) before it turns on
- [ ] `S2` The free trial works on monthly and annual plans, not just annual
- [ ] `S2` (partial) A Pro preview: organizers can see what the season tab and other Pro features look like before paying. Built 2026-09-29 behind the paywall flag: "By person | Season (Pro)" on the Tab for organizers opens their real season from their own rounds with a Preview banner and "Try free for 14 days"; under 2 finished rounds it's a 3-step tour with a sample group. Still to do: previews of the other Pro features, and real entitlements (so an organizer's group sees their season)
- [ ] `S3` Early payers keep their price when prices go up
- [ ] `S2` Stripe on the web for the test groups, with promo codes
- [ ] `S3` App Store and Google Play purchases through RevenueCat, including restore purchases
- [ ] `S3` Account screen: manage the plan, receipts, cancel
- [ ] `S3` Trip Pass: a one-time purchase for a trip ($19.99 to $29.99, a placeholder), which the group can split on the Tab. Moved up from S5 (was "Event Pass"), since trip organizers show the most pain (2026-09-30)
- [ ] `S5` League billing
- [ ] `S2` Test price with the S2 groups: $29.99 against $49.99 a year. Casual side-game payers on Reddit accept $10 to $24 and turn down "another app that costs $50/yr"; TheGrint's $60 feels like "nothing" because it includes the official handicap
- [ ] `S3` Paywall rules: the trial unlocks everything (Kodiak's trial still gated side bets), a visible timeline and reminder, never a pop-up during a round (18Birdies' pop-ups are called "infuriating"), never a surprise charge
- [ ] `S3` The cancel screen shows the group its own numbers ("12 rounds, 4 rivalries, $640 settled"), the way Strava's does
- [ ] `S5` Free plans for club captains

### 12. Notifications
- [x] `S3` Push: invited to a round, who's in for Saturday, new trash talk, round finished with your result, someone paid you, a carry-over to approve Shipped 2026-10-07 (overnight 10). Needs the push SQL and the VAPID env vars in Vercel before any push goes out.
- [ ] `S3` Notification settings (from Trevor, 2026-10-07): a spot in Settings to pick which pushes you get (trash talk, who's in, round finished, payments, tee time reminders), since trash talk now pushes once per comment with its words
- [ ] `S3` Email: receipts and a welcome email
- [ ] `S4` The spring comeback email ("Your crew's first round of the season?")
- [ ] `S3` Live Activity on the lock screen: your money and the hole during a round (18Birdies users praise theirs)
- Note: during the week, notifications should feel like the group chat, not the app nagging. Group them, and let each person turn them down.

### 13. Distribution
- [ ] `S1` (partial) Already an installable web app (manifest and service worker)
- [ ] `S3` App Store and Google Play apps (Capacitor wrapper)
- [ ] `S3` Links that open straight into the app (universal links)
- [x] `S3` Never force an update before or during a round. New versions install between rounds. Built 2026-10-01 (overnight 6, shipped 2026-10-03): a new version waits while any round is going on (watched or being fixed too), swaps in only right at launch with no round going on, and otherwise shows "Update ready" on Up next.
- [x] `S3` Plays nicely next to other apps: switching to a GPS app and back keeps your place, and Birdie Bank never stops the player's music (2026-10-05)
- [ ] `S5` Referrals ("Give a month, get a month")

### 14. Trust and legal
- [x] "Friendly wagers only" screen in onboarding
- [ ] `S3` (partial) Terms of service and privacy policy. Privacy policy at /privacy.html (2026-09-25), still due its legal review; terms of service to come.
- [x] `S3` Age check (18+ at minimum, higher in some places) Shipped 2026-10-07 (overnight 9).
- [ ] `S3` One-time legal review of how betting is worded, before App Store review and the creator test

### 15. Behind the scenes
- [ ] `S2` Crash reporting (Sentry)
- [ ] `S2` Product analytics (PostHog or similar): rounds per week, days opened between rounds, upgrades
- [ ] `S3` Attribution: which creator sent each download, and each step from download to paying
- [ ] `S3` Support that answers: a help link in the app, a reply within a day in season, and no-fuss refunds (a slow reply on round day loses a whole group)
- [ ] `S5` Admin view: users, subscriptions, refunds, turning features on and off
- [ ] `S3` Review hosting costs before launch: compare staying on Vercel with moving to Cloudflare (free data transfer, generous free tier). Moving means rewriting `api/` and `middleware.js` for Cloudflare Workers, so only worth it once real usage, not build minutes, drives the bill. Builds are trimmed by `scripts/vercel-ignore.sh` (added 2026-10-05, when the bill was about $28 a month, almost all builds)

### 16. Brand and identity
- [ ] `S1` (partial) A playful color theme, Phosphor icons, no emoji, one golf ball illustration with a face (`BallIllo` in `src/components/ui.jsx`), confetti, count-ups and vibrations (`src/lib/delight.js`), a few small CSS animations
- [ ] `S2` Pick the app's final name as part of the branding exercise, and buy its domain. Birdie Bank was always a placeholder, and another app already ships under it (birdiebank.app, on iOS and Android with tournaments and leagues, found 2026-09-30). Check the App Store, Google Play, USPTO and domains before choosing. Custom SMTP, the quick logo and the App Store listing wait on it.
- [ ] `S2` Quick logo and app icon (good enough to start). Moved out of S1 (2026-09-26) so it doesn't hold anything up, but do it early in S2, before organizer onboarding and the paywall.
- [ ] `S2` Final logo: symbol plus the name set in type, and an app icon that stands out on a home screen
- [ ] `S2` Brand foundations: colors, typography, voice and tone (friendly trash talk, never casino), a short brand guide
- [x] `S2` Copy audit applied across the app: "group" (crew only for saved lists), "bets" not "stakes", "each player puts in" not "ante", "Gets 5 strokes" not "HC 5", one delete verb, and the money screen called the Tab. Deeper pink (#d42a6b) behind small white text (2026-09-27)
- [x] `S2` Motion for the killer end-of-round moment: bets rise in as they resolve, totals count up and pop, the winner's row lifts with a pink glow, the title crossfades, and Reveal, Settle up and Share slide in. Tap to skip and reduced motion show the finished screen at once, and the reveal runs a little faster than before (2026-09-30). For filming: once the bets resolve the card tightens to one line a bet and every total lands on a phone screen (2026-09-30, Trevor's review)
- [x] `S1` Floating sheets: every bottom sheet is a card inset 12px from the sides and the bottom, with 30px corners all round like the phone's own, the accent X to close, and its own raised surface (white over a dimmed page in light mode, a lighter gray with a faint edge over a darker scrim in dark mode) so the sheet's top edge never disappears. Text inside stays AA in both themes (from Trevor, 2026-10-06)
- [ ] `S3` Character and illustration set for key moments: win, loss, press, birdie, lone Wolf, all square, trash talk, empty screens, onboarding, paywalls, one per game
- [ ] `S3` More motion: character reactions, a launch animation (Lottie or Rive)
- [ ] `S3` A theme for every game: a custom illustration in place of each game's icon, and a look carried into the round (money bar, big hole moments), the end-of-round reveal and the share card (from Trevor, 2026-09-30)
- [ ] `S5` Optional sounds for big moments, off by default
- Note: don't let the rebrand hold up S2. Learn which moments groups care about first, then put the most illustration and motion work into those.

### 17. Brand assets you can share
- [x] `S1` Round results can be shared as an image or text (2026-09-26)
- [ ] `S3` (partial) Round results image: course, game, winner, a character reaction, logo. Money hidden by default, with a switch to show it. Built (2026-09-26) without the character. The Show amounts switch starts off and remembers each person's choice (2026-09-27).
- [x] `S3` Link preview images for join and share links (iMessage, WhatsApp) (2026-09-26)
- [x] `S3` Saturday preview card to post in the group chat (see area 21) Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [ ] `S3` All of these made from templates in the app, with the logo and a download link
- [x] `S5` Profile card: handicap, season record, nemesis, favorite game Shipped 2026-10-07 (overnight 10).
- [x] `S5` Year in review cards sized for Instagram Stories Shipped 2026-10-07 (overnight 10).

### 18. Website
- [ ] `S3` Home page, pricing, download page that points to the right app store, legal pages
- [x] `S3` 16 game rule pages ("How to play Wolf") with a "Play this now" button Shipped 2026-10-07 (overnight 9).
- [x] `S3` Branded web pages behind join and share links for people without the app Shipped 2026-10-07 (overnight 9).
- [ ] `S5` Press kit
- [ ] `S5` A page for pro shops, leagues and trip operators (see area 23)

### 19. App Store presence
- [ ] `S3` 6 to 8 screenshot slides per store: headline copy, device frames, characters, one idea per slide. Lead with the killer end-of-round moment.
- [ ] `S3` Short preview video
- [x] `S3` Store keyword research for the listing and subtitle Shipped 2026-10-07 (overnight 10).
- [ ] `S5` Test different screenshot sets

### 20. Feedback, roadmap and community
- [x] `S1` "Suggest something" in the app with four choices: a new game, a missing course, a feature, something's broken. Saves to a Supabase feedback table. Built in Settings (2026-09-25). Live since the feedback SQL was run (2026-09-28).
- [x] `S1` Each form asks for what's useful: a game's rules and how the money works; a course's name, city and optional scorecard photo; a bug's screenshot with round and device details attached automatically. Built (2026-09-25), live since 2026-09-28.
- [x] `S2` Show it in natural places: course search with no results, the end of the games list, a quick "How was it?" after a round (2026-09-26)
- [x] `S2` Make feedback impossible to miss: a pink "Report a bug or send an idea" button first in the round menu (the round's details come along) and first in Settings (2026-09-29)
- [x] `S2` After a round, "How was Birdie Bank today?" saves a one-tap reaction as feedback, then offers a form to say more (2026-09-27)
- [x] `S2` Needs check by kind of user: the organizer, the invited friend, the trip or member-guest organizer, the league runner, and a casual twosome. Done as research (2026-09-26); the approved proposals and missing games are now in their areas (2026-09-27)
- [ ] `S2` Bug and polish pass after each batch of real rounds: fix what broke, smooth anything that took extra taps or caused a question on the course
- [ ] `S2` Slack community (free plan): #feedback, #game-requests, #course-requests, #bugs, #show-your-round, #general. Invite each group's organizer personally.
- [ ] `S2` Slack to database automation: a Slack app sends feedback channel messages to Supabase, Claude sorts each one (game, course, feature, bug), merges it with matching roadmap items and pulls out details, then replies in Slack with the roadmap link. Needed because Slack's free plan hides messages after 90 days.
- [ ] `S2` Weekly feedback digest for Trevor to approve items onto the roadmap
- [x] `S3` Public roadmap in the app and on the website: Planned, In progress, Shipped, with votes, comments and new requests Shipped 2026-10-07 (overnight 9).
- [ ] `S3` After submitting a request, people land on the roadmap
- [ ] `S3` Tell requesters when their idea ships ("The game you asked for is live")
- [x] `S4` "What's new" screen for release notes Shipped 2026-10-07 (overnight 10).
- Note: most golfers won't join Slack. The form in the app is the main path; Slack is for the most engaged 5 to 10%.
- Build or buy: tools like Canny or Featurebase do this with Slack integrations, but they cost money and live outside the app. Building it on Supabase is only a few tables and screens. Check whether a free tier is enough for S2.

### 21. Between rounds (the week)
The goal: people open the app on days they don't play, and Saturday feels bigger because of it.

**Setting up the next round**
- [x] `S2` "Up next" home tab and new bottom nav (Up next, Tab, Play, History, Players, with Settings behind your avatar): a round in progress, your tab at a glance, your last result, and a prompt to plan the next round. Upcoming rounds get their own slot here (2026-09-27)
- [x] `S2` "Run it back" on a finished round: setup opens with the same game, course, group and bets (2026-09-27)
- [x] `S2` Upcoming rounds: date, course, tee time, and games and stakes set during the week, not on the first tee. Pick the game, then "Schedule for later"; they show on Up next. Needs `supabase/2026-09-28-upcoming.sql` run for the group link; until then plans live on the organizer's phone (2026-09-28)
- [x] `S2` Who's in: each player answers in, out or maybe, and the organizer sees the count, with a nudge for anyone who hasn't answered. Friends answer from one group link (or their own link) with an RSVP card, no install and no paywall, and vote on the game and the bet; the organizer suggests, the group decides, and the tally shows. Player cards show a friend's answer. Any member can send the morning text (share sheet or text) (2026-09-28)
- [x] `S2` Bets set ahead of time, so the round starts in one tap on the first tee: roll call confirms who showed (walk-ups too), then "Tee off" starts the voted game and bet and shares it live with the plan (2026-09-28)
- [x] `S2` Edit an upcoming round: the organizer changes the day, tee time, course or holes from "Edit" on the plan, and everyone with the link sees the change. Planning also asks 9 or 18 holes on the When step (it was hidden below the game list, and skipped when planning from onboarding) (2026-09-30)
- [x] `S2` "Schedule for later" at the end of setup, not just on the first step: on the Bets step, on "Round ready" ("Not playing today?"), and from End round on a round with no holes scored. The game, course, holes, bets and side games carry into the plan and everyone picked is invited, so the organizer can build the round, send the group link, and let the group look it over and vote instead of passing screenshots around. A round already made becomes the plan (2026-09-30)
- [x] `S3` A plan keeps the rest of the setup made before it was scheduled (teams, playing order, tees, handicap overrides, starting hole), so roll call starts it exactly as built. For now roll call uses fresh teams and the default tee Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- [x] `S3` Lock down plans before the creator test: only the organizer changes a plan and each person changes only their own answer (anyone with the code can for now, 2026-09-28) Built 2026-10-04 (overnight 7, shipped 2026-10-04). `supabase/2026-10-04-plan-lock.sql` is run; seat links are tightened too (`2026-10-04-seat-links.sql`).
- [x] `S3` Push reminders for upcoming rounds (the morning text is a share for now) Shipped 2026-10-07 (overnight 10). Needs the push SQL and the VAPID env vars in Vercel before any push goes out.
- [x] `S3` Tee time reminder: "Book your tee time, Saturday fills up by Wednesday," with a link to the course's booking page and a reminder day the organizer picks (2026-10-05)
- [x] `S3` Countdown and a Saturday preview: who's in, the games, who gets strokes on which holes, head-to-head records ("Mike is 3 and 1 against Dave this season") Built 2026-10-04 (overnight 7, shipped 2026-10-04). The preview lists agreed challenges and side bets.

**Trash talk**
Kept light on purpose. Groups already have a group text, so Birdie Bank adds to it rather than replacing it.
- [x] `S3` Comments and reactions on rounds, challenges and settle-ups, plus quick jabs to pick from, with character illustrations Shipped 2026-10-07 (overnight 9).
- [x] `S3` Easy sharing into the group's own text thread (preview cards, results, callouts) (2026-10-05)
- [x] `S3` Challenges: "Dave challenges Mike to a $20 match on Saturday." Mike accepts or declines, and it becomes a side bet in the round. Built 2026-10-04 (overnight 7, shipped 2026-10-04). From a Player card or a planned round, with Accept, Counter and Decline; the organizer can set one up between two others and mark their answers; it moves with a rescheduled plan.
- [x] `S3` Callouts from the tab and stats ("Still owes $40," "Hasn't won a skin in 3 weeks"), easy to post, never mean-spirited Built 2026-10-04 (overnight 7, shipped 2026-10-04). Lines about money are only ever about yourself.
- Not now: a full chat system for each round or group. It's a lot of work to do well, and nobody has asked for it. Revisit only if the feedback table shows groups want it.

**Settling up during the week**
- [x] `S2` Group sees who has paid from last round (see area 7; built 2026-09-29) (live 2026-09-29, SQL run)
- [x] `S2` Carry-over proposals: propose rolling a balance into the next round; once the other person agrees, it's settled for now (see area 7; built 2026-09-29) (live 2026-09-29, SQL run)
- [x] `S3` Monday recap: last round's results, who's paid, what carried over Built 2026-10-04 (overnight 7, shipped 2026-10-04). Shown the day after a round, for a week.

**Watching other rounds**
- [x] `S3` Friends' rounds during the week show up live in the feed, with reactions and comments (see area 9) (2026-10-05)

- Note: this is also the answer to Birdie Bank being played once a week. It gives a new organizer something to do on the day they download (set up Saturday, invite the group), which is what makes paid creator marketing work.

### 22. Creator marketing (from Jake Castillo's playbook)
- [x] `S3` List of 50 to 100 golf creators on TikTok, Instagram and YouTube with 10k to 100k followers. Skip the big names and the tiny accounts. Favor ones who already film money matches with their buddies. Shipped 2026-10-07 (overnight 10).
- [ ] `S3` Price each deal before reaching out: take the median views of their last 10 to 15 videos, leaving out any viral outlier, then compare cost per view across creators
- [ ] `S3` Two-minute brief (a short doc): the problem, the end-of-round moment, the "friendly games" wording, #ad, the download link. Then let them make the video their way. Show the real app with their real group, not an ad read. GameBook reviews show viewers who feel sold to leave 1 star reviews.
- [ ] `S3` A download link or code for each creator, so attribution works (see area 15)
- [ ] `S4` Sign 10 creators at $300 to $500 each: flat fee, paid upfront, one post each, reuse rights included. Keep $1k in reserve.
- [ ] `S4` Measure each creator against the benchmarks: downloads per 1,000 views, share reaching the paywall, share paying
- [ ] `S5` Put more money into the 2 or so that work. When a video takes off, work out its format and run it with other creators until it stops working.
- [ ] `S5` Use the reuse rights to run the best videos as paid ads (for example TikTok Spark Ads)
- [ ] `S5` Monthly retainers with the best creators

### 23. Partners and the real world
Code is cheap now, so anyone can build a scoring app. What a weekend coder can't copy is people, places, money and history: relationships with courses, leagues and resorts, an official handicap license, and years of each group's records (Trevor, 2026-09-29). Build the app and grow users first, then pull these in.

- [ ] `S2` Talk to the head pros at Birch Creek, Logan River and Preston: how they run their weekly game (dogfight, skins, men's league), what they hate about it, and whether they'd switch
- [ ] `S3` Official handicaps: apply to GHIN or a state golf association for access to post scores and pull each player's index (TheGrint's real advantage is its license)
- [ ] `S4` Pro shop house game pilot: sign-ups, entry fees, live skins across every group, payouts as pro shop credit (how courses already pay out)
- [ ] `S4` Run a men's league's season in the app with one local league
- [ ] `S5` A dashboard for courses and leagues
- [ ] `S5` Book tee times in the app, through GolfNow or tee sheet partners
- [ ] `S5` Stay-and-play trip packages with resorts, with Trip Mode built in
- [ ] `S5` Engraved trophies and plaques for each group's season champion, shipped every year
- [ ] `S5` A Birdie Bank season series that ends at a real yearly event, and partnerships with big amateur tournaments
- [ ] `Later` Real pots held in the app (trip pots, season dues) after a legal review, starting with brand-sponsored pots ("Titleist pays $50 for every eagle")

---

## Open questions

**Pricing and payments are unknown, and that's fine.** We'll learn what people pay for by testing and talking to groups, not by predicting. It doesn't block building anything else. Prices, plans and the free and Pro split in this file are placeholders. Things to learn along the way:
- Is there a free tier for organizers after the trial, or is it trial then paid? The GameBook lessons lean toward a small free tier (roughly what the app does today: score a round and settle it) that never shrinks, so put less on the free promise at first rather than take things back later.
- Does the first paywall test run on Stripe on the web or wait for the App Store? Stripe on the web is the easy start, since test groups already use the web app. Before S3, check Apple's current rules on linking out to web payments in US apps.
- A hard paywall at the end of onboarding (Jake's playbook) or a trial with a "Keep scoring for free" option? Measure both.
- What price, and how much annual vs monthly? Talk to the S2 groups before picking numbers.
- Is a Trip Pass the first thing most organizers buy, with the yearly plan after a great trip?
- Does splitting Pro on the Tab make $49.99 feel like $12, or should the price just be lower?

## Decisions

- 2026-09-25: The organizer pays and everyone else plays free.
- 2026-09-25: Never hold or move money; only link out to payment apps.
- 2026-09-25: Accounts and cloud data come before profiles, the friends feed, leagues and paywalls, since they all depend on them.
- 2026-09-25: Leagues come before the wider friends feed, since a league brings a group that already knows each other.
- 2026-09-25: Slack (not Discord) for the community, with feedback copied into Supabase.
- 2026-09-25: Build the roadmap and voting in the app rather than buying a tool (check a free tier first).
- 2026-09-25: Adopted Jake Castillo's creator playbook: paid golf creators become the main way to grow, the onboarding and paywall move to S2, and the App Store app moves to S3.
- 2026-09-25: Creator test timed for February to April 2027, when golf season starts; build over fall and winter.
- 2026-09-25: The free trial must cover a first real round (7 to 14 days), since groups play weekly.
- 2026-09-25: The days between rounds get their own area (21) so people open the app during the week. Organizer onboarding ends with setting up the next round.
- 2026-09-25: Balances can be carried over to the next round when both people agree, as an alternative to paying.
- 2026-09-25: After reading Golf GameBook's negative reviews: no GPS (play nicely next to GPS apps instead), no ads or sponsor placements in the app, a published free promise that never shrinks, a trial on every plan, and offline-first scoring.
- 2026-09-25: Pricing and monetization stay open until tested with real groups. They don't block building.
- 2026-09-25: No full chat system for now. Keep trash talk to comments, reactions and sharing into the group's own text thread. Big features wait until people ask for them.
- 2026-09-26: The S1 gate no longer waits on 8+ real rounds. Real rounds, bug fixes and polish run alongside every step instead of blocking the next one. The quick logo moves to early S2.
- 2026-09-27: Money rules. A bet changed mid-round counts from the next hole ("Whole round" is the option); a leg or match already under way keeps its bet, and a pot always covers the whole round. "Per point" stays pairwise, Nines is "every point above or below 54", and each bet shows a worked example. Stableford and Quota default to a pot. Every unfinished leg pays on the holes played. Rabbit is "set free" and ties change nothing (steal and ties-free stay as options). Quota scales to the holes played. The handicap percentage goes on each player first (WHS). The 3-person scramble allowance is 30/20/10 (WHS 2024 Appendix C). Greenie means closest to the pin, par to keep it.
- 2026-09-27: Product. Never delete a round in progress: several can be going at once. Share images hide amounts by default and remember each person's choice. Pay buttons only show to the person paying or owed, and each person picks their own payment app (Venmo, Cash App, PayPal or Zelle; Zelle shows the handle with a copy button). A deeper pink (#d42a6b) goes behind small white text. Editing a finished round keeps it counting on the Tab. Database courses get a soft tag and start on the middle tee. Join previews keep first names. The after-round prompt is "How was Birdie Bank today?" and reactions save as feedback. The spare cent on a 3-way split is paid by the first-listed player, and the player-left rules stay.
- 2026-09-27: Words. The money screen is the Tab everywhere. "Group" (crew only for saved lists), "bets" not "stakes", "each player puts in" not "ante", "Gets 5 strokes" not "HC 5", and one delete verb. The home tab is "Up next". Crews are secondary everywhere, and no core feature is built around them.
- 2026-09-27: Needs check proposals approved: add a player mid-round and "Add me", honest head-to-head, request links on the Tab, Snake and Hammer, skins and Nassau house rules, bragging-rights mode, Run it back, only players edit scores, per-game handicap % suggestions, several groups in one game moved to S3, a trip tab in S2 and trip formats in S3.
- 2026-09-28: The paywall stays off for everyone until real payments exist: it's a preview behind a flag, so no one taps "Start my free trial" and expects something to happen. Onboarding ends with planning the next round, and the paywall comes after the plan (cancelling the plan still lands on it). The friendly wagers note is a checkbox on the name screen, as in the wireframe.
- 2026-09-28: Overnight 2 calls confirmed. Kept as built: legs under way keep their bet, old short rounds use the new unfinished-leg money, the Tab routes through mutual friends (Trevor to judge the wording), carried skins after the last hole go to nobody by default, the Snake and Hammer defaults, fixed-side games can't add a player mid-round, the paywall rules and the smaller calls. Changed: a skin carried from before a late joiner arrived stays with the players who built it, doubling Snake gets an optional cap (4 doubles by default), and the ballot shows each game's own unit ("$5 a side", "$1 a point").
- 2026-09-28: Plans stay open to anyone with the code for S2, like live rounds. Tighten before the creator test.
- 2026-09-29: Stop hiding Pro before launch. The app is only with friends and small groups, so everything is open and unlabelled; the free and Pro split happens at the official launch, and early testers get Pro for life.

## Progress log

- 2026-09-25: Roadmap created. Starting S1.
- 2026-09-25: Reworked the steps around paid creator marketing and a spring 2027 creator test. Added area 21 (between rounds) and area 22 (creator marketing).
- 2026-09-25: Read Golf GameBook's 1 and 2 star App Store reviews. Added "Lessons from Golf GameBook" and new items in areas 1, 5, 6, 8, 10, 11, 13, 15 and 22.
- 2026-09-25: Finalized for now: pricing marked as something to learn by testing, full chat set aside, "build what's asked for" added to the rules.
- 2026-09-25: Live sharing was already on in production (since 2026-09-23). A join link on a new phone now skips organizer onboarding: see the round, pick your name, you're in.
- 2026-09-25: Built "Suggest something" (Settings) with a form for each kind, photos, and an offline queue. Needs the feedback SQL run in Supabase before it's pushed.
- 2026-09-25: Accounts and cloud data: Google and email-link sign-in, offline-first sync of every player, crew, course, round, payment and setting, merge on first sign-in, and a "save it to your tab" prompt after rounds. Supabase SQL run; Google Cloud project "Birdie Bank" created with a web sign-in client.
- 2026-09-25: Added a privacy policy page and published Google sign-in to production, so anyone can sign in with Google.
- 2026-09-26: From a Mobbin review and clickable wireframes: money is now pinned on the Play screen from hole 1 and moves with every tap (it used to appear only after a hole was saved, and Banker's bets step hid it). Setup asks one question per step with "Your usual" and a "Round ready" invite screen. The end of a round is now reveal, settle up with Venmo links, then share.
- 2026-09-26: Changed the S1 gate to sign-in for anyone plus live feedback, moved the quick logo to early S2, and added a needs check by kind of user and an ongoing bug and polish pass (area 20). Checklist: 17 of 144 done (12%), up from 5 of 141 (4%) when the roadmap started.
- 2026-09-26 (overnight): Money math tested for all 16 games (5 bugs fixed, including cent rounding), "A player left" and forgiving round endings, per-bet reveal and a results image, feedback prompts in natural places, join link previews, course search ready for a GolfCourseAPI key, stronger offline sync and a service worker that caches the whole app, a faster first load (main bundle 407 KB to about 270 KB), and an accessibility pass. Research: needs check, rules check and copy audit, plus wireframes for the other app areas, rounds set up ahead of time, and organizer onboarding.
- 2026-09-27: Money rules #1 to #9 built with tests for each, including the rules check examples: bets change from a hole on, unfinished Rabbit legs and Sixes matches pay, Rabbit set free, Quota scales to holes played, WHS handicap allowances (per player, 3-person scramble 30/20/10), pots by default for Stableford and Quota, worked examples under every bet, and one greenie a hole on par 3s.
- 2026-09-27: Two new games, Snake and Hammer, with rules, options, scoring on the Play screen, results and reveal. Skins house rules (net and gross together, a pot split by skins won, and void, split or playoff for carryovers after the last hole) and Nassau press house rules (press at the turn, no press on the last hole). Published rules cited in the code.
- 2026-09-27 (overnight, product and copy): More than one round in progress (nothing is deleted to start a new one), fixing a finished round keeps it on the tab, database courses get a soft tag and the middle tee, the results image hides amounts until you turn them on, after-round reactions save as feedback, a deeper pink for small white text, and the approved copy audit applied screen by screen.
- 2026-09-27: Tab and people: the Ledger screen is now the Tab, by person, with Remind, Request and a round-by-round story for each friend. Fewest payments across the whole group (only between people who've played together), payment apps for everyone (Venmo, Cash App, PayPal, Zelle) with pay buttons only for the payer or payee, Player cards, and honest head-to-head worked out bet by bet.
- 2026-09-27 (overnight): New app shell. Up next is the home tab (round in progress, your tab at a glance, last result, plan your next round), the bottom nav is Up next, Tab, Play, History, Players, and Settings moved behind your avatar. History is grouped by month with totals, with a Season, Month or Custom range and a chart of your net. "Run it back" starts a round like a finished one.
- 2026-09-27 (overnight): Joining from a link is now an invite card, seat tiles and a strokes check, with "Not on the list? Add me" for people the scorekeeper forgot. Scorekeepers can add a player mid-round; their money counts from the hole they join. Seat requests ride in the existing live round records, so no SQL is needed.
- 2026-09-27 (overnight, integration): All six wave 1 streams merged into main (money rules, new games, product and copy, the Tab and Players, the app shell, joining). Head-to-head now also covers Snake, Hammer, the skins pot and bets changed mid-round; the last copy audit items are in (the Tab, Players, Settings, joining). Added the approved needs-check proposals and the missing games to their areas. Tests: 304 passing. Checklist: 42 of 174 done (24%), up from 17 of 144 (12%) on 2026-09-26.
- 2026-09-28 (overnight): Upcoming rounds. Pick the game, then "Schedule for later" for the day, course and tee time; invite players or just send one group link. Friends answer in, maybe or out and vote on the game and the bet from an RSVP card with no install and no paywall; the organizer sees the counts, the tally and a nudge. Any member sends the morning text, and a roll call at the tee starts the voted game in one tap. New tables in `supabase/2026-09-28-upcoming.sql` (not run yet; plans stay on the organizer's phone until it is). Tests: 321 passing. Checklist: 45 of 175 done (26%).
- 2026-09-28 (overnight): Organizer onboarding. A welcome, then what the group plays, how many, how they settle up and who does the math, one a screen, with a payoff after three answers that speaks to that answer (never assuming Venmo). Your name comes with the friendly wagers note as a checkbox. "Here's your group" leads into planning the next round with the answers filled in, and then the paywall preview: option C with a 14-day trial timeline, yearly and monthly plans (placeholder prices), the free promise and a full "Keep scoring for free" button. It's UI only behind a flag (on in local dev, `?paywall=on` anywhere), and each phone keeps one variant so an A/B test can be added later. Invited players never see onboarding or the paywall. Tests: 343 passing. Checklist: 47 of 175 done (27%).
- 2026-09-28: Everything from both overnight runs is live on main, and all three SQL parts are run. Join link previews now show the round (they never had: `vercel.json` rewrites don't run for `/`, so middleware does it, and "$2 a skin" no longer breaks the text). Course search is on with a free GolfCourseAPI key. Custom SMTP waits for the app's final name and domain. Tests: 346 passing.
- 2026-09-28: Skins and late joiners: a carry stays with the players who built it. A player added mid-round plays for every skin from the hole they join, but not for skins already carrying when they arrive; if they win a hole outright they take that hole's skin and the older carry keeps rolling among its builders. Works for net, gross, both, the pot and the last-hole rules, and the join sheet and Skins rules say so. Tests: 351 passing.
- 2026-09-28: A doubling Snake has an optional cap, 4 doubles by default ($5 tops out at $80), with No cap as a choice; rounds played before keep their money. The planned-round ballot votes on each game's bet in its own unit ("$5 a side", "$2 a skin", "$1 a point"), and Tee off uses the amount voted for the winning game; older plans still load. Tests: 365 passing.
- 2026-09-29 (overnight, all of tonight on `overnight3/next`): Trevor's wireframe decisions 1 to 10. Several games at once: a main game plus up to two side games (Skins, Junk with chips under each player, a Birdie pot), each with its own bet line and worked example, one money bar total with a by-game table, a reveal with each person's games in small type and the fewest payments across every game; old rounds return exactly the old money (checked against the previous engine on 1,000+ random rounds). Add a player picks their games and start hole, and a player who can't join a fixed-side main game can still play the side games without moving its money. One scorekeeper per shared round: hand off, "Ask for it", read-only for everyone else, "Take the card" after 10 quiet minutes, watchers never edit. Up to 5 named usuals, synced in the profile. "Fix this hole" (round menu and "Wrong par or HCP?" under the scorecard; the Hole/Par/HCP strip still opens the scorecard) and "Course and tee", keeper only, with whose strokes move, the money recounted, a Fixed tag and the fix sent as course feedback. The shared Tab: "I paid" and "Didn't get it?" on both phones for rounds shared live, the who's square strip (status only, labelled by the round), "Roll to next time" on the same person card; needs `supabase/2026-09-29-round-payments.sql` (not run). "The Tab is free, always" with the free list, and a Season preview for organizers behind the paywall flag (sample tour under 2 rounds; nothing charged). "Lately" on Up next, fed by shared-Tab payments (one tap is one row), agreed carry-overs and recaps that name every game. Report fixes a to g (join links for signed-in people, adding names in the Who step, accessible names, the repeated line, Dormie, "Your usual" never offers a round in progress or one you only watched; the service worker console lines come from the Claude browser pane, not the app). Records with a friend no longer count rounds you only watched. Checklist: 52 of 182 done (29%), up from 47 of 177 (27%).
- 2026-09-29: From Trevor's feedback after a round. Several games share one scorecard already on `overnight3/next`; now a side game can be added mid-round from the round menu without setting up course and players again, and it counts the holes already scored. Researched which games pair well: one main game plus side bets is the norm, so Snake and Rabbit join Skins, Junk and the Birdie pot as side games (up to three), and pairs that pay twice are blocked. Banker gets the "Low" rotation (Trevor's group plays it; a tie stays with the banker) and Birdies double as a setting, since no source agrees on gross or net. The round menu is grouped and scrolls on small phones (its top used to run off the screen), with "Report a bug or send an idea" first there and in Settings. The scorecard key keeps each mark next to its words on a phone. "Edit a hole" meant fixing par or HCP, which is "Fix par or HCP" in the round menu on this branch. Tests: 503 passing. Checklist: 57 of 187 done (30%).
- 2026-09-29: Shipped to main: the overnight run (`overnight3/next`) and the feedback fixes (`feedback/sept28`). The shared Tab and carry-overs still stay on each phone until `supabase/2026-09-29-round-payments.sql` is run.
- 2026-09-29: `supabase/2026-09-29-round-payments.sql` is run, so "I paid", the who's square strip and carry-overs sync between phones on shared rounds. Still open on the shared Tab: each phone totals only the rounds it has, so two phones can show different amounts (the carry ask bug). Checklist: 61 of 187 done (33%).
- 2026-09-29 (follow-ups, branch `overnight3/followups`): The carry bug: each phone netted every round it had, so Trevor's phone offered to roll $46 while Sam's only knew $28. Now what's open on rounds both phones have stays between the two people (from those rounds' own transfers, never passed on through a friend), and "I paid", "Roll to next time" and the who's square strip count only that; rounds one phone has alone still show on the Tab and are paid locally, and the card says what a roll covers. Old carries still show. "Paid part of it?" on each Tab card. A side Skins game shows its house rules in one line and opens them for the round. Side games go on the planned-round ballot with a yes or no vote each, and roll call starts with them (no SQL). Asking for the card starts a 2-minute countdown; the keeper answers Yes or No, and with no answer one tap takes it. The free-forever list is held in production behind the paywall flag. A mid-round hole fix is saved to the fixing phone's copy of the course. Merged onto main after the feedback fixes. Checklist: 63 of 187 done (34%), up from 61 of 187 (33%).
- 2026-09-29: Nothing is held back until launch. The Season view on the Tab is open to everyone who has played a round (no Pro tag, no Preview banner, no trial button; under 2 rounds it says your season starts after 2). With `?paywall=on` it's the organizer-only Pro preview as before. "Pro at launch" is written down in area 11, with new items for lifetime Pro for early testers and deciding the split at launch.
- 2026-09-30: From Trevor: planning a round asks 9 or 18 holes on the When step (the choice was at the bottom of the game list, and missing when planning from onboarding), and "Edit" on a plan changes the day, tee time, course or holes, sent to everyone with the link.
- 2026-09-30: Research on premium features and the long game (golf forums, 19 r/golf threads, apps from other hobbies) added to the checklist: free fairness tools (allowances by format, half-pops, Canadian skins, a first-tee rules card), the Big Game, trip expenses on the Tab, splitting Pro on the Tab, rivalry cards and the Record Book limit, reputation and find a game, Trip Mode templates, a Trip Pass moved up to S3, a price test, paywall rules, a Live Activity, and a new area 23 for partners (pro shops, men's leagues, GHIN, tee times, resorts, trophies, a season series). From Trevor: an avatar library with photo upload, and a theme for every game carried into the round and the share card. Pro headliner ideas noted in area 11, not decided. Checklist: 64 of 222 done (29%), up from 64 of 190.
- 2026-09-30: From Trevor: he set up a whole round for a future day and only then remembered planning ahead, so the only way out was to cancel it. "Schedule for later" now shows on the Bets step, on Round ready, and in End round for a round with no holes scored; the setup carries into the plan (players invited, bets suggested, side games on the ballot) and a round already made is replaced by the plan. Follow-up added: plans keep teams, order, tees and handicap overrides. Checklist: 65 of 224 done (29%), up from 64 of 222.
- 2026-09-30: From Trevor: the Players tab had two Adams and two Daltons, one he added and one from rounds started on a friend's phone, and the joined copies couldn't be edited. Merge is a pointer on the duplicate (`mergedInto`), so rounds and shared Tab rows are untouched and it syncs with the account; every place the Tab and records work out who's who follows it. Test rounds are still cleared by deleting them from History. Tests: 527 passing. Checklist: 66 of 226 done (29%).
- 2026-09-30 (overnight, branch `overnight4/next`): Nine step branches merged: fixes (invite card team name, keeper finish sends every phone to Final results, a rules page per game in the round menu including a new Birdie pot page), one person across several player ids (seat claims, "Same person as...", "Not the same person" and Undo; each round's money unchanged), side game bets changed mid-round, usuals when planning ahead, the WHS handicap % hint, blind wolf and Hogan, play for Points or a reward (Trevor's idea: lunch, a drink or a custom reward for the winner), favorite and recently played courses, and reveal motion. Old rounds give the same money, and balances still sum to zero. No SQL. Tests: 655 passing. Checklist: 71 of 189 done (38%), up from 63 of 189 (33%).
- 2026-09-29 (branch `overnight4/moments`): From Trevor's second full round with the app: it wasn't obvious who was winning, and winning the match 3 holes early had no big moment. Match play and Nassau now show a banner for a lead change, all square, dormie, taking the lead and a nine won or halved; the match tile pops and names the leader; a match won early gets a full "Match over" screen with Keep playing or Finish the round here. His friend didn't want to compete, so a no-pressure way in is on the list (S3). Tests: 662 passing. Checklist: 72 of 192 done (38%).
- 2026-09-30: Trevor's first 4-player Banker round. Missing handicaps had played as scratch and gave him strokes, and handicaps couldn't be turned off mid-round. On `feedback/sept30` (on top of overnight 5): handicaps are a choice on the Players step, off for a new setup, with a warning before anyone plays as scratch; a Handicaps sheet in the round menu works every hole out again; Banker bets get $1 to $10 chips and carry over per player; "On the line" sits at the top on both steps. Two-player side bets with their own strokes and the settle-up breakdown are next, data model agreed. Tests: 812 passing.
- 2026-09-30: Trevor's answers to the Overnight 4 and 5 review, on `ship/trial`: reward rounds leave anyone who left early out of buying (ties as built), and the reveal headline says who wins the reward; a bet changed mid-round (main or side game, Skins house rules included) never becomes next time's default; blind wolf is off for a new setup and is lone + 1 or lone + 2 (saved settings move once, rev 4; saved rounds keep their own multiplier and money); points rounds read in points on setup's bets, examples, keypads and the Banker chips; "Handicap rules suggest 95%"; the reveal's bets card tightens once resolved and scrolls every total onto the screen; the round's first lead gets a banner; Recently played skips watched rounds. Tests: 825 passing.
- 2026-10-01 (overnight, branch `overnight6/next`, not on main): Eight tasks built, each reviewed, merged, then tested on two phones and money-checked. The profile foundation: a profile for each account, claimed seats linked to the account so the same person is one person on every phone without merging, Ball buddies avatars, photos and initials, your profile screen with home course, privacy with money hidden by default, profile stats and Delete your account (`supabase/2026-10-01-profiles.sql`, run 2026-10-01). Two-player side bets (match, per hole, closest to the pin, custom) with strokes only between the two, and "Where it comes from" by game and side bet on the settle-up and the Tab. The trip tab with standings and Settle the trip (rounds shared live settle pair by pair so both phones agree). Moments for Sixes, Banker and Hammer. Small fixes: a scramble drives shortfall note, a stroke key for side games, usuals and plans keep half strokes, Courses near me finds courses not named for their town, the nemesis counts money rounds only. "Request this course" on an empty search. No forced update while a round is going on. Area 20's two "Suggest something" lines marked done (live since 2026-09-28). Old rounds give the same money (400 seeded rounds compared against main). Tests: 979 passing. Checklist: 100 of 237 done (42%), up from 88 of 237 (37%).
- 2026-10-03: Overnight 6 shipped to main (`b21d4c0`) after Trevor ran the profiles SQL and answered the review. His answers are next.
- 2026-10-03: Trevor's overnight 6 answers built on `overnight6/followups`, tested on two phones and money-checked twice (the reviews caught Tab totals going wrong once a trip plan was live, a trip inventing a payment, a carry vanishing and a removed side bet coming back; all fixed with tests). Settle the trip now says when a round the organizer didn't play settles between its players. Both new SQL files run. Tests: 1051 passing. Shipped to main.
- 2026-10-04: Overnight 7 (night of 2026-10-03): 14 tasks in 4 stretches, each reviewed and merged, then two-phone QA, three money reviews and fixes (trip expenses paid on one phone only, a friend counted as two people on a third phone, a payment tapped twice, plan lines moving after paying, a cup stake that differed by phone, a challenge becoming two bets). Then Trevor's 40 review answers: the cup stake on the Tab, foursomes, organizer-made challenges that move with the plan, side bets on the preview, one profile privacy setting with shared non-money stats, whole points on screen. Tests: 1594 passing. Checklist: 116 of 237 done (48.9%), up from 100 of 237 (42.2%).
- 2026-10-05: Overnight 8 shipped to main (`97fc006`): the Big Game, following friends' rounds and the friend and group feed, crew and trip tabs with Close the books, tee time and payment reminders, Trip Mode templates and the captains' draft, sharing into the group text, and keeping your place across apps. Two money reviews (the second found 8 issues, all fixed) and a security fix: live rounds, payments, plans and challenges get locked behind their codes by `2026-10-06-round-codes.sql`, to run once phones have the new build. Tests: 1846 passing. Checklist: 126 of 237 done (53.2%), up from 116 of 237 (48.9%).
- 2026-10-06: Floating sheets on branch `feedback/floating-sheets` (from Trevor): every bottom sheet, number pad and confirm is a card inset from the sides and bottom with 30px corners and an accent X, on its own raised surface so it stands apart from the page in dark mode (a lighter gray, a faint edge and a darker scrim) and in light mode (white over a dimmed page). One change in the shared sheet styles covers every sheet in the app. Checklist: 127 of 239 done (53.1%), up from 126 of 238 (52.9%, the S3 hosting review was added 2026-10-05).
- 2026-10-07: Overnights 9 and 10 shipped to main with Trevor's answers from both review queues (money with thousands commas, trash talk pushes that say what was written, "You tied for 1st", points rounds counting as hall of fame wins, faded days in the date picker). Checklist: 147 of 240 done (61.3%), up from 127 of 240 (52.9%). Notification settings added to area 12 from his review note.
- 2026-10-07: Trevor ran the three overnight 9 and 10 SQL files in Supabase. Push still waits on its Vercel env vars.
