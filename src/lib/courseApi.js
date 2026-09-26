// Course search backed by GolfCourseAPI (golfcourseapi.com), reached through our own
// /api/courses function so the API key never ships to the phone. The pure mapping
// functions turn its responses into the app's course shape:
// { id, name, city, holes: [{ par, hdcp }], tees: [{ name, rating, slope }], verified, custom }.
// If the server has no key, search quietly returns nothing and the app works as before.

export const SOURCE = 'golfcourseapi';
const ENDPOINT = '/api/courses';

// Opaque 8-character ids from the API's own alphabet (no i, l, o, u)
export const API_ID_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
export const MIN_QUERY = 3;
export const MAX_QUERY = 60;

/** Tidy a search box value into a query worth sending, or '' when it's too short. */
export function cleanQuery(q) {
  const s = String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
  return s.length >= MIN_QUERY ? s : '';
}

/** Our id for a course that came from the API, so a second pick finds the saved copy. */
export function apiCourseId(apiId) { return `gca-${apiId}`; }

/** "Pinehurst Resort (No. 2)", or just one name when the other repeats it. */
export function courseName(club, course) {
  const a = (club || '').trim();
  const b = (course || '').trim();
  if (!a || !b) return a || b;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (bl.includes(al)) return b;
  if (al.includes(bl)) return a;
  return `${a} (${b})`;
}

/** "Logan, UT". Falls back to reading the address when city and state aren't sent. */
export function cityLabel(loc) {
  if (!loc) return '';
  const us = !loc.country || /^(united states|usa|us)$/i.test(loc.country);
  if (loc.city) return [loc.city, loc.state || (us ? '' : loc.country)].filter(Boolean).join(', ');
  const parts = (loc.address || '').split(',').map(s => s.trim()).filter(Boolean);
  // "124 Golf Course Lane, Murray, KY 42071, USA": city and state sit before the country
  if (parts.length >= 4) return `${parts.at(-3)}, ${parts.at(-2).replace(/\s*\d[\d-]*$/, '')}`;
  if (parts.length === 3) return `${parts[1]}, ${parts[2].replace(/\s*\d[\d-]*$/, '')}`;
  return '';
}

/** Search results: [{ apiId, id, name, city, teeCount }]. */
export function mapSearch(json) {
  const list = Array.isArray(json?.courses) ? json.courses : [];
  return list
    .filter(c => c && API_ID_RE.test(String(c.id || '').toLowerCase()))
    .map(c => {
      const apiId = String(c.id).toLowerCase();
      const teeCount = Object.values(c.tees || {}).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0);
      return { apiId, id: apiCourseId(apiId), name: courseName(c.club_name, c.course_name) || 'Unnamed course', city: cityLabel(c.location), teeCount };
    });
}

const isInt = v => Number.isInteger(v);
const validPar = p => isInt(p) && p >= 3 && p <= 6;
const holeCountOk = holes => Array.isArray(holes) && (holes.length === 9 || holes.length === 18);

/** Every hole has a handicap from 1 to 18 and no number repeats. */
export function handicapsComplete(holes) {
  const seen = new Set();
  for (const h of holes) {
    if (!isInt(h.handicap) || h.handicap < 1 || h.handicap > 18 || seen.has(h.handicap)) return false;
    seen.add(h.handicap);
  }
  return true;
}

/** A rating that makes sense for this many holes (9-hole courses carry 9-hole ratings), else null. */
function cleanRating(v, n) {
  const r = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(r)) return null;
  const [lo, hi] = n === 9 ? [25, 45] : [50, 85];
  return r >= lo && r <= hi ? Math.round(r * 10) / 10 : null;
}
function cleanSlope(v) {
  const s = typeof v === 'string' ? parseInt(v, 10) : v;
  return isInt(s) && s >= 55 && s <= 155 ? s : null;
}

/**
 * A full course from GET /v1/courses/{id} in the app's shape, or null when no tee has a
 * usable 9 or 18 hole scorecard. Par and hole handicaps come from the first tee with a
 * complete set (men's tees first). Women's tees get "(W)" when the course also has men's
 * tees, since the same colour usually has a different rating. Missing or repeated hole
 * handicaps leave those holes blank and mark the course unverified so the player checks it.
 */
export function mapCourse(json) {
  const c = json?.course ?? json;
  const apiId = String(c?.id || '').toLowerCase();
  if (!API_ID_RE.test(apiId)) return null;
  const male = Array.isArray(c.tees?.male) ? c.tees.male : [];
  const female = Array.isArray(c.tees?.female) ? c.tees.female : [];
  const all = [...male.map(t => ({ t, w: false })), ...female.map(t => ({ t, w: true }))]
    .filter(({ t }) => t && holeCountOk(t.holes) && t.holes.every(h => validPar(h?.par)));
  if (!all.length) return null;

  const n = all.some(({ t }) => t.holes.length === 18) ? 18 : 9;
  const usable = all.filter(({ t }) => t.holes.length === n);
  const ref = usable.find(({ t }) => handicapsComplete(t.holes)) || usable[0];
  const complete = handicapsComplete(ref.t.holes);
  const holes = ref.t.holes.map(h => {
    const ok = complete || (isInt(h.handicap) && h.handicap >= 1 && h.handicap <= 18 && ref.t.holes.filter(x => x.handicap === h.handicap).length === 1);
    return { par: h.par, hdcp: ok ? h.handicap : null };
  });

  const mixed = usable.some(x => x.w) && usable.some(x => !x.w);
  const tees = [];
  for (const { t, w } of usable) {
    const base = String(t.tee_name || '').trim() || 'Tee';
    const name = w && mixed ? `${base} (W)` : base;
    if (tees.some(x => x.name.toLowerCase() === name.toLowerCase())) continue;
    tees.push({ name, rating: cleanRating(t.course_rating, n), slope: cleanSlope(t.slope_rating) });
  }

  return {
    id: apiCourseId(apiId),
    apiId,
    source: SOURCE,
    name: courseName(c.club_name, c.course_name) || 'Unnamed course',
    city: cityLabel(c.location),
    holes,
    tees,
    custom: true,
    verified: complete && tees.some(t => t.rating != null && t.slope != null),
  };
}

// ---------------------------------------------------------------------------
// Network. Everything below talks to /api/courses (or the dev samples).

let off = false; // the server said it has no key; stop asking for this session
const searchCache = new Map();

// In `npm run dev` there is no /api, so VITE_COURSE_SAMPLES=1 (or localStorage
// bb-course-samples=1) serves the made-up courses in src/data/courseApiSamples.js.
// Written out in full so the production build drops the samples entirely (and so plain
// Node, where import.meta.env doesn't exist, can run the tests).
const DEV = !!(import.meta.env && import.meta.env.DEV);
function samplesOn() {
  if (!DEV) return false;
  if (import.meta.env.VITE_COURSE_SAMPLES === '1') return true;
  try { return localStorage.getItem('bb-course-samples') === '1'; } catch { return false; }
}
async function samples() {
  if (!(import.meta.env && import.meta.env.DEV)) throw new Error('Samples are dev only');
  return import('../data/courseApiSamples.js');
}

/** Whether a search could return anything; false once the server has said it isn't set up. */
export function courseSearchAvailable() { return !off || samplesOn(); }

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  // Vite's dev server answers unknown paths with index.html, which means "no API here"
  const json = (res.headers.get('content-type') || '').includes('application/json') ? await res.json().catch(() => null) : null;
  if (!json || (res.status === 503 && json.error === 'not_configured')) off = true;
  return { res, json };
}

/**
 * Search the course database. Resolves { status: 'ok' | 'off' | 'error', results }.
 * Only an abort rejects, so callers can drop stale requests.
 */
export async function searchCourses(query, { signal } = {}) {
  const q = cleanQuery(query);
  if (!q) return { status: 'ok', results: [] };
  if (samplesOn()) {
    const { SAMPLE_SEARCH } = await samples();
    const needle = q.toLowerCase();
    const hits = SAMPLE_SEARCH.courses.filter(c => [c.club_name, c.course_name, c.location?.city, c.location?.address].some(s => (s || '').toLowerCase().includes(needle)));
    return { status: 'ok', results: mapSearch({ courses: hits }) };
  }
  if (off) return { status: 'off', results: [] };
  const key = q.toLowerCase();
  if (searchCache.has(key)) return { status: 'ok', results: searchCache.get(key) };
  try {
    const { res, json } = await getJson(`${ENDPOINT}?q=${encodeURIComponent(q)}`, signal);
    if (off) return { status: 'off', results: [] };
    if (!res.ok) return { status: 'error', results: [] };
    const results = mapSearch(json);
    searchCache.set(key, results);
    return { status: 'ok', results };
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    return { status: 'error', results: [] };
  }
}

/** Fetch one course's scorecard in the app's shape. Throws when it can't be used. */
export async function getCourse(apiId) {
  const id = String(apiId || '').toLowerCase();
  if (!API_ID_RE.test(id)) throw new Error('Not a course id');
  let json;
  if (samplesOn()) {
    json = (await samples()).SAMPLE_COURSES[id];
  } else {
    const r = await getJson(`${ENDPOINT}?id=${id}`);
    if (!r.res.ok) throw new Error(`Course lookup failed (${r.res.status})`);
    json = r.json;
  }
  const course = mapCourse(json);
  if (!course) throw new Error('No usable scorecard');
  return course;
}
