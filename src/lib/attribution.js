// Which creator sent someone: a creator's link carries ?ref=CODE (or ?via=CODE), and the phone keeps
// the first code it ever sees with the page it landed on (first touch wins, a later link never
// replaces it). Every usage event carries it (analytics.js), and once someone signs in it's saved
// to their account, one row each (supabase/2026-10-09-attribution.sql), so a creator's downloads can
// be followed all the way to paying. main.jsx reads it before the app tidies the address bar.
// Pure apart from saveAttribution, which takes the Supabase client.

export const REF_KEY = 'bb-ref';
const SAVED_KEY = 'bb-ref-saved';
const MAX_CODE = 32;

/**
 * A creator code as a short slug ("Good Good Golf!" → "good-good-golf"), or null. Lower case
 * letters, digits, - and _, at most 32 characters; anything that looks like an email is no code.
 */
export function cleanRef(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.includes('@')) return null;
  const slug = s.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, MAX_CODE)
    .replace(/[-_]+$/, '');
  return slug || null;
}

/** The creator code in a query string or URLSearchParams (?ref= first, then ?via=), or null. */
export function refFrom(search) {
  let q;
  try { q = search instanceof URLSearchParams ? search : new URLSearchParams(search || ''); } catch { return null; }
  return cleanRef(q.get('ref')) || cleanRef(q.get('via'));
}

// The app links a creator might put a code on, in the order the app opens them
const LINK_KINDS = ['join', 'plan', 'challenge', 'draft', 'play', 'roadmap'];

/** The page someone landed on: its path, and the kind of app link it was ("/?join"), never the code in it. */
export function landingOf(path, search) {
  const p = String(path || '/').split(/[?#]/)[0].replace(/[^A-Za-z0-9/_.-]/g, '').slice(0, 48) || '/';
  let q;
  try { q = new URLSearchParams(search || ''); } catch { q = new URLSearchParams(); }
  const kind = LINK_KINDS.find(k => q.has(k));
  return kind ? `${p}?${kind}` : p;
}

/**
 * What to keep after this visit: the saved attribution if there is one (first touch wins), else a
 * new one from this address, else null. `fresh`: the phone hadn't been set up when the code
 * arrived, so it counts as a new download rather than someone who already had the app.
 */
export function firstTouch(saved, { search, path, now = Date.now(), fresh = true } = {}) {
  if (saved?.code) return saved;
  const code = refFrom(search);
  if (!code) return null;
  return { code, landing: landingOf(path, search), at: now, fresh: !!fresh };
}

/** The attribution saved on this phone, or null. */
export function readAttribution(storage) {
  try {
    const a = JSON.parse(storage?.getItem(REF_KEY) || 'null');
    const code = cleanRef(a?.code);
    return code ? { code, landing: String(a.landing || '/').slice(0, 64), at: Number(a.at) || 0, fresh: a.fresh !== false } : null;
  } catch { return null; }
}

/**
 * Read this visit's address and keep the first creator code seen. Returns what's kept (or null).
 * Never throws: blocked storage just means nothing is kept.
 */
export function captureAttribution({ storage, search, path, now = Date.now(), fresh = true } = {}) {
  const saved = readAttribution(storage);
  const kept = firstTouch(saved, { search, path, now, fresh });
  if (kept && kept !== saved) {
    try { storage?.setItem(REF_KEY, JSON.stringify(kept)); } catch { /* storage blocked */ }
  }
  return kept;
}

/** The properties every usage event carries for it: { ref, ref_landing, ref_new }, or nothing. */
export function attributionProps(a) {
  if (!a?.code) return {};
  return { ref: a.code, ref_landing: a.landing, ref_new: a.fresh !== false };
}

/** The account row for it (supabase/2026-10-09-attribution.sql). */
export function attributionRow(a, userId) {
  return { user_id: userId, code: a.code, landing: a.landing, first_seen: new Date(a.at || Date.now()).toISOString(), new_phone: a.fresh !== false };
}

/** The server isn't set up for it yet (the SQL hasn't run): a missing table or column. */
export function attributionOff(error) {
  const code = error?.code;
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)) return true;
  return /relation .* does not exist|could not find the table/i.test(String(error?.message || ''));
}

/**
 * Save it to the signed-in account, once per account per phone. A row already there (another
 * phone saved one first) is first touch too, so that counts as saved. Until the SQL runs it says
 * 'off' and tries again next launch. Resolves to 'saved' | 'none' | 'off' | 'failed'.
 */
export async function saveAttribution({ db, userId, storage }) {
  const a = readAttribution(storage);
  if (!a || !db || !userId) return 'none';
  try { if (storage?.getItem(SAVED_KEY) === userId) return 'saved'; } catch { /* storage blocked */ }
  try {
    const { error } = await db.from('attribution').insert(attributionRow(a, userId));
    if (error && error.code !== '23505') return attributionOff(error) ? 'off' : 'failed';
  } catch { return 'failed'; }
  try { storage?.setItem(SAVED_KEY, userId); } catch { /* storage blocked */ }
  return 'saved';
}

/**
 * The little script the static pages (the rule pages) carry so a code on them survives into the
 * app: it adds ?ref=CODE to every link back into the site. The code goes through the same rule as
 * cleanRef's characters, so nothing else can ride along.
 */
export const CARRY_REF_SCRIPT = `<script>(function(){try{var q=new URLSearchParams(location.search),r=(q.get('ref')||q.get('via')||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,${MAX_CODE});if(!r)return;document.querySelectorAll('a[href^="/"]').forEach(function(a){var u=new URL(a.getAttribute('href'),location.origin);if(u.searchParams.has('ref'))return;u.searchParams.set('ref',r);a.setAttribute('href',u.pathname+u.search+u.hash)})}catch(e){}})()</script>`;
