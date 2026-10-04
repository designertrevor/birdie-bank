// The Season view on the Tab (a Pro preview): the organizer's own season, built from their
// finished rounds. Pure functions of plain data. Every number comes from roundResults(), so
// anything a round's money includes is included here too.
// Nothing here is new data: History and Players already show your own season for free, and they stay free.
import { GAMES, roundResults } from './round.js';
import { meFor, myIds } from './format.js';
import { nameOf } from './ledger.js';
import { roundTime } from './history.js';
import { canonicalOf } from './pair-debts.js';
import { countsMoney, tabResultsFor } from './play-for.js';

/** Fewer finished rounds than this and the Season preview shows the sample group instead. */
export const MIN_REAL_ROUNDS = 2;

const cents = v => Math.round(v * 100) / 100 || 0;

/**
 * Finished rounds this season (calendar year) with money of yours on the Tab, joined rounds
 * included: money rounds, and reward rounds where you had a side bet for money (only those bets
 * count, see tabResultsFor). Oldest first. Points rounds never count toward the season's money.
 */
export function seasonRounds(state, year = new Date().getFullYear()) {
  return Object.values(state?.rounds || {})
    .filter(r => r.status === 'done' && new Date(roundTime(r)).getFullYear() === year)
    .filter(r => { const me = meFor(r, state); return !!me && r.players.some(p => p.id === me) && !!tabResultsFor(r, me); })
    .sort((a, b) => roundTime(a) - roundTime(b));
}

/** How many finished rounds you played this season. Under MIN_REAL_ROUNDS, the preview uses the sample. */
export function realRoundCount(state, year = new Date().getFullYear()) {
  return seasonRounds(state, year).length;
}

/**
 * Your season, from your own finished rounds this year:
 * - balances: [{ id, name, net, me }] everyone's total across those rounds, biggest first. You are one row.
 * - rival: you against the friend you played most ({ id, name, rounds, won, lost, even, net }), or null.
 * - biggestDay: your best round ({ id, course, amount, at }), or null when you haven't won one.
 * - bestGame: the game you won most at ({ game, name, net, rounds }), or null.
 * `rounds` is the count, `since` the first round's time.
 */
export function seasonBoard(state, year = new Date().getFullYear()) {
  const rounds = seasonRounds(state, year);
  const mine = myIds(state);
  const meKey = state?.me || [...mine][0] || 'me';
  // One friend is one row, whichever of their ids a round has (see people-links.js)
  const canon = canonicalOf(state || {});
  const who = id => { const k = canon(id); return mine.has(id) || mine.has(k) ? meKey : k; };
  const bal = new Map();
  const h2h = new Map();
  const games = new Map();
  let biggestDay = null;
  for (const r of rounds) {
    const me = meFor(r, state);
    // A money round's whole result; a reward round's side bets for money alone
    const res = tabResultsFor(r, me, roundResults(r));
    for (const [id, v] of Object.entries(res.balances)) {
      const k = who(id);
      bal.set(k, cents((bal.get(k) || 0) + v));
    }
    const mineNet = res.balances[me] || 0;
    if (mineNet > 0 && (!biggestDay || mineNet > biggestDay.amount)) {
      biggestDay = { id: r.id, course: r.course?.name || '', amount: cents(mineNet), at: roundTime(r) };
    }
    // Each game in the round counts on its own line: a side Skins adds to Skins, not to the main game
    const parts = res.detail?.byGame
      ? Object.entries(res.detail.byGame)
        // Side bets between two players only count for a round you had one in
        .filter(([key, v]) => key !== 'bets' || (v.detail?.bets || []).some(b => b.sides.includes(me)))
        .map(([key, v]) => ({ game: key === 'main' ? r.game : key, name: v.label, net: v.balances?.[me] || 0 }))
      : [{ game: r.game, name: GAMES[r.game]?.name || r.game, net: mineNet }];
    for (const part of parts) {
      const g = games.get(part.name) || { game: part.game, name: part.name, net: 0, rounds: 0 };
      g.net = cents(g.net + part.net);
      g.rounds++;
      games.set(part.name, g);
    }
    const pairs = res.pairs?.[me] || {};
    const inRound = new Map();
    // A reward round is a round together only with the players you had a side bet for money with
    const betWith = countsMoney(r) ? null : new Set((res.detail.byGame.bets?.detail?.bets || []).filter(b => b.sides?.includes(me)).flatMap(b => b.sides));
    for (const p of r.players) {
      const k = who(p.id);
      if (k === meKey || (betWith && !betWith.has(p.id))) continue;
      inRound.set(k, (inRound.get(k) || 0) + (pairs[p.id] ?? 0));
    }
    for (const [k, v] of inRound) {
      const cur = h2h.get(k) || { id: k, rounds: 0, won: 0, lost: 0, even: 0, net: 0 };
      cur.rounds++;
      if (v > 0.004) cur.won++; else if (v < -0.004) cur.lost++; else cur.even++;
      cur.net = cents(cur.net + v);
      h2h.set(k, cur);
    }
  }
  const name = id => (id === meKey ? 'You' : nameOf(state, id));
  const balances = [...bal.entries()]
    .map(([id, net]) => ({ id, name: name(id), net, me: id === meKey }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
  // Most rounds together; a tie goes to the bigger money either way, then the name
  const rivalRow = [...h2h.values()].sort((a, b) => b.rounds - a.rounds || Math.abs(b.net) - Math.abs(a.net) || name(a.id).localeCompare(name(b.id)))[0];
  const rival = rivalRow ? { ...rivalRow, name: name(rivalRow.id) } : null;
  const bestRow = [...games.values()].sort((a, b) => b.net - a.net)[0];
  const bestGame = bestRow && bestRow.net > 0 ? bestRow : null;
  return { year, rounds: rounds.length, since: rounds.length ? roundTime(rounds[0]) : null, balances, rival, biggestDay, bestGame };
}

// --------------------------- the sample group -------------------------------

/** A made-up group for the tour when there aren't enough real rounds yet. Always shown with a "Sample" tag. */
export const SAMPLE = {
  rounds: 6,
  balances: [
    { id: 'sample_alex', name: 'Alex', net: 85 },
    { id: 'sample_jordan', name: 'Jordan', net: 40 },
    { id: 'sample_pat', name: 'Pat', net: -30 },
    { id: 'sample_lee', name: 'Lee', net: -40 },
    { id: 'sample_casey', name: 'Casey', net: -55 },
  ],
  rival: { a: 'sample_alex', b: 'sample_jordan', won: 4, lost: 2, even: 0, net: 25 },
  biggestDay: { who: 'sample_alex', course: 'Oak Hollow', amount: 45 },
  bestGame: { who: 'sample_alex', game: 'nassau', name: 'Nassau', net: 60 },
  usual: { game: 'Nassau', bet: '$5', course: 'Oak Hollow' },
  rsvp: { in: 3, maybe: 1, out: 0, none: 1 },
};

/** Stand-ins used when a sample name is also someone real on this phone, so the sample never looks like real money. */
const SPARE_NAMES = ['Riley', 'Morgan', 'Quinn', 'Drew', 'Jamie', 'Rowan', 'Reese', 'Sky', 'Emery', 'Hayden'];

/** The sample group for this phone: SAMPLE, with any name that matches a real player's first name swapped out. */
export function sampleBoard(state) {
  const real = new Set();
  for (const p of Object.values(state?.players || {})) real.add(firstLower(p.name));
  for (const r of Object.values(state?.rounds || {})) for (const p of r.players || []) real.add(firstLower(p.name));
  const spare = SPARE_NAMES.filter(n => !real.has(n.toLowerCase()));
  const names = {};
  for (const b of SAMPLE.balances) names[b.id] = real.has(b.name.toLowerCase()) ? (spare.shift() || `Player ${Object.keys(names).length + 1}`) : b.name;
  return {
    ...SAMPLE,
    sample: true,
    names,
    balances: SAMPLE.balances.map(b => ({ ...b, name: names[b.id], me: false })),
  };
}

const firstLower = name => String(name || '').trim().split(/\s+/)[0].toLowerCase();
