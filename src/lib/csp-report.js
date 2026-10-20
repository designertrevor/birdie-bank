// Content security policy reports (api/csp-report.js). Browsers send one when a page loads or runs
// something the policy in vercel.json doesn't list. Two shapes arrive: the older report-uri one
// (Safari, Firefox: one { "csp-report": {...} } per POST) and the Reporting API one (Chrome, Edge:
// report-to, an array of { type: 'csp-violation', body: {...} }). Both become the older shape,
// which Sentry's security endpoint has always taken, and go to the project the app's DSN names.
// Browser extensions injecting their own scripts are dropped here, since they're not ours to fix.
// Pure, so the tests can check it; the function does the sending.

/** The most reports one POST may carry on to Sentry, and the biggest body read. */
export const MAX_REPORTS = 10;
export const MAX_BODY = 64 * 1024;

const EXTENSION = /^(chrome|moz|safari|safari-web|ms-browser|webkit-masked)-extension:|^(chrome|edge|brave):/i;

/**
 * Sentry's CSP endpoint for a DSN (https://<key>@<host>/<project>, maybe with a path before the project),
 * or null when it isn't one. `environment` and `release` tag the reports like the app's own errors.
 */
export function sentrySecurityUrl(dsn, { environment, release } = {}) {
  let u;
  try { u = new URL(String(dsn || '').trim()); } catch { return null; }
  const key = u.username;
  const parts = u.pathname.split('/').filter(Boolean);
  const project = parts.pop();
  if (!key || !project || !/^\d+$/.test(project) || !/^https?:$/.test(u.protocol)) return null;
  const prefix = parts.length ? `/${parts.join('/')}` : '';
  const q = new URLSearchParams({ sentry_key: key });
  if (environment) q.set('sentry_environment', environment);
  if (release) q.set('sentry_release', release);
  return `${u.protocol}//${u.host}${prefix}/api/${project}/security/?${q}`;
}

// The Reporting API's camelCase names, as the older report's
const FIELDS = [
  ['documentURL', 'document-uri'], ['referrer', 'referrer'], ['blockedURL', 'blocked-uri'],
  ['effectiveDirective', 'effective-directive'], ['originalPolicy', 'original-policy'],
  ['disposition', 'disposition'], ['sourceFile', 'source-file'], ['lineNumber', 'line-number'],
  ['columnNumber', 'column-number'], ['statusCode', 'status-code'], ['sample', 'script-sample'],
];

/** One Reporting API csp-violation body in the older shape. */
function fromReportTo(body) {
  const out = {};
  for (const [from, to] of FIELDS) if (body[from] != null && body[from] !== '') out[to] = body[from];
  if (out['effective-directive']) out['violated-directive'] = out['effective-directive'];
  return out;
}

/**
 * A page or file address without its query or #hash: a join link's round code, a sign-in's tokens
 * and the like never leave the phone in a report (the same rule as scrub.js for crash reports).
 * Words like 'inline' or 'eval' that browsers put in blocked-uri stay as they are.
 */
export function cleanUrl(v) {
  if (typeof v !== 'string') return v;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v.split(/[?#]/)[0];
  try { const u = new URL(v); return `${u.origin}${u.pathname}`; } catch { return v.split(/[?#]/)[0]; }
}
const URL_FIELDS = ['document-uri', 'referrer', 'blocked-uri', 'source-file'];
const cleaned = r => {
  const out = { ...r };
  for (const f of URL_FIELDS) if (out[f] != null) out[f] = cleanUrl(out[f]);
  // The sample is the first characters of the blocked inline code; it could hold anything, so it stays out
  delete out['script-sample'];
  return out;
};

const fromExtension = r => EXTENSION.test(String(r['blocked-uri'] || '')) || EXTENSION.test(String(r['source-file'] || ''));

/**
 * The reports in a POST body (text) as a list of older-shape objects ({ 'document-uri', ... }),
 * at most MAX_REPORTS, without the ones browser extensions caused. [] for anything unreadable.
 */
export function readReports(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_BODY) return [];
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  let list = [];
  if (Array.isArray(data)) {
    list = data.filter(r => r && r.type === 'csp-violation' && r.body && typeof r.body === 'object').map(r => fromReportTo(r.body));
  } else if (data && typeof data === 'object' && data['csp-report'] && typeof data['csp-report'] === 'object') {
    list = [data['csp-report']];
  }
  return list.filter(r => r && typeof r === 'object' && !fromExtension(r)).slice(0, MAX_REPORTS).map(cleaned);
}

/** A short line for the function's log when there's no DSN: what was blocked, where, by which rule. */
export function logLine(r) {
  let page = String(r['document-uri'] || '');
  try { page = new URL(page).pathname; } catch { /* keep it as it came */ }
  return `csp ${r['disposition'] || 'report'}: ${r['effective-directive'] || r['violated-directive'] || '?'} blocked ${r['blocked-uri'] || '?'} on ${page || '?'}`;
}
