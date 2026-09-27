// Organizer onboarding (roadmap area 3): four questions, one a screen, with a payoff after three
// of them that says what Birdie Bank does about that answer. The answers then fill in the next
// round's plan (the suggested game and the ballot) so a new organizer gets value on day one.
// Pure functions of plain data, so they're easy to test. Invited players never come through here.
import { GAMES } from './round.js';
import { MAX_BALLOT_GAMES } from './plans.js';

/** The games offered on the first question, in the order shown. Every key is a real game. */
export const ONBOARD_GAMES = ['skins', 'nassau', 'wolf', 'banker', 'vegas', 'match', 'stableford', 'stroke'];

export const SIZES = [
  { value: '2', label: 'Just two of us', sub: 'A match with a buddy' },
  { value: '4', label: 'A foursome', sub: 'The classic' },
  { value: '8', label: '5 to 8', sub: 'Two groups, one pot' },
  { value: '12', label: '9 or more', sub: 'A trip or a league' },
];

// Venmo is never assumed: each person picks their own payment app later
export const SETTLES = [
  { value: 'app', label: 'A payment app after the round', sub: 'Venmo, Cash App, PayPal, Zelle' },
  { value: 'cash', label: 'Cash on the 18th green' },
  { value: 'tab', label: 'Someone keeps a running tab' },
  { value: 'none', label: 'Honestly? We mostly don’t' },
];

export const MATHS = [
  { value: 'me', label: 'Me, every time' },
  { value: 'rotate', label: 'It rotates' },
  { value: 'phone', label: 'Whoever has a calculator open' },
  { value: 'nobody', label: 'Nobody. That’s the problem.' },
];

/**
 * The screens in order. `q*` ask, `p*` pay off the answer before it, `name` asks who you are
 * (with the friendly wagers note), and `group` sums it up and leads into the next round.
 */
export const STEPS = ['welcome', 'games', 'p-games', 'size', 'settle', 'p-settle', 'math', 'p-math', 'name', 'group'];

export function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i < 0 || i === STEPS.length - 1 ? step : STEPS[i + 1];
}
export function prevStep(step) {
  const i = STEPS.indexOf(step);
  return i <= 0 ? STEPS[0] : STEPS[i - 1];
}
/** How far along the progress bar is, 0 to 1. The welcome screen doesn't count. */
export function progressOf(step) {
  const i = STEPS.indexOf(step);
  return i <= 0 ? 0 : i / (STEPS.length - 1);
}

/** Whether a question screen has an answer, so Continue can go. Other screens are always ready. */
export function answered(step, a = {}) {
  switch (step) {
    case 'games': return (a.games || []).length > 0;
    case 'size': return !!a.size;
    case 'settle': return !!a.settle;
    case 'math': return !!a.math;
    default: return true;
  }
}

/** Add or remove a game from the picks, keeping the order they were tapped in. */
export function toggleGame(games = [], key) {
  return games.includes(key) ? games.filter(g => g !== key) : [...games, key];
}

const nameOf = k => GAMES[k]?.name || k;

/** "Skins", "Skins and Wolf", "Skins, Wolf and Nassau", "Skins, Wolf and 2 more". */
export function gameList(games = []) {
  const names = games.filter(k => GAMES[k]).map(nameOf);
  if (!names.length) return 'Skins';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** The game the organizer suggests for the next round: the first one they picked. */
export function suggestedGame(a = {}) {
  return (a.games || []).find(k => GAMES[k]) || 'skins';
}

/** The other games they play go on the next round's ballot, so the group can vote for them. */
export function ballotGames(a = {}) {
  const first = suggestedGame(a);
  return (a.games || []).filter(k => GAMES[k] && k !== first).slice(0, MAX_BALLOT_GAMES - 1);
}

export const sizeLabel = size => ({ 2: '2 players', 4: 'A foursome', 8: '5 to 8 players', 12: '9 or more' })[size] || '';
export const settleLabel = settle => ({ app: 'A payment app after', cash: 'Cash on 18', tab: 'A running tab', none: 'Mostly don’t' })[settle] || '';

/**
 * Settling up with everyone owing everyone: how many debts there can be between the group, and
 * how few payments square them. With n people, every pair can owe (n choose 2), and n - 1
 * payments always cover it. "9 or more" is shown as 10.
 */
export function settleMath(size) {
  const n = { 2: 4, 4: 4, 8: 8, 12: 10 }[size] || 4;
  return { people: n, debts: (n * (n - 1)) / 2, payments: n - 1 };
}

/** The payoff after a question: { eyebrow, title, text }. Null for a question with no payoff. */
export function payoff(step, a = {}) {
  if (step === 'p-games') {
    const n = Object.keys(GAMES).length;
    return {
      eyebrow: 'Nice',
      title: `${gameList(a.games)}. Good taste.`,
      text: `Birdie Bank knows the rules for all ${n} games, carryovers and presses included. You tap scores, and the money keeps up hole by hole.`,
    };
  }
  if (step === 'p-settle') {
    const copy = {
      app: ['A payment app after? We’ll hand everyone the button.', 'Birdie Bank cuts a round down to the fewest payments, and each one opens the app the other person uses: Venmo, Cash App, PayPal or Zelle.'],
      cash: ['Cash works until someone’s short a twenty.', 'Birdie Bank keeps a tab all season, so “I’ll get you next week” actually happens.'],
      tab: ['Whoever keeps the tab just got a promotion.', 'Birdie Bank keeps it for them: netted across every round, and the whole group can see it.'],
      none: ['Then somebody’s keeping score in their head.', 'Birdie Bank makes it official, in a friendly way: the fewest payments, and a tab that remembers.'],
    }[a.settle] || [];
    if (!copy.length) return null;
    return { eyebrow: 'Settling up', title: copy[0], text: copy[1] };
  }
  if (step === 'p-math') {
    const title = {
      me: 'So you’re the bank.',
      rotate: 'Rotating means nobody checks anybody.',
      phone: 'Calculator app on the 18th green. Classic.',
      nobody: 'Now somebody does, and it shows its work.',
    }[a.math];
    if (!title) return null;
    return {
      eyebrow: 'About that',
      title,
      text: 'Someone sets up the game, keeps the card, does the math and chases the payments. Birdie Bank does all four. Your group joins free from a link, no download.',
    };
  }
  return null;
}

/** The checklist on "Here’s your group": what's ready because of their answers. */
export function readyLines(a = {}) {
  return [
    `Rules for ${gameList(a.games)} ready to go`,
    'Your group joins free from a link',
    a.settle === 'app' ? 'Pay buttons for each person’s own app' : 'A tab that remembers, all season',
  ];
}

/** What gets saved: the answers, cleaned, with when. Kept on this phone for the next round and the paywall. */
export function organizerRecord(a = {}, now = Date.now()) {
  return {
    games: (a.games || []).filter(k => GAMES[k]),
    size: a.size || null,
    settle: a.settle || null,
    math: a.math || null,
    at: now,
  };
}
