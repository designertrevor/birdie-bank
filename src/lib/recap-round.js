// Which round the day-after recap is about (see recap.js for the card itself). Kept apart so Up next
// can tell whether there's a recap without loading the moments. Pure, tested in recap.test.js.
import { GAMES } from './round.js';
import { activeRounds, roundTime } from './history.js';
import { played } from './pair-debts.js';

/** How many days the recap stays up after the day it first shows. */
export const RECAP_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const startOfDay = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

/** "Yesterday" for the day before `now`, otherwise "Sat, Sep 26". */
export function recapDay(at, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days === 1) return 'Yesterday';
  const d = new Date(at);
  return `${SHORT_DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Your finished rounds (ones you played, never a watcher's copy), newest first. */
export function myDoneRounds(state) {
  return Object.values(state?.rounds || {})
    .filter(r => r?.status === 'done' && GAMES[r.game] && played(r, state))
    .sort((a, b) => roundTime(b) - roundTime(a));
}

/**
 * The round the recap is about, or null: your newest finished round, once a new calendar day has
 * started since it finished and for RECAP_DAYS after that, unless it's been dismissed on this phone
 * (`seen`, { roundId: when }) or a round is going on.
 */
export function recapRound(state, now = Date.now(), { seen = state?.recapSeen } = {}) {
  if (activeRounds(state).length) return null;
  const r = myDoneRounds(state)[0];
  if (!r) return null;
  const at = roundTime(r);
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days < 1 || days > RECAP_DAYS) return null;
  if (seen && typeof seen === 'object' && seen[r.id]) return null;
  return r;
}
