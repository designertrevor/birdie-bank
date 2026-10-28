# Fix pass 2: Get a round going and the plan pages (2026-10-28 night)

Branch `fix2/plan`, worktree `.claude/worktrees/fx-plan`. Before and after shots of every plan screen
and state in `overnight/fix2-shots/plan/` (untracked), made by `scripts/plan-shots.mjs`, which now
shoots 34 states on a fixed clock, including the friend's view from a link with no app set up:

```sh
npx vite --port 5202 --strictPort --host 127.0.0.1
BASE=http://127.0.0.1:5202/ OUT=overnight/fix2-shots/plan/ SUFFIX=-after node scripts/plan-shots.mjs
```

## Trevor's notes

1. **The ask.** One title, in the header: "Get a round going" (the name of the card that opens it),
   with the small close X beside it; it tucks to the small size with a hairline on scroll like the
   tabs. The second heading ("Who's up for golf?") is gone, so there's no double question. The
   message is a quiet text field on white with a hairline, labelled "Your message", with a foot line
   "Goes to the group with the link to answer". No yellow, no card look. Sections are now labelled
   Your message / The details / Who to ask, and the hint under the details says "Each one can
   wait. Leave it open and the group sorts it out" (it said "Not yet", which no tag on the screen says).
2. **Plan ticket:** no butter fill. It's the card colour, white in light and the lighter card
   surface in dark, the same as the dated ticket.
3. **Seats fill the row.** Seat tiles are a grid whose columns are worked out so the rows come out
   even, five across at most, and the Open tile counts as a seat: 4 tiles fill one row, 6 are 3 and 3,
   7 are 4 and 3. Open never sits alone under a full row. The grid reaches a little into the
   ticket's padding so "No answer" stays on one line at five across.

## Found in the review and fixed

- **A message typed on the ask was dropped when a day was set**: a plan with a day sends the dated
  invite, which ignored the ask. Now a message you wrote leads the dated invite too ("Who wants Rancho
  this weekend?" then "Golf Saturday at 8:10 AM? ..."); the default message doesn't, since the day
  line already asks. Tested in `plans.test.js`. Plans made from the full setup have no message, so
  their text is unchanged.
- **Disabled pink buttons looked tappable** (app-wide): `.full-btn.pink` came after
  `.full-btn:disabled` in styles.css and won, so "Send my answer" before you pick In / Maybe / Can't,
  and Send while the link loads, looked live. One rule in styles.css now greys them like every other
  disabled button. Every disabled pink button in the app gets this.
- **The lock nudge asked without an answer**: the mint "Sun Nov 1 works for 4 of 6. Lock it in?"
  card now carries a "Lock in Sun Nov 1" button (white pill) that opens the same sheet as the pink
  button below.
- **Called off read like a live plan**: the ticket's eyebrow now says "Called off · Sat Oct 31" in red
  and the time is muted and struck through (deleted plans too).
- **Game and Bet rows had the same coin-stack icon** (Skins' icon and the bet's). The bet row is a
  dollar sign now, and a game the group picks shows the cards icon, not the first ballot game's.
- **"Change the day, time, course or holes"** sat left while "Call it off" under it was centred: both
  centred now.
- **"No reminder" touched its chip's edges** on the booking reminder strip: it has side padding now
  (plan page only).

## Calls I made for Trevor

- The ask's title is "Get a round going", a statement, matching the Up next card that opens it,
  rather than keeping "Who's up for golf?" as the one title.
- The message is a text field, not a group-text bubble preview: a preview of the whole text would
  repeat the details and link lines right above the rows that set them.
- The nudge keeps the pinned pink "Lock in" button too, so the card's button is white, not a second
  pink one.
- 6 seats go 3 and 3 (wide tiles) rather than 5 and 1; 2 or 3 seats spread across the width.

## Looked at and left

- **Pink eyebrows** ("SAT OCT 31 · 5 DAYS TO GO", "WHEN WORKS?") on the ticket and the Up next cards
  are text, not taps, so they stretch "pink only on the one thing to tap". They're the same on every
  Up next card (the home fixer's area), so I kept them consistent rather than changing the ticket
  alone. Worth a call in the audit.
- **Sheet close X is pink** (the shared Sheet in ui.jsx, every sheet in the app), and Where's picked
  row is a pink fill (shared PickRow). Same pink question, app-wide, not the plan's to change.
- **The bottom of the plan page** stacks two buttons and "Done for now" (Lock in / Invite the group,
  or Invite / Roll call). Each is used; kept.
- **The friend's invite card** ("Golf soon?" with the pin) before they pick who they are looks unlike
  the ticket after. Trevor kept the friend's view as built.
- **The "Everyone" list** repeats the seats on the ticket, but it's where days, votes, nudges and
  marking someone's answer live. Kept.
- Up next's plan cards (UpcomingCard, OpenPlanCard) read fine after 3974f17; no change. The Lock in
  row stays.
- Loading and failure for a link ("Finding the plan…", Plan not found, No signal, Try again) and a
  deleted plan ("This plan is gone") were already there.
