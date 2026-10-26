// Overhaul look (overhaul/look): screenshots of the screens in both looks (classic, new) and both
// themes at 390 by 844, seeded from overnight/overhaul-shots/look/seed-state.json. Needs the dev
// server (LOOK_BASE, default http://127.0.0.1:5181/) and Chrome (playwright-core, as e2e/round.e2e.js).
// Run: node scripts/look-shots.mjs [filter] [--type=inter]
//   writes overnight/overhaul-shots/look/<look>-<theme>-<screen>.png
//   --dump=<screen> prints the visible buttons on that screen instead, for writing new steps
//   --audit prints text that falls under WCAG contrast (4.5:1, 3:1 from 24px or 19px bold) per shot
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.LOOK_BASE || 'http://127.0.0.1:5181/';
const OUT = new URL('../overnight/overhaul-shots/look/', import.meta.url);
const seed = JSON.parse(fs.readFileSync(new URL('seed-state.json', OUT), 'utf8'));
const args = process.argv.slice(2);
const filter = args.find(a => !a.startsWith('--')) || '';
const type = (args.find(a => a.startsWith('--type=')) || '').slice(7);
const dump = (args.find(a => a.startsWith('--dump=')) || '').slice(7);
const audit = args.includes('--audit');
const looks = (args.find(a => a.startsWith('--looks=')) || '--looks=classic,new').slice(8).split(',');
const themes = (args.find(a => a.startsWith('--themes=')) || '--themes=light,dark').slice(9).split(',');

// Seed variants: the live Nassau round, the same without it (so Play opens setup), and a new phone
const noLive = structuredClone(seed);
delete noLive.rounds[noLive.activeRoundId];
noLive.activeRoundId = null;
const STATES = { live: seed, done: noLive, fresh: null };

// In-page helpers: tap a button by its text or label, tap a nav tab, wait
const HELPERS = `
window.w = (ms = 900) => new Promise(r => setTimeout(r, ms));
window.vis = () => [...document.querySelectorAll('button, [role=button], a')].filter(b => b.offsetParent);
window.tap = t => { const b = vis().find(b => (b.innerText || '').trim() === t || b.getAttribute('aria-label') === t) || vis().find(b => (b.innerText || '').trim().startsWith(t) || (b.getAttribute('aria-label') || '').startsWith(t)); if (!b) throw new Error('no button ' + t); b.click(); };
window.nav = t => { const b = [...document.querySelectorAll('.bottom-nav button')].find(b => (b.innerText || '').trim() === t); if (!b) throw new Error('no nav ' + t); b.click(); };
window.leave = () => vis().find(b => b.getAttribute('aria-label')?.startsWith('Leave round'))?.click();
window.center = () => document.querySelector('.bottom-nav .nav-btn.center').click();
window.gotIt = () => vis().find(b => (b.innerText || '').trim() === 'Got it')?.click();
window.pickGame = name => { const el = [...document.querySelectorAll('.screen.active .game-row, .screen.active [class*=game]')].find(e => e.offsetParent && (e.innerText || '').trim().replace(/^\\$\\s*/, '').startsWith(name)); if (!el) throw new Error('no game ' + name); el.click(); };
`;

const toUpNext = 'leave(); await w();';
const SHOTS = [
  { id: 'welcome', state: 'fresh', steps: '' },
  { id: 'upnext', state: 'live', steps: toUpNext },
  { id: 'play', state: 'live', steps: 'document.querySelector(".resume-card").click(); await w(1400); try { tap("Skip for now"); } catch {} await w();' },
  { id: 'tab', state: 'live', steps: toUpNext + ' nav("Tab"); await w(1400);' },
  { id: 'history', state: 'live', steps: toUpNext + ' nav("History"); await w(1400);' },
  { id: 'players', state: 'live', steps: toUpNext + ' nav("Players"); await w(1400);' },
  { id: 'round', state: 'live', steps: toUpNext + ' nav("History"); await w(1200); document.querySelector(".screen.active .hist-row").click(); await w(1600);' },
  { id: 'setup', state: 'done', steps: 'gotIt(); await w(400); center(); await w(1200);' },
  { id: 'settings', state: 'done', steps: 'gotIt(); await w(400); tap("Settings"); await w(1400);' },
  { id: 'profile', state: 'done', steps: 'gotIt(); await w(400); nav("Players"); await w(1200); document.querySelector(".screen.active .li, .screen.active .person-row")?.click(); await w(1400);' },
  { id: 'sheet', state: 'done', steps: 'gotIt(); await w(400); nav("Tab"); await w(1200); tap("Paid part of it?"); await w(1200);' },
  // Screens nobody is restructuring tonight, opened straight from a saved place (place.js)
  { id: 'stats', state: 'done', place: 'stats', steps: '' },
  { id: 'season', state: 'done', place: 'season', steps: '' },
  { id: 'hof', state: 'done', place: 'hallOfFame', steps: '' },
  { id: 'trip', state: 'done', place: 'trip', steps: '' },
  { id: 'paywall', state: 'done', place: 'paywall', steps: '' },
  { id: 'me', state: 'done', place: 'profile', steps: '' },
  { id: 'onboard', state: 'fresh', steps: 'tap("Set up my group"); await w(1200);' },
  { id: 'menu', state: 'live', steps: 'document.querySelector(".resume-card").click(); await w(1400); try { tap("Skip for now"); } catch {} await w(); tap("Round menu"); await w(1200);' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const launch = async () => {
  const paths = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(p => p && fs.existsSync(p));
  for (const executablePath of paths) { try { return await chromium.launch({ executablePath }); } catch { /* next */ } }
  return chromium.launch({ channel: 'chrome' });
};

// The contrast walk (memory birdie-bank-theme-qa): each visible text node's colour against the
// first opaque background up its ancestors, blended through any translucent ones on the way
const AUDIT = `(() => {
  const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none') return null; const c = parse(s.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; };
  const out = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); const el = n.parentElement; if (!t || !el || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity === 0 || el.closest('[aria-hidden=true], svg, #splash')) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < .9) continue;
    const bg = bgOf(el); if (!bg) continue; const fg0 = parse(s.color); if (!fg0) continue; const fg = over({ ...fg0, a: fg0.a * op }, bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700; const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) out.push(ratio.toFixed(2) + ' < ' + need + '  ' + size + 'px/' + s.fontWeight + '  .' + (el.className && typeof el.className === 'string' ? el.className.split(' ').join('.') : el.tagName) + '  "' + t.slice(0, 40) + '"');
  }
  return out;
})()`;

const browser = await launch();
try {
  for (const look of looks) for (const theme of themes) for (const shot of SHOTS) {
    const name = `${look}${type && look === 'new' ? '-' + type : ''}-${theme}-${shot.id}`;
    if (dump ? shot.id !== dump : filter && !name.includes(filter)) continue;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    // Every load starts from the shot's saved state, in this theme and look
    const state = STATES[shot.state] && structuredClone(STATES[shot.state]);
    if (state) state.settings.theme = theme;
    await page.addInitScript(`try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); ${state ? `localStorage.setItem('birdie-bank-v1', ${JSON.stringify(JSON.stringify(state))});` : ''} ${shot.place ? `localStorage.setItem('kept-place', ${JSON.stringify(JSON.stringify({ at: Date.now(), tab: 'upnext', stack: [{ name: shot.place, params: {}, key: 'shot' }], kept: {}, maps: {} }))});` : ''} localStorage.setItem('bb-look', '${look}'); localStorage.setItem('bb-type', '${type}'); sessionStorage.setItem('seeded', '1'); } } catch (e) {}`);
    await page.goto(BASE);
    await sleep(3000);
    try {
      await page.evaluate(`(async () => { ${HELPERS} ${shot.steps} await document.fonts.ready; })()`);
    } catch (e) { console.log(name, 'FAILED', e.message.split('\n')[0]); }
    await sleep(1300);
    if (dump) {
      console.log(await page.evaluate(`[...document.querySelectorAll('button, [role=button], a')].filter(b => b.offsetParent).map(b => (b.className || b.tagName) + ' | ' + (b.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40) + ' | ' + (b.getAttribute('aria-label') || '')).join('\\n')`));
    } else if (audit) {
      const bad = await page.evaluate(AUDIT);
      console.log(name, bad.length ? '\n  ' + bad.join('\n  ') : 'ok');
    } else {
      await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) });
      console.log(name);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
