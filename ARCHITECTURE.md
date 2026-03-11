# Birdie Bank — Architecture

High-level structure and data flow so the next dev (or future you) can navigate and extend without guessing.

---

## State: RoundContext

All round state lives in **React Context** (`src/context/RoundContext.jsx`), updated via a single **reducer**. No Redux; one provider, one source of truth.

### State shape

| Field | Type | Description |
|-------|------|-------------|
| `currentScreen` | `'home' \| 'games' \| 'players' \| 'stakes' \| 'hole' \| 'settle' \| 'history'` | Which screen is active. |
| `selectedGames` | `string[]` | Game keys: `'banker'`, `'skins'`, `'nassau'`, `'wolf'`. |
| `players` | `Array<{ id, name, hcp }>` | Current round’s players. |
| `nextPlayerId` | `number` | Next id when adding a player. |
| `stakeVals` | `Record<string, number>` | Per-game stake (e.g. `{ banker: 2, skins: 3 }`). |
| `scores` | `Record<string, number>` | Key `"holeNumber-playerId"` → score (1–9). |
| `bets` | `Record<string, number>` | Key `"holeNumber-playerId"` → Banker bet (banker has no bet). |
| `currentHole` | `number` | 1–18. |
| `wolfPartnerThisHole` | `number \| 'lone' \| null` | Wolf partner for current hole (when Wolf is selected). |

### Actions (dispatch)

- `GO` — navigate to a screen.
- `TOGGLE_GAME` — add/remove game from `selectedGames`.
- `ADD_PLAYER` / `REMOVE_PLAYER` / `SET_PLAYER_NAME` / `SET_PLAYER_HCP` — players.
- `SET_STAKE` — change stake for a game.
- `SET_SCORE` / `SET_BET` — per hole/player (key = `currentHole-playerId`).
- `SET_CURRENT_HOLE` / `SET_WOLF_PARTNER` — hole UI state.
- `RESET_ROUND` — clear to initial state (used by “New Round”).

### Context value

The provider exposes **state + stable callbacks** (`go`, `toggleGame`, `setScore`, etc.). The value object is **memoized** so consumers only re-render when state or the callbacks they use actually change.

---

## Persistence: storage.js

- **Save:** After each state change, round state is written to **localStorage** (debounced 300ms). Key: `birdie-bank-round`.
- **Load:** On app init, the reducer’s initial state is **merged** with `loadRound()`. Invalid or missing data falls back to defaults.
- **Clear:** `resetRound()` (used by “New Round”) dispatches `RESET_ROUND` and calls `clearRound()` so the next load starts fresh.

Persisted fields: `currentScreen`, `selectedGames`, `players`, `nextPlayerId`, `stakeVals`, `scores`, `bets`, `currentHole`, `wolfPartnerThisHole`.

---

## Logic: pure functions in `src/logic/`

Game math lives in **plain JS modules** (no React). They take data in, return data out; easy to test and reuse.

- **banker.js** — `getBankerIndexForHole`, `computeHolePayouts`, `computeRunningTotals`. Keys: `scores["hole-playerId"]`, `bets["hole-playerId"]`.
- **settlement.js** — `computeMinTransfers(players, netByPlayerId)` for “who pays who” with fewest transfers.

Screens and context **call** these; they do not hold UI state.

---

## Constants: `src/constants.js`

Single place for:

- `GAME_KEYS`, `STAKE_STEPS`
- `GAME_CFG` (label, sub, Lucide icon per game)
- `DEFAULT_PLAYERS`, `DEFAULT_STAKES`

Used by RoundContext, GameSelectScreen, StakesScreen. Adding a new game = add to `GAME_CFG` and `GAME_KEYS`, then implement logic and wire UI.

---

## Screens and routing

- **No router library.** `App.jsx` reads `currentScreen` from context and renders the matching screen component (`HomeScreen`, `GameSelectScreen`, …).
- **Navigation:** `go('screenId')` dispatches `GO` and scrolls to top. “New Round” calls `resetRound()` then `go('games')`.

---

## Error handling

- **AppErrorBoundary** (`src/components/AppErrorBoundary.jsx`) wraps the app in `main.jsx`. Any uncaught React error in the tree is caught; the user sees “Something went wrong” and can try again or refresh. Prevents a single broken component from white-screening the app.

---

## Tests

- **Vitest** for unit tests. Run: `npm run test`.
- Tests live next to logic: `src/logic/banker.test.js`, `src/logic/settlement.test.js`. They import the pure functions and assert on return values. No React Testing Library yet; add when testing components.

---

## Scripts

| Script | Purpose |
|--------|--------|
| `npm run dev` | Vite dev server. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier (writes `src/**`). |
| `npm run test` | Vitest (run once). |
| `npm run test:watch` | Vitest watch. |

---

## What to add next

- **Skins / Nassau / Wolf** — New files in `src/logic/`, then call from Hole screen and Settlement (same pattern as Banker).
- **Backend** — Replace or augment `storage.js` with API calls; keep the same state shape and reducer so UI stays unchanged.
