// The terms of service page (terms-page.js) and the support address (support.js): the page says
// it's a draft, promises what the app actually does with money, reads its name and contact from
// their one place, and keeps to the house style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_NAME } from './app-name.js';
import { MONEY_AGE } from './age.js';
import { SUPPORT_EMAIL, helpMailto } from './support.js';
import { TERMS_FILE, TERMS_PATH, renderTermsPage, termsSections } from './terms-page.js';

const EM = String.fromCharCode(0x2014);
const page = renderTermsPage();
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('terms: marked as a draft for legal review at the top, and not indexed while it is', () => {
  const draft = page.indexOf('Draft for legal review');
  assert.ok(draft > 0);
  assert.ok(draft < page.indexOf('<h1>'), 'the banner comes before the title');
  assert.match(page, /<meta name="robots" content="noindex">/);
  const done = renderTermsPage({ draft: false });
  assert.doesNotMatch(done, /Draft for legal review/);
  assert.doesNotMatch(done, /noindex/);
});

test('terms: friendly wagers only, no money held, no cut, players settle themselves', () => {
  const t = text(page);
  assert.match(t, /never hold, move or collect money/);
  assert.match(t, /take no cut/);
  assert.match(t, /settle up between yourselves/);
  assert.match(t, new RegExp(`${MONEY_AGE} or older`));
  assert.match(t, /laws where you live and play/);
});

test('terms: every section the brief asks for', () => {
  const heads = termsSections('x').map(([h]) => h);
  for (const want of ['Your account', 'What you put in the app', 'Using the app fairly', 'If we have to stop your access', 'The app as it is', 'Limits on our liability', 'Changes', 'Contact']) {
    assert.ok(heads.includes(want), want);
  }
});

test('terms: the name comes from app-name.js and the contact from support.js, nowhere else', () => {
  assert.match(page, new RegExp(`<title>Terms of Service · ${APP_NAME}</title>`));
  assert.ok(page.includes(`mailto:${SUPPORT_EMAIL}`));
  const renamed = renderTermsPage({ appName: 'Fairway Club', email: 'help@example.com' });
  assert.ok(!renamed.includes(APP_NAME), 'no hard-coded name in the body');
  assert.ok(!renamed.includes(SUPPORT_EMAIL), 'no hard-coded address in the body');
  assert.ok(renamed.includes('mailto:help@example.com'));
});

test('terms: links to the privacy policy, lives next to it, and has no em dashes', () => {
  assert.ok(page.includes('href="/privacy.html"'));
  assert.equal(TERMS_FILE, 'terms.html');
  assert.equal(TERMS_PATH, '/terms.html');
  assert.ok(!page.includes(EM));
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.rewrites.some(r => r.source === '/terms' && r.destination === TERMS_PATH));
});

test('support: a mailto with a subject, from the one address', () => {
  assert.equal(helpMailto('Hi there', 'a@b.co'), 'mailto:a@b.co?subject=Hi%20there');
  assert.ok(helpMailto().startsWith(`mailto:${SUPPORT_EMAIL}?subject=`));
});
