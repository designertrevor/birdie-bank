// Crash reports, the part on the first screen: reportError (ErrorBoundary.jsx and ops.js call it).
// Tiny on purpose. Errors wait here until the reporter (crash-core.js) is loaded after the first
// paint, and only with a Sentry DSN (ops-late.js); without one they're dropped.
const MAX_QUEUE = 10;
let impl = null;
let off = false;
let queue = [];

/** Report an error, with { componentStack } from an error boundary or { where }. A no-op without a DSN. */
export function reportError(error, context = {}) {
  if (off || error == null) return;
  if (impl) { try { impl.report(error, context); } catch { /* never crash on a crash */ } return; }
  if (queue.length < MAX_QUEUE) queue.push([error, context, false]);
}
/** An error the window saw: before Sentry is up it waits here; after, Sentry's own handlers have it. */
export function windowError(error, where) {
  if (off || error == null) return;
  if (impl) { try { impl.fromWindow(error, where); } catch { /* ignore */ } return; }
  if (queue.length < MAX_QUEUE) queue.push([error, { where }, true]);
}
/** Hand what waited to the reporter. */
export function attachReporter(reporter) {
  impl = reporter;
  const waiting = queue;
  queue = [];
  waiting.forEach(([e, ctx, fromWindow]) => (fromWindow ? windowError(e, ctx.where) : reportError(e, ctx)));
}
/** No DSN: drop what waited and ignore the rest. */
export function crashReportsOff() { off = true; queue = []; }
/** For tests: how many wait. */
export const waitingCount = () => queue.length;
