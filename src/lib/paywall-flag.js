// Whether the paywall shows on this phone. Read once at startup; see readFlag in paywall.js.
import { readFlag } from './paywall.js';

const KEY = 'bb-paywall';

function read() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
  const search = typeof location !== 'undefined' ? location.search : '';
  const { on, remember } = readFlag({ env, search, saved });
  if (remember) { try { localStorage.setItem(KEY, remember); } catch { /* storage blocked */ } }
  return on;
}

export const PAYWALL_ON = read();
