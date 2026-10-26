# Review shots: Current vs New

Screenshot pairs for the overhaul review, at 390 by 844 CSS px (2x), light and dark, from one seed.
Every file is `<screen>-<theme>.png`, so `current/tab-dark.png` pairs with `new/tab-dark.png`.

## Run it

Two dev servers, one per copy of the app:

```sh
# Current (main), in .claude/worktrees/oh-current
npx vite --port 5190 --strictPort --host 127.0.0.1
# New (overhaul/next), in .claude/worktrees/overhaul
npx vite --port 5191 --strictPort --host 127.0.0.1
```

Then, from the overhaul worktree (needs Google Chrome, no packages):

```sh
node scripts/review-shots.mjs --base http://127.0.0.1:5190/ --out overnight/review-shots/current --label current
node scripts/review-shots.mjs --base http://127.0.0.1:5191/ --out overnight/review-shots/new --label new
# New in the classic look, light only
node scripts/review-shots.mjs --base http://127.0.0.1:5191/ --out overnight/review-shots/new-classic --label new --look classic --theme light --only upnext,tab,scoring
```

Flags:

- `--label current|new` picks the taps for that copy and which shots exist (some are New only).
- `--look classic|new` sets localStorage `bb-look` (default: classic for current, new for new).
- `--theme light|dark|both` (default both). `--only upnext,tab` shoots just those.
- `--type <name>` opens the app at `?type=<name>`, for a type switch if the New copy has one.
- `--seed <file>` loads another seed. `--build-seed` rebuilds `seed-state.json` and stops.

## The seed

`seed-state.json` is one saved app state (localStorage `birdie-bank-v1`) that both copies load.
`scripts/review-seed.js` builds it inside the app's page with the app's own functions
(`createRound`, `bankerHoleSetup`, `wolfFor`, `newPlan`, `stampAvatars`), from a fixed random seed:

- Trevor plus 8 friends, each with a Ball buddy.
- 8 finished rounds from Aug 29 to Oct 21: Skins, Nassau (2 v 2 and head to head), Wolf, Banker,
  at Logan River, Birch Creek and Preston. Trevor is +$45 on the season.
- Two payments, so the Tab has history. Open: Sam owes Trevor $22, Tyler $11, Jackson $3;
  Trevor owes Ben $13.
- Skins at Logan River going on now, two holes scored, on the 3rd.
- Saturday's Nassau at 8:40, Logan River, with Jackson and Marcus in, Dev a maybe, Sam no answer.

The New copy adds two plans on top with its own code (`newOnlyPlans`): a round with no day yet at
Birch Creek with three weekend days voted on, and the same plan as Riley sees it from the link.

Every page runs on a fixed clock, Monday 26 Oct 2026 at 5:40 pm in Denver's time zone, so "Saturday,
5 days" and "6h ago" read the same on both copies whenever they're shot.

## Shots

| Shot | How it gets there |
| --- | --- |
| `upnext`, `upnext-scrolled` | Up next with the round in progress; scrolled by one viewport |
| `tab`, `history`, `players` | The bottom nav |
| `plan-dated` | Up next, Saturday's Nassau card |
| `setup-first-step` (Current) / `setup-overview` (New) | No round going on, the centre play button |
| `round-ready` | Skins, Logan River, Trevor, Jackson, Marcus, Dev, Create round |
| `scoring` | The round in progress, hole 3 |
| `live` | The same round shared, with Jackson keeping the card, so this phone watches it. Current shows the read-only hole with "Jackson is keeping score"; New opens on the live money |
| `results` | History, the Oct 21 Banker round (RoundDetail) |
| `plan-ask`, `plan-open`, `plan-friend`, `pad` (New only) | Get a round going; the no-day plan; Riley's view of it; the number pad on hole 3 |

The watched round's shared copy is seeded into localStorage (`bb-live:LOGAN7`), which is what the
dev server's local sync adapter reads, so sharing doesn't end on load.
