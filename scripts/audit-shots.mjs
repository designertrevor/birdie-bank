// Design audit: a screenshot of every screen and state, at 390 by 844 (2x), light and dark.
// Headless Chrome over the DevTools protocol (no packages). Needs the dev server:
//
//   npx vite --port 5193 --strictPort --host 127.0.0.1
//   node scripts/audit-shots.mjs --theme light            # every area
//   node scripts/audit-shots.mjs --theme dark --area home,plan
//   node scripts/audit-shots.mjs --probe 'return listButtons()' --state live
//
// Shots land in overnight/audit-shots/<area>/<screen>-<state>-<light|dark>.png, with a manifest per
// area and theme (_manifest-<theme>.json) that scripts/audit-sheets.py turns into INDEX.md and the
// contact sheets. Starts from the review seed (overnight/review-shots/seed-state.json, see that
// README) on its fixed clock (Mon 26 Oct 2026, 5:40 pm in Denver). Motion is on; each shot waits for
// fonts, images and about 1.2 s so entrances finish. The shot list is in scripts/audit-list.mjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (k, d = null) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = flag('base', 'http://127.0.0.1:5193/');
const THEME = flag('theme', 'light');
const AREAS = flag('area') ? String(flag('area')).split(',') : null;
const ONLY = flag('only') ? String(flag('only')).split(',') : null;
const OUT = path.resolve(ROOT, flag('out', 'overnight/audit-shots'));
const NOW = Date.parse('2026-10-26T17:40:00-06:00');
const TZ = 'America/Denver';
const PORT = 9400 + Math.floor(Math.random() * 90);
const VW = 390, VH = 844;

const seedSrc = fs.readFileSync(new URL('./review-seed.js', import.meta.url), 'utf8').replace(/^export /gm, '');

const CLOCK = `(() => { const D = Date, t0 = D.now(), F = ${NOW}; const now = () => F + (D.now() - t0);
  class FakeDate extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } }
  FakeDate.parse = D.parse; FakeDate.UTC = D.UTC; window.Date = FakeDate; })();`;

// In-page helpers, put on window once per page
export const HELPERS = `
window.w = (ms = 800) => new Promise(r => setTimeout(r, ms));
window.vis = b => !!(b && (b.offsetParent || b.getClientRects().length) && getComputedStyle(b).visibility !== 'hidden');
window.txt = b => (b.innerText || b.textContent || '').trim().replace(/\\s+/g, ' ');
// The screen on stage now (not one leaving)
window.stageEl = () => [...document.querySelectorAll('.stage')].filter(e => !/\\bout-/.test(e.className) && !e.classList.contains('under')).pop() || document;
window.find = (t, sel = 'button, [role=button], [role=radio], [role=checkbox], [role=tab], a, summary, label') => {
  const all = [...document.querySelectorAll(sel)].filter(vis).filter(b => !b.closest('.stage.under, [class*="stage out-"]')).reverse();
  const lab = b => b.getAttribute('aria-label') || '';
  return all.find(b => txt(b) === t || lab(b) === t) || all.find(b => txt(b).startsWith(t) || lab(b).startsWith(t)) || all.find(b => txt(b).includes(t) || lab(b).includes(t));
};
window.tap = (t, sel) => { const b = typeof t === 'string' ? find(t, sel) : t; if (!b) throw new Error('no button ' + t); b.scrollIntoView({ block: 'center' }); b.click(); return b; };
window.tryTap = (t, sel) => { try { return tap(t, sel); } catch { return null; } };
window.el = (sel, t) => [...document.querySelectorAll(sel)].filter(vis).find(e => !t || txt(e).includes(t));
window.clickEl = (sel, t) => { const e = el(sel, t); if (!e) throw new Error('no ' + sel + ' ' + (t || '')); e.scrollIntoView({ block: 'center' }); e.click(); return e; };
window.typeIn = (sel, v) => { const i = typeof sel === 'string' ? el(sel) : sel; if (!i) throw new Error('no input ' + sel); const set = Object.getOwnPropertyDescriptor(i.constructor.prototype, 'value').set; i.focus(); set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); return i; };
window.leave = () => { const b = [...document.querySelectorAll('button')].find(b => vis(b) && (b.getAttribute('aria-label') || '').startsWith('Leave round')); if (b) b.click(); return !!b; };
window.navApi = async () => {
  const { NavCtx } = await import('/src/lib/nav.js');
  const root = document.getElementById('root');
  const k = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  const stack = [root[k]];
  while (stack.length) { const f = stack.pop(); if (!f) continue; if ((f.type === NavCtx || f.type?._context === NavCtx) && f.memoizedProps?.value) return f.memoizedProps.value; if (f.sibling) stack.push(f.sibling); if (f.child) stack.push(f.child); }
  throw new Error('no nav');
};
window.go = async (name, params = {}) => { (await navApi()).push(name, params); await w(1300); };
window.tabTo = async t => { (await navApi()).setTab(t); await w(1300); };
window.store = () => import('/src/lib/store.js');
window.mut = async fn => { (await store()).update(fn); await w(400); };
window.scroller = () => {
  const ok = e => vis(e) && e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY);
  const sheets = [...document.querySelectorAll('.sheet, [role=dialog]')].filter(vis);
  for (const s of sheets.reverse()) { const inner = [s, ...s.querySelectorAll('*')].filter(ok); if (inner.length) return inner[0]; if (sheets.length) return null; }
  const st = stageEl();
  const el = [...st.querySelectorAll('.scroll, .screen, main, [class*=scroll]')].find(ok);
  return el || (document.scrollingElement.scrollHeight > innerHeight + 4 ? document.scrollingElement : null);
};
window.scrollInfo = () => { const e = scroller(); return e ? { h: e.scrollHeight, c: e.clientHeight, t: e.scrollTop } : null; };
window.scrollBy1 = () => { const e = scroller(); if (e) e.scrollTop += e.clientHeight; };
window.scrollBottom = () => { const e = scroller(); if (e) e.scrollTop = e.scrollHeight; };
window.scrollTopNow = () => { const e = scroller(); if (e) e.scrollTop = 0; };
window.settle = async (ms = 1200) => { await document.fonts.ready; await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 3000); }))); await w(ms); };
window.pickGame = name => { const e = [...document.querySelectorAll('.game-tile, .game-row, [class*=game-]')].filter(vis).filter(e => !e.closest('.stage.under, [class*="stage out-"]')).find(e => (e.getAttribute('aria-label') || '').startsWith(name + ':') || txt(e).replace(/^\\$\\s*/, '').startsWith(name)); if (!e) throw new Error('no game ' + name); e.scrollIntoView({ block: 'center' }); e.click(); return e; };
window.listButtons = () => [...document.querySelectorAll('button, [role=button], a, [role=radio], [role=tab], input, select, textarea')].filter(vis).filter(b => !b.closest('.stage.under, [class*="stage out-"]')).map(b => (b.tagName.toLowerCase() + (b.className ? '.' + String(b.className).split(' ').slice(0, 2).join('.') : '') + ': ' + (txt(b).slice(0, 60) || '') + (b.getAttribute('aria-label') ? ' [' + b.getAttribute('aria-label').slice(0, 60) + ']' : '')));
window.heads = () => [...document.querySelectorAll('h1, h2, h3, .eyebrow, .sheet-title')].filter(vis).map(txt).slice(0, 30);
window.place = async (tab, stack) => { const { PLACE_KEY } = await import('/src/lib/place.js'); localStorage.setItem(PLACE_KEY, JSON.stringify({ at: Date.now(), tab, stack: stack.map(([name, params = {}], i) => ({ name, params, key: 1000 + i })), kept: {}, maps: {} })); };
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

const manifest = {}; // area -> [{ file, what }]
const notes = {}; // area -> [string]
function record(area, file, what) { (manifest[area] ||= []).push({ file, what }); }
export function note(area, what) { (notes[area] ||= []).push(what); console.log('  NOTE', area, what); }

// For builders: mkRound(s, opts) makes a round inside S.update(s => ...), like the review seed's play()
const BUILD_LIB = `
const R = await import('/src/lib/round.js'); const C = await import('/src/lib/courses.js'); const AV = await import('/src/lib/avatars.js');
const DAY = 86400000;
const mkRound = (s, o) => {
  const c = C.findCourse(s, o.courseId || 'logan-river');
  const players = o.pids.map(pid => ({ ...s.players[pid], tee: c.tees?.[Math.min(2, c.tees.length - 1)]?.name }));
  const r = R.createRound({ id: o.id, game: o.game, course: c, holesCount: o.holesCount || 18, nine: 'front', players, settings: s.settings, hcPct: 100, useHandicaps: o.useHandicaps ?? true, teams: o.teams || null });
  r.createdAt = Date.now() - (o.daysAgo || 0) * DAY - 3 * 3600000;
  const n = o.holesScored ?? 0;
  for (let i = 0; i < n; i++) {
    const h = r.holes[i];
    if (o.game === 'banker') r.banker[h.no] = R.bankerHoleSetup(r, i);
    if (o.game === 'wolf') { const wf = R.wolfFor(r, i); const others = o.pids.filter(p => p !== wf); r.wolf[h.no] = { wolf: wf, partner: others[i % others.length] }; }
    r.scores[h.no] = Object.fromEntries(o.pids.map((pid, k) => [pid, o.score ? o.score(k, i, h) : h.par + ((k * 2 + i) % 3) - 1]));
    r.marks[h.no] = {};
  }
  if (o.playFor) r.playFor = o.playFor;
  if (o.done) { r.status = 'done'; r.current = r.holes.length - 1; r.finishedAt = r.createdAt + 4.5 * 3600000; }
  else r.current = o.current ?? n;
  AV.stampAvatars(s, r);
  s.rounds[o.id] = r;
  if (!o.done && !o.keepActive) s.activeRoundId = o.id;
  return r;
};
`;

/**
 * A page at 390 by 844 on the fixed clock, with `state` as the app's saved state (null: a brand new
 * phone), `storage` more localStorage keys, `place` a [tab, [[screen, params], ...]] to open on.
 */
async function openPage({ theme = THEME, state = null, storage = null, url = BASE, reduced = false, place = null, area = 'misc', install = false }) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
  await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s('Emulation.setTimezoneOverride', { timezoneId: TZ });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  if (state) { state = structuredClone(state); state.settings = { ...state.settings, theme }; }
  let seedJs = state ? `localStorage.setItem('birdie-bank-v1', ${JSON.stringify(JSON.stringify(state))});` : '';
  // The Add to Home Screen card is put away unless a shot asks for it (install: true), so it doesn't sit on top of every Up next
  if (!install) seedJs += `localStorage.setItem('bb-install', ${JSON.stringify(JSON.stringify({ done: true }))});`;
  for (const [k, v] of Object.entries(storage || {})) seedJs += `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(typeof v === 'string' ? v : JSON.stringify(v))});`;
  if (place) {
    const [tab, stack] = place;
    const p = { at: NOW - 1000, tab, stack: stack.map(([name, params = {}], i) => ({ name, params, key: 1000 + i })), kept: {}, maps: {} };
    seedJs += `localStorage.setItem('kept-place', ${JSON.stringify(JSON.stringify(p))});`;
  }
  // Seeds once per tab: a reload keeps what the app saved since
  await s('Page.addScriptToEvaluateOnNewDocument', { source: `${CLOCK} try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('bb-look', 'new'); ${seedJs} sessionStorage.setItem('seeded', '1'); } } catch (e) {}` });
  await s('Page.navigate', { url });
  const pg = {
    s, area, theme,
    close: () => send('Target.closeTarget', { targetId }),
    async js(body) {
      const r = await s('Runtime.evaluate', { expression: `(async () => { if (!window.__h) { ${HELPERS}; window.__h = 1; } ${body} })()`, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text);
      return r.result.value;
    },
    async ready() {
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        const ok = await pg.js(`return !!document.querySelector('#root *') && !document.querySelector('[aria-busy=true]');`).catch(() => false);
        if (ok) break;
      }
      await pg.js('await settle(1200);').catch(() => {});
    },
    async reload() { await s('Page.reload', {}); await pg.ready(); },
    /** Save the viewport as <area>/<id>-<theme>.png */
    async snap(id, what) {
      const file = `${id}-${theme}.png`;
      const { data } = await s('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.join(OUT, area), { recursive: true });
      fs.writeFileSync(path.join(OUT, area, file), Buffer.from(data, 'base64'));
      record(area, file, what);
      console.log('  ', area + '/' + file);
    },
    /** Settle, shoot, then (when taller than the phone) one viewport down and the bottom */
    async shoot(id, what, { settle = 1200, scroll = true, all = false } = {}) {
      await pg.js(`await settle(${settle});`).catch(() => {});
      await pg.snap(id, what);
      if (!scroll) return;
      const info = await pg.js('return scrollInfo();').catch(() => null);
      if (!info || info.h <= info.c + 8) return;
      if (all) {
        // Every viewport down to the bottom, numbered
        for (let k = 1; k < 200; k++) {
          const at = await pg.js(`const e = scroller(); e.scrollTop = ${k} * Math.round(e.clientHeight * 0.92); await w(500); return { t: e.scrollTop, end: e.scrollTop + e.clientHeight >= e.scrollHeight - 2 };`);
          await pg.snap(`${id}-p${String(k + 1).padStart(2, '0')}`, `${what}, viewport ${k + 1}`);
          if (at.end) break;
        }
        await pg.js('scrollTopNow(); await w(300);');
        return;
      }
      await pg.js('scrollBy1(); await w(700);');
      await pg.snap(`${id}-scrolled`, `${what}, scrolled one viewport down`);
      if (info.h > info.c * 2 + 8) {
        await pg.js('scrollBottom(); await w(700);');
        await pg.snap(`${id}-bottom`, `${what}, scrolled to the bottom`);
      }
      await pg.js('scrollTopNow(); await w(300);');
    },
  };
  return pg;
}

// Seed states
function baseStates(seed, extra) {
  const S = {};
  S.live = structuredClone(seed);
  S.done = structuredClone(seed);
  delete S.done.rounds[S.done.activeRoundId];
  S.done.activeRoundId = null;
  if (extra) {
    for (const k of ['live', 'done']) S[k + 'Open'] = { ...structuredClone(S[k]), plans: { ...S[k].plans, [extra.open.id]: structuredClone(extra.open) } };
    S.friend = { ...structuredClone(S.done), plans: { ...S.done.plans, [extra.friend.id]: structuredClone(extra.friend) } };
    // Riley's phone: she is this phone's "me", with her own face, so her seat shows hers and Trevor's the one his plan carried
    S.friend.me = 'p_riley';
    S.friend.profile = { ...S.friend.profile, avatar: S.friend.players.p_riley?.avatar };
  }
  const watch = structuredClone(seed);
  const r = watch.rounds[watch.activeRoundId];
  r.shared = { code: 'LOGAN7', host: true, since: r.createdAt };
  r.shareCode = 'LOGAN7';
  r.keeper = { id: 'p_jackson', since: r.createdAt, by: watch.me, lastSaveAt: r.createdAt + 25 * 60000 };
  S.watch = watch;
  return S;
}

async function main() {
  let ver;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--user-data-dir=${process.env.TMPDIR || '/tmp'}/audit-shots-chrome-${PORT}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 40 && !ver; i++) { await sleep(250); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.json()).catch(() => null); }
    ws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    });

    const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'overnight/review-shots/seed-state.json'), 'utf8'));
    const pg0 = await openPage({ state: null });
    await pg0.ready();
    const extra = await pg0.js(`${seedSrc}\n return await newOnlyPlans(${JSON.stringify(seed)}, ${NOW});`);
    const wr = baseStates(seed).watch.rounds.r_live;
    const liveRecord = await pg0.js(`const M = await import('/src/lib/sync-model.js'); const r = ${JSON.stringify(wr)}; return { meta: M.buildMeta(r), holes: M.buildHoles(r), lock: {} };`);
    await pg0.close();
    const STATES = baseStates(seed, extra);
    const memos = new Map();
    const ctx = {
      NOW, seed, STATES, extra, liveRecord, note, seedSrc, BASE,
      /** Build once per run */
      memo(key, fn) { if (!memos.has(key)) memos.set(key, fn()); return memos.get(key); },
      open: o => openPage(o),
      /** Build a state in a page: `body` gets the store loaded with `from` and returns nothing; the result is the saved state */
      async build(from, body) {
        const p = await openPage({ state: from });
        await p.ready();
        try {
          return await p.js(`const S = await store(); ${BUILD_LIB} ${body}; await w(300); return JSON.parse(localStorage.getItem('birdie-bank-v1'));`);
        } finally { await p.close(); }
      },
    };

    if (flag('probe')) {
      const st = flag('state') ? STATES[flag('state')] : null;
      const plc = flag('place') ? JSON.parse(flag('place')) : null;
      const p = await openPage({ state: st, place: plc, url: flag('url') ? BASE + flag('url') : BASE });
      await p.ready();
      console.log(JSON.stringify(await p.js(`try { ${flag('probe')} } catch (e) { return { error: e.message, h: heads(), b: listButtons() }; }`), null, 1));
      if (flag('snap')) { const { data } = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(flag('snap'), Buffer.from(data, 'base64')); }
      await p.close();
      return;
    }

    const { SHOTS } = await import(new URL('./audit-list.mjs', import.meta.url) + `?t=${Date.now()}`);
    for (const shot of SHOTS) {
      if (AREAS && !AREAS.includes(shot.area)) continue;
      if (ONLY && !ONLY.includes(shot.id)) continue;
      if (shot.themes && !shot.themes.includes(THEME)) continue;
      console.log(shot.area, shot.id);
      let p = null;
      try {
        const opts = typeof shot.page === 'function' ? await shot.page(ctx) : (shot.page || {});
        p = await openPage({ area: shot.area, ...opts });
        await p.ready();
        await shot.run(p, ctx);
      } catch (e) {
        console.log('  FAILED', shot.area, shot.id, e.message);
        note(shot.area, `${shot.id}: failed (${e.message})`);
        if (p) {
          try { const { data } = await p.s('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.join(OUT, '_failed'), { recursive: true }); fs.writeFileSync(path.join(OUT, '_failed', `${shot.area}-${shot.id}-${THEME}.png`), Buffer.from(data, 'base64')); } catch { /* ignore */ }
        }
      } finally { await p?.close().catch(() => {}); }
    }
    for (const area of new Set([...Object.keys(manifest), ...Object.keys(notes)])) {
      const f = path.join(OUT, area, `_manifest-${THEME}.json`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      // Merge with what an earlier run of other shots in this area wrote
      let old = { shots: [], notes: [] };
      try { old = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* first run */ }
      const files = new Set((manifest[area] || []).map(m => m.file));
      const ran = new Set(SHOTS.filter(s => s.area === area && (!ONLY || ONLY.includes(s.id))).map(s => s.id));
      const shots = [...old.shots.filter(m => !files.has(m.file)), ...(manifest[area] || [])];
      const keptNotes = old.notes.filter(n => !ran.has(n.split(':')[0]));
      fs.writeFileSync(f, JSON.stringify({ shots, notes: [...keptNotes, ...(notes[area] || [])] }, null, 1));
    }
  } finally {
    ws?.close();
    chrome.kill();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
