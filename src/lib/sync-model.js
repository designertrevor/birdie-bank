// Pure helpers for splitting a round into shareable pieces and merging them back.
// A shared round is one "meta" record plus one record per hole, so two phones scoring
// different holes never overwrite each other.

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
  const firstOpen = round.holes.findIndex(h => !round.scores[h.no] || round.players.some(p => round.scores[h.no][p.id] == null));
  round.current = firstOpen < 0 ? round.holes.length - 1 : firstOpen;
  return round;
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Three-way merge of a shared record. `base` is what the server had when this phone last
 * heard from it, `local` is this phone's copy and `remote` is the server's copy now.
 * A side that didn't change from base takes the other side's value. When both changed,
 * objects are merged key by key down to `depth` levels (so two phones scoring different
 * players on the same hole both keep their scores). A true clash keeps this phone's edit,
 * which is then sent up. When `base` is undefined (this phone never saw the server's copy,
 * for example a round joined before this merge existed) a clash takes the server's copy.
 */
export function merge3(base, local, remote, depth = 1, known = base !== undefined) {
  const b = stable(base), l = stable(local), r = stable(remote);
  if (l === b || l === r) return remote;
  if (r === b) return local;
  if (depth <= 0 || !isObj(local) || !isObj(remote)) return known ? local : remote;
  const bo = isObj(base) ? base : {};
  const out = {};
  for (const k of new Set([...Object.keys(bo), ...Object.keys(local), ...Object.keys(remote)])) {
    const v = merge3(bo[k], local[k], remote[k], depth - 1, known);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}
export function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
