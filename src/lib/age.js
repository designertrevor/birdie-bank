// The age check: before anyone plays for money, a one-time "Are you 18 or older?". The answer is
// saved on your own profile (state.profile.age = { answer: 'adult' | 'under', at }), which lives on
// the phone before you sign in and goes to your account with the rest of your profile once you do
// (cloud-model.js), so it's asked once per person, not once per phone. It never goes on the profile
// row other people can see.
//
// Under 18 still keeps score, joins rounds to watch, and plays for points or a reward. Only money
// waits: a money round in setup, taking a seat in someone's money round, and a reward round's side
// bets for money. A round already in progress is never stopped or changed by it.
// Pure functions of plain data, so they're easy to test.
import { onTab } from './play-for.js';

/** The youngest age for money rounds anywhere. Some places ask more, so the copy says so too. */
export const MONEY_AGE = 18;
export const ANSWERS = ['adult', 'under'];

/** 'adult', 'under', or null when nobody on this phone or account has answered yet. */
export function ageAnswer(state) {
  const a = state?.profile?.age?.answer;
  return ANSWERS.includes(a) ? a : null;
}

/** Whether you've said you're old enough to play for money. */
export const moneyOk = state => ageAnswer(state) === 'adult';

/** Whether you've said you're under 18, so money stays off until you change it. */
export const moneyOff = state => ageAnswer(state) === 'under';

/**
 * Whether a round (or a round being set up) asks about money at all: a money round, or a reward
 * round with a side bet played for money. Points and reward-only rounds never do.
 */
export const playsForMoney = round => !!round && onTab(round);

/**
 * Whether to ask before going ahead with `round`: only when it plays for money and you haven't said
 * you're 18 or older. `inProgress` (a round already under way, or finished) never asks: the check
 * comes before money starts, never in the middle of a round.
 */
export function needsAgeCheck(state, round, { inProgress = false } = {}) {
  if (inProgress || !playsForMoney(round)) return false;
  return !moneyOk(state);
}

/** Save an answer on a state draft (mutates). Anything but 'adult' or 'under' is ignored. */
export function setAgeAnswer(draft, answer, at = Date.now()) {
  if (!ANSWERS.includes(answer)) return;
  const cur = draft.profile && typeof draft.profile === 'object' && !Array.isArray(draft.profile) ? draft.profile : {};
  draft.profile = { ...cur, age: { answer, at } };
}

/**
 * The account's profile coming down onto this phone: it wins, as always, except an answer this
 * phone has that the account's copy doesn't (answered before signing in), which is kept so nobody is
 * asked twice.
 */
export function keepAgeAnswer(incoming, local) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  if (ANSWERS.includes(incoming.age?.answer)) return incoming;
  const mine = local?.age;
  return ANSWERS.includes(mine?.answer) ? { ...incoming, age: mine } : incoming;
}

/** The words for the question, the same everywhere it's asked. */
export const AGE_COPY = {
  title: 'Are you 18 or older?',
  text: 'Playing for money is for adults: 18 or older, or the age where you live if it’s higher. We only ask once. Under 18? You can still keep score and play for points or a reward.',
  yes: 'Yes, I’m 18 or older',
  no: 'No, I’m under 18',
};

/** One line for Settings about where you stand. */
export function ageLine(state) {
  const a = ageAnswer(state);
  if (a === 'adult') return 'You’re 18 or older, so money rounds are on';
  if (a === 'under') return 'Under 18: points and reward rounds only';
  return 'We ask once, before your first money round';
}
