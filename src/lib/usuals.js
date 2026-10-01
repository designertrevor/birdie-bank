// "Your usuals": named setups (game, side games, bets, course and players) saved from a round and
// set up again in one tap. They live in state.usuals (never inside settings: settings are merged
// key by key on load and copied into every round), at most MAX_USUALS, and sync in the profile doc.
import { rematchSetup } from './rematch.js';
import { findCourse } from './courses.js';
import { GAMES, sideGamesOf } from './round.js';
import { defaultTeams } from './teams.js';
import { stable } from './sync-model.js';
import { storedPlayFor } from './play-for.js';

export const MAX_USUALS = 5;

/** "Skins at Pebble Creek" (never a weekday or "weekly": groups don't all play on a set day). */
export function defaultName(round) {
  return `${GAMES[round.game]?.name || 'Round'} at ${round.course?.name || 'the course'}`;
}

/** The saved list, oldest first, as stored (an old phone or backup without one has none). */
export function usualsOf(state) {
  return Array.isArray(state?.usuals) ? state.usuals : [];
}

/**
 * A usual built from a round, through the same "Run it back" setup. Players not saved on this
 * phone are left out. Returns null when the round's game is gone.
 */
export function usualFromRound(state, round, { id, name = null, now = Date.now() } = {}) {
  const s = rematchSetup(state, round);
  if (!s) return null;
  const names = Object.fromEntries(s.picked.map(pid => [pid, state.players[pid]?.name || '']));
  return {
    id,
    name: (name || '').trim() || defaultName(round),
    game: s.game,
    ...(s.sideGames?.length ? { sideGames: s.sideGames } : {}),
    ...(s.playFor ? { playFor: s.playFor } : {}),
    holesCount: s.holesCount,
    nine: s.nine,
    courseId: s.courseId ?? round.course?.id ?? null,
    courseName: round.course?.name || '',
    players: s.picked,
    names,
    tees: s.tees,
    hcOverride: s.hcOverride,
    bets: s.bets,
    hcPct: s.hcPct,
    useHc: s.useHc,
    // Half strokes ride along (absent: full strokes, as every usual saved before them)
    ...(s.halfStrokes ? { halfStrokes: true } : {}),
    teams: GAMES[s.game]?.teams ? s.teams : null,
    createdAt: now,
    lastPlayedAt: round.status === 'done' ? (round.finishedAt || round.createdAt || now) : null,
  };
}

/**
 * The setup screen's starting values for a usual: the same shape as rematchSetup. It opens on the
 * course when the course isn't on this phone any more, on the players when someone is missing,
 * else on the bets to confirm. Null when the game is gone.
 */
export function setupFromUsual(state, usual) {
  if (!usual || !GAMES[usual.game]) return null;
  const course = findCourse(state, usual.courseId);
  const picked = usual.players.filter(pid => state.players[pid]);
  const missing = usual.players.filter(pid => !state.players[pid]).map(pid => usual.names?.[pid] || 'A player');
  const keep = obj => Object.fromEntries(Object.entries(obj || {}).filter(([pid]) => picked.includes(pid)));
  const sameGroup = !missing.length && Array.isArray(usual.teams) && usual.teams.every(t => t.every(pid => picked.includes(pid)));
  const allowed = GAMES[usual.game].holes;
  return {
    game: usual.game,
    holesCount: allowed.includes(usual.holesCount) ? usual.holesCount : allowed[0],
    courseId: course?.id ?? null,
    nine: usual.nine || 'front',
    picked,
    missing,
    tees: keep(usual.tees),
    hcOverride: keep(usual.hcOverride),
    bets: usual.bets ? structuredClone(usual.bets) : null,
    hcPct: usual.hcPct ?? null,
    useHc: usual.useHc !== false,
    ...(usual.halfStrokes ? { halfStrokes: true } : {}),
    teams: sameGroup ? usual.teams.map(t => [...t]) : defaultTeams(usual.game, picked),
    ...(usual.sideGames?.length ? { sideGames: structuredClone(usual.sideGames) } : {}),
    ...(storedPlayFor(usual.playFor) ? { playFor: storedPlayFor(usual.playFor) } : {}),
    step: !course ? 1 : missing.length ? 2 : 3,
  };
}

/**
 * A usual as a round planned for later: what the plan-ahead setup fills in. The game and bet
 * become the organizer's suggestion on the ballot (the group still votes), and the side games go
 * on the ballot already picked, with the usual's house rules. `opts` is laid over the setup's
 * settings: the main game's bets, the handicap percentage and each side game's settings, so the
 * ballot's rules match the usual. `invited` is everyone saved on this phone except me; `missing`
 * names the rest. `courseId` is null when the course isn't on this phone any more, so setup lands
 * on the When and Course step with no course picked (it always lands there: the date needs
 * picking). Null when the game is gone.
 */
export function planFromUsual(state, usual) {
  const s = setupFromUsual(state, usual);
  if (!s) return null;
  const fits = sideGamesOf({ game: s.game, sideGames: s.sideGames || [] });
  const opts = {
    ...(s.bets ? { [s.game]: structuredClone(s.bets) } : {}),
    ...(s.hcPct != null ? { hcPct: s.hcPct } : {}),
    ...(s.halfStrokes ? { halfStrokes: true } : {}),
  };
  for (const sg of fits) opts[sg.game] = structuredClone(sg.settings);
  return {
    game: s.game, holesCount: s.holesCount, nine: s.nine, courseId: s.courseId,
    invited: s.picked.filter(pid => pid !== state.me),
    opts,
    sides: fits.map(sg => sg.game),
    // The side games as saved, with any Strokes given % of their own (the plan keeps those too)
    sideGames: structuredClone(fits),
    missing: s.missing,
    useHc: s.useHc,
    // Points or a reward rides along on the plan (absent: money)
    ...(s.playFor ? { playFor: s.playFor } : {}),
    usualId: usual.id,
    step: 1,
  };
}

/**
 * The usual a round came from, for "Last played": its id when it's still saved and the round is
 * still its game at its course (a plan's group can vote for another game), else null.
 */
export function usualIdFor(state, usualId, game, course) {
  const u = usualId && usualsOf(state).find(x => x.id === usualId);
  if (!u || u.game !== game || !course) return null;
  return u.courseId === course.id || findCourse(state, u.courseId)?.id === course.id ? u.id : null;
}

/** What makes two usuals the same setup: game, side games, bets, course, length, players and what it's played for. */
function key(u) {
  return stable({
    game: u.game, courseId: u.courseId ?? null, holesCount: u.holesCount, nine: u.holesCount === 9 ? u.nine || 'front' : null,
    players: [...(u.players || [])].sort(), bets: u.bets ?? null,
    // A side game's own % and half strokes only join the key when set, so usuals saved before them still match
    sideGames: (u.sideGames || []).map(sg => ({ game: sg.game, settings: sg.settings, ...(sg.hcPct != null ? { hcPct: sg.hcPct } : {}) })),
    ...(u.halfStrokes ? { halfStrokes: true } : {}),
    // Money usuals keep the key they always had (no playFor), so saved ones still match
    ...(storedPlayFor(u.playFor) ? { playFor: storedPlayFor(u.playFor) } : {}),
  });
}

/** Two usuals (or a usual and a round's would-be usual) set up the same round. */
export function sameAs(a, b) {
  if (!a || !b) return false;
  return key(a) === key(b);
}

/** The saved usual a round's setup matches, or null. */
export function matchingUsual(state, round) {
  const u = usualFromRound(state, round, { id: '_' });
  return u ? usualsOf(state).find(x => sameAs(x, u)) || null : null;
}

/** Whether another usual can be saved. */
export function canAddUsual(state) {
  return usualsOf(state).length < MAX_USUALS;
}

/**
 * Save a usual into a state draft (mutates). Returns 'saved', 'same' (an identical one is already
 * saved, so nothing changes) or 'full' (at the cap).
 */
export function addUsual(draft, usual) {
  const list = usualsOf(draft);
  if (list.some(u => sameAs(u, usual))) return 'same';
  if (list.length >= MAX_USUALS) return 'full';
  draft.usuals = [...list, usual];
  return 'saved';
}

export function renameUsual(draft, id, name) {
  const clean = (name || '').trim();
  if (!clean) return;
  draft.usuals = usualsOf(draft).map(u => (u.id === id ? { ...u, name: clean } : u));
}

export function deleteUsual(draft, id) {
  draft.usuals = usualsOf(draft).filter(u => u.id !== id);
}

/** A round started from a usual finished: note when (mutates the draft). */
export function markUsualPlayed(draft, round, at = Date.now()) {
  if (!round?.usualId) return;
  draft.usuals = usualsOf(draft).map(u => (u.id === round.usualId ? { ...u, lastPlayedAt: at } : u));
}

/** Most recently played (or saved) first, for the setup list. */
export function sortedUsuals(state) {
  return [...usualsOf(state)].sort((a, b) => (b.lastPlayedAt || b.createdAt || 0) - (a.lastPlayedAt || a.createdAt || 0));
}

/** A round-like object for a usual, so the bet lines read like a round's. */
export function usualAsRound(state, usual) {
  const settings = { ...state.settings, ...(usual.bets ? { [usual.game]: usual.bets } : {}) };
  return { game: usual.game, settings, ...(usual.sideGames?.length ? { sideGames: usual.sideGames } : {}), ...(usual.playFor ? { playFor: usual.playFor } : {}) };
}

