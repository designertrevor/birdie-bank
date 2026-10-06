# O10 research (a): App Store and Google Play keywords

Roadmap area 19 "Store keyword research for the listing and subtitle" (S3). Research only, no code. Checked 2026-10-06.

The app name is still a codename, so every title below uses `{Name}` as a placeholder. The suffix after the name is counted separately so it still works once the real name is picked.

## How this was researched, and how far to trust it

- **Sources:** web search results only. apps.apple.com, play.google.com, the iTunes Search API, Google Trends and every ASO and app-tracking site (AppFollow, AppGoblin, MWM, AppBrain) were blocked by this session's network proxy. So competitor titles and subtitles are as search engines index them on 2026-10-06, not read off the live store pages. Spot-check the top 5 on a phone before you rely on them.
- **No real volume numbers.** Apple and Google don't publish keyword volume. The real numbers come from Apple Search Ads (a "popularity" score from 5 to 100 per term) and Google Ads Keyword Planner. Both need an account, and tonight's rules say no new accounts. Every volume below is a **qualitative estimate** (High, Med, Low, Very low), based on which apps chose to put the term in their title (developers pay for title space, so it's a decent signal), how many apps target it, and how golfers talk on forums and in articles. Treat these as hypotheses to check with Search Ads popularity before launch.
- The one public web number found: "golf betting tips" gets about 6,600 Google searches a month (third-party SEO snippet). That is tour-betting intent, not friends' games. It's a warning, not a target (see keyword 15).

## What competitors put in their listings

| App | Title (30) | Subtitle (30) | What it tells us |
|---|---|---|---|
| Golf GameBook | Golf GameBook: Scorecard & GPS | Shot Tracker & Range Finder | The app golf YouTubers use leads with scorecard and GPS, not games. "20 game formats incl. skins" sits in the description |
| 18Birdies | 18Birdies: Golf GPS Tracker | Range Finder, Handicap, Score | GPS, handicap and score are taken by the giants |
| TheGrint | TheGrint: Golf GPS & Scorecard | Accurate GPS, Stats, Handicap | Same cluster. Play listing: "TheGrint \| Golf Handicap & GPS" |
| Golf Pad | Golf Pad GPS Range Finder | Scorecard, Tracker, Handicap | Same cluster |
| Squabbit | Squabbit - Golf Tournament App | Tournament and league scoring | Owns "tournament" and "trip". Side games only in the description |
| Beezer Golf | BEEZER GOLF - Golf Scorecard | Golf Side Games, Golf GPS | The closest positioning to ours. Uses **"side games"** in the subtitle. Calls its ledger "Beezer Bank" and says "dollars, pounds, quarters or beers" |
| Skins App (SKINS) | Skins App | On-course Golf Games | Press calls it a "golf betting app", but the listing says "golf games". $40 a year. Troon partnership |
| Halved | (not confirmed) | Skins, Nassau & golf games | Spends the subtitle on game names |
| OneUnder Golf | One Under Golf | Bets and Scorecard | Uses **"Bets"** in the subtitle, and it's live |
| Honors | Honors (golf bets) | (not confirmed) | Released 2026-07-08. Third-party trackers list it as "Honors - Golf Bets" |
| GolfBet | GolfBet: Bet Tracker | (not confirmed) | "Bet Tracker" in the title. $1.99 |
| Wolf Plus | Wolf Plus | Golf- Wolf, score, rules, more | One game, $4.99. Description says "friendly wager" |
| 19th Tee | 19th Tee | (tagline "Get skin in the game") | "settle bets without post-round math or arguments", Venmo settle |
| Press Golf | Press Golf | (not confirmed) | "for golfers who play for something", "a friendly $5 Nassau", auto presses, payouts |
| Big Game Golf | Big Game | (not confirmed) | "side action", "wagering". Also goes beyond golf into sports picks |
| Golf Wager, Golf Betters, iBet Golfing, Tlani, Leaderboard, WolfMore, Settle Up Golf, Golf with Mates, Bets and Strokes (Android), Golf Action | various | | A long tail of small apps. The niche is crowded with small players and has no clear winner. Settle Up Golf uses "who owes who" |

**Takeaways**

1. The big apps (GameBook, 18Birdies, TheGrint, Golf Pad) spend their title and subtitle on GPS, scorecard and handicap. We can't win those words at launch, and they aren't our pitch anyway.
2. The money-game niche is crowded, but every app in it is small, and none clearly owns "skins", "nassau" or "side games" yet. That's the gap to go after.
3. Several live apps use "bet", "bets" or "betting" in the title or subtitle (OneUnder, GolfBet, Honors, Golf Betters, iBet). So Apple isn't auto-rejecting the word for apps that only track bets. Still, it gets extra review attention (see Policy).
4. Nobody leads with planning the round plus settling up plus group history. "Who owes who" and "settle up" are only lightly used (Settle Up Golf, 19th Tee). They describe our killer end-of-round moment.

## Ranked keyword list (32 terms)

Volume and competition are qualitative estimates (see above). "Relevance" means how well the term matches what we actually do.

| # | Keyword | Relevance | Competition | Likely volume | Notes |
|---|---|---|---|---|---|
| 1 | golf side games | Very high | Med (Beezer subtitle, small apps) | Med | Our core phrase. Policy-safe. Golfers say "side games" naturally. Title or subtitle |
| 2 | skins / golf skins | Very high | Med (Skins App owns the brand) | Med to High | The most played money game. "skins" alone also catches a brand search for "Skins App", which is fine but don't use their name. Subtitle |
| 3 | nassau / golf nassau | Very high | Low to Med | Med | The second most known game. Low competition for the word itself. Subtitle |
| 4 | golf scorecard | High | **Very high** (all the giants) | High | Too contested for the title. Put "scorecard" in the keyword field so Apple combines it with "golf" from the title |
| 5 | golf games | High | Med to High (mixes with video games like Golf Clash) | High | Noisy intent. Fine as two words split across fields ("golf" in the title, "games" in the subtitle) |
| 6 | wolf / golf wolf | Very high | Low | Low to Med | Wolf Plus and WolfMore target it. Cheap to rank |
| 7 | golf bet / golf bets | Very high | Med, mixed with sportsbooks | Med | Matches intent, but policy and ad risk. Use in the Apple keyword field (hidden) and in descriptions as "friendly bets", not in the title (see Policy) |
| 8 | golf betting app | High | High (sportsbooks like DraftKings and FanDuel compete) | Med | Search intent is split between tour betting and friends' games. Don't chase it in visible metadata |
| 9 | settle up / who owes who | Very high | Low | Low (growing) | Describes our hero moment. Good subtitle words. "Who owes who" is how people phrase it |
| 10 | golf money games | Very high | Low | Low to Med | Common in articles ("9 best golf money games"). Safer than "betting". Title candidate |
| 11 | golf wager / wager tracker | High | Low | Low | Golf Wager owns the exact name. Keyword field only |
| 12 | match play | High | Med | Med | We support it. Keyword field ("match") |
| 13 | vegas (golf) | High | Low | Low | Game name. Keyword field |
| 14 | banker / hammer / snake / quota / sixes / rabbit | High | Very low | Very low each | Long-tail game names. Cheap and easy to rank for. Fill leftover keyword characters. Use the description for the ones that don't fit |
| 15 | golf betting tips | Low | High | Med (about 6,600 a month on Google, third-party) | Tour-betting intent. **Avoid**: wrong users, and it draws gambling scrutiny |
| 16 | scramble | Med | Med (Squabbit, tournament apps) | Med | Group events and trips. Keyword field |
| 17 | best ball | Med | Low to Med | Low | We support it. Description, or the keyword field if there's room |
| 18 | stableford | Med | Med (GameBook, UK and Australia) | Med outside the US, low in the US | Bigger in the UK and Australia. Use it in those storefronts' keyword fields |
| 19 | golf trip | Med | Med (Squabbit, trip planners) | Low to Med | Trip Pass fit. Description, maybe the keyword field later |
| 20 | golf league | Med | Med to High | Med | Organizer audience. Keyword field later (S5 leagues) |
| 21 | golf buddies / golf with friends | High | Low (but the video game "Golf With Your Friends" adds noise) | Low to Med | "buddies" is cleaner than "friends" |
| 22 | golf group / golf crew | High | Low | Low | Our language ("crews"). Description |
| 23 | tee time / plan round | Med | High ("tee time" means GolfNow-style booking) | High, wrong intent | We plan, we don't book. Avoid in visible fields so we don't disappoint people |
| 24 | press (nassau press) | High | Very low | Very low | Keyword field |
| 25 | payout / payouts | High | Low | Low | Keyword field |
| 26 | tab | High | Very low | Very low | Our screen name. Keyword field only if there's room |
| 27 | leaderboard | Med | Med | Med | Description |
| 28 | handicap / net strokes | Med | Very high | High | Giants own it. Description only |
| 29 | golf GPS / rangefinder | Low | Very high | Very high | We don't do GPS. Never use it: it's misleading and burns reviews |
| 30 | Venmo / Cash App / PayPal | Med | n/a | n/a | Trademarks. Never in title, subtitle or keywords (guideline 2.3.7). OK in the description as "request links for Venmo, Cash App, PayPal" if accurate |
| 31 | competitor names (GameBook, Skins App, Beezer, 18Birdies) | n/a | n/a | n/a | Never in metadata (2.3.7: "popular app names"). Use Apple Search Ads competitor bidding later instead |
| 32 | golf gambling | Low | n/a | n/a | **Never use.** It's the word that triggers guideline 5.3 and Play gambling review |

## Title and subtitle combos (Apple, 30 characters each)

Counts include spaces and punctuation, worked out with a script. The title count is the suffix after `{Name}`. Whatever is left of the 30 is the budget for the name.

| # | Title | Suffix length (name budget) | Subtitle | Subtitle length | Why |
|---|---|---|---|---|---|
| 1 (**Suggested**) | `{Name}: Golf Side Games` | 17 (name up to 13) | `Skins, Nassau, Wolf, Settle Up` | 30 | Indexes golf, side, games, skins, nassau, wolf, settle up. Policy-safe. Says what we are and the hero moment |
| 2 | `{Name}: Golf Money Games` | 18 (name up to 12) | `Skins, Nassau & Who Owes Who` | 28 | "Money games" is stronger and still not "gambling". "Who owes who" matches the phrase people use |
| 3 | `{Name}: Skins & Nassau` | 16 (name up to 14) | `Golf Scorecard & Side Games` | 27 | Leads with the two biggest game names. Puts "scorecard" visible. Good if the name itself already says golf |
| 4 | `{Name}: Golf Side Games` | 17 (name up to 13) | `Skins, Nassau, Wolf & Payouts` | 29 | Version of 1 that says "payouts" instead of "settle up" (worth an A/B test later) |
| 5 (riskier) | `{Name}: Golf Games & Bets` | 19 (name up to 11) | `Side games, scores & settle up` | 30 | Puts "bets" in the title like OneUnder and GolfBet. Higher intent match, higher review and ad risk. Only after the legal review signs off |

## Apple keyword field (100 characters)

Rules: comma-separated, no spaces after commas, don't repeat words already in the title or subtitle, singular forms, no trademarks or app names.

For combo 1 (title has golf, side, games; subtitle has skins, nassau, wolf, settle, up):

```
scorecard,bet,wager,money,match,buddies,owes,who,tab,payout,vegas,banker,hammer,press,scramble,quota
```
100 characters exactly.

Policy-cautious version (no bet or wager), if the legal review prefers it:

```
scorecard,money,match,buddies,owes,who,tab,payout,vegas,banker,hammer,snake,press,scramble,trip
```
95 characters.

Notes: Apple combines words across the name, subtitle and keyword field, so "golf" (title) plus "scorecard" (keywords) can rank for "golf scorecard", and "who" plus "owes" can rank for "who owes who". The keyword field isn't shown to users but reviewers can see it, so "bet" there is low risk, not zero risk. For UK and Australian storefronts, swap `quota,vegas` for `stableford,sixes`.

## Google Play short description options (80 characters)

Google Play has no keyword field. It indexes the title (30), the short description (80) and the full description (4,000). Avoid "best", "#1", "free" and price or promotional words (Play metadata policy).

| # | Short description | Length |
|---|---|---|
| 1 (**Suggested**) | Golf side games for your group: skins, Nassau, wolf. Scores and payouts done. | 77 |
| 2 | Skins, Nassau, Wolf and more. Keep score with friends and see who owes who. | 75 |
| 3 | Plan the round, play skins and Nassau, settle up. Golf side games for groups. | 77 |
| 4 | Play skins, Nassau and wolf with friends. The app does the math and the tab. | 76 |
| 5 | Friendly golf games made easy: score, track side games, settle up after. | 72 |

Play title: the same as Apple combo 1 (`{Name}: Golf Side Games`). In the full description, repeat the core terms naturally 3 to 5 times each (side games, skins, Nassau, wolf, scorecard, settle up, golf buddies) and list every game by name once. Don't keyword-stuff: Play flags repeated lists.

## Policy risk: betting and gambling words

**Apple**
- Guideline 5.3 (Gaming, Gambling, and Lotteries) says this is "one of the most regulated offerings" and to expect "extra time during the review process". 5.3.3: no in-app purchase for "credit or currency for use in conjunction with real money gaming". 5.3.4: real-money gaming needs licences and geo-restriction. We stay outside 5.3.4 as long as the app **never holds, moves or escrows money**, and settling stays a record plus links out to Venmo, Cash App, PayPal or Zelle.
- Guideline 2.3.7: name limited to 30 characters. Don't pack metadata with "trademarked terms, popular app names, pricing information, or other irrelevant phrases". The subtitle must not "reference other apps or make unverifiable product claims".
- Age rating (new tiers since July 2025: 4+, 9+, 13+, 16+, 18+): real-money gambling drives 18+, and simulated gambling drives 13+ or 16+. How we answer the "gambling" questions for an app that records real-life friendly bets but processes no money is a judgment call for the one-time legal review (roadmap area 14). Expect 17+ or 18+ to be the safe answer, and note it limits who can find the app. This matches the 18+ age check already in the app.
- Reviewer notes: say plainly in App Review notes that the app "keeps score for golf games played between friends; it never holds, transfers or facilitates payment of stakes; settle-up opens the user's own payment app".

**Google Play**
- The Real-Money Gambling, Games and Contests policy covers apps that facilitate online gambling, which need a licence, approval, and to be free of Play billing. An app that records offline games between friends and handles no stakes isn't an online gambling app. But "betting" wording in the listing invites a closer look, and Play also bans "simulated gambling" apps that point users to real-money gambling. Answer the IARC content rating questionnaire consistently with Apple.
- Ads: Google Ads and Meta treat "betting" and "gambling" keywords as restricted categories. If the store listing and the creative say "bets", paid campaigns for the S4 creator test may need gambling certification or get limited. "Side games" and "money games" avoid that.

**Recommended wording**
- Visible fields (title, subtitle, short description, screenshots): "side games", "friendly games", "money games", "skins, Nassau, wolf", "who owes who", "settle up", "payouts".
- Hidden or low-visibility (Apple keyword field, deep in the description): "bet", "wager", "friendly wagers".
- Never: "gambling", "casino", "odds", "sportsbook", "win money", "cash prizes", any dollar amounts in metadata.
- Description disclaimer line: "For friendly games between friends. [Name] never holds or sends money; settling up opens your own payment app."

## Next steps for Trevor

1. After the name is picked: check combo 1's words in Apple Search Ads popularity (and Google Keyword Planner for Play). That needs an account, so it's your call.
2. Spot-check the competitor subtitles above on a phone (they came from search indexes, not the live store pages).
3. Bring the "bet in the keyword field" question and the age-rating answers to the legal review (area 14).
4. After launch: use Apple Product Page Optimization to test combo 1 against combo 2 or 4.

## Sources

- [Apple App Review Guidelines (5.3, 2.3.7)](https://developer.apple.com/app-store/review/guidelines/), fetched 2026-10-06
- [Apple age ratings reference](https://developer.apple.com/help/app-store-connect/reference/age-ratings), [age rating tiers summary (Capgo)](https://capgo.app/blog/app-store-age-ratings-guide/)
- [Google Play Real-Money Gambling policy](https://support.google.com/googleplay/android-developer/answer/9877032), [Play metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842), [Gummicube on the Play gambling policy](https://gummicube.com/blog/google-play-developer-policy-changes-real-money-gambling), [Android Developers Blog on listing rules](https://android-developers.googleblog.com/2021/04/updated-guidance-to-improve-your-app.html) (from search results; support.google.com was blocked)
- [Keyword field practice (MobileAction)](https://www.mobileaction.co/blog/ios-keywords-field/), [Adalo](https://studio.adalo.com/blog/app-store-keywords-field)
- Competitor listings as indexed: [Golf GameBook](https://apps.apple.com/app/id409307935), [18Birdies](https://apps.apple.com/us/app/-/id892700751), [TheGrint](https://apps.apple.com/us/app/532085262), [Golf Pad](https://apps.apple.com/app/id446320556), [Squabbit](https://apps.apple.com/us/app/-/id1556538444), [Beezer Golf](https://apps.apple.com/app/id1474924288), [Skins App](https://apps.apple.com/app/skins-app/id6447497626), [OneUnder](https://apps.apple.com/us/app/id6450483742), [Honors](https://mwm.ai/apps/honors-golf-bets/6786117687), [Wolf Plus](https://apps.apple.com/app/id1376107917), [19th Tee](https://apps.apple.com/us/app/19th-tee/id1574739608), [Press Golf](https://apps.apple.com/us/app/-/id1574038188), [Big Game](https://apps.apple.com/us/app/big-game/id1608219788), [Golf Wager](https://apps.apple.com/app/id1094847710), [Golf Betters](https://apps.apple.com/app/id1496092286), [iBet Golfing](https://apps.apple.com/app/id1503956885), [GolfBet](https://worldsapps.com/download-golfbet-bet-tracker), [Settle Up Golf](https://www.producthunt.com/p/settle-up-golf/settle-up-golf), [Golf with Mates](https://apps.apple.com/app/id6767859434), [Skins app press (Troon)](https://troon.com/press-releases/troon-partners-with-skins-to-elevate-golf-experience-for-players-worldwide)
