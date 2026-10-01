// Usuals and planned rounds keep half strokes and side games' own Strokes given %s (Overnight 6).
// Before this a usual or a plan dropped them, so a round set up again played full strokes off one %.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { addUsual, matchingUsual, planFromUsual, sameAs, setupFromUsual, usualFromRound } from './usuals.js';
import { betOf, newPlan, planMeta, planStart } from './plans.js';

const course = {
  id: 'cc_pebble', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'White', color: '#fff', rating: 70, slope: 120 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, nassau: { front: 5, back: 5, total: 5 }, birdies: { value: 2, eagleShares: 2 } };

function state({ half = true, skinsPct = 80 } = {}) {
  const players = {
    me: { id: 'me', name: 'Trevor Nielsen', index: 8 },
    dave: { id: 'dave', name: 'Dave Smith', index: 12 },
  };
  const round = createRound({
    id: 'r1', game: 'nassau', course, holesCount: 18, nine: 'front',
    players: Object.values(players).map(p => ({ ...p, tee: 'White' })), settings: structuredClone(SETTINGS), hcPct: 90, halfStrokes: half,
  });
  round.status = 'done';
  round.finishedAt = 5;
  round.sideGames = [{ game: 'skins', settings: { value: 2, carryover: true }, ...(skinsPct ? { hcPct: skinsPct } : {}) }];
  const s = { me: 'me', players, customCourses: { [course.id]: course }, rounds: { r1: round }, settings: SETTINGS, usuals: [] };
  addUsual(s, usualFromRound(s, round, { id: 'u1', now: 1 }));
  return s;
}

// The plan-ahead screen: lay the usual over the settings and make the plan, as NewRound's makePlan does
function planFrom(s, p) {
  const opts = { ...structuredClone(s.settings), ...structuredClone(p.opts) };
  return newPlan({
    id: 'pl1', hostWho: 'me', hostName: 'Trevor', game: p.game, holesCount: p.holesCount, nine: p.nine, date: '2026-10-03', course,
    people: p.invited.map(pid => s.players[pid]), ballot: { games: [], bets: [betOf(p.game, opts)], sides: p.sides }, suggestedBet: betOf(p.game, opts),
    settings: opts, useHc: p.useHc, hcPct: opts.hcPct, usualId: p.usualId, now: 1,
    halfStrokes: !!opts.halfStrokes, sidePcts: Object.fromEntries((p.sideGames || []).filter(sg => sg.hcPct != null).map(sg => [sg.game, sg.hcPct])),
  });
}

test('a usual saves half strokes and the side game’s own %, and sets them up again', () => {
  const s = state();
  const u = s.usuals[0];
  assert.equal(u.halfStrokes, true);
  assert.equal(u.hcPct, 90);
  assert.equal(u.sideGames[0].hcPct, 80);
  const setup = setupFromUsual(s, u);
  assert.equal(setup.halfStrokes, true);
  assert.equal(setup.hcPct, 90);
  assert.equal(setup.sideGames[0].hcPct, 80);
  // The round it came from still matches it
  assert.equal(matchingUsual(s, s.rounds.r1)?.id, 'u1');
});

test('a usual played on full strokes saves no half strokes key, and matches as before', () => {
  const s = state({ half: false, skinsPct: null });
  const u = s.usuals[0];
  assert.equal('halfStrokes' in u, false);
  assert.equal('hcPct' in u.sideGames[0], false);
  assert.equal('halfStrokes' in setupFromUsual(s, u), false);
  // A usual saved before this change (no keys at all) is the same setup as the round it came from
  assert.equal(sameAs(u, { ...u }), true);
  // Half strokes or a side game's own % make it a different setup
  assert.equal(sameAs(u, { ...u, halfStrokes: true }), false);
  assert.equal(sameAs(u, { ...u, sideGames: [{ ...u.sideGames[0], hcPct: 85 }] }), false);
});

test('a plan from a usual carries half strokes and side %s through to the roll call', () => {
  const s = state();
  const p = planFromUsual(s, s.usuals[0]);
  assert.equal(p.opts.halfStrokes, true);
  assert.equal(p.sideGames[0].hcPct, 80);
  const plan = planFrom(s, p);
  assert.equal(plan.halfStrokes, true);
  assert.deepEqual(plan.sidePcts, { skins: 80 });
  // They ride along to the group's phones too
  assert.equal(planMeta(plan).halfStrokes, true);
  const start = planStart(s, plan, ['me', 'dave'], { course });
  assert.equal(start.halfStrokes, true);
  assert.equal(start.hcPct, 90);
  assert.deepEqual(start.sideGames, [{ game: 'skins', settings: { value: 2, carryover: true }, hcPct: 80 }]);
  // The round it starts plays them
  const r = createRound({ id: 'r2', game: start.game, course, holesCount: 18, players: start.players, settings: start.settings, hcPct: start.hcPct, useHandicaps: start.useHandicaps, halfStrokes: start.halfStrokes });
  assert.equal(r.halfStrokes, true);
});

test('half strokes drop when the group votes for a game that can’t use them', () => {
  const s = state();
  const plan = planFrom(s, planFromUsual(s, s.usuals[0]));
  plan.sidePcts = { birdies: 50 };
  const voted = { ...plan, suggested: { ...plan.suggested, game: 'stroke', sides: [] }, answers: { me: { ...plan.answers.me, game: 'stroke', sides: {} } }, ballot: { ...plan.ballot, games: ['nassau', 'stroke'], sides: [] } };
  const start = planStart(s, voted, ['me', 'dave'], { course });
  assert.equal(start.game, 'stroke');
  assert.equal(start.halfStrokes, false);
  assert.deepEqual(start.sideGames, []);
});

test('plans made without them look exactly as before', () => {
  const s = state({ half: false, skinsPct: null });
  const plan = planFrom(s, planFromUsual(s, s.usuals[0]));
  assert.equal('halfStrokes' in plan, false);
  assert.equal('sidePcts' in plan, false);
  const start = planStart(s, plan, ['me', 'dave'], { course });
  assert.equal(start.halfStrokes, false);
  assert.deepEqual(start.sideGames, [{ game: 'skins', settings: { value: 2, carryover: true } }]);
  // Bad %s never reach a plan
  const bad = newPlan({ id: 'x', hostName: 'T', game: 'skins', holesCount: 18, date: '2026-10-03', course, people: [], ballot: { games: [], bets: [2], sides: ['birdies'] }, suggestedBet: 2, settings: SETTINGS, sidePcts: { birdies: 0, skins: 80 }, now: 1 });
  assert.equal('sidePcts' in bad, false);
});
