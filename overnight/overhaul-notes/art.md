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

## Left for later (results and plan, owned by the other builders)

- **podium**: results, the winner's card hero (where the crowd or the winner's crowned buddy shows now).
- **handshake**: results when all square, in place of the hand-drawn high five on the results hero.
- **receipt**: results, the full breakdown (By game) section's head or its empty state.
- **bragging / buying / agreed**: the results reward cards (Bragging rights, Who's buying, As agreed),
  one per card at about 72px.
- **nobirdies**: the Birdie pot result when nobody made a net birdie.
- **crown**: results, the winner line when the winner has no buddy (a photo or initials).
- **piggy**: results, the pot line for pot games (Birdie pot, closest to the pin).
- **clock**: the plan page's tee time row (the plan builder's page).

## Checks

`npm test` 2657 pass, `npm run lint` clean (no em dashes), `npm run build` ok.
