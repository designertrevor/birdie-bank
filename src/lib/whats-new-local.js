// This phone's What's new record (whats-new.js): which shipped items it has already shown.
// Kept beside the roadmap's own record, on this phone only.
import { cleanSeen } from './whats-new.js';

const KEY = 'bb-whats-new';

export function loadSeen() {
  try { return cleanSeen(JSON.parse(localStorage.getItem(KEY))); } catch { return cleanSeen(null); }
}

export function saveSeen(record) {
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* storage full or blocked */ }
}
