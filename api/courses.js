// Vercel serverless function: course search and scorecards from GolfCourseAPI, proxied so
// the API key (env GOLFCOURSEAPI_KEY) stays on the server.
//   GET /api/courses?q=pinehurst   -> GolfCourseAPI /v1/search
//   GET /api/courses?id=7k2m9qb4   -> GolfCourseAPI /v1/courses/{id}
// Without a key it answers 503 { error: 'not_configured' } and the app hides API results.

const UPSTREAM = 'https://api.golfcourseapi.com/v1';
const ID_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
const MIN_QUERY = 3;
const MAX_QUERY = 60;

// Scorecards barely change, so let Vercel's CDN answer repeats and save the daily quota
const CACHE_SEARCH = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_COURSE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';

/** Check the query string. Returns { path, cache } for the upstream call, or { status, error }. */
export function parseRequest(search) {
  const params = new URLSearchParams(search);
  const q = params.get('q');
  const id = params.get('id');
  if ((q == null) === (id == null)) return { status: 400, error: 'send exactly one of q or id' };
  if (id != null) {
    const clean = id.trim().toLowerCase();
    if (!ID_RE.test(clean)) return { status: 400, error: 'id must be an 8-character course id' };
    return { path: `/courses/${clean}`, cache: CACHE_COURSE };
  }
  const clean = q.replace(/\s+/g, ' ').trim();
  if (clean.length < MIN_QUERY || clean.length > MAX_QUERY) return { status: 400, error: `q must be ${MIN_QUERY} to ${MAX_QUERY} characters` };
  return { path: `/search?search_query=${encodeURIComponent(clean)}`, cache: CACHE_SEARCH };
}

function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  const key = process.env.GOLFCOURSEAPI_KEY;
  if (!key) return send(res, 503, { error: 'not_configured' });

  const url = new URL(req.url || '/', 'http://localhost');
  const parsed = parseRequest(url.search);
  if (parsed.error) return send(res, parsed.status, { error: parsed.error });

  let upstream;
  try {
    upstream = await fetch(UPSTREAM + parsed.path, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return send(res, 504, { error: 'upstream_unreachable' });
  }
  if (upstream.status === 404) return send(res, 404, { error: 'not_found' }, 'public, s-maxage=3600');
  // A bad or expired key is our problem, not the caller's; don't echo upstream details
  if (upstream.status === 401 || upstream.status === 403) return send(res, 502, { error: 'upstream_auth' });
  if (upstream.status === 429) return send(res, 503, { error: 'rate_limited' });
  if (!upstream.ok) return send(res, 502, { error: 'upstream_error', status: upstream.status });

  let body;
  try { body = await upstream.json(); } catch { return send(res, 502, { error: 'upstream_bad_json' }); }
  return send(res, 200, body, parsed.cache);
}
