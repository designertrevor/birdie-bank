// Proves the data walls hold: nobody reads or changes data that isn't theirs (ROADMAP area 25).
// Real rows only ever get reads and a no-op update that writes back the value a row already has.
// Deletes and edits are tried only on a throwaway round, plan and trip the script makes for itself
// (and removes at the end), or aimed at a row that can't exist, so a wall that's down never costs
// real data. It prints counts and table names, never row contents.
//
//   node scripts/data-walls.mjs                 anonymous checks and a stranger's deletes and edits
//   BB_TOKEN_A=... BB_TOKEN_B=... node scripts/data-walls.mjs
//                                               adds the two-account checks
//
// The tokens are the access_token of two signed-in test accounts (in the browser: localStorage
// "bb-auth", or Application > Local Storage in dev tools). Use test accounts, not real ones, and
// sign one of them in, play a round and save a profile first so there is something to protect.
// Run it again after every new SQL file. Exit code 1 when any wall is down.

import { createHash, randomBytes } from 'node:crypto';

const URL_ = process.env.VITE_SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx';

// Every table, and what a stranger with no code should see: nothing.
const TABLES = [
  'account_players', 'attribution', 'big_games', 'challenge_moves', 'challenges', 'comment_members',
  'comments', 'course_api_usage', 'entitlements', 'feed_secret', 'feedback', 'live_holes', 'live_rounds', 'plan_answer_owners',
  'plan_hosts', 'plan_rsvps', 'plan_votes', 'planned_rounds', 'pro_settings', 'profiles', 'push_prefs',
  'push_sends', 'push_subscriptions', 'roadmap_comments', 'roadmap_votes', 'round_followers',
  'round_payments', 'trip_cup', 'trip_expenses', 'trip_plans', 'user_docs',
];
// Tables keyed by the account that owns the row
const OWNED = ['user_docs', 'profiles', 'account_players', 'push_subscriptions', 'push_prefs', 'entitlements', 'attribution'];
// Shared by a code in a header (supabase/2026-10-06-round-codes.sql): a made-up code must see nothing
const CODED = [
  ['live_rounds', 'x-round-code'], ['live_holes', 'x-round-code'], ['round_payments', 'x-round-code'],
  ['planned_rounds', 'x-plan-code'], ['plan_rsvps', 'x-plan-code'], ['plan_votes', 'x-plan-code'],
  ['challenges', 'x-challenge-code'], ['challenge_moves', 'x-challenge-code'],
];

// The tables the script can't fill itself, each with a filter no real row can match: a delete there
// shows whether the public key may delete at all, and can't remove anything even if it may
const NOWHERE = {
  account_players: 'user_id=eq.00000000-0000-0000-0000-000000000000', attribution: 'user_id=eq.00000000-0000-0000-0000-000000000000',
  challenge_moves: 'code=eq.zzzzzz', challenges: 'code=eq.zzzzzz', comment_members: 'scope=eq.none', comments: 'scope=eq.none',
  course_api_usage: 'day=eq.1900-01-01', entitlements: 'user_id=eq.00000000-0000-0000-0000-000000000000',
  feed_secret: 'id=eq.false', feedback: 'id=eq.00000000-0000-0000-0000-000000000000', plan_answer_owners: 'code=eq.zzzzzz',
  plan_hosts: 'code=eq.zzzzzz', pro_settings: 'id=eq.false', profiles: 'user_id=eq.00000000-0000-0000-0000-000000000000',
  push_prefs: 'user_id=eq.00000000-0000-0000-0000-000000000000', push_sends: 'id=eq.-1',
  push_subscriptions: 'user_id=eq.00000000-0000-0000-0000-000000000000', roadmap_comments: 'id=eq.00000000-0000-0000-0000-000000000000',
  roadmap_votes: 'item=eq.-', round_followers: 'code=eq.zzzzzz', user_docs: 'user_id=eq.00000000-0000-0000-0000-000000000000',
};

const fails = [];
const passes = [];
// Open by design: allowed, but worth seeing on every run
const open = [];
const note = (ok, what) => (ok ? passes : fails).push(what);

async function rest(path, { token, headers = {}, method = 'GET', body } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token || KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,count=exact',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let rows = null;
  try { rows = await res.json(); } catch { rows = null; }
  const range = res.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return { status: res.status, rows: Array.isArray(rows) ? rows : null, total: Number.isFinite(total) ? total : null };
}

// A row count a caller can see: refused (401, 403, 404) counts as none
const seen = r => (r.status >= 400 ? 0 : Math.max(r.rows?.length ?? 0, r.total ?? 0));

function userIdOf(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub; } catch { return null; }
}

async function anonymous() {
  for (const t of TABLES) {
    const r = await rest(`${t}?select=*&limit=1`);
    note(seen(r) === 0, `anonymous sees no rows in ${t} (status ${r.status}${seen(r) ? `, saw ${seen(r)}` : ''})`);
  }
  for (const [t, header] of CODED) {
    const r = await rest(`${t}?select=*&limit=1`, { headers: { [header]: 'ZZZZZZ' } });
    note(seen(r) === 0, `a made-up ${header} sees no rows in ${t} (status ${r.status})`);
  }
}

async function twoAccounts(tokenA, tokenB) {
  const a = userIdOf(tokenA);
  const b = userIdOf(tokenB);
  if (!a || !b || a === b) { fails.push('BB_TOKEN_A and BB_TOKEN_B must be two different signed-in accounts'); return; }
  for (const t of OWNED) {
    const own = await rest(`${t}?select=user_id&user_id=eq.${a}`, { token: tokenA });
    const theirs = await rest(`${t}?select=user_id&user_id=eq.${a}`, { token: tokenB });
    const mine = seen(own);
    note(seen(theirs) === 0, `account B reads none of A's ${t} rows (A has ${mine})`);
    // Writing back the same user_id changes nothing even if it got through
    const write = await rest(`${t}?user_id=eq.${a}`, { token: tokenB, method: 'PATCH', body: { user_id: a } });
    note(seen(write) === 0, `account B can't update A's ${t} rows (status ${write.status})`);
    if (mine === 0) passes.push(`(A has no ${t} rows yet, so the read check above proves less)`);
  }
}

const hex = n => randomBytes(n).toString('hex');
const sha = s => createHash('sha256').update(s).digest('hex');
const newCode = () => Array.from(randomBytes(6), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

// One phone shares a throwaway round, plan and trip, then strangers try to delete and change them:
// someone with only the public key (the usual attack), one with a phone key of their own, one with
// made-up codes, and another phone that has the codes (a friend in the group, who may read but
// may not delete the round or plan, or change the organizer's things)
async function strangerWrites() {
  const owner = hex(24);
  const other = hex(24);
  const R = newCode();
  const P = newCode();
  const T = `datawalls-${hex(6)}`;
  const E = `datawalls-${hex(6)}`;
  const probe = 'data-walls';
  const codes = { 'x-round-code': R, 'x-plan-code': P };
  const mine = { 'x-bb-device': owner, ...codes };
  const rows = [
    { t: 'live_rounds', key: `code=eq.${R}`, mark: r => r.meta?.mark, edit: { meta: { probe, mark: 'v2' } },
      row: { code: R, meta: { probe, mark: 'v1', hostDev: sha(owner), keeper: {}, players: [{ id: 'p1', name: 'Wall check' }], devs: {} } } },
    { t: 'live_holes', key: `code=eq.${R}&hole_no=eq.1`, mark: r => r.data?.mark, edit: { data: { mark: 'v2' } },
      row: { code: R, hole_no: 1, data: { probe, mark: 'v1' } } },
    // Any phone with the round's code may write its payments (the app never deletes one, it marks it undone)
    { t: 'round_payments', key: `code=eq.${R}&id=eq.${probe}`, mark: r => r.status, edit: { status: 'undone' }, codeHolders: true,
      row: { code: R, id: probe, kind: 'payment', from_id: 'p1', to_id: 'p2', amount: 1, status: 'paid' } },
    { t: 'planned_rounds', key: `code=eq.${P}`, mark: r => r.meta?.mark, edit: { meta: { probe, mark: 'v2' } },
      row: { code: P, meta: { probe, mark: 'v1' } } },
    { t: 'plan_rsvps', key: `code=eq.${P}&who=eq.host`, mark: r => r.status, edit: { status: 'out' },
      row: { code: P, who: 'host', name: 'Wall check', status: 'in' } },
    { t: 'plan_votes', key: `code=eq.${P}&who=eq.host&kind=eq.game`, mark: r => r.choice, edit: { choice: 'nassau' },
      row: { code: P, who: 'host', kind: 'game', choice: 'skins' } },
    { t: 'trip_plans', key: `trip_id=eq.${T}`, mark: r => r.plan?.mark, edit: { plan: { probe, mark: 'v2' } },
      row: { trip_id: T, codes: [R], plan: { probe, mark: 'v1' } } },
    { t: 'trip_expenses', key: `id=eq.${E}`, mark: r => r.expense?.mark, edit: { expense: { probe, mark: 'v2' } },
      row: { id: E, trip_id: T, codes: [R], expense: { probe, mark: 'v1' } } },
    { t: 'trip_cup', key: `trip_id=eq.${T}&key=eq.Ldatawalls`, mark: r => r.data?.mark, edit: { data: { probe, mark: 'v2' } },
      row: { trip_id: T, key: 'Ldatawalls', data: { probe, mark: 'v1' } } },
    { t: 'big_games', key: `trip_id=eq.${T}`, mark: r => r.game?.mark, edit: { game: { probe, mark: 'v2' } },
      row: { trip_id: T, codes: [R], game: { probe, mark: 'v1' } } },
  ];
  // What the owner phone sees now: the row's mark, or undefined once it's gone
  const now = async x => {
    const r = await rest(`${x.t}?select=*&${x.key}`, { headers: mine });
    return r.rows?.[0] ? x.mark(r.rows[0]) : undefined;
  };

  const made = [];
  try {
    for (const x of rows) {
      const r = await rest(x.t, { method: 'POST', headers: mine, body: x.row });
      if (r.status >= 300 || !r.rows?.length) { fails.push(`couldn't make the test row in ${x.t} (status ${r.status}), so it went untried`); continue; }
      made.push({ ...x, was: x.mark(r.rows[0]) });
    }
    const strangers = [
      ['someone with only the public key', {}, false],
      ['a stranger with a phone key', { 'x-bb-device': other }, false],
      ['made-up codes', { 'x-bb-device': other, 'x-round-code': 'ZZZZZZ', 'x-plan-code': 'ZZZZZZ' }, false],
      ['another phone with the codes', { 'x-bb-device': other, ...codes }, true],
    ];
    for (const [who, headers, hasCodes] of strangers) {
      for (const x of made) {
        if (x.gone) continue;
        const byDesign = hasCodes && x.codeHolders;
        const edit = await rest(`${x.t}?${x.key}`, { method: 'PATCH', headers, body: x.edit });
        const after = await now(x);
        if (byDesign && after !== x.was) open.push(`${who} can change ${x.t}`);
        else note(after === x.was, `${who} can't change ${x.t} (status ${edit.status})`);
        if (after !== undefined) x.was = after;
        const del = await rest(`${x.t}?${x.key}`, { method: 'DELETE', headers });
        x.gone = (await now(x)) === undefined;
        if (byDesign && x.gone) open.push(`${who} can delete ${x.t}`);
        else note(!x.gone, `${who} can't delete ${x.t} (status ${del.status})`);
      }
    }
  } finally {
    // The owner phone removes what's left, the rows that hang off others first
    for (const x of [...made].reverse()) if (!x.gone) await rest(`${x.t}?${x.key}`, { method: 'DELETE', headers: mine });
    const left = [];
    for (const x of made) if (!x.gone && (await now(x)) !== undefined) left.push(x.t);
    if (left.length) fails.push(`test rows left behind in ${left.join(', ')} (round ${R}, plan ${P}, trip ${T}): delete them in Supabase`);
  }

  const allowed = [];
  for (const [t, filter] of Object.entries(NOWHERE)) {
    const r = await rest(`${t}?${filter}`, { method: 'DELETE' });
    if (r.status === 401 || r.status === 403) passes.push(`the public key may not delete from ${t} at all`);
    else allowed.push(t);
  }
  if (allowed.length) open.push(`the public key may delete from ${allowed.join(', ')}; only each table's row rules stop it`);
}

await anonymous();
await strangerWrites();
const { BB_TOKEN_A, BB_TOKEN_B } = process.env;
if (BB_TOKEN_A && BB_TOKEN_B) await twoAccounts(BB_TOKEN_A, BB_TOKEN_B);
else passes.push('two-account checks skipped: set BB_TOKEN_A and BB_TOKEN_B to run them');

for (const p of passes) console.log(`ok    ${p}`);
for (const o of open) console.log(`open  ${o}`);
for (const f of fails) console.log(`DOWN  ${f}`);
console.log(`\n${passes.length} ok, ${fails.length} down`);
process.exit(fails.length ? 1 : 0);
