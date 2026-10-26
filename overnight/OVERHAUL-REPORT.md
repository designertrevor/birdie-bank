# The app overhaul: report (2026-10-26 night)

Branch `overhaul/next`, from main `22c8780`. Preview:
https://birdie-bank-git-overhaul-next-design-trevornielses-projects.vercel.app
(`?look=classic` for today's look on that phone, `?look=new` to undo, `?type=inter` for the
runner-up type). Nothing is on main. The review queue with Current vs New screenshots is the
artifact linked from the end of the run; this file is the written record.

## What got built

1. **Get a round going** (area 21, Trevor's six plan picks, all A). "Get a round going" on Up
   next opens one screen: an editable message, When / Where / Game and bet all optional and
   starting as Not yet, who to ask, Send to the group or copy the link. When is Set a day, A few
   options or Not sure yet, with morning or afternoon in place of a tee time. The plan page
   shows a ticket with No day yet (or the day that leads), who's in as seat tiles, then Day,
   Course, Game and Bet rows each Set, Up for a vote or Not yet, and "Lock in Sun Nov 1" once a
   day leads. No chat on the page: trash talk is a quiet row that opens a sheet. A friend's card
   says No day yet, then I'm in / Maybe / Can't, the days to tick (and add), Send my answer, and
   the game and bet vote as an outline button. The organizer gets a nudge to lock when one day
   works for most, and a dated plan becomes Layout Lab Plan A's ticket. Files:
   `src/screens/plan/`, `src/lib/plan-open.js`, `src/lib/plan-ask.js`. Notes: `overhaul-notes/plan.md`.
2. **Up next** (Layout Lab A, C and E): a countdown strip to the next round, the upcoming plans,
   Start a round with Run it back, Get a round going always there, illustrated trip and Big Game
   cards, number tiles once you've played 3 rounds, the recap moved below. First screen 420 kB of
   481. Notes: `overhaul-notes/home.md`.
3. **Players**: compact rows (about 60px, were about 170) with the buddy and name first, a quiet
   record line, the Tab as a small pill, Played with most as one row of big avatars, search from
   8 people. Flagged for another look, as asked.
4. **The Tab** (Layout Lab E): a summary, then Owes you and You owe with Paid and Roll to next time
   side by side for each person, no batch ticks, no chart. Notes: `overhaul-notes/tab.md`.
5. **History** (A with C's cards): the compact chart and month list, a card per round with the
   game art, who won, your money and the round's best moment, the month's best win bigger.
6. **Round setup** (Layout Lab A): opens on an overview with every choice and Change, the steps
   in order the first time, Run it back on top, Create round and Schedule for later on the
   overview. **Round ready** trimmed with What we agreed. Notes: `overhaul-notes/setup.md`.
7. **Scoring** (Layout Lab C with A's folding): everyone starts at par, Eagle / Birdie / Par /
   Bogey / Dbl chips (Ace on a par 3), + opens a number pad; hole, par and HCP on one line, money
   as a thin strip, the side bet ask as a chip. **Live money**: the race with Scorecard and the
   hole-by-hole story. **Results**: the podium, then who pays who, then the scorecard. Notes:
   `overhaul-notes/play.md`.
8. **The new illustrations**: `art/round-4` (116 SVGs) merged, and the new drawings placed on
   Trip, Draft, Hall of fame, Season, the Tab's empty state, Friends, Lately, the avatar picker,
   side games, the course picker, gone screens, the results and Lock in the day. Notes:
   `overhaul-notes/art.md`.
9. **The new type and look**: Fraunces 500 for headlines and money with Figtree for everything
   else, hairlines instead of shadows, smaller corners, thin icons, pink only on the one thing to
   tap, Play's numbers in heavy Figtree for the sun. Runner-up (Fraunces 400 with Inter) at
   `?type=inter`. Notes: `overhaul-notes/look.md`.

## Why this pairing

Fraunces at medium weight, with its soft axis up, reads warm and a little old-golf without being
stuffy, which is what the Good Dog study pointed at. Figtree is rounder and more of a brand than
Inter, and it has a real 800, so the scoring screen's numbers stay heavy in the same family. Inter
with a lighter Fraunces (the serif experiment) looks more like a finance app.

## Money checks (before each merge)

- Scoring: `src/lib/par-chips.test.js` keeps a copy of the old stepper as the reference. 2,000
  seeded random rounds across all 22 games save exactly what the stepper saved, including
  untouched players at par, a hole in one through the pad, pickups and edits after save. Every
  round settles to zero in whole cents.
- The Tab: `src/lib/tab-sections.test.js`, 80 seeded states. Each person's amount matches the
  balance functions to the cent, owes you minus you owe equals your net, nobody is on both sides.
  The Paid and Roll handlers are unchanged and a test holds them.
- Setup: `src/lib/setup-round.test.js` builds 11 rounds (Skins, back-nine skins, Nassau 2 v 2 with
  half strokes, side games and side bets, Wolf for points, Best ball for lunch, Banker with
  someone just playing, Stroke with and without handicaps, Match play with pots, Vegas, a trip
  round) and compares each to the old code's output field by field.

## Review and fixes

A reviewer read the merged diff and ran the app: no blockers (nothing changes what's saved, synced
or paid, shows hidden money, or crashes a main path). Six fixes made after: the e2e test's
selectors for the overview; day votes now stop at what one answer holds (7 to 9 days) instead of
dropping a day silently; the trash talk row shows on every plan that's on; a called-off plan with
no day stays 3 days from when it was called off, and an open one with no activity drops off after
30 days; a phone watching a Big Game group with no money of its own opens on the hole with the
board; results' Roll button now says "Roll it on the Tab". Full review: `overhaul-notes/review.md`.

## Decisions made for Trevor

Each one is a question in the review queue. The main ones: main buttons stay black (pink only on
one thing); the overview opens first even for a new round; Course is Set or Not yet only on a
plan; a friend's days ride inside their game vote (older app versions ignore them); watching
phones open on live money; "Dbl" and "Ace" on the chips; the Tab leads with what's owed to you;
coin stack on the empty Tab.

## Not done

- The lock screen Live Activity (area 12, a native-app line).
- Friends suggesting a course or another game on a plan, and a "still want to play?" nudge
  (new S3 lines in area 21).
- Six drawings have a see-through ball body that shows square dimples in dark mode (agreed,
  bragging, buying, megaphone, gift, bulb), mostrounds doesn't read, tees and podium have specks
  (new line in area 24). Buying and bragging sit on a cream plate for now.
- Onboarding still asks for a day when it sets up the first plan.

## SQL

None. A plan is one JSON blob on the server, so the new fields ride in it.

## Checks

See the end of the run: `npm test`, `npm run lint`, `npm run build`, `npm run e2e` and
`E2E_BUILD=1 npm run e2e`.
