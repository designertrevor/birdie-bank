// Named usuals in the plan-ahead flow: a usual fills the plan's game, bets, side games, course and
// group, the game and bet go to the vote as the organizer's suggestion, and its side games go on
// the ballot with the usual's house rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { addUsual, planFromUsual, usualFromRound, usualIdFor } from './usuals.js';
import { betOf, newPlan, planMeta, planStart } from './plans.js';

const course = {
  id: 'cc_pebble', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'White', color: '#fff', rating: 70, slope: 120 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
// This phone's own settings differ from the usual's, so the tests can tell which one won
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, nassau: { front: 5, back: 5, total: 5 }, dots: { value: 1, auto: true, kinds: { greenie: true } } };
const USUAL_DOTS = { value: 3, auto: true, kinds: { greenie: true, sandy: true } };

function baseState() {
  const players = {
    me: { id: 'me', name: 'Trevor Nielsen', index: 8 },
    dave: { id: 'dave', name: 'Dave Smith', index: 12 },
    al: { id: 'al', name: 'Al Brown', index: 4 },
  };
  const round = createRound({
    id: 'r1', game: 'skins', course, holesCount: 18, nine: 'front',
    players: Object.values(players).map(p => ({ ...p, tee: 'White' })),
    settings: { ...SETTINGS, skins: { value: 10, carryover: true } }, hcPct: 90,
  });
  round.status = 'done';
  round.finishedAt = Date.UTC(2026, 8, 26, 18);
  round.sideGames = [{ game: 'dots', settings: USUAL_DOTS }];
  const s = { me: 'me', players, customCourses: { [course.id]: course }, rounds: { r1: round }, settings: SETTINGS, usuals: [] };
  addUsual(s, usualFromRound(s, round, { id: 'u1', now: 1 }));
  return s;
}

// What the plan-ahead setup does with the result: lay the patch over the settings and make the plan
function planFrom(s, p, { useHcFromUsual = true } = {}) {
  const opts = { ...structuredClone(s.settings), ...structuredClone(p.opts) };
  return newPlan({
    id: 'pl1', hostWho: 'me', hostName: 'Trevor Nielsen', game: p.game, holesCount: p.holesCount, nine: p.nine,
    date: '2026-10-03', teeTime: '08:10', course: s.customCourses[p.courseId] || null,
    people: p.invited.map(pid => s.players[pid]),
    ballot: { games: [], bets: [betOf(p.game, opts)], sides: p.sides }, suggestedBet: betOf(p.game, opts), settings: opts,
    useHc: useHcFromUsual ? p.useHc : true, hcPct: opts.hcPct, usualId: p.usualId, now: 1,
  });
}

test('a usual fills the plan: game, length, course, group, bets and side games', () => {
  const s = baseState();
  const p = planFromUsual(s, s.usuals[0]);
  assert.equal(p.game, 'skins');
  assert.equal(p.holesCount, 18);
  assert.equal(p.nine, 'front');
  assert.equal(p.courseId, course.id);
  assert.deepEqual(p.invited, ['dave', 'al']);
  assert.deepEqual(p.missing, []);
  assert.equal(p.opts.skins.value, 10);
  assert.equal(p.opts.hcPct, 90);
  assert.deepEqual(p.opts.dots, USUAL_DOTS);
  assert.deepEqual(p.sides, ['dots']);
  assert.equal(p.useHc, true);
  assert.equal(p.usualId, 'u1');
  // Always lands on When and Course: the date needs picking
  assert.equal(p.step, 1);
  // Copies, never the saved usual itself
  p.opts.dots.value = 99;
  assert.equal(s.usuals[0].sideGames[0].settings.value, 3);
});

test('the plan built from it suggests the usual bet and puts its side games on the ballot with its rules', () => {
  const s = baseState();
  const plan = planFrom(s, planFromUsual(s, s.usuals[0]));
  assert.equal(plan.suggested.game, 'skins');
  assert.equal(plan.suggested.bet, 10);
  assert.equal(plan.ballot.rules.skins.value, 10);
  assert.deepEqual(plan.ballot.sides, ['dots']);
  assert.deepEqual(plan.suggested.sides, ['dots']);
  assert.deepEqual(plan.ballot.rules.dots, USUAL_DOTS);
  assert.deepEqual(plan.people.map(p => p.id), ['me', 'dave', 'al']);
  assert.equal(plan.hcPct, 90);
  assert.equal(plan.usualId, 'u1');
  // The usual stays on the organizer's phone: friends never get its id
  assert.equal('usualId' in planMeta(plan), false);
  assert.equal(planMeta(plan).hcPct, 90);
});

test('the roll call starts the round with the usual rules and handicap percentage', () => {
  const s = baseState();
  const plan = planFrom(s, planFromUsual(s, s.usuals[0]));
  const start = planStart(s, plan, ['me', 'dave', 'al'], { course });
  assert.equal(start.problem, null);
  assert.equal(start.settings.skins.value, 10);
  assert.deepEqual(start.sideGames, [{ game: 'dots', settings: USUAL_DOTS }]);
  assert.equal(start.hcPct, 90);
  assert.equal(start.useHandicaps, true);
  // A usual played without handicaps plans without them too
  const off = { ...s.usuals[0], useHc: false };
  assert.equal(planStart(s, planFrom(s, planFromUsual(s, off)), ['me', 'dave'], { course }).useHandicaps, false);
});

test('plans without a usual start exactly as before', () => {
  const s = baseState();
  const plan = newPlan({
    id: 'pl2', hostWho: 'me', hostName: 'Trevor', game: 'skins', holesCount: 18, date: '2026-10-03', course,
    people: [s.players.dave], ballot: { games: [], bets: [2] }, suggestedBet: 2, settings: SETTINGS, now: 1,
  });
  assert.equal('hcPct' in plan, false);
  assert.equal('usualId' in plan, false);
  assert.equal(planStart({ ...s, settings: { ...SETTINGS, hcPct: 80 } }, plan, ['me', 'dave'], { course }).hcPct, 80);
});

test('a usual whose course is gone lands on the course step with no course picked', () => {
  const s = { ...baseState(), customCourses: {} };
  const p = planFromUsual(s, s.usuals[0]);
  assert.equal(p.courseId, null);
  assert.equal(p.step, 1);
  assert.equal(p.game, 'skins');
});

test('players not on this phone are left out of the invites and named', () => {
  const s = baseState();
  const { dave: _gone, ...rest } = s.players;
  const p = planFromUsual({ ...s, players: rest }, s.usuals[0]);
  assert.deepEqual(p.invited, ['al']);
  assert.deepEqual(p.missing, ['Dave Smith']);
  // A game that no longer exists can't be planned
  assert.equal(planFromUsual(s, { ...s.usuals[0], game: 'gone' }), null);
});

test('a side game that clashes with the main game stays off the ballot', () => {
  const s = baseState();
  const u = { ...s.usuals[0], game: 'nassau', bets: { front: 2, back: 2, total: 2 }, sideGames: [{ game: 'skins', settings: { value: 1 } }, { game: 'dots', settings: USUAL_DOTS }] };
  const p = planFromUsual(s, u);
  assert.deepEqual(p.sides, ['skins', 'dots']);
  const clash = planFromUsual(s, { ...u, game: 'skins', bets: { value: 5 } });
  assert.deepEqual(clash.sides, ['dots']);
  assert.equal(clash.opts.skins.value, 5);
});

test('a round from the plan counts for the usual only when it is still its game at its course', () => {
  const s = baseState();
  assert.equal(usualIdFor(s, 'u1', 'skins', course), 'u1');
  assert.equal(usualIdFor(s, 'u1', 'nassau', course), null);
  assert.equal(usualIdFor(s, 'u1', 'skins', { id: 'other' }), null);
  assert.equal(usualIdFor(s, 'u1', 'skins', null), null);
  assert.equal(usualIdFor(s, 'gone', 'skins', course), null);
  assert.equal(usualIdFor(s, null, 'skins', course), null);
});
