// Courses near me finds courses not named for the nearest town (Overnight 6): it also searches the
// spot's other place names and the towns of the courses it found, dedupes, and sorts by distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SEARCHES, findNearby, searchAround, searchTerms } from './nearby.js';

const memStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const HERE = { lat: 41.737, lon: -111.834 };
const GEO = {
  city: 'Logan', locality: 'Logan', principalSubdivision: 'Utah', principalSubdivisionCode: 'US-UT', countryCode: 'US',
  localityInfo: { administrative: [
    { name: 'United States of America', adminLevel: 2 }, { name: 'Utah', adminLevel: 4 },
    { name: 'Cache County', adminLevel: 6 }, { name: 'Logan', adminLevel: 8 },
  ] },
};
const c = (apiId, name, city, dLat) => ({ apiId, id: `gca-${apiId}`, name, city, lat: HERE.lat + dLat, lon: HERE.lon, teeCount: 1 });
// What the course API finds for each name search (names only, like the real one)
const BY_QUERY = {
  Logan: [c('aaaaaaaa', 'Logan River GC', 'Logan, UT', 0.01), c('bbbbbbbb', 'Logan Golf & CC', 'North Logan, UT', 0.05)],
  Cache: [c('cccccccc', 'Cache Valley Links', 'Hyde Park, UT', 0.08), c('aaaaaaaa', 'Logan River GC', 'Logan, UT', 0.01)],
  'North Logan': [c('dddddddd', 'North Logan Par 3', 'North Logan, UT', 0.04)],
  'Hyde Park': [c('eeeeeeee', 'Hyde Park Muni', 'Hyde Park, UT', 0.09), c('ffffffff', 'Far Away Hyde Park', 'Hyde Park, NY', 30)],
};
function mockSearch(fail = {}) {
  const queries = [];
  return {
    queries,
    search: async q => { queries.push(q); return fail[q] ? { status: fail[q], results: [] } : { status: 'ok', results: BY_QUERY[q] || [] }; },
  };
}

test('searchTerms: the town, then the county without "County", never the state or country', () => {
  assert.deepEqual(searchTerms(GEO), ['Logan', 'Cache']);
  assert.deepEqual(searchTerms({ ...GEO, locality: 'Providence' }), ['Logan', 'Providence', 'Cache']);
  // A reply without localityInfo (what the old tests use) is just the town
  assert.deepEqual(searchTerms({ city: 'Logan', countryCode: 'US' }), ['Logan']);
  assert.deepEqual(searchTerms({ city: '' }), []);
  // Zip codes and names too short to search are skipped
  assert.deepEqual(searchTerms({ city: 'Logan', localityInfo: { administrative: [{ name: '84321', adminLevel: 10 }, { name: 'Ab', adminLevel: 9 }] } }), ['Logan']);
});

test('searchAround follows the towns of the courses it finds, and stops at the cap', async () => {
  const m = mockSearch();
  const r = await searchAround(HERE, searchTerms(GEO), m.search);
  assert.equal(r.status, 'ok');
  // Logan, Cache, then the in-range course towns nearest first: North Logan (0.05) and Hyde Park (0.08)
  assert.deepEqual(m.queries, ['Logan', 'Cache', 'North Logan', 'Hyde Park']);
  assert.ok(m.queries.length <= MAX_SEARCHES);
  const many = { ...GEO, localityInfo: { administrative: ['Aaa', 'Bbb', 'Ccc', 'Ddd', 'Eee', 'Fff'].map((name, i) => ({ name, adminLevel: 9 - i / 10 })) } };
  const m2 = mockSearch();
  await searchAround(HERE, searchTerms(many), m2.search);
  assert.equal(m2.queries.length, MAX_SEARCHES);
});

test('findNearby: courses not named for the town show up, once each, closest first', async () => {
  const m = mockSearch();
  const r = await findNearby(HERE, { storage: memStorage(), now: 1, geocode: async () => GEO, search: m.search });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.place, { town: 'Logan', region: 'UT' });
  // Logan River (found twice) once; Hyde Park, NY is 2,000 miles off and dropped
  assert.deepEqual(r.courses.map(x => x.name), ['Logan River GC', 'North Logan Par 3', 'Logan Golf & CC', 'Cache Valley Links', 'Hyde Park Muni']);
  // The day's answer is cached: no more searches
  const again = await findNearby(HERE, { storage: memStorage(), now: 2, geocode: async () => GEO, search: m.search });
  assert.equal(again.courses.length, 5);
});

test('findNearby: the town search decides off or error; a later failure only adds nothing', async () => {
  const off = mockSearch({ Logan: 'off' });
  assert.equal((await findNearby(HERE, { storage: memStorage(), now: 1, geocode: async () => GEO, search: off.search })).status, 'off');
  assert.deepEqual(off.queries, ['Logan']);
  const flaky = mockSearch({ Cache: 'error' });
  const r = await findNearby(HERE, { storage: memStorage(), now: 1, geocode: async () => GEO, search: flaky.search });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.courses.map(x => x.apiId), ['aaaaaaaa', 'dddddddd', 'bbbbbbbb']);
});
