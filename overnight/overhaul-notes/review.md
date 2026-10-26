# Overhaul review (git diff 22c8780 overhaul/next, fbc7ef3)

No blockers found. The money path holds: 2682 unit tests pass, lint is clean, and the e2e passes once its selectors are updated (finding 1). It covers chips, the pad, the reveal, Settle up, results, standings summing to $0, who pays who and the Tab. setup-round.js is a faithful move: field-for-field the same as the old useStartRound. Par chips save what the stepper saved. tabSections nets in whole cents, and the Tab's Paid and Roll handlers are unchanged. FriendRound's hole story shows only when every amount may show (Big Game, feedMoney off and Show my money are all respected).

## Should-fix

1. **The e2e ship gate fails as merged.** `e2e/round.e2e.js:222, 244, 351`
   - Cause: "Start a round" now opens the overview, Create round moved there, and the History card's aria-label has more after the amount.
   - Repro: `npm run e2e` times out waiting for `radio /^Skins:/`.
   - Fix: click "Pick a game" first, then "Next: Look it over" and "Create round". Loosen the History regex to `(\.|$)` with `.first()`. With those changes it passes (patch in this worktree).

2. **Day votes are silently cut at the server's 32-character vote limit.** `src/lib/plans.js:133`
   - Cause: encodeDays drops the latest days that don't fit. Nothing caps how many days a person can tick: the DaySheet and FriendAnswer let anyone add days, and saveDays lets the organizer add past MAX_DAY_OPTIONS.
   - Repro: a Stableford plan with 8 days ticked encodes as `stableford~~8f.8g.8m.8n.8t.8u.90` (32 characters), which parses back to 7 days. After the next refresh, applyRemote replaces the local answer, so the 8th day loses that vote and the leading day or lock nudge can change.
   - Fix: cap the ticks at what fits (work out the room the same way, and disable more ticks with a note), and cap days the organizer adds at MAX_DAY_OPTIONS.

3. **Nobody can start trash talk on a plan any more.** `src/screens/Plan.jsx:365`
   - Cause: the only TalkSection for plans sits in a sheet, and its row shows only when talk already exists. Nothing else opens planTalk.
   - Fix: always show the quiet row on a plan that's on, for example "Trash talk" with no count.

## Minor

4. **An undated plan called off more than 3 days after it was made vanishes at once.** `src/lib/plan-basics.js:184`
   - Cause: the 3-day window is measured from createdAt, not from when the plan was called off.
   - Repro: make an open plan, call it off 4 days later. `upcomingPlans` returns nothing, so friends never see "Called off".
   - Also: undated plans that stay on never age off Up next.
   - Fix: stamp `offAt` in callOff and measure from that. Consider letting an undated plan drop off after N days.

5. **The Big Game board is hidden on a watching phone.** `src/screens/Play.jsx:167, 196`
   - Cause: on a watching phone, `noMoney` hides BigBar, and MoneyRace shows the group's own roundResults instead.
   - Repro: a Big Game stroke group with no money of its own, watched from a non-keeper phone, shows every player at $0 with "No money moved" on each hole, until you tap This hole.
   - Fix: when `round.trip?.format === BIG_FORMAT && !ownMoney(round)`, default `watch` to 'hole', or keep BigBar.

6. **Results "Roll to next time" rolls nothing.** `src/screens/RoundDetail.jsx:284`
   - It only opens the Tab (play.md decision 5). Money is untouched, but the label reads as an action already taken.
   - Fix: rename it to "Settle it on the Tab", or open the Tab's Roll sheet for your line.

## Checked, no issue

- Vote encoding: an older app parses `game~~days` as the game with empty sides, with no crash. An older app re-sending an answer drops that person's days, which is rare.
- Every reader of plan.date is null-safe: reminders, push and the tee cron SQL (`null >= today` is skipped), countdown, morning text, roll call, trips, tees-off, challenges, og preview, Lately, Players.
- upcomingPlans puts dated plans first.
- Plans saved before tonight read as `when: set` through normalizePlan.
- Moved features are all reachable as the notes say: Season, Close the books, usuals, Schedule for later, house rules, the Preview link and Edit (dated plans only).
