// Overhaul review: Current vs New screenshot pairs at 390 by 844 (2x), light and dark, from one seed.
// Headless Chrome over the DevTools protocol (no packages needed). Needs a dev server for each copy.
//
//   node scripts/review-shots.mjs --base http://127.0.0.1:5190/ --out overnight/review-shots/current --label current
//   node scripts/review-shots.mjs --base http://127.0.0.1:5191/ --out overnight/review-shots/new --label new
//
// Flags: --look classic|new (localStorage bb-look), --theme light|dark|both (default both),
// --only upnext,tab (shot ids), --type <name> (opens ?type=<name>), --seed <file>,
// --build-seed (rebuilds overnight/review-shots/seed-state.json with this server's code, then stops),
// --top-set (the scoring screen's top, every game x theme, plain and scrolled, into
// overnight/review-shots/top-final/<game>-<theme>[-scrolled].png; narrow it with --games skins,wolf, move it with --out).
// Every page runs on a fixed clock (Mon 26 Oct 2026, 5:40 pm in Utah), so both copies show the same days.
// See overnight/review-shots/README.md.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (k, d = null) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = flag('base', 'http://127.0.0.1:5191/');
const LABEL = flag('label', 'new');
const LOOK = flag('look', LABEL === 'current' ? 'classic' : 'new');
const TYPE = flag('type');
const THEMES = flag('theme', 'both') === 'both' ? ['light', 'dark'] : [flag('theme')];
const ONLY = flag('only') ? String(flag('only')).split(',') : null;
const SEED = path.resolve(ROOT, flag('seed', 'overnight/review-shots/seed-state.json'));
const OUT = path.resolve(ROOT, flag('out', `overnight/review-shots/${LABEL}`));
const NOW = Date.parse('2026-10-26T17:40:00-06:00');
const TZ = 'America/Denver';
const PORT = 9300 + Math.floor(Math.random() * 90);
const isNew = LABEL !== 'current';

const seedSrc = fs.readFileSync(new URL('./review-seed.js', import.meta.url), 'utf8').replace(/^export /gm, '');

// A fixed clock in every page, so "in 5 days" and "2 weeks ago" read the same on both copies
const CLOCK = `(() => { const D = Date, t0 = D.now(), F = ${NOW}; const now = () => F + (D.now() - t0);
  class FakeDate extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } }
  FakeDate.parse = D.parse; FakeDate.UTC = D.UTC; window.Date = FakeDate; })();`;

// In-page helpers: tap a button by its text or label, a nav tab, wait for things to settle
const HELPERS = `
window.w = (ms = 800) => new Promise(r => setTimeout(r, ms));
const vis = b => b.offsetParent || b.getClientRects().length;
const txt = b => (b.innerText || b.textContent || '').trim().replace(/\\s+/g, ' ');
window.find = (t, sel = 'button, [role=button], a') => { const all = [...document.querySelectorAll(sel)].filter(vis).reverse(); return all.find(b => txt(b) === t || b.getAttribute('aria-label') === t) || all.find(b => txt(b).startsWith(t) || (b.getAttribute('aria-label') || '').startsWith(t)) || all.find(b => txt(b).includes(t)); };
window.tap = (t, sel) => { const b = find(t, sel); if (!b) throw new Error('no button ' + t); b.click(); return b; };
window.tryTap = (t, sel) => { try { return tap(t, sel); } catch { return null; } };
window.nav = t => { const b = [...document.querySelectorAll('.bottom-nav button, nav button')].find(b => txt(b) === t || b.getAttribute('aria-label') === t); if (!b) throw new Error('no nav ' + t); b.click(); };
window.center = () => (document.querySelector('.bottom-nav .nav-btn.center') || document.querySelector('.bottom-nav .center')).click();
window.leave = () => { const b = [...document.querySelectorAll('button')].find(b => vis(b) && (b.getAttribute('aria-label') || '').startsWith('Leave round')); if (b) b.click(); return !!b; };
window.scroller = () => { const el = [...document.querySelectorAll('.screen.active, .screen, main, [class*=scroll]')].find(e => vis(e) && e.scrollHeight > e.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); return el || document.scrollingElement; };
window.scrollOne = () => { const el = scroller(); el.scrollTop += innerHeight; };
window.pickGame = name => { const el = [...document.querySelectorAll('.screen.active .game-row, .screen.active [class*=game]')].find(e => vis(e) && txt(e).replace(/^\\$\\s*/, '').startsWith(name)); if (!el) throw new Error('no game ' + name); el.click(); };
window.clickEl = sel => { const el = [...document.querySelectorAll(sel)].find(vis); if (!el) throw new Error('no ' + sel); el.click(); return el; };
window.settle = async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 3000); }))); await w(500); };
`;

// Seed variants: with the round going on (live), without it so the play button opens setup (done)
function variants(seed, extra) {
  const live = structuredClone(seed);
  const done = structuredClone(seed);
  delete done.rounds[done.activeRoundId];
  done.activeRoundId = null;
  // The same round shared, with Jackson keeping the card: this phone watches it (the live money view)
  const watch = structuredClone(seed);
  const r = watch.rounds[watch.activeRoundId];
  r.shared = { code: 'LOGAN7', host: true, since: r.createdAt };
  r.shareCode = 'LOGAN7';
  r.keeper = { id: 'p_jackson', since: r.createdAt, by: watch.me, lastSaveAt: r.createdAt + 25 * 60000 };
  const out = { live, done, watch };
  if (extra) {
    for (const k of ['live', 'done']) out[k + 'Open'] = { ...structuredClone(out[k]), plans: { ...out[k].plans, [extra.open.id]: structuredClone(extra.open) } };
    out.friend = { ...structuredClone(done), plans: { ...done.plans, [extra.friend.id]: structuredClone(extra.friend) } };
  }
  return out;
}

// Each shot: which state it starts from, and the taps on each copy (null: not on that copy)
const SHOTS = [
  { id: 'upnext', state: 'liveOpen', current: 'await home();', new: 'await home();' },
  { id: 'upnext-scrolled', state: 'liveOpen', current: 'await home(); scrollOne(); await w(900);', new: 'await home(); scrollOne(); await w(900);' },
  { id: 'tab', state: 'liveOpen', current: 'await home(); nav("Tab"); await w(1400);', new: 'await home(); nav("Tab"); await w(1400);' },
  { id: 'history', state: 'liveOpen', current: 'await home(); nav("History"); await w(1400);', new: 'await home(); nav("History"); await w(1400);' },
  { id: 'players', state: 'liveOpen', current: 'await home(); nav("Players"); await w(1400);', new: 'await home(); nav("Players"); await w(1400);' },
  { id: 'plan-dated', state: 'liveOpen', current: 'await home(); await openPlan("Nassau"); await w(1400);', new: 'await home(); await openPlan("Nassau"); await w(1400);' },
  { id: 'setup-first-step', state: 'done', current: 'await home(); center(); await w(1400);', new: null },
  { id: 'setup-overview', state: 'done', current: null, new: 'await home(); center(); await w(1400);' },
  { id: 'round-ready', state: 'done', current: 'await home(); await toReady(); await w(1600);', new: 'await home(); await toReady(); await w(1600);' },
  { id: 'scoring', state: 'live', current: 'await toRound(); await w(1400);', new: 'await toRound(); await w(1400);' },
  { id: 'live', state: 'watch', current: 'await toRound(); await w(1400);', new: 'await toRound(); await toLive(); await w(1400);' },
  { id: 'results', state: 'live', current: 'await home(); nav("History"); await w(1200); await openRound("Banker"); await w(1600);', new: 'await home(); nav("History"); await w(1200); await openRound("Banker"); await w(1600);' },
  { id: 'plan-ask', state: 'liveOpen', current: null, new: 'await home(); await toAsk(); await w(1200);' },
  { id: 'plan-open', state: 'liveOpen', current: null, new: 'await home(); await openPlan("Birch Creek"); await w(1400);' },
  { id: 'plan-friend', state: 'friend', current: null, new: 'await home(); await openPlan("Birch Creek"); await w(1400);' },
  { id: 'pad', state: 'live', current: null, new: 'await toRound(); await w(1200); await openPad(); await w(900);' },
];

// The copy-specific journeys the shots share; filled in per copy below
const JOURNEYS = {
  current: `
    window.home = async () => { await w(300); leave(); await w(900); tryTap('Got it'); await w(300); };
    window.openPlan = async t => { const c = [...document.querySelectorAll('.upcoming-card, [class*=plan-card], [class*=upcoming]')].find(e => vis(e) && txt(e).includes(t)); if (!c) throw new Error('no plan card ' + t); c.scrollIntoView({ block: 'center' }); c.click(); };
    window.toRound = async () => { await w(600); const r = document.querySelector('.resume-card'); if (r) { r.click(); await w(1200); } tryTap('Skip for now'); await w(300); };
    window.toLive = async () => { tap('Live'); };
    window.toReady = async () => { center(); await w(1200); pickGame('Skins'); await w(500); tap('Next: Course'); await w(800); tap('Logan River GC'); await w(400); tap('Next: Players'); await w(800); tap('Jackson'); tap('Marcus'); tap('Dev'); await w(400); tap('Next: Bets'); await w(800); tap('Create round'); };
    window.openRound = async t => { const rows = [...document.querySelectorAll('.screen.active .hist-row, .hist-row')].filter(vis); const r = rows.find(e => txt(e).includes(t)) || rows[0]; r.click(); };
  `,
  new: `
    window.home = async () => { await w(300); leave(); await w(900); tryTap('Got it'); await w(300); };
    window.openPlan = async t => { const c = [...document.querySelectorAll('.upcoming-card, [class*=plan-card], [class*=upcoming]')].find(e => vis(e) && txt(e).includes(t)); if (!c) throw new Error('no plan card ' + t); c.scrollIntoView({ block: 'center' }); c.click(); };
    window.toRound = async () => { await w(600); const r = document.querySelector('.resume-card'); if (r) { r.click(); await w(1200); } tryTap('Skip for now'); await w(300); };
    // A watching phone opens on the live money by itself
    window.toLive = async () => {};
    window.toReady = async () => { center(); await w(1200); tap('Pick a game'); await w(900); pickGame('Skins'); await w(500); tap('Next: Course'); await w(800); tap('Logan River GC'); await w(400); tap('Next: Players'); await w(800); tap('Jackson'); tap('Marcus'); tap('Dev'); await w(400); tap('Next: Bets'); await w(800); tap('Next: Look it over'); await w(900); tap('Create round'); };
    window.toAsk = async () => { tap('Get a round going'); };
    window.openPad = async () => { tap('Trevor: another score. Number pad'); };
    window.openRound = async t => { const rows = [...document.querySelectorAll('.screen.active .rc-card, .rc-card')].filter(vis); const r = rows.find(e => txt(e).includes(t)) || rows[0]; r.click(); };
  `,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=2',
  `--user-data-dir=${process.env.TMPDIR || '/tmp'}/review-shots-chrome-${PORT}`, 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function openPage({ theme, state, look, url = BASE, clock = true, storage = null }) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s('Emulation.setTimezoneOverride', { timezoneId: TZ });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  let seedJs = state ? `localStorage.setItem('birdie-bank-v1', ${JSON.stringify(JSON.stringify(state))});` : '';
  for (const [k, v] of Object.entries(storage || {})) seedJs += `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`;
  await s('Page.addScriptToEvaluateOnNewDocument', { source: `${clock ? CLOCK : ''} try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); ${seedJs} localStorage.setItem('bb-look', '${look}'); sessionStorage.setItem('seeded', '1'); } } catch (e) {}` });
  await s('Page.navigate', { url });
  return { s, close: () => send('Target.closeTarget', { targetId }) };
}

async function evaluate(s, body) {
  const r = await s('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text);
  return r.result.value;
}

// Wait for the splash to go and the first screen to be in
async function ready(s) {
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const ok = await evaluate(s, `return !!document.querySelector('#root *') && !document.querySelector('#splash, .splash:not(.gone)') && !document.querySelector('[aria-busy=true]');`).catch(() => false);
    if (ok) break;
  }
  await sleep(1200);
}

try {
  let ver;
  for (let i = 0; i < 40 && !ver; i++) { await sleep(250); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.json()).catch(() => null); }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });

  if (flag('build-seed')) {
    const pg = await openPage({ theme: 'light', state: null, look: LOOK });
    await ready(pg.s);
    const { state, money } = await evaluate(pg.s, `${seedSrc}\n return await buildSeed(${NOW});`);
    fs.mkdirSync(path.dirname(SEED), { recursive: true });
    fs.writeFileSync(SEED, JSON.stringify(state, null, 1));
    const me = state.me;
    for (const [id, bal] of Object.entries(money)) console.log(id, Object.entries(bal).map(([p, v]) => `${state.players[p]?.name}:${v}`).join(' '), me in bal ? '' : '');
    console.log('wrote', path.relative(ROOT, SEED));
    await pg.close();
  } else if (flag('top-set')) {
    // The scoring screen's top: each game's round on screen, then scrolled down a bit
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
    const pg = await openPage({ theme: 'light', state: null, look: LOOK });
    await ready(pg.s);
    const games = await evaluate(pg.s, `${seedSrc}\n return await topRounds(${JSON.stringify(seed)}, ${NOW});`);
    await pg.close();
    games.skins = seed;
    const GAMES = String(flag('games', 'skins,nassau,wolf,banker,vegas')).split(',');
    const out = path.resolve(ROOT, flag('out', 'overnight/review-shots/top-final'));
    fs.mkdirSync(out, { recursive: true });
    for (const g of GAMES) for (const theme of THEMES) {
      const state = structuredClone(games[g]);
      state.settings.theme = theme;
      const pg = await openPage({ theme, state, look: LOOK });
      await ready(pg.s);
      const name = `${g}-${theme}`;
      try {
        await evaluate(pg.s, `${HELPERS} ${JOURNEYS.new} await toRound(); await w(1400); await settle(); return 1;`);
      } catch (e) { console.log(name, 'FAILED', e.message); }
      await sleep(400);
      let { data } = await pg.s('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
      // Scrolled 420px down the hole, to show what stays put
      await evaluate(pg.s, `const el = document.querySelector('.play > .scroll'); if (el) el.scrollTop = 420; await new Promise(r => setTimeout(r, 700)); return 1;`).catch(() => {});
      ({ data } = await pg.s('Page.captureScreenshot', { format: 'png' }));
      fs.writeFileSync(path.join(out, `${name}-scrolled.png`), Buffer.from(data, 'base64'));
      console.log(name);
      await pg.close();
    }
  } else {
    const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
    // The New copy adds the plans only it can show, made with its own code
    let extra = null;
    if (isNew) {
      const pg = await openPage({ theme: 'light', state: null, look: LOOK });
      await ready(pg.s);
      extra = await evaluate(pg.s, `${seedSrc}\n return await newOnlyPlans(${JSON.stringify(seed)}, ${NOW});`).catch(e => { console.log('no-day plans FAILED', e.message); return null; });
      await pg.close();
    }
    const STATES = variants(seed, extra);
    // The watched round's copy on the "server": the local adapter keeps it in localStorage (sync-adapters.js)
    const pg = await openPage({ theme: 'light', state: null, look: LOOK });
    await ready(pg.s);
    const wr = STATES.watch.rounds[STATES.watch.activeRoundId];
    const liveRecord = await evaluate(pg.s, `const M = await import('/src/lib/sync-model.js'); const r = ${JSON.stringify(wr)}; return { meta: M.buildMeta(r), holes: M.buildHoles(r), lock: {} };`);
    await pg.close();
    const STORAGE = { watch: { ['bb-live:' + wr.shared.code]: liveRecord } };
    if (!extra) { STATES.liveOpen = STATES.live; STATES.doneOpen = STATES.done; }
    fs.mkdirSync(OUT, { recursive: true });
    const url = TYPE ? `${BASE}?type=${encodeURIComponent(TYPE)}` : BASE;
    for (const theme of THEMES) for (const shot of SHOTS) {
      const steps = shot[isNew ? 'new' : 'current'];
      if (steps == null) continue;
      if (ONLY && !ONLY.includes(shot.id)) continue;
      if (!STATES[shot.state]) { console.log(shot.id, 'SKIPPED (no state)'); continue; }
      const name = `${shot.id}-${theme}`;
      const state = structuredClone(STATES[shot.state]);
      state.settings.theme = theme;
      const pg = await openPage({ theme, state, look: LOOK, url, storage: STORAGE[shot.state] });
      await ready(pg.s);
      try {
        await evaluate(pg.s, `${HELPERS} ${JOURNEYS[isNew ? 'new' : 'current']} ${steps} await settle(); return 1;`);
      } catch (e) { console.log(name, 'FAILED', e.message); }
      await sleep(400);
      const { data } = await pg.s('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(name);
      await pg.close();
    }
  }
} finally {
  ws?.close();
  chrome.kill();
}
