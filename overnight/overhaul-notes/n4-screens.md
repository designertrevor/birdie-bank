# Night 4: final screens fixes (n4/screens)

The final audit's findings for home, plan, onboarding and shared (auditor-5, auditor-6's shared ones,
auditor-4's once it landed). One line per finding: what changed, or why not. Before shots are the
audit's own (overnight/audit-shots-4 in the overhaul worktree, commit 1db6c49, the same code this
branch started from), copied to overnight/n4-shots/screens/before/<area>/; after shots in
overnight/n4-shots/screens/after/<area>/ (untracked), shot with scripts/audit-shots.mjs.

## Broken

- plan-1: fixed. A friend's own seat used this phone's "me" (right on a real friend's phone, but every other face on a friend's phone was looked up by the organizer's player ids, which mean nothing there, and the organizer's face only went up once). Now the organizer's phone stamps everyone's face on the plan (`faces`, plus `hostAvatar` refreshed on every change, lib/plan-faces.js), and PlanAvatar picks one face per seat: the organizer's from the plan, your own from your profile (else the one the organizer has for you), everyone else's from the plan. Test: src/lib/plan-faces.test.js. The audit's friend view was also Trevor's phone pretending to be Riley, so scripts/audit-shots.mjs now makes it Riley's phone (her "me" and face) and the seed's friend plan carries the stamped faces.
- setup-1: fixed for every pinned footer. The footer's fade is 40px (was 28, 24 on setup), ends solid at 70% and paints over what scrolls under it (z-index 2), so a row meeting the footer fades out instead of being sliced; every scroll with a pinned footer after it gets 56px of bottom room, so its last row (Round ready's Invite the group, each step's last row) always scrolls fully clear. styles.css and newround/overview.css.

## Should

- Face stacks (history-3, tab-1, play-34, plan-13, classic-4): fixed. The dark theme's "no ring on a buddy" rule out-ranked every stack's ring, so the plates fused. Now every stack (.rc-faces, .tab-faces, .ip-faces, .pv-pair, .ic-stack) sets one ring, 2px in the colour behind it, read by the avatar rules in both themes; the dark teal plate keeps its cream edge inside the ring. The Square band rings its faces in the card colour, so Cody's mint plate has an edge on the mint band. Overlap stays about a quarter (24px faces -6px, 30px -8px); the preview's pairs go from -12px to -10px.
- The blank frame on a lazy screen's first open (known, App.jsx): fixed. Every move between screens (push, pop, replace, reset, tab, the phone's back) is a React transition, so a screen whose code hasn't loaded keeps the current one showing until it's ready, instead of the Suspense fallback blanking the stage. A probe pushing six lazy screens frame by frame saw no fallback frame.
- play-30 (shared): fixed. In a sheet the footer isn't pinned (the whole sheet scrolls), so the footer fade is off there; it only washed out the 18 holes segment, Fix hole's last line and the side bet's How much field.
- setup-24 (shared): fixed. The setup steps' top fade is 24px with a hairline once scrolled, so a control cut under the title reads as cut.
- players-3: fixed. The picked buddy's ring goes through the avatar's own ring variable, so dark's "no ring on a buddy" rule no longer drops it; it's cream (--ink) in dark with the canvas gap.
- home-1: fixed. The Tab tile's cream hairline vanished on mint; it gets an ink hairline at 12%, which edges it in both themes.
- plan-2: fixed. While the Lock in nudge shows, the pinned Invite the group is the outline button, so Lock in is the only pink.
- players-4: done. Edit player shows the player's avatar (72px) with a pencil badge that opens the same picker as yours, Characters and Initials (no Photo: a photo is someone's own). It's saved on their card on this phone; a friend with their own profile avatar shows theirs with a line saying they picked it, and no pencil. Your own card opens your profile picker.
- history-5: fixed. Only a card with no net at all drops its top padding; one round's net without a chart keeps the card's air and its divider over the stats link.
- plan-3: fixed. In dark, Up for a vote (the "leads" chips, Maybe) is a gold outline with gold words, not a butter fill that read olive (look.css tokens, plus --state-vote-edge on every vote chip, People's maybe and setup's change chip too).
- tab-4: fixed. Mark paid is a 36px chip (its 44px hit area was already there) with 12px clear of the amount.
- players-5: fixed. The Players empty state shows the crowd sticker (150px, as ART_USES already listed) instead of four outline icons.
- play-2 (shared): fixed. Once a sheet has scrolled, a 16px fade sits under its title (scroll-driven), so rows slide under it instead of being sliced. The drag handle still scrolls away with the content (left: pinning it would need the sheet's markup changed in every sheet).
- play-9 (shared): fixed. The toast already rises above a pinned footer; it now has a 6px halo of the page around it, so the hint under it never shows at its edge, and fades in and out in .12s so it's see-through for less time. It still lands on whatever is above the footer (the hint here), by design.
- play-27 (shared): fixed in the new look. Every segmented control is the body face at 600, picked or not; the holes toggle comes down to 16px. The fills stay: inside a sheet a card is the sheet's cream, on a page it's white, which is the same token both ways.
- play-28 (shared): fixed. The round menu's group labels are sentence-case section labels in the new look; Add a player's How they play, Handicap for this round and Starts on hole, A player left's Who left and the Banker step's Step 1 of 2 are field labels like Name. (Touches play/RoundSheets.jsx, play/HolePanels.jsx and AddPlayer.jsx: className only.)
- play-29 (shared): fixed. An ask that opens over scoring takes Play's heavy body title, like the round's own sheets.
- play-30 (shared): fixed with setup-1 (no footer fade in sheets).
- play-31 (shared): fixed. The switch knob is 24px with 5px of air all round, so off it never touches the track's edge.
- play-32 (shared): fixed. The name field's placeholder is 18px, 500, mute; what you type stays big.
- play-42 (shared): fixed. Rules list bullets (and First tee's change list) are mute, not pink.
- play-44 (shared): fixed. Steppers' minus and plus are the same weight (card fill, ink edge, ink icon), disabled at .4. This reverses last night's "quiet minus, ink plus" (play-55 then); the audit found the enabled minus read as disabled.
- play-52 (shared): fixed. A section label inside a sheet has 14px above it, since the card above brings its own margin.
- play-55 (shared): fixed. In the new look a sheet's cards keep the hairline (the classic sheet dropped its cards' lift), so Fix hole and Course and tee match Bets.
- trips-36 (shared): fixed. Start a trip's empty template rings are 1.5px mute.
- trips-39 (shared): fixed for every link button: an icon in a link sits out of the underline.
- trips-34 (handed over from the trips fixer): fixed. The Up next card for the round the countdown strip counts down to names the day and leaves the count to the strip ("Saturday · 8:40 AM"); countdownLine takes { counted }, tested in preview.test.js.
- history-14, setup-27 (shared, mid-transition double exposure): fixed. The screen underneath a push fades out over 150ms while the new one comes in, so the two never read through each other.
- history-7: the fade was there but 32px; it's 56px now, so a tile cut mid-name reads as fading off.
- plan-5: fixed. Days in "Can make" and your own days never break inside a date (non-breaking spaces).

## Polish (auditor-5)

- home-3: fixed. The first round card's tee sticker is 96px, 20px in from the right and 18px down, its grass clear of the card edge.
- home-4: fixed. Step 2 Start a round is tappable with a chevron like its neighbours (it opens setup, as the big button does), with its own line instead of "the button above". (onboarding-12 the same.)
- home-5: fixed. "See all 9" under Lately is the same centred pill as the card stack's "2 more", both 36px with a 44px hit area (also on Friends, Roadmap and What's new, which share the class).
- home-6: fixed. The round in progress card's eyebrow is the tracked caps eyebrow with its live dot.
- home-7: fixed. A trip card with its close X drops the chevron under it (CSS in upnext.css, so Trips.jsx is untouched).
- home-8: fixed. The reminder line's date never breaks ("from Aug 29" stays whole); body text already has text-wrap: pretty.
- home-9: fixed. Rounds in progress names each round in the card title face. The hint's orphan is the app-wide pretty wrap's call.
- home-10, more-2 (shared): fixed. The light scrim is a warm ink at 40% (was a blue-green that turned the cream sage); a secondary button in a sheet sits on the sheet's white with the hairline, like on a page.
- home-11: fixed. The recap eyebrow wraps to a second line instead of cutting the course off.
- home-12: fixed. The start card's line is balanced.
- plan-12: fixed. The ask's hint is balanced.

## auditor-4

- art-1 (broken, onboarding's slot): fixed. The welcome, settle and math scenes were cropped to a rounded rectangle (overflow hidden + radius), so the ground ran to the box edges as a mint plate. Now each scene draws whole in a viewBox with room for three times its sticker border on every side, overflow visible, centred: the white border shows all round. The ground's own shape (a slab) is the art fixer's.
- onboarding-2: fixed with players-3 (the same .av-pick ring).
- onboarding-3 (shared): fixed in the new look. --check is the eyebrow teal (both themes), not kelly green: the paywall's lists, What's new's Shipped, every check that used it.
- onboarding-4: fixed. All set's eyebrow and title are centred under the crowd, which is 168px.
- onboarding-5: fixed. All set's rows are a plain summary with no ticks, so "Mostly don't" isn't a thumbs-up.
- onboarding-6: fixed. The age answers are an even pair at 56px filling the row.
- onboarding-8: fixed. The IOU payoff's two numbers sit on one line however their captions wrap.
- onboarding-9: fixed. The struck "You" is body colour at 15px and fades to .75, not .5.
- onboarding-10: fixed. The join invite leads with the game's sticker (GameArt, 40px) instead of the welcome's glyph.
- onboarding-14: fixed. "($4.17 a month)" stays whole; the timeline lines are balanced, so "Two taps." isn't alone.
- onboarding-15 (shared): fixed in the new look. Onboarding's answers and the paywall's plans pick in ink (ring and check), like the sheets' lists, so a question screen's only pink is Continue. This changes last night's "onboarding keeps the pink pick"; Trevor marked ink selection as right in his review.
- more-1: fixed. Privacy's unpicked rows are the plain card with a hollow ring; sheets' and onboarding's unpicked radios are the same hollow ring (more-19 too, the radio half; the Home course search magnifier isn't done).
- more-3 (shared): fixed. The paywall's Save 40% uses the vote chip tokens: butter in light, a gold outline in dark. The plan link's chips were fixed with plan-3.
- more-4: fixed. "Your next round is set up" only right after onboarding; from Settings, Season or a record it says "Everything in Pro, starting now."
- more-5: fixed. A public roadmap title cut at a word ends in an ellipsis (still 60 characters at most, the test's cap).
- more-6: fixed. Every tee swatch has an ink ring at 25% (black reads on a dark card), and Silver is a swatch.
- more-12, plan-11 (add rows): the plus is ink in a quiet circle in the new look, not a gold disc. The dashed tile stays. Course name vs City sizes: kept (the name field is the big name input everywhere, Edit player too).

## Polish (auditor-5, the rest)

- plan-4: fixed. The When sheet shows seven weekend days, so Pick a day completes the second row of four.
- plan-7: fixed. The plan page's footer already has a hairline edge, so it has no fade over In / Maybe / Out.
- plan-9: fixed. Roll call's people are one hairline card of rows, each with its 32px face; the summary keeps its hairline in dark, no gold top edge.
- plan-10: fixed. Which days work? is a body-face heading (17px, 700), not a second display title.
- plan-11: fixed. The day strip fades at both edges with 16px scroll padding; the add row's plus is ink (with more-12).
- tab-5: fixed. The tools card has a More label, 20px icons, and Start a trip is a row like Season and Close the books (bold title, line, chevron). Alone on an empty Tab it stays the quiet link.
- tab-6: changed, not removed. Every payment keeps its Undo (older ones have no other place to undo), but only the last day's is the round button; older ones are a quiet icon with no circle.
- tab-7: fixed. In dark, losing bars are the -$ coral at 80%, not a brick at 60%.
- tab-8: fixed. With nothing owed, the trip link sits 24px under Start a round.
- tab-10: fixed. Close the books has 24px of air under its header.
- history-8: fixed. "Every round you've played" is a muted 14px caption, left on the page edge, 16px under the switch.
- history-9: fixed. A course's town moves to the second line with its count, so neither is cut.
- history-10: fixed (layout half). The record tiles share rows across the grid (subgrid: eyebrow, who, number, note line up), every drawing sits in one 40px box, and the eyebrows are Win streak and Most skins. The badge drawings themselves are the art fixer's.
- history-15: fixed. Lately leads each row about a person with their face (a plan's answers with the face the plan carries), a finished round with its game sticker; the rest keep their icon. Titles already wrap pretty.
- history-16: fixed. The rival tile says "10 rounds" (the record before it says together).
- history-17: partly. The year in review image drops the pink corner and gold dot behind the face, and an odd last tile runs full width (no half row). Its type is the share images' shared face (shareImage.js, Bricolage Grotesque, the results image too); moving every share image to the serif is a call for Trevor, left.
- players-6: fixed. Played with most shows four faces (56px) with 16px between, not five edge to edge.
- players-7: fixed. The merge sheet's people are one hairline card of rows.
- players-8: fixed. Names on Friends are in the Players name face.
- players-9, players-10: fixed (with players-3): the shelf with your pick shows a small ink check, not a pink dot; Save on every tab ("Use this photo" once a photo is picked).
- classic-1: the date half is fixed (home-8); the title wrap beside the chip is the classic look's longer font, left.
- classic-2: fixed. The nemesis line is balanced.
- classic-3: kept. Last night's call was to wrap a moment rather than cut it; the hole stays at the row's end.

## auditor-4, the rest

- onboarding-1, onboarding-11: fixed. All set's crowd leads with your face at every size, the same face the card under it shows: your pick, else the buddy your name gives. Finishing without a pick keeps that buddy as your avatar, so Up next and every list wear the same face from the first screen (before, All set keyed it by name and the app by a fresh id, so they differed). A pick from before, when starting over, stays.
- onboarding-7: fixed. Each step's scroll runs up under the bar (its canvas covers it, its fade is 20px), so a scrolled title fades out instead of being cut at the bar's edge.
- onboarding-12: fixed with home-4 (step 2 is tappable); the hero art with home-3.
- onboarding-13: kept. The Set / Up for a vote / Not yet tags on the ask's rows are the plan design's state tags (BRIEF's --state-* tokens), not values; they stay.
- more-7: fixed. Settings' "Add your home course" and "Pick an avatar" chips open the profile with that sheet already up.
- more-8: fixed. Something went wrong is one centred column (340px) with the lone ball over it, like the gone states (ART_USES has the use).
- more-9 (shared): fixed with play-30 and play-2 (no footer fade in sheets, a fade under the title once scrolled).
- more-10: the period is added. The off switch keeps its edge: it's the fix from the sun-readability pass (its fill alone was 1.25:1 on a card), so it isn't made a borderless warm track.
- more-11: kept. Nassau's presses have the Presses section label above their card; the Banker amounts are a different control (chips), left for a pass on Game defaults.
- more-13: fixed (stickers). About's game rules rows lead with each game's 36px sticker. The tee ball's few points off centre is the drawing's own box (art fixer).
- more-14: fixed. Recently deleted, empty, sits centred with a Back to Settings button.
- more-15: fixed. The picks screen is titled Notifications; "Which ones you get" is its section label.
- more-16: fixed in part. The tile says FAVORITE (one line, level with its neighbours) and the stats row's line is one short sentence. The handicap tile and Clear heights: not reproduced here, left.
- more-17: left. The player card image shares the share images' type and shapes (shareImage.js); see history-17.
- more-18: fixed. With Only you, Show my money stays on the page, switched off, saying "Hidden while your profile is Only you."
- more-19: radios fixed with more-1; the Home course search magnifier isn't added (HomeCourseSheet is a shared course search, left as is).
- more-20: fixed. The old shipped item reads "The first 16 games, ..." (it was 16 when it shipped), and roadmap titles get curly quotes and apostrophes.
- more-21: fixed. No votes yet says Vote, not 0; apostrophes are curly.
- more-22: left. The public roadmap's header and art are the public link pages' own layout (LinkBrand); not changed tonight.
- more-23: fixed. Note boxes have no resize grip; Send looks off until there's text, and a tap still shows what's missing.
- more-24: fixed. Not on the list is the same tile with a dashed hairline; the day list never breaks inside a date (plan-5); the stranger's tiles wear the faces the plan carries (plan-1).
- more-25: fixed. "Just keep my own score · Not now" are one centred row, one weight, a middle dot between.
- more-26: left. Each gone state's copy fits what went missing (a round on History vs the round you were scoring); one GoneState per kind is a bigger change than tonight's.
- more-27: fixed. The status page's cream is the app's (#f9f5ec, theme-color too) and Check again has room past the home bar. The wordmark lockup is left.
- more-28 (shared): kept. A toast over a list row covers whatever is there; it now has the page halo (play-9) so it reads as on top.
- more-29: kept. No See Pro button while nothing is gated (Trevor: no gating until launch, memory birdie-bank-no-gating-until-launch).
- onboarding-3, more-2, more-3: see above (teal checks, sheet secondary buttons and scrim, gold outline tags).
