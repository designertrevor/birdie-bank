import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ROADMAP_AREAS, approvedNote, areaFor, digestDenied, digestOff, digestPush, groupDigest, ideaDetail, oneLine, sentAgo, themeOf } from './digest.js';
import { handleDigest } from './digest-server.js';
import { pushConfig } from './push-server.js';

const row = (id, kind, body, extra = {}) => ({ id, kind, body, details: {}, created_at: '2026-10-10T12:00:00Z', ...extra });

test('themes: kind first for games and courses, bugs on their own, words for the rest', () => {
  assert.equal(themeOf(row('1', 'game', 'Hammer')).id, 'games');
  assert.equal(themeOf(row('2', 'course', 'Birch Creek')).id, 'courses');
  assert.equal(themeOf(row('3', 'bug', 'The tab shows the wrong money')).id, 'bugs');
  assert.equal(themeOf(row('4', 'feature', 'Let me pay through Venmo from the Tab')).id, 'money');
  assert.equal(themeOf(row('5', 'feature', 'Show my handicap trend')).id, 'stats');
  assert.equal(themeOf(row('6', 'feature', 'A buddies trip weekend planner')).id, 'trips');
  assert.equal(themeOf(row('7', 'feature', 'Dark purple app icon please')).id, 'other');
  // Matched on whole-word starts, so "tablet" isn't the Tab and "repay" isn't pay
  assert.equal(themeOf(row('8', 'feature', 'Bigger text on my tablet')).id, 'other');
  // The form's other answers count too
  assert.equal(themeOf(row('9', 'feature', 'Something new', { details: { why: 'when we settle up after' } })).id, 'money');
});

test('areaFor: Trevor\'s pick wins, else the theme\'s guess, always a real area', () => {
  assert.equal(areaFor(row('1', 'course', 'X')), '6');
  assert.equal(areaFor(row('1', 'course', 'X', { area: '12' })), '12');
  assert.equal(areaFor(row('1', 'course', 'X', { area: '99' })), '6');
  assert.equal(areaFor(row('1', 'feature', 'Nothing to match')), '20');
  for (const n of ['5', '6', '7', '8', '21', '9', '4', '10', '12', '2', '20']) assert.ok(ROADMAP_AREAS[n]);
});

test('groupDigest: ideas grouped biggest first, bugs and other last, reactions counted not listed', () => {
  const rows = [
    row('a', 'feature', 'Pay from the tab'),
    row('b', 'feature', 'Settle up faster', { decision: 'approve' }),
    row('c', 'game', 'Hammer'),
    row('d', 'bug', 'Crash on hole 3'),
    row('e', 'feature', 'Purple'),
    row('f', 'reaction', 'Great'),
    row('g', 'feature', 'Great', { details: { sentAs: 'reaction' } }),
    row('h', 'reaction', 'Just OK'),
    null, 'junk', row('i', 'mystery', 'x'),
  ];
  const d = groupDigest(rows);
  assert.deepEqual(d.groups.map(g => g.id), ['money', 'games', 'bugs', 'other']);
  assert.equal(d.groups[0].items.length, 2);
  assert.equal(d.groups[0].waiting, 1);
  assert.equal(d.total, 5);
  assert.equal(d.waiting, 4);
  assert.deepEqual(d.reactions, { Great: 2, 'Just OK': 1 });
  assert.deepEqual(groupDigest(null), { groups: [], reactions: {}, waiting: 0, total: 0 });
});

test('ideaDetail: the form\'s other answers, not the main one again', () => {
  assert.equal(ideaDetail(row('1', 'course', 'Birch Creek', { details: { name: 'Birch Creek', city: 'Smithfield, UT' } })), 'Smithfield, UT');
  assert.equal(ideaDetail(row('1', 'game', 'Hammer', { details: { name: 'Hammer', rules: 'Double it', money: '$1 a hole' } })), 'Double it · $1 a hole');
  assert.equal(ideaDetail(row('1', 'feature', 'x', { details: null })), '');
});

test('approvedNote: grouped by area, with the words, the kind, the day, the note and the id', () => {
  const note = approvedNote([
    row('id-2', 'feature', 'Pay from\nthe tab', { area: '7', note: 'Venmo first' }),
    row('id-1', 'course', 'Birch Creek', { details: { city: 'Smithfield, UT' } }),
  ], '2026-10-12');
  assert.match(note, /^Feedback digest approvals \(2026-10-12\)/);
  assert.ok(note.indexOf('Area 6, Courses:') < note.indexOf('Area 7, The tab and settling up:'));
  assert.match(note, /- "Birch Creek" \(Smithfield, UT\)\. A missing course, sent 2026-10-10\. \[id-1\]/);
  assert.match(note, /- "Pay from the tab"\. A feature, sent 2026-10-10\. Trevor’s note: Venmo first \[id-2\]/);
  assert.equal(approvedNote([], '2026-10-12'), '');
  assert.ok(!note.includes(String.fromCharCode(0x2014)));
});

test('digestPush: only when something waits, and it opens the digest', () => {
  assert.equal(digestPush(0), null);
  assert.equal(digestPush('nope'), null);
  assert.equal(digestPush(1).body, '1 idea from the last 7 days is waiting for a yes or a no.');
  assert.deepEqual({ ...digestPush(4), body: undefined }, { title: 'Your weekly feedback digest', body: undefined, url: '/?digest', tag: 'digest' });
});

test('small helpers: oneLine, sentAgo, the error kinds', () => {
  assert.equal(oneLine('a\n\n b  c'), 'a b c');
  assert.equal(oneLine('abcdef', 4), 'abc…');
  const now = new Date(2026, 9, 12, 9).getTime();
  assert.equal(sentAgo(new Date(2026, 9, 12, 1).toISOString(), now), 'today');
  assert.equal(sentAgo(new Date(2026, 9, 11, 23).toISOString(), now), 'yesterday');
  assert.equal(sentAgo(new Date(2026, 9, 8, 12).toISOString(), now), '4 days ago');
  assert.equal(sentAgo('bad', now), '');
  assert.ok(digestOff({ code: 'PGRST202' }));
  assert.ok(!digestOff({ code: '42501' }));
  assert.ok(digestDenied({ code: '42501', message: 'Not allowed' }));
});

// ---------------------------------------------------------------------------------------------
// The Monday push, with a fake network

const b64u = b => Buffer.from(b).toString('base64url');
const vapid = createECDH('prime256v1');
vapid.generateKeys();
const CFG = pushConfig({
  VAPID_PRIVATE_KEY: vapid.getPrivateKey('base64url'), VAPID_SUBJECT: 'mailto:hello@example.com',
  SUPABASE_SERVICE_ROLE_KEY: 'service', VITE_SUPABASE_URL: 'https://db.example.co', VITE_SUPABASE_ANON_KEY: 'anon',
});
function sub(user, waiting) {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  return { waiting, to_user: user, push_endpoint: `https://fcm.googleapis.com/send/${user}`, push_p256dh: b64u(ua.getPublicKey()), push_auth: b64u(Buffer.alloc(16, 3)) };
}
function fakeFetch(rows, { rpcOk = true } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/rest/v1/rpc/')) return { ok: rpcOk, status: rpcOk ? 200 : 404, json: async () => rows };
    return { ok: true, status: 201 };
  };
  fn.calls = calls;
  return fn;
}

test('handleDigest: asks push_digest_due as the service role and sends to each admin phone', async () => {
  const f = fakeFetch([sub('trevor', 3), sub('trevor', 3)].map((r, i) => ({ ...r, push_endpoint: `${r.push_endpoint}-${i}` })));
  assert.equal(await handleDigest(CFG, f), 2);
  assert.ok(f.calls[0].url.endsWith('/rest/v1/rpc/push_digest_due'));
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer service');
  assert.equal(f.calls.filter(c => c.url.startsWith('https://fcm.googleapis.com/')).length, 2);
});

test('handleDigest: nothing waiting, SQL not run, or push off sends nothing', async () => {
  assert.equal(await handleDigest(CFG, fakeFetch([])), 0);
  const notRun = fakeFetch([sub('trevor', 3)], { rpcOk: false });
  assert.equal(await handleDigest(CFG, notRun), 0);
  assert.equal(notRun.calls.length, 1);
  assert.equal(await handleDigest(null, fakeFetch([sub('trevor', 3)])), 0);
});

// ---------------------------------------------------------------------------------------------
// The SQL keeps everyone but admins out

test('the digest SQL: locked tables, every reader checks app_admins, the push is service role only', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-12-feedback-digest.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on public\.app_admins from anon, authenticated;/);
  assert.match(sql, /revoke all on public\.feedback_digest from anon, authenticated;/);
  for (const fn of ['digest_feedback', 'digest_decide', 'digest_approved', 'digest_mark_added']) {
    const body = sql.slice(sql.indexOf(`create or replace function public.${fn}(`));
    const end = body.indexOf('end $$;');
    assert.ok(end > 0, fn);
    assert.match(body.slice(0, end), /perform public\.digest_admin_check\(\);/, `${fn} checks the admin`);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`), `${fn} closed to anon`);
  }
  assert.match(sql, /revoke all on function public\.push_digest_due\(\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.push_digest_due\(\) to service_role;/);
  // No real email baked in: Trevor fills in his own
  assert.match(sql, /YOUR-ACCOUNT-EMAIL/);
  assert.ok(!sql.includes(String.fromCharCode(0x2014)));
});

test('vercel.json runs the digest push on Mondays', () => {
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(v.crons.some(c => c.path === '/api/push-digest' && / 1$/.test(c.schedule)));
});
