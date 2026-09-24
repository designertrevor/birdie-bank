# Birdie Bank

Golf side-game scorekeeper for a group: Banker, Nassau, Skins and Wolf, with handicaps,
presses, a ledger that nets debts across rounds, and settle-up links.

Live: https://birdie-bank.vercel.app/ (auto-deploys from `main`). The original static
prototype is kept at `/prototype.html`.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # game maths (node:test)
npm run lint
npm run build
```

## How it's put together

- `src/lib/golf.js` — pure maths: WHS course handicap, stroke allocation (incl. plus
  handicaps), Banker settlement, Nassau match play and presses, fewest-payments settle-up.
- `src/lib/round.js` — the round model (holes in play, strokes off the low player, nets,
  results for each game). Everything shown is derived from saved scores.
- `src/lib/store.js` — app state in `localStorage` (one scorekeeper per phone).
  Backup/restore lives in Settings.
- `src/lib/ledger.js` — outstanding debts netted across finished rounds and payments.
- `src/data/courses.js` — bundled scorecards with sources; `verified: false` ones show a
  warning and can be corrected in-app (saved as the user's own copy).
- `src/screens/*` — History, Ledger, Players, Settings tabs; New round wizard; Play.
- `public/sw.js` + `manifest.webmanifest` — installable, works offline once loaded.

## Shared live scoring (Supabase)

Without keys the feature is hidden in production. In `npm run dev` it uses a local
stand-in, so two tabs can act as two phones: open the second one with `?profile=b`.

1. Create a free project at supabase.com.
2. SQL Editor → run `supabase/schema.sql`.
3. Project Settings → API: copy the Project URL and the anon (publishable) key.
4. Vercel → Project → Settings → Environment Variables: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (all environments), then redeploy.
5. For local dev against the real server, put the same two values in `.env.local`.

Rounds are shared by a 6-letter code; anyone with the code can view and score it.
There are no accounts yet.
