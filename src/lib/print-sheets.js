// Printable sheets for an event (ROADMAP area 10, Overnight 14): the pairings an organizer tapes up,
// a sign for every cart, and a results sheet. Leagues aren't built yet, so an event is one of what
// exists: a trip (its schedule's groups, its planned rounds, or its flights), a Big Game (several
// groups, one pot) or one finished round.
//
// Everything here is pure: an event is worked out once from the state (tripEvent, bigEvent,
// roundEvent) as { kind, title, date, course, line, hcNote, sessions, results }, and the sheets are
// rows built from it (pairingPages, cartSigns, resultBlocks and paginate). The results never work
// money out again: they read the same helpers the screens do (roundResults, bigRoundResults and
// tabResults for a round, tripStatus and tripByGame for a trip, bigStatus for a Big Game), so the
// sheet says exactly what Settle up says. Print.jsx draws it all on Letter pages.
//
// - session: { key, label, date, course, groups }: one day or one part of a day.
// - group: { key, n, name, sub, when, hole, players: [{ id, name, hc }], game, bets: [line], matches, keeper }
//   `when` is a tee time ("8:00 AM") and `hole` the start hole, either null when nobody set it
//   (applyStarts fills them from the organizer's pick, or the sheet leaves a line to write on).
// - results: { headline, sub, standings, scoreCol, podium, tables, owes, owesTitle, notes, empty }
import { GAMES, bettingRound, cardOnly, roundResults } from './round.js';
import { money } from './golf.js';
import { countsMoney, points, rewardOutcome, tabResults, unitFmt, wholeByGame, wholePoints } from './play-for.js';
import { bigGroupName, formatIndex, gameLabel, placeLabel, roundPlayerName, scoreLine } from './format.js';
import { bigRoundResults, bigStatus } from './big-money.js';
import { roundStakeLines } from './stakes.js';
import { nameOf } from './ledger.js';
import { tripByGame, tripDates, tripStatus } from './trips.js';
import { CUP_KINDS, cupHeadline, cupPoints } from './cup.js';
import { flightBoard } from './flights.js';
import { cleanFlights, FLIGHT_NAMES } from './flights-clean.js';
import { matchLine, scheduleRounds } from './trip-templates.js';
import { HOST, betLabel, planChoice, planPeople, planRules, timeLabel } from './plans.js';
import { BIG_BET_KINDS, POT_KINDS, bigSummary, placesLabel } from './big-game.js';
import { toParText } from './big-view.js';
import { BIG_FORMAT } from './big-format.js';
import { heldNote, keepsMoneyPrivate } from './share.js';

/** Two to a cart. */
export const CART_SIZE = 2;
/** Group cards on a pairings page: two across, three down. */
export const GROUPS_PER_PAGE = 6;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Player';
const listNames = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** A calendar day ("YYYY-MM-DD") or a time in ms as "Sat, Oct 17, 2026", or '' for neither. */
export function longDate(v) {
  let d = null;
  if (typeof v === 'string') {
    const [y, m, day] = v.split('-').map(Number);
    if (y && m && day) d = new Date(y, m - 1, day);
  } else if (Number.isFinite(v) && v > 0) d = new Date(v);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** A course handicap as it prints: "12", "+2" for a plus handicap, null for none. */
export function hcText(v) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return null;
  const n = Math.round(Number(v));
  return n < 0 ? `+${-n}` : String(n);
}

/** A handicap index as it prints ("12.4", "+1.0"), or null for none. */
const indexText = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : formatIndex(Number(v)));

/**
 * A list cut into `size`-ish groups as even as they go: ceil(n / size) groups, the bigger ones
 * first, so 6 by fours is 3 and 3 and 9 is 3, 3 and 3, never a lone player at the end.
 */
export function balancedChunks(list, size = 4) {
  const n = list.length;
  if (!n) return [];
  const k = Math.ceil(n / Math.max(1, size));
  const base = Math.floor(n / k), extra = n % k;
  const out = [];
  let at = 0;
  for (let i = 0; i < k; i++) {
    const len = base + (i < extra ? 1 : 0);
    out.push(list.slice(at, at + len));
    at += len;
  }
  return out;
}

/** Players in carts, two to a cart in the group's order (partners side by side): the odd one out rides alone. */
export function cartPairs(players) {
  const out = [];
  for (let i = 0; i < (players || []).length; i += CART_SIZE) out.push(players.slice(i, i + CART_SIZE));
  return out;
}

/**
 * A trip's flights as groups to play in: each flight split into groups of up to `size` as even as
 * they go, numbered across the whole field ("Group 1" is in flight A). `hcOf(id)` gives an index.
 */
export function groupsFromFlights(flights, { size = 4, hcOf = () => null } = {}) {
  const list = cleanFlights(flights) || [];
  const out = [];
  list.forEach((flight, f) => {
    for (const chunk of balancedChunks(flight, size)) {
      const n = out.length + 1;
      out.push(group({ key: `f${f}g${n}`, n, sub: `Flight ${FLIGHT_NAMES[f]}`, players: chunk.map(p => ({ id: p.id, name: p.name, hc: indexText(hcOf(p.id)) })) }));
    }
  });
  return out;
}

const group = g => ({ key: g.key, n: g.n, name: g.name || `Group ${g.n}`, sub: g.sub || null, when: g.when || null, hole: g.hole ?? null, players: g.players || [], game: g.game || null, bets: g.bets || [], matches: g.matches || null, keeper: g.keeper || null });

const pad2 = n => String(n).padStart(2, '0');
/** "08:00" plus `min` minutes, as "HH:MM" (wraps past midnight). */
function addMinutes(t, min) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  const at = ((m ? Number(m[1]) * 60 + Number(m[2]) : 8 * 60) + min) % (24 * 60);
  return `${pad2(Math.floor(at / 60))}:${pad2(at % 60)}`;
}

/**
 * Where `count` groups start, as the organizer picked on the print screen:
 * - 'tee': off the first tee from `first`, `gap` minutes apart ([{ when: "8:00 AM", hole: 1 }, { when: "8:10 AM", hole: 1 }, ...]);
 * - 'shotgun': everyone at `first`, spread around the course (3 groups on 18: holes 1, 7 and 13;
 *   more groups than holes doubles up as "1A", "1B");
 * - anything else: nothing set, so the sheets leave a line to write on.
 */
export function startSlots(count, { mode = 'none', first: at = '08:00', gap = 10, holes = 18 } = {}) {
  const n = Math.max(0, count | 0);
  if (mode === 'tee') return Array.from({ length: n }, (_, i) => ({ when: timeLabel(addMinutes(at, i * gap)), hole: 1 }));
  if (mode === 'shotgun') {
    const h = Math.max(1, holes | 0);
    return Array.from({ length: n }, (_, i) => {
      if (n <= h) return { when: timeLabel(addMinutes(at, 0)), hole: Math.floor((i * h) / n) + 1 };
      return { when: timeLabel(addMinutes(at, 0)), hole: `${(i % h) + 1}${'ABCD'[Math.floor(i / h)] || ''}` };
    });
  }
  return Array.from({ length: n }, () => ({ when: null, hole: null }));
}

/** Whether a session has no start for any group yet, so the organizer can pick one. */
const unset = s => s.groups.length > 0 && s.groups.every(g => !g.when && g.hole == null);
/** Whether any session of the event could use a start picked on the print screen. */
export const needsStarts = event => !!event?.sessions?.some(unset);

/** The event with starts filled in from the organizer's pick, only in sessions that have none of their own. */
export function applyStarts(event, opts = {}) {
  if (!event) return event;
  return {
    ...event,
    sessions: event.sessions.map(s => {
      if (!unset(s)) return s;
      const slots = startSlots(s.groups.length, { ...opts, holes: opts.holes || s.holes || 18 });
      return { ...s, groups: s.groups.map((g, i) => ({ ...g, ...slots[i] })) };
    }),
  };
}

/** "Hole 7 · 8:10 AM", "8:00 AM", or null when neither is set. */
export function startText(g) {
  return [g.hole != null ? `Hole ${g.hole}` : null, g.when].filter(Boolean).join(' · ') || null;
}

/**
 * What's on the line for a group, in one line: its game (or, with none of its own, the game across
 * the field) and its bets.
 */
export function lineFor(g, event) {
  return [g.game || event?.line, ...(g.bets || [])].filter(Boolean).join(' · ') || null;
}

/**
 * The pairings sheet's pages: each session's groups, up to GROUPS_PER_PAGE a page, a session never
 * sharing a page with the next. [{ key, session, groups, part, parts }].
 */
export function pairingPages(event, { perPage = GROUPS_PER_PAGE } = {}) {
  const out = [];
  for (const s of event?.sessions || []) {
    const chunks = [];
    for (let i = 0; i < s.groups.length; i += perPage) chunks.push(s.groups.slice(i, i + perPage));
    chunks.forEach((groups, i) => out.push({ key: `${s.key}-${i}`, session: s, groups, part: i + 1, parts: chunks.length }));
  }
  return out;
}

/**
 * One sign a cart, in order: [{ key, session, group, start, cart, carts, names, line, matches }].
 * Two names a cart; a group with an odd number has one cart with one name.
 */
export function cartSigns(event) {
  const out = [];
  for (const s of event?.sessions || []) {
    for (const g of s.groups) {
      const carts = cartPairs(g.players);
      carts.forEach((two, i) => out.push({
        key: `${s.key}-${g.key}-${i}`, session: s.label || null, group: g.name, start: startText(g),
        cart: i + 1, carts: carts.length, names: two.map(p => p.name), line: lineFor(g, event), matches: g.matches,
      }));
    }
  }
  return out;
}

// --------------------------- a round ---------------------------------------------

/** A round's group for the sheets: its players (with course handicaps when it uses them), start hole, game and bets. */
export function roundGroup(round, n = 1, { name = null } = {}) {
  const sides = round.bets?.length ? [`${round.bets.length} side bet${round.bets.length === 1 ? '' : 's'}`] : [];
  const playerName = id => round.players.find(p => p.id === id)?.name;
  return group({
    key: round.id, n, name: name || `Group ${n}`,
    hole: round.holes?.[0]?.no ?? null,
    players: round.players.map(p => ({ id: p.id, name: p.name, hc: round.useHandicaps ? hcText(p.courseHc) : null })),
    game: cardOnly(round) ? null : gameLabel(round),
    bets: cardOnly(round) ? [] : [...roundStakeLines(round).map(l => l.line).filter(Boolean), ...sides],
    matches: round.cup?.sides ? `${CUP_KINDS[round.cup.kind]?.name || 'Match'}: ${matchLine(round.cup, playerName)}` : null,
  });
}

/** One finished (or live) round as an event: its group and, once it's done, its results. */
export function roundEvent(state, round) {
  if (!round) return null;
  // A Big Game group's round goes by its group's name
  const code = round.shareCode || round.shared?.code || null;
  const big = round.trip?.format === BIG_FORMAT ? (round.trip.big?.groups || []).find(g => g && ((g.roundId && g.roundId === round.id) || (code && g.code === code)))?.name || null : null;
  return {
    kind: 'round', id: round.id,
    title: round.course?.name || 'Round',
    date: longDate(round.finishedAt || round.createdAt),
    course: round.trip?.name || null,
    line: null,
    hcNote: round.useHandicaps ? `Course handicaps${round.hcPct && round.hcPct !== 100 ? `, strokes at ${round.hcPct}%` : ''}.` : null,
    sessions: [{ key: 'round', label: null, date: null, course: null, holes: round.holes?.length || 18, groups: [roundGroup(round, 1, { name: big || 'The group' })] }],
    results: round.status === 'done' ? roundSheetResults(state, round) : null,
  };
}

/** A row of a standings list as it prints. */
const standRow = (id, place, name, value, extra = {}) => ({ id, place: String(place), name, value, score: null, sub: null, ...extra });

/**
 * A finished round's results, from exactly what its results screen shows (RoundDetail.jsx): the
 * standings and money from roundResults (a Big Game group's from bigRoundResults), who pays who
 * from the same transfers, and the by-game table from the same byGame, in whole points for a
 * points round the way the app's table adds them up.
 */
export function roundSheetResults(state, round) {
  const own = roundResults(round);
  const res = bigGroupName(round) ? bigRoundResults(state, round, own) : own;
  const fmt = unitFmt(round);
  const isMoney = countsMoney(round);
  const tab = tabResults(round, own);
  const betRound = bettingRound(round);
  const notes = [];
  if (cardOnly(round)) {
    const standings = round.players.map(p => standRow(p.id, '–', p.name, scoreLine(round, p.id) || '–'));
    return { headline: 'Just keeping score', sub: null, standings, scoreCol: false, valueLabel: 'Score', podium: [], tables: [], owes: [], owesTitle: null, notes: ['Nobody had a bet on this round, so there’s no money or points.'] };
  }
  const st = res.standings;
  const pending = !!(res.big && !res.big.final);
  const allSquare = st.every(p => p.amount === 0);
  const top = st[0];
  const leaders = st.filter(p => p.amount === top?.amount);
  let headline;
  if (pending) headline = 'Waiting on the other groups';
  else if (allSquare) headline = 'All square';
  else if (leaders.length > 1) {
    const side = round.teams?.find(tm => tm.players.length === leaders.length && tm.players.every(pid => leaders.some(p => p.id === pid)));
    headline = side ? `${side.name} win the day` : `${listNames(leaders.map(p => first(p.name)))} tie for top`;
  } else headline = `${top.name} wins the day`;
  const standings = st.map((p, i) => standRow(p.id, placeLabel(st, i), p.name, fmt(p.amount, { sign: true }), { amount: p.amount, score: scoreLine(round, p.id) || '–' }));
  const podium = st.length >= 3 && !allSquare && !pending ? standings.slice(0, 3) : [];

  // The by-game table: the same numbers as the results screen's, a row a player
  const tables = [];
  const ids = new Set(betRound.players.map(p => p.id));
  const rowsFor = st.filter(p => ids.has(p.id));
  const byGameTable = (title, byGame, total, f) => {
    const games = Object.entries(byGame);
    const whole = f === points ? wholeByGame(byGame, betRound.players.map(p => p.id), total) : null;
    return {
      title, columns: [...games.map(([, g]) => g.label), 'Total'],
      rows: rowsFor.map(p => ({
        name: p.name,
        cells: [...games.map(([key, g]) => f(whole ? whole[key][p.id] : g.balances[p.id] || 0, { sign: true })), f(whole ? wholePoints(total[p.id]) : total[p.id] || 0, { sign: true })],
      })),
    };
  };
  if (res.detail?.byGame && Object.keys(res.detail.byGame).length) tables.push(byGameTable('By game', res.detail.byGame, res.balances, fmt));
  if (res.cash) tables.push(byGameTable('Side bets for money', { cash: { label: res.cash.label, balances: res.cash.balances } }, res.cash.balances, money));

  // Who pays who: the money round's transfers, or a points round's side bets for money
  let owes = [], owesTitle = null;
  const pay = list => list.map(t => ({ from: roundPlayerName(round, t.from), to: roundPlayerName(round, t.to), amount: money(t.amount) }));
  if (isMoney) {
    // A Big Game group's money is settled once on the game's page: the sheet says so instead
    owesTitle = res.big ? null : 'Who pays who';
    if (res.big) notes.push(res.big.final ? `${round.trip.name} is settled once for the whole game, on its page.` : `${round.trip.name} is decided once every group is in. It’s settled once, on its page.`);
    else {
      owes = pay(res.transfers);
      if (!owes.length) notes.push('Nobody owes anybody.');
      else notes.push(round.trip?.format === 'big' ? `Fewest payments for this round alone. It’s part of ${round.trip.name}, so it’s settled once with the whole game.`
        : round.trip?.id ? 'Fewest payments for this round alone. It’s on the trip, so it’s settled once with the trip’s other rounds.'
        : 'Fewest payments to square everyone up.');
    }
  } else {
    const reward = rewardOutcome(round, res);
    notes.push(reward ? reward.text : 'Played for points, so nothing goes on the Tab. Just bragging rights.');
    if (res.cash) {
      owesTitle = 'Side bets for money';
      owes = pay(tab.transfers);
      if (!owes.length) notes.push('The money bets came out square.');
    }
  }
  return { headline, sub: [gameLabel(round), `${round.holes.length} holes`].join(' · '), standings, scoreCol: true, valueLabel: isMoney ? 'Money' : 'Points', podium, tables, owes, owesTitle, notes };
}

// --------------------------- a trip ----------------------------------------------

/** A person's full name on this phone, else the name the record has. */
const fullName = (state, id, fallback) => (state.players?.[id]?.name || fallback || nameOf(state, id) || 'Player');

/** A planned round's group: who's in or invited (not out), its tee time, course, game and bet. */
function planGroup(state, plan, n) {
  const settings = planRules(plan, state.settings);
  const { game, bet } = planChoice(plan);
  const g = game || plan.game;
  const people = planPeople(plan).filter(p => p.status !== 'out');
  const idOf = who => (who === HOST && plan.host ? state.me : who);
  const players = people.map(p => {
    const id = idOf(p.who);
    return { id, name: plan.host ? fullName(state, id, p.name) : p.name, hc: plan.useHc ? indexText(state.players?.[id]?.index) : null };
  });
  const cup = plan.cup?.sides ? plan.cup : null;
  const nameById = id => players.find(p => p.id === idOf(id))?.name || state.players?.[id]?.name || 'Player';
  const line = betLabel(g, settings, bet || plan.suggested?.bet, plan.holesCount || 18);
  return group({
    key: plan.id, n, name: `Group ${plan.session?.group || n}`,
    when: timeLabel(plan.teeTime) || null, hole: plan.setup?.startHole ?? null,
    players, game: GAMES[g]?.name || null, bets: line ? [line] : [],
    matches: plan.session?.line ? `${CUP_KINDS[plan.session.kind]?.name || 'Match'}: ${plan.session.line}` : cup ? `${CUP_KINDS[cup.kind]?.name || 'Match'}: ${matchLine(cup, nameById)}` : null,
  });
}

/**
 * A trip as an event. Its groups, in the first way that has some:
 * - a Trip Mode schedule with its teams picked: every session's groups and matches as the schedule
 *   works them out on every phone, with the tee time and course from the round's plan when this
 *   phone has it;
 * - else the rounds planned for it (and any being played now), day by day;
 * - else its handicap flights, in groups of four.
 * The results are the trip's standings, money by game and Settle the trip's payments.
 */
export function tripEvent(state, id, { now = Date.now() } = {}) {
  const st = tripStatus(state, id, { now });
  if (!st) return null;
  if (st.trip.format === BIG_FORMAT) return bigEvent(state, id, { now, st });
  const { trip, cup } = st;
  let sessions = [];
  const def = cup?.def;
  if (def?.schedule && trip.start) {
    const teams = def.teams.map(t => t.map(p => p.id));
    const names = new Map(def.teams.flat().map(p => [p.id, p.name]));
    const plans = Object.values(state.plans || {}).filter(p => p?.session?.trip === id && !p.gone);
    const byKey = new Map(plans.map(p => [p.session.key, p]));
    const map = new Map();
    for (const r of scheduleRounds(def.schedule, teams, { start: trip.start })) {
      const plan = byKey.get(r.key);
      const date = plan?.date || r.date;
      const k = `d${r.day}s${r.session}`;
      const s = map.get(k) || { key: k, label: `Day ${r.day} · ${r.label}${r.worth > 1 ? ` · ${r.worth} points a match` : ''}`, date: longDate(date), course: plan?.course?.name || r.course?.name || null, holes: 18, groups: [] };
      const name = pid => fullName(state, pid, names.get(pid));
      const line = plan ? betLabel(r.game, planRules(plan, state.settings), planChoice(plan).bet || plan.suggested?.bet, plan.holesCount || 18) : '';
      s.groups.push(group({
        key: r.key, n: r.group, when: timeLabel(plan?.teeTime || r.teeTime) || null, hole: plan?.setup?.startHole ?? null,
        players: r.players.map(pid => ({ id: pid, name: name(pid), hc: indexText(state.players?.[pid]?.index) })),
        game: GAMES[r.game]?.name || null, bets: line ? [line] : [],
        matches: `${CUP_KINDS[r.kind].name}: ${matchLine(r.cup, name)}`,
      }));
      map.set(k, s);
    }
    sessions = [...map.values()];
  }
  if (!sessions.length) {
    const byDate = new Map();
    const add = (date, g, course) => {
      const s = byDate.get(date) || { key: `p${date}`, label: null, date: longDate(date), course: course || null, holes: 18, groups: [] };
      if (course && s.course && s.course !== course) s.course = 'Courses below';
      s.groups.push(g);
      byDate.set(date, s);
    };
    const live = st.live.map(r => ({ r, date: isoDay(r.createdAt) }));
    for (const { r, date } of live) add(date, roundGroup(r, 0), r.course?.name);
    for (const p of st.planned) add(p.date, planGroup(state, p, 0), p.course?.name);
    sessions = [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key))
      .map(s => ({ ...s, groups: s.groups.map((g, i) => ({ ...g, n: i + 1, name: `Group ${i + 1}` })) }));
  }
  if (!sessions.length && cleanFlights(trip.flights)) {
    sessions = [{ key: 'flights', label: 'Groups by flight', date: longDate(trip.start), course: trip.where || null, holes: 18, groups: groupsFromFlights(trip.flights, { hcOf: pid => state.players?.[pid]?.index }) }];
  }
  const line = def ? `${def.names[0]} v ${def.names[1]}${def.stake ? ` · ${money(def.stake)} a player on the cup` : ''}` : null;
  return {
    kind: 'trip', id,
    title: trip.name,
    date: [tripDates(trip), trip.start ? trip.start.slice(0, 4) : null].filter(Boolean).join(', '),
    course: trip.where || null,
    line,
    hcNote: sessions.some(s => s.groups.some(g => g.players.some(p => p.hc))) ? 'Handicap index for each player.' : null,
    sessions,
    results: tripSheetResults(state, st),
  };
}

const isoDay = t => { const d = new Date(t || Date.now()); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

/**
 * A trip's results from its status (trips.js tripStatus), as the trip's page has them: the money
 * standings (or points for a trip played for points), the cup, money by game (tripByGame, the cup
 * stake its own column), everyone all in with the expenses, and Settle the trip's payments.
 */
export function tripSheetResults(state, st) {
  const name = id => nameOf(state, id) || 'Player';
  const notes = [];
  const tables = [];
  let standings = [];
  let valueLabel = 'Money';
  if (st.standings.length) {
    standings = st.standings.map((p, i) => standRow(p.id, placeLabel(st.standings, i), name(p.id), money(p.amount, { sign: true }), {
      amount: p.amount,
      sub: [p.rounds < st.done.length ? `${p.rounds} of ${st.done.length} rounds` : null, p.stake != null ? `${money(p.stake, { sign: true })} from the cup` : null].filter(Boolean).join(' · ') || null,
    }));
  } else if (st.points) {
    valueLabel = 'Points';
    const rows = Object.entries(st.points).sort((a, b) => b[1] - a[1]);
    standings = rows.map(([pid, v]) => standRow(pid, rows.findIndex(r => r[1] === v) + 1, name(pid), points(v, { sign: true }), { amount: v }));
  }
  const cup = st.cup;
  if (!standings.length && !(cup && cup.score.done)) {
    return { empty: 'The results fill in as soon as a round for the trip is finished.', standings: [], podium: [], tables: [], owes: [], notes: [] };
  }
  const allSquare = standings.every(p => p.amount === 0);
  const podium = standings.length >= 3 && !allSquare ? standings.slice(0, 3) : [];

  if (cup) {
    const [a, b] = cup.score.points;
    tables.push({ title: 'The cup', columns: ['Points'], rows: [{ name: cup.names[0], cells: [cupPoints(a)] }, { name: cup.names[1], cells: [cupPoints(b)] }] });
    if (cup.leaderboard.length) {
      tables.push({ title: 'Cup leaderboard', columns: ['Team', 'W-L-H', 'Points'], rows: cup.leaderboard.map(r => ({ name: r.id ? name(r.id) : r.name, cells: [cup.names[r.team], `${r.won}-${r.lost}-${r.halved}`, cupPoints(r.points)] })) });
    }
  }
  const { columns, rows } = tripByGame(state, st.trip.id, { stake: cup?.stakeBy });
  if (columns.length) {
    const order = st.standings.map(p => p.id).filter(pid => rows.has(pid));
    tables.push({
      title: 'Money by game', columns: [...columns, 'Trip'],
      rows: order.map(pid => {
        const row = rows.get(pid);
        const tot = st.standings.find(p => p.id === pid)?.amount ?? 0;
        return { name: name(pid), cells: [...columns.map(c => (c in row ? money(row[c], { sign: true }) : '–')), money(tot, { sign: true })] };
      }),
    });
  }
  if (st.expenses.length && st.totals.length) {
    tables.push({ title: 'All in, with the expenses', columns: ['Golf', 'Expenses', 'All in'], rows: st.totals.map(p => ({ name: name(p.id), cells: [money(p.golf, { sign: true }), money(p.expenses, { sign: true }), money(p.amount, { sign: true })] })) });
  }
  const board = flightBoard(state, st.trip).filter(f => f.rows.some(r => r.rounds));
  for (const f of board) {
    tables.push({ title: `Flight ${f.flight}, net to par`, columns: ['Rounds', 'Net'], rows: f.rows.map(r => ({ name: r.name, cells: [String(r.rounds), r.net == null ? '–' : toParText(r.net)] })) });
  }
  // Settle the trip: the same lines as its screen, and the cup stake's lines marked paid on the trip
  const owes = st.plan.map(t => ({ from: name(t.from), to: name(t.to), amount: money(t.amount) }));
  if (cup) for (const l of cup.lines.filter(x => x.open > 0 && !x.onTab)) owes.push({ from: l.fromId ? name(l.fromId) : l.fromName, to: l.toId ? name(l.toId) : l.toName, amount: money(l.open / 100) });
  if (st.phase === 'ready') notes.push(`${owes.length} payment${owes.length === 1 ? '' : 's'} square${owes.length === 1 ? 's' : ''} the trip, the rounds${st.expenses.length ? ' and the expenses' : ''} together.`);
  else if (st.phase === 'square') notes.push('Everyone’s square on the trip.');
  else if (owes.length) notes.push('Not final: the trip is still being played, so these are the payments so far. Settle the trip opens after the last round.');
  const headline = cup ? cupHeadline(cup) : st.phase === 'ready' || st.phase === 'square' ? 'Final standings' : 'Standings so far';
  const sub = `${st.done.length} round${st.done.length === 1 ? '' : 's'} finished${st.live.length ? `, ${st.live.length} being played` : ''}`;
  return { headline, sub, standings, scoreCol: false, valueLabel, podium, tables, owes, owesTitle: owes.length || st.phase === 'ready' ? 'Settle the trip' : null, notes };
}

// --------------------------- a Big Game -----------------------------------------

/**
 * A Big Game as an event: its groups (a group whose round has started starts where its card does),
 * what's on the line across the field, and once its groups are in, the results.
 */
export function bigEvent(state, id, { now = Date.now(), st = tripStatus(state, id, { now }) } = {}) {
  const bs = st?.big || bigStatus(state, id);
  if (!st || !bs) return null;
  const { trip } = st;
  const { big, field } = bs;
  const name = pid => big.people[pid]?.name || nameOf(state, pid) || 'Player';
  const groups = field.groups.map((g, i) => group({
    key: g.id, n: i + 1, name: g.name,
    hole: g.card?.holes?.[0]?.no ?? null,
    players: g.players.map(pid => ({ id: pid, name: name(pid), hc: big.useHandicaps ? hcText(field.players.get(pid)?.hc ?? big.people[pid]?.hc) : null })),
    bets: big.bets.filter(b => b.sides.some(s => g.players.includes(s))).map(b => `${first(name(b.sides[0]))} v ${first(name(b.sides[1]))}: ${money(b.stake)} ${BIG_BET_KINDS[b.kind]?.label.toLowerCase() || 'bet'}`),
    keeper: g.keeper ? `${first(name(g.keeper))} keeps score` : null,
  }));
  const where = trip.where || bs.rounds.find(r => r.course?.name)?.course.name || null;
  return {
    kind: 'big', id,
    title: trip.name,
    date: longDate(trip.start),
    course: where,
    line: bigSummary(big, money) || null,
    hcNote: big.useHandicaps ? `Course handicaps. Strokes at ${big.hcPct}% of each one, across the whole field.` : null,
    sessions: [{ key: 'big', label: null, date: null, course: null, holes: field.holes.length || 18, groups }],
    results: bigSheetResults(state, st, bs),
  };
}

/**
 * A Big Game's results as its page has them (BigGame.jsx): the pot's board (or the money, with no
 * pot), the money table by part once every group is in (pot, skins, teams, bets, in cents), and
 * Settle the game's payments (the trip's plan, the same lines as its Money view).
 */
export function bigSheetResults(state, st, bs) {
  const { big, results } = bs;
  const name = pid => big.people[pid]?.name || nameOf(state, pid) || 'Player';
  if (!bs.started) return { empty: 'The results fill in once the groups tee off.', standings: [], podium: [], tables: [], owes: [], notes: [] };
  const final = bs.final;
  const groupName = gid => big.groups.find(g => g.id === gid)?.name || null;
  let standings, valueLabel, scoreCol;
  const bal = pid => (results.balances[pid] || 0) / 100;
  if (big.pot.on) {
    const stableford = big.pot.kind === 'stableford';
    scoreCol = final;
    valueLabel = final ? 'Money' : stableford ? 'Points' : 'To par';
    const score = r => (stableford ? (r.thru ? `${r.points} pts` : '–') : toParText(r.toPar));
    standings = results.pot.map(r => standRow(r.id, r.place, name(r.id), final ? money(bal(r.id), { sign: true }) : score(r), {
      score: final ? score(r) : null, amount: bal(r.id),
      sub: [groupName(r.group), r.thru ? (r.complete ? 'done' : `thru ${r.thru}`) : null, final && results.money.pot.won?.[r.id] ? `wins ${money(results.money.pot.won[r.id] / 100)} of the pot` : null].filter(Boolean).join(' · ') || null,
    }));
  } else {
    scoreCol = false;
    valueLabel = 'Money';
    const ids = Object.keys(big.people).sort((a, b) => bal(b) - bal(a) || name(a).localeCompare(name(b)));
    const rows = ids.map(pid => ({ id: pid, amount: bal(pid) }));
    standings = ids.map((pid, i) => standRow(pid, final ? placeLabel(rows, i) : '–', name(pid), final ? money(bal(pid), { sign: true }) : '–', { amount: bal(pid), sub: groupName(big.groups.find(g => g.players.includes(pid))?.id) }));
  }
  const podium = final && standings.length >= 3 && standings[0].place !== '–' ? standings.slice(0, 3) : [];
  const tables = [];
  const notes = [];
  if (final) {
    const m = results.money;
    const cols = [big.pot.on && ['pot', 'Pot'], big.skins.on && ['skins', 'Skins'], big.teams.on && ['teams', 'Teams'], big.bets.length > 0 && ['bets', 'Bets']].filter(Boolean);
    const ids = Object.keys(big.people).filter(pid => big.groups.some(g => g.players.includes(pid)))
      .sort((a, b) => (results.balances[b] || 0) - (results.balances[a] || 0) || name(a).localeCompare(name(b)));
    tables.push({
      title: 'Money by part', columns: [...cols.map(c => c[1]), 'Total'],
      rows: ids.map(pid => ({ name: name(pid), cells: [...cols.map(([k]) => (pid in (m[k].balances || {}) ? money(m[k].balances[pid] / 100, { sign: true }) : '–')), money(bal(pid), { sign: true })] })),
    });
    notes.push(`${big.pot.on ? `${POT_KINDS[big.pot.kind].name}, ${placesLabel(big.pot.places).toLowerCase()}. ` : ''}Adds up to $0 across the game. The pot and skins pay what each person won less their buy-in.`);
  } else {
    notes.push(`Not final: ${bs.waiting.length ? `still waiting on ${bs.waiting.map(g => g.name).join(', ')}` : 'groups are still out there'}. Nothing is paid until every group is in.`);
  }
  const short = x => big.people[x]?.name || nameOf(state, x) || 'Player';
  const owes = final ? st.plan.map(t => ({ from: short(t.from), to: short(t.to), amount: money(t.amount) })) : [];
  if (final && !owes.length) notes.push('Everyone’s square on the game.');
  return {
    headline: final ? (bs.ended ? 'Final, closed early' : 'Final results') : 'Standings so far',
    sub: `${big.groups.length} groups · ${Object.keys(big.people).length} players`,
    standings, scoreCol, valueLabel, podium, tables, owes, owesTitle: final ? 'Settle the game' : null, notes,
  };
}

// --------------------------- the results sheet's pages ---------------------------

/**
 * How tall a block is, in rows of a table (about 2em, 0.3 inch on paper), measured off the pages as
 * Print.jsx draws them: a section's title is 1.5 rows, a table's column heads about 1, a standing
 * with a line under the name 1.6. A page has about 29 rows under the big header and 31 after.
 */
export function blockSize(b) {
  if (!b.rows) return b.size || 1;
  return (b.title ? 1.5 : 0) + (b.columns ? 0.95 : 0) + b.rows.length * (b.rowSize || 1) + 0.2;
}

/**
 * The results as blocks to lay out on pages: the headline, the podium, the standings, each table,
 * who pays who and the notes. A block with rows can be split across pages.
 */
export function resultBlocks(results) {
  if (!results) return [];
  if (results.empty) return [{ kind: 'empty', text: results.empty, size: 3 }];
  const out = [{ kind: 'headline', text: results.headline, sub: results.sub, size: 2.2 }];
  if (results.podium?.length) out.push({ kind: 'podium', rows: null, items: results.podium, size: 8 });
  if (results.standings?.length) out.push({ kind: 'standings', title: 'Standings', columns: true, rows: results.standings, scoreCol: results.scoreCol, valueLabel: results.valueLabel, rowSize: results.standings.some(r => r.sub) ? 1.6 : 1 });
  if (results.owesTitle) out.push({ kind: 'owes', title: results.owesTitle, rows: results.owes.length ? results.owes : [{ none: true }] });
  for (const t of results.tables || []) if (t.rows.length) out.push({ kind: 'table', title: t.title, columns: t.columns, rows: t.rows });
  for (const n of results.notes || []) out.push({ kind: 'note', text: n, size: 1 + Math.floor(String(n).length / 110) });
  return out;
}

/**
 * Blocks onto pages: as many as fit on each (`first` rows of room on the first page, under the
 * big header, `rest` on the next), a block with rows split where it runs out of room (at least
 * three rows, or one on a page of its own), the rest carried on with "(continued)". [[block]].
 */
export function paginate(blocks, { first: firstRoom = 28, rest = 30 } = {}) {
  const pages = [[]];
  let left = firstRoom;
  const queue = [...blocks];
  const next = () => { pages.push([]); left = rest; };
  let guard = 0;
  while (queue.length && guard++ < 10000) {
    const b = queue.shift();
    const size = blockSize(b);
    const empty = pages.at(-1).length === 0;
    if (size <= left) { pages.at(-1).push(b); left -= size; continue; }
    if (b.rows && b.rows.length > 1) {
      const rs = b.rowSize || 1;
      const fixed = size - b.rows.length * rs;
      const fit = Math.floor((left - fixed) / rs);
      const min = empty ? 1 : Math.min(3, b.rows.length);
      if (fit >= min && fit < b.rows.length) {
        pages.at(-1).push({ ...b, rows: b.rows.slice(0, fit) });
        queue.unshift({ ...b, rows: b.rows.slice(fit), title: b.title && !b.cont ? `${b.title} (continued)` : b.title, cont: true });
        next();
        continue;
      }
    }
    if (empty) { pages.at(-1).push(b); left = 0; continue; }
    queue.unshift(b);
    next();
  }
  return pages.filter(p => p.length);
}

// --------------------------- any of them ---------------------------------------

const HAS_MONEY = /\$\d/;

/**
 * The results with the money taken off when someone on the sheet keeps their money private
 * (share.js keepsMoneyPrivate, the one profile setting). A printed sheet goes on a wall, so it
 * follows the share card's rule (amountsRule): one person holding theirs back keeps every amount
 * off, since the others' amounts would give theirs away. Places, scores and points stay; the money
 * column reads "–", any table or line under a name with dollars in it goes, and so does who pays
 * who, with a note saying why.
 */
export function holdPrivateMoney(state, results) {
  if (!results || results.empty) return results;
  const seen = new Set();
  const held = [];
  for (const r of results.standings || []) {
    if (r.id == null || seen.has(r.id)) continue;
    seen.add(r.id);
    if (keepsMoneyPrivate(state, r.id)) held.push(first(r.name));
  }
  if (!held.length) return results;
  const isMoney = results.valueLabel === 'Money';
  const hide = r => ({ ...r, value: isMoney || HAS_MONEY.test(String(r.value)) ? '–' : r.value, sub: r.sub && HAS_MONEY.test(r.sub) ? null : r.sub });
  const standings = (results.standings || []).map(hide);
  const byId = new Map(standings.map(r => [r.id, r]));
  const hadOwes = !!results.owesTitle;
  return {
    ...results,
    standings,
    podium: (results.podium || []).map(r => byId.get(r.id) || hide(r)),
    tables: (results.tables || []).filter(t => !t.rows.some(row => row.cells.some(c => HAS_MONEY.test(String(c))))),
    owes: [], owesTitle: null,
    notes: [...(results.notes || []).filter(n => !HAS_MONEY.test(n) && !(hadOwes && /pay|owes|square/i.test(n))), `Amounts stay off: ${heldNote([...new Set(held)])}.`],
  };
}

/** The event for the print screen: { kind: 'round' | 'trip' | 'big', id }, or null when it's gone. */
export function printEvent(state, kind, id, { now = Date.now() } = {}) {
  const event = kind === 'round' ? roundEvent(state, state.rounds?.[id])
    : kind === 'trip' || kind === 'big' ? tripEvent(state, id, { now }) : null;
  return event?.results ? { ...event, results: holdPrivateMoney(state, event.results) } : event;
}

/** Which sheet a print screen opens on: a finished round's results, everything else's pairings. */
export const firstSheet = event => (event?.kind === 'round' && event.results ? 'results' : 'pairings');

/** "Pinehurst · Sat, Oct 17, 2026": who and when, for every page's header and footer. */
export const metaLine = event => [event?.date, event?.course].filter(Boolean).join(' · ');
