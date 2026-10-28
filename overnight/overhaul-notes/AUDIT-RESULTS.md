# Visual design audit: results (2026-10-28)

Trevor's review (REVIEW-ANSWERS.md) asked for a full visual design audit before anything ships.

## What ran

1. Every screen and state shot at 390 by 844, light and dark: 1,142 shots before tonight's fixes
   (`overnight/audit-shots/`), 1,114 after the fixes for his notes (`overnight/audit-shots-2/`),
   with `scripts/audit-shots.mjs` (untracked shots; the script is committed).
2. Three auditors with the design review checklist (brand fit, polish, every decision card carries
   its action, robustness, dark mode, consistency): 269 findings in `overnight/audit/auditor-1.json`
   (onboarding, more, art), `auditor-2.json` (home, plan, Tab, History, Players, classic) and
   `auditor-3.json` (setup, play, trips).

| | Broken | Should | Polish |
|---|---|---|---|
| Found | 7 | 107 | 155 |
| Fixed tonight | 7 | most (see each fix2 note's "Audit fixes") | a few quick ones |

## Broken, all fixed

- All set in onboarding showed the old straw-hat buddy instead of the one you picked.
- The results share card had a blank cream square where the game art goes.
- A round of one ended as "All square $0, nobody owes anybody".
- The Tab's one-card lists drew notched corners on every row.
- A friend saw a red "Delete plan" (it only hid the plan from her phone).
- Trevor had the halo avatar on the plan and his cap everywhere else.
- (Before the audit) onboarding's art sat in the top left corner after the first step.

## Left for the next run

- Polish (about 150 items): in the three JSON files, severity "polish".
- Should items not reached, with reasons, under "Left" in fix2-home.md, fix2-play.md, fix2-plan.md,
  fix2-onb.md and fix2-art.md. The biggest: Settle up as one card with a quieter Venmo button, the
  team podium, the reward round's lead number and Mark done, Wolf panel collapse, Vegas teams, the
  handicaps sheet, four trip screens never opened full size (cup-trip, cup-rounds, cup-expenses,
  trip-print, trip-add-expense, draft-trip, draft-open, Big Game setup), the Year in review share
  image, the number pad's close, Settings' pink toggles and Help callout, the Status header.
- Trevor's calls: which number a trip leads with (trips-9, trips-14), whether the untouched par
  number stays grey, whether the crew's oval on Round ready should be paler.
