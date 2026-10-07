import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import Gallery from './screens/Gallery.jsx';
import { registerServiceWorker } from './lib/sw-update.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('gallery') ? <Gallery /> : <App />}
  </StrictMode>,
);

// A new version waits while a round is going on, then applies at launch or from Up next
if (import.meta.env.PROD) registerServiceWorker();
