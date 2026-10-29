# Final visual design audit (2026-10-29 night): shared brief

Trevor reviewed the overhaul and found things the last review missed (onboarding's art off centre,
illustrations not working in dark). He asked for a full visual design audit that catches everything,
and for fixes from what it finds. Tonight's fixes for his notes are already in (see
overnight/overhaul-notes/REVIEW-ANSWERS.md and fix2-*.md); judge the app as it is now.

Shots: overnight/audit-shots-4/<area>/ in /Users/trevor/Projects/Birdie Bank 2/.claude/worktrees/overhaul
(PNGs at 390 by 844, 2x, light and dark, from commit 1db6c49; INDEX.md says what each shows;
_sheet-light.jpg and _sheet-dark.jpg per area for scanning). Start from the contact sheets, then open
every screen full size, light AND dark. Read-only: don't edit app code or commit.

Method (memory /Users/trevor/.claude/projects/-Users-trevor-Projects-Birdie-Bank-2/memory/design-review-checklist.md):
brand fit (BRAND.md; the Good Dog direction in memory gooddog-reference.md: hairlines, calm, pink only
on the one thing to tap, generous space around the focal point, memory feedback-breathing-room.md);
polish (the make-interfaces-feel-better skill: alignment, optical centring, consistent spacing and
radii, 44px hit areas, type hierarchy, text that wraps badly or clips, orphans); every card that asks
for a decision carries its action; robustness (headings, loading and failure states where shown).
Dark mode specifically: illustrations (outline, muddy fills, see-through bits), contrast, colour bands
that read olive or brown, pink on dark. Also cross-screen consistency: the same element styled the
same way everywhere (headers, section labels, cards, buttons, chips, sheets, empty states).

**Illustrations, every one, in place (Trevor's priority tonight).** Every drawing should sit straight on
its background as a die-cut sticker: an even white border following the silhouette, in both themes, with no
colour plate, blob or oval behind it. Check each one for: the border present, even and not clipped by its
box or container; no leftover cream or white islands between legs, arms, handles or under chairs where the
background should show; no see-through faces, hands or necks; nothing dark (shoes, hats, an arm) vanishing
into a dark background; centred in its slot when it's the focal point (onboarding steps, empty states,
heroes, Round ready, results), at a sensible size with breathing room; avatars (Ball buddies, critters) with
an ink outline around the head, glasses and every hat; the birdie and eagle critters centred; the podium
steps flush with their container's bottom edge. Zoom into the full-size shots for these; contact sheets
aren't enough.

Last night's findings that were deliberately left (don't re-report): see the "left" and "kept" lines in
n3-polish.md and n3-play2.md. Also known: sheet and header titles aren't headings in ui.jsx;
the blank frame when a lazy screen first opens (App.jsx Suspense, being handled); the pink strip on
Vegas and Hammer (the head-to-head group colour, Trevor's call).

Output: write overnight/audit/<your-name>.json (names auditor-4, auditor-5, auditor-6) in the overhaul worktree: an array of findings, each
{ "id": "<area>-<n>", "area", "screen", "files": ["audit-shots-4/..."], "theme": "light|dark|both",
"severity": "broken|should|polish", "issue": "...", "fix": "a concrete fix, naming the element or CSS",
"owner": "onb|plan|play|home|art|shared" } where owner is: onb = onboarding, welcome, Settings,
Profile, paywall, Join invite, More screens; plan = plan screens and the Up next plan card; play =
setup, Round ready, scoring, live, results, reveal, settle up; home = Up next, Tab, History, Players,
Friends, Lately, Season, Stats, Hall of fame, trips, draft, Big Game; art = drawing files and the shared
art components; shared = ui.jsx, nav, sheets, toasts, look CSS used everywhere. Rank broken first.
Verify each finding against the full-size shot before writing it; drop anything you can't see. Be
thorough: Trevor would rather have 80 real findings than 15. Final message under 200 words: counts by
severity and owner, and the five worst.
