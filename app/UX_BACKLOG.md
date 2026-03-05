# Birdie Bank — UX & design backlog

Captured from product feedback. Focus: flow and interface before adding more games.

---

## Home screen

- [x] **Add a button to add another crew** — "Add crew" button in Your Crews section; goes to Players with fresh round.
- Later: consider redesigning home; consider whether crews live only on Players screen.

---

## Players screen & crew flow

- [x] **Save current group as a crew** — "Save as crew" on Players (prompt for name); crews in localStorage.
- [ ] **Use an existing crew** — When on Players, option to "Use a crew" / load a saved group so you don’t re-enter everyone.
- [x] **Bigger handicap controls** — HCP input and +/- buttons enlarged; dedicated .player-hcp-btn (40×40px) for touch.
- [ ] **Past players when adding** — When adding a new player, suggest or pick from past players you’ve played with instead of typing name every time.
- [ ] *(Later)* Cloud profiles: save players in the cloud, find each other, public profile with winnings/losses, view another player’s history if they allow it.
- Four players: OK to allow more than four; Wolf still requires exactly four.

---

## Stakes & flow

- [x] **Stakes optional** — Primary CTA is "Let's Play" on Players → scoring; "Set stakes (optional)" still available.
- [ ] **"Let’s Play" on Players screen** — Primary action after choosing players could be "Let’s Play" at the bottom of the Players screen → go straight to scoring (hole 1). Stakes could be optional or set on first hole.

---

## Hole / scoring screen

- [x] **Start on hole 1** — Round starts on hole 1 (fixed in RoundContext initial state).
- [ ] **Course selection** — Need a place to choose/say what course you’re playing.
- [ ] **Course library (later)** — Library of courses so app knows 9 vs 18 holes and par per hole.
- [x] **Hole dots layout** — Two rows: 1–9, then 10–18 (.hole-dots-row in App.css).
- [x] **Choose who is the banker** — "Banker on hole 1" dropdown on Players screen (when Banker selected); rotation uses bankerStartIndex.
- [x] **Banker: Double / press** — Double button per non-banker (doubles their bet); "Double back" for banker (doubles vs everyone). Logic in banker.js (opts.playerDoubled, opts.bankerDoubledBack); state in RoundContext.

---

## Done this session

- Hole dots rows, start hole 1, HCP touch targets, Let's Play on Players + optional Stakes, Add crew, Choose banker, Double / Double back UI and logic.
- Remaining: Save as crew / Use crew, past players, course selection, course library.
