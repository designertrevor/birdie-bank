// Getting a round going before anything is settled (the overhaul's "Get a round going", 2026-10-27).
// A plan can start as just the ask: no day, no course, and the group picks the game and the bet.
// Each of the four details (Day, Course, Game, Bet) is in one of three states: Set, Up for a vote
// or Not yet, and the plan page, the friend's card and Up next all read them from here.
//
// Where it rides, with no new table or column: the plan's own parts go in its meta like everything
// else (`when`, `ask`, `groupPicks`), and each person's days ride in their game vote after a second
// "~" ("skins~~9k.9l", "nassau~skins~9k", plans.js gameVoteChoice). Phones from before this read
// only the first two parts, so they keep the game and side votes and never see the days.
// Pure functions of plain data; imports only plan-basics.js so Up next's card can use it.
import { betsFor, dayLabel, daysUntil, planPeople, tally, timeLabel } from './plan-basics.js';

/** What the ask says until the organizer changes it. */
export const ASK_DEFAULT = 'Trying to get a round in soon. Who’s in?';
/** The longest ask, so it fits a text and the friend's card. */
export const ASK_MAX = 140;
/** The three ways the day can stand: a day set, a few days offered, or not sure yet. */
export const WHEN_MODES = ['set', 'options', 'open'];
/** Morning or afternoon, in place of a tee time while there isn't one. */
export const PARTS = ['morning', 'afternoon'];
export const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon' };
/** A detail's state and its tag. */
export const STATE_LABEL = { set: 'Set', vote: 'Up for a vote', not: 'Not yet' };
/** At most this many days on offer, so the vote stays quick and the days fit a vote row. */
export const MAX_DAY_OPTIONS = 6;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad2 = n => String(n).padStart(2, '0');

/** Whether `iso` is a real calendar day ("2026-02-31" isn't). */
export function validDay(iso) {
  const m = ISO.exec(String(iso ?? ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const daySet = list => [...new Set((Array.isArray(list) ? list : []).filter(validDay))].sort();

// --------------------------- days in a vote --------------------------------
// A day as a short code: days since 2026-01-01 in base 36 ("9k" is Oct 25, 2026), so six days fit
// in the 32 characters a vote can hold next to the game and side votes.

const EPOCH = Date.UTC(2026, 0, 1);

/** "9k" for "2026-10-25". Null for a day that isn't real or is before 2026. */
export function dayCode(iso) {
  if (!validDay(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
  return n >= 0 ? n.toString(36) : null;
}

/** "2026-10-25" for "9k". Null for anything else. */
export function codeDay(code) {
  if (!/^[0-9a-z]{1,4}$/.test(String(code ?? ''))) return null;
  const d = new Date(EPOCH + parseInt(code, 36) * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Days as a vote keeps them ("9k.9l"), soonest first, leaving off the latest ones that don't fit in `room` characters. */
export function encodeDays(days, room = 32) {
  const codes = daySet(days).map(dayCode).filter(Boolean);
  while (codes.length && codes.join('.').length > room) codes.pop();
  return codes.join('.');
}

/** The days in a vote's day part, soonest first. */
export function decodeDays(s) {
  return daySet(String(s ?? '').split('.').map(codeDay));
}

// --------------------------- the plan, read the same way everywhere --------

/**
 * A plan as the new pages read it, whatever app version saved it. Plans from before this always
 * have a day, a game and a ballot; they come back with `when` set to that day, nobody's picks left
 * to the group, and no ask. A day that isn't a real day reads as no day. Nothing else changes.
 * { ...plan, date, when: { mode, days, part }, groupPicks: { game, bet }, ask }
 */
export function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const date = validDay(plan.date) ? plan.date : null;
  const w = plan.when && typeof plan.when === 'object' ? plan.when : {};
  const days = daySet(w.days).slice(0, MAX_DAY_OPTIONS * 2);
  // A day set is set, whatever the mode said; with none, the days offered say whether it's a vote
  const mode = date ? 'set' : w.mode === 'options' || w.mode === 'open' ? w.mode : days.length ? 'options' : 'open';
  const gp = plan.groupPicks && typeof plan.groupPicks === 'object' ? plan.groupPicks : {};
  const ask = typeof plan.ask === 'string' && plan.ask.trim() ? plan.ask.replace(/\s+/g, ' ').trim().slice(0, ASK_MAX) : null;
  return {
    ...plan, date,
    when: { mode, days, part: PARTS.includes(w.part) ? w.part : null },
    groupPicks: { game: gp.game === true, bet: gp.bet === true },
    ask,
  };
}

/** "Sat Oct 25": a day for a tag, a button or a text. */
export function shortDay(iso) {
  if (!validDay(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return `${DAYS[day.getDay()]} ${MONTHS[m - 1]} ${d}`;
}

/** The days golfers reach for when picking a few: the next `n` Saturdays and Sundays, from today on. */
export function soonDays(now = new Date(), n = 8) {
  const out = [];
  for (let i = 0; out.length < n && i < 70; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return out;
}

/** "Sat" and "25" for a day tile. */
export function dayTile(iso) {
  if (!validDay(iso)) return { top: '', bottom: '' };
  const [y, m, d] = iso.split('-').map(Number);
  return { top: DAYS[new Date(y, m - 1, d).getDay()], bottom: String(d), month: MONTHS[m - 1] };
}

// --------------------------- the day vote ----------------------------------

/**
 * The days to pick from: the ones the organizer offered and any day someone said works (a friend
 * adding a day), today on, soonest first. Each with who can make it; people who are out don't count.
 * [{ iso, option, votes, ins, maybes, who, by }] where `ins` and `maybes` are names, `who` the
 * people's keys, `by` the name of whoever added a day the organizer didn't offer.
 */
export function dayOptions(plan, now = new Date()) {
  const p = normalizePlan(plan);
  const map = new Map();
  const add = (iso, option) => {
    if (!validDay(iso) || (daysUntil(iso, now) ?? -1) < 0) return null;
    let o = map.get(iso);
    if (!o) { o = { iso, option: false, votes: 0, ins: [], maybes: [], who: [], by: null }; map.set(iso, o); }
    if (option) o.option = true;
    return o;
  };
  for (const iso of p?.when?.days || []) add(iso, true);
  for (const x of planPeople(p)) {
    if (!x.status || x.status === 'out' || !Array.isArray(x.days)) continue;
    for (const iso of daySet(x.days)) {
      const o = add(iso, false);
      if (!o || o.who.includes(x.who)) continue;
      o.votes++;
      o.who.push(x.who);
      (x.status === 'maybe' ? o.maybes : o.ins).push(x.name);
      if (!o.option && !o.by) o.by = x.name;
    }
  }
  return [...map.values()].sort((a, b) => a.iso.localeCompare(b.iso));
}

/**
 * The days on offer once the organizer adds `added`: today on, soonest first, at most
 * MAX_DAY_OPTIONS. Days already on offer keep their place; added ones fill what's left.
 */
export function offeredDays(days, added = [], now = new Date()) {
  const ahead = list => daySet(list).filter(d => (daysUntil(d, now) ?? -1) >= 0);
  const have = ahead(days).slice(0, MAX_DAY_OPTIONS);
  const extra = ahead(added).filter(d => !have.includes(d));
  return daySet([...have, ...extra.slice(0, MAX_DAY_OPTIONS - have.length)]);
}

/** The day most people can make: most votes, then most who are in, then the soonest. Null before anyone picks one. */
export function leadingDay(plan, now = new Date()) {
  let best = null;
  for (const o of dayOptions(plan, now)) {
    if (!o.votes) continue;
    if (!best || o.votes > best.votes || (o.votes === best.votes && o.ins.length > best.ins.length)) best = o;
  }
  return best;
}

/**
 * The nudge to lock in the day: one day clearly leads (at least two can make it, more than any
 * other day, and more than half of everyone who isn't out, counting who hasn't answered).
 * { iso, votes, of, waiting: names who haven't answered, cant: names in or maybe who didn't pick it }
 * or null. Only for a plan still on with no day yet.
 */
export function lockNudge(plan, now = new Date()) {
  const p = normalizePlan(plan);
  if (!p || p.date || p.status !== 'planned' || p.gone) return null;
  const opts = dayOptions(p, now);
  const lead = leadingDay(p, now);
  if (!lead || lead.votes < 2) return null;
  const next = Math.max(0, ...opts.filter(o => o.iso !== lead.iso).map(o => o.votes));
  if (lead.votes <= next) return null;
  const people = planPeople(p);
  const notOut = people.filter(x => x.status !== 'out');
  if (lead.votes * 2 <= notOut.length) return null;
  return {
    iso: lead.iso, votes: lead.votes, of: notOut.length,
    waiting: people.filter(x => !x.status).map(x => x.name),
    cant: notOut.filter(x => x.status && !lead.who.includes(x.who)).map(x => x.name),
  };
}

// --------------------------- the four details ------------------------------

const dollars = (_game, n) => `$${n}`;

/**
 * Each detail's state and the words for its tag: { day, course, game, bet }, each
 * { state: 'set' | 'vote' | 'not', label }. `name(game)` names a game and `unit(game, amount)`
 * says a bet in the game's unit; the defaults keep this free of the games list for Up next.
 * The game and the bet: Set when the organizer picked one, Up for a vote when there's a choice,
 * Not yet when the group picks and nobody has voted.
 */
export function detailStates(plan, { now = new Date(), name = g => g, unit = dollars } = {}) {
  const p = normalizePlan(plan);
  // Day
  let day;
  if (p.date) day = { state: 'set', label: [shortDay(p.date), timeLabel(p.teeTime) || PART_LABEL[p.when.part]].filter(Boolean).join(' · ') };
  else {
    const opts = dayOptions(p, now);
    const lead = leadingDay(p, now);
    day = !opts.length ? { state: 'not', label: 'Not yet' } : { state: 'vote', label: lead ? `${shortDay(lead.iso)} leads` : 'Voting' };
  }
  // Course
  const course = p.course?.name ? { state: 'set', label: p.course.name } : { state: 'not', label: 'Any course' };
  // Game
  const gt = tally(p, 'game');
  let game;
  if (p.groupPicks.game) game = gt.total ? { state: 'vote', label: `${name(gt.winner)} leads` } : { state: 'not', label: 'Group picks' };
  else if ((p.ballot?.games || []).length > 1) game = { state: 'vote', label: `${name(gt.winner)} ${gt.total > 1 ? 'leads' : 'suggested'}` };
  else game = gt.winner ? { state: 'set', label: name(gt.winner) } : { state: 'not', label: 'Not yet' };
  // Bet, for the game the group is going for
  const bt = tally(p, 'bet', gt.winner);
  const amounts = betsFor(p, gt.winner);
  let bet;
  if (p.groupPicks.bet) bet = bt.total ? { state: 'vote', label: `${unit(gt.winner, bt.winner)} leads` } : { state: 'not', label: 'Group picks' };
  else if (amounts.length > 1) bet = { state: 'vote', label: `${unit(gt.winner, bt.winner)} ${bt.total > 1 ? 'leads' : 'suggested'}` };
  else bet = Number(bt.winner) > 0 ? { state: 'set', label: unit(gt.winner, bt.winner) } : { state: 'not', label: 'Not yet' };
  return { day, course, game, bet };
}

/** The plan's day for a card: "Sat Oct 25 · 8:40 AM", or "No day yet" / "Sat Oct 25 leads" before there is one. */
export function whenLine(plan, now = new Date()) {
  const p = normalizePlan(plan);
  if (p.date) return [dayLabel(p.date, now), timeLabel(p.teeTime) || PART_LABEL[p.when.part]].filter(Boolean).join(' · ');
  const lead = leadingDay(p, now);
  return lead ? `No day yet · ${shortDay(lead.iso)} leads` : 'No day yet';
}

/** "Sun Oct 25 · Morning", "3 days to pick from", "Not sure yet": the ask's When row. `v`: { mode, date, days, part }. */
export function whenWords(v) {
  const part = PART_LABEL[v.part];
  if (v.mode === 'set' && v.date) return [shortDay(v.date), part].filter(Boolean).join(' · ');
  if (v.mode === 'options' && v.days.length) return `${v.days.length === 1 ? shortDay(v.days[0]) : `${v.days.length} days to pick from`}${part ? ` · ${part}` : ''}`;
  return `Not sure yet${part ? ` · ${part}` : ''}`;
}

// --------------------------- texts ------------------------------------------

const first = name => String(name || '').trim().split(/\s+/)[0];
const orList = l => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} or ${l.at(-1)}`);

/** The ask as the group text: the message, the days on offer and the course when set, and the link. */
export function askText(plan, link, now = new Date()) {
  const p = normalizePlan(plan);
  const days = p.when.days.filter(d => (daysUntil(d, now) ?? -1) >= 0).map(shortDay);
  const part = PART_LABEL[p.when.part];
  const facts = [
    days.length ? `Thinking ${orList(days)}${part ? `, ${part.toLowerCase()}` : ''}.` : null,
    p.course?.name ? `At ${p.course.name}.` : null,
  ].filter(Boolean).join(' ');
  return [
    p.ask || ASK_DEFAULT,
    facts || null,
    days.length ? 'Tap to say if you’re in and which days work:' : 'Tap to say if you’re in and when you can play:',
    link,
  ].filter(Boolean).join('\n');
}

/** The text once the organizer locks the day: when, where, and the link to see who's in. */
export function lockText(plan, link) {
  const p = normalizePlan(plan);
  const t = timeLabel(p.teeTime) || (PART_LABEL[p.when.part] ? `in the ${p.when.part}` : '');
  return [
    `Golf’s on: ${shortDay(p.date)}${t ? (p.teeTime ? ` at ${t}` : ` ${t}`) : ''}${p.course?.name ? `, ${p.course.name}` : ''}.`,
    link ? 'Tap to see who’s in:' : null,
    link || null,
  ].filter(Boolean).join('\n');
}

/** "Jordan hasn't answered", "Jordan and Mike haven't answered": the lock sheet's line. */
export function waitingLine(names) {
  const n = names.map(first);
  if (!n.length) return '';
  const who = n.length < 3 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`;
  return `${who} ${n.length === 1 ? 'hasn’t' : 'haven’t'} answered`;
}
