import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { registerServiceWorker } from './lib/sw-update.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// A new version waits while a round is going on, then applies at launch or from Up next
if (import.meta.env.PROD) registerServiceWorker();
