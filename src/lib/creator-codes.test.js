import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATOR_CODES, creatorLink, creatorOf } from './creator-codes.js';
import { cleanRef, refFrom } from './attribution.js';
import { APP_NAME } from './app-name.js';

test('creator codes: every code is unique', () => {
  const codes = CREATOR_CODES.map(c => c.code);
  assert.equal(new Set(codes).size, codes.length, 'a code is used twice');
  const rows = CREATOR_CODES.map(c => c.row);
  assert.equal(new Set(rows).size, rows.length, 'a research row is listed twice');
});

test('creator codes: each one passes the cleaning rule unchanged', () => {
  for (const { code } of CREATOR_CODES) {
    assert.equal(cleanRef(code), code, code);
    assert.equal(cleanRef(code.toUpperCase()), code, `${code} typed in capitals`);
    assert.equal(refFrom(`?ref=${code}`), code, `${code} on ?ref`);
    assert.equal(refFrom(`?via=${code}`), code, `${code} on ?via`);
  }
});

test('creator codes: lower-case letters, digits and single dashes, short', () => {
  for (const { code } of CREATOR_CODES) {
    assert.match(code, /^[a-z0-9]+(-[a-z0-9]+)*$/, code);
    assert.ok(code.length >= 3 && code.length <= 16, `${code} is ${code.length} characters`);
  }
});

test('creator codes: fit the attribution table check in the SQL', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-09-attribution.sql', import.meta.url), 'utf8');
  const m = sql.match(/check \(code ~ '([^']+)'\)/);
  assert.ok(m, 'the code check is still in the SQL');
  const rule = new RegExp(m[1]);
  for (const { code } of CREATOR_CODES) assert.match(code, rule, code);
});

test('creator codes: never carry the app name (a codename until the rename)', () => {
  const words = APP_NAME.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  assert.ok(words.length > 0);
  for (const { code } of CREATOR_CODES) {
    for (const w of words) assert.ok(!code.includes(w), `${code} contains "${w}"`);
  }
});

test('creator codes: each entry names its creator and platform', () => {
  for (const c of CREATOR_CODES) {
    assert.ok(c.creator && c.creator.trim(), `${c.code} has no creator`);
    assert.ok(['YouTube', 'TikTok', 'Instagram'].includes(c.platform), `${c.code}: ${c.platform}`);
  }
});

test('creatorLink and creatorOf', () => {
  assert.equal(creatorLink('badgolf', 'https://example.app'), 'https://example.app/?ref=badgolf');
  assert.equal(creatorLink('badgolf', 'https://example.app/'), 'https://example.app/?ref=badgolf');
  assert.equal(refFrom(new URL(creatorLink('kelley-yt', 'https://example.app')).search), 'kelley-yt');
  assert.equal(creatorOf('badgolf').row, 2);
  assert.equal(creatorOf('nobody'), null);
});
