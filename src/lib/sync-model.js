// Pure helpers for splitting a round into shareable pieces and merging them back.
// A shared round is one "meta" record plus one record per hole, so two phones scoring
// different holes never overwrite each other. Round-wide fields like `left` (players who left)
// travel in the meta record.
import { holeComplete } from './round.js';

/** Fields that belong to one phone only and are never shared. */
const LOCAL_ONLY = ['scores', 'banker', 'wolf', 'marks', 'presses', 'current', 'shared', 'localMe', '_remote', 'pressSeq'];

/** JSON with sorted keys so equal data always compares equal. */
export function stable(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

export function buildMeta(round) {
  const meta = {};
  for (const [k, v] of Object.entries(round)) if (!LOCAL_ONLY.includes(k)) meta[k] = v;
  return meta;
}

export function buildHole(round, idx) {
  const h = round.holes[idx];
  const data = {
    scores: round.scores[h.no] || null,
    banker: round.banker?.[h.no] || null,
    wolf: round.wolf?.[h.no] || null,
    marks: round.marks?.[h.no] || null,
    presses: (round.presses || []).filter(p => p.start === idx + 1),
  };
  const empty = !data.scores && !data.banker && !data.wolf && !data.marks && !data.presses.length;
  return empty ? null : data;
}

export function buildHoles(round) {
  const out = {};
  round.holes.forEach((h, i) => { const d = buildHole(round, i); if (d) out[h.no] = d; });
  return out;
}

/** Apply a remote hole record onto a local round (mutates). */
export function applyHole(round, holeNo, data) {
  const idx = round.holes.findIndex(h => h.no === holeNo);
  if (idx < 0) return;
  if (data?.scores) round.scores[holeNo] = data.scores; else delete round.scores[holeNo];
  if (data?.banker) round.banker[holeNo] = data.banker; else delete round.banker[holeNo];
  if (data?.wolf) round.wolf[holeNo] = data.wolf; else delete round.wolf[holeNo];
  if (!round.marks) round.marks = {};
  if (data?.marks) round.marks[holeNo] = data.marks; else delete round.marks[holeNo];
  round.presses = [...(round.presses || []).filter(p => p.start !== idx + 1), ...(data?.presses || [])]
    .sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)));
  round._remote = { ...(round._remote || {}), [holeNo]: ((round._remote || {})[holeNo] || 0) + 1 };
}

/** Apply remote meta onto a local round, keeping this phone's own fields (mutates). */
export function applyMeta(round, meta) {
  for (const k of Object.keys(buildMeta(round))) if (!(k in meta)) delete round[k];
  Object.assign(round, meta);
}

/** Build a local round from a fetched shared round. */
export function assemble(meta, holes) {
  const round = { ...meta, scores: {}, banker: {}, wolf: {}, marks: {}, presses: [], current: 0 };
  for (const [no, data] of Object.entries(holes || {})) applyHole(round, Number(no), data);
  round._remote = {};
  const firstOpen = round.holes.findIndex(h => !holeComplete(round, h));
  round.current = firstOpen < 0 ? round.holes.length - 1 : firstOpen;
  return round;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}
export function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
