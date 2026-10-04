// The setup made before a round was scheduled for later: the playing order, teams, tees, handicap
// edits, the starting hole and two-player side bets. "Schedule for later" (from the Bets step,
// Round ready, or End round before any holes) and a saved usual keep it on the plan, so the roll
// call starts the round exactly as it was built. Anything that no longer fits (someone who didn't
// come, a course that changed) is dropped, and each drop comes back as a line saying so.
//
// It stays on the organizer's phone (plans.js LOCAL_ONLY): it's keyed by this phone's own player
// ids and holds handicap edits, which mean nothing on a friend's phone. Plans made before it have
// none, and their roll call works as it always did. Pure, so tests can load it.
import { GAMES, holesInPlay, oneBall } from './round.js';
import { teamsProblem } from './teams.js';
import { betsOf, cleanBet } from './pair-bets.js';
import { defaultTee, findCourse } from './courses.js';
import { rematchSetup } from './rematch.js';

const isStr = v => typeof v === 'string' && v.length > 0;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const first = name => String(name || '').trim().split(/\s+/)[0] || 'A player';
const listNames = n => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
const notHere = names => `${listNames(names)} ${names.length === 1 ? 'isn’t' : 'aren’t'} here`;

/**
 * What a plan keeps from setup, or null when there's nothing to keep. `order` is the players
 * picked, in the order setup had them (the organizer included); everything else is keyed by
 * those ids. `bets` are setup's two-player side bets as they were on the Bets step. `me` is the
 * organizer's own id then, so the roll call still knows them if signing in gives them another.
 */
export function setupForPlan({ game, courseId = null, holesCount, nine = 'front', me = null, order = [], teams = null, tees = {}, hcOverride = {}, startHole = null, bets = [] }) {
  if (!GAMES[game]) return null;
  const ids = [...new Set((order || []).filter(isStr))];
  if (!ids.length) return null;
  const keep = (obj, ok) => Object.fromEntries(Object.entries(isObj(obj) ? obj : {}).filter(([pid, v]) => ids.includes(pid) && ok(v)));
  const t = keep(tees, isStr);
  const hc = keep(hcOverride, v => typeof v === 'number' && Number.isFinite(v));
  const split = GAMES[game].teams && Array.isArray(teams) && teams.length
    ? teams.map(x => (Array.isArray(x) ? x.filter(pid => ids.includes(pid)) : []))
    : null;
  const sideBets = (Array.isArray(bets) ? bets : [])
    .filter(b => isObj(b) && Array.isArray(b.sides) && b.sides.length === 2 && b.sides.every(pid => ids.includes(pid)))
    .map(b => { const { shape: _SHAPE, ...rest } = b; return structuredClone(rest); });
  return {
    game, courseId, holesCount, nine: nine || 'front',
    ...(isStr(me) && ids.includes(me) ? { me } : {}),
    order: ids,
    ...(split ? { teams: split } : {}),
    ...(Object.keys(t).length ? { tees: t } : {}),
    ...(Object.keys(hc).length ? { hcOverride: hc } : {}),
    ...(Number.isInteger(startHole) ? { startHole } : {}),
    ...(sideBets.length ? { bets: sideBets } : {}),
  };
}

/**
 * The setup with each id that isn't here moved to the id here that's the same person (`sameAs`):
 * the organizer's new id after signing in, or a friend linked to another id since. Without it
 * they'd read as someone who didn't come plus someone new, and lose their place, team and tee.
 */
function matchIds(setup, ids, sameAs) {
  const map = new Map();
  const free = ids.filter(id => !setup.order.includes(id));
  for (const a of setup.order.filter(id => !ids.includes(id))) {
    const b = free.find(x => ![...map.values()].includes(x) && sameAs(a, x));
    if (b) map.set(a, b);
  }
  if (!map.size) return setup;
  const to = id => map.get(id) ?? id;
  const keyed = obj => (isObj(obj) ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [to(k), v])) : obj);
  return {
    ...setup,
    order: setup.order.map(to),
    teams: Array.isArray(setup.teams) ? setup.teams.map(t => (Array.isArray(t) ? t.map(to) : t)) : setup.teams,
    tees: keyed(setup.tees),
    hcOverride: keyed(setup.hcOverride),
    bets: Array.isArray(setup.bets) ? setup.bets.map(b => (!isObj(b) ? b : {
      ...b,
      ...(Array.isArray(b.sides) ? { sides: b.sides.map(to) } : {}),
      ...(isObj(b.strokes) && b.strokes.to ? { strokes: { ...b.strokes, to: to(b.strokes.to) } } : {}),
    })) : setup.bets,
  };
}

/**
 * Who goes on which team: the teams as set up when they still work for the players here (anyone
 * who didn't come taken off, anyone new on the smallest team), else null for a fresh split.
 * { teams, changed } where `changed` says the people on them changed.
 */
function keptTeams(game, setTeams, ids) {
  const cfg = GAMES[game]?.teams;
  if (!cfg || !Array.isArray(setTeams)) return null;
  const teams = setTeams.map(t => t.filter(pid => ids.includes(pid)));
  const placed = new Set(teams.flat());
  const joined = ids.filter(pid => !placed.has(pid));
  for (const pid of joined) {
    const small = teams.reduce((m, t, i) => (t.length < teams[m].length ? i : m), 0);
    teams[small].push(pid);
  }
  if (teamsProblem(game, teams, ids)) return null;
  return { teams, changed: joined.length > 0 || teams.flat().length !== setTeams.flat().length };
}

/**
 * The setup laid over the players who showed up. `players` are the saved players for the round in
 * the plan's order; `course`, `holesCount` and `nine` are the round's (the organizer can change
 * them on the plan after scheduling); `game` is the game the group picked. `nameOf(id)` names a
 * player who didn't come. `fresh(ids)` makes a fresh team split (teams.js defaultTeams).
 * `sameAs(a, b)`: whether setup's id `a` and the id `b` here are one person (people-links.js).
 * Returns { players (ordered, with tee and courseHcOverride), teams, startHole, bets, kept, changes }:
 * `kept` names what carried over, for the roll call's summary, and `changes` is one line per thing
 * that was dropped.
 */
export function applySetup(setup, { game, course, holesCount, nine = 'front', players, nameOf = () => null, fresh = () => null, sameAs = null }) {
  const ids = players.map(p => p.id);
  const fallbackTee = defaultTee(course)?.name ?? null;
  if (!isObj(setup) || !Array.isArray(setup.order)) {
    return { players: players.map(p => ({ ...p, tee: fallbackTee })), teams: fresh(ids), startHole: null, bets: [], kept: [], changes: [] };
  }
  if (sameAs) setup = matchIds(setup, ids, sameAs);
  const name = id => first(nameOf(id));
  const absent = setup.order.filter(id => !ids.includes(id));
  const joined = ids.filter(id => !setup.order.includes(id));
  const kept = [];
  const changes = [];
  const g = GAMES[game];
  const sameCourse = !!course && course.id === setup.courseId;
  const sameHoles = sameCourse && holesCount === setup.holesCount && (holesCount !== 9 || (nine || 'front') === (setup.nine || 'front'));
  const why = !sameCourse ? 'the course changed' : 'the holes changed';

  // The playing order: as set up, with anyone new at the end
  const byId = new Map(players.map(p => [p.id, p]));
  const ordered = [...setup.order.filter(id => byId.has(id)), ...joined].map(id => byId.get(id));
  if (setup.order.length > 1 && g?.order) {
    kept.push('the playing order');
    if (joined.length && setup.order.some(id => byId.has(id))) changes.push(`${listNames(joined.map(id => first(byId.get(id).name)))} ${joined.length === 1 ? 'goes' : 'go'} last in the order.`);
  }

  // Tees: each player's when the course still has it, else the course's usual tee
  const teeNames = new Set((course?.tees || []).map(t => t.name));
  let teesKept = false;
  const out = ordered.map(p => {
    const want = setup.tees?.[p.id];
    if (want && teeNames.has(want)) { if (want !== fallbackTee) teesKept = true; return { ...p, tee: want }; }
    if (want && fallbackTee) changes.push(`${first(p.name)} plays ${fallbackTee}: there’s no ${want} tee here.`);
    return { ...p, tee: fallbackTee };
  });
  if (teesKept) kept.push('tees');

  // Handicap edits are a course handicap for one course and length, so they only hold for that
  const edits = out.filter(p => setup.hcOverride?.[p.id] != null);
  if (edits.length && sameHoles) {
    for (const p of edits) p.courseHcOverride = setup.hcOverride[p.id];
    kept.push('handicap edits');
  } else if (edits.length) changes.push(`Handicap edits are off: ${why}.`);

  // The starting hole, when it's still one of the holes played
  let startHole = null;
  if (setup.startHole != null) {
    const holes = course ? holesInPlay(course, holesCount, nine) : [];
    if (sameHoles && holes.some(h => h.no === setup.startHole) && holes[0]?.no !== setup.startHole) {
      startHole = setup.startHole;
      kept.push(`starts on hole ${startHole}`);
    } else if (holes.length && holes[0].no !== setup.startHole) changes.push(`Starts on hole ${holes[0].no}: ${why}.`);
  }

  // Teams, for the game they were set up for
  let teams = null;
  if (g?.teams) {
    const k = setup.game === game ? keptTeams(game, setup.teams, ids) : null;
    const optionalTwo = g.teams.optional && ids.length <= 2;
    if (k && !optionalTwo) {
      teams = k.teams;
      kept.push(g.teams.optional ? 'sides' : 'teams');
      if (k.changed) {
        const bits = [absent.length ? `without ${listNames(absent.map(name))}` : null, joined.length ? `with ${listNames(joined.map(id => first(byId.get(id).name)))} on the smaller side` : null].filter(Boolean);
        if (bits.length) changes.push(`Teams as you set them, ${bits.join(' and ')}.`);
      }
    } else {
      teams = fresh(ids);
      if (Array.isArray(setup.teams) && setup.teams.length && !optionalTwo) {
        const reasons = setup.game !== game ? [`the group picked ${g.name}`]
          : [absent.length ? notHere(absent.map(name)) : null, joined.length ? `${listNames(joined.map(id => first(byId.get(id).name)))} joined` : null].filter(Boolean);
        changes.push(`Teams start fresh${reasons.length ? `: ${reasons.join(' and ')}` : ''}.`);
      } else if (Array.isArray(setup.teams) && setup.teams.length && optionalTwo && ids.length === 2) {
        // Sides set up for more, and only two here: they play each other, and the card says so
        changes.push(`The sides are off: ${listNames(ids.map(id => first(byId.get(id).name)))} play each other.`);
      }
    }
  }

  // Two-player side bets between two people who are both here. A bet on some of the holes, or with
  // strokes on picked holes, goes back to the whole round when the holes changed
  const bets = [];
  for (const b of Array.isArray(setup.bets) ? setup.bets : []) {
    const pair = listNames((b.sides || []).map(id => (byId.has(id) ? first(byId.get(id).name) : name(id))));
    const gone = (b.sides || []).filter(id => !byId.has(id));
    if (gone.length) { changes.push(`${pair}’s side bet is off: ${notHere(gone.map(name))}.`); continue; }
    let bet = structuredClone(b);
    if (!sameHoles) {
      const { holes: _HOLES, ...rest } = bet;
      bet = rest;
      if (bet.strokes?.on) bet.strokes = { to: bet.strokes.to, count: bet.strokes.count };
      if (b.holes || b.strokes?.on) changes.push(`${pair}’s side bet covers every hole now: ${why}.`);
    }
    if (oneBall(game) && !betsOf({ game, players: out, teams, bets: [bet] }).length) {
      changes.push(`${pair}’s side bet is off: they’re on the same team now.`);
      continue;
    }
    bets.push(bet);
  }
  if (bets.length) kept.push(bets.length === 1 ? '1 side bet' : `${bets.length} side bets`);

  return { players: out, teams, startHole, bets, kept, changes };
}

/** A round's side bets from the plan's setup, cleaned for the round that was just made. */
export function roundBets(round, bets) {
  if (!Array.isArray(bets) || !bets.length) return [];
  return betsOf({ ...round, bets: bets.map(b => cleanBet(round, b)) });
}

/** "Set up as you built it: the playing order, tees and 1 side bet." for the roll call, or null. */
export function keptLine(kept) {
  if (!kept?.length) return null;
  return `Set up as you built it: ${listNames(kept)}.`;
}

/**
 * Setup's starting values for a round set up but not played yet, turned into a plan (End round
 * before any holes): the same as Run it back, plus where it starts and its side bets, which Run it
 * back leaves behind but a round that never teed off keeps. Opens on When and Course.
 */
export function rescheduleSetup(state, round) {
  const p = rematchSetup(state, round);
  if (!p) return null;
  const course = findCourse(state, round.course?.id);
  const usualFirst = course ? holesInPlay(course, p.holesCount, p.nine)[0]?.no : null;
  const firstNo = round.holes?.[0]?.no;
  return {
    ...p,
    startHole: usualFirst != null && firstNo != null && firstNo !== usualFirst ? firstNo : null,
    pairBets: structuredClone(betsOf(round)),
    step: p.courseId ? 1 : 0,
  };
}
