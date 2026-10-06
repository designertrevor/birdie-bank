import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORT_EMAIL, SUPPORT_PLACEHOLDER, fillSupportEmail, helpMailto } from './support.js';

const privacy = readFileSync(new URL('../../public/privacy.html', import.meta.url), 'utf8');

test('the privacy page names no address of its own, only the placeholder the build fills in', () => {
  assert.ok(privacy.includes(SUPPORT_PLACEHOLDER));
  assert.doesNotMatch(privacy, /mailto:(?!%SUPPORT_EMAIL%)/);
  assert.doesNotMatch(privacy, /[\w.+-]+@[a-z][\w-]*\.[a-z]{2,}/i);
});

test('filling the page puts the support address everywhere the placeholder was', () => {
  const page = fillSupportEmail(privacy);
  assert.ok(!page.includes(SUPPORT_PLACEHOLDER));
  assert.ok(page.includes(`href="mailto:${SUPPORT_EMAIL}"`));
  assert.equal(page.split(SUPPORT_EMAIL).length, privacy.split(SUPPORT_PLACEHOLDER).length);
});

test('a changed address goes in as plain, safe text', () => {
  assert.equal(fillSupportEmail(`<a href="mailto:${SUPPORT_PLACEHOLDER}">${SUPPORT_PLACEHOLDER}</a>`, 'help@example.com'), '<a href="mailto:help@example.com">help@example.com</a>');
  assert.equal(fillSupportEmail(SUPPORT_PLACEHOLDER, 'a"b<c>@x.com'), 'a&quot;b&lt;c&gt;@x.com');
});

test('the Help link mails support with a subject', () => {
  assert.match(helpMailto('Hi'), new RegExp(`^mailto:${SUPPORT_EMAIL}\\?subject=Hi$`));
});
