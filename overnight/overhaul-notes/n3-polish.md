# Night 3: polish fixer (branch n3/polish), 2026-10-29

Every audit finding owned by home, plan, onb or shared that wasn't broken (153: 60 should, 93 polish),
from `overnight/audit/auditor-1.json`, `-2` and `-3`. Each one was checked against the code and the
fix2 notes first; many were fixed last night. Round screens, Trip.jsx, Trips.jsx, src/art and the art
components were left alone (other fixers tonight); findings that need them are listed as left.

Shots (untracked): `overnight/n3-shots/polish/before/<area>/` from an untouched copy of the branch's
starting commit (4a420cb), `overnight/n3-shots/polish/after/<area>/` from this branch, same names, both
themes, made with `scripts/audit-shots.mjs` (390 by 844, the review seed on its fixed clock).

`scripts/audit-list.mjs`: the Big Game shots looked for a pink Start the groups (it's ink since fix2),
so the board, skins and money shots never ran last night; they run now (before and after shot with the
fixed script). The paid-part shot follows the new straight-to-the-amount flow.

Checks: npm test (2688 pass), npm run lint, npm run build pass. Money logic untouched (display only).

## Calls I made for Trevor

1. **Switches on are teal** (the eyebrow teal, `--eyebrow-ink`) in the new look, app-wide, with the
   knob in the card colour. Classic keeps pink. Settings has many switches and pink is for the one tap.
2. **One of a list in a sheet is ink** (an ink ring and an ink check, no tint): the Where sheet, the
   banker pick, Settings' who-can-see-your-profile. Picking people (setup, crews) and onboarding's
   answers keep the pink pick, since there the pick is the moment.
3. **On the day of a round you organized**, its card's Start this round is the pink and Playing now?'s
   Start a round turns outline. Both stay.
4. **Paid part of it?** opens straight on the amount pad ("What you paid Ben (of $13)"), not on the
   Settle up sheet with Pay on Venmo first. The Settle up sheet (from a payment row) still has
   "I paid part of it" at its foot.
5. **The plan page's Booked is "I booked it"**, a hairline button (it opens the tee time sheet).
6. **All set gets a drawing**: your group at the size you said, your buddy first (the size question's
   crowd, 136px). The review card now sits under it; the line under the card scrolls into view.
7. **The year in review** leads its tiles with your favorite game instead of a Rounds tile that
   repeated the headline. Its palette is unchanged (see history-9).
8. **A crew's tab** leads with the same summary card as Everyone: what the tab is, your money on it
   big, and "You're up on this tab" under it ("Even" with "The others still owe each other" when
   you're square but they aren't).
9. **Done steps keep their check** in a scrolling step bar too (Big Game setup), which also adds the
   check to round setup's bar when it scrolls (Steps in ui.jsx).
10. **Every pinned footer fades** the scroll above it (it was opt-in), and steps out under any sheet.

## For the other fixers (needs their files)

- Trip.jsx: trips-8 (hero art crop), trips-9 and trips-14 (Trevor's call on the lead number),
  trips-28 to 32, trips-37 (image sized to its rows; the switch wording is fixed in Share.jsx).
- Trips.jsx: trips-23 and trips-26 (Start a trip sheet's scroll padding under its footer), trips-34
  (the trip card's expense pill), tab-8 (the trip card's meta: "· settle after the last round"
  starts a line; join its parts with a non-breaking space before each dot).
- Podium.jsx: history-7 (one warm podium palette in dark).
- Round screens: play-41, play-77 (one label style across Bets / Handicaps, reveal, results).
- Art: history-10 wants the game's art tile on Lately's game rows (needs ART_USES lines).
- Share images (shareImage.js family): history-9 and trips-37's restyle, cream and Fraunces, is one
  job for all four cards (results, rivalry, profile, year in review) so they stay a family.

## Every finding

### Should (60)

- onboarding-2 (shared): fixed earlier (fix2): dark picks are a neutral lift
- onboarding-3 (onb): fixed earlier (fix2)
- onboarding-4 (onb): fixed earlier (fix2): the ask and paywall load on the name step
- more-2 (onb): fixed earlier (fix2)
- more-3 (home): fixed earlier (fix2): Player not found
- more-4 (shared): fixed earlier (fix2): one Gone layout
- more-5 (shared): fixed earlier (fix2) (a fade above the share buttons); tonight every pinned footer has that fade
- home-1 (home): fixed earlier (fix2)
- home-2 (home): fixed earlier (fix2)
- home-3 (home): fixed earlier (fix2)
- home-4 (home): fixed earlier (fix2)
- home-5 (home): fixed earlier (fix2)
- home-6 (home): fixed earlier (fix2)
- home-7 (home): fixed earlier (fix2)
- home-8 (home): fixed earlier (fix2)
- home-9 (home): fixed earlier (fix2)
- home-10 (home): fixed earlier (fix2)
- home-11 (plan): fixed tonight: the plan fixer had added Start this round; now the strip says Today (or Tomorrow), Start this round is the pink, and Playing now?'s Start a round goes quiet (outline) on the day of a round you organized
- home-12 (home): fixed earlier (fix2)
- tab-2 (home): fixed earlier (fix2)
- tab-3 (shared): fixed earlier (fix2)
- tab-4 (home): fixed earlier (fix2)
- tab-5 (home): fixed earlier (fix2)
- plan-3 (plan): fixed earlier (fix2)
- plan-4 (plan): fixed earlier (fix2)
- plan-5 (plan): fixed earlier (fix2)
- plan-6 (plan): fixed earlier (fix2)
- plan-7 (plan): fixed earlier (fix2)
- plan-8 (plan): fixed earlier (fix2)
- plan-9 (plan): fixed earlier (fix2)
- plan-10 (plan): fixed earlier (fix2)
- plan-11 (shared): fixed tonight: the plan sheets' labels (Morning or afternoon?, Tee time) are sentence case like the page behind
- plan-12 (shared): fixed tonight: one of a list in a sheet (Where, the banker) and Settings' privacy choice is an ink ring and ink check, no tint; the Where rows line up with the search field
- history-1 (home): fixed earlier (fix2)
- history-3 (shared): fixed earlier (fix2)
- history-5 (home): fixed earlier (fix2)
- history-6 (home): fixed earlier (fix2)
- history-7 (home): part earlier (the cup leads, crown only on the podium); the podium palette is Podium.jsx, a round component another fixer owns tonight: left for them
- history-8 (home): fixed earlier (fix2)
- history-9 (home): part tonight: the tiles lead with the favorite game, not the round count again. Not restyled: the year in review, results, rivalry and profile images share one palette and type (shareImage.js); changing one splits the family, so a family restyle is its own design job
- shared-1 (shared): fixed earlier (fix2)
- home-13 (shared): fixed earlier (fix2)
- play-10 (shared): fixed earlier (fix2)
- play-11 (shared): fixed earlier (fix2)
- play-12 (shared): fixed earlier (fix2)
- trips-1 (shared): fixed earlier (fix2)
- trips-2 (home): no change: Mark paid already has a 44px target (fix2 note)
- trips-3 (home): fixed earlier (fix2)
- trips-4 (home): fixed tonight: one line ("No skins yet. Holes fill in here as every group plays them.") until a hole is decided, then only decided holes, with a count of the ones still out
- trips-5 (home): fixed earlier (fix2)
- trips-6 (home): fixed earlier (fix2)
- trips-7 (home): fixed tonight: dark red team tint leans rose (#4d1f2a), shared Cup token in styles.css
- trips-8 (home): left: the trip hero is Trip.jsx, which the round fixer is changing tonight
- trips-9 (home): left: which number a trip leads with is Trevor's call, and it is Trip.jsx
- trips-10 (home): fixed earlier (fix2)
- trips-11 (home): fixed earlier (fix2)
- trips-12 (home): fixed earlier (fix2)
- trips-13 (home): fixed tonight: a captain has no empty pick-number slot, so the name starts at the chip edge and fits
- trips-14 (home): left: Trevor's call (the Cup score as the hero), and it is Trip.jsx
- trips-15 (home): fixed earlier (fix2)

### Polish (93)

- onboarding-5 (onb): fixed earlier (fix2)
- onboarding-6 (onb): fixed earlier (fix2)
- onboarding-7 (onb): fixed tonight: your buddy's file starts loading when you pick it; the rows come in right behind the card (shorter stagger)
- onboarding-8 (onb): fixed tonight for All set: your group at the size you said, your buddy first (136px, spots/crowd use added to ART_USES). Name step left as is: the buddy picker on that step already shows the one you pick
- onboarding-9 (onb): fixed earlier (fix2)
- onboarding-10 (onb): fixed tonight: the pad has the sheets' round X, and nothing typed is a faint dash (it read as a minus)
- onboarding-11 (onb): fixed earlier (fix2)
- onboarding-12 (onb): fixed earlier (fix2)
- onboarding-13 (home): fixed earlier (fix2) (same as home-14)
- onboarding-14 (onb): fixed earlier (fix2) (with more-2)
- more-6 (plan): fixed tonight: before answering, the card has the ticket's title (No day yet) and eyebrow (Sat Nov 7 leads so far), no ball icon
- more-7 (plan): fixed tonight: tiles with no reply say No answer, so every tile is three lines
- more-8 (onb): eyebrows earlier; tonight the entries are one card of rows with a hairline, no notched corners
- more-9 (onb): link earlier; tonight switches on are teal in the new look (app-wide), the privacy choice is ink, the Help callout is a white card with the bulb centred above. Erase all data stays red: it is the danger action
- more-10 (onb): fixed tonight: Fraunces title and Figtree body, Birdie Bank mark in ink, a working row drops its "Working" line (the dot says it), the button is the soft rectangle
- history-10 (home): part tonight: titles wrap pretty. Game art on Lately rows left: it needs new ART_USES lines while the art fixer edits art-manifest.js tonight
- home-14 (home): fixed earlier (fix2)
- home-15 (home): fixed earlier (fix2)
- home-16 (home): fixed earlier (fix2)
- home-17 (home): fixed tonight: the install steps keep the icon tile, no number circle (the list is still an ol)
- home-18 (home): fixed earlier (fix2) (ink binoculars); You're in stays beside the title, it fits at 390 with the seed
- home-19 (home): fixed earlier (fix2)
- home-20 (home): fixed earlier (fix2)
- home-21 (home): fixed tonight: Turn off callouts sits under the bubbles on their left edge (CSS only, Recap.jsx untouched)
- home-22 (home): fixed earlier (fix2) (equal rows)
- home-23 (home): fixed tonight: row titles use the list title style (16px, 600), white on the picked row
- tab-6 (home): fixed earlier (fix2) (the bell moved to the person screen)
- tab-7 (home): icons earlier; tonight How the Tab works tucks under its list and the next section's own air is the gap
- tab-8 (home): part tonight: +3 after the five faces (summary and square line). Left: the "· settle after the last round" orphan is the trip card in Trips.jsx (round fixer's file); cents stay as money() writes them app-wide (whole dollars drop .00 everywhere), so the Tab alone would read differently
- tab-9 (home): fixed tonight: Where it comes from and Paid part of it? share one style and baseline; the rivalry line says "You lead" under the 3-0 instead of repeating the score
- tab-10 (home): fixed tonight: Paid part of it? opens straight on the amount, titled "What you paid Ben (of $13)" or "What Sam paid you (of $22)", capped, with the pad's X; closing it closes the lot
- tab-11 (shared): fixed earlier (fix2)
- tab-12 (home): fixed tonight: losses are a solid muted red, the two links are one card of rows; names were already right-aligned
- tab-13 (home): fixed tonight: the intro sits on the 20px label edge; "rolled stays owed into the next season" is said once under the label, not on every line
- tab-14 (home): fixed tonight: a crew tab leads with the same summary card as Everyone; New crew is one card of rows. The scope chips wrap inside the 16px gutter (checked at 390)
- plan-13 (plan): hints earlier; value chips kept: Trevor kept the Set / Up for a vote / Not yet tags
- plan-14 (plan): add tile earlier. The lavender "ring" on today is the keyboard focus ring the calendar puts on today when it opens; it shows in the scripted shots (no real tap) and is kept for keyboard users; today itself is the dot
- plan-15 (plan): fixed tonight: the notches are half-circles with the hairline round their curve (clip-path on the canvas circles)
- plan-16 (plan): kept: Trevor kept the friend's view and the In / Maybe / Out labels (fix2 note)
- plan-17 (plan): trash talk earlier; tonight Challenges is a white hairline row with a neutral icon
- plan-18 (plan): fixed earlier (fix2)
- plan-19 (plan): fixed tonight: in the sheet the talk sits on the sheet (no inner card) and the quick jabs run to the sheet edges
- plan-20 (plan): fixed earlier (fix2)
- plan-21 (plan): parts earlier; tonight the reminder days fade at the card edge and Booked is an "I booked it" hairline button (it opens the tee time sheet, it isn't a status)
- plan-22 (plan): fixed earlier (fix2)
- history-11 (home): fixed earlier (fix2)
- history-12 (shared): months earlier; tonight Head to head is the same 15px section label as Up next, its line under it smaller
- history-13 (home): fixed earlier (fix2)
- history-16 (home): fixed tonight: label then number; the word (Winning, Up) leads the line under the number
- history-17 (home): fixed tonight: a dotted swatch by Official index ties it to the dotted line, and "Lower is better, so the line climbs as you get better" under the chart
- history-18 (home): fixed tonight: record art on its own row with the label full width under it (two lines' room) so tiles line up; biggest wins name in ink 600, money green; the links are one card
- players-1 (home): fixed earlier (fix2)
- players-2 (home): fixed tonight: nemesis card has the hairline (red skull eyebrow kept), Add a player is the list's last row with an ink plus
- players-3 (home): fixed earlier (fix2)
- players-4 (home): fixed tonight: Add a player is inside the empty card; the outlines are solid with a face, not dashed pluses
- players-5 (shared): fixed tonight: the fix2 ink ring lost to the new look's lavender rule; the new look uses the 2px ink ring now
- players-6 (home): fixed tonight: handicap is a field like the name, with an inline clear X
- players-7 (home): fixed tonight: friends and suggested are one card of rows each
- players-8 (shared): fixed tonight: picked buddy is an ink ring and check. Done on Photo stays disabled until a photo is picked (it is disabled, not just beige)
- classic-1 (shared): dot earlier; tonight the nav draws inactive tabs in outline in both looks
- classic-2 (home): fixed tonight: History's moment and Players' record wrap instead of cutting off
- setup-16 (shared): part tonight: First tee's labels are the tracked eyebrow. The rule kept: sentence-case labels outside cards, tracked eyebrows inside them; Bets' PLAY FOR / PAYOUT are inside cards, so they stay
- setup-25 (shared): kept: First tee opens over the scoring screen, where every sheet title is the heavy body face on purpose (play in the sun)
- setup-28 (plan): scroll-into-view earlier (WhenPicker); tonight the day strip fades at the card edge (CSS only)
- play-41 (shared): left: the Bets and Handicaps sheets are round screens; their in-card eyebrows already match the rule above
- play-42 (shared): fixed tonight: sheet titles start on the 20px edge, the same as a confirm's title (End this round? stays serif: confirms are moments outside the play screen)
- play-43 (shared): fixed tonight: same, the title and the words under it share the 20px edge
- play-55 (shared): fixed tonight: Add a player's handicap stepper is the shared score-ctrl group, quiet minus and ink plus like Fix hole
- play-65 (shared): fixed tonight: every pinned footer (.cta-wrap, .pin-btn) has a canvas fade above it
- play-66 (shared): fixed tonight: a small header gets the hairline once its scroll moves (Header in ui.jsx)
- play-70 (shared): fixed earlier (fix2) (the off switch fill and edge from play-12)
- play-77 (shared): left: reveal, results and settle up are round screens another fixer owns tonight
- trips-16 (home): fixed tonight: no score yet is a quiet en dash like the rank
- trips-17 (home): fixed tonight: the group counts are hairline chips, the live ones edged in ink
- trips-18 (home): fixed tonight: Send every group its link is a full-width outline button
- trips-19 (home): fixed tonight: done steps keep their check in a scrolling step bar too (Steps in ui.jsx; round setup gets it as well)
- trips-20 (shared): fixed tonight: a pinned footer anywhere on the screen steps out while a sheet is up
- trips-21 (home): fixed tonight: How much is a field with the field edge and a pencil
- trips-22 (home): fixed tonight: before the game is final, the Money tab is a small card (Pot, Skins, You're in for) then the note
- trips-23 (shared): left: the Start a trip sheet is Trips.jsx (round fixer's file tonight)
- trips-24 (home): fixed tonight: the template badge splits brighter navy and rose in dark
- trips-25 (shared): fixed tonight: the schedule's Course optional matches every other optional label
- trips-26 (home): part tonight: the schedule Day is a white hairline card (TripMode.jsx). The sheet's scroll padding under the footer is Trips.jsx: left
- trips-28 (home): left: Trip.jsx
- trips-29 (home): left: Trip.jsx
- trips-30 (home): left: Trip.jsx
- trips-31 (home): left: Trip.jsx
- trips-32 (home): left: Trip.jsx
- trips-33 (home): fixed earlier (fix2) (the eyebrow joins with a gap)
- trips-34 (home): left: the trip card's expense row is Trips.jsx
- trips-35 (home): fixed tonight: Still to pick is full colour in both themes (no .85 opacity)
- trips-36 (shared): kept: matches the one rule (Name is a field label outside the cards, DAY and HOLES are eyebrows inside them)
- trips-37 (home): part tonight: the switch says "Just the order, no money" on a trip with no cup. Sizing the image to its rows is the share image renderer (shareImage.js family): left
