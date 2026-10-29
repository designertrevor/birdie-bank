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
