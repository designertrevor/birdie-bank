# Birdie Bank — Roadmap

## Done

- [x] Convert prototype to React + Vite app in `app/`
- [x] Folder structure: `components/screens`, `components/ui`, `context`, `logic`
- [x] Global round state via **RoundContext** (games, players, stakes, scores, bets, current hole, wolf partner)
- [x] All screens: Home, Game Select, Players, Stakes, Hole (scoring), Settlement, History
- [x] Navigation between screens; progress bar on setup steps
- [x] Game select (Banker, Skins, Nassau, Wolf) with toggle
- [x] Players: add / remove / edit name & HCP; Wolf warning when ≠4 players
- [x] Stakes: per-game pickers for selected games only
- [x] Hole screen: game chips, banker notice, Wolf partner picker, score cards, Banker bet pickers, skins pot (mock), running tally (mock), hole dots, prev/next hole
- [x] Settlement: per-player breakdown (mock), “Who Pays Who” (mock)
- [x] Past Rounds list (mock)
- [x] Design: Birdie Bank branding, dark theme, Bebas Neue + DM Sans, lime accent, Lucide icons
- [x] README and ROADMAP

## Done (Banker)

- [x] **Banker game logic** in `logic/banker.js` (rotating banker, hole payouts, running totals)
- [x] **Settlement** minimum-transactions in `logic/settlement.js` (who pays who, fewest transfers)
- [x] Hole screen: real Banker running total; banker-per-hole notice and bet UI
- [x] Settlement screen: real Banker totals and “Who Pays Who” from Banker only

## In progress

- [ ] **Skins logic** in `logic/skins.js` (hole winner, carry-over pot)
- [ ] **Nassau logic** in `logic/nassau.js` (front/back/total match state)
- [ ] **Wolf logic** in `logic/wolf.js` (partner/lone wolf, per-hole payouts)
- [ ] Wire Skins/Nassau/Wolf into Hole + Settlement when selected

## Done (Foundation)

- [x] **Constants** — `src/constants.js` for GAME_CFG, STAKE_STEPS, GAME_KEYS, defaults
- [x] **RoundContext** — memoized value to avoid unnecessary re-renders
- [x] **Error boundary** — AppErrorBoundary wraps app so one component error doesn’t white-screen
- [x] **Prettier** — format script + ESLint integration
- [x] **Tests** — Vitest; unit tests for `banker.js` and `settlement.js`
- [x] **ARCHITECTURE.md** — state shape, persistence, logic, scripts
- [x] **localStorage persistence** — round saved (debounced); rehydrate on load; “New Round” clears

## Planned

- [ ] ~~Persist round to **localStorage**~~ (done)
- [ ] Empty states, loading states, error handling
- [ ] Polish: scoring feedback, Wolf UX, touch targets on device
- [ ] PWA: manifest + service worker, “Add to Home Screen”
- [ ] Optional backend (e.g. Supabase/Firebase) for sync and accounts
- [ ] React Native build for iOS/Android
- [ ] Monetization: free (Banker only) vs paid unlock (all games, history, crews, stats)
