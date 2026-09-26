// Offline support.
// - Install: save the whole built app (every JS/CSS chunk, icons, the page itself) plus the
//   Google Fonts and Phosphor icon stylesheets and their font files, so the app works with
//   no signal from the first launch after it was opened once, including screens not yet seen.
// - The app page: network first, but fall back to the saved copy after a few seconds, so
//   one bar of signal on the course doesn't leave a blank screen.
// - Everything else: cache first (built files are content hashed; fonts and icons are versioned).
// The build (vite.config.js) replaces the PRECACHE block below with the real file list.
const PRECACHE = /* bb-precache */ { version: 'dev', app: ['/', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png'], external: [] } /* /bb-precache */;
const APP = `birdie-bank-app-${PRECACHE.version}`;
const RUNTIME = 'birdie-bank-runtime';
const PAGE_TIMEOUT = 3500;

const CDN = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/;

/** Save a stylesheet and the font files it points at (Latin subsets only for Google Fonts). */
async function cacheStylesheet(cache, href) {
  const res = await fetch(href, { mode: 'cors' });
  if (!res.ok) return;
  const css = await res.clone().text();
  await cache.put(href, res);
  const google = new URL(href).host === 'fonts.googleapis.com';
  const blocks = css.split('@font-face');
  const urls = new Set();
  blocks.forEach((block, i) => {
    if (!i) return;
    // Google labels each block with a subset comment at the end of the previous one
    const label = blocks[i - 1].match(/\/\*\s*([\w-]+)\s*\*\/\s*$/)?.[1];
    if (google && label && !/^latin(-ext)?$/.test(label)) return;
    // The first source is the one browsers use (woff2); skip the older fallbacks
    const m = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
    if (m) urls.add(new URL(m[1], href).href);
  });
  await Promise.all([...urls].map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && cache.put(u, r)).catch(() => {})));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const app = await caches.open(APP);
    await app.addAll(PRECACHE.app.map(u => new Request(u, { cache: 'reload' })));
    // Fonts and icons are nice to have: never fail the install over them
    const runtime = await caches.open(RUNTIME);
    await Promise.all(PRECACHE.external.map(href => runtime.match(href, { ignoreVary: true }).then(hit => hit || cacheStylesheet(runtime, href)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== APP && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** Network first with a time limit; falls back to the saved copy (and keeps waiting if there is none). */
function pageFromNetwork(req, key) {
  return new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done && res) { done = true; resolve(res); } return res; };
    const fromCache = () => caches.match(key).then(finish);
    const timer = setTimeout(fromCache, PAGE_TIMEOUT);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(key, copy)); }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(hit => { if (!hit) finish(Response.error()); });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data (course search) always goes to the network; the app keeps what it needs itself
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Only the app itself is the offline copy; plain pages like /privacy.html cache under their own path
    const key = url.pathname.endsWith('.html') ? url.pathname : '/';
    e.respondWith(pageFromNetwork(req, key));
    return;
  }
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !CDN.test(url.host)) return; // Supabase and anything else goes straight to the network
  e.respondWith(caches.match(req, { ignoreVary: !sameOrigin }).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
    return res;
  })));
});
