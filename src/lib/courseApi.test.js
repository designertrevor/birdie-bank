import test from 'node:test';
import assert from 'node:assert/strict';
import { apiCourseId, cityLabel, cleanQuery, courseName, courseSearchAvailable, getCourse, handicapsComplete, mapCourse, mapSearch, searchCourses } from './courseApi.js';
import { courseWarning, teeDotStyle } from './courses.js';
import { SAMPLE_COURSES, SAMPLE_SEARCH } from '../data/courseApiSamples.js';
import handler, { parseRequest } from '../../api/courses.js';

const clone = x => structuredClone(x);

test('cleanQuery trims, collapses spaces and needs 3 characters', () => {
  assert.equal(cleanQuery('  pine   hollow '), 'pine hollow');
  assert.equal(cleanQuery('pi'), '');
  assert.equal(cleanQuery(null), '');
  assert.equal(cleanQuery('x'.repeat(80)).length, 60);
});

test('courseName drops a repeated club name', () => {
  assert.equal(courseName('Pine Hollow Golf Club', 'Pine Hollow Golf Club'), 'Pine Hollow Golf Club');
  assert.equal(courseName('Cedar Ridge', 'Cedar Ridge Golf Course'), 'Cedar Ridge Golf Course');
  assert.equal(courseName('Pinehurst Resort', 'No. 2'), 'Pinehurst Resort (No. 2)');
  assert.equal(courseName('', 'Course No. 1'), 'Course No. 1');
});

test('cityLabel uses city and state, or reads them from the address', () => {
  assert.equal(cityLabel({ city: 'Logan', state: 'UT', country: 'United States' }), 'Logan, UT');
  assert.equal(cityLabel({ address: '124 Golf Course Lane, Murray, KY 42071, USA' }), 'Murray, KY');
  assert.equal(cityLabel({ city: 'St Andrews', country: 'Scotland' }), 'St Andrews, Scotland');
  assert.equal(cityLabel({}), '');
  assert.equal(cityLabel(undefined), '');
});

test('mapSearch keeps valid ids and counts tees', () => {
  const res = mapSearch(SAMPLE_SEARCH);
  assert.equal(res.length, 4);
  assert.deepEqual(res[0], { apiId: '7k2m9qb4', id: 'gca-7k2m9qb4', name: 'Pine Hollow Golf Club', city: 'Logan, UT', teeCount: 5 });
  assert.equal(res[1].city, 'Heber City, UT');
  assert.equal(res[3].name, 'Pine Hollow Golf Club (Executive Course)');
  // Old numeric ids and junk are dropped; upper case ids are accepted
  assert.deepEqual(mapSearch({ courses: [{ id: 12345 }, null, { id: '7K2M9QB4', club_name: 'X' }] }).map(c => c.apiId), ['7k2m9qb4']);
  assert.deepEqual(mapSearch({}), []);
  assert.deepEqual(mapSearch(null), []);
});

test('mapCourse: 18 holes with men\'s and women\'s tees', () => {
  const c = mapCourse(SAMPLE_COURSES['7k2m9qb4']);
  assert.equal(c.id, apiCourseId('7k2m9qb4'));
  assert.equal(c.apiId, '7k2m9qb4');
  assert.equal(c.source, 'golfcourseapi');
  assert.equal(c.custom, true);
  assert.equal(c.verified, true);
  assert.equal(c.name, 'Pine Hollow Golf Club');
  assert.equal(c.city, 'Logan, UT');
  assert.equal(c.holes.length, 18);
  // Men's handicaps win over the women's, which differ
  assert.deepEqual(c.holes.slice(0, 3), [{ par: 4, hdcp: 7 }, { par: 5, hdcp: 3 }, { par: 3, hdcp: 17 }]);
  assert.deepEqual(c.tees.map(t => t.name), ['Black', 'Blue', 'White', 'White (W)', 'Red (W)']);
  assert.deepEqual(c.tees[1], { name: 'Blue', rating: 71.2, slope: 129 });
  assert.deepEqual(c.tees[3], { name: 'White (W)', rating: 74.6, slope: 133 });
  // No yardage or other extras leak into the app's shape
  assert.deepEqual(Object.keys(c.holes[0]), ['par', 'hdcp']);
});

test('mapCourse accepts a { course } wrapper too', () => {
  assert.equal(mapCourse({ course: SAMPLE_COURSES['7k2m9qb4'] }).id, 'gca-7k2m9qb4');
});

test('mapCourse: 9-hole course keeps 9-hole ratings', () => {
  const c = mapCourse(SAMPLE_COURSES['c3dr9h2x']);
  assert.equal(c.holes.length, 9);
  assert.equal(c.verified, true);
  assert.equal(c.name, 'Cedar Ridge Golf Course');
  // Only women's tee named Red, but the course has men's tees too, so it's marked
  assert.deepEqual(c.tees, [
    { name: 'White', rating: 34.6, slope: 118 },
    { name: 'Gold', rating: 33.1, slope: 112 },
    { name: 'Red (W)', rating: 35.9, slope: 121 },
  ]);
});

test('mapCourse: missing handicaps and slope leave blanks and mark it unverified', () => {
  const c = mapCourse(SAMPLE_COURSES['k8sd4m1v']);
  assert.equal(c.verified, false);
  assert.deepEqual(c.holes.filter(h => h.hdcp == null).length, 3);
  assert.equal(c.holes[0].hdcp, 9);
  assert.deepEqual(c.tees[1], { name: 'White', rating: 68.4, slope: null });
  assert.equal(courseWarning(c), 'Check hole handicaps');
  assert.equal(courseWarning({ ...c, edited: true }), 'Edited by you');
});

test('mapCourse prefers any tee with a full set of handicaps', () => {
  const raw = clone(SAMPLE_COURSES['7k2m9qb4']);
  for (const t of raw.tees.male) delete t.holes[4].handicap;
  const c = mapCourse(raw);
  // Falls through to the women's tees, which are complete
  assert.equal(c.verified, true);
  assert.equal(c.holes[0].hdcp, 5);
});

test('mapCourse blanks repeated handicaps', () => {
  const raw = clone(SAMPLE_COURSES['c3dr9h2x']);
  for (const t of [...raw.tees.male, ...raw.tees.female]) t.holes[1].handicap = 3; // same as hole 1
  const c = mapCourse(raw);
  assert.equal(c.verified, false);
  assert.equal(c.holes[0].hdcp, null);
  assert.equal(c.holes[1].hdcp, null);
  assert.equal(c.holes[2].hdcp, 15);
});

test('mapCourse: women-only course needs no (W) and junk ratings become null', () => {
  const raw = clone(SAMPLE_COURSES['c3dr9h2x']);
  raw.tees = { female: [{ ...raw.tees.female[0], course_rating: 71.9, slope_rating: 300 }] };
  const c = mapCourse(raw);
  // 71.9 is an 18-hole rating on a 9-hole card, and 300 is not a slope
  assert.deepEqual(c.tees, [{ name: 'Red', rating: null, slope: null }]);
  assert.equal(c.verified, false);
});

test('mapCourse returns null when nothing is playable', () => {
  assert.equal(mapCourse(SAMPLE_COURSES['p9ncr3st']), null);
  assert.equal(mapCourse({ id: '7k2m9qb4', tees: {} }), null);
  assert.equal(mapCourse({ id: 42, tees: SAMPLE_COURSES['7k2m9qb4'].tees }), null);
  assert.equal(mapCourse(null), null);
  const raw = clone(SAMPLE_COURSES['7k2m9qb4']);
  for (const t of [...raw.tees.male, ...raw.tees.female]) t.holes = t.holes.slice(0, 12);
  assert.equal(mapCourse(raw), null);
});

test('handicapsComplete wants 1 to 18 with no repeats', () => {
  assert.equal(handicapsComplete([{ handicap: 1 }, { handicap: 2 }]), true);
  assert.equal(handicapsComplete([{ handicap: 1 }, { handicap: 1 }]), false);
  assert.equal(handicapsComplete([{ handicap: 0 }]), false);
  assert.equal(handicapsComplete([{}]), false);
});

test('teeDotStyle finds colours in database tee names', () => {
  assert.deepEqual(teeDotStyle({ name: 'Red (W)' }), { background: '#d64545' });
  assert.deepEqual(teeDotStyle({ name: 'Blue Tees' }), { background: '#2f6fd6' });
  assert.deepEqual(teeDotStyle({ name: 'Championship' }), { background: '#999' });
});

// ---------------------------------------------------------------------------
// The /api/courses proxy

test('parseRequest validates q and id', () => {
  assert.deepEqual(parseRequest('?q=pine%20%20hollow').path, '/search?search_query=pine%20hollow');
  assert.equal(parseRequest('?id=7K2M9QB4').path, '/courses/7k2m9qb4');
  assert.equal(parseRequest('?q=pi').status, 400);
  assert.equal(parseRequest(`?q=${'x'.repeat(61)}`).status, 400);
  assert.equal(parseRequest('?id=12345').status, 400);
  assert.equal(parseRequest('?id=../../users').status, 400);
  assert.equal(parseRequest('').status, 400);
  assert.equal(parseRequest('?q=pine&id=7k2m9qb4').status, 400);
});

function fakeRes() {
  const r = { headers: {}, statusCode: 200, body: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = b => { r.body = b ? JSON.parse(b) : null; };
  return r;
}
async function call(url, { key, upstream, method = 'GET' } = {}) {
  const env = process.env.GOLFCOURSEAPI_KEY;
  const realFetch = globalThis.fetch;
  const seen = [];
  if (key) process.env.GOLFCOURSEAPI_KEY = key; else delete process.env.GOLFCOURSEAPI_KEY;
  globalThis.fetch = async (u, init) => { seen.push({ u, init }); return upstream(); };
  try {
    const res = fakeRes();
    await handler({ method, url }, res);
    return { res, seen };
  } finally {
    globalThis.fetch = realFetch;
    if (env == null) delete process.env.GOLFCOURSEAPI_KEY; else process.env.GOLFCOURSEAPI_KEY = env;
  }
}
const jsonResponse = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('proxy says not_configured without a key and never calls out', async () => {
  const { res, seen } = await call('/api/courses?q=pine', { upstream: jsonResponse(200, {}) });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'not_configured' });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(seen.length, 0);
});

test('proxy forwards search with a bearer key and CDN caching', async () => {
  const { res, seen } = await call('/api/courses?q=pine', { key: 'test-key', upstream: jsonResponse(200, SAMPLE_SEARCH) });
  assert.equal(res.statusCode, 200);
  assert.equal(seen[0].u, 'https://api.golfcourseapi.com/v1/search?search_query=pine');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer test-key');
  assert.match(res.headers['cache-control'], /s-maxage=86400/);
  assert.equal(res.body.courses.length, 4);
  // The key never appears in what we send back
  assert.ok(!JSON.stringify(res).includes('test-key'));
});

test('proxy maps upstream failures and rejects bad input', async () => {
  const notFound = await call('/api/courses?id=7k2m9qb4', { key: 'k', upstream: jsonResponse(404, { error: 'the requested resource could not be found' }) });
  assert.equal(notFound.res.statusCode, 404);
  const badKey = await call('/api/courses?id=7k2m9qb4', { key: 'k', upstream: jsonResponse(401, { error: 'API key is missing or invalid' }) });
  assert.equal(badKey.res.statusCode, 502);
  assert.equal(badKey.res.body.error, 'upstream_auth');
  const bad = await call('/api/courses?id=nope', { key: 'k', upstream: jsonResponse(200, {}) });
  assert.equal(bad.res.statusCode, 400);
  assert.equal(bad.seen.length, 0);
  const post = await call('/api/courses?q=pine', { key: 'k', method: 'POST', upstream: jsonResponse(200, {}) });
  assert.equal(post.res.statusCode, 405);
  const down = await call('/api/courses?q=pine', { key: 'k', upstream: () => { throw new TypeError('fetch failed'); } });
  assert.equal(down.res.statusCode, 504);
});

// ---------------------------------------------------------------------------
// The client, against a stubbed /api/courses. Runs last: "not configured" sticks for the session.

async function withFetch(fn, body) {
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async u => { urls.push(u); return fn(u)(); };
  try { return { out: await body(), urls }; } finally { globalThis.fetch = realFetch; }
}

test('client searches, caches, and fetches a scorecard', async () => {
  const { out, urls } = await withFetch(u => (u.includes('?q=') ? jsonResponse(200, SAMPLE_SEARCH) : jsonResponse(200, SAMPLE_COURSES['c3dr9h2x'])), async () => {
    const a = await searchCourses(' Pine  Hollow ');
    const b = await searchCourses('pine hollow');
    const c = await getCourse('C3DR9H2X');
    return { a, b, c };
  });
  assert.equal(out.a.status, 'ok');
  assert.equal(out.a.results.length, 4);
  assert.equal(out.b.results, out.a.results);
  assert.deepEqual(urls, ['/api/courses?q=Pine%20Hollow', '/api/courses?id=c3dr9h2x']);
  assert.equal(out.c.id, 'gca-c3dr9h2x');
  assert.equal((await searchCourses('pi')).results.length, 0);
});

test('client: unusable scorecards and failures throw, search errors stay quiet', async () => {
  const { out } = await withFetch(u => (u.includes('?id=p9ncr3st') ? jsonResponse(200, SAMPLE_COURSES['p9ncr3st']) : jsonResponse(500, { error: 'boom' })), async () => ({
    empty: await getCourse('p9ncr3st').catch(e => e.message),
    fail: await getCourse('7k2m9qb4').catch(e => e.message),
    bad: await getCourse('nope').catch(e => e.message),
    search: await searchCourses('cedar'),
  }));
  assert.equal(out.empty, 'No usable scorecard');
  assert.match(out.fail, /500/);
  assert.equal(out.bad, 'Not a course id');
  assert.deepEqual(out.search, { status: 'error', results: [] });
  assert.equal(courseSearchAvailable(), true);
});

test('client goes quiet for the session once the server has no key', async () => {
  const { out, urls } = await withFetch(() => jsonResponse(503, { error: 'not_configured' }), async () => [
    await searchCourses('lakeside'),
    await searchCourses('lakeside two'),
  ]);
  assert.deepEqual(out, [{ status: 'off', results: [] }, { status: 'off', results: [] }]);
  assert.equal(urls.length, 1);
  assert.equal(courseSearchAvailable(), false);
});
