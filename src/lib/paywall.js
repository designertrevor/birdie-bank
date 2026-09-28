// The paywall at the end of organizer onboarding (roadmap area 11). UI only for now: nothing is
// charged, no payment provider is wired up, and it stays off unless the flag turns it on.
// Built for an A/B test later: each design is a variant with a weight, a phone gets one variant
// and keeps it, and what they chose is saved with the variant so the two can be compared.
// Invited players never see it: only someone who came through organizer onboarding qualifies.
// Pure functions of plain data, so they're easy to test.

export const TRIAL_DAYS = 14;
/** The day we remind them the trial is ending, so there are no surprises. */
export const REMIND_DAY = 12;

// PLACEHOLDER PRICES. Not decided yet (see "open questions" in ROADMAP.md): change them here only.
export const PRICES_ARE_PLACEHOLDERS = true;
export const PLANS = {
  annual: { id: 'annual', label: 'Yearly', price: 49.99, per: 'year' },
  monthly: { id: 'monthly', label: 'Monthly', price: 6.99, per: 'month' },
};
export const DEFAULT_PLAN = 'annual';

/**
 * What Pro adds, from the roadmap's organizer model.
 * Open for Trevor: "Your usual game in one tap" and "Planning rounds ahead" are free in the live app
 * today. Left as is tonight; gating them later would take away something free.
 */
export const PRO_FEATURES = [
  { icon: 'receipt', text: 'The season tab across every round' },
  { icon: 'calendar-check', text: 'Planning rounds ahead, with who’s in and the group vote' },
  { icon: 'arrow-counter-clockwise', text: 'Your usual game in one tap' },
  { icon: 'map-trifold', text: 'Every course' },
  { icon: 'chart-line-up', text: 'Season stats and results images' },
];

/** The free promise: nothing on this list ever moves to Pro. `games` is how many games there are. */
export function freePromise(games) {
  return [
    'Join any round from a link',
    'Live scores and the money, hole by hole',
    `All ${games} games`,
    'Settle up, pay links and the Tab for what’s owed',
    'Carry-overs between two people',
    'Trash talk in your group’s rounds',
  ];
}

// --------------------------- the variants ------------------------------------

/**
 * Paywall designs to test. `weight` is each one's share of new organizers; set it to 0 to stop
 * showing a variant while keeping the answers already recorded against it. To add one: give it
 * an id and a weight here, and a view in components/Paywall.jsx.
 */
export const VARIANTS = {
  // C from the 2026-09-27 wireframes: trial timeline, plans, the free promise and a full "Keep scoring for free" button
  c: { id: 'c', name: 'Trial with a free way out', weight: 1, freeWayOut: true },
};

/** A stable number from 0 to 1 for a string (FNV-1a), so a phone always lands in the same bucket. */
export function bucket(key = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** Which variant a key lands in, by weight. Null when every weight is 0. */
export function pickVariant(key, variants = VARIANTS) {
  const live = Object.values(variants).filter(v => v.weight > 0);
  const total = live.reduce((t, v) => t + v.weight, 0);
  if (!total) return null;
  let at = bucket(String(key)) * total;
  for (const v of live) {
    if (at < v.weight) return v.id;
    at -= v.weight;
  }
  return live[live.length - 1].id;
}

/** The variant this phone sees: the one it already got, if that still exists, or a new pick. */
export function variantFor(state, key, variants = VARIANTS) {
  const had = state?.paywall?.variant;
  if (had && variants[had]) return had;
  return pickVariant(key, variants);
}

// --------------------------- who sees it -------------------------------------

/**
 * The flag. Off unless turned on: `VITE_PAYWALL=on` at build time, on in local dev, and
 * `?paywall=on` or `?paywall=off` in the address bar overrides both on that phone (remembered).
 * Returns { on, remember } where `remember` is the override to save, if the URL set one.
 */
export function readFlag({ env = {}, search = '', saved = null } = {}) {
  const q = new URLSearchParams(search).get('paywall');
  if (q === 'on' || q === 'off') return { on: q === 'on', remember: q };
  if (saved === 'on' || saved === 'off') return { on: saved === 'on', remember: null };
  const v = String(env.VITE_PAYWALL ?? '').toLowerCase();
  if (v === 'on' || v === '1' || v === 'true') return { on: true, remember: null };
  if (v === 'off' || v === '0' || v === 'false') return { on: false, remember: null };
  return { on: !!env.DEV, remember: null };
}

/**
 * Whether to show the paywall at the end of onboarding: the flag is on, this phone's owner came
 * through organizer onboarding (not a join link or an RSVP link), and they haven't answered it yet.
 */
export function shouldShowPaywall(state, flagOn) {
  if (!flagOn || !state) return false;
  if (!state.organizer) return false;
  return !state.paywall?.choice;
}

/**
 * Whether this phone's owner organizes rounds, so a Pro preview makes sense for them: they came
 * through organizer onboarding, set up a round themselves, or planned one. Someone who only ever
 * joined from a link (their rounds carry `localMe`) or answered an RSVP doesn't.
 */
export function isOrganizer(state) {
  if (!state) return false;
  if (state.organizer) return true;
  if (Object.values(state.rounds || {}).some(r => !r.localMe)) return true;
  return Object.values(state.plans || {}).some(p => p.host);
}

/** The Settings line for Pro: where this phone stands. */
export function planStatus(state, now = Date.now()) {
  const p = state?.paywall;
  if (p?.choice === 'trial' && p.trialEnds > now) {
    const days = Math.ceil((p.trialEnds - now) / DAY);
    return `Pro trial preview · ${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  return 'Free · see what Pro adds';
}

// --------------------------- what it shows -----------------------------------

const DAY = 24 * 60 * 60 * 1000;
const fmtDay = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** The trial, step by step: today, the reminder, and when Pro starts. `planned`: they just planned a round. */
export function trialTimeline(start = new Date(), { days = TRIAL_DAYS, remind = REMIND_DAY, planned = false } = {}) {
  const at = n => new Date(start.getTime() + n * DAY);
  return [
    { key: 'today', icon: 'check', title: 'Today', when: null, text: planned ? 'Everything in Pro. Your next round is set up and the group link is ready.' : 'Everything in Pro, starting with your next round.' },
    { key: 'remind', icon: 'bell', title: `Day ${remind}`, when: fmtDay(at(remind)), text: 'We remind you the trial is ending. No surprises.' },
    { key: 'start', icon: 'star', title: `Day ${days}`, when: fmtDay(at(days)), text: 'Pro starts, unless you cancel. Two taps.' },
  ];
}

const dollars = v => `$${v.toFixed(2)}`;

/** "$49.99 a year", "$6.99 a month". */
export function priceLabel(plan) {
  return `${dollars(plan.price)} a ${plan.per}`;
}

/** What the yearly plan works out to each month: "$4.17 a month". */
export function perMonthLabel(plan) {
  const m = plan.per === 'year' ? plan.price / 12 : plan.price;
  return `${dollars(Math.round(m * 100) / 100)} a month`;
}

/** How much yearly saves against paying monthly for a year, as a whole percent. */
export function annualSavings(plans = PLANS) {
  const year = plans.monthly.price * 12;
  return Math.round((1 - plans.annual.price / year) * 100);
}

/** What gets saved when they answer: the variant, the choice and the plan they had picked. */
export function paywallAnswer({ variant, choice, plan, source = 'onboarding', now = Date.now() }) {
  return {
    variant,
    choice, // 'trial' | 'free'
    plan: choice === 'trial' ? plan : null,
    source,
    at: now,
    trialEnds: choice === 'trial' ? now + TRIAL_DAYS * DAY : null,
  };
}
