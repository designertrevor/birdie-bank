// One tap, one write. A second tap that lands before the screen has caught up (a double tap, a
// slow phone, a button still showing the old amount) runs the same action again with the same
// numbers; for a payment that would count the money twice. `tapOnce()` makes a guard: the same
// key within `ms` of the first run returns the first run's result instead of running again.

export const TAP_MS = 1000;

export function tapOnce(ms = TAP_MS) {
  const last = new Map(); // key -> { at, result }
  const guard = (key, run, now = Date.now()) => {
    const hit = last.get(key);
    if (hit && now - hit.at >= 0 && now - hit.at < ms) return hit.result;
    const result = run();
    last.set(key, { at: now, result });
    // Only recent taps matter, so the map never grows past a handful
    for (const [k, v] of last) if (now - v.at >= ms) last.delete(k);
    return result;
  };
  // Something took it back (an Undo): the next tap is a new one, however soon it comes
  guard.reset = () => last.clear();
  return guard;
}
