import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { registerServiceWorker } from './lib/sw-update.js';
import { opsAfterPaint, opsAtLaunch } from './lib/ops.js';
// Listening from the start for Android's install prompt, which fires once, early (install-prompt.js)
import './lib/install-prompt.js';

// Before anything renders: keep a creator's ?ref= code before the app tidies the address, and
// catch errors from the start (ops.js; each part is off without its key)
opsAtLaunch();

// The art sheet (?art, or the older ?gallery): every drawing in the app on one page, for whoever
// makes the outside set. Its own chunk, so the app's first screen doesn't carry it.
const ArtSheet = lazy(() => import('./screens/ArtSheet.jsx'));
const wantsArt = /[?&](art|gallery)(?=[=&]|$)/.test(location.search);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {wantsArt ? <Suspense fallback={null}><ArtSheet /></Suspense> : <App />}
  </StrictMode>,
);

// The splash (index.html) stays until the first real screen is in: a screen that's still loading
// its code (aria-busy) keeps it up. It fades, then goes. Ten seconds at most, whatever happens.
function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const root = document.getElementById('root');
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    mo.disconnect();
    clearTimeout(cap);
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 300);
  };
  const ready = () => wantsArt ? root.childElementCount > 0
    : !!root.querySelector('.screen.active') && !root.querySelector('[aria-busy="true"]');
  const mo = new MutationObserver(() => { if (ready()) requestAnimationFrame(go); });
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'class'] });
  const cap = setTimeout(go, 10000);
  if (ready()) requestAnimationFrame(go);
}
hideSplash();

// Crash reports and usage counts load once the first screen is up, never ahead of it
if ('requestIdleCallback' in window) requestIdleCallback(opsAfterPaint, { timeout: 4000 });
else setTimeout(opsAfterPaint, 2000);

// A new version waits while a round is going on, then applies at launch or from Up next
if (import.meta.env.PROD) registerServiceWorker();
