// Upcoming rounds: a round planned for later in the week. The organizer picks the game, the day,
// the course and the tee time, and suggests a game and a bet. Everyone answers in, maybe or out
// and votes; the organizer suggests, the group decides. At the tee, a roll call confirms who
// showed and starts the round with the voted game and bet in one tap.
// Pure functions of plain data, so they're easy to test. No storage, no network.
import { GAMES } from './round.js';
import { stakeSummary } from './stakes.js';
import { defaultTeams, teamsProblem } from './teams.js';
import { defaultTee } from './courses.js';

export const RSVPS = ['in', 'maybe', 'out'];
/** The organizer's own key on a plan. Not their player id, so signing in (which can change it) never loses their answer. */
export const HOST = 'host';
export const RSVP_LABEL = { in: 'In', maybe: 'Maybe', out: 'Out' };

/** Dollar amounts the organizer can put up for a vote. */
export const BET_LADDER = [1, 2, 5, 10, 20, 50];
/** At most this many games on the ballot, so the vote stays quick. */
export const MAX_BALLOT_GAMES = 4;

// --------------------------- the bet as one number ---------------------------

/** The dollar amount that stands for a game's bet: the number the group votes on. */
export function betOf(game, settings) {
  const s = settings?.[game] || {};
  switch (game) {
    case 'banker': return s.defaultBet;
    case 'nassau': return s.front;
    case 'skins': return s.payout === 'pot' ? (s.stake ?? s.value) : s.value;
    case 'wolf': case 'vegas': case 'nines': return s.point;
    case 'aces': return s.ace;
    case 'bbb': case 'dots': return s.value;
    default: return s.stake;
  }
}

const cents = v => Math.round(v * 100) / 100;

/** A copy of `settings` with the game's bet set to `amount`; every other house rule stays. */
export function withBet(game, settings, amount) {
  const out = structuredClone(settings || {});
  const a = Number(amount);
  if (!GAMES[game] || !(a > 0)) return out;
  const s = out[game] = { ...(out[game] || {}) };
  switch (game) {
    case 'banker':
      s.defaultBet = a;
      s.min = Math.min(s.min ?? a, a);
      s.max = Math.max(s.max ?? a, a);
      break;
    case 'nassau': s.front = a; s.back = a; s.total = a; break;
    case 'skins': if (s.payout === 'pot') s.stake = a; else s.value = a; break;
    case 'wolf': case 'vegas': case 'nines': s.point = a; break;
    case 'aces': s.ace = a; s.deuce = cents(a / 2); break;
    case 'bbb': case 'dots': s.value = a; break;
    default: s.stake = a;
  }
  return out;
}

/** "$5 a skin", "$2 each in the pot": what a bet amount means in a game. */
export function betLabel(game, settings, amount) {
  if (!GAMES[game] || !settings?.[game]) return '';
  return stakeSummary(game, withBet(game, settings, amount));
}

// --------------------------- who's in ---------------------------------------

/**
 * Everyone on the plan with their answer: the people invited (in the organizer's order), then
 * anyone who answered from the group link, in the order they answered.
 * [{ who, name, status: 'in' | 'maybe' | 'out' | null, game, bet, invited }]
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
  return { status: RSVPS.includes(a?.status) ? a.status : null, game: a?.game ?? null, bet: a?.bet ?? null };
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
 * { rows: [{ choice, votes, suggested, leading }], winner, total }
 */
export function tally(plan, kind) {
  const ballot = (kind === 'game' ? plan?.ballot?.games : plan?.ballot?.bets) || [];
  const suggested = plan?.suggested?.[kind] ?? ballot[0] ?? null;
  const rows = ballot.map(choice => ({ choice, votes: 0, suggested: same(kind, choice, suggested), leading: false }));
  let total = 0;
  for (const p of planPeople(plan)) {
    if (p.status === 'out') continue;
    const v = p[kind];
    if (v == null) continue;
    const row = rows.find(r => same(kind, r.choice, v));
    if (!row) continue;
    row.votes++;
    total++;
  }
  const top = Math.max(0, ...rows.map(r => r.votes));
  const tied = rows.filter(r => r.votes === top);
  const win = !total ? (rows.find(r => r.suggested) || rows[0]) : (tied.find(r => r.suggested) || tied[0]);
  if (win && total) win.leading = true;
  return { rows, winner: win ? win.choice : suggested, total };
}

/** The game and the bet the group picked (or the suggestion, while nobody has voted). */
export function planChoice(plan) {
  return { game: tally(plan, 'game').winner, bet: Number(tally(plan, 'bet').winner) || null };
}

// --------------------------- roll call --------------------------------------

/** Who starts checked at the tee: everyone who said they're in. */
export function rollCallDefault(plan) {
  return planPeople(plan).filter(p => p.status === 'in').map(p => p.who);
}

/** Why this many players can't play the game, or null when they can. */
export function playersProblem(game, count) {
  const g = GAMES[game];
  if (!g) return 'Pick a game first';
  if (g.min === g.max && count !== g.min) return `${g.name} is for exactly ${g.min}. You have ${count}.`;
  if (count < g.min) return `${g.name} needs at least ${g.min} players. You have ${count}.`;
  if (count > g.max) return `${g.name} takes up to ${g.max} players. You have ${count}.`;
  return null;
}

/**
 * Everything needed to start the round from a roll call, or a `problem` to send the organizer
 * to setup instead. `present` is the `who` keys of the people who showed, in any order; they
 * start in the plan's order. People not saved on this phone (friends from the group link, or
 * walk-ups added at the tee as answers) come back in `newPlayers` for the caller to save first.
 * `newId` makes an id for them (the store's uid, passed in to keep this pure).
 */
export function planStart(state, plan, present, { newId, course: courseIn } = {}) {
  const { game, bet } = planChoice(plan);
  const course = courseIn ?? null;
  const people = planPeople(plan);
  const chosen = people.filter(p => present.includes(p.who));
  const players = [];
  const newPlayers = [];
  for (const p of chosen) {
    const who = p.who === plan.hostWho ? (state.me ?? p.who) : p.who;
    let saved = state.players?.[who];
    if (!saved) {
      // A friend from the group link: reuse a saved player with the same name, else save them
      const name = String(p.name || '').trim();
      saved = name ? Object.values(state.players || {}).find(x => String(x?.name || '').trim().toLowerCase() === name.toLowerCase()) : null;
      if (!saved) {
        const a = plan.answers?.[p.who] || {};
        saved = { id: newId ? newId() : `p_${p.who}`, name: name || 'Guest', index: null, createdAt: Date.now(), ...(a.payApp && a.payHandle ? { payApp: a.payApp, payHandle: a.payHandle } : {}) };
        newPlayers.push(saved);
      }
    }
    if (!players.some(x => x.id === saved.id)) players.push(saved);
  }
  const g = GAMES[game];
  let problem = null;
  if (!g) problem = 'Pick a game first';
  else if (!course) problem = 'That course isn’t saved on this phone';
  else problem = playersProblem(game, players.length);
  const holesCount = g && g.holes.includes(plan.holesCount) ? plan.holesCount : g?.holes[0] ?? 18;
  const ids = players.map(p => p.id);
  const teams = g?.teams ? defaultTeams(game, ids) : null;
  if (!problem && g?.teams) problem = teamsProblem(game, teams, ids);
  const settings = bet ? withBet(game, state.settings, bet) : structuredClone(state.settings || {});
  delete settings.shareAmounts; // a personal setting, not part of a round's bets
  const tee = defaultTee(course)?.name ?? null;
  return {
    game, bet, course, holesCount, nine: plan.nine || 'front', teams, problem, newPlayers,
    players: players.map(p => ({ ...p, tee })),
    settings,
    hcPct: settings.hcPct ?? 100,
    useHandicaps: plan.useHc !== false,
  };
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

/**
 * Plans for Up next, soonest first: still planned, or called off (so friends see that), from
 * yesterday on. A friend's plan that has started stays too, so they can follow the round (the
 * organizer has the round itself). Older ones drop off by themselves.
 */
export function upcomingPlans(state, now = new Date()) {
  return Object.values(state?.plans || {})
    .filter(p => p && (p.status === 'planned' || p.status === 'off' || (p.status === 'started' && !p.host)) && (daysUntil(p.date, now) ?? -99) >= -1)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.teeTime || '').localeCompare(String(b.teeTime || '')) || (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * A saved player's answer to the soonest plan they're on, for their card on Players:
 * { plan, status } or null. Only plans this phone organized know saved players by id.
 */
export function rsvpFor(state, playerId, now = new Date()) {
  for (const plan of upcomingPlans(state, now)) {
    if (plan.status !== 'planned' || !plan.host) continue;
    const p = planPeople(plan).find(x => x.who === playerId);
    if (p) return { plan, status: p.status };
  }
  return null;
}

// --------------------------- texts ------------------------------------------

const first = name => String(name || '').trim().split(/\s+/)[0];
const listNames = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

function dayWords(plan, now) {
  const n = daysUntil(plan.date, now);
  const d = dayLabel(plan.date, now);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return n > 1 && n < 7 ? d : `on ${d}`;
}

/** The group invite: what, when, where, and a link to answer and vote. */
export function inviteText(plan, link, now = new Date()) {
  const { game } = planChoice(plan);
  const t = timeLabel(plan.teeTime);
  return [
    `Golf ${dayWords(plan, now)}${t ? ` at ${t}` : ''}? ${plan.course?.name || ''}.`.replace(' .', '.'),
    `Thinking ${GAMES[game]?.name || 'a game'}. Tap to say if you’re in and vote on the game and the bet:`,
    link,
  ].filter(Boolean).join('\n');
}

/** A nudge to one person who hasn't answered yet, with their own link. */
export function nudgeText(plan, name, link, now = new Date()) {
  const t = timeLabel(plan.teeTime);
  return [`Hey ${first(name) || 'there'}, you in for golf ${dayWords(plan, now)}? ${plan.course?.name || ''}${t ? `, ${t}` : ''}.`, 'Tap to answer:', link].filter(Boolean).join('\n');
}

/** A nudge to the whole group for the answers still missing. */
export function nudgeAllText(plan, link, now = new Date()) {
  return [`Still need answers for golf ${dayWords(plan, now)}. In, maybe or out? Vote on the game and the bet while you’re there:`, link].filter(Boolean).join('\n');
}

/** The morning-of text: tee time, who's in, and the group's game and bet. */
export function morningText(plan, link, settings, now = new Date()) {
  const { game, bet } = planChoice(plan);
  const ins = planPeople(plan).filter(p => p.status === 'in').map(p => first(p.name));
  const t = timeLabel(plan.teeTime);
  const n = daysUntil(plan.date, now);
  const lead = n === 0 ? 'Golf today!' : n === 1 ? 'Golf tomorrow!' : `Golf ${dayWords(plan, now)}!`;
  const bets = bet && settings?.[game] ? betLabel(game, settings, bet) : '';
  return [
    `${lead} ${plan.course?.name || ''}${t ? `, tee time ${t}` : ''}.`.replace(' ,', ','),
    ins.length ? `In: ${listNames(ins)}.` : null,
    GAMES[game] ? `Game: ${GAMES[game].name}${bets ? `, ${bets}` : ''}.` : null,
    link,
  ].filter(Boolean).join('\n');
}

// --------------------------- sharing ----------------------------------------

/** Fields that stay on this phone and never go into the shared plan. */
// `unsent` and `metaUnsent` are this phone's own retry flags; a friend's phone taking the
// organizer's copy would resend (and so overwrite) answers that were never theirs.
const LOCAL_ONLY = ['code', 'host', 'answers', 'localMe', 'syncedAt', 'gone', 'unsent', 'metaUnsent', 'roundId'];

/** The shared part of a plan (what friends' phones read). */
export function planMeta(plan) {
  const meta = {};
  for (const [k, v] of Object.entries(plan)) if (!LOCAL_ONLY.includes(k)) meta[k] = v;
  return meta;
}

/** Answers keyed by who, from the RSVP and vote rows the server keeps. */
export function answersFrom(rsvps = [], votes = []) {
  const out = {};
  for (const r of rsvps) {
    if (!r?.who || !RSVPS.includes(r.status)) continue;
    out[r.who] = { name: r.name, status: r.status, at: r.at || 0, ...(r.payApp && r.payHandle ? { payApp: r.payApp, payHandle: r.payHandle } : {}) };
  }
  for (const v of votes) {
    if (!v?.who || !out[v.who] || v.choice == null) continue;
    if (v.kind === 'game') out[v.who].game = String(v.choice);
    if (v.kind === 'bet' && Number(v.choice) > 0) out[v.who].bet = Number(v.choice);
  }
  return out;
}

/** Tidy a name typed on the RSVP card: trimmed, single spaces, at most 24 characters. */
export function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

/** The link friends open: the whole group, or one person's own (so it knows who they are). */
export function planLink(origin, code, who = null) {
  return `${origin}/?plan=${code}${who ? `&p=${encodeURIComponent(who)}` : ''}`;
}

/**
 * A new plan from the setup screens. The organizer is on it and in, and their suggestion is
 * their own vote until they change it.
 */
export function newPlan({ id, hostWho = HOST, hostName, game, holesCount, nine, date, teeTime, course, people, ballot, suggestedBet, useHc = true, now = Date.now() }) {
  const games = [game, ...(ballot?.games || []).filter(g => g !== game && GAMES[g])].slice(0, MAX_BALLOT_GAMES);
  const bets = [...new Set([...(ballot?.bets || []), suggestedBet].filter(b => Number(b) > 0).map(Number))].sort((a, b) => a - b);
  const hostFirst = first(hostName);
  const others = (people || []).filter(p => p.id !== hostWho).map(p => ({ id: p.id, name: first(p.name) || 'Friend' }));
  return {
    id, v: 1, status: 'planned', createdAt: now, host: true,
    hostWho, hostName: hostFirst,
    game, holesCount, nine: nine || 'front', date, teeTime: teeTime || null, useHc,
    course: course ? { id: course.id, name: course.name, city: course.city || null } : null,
    people: [{ id: hostWho, name: hostFirst || 'Me' }, ...others],
    ballot: { games, bets },
    suggested: { game, bet: Number(suggestedBet) || bets[0] || null },
    answers: { [hostWho]: { name: hostFirst || 'Me', status: 'in', game, bet: Number(suggestedBet) || null, at: now } },
    code: null,
  };
}
