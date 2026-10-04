// Handicap flights for a trip (Trip Mode, 2026-10-04): everyone going sorted by handicap index
// into flights A to D, best first. Flights do two jobs:
// - picking the cup's teams: each flight is split between the two teams, so both get the same
//   number of A players, of B players and so on (flightTeams);
// - an individual flighted net leaderboard on the trip's page: in each flight, everyone's net to
//   par across the trip's finished rounds (flightBoard), so a 25 handicap has someone to beat too.
// The flights are set when the trip is (`trip.flights`, the organizer's ids and names), so an index
// that changes on the trip doesn't move anyone. They ride in the trip's stamp to friends' phones.
// Other groups' rounds count on a team points trip, from what their phones post (cup.js cupEntry);
// on a money trip a phone counts the rounds it has. Pure, unit tested.
import { canonicalOf, codeOf } from './pair-debts.js';
import { cleanEntry, cupKey } from './cup.js';
import { courseNetOf } from './to-par.js';
import { isDraftKey } from './draft.js';

export const FLIGHT_NAMES = ['A', 'B', 'C', 'D'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;
const lower = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
/** Handicap index for sorting: no handicap sorts after everyone with one. */
const indexOf = p => (p?.index == null || p.index === '' || Number.isNaN(Number(p.index)) ? 99 : Number(p.index));

/**
 * How many flights for `n` players: four when they split evenly into four flights that each split
 * evenly between two teams (8, 16, 24), else three or two that do (12 is three flights of four),
 * else four as even as they go. Never more flights than pairs of players, and at least one.
 */
export function flightCount(n) {
  for (const f of [4, 3, 2]) if (n >= f * 2 && n % (f * 2) === 0) return f;
  return Math.max(1, Math.min(4, Math.floor(n / 2)));
}

/**
 * People in flights, best index first: [[{ id, name, index }], ...] (A first). Flights differ by at
 * most one player, the bigger ones first. Ties keep the order given.
 */
export function flightsOf(people, count = flightCount(people.length)) {
  const list = people.map((p, i) => ({ p, i })).sort((a, b) => indexOf(a.p) - indexOf(b.p) || a.i - b.i).map(x => x.p);
  const f = Math.max(1, Math.min(FLIGHT_NAMES.length, count));
  const base = Math.floor(list.length / f), extra = list.length % f;
  const out = [];
  let at = 0;
  for (let i = 0; i < f; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(list.slice(at, at + size).map(p => ({ id: p.id, name: p.name, index: p.index ?? null })));
    at += size;
  }
  return out.filter(x => x.length);
}

/**
 * Two teams with an even share of every flight: in each flight, best first, a player goes to the
 * team with fewer from that flight, then the team with fewer so far, then the one whose turn it is
 * (the first team in flight A, the second in B, and so on, so neither always gets the better half).
 * [[{ id, name }], [{ id, name }]], each best first.
 */
export function flightTeams(people) {
  const teams = [[], []];
  flightsOf(people).forEach((flight, f) => {
    const here = [0, 0];
    flight.forEach((p, i) => {
      const t = here[0] !== here[1] ? (here[0] < here[1] ? 0 : 1)
        : teams[0].length !== teams[1].length ? (teams[0].length < teams[1].length ? 0 : 1)
        : (f + i) % 2;
      here[t]++;
      teams[t].push({ id: p.id, name: p.name });
    });
  });
  return teams;
}

/** A trip's flights as saved: up to four lists of { id, name }, each person once, or null. */
export function cleanFlights(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = raw.slice(0, FLIGHT_NAMES.length).map(f => (Array.isArray(f) ? f : [])
    .filter(p => isObj(p) && isStr(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, 24)
    .map(p => ({ id: p.id, name: String(p.name || '').trim().slice(0, 40) || 'Player' })))
    .filter(f => f.length);
  return out.length ? out : null;
}

/**
 * Which flight someone in a round is in (0 for A), or null: the same person (any id this phone links
 * to them), or else a name only one person in the flights has.
 */
export function flightOf(state, flights, player) {
  if (!flights) return null;
  const who = canonicalOf(state);
  const me = who(player.id);
  for (let i = 0; i < flights.length; i++) if (flights[i].some(p => p.id === player.id || who(p.id) === me)) return i;
  const n = lower(player.name);
  if (!n) return null;
  const hits = flights.flatMap((f, i) => f.filter(p => lower(p.name) === n).map(() => i));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Each finished round of the trip, as { key, players: [{ id, name, net, played }] }: this phone's own
 * (net to par worked out here), then other groups' from the server that this phone doesn't have
 * (`state.cupRemote`, team points trips only). A player with no score of their own (one ball a team)
 * is left out of that round.
 */
function finishedRounds(state, tripId) {
  const out = new Map();
  const local = Object.values(state.rounds || {}).filter(r => r?.trip?.id === tripId && r.status === 'done');
  for (const r of local) {
    const players = r.players.map(p => ({ id: p.id, name: p.name, ...courseNetOf(r, p) })).filter(p => p.played > 0);
    out.set(cupKey(r), { key: cupKey(r), players });
  }
  const mine = new Set(Object.values(state.rounds || {}).flatMap(r => [cupKey(r), `L${r.id}`, codeOf(r)].filter(Boolean)));
  const remote = isObj(state.cupRemote?.[tripId]) ? state.cupRemote[tripId] : {};
  for (const [key, raw] of Object.entries(remote)) {
    if (key.startsWith('P') || isDraftKey(key) || out.has(key) || mine.has(key)) continue;
    const e = cleanEntry({ ...raw, key });
    if (!e || e.status !== 'done') continue;
    out.set(key, { key, players: e.players.filter(p => Number.isFinite(p.net) && p.played > 0).map(p => ({ id: p.id, name: p.name, net: p.net, played: p.played })) });
  }
  return [...out.values()];
}

/**
 * The flighted net leaderboard: [{ flight: 'A', rows: [{ key, id, name, net, rounds, holes }] }],
 * one list a flight with everyone in it (someone who hasn't finished a round shows with no score).
 * In each flight, most rounds first (someone who missed one can't be ahead of everyone who played
 * them all), then the lowest net to par, then name. `id` is the flight's own id for the person.
 */
export function flightBoard(state, trip) {
  const flights = cleanFlights(trip?.flights);
  if (!flights) return [];
  const who = canonicalOf(state);
  const rows = flights.map(f => f.map(p => ({ key: p.id, id: p.id, name: p.name, net: 0, rounds: 0, holes: 0 })));
  for (const r of finishedRounds(state, trip.id)) {
    for (const p of r.players) {
      const f = flightOf(state, flights, p);
      if (f == null) continue;
      const row = rows[f].find(x => x.id === p.id || who(x.id) === who(p.id)) || rows[f].find(x => lower(x.name) === lower(p.name));
      if (!row) continue;
      row.net += p.net;
      row.rounds++;
      row.holes += p.played;
    }
  }
  return rows.map((list, i) => ({
    flight: FLIGHT_NAMES[i],
    rows: list.map(x => ({ ...x, net: x.rounds ? Math.round(x.net * 2) / 2 : null }))
      .sort((a, b) => b.rounds - a.rounds || (a.net ?? 0) - (b.net ?? 0) || String(a.name).localeCompare(String(b.name))),
  }));
}
