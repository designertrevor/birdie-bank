// A plan keeps the setup made before it was scheduled (order, teams, tees, handicap edits, the
// starting hole and side bets), and the roll call starts the round exactly as built, dropping only
// what no longer fits, with a line for each drop. Plans without a setup start as they always did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { newPlan, planMeta, planStart } from './plans.js';
import { applySetup, keptLine, rescheduleSetup, roundBets, setupForPlan } from './plan-setup.js';
import { rematchSetup } from './rematch.js';
import { addUsual, planFromUsual, usualFromRound } from './usuals.js';

const holes = Array.from({ length: 18 }, (_, i) => ({ par: i % 6 === 2 ? 3 : 4, hdcp: i + 1 }));
const COURSE = { id: 'c1', name: 'Rancho Park', city: 'LA', custom: true, holes, tees: [{ name: 'Blue', rating: 72, slope: 130 }, { name: 'White', rating: 70, slope: 120 }] };
const OTHER = { id: 'c2', name: 'Griffith', city: 'LA', custom: true, holes, tees: [{ name: 'Gold', rating: 71, slope: 125 }, { name: 'White', rating: 69, slope: 118 }] };
const SETTINGS = { hcPct: 100, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' }, skins: { value: 2, carryover: true }, wolf: { point: 2, loneMultiplier: 2 } };
const PLAYERS = {
  me: { id: 'me', name: 'Trevor Nielsen', index: 8 },
  mike: { id: 'mike', name: 'Mike Jones', index: 14 },
  dave: { id: 'dave', name: 'Dave Smith', index: 20 },
  sam: { id: 'sam', name: 'Sam Lee', index: 4 },
};
const state = (extra = {}) => ({ me: 'me', players: structuredClone(PLAYERS), customCourses: { c1: COURSE, c2: OTHER }, settings: SETTINGS, rounds: {}, ...extra });

// Setup as the Bets step had it: Sam leads off, Dave and Sam against Trevor and Mike, Dave on the
// Blue tees with a handicap edit, starting on 10, and a match between Trevor and Dave
const BET = { id: 'b1', kind: 'match', sides: ['me', 'dave'], stake: 10, shape: '18|front|c1|10' };
const SETUP = {
  game: 'nassau', courseId: 'c1', holesCount: 18, nine: 'front',
  order: ['sam', 'me', 'dave', 'mike'],
  teams: [['sam', 'dave'], ['me', 'mike']],
  tees: { dave: 'Blue', me: 'White', mike: 'White', sam: 'White' },
  hcOverride: { dave: 18 },
  startHole: 10,
  bets: [BET],
};

function plan({ setup = SETUP, game = 'nassau', course = COURSE, holesCount = 18 } = {}) {
  return newPlan({
    id: 'pl1', hostName: 'Trevor Nielsen', game, holesCount, date: '2026-10-10', teeTime: '08:10', course,
    people: [PLAYERS.mike, PLAYERS.dave, PLAYERS.sam], ballot: { games: ['wolf'], bets: [5] }, suggestedBet: 5,
    settings: SETTINGS, useHc: true, hcPct: 100, setup: setup ? setupForPlan(setup) : null, now: 1,
  });
}
const ALL = ['host', 'mike', 'dave', 'sam'];

test('setupForPlan keeps only the people picked, and no setup-screen bookkeeping', () => {
  const s = setupForPlan({ ...SETUP, tees: { ...SETUP.tees, ghost: 'Blue' }, hcOverride: { dave: 18, ghost: 3, mike: 'x' } });
  assert.deepEqual(s.order, ['sam', 'me', 'dave', 'mike']);
  assert.deepEqual(Object.keys(s.tees).sort(), ['dave', 'me', 'mike', 'sam']);
  assert.deepEqual(s.hcOverride, { dave: 18 });
  assert.equal(s.startHole, 10);
  assert.deepEqual(s.bets, [{ id: 'b1', kind: 'match', sides: ['me', 'dave'], stake: 10 }]);
  assert.equal(setupForPlan({ ...SETUP, order: [] }), null);
  assert.equal(setupForPlan({ ...SETUP, game: 'nope' }), null);
  // A game without teams keeps no teams
  assert.equal(setupForPlan({ ...SETUP, game: 'skins' }).teams, undefined);
});

test('the setup stays on the organizer’s phone: it never goes to the group', () => {
  const p = plan();
  assert.ok(p.setup);
  assert.equal('setup' in planMeta(p), false);
});

test('everyone showed: roll call starts it exactly as built', () => {
  const s = planStart(state(), plan(), ALL, { course: COURSE });
  assert.equal(s.problem, null);
  assert.deepEqual(s.players.map(p => p.id), ['sam', 'me', 'dave', 'mike']);
  assert.deepEqual(s.teams, [['sam', 'dave'], ['me', 'mike']]);
  assert.deepEqual(s.players.map(p => p.tee), ['White', 'White', 'Blue', 'White']);
  assert.equal(s.players.find(p => p.id === 'dave').courseHcOverride, 18);
  assert.equal(s.players.find(p => p.id === 'mike').courseHcOverride, undefined);
  assert.equal(s.startHole, 10);
  assert.deepEqual(s.bets.map(b => b.id), ['b1']);
  assert.deepEqual(s.changes, []);
  assert.equal(keptLine(s.kept), 'Set up as you built it: tees, handicap edits, starts on hole 10, sides and 1 side bet.');
});

test('the round from roll call is the same round, and pays the same, as starting it from setup directly', () => {
  const st = state();
  const s = planStart(st, plan(), ALL, { course: COURSE });
  const fromPlan = createRound({ id: 'r', game: s.game, course: COURSE, holesCount: s.holesCount, nine: s.nine, startHole: s.startHole, players: s.players, settings: s.settings, hcPct: s.hcPct, useHandicaps: s.useHandicaps, teams: s.teams });
  fromPlan.bets = roundBets(fromPlan, s.bets);
  // What setup's Create round makes from the same choices
  const order = SETUP.order.map(id => ({ ...PLAYERS[id], tee: SETUP.tees[id], courseHcOverride: SETUP.hcOverride[id] }));
  const direct = createRound({ id: 'r', game: 'nassau', course: COURSE, holesCount: 18, nine: 'front', startHole: 10, players: order, settings: s.settings, hcPct: 100, useHandicaps: true, teams: SETUP.teams });
  direct.bets = roundBets(direct, [BET]);
  for (const r of [fromPlan, direct]) { r.createdAt = 0; }
  assert.deepEqual(fromPlan, direct);
  // Play it out: both pay the same
  const scores = {};
  fromPlan.holes.forEach((h, i) => { scores[h.no] = { sam: 4, me: 4 + (i % 3 === 0 ? 1 : 0), dave: 5, mike: 4 - (i % 4 === 0 ? 1 : 0) }; });
  fromPlan.scores = structuredClone(scores); direct.scores = structuredClone(scores);
  fromPlan.status = direct.status = 'done';
  assert.deepEqual(roundResults(fromPlan), roundResults(direct));
  assert.equal(fromPlan.holes[0].no, 10);
});

test('someone didn’t come: their side bet is off and the teams go on without them, with a line for each', () => {
  const s = planStart(state(), plan(), ['host', 'mike', 'sam'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.deepEqual(s.players.map(p => p.id), ['sam', 'me', 'mike']);
  assert.deepEqual(s.teams, [['sam'], ['me', 'mike']]);
  assert.deepEqual(s.bets, []);
  assert.deepEqual(s.changes, ['Teams as you set them, without Dave.', 'Trevor and Dave’s side bet is off: Dave isn’t here.']);
});

test('a walk-up joins the smaller team, and goes last in a game with an order', () => {
  const st = state({ players: { ...structuredClone(PLAYERS), al: { id: 'al', name: 'Al Green', index: 10 } } });
  const p = plan({ setup: { ...SETUP, teams: [['sam', 'dave'], ['me']], order: ['sam', 'me', 'dave'] } });
  p.answers.al = { name: 'Al', status: 'in', at: 5 };
  const s = planStart(st, p, ['host', 'dave', 'sam', 'al'], { course: COURSE });
  assert.deepEqual(s.teams, [['sam', 'dave'], ['me', 'al']]);
  assert.deepEqual(s.changes, ['Teams as you set them, with Al on the smaller side.']);
  // Wolf keeps the tee order, with the newcomer at the end
  const w = plan({ game: 'wolf', setup: { ...SETUP, game: 'wolf', teams: null, order: ['sam', 'me', 'dave'] } });
  w.answers.al = { name: 'Al', status: 'in', at: 5 };
  const ws = planStart(st, w, ['host', 'dave', 'sam', 'al'], { course: COURSE });
  assert.deepEqual(ws.players.map(x => x.id), ['sam', 'me', 'dave', 'al']);
  assert.ok(ws.kept.includes('the playing order'));
  assert.ok(ws.changes.includes('Al goes last in the order.'));
});

test('a walk-up in place of someone who didn’t come keeps the teams in shape', () => {
  // Vegas needs two teams of two: Al takes the open spot
  const vegas = { ...SETUP, game: 'vegas', teams: [['sam', 'dave'], ['me', 'mike']] };
  const p = plan({ game: 'vegas', setup: vegas });
  const st = state({ players: { ...structuredClone(PLAYERS), al: { id: 'al', name: 'Al Green', index: 10 } } });
  p.answers.al = { name: 'Al', status: 'in', at: 5 };
  const s = planStart(st, p, ['host', 'mike', 'sam', 'al'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.deepEqual(s.teams, [['sam', 'al'], ['me', 'mike']]);
  assert.ok(s.changes.includes('Teams as you set them, without Dave and with Al on the smaller side.'));
});

test('teams that no longer work start fresh, and say why', () => {
  // A scramble whose whole first team stayed home
  const p = plan({ game: 'scramble', setup: { ...SETUP, game: 'scramble', bets: [] } });
  const s = planStart(state(), p, ['host', 'mike'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.deepEqual(s.teams, [['me'], ['mike']]);
  assert.ok(s.changes.includes('Teams start fresh: Sam and Dave aren’t here.'));
});

test('the group picked another team game: its teams start fresh', () => {
  const p = plan();
  p.ballot.games.push('vegas');
  for (const who of ['mike', 'dave', 'sam']) p.answers[who] = { name: who, status: 'in', game: 'vegas', at: 2 };
  p.answers.host.game = 'vegas';
  const s = planStart(state(), p, ALL, { course: COURSE });
  assert.equal(s.game, 'vegas');
  assert.ok(s.changes.includes('Teams start fresh: the group picked Vegas.'));
  // The other things still carry: the order, tees and handicap edits
  assert.deepEqual(s.players.map(x => x.id), ['sam', 'me', 'dave', 'mike']);
  assert.equal(s.players.find(x => x.id === 'dave').courseHcOverride, 18);
});

test('the course changed on the plan: handicap edits and the starting hole drop, tees that aren’t there go to the usual one', () => {
  const p = plan();
  p.course = { id: 'c2', name: 'Griffith', city: 'LA' };
  const s = planStart(state(), p, ALL, { course: OTHER });
  assert.equal(s.problem, null);
  assert.deepEqual(s.players.map(x => [x.id, x.tee]), [['sam', 'White'], ['me', 'White'], ['dave', 'Gold'], ['mike', 'White']]);
  assert.equal(s.players.some(x => x.courseHcOverride != null), false);
  assert.equal(s.startHole, null);
  assert.deepEqual(s.changes, [
    'Dave plays Gold: there’s no Blue tee here.',
    'Handicap edits are off: the course changed.',
    'Starts on hole 1: the course changed.',
  ]);
  // The bet still stands, over every hole
  assert.deepEqual(s.bets.map(b => b.id), ['b1']);
});

test('a bet on some holes goes back to the whole round when the holes changed', () => {
  const bet = { ...BET, holes: [1, 9], strokes: { to: 'dave', count: 2, on: [3, 5] } };
  const p = plan({ setup: { ...SETUP, startHole: null, bets: [bet] } });
  p.holesCount = 9;
  const s = planStart(state(), p, ALL, { course: COURSE });
  assert.equal(s.bets[0].holes, undefined);
  assert.deepEqual(s.bets[0].strokes, { to: 'dave', count: 2 });
  assert.ok(s.changes.includes('Trevor and Dave’s side bet covers every hole now: the holes changed.'));
  // Same holes: kept as made
  const same = planStart(state(), plan({ setup: { ...SETUP, startHole: null, bets: [bet] } }), ALL, { course: COURSE });
  assert.deepEqual(same.bets[0].holes, [1, 9]);
  assert.deepEqual(same.bets[0].strokes.on, [3, 5]);
});

test('a plan made from scratch starts the way it always did', () => {
  const p = plan({ setup: null });
  assert.equal(p.setup, undefined);
  const s = planStart(state(), p, ['sam', 'host', 'dave', 'mike'], { course: COURSE });
  // The plan's order, the course's usual tee, fresh teams, no edits, hole 1
  assert.deepEqual(s.players.map(x => x.id), ['me', 'mike', 'dave', 'sam']);
  assert.deepEqual(s.players.map(x => x.tee), ['Blue', 'Blue', 'Blue', 'Blue']);
  assert.deepEqual(s.teams, [['me', 'mike'], ['dave', 'sam']]);
  assert.equal(s.startHole, null);
  assert.deepEqual(s.bets, []);
  assert.deepEqual(s.kept, []);
  assert.deepEqual(s.changes, []);
});

test('applySetup with no setup is the old roll call', () => {
  const players = [PLAYERS.me, PLAYERS.mike];
  const out = applySetup(null, { game: 'skins', course: COURSE, holesCount: 18, players, fresh: () => null });
  assert.deepEqual(out.players, players.map(p => ({ ...p, tee: 'Blue' })));
  assert.equal(out.teams, null);
});

test('a scramble side bet between two people now on the same team is off', () => {
  const setup = { ...SETUP, game: 'scramble', teams: [['sam', 'dave'], ['me', 'mike']], bets: [{ id: 'b2', kind: 'match', sides: ['me', 'sam'], stake: 5 }] };
  const p = plan({ game: 'scramble', setup });
  const s = planStart(state(), p, ['host', 'dave', 'sam'], { course: COURSE });
  // Without Mike the teams keep as set, so Trevor and Sam are still on different teams and the bet stands
  assert.deepEqual(s.teams, [['sam', 'dave'], ['me']]);
  assert.deepEqual(s.bets.map(b => b.id), ['b2']);
  const together = applySetup(setupForPlan({ ...setup, teams: [['sam', 'me'], ['dave', 'mike']] }), {
    game: 'scramble', course: COURSE, holesCount: 18, players: [PLAYERS.sam, PLAYERS.me, PLAYERS.dave, PLAYERS.mike].map(x => ({ ...x })),
  });
  assert.deepEqual(together.bets, []);
  assert.ok(together.changes.includes('Trevor and Sam’s side bet is off: they’re on the same team now.'));
});

test('a round set up but not played keeps its starting hole and side bets when it becomes a plan; Run it back doesn’t', () => {
  const st = state();
  const round = createRound({
    id: 'r1', game: 'nassau', course: COURSE, holesCount: 18, nine: 'front', startHole: 10,
    players: SETUP.order.map(id => ({ ...PLAYERS[id], tee: SETUP.tees[id], courseHcOverride: SETUP.hcOverride[id] })),
    settings: SETTINGS, hcPct: 90, useHandicaps: true, teams: SETUP.teams,
  });
  round.bets = roundBets(round, [BET]);
  const r = rescheduleSetup(st, round);
  assert.equal(r.startHole, 10);
  assert.deepEqual(r.pairBets.map(b => b.id), ['b1']);
  assert.deepEqual(r.picked, ['sam', 'me', 'dave', 'mike']);
  assert.deepEqual(r.hcOverride, { dave: 18 });
  assert.equal(r.step, 1);
  const again = rematchSetup(st, round);
  assert.equal('startHole' in again, false);
  assert.equal('pairBets' in again, false);
  // Starting on the first hole is no starting hole at all
  const plain = createRound({ id: 'r2', game: 'nassau', course: COURSE, holesCount: 18, nine: 'front', startHole: null, players: round.players, settings: SETTINGS, hcPct: 90, teams: SETUP.teams });
  assert.equal(rescheduleSetup(st, plain).startHole, null);
});

test('a usual planned ahead carries its order, teams, tees and handicap edits', () => {
  const st = state();
  const round = createRound({
    id: 'r1', game: 'nassau', course: COURSE, holesCount: 18, nine: 'front',
    players: SETUP.order.map(id => ({ ...PLAYERS[id], tee: SETUP.tees[id], courseHcOverride: SETUP.hcOverride[id] })),
    settings: SETTINGS, hcPct: 100, useHandicaps: true, teams: SETUP.teams,
  });
  round.status = 'done';
  st.usuals = [];
  addUsual(st, usualFromRound(st, round, { id: 'u1', now: 1 }));
  const p = planFromUsual(st, st.usuals[0]);
  assert.deepEqual(p.order, ['sam', 'me', 'dave', 'mike']);
  assert.deepEqual(p.teams, [['sam', 'dave'], ['me', 'mike']]);
  assert.equal(p.tees.dave, 'Blue');
  assert.deepEqual(p.hcOverride, { dave: 18 });
  // And the roll call starts it that way
  const pl = plan({ setup: { game: p.game, courseId: p.courseId, holesCount: p.holesCount, nine: p.nine, order: p.order, teams: p.teams, tees: p.tees, hcOverride: p.hcOverride } });
  const s = planStart(st, pl, ALL, { course: COURSE });
  assert.deepEqual(s.players.map(x => x.id), ['sam', 'me', 'dave', 'mike']);
  assert.deepEqual(s.teams, [['sam', 'dave'], ['me', 'mike']]);
  assert.deepEqual(s.changes, []);
});
