// Crash reports: a crash on a screen (ErrorBoundary.jsx), an error nothing caught and a promise
// nobody handled. This is the reporter behind reportError (crash.js, the tiny part on the first
// screen); ops-late.js loads it after the first paint, only with a Sentry DSN, and wires it to Sentry.
// Errors from before Sentry has loaded wait in a short queue and go once it's up; after that,
// Sentry's own handlers catch the window's errors, so each one goes once.
const MAX_QUEUE = 10;

/**
 * A reporter. `start({ load, allowed })`: `load()` resolves to { capture(error, context) };
 * `allowed()` is Share usage data. Until `start`, and while loading, errors queue.
 */
export function createCrashReporter() {
  let state = 'waiting'; // 'waiting' | 'loading' | 'ready' | 'off'
  let client = null;
  let allowed = () => true;
  let loader = null;
  let queue = [];
  const ok = () => { try { return allowed() !== false; } catch { return false; } };
  const go = () => {
    if (state !== 'waiting' || !loader) return;
    if (!ok()) { queue = []; return; }
    state = 'loading';
    Promise.resolve().then(loader).then(c => {
      if (!c) { state = 'off'; queue = []; return; }
      client = c;
      state = 'ready';
      const waiting = queue;
      queue = [];
      if (ok()) waiting.forEach(([e, ctx]) => send(e, ctx));
    }).catch(() => { state = 'waiting'; });
  };
  const send = (error, context) => { try { client.capture(error, context); } catch { /* never crash on a crash */ } };

  return {
    /** Report an error, with { componentStack } from an error boundary or { where }. */
    report(error, context = {}) {
      if (state === 'off' || error == null) return;
      if (state === 'ready') { if (ok()) send(error, context); return; }
      if (queue.length < MAX_QUEUE) queue.push([error, context]);
      if (state === 'waiting') go(); // a load that failed (no signal) tries again
    },
    /** An error the window saw: only reported here before Sentry is up (its own handlers take over). */
    fromWindow(error, where) {
      if (state === 'ready') return;
      this.report(error, { where });
    },
    /** Start it; with no loader (no DSN) it turns off and drops the queue. */
    start({ load, allowed: isAllowed } = {}) {
      if (state !== 'waiting' || loader) return;
      if (!load) { state = 'off'; queue = []; return; }
      if (isAllowed) allowed = isAllowed;
      loader = load;
      go();
    },
    /** Share usage data was switched: on loads Sentry if it hadn't, off drops what's waiting and stops a loaded Sentry sending. */
    sharingChanged(on) {
      if (client?.setEnabled) { try { client.setEnabled(!!on); } catch { /* ignore */ } }
      if (!on) queue = [];
      else go();
    },
    status() { return { state, queued: queue.length }; },
  };
}
