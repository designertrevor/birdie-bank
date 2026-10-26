# Get a round going (overhaul, plan builder, 2026-10-27 night)

Branch `overhaul/plan`, worktree `.claude/worktrees/oh-plan`. All six picks A from the "Plan a round,
simpler" calls, plus Layout Lab Plan A once a day is set. Screenshots in
`overnight/overhaul-shots/plan/` (new look light and dark, a few in classic), made by
`node scripts/plan-shots.mjs <seed.json>` against the dev server on :5182.

## What's built, pick by pick

1. **Start (one-screen ask)** `src/screens/plan/PlanAsk.jsx`. "Plan ahead" (`nav.push('newRound', { ahead: true })`)
   now opens it: NewRound.jsx is a small wrapper that shows the ask when `ahead` comes alone, and the
   full steps for everything else. An editable message (default "Trying to get a round in soon. Who's in?"),
   three rows that start as Not yet (When: Not sure yet, Where: Any course, Game and bet: Group picks),
   who to ask (the same people list as the trip and invite steps, `tripInvitees`, plus "+ Name"),
   **Send to the group** (the share sheet with the group link, `inviteText` now writes the ask when there's
   no day) and **Or copy the link**. Nothing has to be set. Picks are kept with your place (useKept).
2. **When** `WhenSheet` in `src/screens/plan/PlanParts.jsx`: Set a day / A few options / Not sure yet on one
   row, day tiles for the next eight weekend days plus "Pick a day" (the existing calendar sheet,
   `DateSheet`), up to 6 options, and Either / Morning / Afternoon in place of a tee time.
3. **Plan page** `src/screens/Plan.jsx` (PlanBody rewritten). A ticket at the top with who's in as seat
   tiles, then "Still to decide": Day, Course, Game, Bet, each with its state tag. Tap Day to tick days
   (anyone can add one), Course to set it (organizer), Game or Bet to vote. Ends with **Lock in Sat Oct 25**
   once a day leads. **No chat on the page.**
4. **Friend side**: the September invite card (WhoAreYou) says "No day yet" where the date goes and
   "Golf soon?" when the group picks the game. Then on the page: I'm in / Maybe / Can't, "Which days work?"
   tiles with how many can make each and "Add a day", **Send my answer**, and below it an **outline
   button** "Vote on the game and bet (optional)" (not a text link). After sending: "You're in · Sun Oct 25,
   Sat Oct 31 · Change".
5. **Lock**: `lockNudge` says when a day clearly leads (at least two can make it, more than any other day,
   and more than half of everyone not out, counting who hasn't answered). Then a mint card on the page
   ("Sun Nov 1 works for 4 of 5. Dev hasn't answered...") and "Ready to lock in Sun Nov 1" on Up next.
   The Lock button (pink) shows whenever any day leads; its sheet has the count, who's waiting, the days
   to choose from, an optional tee time, **Lock in Sunday** and **Wait for Dev**. Locking sets the day,
   and opens the share sheet with "Golf's on: Sun Nov 1 at 8:40 AM, Logan River GC. Tap to see who's in".
6. **Entry**: the ask is what `nav.push('newRound', { ahead: true })` opens, so the home builder's
   "Get a round going" card lands on it. I only touched `UpcomingCard` in `UpNextPlans.jsx`: a plan with
   no day gets its own card (butter band, "No day yet" or "Ready to lock in Sun Nov 1", "Golf soon?",
   counts, and Day / Course / Game / Bet tags), dated plans keep today's card. One import line and a
   new `OpenPlanCard` function next to it; nothing else in that file changed.
7. **Dated plan = Layout Lab Plan A**: the ticket with the date and countdown as the eyebrow, the tee time
   big (or Morning, or the weekday), course, holes, game and bet, a perforation, seat tiles
   (In / Maybe / No answer, plus an "Open" tile for the organizer to ask more), In / Maybe / Out, then
   "What we're playing" rows (The game, The bet) that open the vote sheet.

## Data: no SQL needed

Plans are one JSON blob (`planned_rounds.meta`), so the new parts ride there: `when: { mode, days, part }`,
`ask`, `groupPicks: { game, bet }`, and `date: null`. The only per-person new thing is the days someone
can make, and `plan_votes.kind` only allows 'game' and 'bet' (choice up to 32 chars). The days ride in
the **game vote** after a second "~" (`skins~~9k.9l`, `nassau~skins~9k`), days as base 36 from
2026-01-01, as many as fit in 32 characters. Phones from before this destructure only the first two
parts, so they keep the game and side votes and never see the days; the plan lock still applies
(votes follow the answer). No SQL file.

Logic in `src/lib/plan-open.js` (states, day options, leading day, lock nudge, normalizer, codec, texts;
imports only plan-basics so Up next can use it) and `src/lib/plan-ask.js` (the new plan). Tests in
`src/lib/plan-open.test.js` (14). `tally`, `planChoice`, `answerPlan` merging and plan-lock are unchanged;
`planPeople` now also carries `days`.

**Normalizer** `normalizePlan`: plans saved before (a day, a game, a ballot) read as when set, nobody's
picks left to the group, no ask; a junk date reads as no day. Tested with a real older plan.

**A plan with no day, checked across the app:**
- `upcomingPlans` now keeps a plan with no day while it's on (after the dated ones, oldest first; a
  called-off one for 3 days). Older app versions drop it from Up next (no crash) since they filter on
  the date.
- Reminders (`tee-reminders.js`), the countdown, Book your tee time, trips (`trips.js` needs a date),
  tees-off, `rsvpFor`, challenges: all already null-safe; they just skip it.
- Tee time push (`push_tee_due` SQL): `meta->>'date' >= today` is null, so it's skipped.
- Link preview (`og.js planPreview`): no day and no course returns null, so the link shows the default card.
  Not changed (a follow-up: "Trevor wants to get a round in").
- Morning text and roll call need a day; both only show once it's locked.
- Lately "Dave is in for ...", the friends feed line and Players' RSVP tag said nothing for the day;
  now "the next round" / "No day yet".
- Nudges say "golf soon"; the invite text is the ask.
- An older app opening the link: Plan.jsx shows "Date to be set", the suggested game (the ballot's first),
  and its preview link (Preview handles no date with empty labels).

## Decisions I made for Trevor

1. **Course has two states only** (Set or Not yet). Only the organizer sets it, from the Course row. No
   course vote or suggestions (it was a "later" question on the wireframe).
2. **"Group picks" puts four games on the ballot**: the ones you've played most, then Skins, Nassau, Wolf,
   Best ball. Each game's bet vote is three amounts around your usual bet. The organizer casts no vote
   on what they left to the group, and no "Suggested" tag shows.
3. **Game and bet as one row on the ask** (as wireframed), with Group picks / I'll pick, and the bet can
   still be left to the group once the game is set. No side games or play-for on the ask; they stay on
   the full setup's "Schedule for later".
4. **The organizer counts as able to make every day they offered**; they can untick from the Day row. A
   day the organizer adds later goes on offer for everyone; a friend's added day shows as a candidate.
5. **The lock nudge rule**: at least 2, strictly ahead of the next day, more than half of everyone not out.
   The Lock button shows as soon as any day leads; only the card and Up next's "Ready to lock" wait for the
   rule.
6. **Locking texts the group** through the share sheet (no new push kind). An invite push still goes out
   when the plan is first shared.
7. **Trash talk off the plan page.** It's still reachable: a quiet "Trash talk" row at the bottom appears
   only on a plan that already has comments or reactions, and opens them in a sheet. Lately's talk items
   still open the plan. A plan with none shows nothing (Trevor: "everything above the chat bubbles").
8. **Edit** (the header button and "Change the day, time, course or holes") only shows once a day is set;
   before that the Day and Course rows do the job.
9. **Onboarding and trips keep the full steps** (they come with a game already picked, or a trip's
   schedule). Onboarding could open the ask later; it's the one remaining place a day is required.
10. **Preview link**: Match preview and Lineup are moving to Preview.jsx, which the dated ticket already
    links ("Saturday preview ... the lineup"). Not shown before a day is set.
11. **Seat tiles** hide people who said Can't (a line says how many can't); the full list with nudges
    and marking stays below as "Everyone".

## Not done

- Friends suggesting a course or a game not on the ballot.
- The Up next "Plan ahead" tile label (home builder's file).
- The link preview card for a plan with no day (og.js).
- A "Still want to play?" nudge after a week with no day (wireframe's later question).
- E2E run.

## Roadmap lines for area 21 (to add under "Setting up the next round")

- [ ] `S2` Get a round going: one screen to ask the group (a message, When / Where / Game and bet all optional, who to ask, Send or copy the link). Built on `overhaul/plan`.
- [ ] `S2` Plans with no day yet: Set a day, a few options, or not sure yet; morning or afternoon in place of a tee time; friends tick days and add their own. Built on `overhaul/plan`.
- [ ] `S2` The plan page's four details (Day, Course, Game, Bet) each Set, Up for a vote or Not yet; the group picks the game and the bet. Built on `overhaul/plan`.
- [ ] `S2` Lock in the day: a nudge when one day works for most, then the organizer locks it and texts the group. Built on `overhaul/plan`.
- [ ] `S2` The plan as a ticket (Layout Lab Plan A): the day and tee time big, seat tiles, In / Maybe / Out. Built on `overhaul/plan`.
- [ ] `S3` Friends suggest a course or another game on a plan.
- [ ] `S3` A plan with no day after a week nudges the organizer ("Still want to play? 3 said they're in").
