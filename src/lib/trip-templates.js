// Trip Mode: a Ryder Cup weekend set up in minutes (2026-10-04). Pick a template for 8, 12, 16 or
// 24 players and the trip comes with its days, each day's sessions (four-ball, foursomes, singles),
// what a match is worth and each session's handicap allowance, agreed before anyone leaves. Once
// the teams are picked (balanced, by flights, or a captains' draft, draft.js) every session's
// matches are worked out from them and each group's round is planned for its day, so the trip's
// rounds are on Up next ready to start, with the right matches, from the roll call.
//
// The schedule lives on the cup (`trip.cup.schedule`, cup.js cleanSchedule), so it rides in the
// trip's stamp like the teams. Each planned round carries its group's matches (`plan.cup`, the
// organizer's player ids) and where it sits in the schedule (`plan.session`), and the roll call
// starts the round with those matches when they still fit the people who showed up (else the
// trip's teams decide, as for any trip round). Partners rotate from session to session, and in
// singles each player meets a different opponent each time, so nobody plays the same match twice
// when the team is big enough. Pure, unit tested.
import { CUP_KINDS, cleanSchedule, cleanWorth, cupOf } from './cup.js';
import { canonicalOf } from './pair-debts.js';
import { betOf, isoDate, newPlan } from './plans.js';
import { setupForPlan } from './plan-setup.js';

export { cleanSchedule };

/** The Ryder Cup weekends to start from: how many players. */
export const TEMPLATE_SIZES = [8, 12, 16, 24];
export const MAX_DAYS = 5;
export const MAX_SESSIONS = 2;
/** The kinds of session, in the order they're offered. */
export const SESSION_KINDS = ['fourball', 'foursomes', 'singles'];

/**
 * Each session's handicap allowance to start with, from the WHS table (allowances.js): four-ball
 * match play 90%, singles 100%. Foursomes is 100% here because the round works the pair's own
 * foursomes handicap out from each player's full one (round.js teamHoleScore).
 */
export const SESSION_PCT = { fourball: 90, foursomes: 100, singles: 100 };

/**
 * The game each session's rounds play as, so the round keeps its own bets too: four-ball is Best
 * ball between the two pairs, foursomes is Alternate shot, and a singles group plays Skins (each of
 * its two singles matches is the cup's; Skins is a bet everyone in the group can be in).
 */
export const SESSION_GAME = { fourball: 'bestball', foursomes: 'altshot', singles: 'skins' };

/** The first group of a session tees off at this time, the next ones 10 minutes apart. */
const SESSION_TEE = ['08:00', '13:00'];
const TEE_GAP = 10;

const session = kind => ({ kind, worth: 1, pct: SESSION_PCT[kind] });

/**
 * A Ryder Cup weekend for `size` players (two teams of size / 2), as { size, days }:
 * - 8: day 1 four-ball then foursomes, day 2 singles (8 points, 4½ wins).
 * - 12: four-ball, then foursomes, then singles, one a day (12 points, 6½ wins).
 * - 16 and 24: two days of four-ball and foursomes, then singles (24 and 36 points).
 * Every match is worth 1 point to start with, and everyone plays every session.
 */
export function ryderTemplate(size) {
  const n = TEMPLATE_SIZES.includes(size) ? size : 8;
  const days = n === 8 ? [['fourball', 'foursomes'], ['singles']]
    : n === 12 ? [['fourball'], ['foursomes'], ['singles']]
    : [['fourball', 'foursomes'], ['fourball', 'foursomes'], ['singles']];
  return { size: n, days: days.map(d => ({ course: null, sessions: d.map(session) })) };
}

/** A new session to add to a day: singles on a day with none, else four-ball. */
export function addSession(schedule, day) {
  const days = schedule.days.map((d, i) => (i === day && d.sessions.length < MAX_SESSIONS ? { ...d, sessions: [...d.sessions, session(d.sessions.some(x => x.kind === 'singles') ? 'fourball' : 'singles')] } : d));
  return { ...schedule, days };
}

/** Another day on the end: singles. */
export function addDay(schedule) {
  if (schedule.days.length >= MAX_DAYS) return schedule;
  return { ...schedule, days: [...schedule.days, { course: null, sessions: [session('singles')] }] };
}

/** Change one session (`patch`: kind, worth or pct). A new kind starts at its own allowance. */
export function setSession(schedule, day, i, patch) {
  const days = schedule.days.map((d, k) => (k !== day ? d : {
    ...d,
    sessions: d.sessions.map((x, j) => (j !== i ? x : { ...x, ...patch, ...(patch.kind && patch.kind !== x.kind && patch.pct == null ? { pct: SESSION_PCT[patch.kind] } : {}) })),
  }));
  return { ...schedule, days };
}

/** Take a session out; a day left with none goes too (the schedule always keeps one session). */
export function removeSession(schedule, day, i) {
  const days = schedule.days.map((d, k) => (k !== day ? d : { ...d, sessions: d.sessions.filter((_, j) => j !== i) })).filter(d => d.sessions.length);
  return days.length ? { ...schedule, days } : schedule;
}

/** How many matches a session has with `perTeam` players a side: one a pair in four-ball and foursomes, one a player in singles. */
export function sessionMatches(kind, perTeam) {
  const n = Math.max(0, Math.floor(perTeam) || 0);
  return CUP_KINDS[kind]?.size === 2 ? Math.floor(n / 2) : n;
}

/**
 * The points on the schedule with `perTeam` players a side: { total, toWin, matches, sessions }.
 * `toWin` is the least that's more than half, so a halved cup is the only tie: 8 points, 4½ wins.
 */
export function schedulePoints(schedule, perTeam) {
  let total = 0, matches = 0, sessions = 0;
  for (const d of schedule?.days || []) {
    for (const s of d.sessions) {
      const m = sessionMatches(s.kind, perTeam);
      matches += m;
      total += m * cleanWorth(s.worth);
      sessions++;
    }
  }
  return { total, toWin: total / 2 + 0.5, matches, sessions };
}

/** "Four-ball", or "Morning four-ball" and "Afternoon foursomes" on a day of two. */
export function sessionLabel(kind, i, count) {
  const name = CUP_KINDS[kind]?.name || 'Matches';
  if (count < 2) return name;
  return `${i === 0 ? 'Morning' : 'Afternoon'} ${name.toLowerCase()}`;
}

/**
 * Partners for the `r`th pairs session from a team's players in order: the circle method, so over
 * n - 1 sessions everyone partners everyone once. [[a, b], ...]; an odd player out is left off.
 */
export function partnersFor(list, r) {
  const n = list.length - (list.length % 2);
  if (n < 2) return [];
  const [fixed, ...rest] = list.slice(0, n);
  const k = rest.length ? r % rest.length : 0;
  const turned = [fixed, ...rest.map((_, i) => rest[(i + k) % rest.length])];
  const out = [];
  for (let i = 0; i < n / 2; i++) out.push([turned[i], turned[n - 1 - i]]);
  return out;
}

/** A day of the trip (YYYY-MM-DD), `n` days after `start`. */
function dayAfter(start, n) {
  const [y, m, d] = String(start).split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/** "08:00" plus `min` minutes. */
function teeAt(t, min) {
  const [h, m] = t.split(':').map(Number);
  const all = h * 60 + m + min;
  return `${String(Math.floor(all / 60) % 24).padStart(2, '0')}:${String(all % 60).padStart(2, '0')}`;
}

/**
 * Why the teams can't be scheduled, or null: both teams need the same number of players, at least
 * one each, and an even number when the schedule has four-ball or foursomes.
 */
export function scheduleProblem(schedule, teams) {
  const [a, b] = (teams || [[], []]).map(t => t.length);
  if (!a || !b) return 'Each team needs players before the rounds can be set up.';
  if (a !== b) return `The teams need the same number of players to set up the rounds. They have ${a} and ${b}.`;
  const pairs = (schedule?.days || []).some(d => d.sessions.some(s => CUP_KINDS[s.kind]?.size === 2));
  if (pairs && a % 2) return `Four-ball and foursomes need an even number a side. Each team has ${a}.`;
  return null;
}

/**
 * Every round of the schedule from the teams (`teams`: [[ids], [ids]], each in the team's order,
 * best first), oldest first: [{ key, day, date, session, sessions, label, kind, worth, pct, group,
 * groups, game, players, teams, cup, teeTime, course }].
 * - Four-ball and foursomes: one round a match, a pair from each team. Partners rotate each pairs
 *   session (partnersFor), and the pairs meet a different pair each time.
 * - Singles: two matches a round (a group of four), the first players on each team against each
 *   other the first time, then each player a place further down the other team each singles day.
 * `cup` is the round's matches in cup.js shape ({ kind, sides, worth? }), `teams` the round's own
 * teams for its game (the pairs), or null for singles. `start`: the trip's first day.
 */
export function scheduleRounds(schedule, teams, { start }) {
  if (scheduleProblem(schedule, teams)) return [];
  const [A, B] = teams;
  const n = A.length;
  const out = [];
  let pairsDone = 0, singlesDone = 0;
  schedule.days.forEach((d, di) => {
    d.sessions.forEach((s, si) => {
      const base = { day: di + 1, date: dayAfter(start, di), session: si + 1, sessions: d.sessions.length, label: sessionLabel(s.kind, si, d.sessions.length), kind: s.kind, worth: cleanWorth(s.worth), pct: s.pct, course: d.course || null, game: SESSION_GAME[s.kind] };
      const groups = [];
      if (CUP_KINDS[s.kind].size === 2) {
        const pa = partnersFor(A, pairsDone), pb = partnersFor(B, pairsDone);
        // Opponents turn too, so a pair meets someone new
        const shift = pb.length ? pairsDone % pb.length : 0;
        pa.forEach((pair, i) => groups.push({ sides: [pair, pb[(i + shift) % pb.length]], teams: true }));
        pairsDone++;
      } else {
        const shift = n ? singlesDone % n : 0;
        const matches = A.map((a, i) => [a, B[(i + shift) % n]]);
        for (let i = 0; i < matches.length; i += 2) {
          const two = matches.slice(i, i + 2);
          groups.push({ sides: [two.map(m => m[0]), two.map(m => m[1])], teams: false });
        }
        singlesDone++;
      }
      groups.forEach((g, gi) => {
        out.push({
          ...base, key: `d${di + 1}s${si + 1}g${gi + 1}`, group: gi + 1, groups: groups.length,
          players: [...g.sides[0], ...g.sides[1]],
          teams: g.teams ? g.sides.map(x => [...x]) : null,
          cup: { kind: s.kind, sides: g.sides.map(x => [...x]), ...(cleanWorth(s.worth) !== 1 ? { worth: cleanWorth(s.worth) } : {}) },
          teeTime: teeAt(SESSION_TEE[si] || SESSION_TEE[0], gi * TEE_GAP),
        });
      });
    });
  });
  return out;
}

/**
 * A round's matches in words, first names: "Trevor & Sam v Mike & Dave", or two singles
 * "Trevor v Mike, Sam v Dave". `name(id)` gives a name.
 */
export function matchLine(cup, name) {
  const first = id => String(name(id) || '').trim().split(/\s+/)[0] || 'Player';
  if (CUP_KINDS[cup.kind]?.size === 2) return `${cup.sides[0].map(first).join(' & ')} v ${cup.sides[1].map(first).join(' & ')}`;
  return cup.sides[0].map((a, i) => `${first(a)} v ${first(cup.sides[1][i])}`).join(', ');
}

/**
 * Where a planned round sits in a trip's schedule, as it rides on the plan (`plan.session`):
 * { trip, key, day, session, label, kind, worth, group, groups, line } (`line`: its matches in words,
 * so every phone with the plan can say who plays whom).
 */
export const sessionOf = (tripId, r, line = null) => ({ trip: tripId, key: r.key, day: r.day, session: r.session, label: r.label, kind: r.kind, worth: r.worth, group: r.group, groups: r.groups, ...(line ? { line } : {}) });

/**
 * The plan for one scheduled round, on the organizer's phone: its day and tee time, the day's
 * course if set, the session's game at the organizer's usual bet (house rules from `settings`), its
 * handicap allowance, and the group already marked in (the organizer too when they're in it, or
 * out of a group they aren't), so the roll call starts with the right four. `setup` keeps the
 * group's order and pairs; `cup` its matches. `players`: the organizer's saved players by id.
 */
export function scheduledPlan(r, { id, tripId, me, players, settings, stamp, now = Date.now() }) {
  const p = pid => players[pid] || { id: pid, name: 'Player' };
  const host = players[me];
  const inIt = r.players.includes(me);
  const people = r.players.filter(pid => pid !== me).map(p);
  const bet = Number(betOf(r.game, settings)) || null;
  const plan = newPlan({
    id, hostName: host?.name || 'Me', game: r.game, holesCount: 18, nine: 'front', date: r.date, teeTime: r.teeTime,
    course: r.course, people, ballot: { games: [r.game], bets: bet ? [bet] : [] }, suggestedBet: bet, settings, useHc: true, hcPct: r.pct,
    setup: setupForPlan({ game: r.game, courseId: r.course?.id || null, holesCount: 18, nine: 'front', me, order: r.players, teams: r.teams }),
    now,
  });
  // Everyone in the group is in, marked by the organizer; the organizer is out of a group they aren't in
  for (const x of people) plan.answers[x.id] = { name: String(x.name || '').trim().split(/\s+/)[0] || 'Friend', status: 'in', at: now };
  if (!inIt) plan.answers[plan.hostWho] = { ...plan.answers[plan.hostWho], status: 'out', game: null, bet: null, betGame: null };
  plan.trip = stamp;
  plan.cup = structuredClone(r.cup);
  plan.session = sessionOf(tripId, r, matchLine(r.cup, pid => p(pid).name));
  return plan;
}

/** The trip's planned rounds made from its schedule, on this phone, still to be played: by plan id. */
export function scheduledPlans(state, tripId) {
  return Object.values(state.plans || {}).filter(p => p?.host && p.session?.trip === tripId && p.status === 'planned' && !p.gone);
}

/**
 * What planning a trip's schedule does on the organizer's phone: { rounds, remove, kept }: the
 * schedule's rounds still to plan, and the ids of planned rounds to take off first. A group that
 * already has a plan keeps it, whether it's started, played, called off or shared. `redo` (the
 * teams or the schedule changed): the planned rounds not shared yet are planned again, and `kept`
 * counts the shared ones left as they are (friends have their link). A round that's been started
 * is never planned again, so a played day doesn't come back on Up next.
 */
export function scheduleWork(state, tripId, schedule, teams, { redo = false, start }) {
  const mine = Object.values(state.plans || {}).filter(p => p?.host && p.session?.trip === tripId && !p.gone);
  const remove = redo ? mine.filter(p => p.status === 'planned' && !p.code).map(p => p.id) : [];
  const going = new Set(remove);
  const have = new Set(mine.filter(p => !going.has(p.id)).map(p => p.session.key));
  const kept = redo ? mine.filter(p => p.status === 'planned' && p.code).length : 0;
  return { rounds: scheduleRounds(schedule, teams, { start }).filter(r => !have.has(r.key)), remove, kept };
}

/**
 * A planned round's matches for the round it starts (`players`: the round's [{ id }]), or null when
 * they don't fit any more (someone in them didn't come, or the setup changed who's in the round),
 * and the trip's teams decide instead. Only the people in the round, each once.
 */
export function planCupFor(plan, players) {
  const c = plan?.cup;
  if (!c || !CUP_KINDS[c.kind] || !Array.isArray(c.sides)) return null;
  const ids = new Set((players || []).map(p => p.id));
  const sides = c.sides.map(s => (Array.isArray(s) ? s : []));
  const all = sides.flat();
  if (all.length !== ids.size || !all.every(id => ids.has(id)) || new Set(all).size !== all.length) return null;
  return { kind: c.kind, sides: sides.map(s => [...s]), ...(cleanWorth(c.worth) !== 1 ? { worth: cleanWorth(c.worth) } : {}) };
}

const lower = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The schedule's group a round started on any phone is (not from the organizer's plan: a friend in
 * a group the organizer isn't in tees off on their own phone), worked out from the trip's schedule
 * and teams as every phone on the trip has them: { cup, session } with the round's own player ids,
 * or null. `players`: the round's [{ id, name }], who must be exactly one group of the schedule on
 * `date` (each the same person as a team player, by a link or else a name only one of them has).
 * With two groups of the same four that day, the one whose game the round plays, then the morning's
 * before noon and the afternoon's after.
 */
export function scheduledCupFor(state, trip, players, { date, game = null, hour = 12 } = {}) {
  const cup = cupOf(trip);
  if (!cup?.schedule || !trip.start || !Array.isArray(players) || !players.length) return null;
  const teams = cup.teams.map(t => t.map(p => p.id));
  const who = canonicalOf(state);
  const named = new Map();
  for (const p of cup.teams.flat()) named.set(lower(p.name), (named.get(lower(p.name)) || 0) + 1);
  const nameOf = id => cup.teams.flat().find(p => p.id === id)?.name || '';
  const seat = id => {
    const same = players.filter(p => p.id === id || who(p.id) === who(id));
    if (same.length === 1) return same[0].id;
    const n = lower(nameOf(id));
    if (!n || named.get(n) !== 1) return null;
    const byName = players.filter(p => lower(p.name) === n);
    return byName.length === 1 ? byName[0].id : null;
  };
  const hits = [];
  for (const r of scheduleRounds(cup.schedule, teams, { start: trip.start })) {
    if (r.date !== date || r.players.length !== players.length) continue;
    const map = new Map(r.players.map(id => [id, seat(id)]));
    const got = [...map.values()];
    if (got.some(x => !x) || new Set(got).size !== got.length) continue;
    hits.push({ r, map });
  }
  if (!hits.length) return null;
  const score = ({ r }) => (r.game === game ? 2 : 0) + ((r.session === 1) === (hour < 12) ? 1 : 0);
  const { r, map } = hits.sort((a, b) => score(b) - score(a))[0];
  const sides = r.cup.sides.map(side => side.map(id => map.get(id)));
  const name = id => players.find(p => p.id === id)?.name;
  const out = { kind: r.cup.kind, sides, ...(r.worth !== 1 ? { worth: r.worth } : {}) };
  return { cup: out, session: sessionOf(trip.id, r, matchLine(out, name)) };
}

/**
 * A round's matches at its session's worth: a planned round whose own matches no longer fit who
 * showed up starts with matches from the trip's teams, and they're still worth what the session's
 * are (2 points a singles match, say). `session`: the plan's (`plan.session`), for trip `tripId`.
 */
export function withSessionWorth(cup, session, tripId) {
  if (!cup || !session || session.trip !== tripId) return cup;
  const w = cleanWorth(session.worth);
  return w !== 1 && cleanWorth(cup.worth) === 1 ? { ...cup, worth: w } : cup;
}

/**
 * The trip's planned rounds by day for the trip page and Up next: [{ date, sessions: [{ key,
 * label, kind, worth, plans }] }], soonest first. Plans not made from the schedule are their own
 * session, under their day.
 */
export function plansByDay(plans) {
  const days = new Map();
  for (const p of plans) {
    const d = days.get(p.date) || new Map();
    const key = p.session ? `d${p.session.day}s${p.session.session}` : `p${p.id}`;
    const s = d.get(key) || { key, label: p.session?.label || null, kind: p.session?.kind || null, worth: p.session?.worth || 1, plans: [] };
    s.plans.push(p);
    d.set(key, s);
    days.set(p.date, d);
  }
  return [...days].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([date, d]) => ({ date, sessions: [...d.values()].map(s => ({ ...s, plans: s.plans.sort((a, b) => (a.session?.group || 0) - (b.session?.group || 0) || String(a.teeTime || '').localeCompare(String(b.teeTime || ''))) })) }));
}

/** "Day 1 · Morning four-ball · Group 2 of 3": a planned round's place in its trip's schedule, or null. */
export function sessionEyebrow(plan) {
  const s = plan?.session;
  if (!s || !s.label) return null;
  return `Day ${s.day} · ${s.label}${s.groups > 1 ? ` · Group ${s.group} of ${s.groups}` : ''}`;
}
