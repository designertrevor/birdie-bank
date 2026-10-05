// The plan lock: only the organizer changes a plan, and each person changes only their own answer.
// plan-lock.js is the spec for supabase/2026-10-04-plan-lock.sql; the dev transport plays it too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerWrite, hostOf, planWrite } from './plan-lock.js';
import { planLocalAdapter, planSupabaseAdapter } from './plan-adapters.js';
import { answersFrom, newPlan, planMeta, planPeople } from './plans.js';

const ORG = { dev: 'd-org', user: null };
const DAVE = { dev: 'd-dave', user: null };
const SAM = { dev: 'd-sam', user: null };
const OLD_APP = { dev: null, user: null };

test('the plan: only the phone that shared it, or its account once signed in', () => {
  const host = hostOf(ORG);
  assert.deepEqual(host, { dev: 'd-org', user: null });
  assert.equal(planWrite(host, ORG).ok, true);
  assert.equal(planWrite(host, DAVE).ok, false);
  assert.equal(planWrite(host, OLD_APP).ok, false);
  // Signing in on the same phone notes the account, so another phone signed in to it can change it too
  const signed = planWrite(host, { dev: 'd-org', user: 'u-org' }).host;
  assert.deepEqual(signed, { dev: 'd-org', user: 'u-org' });
  assert.equal(planWrite(signed, { dev: 'd-org-ipad', user: 'u-org' }).ok, true);
  assert.equal(planWrite(signed, { dev: 'd-dave', user: 'u-dave' }).ok, false);
});

test('a plan shared before the lock, or by an older app, stays open to everyone', () => {
  assert.equal(hostOf(OLD_APP), null);
  assert.equal(planWrite(null, DAVE).ok, true);
  assert.equal(planWrite(null, OLD_APP).ok, true);
  assert.equal(answerWrite({ host: null, who: 'dave', owner: { dev: 'd-sam' }, w: DAVE, take: true }).as, 'open');
});

test('the first phone to answer for a name owns that answer', () => {
  const host = hostOf(ORG);
  const first = answerWrite({ host, who: 'dave', owner: null, w: DAVE, take: true });
  assert.equal(first.as, 'self');
  assert.deepEqual(first.owner, { dev: 'd-dave', user: null, byHost: false });
  // Dave changes it again
  assert.equal(answerWrite({ host, who: 'dave', owner: first.owner, w: DAVE, take: true }).as, 'self');
  // Sam can't, the organizer can't, and nor can an older app
  for (const w of [SAM, ORG, OLD_APP]) assert.equal(answerWrite({ host, who: 'dave', owner: first.owner, w, take: true }).as, null);
  // Votes follow the answer
  assert.equal(answerWrite({ host, who: 'dave', owner: first.owner, w: DAVE }).as, 'self');
  assert.equal(answerWrite({ host, who: 'dave', owner: first.owner, w: SAM }).as, null);
});

test('the organizer marks someone in; their own answer from the link takes it over, and then it’s theirs', () => {
  const host = hostOf(ORG);
  const marked = answerWrite({ host, who: 'dave', owner: null, w: ORG, take: true });
  assert.equal(marked.as, 'host');
  assert.equal(marked.owner.byHost, true);
  // The organizer can change their mark
  assert.equal(answerWrite({ host, who: 'dave', owner: marked.owner, w: ORG, take: true }).as, 'host');
  // A vote can't ride on the organizer's mark
  assert.equal(answerWrite({ host, who: 'dave', owner: marked.owner, w: DAVE }).as, null);
  // Dave answers from the link
  const his = answerWrite({ host, who: 'dave', owner: marked.owner, w: DAVE, take: true });
  assert.equal(his.as, 'self');
  assert.equal(his.owner.byHost, false);
  assert.equal(answerWrite({ host, who: 'dave', owner: his.owner, w: ORG, take: true }).as, null);
});

test('the organizer’s own answer is theirs alone', () => {
  const host = hostOf(ORG);
  assert.equal(answerWrite({ host, who: 'host', w: ORG, take: true }).as, 'host');
  assert.equal(answerWrite({ host, who: 'host', w: DAVE, take: true }).as, null);
  // A plan whose organizer key is a player id (older plans used one)
  assert.equal(answerWrite({ host, hostWho: 'me', who: 'me', w: DAVE, take: true }).as, null);
});

test('an answer made by an older app stays open, and the first phone with a key to answer takes it', () => {
  const host = hostOf(ORG);
  assert.equal(answerWrite({ host, who: 'g_1', owner: null, w: OLD_APP, take: true }).as, 'open');
  const r = answerWrite({ host, who: 'g_1', owner: { dev: null, user: null, byHost: false }, w: SAM, take: true });
  assert.equal(r.as, 'self');
  assert.equal(r.owner.dev, 'd-sam');
});

test('signing in after answering lets that account change the answer from another phone', () => {
  const host = hostOf(ORG);
  const own = answerWrite({ host, who: 'dave', owner: null, w: DAVE, take: true }).owner;
  const signed = answerWrite({ host, who: 'dave', owner: own, w: { dev: 'd-dave', user: 'u-dave' }, take: true }).owner;
  assert.equal(signed.user, 'u-dave');
  assert.equal(answerWrite({ host, who: 'dave', owner: signed, w: { dev: 'd-laptop', user: 'u-dave' }, take: true }).as, 'self');
});

// --------------------------- the dev transport plays the lock ---------------------------

function withStorage(fn) {
  const mem = new Map();
  const prev = { ls: globalThis.localStorage, bc: globalThis.BroadcastChannel };
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  globalThis.BroadcastChannel = undefined;
  return Promise.resolve(fn(mem)).finally(() => { globalThis.localStorage = prev.ls; globalThis.BroadcastChannel = prev.bc; });
}

const plan = () => newPlan({
  id: 'pl1', hostName: 'Trevor', game: 'skins', holesCount: 18, date: '2026-10-10', course: { id: 'c1', name: 'Rancho' },
  people: [{ id: 'dave', name: 'Dave' }, { id: 'sam', name: 'Sam' }], ballot: { games: ['nassau'], bets: [2, 5] }, suggestedBet: 5, now: 1,
});

test('two phones on the dev transport: the friend can’t change the plan or someone else’s answer', () => withStorage(async () => {
  let dev = 'd-org';
  const a = planLocalAdapter(() => dev);
  const meta = planMeta(plan());
  await a.create('ABC123', meta);
  assert.equal(await a.setRsvp('ABC123', { who: 'host', name: 'Trevor', status: 'in' }), true);
  // The organizer marks Sam in
  assert.equal(await a.setRsvp('ABC123', { who: 'sam', name: 'Sam', status: 'in' }), true);

  // Dave's phone
  dev = 'd-dave';
  assert.equal(await a.setRsvp('ABC123', { who: 'dave', name: 'Dave', status: 'in' }), true);
  await a.setVote('ABC123', 'dave', 'game', 'nassau');
  // He can't change the plan, the organizer's own answer, or delete the plan
  assert.equal(await a.updateMeta('ABC123', { ...meta, status: 'off' }), false);
  assert.equal(await a.setRsvp('ABC123', { who: 'host', name: 'Trevor', status: 'out' }), false);
  await a.remove('ABC123');
  let r = await a.fetch('ABC123');
  assert.equal(r.meta.status, 'planned');
  assert.equal(r.rsvps.find(x => x.who === 'host').status, 'in');

  // Sam's phone takes over his own answer from the organizer's mark
  dev = 'd-sam';
  assert.equal(await a.setRsvp('ABC123', { who: 'sam', name: 'Sam', status: 'maybe' }), true);
  assert.equal(await a.setRsvp('ABC123', { who: 'dave', name: 'Dave', status: 'out' }), false);
  await a.setVote('ABC123', 'dave', 'game', 'skins');

  // Back on the organizer's phone: Dave's and Sam's answers are theirs now
  dev = 'd-org';
  assert.equal(await a.setRsvp('ABC123', { who: 'sam', name: 'Sam', status: 'out' }), false);
  r = await a.fetch('ABC123');
  const answers = answersFrom(r.rsvps, r.votes);
  assert.equal(answers.dave.status, 'in');
  assert.equal(answers.dave.game, 'nassau');
  assert.equal(answers.dave.self, true);
  assert.equal(answers.sam.status, 'maybe');
  assert.equal(answers.host.self, undefined);
  // planPeople says whose answer is their own, so the organizer's phone doesn't offer to change it
  const p = { ...plan(), answers };
  assert.deepEqual(planPeople(p).map(x => [x.who, x.self]), [['host', false], ['dave', true], ['sam', true]]);
  // The organizer changes the plan and can delete it
  assert.equal(await a.updateMeta('ABC123', { ...meta, status: 'off' }), true);
  assert.equal((await a.fetch('ABC123')).meta.status, 'off');
  await a.remove('ABC123');
  assert.equal(await a.fetch('ABC123'), null);
}));

test('with the lock off (as before the SQL runs), every write goes through', () => withStorage(async mem => {
  mem.set('bb-lock-off', '1');
  let dev = 'd-org';
  const a = planLocalAdapter(() => dev);
  await a.create('XYZ789', planMeta(plan()));
  dev = 'd-dave';
  assert.equal(await a.setRsvp('XYZ789', { who: 'host', name: 'Trevor', status: 'out' }), true);
  assert.equal(await a.updateMeta('XYZ789', { ...planMeta(plan()), status: 'off' }), true);
  const r = await a.fetch('XYZ789');
  assert.equal(r.meta.status, 'off');
  assert.equal(r.rsvps[0].self, false);
}));

test('answers from the server before the lock (no by_self) read as before', () => {
  const a = answersFrom([{ who: 'dave', name: 'Dave', status: 'in', at: 1 }], []);
  assert.deepEqual(a, { dave: { name: 'Dave', status: 'in', at: 1 } });
});

// A stand-in for the Supabase client: each call resolves to the rows the server sent back
function fakeDb(rows) {
  // (setHeader: every plan request names the plan's code)
  const sent = () => { const p = Promise.resolve({ data: rows, error: null }); p.setHeader = () => p; return p; };
  const q = { eq: () => q, select: sent };
  return { from: () => ({ update: () => q, upsert: () => q }) };
}

test('on Supabase, a plan or answer the lock kept as it was reads as refused; before the SQL, every write is kept', async () => {
  // The lock returns no row for a write it left alone
  const locked = planSupabaseAdapter(fakeDb([]));
  assert.equal(await locked.updateMeta('ABC123', {}), false);
  assert.equal(await locked.setRsvp('ABC123', { who: 'dave', name: 'Dave', status: 'in' }), false);
  // The row comes back when the write went through (always, before the plan lock SQL has run)
  const open = planSupabaseAdapter(fakeDb([{ code: 'ABC123', who: 'dave' }]));
  assert.equal(await open.updateMeta('ABC123', {}), true);
  assert.equal(await open.setRsvp('ABC123', { who: 'dave', name: 'Dave', status: 'in' }), true);
});
