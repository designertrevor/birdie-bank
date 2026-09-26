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

- `src/lib/golf.js`: pure maths: WHS course handicap, stroke allocation (incl. plus
  handicaps), Banker settlement, Nassau match play and presses, fewest-payments settle-up.
- `src/lib/round.js`: the round model (holes in play, strokes off the low player, nets,
  results for each game). Everything shown is derived from saved scores.
- `src/lib/store.js`: app state in `localStorage` (one scorekeeper per phone).
  Backup/restore lives in Settings.
- `src/lib/ledger.js`: outstanding debts netted across finished rounds and payments.
- `src/data/courses.js`: bundled scorecards with sources; `verified: false` ones show a
  warning and can be corrected in-app (saved as the user's own copy).
- `src/screens/*`: History, Ledger, Players, Settings tabs; New round wizard; Play.
- `public/sw.js` + `manifest.webmanifest`: installable, works offline once loaded.

## Shared live scoring (Supabase)

Without keys the feature is hidden in production. In `npm run dev` it uses a local
stand-in, so two tabs can act as two phones: open the second one with `?profile=b`.

The project is `birdie-bank` in Supabase (West US). Its URL and publishable key live in
`.env.production`, which Vercel builds with. To rebuild from scratch: create a project,
run `supabase/schema.sql` in the SQL Editor, and put the new URL and publishable key in
`.env.production`. To use the real server in `npm run dev`, copy them into `.env.local`.

Rounds are shared by a 6-letter code; anyone with the code can view and score it.
There are no accounts yet.

## Course search (GolfCourseAPI)

Searching in the course picker also asks `api/courses.js`, a Vercel function that proxies
GolfCourseAPI with the server-side `GOLFCOURSEAPI_KEY`. Without that variable it answers
`not_configured` and the app shows only its own courses. A picked course is saved into
`customCourses` (with `source: 'golfcourseapi'`), so it syncs, works offline and can be
corrected like any course you added. `npm run dev` has no `/api`; put
`VITE_COURSE_SAMPLES=1` in `.env.local` to search a few made-up courses instead.
