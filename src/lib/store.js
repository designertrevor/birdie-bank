// App state: a single object persisted to localStorage, exposed through a tiny
// subscribe/getSnapshot store so React can read it with useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import { migrateSettings, REV2_DEFAULTS, SETTINGS_REV, SNAKE_CAP_DEFAULT, TEAM_DEFAULTS } from './settings.js';

// Dev only: ?profile=b gives a tab its own data, to test shared rounds as two "phones"
function profileSuffix() {
  if (!import.meta.env.DEV || typeof location === 'undefined') return '';
  const q = new URLSearchParams(location.search).get('profile');
  if (q) sessionStorage.setItem('bb-profile', q);
  const p = sessionStorage.getItem('bb-profile');
  return p ? `:${p}` : '';
}
const KEY = 'birdie-bank-v1' + profileSuffix();
/** Where the app state lives in localStorage (per dev profile). */
export const STORE_KEY = KEY;
const VERSION = 1;

export const DEFAULT_SETTINGS = {
  theme: 'system',   // 'system' | 'light' | 'dark'
  hcPct: 100,
  shareAmounts: false, // results image shows dollar amounts (off until you turn it on, then remembered)
  betPrompt: true,     // "Any side bets on this hole?" on the Play screen (see bet-prompt.js); personal, never a round's
  callouts: true,      // callouts for the group text on Up next (see callouts.js); off from the card or Settings
  nudgeDays: 7,        // suggest a friendly payment reminder on Up next once someone has owed you this many days; 0 is Off (see nudges.js)
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off', par3Triple: false },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2, turnPress: false, noLastPress: false, teamScore: 'best' },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void', backDouble: false },
  // Blind wolf (off for a new setup): the wolf can go lone before anyone tees off, for one or two
  // more than a lone wolf (blindPlus, see blindMultiplierOf in round.js).
  // House rules added 2026-10-03 (one more per game, and three for Quota) start off too; see house-rules.js.
  // House rules added 2026-09-30 all start off, so rounds and defaults from before play the same:
  // wolf and aces ties carry, Vegas birdies double, Sixes halved matches carry (see round.js)
  wolf: { point: 2, loneMultiplier: 2, blind: false, blindPlus: 1 }, // carry (ties carry) and lastWolf are off when unset
  match: { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best' },
  hammer: { stake: 5, max: 3, who: 'either', birdie: false },
  vegas: { point: 1, birdieFlip: true, birdieDouble: false, daytona: false },
  sixes: { stake: 5, mode: 'match', carry: false, teamScore: 'best' },
  scramble: { stake: 5, drives: 0, second: false }, // drives: the minimum each player's drive is used, 0 for none
  // The team games (2026-10-03, see TEAM_DEFAULTS in settings.js and round.js)
  ...structuredClone(TEAM_DEFAULTS),
  stroke: { stake: 5, payout: 'pot', cap: false, nassau: false }, // cap: net double bogey is the most a hole costs
  stableford: { ...REV2_DEFAULTS.stableford, nassau: false },
  quota: { ...REV2_DEFAULTS.quota, nassau: false, minus: false, split: 'top' },
  nines: { point: 1, sweep: false, birdie: false }, // sweep: win a hole by 2 and take all nine; birdie: 7-1-1
  aces: { ace: 2, deuce: 1, carry: false },
  bbb: { value: 1, sweep: false, netBongo: false }, // sweep: all three points on a hole count double
  dots: { value: 1, auto: true, greenieCarry: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: false } },
  rabbit: { ...REV2_DEFAULTS.rabbit, sixes: false },
  snake: { stake: 5, growth: 'flat', nines: false, cap: SNAKE_CAP_DEFAULT, fourPutt: false }, // cap: most doubles, 0 for none
  // Birdie pot, a side game only: each player puts in the stake; a net eagle or better is 2 shares
  birdies: { stake: 5, eagleShares: 2 },
  // Closest to the pin and long drive pots, side games only: each player puts in the stake, and a
  // hole nobody wins carries to the next pot hole ('carry') or is split across the holes won ('split').
  // Long drive's holes are picked for each round (none picked: every par 5, see potHoles in round.js)
  ctp: { stake: 5, unclaimed: 'carry' },
  drive: { stake: 5, unclaimed: 'carry' },
  rev: SETTINGS_REV,
};

function fresh() {
  return {
    version: VERSION,
    onboarded: false,
    me: null,
    players: {},
    crews: {},
    customCourses: {},
    favorites: [],     // courses picked lately, newest first (the picker's fallback for Recently played)
    starredCourses: [], // courses you starred to keep at the top of the picker, synced in the profile
    rounds: {},
    activeRoundId: null,
    settlements: [],
    carries: [],       // carry-overs between two people (see carry.js)
    tabRows: {},       // this phone's copy of the shared Tab rows, for who's square (see shared-tab.js)
    plans: {},         // upcoming rounds (see plans.js)
    challenges: {},    // challenges made or answered on this phone (see challenges.js)
    trips: {},         // golf trips this phone made: name, dates, who's going, "done playing" (see trips.js)
    tripHidden: {},    // trips you hid from the Tab and Up next: { tripId: when }, synced in the profile
    tripPlans: {},     // the organizer's published plan for each trip, from the server (see trip-plan.js)
    tripPlanSeen: {},  // the plan version you last saw for each trip, for "Updated" (this phone only)
    tripExpenses: {},  // trip expenses, yours and friends': { id: expense } (see trip-expenses.js), synced in the profile
    cupRemote: {},     // a team points trip's matches and stake marks from the server, by trip and row (see cup-sync.js)
    cupPaid: {},       // the stake payments you marked for each team points trip (see cup.js), synced in the profile
    usuals: [],        // saved "usual" setups, at most 5 (see usuals.js); an array, so never inside settings
    links: {},         // "Same person as...": { aliasId: keptId } (see people-links.js)
    unlinks: [],       // "Not the same person": [[a, b]] pairs that stay apart (see people-links.js)
    rewardsDone: {},   // reward lines marked done on this phone, "roundId:from>to" -> time (see play-for.js)
    recapSeen: {},     // day-after recaps put away on this phone: { roundId: when } (see recap.js)
    profile: {},       // your own profile beyond your player card: avatar, home course, privacy (see profile-model.js)
    accountOf: {},     // which account each player id is, from the server: { playerId: accountId } (see profiles.js)
    profiles: {},      // profiles of people you've played with, by account: { accountId: profile } (see profiles.js)
    betPrompts: {},    // rounds whose "Any side bets?" card was answered on this phone: { roundId: { skip, done } } (see bet-prompt.js)
    courseLinks: {},   // booking pages you saved for courses: { courseId: url } (see tee-reminders.js), synced in the profile
    nudges: {},        // when you last nudged each person about money they owe you: { personId: when } (see nudges.js), synced in the profile
    talk: {},          // comments and reactions: { 'round:<id>' | 'plan:<id>': { rowId: row } } (see talk.js)
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (data.settings) data.settings = migrateSettings(data.settings);
    const base = fresh();
    // Shallow-merge so newly added keys (and newly added games) get defaults
    const settings = { ...base.settings, ...data.settings };
    for (const [k, v] of Object.entries(base.settings)) {
      if (v && typeof v === 'object') settings[k] = { ...v, ...data.settings?.[k] };
    }
    if (settings.dots) settings.dots.kinds = { ...base.settings.dots.kinds, ...data.settings?.dots?.kinds };
    return { ...base, ...data, usuals: Array.isArray(data.usuals) ? data.usuals : [], settings };
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

/** A brand new state, for restoring a backup over (see backup.js). */
export function freshState() { return fresh(); }

/** Swap in a whole new state (used by cloud sync after merging an account's data). */
export function replaceState(next) {
  state = next;
  persist();
  listeners.forEach(l => l());
}
