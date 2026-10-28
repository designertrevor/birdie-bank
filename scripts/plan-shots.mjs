// Get a round going: screenshots of every plan screen and state at 390 by 844 in light and dark: the
// ask and its sheets (When, a day, Where, Game and bet), Up next's plan cards, the plan page with no
// day (nothing set, days voted, the lock nudge and sheet, the day sheet), the friend's link view
// before and after answering, the dated ticket, a called-off plan and the trash talk sheet. Every
// page runs on a fixed clock (Mon 26 Oct 2026, 5:40 pm in Utah) so before and after shots match.
// Needs the dev server and Google Chrome.
// Run: BASE=http://127.0.0.1:5202/ OUT=overnight/fix2-shots/plan/ SUFFIX=-after node scripts/plan-shots.mjs [seed.json] [filter]
// Writes <OUT><shot><SUFFIX>-<theme>.png (classic look shots start with classic-)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { newAskPlan } from '../src/lib/plan-ask.js';
import { newPlan } from '../src/lib/plans.js';
import { soonDays } from '../src/lib/plan-open.js';

const BASE = process.env.BASE || 'http://localhost:5182/';
const OUT = path.resolve(process.env.OUT || 'overnight/overhaul-shots/plan/');
const SUFFIX = process.env.SUFFIX || '';
const seedPath = process.argv[2] || new URL('../overnight/review-shots/seed-state.json', import.meta.url);
const filter = process.argv[3] || '';
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const NOW = Date.parse('2026-10-26T17:40:00-06:00');
const CLOCK = `(() => { const D = Date, t0 = D.now(), F = ${NOW}; const now = () => F + (D.now() - t0);
  class FakeDate extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } }
  FakeDate.parse = D.parse; FakeDate.UTC = D.UTC; window.Date = FakeDate; })();`;
// No round going on, so Up next offers the next round
delete seed.rounds[seed.activeRoundId];
seed.activeRoundId = null;
seed.plans = {};
fs.mkdirSync(OUT, { recursive: true });

const me = seed.me;
const P = seed.players;
const people = Object.values(P).filter(p => p.id !== me).slice(0, 5).map(p => ({ id: p.id, name: p.name }));
const [a, b, c] = people;
const days = soonDays(new Date(NOW));
const course = { id: 'logan-river', name: 'Logan River GC', city: 'Logan' };
const base = (id, over) => newAskPlan({ id, hostWho: 'host', hostName: P[me].name, people, settings: seed.settings, now: NOW - 3600000, ...over });
const says = (plan, who, name, ans) => { plan.answers[who] = { name, at: NOW, ...ans }; return plan; };

const nothing = base('pl_nothing', {});
const voted = says(says(base('pl_voted', { when: { mode: 'options', days: days.slice(0, 3) } }), a.id, a.name, { status: 'in', days: [days[1], days[2]] }), b.id, b.name, { status: 'maybe', days: [days[0]] });
const nudge = says(says(says(base('pl_nudge', { when: { mode: 'options', days: days.slice(0, 3) }, course }), a.id, a.name, { status: 'in', days: [days[1]], game: 'nassau' }), b.id, b.name, { status: 'in', days: [days[1], days[2]], game: 'skins' }), c.id, c.name, { status: 'in', days: [days[1]], game: 'nassau' });
const friendOf = id => ({ ...base(id, { when: { mode: 'options', days: days.slice(0, 3) }, course }), host: false, hostName: 'Trevor' });
const friendBefore = friendOf('pl_friend0');
says(friendBefore, b.id, b.name, { status: 'in', days: [days[1]] });
const friend = { ...friendOf('pl_friend'), localMe: a.id };
says(friend, b.id, b.name, { status: 'in', days: [days[1]] });
const friendAfter = { ...friendOf('pl_friend2'), localMe: a.id, daysSent: true };
says(says(friendAfter, b.id, b.name, { status: 'in', days: [days[1]] }), a.id, a.name, { status: 'in', days: [days[1], days[2]] });
const datedOf = (id, n) => {
  const p = newPlan({ id, hostName: P[me].name, game: 'skins', holesCount: 18, date: days[0], teeTime: '08:40', course, people: people.slice(0, n), ballot: { games: ['nassau', 'wolf'], bets: [2, 5] }, suggestedBet: 2, settings: seed.settings, now: NOW });
  return says(says(p, a.id, a.name, { status: 'in', game: 'nassau' }), b.id, b.name, { status: 'maybe' });
};
const dated = datedOf('pl_dated', 3);
const datedFull = datedOf('pl_dated5', 5);
const off = { ...datedOf('pl_off', 3), status: 'off', offAt: NOW - 3600000 };

// In-page helpers: tap by text, wait
const HELPERS = `
window.w = (ms = 700) => new Promise(r => setTimeout(r, ms));
window.tap = t => { const b = [...document.querySelectorAll('button')].reverse().find(b => b.offsetParent && ((b.innerText || '').trim() === t || b.getAttribute('aria-label') === t || (b.innerText || '').trim().startsWith(t))); if (!b) throw new Error('no button ' + t); b.click(); };
window.card = (i = 0) => document.querySelectorAll('.upcoming-card')[i].click();
window.down = sel => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.scrollIntoView({ block: 'center' }); };
window.bottom = () => document.querySelector('.screen.active .scroll').scrollTo(0, 1e5);
`;
const ASK = 'tap("Get a round going"); await w(1200);';
const SHOTS = [
  { id: 'ask', steps: ASK },
  { id: 'ask-bottom', steps: `${ASK} bottom(); await w();` },
  { id: 'ask-typing', steps: `${ASK} document.querySelector('.pa-msg').focus(); await w();` },
  { id: 'when-options', steps: `${ASK} tap("When"); await w(); tap("A few options"); await w(300); document.querySelectorAll(".pd-day")[1].click(); document.querySelectorAll(".pd-day")[2].click(); document.querySelectorAll(".pd-day")[4].click(); await w();` },
  { id: 'when-set', steps: `${ASK} tap("When"); await w(); tap("Set a day"); await w(300); document.querySelectorAll(".pd-day")[2].click(); await w();` },
  { id: 'when-open', steps: `${ASK} tap("When"); await w();` },
  { id: 'when-calendar', steps: `${ASK} tap("When"); await w(); tap("Set a day"); await w(300); document.querySelector(".pd-day.add").click(); await w(900);` },
  { id: 'where', steps: `${ASK} tap("Where"); await w(900);` },
  { id: 'game', steps: `${ASK} tap("Game and bet"); await w();` },
  { id: 'game-pick', steps: `${ASK} tap("Game and bet"); await w(); tap("I’ll pick"); await w();` },
  { id: 'ask-filled', steps: `${ASK} tap("When"); await w(); tap("A few options"); await w(300); document.querySelectorAll(".pd-day")[1].click(); document.querySelectorAll(".pd-day")[2].click(); await w(200); tap("Use these"); await w(); document.querySelectorAll(".pa-chip")[0].click(); document.querySelectorAll(".pa-chip")[2].click(); await w();` },
  { id: 'upnext-cards', plans: [nudge, voted, dated], steps: 'down(".upcoming-card"); await w();' },
  { id: 'plan-nothing-set', plans: [nothing], steps: 'card(); await w(1200);' },
  { id: 'plan-nothing-set-rows', plans: [nothing], steps: 'card(); await w(1200); down(".pd-rows"); await w();' },
  { id: 'plan-days-voted', plans: [voted], steps: 'card(); await w(1200);' },
  { id: 'plan-days-voted-rows', plans: [voted], steps: 'card(); await w(1200); down(".pd-rows"); await w();' },
  { id: 'plan-bottom', plans: [voted], steps: 'card(); await w(1200); bottom(); await w();' },
  { id: 'day-sheet', plans: [voted], steps: 'card(); await w(1200); tap("Day"); await w(900);' },
  { id: 'lock-nudge', plans: [nudge], steps: 'card(); await w(1200); down(".pd-nudge"); await w();' },
  { id: 'lock-sheet', plans: [nudge], steps: 'card(); await w(1200); tap("Lock in"); await w(900);' },
  { id: 'friend-who', plans: [friendBefore], steps: 'card(); await w(1200);' },
  { id: 'friend-no-day-top', plans: [friend], steps: 'card(); await w(1200);' },
  { id: 'friend-no-day', plans: [friend], steps: 'card(); await w(1200); tap("I’m in"); await w(); bottom(); await w();' },
  { id: 'friend-answered', plans: [friendAfter], steps: 'card(); await w(1200);' },
  { id: 'friend-answered-rows', plans: [friendAfter], steps: 'card(); await w(1200); down(".pd-rows"); await w();' },
  { id: 'dated-ticket', plans: [dated], steps: 'card(); await w(1200);' },
  { id: 'dated-ticket-five', plans: [datedFull], steps: 'card(); await w(1200);' },
  { id: 'dated-ticket-rows', plans: [dated], steps: 'card(); await w(1200); down(".pd-rows"); await w();' },
  { id: 'dated-bottom', plans: [dated], steps: 'card(); await w(1200); bottom(); await w();' },
  { id: 'called-off', plans: [off], steps: 'card(); await w(1200);' },
  { id: 'talk-sheet', plans: [dated], steps: 'card(); await w(1200); tap("Trash talk"); await w(900);' },
  // The friend's view from the link with no app set up: the organizer's phone shares the plan
  // (the dev server's local adapter), then a clean profile opens the link
  { id: 'link-who', plans: [voted], link: 'pl_voted', steps: '' },
  { id: 'link-answer', plans: [voted], link: 'pl_voted', steps: 'tap("Dev"); await w(1200); tap("I’m in"); await w(); document.querySelectorAll(".pd-answer .pd-day")[1].click(); await w(); bottom(); await w();' },
  { id: 'link-answered', plans: [voted], link: 'pl_voted', steps: 'tap("Dev"); await w(1200); tap("I’m in"); await w(); document.querySelectorAll(".pd-answer .pd-day")[1].click(); await w(300); tap("Send my answer"); await w(1500); document.querySelector(".screen.active .scroll").scrollTo(0, 0); await w();' },
];
const CLASSIC = ['ask', 'plan-days-voted', 'dated-ticket', 'friend-no-day-top', 'upnext-cards'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const look of ['new', 'classic']) for (const theme of ['light', 'dark']) for (const shot of SHOTS) {
    if (look === 'classic' && !CLASSIC.includes(shot.id)) continue;
    const name = `${look === 'new' ? '' : 'classic-'}${shot.id}${SUFFIX}-${theme}`;
    if (filter && !new RegExp(filter).test(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    const state = structuredClone(seed);
    state.settings.theme = theme;
    if (shot.plans) state.plans = Object.fromEntries(shot.plans.map(p => [p.id, structuredClone(p)]));
    await ctx.addInitScript(`${CLOCK} try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('birdie-bank-v1', ${JSON.stringify(JSON.stringify(state))}); localStorage.setItem('bb-look', '${look}'); sessionStorage.setItem('seeded', '1'); } } catch (e) {}`);
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2500);
    try {
      if (shot.link) {
        const code = await page.evaluate(`(async () => (await import('/src/lib/plan-sync.js')).sharePlan('${shot.link}'))()`);
        await page.goto(`${BASE}?profile=friend&plan=${code}`);
        await page.waitForTimeout(2500);
      }
      await page.evaluate(`(async () => { ${HELPERS} ${shot.steps} await document.fonts.ready; })()`);
    } catch (e) { console.log(name, 'FAILED', e.message.split('\n')[0]); }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(name);
    await ctx.close();
  }
} finally { await browser.close(); }
