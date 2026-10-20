// The content security policy in vercel.json (report-only for now, see overnight/o14-notes/status.md):
// it allows everything the app really loads, from the origins its code names, and nothing inline
// except the scripts it lists by hash. A new origin in the app's code fails here until it's either
// added to the policy or listed below as a plain link (a page we send people to, never load).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARRY_REF_SCRIPT } from './attribution.js';
import { renderTermsPage } from './terms-page.js';
import { CHECKS } from '../../public/status-core.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(join(ROOT, p), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const SELF = 'https://birdie-bank.vercel.app';

function headerValues(key) {
  return vercel.headers.flatMap(h => h.headers.filter(x => x.key === key).map(x => ({ source: h.source, value: x.value })));
}

/** "a b; c d" as { a: ['b'], c: ['d'] } */
function parsePolicy(value) {
  const out = {};
  for (const part of value.split(';').map(s => s.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    assert.ok(!(name in out), `${name} appears twice`);
    out[name.toLowerCase()] = sources;
  }
  return out;
}

const [reportOnly] = headerValues('Content-Security-Policy-Report-Only');
const policy = parsePolicy(reportOnly.value);

// Which directive a fetch falls back to when its own isn't there (CSP3)
const FALLBACK = { 'worker-src': ['child-src', 'script-src', 'default-src'], 'frame-src': ['child-src', 'default-src'] };
const sourcesFor = name => {
  for (const d of [name, ...(FALLBACK[name] || ['default-src'])]) if (policy[d]) return policy[d];
  return [];
};

/** Does one source expression allow this URL? Enough of CSP3 matching for the sources we use. */
function sourceAllows(src, url) {
  const u = new URL(url, SELF);
  if (src === "'self'") return u.origin === SELF;
  if (/^[a-z][a-z0-9+.-]*:$/i.test(src)) return u.protocol === src.toLowerCase();
  const m = src.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:']+)(?::(\d+|\*))?(\/.*)?$/i);
  if (!m) return false;
  const [, scheme, wild, host] = m;
  if (scheme && `${scheme.toLowerCase()}:` !== u.protocol) return false;
  return wild ? u.hostname.endsWith(`.${host}`) : u.hostname === host;
}
const allows = (directive, url) => sourcesFor(directive).some(s => sourceAllows(s, url));

test('the enforced policy is still just frame-ancestors, and the full one is report-only on every page but the old prototype', () => {
  const enforced = headerValues('Content-Security-Policy');
  assert.deepEqual(enforced.map(e => e.value), ["frame-ancestors 'self'"]);
  assert.equal(headerValues('Content-Security-Policy-Report-Only').length, 1);
  const re = new RegExp(`^${reportOnly.source.replace(/^\//, '\\/')}$`);
  for (const path of ['/', '/status', '/rules/wolf', '/terms.html', '/sw.js', '/assets/index-abc.js']) assert.ok(re.test(path), path);
  assert.ok(!re.test('/prototype.html'));
});

test('the policy covers every kind of fetch, reports back, and has no unsafe script escape hatch', () => {
  for (const d of ['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'worker-src', 'manifest-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'report-uri', 'report-to']) {
    assert.ok(policy[d], `missing ${d}`);
  }
  assert.deepEqual(policy['default-src'], ["'self'"]);
  assert.deepEqual(policy['object-src'], ["'none'"]);
  assert.deepEqual(policy['frame-ancestors'], ["'self'"]);
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", '*', 'https:', 'data:']) assert.ok(!policy['script-src'].includes(bad), `script-src has ${bad}`);
  assert.deepEqual(policy['report-uri'], ['/api/csp-report']);
  const [endpoints] = headerValues('Reporting-Endpoints');
  assert.equal(endpoints.source, reportOnly.source);
  assert.match(endpoints.value, new RegExp(`(^|,\\s*)${policy['report-to'][0]}="/api/csp-report"`));
});

const sha = code => `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
const inlineScripts = html => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(m => !/\ssrc=/.test(m[1] || '') && !/type="application\/(ld\+)?json"/.test(m[1] || ''))
  .map(m => m[2]);
const handlers = html => html.replace(/<!--[\s\S]*?-->/g, '').match(/<[a-z][^>]*\son[a-z]+\s*=/gi) || [];

test('every inline script the pages run is allowed by its hash, and no page uses an inline event handler', () => {
  const index = read('index.html');
  const scripts = inlineScripts(index);
  assert.equal(scripts.length, 1, 'index.html has one inline script, the theme and late stylesheets');
  for (const code of scripts) assert.ok(policy['script-src'].includes(sha(code)), `index.html's inline script changed: put ${sha(code)} in script-src (vercel.json)`);
  assert.deepEqual(handlers(index), []);

  // The rule pages' ref carrier (attribution.js)
  const carry = CARRY_REF_SCRIPT.replace(/^<script>/, '').replace(/<\/script>$/, '');
  assert.ok(policy['script-src'].includes(sha(carry)), `CARRY_REF_SCRIPT changed: put ${sha(carry)} in script-src (vercel.json)`);

  for (const [name, html] of [['terms', renderTermsPage()], ['privacy', read('public/privacy.html')], ['status', read('public/status.html')]]) {
    assert.deepEqual(inlineScripts(html), [], `${name} has an inline script`);
    assert.deepEqual(handlers(html), [], `${name} has an inline handler`);
  }
});

test('the app, its fonts, its service worker and its manifest load from where the policy allows', () => {
  assert.ok(allows('script-src', '/assets/index-abc.js'));
  assert.ok(allows('script-src', '/status.js'));
  assert.ok(allows('worker-src', '/sw.js'));
  assert.ok(allows('manifest-src', '/manifest.webmanifest'));
  assert.ok(allows('style-src', 'https://fonts.googleapis.com/css2?family=Inter'));
  assert.ok(allows('style-src', 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css'));
  assert.ok(allows('font-src', 'https://fonts.gstatic.com/s/inter/v13/a.woff2'));
  assert.ok(allows('font-src', 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/Phosphor-Bold.woff2'));
  // Share cards, avatars and screenshots are drawn on a canvas and shown as data: or blob: pictures
  for (const u of ['data:image/png;base64,AAAA', 'blob:https://birdie-bank.vercel.app/1234', 'https://yffribkjqvkncmypexfa.supabase.co/storage/v1/object/public/avatars/u/a.jpg', '/icon.svg']) assert.ok(allows('img-src', u), u);
  // The service worker saves the font stylesheets and files with fetch(), so they count as connect-src too
  for (const u of ['https://fonts.googleapis.com/css2', 'https://fonts.gstatic.com/x.woff2', 'https://cdn.jsdelivr.net/npm/x.css']) assert.ok(allows('connect-src', u), u);
  assert.ok(!allows('img-src', 'https://evil.example/pixel.gif'));
  assert.ok(!allows('connect-src', 'https://evil.example/collect'));
});

test('Supabase (REST, storage and realtime), Sentry, PostHog and the geocoder are reachable', () => {
  const sb = 'yffribkjqvkncmypexfa.supabase.co';
  assert.ok(allows('connect-src', `https://${sb}/rest/v1/live_rounds`));
  assert.ok(allows('connect-src', `https://${sb}/auth/v1/token`));
  assert.ok(allows('connect-src', `https://${sb}/storage/v1/object/avatars/a.jpg`));
  assert.ok(allows('connect-src', `wss://${sb}/realtime/v1/websocket?apikey=x`));
  // The DSN only lives in Vercel, so any of Sentry's ingest regions
  for (const host of ['o4508.ingest.us.sentry.io', 'o4508.ingest.de.sentry.io', 'o123.ingest.sentry.io']) assert.ok(allows('connect-src', `https://${host}/api/1/envelope/`), host);
  assert.ok(allows('connect-src', 'https://us.i.posthog.com/i/v0/e/'));
  assert.ok(allows('connect-src', 'https://api.bigdatacloud.net/data/reverse-geocode-client'));
  // Course search goes through our own function, so GolfCourseAPI never needs to be listed
  assert.ok(allows('connect-src', '/api/courses?q=pinehurst'));
  assert.ok(!sourcesFor('connect-src').some(s => s.includes('golfcourseapi')));
});

test('the status page can reach everything it checks', () => {
  for (const c of CHECKS) assert.ok(allows('connect-src', c.url), c.url);
});

// --------------------------- every origin the app's code names ---------------------------

// Loaded by the browser, and from which directives
const LOADED = {
  'yffribkjqvkncmypexfa.supabase.co': ['connect-src', 'img-src'],
  'fonts.googleapis.com': ['style-src', 'connect-src'],
  'fonts.gstatic.com': ['font-src', 'connect-src'],
  'cdn.jsdelivr.net': ['style-src', 'font-src', 'connect-src'],
  'us.i.posthog.com': ['connect-src'],
  'api.bigdatacloud.net': ['connect-src'],
  'birdie-bank.vercel.app': ['connect-src', 'img-src', 'script-src'],
};
// Called only from our serverless functions (api/), which no browser policy covers
const SERVER_ONLY = new Set(['api.resend.com', 'api.golfcourseapi.com', 'golfcourseapi.com']);
// Pages people are sent to (payment apps, rule sources, booking sites) or names in text and
// markup (SVG's xmlns, the sitemap schema, made-up sample data). Never fetched by the app
const LINK_ONLY = new Set([
  'cash.app', 'paypal.me', 'venmo.com', 'foreupsoftware.com', 'x.app', 'example.com',
  'www.w3.org', 'www.sitemaps.org', 'en.wikipedia.org', 'supabase.com', 'localhost',
  // Where the games' rules come from (games.js, round.js, golf.js, allowances.js, scramble-drives.js)
  'aussiegolfer.com.au', 'business.fau.edu', 'docs.golfgenius.com', 'golf.com', 'golf.swingbyswing.com',
  'golfcompendium.com', 'golfmonthly.com', 'golfworkoutprogram.com', 'greatgamesforgolfers.com',
  'help.18birdies.com', 'help.unknowngolf.com', 'mygolfspy.com', 'nationalclubgolfer.com',
  'socalroundup.scga.org', 'stickapp.golf', 'stix.golf', 'thefriedegg.com', 'thegolfnewsnet.com', 'txga.org',
  'www.australiangolfdigest.com.au', 'www.caddiehq.com', 'www.golfcare.co.uk', 'www.golfcompendium.com',
  'www.golfdigest.com', 'www.golfgameshub.com', 'www.golfmonthly.com', 'www.golfrsa.com',
  'www.golfsoftware.com', 'www.livetourney.com', 'www.randa.org', 'www.usga.org',
]);

/** Every host named as http(s):// or ws(s):// in what the browser runs: src/, index.html and public/. */
function namedHosts() {
  const files = [];
  const walk = d => readdirSync(join(ROOT, d)).forEach(f => {
    const p = join(d, f);
    if (statSync(join(ROOT, p)).isDirectory()) return walk(p);
    if (/\.(js|jsx|mjs|html|css|json|webmanifest)$/.test(f) && !/\.test\.js$/.test(f)) files.push(p);
  });
  walk('src');
  walk('public');
  files.push('index.html');
  const hosts = new Map();
  for (const f of files) {
    if (/prototype\.html$/.test(f)) continue;
    for (const m of read(f).matchAll(/\b(?:https?|wss?):\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)/gi)) {
      const host = m[1].toLowerCase();
      if (!hosts.has(host)) hosts.set(host, new Set());
      hosts.get(host).add(relative(ROOT, join(ROOT, f)));
    }
  }
  return hosts;
}

test('every origin in the app code is either allowed by the policy or a plain link', () => {
  const hosts = namedHosts();
  assert.ok(hosts.size > 20, 'the scan found the app files');
  const unknown = [...hosts].filter(([h]) => !LOADED[h] && !SERVER_ONLY.has(h) && !LINK_ONLY.has(h)).map(([h, f]) => `${h} (${[...f].join(', ')})`);
  assert.deepEqual(unknown, [], 'New origins: add each to the policy in vercel.json and LOADED here, or to LINK_ONLY if the app only links to it');
  for (const [host, directives] of Object.entries(LOADED)) {
    for (const d of directives) assert.ok(allows(d, `https://${host}/x`), `${host} not allowed by ${d}`);
  }
  // Supabase realtime runs over a websocket to the same host
  assert.ok(allows('connect-src', 'wss://yffribkjqvkncmypexfa.supabase.co/realtime/v1/websocket'));
  // The plain links stay out of the policy: listing them would only widen it
  for (const h of LINK_ONLY) if (h !== 'localhost') assert.ok(!Object.values(policy).flat().some(s => s.includes(h)), `${h} is in the policy`);
});
