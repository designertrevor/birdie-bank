// Proves the data walls hold: nobody reads or changes data that isn't theirs (ROADMAP area 25).
// It only reads, plus a no-op update that writes back the value a row already has, so it never
// changes anything even if a wall is down. It prints counts and table names, never row contents.
//
//   node scripts/data-walls.mjs                 anonymous checks only
//   BB_TOKEN_A=... BB_TOKEN_B=... node scripts/data-walls.mjs
//                                               adds the two-account checks
//
// The tokens are the access_token of two signed-in test accounts (in the browser: localStorage
// "bb-auth", or Application > Local Storage in dev tools). Use test accounts, not real ones, and
// sign one of them in, play a round and save a profile first so there is something to protect.
// Run it again after every new SQL file. Exit code 1 when any wall is down.

const URL_ = process.env.VITE_SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx';

// Every table, and what a stranger with no code should see: nothing.
const TABLES = [
  'account_players', 'attribution', 'big_games', 'challenge_moves', 'challenges', 'comment_members',
  'comments', 'entitlements', 'feed_secret', 'feedback', 'live_holes', 'live_rounds', 'plan_answer_owners',
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

const fails = [];
const passes = [];
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

await anonymous();
const { BB_TOKEN_A, BB_TOKEN_B } = process.env;
if (BB_TOKEN_A && BB_TOKEN_B) await twoAccounts(BB_TOKEN_A, BB_TOKEN_B);
else passes.push('two-account checks skipped: set BB_TOKEN_A and BB_TOKEN_B to run them');

for (const p of passes) console.log(`ok    ${p}`);
for (const f of fails) console.log(`DOWN  ${f}`);
console.log(`\n${passes.length} ok, ${fails.length} down`);
process.exit(fails.length ? 1 : 0);
