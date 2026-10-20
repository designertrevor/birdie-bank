// Debounced course database search for the course picker. Returns the last results
// while a newer query is in flight, and nothing at all when the API isn't set up.
// `limited` is true when the server said too many searches just now (src/lib/rate-limit.js),
// so the picker can say "Try again in a minute" instead of looking empty.
import { useEffect, useState } from 'react';
import { cleanQuery, courseSearchAvailable, searchCourses } from './courseApi.js';

const DEBOUNCE_MS = 350;

export function useCourseSearch(query) {
  const q = cleanQuery(query);
  const [done, setDone] = useState({ q: '', results: [], limited: false });
  // Bumped once the wait a 429 asked for is over, so the same query is tried again by itself
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!done.limited) return undefined;
    const timer = setTimeout(() => setRetry(n => n + 1), Math.min(done.retryAfter || 60, 120) * 1000);
    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!q || !courseSearchAvailable()) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchCourses(q, { signal: ctrl.signal })
        .then(r => setDone({ q, results: r.results, limited: r.status === 'limited', retryAfter: r.retryAfter }))
        .catch(() => { /* aborted by a newer query */ });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, retry]);

  return {
    results: q ? done.results : [],
    loading: !!q && done.q !== q && courseSearchAvailable(),
    limited: !!q && done.q === q && done.limited,
  };
}
