// Offline support: network-first for the app page, cache-first for everything else
// (built assets are content-hashed; fonts and icons come from CDNs).
const CACHE = 'birdie-bank-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data (course search) always goes to the network; the app keeps what it needs itself
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Only the app itself is the offline copy; plain pages like /privacy.html cache under their own path
    const key = url.pathname.endsWith('.html') ? req : '/';
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); return res; }).catch(() => caches.match(key)));
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
