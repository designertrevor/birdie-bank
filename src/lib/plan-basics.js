// Plans as Up next reads them: who's in, the group's pick so far, and the day and tee time.
// Split out of plans.js (which re-exports all of it) so Up next's first paint doesn't load the
// plan setup, the stakes text and the rest of what starting a round from a plan needs.
// Pure functions of plain data, no imports.

export const RSVPS = ['in', 'maybe', 'out'];
/** The organizer's own key on a plan. Not their player id, so signing in (which can change it) never loses their answer. */
export const HOST = 'host';
export const RSVP_LABEL = { in: 'In', maybe: 'Maybe', out: 'Out' };

// --------------------------- the ballot -------------------------------------

/** The amounts on the ballot for one game. Older plans have one list for every game. */
export function betsFor(plan, game) {
  return plan?.ballot?.betsByGame?.[game] ?? plan?.ballot?.bets ?? [];
}

/** The organizer's suggested bet for one game (older plans: one amount for every game). */
export function suggestedBetFor(plan, game) {
  const s = plan?.suggested;
  if (s?.bets) return s.bets[game] ?? null;
  return s?.bet ?? null;
}

// --------------------------- who's in ---------------------------------------

/**
 * Everyone on the plan with their answer: the people invited (in the organizer's order), then
 * anyone who answered from the group link, in the order they answered.
 * [{ who, name, status: 'in' | 'maybe' | 'out' | null, game, bet, betGame, invited, self }]
 * `betGame`: the game the bet vote is for (null on a vote from before bets were per game).
 * `self`: they answered from their own phone, so only they change it (the organizer can't mark it).
 */
export function planPeople(plan) {
  const answers = plan?.answers || {};
  const out = (plan?.people || []).map(p => ({ who: p.id, name: p.name, invited: true, ...pick(answers[p.id]) }));
  const known = new Set(out.map(p => p.who));
  Object.entries(answers)
    .filter(([who, a]) => !known.has(who) && a?.status)
    .sort(([, a], [, b]) => (a.at || 0) - (b.at || 0))
    .forEach(([who, a]) => out.push({ who, name: a.name || 'Guest', invited: false, ...pick(a) }));
  return out;
}
function pick(a) {
  const bet = a?.bet ?? null;
  // `days`: the days they can make on a plan with no day yet (plan-open.js), null when they haven't said
  return { status: RSVPS.includes(a?.status) ? a.status : null, game: a?.game ?? null, bet, betGame: bet != null ? a?.betGame ?? null : null, sides: a?.sides || null, days: Array.isArray(a?.days) ? a.days : null, self: a?.self === true };
}

/** Counts for the card: { in, maybe, out, waiting } (waiting: invited and no answer yet). */
export function planCounts(plan) {
  const c = { in: 0, maybe: 0, out: 0, waiting: 0 };
  for (const p of planPeople(plan)) {
    if (p.status) c[p.status]++;
    else c.waiting++;
  }
  return c;
}

/** "4 in · 1 maybe · 2 haven't answered": the counts line, leaving out the zeros. */
export function countsLine(c) {
  const parts = [`${c.in} in`];
  if (c.maybe) parts.push(`${c.maybe} maybe`);
  if (c.out) parts.push(`${c.out} out`);
  if (c.waiting) parts.push(`${c.waiting} ${c.waiting === 1 ? 'hasn’t' : 'haven’t'} answered`);
  return parts.join(' · ');
}

// --------------------------- the vote ---------------------------------------

const same = (kind, a, b) => (kind === 'bet' ? Number(a) === Number(b) : a === b);

/**
 * The vote on the game or the bet. Everyone who isn't out gets one vote. Most votes wins; a tie
 * goes to the organizer's suggestion if it's in the tie, else to the one listed first. With no
 * votes yet, the suggestion stands.
 * The bet vote is for one game: `game`, or the game the group picked when it's left out. A bet
 * vote counts for the game it was cast for; one from before bets were per game counts for any.
 * { rows: [{ choice, votes, suggested, leading }], winner, total, game (the bet's game) }
 */
export function tally(plan, kind, game = null) {
  const betGame = kind === 'bet' ? (game ?? tally(plan, 'game').winner) : null;
  const ballot = (kind === 'game' ? plan?.ballot?.games : betsFor(plan, betGame)) || [];
  const suggested = (kind === 'game' ? plan?.suggested?.game : suggestedBetFor(plan, betGame)) ?? ballot[0] ?? null;
  const rows = ballot.map(choice => ({ choice, votes: 0, suggested: same(kind, choice, suggested), leading: false }));
  let total = 0;
  for (const p of planPeople(plan)) {
    if (p.status === 'out') continue;
    const v = p[kind];
    if (v == null) continue;
    if (kind === 'bet' && p.betGame && p.betGame !== betGame) continue;
    const row = rows.find(r => same(kind, r.choice, v));
    if (!row) continue;
    row.votes++;
    total++;
  }
  const top = Math.max(0, ...rows.map(r => r.votes));
  const tied = rows.filter(r => r.votes === top);
  const win = !total ? (rows.find(r => r.suggested) || rows[0]) : (tied.find(r => r.suggested) || tied[0]);
  if (win && total) win.leading = true;
  return { rows, winner: win ? win.choice : suggested, total, ...(kind === 'bet' ? { game: betGame } : {}) };
}

/** The game the group picked and the bet voted for that game (or the suggestions, while nobody has voted). */
export function planChoice(plan) {
  const game = tally(plan, 'game').winner;
  return { game, bet: Number(tally(plan, 'bet', game).winner) || null };
}

// --------------------------- dates ------------------------------------------

const pad2 = n => String(n).padStart(2, '0');
/** A local calendar day as YYYY-MM-DD. */
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseDay(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** Whole days from today to the plan's day: 0 today, 1 tomorrow, negative once it's gone. */
export function daysUntil(iso, now = new Date()) {
  const day = parseDay(iso);
  if (!day) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day - today) / 86400000);
}

/** "8:10 AM" from "08:10". */
export function timeLabel(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Tomorrow", "Saturday" (this week) or "Sat, Oct 11". */
export function dayLabel(iso, now = new Date()) {
  const day = parseDay(iso);
  const n = daysUntil(iso, now);
  if (!day || n == null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1 && n < 7) return DAYS[day.getDay()];
  return `${DAYS[day.getDay()].slice(0, 3)}, ${MONTHS[day.getMonth()]} ${day.getDate()}`;
}

/** "Saturday · 8:10 AM": the day and tee time together. */
export function whenLabel(plan, now = new Date()) {
  return [dayLabel(plan.date, now), timeLabel(plan.teeTime)].filter(Boolean).join(' · ');
}

/** The next `n` days to pick from, starting today: [{ iso, top, bottom }]. */
export function dayChoices(now = new Date(), n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return {
      iso: isoDate(d),
      top: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[d.getDay()].slice(0, 3),
      bottom: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
    };
  });
}

/** How long a plan with no day yet that was called off stays on Up next, so friends see it's off. */
const OPEN_OFF_MS = 3 * 86400000;
/** How long a plan with no day yet stays on Up next with nothing happening on it. */
export const OPEN_STALE_MS = 30 * 86400000;

/**
 * When anything last happened on a plan, in ms: when it was made, or anyone's latest answer
 * (each answer's `at`, which moves on every in, maybe, out, day or vote, and comes from the server
 * for friends' answers). The organizer's own edits ride in the plan with no time, so they don't count.
 * 0 when the plan has no time at all.
 */
export function planActivity(p) {
  const ats = Object.values(p?.answers || {}).map(a => Number(a?.at) || 0);
  return Math.max(Number(p?.createdAt) || 0, ...ats);
}

/**
 * Plans for Up next, soonest first: still planned, or called off (so friends see that), from
 * yesterday on. A friend's plan that has started stays too, so they can follow the round (the
 * organizer has the round itself). Older ones drop off by themselves.
 * A plan with no day yet (plan-open.js) stays while it's on, after the ones with a day, oldest
 * first, until 30 days go by with nothing happening on it (planActivity). Called off, it stays
 * 3 days from when it was called off (`offAt`); plans called off before that was kept count from
 * when they were made.
 */
export function upcomingPlans(state, now = new Date()) {
  const dated = p => daysUntil(p.date, now) != null;
  const keep = p => {
    if (!p || !(p.status === 'planned' || p.status === 'off' || (p.status === 'started' && !p.host))) return false;
    if (dated(p)) return daysUntil(p.date, now) >= -1;
    if (p.status === 'off') return now.getTime() - (Number(p.offAt) || p.createdAt || 0) < OPEN_OFF_MS;
    // A plan with no time at all can't be aged, so it stays
    const last = planActivity(p);
    return p.status !== 'planned' || !last || now.getTime() - last < OPEN_STALE_MS;
  };
  return Object.values(state?.plans || {})
    .filter(keep)
    // A round kept for another day: the new plan takes the old one's place once it's on this phone
    .filter(p => !(p.movedTo && movedPlanOf(state, p)))
    .sort((a, b) => (dated(b) - dated(a)) || String(a.date || '').localeCompare(String(b.date || '')) || String(a.teeTime || '').localeCompare(String(b.teeTime || '')) || (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * The plan a round kept for another day moved to (`movedTo` on the old plan: { id, code, date },
 * set on the organizer's phone and shared with the plan), as it is on this phone, or null.
 */
export function movedPlanOf(state, plan) {
  const m = plan?.movedTo;
  if (!m) return null;
  const plans = Object.values(state?.plans || {});
  return (m.code && plans.find(p => p?.code === m.code)) || (m.id && state?.plans?.[m.id]) || null;
}
