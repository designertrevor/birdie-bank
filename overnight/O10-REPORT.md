# Overnight 10 report (cloud run, 2026-10-06 05:37 to about 07:30 UTC)

Review queue: REVIEW_QUEUE_LINK

**Roadmap:** 126 of 237 items checked (53.2%) before the run. If Overnight 9 and Overnight 10 both ship: about **145 of 237 (61.2%)**. Size-weighted (each item weighted 1, 2 or 3 by how long its line is, as a stand-in for size): 61.9% now, about 68.4% if both ship. Nothing was checked off tonight; items get checked off when you ship.

- Overnight 9 would check off 8: house rules for every game, the no-pressure way in, request links for every app, the age check, the rule pages, branded link pages, the public roadmap, comments and jabs.
- Overnight 10 would check off 11: the notification ask, push, push reminders for upcoming rounds, handicap trend, year in review, Stories cards, hall of fame, crew season money list, What's new, store keyword research, and the creator list. Terms of service and Support stay partial: the terms need their legal review, and Support still needs the reply-within-a-day part.
- Field skins is built, but its roadmap line also names Calcutta and rolling quota, so it stays open. The profile card (area 12, S5) was built with spare time and would check off too, making 146 (61.6%).

**Branch:** everything is on `overnight10/next`, stacked on `overnight9/next` (unchanged). Nothing touched `main`. All task branches (`o10/*`) are local only and merged. Vercel preview: the `overnight10/next` branch preview in the Vercel dashboard (I couldn't read its URL from here; it's usually `birdie-bank-git-overnight10-next-<team>.vercel.app`). Pushes tonight: 4 (batches).

**Checks:** 2,078 tests before, TESTS_AFTER after, all passing. `npm run lint` (no em dashes) and `npm run build` pass. Money check for field skins: old snapshot files unchanged, money suites pass, an oracle sim of 4,000 random fields matched to the cent, and the review pass compared old and new skins money on 200,000 old-style games with zero differences.

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
- **QA pass:** fixed the legal pages' summary box spacing, "Most rounds" ties in the hall of fame, and spacing on the year in review image. QA_ROUND2
- **Review pass:** one real bug fixed. The push sender could be pointed at any web address through a crafted subscription; it now only sends to the browsers' push services and never follows a redirect. I also made the push SQL give a phone's push address to the newest account only, so a shared phone stops buzzing for the person before.
- **Profile card (area 12, S5):** "Share my card" on your Profile, a 1080x1080 image with handicap, the trend guide (labelled), season record, favorite game and nemesis. Money is hidden by default.
- BUDGET_LINE

## SQL to run, in order

1. Overnight 9's SQL first, if not run yet: `supabase/2026-10-07-challenge-talk.sql`, then `supabase/2026-10-07-roadmap.sql`.
2. `supabase/2026-10-08-push.sql` (new tonight). It needs schema, profiles, plan-lock, comments and round-codes, all already run. The app works the same until it runs.

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
- "Round finished" doesn't include your result yet. A carry-over that was agreed or declined doesn't notify the person who asked.
- The tee time reminder's "today" is US time (plans have no time zone).
- An older phone in a Big Game ignores the new field skins rules until it updates (the update offer helps). An organizer on an old build could drop the rules when saving.
- The RSVP push can be out of date if someone flips in, out, in within 10 minutes.
- The year in review and profile card show the app name from `app-name.js`, so they change when the name does.
- The creator list needs a phone pass to confirm counts and add more TikTok and Instagram creators.

## Decisions (answer in the review queue)

DECISIONS
