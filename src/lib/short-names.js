// Short names for people shown side by side (selection chips, a group's line): first names, but
// two people who share a first name get their last initial ("Sam O" and "Sam G"), and their whole
// name when that's the same too, so you can always tell which one you're picking.

const parts = name => String(name || '').trim().split(/\s+/).filter(Boolean);
const firstOf = name => parts(name)[0] || '';

/**
 * Map(key -> short name) for `people`, [[key, name]]. Keys are whatever the caller picks people by
 * (player ids, a challenge's `who`). A missing name falls back to `fallback`.
 */
export function shortNames(people, fallback = 'Player') {
  const byFirst = new Map();
  for (const [, name] of people) {
    const f = firstOf(name).toLowerCase();
    byFirst.set(f, (byFirst.get(f) || 0) + 1);
  }
  const out = new Map();
  for (const [key, name] of people) {
    const p = parts(name);
    if (!p.length) { out.set(key, fallback); continue; }
    if (byFirst.get(p[0].toLowerCase()) < 2) { out.set(key, p[0]); continue; }
    // Shared first name: add the last initial, or the whole name when the initials match as well
    const initial = p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}` : p[0];
    const clash = people.some(([k, n]) => k !== key && parts(n)[0]?.toLowerCase() === p[0].toLowerCase()
      && (parts(n).length > 1 ? `${parts(n)[0]} ${parts(n).at(-1)[0].toUpperCase()}` : parts(n)[0]).toLowerCase() === initial.toLowerCase());
    out.set(key, clash ? p.join(' ') : initial);
  }
  return out;
}
