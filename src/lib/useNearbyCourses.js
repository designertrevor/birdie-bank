// "Courses near me" for the course picker. Nothing is asked on open: if this phone looked in
// the last day, that list shows straight away from the cache. Location is asked only when
// the golfer taps, and the picker keeps working while it looks.
import { useEffect, useRef, useState } from 'react';
import { findNearby, latestSpot, nearbyFrom, readCache, reverseGeocode } from './nearby.js';
import { searchCourses } from './courseApi.js';

const storage = () => { try { return window.localStorage; } catch { return null; } };
const memory = { getItem: () => null, setItem: () => {} };

/** The last lookup from today, or an empty idle state. */
function fromCache() {
  const e = latestSpot(readCache(storage() || memory), Date.now());
  return e?.pos ? { status: 'ready', pos: e.pos, place: e.place, courses: nearbyFrom(e.results, e.pos) } : { status: 'idle', pos: null, place: null, courses: [] };
}

function position() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      // A town-level fix is plenty, and one from the last 10 minutes saves the battery
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/**
 * { status, pos, place, courses, ask }. status: 'idle', 'looking', 'ready', 'denied' (location is
 * off for this site), 'unavailable' (no location on this device), 'nofix' (couldn't get a
 * position), 'off' (course search isn't set up) or 'error'. courses carry `miles`.
 */
export function useNearbyCourses() {
  const [s, setS] = useState(fromCache);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const ask = async () => {
    if (busy.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setS(x => ({ ...x, status: 'unavailable' })); return; }
    busy.current = true;
    setS(x => ({ ...x, status: 'looking' }));
    let next;
    try {
      const pos = await position();
      const r = await findNearby(pos, { storage: storage() || memory, geocode: reverseGeocode, search: searchCourses });
      next = { status: r.status === 'ok' ? 'ready' : r.status, pos, place: r.place, courses: r.courses };
    } catch (e) {
      // GeolocationPositionError: 1 permission denied, 2 no position, 3 timed out
      next = { status: e?.code === 1 ? 'denied' : e?.code ? 'nofix' : 'error' };
    }
    busy.current = false;
    if (alive.current) setS(x => (next.status === 'ready' ? next : { ...x, status: next.status, pos: next.pos || x.pos }));
  };

  return { ...s, ask };
}
