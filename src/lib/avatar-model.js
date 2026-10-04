// What a saved avatar can be: a buddy, initials on a colour, or a photo (see avatars.js). Pure,
// tested in avatars.test.js.
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A clean avatar, or null when it isn't one. Extra fields on a buddy (its colors, say) are kept. */
export function normalizeAvatar(a) {
  if (!isObj(a)) return null;
  if (a.kind === 'buddy') {
    const id = text(a.id, 40);
    return id ? { ...a, kind: 'buddy', id } : null;
  }
  if (a.kind === 'initials') {
    // Initials on a colour you picked (avatars.js): the letters come from your name
    const out = { kind: 'initials' };
    const bg = text(a.bg, 20);
    if (bg) out.bg = bg;
    if (a.letters === 1 || a.letters === 2) out.letters = a.letters;
    return out;
  }
  if (a.kind === 'photo') {
    const url = typeof a.url === 'string' ? a.url : '';
    if (!/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(url)) return null;
    const out = { kind: 'photo', url };
    if (typeof a.path === 'string' && a.path) out.path = a.path;
    if (a.pending || url.startsWith('data:')) out.pending = true;
    return out;
  }
  return null;
}
