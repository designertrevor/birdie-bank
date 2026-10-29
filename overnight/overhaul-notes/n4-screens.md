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
