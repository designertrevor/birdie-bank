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

**Shipped overnight 2026-09-27 (wave 1):** the nine money rules, Snake and Hammer (18 games), skins and Nassau house rules, the Up next home tab and new nav, History by month with a chart, Run it back, the Tab by person with payment apps for everyone and honest head-to-head, Player cards, several rounds in progress, fixing a finished round without reopening it, the invite card with seat tiles and "Add me", adding a player mid-round, and the approved copy audit (the money screen is now the Tab).

**Shipped overnight 2026-09-28:** upcoming rounds (area 21): plan ahead, who's in with a nudge, the group vote on the game and the bet, the RSVP link for friends, the morning text and the roll call. The SQL is run, so the group link is on.

**Shipped overnight 2026-09-28 (onboarding):** organizer onboarding: four questions one a screen with payoffs, "Here's your group", then "Set up your next round" straight into the plan flow (the first game they play is suggested, the others go on the ballot). The paywall (option C, trial with a free way out) is built as a preview behind a flag: open the app with `?paywall=on` to see it, `?paywall=off` to hide it. Placeholder prices, nothing charged.

**Built overnight 2026-09-29 (shared Tab, branch `overnight3/shared-tab`):** one Tab on both phones for shared rounds ("I paid", "Didn't get it?", undo with one tap), the who's square strip, and "Roll to next time" carry-overs on the same person card. Run `supabase/2026-09-29-round-payments.sql` to switch it on; until then everything stays on each phone as before.

**Built overnight 2026-09-29 (Pro preview, branch `overnight3/pro-preview`):** a "By person | Season (Pro)" switch on the Tab for organizers, only while the paywall flag is on, so production looks the same until it's turned on. Season shows your real season from your own rounds (everyone's total, you against your most-played friend, your biggest day, your best game) with a Preview banner and "Try free for 14 days" into the paywall preview; with fewer than 2 finished rounds it's a short tour with a sample group. "The Tab is free, always" and the free-forever list are one tap away on the Tab for everyone, and the free list now sits at the top of the paywall. Nothing is charged.

**Next in S2:** finish the shared tab (linking the organizer's copy of a player to the real person, area 1), real payments for the paywall test (Stripe, area 11), several games in one round, and the quick logo (area 16).

**The big date:** the creator test (S4) runs February to April 2027, when golf season starts back up. Everything before it is about being ready: a product groups keep using, a smooth path from video to paying, and an App Store app.

Last updated: 2026-09-29

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
- [ ] `S1` (partial) Data saved on the phone, with a backup file you can export in Settings
- [ ] `S1` (partial) Sign in with Apple, Google, or a phone number or email link. Google and email link work (2026-09-25), and Google sign-in is public. Email only reaches Supabase team members until custom SMTP is set up. Apple comes with the App Store app (S3); phone numbers are skipped for now.
- [x] `S1` Rounds, crews and the tab saved to the cloud and shared across devices (2026-09-25)
- [ ] `S1` (partial) Claim your seat: a guest player becomes the real person when they sign up, and their history and tab come with them. A guest who joins from a link plays as their seat in that round, and signing up saves those rounds to their account. Linking the organizer's copy of that player to the real person comes with the shared tab (S2).
- [x] `S1` Move each phone's existing local data into the account (2026-09-25)
- [x] `S1` Offline first: scoring keeps working with no signal, changes queue and sync when signal returns, and a score is never lost or overwritten (2026-09-25)
- [ ] `S3` Delete your account (Apple requires it)

### 2. Profiles
- [x] `S1` Players have a name, handicap index and Venmo username, saved to your account when signed in (2026-09-25)
- [ ] `S3` (partial) Your own profile: photo, home course, handicap, which payment apps you use. Your payment app and handle (Venmo, Cash App, PayPal or Zelle) are set on your player card from Settings or Players (2026-09-27); photo and home course still to do.
- [x] `S2` Player cards: each person shows your record and honest net with them, and opens a card with Request, Remind, Settle up and the round-by-round story. Crews sit in a small section below (2026-09-27)
- [ ] `S5` Profile stats: rounds, net winnings, record against each friend, favorite game
- [ ] `S3` Privacy settings, with money hidden by default

### 3. Onboarding
- [x] Three-step first run: welcome, the "friendly wagers" disclaimer, your name and handicap
- [x] `S1` Two paths: the organizer setting up a game, and the invited player arriving from a link (pick your name, you're in) (2026-09-25)
- [x] `S1` Guests play without an account, then "You won $22. Save it to your tab" leads to sign-up (2026-09-25)
- [x] `S2` Organizer onboarding as a series of questions that sells as it goes: what games your group plays, how many of you, how you settle up now, who ends up doing the math (2026-09-28)
- [x] `S2` Onboarding ends with "Set up your next round" and inviting the group, so a new organizer gets value on day one, not on Saturday (2026-09-28)
- [ ] `S2` (partial) The paywall and free trial at the end of organizer onboarding (see area 11). The screen is built (option C) and shows after planning the next round, but it's UI only and off unless the flag is on; nothing is charged yet
- [ ] `S3` Ask for notification permission at the right moment, not on first launch

### 4. Invites and joining
- [x] `S1` Live shared rounds with a code and link (2026-09-23)
- [x] `S1` Turn on live sharing in production (2026-09-23)
- [x] `S1` Join from the web without installing anything (2026-09-25)
- [x] `S2` Joining from a link starts on an invite card (who invited you, the game, the bets, the course and who's in), then seat tiles, then your strokes, then the round. "Not on the list? Add me" sends your name to the scorekeeper, who lets you in from a note on the Play screen (2026-09-27)
- [ ] `S2` Each player can enter their own scores or just watch; hand the scorekeeper role to someone else
- [x] `S3` A link preview card for group texts (course, game, players). Join links show the game, course and first names; other links show a static card (2026-09-26). Per-round previews work in production since 2026-09-28: Routing Middleware sends preview bots to the function, and the function has the public Supabase values built in.

### 5. Setting up and playing a round
- [x] 16 games with the setup wizard, game defaults, crews, bets that change mid-round, 9 or 18 holes
- [x] `S2` Rules check fixes: every money rule from the rules check built and tested (bets changed mid-round count from the next hole, unfinished legs pay on the holes played, Rabbit set free, Quota scaled to holes played, WHS allowances) (2026-09-27)
- [x] `S2` Snake (three-putts, fixed, growing or doubling, each nine) and Hammer (double the hole, play on or fold, with a cap and who throws first), with rules, money bar and reveal: 18 games (2026-09-27)
- [x] `S1` Money on screen from the first hole of every game, starting at $0 and moving as each score is tapped, with what the hole adds and a toast when it's saved (2026-09-26)
- [x] `S1` Setup asks one question per step, puts the stakes up front with the rest under "More options," and ends on a "Round ready" screen to invite the group before hole 1 (2026-09-26)
- [ ] `S2` Several games at once in one round (Nassau plus skins plus greenies)
- [ ] `S2` (partial) "Our usual game": saved crew, games and stakes, set up in one tap. "Your usual" on the first setup step repeats the last round's game, course, group and bets (2026-09-26). Still to do: save more than one, and put it behind Pro.
- [x] `S2` Skins house rules: net, gross or both, a pot split by skins won, and what carryovers after the last hole do (nobody, split, or a playoff) (2026-09-27)
- [x] `S2` Nassau house rules: press at the turn, and no press on a leg's last hole (2026-09-27)
- [ ] `S2` More house rules: Hogan and Arnie dots, and blind wolf (the wolf goes lone before anyone tees off, for more)
- [ ] `S2` Bragging-rights mode: play any game for no money, with results, records and head-to-head in points instead of dollars
- [ ] `S2` Only the players in a round (and the scorekeeper) can edit its scores
- [ ] `S2` Suggested handicap % for each game (the WHS recommended allowances), shown as a hint next to the Strokes given choice
- [ ] `S3` New games: closest to the pin and long drive pots
- [ ] `S3` New game: team best ball, best 1 or 2 scores of 4 on each hole
- [ ] `S3` New games: Alternate shot, Shamble and Chapman
- [ ] `S3` New game: Ryder Cup team points across matches
- [ ] `S5` New games: field skins across several groups, Calcutta, and rolling quota
- [ ] `S2` (partial) House rules for every game, the variations real groups play. Some exist (modified Stableford, skins carryovers, Rabbit steal or set free and ties, 2026-09-27; skins net and gross together, skins pot split by skins won, what last-hole carryovers do, Nassau press at the turn and no press on the last hole, 2026-09-27; a skins carry stays with the players who built it when someone joins late, 2026-09-28). Go through all 18 games, and add the variations people ask for in "Suggest something."
- [x] `S2` Ending a round is one tap and forgiving: stopping early, a missing score or a player who left never traps the round open. "A player left" in the round menu, holes with a missing score aren't counted (and the results say so), and finished rounds can't get stuck as active (2026-09-26)
- [x] `S2` The killer end-of-round moment: every game and press totals up in one animated moment, then the fewest payments with one-tap pay links. Each bet resolves in turn (legs, presses, skins, biggest holes), then the totals land, then settle up with Venmo links and Mark paid, then a results image to share (2026-09-26)
- [x] `S2` More than one round in progress: starting a round never deletes the one you're in, and "Rounds in progress" in the round menu switches between them. Fixing scores on a finished round keeps it counting on the tab (2026-09-27)
- [x] `S2` "Add a player" in the round menu: their money counts from the hole they join, nobody else's strokes move, and the results say so. Games with fixed sides or an exact head count (Nassau, match play, Vegas, Sixes, Wolf, Nines, scramble) only take new players before the first score (2026-09-27)
- [ ] `S3` Side bets between two players inside a bigger round (proposed during the week, see area 21)
- [ ] `S3` Several groups, one game: multiple foursomes feeding one pot and one leaderboard (moved up from S5, 2026-09-27)

### 6. Courses
- [ ] `S1` (partial) Three bundled courses plus custom courses you can edit
- [ ] `S2` (partial) Search every course (GolfCourseAPI Pro was the pick after researching providers). Built (2026-09-26) behind a server function, and live since 2026-09-28 on the free plan (35 requests a day across everyone). Upgrade to Pro before the group uses it. Checked against the verified cards: Birch Creek and Logan River match; the database's Preston G&CC hole handicaps are swapped by nines.
- [x] `S2` Courses from the database show a soft "From course database" tag instead of a warning, and players start on the middle tee (2026-09-27)
- [ ] `S2` Favorite courses and courses near you
- [ ] `S2` Fix a hole on the spot: the organizer can correct a par, stroke index or tee rating mid-round for their group, and the fix goes to the feedback table so the course gets corrected for everyone
- [ ] `S3` "Request this course" when a search finds nothing (see area 20)

### 7. The tab and settling up
- [x] Debts netted across every round, recording payments (including partial ones), Venmo pay links
- [x] `S1` Settle up right from the end of the round: Venmo pay or request links and Mark paid, without leaving for the Tab (2026-09-26)
- [ ] `S2` (partial) One shared tab for the group: both players see the same numbers, and a recorded payment shows up for the other person. Built 2026-09-29: on a round that was shared live, "I paid" or "Mike paid me" on the person card shows on both phones, and the other side can take it back ("Didn't get it?"), one tap with an Undo toast. Needs `supabase/2026-09-29-round-payments.sql` run; until then payments stay on each phone as before. Still open: the person-card amount is each phone's own math across the rounds on that phone, so two phones can show different totals, and linking the organizer's copy of a player to the real person (area 1)
- [ ] `S2` (partial) The group can see who's settled up between rounds. Built 2026-09-29: a strip on the Tab for your latest shared round ("Last round · Sat, Sep 26", "3 of 5 square") with Square, Owes, Waiting or Carried for each player, status only, never amounts. Goes live for the group once the round payments SQL is run
- [ ] `S2` (partial) **Carry it over:** instead of "I paid," either person can propose rolling the balance into the next round. Once the other person agrees, it's no longer pending or overdue; it stays in the running tab as an agreed carry-over. Built 2026-09-29 on the same person card: "Roll to next time" with optional reasons, Agree or "I'd rather get paid" ("I'll just pay" when the payer answers), Take it back, "Carried over" with Remind and Request hidden, its own line in the person's story, and it rolls once the two finish another round. Only offered for pairs with a shared round, and hidden until the round payments SQL is run
- [x] `S2` Fewest payments for the whole group, not just pair by pair. Only ever between people who have played together; money is passed along through a mutual friend when needed (2026-09-27)
- [x] `S2` Cash App, PayPal and Zelle alongside Venmo. Each person picks their app; pay buttons use the payee's app (Zelle shows the handle with a copy button) and only show to the person paying or owed. Handles ride along on shared rounds (2026-09-27)
- [x] `S2` The Tab by person: your net with each friend, Settle up and Remind on every row, Venmo request links, and tap a person for the round-by-round story (2026-09-27)
- [ ] `S3` (partial) Request links on the Tab for every app. Venmo requests are built (2026-09-27); Cash App, PayPal and Zelle have no prefilled request link, so Remind (with your pay link) covers them for now.
- [ ] `S2` A trip tab: one tab across the rounds of a golf trip, settled once at the end
- [ ] `S3` (partial) Gentle payment reminders ("Mike still owes $18 from Saturday"). A Remind button sends a friendly text with the amount and your pay link (2026-09-27); automatic reminders still to do.
- [ ] `S3` A separate tab for each crew or trip, and "close the books" at season's end

### 8. History and stats
- [x] Round history, season stats, head-to-head
- [x] `S2` Honest head-to-head: each pair's result comes from the bets and holes between them, not from who happened to pay whom (2026-09-27)
- [x] `S2` History by month: each month shows its round count and your net, one line per round, and a Season, Month or Custom range that also drives a chart of your net over time (2026-09-27)
- [ ] `S3` Deeper stats for Pro: press win rate, results by game and by course
- [ ] `S5` Handicap trend from your rounds, as a guide next to your official index (GameBook users ask for handicap tracking). The official index still comes from GHIN or your club.
- [ ] `S5` Year in review ("Birdie Bank Wrapped")

### 9. Social and community
- [ ] `S3` The group's weekly feed: upcoming round, trash talk, settle-ups, last round's recap (see area 21)
- [ ] `S3` Follow friends' rounds live, even ones you're not in (someone's Tuesday round), with reactions and comments
- [ ] `S5` Friends list beyond your groups, suggested from people you've played with
- [ ] `S5` Wider activity feed: big wins, birdie streaks, lone Wolf wins
- [ ] `S5` A money list for each crew's season
- Design rule: dollar amounts are private by default. Feeds show results and bragging rights; only people in the round or the group see the money.

### 10. Leagues and events
- [ ] `S5` League: season, weekly schedule, sign-ups, standings, flights, league handicaps, weekly pots, dues, admin roles
- [ ] `S5` Event or trip: multiple days and rounds, team formats (Ryder Cup style), one tab for the trip, a leaderboard view for a clubhouse TV
- [ ] `S3` Trip formats: day-by-day team points (Ryder Cup style), rotating partners and a trip leaderboard, on top of the trip tab (area 7)
- [ ] `S5` An organizer dashboard on the web for league and event admins
- [ ] `S5` Printable pairings, cart signs and results sheets for events and leagues

### 11. Upgrading and paywalls
- [ ] `S2` Test what's free and what's Pro with the S2 groups, and talk to them about price (see open questions)
- [ ] `S2` (partial) Publish the free promise: a short list of what's free forever, shown on the pricing page and in the app. Nothing on it ever moves to Pro. In the app it's at the top of the paywall and one tap away on the Tab ("The Tab is free, always", 2026-09-29, branch `overnight3/pro-preview`), and now names the Tab and carry-overs; no pricing page yet
- [ ] `S2` (partial) Paywall with a 7 to 14 day free trial at the end of organizer onboarding. Invited players never see it. Option C (14 days, a trial timeline, both plans, "Keep scoring for free") is built as a preview behind a flag, with variants by weight ready for an A/B test; it needs real payments (Stripe) before it turns on
- [ ] `S2` The free trial works on monthly and annual plans, not just annual
- [ ] `S2` (partial) A Pro preview: organizers can see what the season tab and other Pro features look like before paying. Built 2026-09-29 behind the paywall flag (branch `overnight3/pro-preview`): "By person | Season (Pro)" on the Tab for organizers opens their real season from their own rounds with a Preview banner and "Try free for 14 days"; under 2 finished rounds it's a 3-step tour with a sample group. Still to do: previews of the other Pro features, and real entitlements (so an organizer's group sees their season)
- [ ] `S3` Early payers keep their price when prices go up
- [ ] `S2` Stripe on the web for the test groups, with promo codes
- [ ] `S3` App Store and Google Play purchases through RevenueCat, including restore purchases
- [ ] `S3` Account screen: manage the plan, receipts, cancel
- [ ] `S5` Event Pass (one time) and League billing
- [ ] `S5` Free plans for club captains

### 12. Notifications
- [ ] `S3` Push: invited to a round, who's in for Saturday, new trash talk, round finished with your result, someone paid you, a carry-over to approve
- [ ] `S3` Email: receipts and a welcome email
- [ ] `S4` The spring comeback email ("Your crew's first round of the season?")
- Note: during the week, notifications should feel like the group chat, not the app nagging. Group them, and let each person turn them down.

### 13. Distribution
- [ ] `S1` (partial) Already an installable web app (manifest and service worker)
- [ ] `S3` App Store and Google Play apps (Capacitor wrapper)
- [ ] `S3` Links that open straight into the app (universal links)
- [ ] `S3` Never force an update before or during a round. New versions install between rounds.
- [ ] `S3` Plays nicely next to other apps: switching to a GPS app and back keeps your place, and Birdie Bank never stops the player's music
- [ ] `S5` Referrals ("Give a month, get a month")

### 14. Trust and legal
- [x] "Friendly wagers only" screen in onboarding
- [ ] `S3` (partial) Terms of service and privacy policy. Privacy policy at /privacy.html (2026-09-25), still due its legal review; terms of service to come.
- [ ] `S3` Age check (18+ at minimum, higher in some places)
- [ ] `S3` One-time legal review of how betting is worded, before App Store review and the creator test

### 15. Behind the scenes
- [ ] `S2` Crash reporting (Sentry)
- [ ] `S2` Product analytics (PostHog or similar): rounds per week, days opened between rounds, upgrades
- [ ] `S3` Attribution: which creator sent each download, and each step from download to paying
- [ ] `S3` Support that answers: a help link in the app, a reply within a day in season, and no-fuss refunds (a slow reply on round day loses a whole group)
- [ ] `S5` Admin view: users, subscriptions, refunds, turning features on and off

### 16. Brand and identity
- [ ] `S1` (partial) A playful color theme, Phosphor icons, no emoji, one golf ball illustration with a face (`BallIllo` in `src/components/ui.jsx`), confetti, count-ups and vibrations (`src/lib/delight.js`), a few small CSS animations
- [ ] `S2` Pick the app's final name (Birdie Bank is likely a working name, 2026-09-28) and buy its domain. Custom SMTP, the quick logo and the App Store listing wait on it.
- [ ] `S2` Quick logo and app icon (good enough to start). Moved out of S1 (2026-09-26) so it doesn't hold anything up, but do it early in S2, before organizer onboarding and the paywall.
- [ ] `S2` Final logo: symbol plus the name set in type, and an app icon that stands out on a home screen
- [ ] `S2` Brand foundations: colors, typography, voice and tone (friendly trash talk, never casino), a short brand guide
- [x] `S2` Copy audit applied across the app: "group" (crew only for saved lists), "bets" not "stakes", "each player puts in" not "ante", "Gets 5 strokes" not "HC 5", one delete verb, and the money screen called the Tab. Deeper pink (#d42a6b) behind small white text (2026-09-27)
- [ ] `S2` Motion for the killer end-of-round moment
- [ ] `S3` Character and illustration set for key moments: win, loss, press, birdie, lone Wolf, all square, trash talk, empty screens, onboarding, paywalls, one per game
- [ ] `S3` More motion: character reactions, a launch animation (Lottie or Rive)
- [ ] `S5` Optional sounds for big moments, off by default
- Note: don't let the rebrand hold up S2. Learn which moments groups care about first, then put the most illustration and motion work into those.

### 17. Brand assets you can share
- [x] `S1` Round results can be shared as an image or text (2026-09-26)
- [ ] `S3` (partial) Round results image: course, game, winner, a character reaction, logo. Money hidden by default, with a switch to show it. Built (2026-09-26) without the character. The Show amounts switch starts off and remembers each person's choice (2026-09-27).
- [x] `S3` Link preview images for join and share links (iMessage, WhatsApp) (2026-09-26)
- [ ] `S3` Saturday preview card to post in the group chat (see area 21)
- [ ] `S3` All of these made from templates in the app, with the logo and a download link
- [ ] `S5` Profile card: handicap, season record, nemesis, favorite game
- [ ] `S5` Year in review cards sized for Instagram Stories

### 18. Website
- [ ] `S3` Home page, pricing, download page that points to the right app store, legal pages
- [ ] `S3` 16 game rule pages ("How to play Wolf") with a "Play this now" button
- [ ] `S3` Branded web pages behind join and share links for people without the app
- [ ] `S5` Press kit

### 19. App Store presence
- [ ] `S3` 6 to 8 screenshot slides per store: headline copy, device frames, characters, one idea per slide. Lead with the killer end-of-round moment.
- [ ] `S3` Short preview video
- [ ] `S3` Store keyword research for the listing and subtitle
- [ ] `S5` Test different screenshot sets

### 20. Feedback, roadmap and community
- [ ] `S1` (partial) "Suggest something" in the app with four choices: a new game, a missing course, a feature, something's broken. Saves to a Supabase feedback table. Built in Settings (2026-09-25); goes live once the feedback section of `supabase/schema.sql` is run in Supabase.
- [ ] `S1` (partial) Each form asks for what's useful: a game's rules and how the money works; a course's name, city and optional scorecard photo; a bug's screenshot with round and device details attached automatically. Built (2026-09-25), same SQL step as above.
- [x] `S2` Show it in natural places: course search with no results, the end of the games list, a quick "How was it?" after a round (2026-09-26)
- [x] `S2` After a round, "How was Birdie Bank today?" saves a one-tap reaction as feedback, then offers a form to say more (2026-09-27)
- [x] `S2` Needs check by kind of user: the organizer, the invited friend, the trip or member-guest organizer, the league runner, and a casual twosome. Done as research (2026-09-26); the approved proposals and missing games are now in their areas (2026-09-27)
- [ ] `S2` Bug and polish pass after each batch of real rounds: fix what broke, smooth anything that took extra taps or caused a question on the course
- [ ] `S2` Slack community (free plan): #feedback, #game-requests, #course-requests, #bugs, #show-your-round, #general. Invite each group's organizer personally.
- [ ] `S2` Slack to database automation: a Slack app sends feedback channel messages to Supabase, Claude sorts each one (game, course, feature, bug), merges it with matching roadmap items and pulls out details, then replies in Slack with the roadmap link. Needed because Slack's free plan hides messages after 90 days.
- [ ] `S2` Weekly feedback digest for Trevor to approve items onto the roadmap
- [ ] `S3` Public roadmap in the app and on the website: Planned, In progress, Shipped, with votes, comments and new requests
- [ ] `S3` After submitting a request, people land on the roadmap
- [ ] `S3` Tell requesters when their idea ships ("The game you asked for is live")
- [ ] `S4` "What's new" screen for release notes
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
- [ ] `S3` Lock down plans before the creator test: only the organizer changes a plan and each person changes only their own answer (anyone with the code can for now, 2026-09-28)
- [ ] `S3` Push reminders for upcoming rounds (the morning text is a share for now)
- [ ] `S3` Tee time reminder: "Book your tee time, Saturday fills up by Wednesday," with a link to the course's booking page and a reminder day the organizer picks
- [ ] `S3` Countdown and a Saturday preview: who's in, the games, who gets strokes on which holes, head-to-head records ("Mike is 3 and 1 against Dave this season")

**Trash talk**
Kept light on purpose. Groups already have a group text, so Birdie Bank adds to it rather than replacing it.
- [ ] `S3` Comments and reactions on rounds, challenges and settle-ups, plus quick jabs to pick from, with character illustrations
- [ ] `S3` Easy sharing into the group's own text thread (preview cards, results, callouts)
- [ ] `S3` Challenges: "Dave challenges Mike to a $20 match on Saturday." Mike accepts or declines, and it becomes a side bet in the round.
- [ ] `S3` Callouts from the tab and stats ("Still owes $40," "Hasn't won a skin in 3 weeks"), easy to post, never mean-spirited
- Not now: a full chat system for each round or group. It's a lot of work to do well, and nobody has asked for it. Revisit only if the feedback table shows groups want it.

**Settling up during the week**
- [ ] `S2` (partial) Group sees who has paid from last round (see area 7; built 2026-09-29, waits on the round payments SQL)
- [ ] `S2` (partial) Carry-over proposals: propose rolling a balance into the next round; once the other person agrees, it's settled for now (see area 7; built 2026-09-29, waits on the round payments SQL)
- [ ] `S3` Monday recap: last round's results, who's paid, what carried over

**Watching other rounds**
- [ ] `S3` Friends' rounds during the week show up live in the feed, with reactions and comments (see area 9)

- Note: this is also the answer to Birdie Bank being played once a week. It gives a new organizer something to do on the day they download (set up Saturday, invite the group), which is what makes paid creator marketing work.

### 22. Creator marketing (from Jake Castillo's playbook)
- [ ] `S3` List of 50 to 100 golf creators on TikTok, Instagram and YouTube with 10k to 100k followers. Skip the big names and the tiny accounts. Favor ones who already film money matches with their buddies.
- [ ] `S3` Price each deal before reaching out: take the median views of their last 10 to 15 videos, leaving out any viral outlier, then compare cost per view across creators
- [ ] `S3` Two-minute brief (a short doc): the problem, the end-of-round moment, the "friendly games" wording, #ad, the download link. Then let them make the video their way. Show the real app with their real group, not an ad read. GameBook reviews show viewers who feel sold to leave 1 star reviews.
- [ ] `S3` A download link or code for each creator, so attribution works (see area 15)
- [ ] `S4` Sign 10 creators at $300 to $500 each: flat fee, paid upfront, one post each, reuse rights included. Keep $1k in reserve.
- [ ] `S4` Measure each creator against the benchmarks: downloads per 1,000 views, share reaching the paywall, share paying
- [ ] `S5` Put more money into the 2 or so that work. When a video takes off, work out its format and run it with other creators until it stops working.
- [ ] `S5` Use the reuse rights to run the best videos as paid ads (for example TikTok Spark Ads)
- [ ] `S5` Monthly retainers with the best creators

---

## Open questions

**Pricing and payments are unknown, and that's fine.** We'll learn what people pay for by testing and talking to groups, not by predicting. It doesn't block building anything else. Prices, plans and the free and Pro split in this file are placeholders. Things to learn along the way:
- Is there a free tier for organizers after the trial, or is it trial then paid? The GameBook lessons lean toward a small free tier (roughly what the app does today: score a round and settle it) that never shrinks, so put less on the free promise at first rather than take things back later.
- Does the first paywall test run on Stripe on the web or wait for the App Store? Stripe on the web is the easy start, since test groups already use the web app. Before S3, check Apple's current rules on linking out to web payments in US apps.
- A hard paywall at the end of onboarding (Jake's playbook) or a trial with a "Keep scoring for free" option? Measure both.
- What price, and how much annual vs monthly? Talk to the S2 groups before picking numbers.

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
- 2026-09-29 (overnight): The shared Tab and carry-overs (decisions 1 and 2). A payment on a round that was shared live is a row keyed to the round's code and its transfer, so "I paid" shows on both phones and marking the same transfer on two phones counts once; the other side can take it back with one tap. The Tab by person keeps each phone's own math; a strip shows who's square in your latest shared round, status only. "Roll to next time" asks the other person to carry what's owed into the next round; agreed carries hide Remind and Request and never change the money. New table in `supabase/2026-09-29-round-payments.sql` (not run yet). Old rounds and payments read the same money (tested). Tests: 385 passing.
- 2026-09-29 (overnight): Free promise and Pro preview (decision 3). The Tab gets "By person | Season (Pro)" for organizers while the paywall flag is on (off in production, so nothing changes there tonight). Season is built from your own finished rounds this season through the same round math, so every game in a round counts; with fewer than 2 finished rounds it shows a 3-step sample tour (Alex, Jordan, Pat, Lee, Casey, marked Sample, and swapped for other names if one matches a real player). "Try free for 14 days" opens the paywall preview and records the source; nothing is charged. The free list gained the Tab and carry-overs, sits at the top of the paywall, and is one tap away on the Tab for everyone. Pro access is one function with a TODO until real entitlements exist; for now organizers get the preview and invited players never see Pro. History and Players keep their free season views. Tests: 399 passing. Checklist unchanged (2 items still partial).
