// Branded previews behind every kind of link (link-target.js, og.js, api/join.js, middleware.js):
// a round's, a plan's, a challenge's and a captain's draft. A preview bot gets the link's own
// title and description; a person gets the app. Plans and challenges are read with their own code
// header, the way the app reads them once the round codes SQL runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkTarget, previewApiPath, targetQuery, targetUrl } from './link-target.js';
import { challengePreview, draftPreview, joinPreview, planPreview, previewDay, previewTime } from './og.js';
import { APP_NAME } from './app-name.js';

const EM = String.fromCharCode(0x2014);

test('linkTarget: reads each kind of link the app writes', () => {
  assert.deepEqual(linkTarget('?join=ab12cd'), { kind: 'join', code: 'AB12CD' });
  assert.deepEqual(linkTarget('plan=PL4N99'), { kind: 'plan', code: 'PL4N99', who: null });
  assert.deepEqual(linkTarget('?plan=PL4N99&p=p_dave1'), { kind: 'plan', code: 'PL4N99', who: 'p_dave1' });
  assert.deepEqual(linkTarget('?challenge=CH4LL3'), { kind: 'challenge', code: 'CH4LL3' });
  assert.deepEqual(linkTarget('?draft=trip_1&c=1'), { kind: 'draft', tripId: 'trip_1', seat: 1 });
  assert.deepEqual(linkTarget(new URLSearchParams('draft=t2')), { kind: 'draft', tripId: 't2', seat: 0 });
  // A join link wins, the way the app opens it
  assert.equal(linkTarget('?plan=PL4N99&join=AB12CD').kind, 'join');
});

test('linkTarget: anything that isn\'t a code is nothing', () => {
  for (const q of ['', '?', '?join=', '?join=ab', '?join=ABCDEFGHI', '?join=AB-12', '?plan=<x>', '?challenge=%20', '?draft=a/b', '?play=wolf', null, undefined]) {
    assert.equal(linkTarget(q), null, String(q));
  }
  // A garbled ?p= is dropped, not passed on
  assert.equal(linkTarget('?plan=PL4N99&p=<script>').who, null);
});

test('targetQuery and previewApiPath round-trip every kind', () => {
  for (const q of ['join=AB12CD', 'plan=PL4N99', 'plan=PL4N99&p=p_dave1', 'challenge=CH4LL3', 'draft=trip_1&c=1', 'draft=t2&c=0']) {
    const t = linkTarget(q);
    assert.equal(targetQuery(t), q);
    assert.deepEqual(linkTarget(previewApiPath(t).split('?')[1]), t);
  }
  assert.equal(previewApiPath(linkTarget('plan=PL4N99')), '/api/join?plan=PL4N99');
  assert.equal(targetUrl('https://x.test', linkTarget('challenge=CH4LL3')), 'https://x.test/?challenge=CH4LL3');
  assert.equal(targetUrl('https://x.test', null), 'https://x.test/');
  assert.equal(previewApiPath(null), null);
});

test('previewDay and previewTime: the date itself, never "tomorrow"', () => {
  assert.equal(previewDay('2026-10-11'), 'Sun, Oct 11');
  assert.equal(previewDay('2026-10-10'), 'Sat, Oct 10');
  assert.equal(previewDay('2027-01-01'), 'Fri, Jan 1');
  for (const bad of ['', null, '2026-13-01', '2026-02-31', 'soon']) assert.equal(previewDay(bad), '', String(bad));
  assert.equal(previewTime('08:10'), '8:10 AM');
  assert.equal(previewTime('13:05'), '1:05 PM');
  assert.equal(previewTime('00:30'), '12:30 AM');
  assert.equal(previewTime('25:00'), '');
  assert.equal(previewTime(''), '');
});

const PLAN = { hostName: 'Trevor', date: '2026-10-10', teeTime: '08:10', course: { name: 'Birch Creek' }, game: 'wolf', people: [{ id: 'p_dave1', name: 'Dave Po' }], status: 'planned' };

test('planPreview: who asked, the day, the course and the game', () => {
  const p = planPreview(PLAN);
  assert.equal(p.title, 'Golf at Birch Creek, Sat, Oct 10 at 8:10 AM');
  assert.equal(p.description, 'Trevor invited you · Thinking Wolf. Tap to say if you’re in and vote on the game and the bet. No download needed.');
});

test('planPreview: one person\'s own link asks them by name', () => {
  const p = planPreview(PLAN, 'p_dave1');
  assert.equal(p.title, 'Dave, you in for golf Sat, Oct 10 at 8:10 AM?');
  assert.match(p.description, /^Trevor invited you · Birch Creek · Thinking Wolf\./);
  // Someone not on the plan gets the group's version
  assert.equal(planPreview(PLAN, 'p_nobody').title, planPreview(PLAN).title);
});

test('planPreview: no amounts, a called-off plan says so, and nothing to go on is null', () => {
  const p = planPreview({ ...PLAN, suggestedBet: 20, ballot: { bets: [10, 20] } });
  assert.ok(!/\$/.test(p.title + p.description), 'no money in a preview');
  const off = planPreview({ ...PLAN, status: 'off' });
  assert.equal(off.title, 'Golf on Sat, Oct 10 at 8:10 AM is off');
  assert.match(off.description, /^Trevor called off the round at Birch Creek\./);
  assert.equal(planPreview({ ...PLAN, status: 'off', date: null, teeTime: null }).title, 'This round is off');
  assert.equal(planPreview(null), null);
  assert.equal(planPreview({ game: 'wolf' }), null);
  // No host, no tee time, no game: still reads
  const bare = planPreview({ date: '2026-10-10', course: { name: 'Oak' } });
  assert.equal(bare.title, 'Golf at Oak, Sat, Oct 10');
  assert.equal(planPreview({ date: '2026-10-10', teeTime: '07:00' }).title, 'Golf Sat, Oct 10 at 7:00 AM');
  assert.equal(planPreview({ course: { name: 'Oak' } }).title, 'Golf at Oak');
  assert.match(bare.description, /^You’re invited\. Tap/);
});

test('planPreview: a plan moved to another day points there, and one going now says it is on', () => {
  const moved = planPreview({ ...PLAN, movedTo: { id: 'x', code: 'NEW123', date: '2026-10-17' } }, 'p_dave1');
  assert.equal(moved.title, 'Golf moved to Sat, Oct 17');
  assert.match(moved.description, /^Trevor moved the round at Birch Creek to Sat, Oct 17\./);
  assert.ok(!moved.title.includes('Oct 10'));
  const on = planPreview({ ...PLAN, status: 'started' });
  assert.equal(on.title, 'Golf at Birch Creek is on');
  assert.match(on.description, /Tap to follow it live/);
  assert.ok(!/say if you/.test(on.description), 'it no longer asks who is in');
});

test('challengePreview: who challenged who, the kind, the holes and the day, never the amount', () => {
  const ch = { from: { who: 'a', name: 'Mike Ross' }, to: { who: 'b', name: 'Dave' }, kind: 'match', stake: 20, holes: 'back', plan: { date: '2026-10-10' } };
  const p = challengePreview(ch);
  assert.equal(p.title, 'Mike challenged Dave');
  assert.equal(p.description, 'A match on the back 9, on Sat, Oct 10. Tap to accept, pass or name your own amount. No download needed.');
  assert.ok(!p.description.includes('20'));
  const set = challengePreview({ ...ch, setBy: { who: 'c', name: 'Trevor N' }, kind: 'ctp', holes: 'all', plan: null });
  assert.equal(set.title, 'Trevor set up Mike v Dave');
  assert.match(set.description, /^Closest to the pin on the par 3s, next time they play\./);
  assert.match(challengePreview({ ...ch, kind: 'custom', label: 'Most fairways' }).description, /^A side bet: Most fairways/);
  assert.equal(challengePreview(null), null);
  assert.equal(challengePreview({ from: { name: 'A' } }), null);
});

test('joinPreview: a live round names who sent it; a finished one names the app from the constant', () => {
  const live = joinPreview({ game: 'skins', hostName: 'Trevor Nielsen', course: { name: 'Oak' }, players: [{ name: 'Trevor' }] });
  assert.equal(live.description, 'Trevor invited you. Trevor. Tap to follow the money live for Skins. No download needed.');
  const done = joinPreview({ game: 'skins', hostName: 'Trevor', status: 'done', course: { name: 'Oak' }, players: [] });
  assert.ok(!done.description.includes('invited you'));
  assert.ok(done.description.endsWith(`on ${APP_NAME}.`));
});

test('previews: none of them use an em dash', () => {
  const all = [planPreview(PLAN), planPreview(PLAN, 'p_dave1'), planPreview({ ...PLAN, status: 'off' }), planPreview({ ...PLAN, status: 'started' }), planPreview({ ...PLAN, movedTo: { date: '2026-10-17' } }), challengePreview({ from: { name: 'A' }, to: { name: 'B' }, kind: 'hole', holes: 'front' }), draftPreview()];
  for (const p of all) assert.ok(!(p.title + p.description).includes(EM));
});

// ---------------------------------------------------------------------------
// The function and the middleware

async function withFetch(rows, run) {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, opts = {}) => {
    seen.push({ url: String(url), headers: opts.headers || {} });
    if (String(url).endsWith('/index.html')) {
      return new Response('<html><head><meta name="description" content="d"><meta property="og:title" content="t"><meta property="og:url" content="u"><title>x</title></head></html>', { status: 200 });
    }
    return new Response(JSON.stringify(rows), { status: 200 });
  };
  try {
    const { default: handler } = await import('../../api/join.js');
    const res = await run(handler);
    return { seen, html: await res.text(), robots: res.headers.get('x-robots-tag') };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('api/join: a plan link reads the plan with its code in x-plan-code and fills in the preview', async () => {
  const { seen, html } = await withFetch([{ meta: PLAN }], h => h.fetch(new Request('https://x.test/api/join?plan=PL4N99&p=p_dave1')));
  const read = seen.find(r => r.url.includes('/rest/v1/planned_rounds'));
  assert.ok(read, 'it reads the plan');
  assert.equal(read.headers['x-plan-code'], 'PL4N99');
  assert.match(read.url, /code=eq\.PL4N99/);
  assert.ok(!seen.some(r => r.url.includes('live_rounds')), 'nothing listed');
  assert.ok(html.includes('<title>Dave, you in for golf Sat, Oct 10 at 8:10 AM?</title>'));
  assert.ok(html.includes('<meta property="og:url" content="https://x.test/?plan=PL4N99&amp;p=p_dave1">'));
});

test('api/join: a challenge link reads it with x-challenge-code', async () => {
  const ch = { from: { who: 'a', name: 'Mike' }, to: { who: 'b', name: 'Dave' }, kind: 'match', stake: 20, holes: 'all' };
  const { seen, html, robots } = await withFetch([{ meta: ch }], h => h.fetch(new Request('https://x.test/api/join?challenge=CH4LL3')));
  assert.equal(robots, 'noindex, nofollow', 'a preview that names people is never in search results');
  const read = seen.find(r => r.url.includes('/rest/v1/challenges'));
  assert.equal(read.headers['x-challenge-code'], 'CH4LL3');
  assert.ok(html.includes('<title>Mike challenged Dave</title>'));
});

test('api/join: a draft link needs no lookup; an unknown plan keeps the plain page', async () => {
  const d = await withFetch([], h => h.fetch(new Request('https://x.test/api/join?draft=trip_1&c=1')));
  assert.ok(!d.seen.some(r => r.url.includes('/rest/v1/')));
  assert.ok(d.html.includes('<title>Your captain’s draft is ready</title>'));
  const none = await withFetch([], h => h.fetch(new Request('https://x.test/api/join?plan=PL4N99')));
  assert.ok(none.html.includes('<title>x</title>'));
});

test('middleware: preview bots on any kind of link go to the function, people get the app', async () => {
  const { default: middleware } = await import('../../middleware.js');
  const bot = { 'user-agent': 'WhatsApp/2.23' };
  const to = q => middleware(new Request(`https://x.test/?${q}`, { headers: bot }))?.headers.get('x-middleware-rewrite') || null;
  assert.equal(to('join=ab12cd'), 'https://x.test/api/join?join=AB12CD');
  assert.equal(to('plan=PL4N99&p=p_dave1'), 'https://x.test/api/join?plan=PL4N99&p=p_dave1');
  assert.equal(to('challenge=CH4LL3'), 'https://x.test/api/join?challenge=CH4LL3');
  assert.equal(to('draft=trip_1&c=1'), 'https://x.test/api/join?draft=trip_1&c=1');
  assert.equal(to('play=wolf'), null);
  assert.equal(to(''), null);
  // A person opening the same link gets the app straight away
  assert.equal(middleware(new Request('https://x.test/?plan=PL4N99', { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } })), undefined);
});

test('link pages: three short steps for a round, a plan and a challenge, no em dashes', async () => {
  const { HOW_IT_WORKS, howItWorks, BROWSER_LINE } = await import('./link-landing.js');
  for (const kind of ['join', 'plan', 'challenge']) {
    const steps = howItWorks(kind);
    assert.equal(steps.length, 3, kind);
    for (const s of steps) { assert.ok(s.length < 80, s); assert.ok(!s.includes(EM)); assert.match(s, /\.$/); }
  }
  assert.deepEqual(howItWorks('draft'), []);
  // A points or lunch round has no money to follow or settle
  const noMoney = howItWorks('join', false);
  assert.equal(noMoney.length, 3);
  assert.ok(!noMoney.some(s => /money|settle|pay/i.test(s)), noMoney.join(' '));
  assert.deepEqual(howItWorks('join', true), HOW_IT_WORKS.join);
  assert.deepEqual(howItWorks('plan', false), HOW_IT_WORKS.plan);
  assert.deepEqual(howItWorks('nope'), []);
  assert.equal(Object.keys(HOW_IT_WORKS).length, 3);
  assert.equal(BROWSER_LINE, 'No download needed');
});
