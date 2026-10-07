import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { registerServiceWorker } from './lib/sw-update.js';

// The art sheet (?art, or the older ?gallery): every drawing in the app on one page, for whoever
// makes the outside set. Its own chunk, so the app's first screen doesn't carry it.
const ArtSheet = lazy(() => import('./screens/ArtSheet.jsx'));
const wantsArt = /[?&](art|gallery)(?=[=&]|$)/.test(location.search);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {wantsArt ? <Suspense fallback={null}><ArtSheet /></Suspense> : <App />}
  </StrictMode>,
);

// A new version waits while a round is going on, then applies at launch or from Up next
if (import.meta.env.PROD) registerServiceWorker();
