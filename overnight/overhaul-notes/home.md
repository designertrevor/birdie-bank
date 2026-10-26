# Home: Up next and Players (overhaul/home, 2026-10-26 night)

Screenshots at 390 by 844, light and dark, in `overnight/overhaul-shots/home/` (untracked):
Up next for a new user, with 1 round and a plan, with 6 rounds (tiles), with a round in progress;
Players with 3 and with 25 people. `-scroll2` and `-scroll3` files are the rest of each scroll.

## Up next

New order, top to bottom (Layout Lab A as the base, E's cards and strip, C's tiles):

1. Update ready note (unchanged).
2. Rounds in progress (unchanged resume cards).
3. Trips on now (unchanged).
4. **Countdown strip** (new, E): a thin ink strip, "Skins · Sat  05d 05h 49m", ticking every 30
   seconds, to the first upcoming plan that's still on and that you aren't out of. Hidden with no
   plan and while a round is going on. Tap opens the plan. Days only when the plan has no tee time.
5. Upcoming rounds: `UpcomingCard` placed as is (its body untouched for the plan builder).
6. **Start card**: with nothing planned it's the one next thing, a big mint card with the ball on a
   tee, Start a round (pink, the main action) and Run it back beside it, Join a friend's round
   under them. With a plan it shrinks to "Playing now?" on white with the same buttons.
7. Your first round checklist (new users only, unchanged).
8. **Get a round going** (always there, even mid-round): a lilac card with the calendar spot that
   calls `nav.push('newRound', { ahead: true })`. It replaces the old "Plan ahead" tile.
9. Start a trip and Big Game as two small illustrated cards (peach and butter).
10. The card stack (trial reminder, install, reminders, It shipped, What's new): moved down from
    above the plans.
11. Challenges: moved out of the plans block, same component.
12. **Number tiles** (new, C), "Your golf": only once you've finished 3 rounds (`TILES_FROM`).
    The Tab, this year so far, rounds played, then Best day or You vs your most-played friend.
    Each tile only shows with real data, a zero reads "Even" or "Square", and it's always 2 or 4.
    Tap goes to the Tab, History, the round or the person. Display only, from `myTab` and `seasonBoard`.
13. The recap: **moved down** from the very top. Then For the group text (callouts).
14. Friends row, Lately (moved down a little; Friends was inside the plans block).
15. The Tab at a glance and Last time out. Once the tiles show, the Tab box hides (the Tab tile
    covers it, open rewards included); Last time out stays.

Code: `src/screens/UpNext.jsx` (order), `src/components/UpNextPlans.jsx` (`PlansAndNext`,
`StartCard`, `MoreWays`; `UpcomingCard` and `FirstSteps` untouched), `src/components/UpNextCountdown.jsx`
(the strip), `StatTiles` in `src/components/UpNextMore.jsx` (lazy, with the money), pure helpers
`nextPlan`, `stripClock`, `doneCount` in `src/lib/upnext-first.js` and `homeTiles` in
`src/lib/upnext-tiles.js` (both tested). CSS in `src/screens/upnext.css`. Art uses updated in
`art-manifest.js`. The old `.plan-card`, `.pc-*` and `.more-tile` rules in `styles.css` are now
unused; left in place so the look branch's edits merge cleanly, safe to delete after.

## Players

- Compact rows in one card with hairlines (about 60px each, was about 170): avatar, name in the
  display face, and one quiet line: a tiny RSVP tag ("In Sat", "Sat?") and "6 rounds · won 3, lost 2".
- No crews first. Crews stay at the bottom as before.
- Money on the Tab between you is a small green or red pill on the row (+$8, −$12). Tapping it
  opens a sheet with Remind and Request (they owe you) or Pay (you owe them), and a link to their
  card. Those buttons used to sit on every card and made the cards tall.
- "Played with most": one row of up to 5 big avatars (60px), only with 6+ people and at least 3 you've
  played 2+ rounds with. Hidden while searching.
- Search: shows from 8 people. With no match, "Add them".
- Add: the Add a player row stays; a small Add button by the list's head shows on long lists (8+).
- The nemesis card moved from above the list to below it (rivalry quiet, people first).
- Kept: you on top (profile), Friends link, Make a crew / crew rows, the Record Book note, the
  empty state, merge and edit (both on the player's edit screen, unchanged), and the head-to-head
  record. The money net with each person over all rounds left the row; it's on their card
  (Person.jsx's tiles). Person.jsx not touched.

**Flag: Players wants another look.** Nothing in the Layout Lab was loved; this is the compact
list as asked, with the Roster row as a light touch.

## Decisions for Trevor

1. Strip shows d/h/m (F1 style) with a tee time, ticking every 30 seconds. It hides while a round
   is going on and for a plan you're out of. Keep the minutes, or just "5 days"?
2. With a plan, Start a round stays as a slimmer card under it ("Playing now?"), not removed.
3. Tiles from 3 finished rounds; the Tab tile replaces the Tab at a glance box when they show.
   Tile five (Best day or You vs Jackson) picks Best day first.
4. "Get a round going" shows even with a round in progress.
5. Players: the row's money pill is what's on the Tab now (not the all-time net), since it's the
   thing you can act on.
6. Players: the nemesis card went below the list. Easy to move back.

## Bundle (npm run build, first screen JS)

- Before: 418.66 kB of 481 kB (O11's 379 kB has grown since).
- After: 420.26 kB of 481 kB (+1.6 kB: the strip and the pure helpers). Tiles load with
  UpNextMore (lazy, 15.22 to 17.53 kB). People 14.98 to 17.05 kB (its own chunk).

## Checks

`npm test` 2633 pass, `npm run lint` clean, `npm run build` passes under budget.
