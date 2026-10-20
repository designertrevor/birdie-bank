// Pure helpers for setting up or planning a round (src/screens/NewRound.jsx and src/screens/newround/):
// no React, no JSX, so node tests reach them (setup-screen.test.js). Moved out of NewRound.jsx
// unchanged when it was split up (roadmap area 25), so setup reads the same as before.
import { GAMES } from './round.js';
import { findCourse } from './courses.js';
import { betChoices, isoDate, planStart } from './plans.js';
import { challengeIdOfBet } from './challenges.js';

/** Setup options with an earlier round's bets and handicap percentage laid over them. */
export function withBets(opts, pre) {
  if (!pre) return opts;
  return { ...opts, ...(pre.bets ? { [pre.game]: structuredClone(pre.bets) } : {}), hcPct: pre.hcPct ?? opts.hcPct, halfStrokes: !!pre.halfStrokes };
}
export const listNames = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** The next Saturday (today when it's Saturday), the usual day to plan for. */
export function nextSaturday(now = new Date()) {
  return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7)));
}

/** Two amounts either side of the suggestion, for the bet vote. */
export function nearbyBets(bet) {
  return betChoices(bet).filter(b => b !== bet);
}

/** Setup filled in from a planned round's roll call ("Change the setup"). `newId` makes a player id for someone new on it. */
export function planSetup(state, planId, present, newId) {
  const plan = state.plans?.[planId];
  if (!plan) return null;
  const course = findCourse(state, plan.course?.id);
  const s = planStart(state, plan, present || [], { course, newId });
  if (!GAMES[s.game]) return null;
  const picked = s.players.map(p => p.id).filter(id => state.players[id]);
  const g = GAMES[s.game];
  // The tees, handicap edits, starting hole and side bets the plan kept from its setup (plan-setup.js)
  const tees = Object.fromEntries(s.players.filter(p => p.tee).map(p => [p.id, p.tee]));
  const hcOverride = Object.fromEntries(s.players.filter(p => p.courseHcOverride != null).map(p => [p.id, p.courseHcOverride]));
  return {
    game: s.game, holesCount: s.holesCount, courseId: course?.id ?? null, nine: s.nine, picked, missing: [], tees, hcOverride,
    bets: structuredClone(s.settings[s.game]), hcPct: s.hcPct, useHc: s.useHandicaps, teams: s.teams, sideGames: s.sideGames, halfStrokes: s.halfStrokes,
    startHole: s.startHole, pairBets: s.bets,
    usualId: plan.usualId ?? null,
    playFor: s.playFor,
    // Who each person on the plan is here, so the plan's agreed challenges come in as side bets
    idOf: s.idOf,
    step: !course ? 1 : picked.length < g.min || picked.length > g.max ? 2 : 3,
  };
}

/** "Dave and Mike’s challenge is in as a side bet." for the challenges setup brought in. */
export function challengeNote(round, bets) {
  const name = id => (round.players.find(p => p.id === id)?.name || '?').split(' ')[0];
  const pairs = bets.filter(b => challengeIdOfBet(b.id) && b.sides.every(id => round.players.some(p => p.id === id))).map(b => `${name(b.sides[0])} and ${name(b.sides[1])}’s`);
  if (!pairs.length) return '';
  const who = pairs.length === 1 ? pairs[0] : `${pairs.slice(0, -1).join(', ')} and ${pairs.at(-1)}`;
  return pairs.length === 1 ? `${who} challenge is in as a side bet. Tap it to change it, or take it off for today.`
    : `${who} challenges are in as side bets. Tap one to change it, or take it off for today.`;
}

/** "Saturday, October 3" (today and tomorrow say so), for a day chip's accessible name. */
export function dayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const full = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const today = isoDate(new Date());
  const tmrw = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
  return iso === today ? `Today, ${full}` : iso === tmrw ? `Tomorrow, ${full}` : full;
}

/** "1 tee", "4 tees" */
export const teeCount = n => `${n} ${n === 1 ? 'tee' : 'tees'}`;

/** Holes 1 to 18 (or the nine) with no pars, for the tee off choice before a course is picked. */
export function plainHoles(holesCount, nine) {
  const from = holesCount === 9 && nine === 'back' ? 10 : 1;
  return Array.from({ length: holesCount }, (_, i) => ({ no: from + i }));
}
