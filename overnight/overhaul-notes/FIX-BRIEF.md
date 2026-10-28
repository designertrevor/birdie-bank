# Fix pass 2 (2026-10-28 night): shared brief

Trevor reviewed the overhaul (overnight/overhaul-notes/REVIEW-ANSWERS.md) and asked for his notes
fixed plus a full visual design audit, with fixes made from what the audit finds. He's asleep: work
through without asking, note every call you make for him in overnight/overhaul-notes/fix2-<area>.md.

Rules: everything in overnight/overhaul-notes/BRIEF.md still applies (own worktree and branch, npm
already installed, commit small with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", never
push or merge, never run SQL, no em dashes anywhere, match the surrounding code and comments, new CSS
beside your screen, light and dark, both looks, every entrance has its exit, breathing room). After a
change to src/styles.css run `node scripts/look-new-css.mjs` and commit the regenerated file.

Review method for every screen you touch (memory design-review-checklist): brand fit (BRAND.md, the
Good Dog direction: hairlines, calm, pink only on the one thing to tap, generous space around the focal
point), polish (the make-interfaces-feel-better skill: alignment, optical centring, hit areas of 44px,
press states, consistent radii and spacing), every card that asks for a decision carries its action,
and robustness (real headings, short accessible names, what shows while loading and when a load fails).

Look at every change in a real browser at 390 by 844, light and dark (headless Chrome via playwright-core;
scripts/review-shots.mjs and scripts/review-seed.js seed a rich state with a fixed clock, see
overnight/review-shots/README.md). Check the state you changed AND its neighbours. Save before and after
shots to overnight/fix2-shots/<area>/<name>-<before|after>-<light|dark>.png (untracked).

Finish: npm test, npm run lint, npm run build pass. Final message under 250 words: head commit, each
item and what you did, calls you made, anything you couldn't fix and why.
