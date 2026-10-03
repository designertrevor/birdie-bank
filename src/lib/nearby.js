// Courses near you, for the course picker. GolfCourseAPI can't search by location: its
// /v1/search matches course and club names only. But since v1.1.0 every search result
// carries the course's latitude and longitude. So a lookup is:
//   1. the phone's position (asked only when the golfer taps "Courses near me"),
//   2. the nearest town from BigDataCloud's free client-side reverse geocoder (no key, and it
//      doesn't count against our GolfCourseAPI quota),
//   3. course searches through /api/courses, which Vercel's CDN caches for a day by query, so
//      every phone in the same town shares those calls: the town first, then the other place
//      names the geocoder gives for the spot (the locality, the county without "County"), then
//      the towns of the in-range courses that search found (a course in North Logan leads to
//      "North Logan", where the courses named for it live). At most MAX_SEARCHES in all.
//   4. results kept only when their coordinates are within RADIUS_MI, one per course, closest first.
// Results are cached on the phone for a day, keyed by the position rounded to about 7 miles,
// so each phone looks up at most once a day per spot. A course whose name shares no word with
// any town or county around it can still be missed: the course API only searches names.

export const GEOCODER = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
export const GRID = 0.1; // degrees: about 7 miles north to south, 5 east to west in the US
export const RADIUS_MI = 30;
export const NEAR_MAX = 8;
// Course searches per lookup: the town, other names for the spot, nearby course towns.
// Held at 2 (it was 5) while GolfCourseAPI is on the free tier, so one tap of "Courses near me"
// can't spend much of the day's quota. Raise this one number once the course API is upgraded.
export const MAX_SEARCHES = 2;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_KEY = 'bb-near-courses';
const CACHE_KEEP = 5; // spots remembered, for a golfer who plays in a few towns

const toRad = d => (d * Math.PI) / 180;
const isCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** The cache key for a position: rounded to the GRID, so a few blocks' walk hits the same entry. */
export function spotKey(lat, lon) {
  if (!isCoord(lat, lon)) return null;
  const r = v => (Math.round(v / GRID) * GRID).toFixed(1).replace(/^-0\.0$/, '0.0');
  return `${r(lat)},${r(lon)}`;
}

/** Straight-line miles between two { lat, lon } points (haversine). */
export function distanceMiles(a, b) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "0.4 mi", "3.2 mi", "12 mi". */
export function milesLabel(mi) {
  if (!Number.isFinite(mi)) return '';
  if (mi < 10) return `${Math.max(0.1, Math.round(mi * 10) / 10).toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/** The town to search for from a BigDataCloud reply: { town, region }, or null when there's none. */
export function placeFrom(json) {
  const town = String(json?.city || json?.locality || '').trim();
  if (!town) return null;
  // "US-UT" becomes "UT"; outside the US the subdivision name reads better
  const code = String(json?.principalSubdivisionCode || '');
  const region = json?.countryCode === 'US' && /^US-[A-Z]{2}$/.test(code) ? code.slice(3) : String(json?.principalSubdivision || '').trim();
  return { town, region };
}

const CLEAN_PLACE = /\s+(county|parish|borough|township|census area|municipality)$/i;
/** A place name as a course search: "Cache County" becomes "Cache". Too short to search: ''. */
function searchable(name) {
  const t = String(name || '').replace(CLEAN_PLACE, '').trim();
  return t.length >= 3 && !/^\d/.test(t) ? t : '';
}

/**
 * The course searches for a BigDataCloud reply, the town first: the town, the locality when it
 * differs, then the reply's own smaller-than-state places (county and below), deduped ignoring case.
 * The state and country are left out: a course name search for "Utah" finds courses across it.
 */
export function searchTerms(json) {
  const place = placeFrom(json);
  if (!place) return [];
  const admin = Array.isArray(json?.localityInfo?.administrative) ? json.localityInfo.administrative : [];
  const local = admin.filter(a => Number(a?.adminLevel) >= 5).sort((a, b) => Number(b.adminLevel) - Number(a.adminLevel)).map(a => a.name);
  const out = [];
  for (const n of [place.town, json?.locality, json?.city, ...local]) {
    const t = searchable(n);
    if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/**
 * Search results within `radius` miles of `pos`, each with `miles`, closest first, at most `max`.
 * Results with no coordinates are left out, since we can't say how far they are.
 */
export function nearbyFrom(results, pos, { radius = RADIUS_MI, max = NEAR_MAX } = {}) {
  if (!pos || !isCoord(pos.lat, pos.lon)) return [];
  const seen = new Set();
  return (results || [])
    .filter(r => r && isCoord(r.lat, r.lon))
    .map(r => ({ ...r, miles: distanceMiles(pos, r) }))
    .filter(r => r.miles <= radius)
    .sort((a, b) => a.miles - b.miles || a.name.localeCompare(b.name))
    .filter(r => { const k = r.apiId || r.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}

const FILLER = /\b(the|golf|course|club|country|links|gc|cc|g&cc|gcc|and|at|of)\b/g;
/** "Logan River GC" and "Logan River Golf Course" both become "logan river". */
export function nameKey(name) {
  return String(name || '').toLowerCase().replace(/\bg\s*&\s*cc\b/g, ' ').replace(/&/g, ' and ').replace(FILLER, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}
const townOf = city => String(city || '').split(',')[0].trim().toLowerCase();

/**
 * One list for the Near you section: [{ miles, c } | { miles, r }], closest first. `c` is a
 * course already on this phone, `r` a search result to add. A result becomes the saved course
 * when it has the same database id, or the same name and town (so the bundled "Logan River GC"
 * isn't shown twice). Saved courses with their own coordinates count too, at no cost.
 */
export function mergeNear(near, saved, pos, { max = NEAR_MAX } = {}) {
  const list = saved || [];
  const byApi = new Map(list.filter(c => c.apiId).map(c => [c.apiId, c]));
  const byName = new Map(list.map(c => [`${nameKey(c.name)}|${townOf(c.city)}`, c]));
  const out = new Map();
  const put = (id, item) => { const had = out.get(id); if (!had || item.miles < had.miles) out.set(id, item); };
  for (const r of near || []) {
    const c = byApi.get(r.apiId) || byName.get(`${nameKey(r.name)}|${townOf(r.city)}`);
    if (c) put(c.id, { miles: r.miles, c });
    else put(r.id || r.apiId, { miles: r.miles, r });
  }
  for (const c of nearbyFrom(list, pos, { max: 50 })) put(c.id, { miles: c.miles, c: list.find(x => x.id === c.id) });
  return [...out.values()].sort((a, b) => a.miles - b.miles).slice(0, max);
}

// ---------------------------------------------------------------------------
// The phone's cache: { entries: [{ key, at, place, results }] }, newest first. Pure functions
// over the parsed value; the hook reads and writes localStorage around them.

/** A fresh (under a day old) entry for this spot, or null. */
export function cachedSpot(cache, key, now) {
  const e = (cache?.entries || []).find(x => x.key === key);
  return e && now - e.at >= 0 && now - e.at < DAY_MS ? e : null;
}

/** The newest fresh entry of any spot, to show on open without asking for location again. */
export function latestSpot(cache, now) {
  return (cache?.entries || []).find(x => now - x.at >= 0 && now - x.at < DAY_MS) || null;
}

/** The cache with this entry saved first, stale entries dropped, and at most CACHE_KEEP kept. */
export function withSpot(cache, entry, now) {
  const rest = (cache?.entries || []).filter(x => x.key !== entry.key && now - x.at < DAY_MS);
  return { entries: [entry, ...rest].slice(0, CACHE_KEEP) };
}

export function readCache(storage) {
  try { const v = JSON.parse(storage.getItem(CACHE_KEY)); return v && Array.isArray(v.entries) ? v : { entries: [] }; } catch { return { entries: [] }; }
}
export function writeCache(storage, cache) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
}

/**
 * Find courses near `pos` ({ lat, lon }). Uses the day's cached answer for this spot when there
 * is one (no network at all). Otherwise one reverse geocode and one course search.
 * `deps`: { storage, now, geocode(lat, lon) -> json, search(query) -> { status, results } }.
 * Resolves { status: 'ok' | 'off' | 'error', place, courses, cached }. Only an abort rejects.
 */
export async function findNearby(pos, { storage, now = Date.now(), geocode, search, max = MAX_SEARCHES }) {
  const key = spotKey(pos?.lat, pos?.lon);
  if (!key) return { status: 'error', place: null, courses: [], cached: false };
  const cache = readCache(storage);
  const hit = cachedSpot(cache, key, now);
  if (hit) return { status: 'ok', place: hit.place, courses: nearbyFrom(hit.results, pos), cached: true };

  let place;
  let json;
  try {
    json = await geocode(pos.lat, pos.lon);
    place = placeFrom(json);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    return { status: 'error', place: null, courses: [], cached: false };
  }
  if (!place) return { status: 'error', place: null, courses: [], cached: false };

  const terms = searchTerms(json);
  const r = await searchAround(pos, terms.length ? terms : [place.town], search, max);
  if (r.status !== 'ok') return { status: r.status, place, courses: [], cached: false };
  // Keep only what's in range, trimmed to what the picker needs, so the cache stays small
  const results = nearbyFrom(r.results, pos, { radius: RADIUS_MI + 10, max: 20 })
    .map(({ apiId, id, name, city, teeCount, lat, lon }) => ({ apiId, id, name, city, teeCount, lat, lon }));
  // Where the golfer was (to about 100 yards), so the list can show on the next open that day
  const where = { lat: Math.round(pos.lat * 1000) / 1000, lon: Math.round(pos.lon * 1000) / 1000 };
  writeCache(storage, withSpot(cache, { key, at: now, pos: where, place, results }, now));
  return { status: 'ok', place, courses: nearbyFrom(results, pos), cached: false };
}

/**
 * Course searches for the spot's place names, then for the towns of the in-range courses found,
 * nearest first, until `max` searches (MAX_SEARCHES unless a test asks for more). Resolves { status, results } with every result found. The
 * first search decides the status: when it fails (or search is off) nothing more is tried; a
 * later failure just adds nothing.
 */
export async function searchAround(pos, terms, search, max = MAX_SEARCHES) {
  const done = new Set();
  const all = [];
  const run = async q => {
    done.add(q.toLowerCase());
    const r = await search(q);
    if (r?.status === 'ok') all.push(...(r.results || []));
    return r;
  };
  const first = await run(terms[0]);
  if (first?.status !== 'ok') return { status: first?.status || 'error', results: [] };
  // Each wave runs at once, so a lookup waits for three round trips at most
  const wave = list => {
    const picked = [];
    for (const q of list) {
      if (done.size + picked.length >= max) break;
      if (q && !done.has(q.toLowerCase()) && !picked.some(x => x.toLowerCase() === q.toLowerCase())) picked.push(q);
    }
    return Promise.all(picked.map(run));
  };
  await wave(terms.slice(1));
  // The towns of the courses in range, nearest first: the course API knows each course's own city
  await wave(nearbyFrom(all, pos, { radius: RADIUS_MI, max: 50 }).map(c => searchable(String(c.city || '').split(',')[0])));
  return { status: 'ok', results: all };
}

/** BigDataCloud's reply for a position (browser only; their free tier is for client-side calls). */
export async function reverseGeocode(lat, lon, { signal } = {}) {
  const url = `${GEOCODER}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  return res.json();
}
