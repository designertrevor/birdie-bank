# Night 4: final screens fixes (n4/screens)

The final audit's findings for home, plan, onboarding and shared (auditor-5, auditor-6's shared ones,
auditor-4's once it landed). One line per finding: what changed, or why not. Before shots are the
audit's own (overnight/audit-shots-4 in the overhaul worktree, commit 1db6c49, the same code this
branch started from), copied to overnight/n4-shots/screens/before/<area>/; after shots in
overnight/n4-shots/screens/after/<area>/ (untracked), shot with scripts/audit-shots.mjs.

## Broken

- plan-1: fixed. A friend's own seat used this phone's "me" (right on a real friend's phone, but every other face on a friend's phone was looked up by the organizer's player ids, which mean nothing there, and the organizer's face only went up once). Now the organizer's phone stamps everyone's face on the plan (`faces`, plus `hostAvatar` refreshed on every change, lib/plan-faces.js), and PlanAvatar picks one face per seat: the organizer's from the plan, your own from your profile (else the one the organizer has for you), everyone else's from the plan. Test: src/lib/plan-faces.test.js. The audit's friend view was also Trevor's phone pretending to be Riley, so scripts/audit-shots.mjs now makes it Riley's phone (her "me" and face) and the seed's friend plan carries the stamped faces.
