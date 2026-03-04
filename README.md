# Birdie Bank

A mobile-first golf betting scorecard app for tracking friendly money games during a round. Built for **glance-and-tap** use on the course: minimal taps, large touch targets, no GPS or maps—just betting and scores.

**Target:** Web app first (React + Vite, deploy on Vercel), then native iOS via React Native.

---

## The four games

- **Banker** — Rotating banker each hole (lowest score or first to putt out). Non-banker players set their own bet within min/max; banker tees last and sets the max. Highest priority; most complex math.
- **Skins** — Win a hole outright to take the skin. Ties carry the pot to the next hole.
- **Nassau** — Three matches: front 9, back 9, total 18. Common stakes e.g. $5-$5-$10. Press (side bet when 2-down) to be added later.
- **Wolf** — 4 players. Rotating wolf tees last each hole, picks a partner after tee shots or goes lone wolf (1v3, stakes double).

---

## Tech stack

- **React 19** + **Vite 7**
- **RoundContext** for global round state (games, players, stakes, scores, current hole)
- **Lucide React** for icons
- Mobile-first 390px width; dark golf-green theme, Bebas Neue + DM Sans, lime accent

---

## Project structure

```
Birdie Bank/
├── app/                    # Vite + React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── screens/    # Home, GameSelect, Players, Stakes, Hole, Settlement, History
│   │   │   └── ui/         # Reusable UI (to be expanded)
│   │   ├── context/
│   │   │   └── RoundContext.jsx
│   │   ├── logic/          # Game math: banker, skins, nassau, wolf (to be added)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── golf-app-prototype.html # Original HTML/CSS/JS prototype (reference)
├── README.md               # This file
└── ROADMAP.md              # What’s built, in progress, planned
```

---

## Run locally

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173`. Deploy to Vercel by connecting the repo; the app lives in the `app` folder.

---

## Legal

Positioned as tracking **friendly wagers between friends**, not real-money gambling. Aligns with how other golf betting apps (Beezer, Unknown Golf, Press Golf) position themselves. Terms of Service should be reviewed by a lawyer before public launch.

---

## Name

**Birdie Bank** — no existing golf app uses this name; no trademark conflicts found. Domain availability (e.g. birdiebank.com, birdiebank.app) to be confirmed.
