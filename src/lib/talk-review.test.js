// Review of the trash talk (overnight 7): money jabs only where there's money, Lately and plans
// that were called off, a refused reaction tried again on the next tap, and the SQL file's shape
// (safe to run again, and its helpers not callable on their own).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound } from './round.js';
import { betsOf } from './pair-bets.js';
import { JABS, betTarget, jabsFor, latelyTalk, moneyOn, payTarget, planTalk, roundTalk, toggleReaction } from './talk.js';

const course = {
  id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'Blue', color: '#00f', rating: 36.0, slope: 120 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const PLAYERS = [
  { id: 'me', name: 'Trevor Nielsen', index: 10, tee: 'Blue' },
  { id: 'sam', name: 'Sam Ortiz', index: 2, tee: 'Blue' },
];
function round(playFor = null, betPlayFor = undefined) {
  const r = createRound({ id: 'r1', game: 'skins', course, holesCount: 9, nine: 'front', players: PLAYERS, settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  r.holes.forEach(h => { r.scores[h.no] = { me: 4, sam: 4 }; });
  const bet = { id: 'b1', kind: 'custom', sides: ['me', 'sam'], stake: 5, label: 'Longest drive', winner: 'me', at: 3 };
  if (betPlayFor) bet.playFor = betPlayFor;
  return { ...r, status: 'done', playFor, bets: [bet] };
}
const keys = list => list.map(j => j.key);
const MONEY_JABS = Object.values(JABS).flat().filter(j => j.money).map(j => j.key);

test('talk review: money jabs show only on a thing played for money', () => {
  assert.deepEqual(MONEY_JABS.sort(), ['easy', 'lesson', 'wallet']);
  // A money round: every jab, everywhere
  const cash = round();
  assert.equal(betsOf(cash).length, 1, 'the bet is a real side bet');
  for (const on of ['round', payTarget('sam', 'me'), betTarget('b1')]) {
    assert.equal(moneyOn(cash, on), true, on);
    assert.deepEqual(jabsFor(on, { money: roundTalk(cash, { me: 'me', rounds: {} }).moneyOn(on) }), jabsFor(on));
  }
  // A points round: nothing about money
  const pts = round({ kind: 'points' });
  assert.equal(moneyOn(pts, 'round'), false);
  assert.equal(moneyOn(pts, betTarget('b1')), false);
  assert.ok(!keys(jabsFor('round', { money: false })).includes('lesson'));
  assert.ok(!keys(jabsFor(betTarget('b1'), { money: false })).includes('easy'));
  assert.ok(keys(jabsFor('round', { money: false })).includes('chip'), 'the rest stay');
  // A lunch round: the round reads in the reward; its side bet for money is money, a points one isn't
  assert.equal(moneyOn(round({ kind: 'reward', reward: 'Lunch' }), 'round'), false);
  assert.equal(moneyOn(round({ kind: 'reward', reward: 'Lunch' }, 'money'), betTarget('b1')), true);
  assert.equal(moneyOn(round({ kind: 'reward', reward: 'Lunch' }, 'points'), betTarget('b1')), false);
  assert.equal(moneyOn(round({ kind: 'reward', reward: 'Lunch' }), payTarget('sam', 'me')), true, 'a settle-up line is on the Tab');
  assert.equal(moneyOn(cash, betTarget('gone')), false, 'a bet that is not in the round');
  // A plan reads as it's played for
  const plan = { id: 'p1', status: 'planned', host: true, hostWho: 'host', hostName: 'Trevor', people: [{ id: 'host', name: 'Trevor' }], answers: {} };
  assert.equal(planTalk(plan).moneyOn('plan'), true);
  assert.equal(planTalk({ ...plan, playFor: { kind: 'points' } }).moneyOn('plan'), false);
  assert.ok(!keys(jabsFor('plan', { money: false })).includes('wallet'));
});

test('talk review: Lately leaves out a called-off plan, and a plan for today reads in lower case', () => {
  const NOW = new Date(2026, 9, 3, 12).getTime();
  const today = '2026-10-03';
  const plan = { id: 'p1', status: 'planned', host: true, hostWho: 'host', hostName: 'Trevor', date: today, course: { name: 'Pebble Creek' }, people: [{ id: 'host', name: 'Trevor' }, { id: 'sam', name: 'Sam' }], answers: {} };
  const row = { id: 'a', on: 'plan', kind: 'comment', who: 'sam', name: 'Sam', body: 'Bring your wallet', jab: 'wallet', emoji: null, at: NOW - 6e5, updatedAt: NOW - 6e5, deleted: false };
  const state = p => ({ me: 'me', links: {}, unlinks: [], players: { me: { id: 'me', name: 'Trevor' } }, rounds: {}, settlements: [], plans: { p1: p }, talk: { 'plan:p1': { a: row } } });
  const [it] = latelyTalk(state(plan), NOW);
  assert.match(it.sub, /^Plan for today at Pebble Creek/);
  assert.deepEqual(latelyTalk(state({ ...plan, status: 'off' }), NOW), []);
  assert.deepEqual(latelyTalk(state({ ...plan, gone: true }), NOW), []);
});

test('talk review: a reaction the server refused goes up again on the next tap', () => {
  const on = payTarget('sam', 'me');
  const a = { ...toggleReaction({}, { on, who: 'me', emoji: 'fire', now: 10 }), refused: true };
  const b = toggleReaction({ [a.id]: a }, { on, who: 'me', emoji: 'fire', now: 20 });
  assert.equal(b.refused, false);
  assert.equal(b.deleted, true);
});

test('talk review: the comments SQL is safe to run again and keeps its helpers to itself', () => {
  const sql = readFileSync(new URL('../../supabase/2026-10-04-comments.sql', import.meta.url), 'utf8');
  const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.ok(!sql.includes(String.fromCharCode(0x2014)));
  for (const m of code.matchAll(/create table (?!if not exists)/gi)) assert.fail(`create table without if not exists at ${m.index}`);
  for (const m of code.matchAll(/create (?!or replace)function/gi)) assert.fail(`create function without or replace at ${m.index}`);
  for (const m of code.matchAll(/create index (?!if not exists)/gi)) assert.fail(`create index without if not exists at ${m.index}`);
  for (const [, name] of code.matchAll(/create policy "([^"]+)"/g)) assert.ok(code.includes(`drop policy if exists "${name}"`), name);
  for (const [, name] of code.matchAll(/create trigger (\w+)/g)) assert.ok(code.includes(`drop trigger if exists ${name}`), name);
  // Supabase grants new functions to anon and authenticated itself, so revoking from public alone isn't enough
  assert.match(code, /revoke all on function public\.comment_round_seats\(jsonb, text, uuid\) from public, anon, authenticated;/);
  assert.match(code, /revoke all on function public\.comment_plan_seats\(text\) from public, anon, authenticated;/);
  // Every $$ body is closed
  assert.equal((code.match(/\$\$/g) || []).length % 2, 0);
  // No earlier dated file was touched for this
  assert.doesNotMatch(code, /alter table public\.(live_rounds|planned_rounds|plan_rsvps|account_players)/);
});
