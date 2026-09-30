import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_KEY, DAY_MS, cachedSpot, distanceMiles, findNearby, latestSpot, mergeNear, milesLabel, nameKey, nearbyFrom, placeFrom, readCache, spotKey, withSpot } from './nearby.js';
import { mapCourse, mapSearch } from './courseApi.js';
import { SAMPLE_COURSES, SAMPLE_SEARCH } from '../data/courseApiSamples.js';

// Logan, UT (a mile or so from the sample Pine Hollow) and a fake localStorage
const LOGAN = { lat: 41.7370, lon: -111.8338 };
const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const GEO_LOGAN = { city: 'Logan', locality: 'Logan', principalSubdivision: 'Utah', principalSubdivisionCode: 'US-UT', countryCode: 'US' };

/** Mocks that count calls, so no test ever reaches the real APIs. */
function mocks({ geo = GEO_LOGAN, search = { status: 'ok', results: mapSearch(SAMPLE_SEARCH) } } = {}) {
  const calls = { geocode: 0, search: 0, queries: [] };
  return {
    calls,
    geocode: async () => { calls.geocode++; if (geo instanceof Error) throw geo; return geo; },
    search: async q => { calls.search++; calls.queries.push(q); return search; },
  };
}

test('spotKey rounds to a tenth of a degree', () => {
  assert.equal(spotKey(41.7370, -111.8338), '41.7,-111.8');
  assert.equal(spotKey(41.7649, -111.8499), '41.8,-111.8');
  assert.equal(spotKey(41.74, -111.86), '41.7,-111.9');
  assert.equal(spotKey(-0.01, 0.02), '0.0,0.0');
  assert.equal(spotKey(NaN, 3), null);
  assert.equal(spotKey(95, 3), null);
});

test('distanceMiles is close to known distances', () => {
  // Logan to Salt Lake City is about 70 miles as the crow flies
  const d = distanceMiles(LOGAN, { lat: 40.7608, lon: -111.8910 });
  assert.ok(d > 66 && d < 70, `got ${d}`);
  assert.equal(distanceMiles(LOGAN, LOGAN), 0);
});

test('milesLabel: one decimal under 10, whole miles after', () => {
  assert.equal(milesLabel(3.24), '3.2 mi');
  assert.equal(milesLabel(0.02), '0.1 mi');
  assert.equal(milesLabel(9.96), '10.0 mi');
  assert.equal(milesLabel(12.4), '12 mi');
  assert.equal(milesLabel(NaN), '');
});

test('placeFrom picks the town and a short US state', () => {
  assert.deepEqual(placeFrom(GEO_LOGAN), { town: 'Logan', region: 'UT' });
  assert.deepEqual(placeFrom({ city: '', locality: 'St Andrews', principalSubdivision: 'Scotland', countryCode: 'GB' }), { town: 'St Andrews', region: 'Scotland' });
  assert.equal(placeFrom({ city: '', locality: '' }), null);
  assert.equal(placeFrom(null), null);
});

test('nearbyFrom keeps courses in range with coordinates, closest first', () => {
  const results = [
    { apiId: 'a', name: 'Far', lat: 40.7608, lon: -111.8910 }, // about 68 mi
    { apiId: 'b', name: 'Mid', lat: 41.60, lon: -111.83 },
    { apiId: 'c', name: 'Near', lat: 41.74, lon: -111.83 },
    { apiId: 'd', name: 'No coords' },
    { apiId: 'c', name: 'Near', lat: 41.74, lon: -111.83 }, // a repeat
  ];
  const near = nearbyFrom(results, LOGAN);
  assert.deepEqual(near.map(r => r.name), ['Near', 'Mid']);
  assert.ok(near[0].miles < 1);
  assert.deepEqual(nearbyFrom(results, LOGAN, { max: 1 }).map(r => r.name), ['Near']);
  assert.deepEqual(nearbyFrom(results, null), []);
});

test('the cache is fresh for a day, keyed by spot, and keeps a few spots', () => {
  const t = 1_000_000_000_000;
  let cache = withSpot(undefined, { key: 'A', at: t, place: null, results: [] }, t);
  assert.equal(cachedSpot(cache, 'A', t + DAY_MS - 1).key, 'A');
  assert.equal(cachedSpot(cache, 'A', t + DAY_MS), null);
  assert.equal(cachedSpot(cache, 'B', t), null);
  for (const k of ['B', 'C', 'D', 'E', 'F']) cache = withSpot(cache, { key: k, at: t + 10, results: [] }, t + 10);
  assert.deepEqual(cache.entries.map(e => e.key), ['F', 'E', 'D', 'C', 'B']);
  assert.equal(latestSpot(cache, t + 20).key, 'F');
  // A day later nothing is fresh, and saving a new spot drops the stale ones
  assert.equal(latestSpot(cache, t + 10 + DAY_MS), null);
  assert.deepEqual(withSpot(cache, { key: 'G', at: t + 2 * DAY_MS }, t + 2 * DAY_MS).entries.map(e => e.key), ['G']);
});

test('readCache survives junk in storage', () => {
  const s = memStorage();
  assert.deepEqual(readCache(s), { entries: [] });
  s.setItem(CACHE_KEY, '{not json');
  assert.deepEqual(readCache(s), { entries: [] });
  assert.deepEqual(readCache({ getItem: () => { throw new Error('blocked'); } }), { entries: [] });
});

test('findNearby: one geocode and one search the first time, none again that day', async () => {
  const storage = memStorage();
  const m = mocks();
  const t = 1_700_000_000_000;
  const first = await findNearby(LOGAN, { storage, now: t, geocode: m.geocode, search: m.search });
  assert.equal(first.status, 'ok');
  assert.equal(first.cached, false);
  assert.deepEqual(first.place, { town: 'Logan', region: 'UT' });
  assert.deepEqual(m.calls.queries, ['Logan']);
  // Pine Hollow is in Logan; Cedar Ridge (Heber City) is about 85 miles off; the others have no coordinates
  assert.deepEqual(first.courses.map(c => c.apiId), ['7k2m9qb4']);
  assert.equal(milesLabel(first.courses[0].miles), '0.1 mi');

  // Same spot a few blocks away, later that day: no network, distance measured from the new spot
  const walk = { lat: 41.7450, lon: -111.8100 };
  const again = await findNearby(walk, { storage, now: t + 6 * 3600e3, geocode: m.geocode, search: m.search });
  assert.equal(again.cached, true);
  assert.deepEqual(again.courses.map(c => c.apiId), ['7k2m9qb4']);
  assert.ok(again.courses[0].miles > 1);
  assert.equal(m.calls.geocode, 1);
  assert.equal(m.calls.search, 1);

  // The next day it looks again
  await findNearby(LOGAN, { storage, now: t + DAY_MS + 1, geocode: m.geocode, search: m.search });
  assert.equal(m.calls.search, 2);
});

test('findNearby caches an empty answer too, but not a failure', async () => {
  const storage = memStorage();
  const empty = mocks({ search: { status: 'ok', results: [] } });
  const t = 1_700_000_000_000;
  assert.deepEqual((await findNearby(LOGAN, { storage, now: t, ...empty })).courses, []);
  await findNearby(LOGAN, { storage, now: t + 1, ...empty });
  assert.equal(empty.calls.search, 1);

  const s2 = memStorage();
  const down = mocks({ search: { status: 'error', results: [] } });
  assert.equal((await findNearby(LOGAN, { storage: s2, now: t, ...down })).status, 'error');
  await findNearby(LOGAN, { storage: s2, now: t + 1, ...down });
  assert.equal(down.calls.search, 2);

  const off = mocks({ search: { status: 'off', results: [] } });
  assert.equal((await findNearby(LOGAN, { storage: memStorage(), now: t, ...off })).status, 'off');
});

test('findNearby: no town or a failed geocode spends no course search', async () => {
  const t = 1_700_000_000_000;
  const nowhere = mocks({ geo: { city: '', locality: '' } });
  assert.equal((await findNearby(LOGAN, { storage: memStorage(), now: t, ...nowhere })).status, 'error');
  const broken = mocks({ geo: new Error('down') });
  assert.equal((await findNearby(LOGAN, { storage: memStorage(), now: t, ...broken })).status, 'error');
  assert.equal(nowhere.calls.search + broken.calls.search, 0);
  assert.equal((await findNearby({ lat: NaN, lon: 0 }, { storage: memStorage(), now: t, ...nowhere })).status, 'error');
});

test('a course picked from Near you keeps its coordinates', () => {
  const c = mapCourse(SAMPLE_COURSES['7k2m9qb4']);
  assert.equal(c.lat, 41.7355);
  assert.equal(c.lon, -111.8344);
});

test('nameKey ignores the golf words', () => {
  assert.equal(nameKey('Logan River GC'), 'logan river');
  assert.equal(nameKey('Logan River Golf Course'), 'logan river');
  assert.equal(nameKey('Preston G&CC'), 'preston');
  assert.equal(nameKey('Preston Golf & Country Club'), 'preston');
  assert.equal(nameKey('The Links at Birch Creek'), 'birch creek');
});

test('mergeNear: saved courses win over search results, closest first', () => {
  const builtIn = { id: 'logan-river', name: 'Logan River GC', city: 'Logan, UT' };
  const added = { id: 'gca-7k2m9qb4', apiId: '7k2m9qb4', name: 'Pine Hollow Golf Club', city: 'Logan, UT' };
  const ownCoords = { id: 'mine', name: 'Back Nine Farm', city: 'Hyde Park, UT', lat: 41.80, lon: -111.82 };
  const farOwn = { id: 'far', name: 'Far Away', city: 'Moab, UT', lat: 38.57, lon: -109.55 };
  const near = [
    { apiId: 'aaaaaaaa', id: 'gca-aaaaaaaa', name: 'Logan River Golf Course', city: 'Logan, UT', miles: 3.1 },
    { apiId: '7k2m9qb4', id: 'gca-7k2m9qb4', name: 'Pine Hollow Golf Club', city: 'Logan, UT', miles: 0.2 },
    { apiId: 'bbbbbbbb', id: 'gca-bbbbbbbb', name: 'Logan River Golf Course', city: 'Ogden, UT', miles: 9 },
  ];
  const m = mergeNear(near, [builtIn, added, ownCoords, farOwn], LOGAN);
  assert.deepEqual(m.map(x => (x.c ? `c:${x.c.id}` : `r:${x.r.apiId}`)), ['c:gca-7k2m9qb4', 'c:logan-river', 'c:mine', 'r:bbbbbbbb']);
  assert.equal(m[1].miles, 3.1);
  assert.ok(m[2].miles > 4 && m[2].miles < 5);
  assert.equal(mergeNear(near, [], LOGAN, { max: 2 }).length, 2);
  assert.deepEqual(mergeNear([], [], null), []);
});
