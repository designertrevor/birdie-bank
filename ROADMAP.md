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

---

## Current focus

**Step 1: Foundation.** Accounts and cloud data, claiming your seat, and the first "Suggest something" form. Invites are live in production, and a join link now takes a new phone straight to picking your name. Start the quick logo alongside, since it's design work Trevor does himself and doesn't block engineering. Build the cloud data offline first: a round in progress must keep working with no signal and never lose a score (see "Lessons from Golf GameBook").

**The big date:** the creator test (S4) runs February to April 2027, when golf season starts back up. Everything before it is about being ready: a product groups keep using, a smooth path from video to paying, and an App Store app.

Last updated: 2026-09-25

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

**Free forever:** join any round by link, live scores, all games, your own settle-up, trash talk in your group's rounds. Invited players never see a paywall.
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
- **Gate:** your Saturday group has used it for 8+ real rounds with zero math by hand.
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
- [ ] `S1` Sign in with Apple, Google, or a phone number or email link
- [ ] `S1` Rounds, crews and the tab saved to the cloud and shared across devices
- [ ] `S1` Claim your seat: a guest player becomes the real person when they sign up, and their history and tab come with them
- [ ] `S1` Move each phone's existing local data into the account
- [ ] `S1` Offline first: scoring keeps working with no signal, changes queue and sync when signal returns, and a score is never lost or overwritten
- [ ] `S3` Delete your account (Apple requires it)

### 2. Profiles
- [ ] `S1` (partial) Players have a name, handicap index and Venmo username, stored only on the phone
- [ ] `S3` Your own profile: photo, home course, handicap, which payment apps you use
- [ ] `S5` Profile stats: rounds, net winnings, record against each friend, favorite game
- [ ] `S3` Privacy settings, with money hidden by default

### 3. Onboarding
- [x] Three-step first run: welcome, the "friendly wagers" disclaimer, your name and handicap
- [x] `S1` Two paths: the organizer setting up a game, and the invited player arriving from a link (pick your name, you're in) (2026-09-25)
- [ ] `S1` (partial) Guests play without an account, then "You won $22. Save it to your tab" leads to sign-up. Guests can play from a link now; the sign-up prompt waits on accounts.
- [ ] `S2` Organizer onboarding as a series of questions that sells as it goes: what games your group plays, how many of you, how you settle up now, who ends up doing the math
- [ ] `S2` Onboarding ends with "Set up your next round" and inviting the group, so a new organizer gets value on day one, not on Saturday
- [ ] `S2` The paywall and free trial at the end of organizer onboarding (see area 11)
- [ ] `S3` Ask for notification permission at the right moment, not on first launch

### 4. Invites and joining
- [x] `S1` Live shared rounds with a code and link (2026-09-23)
- [x] `S1` Turn on live sharing in production (2026-09-23)
- [x] `S1` Join from the web without installing anything (2026-09-25)
- [ ] `S2` Each player can enter their own scores or just watch; hand the scorekeeper role to someone else
- [ ] `S3` A link preview card for group texts (course, game, players)

### 5. Setting up and playing a round
- [x] 16 games with the setup wizard, game defaults, crews, bets that change mid-round, 9 or 18 holes
- [ ] `S2` Several games at once in one round (Nassau plus skins plus greenies)
- [ ] `S2` "Our usual game": saved crew, games and stakes, set up in one tap
- [ ] `S2` (partial) House rules for every game, the variations real groups play. Some exist (modified Stableford, skins carryovers). Go through all 16 games, and add the variations people ask for in "Suggest something."
- [ ] `S2` Ending a round is one tap and forgiving: stopping early, a missing score or a player who left never traps the round open
- [ ] `S2` The killer end-of-round moment: every game and press totals up in one animated moment, then the fewest payments with one-tap pay links
- [ ] `S3` Side bets between two players inside a bigger round (proposed during the week, see area 21)
- [ ] `S5` Several groups, one game: multiple foursomes feeding one pot and one leaderboard

### 6. Courses
- [ ] `S1` (partial) Three bundled courses plus custom courses you can edit
- [ ] `S2` Search every course (GolfCourseAPI Pro was the pick after researching providers)
- [ ] `S2` Favorite courses and courses near you
- [ ] `S2` Fix a hole on the spot: the organizer can correct a par, stroke index or tee rating mid-round for their group, and the fix goes to the feedback table so the course gets corrected for everyone
- [ ] `S3` "Request this course" when a search finds nothing (see area 20)

### 7. The tab and settling up
- [x] Debts netted across every round, recording payments (including partial ones), Venmo pay links
- [ ] `S2` One shared tab for the group: both players see the same numbers, and a recorded payment shows up for the other person
- [ ] `S2` The group can see who's settled up during the week
- [ ] `S2` **Carry it over:** instead of "I paid," either person can propose rolling the balance into next week. Once the other person agrees, it's no longer pending or overdue; it stays in the running tab as an agreed carry-over.
- [ ] `S2` Fewest payments for the whole group, not just pair by pair
- [ ] `S2` Cash App, PayPal and Zelle alongside Venmo
- [ ] `S3` Gentle payment reminders ("Mike still owes $18 from Saturday")
- [ ] `S3` A separate tab for each crew or trip, and "close the books" at season's end

### 8. History and stats
- [x] Round history, season stats, head-to-head
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
- [ ] `S5` An organizer dashboard on the web for league and event admins
- [ ] `S5` Printable pairings, cart signs and results sheets for events and leagues

### 11. Upgrading and paywalls
- [ ] `S2` Test what's free and what's Pro with the S2 groups, and talk to them about price (see open questions)
- [ ] `S2` Publish the free promise: a short list of what's free forever, shown on the pricing page and in the app. Nothing on it ever moves to Pro.
- [ ] `S2` Paywall with a 7 to 14 day free trial at the end of organizer onboarding. Invited players never see it.
- [ ] `S2` The free trial works on monthly and annual plans, not just annual
- [ ] `S2` A Pro preview: organizers can see what the season tab and other Pro features look like before paying
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
- [ ] `S3` Terms of service and privacy policy
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
- [ ] `S1` Quick logo and app icon (good enough to start)
- [ ] `S2` Final logo: symbol plus the name set in type, and an app icon that stands out on a home screen
- [ ] `S2` Brand foundations: colors, typography, voice and tone (friendly trash talk, never casino), a short brand guide
- [ ] `S2` Motion for the killer end-of-round moment
- [ ] `S3` Character and illustration set for key moments: win, loss, press, birdie, lone Wolf, all square, trash talk, empty screens, onboarding, paywalls, one per game
- [ ] `S3` More motion: character reactions, a launch animation (Lottie or Rive)
- [ ] `S5` Optional sounds for big moments, off by default
- Note: don't let the rebrand hold up S2. Learn which moments groups care about first, then put the most illustration and motion work into those.

### 17. Brand assets you can share
- [ ] `S1` (partial) Round results can be shared, but only as text
- [ ] `S3` Round results image: course, game, winner, a character reaction, logo. Money hidden by default, with a switch to show it.
- [ ] `S3` Link preview images for join and share links (iMessage, WhatsApp)
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
- [ ] `S1` "Suggest something" in the app with four choices: a new game, a missing course, a feature, something's broken. Saves to a Supabase feedback table.
- [ ] `S1` Each form asks for what's useful: a game's rules and how the money works; a course's name, city and optional scorecard photo; a bug's screenshot with round and device details attached automatically
- [ ] `S2` Show it in natural places: course search with no results, the end of the games list, a quick "How was it?" after a round
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
- [ ] `S2` Upcoming rounds: date, course, tee time, and games and stakes set during the week, not on the first tee
- [ ] `S2` Who's in: each player answers in, out or maybe, and the organizer sees the count
- [ ] `S2` Bets set ahead of time, so the round starts in one tap on the first tee
- [ ] `S3` Tee time reminder: "Book your tee time, Saturday fills up by Wednesday," with a link to the course's booking page and a reminder day the organizer picks
- [ ] `S3` Countdown and a Saturday preview: who's in, the games, who gets strokes on which holes, head-to-head records ("Mike is 3 and 1 against Dave this season")

**Trash talk**
Kept light on purpose. Groups already have a group text, so Birdie Bank adds to it rather than replacing it.
- [ ] `S3` Comments and reactions on rounds, challenges and settle-ups, plus quick jabs to pick from, with character illustrations
- [ ] `S3` Easy sharing into the group's own text thread (preview cards, results, callouts)
- Not now: a full chat system for each round or group. It's a lot of work to do well, and nobody has asked for it. Revisit only if the feedback table shows groups want it.
- [ ] `S3` Challenges: "Dave challenges Mike to a $20 match on Saturday." Mike accepts or declines, and it becomes a side bet in the round.
- [ ] `S3` Callouts from the tab and stats ("Still owes $40," "Hasn't won a skin in 3 weeks"), easy to post, never mean-spirited

**Settling up during the week**
- [ ] `S2` Group sees who has paid from last round (see area 7)
- [ ] `S2` Carry-over proposals: propose rolling a balance into next week; once the other person agrees, it's settled for now (see area 7)
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

## Progress log

- 2026-09-25: Roadmap created. Starting S1.
- 2026-09-25: Reworked the steps around paid creator marketing and a spring 2027 creator test. Added area 21 (between rounds) and area 22 (creator marketing).
- 2026-09-25: Read Golf GameBook's 1 and 2 star App Store reviews. Added "Lessons from Golf GameBook" and new items in areas 1, 5, 6, 8, 10, 11, 13, 15 and 22.
- 2026-09-25: Finalized for now: pricing marked as something to learn by testing, full chat set aside, "build what's asked for" added to the rules.
- 2026-09-25: Live sharing was already on in production (since 2026-09-23). A join link on a new phone now skips organizer onboarding: see the round, pick your name, you're in.
