// Two small sync helpers split out of sync-model.js (which re-exports them), so the app's start
// and the cup don't load the round's sharing code: JSON that compares equal, and a code as typed.
// Pure, no imports.

/** JSON with sorted keys so equal data always compares equal. */
export function stable(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

/** A share code as typed or pasted: capital letters and digits, six at most. */
export function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
