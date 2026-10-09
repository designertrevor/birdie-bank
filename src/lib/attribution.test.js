import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARRY_REF_SCRIPT, REF_KEY, attributionOff, attributionProps, attributionRow, captureAttribution, cleanRef,
  firstTouch, landingOf, readAttribution, refFrom, saveAttribution,
} from './attribution.js';

/** A stand-in for localStorage. */
function memory(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test('cleanRef: a short lower-case slug, or nothing', () => {
  assert.equal(cleanRef('GoodGood'), 'goodgood');
  assert.equal(cleanRef('  Good Good Golf! '), 'good-good-golf');
  assert.equal(cleanRef('bryan_bros-2027'), 'bryan_bros-2027');
  assert.equal(cleanRef('--x--'), 'x');
  assert.equal(cleanRef('a'.repeat(60)).length, 32);
  assert.equal(cleanRef(`${'a'.repeat(31)}-b`), 'a'.repeat(31), 'no dash left hanging on the end');
  for (const bad of ['', '   ', null, undefined, '!!!', 'bob@example.com']) assert.equal(cleanRef(bad), null, String(bad));
  assert.equal(cleanRef('<script>alert(1)</script>'), 'script-alert-1-script');
});

test('refFrom: ?ref= first, then ?via=', () => {
  assert.equal(refFrom('?ref=GoodGood'), 'goodgood');
  assert.equal(refFrom('?via=Bryan'), 'bryan');
  assert.equal(refFrom('?ref=one&via=two'), 'one');
  assert.equal(refFrom('?ref=&via=two'), 'two');
  assert.equal(refFrom(new URLSearchParams('join=AB12CD&ref=x1')), 'x1');
  assert.equal(refFrom(''), null);
  assert.equal(refFrom('?join=AB12CD'), null);
});

test('landingOf: the path and the kind of app link, never its code', () => {
  assert.equal(landingOf('/', '?ref=x'), '/');
  assert.equal(landingOf('/', '?join=AB12CD&ref=x'), '/?join');
  assert.equal(landingOf('/', '?play=wolf&ref=x'), '/?play');
  assert.equal(landingOf('/roadmap', '?ref=x'), '/roadmap');
  assert.equal(landingOf('/<b>"x"', ''), '/bx');
  assert.equal(landingOf('', ''), '/');
});

test('first touch wins: a later link never replaces the first code', () => {
  const storage = memory();
  const first = captureAttribution({ storage, search: '?ref=GoodGood', path: '/', now: 1000, fresh: true });
  assert.deepEqual(first, { code: 'goodgood', landing: '/', at: 1000, fresh: true });
  const again = captureAttribution({ storage, search: '?ref=Other', path: '/rules/wolf', now: 2000, fresh: false });
  assert.deepEqual(again, first);
  assert.deepEqual(readAttribution(storage), first);
  // No code, nothing saved
  const empty = memory();
  assert.equal(captureAttribution({ storage: empty, search: '?join=AB12CD', path: '/' }), null);
  assert.equal(empty.map.size, 0);
});

test('a code that arrives after the phone was set up is marked as not a new download', () => {
  const a = firstTouch(null, { search: '?via=bryan', path: '/', now: 5, fresh: false });
  assert.equal(a.fresh, false);
  assert.deepEqual(attributionProps(a), { ref: 'bryan', ref_landing: '/', ref_new: false });
  assert.deepEqual(attributionProps(null), {});
});

test('blocked or broken storage never throws and keeps nothing', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(captureAttribution({ storage: blocked, search: '?ref=x', path: '/', now: 1 }), { code: 'x', landing: '/', at: 1, fresh: true });
  assert.equal(readAttribution(memory({ [REF_KEY]: '{not json' })), null);
  assert.equal(readAttribution(memory({ [REF_KEY]: JSON.stringify({ code: 'bob@example.com' }) })), null);
});

test('attributionRow: one row for the account, as the SQL expects', () => {
  const row = attributionRow({ code: 'goodgood', landing: '/?join', at: Date.UTC(2026, 9, 9), fresh: true }, 'user-1');
  assert.deepEqual(row, { user_id: 'user-1', code: 'goodgood', landing: '/?join', first_seen: '2026-10-09T00:00:00.000Z', new_phone: true });
});

/** A stand-in Supabase client whose insert answers with `error`. */
function fakeDb(error = null) {
  const rows = [];
  return { rows, from: table => ({ insert: async row => { rows.push([table, row]); return { error }; } }) };
}

test('saveAttribution: once per account, quiet until the SQL is run', async () => {
  const storage = memory();
  captureAttribution({ storage, search: '?ref=goodgood', path: '/', now: 1 });
  // Not run yet: says off, saves nothing, tries again next time
  const missing = fakeDb({ code: 'PGRST205', message: 'Could not find the table public.attribution' });
  assert.equal(await saveAttribution({ db: missing, userId: 'u1', storage }), 'off');
  const db = fakeDb();
  assert.equal(await saveAttribution({ db, userId: 'u1', storage }), 'saved');
  assert.equal(await saveAttribution({ db, userId: 'u1', storage }), 'saved');
  assert.equal(db.rows.length, 1, 'sent once');
  assert.equal(db.rows[0][0], 'attribution');
  // Another phone saved first: the row there is first touch too
  const other = memory();
  captureAttribution({ storage: other, search: '?ref=later', path: '/', now: 2 });
  assert.equal(await saveAttribution({ db: fakeDb({ code: '23505' }), userId: 'u1', storage: other }), 'saved');
  // No code, no account or no client: nothing to do
  assert.equal(await saveAttribution({ db, userId: 'u1', storage: memory() }), 'none');
  assert.equal(await saveAttribution({ db: null, userId: 'u1', storage }), 'none');
  assert.equal(await saveAttribution({ db: fakeDb({ code: '42501', message: 'denied' }), userId: 'u2', storage }), 'failed');
});

test('attributionOff: a missing table or column, not any other error', () => {
  assert.equal(attributionOff({ code: '42P01' }), true);
  assert.equal(attributionOff({ code: 'PGRST205' }), true);
  assert.equal(attributionOff({ message: 'relation "public.attribution" does not exist' }), true);
  assert.equal(attributionOff({ code: '42501' }), false);
  assert.equal(attributionOff(null), false);
});

test('the rule pages carry a code on into the app, and only a clean one', () => {
  assert.match(CARRY_REF_SCRIPT, /^<script>[\s\S]*<\/script>$/);
  assert.ok(CARRY_REF_SCRIPT.includes("replace(/[^a-z0-9_-]+/g,'-')"));
  const pages = readFileSync(new URL('./rule-pages.js', import.meta.url), 'utf8');
  assert.equal(pages.split('${CARRY_REF_SCRIPT}').length - 1, 2, 'each game page and the index');
});

test('the code is read before the app tidies the address bar, and links keep it', () => {
  const main = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
  assert.ok(main.indexOf('opsAtLaunch()') > 0 && main.indexOf('opsAtLaunch()') < main.indexOf('createRoot('), 'read before the first render');
  // Link-preview bots are the only ones middleware rewrites; people get the page with ?ref intact
  const mw = readFileSync(new URL('../../middleware.js', import.meta.url), 'utf8');
  assert.ok(mw.includes('if (!BOTS.test('));
});

test('the SQL: one row each, add and read your own only, never change or remove', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-09-attribution.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.attribution/);
  assert.match(sql, /user_id uuid primary key/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select, insert on public\.attribution to authenticated/);
  assert.match(sql, /revoke all on public\.attribution from anon/);
  assert.doesNotMatch(sql, /for (update|delete)/);
});
