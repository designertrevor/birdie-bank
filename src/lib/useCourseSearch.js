// Debounced course database search for the course picker. Returns the last results
// while a newer query is in flight, and nothing at all when the API isn't set up.
import { useEffect, useState } from 'react';
import { cleanQuery, courseSearchAvailable, searchCourses } from './courseApi.js';

const DEBOUNCE_MS = 350;

export function useCourseSearch(query) {
  const q = cleanQuery(query);
  const [done, setDone] = useState({ q: '', results: [] });

  useEffect(() => {
    if (!q || !courseSearchAvailable()) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchCourses(q, { signal: ctrl.signal })
        .then(r => setDone({ q, results: r.results }))
        .catch(() => { /* aborted by a newer query */ });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  return {
    results: q ? done.results : [],
    loading: !!q && done.q !== q && courseSearchAvailable(),
  };
}
