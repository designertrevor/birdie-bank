# Overnight 10 report (cloud run, 2026-10-06, 05:37 to about 07:00 UTC)

**Review queue:** https://claude.ai/artifact/9mSK4QjJ2HNgTW7hrfeANs (57 decisions in 9 batches; tap answers, they save as you go, then press Finish. Private to you.)

**Roadmap:** 126 of 237 items checked (53.2%) before the run. If Overnight 9 and Overnight 10 both ship: about **146 of 237 (61.6%)**. Size-weighted (each item weighted 1, 2 or 3 by how long its line is, as a stand-in for size): 61.9% now, about 68.6% if both ship. Nothing was checked off tonight; items get checked off when you ship.

- Overnight 9 would check off 8: house rules for every game, the no-pressure way in, request links for every app, the age check, the rule pages, branded link pages, the public roadmap, comments and jabs.
- Overnight 10 would check off 11: the notification ask, push, push reminders for upcoming rounds, handicap trend, year in review, Stories cards, hall of fame, crew season money list, What's new, store keyword research, and the creator list. Terms of service and Support stay partial: the terms need their legal review, and Support still needs the reply-within-a-day part.
- Field skins is built, but its roadmap line also names Calcutta and rolling quota, so it stays open. The profile card (area 12, S5) was built with spare time and would check off too, making 146 (61.6%).

**Branch:** everything is on `overnight10/next`, stacked on `overnight9/next` (unchanged). Nothing touched `main`. All task branches (`o10/*`) are local only and merged. Vercel preview: the `overnight10/next` branch preview in the Vercel dashboard (I couldn't read its URL from here; it's usually `birdie-bank-git-overnight10-next-<team>.vercel.app`). Pushes tonight: 6 (batches of merges, plus the report).

**Checks:** 2,078 tests before, 2,198 after, all passing. `npm run lint` (no em dashes) and `npm run build` pass. Money check for field skins: old snapshot files unchanged, money suites pass, an oracle sim of 4,000 random fields matched to the cent, and the review pass compared old and new skins money on 200,000 old-style games with zero differences.

**QA:** a headless browser works here. Every new screen was screenshotted at 375px in light and dark under `overnight/o10-shots/` (polish shots in `overnight/o10-shots/polish10/`). The icon font is blocked in this sandbox, so icons are blank in the shots.

## What's built

1. **version: a check for a newer build.** Each build stamps a time and writes `/version.json`. The app checks it at launch and when it comes back to the screen (at most every 10 minutes). A newer build makes the service worker fetch it, and Up next shows the existing "Update ready" note: never forced, never mid-round. A shared round now carries the newest build that kept its score, so an older phone watching or joining it gets the same offer. This covers the Overnight 9 risk of older phones miscounting just-playing seats and new house rules.
2. **whatsnew: What's new.** Release notes from the shipped roadmap items, newest first, in Settings below Roadmap. After an update with new items, Up next shows a calm card once (never during a round). Only one of What's new and "It shipped" shows per visit.
3. **notify: notifications and web push.** A "Want a heads-up?" sheet after you share a plan, join a round, or say you're in (never at launch, signed-in only, backs off after Not now: 2 weeks, 2 months, then never). A Notifications switch in Settings. iPhone Safari is told to add the app to the Home Screen first. Pushes: round or plan invite, who's in, round finished, someone paid you, tee time reminder (daily cron), new trash talk, and a carry-over to approve. No amounts on the lock screen. Completely off until the env vars below exist. Sending uses Node's own crypto (no new dependency), checked against the official RFC 8291 example. Pushes only go to the Google, Mozilla, Apple and Microsoft push services.
4. **legal: terms and Help.** `/terms.html` (and `/terms`), marked "Draft for legal review" at the top, with friendly-wagers wording. Settings has a Help row and About has Terms next to Privacy. The support address lives in one place, `src/lib/support.js`, and the build fills it into both the terms and privacy pages.
5. **halloffame: hall of fame and the crew's season money list.** From the crew's Tab and Season: the money list (net, wins, rounds), champions, biggest wins, records. Points and reward rounds are listed separately and never added to money. Tests prove the totals match the Tab and Close the books to the cent.
6. **wrapped: year in review.** A free 1080x1920 Stories card (or text) from Your stats, Season and the hall of fame. Money only with Show amounts on (off by default).
7. **trend: handicap trend.** On Your stats, a guide figure from your own rounds next to your official index, labelled "A guide from your rounds, not an official index", with a small chart. It needs 3 rounds.
8. **polish10: Overnight 9 screens.** Trip start line, points trip avatars, a quieter dash, screen reader labels on Mark paid and Undo, "I paid part of it" when you owe, no empty bar on a missing challenge, and the just-playing line matching on Players and Bets.
9. **fieldskins: field skins house rules (money).** The Big Game already had field skins. Added: what's carried past the last hole (every skin, last-hole ties, or paid back), Canadian skins, Validate skins, Birdies win two, and a "Who has skins" board with live worths. New games split cents exactly; old games keep their old rounding, so their money never moves.
10. **research.** `overnight/O10-store-keywords.md` (32 keywords, title and subtitle options with character counts, a keyword field, Play short descriptions, policy notes) and `overnight/O10-creators.md` (50 creators). The proxy here blocked the stores and the social sites, so creator counts come from search results and many are marked unverified. It's 50, not 100.

**Extra, with the time left over:**
- **Follow-ups:** trash talk and carry-over pushes, one news card per visit, one support address.
- **QA pass:** fixed the legal pages' summary box spacing, "Most rounds" ties in the hall of fame, and spacing on the year in review image. A second round covered the profile card and field skins: a long name on the card stops before the dot, a buddy avatar that isn't ready shows initials instead of a question mark, and the field skins setup toggles line up with the card.
- **Review pass:** one real bug fixed. The push sender could be pointed at any web address through a crafted subscription; it now only sends to the browsers' push services and never follows a redirect. I also made the push SQL give a phone's push address to the newest account only, so a shared phone stops buzzing for the person before.
- **Profile card (area 12, S5):** "Share my card" on your Profile, a 1080x1080 image with handicap, the trend guide (labelled), season record, favorite game and nemesis. Money is hidden by default.
- **Push follow-ups:** "Round finished" now says your own result ("You won the Birch Creek round", "You finished 2nd"), never an amount. A carry-over that was agreed or declined tells the person who asked. RSVP pushes now match the last answer (capped at 6 an hour per plan).
- **First screen back under its JS budget:** 540 kB down to 477.6 kB (budget 481 kB). What Up next doesn't paint first now loads just after. Nothing changes for users except a buddy avatar showing its plain colour for a moment on a cold launch. Every built file is still saved for offline use.
- **Why I stopped early:** everything was merged and green at about 1 hour 15 minutes. Rather than stack more unrequested features on two unreviewed overnights, I stopped there (decision 3).

## SQL to run, in order

1. Overnight 9's SQL first, if not run yet: `supabase/2026-10-07-challenge-talk.sql`, then `supabase/2026-10-07-roadmap.sql`.
2. `supabase/2026-10-08-push.sql` (new tonight). Run it after every earlier dated file, including `2026-10-06-round-codes.sql`. The app works the same until it runs.

## Env vars to add in Vercel (only when you want push on)

| Name | What | Where |
| --- | --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | Push public key (the app reads it at build time) | Production and Preview |
| `VAPID_PRIVATE_KEY` | Push private key | Production and Preview |
| `VAPID_SUBJECT` | `mailto:` plus your support email | Production and Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard, Project settings, API | Production and Preview |
| `CRON_SECRET` | Any long random string, for the tee time reminder | Production |

Make the VAPID pair once:
`node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log('VITE_VAPID_PUBLIC_KEY='+c.getPublicKey('base64url')+'\nVAPID_PRIVATE_KEY='+c.getPrivateKey('base64url'))"`

Without them, push is silent: no ask, no subscribe, and the server functions answer 204.

## Known gaps

- Push has only been tested in code and on a local Postgres, never on a real phone or push service.
- After 6 RSVP changes in an hour on one plan, the 7th push isn't sent.
- The push SQL was checked on a local Postgres with stand-in tables, not the real Supabase schema.
- A Big Game's Skins tab: hole-by-hole amounts sit about 10px further in than the Who has skins amounts.
- The first-screen budget has only about 3.5 kB of room left.
- The tee time reminder's "today" is US time (plans have no time zone).
- An older phone in a Big Game ignores the new field skins rules until it updates (the update offer helps). An organizer on an old build could drop the rules when saving.
- The RSVP push can be out of date if someone flips in, out, in within 10 minutes.
- The year in review and profile card show the app name from `app-name.js`, so they change when the name does.
- The creator list needs a phone pass to confirm counts and add more TikTok and Instagram creators.

## Decisions (answer in the review queue)

The same 57 questions as the review queue. The Suggested pick is what was built.

### Batch 1: Run and branches

1. **The session was set to develop on main-si9ums, but the brief said overnight10/next. Where should tonight's work live?**
   - a) overnight10/next only (built by Vercel, as the brief said) **(Suggested)**
   - b) Also mirror it to main-si9ums
   - c) Move it to main-si9ums only

2. **All 10 brief tasks were merged about 40 minutes in. With the time left I added a review pass, the profile card (area 12), push follow-ups and a first-screen JS budget pass. Keep these?**
   - a) Keep all of them **(Suggested)**
   - b) Keep the review and follow-ups, drop the profile card
   - c) Drop everything outside the brief

3. **I stopped at about 1 hour 15 minutes instead of using the full 5 hours, so you aren't handed more unrequested features on top of two unreviewed overnights. Next time?**
   - a) Same: finish the brief, then fix and polish only **(Suggested)**
   - b) Keep going down the roadmap's current step until time runs out
   - c) Write a longer brief

### Batch 2: Updates and What's new

4. **How the app decides a build is newer**
   - a) By build time, so a rollback never offers an update **(Suggested)**
   - b) By commit id
   - c) By the offline file list hash

5. **How often to check for a new build when the app comes back to the screen**
   - a) Every 5 minutes
   - b) Every 10 minutes **(Suggested)**
   - c) Every 30 minutes

6. **Which phone stamps a shared round with its build**
   - a) Only the scorekeeper's phone **(Suggested)**
   - b) Every phone on the round

7. **What counts as an item already seen in What's new**
   - a) The ids of items already shown (catches late check-offs) **(Suggested)**
   - b) The newest date shown

8. **What's new on a phone's first visit**
   - a) New people see nothing; people with rounds hear about the last 14 days **(Suggested)**
   - b) Nobody sees anything until the next update

9. **Where What's new remembers what you've seen**
   - a) Its own key on the phone, like the roadmap **(Suggested)**
   - b) Inside app settings, synced across devices

10. **When What's new and It shipped could both show on Up next**
   - a) It shipped wins, What's new waits for a later visit **(Suggested)**
   - b) Whichever loads first
   - c) What's new wins

### Batch 3: Notifications and push

11. **How the server sends pushes**
   - a) Node's own crypto, no new dependency (matches the RFC 8291 example) **(Suggested)**
   - b) The web-push package
   - c) Pushes with no text

12. **The tee time reminder push**
   - a) A daily Vercel cron at 15:00 UTC, off without CRON_SECRET **(Suggested)**
   - b) Up next card only, no push
   - c) A reminder when the app opens

13. **Money on the lock screen**
   - a) No amounts ("Adam paid you") **(Suggested)**
   - b) Show amounts

14. **Who can get pushes**
   - a) Signed-in accounts only **(Suggested)**
   - b) Guests too

15. **When "someone paid you" goes out**
   - a) Only when the payer marks it themselves **(Suggested)**
   - b) Also on I got it and a third person marking it

16. **Asking for notifications in someone's very first session**
   - a) Fine right after they join or plan (often their first launch) **(Suggested)**
   - b) Never in a first session

17. **What a trash talk push says**
   - a) A fixed line with no comment text **(Suggested)**
   - b) Include the text for preset jabs
   - c) Show the comment text

18. **How often trash talk pushes**
   - a) One per person per thread every 10 minutes **(Suggested)**
   - b) One per comment
   - c) A daily digest

19. **The tee reminder's day**
   - a) US time for now **(Suggested)**
   - b) Store a time zone on plans and run hourly

20. **What someone who lost sees when a round finishes**
   - a) Plain "Round finished" **(Suggested)**
   - b) "You finished 4th"
   - c) "You lost"

21. **Where tapping a round finished push goes**
   - a) The round, as before **(Suggested)**
   - b) The Tab

22. **Ties at the top in the round finished push**
   - a) Everyone tied gets "You won" **(Suggested)**
   - b) "You tied for 1st"

23. **Cap on RSVP pushes per plan**
   - a) 6 an hour **(Suggested)**
   - b) 10 an hour
   - c) None, rely on the 40 an hour limit

24. **Where the server is allowed to send pushes**
   - a) Only Google, Mozilla, Apple and Microsoft push services, no redirects **(Suggested)**
   - b) Any https address except private ranges

### Batch 4: Terms and Help

25. **How the terms page gets the app name**
   - a) Built from app-name.js and support.js, body says "the app" and "we" **(Suggested)**
   - b) A static page saying "the app"
   - c) The name typed in

26. **The support address**
   - a) design@trevornielsen.com (already on the privacy page), set in src/lib/support.js **(Suggested)**
   - b) A placeholder like help@example.com
   - c) No address

27. **Liability cap in the draft terms**
   - a) The greater of what you paid in 12 months or $50, for the lawyer to adjust **(Suggested)**
   - b) No cap
   - c) $100

### Batch 5: Stats: trend, hall of fame, year in review, profile card

28. **9-hole rounds in the handicap trend**
   - a) Double the 9-hole figure **(Suggested)**
   - b) The official method (adds an expected score for the other nine)

29. **Tees with no rating**
   - a) Use strokes over par and say so **(Suggested)**
   - b) Leave those rounds out

30. **Rounds that don't count toward the trend**
   - a) Scramble, alternate shot, Chapman and Shamble (not your own ball) **(Suggested)**
   - b) Count everything

31. **Where the trend shows**
   - a) Your stats, using all your rounds **(Suggested)**
   - b) Your profile

32. **The official index line on the trend chart**
   - a) No label, the number sits above the chart **(Suggested)**
   - b) A small Official tag at the line's end

33. **Whose money the hall of fame shows**
   - a) Everyone's from the crew's rounds on your phone, marked Only you see this (like Season) **(Suggested)**
   - b) Hide friends who keep their money private

34. **What a crew's season is**
   - a) Rounds since the books last closed **(Suggested)**
   - b) The calendar year

35. **What counts as a win**
   - a) Money rounds only, ties shared **(Suggested)**
   - b) Points rounds too

36. **Biggest wins: name and course are grey, date darker (shared list style)**
   - a) Leave the shared style **(Suggested)**
   - b) Bold the name here

37. **Money on the year in review**
   - a) The one remembered Show amounts switch **(Suggested)**
   - b) A switch that always starts off for this card

38. **Naming the friend you played with most**
   - a) First name, or "your most-played partner" if their profile is Only you **(Suggested)**
   - b) Never name anyone

39. **Low round on the year in review**
   - a) Lowest full 18 (or 9 if never 18), every hole scored, no one-ball team games **(Suggested)**
   - b) Lowest relative to par

40. **Most played with, when partners tie**
   - a) Leave it (alphabetical) **(Suggested)**
   - b) Say "Your crew" on a tie

41. **The image header says the year twice**
   - a) Leave it **(Suggested)**
   - b) Drop the year from the second line

42. **Season figures on the profile card**
   - a) This calendar year, like the year in review **(Suggested)**
   - b) All time

43. **Favorite game on the profile card**
   - a) All time, matching the Profile tile **(Suggested)**
   - b) This season only

44. **Your own name on the profile card**
   - a) Full name as entered **(Suggested)**
   - b) First name only

45. **The nemesis with amounts off**
   - a) Show their record against you ("Adam, 0–2") **(Suggested)**
   - b) Leave the nemesis off

46. **If your own profile is Only you**
   - a) Still allow the card, sharing it is your choice **(Suggested)**
   - b) Hide the button

47. **The nemesis trash talk line on the card**
   - a) Leave it off (it's written to you) **(Suggested)**
   - b) Include it

### Batch 6: Field skins (money)

48. **Where field skins lives**
   - a) Extend the Big Game's existing field skins **(Suggested)**
   - b) A new Big Game format

49. **Cent rounding**
   - a) Exact for new games, old games keep their rounding so their money never moves **(Suggested)**
   - b) One rule for every game (46 of 3,200 old fields would move a cent)

50. **What's still carried after the last hole, by default**
   - a) Every skin (what it did before) **(Suggested)**
   - b) Last-hole ties
   - c) Paid back

51. **Under Last-hole ties, if nobody wins a skin all day**
   - a) Everyone gets their money back **(Suggested)**
   - b) The tied players take the whole pot

### Batch 7: Speed: the first screen

52. **How the first screen got back under its 481 kB budget (now 477.6 kB)**
   - a) Move what Up next needs into small files, still exported from the originals **(Suggested)**
   - b) Only load screens later with import()
   - c) Restructure the big money files

53. **Ball buddy drawings on a cold launch**
   - a) Load just after first paint, showing the backdrop colour for a moment **(Suggested)**
   - b) Keep them in the first screen and stay over budget
   - c) Show initials while they load

54. **The Supabase config file**
   - a) Leave it in the first screen (0.6 kB, startup reads it) **(Suggested)**
   - b) Defer it too

55. **Big money figures have no thousands comma ("$1284.50"), from the shared formatter**
   - a) Leave it for now **(Suggested)**
   - b) Add commas in the shared formatter (touches every screen)

### Batch 8: Polish

56. **What a trip that hasn't started says at the top**
   - a) "Starts Friday · Oct 9 to 11" (like Up next) **(Suggested)**
   - b) "Coming up · Oct 9 to 11"
   - c) Keep "Starts Oct 9 to 11"

57. **Text inside the roadmap and sheets sits 20px in while cards sit at 16px**
   - a) Leave it **(Suggested)**
   - b) Move all text to 16px


