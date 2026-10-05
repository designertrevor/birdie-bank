// Review fixes for the house rules added 2026-10-05 (overnight 9): Team quota and Quota moves after the
// round work the same from a plan's roll call as from setup, a round made without teams never says
// "team quota", a bye is never counted as somebody's press, and leaving a team quota says what happens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, leftRule, wholeRoundOnly } from './round.js';
import { houseRulesLine } from './house-rules.js';
import { houseRulesFor } from './agreed.js';
import { withQuotaRules } from './quota-carry.js';
import { newPlan, planStart } from './plans.js';
import { pressesIn } from './deep-stats.js';

const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const NAMES = { a: 'Ann', b: 'Bo', c: 'Cy', d: 'Di' };
const QUOTA = { stake: 5, payout: 'pot', nassau: false, minus: false, split: 'top', table: 'chicago', adjust: 'off', team: true };
function mk(ids, { quota = {}, teams = null, holes = 9 } = {}) {
  const players = ids.map(id => ({ id, name: NAMES[id], index: 0 }));
  return createRound({ id: 'r', game: 'quota', course: flat(holes), holesCount: holes, players, settings: { hcPct: 100, quota: { ...QUOTA, ...quota } }, hcPct: 100, useHandicaps: false, teams });
}
const scores = (r, over = {}) => {
  r.holes.forEach(h => { r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, h.par])), ...(over[h.no] || {}) }; });
  return r;
};

test('team quota made without teams plays everyone for themselves, and its settings and card say so', () => {
  // Three players (the toggle came from Game defaults): no teams, so no team quota
  const three = withQuotaRules({ rounds: {} }, mk(['a', 'b', 'c'], { quota: { nassau: true } }));
  assert.equal(three.settings.quota.team, false);
  assert.equal(houseRulesLine('quota', three.settings.quota, 9), '');
  assert.equal(houseRulesFor('quota', three.settings.quota, 18).find(h => h.id === 'team').on, false);
  // With 18 holes the front, back and total the money pays is listed again
  const eighteen = withQuotaRules({ rounds: {} }, mk(['a', 'b', 'c'], { quota: { nassau: true }, holes: 18 }));
  assert.equal(houseRulesLine('quota', eighteen.settings.quota, 18), 'front, back and total');
  assert.equal(roundResults(scores(eighteen, { 1: { a: 3 } })).detail.pots.length, 3);
  // With its teams it stays on
  const teams = withQuotaRules({ rounds: {} }, mk(['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] }));
  assert.equal(teams.settings.quota.team, true);
  assert.equal(houseRulesLine('quota', teams.settings.quota, 9), 'team quota');
  // Any other game is left as it was
  const other = { game: 'skins', settings: { skins: { team: true } } };
  assert.equal(withQuotaRules({ rounds: {} }, other), other);
});

test('quota moves after the round: the carried quotas go on a round however it is made', () => {
  const last = scores(mk(['a', 'b', 'c'], { quota: { team: false, adjust: 'one', payout: 'per', stake: 1 } }), { 1: { a: 3 }, 2: { c: 5 } });
  last.id = 'last'; last.status = 'done'; last.finishedAt = 5;
  const state = { me: 'a', players: { a: { id: 'a', name: 'Ann' }, b: { id: 'b', name: 'Bo' }, c: { id: 'c', name: 'Cy' } }, rounds: { last } };
  // Ann beat 18 (+2 for the birdie), Bo made it on the nose, Cy missed by 1
  const next = withQuotaRules(state, mk(['a', 'b', 'c'], { quota: { team: false, adjust: 'one' } }));
  assert.deepEqual(next.quotas, { a: 19, b: 18, c: 17 });
  // The rule off: nothing carried
  assert.equal(withQuotaRules(state, mk(['a', 'b', 'c'], { quota: { team: false } })).quotas, undefined);
});

test('a planned Quota round with team quota starts in pairs from the roll call', () => {
  const settings = { hcPct: 100, quota: { ...QUOTA } };
  const plan = newPlan({
    id: 'pl', hostName: 'Ann', game: 'quota', holesCount: 9, date: '2026-10-10', course: { id: 'f9', name: 'Flat' },
    people: [{ id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }], settings, suggestedBet: 5, now: 1,
  });
  for (const who of ['b', 'c', 'd']) plan.answers = { ...plan.answers, [who]: { name: NAMES[who], status: 'in', at: 1 } };
  const players = Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name, index: 0 }]));
  const state = { me: 'a', players, settings, plans: { pl: plan }, rounds: {} };
  const setup = planStart(state, plan, [plan.hostWho, 'b', 'c', 'd'], { course: flat(9) });
  assert.equal(setup.problem, null);
  assert.deepEqual(setup.teams, [['a', 'b'], ['c', 'd']]);
  const round = withQuotaRules(state, createRound({ id: 'r', game: 'quota', course: flat(9), holesCount: 9, players: setup.players, settings: setup.settings, hcPct: 100, useHandicaps: false, teams: setup.teams }));
  assert.equal(round.settings.quota.team, true);
  scores(round, { 1: { a: 3 }, 2: { c: 3 }, 3: { d: 5 } });
  // Ann and Bo +2, Cy and Di +1: Ann and Bo take the $20 pot
  assert.deepEqual(roundResults(round).balances, { a: 5, b: 5, c: -5, d: -5 });
  // Three people came: no teams, so it's everyone for themselves
  const three = planStart(state, plan, [plan.hostWho, 'b', 'c'], { course: flat(9) });
  assert.equal(three.teams, null);
});

test('a bye is nobody’s press in Your stats', () => {
  // Ann closes the match out 5&4, then Bo takes the bye
  const r = createRound({ id: 'm', game: 'match', course: flat(9), holesCount: 9, players: [{ id: 'a', name: 'Ann', index: 0 }, { id: 'b', name: 'Bo', index: 0 }], settings: { hcPct: 100, match: { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best', bye: 'half' } }, hcPct: 100, useHandicaps: false });
  scores(r, { 1: { a: 3 }, 2: { a: 3 }, 3: { a: 3 }, 4: { a: 3 }, 5: { a: 3 }, 6: { b: 3 } });
  r.status = 'done';
  assert.ok(roundResults(r).detail.lines.some(l => l.bye));
  const none = { made: { won: 0, lost: 0, halved: 0 }, against: { won: 0, lost: 0, halved: 0 } };
  assert.deepEqual(pressesIn(r, 'a'), none);
  assert.deepEqual(pressesIn(r, 'b'), none);
});

test('leaving a team quota round keeps the player on their team', () => {
  const r = mk(['a', 'b', 'c', 'd'], { teams: [['a', 'b'], ['c', 'd']] });
  assert.equal(leftRule(r, 'a'), 'They stay on their team: their points count against their quota for the holes they played.');
  // Everyone for themselves, a pot: they're out of it, as before
  const solo = mk(['a', 'b', 'c', 'd'], { quota: { team: false } });
  assert.equal(leftRule(solo, 'a'), 'They’re out of the pot, so they don’t pay or win it.');
});

test('Stableford’s points table and Quota’s moves after the round can only change for the whole round', () => {
  assert.equal(wholeRoundOnly('stableford', { payout: 'per', table: 'standard' }, { payout: 'per', table: 'chicago' }), true);
  assert.equal(wholeRoundOnly('stableford', { payout: 'per', modified: false }, { payout: 'per', modified: true }), true);
  assert.equal(wholeRoundOnly('stableford', { payout: 'per', stake: 1 }, { payout: 'per', stake: 2 }), false);
  assert.equal(wholeRoundOnly('quota', { payout: 'per', adjust: 'off' }, { payout: 'per', adjust: 'one' }), true);
  assert.equal(wholeRoundOnly('quota', { payout: 'per', table: 'chicago' }, { payout: 'per', table: 'stableford' }), false);
});
