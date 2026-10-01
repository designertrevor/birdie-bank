// The backup file: everything this phone stores (rounds, players, crews, courses and hole fixes,
// usuals, plans, payments, carry-overs, links and settings) in one JSON file, and reading one back.
// Restoring either adds what's missing (never overwrites anything on the phone) or replaces
// everything. Pure, so tests can load it; the store and Settings do the saving.
import { mergeSettings, migrateSettings } from './settings.js';
import { MAX_USUALS } from './usuals.js';

/** Marks a file as a Birdie Bank backup. */
export const BACKUP_FORMAT = 'birdie-bank-backup';
/** The backup file's own version. Bump it when the file's shape changes in a way an older app can't read. */
export const BACKUP_VERSION = 1;

// Collections kept as { id: thing }
// Golf trips too (trips.js): their rounds carry the trip, the record keeps its dates and "done playing"
const MAPS = ['players', 'crews', 'customCourses', 'rounds', 'plans', 'tabRows', 'links', 'rewardsDone', 'accountOf', 'trips'];
// Collections kept as [thing with an id]
const LISTS = ['settlements', 'carries', 'usuals'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const pad2 = n => String(n).padStart(2, '0');

/** birdie-bank-backup-2026-09-30.json, in the phone's own date. */
export function backupFileName(date = new Date()) {
  return `birdie-bank-backup-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.json`;
}

/** How much is in a state (or a backup's data): { rounds, players, courses, plans, payments, usuals }. */
export function countsOf(data) {
  const n = v => (Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0);
  return {
    rounds: n(data?.rounds), players: n(data?.players), courses: n(data?.customCourses),
    plans: n(data?.plans), payments: n(data?.settlements), usuals: n(data?.usuals),
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "42 rounds, 9 players, 3 courses" (zeros left out, rounds and players always shown). */
export function summaryText(counts) {
  const parts = [plural(counts.rounds, 'round'), plural(counts.players, 'player')];
  if (counts.courses) parts.push(plural(counts.courses, 'course'));
  if (counts.plans) parts.push(plural(counts.plans, 'planned round'));
  if (counts.payments) parts.push(plural(counts.payments, 'payment'));
  if (counts.usuals) parts.push(plural(counts.usuals, 'usual'));
  return parts.join(', ');
}

/** What a merge added, "3 rounds, 1 player", or '' when it added nothing. */
export function addedText(added) {
  const words = { rounds: 'round', players: 'player', courses: 'course', plans: 'planned round', payments: 'payment', usuals: 'usual' };
  return Object.entries(words).filter(([k]) => added[k]).map(([k, w]) => plural(added[k], w)).join(', ');
}

/** The file's contents for a state: a small header, then the state as the phone keeps it. */
export function makeBackup(state, { now = new Date() } = {}) {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    stateVersion: state?.version ?? 1,
    createdAt: now.toISOString(),
    counts: countsOf(state),
    data: state,
  };
}

/** The backup as text, ready to save. */
export function backupText(state, opts) {
  return JSON.stringify(makeBackup(state, opts), null, 2);
}

const DAMAGED = 'This backup looks damaged, so nothing was changed. Try another copy of the file.';

/** Check a state's shape; returns an error message or null. */
function checkData(data) {
  if (!isObj(data) || !isObj(data.players)) return 'That file isn’t a Birdie Bank backup. Pick the file you saved with Back up your data.';
  for (const k of MAPS) if (data[k] != null && !isObj(data[k])) return DAMAGED;
  for (const k of LISTS) if (data[k] != null && !Array.isArray(data[k])) return DAMAGED;
  for (const k of ['players', 'crews', 'customCourses', 'rounds', 'plans']) {
    for (const [id, v] of Object.entries(data[k] || {})) if (!isObj(v) || (v.id != null && v.id !== id)) return DAMAGED;
  }
  for (const r of Object.values(data.rounds || {})) if (!Array.isArray(r.players)) return DAMAGED;
  for (const k of LISTS) for (const v of data[k] || []) if (!isObj(v)) return DAMAGED;
  if (data.settings != null && !isObj(data.settings)) return DAMAGED;
  return null;
}

/**
 * Read a backup file's text. Returns { ok: true, data, counts, createdAt, legacy } or
 * { ok: false, error } with a message to show as it is. A file saved by the old "Back up"
 * (the bare state, no header) still reads, as legacy.
 */
export function parseBackup(text) {
  let file;
  try { file = JSON.parse(text); } catch { return { ok: false, error: 'That file isn’t a Birdie Bank backup. Pick the file you saved with Back up your data.' }; }
  if (!isObj(file)) return { ok: false, error: 'That file isn’t a Birdie Bank backup. Pick the file you saved with Back up your data.' };
  let data = file;
  let createdAt = null;
  const legacy = file.format !== BACKUP_FORMAT;
  if (!legacy) {
    const v = Number(file.backupVersion);
    if (!Number.isInteger(v) || v < 1) return { ok: false, error: DAMAGED };
    if (v > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of Birdie Bank. Update the app, then restore it.' };
    data = file.data;
    createdAt = typeof file.createdAt === 'string' ? file.createdAt : null;
  }
  const error = checkData(data);
  if (error) return { ok: false, error };
  return { ok: true, data, counts: countsOf(data), createdAt, legacy };
}

const pairKey = p => (Array.isArray(p) ? [...p].sort().join('|') : '');

/**
 * Add what the backup has that this phone doesn't. Nothing already on the phone changes: a round,
 * player, course or payment with the same id keeps this phone's copy, and settings stay as they are.
 * Returns { state, added } where added counts what came in.
 */
export function mergeBackup(current, data) {
  const next = structuredClone(current);
  const added = { rounds: 0, players: 0, courses: 0, plans: 0, payments: 0, usuals: 0 };
  const countKey = { rounds: 'rounds', players: 'players', customCourses: 'courses', plans: 'plans' };
  for (const k of MAPS) {
    if (!isObj(data[k])) continue;
    next[k] = isObj(next[k]) ? next[k] : {};
    for (const [id, v] of Object.entries(data[k])) {
      if (id in next[k]) continue;
      next[k][id] = structuredClone(v);
      if (countKey[k]) added[countKey[k]]++;
    }
  }
  for (const k of LISTS) {
    if (!Array.isArray(data[k])) continue;
    next[k] = Array.isArray(next[k]) ? next[k] : [];
    const have = new Set(next[k].map(x => x?.id).filter(Boolean));
    for (const v of data[k]) {
      if (!v?.id || have.has(v.id)) continue;
      if (k === 'usuals' && next[k].length >= MAX_USUALS) break;
      next[k].push(structuredClone(v));
      have.add(v.id);
      if (k === 'settlements') added.payments++;
      if (k === 'usuals') added.usuals++;
    }
  }
  for (const k of ['favorites', 'starredCourses']) {
    if (!Array.isArray(data[k])) continue;
    next[k] = [...(Array.isArray(next[k]) ? next[k] : []), ...data[k].filter(x => !(next[k] || []).includes(x))];
  }
  if (Array.isArray(data.unlinks)) {
    next.unlinks = Array.isArray(next.unlinks) ? next.unlinks : [];
    const have = new Set(next.unlinks.map(pairKey));
    for (const p of data.unlinks) if (pairKey(p) && !have.has(pairKey(p))) { next.unlinks.push([...p]); have.add(pairKey(p)); }
  }
  // A phone that hasn't been set up takes who "me" is from the backup
  if (!next.me && data.me && next.players[data.me]) next.me = data.me;
  if (!next.onboarded && data.onboarded && next.me) next.onboarded = true;
  if (!next.activeRoundId && data.activeRoundId && next.rounds[data.activeRoundId]?.status === 'active') next.activeRoundId = data.activeRoundId;
  return { state: next, added };
}

/**
 * Everything on the phone becomes the backup. `fresh` is a brand new state, so keys added since the
 * backup was made get their defaults, and saved game defaults are brought up to date game by game.
 */
export function replaceFromBackup(fresh, data) {
  const next = { ...structuredClone(fresh), ...structuredClone(data) };
  next.settings = mergeSettings(fresh.settings, migrateSettings(data.settings));
  if (isObj(fresh.settings?.dots?.kinds)) next.settings.dots = { ...next.settings.dots, kinds: { ...fresh.settings.dots.kinds, ...next.settings.dots?.kinds } };
  for (const k of MAPS) if (!isObj(next[k])) next[k] = {};
  for (const k of [...LISTS, 'favorites', 'starredCourses', 'unlinks']) if (!Array.isArray(next[k])) next[k] = [];
  next.version = fresh.version;
  if (next.activeRoundId && next.rounds[next.activeRoundId]?.status !== 'active') next.activeRoundId = null;
  return next;
}
