# records: the Record Book limit (area 8)

Branch `o13/records`.

## What it does

With the paywall flag on (`?paywall=on`) and no Pro, the record views show the last 10 finished
rounds, with a calm line at the bottom: "Your last 10 rounds. Pro brings back the N older rounds.
Nothing is deleted, and the Tab still counts every round." plus a quiet "See Pro" link to the paywall
preview (source `records`). The trial, a paid plan and Pro for life all count as Pro
(`currentPlan(...).pro`), so they see everything. With the flag off nothing changes: the hook hands
back the store's own state object.

Limited views: History (list, net chart, head to head), Players (each card's record and net, the
nemesis), a Player card (the story's rounds and the rivalry card), the rivalry share card, Your stats,
More stats on Your profile, and a crew's Hall of fame (records, biggest wins, history, movers).

Never limited: the Tab, settle-up, carry-overs, payments, trips, Season money and the Hall of fame's
season money list (it adds up to the crew's tab), plus the money line on a Player card ("owes you",
"just between you two"). Hidden is view-only: the stored state, links and sync are never changed.

## Files

- `src/lib/record-book.js`: the rule, pure (`recordBookView`, `recordBookLimited`, `recordBookLine`, `FREE_ROUNDS`).
- `src/lib/record-book.test.js`: 9 tests, including the Tab pinned with the limit on versus off,
  the trial and Pro for life counting as Pro, live rounds never hidden, stored state untouched,
  who-is-who carried over, and a source check that the money screens never read the view.
- `src/lib/useRecordBook.js`: the React hook (flag, Pro for life, trial).
- `src/components/RecordBookNote.jsx`: the calm line.
- Screens: History, People, Person, Stats, Profile, HallOfFame, Share.

## How to see it

Preview URL with `?paywall=on` on a phone with more than 10 finished rounds and no trial: History,
Players, a Player card, Your stats and a crew's Hall of fame show the last 10 and the line. Start the
trial from the line's "See Pro" and everything comes back. `?paywall=off` turns the flag off again.

## Decisions for Trevor

1. Which rounds count toward the 10: options were per view (last 10 with each friend, per crew) or
   the last 10 finished rounds on the phone overall. Picked: overall, the simplest rule to explain
   ("your last 10 rounds"), the same in every view.
2. Who-is-who across hidden rounds: a claimed seat in an old round links two ids. Picked: the view
   carries every link worked out from all rounds, so a friend never splits into two cards.
3. The handicap guide on Your stats: options were limit it or keep every round. Picked: keep every
   round, since it's the handicap the way official handicaps count it (best of the last 20), and
   cutting it to 10 would give a wrong number, not a smaller record.
4. Your profile's tiles (rounds, record) are what friends see and sync from every round, so they stay
   full; the More stats block under them follows the limit like Your stats.
5. The Hall of fame's season money list stays on every round (it adds up to the crew's tab); its
   records and history follow the limit.
6. A friend whose only rounds with you are older ones stays on Players (they may have money on the
   Tab), with "Your rounds together are older ones" instead of the New chip.
7. The line never shows while a round is being played, and is never a pop-up.

## Left undone / notes

- The "Your year in review" share card and the Friends feed are not limited (not record views).
- Build note: the shared `node_modules` in the main checkout is missing `posthog-js` (added in
  overnight 12), so `npm run build` fails through the symlink. I ran `npm ci` in this worktree
  instead (node_modules is gitignored). The lead's integration worktree likely needs the same.
- No SQL, no Vercel steps.
