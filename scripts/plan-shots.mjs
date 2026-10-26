// Overhaul (Get a round going): screenshots of the ask, the When choices, the plan page with no day
// (nothing set, days voted, the lock nudge), a friend's card with No day yet, the dated ticket and
// Up next's card, at 390 by 844 in light and dark. Needs the dev server (npx vite --port 5182) and
// Google Chrome. Run: node scripts/plan-shots.mjs [seed.json] [filter]
// Writes overnight/overhaul-shots/plan/<theme>-<shot>.png
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { newAskPlan } from '../src/lib/plan-ask.js';
import { newPlan } from '../src/lib/plans.js';
import { soonDays } from '../src/lib/plan-open.js';

const BASE = process.env.BASE || 'http://localhost:5182/';
const OUT = new URL('../overnight/overhaul-shots/plan/', import.meta.url);
const seedPath = process.argv[2] || new URL('../overnight/serif-shots/seed-state.json', import.meta.url);
const filter = process.argv[3] || '';
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
// No round going on, so Up next offers the next round
delete seed.rounds[seed.activeRoundId];
seed.activeRoundId = null;
seed.plans = {};
fs.mkdirSync(OUT, { recursive: true });

const me = seed.me;
const P = seed.players;
const people = Object.values(P).filter(p => p.id !== me).map(p => ({ id: p.id, name: p.name }));
const [a, b, c] = people;
const days = soonDays(new Date());
const course = { id: 'logan-river', name: 'Logan River GC', city: 'Logan' };
const base = over => newAskPlan({ id: 'pl_shot', hostWho: 'host', hostName: P[me].name, people, settings: seed.settings, now: Date.now() - 3600000, ...over });
const says = (plan, who, name, ans) => { plan.answers[who] = { name, at: Date.now(), ...ans }; return plan; };

const nothing = base({});
const voted = says(says(base({ when: { mode: 'options', days: days.slice(0, 3) } }), a.id, a.name, { status: 'in', days: [days[1], days[2]] }), b.id, b.name, { status: 'maybe', days: [days[0]] });
const nudge = says(says(says(base({ when: { mode: 'options', days: days.slice(0, 3) }, course }), a.id, a.name, { status: 'in', days: [days[1]], game: 'nassau' }), b.id, b.name, { status: 'in', days: [days[1], days[2]], game: 'skins' }), 'g_x', 'Sam', { status: 'in', days: [days[1]], game: 'nassau' });
const friend = { ...base({ when: { mode: 'options', days: days.slice(0, 3) }, course }), host: false, localMe: a.id, hostName: 'Trevor' };
says(friend, b.id, b.name, { status: 'in', days: [days[1]] });
const dated = newPlan({ id: 'pl_shot', hostName: P[me].name, game: 'skins', holesCount: 18, date: days[0], teeTime: '08:40', course, people, ballot: { games: ['nassau', 'wolf'], bets: [2, 5] }, suggestedBet: 2, settings: seed.settings, now: Date.now() });
says(says(dated, a.id, a.name, { status: 'in', game: 'nassau' }), b.id, b.name, { status: 'maybe' });

// In-page helpers: tap by text, wait
const HELPERS = `
window.w = (ms = 700) => new Promise(r => setTimeout(r, ms));
window.tap = t => { const b = [...document.querySelectorAll('button')].reverse().find(b => b.offsetParent && ((b.innerText || '').trim() === t || b.getAttribute('aria-label') === t || (b.innerText || '').trim().startsWith(t))); if (!b) throw new Error('no button ' + t); b.click(); };
window.card = () => document.querySelector('.upcoming-card').click();
`;
const SHOTS = [
  { id: 'ask', plan: null, steps: 'tap("Plan ahead"); await w(1200);' },
  { id: 'when', plan: null, steps: 'tap("Plan ahead"); await w(1200); tap("When"); await w(); tap("A few options"); await w(300); document.querySelectorAll(".pd-day")[1].click(); document.querySelectorAll(".pd-day")[2].click(); document.querySelectorAll(".pd-day")[4].click(); await w();' },
  { id: 'upnext-card', plan: voted, steps: 'document.querySelector(".upcoming-card").scrollIntoView({ block: "center" }); await w();' },
  { id: 'plan-nothing-set', plan: nothing, steps: 'card(); await w(1200);' },
  { id: 'plan-days-voted', plan: voted, steps: 'card(); await w(1200);' },
  { id: 'plan-days-voted-rows', plan: voted, steps: 'card(); await w(1200); document.querySelector(".pd-rows").scrollIntoView({ block: "center" }); await w();' },
  { id: 'lock-nudge', plan: nudge, steps: 'card(); await w(1200); document.querySelector(".pd-nudge").scrollIntoView({ block: "center" }); await w();' },
  { id: 'lock-sheet', plan: nudge, steps: 'card(); await w(1200); tap("Lock in"); await w(900);' },
  { id: 'friend-no-day', plan: friend, steps: 'card(); await w(1200); tap("I’m in"); await w();' },
  { id: 'friend-no-day-top', plan: friend, steps: 'card(); await w(1200);' },
  { id: 'dated-ticket', plan: dated, steps: 'card(); await w(1200);' },
  { id: 'dated-ticket-rows', plan: dated, steps: 'card(); await w(1200); document.querySelector(".pd-rows").scrollIntoView({ block: "center" }); await w();' },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const look of ['new', 'classic']) for (const theme of ['light', 'dark']) for (const shot of SHOTS) {
    if (look === 'classic' && !['ask', 'plan-days-voted', 'dated-ticket'].includes(shot.id)) continue;
    const name = `${look === 'new' ? '' : 'classic-'}${theme}-${shot.id}`;
    if (filter && !name.includes(filter)) continue;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    const state = structuredClone(seed);
    state.settings.theme = theme;
    if (shot.plan) state.plans = { [shot.plan.id]: structuredClone(shot.plan) };
    await ctx.addInitScript(`try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('birdie-bank-v1', ${JSON.stringify(JSON.stringify(state))}); localStorage.setItem('bb-look', '${look}'); sessionStorage.setItem('seeded', '1'); } } catch (e) {}`);
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2500);
    try {
      await page.evaluate(`(async () => { ${HELPERS} ${shot.steps} await document.fonts.ready; })()`);
    } catch (e) { console.log(name, 'FAILED', e.message.split('\n')[0]); }
    await page.waitForTimeout(500);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) });
    console.log(name);
    await ctx.close();
  }
} finally { await browser.close(); }
