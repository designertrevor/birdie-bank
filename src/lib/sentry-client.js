// The Sentry library, loaded after the first paint and only with a DSN (crash.js). Errors only: no
// performance tracing, no session replay, no console lines or taps in the breadcrumbs, no user and
// no IP from the phone. Every event and breadcrumb goes through scrub.js before it's sent, and
// nothing goes while Share usage data is off.
import {
  breadcrumbsIntegration, browserSessionIntegration, captureException, dedupeIntegration, eventFiltersIntegration,
  functionToStringIntegration, globalHandlersIntegration, httpContextIntegration, init, linkedErrorsIntegration, withScope,
} from '@sentry/browser';
import { scrubBreadcrumb, scrubEvent } from './scrub.js';

/** Start Sentry and hand back how to report an error (with the React component stack, if any). */
export function startSentry({ dsn, release, environment, allowed = () => true }) {
  init({
    dsn,
    release,
    environment,
    // Only the pieces we want, listed here, rather than the defaults
    defaultIntegrations: false,
    integrations: [
      eventFiltersIntegration(),
      functionToStringIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
      globalHandlersIntegration(),
      breadcrumbsIntegration({ console: false, dom: false, sentry: false, fetch: true, xhr: true, history: true }),
      // Crash-free sessions per release: a count, with no user on it
      browserSessionIntegration(),
    ],
    // No IP or user, no cookies, bodies or query strings (scrub.js keeps only the browser's User-Agent header)
    dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false },
    maxBreadcrumbs: 30,
    beforeSend: event => (allowed() ? scrubEvent(event) : null),
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb),
  });
  return {
    capture(error, context) {
      withScope(scope => {
        if (context?.componentStack) scope.setContext('react', { componentStack: String(context.componentStack) });
        if (context?.where) scope.setTag('where', String(context.where).slice(0, 32));
        captureException(error);
      });
    },
  };
}
