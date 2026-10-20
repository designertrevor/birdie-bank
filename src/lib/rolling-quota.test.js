// Rolling quota (overnight 14): Quota's "Quota moves after the round" by its name, with a cap on how far
// one round moves it at half the difference, and setup saying where each quota moved from last time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quotaAdjusted } from './games.js';
import { createRound, nextQuotas, roundResults, wholeRoundOnly } from './round.js';
import { carriedLine, carriedQuotas, movedWords, myQuotaLine, withQuotaRules } from './quota-carry.js';
import { houseRulesLine } from './house-rules.js';

const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const NAMES = { a: 'Ann Lee', b: 'Bo Diaz', c: 'Cy Park' };
function quotaRound(id, quota, { holes = 9, finishedAt = 1 } = {}) {
  const r = createRound({
    id, game: 'quota', course: flat(holes), holesCount: holes, players: Object.keys(NAMES).map(pid => ({ id: pid, name: NAMES[pid], index: null })),
    settings: { hcPct: 100, quota: { stake: 5, payout: 'pot', table: 'chicago', adjust: 'half', ...quota } }, hcPct: 100, useHandicaps: false,
  });
  r.status = 'done'; r.finishedAt = finishedAt;
  return r;
}
// Pars all round (2 points a hole, 18 over nine: level with an 18 quota), then birdies for some
function play(r, birdies = {}) {
  r.holes.forEach(h => { r.scores[h.no] = Object.fromEntries(r.players.map(p => [p.id, h.no <= (birdies[p.id] || 0) ? 3 : 4])); });
  return r;
}

test('the cap: half the difference, never more than the cap; no cap is the old rule', () => {
  assert.equal(quotaAdjusted(18, 12, 'half'), 24);
  assert.equal(quotaAdjusted(18, 12, 'half', 3), 21);
  assert.equal(quotaAdjusted(18, -12, 'half', 3), 15);
  assert.equal(quotaAdjusted(18, 4, 'half', 3), 20);
  assert.equal(quotaAdjusted(18, 4, 'half', 2), 20);
  assert.equal(quotaAdjusted(18, 9, 'one', 3), 19);
});

test('a finished round under Rolling quota moves each quota by half, capped', () => {
  // Ann six birdies (+12 points over an 18 quota), Bo two (+4), Cy pars (level)
  const r = play(quotaRound('r1', { cap: 3 }), { a: 6, b: 2 });
  const next = nextQuotas(r);
  assert.deepEqual([next.a.next, next.b.next, next.c.next], [21, 20, 18]);
  // A round saved before the cap (no cap) moves Ann the full half
  const old = play(quotaRound('r0', {}), { a: 6 });
  assert.equal(nextQuotas(old).a.next, 24);
  assert.equal(wholeRoundOnly('quota', { adjust: 'half', cap: 3 }, { adjust: 'half', cap: 2 }), true);
});

test('setup: the carried quota per player, how far it moved, and yours said on its own', () => {
  const r = play(quotaRound('r1', { cap: 3 }), { a: 6, b: 2 });
  const state = { me: 'a', players: {}, rounds: { r1: r } };
  const carried = carriedQuotas(state, ['a', 'b', 'c'], 9);
  assert.deepEqual(carried.a, { quota: 21, from: 18, last: 18, roundId: 'r1' });
  assert.equal(movedWords(carried.a), 'up 3');
  assert.equal(myQuotaLine(carried, 'a'), 'Your quota is 21, up 3 from last time.');
  assert.equal(myQuotaLine(carried, 'c'), 'Your quota is 18, the same as last time.');
  assert.equal(myQuotaLine(carried, 'x'), '');
  assert.equal(carriedLine(carried, id => NAMES[id], 'a'), 'Bo 20 (up 2) · Cy 18');
  // Over 18 holes next time: the quotas double, and the move is against the doubled one
  const eighteen = carriedQuotas(state, ['a'], 18);
  assert.deepEqual([eighteen.a.quota, eighteen.a.last], [42, 36]);
  assert.equal(myQuotaLine(eighteen, 'a'), 'Your quota is 42, up 6 from last time.');
});

test('it rolls round to round: each round starts from the last one, and the money uses it', () => {
  const r1 = play(quotaRound('r1', { cap: 3 }, { finishedAt: 1 }), { a: 6 });
  let state = { me: 'a', players: {}, rounds: { r1 } };
  // The second round is made with the carried quotas on it
  const r2 = withQuotaRules(state, play(quotaRound('r2', { cap: 3 }, { finishedAt: 2 }), { a: 1 }));
  assert.deepEqual(r2.quotas, { a: 21, b: 18, c: 18 });
  // Ann scores 20 points against 21: down 1, so half rounds to 1 down
  const t = roundResults(r2).detail.totals.find(x => x.id === 'a');
  assert.equal(t.quota, 21);
  state = { ...state, rounds: { r1, r2 } };
  assert.equal(carriedQuotas(state, ['a'], 9).a.quota, 20);
  assert.equal(myQuotaLine(carriedQuotas(state, ['a'], 9), 'a'), 'Your quota is 20, down 1 from last time.');
});

test('the bet line calls it Rolling quota', () => {
  assert.match(houseRulesLine('quota', { adjust: 'half', cap: 3 }), /rolling quota/);
  assert.match(houseRulesLine('quota', { adjust: 'one' }), /rolling quota/);
  assert.doesNotMatch(houseRulesLine('quota', { adjust: 'off' }), /rolling/);
});

test('setup counts Rolling quota among the House rules: on at 1 point or Half, off at Off', () => {
  // The fold counts the rules that report to it as they render (HouseRulesFold.jsx), so the Segmented
  // block has to sit inside a FoldRule, on whenever it isn't Off (it read "All off" on Half)
  const src = readFileSync(new URL('../components/GameOptions.jsx', import.meta.url), 'utf8');
  const quota = src.slice(src.indexOf("case 'quota': {"), src.indexOf("case 'nines':"));
  assert.match(quota, /<FoldRule on=\{adjust !== 'off'\}><div className="block">[\s\S]*label="Rolling quota: how the quota moves after the round"[\s\S]*<\/div><\/FoldRule>/);
  assert.ok(quota.indexOf("{label('House rules')}") < quota.indexOf('<FoldRule'), 'under the House rules label, inside the fold');
  const fold = readFileSync(new URL('../components/HouseRulesFold.jsx', import.meta.url), 'utf8');
  assert.match(fold, /export function FoldRule\(\{ on, children \}\) \{\n {2}useFoldRule\(on\);/);
  assert.match(fold, /export function HouseRule\([^)]*\) \{\n {2}useFoldRule\(on\);/);
});
