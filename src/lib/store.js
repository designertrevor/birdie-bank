// App state: a single object persisted to localStorage, exposed through a tiny
// subscribe/getSnapshot store so React can read it with useSyncExternalStore.
import { useSyncExternalStore } from 'react';

// Dev only: ?profile=b gives a tab its own data, to test shared rounds as two "phones"
function profileSuffix() {
  if (!import.meta.env.DEV || typeof location === 'undefined') return '';
  const q = new URLSearchParams(location.search).get('profile');
  if (q) sessionStorage.setItem('bb-profile', q);
  const p = sessionStorage.getItem('bb-profile');
  return p ? `:${p}` : '';
}
const KEY = 'birdie-bank-v1' + profileSuffix();
const VERSION = 1;

export const DEFAULT_SETTINGS = {
  theme: 'system',   // 'system' | 'light' | 'dark'
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
};

function fresh() {
  return {
    version: VERSION,
    onboarded: false,
    me: null,
    players: {},
    crews: {},
    customCourses: {},
    favorites: [],
    rounds: {},
    activeRoundId: null,
    settlements: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    const base = fresh();
    // Shallow-merge so newly added keys get defaults
    return {
      ...base, ...data,
      settings: {
        ...base.settings, ...data.settings,
        banker: { ...base.settings.banker, ...data.settings?.banker },
        nassau: { ...base.settings.nassau, ...data.settings?.nassau },
        skins: { ...base.settings.skins, ...data.settings?.skins },
        wolf: { ...base.settings.wolf, ...data.settings?.wolf },
      },
    };
  } catch {
    return fresh();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export function getState() { return state; }

/** Immutable-ish update: fn receives a draft copy and may mutate it. */
export function update(fn) {
  const draft = structuredClone(state);
  fn(draft);
  state = draft;
  persist();
  listeners.forEach(l => l());
}

export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }

export function useStore(selector = s => s) {
  return selector(useSyncExternalStore(subscribe, getState, getState));
}

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function resetAll() {
  state = fresh();
  persist();
  listeners.forEach(l => l());
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.players) throw new Error('Not a Birdie Bank backup');
  state = { ...fresh(), ...data };
  persist();
  listeners.forEach(l => l());
}
