# Overnight 13 report (night of 2026-10-11)

Branch `overnight13/next`, from main at the splash screen (`d918302`). Preview:
https://birdie-bank-git-overnight13-next-design-trevornielses-projects.vercel.app (add `?paywall=on` for
the Pro pieces). The review queue artifact has the questions; this file is the record.

**Roadmap:** 195 of 279 on main (69.9%, weighted 76.3%). 196 on this branch (the area 2 line is checked
off). **204 of 279 (73.1%, weighted 79.6%) when it ships.** Weighted: each line counts 1, 2 or 3 by
which third of line lengths it falls in on main (`node scripts/roadmap-weighted.mjs ROADMAP.md <main copy>`).

## Built (all eight merged, test, lint and build green after each)

| Task | Area | Notes |
|---|---|---|
| Split Pro on the Tab | 7 | `overnight/o13-notes/split.md`. Money check found and fixed 5 money bugs before the merge |
| The Record Book limit | 8 | `overnight/o13-notes/records.md`. Check fixed a Big Game split across the cutoff |
| Paywall rules | 11 | `overnight/o13-notes/paywall.md`. Reminder is in-app only until Stripe |
| Push when an idea ships | 12 | `overnight/o13-notes/shippush.md`. Check fixed SQL order and a duplicate-push race |
| Weekly feedback digest | 20 | `overnight/o13-notes/digest.md`. Admin-only screen at `/?digest` plus a Monday push |
| Two-phone bug pass | 20 | Round, Tab, trip, planned round, the flag-on pieces. Three fixes, line stays open |
| Creator pricing | 22 | `overnight/O13-creator-pricing.md` |
| Creator brief | 22 | `overnight/O13-creator-brief.md` |
| Creator codes | 22 | `overnight/O13-creator-codes.md`, `src/lib/creator-codes.js` |
| Area 2 tidy | 2 | Checked off: automatic linking did it |

Tests 2,432 passing (2,358 before). First screen 381.7 kB of 481.

## SQL to run (in order, skip any already run)

1. `2026-10-08-push-prefs.sql`, `2026-10-09-lifetime-pro.sql`, `2026-10-09-attribution.sql` (from overnight 12)
2. `2026-10-12-idea-push.sql` (run before turning "Your ideas" off anywhere: until it runs, the push
   prefs check rejects the new kind)
3. `2026-10-12-feedback-digest.sql`, then add yourself to `app_admins` (line in the file header)

## Open, not blocking (no money, privacy or security blockers)

- Split Pro lives on the organizer's phones only; a friend's part payment can fill a shared round first.
  Friends seeing their share needs a server table (follow-up).
- Recap and a few stats screens still count a split payment after the flag goes back off (testers never
  have the flag on).
- Copy: the paywall's "Today" step claims a round is set up when opened from Your plan; setup with
  handicaps off still says "Net scores"; "and 1 more" when the viewer is the one; the Record Book line on
  a season with nothing hidden; the paywall reopening on a cold start during the trial; the Season Pro
  badge during the trial; the Tab and Settle the trip naming different payees for the same money;
  "Birdie Bank" hard-coded in older copy.
- Two "live round" definitions (record line vs upsell guard) can disagree for a round left open a day.
