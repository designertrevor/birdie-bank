// Time zones for pushes that go at a time of day (the tee time reminder). Each phone saves its own
// IANA zone ("America/Denver", "Europe/London") with its push subscription (push-client.js), and
// the hourly job (api/push-tee.js) sends to an organizer only in the hour their clock reads
// TEE_HOUR, with "today" as their own calendar says it. The once-per-plan rule stays in the
// database (push_tee_due in supabase/2026-10-20-push-timezones.sql), so a move across zones, or a
// job that runs twice, never sends a plan's reminder again.
// Pure: Node's and the browser's own Intl, no network.

/** Rows saved before zones existed are this one: every tester then was in Utah. */
export const DEFAULT_ZONE = 'America/Denver';

/** The tee time reminder goes in this hour of the organizer's own morning (8:00 to 8:59). */
export const TEE_HOUR = 8;

// What the database also lets in (the same shape, see the SQL): "UTC", "Asia/Tokyo",
// "America/Argentina/Buenos_Aires", "Etc/GMT+7"
const SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/;

const formats = new Map();
/** A formatter for one zone, or null when this runtime doesn't know it. */
function formatter(zone) {
  if (formats.has(zone)) return formats.get(zone);
  let f = null;
  try {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { f = null; }
  if (formats.size < 2000) formats.set(zone, f);
  return f;
}

/** A zone name worth saving: the right shape and one this runtime knows. Null otherwise. */
export function cleanZone(zone) {
  if (typeof zone !== 'string') return null;
  const z = zone.trim();
  if (!z || z.length > 64 || !SHAPE.test(z)) return null;
  return formatter(z) ? z : null;
}

/** This phone's zone, or null when the browser can't say. */
export function deviceZone() {
  try { return cleanZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return null; }
}

/**
 * The wall clock in `zone` at `now`: { date: 'YYYY-MM-DD', hour, minute }. A zone this runtime
 * doesn't know reads as DEFAULT_ZONE, so a stray name still gets its reminder in a US morning.
 */
export function zoneClock(now, zone) {
  const f = formatter(cleanZone(zone) || DEFAULT_ZONE) || formatter(DEFAULT_ZONE);
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  // Some engines write midnight as 24 even with h23
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, hour, minute: Number(p.minute) };
}

/**
 * The zones whose clock is in `hour` at `now`, each with its own today:
 * { 'America/Denver': '2026-10-20', ... }. This is what push_tee_due reads: an organizer whose
 * newest phone is in one of these zones gets the reminders due on that day. `zones` are the names
 * the database has (strings, or rows with time_zone); at most 2000, each once.
 */
export function teeDays(zones, now = new Date(), hour = TEE_HOUR) {
  const out = {};
  for (const z of (Array.isArray(zones) ? zones : []).slice(0, 2000)) {
    const name = typeof z === 'string' ? z : z?.time_zone;
    if (typeof name !== 'string' || !name || name.length > 64 || name in out) continue;
    const c = zoneClock(now, name);
    if (c.hour === hour) out[name] = c.date;
  }
  return out;
}

