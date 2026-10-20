// Content security policy reports: vercel.json's policy sends browsers here (report-uri and
// report-to) when a page loads or runs something the policy doesn't list. Each report is tidied
// (src/lib/csp-report.js: no query strings, no code samples, no browser extensions) and passed to
// Sentry's security endpoint for the app's own project, where it shows up under Issues as a CSP
// issue, tagged with this deploy's environment and release. Without a Sentry DSN it's written to
// the function log instead. Always answers 204, so a browser never retries.
//
// The DSN is the one the app already uses (VITE_SENTRY_DSN, which Vercel also hands its functions),
// or SENTRY_DSN if set.
import process from 'node:process';
import { MAX_BODY, logLine, readReports, sentrySecurityUrl } from '../src/lib/csp-report.js';

const done = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request) {
    if (request.method !== 'POST') return done(405);
    let text = '';
    try { text = await request.text(); } catch { return done(204); }
    if (text.length > MAX_BODY) return done(204);
    const reports = readReports(text);
    if (!reports.length) return done(204);

    const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || '';
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    const target = sentrySecurityUrl(dsn, {
      environment: process.env.VERCEL_ENV || 'development',
      release: sha ? `birdie-bank@${sha.slice(0, 7)}` : undefined,
    });
    if (!target) {
      reports.forEach(r => console.log(logLine(r)));
      return done(204);
    }
    const ua = (request.headers.get('user-agent') || '').slice(0, 512);
    await Promise.all(reports.map(r => fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report', ...(ua ? { 'User-Agent': ua } : {}) },
      body: JSON.stringify({ 'csp-report': r }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => console.log(`csp report not passed to Sentry: ${logLine(r)}`))));
    return done(204);
  },
};
