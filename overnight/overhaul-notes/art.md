# Art placements (overhaul, 2026-10-26 night)

Branch `overhaul/art`, worktree `.claude/worktrees/oh-art`. Screenshots at 390 by 844, light and dark,
in `overnight/overhaul-shots/art/` (untracked). Every placement is in `ART_USES`
(`src/lib/art-manifest.js`), so the art sheet (`/?art`) says where each drawing shows.

Every drawing was checked on its own at 150px and 56px in both themes (a contact sheet of all 46
spots), then on its screen at its real size.

## What went where

New pieces: `src/components/ArtNote.jsx` (an empty view inside a busy screen: the drawing centred
on top with room around it, one sentence under it, on the surface colour) and `src/art-places.css`
(the art's own rules, imported by the screens that use them).

| Drawing | Screen | Size |
|---|---|---|
| tees | Trip, Rounds view with no rounds yet | 96 |
| standings | Trip, Standings (and points) before a round is finished | 96 |
| expenses | Trip, Expenses with nothing logged | 96 |
| pennant | Trip, Cup view with no matches yet | 96 |
| clock | Trip, the schedule card before its rounds are planned (organizer, "each group gets its day, a tee time") | 72 |
| clipboard | Draft, Start the draft (Empty), and the draft's head once it's done | 150 / 76 |
| coinflip | Draft, the head before the first pick ("Team Birdie first") | 76 |
| whistle | Draft, the head while the captains pick | 76 |
| hotstreak, skinsking, lowround, punchcard | Hall of fame, the four record badges, in place of the round icons; a record nobody holds dims its drawing | 48 |
| ribbons | Hall of fame with no rounds yet (was the cup) | 150 |
| punchcard | Season, "Your season starts here" before the rounds it needs (was the cup) | 150 |
| coinstack | The Tab, Nothing owed yet (was the empty wallet) | 150 |
| frame | Your avatar, the Photo tab before there's a photo (was your initials) | 112 |
| tumbleweed | Friends, Quiet out there (was sleep) | 150 |
| bell | Lately, Quiet lately (was sleep) | 150 |
| loneball | The Empty default: a crew, round, challenge or Big Game that's gone, Print, Share, Recently deleted (was the hand-drawn ball on a tee with its gradient and grin) | 150 |
| cards | Set up, the Add a side game sheet, on top | 88 |
| pin | Course picker, No courses near you (was a hint card with a map pin icon) | 84 |
| flagempty | Course picker, Can't find it? card | 84 |

Today's scenes: the onboarding scenes (course, clubhouse, scorecard) already show again with no code
change, since `Scene` draws a pulled scene as soon as its file lands. Only the notes in `ART_USES`
and `src/art/README.md` said "pulled"; they're updated. Checked on the welcome in both themes.

## Calls I made for Trevor

1. **The Tab: coin stack, not the piggy.** The pig is a big pink shape and pink is for the one thing
   to tap; the coins are ochre and calm. The old empty wallet (a hand shaking out a wallet with a
   moth) was a joke, and the brief keeps jokes off the Tab. All square keeps the high five drawn from
   the group's own buddies.
2. **Most rounds is the punch card, not `mostrounds`.** The `mostrounds` drawing is a ball in a
   dotted band, and it doesn't say "most rounds" at 48px or 150px. The punch card does. It's left
   unplaced; a re-roll could be a ball with a tally on it.
3. **Loneball as the Empty default.** Every "this is gone / not found" screen used the old hand ball,
   which breaks the brief (gradient, grin). The About page (`<Empty illo>`) keeps the old ball on
   purpose, since it stands for the app there.
4. **Whistle and pin aren't on the Trip page.** The trip's captain rows (the teams picker) and course
   rows (the schedule's course fields) are dense form rows with no room for a drawing, so the whistle
   went to the draft's head (the captain's call) and the pin to the course picker's "nothing near you".
5. **The draft's head carries one drawing per moment** (coin toss, whistle, clipboard) rather than
   a drawing beside the captains or the pool, which are dense.
6. **Hall of fame hero keeps the cup** when there's no champion; it's still the best "trophy" read.

## Found and fixed on the way

History's new round cards (`overhaul/tab`, `src/screens/history.css`) use `.rc-card` and `.rc-art`,
the same class names as the course picker's Can't find it? card, so once History's CSS had loaded the
request card turned into History's 3-column grid (title squeezed into 48px, buttons off the edge). The
request card is now `.rc-ask` (RequestCourse.jsx and its three rules in styles.css); History's classes
are untouched.

## Drawings that don't work (say the word and they get re-rolled)

- **mostrounds**: doesn't say what it is at any size (see 2).
- **Balls cut out to the sky in dark** (agreed, bragging, buying, megaphone, gift, bulb): the ball's
  body is transparent, so in the dark theme the dimples get the cream outline and read as little
  squares on a see-through ball. Not placed by me except where they already were (gift on What's new,
  megaphone in the round menu, bulb on Suggest and Settings). The export should keep the ball's cream
  fill.
- **loneball in light**: the cream ball and its cream ground strip sit on the cream page, so it reads
  as an outlined circle in a tuft of grass. Fine, but quieter than in dark.
- **tees**: a stray speck above the right tee (an export leftover), visible at 96px in both themes.
- **podium**: two stray fragments to the right of the trophy (export leftovers).
- **punchcard** in light: the unpunched holes are cream on a white card and nearly vanish at 48px.
- **ribbons**: mush under 60px; only used at 150.
- **whistle**: the lanyard loops read as two balloons; it works on the draft head but isn't great.
- **pin** wasn't seen in place: the "no courses near you" state needs the course database and a
  location, which the dev server here doesn't have. Checked at 150 and 56 on the contact sheet.

## Second pass: results and the plan (after merging overhaul/next)

| Drawing | Screen | Size |
|---|---|---|
| handshake | Results, the all square hero (was the hand-drawn high five), the reveal's head when it's all square, and a reward round's card when nobody won | 120 / 88 / 64 |
| podium | Results and the reveal while a Big Game waits on its other groups: the trophy still up for grabs (was a crown icon) | 88 |
| crown | The reveal's head when there's no face to crown (more than four level on top) | 88 |
| receipt | Settle up, over "3 payments square everyone up" | 76 |
| buying | A reward round's card, who's buying (was a gift icon), on a cream plate | 64 |
| bragging | A points round's Bragging rights (was a hint card), on a cream plate | 96 |
| nobirdies | Details, the Birdie pot when nobody made a net birdie (was a hint card) | 96 |
| clock | The plan's Lock in the day sheet, where the tee time is set | 64 |

The podium block stays the winner's focal point: nothing was added inside it, and a winner with a
face still gets their crowned buddy. **The plate**: bragging and buying have their ball cut out to the
sky, so they sit on a cream disc (`.art-plate`) with the dark outline off (`Spot outline={false}`,
new); the ball reads white in both themes. Checked in light and dark.

Not placed: **agreed** (its home is Round ready's What we agreed, the setup builder's screen; it needs
the plate too), **piggy** (no results spot where a pink pig fits calmly; the pot breakdowns are dense
tables), **mostrounds** (doesn't read). The six see-through drawings already placed before tonight
(megaphone in the round menu, gift on What's new and Up next, bulb on Suggest, Settings and Roadmap)
still show the dimple squares in dark; `outline={false}` plus `className="art-plate"` fixes each one.

Not seen in place: the reveal's handshake, podium and crown (the reveal only opens straight after a
round, and the screenshot set-up can't reopen it), and the podium on a waiting Big Game. Same files and
sizes as the ones checked on the round page.

Found on the way, not fixed (not an art change): on a reward round's ochre card in the dark theme, the
"Jackson wins lunch" and "Dev's buying" text is pale on ochre and hard to read (see
`overhaul-shots/art/results-reward-dark.png`).

## Checks

`npm test` 2682 pass (after the merge), `npm run lint` clean (no em dashes), `npm run build` ok.
