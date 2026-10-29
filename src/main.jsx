import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './look.css';
import './look-new.css';
import './look-gooddog.css';
import App from './App.jsx';
import { registerServiceWorker, reloadPending, updateBehindSplash } from './lib/sw-update.js';
import { opsAfterPaint, opsAtLaunch } from './lib/ops.js';
// Listening from the start for Android's install prompt, which fires once, early (install-prompt.js)
import './lib/install-prompt.js';

// The overhaul look is on unless this phone asked for the classic one (?look=classic, undone with
// ?look=new), set before the first render so nothing paints in the wrong type (look.css)
// The Good Dog trial (?look=gooddog, kept the same way) is the overhaul look with Good Dog's palette,
// bands, edges and drawings on top: <html data-look="new" data-skin="gooddog"> (look-gooddog.css)
try {
  const pick = (location.search.match(/[?&]look=(new|classic|gooddog)/) || [])[1];
  if (pick) localStorage.setItem('bb-look', pick);
  const look = pick || localStorage.getItem('bb-look');
  document.documentElement.dataset.look = look === 'classic' ? 'classic' : 'new';
  if (look === 'gooddog') {
    document.documentElement.dataset.skin = 'gooddog';
    import('./components/GdArtDraw.jsx').catch(() => {});
  }
  // The runner-up type pairing on the new look, to compare: ?type=inter (Fraunces 400 and Inter, the
  // serif experiment's), undone with ?type=figtree; kept on this phone like the look (look-new.css)
  const type = (location.search.match(/[?&]type=(figtree|inter)/) || [])[1];
  if (type) localStorage.setItem('bb-type', type);
  if ((type || localStorage.getItem('bb-type')) === 'inter') document.documentElement.dataset.type = 'inter';
} catch { document.documentElement.dataset.look = 'new'; }
// The new look's thin icons: Phosphor regular, fetched only when the new look is on (look-new.css
// maps the bold class onto it, outside Play)
if (document.documentElement.dataset.look === 'new') {
  const thin = document.createElement('link');
  thin.rel = 'stylesheet';
  thin.href = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css';
  document.head.appendChild(thin);
}

// Before anything renders: keep a creator's ?ref= code before the app tidies the address, and
// catch errors from the start (ops.js; each part is off without its key)
opsAtLaunch();

// A new version that downloaded last time swaps in now, behind the splash, so the first screen is
// the new one and the page never reloads in front of you (sw-update.js). Resolves at once in dev.
const launchUpdate = updateBehindSplash();

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
// its code (aria-busy) keeps it up, and so does a new version swapping in (the page reloads behind
// it, and the splash is simply there again). It fades, then goes. Ten seconds at most, whatever happens.
function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const root = document.getElementById('root');
  let done = false;
  // Up until the launch update check has answered, and for good once a reload is on its way
  let held = true;
  const go = () => {
    if (done) return;
    done = true;
    mo.disconnect();
    clearTimeout(cap);
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 300);
  };
  const ready = () => !held && !reloadPending() && (wantsArt ? root.childElementCount > 0
    : !!root.querySelector('.screen.active') && !root.querySelector('[aria-busy="true"]'));
  // After the next paint, or a beat later in a tab the browser isn't painting (opened in the background)
  const soon = () => { requestAnimationFrame(go); setTimeout(go, 200); };
  const mo = new MutationObserver(() => { if (ready()) soon(); });
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'class'] });
  let cap = setTimeout(go, 10000);
  launchUpdate.then(reloading => {
    if (reloading) {
      // The reload is a moment away; if it never comes (a worker that won't take over), carry on
      clearTimeout(cap);
      cap = setTimeout(go, 6000);
      return;
    }
    held = false;
    if (ready()) soon();
  });
}
hideSplash();

// Crash reports and usage counts load once the first screen is up, never ahead of it
if ('requestIdleCallback' in window) requestIdleCallback(opsAfterPaint, { timeout: 4000 });
else setTimeout(opsAfterPaint, 2000);

// A new version waits while a round is going on, then applies at launch or from Up next
if (import.meta.env.PROD) registerServiceWorker();
