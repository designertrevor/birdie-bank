# Overnight 14: social (roadmap area 9)

Branch `o14/social`. Two roadmap items: "Friends list beyond your groups, suggested from people you've played with" and "Wider activity feed: big wins, birdie streaks, lone Wolf wins". No new table, no new SQL, no new server data.

## What was built

**Friends list** (`src/lib/friends-list.js`, shown in `src/screens/Friends.jsx`)
- The Friends screen now has two views, Feed and Friends, on a toggle at the top.
- Friends lists everyone you've finished a round with, from every crew, one card per person (ids merged with "Same person as..." or seat claims count once). Each row: rounds together, when you last played, your record against them ("You're 5 and 3 against Sam") and their crews. Newest first. Tapping one opens their Person screen.
- Suggested: people your friends played with in rounds that reached your feed, most friends in common first: "Played with Dalton", "Played with Dalton and Sam", "Played with Dalton and 2 others", with the round and when. Shown as first name and initial ("Mia H."). Tapping one opens that friend's round (see question 3).
- Players tab: a new link under "Add a player", "All your friends, and people you might know", opens the Friends view.

**Wider feed** (`src/lib/feed-brags.js`, merged into the feed's Lately list)
- Hole in one, eagle, a hot round (3 or more birdies), a birdie in 3 straight rounds, a big win ($20 or more, or 10 points or more), a lone or blind Wolf beating the pack, a Nassau swept front, back and total, and 3 hammered holes won in a row.
- One friendly line each: "Dalton made an eagle on 2 at Pebble Creek", "You made 3 birdies at Pebble Creek. Hot putter", "Dave went lone wolf on 2 and beat the pack", "Sam has made a birdie in 3 straight rounds", "Cy made a hole in one on 7 at Pebble Creek. Drinks are on Cy".
- Each row has the game's own icon for its own moments (paw print for Wolf, hammer for Hammer) and the game group's colour (Classics ochre, Head to head pink, Team mint, Full round lav, Points peach), the same tints the feed already uses.
- At most 2 brags per round (the best ones) and 12 in the feed, from the last 7 days (the feed's window).

Other small changes: `roundView` in `friend-feed.js` now carries the feed's `people` line for each seat; `LatelyList` takes an item's own icon and tint; the dev-only feed (no server) lets a `bb-live:` copy say who is a friend, so suggestions can be tested locally.

## How to see it

Players tab, then "All your friends, and people you might know" (or Up next, Friends, "The group feed", then the Friends toggle).
- Friends list: shows as soon as you have finished rounds on the phone.
- Brags: Feed view, under Lately. Your own finished rounds from the last 7 days make them: make 3 birdies in a round, an eagle, or play Wolf and go lone on a hole and win it.
- Suggestions need a friend's round you weren't in. On the live app that's two accounts: B plays a round with A, then B plays one with C (an account A has never played with); A sees C under Suggested. Locally (`npm run dev`, no Supabase), paste a round into localStorage as `bb-live:CODE` = `{ meta, holes, people }`, where `people` marks your friend `{ friend: true, account: 'acct-x' }` and the stranger `{ friend: false, money: false, account: null }`. I tested it that way at 375 px.

## Privacy rules applied

- Only you never shows: suggestions and friends' brags come only from rounds `friend_rounds()` sent, and the server sends a round only when nobody in it is Only you (tested end to end with the server rules in JS, including the older per-item settings).
- Only accounts are suggested: a guest has no line in the feed, so a guest is never suggested. Never you, never a friend, never someone you've already played with.
- Friends' brags are about your friends only, never a friend of a friend or a guest, so a stranger's eagle doesn't land in your feed.
- Money: a friend's amount shows only where the feed already shows it (Show my money on, and every seat in the round lets money reach you). When the money stays back, brags carry no amount at all, and that round can't make a big win (its stakes never reach the phone). In your own rounds, your amount shows; someone else's big win reads "Dave won big at Pebble Creek" with no amount (Lately's rule: money between two other people never shows). Points always show (bragging rights).
- Nobody just playing is spotlighted.

## Risks

- A lone Wolf win, a Nassau sweep or a hammer run in a friend's round whose money stays back still shows (no amount). The hole picks and scores already come with the round, so nothing new leaves the server, but it does say who won those holes.
- A friend of a friend is known only by their seat in that round (the server never sends a non-friend's account), so the same person in rounds hosted by two different friends can show up twice under Suggested.
- "3 straight rounds" counts the rounds this phone and the feed can see. A round kept from you (someone in it is Only you) is skipped, not counted as a break.
- Your own big win sits next to the round's recap ("You won $40 at Pebble Creek" and "Skins at Pebble Creek · You took it"). See question 2.
- First screen unchanged: index chunk 261.98 kB before and after; everything new is in the lazy Friends chunk (14.9 kB).

## Questions for Trevor

1. **The big win bar.** Today it's $20 or more in a money round, 10 points or more in a points round.
   - A. Keep $20 and 10 points (suggested)
   - B. Raise to $40 and 20 points, so only real days show
   - C. Scale it by the stakes (a win of 4 times the main bet or more)
2. **Brags from your own rounds.** Your rounds already have a recap in Lately, so your own big win shows twice in a way.
   - A. Keep every brag from your own rounds (today)
   - B. Keep scoring and game brags from your rounds, drop the big win there (suggested)
   - C. Brags only from friends' rounds
3. **Tapping a suggestion.** Today it opens the round you saw them in.
   - A. Open the round (today, suggested until accounts can be looked up)
   - B. Open a small card: name, who they played with, and "Invite to a round"
   - C. Nothing to tap until there are friend requests
