// Trip Mode (2026-10-04): Ryder Cup templates and their schedule (trip-templates.js), what a match
// is worth (cup.js), handicap flights and the flighted net leaderboard (flights.js), and the live
// captains' draft's order and picks (draft.js). Old trips and rounds stay exactly as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// trips.js first: cup.js and trips.js import each other, and the trip formats need the cup's loaded
import { newTrip, tripChips, tripStamp } from './trips.js';
import { createRound, roundResults } from './round.js';
import { cleanCup, cleanEntry, cleanRoundCup, closeEntry, cupEntries, cupEntry, cupLeaderboard, cupPosts, cupScore, roundCupResults } from './cup.js';
import {
  TEMPLATE_SIZES, addDay, addSession, cleanSchedule, partnersFor, planCupFor, plansByDay, removeSession, ryderTemplate, scheduleProblem,
  schedulePoints, scheduleRounds, scheduledPlan, sessionLabel, sessionMatches, setSession,
} from './trip-templates.js';
import { planStart, rollCallDefault } from './plans.js';
import { cleanFlights, flightBoard, flightCount, flightTeams, flightsOf } from './flights.js';
import { DRAFT_KEY, captainKey, cleanDraft, draftLink, draftOrder, draftTeams, isDraftKey, mergeDraft, newDraft, pickFor, pickHere, undoFor } from './draft.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const ids = n => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const teamsOf = n => [ids(n).filter((_, i) => i % 2 === 0), ids(n).filter((_, i) => i % 2 === 1)];
const pairKey = (a, b) => [a, b].sort().join('+');

// ---------------------------------------------------------------------------
// Templates

test('each Ryder Cup template: its days, sessions and points, everyone playing every session', () => {
  assert.deepEqual(TEMPLATE_SIZES, [8, 12, 16, 24]);
  const want = { 8: { days: 2, total: 8, toWin: 4.5 }, 12: { days: 3, total: 12, toWin: 6.5 }, 16: { days: 3, total: 24, toWin: 12.5 }, 24: { days: 3, total: 36, toWin: 18.5 } };
  for (const size of TEMPLATE_SIZES) {
    const t = ryderTemplate(size);
    assert.equal(t.size, size);
    assert.equal(t.days.length, want[size].days, `${size}: days`);
    const pts = schedulePoints(t, size / 2);
    assert.equal(pts.total, want[size].total, `${size}: points`);
    assert.equal(pts.toWin, want[size].toWin, `${size}: to win`);
    // The last day is singles, and every match starts at 1 point with the WHS allowance
    assert.deepEqual(t.days.at(-1).sessions.map(s => s.kind), ['singles']);
    for (const d of t.days) for (const s of d.sessions) { assert.equal(s.worth, 1); assert.equal(s.pct, s.kind === 'fourball' ? 90 : 100); }
  }
  assert.equal(ryderTemplate(7).size, 8, 'an unknown size starts from the 8');
});

test('a schedule is edited a session at a time, and always keeps one', () => {
  let t = ryderTemplate(8);
  t = setSession(t, 1, 0, { worth: 2 });
  assert.equal(t.days[1].sessions[0].worth, 2);
  assert.equal(schedulePoints(t, 4).total, 12, 'singles at 2 a match: 2 + 2 + 4 x 2');
  t = setSession(t, 0, 1, { kind: 'singles' });
  assert.equal(t.days[0].sessions[1].pct, 100, 'a new kind starts at its own allowance');
  t = setSession(t, 0, 0, { pct: 85 });
  assert.equal(t.days[0].sessions[0].pct, 85);
  t = addSession(t, 1);
  assert.equal(t.days[1].sessions[1].kind, 'fourball', 'a day with singles adds four-ball');
  assert.equal(addSession(t, 1).days[1].sessions.length, 2, 'two sessions a day at most');
  t = addDay(t);
  assert.equal(t.days.length, 3);
  t = removeSession(t, 2, 0);
  assert.equal(t.days.length, 2, 'a day with no session goes');
  const one = { size: 8, days: [{ course: null, sessions: [{ kind: 'singles', worth: 1, pct: 100 }] }] };
  assert.equal(removeSession(one, 0, 0), one, 'the last session stays');
  assert.equal(sessionLabel('fourball', 0, 1), 'Four-ball');
  assert.equal(sessionLabel('foursomes', 1, 2), 'Afternoon foursomes');
  assert.equal(sessionMatches('fourball', 6), 3);
  assert.equal(sessionMatches('singles', 6), 6);
});

test('a schedule is tidied, and a cup without one stays exactly as it was', () => {
  const c = cleanSchedule({ size: 12, days: [{ course: { id: 'c1', name: 'Dunes' }, sessions: [{ kind: 'fourball', worth: 9, pct: 30 }, { kind: 'nope' }, { kind: 'singles', worth: 2, pct: 95 }, { kind: 'foursomes' }] }, { sessions: [] }] });
  assert.deepEqual(c, { size: 12, days: [{ course: { id: 'c1', name: 'Dunes' }, sessions: [{ kind: 'fourball', worth: 1, pct: 100 }, { kind: 'singles', worth: 2, pct: 95 }] }] });
  assert.equal(cleanSchedule({ days: [] }), null);
  assert.equal(cleanSchedule('junk'), null);
  const old = cleanCup({ names: ['Blue', 'Red'], teams: [[{ id: 'a', name: 'Al' }], [{ id: 'b', name: 'Bo' }]], stake: 10, pick: 'draft' });
  assert.deepEqual(Object.keys(old), ['names', 'teams', 'captains', 'stake', 'pick'], 'no schedule or draft keys on an old cup');
  const withIt = cleanCup({ ...old, schedule: ryderTemplate(8), draft: { live: true, order: 'turns', first: 1 } });
  assert.equal(withIt.schedule.days.length, 2);
  assert.deepEqual(withIt.draft, { live: true, order: 'turns', first: 1 });
  assert.equal(cleanCup({ pick: 'flights' }).pick, 'flights');
});

test('partners rotate so everyone partners everyone once over the team size less one', () => {
  const team = ['a', 'b', 'c', 'd', 'e', 'f'];
  const seen = new Set();
  for (let r = 0; r < team.length - 1; r++) {
    const pairs = partnersFor(team, r);
    assert.equal(pairs.length, 3);
    assert.deepEqual(pairs.flat().sort(), team, 'everyone plays each session');
    for (const [a, b] of pairs) {
      assert.ok(!seen.has(pairKey(a, b)), `${a} and ${b} partner once`);
      seen.add(pairKey(a, b));
    }
  }
  assert.equal(seen.size, 15, 'all 15 pairs of six');
  assert.deepEqual(partnersFor(['a'], 0), []);
});

test('the 8 template’s rounds: one a match in four-ball and foursomes, two singles a group, everyone once a session', () => {
  const teams = teamsOf(8);
  const t = ryderTemplate(8);
  t.days[0].course = { id: 'c1', name: 'Dunes' };
  const rounds = scheduleRounds(t, teams, { start: '2026-10-16' });
  // Day 1: 2 four-ball + 2 foursomes rounds; day 2: 2 singles rounds of two matches
  assert.equal(rounds.length, 6);
  const bySession = new Map();
  for (const r of rounds) bySession.set(`${r.day}.${r.session}`, [...(bySession.get(`${r.day}.${r.session}`) || []), r]);
  for (const [, list] of bySession) {
    const everyone = list.flatMap(r => r.players).sort();
    assert.deepEqual(everyone, ids(8).sort(), 'all eight play each session, once');
  }
  const [fb1, fb2, fs1, , s1] = rounds;
  assert.equal(fb1.date, '2026-10-16');
  assert.equal(s1.date, '2026-10-17');
  assert.equal(fb1.course.name, 'Dunes');
  assert.equal(s1.course, null);
  assert.equal(fb1.game, 'bestball');
  assert.equal(fs1.game, 'altshot');
  assert.equal(s1.game, 'skins');
  assert.equal(fb1.label, 'Morning four-ball');
  assert.equal(fs1.label, 'Afternoon foursomes');
  assert.equal(s1.label, 'Singles');
  // Tee times: the session's first group, then 10 minutes apart
  assert.deepEqual([fb1.teeTime, fb2.teeTime, fs1.teeTime, s1.teeTime], ['08:00', '08:10', '13:00', '08:00']);
  // A four-ball round is one match between a pair from each team; its game's teams are those pairs
  assert.equal(fb1.cup.kind, 'fourball');
  assert.ok(fb1.cup.sides[0].every(id => teams[0].includes(id)) && fb1.cup.sides[1].every(id => teams[1].includes(id)));
  assert.deepEqual(fb1.teams, fb1.cup.sides);
  // Partners change from the morning to the afternoon
  const am = new Set(rounds.filter(r => r.day === 1 && r.session === 1).flatMap(r => r.cup.sides.map(s => pairKey(...s))));
  const pm = rounds.filter(r => r.day === 1 && r.session === 2).flatMap(r => r.cup.sides.map(s => pairKey(...s)));
  assert.ok(pm.every(k => !am.has(k)), 'new partners in the afternoon');
  // Singles: two matches a round, first with first
  assert.equal(s1.cup.kind, 'singles');
  assert.equal(s1.teams, null);
  assert.deepEqual(s1.cup.sides, [[teams[0][0], teams[0][1]], [teams[1][0], teams[1][1]]]);
  assert.equal(s1.cup.worth, undefined, 'a match worth 1 carries no worth');
});

test('every template schedules cleanly, and singles opponents change from one singles day to the next', () => {
  for (const size of TEMPLATE_SIZES) {
    const rounds = scheduleRounds(ryderTemplate(size), teamsOf(size), { start: '2026-10-16' });
    const matches = rounds.reduce((a, r) => a + (r.cup.kind === 'singles' ? r.cup.sides[0].length : 1), 0);
    assert.equal(matches, schedulePoints(ryderTemplate(size), size / 2).matches, `${size}: every match planned`);
    assert.ok(rounds.every(r => r.players.length === 4), `${size}: groups of four`);
  }
  const two = { size: 8, days: [{ course: null, sessions: [{ kind: 'singles', worth: 2, pct: 100 }] }, { course: null, sessions: [{ kind: 'singles', worth: 1, pct: 100 }] }] };
  const rounds = scheduleRounds(two, teamsOf(8), { start: '2026-10-16' });
  const opp = day => rounds.filter(r => r.day === day).flatMap(r => r.cup.sides[0].map((a, i) => pairKey(a, r.cup.sides[1][i])));
  assert.ok(opp(2).every(k => !opp(1).includes(k)), 'a new opponent on the second singles day');
  assert.equal(rounds[0].cup.worth, 2, 'what the session’s matches are worth rides on each round');
});

test('teams that can’t be scheduled say why', () => {
  const t = ryderTemplate(8);
  assert.match(scheduleProblem(t, [[], ['a']]), /Each team needs players/);
  assert.match(scheduleProblem(t, [['a', 'b'], ['c']]), /2 and 1/);
  assert.match(scheduleProblem(t, [['a', 'b', 'c'], ['d', 'e', 'f']]), /even number a side/);
  const singles = { size: 6, days: [{ course: null, sessions: [{ kind: 'singles', worth: 1, pct: 100 }] }] };
  assert.equal(scheduleProblem(singles, [['a', 'b', 'c'], ['d', 'e', 'f']]), null, 'singles only takes an odd number');
  const r = scheduleRounds(singles, [['a', 'b', 'c'], ['d', 'e', 'f']], { start: '2026-10-16' });
  assert.deepEqual(r.map(x => x.players.length), [4, 2], 'the odd match is a group of two');
  assert.deepEqual(scheduleRounds(t, [['a'], []], { start: '2026-10-16' }), []);
});

// ---------------------------------------------------------------------------
// The planned rounds

const PLAYERS = Object.fromEntries(['me', ...ids(7)].map((id, i) => [id, { id, name: id === 'me' ? 'Trevor Nielsen' : `Player${i}`, index: i * 3 }]));
const SETTINGS = { hcPct: 100, bestball: { format: 'nassau', front: 5, back: 5, total: 5 }, altshot: { format: 'nassau', front: 5, back: 5, total: 5 }, skins: { value: 2, carryover: true } };
const T8 = [['me', 'p2', 'p4', 'p6'], ['p1', 'p3', 'p5', 'p7']];
const TRIP8 = newTrip({ id: 't_rc', name: 'Ryder weekend', start: '2026-10-16', end: '2026-10-17', by: 'me', format: 'cup', cup: { names: ['Blue', 'Red'], teams: T8.map(t => t.map(id => ({ id, name: PLAYERS[id].name }))), schedule: ryderTemplate(8) }, now: OCT(1) });

test('each scheduled round is a plan with its group marked in, its matches and its allowance', () => {
  const rounds = scheduleRounds(TRIP8.cup.schedule, T8, { start: TRIP8.start });
  const mine = rounds.find(r => r.players.includes('me'));
  const other = rounds.find(r => !r.players.includes('me'));
  const plan = scheduledPlan(mine, { id: 'pl1', tripId: 't_rc', me: 'me', players: PLAYERS, settings: SETTINGS, stamp: tripStamp(TRIP8), now: OCT(2) });
  assert.equal(plan.game, 'bestball');
  assert.equal(plan.date, '2026-10-16');
  assert.equal(plan.teeTime, mine.teeTime);
  assert.equal(plan.hcPct, 90, 'four-ball at 90%, agreed before anyone leaves');
  assert.equal(plan.suggested.bet, 5, 'the organizer’s usual bet for the game');
  assert.equal(plan.trip.id, 't_rc');
  assert.deepEqual(plan.cup, mine.cup);
  assert.equal(plan.session.label, 'Morning four-ball');
  assert.deepEqual(plan.setup.teams, mine.teams);
  // The roll call starts with the group, the organizer in it
  const present = rollCallDefault(plan);
  assert.equal(present.length, 4);
  const state = { me: 'me', players: PLAYERS, settings: SETTINGS, rounds: {}, links: {}, customCourses: {} };
  const start = planStart(state, plan, present, { course: flat9 });
  assert.equal(start.problem, null);
  assert.deepEqual(start.players.map(p => p.id).sort(), [...mine.players].sort());
  assert.deepEqual(start.teams.map(t => [...t].sort()), mine.teams.map(t => [...t].sort()));
  assert.equal(start.hcPct, 90);
  // A group the organizer isn't in: they're out, and the four are in
  const theirs = scheduledPlan(other, { id: 'pl2', tripId: 't_rc', me: 'me', players: PLAYERS, settings: SETTINGS, stamp: tripStamp(TRIP8), now: OCT(2) });
  assert.equal(theirs.answers.host.status, 'out');
  assert.deepEqual(rollCallDefault(theirs).sort(), [...other.players].sort());
});

test('a planned round’s matches start the round while they fit, else the teams decide', () => {
  const plan = { cup: { kind: 'singles', sides: [['a', 'b'], ['c', 'd']], worth: 2 } };
  const four = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  assert.deepEqual(planCupFor(plan, four), { kind: 'singles', sides: [['a', 'b'], ['c', 'd']], worth: 2 });
  assert.equal(planCupFor(plan, four.slice(0, 3)), null, 'someone didn’t come');
  assert.equal(planCupFor(plan, [...four, { id: 'e' }]), null, 'someone else is in the round');
  assert.equal(planCupFor({}, four), null);
  assert.equal(planCupFor({ cup: { kind: 'singles', sides: [['a', 'a'], ['c', 'd']] } }, four), null);
});

test('the trip’s planned rounds group by day and session, groups in order', () => {
  const p = (id, date, session) => ({ id, date, teeTime: '08:00', ...(session ? { session } : {}) });
  const days = plansByDay([
    p('x3', '2026-10-17', { day: 2, session: 1, label: 'Singles', kind: 'singles', worth: 2, group: 2 }),
    p('x1', '2026-10-16', { day: 1, session: 1, label: 'Four-ball', kind: 'fourball', worth: 1, group: 1 }),
    p('x2', '2026-10-17', { day: 2, session: 1, label: 'Singles', kind: 'singles', worth: 2, group: 1 }),
    p('own', '2026-10-17'),
  ]);
  assert.deepEqual(days.map(d => d.date), ['2026-10-16', '2026-10-17']);
  assert.deepEqual(days[1].sessions.map(s => s.plans.map(x => x.id)), [['x2', 'x3'], ['own']]);
  assert.equal(days[1].sessions[0].worth, 2);
  assert.equal(days[1].sessions[1].label, null, 'a round planned by hand is its own');
});

// ---------------------------------------------------------------------------
// What a match is worth

const NAMES = { a: 'Al', b: 'Bo', c: 'Cy', d: 'Di' };
const CUPTRIP = newTrip({ id: 't_w', name: 'Worth', start: '2026-10-16', end: '2026-10-18', by: 'a', format: 'cup', cup: { names: ['Blue', 'Red'], teams: [[{ id: 'a', name: 'Al' }, { id: 'b', name: 'Bo' }], [{ id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }]] }, now: OCT(1) });
function played(id, cup, { status = 'done', upto = 9 } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ['a', 'b', 'c', 'd'].map(x => ({ id: x, name: NAMES[x], index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  // Al birdies 1 and 2, Cy birdies 3: Al beats Cy 1 up, Bo and Di halve; everyone else 4
  for (const h of r.holes) if (h.no <= upto) r.scores[h.no] = { a: h.no <= 2 ? 3 : 4, b: 4, c: h.no === 3 ? 3 : 4, d: 4 };
  r.createdAt = OCT(16, 8);
  r.status = status;
  if (status === 'done') r.finishedAt = OCT(16);
  r.trip = tripStamp(CUPTRIP);
  r.cup = cup;
  return r;
}

test('a round without a worth scores and pays exactly as before; a round worth 2 doubles its points, not its money', () => {
  const plain = played('r1', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']] });
  const double = played('r1', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']], worth: 2 });
  assert.equal(cleanRoundCup(plain).worth, undefined);
  assert.equal(cleanRoundCup(double).worth, 2);
  assert.deepEqual(roundCupResults(plain).matches.map(m => m.result.points), [[1, 0], [0.5, 0.5]]);
  assert.deepEqual(roundCupResults(double).matches.map(m => m.result.points), [[2, 0], [1, 1]]);
  // The entry an old round posts is exactly what it posted before (no worth key)
  assert.equal('worth' in cupEntry({}, plain), false);
  assert.equal(cupEntry({}, double).worth, 2);
  // The round's own money doesn't move
  assert.deepEqual(roundResults(double).balances, roundResults(plain).balances);
  const s = r => ({ me: 'a', players: {}, rounds: { r1: r }, trips: { t_w: CUPTRIP }, plans: {}, cupRemote: {} });
  assert.deepEqual(cupScore(cupEntries(s(plain), 't_w')).points, [1.5, 0.5]);
  assert.deepEqual(cupScore(cupEntries(s(double), 't_w')).points, [3, 1]);
  const board = cupLeaderboard(s(double), cupEntries(s(double), 't_w'));
  assert.equal(board.find(r => r.id === 'a').points, 2);
  assert.equal(board.find(r => r.id === 'a').won, 1);
});

test('another group’s round from the server keeps its worth, and so does one closed when the trip ends', () => {
  const live = cupEntry({}, played('r2', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']], worth: 2 }, { status: 'active', upto: 4 }));
  const fromServer = cleanEntry({ ...live, key: 'ABCDEF' });
  assert.equal(fromServer.worth, 2);
  const closed = closeEntry(fromServer);
  assert.deepEqual(closed.matches.map(m => m.result.points), [[2, 0], [1, 1]]);
  const done = cleanEntry({ ...cupEntry({}, played('r3', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']], worth: 3 })), key: 'Lr3' });
  assert.deepEqual(done.matches.map(m => m.result.points), [[3, 0], [1.5, 1.5]]);
  const junk = cleanEntry({ ...live, key: 'ABCDEF', worth: 7 });
  assert.equal(junk.worth, undefined, 'a worth that isn’t 1, 2 or 3 is 1');
});

test('each player’s net to par rides in a round’s entry, for the flights on other phones', () => {
  const e = cupEntry({}, played('r1', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']] }));
  assert.deepEqual(e.players.map(p => [p.id, p.net, p.played]), [['a', -2, 9], ['b', 0, 9], ['c', -1, 9], ['d', 0, 9]]);
  const back = cleanEntry({ ...e, key: 'Lr1' });
  assert.equal(back.players[0].net, -2);
  assert.equal(cleanEntry({ ...e, key: 'Lr1', players: [{ id: 'a', name: 'Al', net: 'x', played: 9 }] }).players[0].net, undefined);
});

// ---------------------------------------------------------------------------
// Flights

const people = n => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, name: `H${i}`, index: (n - i) * 2 }));

test('flights: four when they split evenly between two teams, else fewer that do', () => {
  assert.equal(flightCount(8), 4);
  assert.equal(flightCount(16), 4);
  assert.equal(flightCount(24), 4);
  assert.equal(flightCount(12), 3, 'three flights of four');
  assert.equal(flightCount(4), 2);
  assert.equal(flightCount(10), 4, 'as even as ten goes');
  assert.equal(flightCount(2), 1);
  const f = flightsOf(people(10));
  assert.deepEqual(f.map(x => x.length), [3, 3, 2, 2]);
  // Best index first: the lowest handicaps in A
  assert.deepEqual(f[0].map(p => p.index), [2, 4, 6]);
  const none = flightsOf([{ id: 'x', name: 'X', index: null }, { id: 'y', name: 'Y', index: 30 }, { id: 'z', name: 'Z', index: 1 }, { id: 'w', name: 'W', index: 5 }]);
  assert.deepEqual(none.map(fl => fl.map(p => p.id)), [['z', 'w'], ['y', 'x']], 'no handicap sorts last');
});

test('teams by flights get an even share of every flight', () => {
  for (const n of [8, 12, 16, 24, 10]) {
    const all = people(n);
    const teams = flightTeams(all);
    assert.ok(Math.abs(teams[0].length - teams[1].length) <= 1, `${n}: team sizes`);
    for (const fl of flightsOf(all)) {
      const on = teams.map(t => t.filter(p => fl.some(x => x.id === p.id)).length);
      assert.ok(Math.abs(on[0] - on[1]) <= 1, `${n}: flight split ${on}`);
    }
  }
  // Eight players: one A, one B, one C and one D a side, the better A on Blue and the better B on Red
  const t8 = flightTeams(people(8));
  assert.deepEqual(t8.map(t => t.map(p => p.id)), [['h7', 'h4', 'h3', 'h0'], ['h6', 'h5', 'h2', 'h1']]);
});

test('flights are tidied, and a trip without them carries none', () => {
  assert.equal(cleanFlights(null), null);
  assert.deepEqual(cleanFlights([[{ id: 'a', name: 'Al' }, { id: 'a' }], [], [{ id: 'b' }]]), [[{ id: 'a', name: 'Al' }], [{ id: 'b', name: 'Player' }]]);
  const plain = newTrip({ id: 't1', name: 'Plain', start: '2026-10-16', end: '2026-10-17', by: 'a', now: OCT(1) });
  assert.equal('flights' in plain, false);
  assert.equal('flights' in tripStamp(plain), false);
  const fl = newTrip({ id: 't1', name: 'Flighted', start: '2026-10-16', end: '2026-10-17', by: 'a', flights: [[{ id: 'a', name: 'Al' }]], now: OCT(1) });
  assert.deepEqual(tripStamp(fl).flights, [[{ id: 'a', name: 'Al' }]]);
});

test('the flighted net leaderboard: each flight on its own, from this phone’s rounds and other groups’', () => {
  const trip = newTrip({ id: 't_w', name: 'Worth', start: '2026-10-16', end: '2026-10-18', by: 'a', format: 'cup', cup: CUPTRIP.cup, flights: [[{ id: 'a', name: 'Al' }, { id: 'c', name: 'Cy' }], [{ id: 'b', name: 'Bo' }, { id: 'd', name: 'Di' }, { id: 'e', name: 'Ed' }]], now: OCT(1) });
  const r1 = played('r1', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']] });
  r1.trip = tripStamp(trip);
  // Another group's round, from the server: Ed (on this phone by name only) went 3 under, Bo's other id even
  const remote = { ZZZZZZ: { status: 'done', at: OCT(17), players: [{ id: 'x1', name: 'Ed', net: -3, played: 9 }, { id: 'x2', name: 'Cy', net: 1, played: 9 }], matches: [] }, [DRAFT_KEY]: { draft: 1 } };
  const state = { me: 'a', players: {}, rounds: { r1 }, trips: { t_w: trip }, plans: {}, cupRemote: { t_w: remote } };
  const board = flightBoard(state, trip);
  assert.deepEqual(board.map(f => f.flight), ['A', 'B']);
  // A: Cy played twice (-1 here, +1 there): ahead of nobody with more rounds, so first; Al once at -2
  assert.deepEqual(board[0].rows.map(r => [r.name, r.net, r.rounds]), [['Cy', 0, 2], ['Al', -2, 1]]);
  assert.deepEqual(board[1].rows.map(r => [r.name, r.net, r.rounds]), [['Ed', -3, 1], ['Bo', 0, 1], ['Di', 0, 1]]);
  // A round being played doesn't count yet, and a trip without flights has no board
  const live = played('r9', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']] }, { status: 'active', upto: 3 });
  live.trip = tripStamp(trip);
  assert.equal(flightBoard({ ...state, rounds: { r1, r9: live } }, trip)[0].rows.find(r => r.name === 'Al').rounds, 1);
  assert.deepEqual(flightBoard(state, CUPTRIP), []);
});

// ---------------------------------------------------------------------------
// The live captains' draft

test('the draft order: snake by default, or taking turns, from whoever picks first', () => {
  assert.deepEqual(draftOrder(6), [0, 1, 1, 0, 0, 1]);
  assert.deepEqual(draftOrder(6, { first: 1 }), [1, 0, 0, 1, 1, 0]);
  assert.deepEqual(draftOrder(5, { order: 'turns' }), [0, 1, 0, 1, 0]);
  assert.deepEqual(draftOrder(4, { order: 'turns', first: 1 }), [1, 0, 1, 0]);
  assert.deepEqual(draftOrder(0), []);
});

const POOL = ['cap0', 'cap1', 'a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, name: id.toUpperCase(), index: i }));
const DEV0 = '0123456789abcdef0123ffff', DEV1 = 'fedcba9876543210fedcaaaa';
const draft = (extra = {}) => newDraft({ pool: POOL, captains: ['cap0', 'cap1'], names: ['Blue', 'Red'], now: OCT(1), ...extra });
const row = (seat, picks, { v = 1, at = OCT(1, 13) } = {}) => ({ draft: 1, seat, v, picks, at });

test('two captains’ phones make one draft, the same on every phone', () => {
  const d = draft();
  assert.equal(captainKey(DEV0), 'Ldraft-0123456789abcdef0123');
  assert.ok(isDraftKey(DRAFT_KEY) && isDraftKey(captainKey(DEV1)) && !isDraftKey('Lr_123'));
  let rows = { [captainKey(DEV0)]: row(0, []), [captainKey(DEV1)]: row(1, []) };
  let m = mergeDraft(d, rows);
  assert.equal(m.turn, 0);
  assert.deepEqual(m.teams, [['cap0'], ['cap1']]);
  assert.equal(m.left.length, 6);
  // Blue picks a; then Red's turn, twice (snake)
  assert.deepEqual(pickFor(d, rows, 0, 'a'), ['a']);
  assert.equal(pickFor(d, rows, 1, 'b'), null, 'not Red’s turn yet');
  rows = { ...rows, [captainKey(DEV0)]: row(0, ['a']) };
  assert.equal(mergeDraft(d, rows).turn, 1);
  assert.equal(pickFor(d, rows, 1, 'a'), null, 'a is taken');
  rows = { ...rows, [captainKey(DEV1)]: row(1, ['b', 'c']) };
  m = mergeDraft(d, rows);
  assert.equal(m.turn, 0);
  assert.deepEqual(m.picks, [{ seat: 0, id: 'a' }, { seat: 1, id: 'b' }, { seat: 1, id: 'c' }]);
  rows = { ...rows, [captainKey(DEV0)]: row(0, ['a', 'd', 'e']), [captainKey(DEV1)]: row(1, ['b', 'c', 'f']) };
  m = mergeDraft(d, rows);
  assert.equal(m.done, true);
  assert.equal(m.turn, null);
  assert.deepEqual(m.teams, [['cap0', 'a', 'd', 'e'], ['cap1', 'b', 'c', 'f']]);
  assert.deepEqual(draftTeams(d, m)[1].map(p => p.name), ['CAP1', 'B', 'C', 'F']);
});

test('a pick that’s gone is skipped, an old draft’s picks don’t count, and the first phone on a link picks', () => {
  const d = draft({ v: 2 });
  const rows = {
    [captainKey(DEV0)]: row(0, ['a', 'b'], { v: 2 }),
    // Red's phone picked a too (it hadn't seen Blue's), then b: both gone, so Red is still to pick
    [captainKey(DEV1)]: row(1, ['a', 'zz'], { v: 2 }),
    // An old version's row, and a second phone on Blue's link that came later, never count
    'Ldraft-aaaaaaaaaaaaaaaaaaaa': row(1, ['c'], { v: 1, at: OCT(1, 9) }),
    'Ldraft-bbbbbbbbbbbbbbbbbbbb': row(0, ['f'], { v: 2, at: OCT(1, 14) }),
  };
  const m = mergeDraft(d, rows);
  assert.deepEqual(m.picks, [{ seat: 0, id: 'a' }]);
  assert.equal(m.turn, 1);
  assert.equal(cleanDraft({ draft: 1, pool: POOL, captains: ['cap0', 'cap0'] }), null, 'two different captains');
  assert.equal(cleanDraft({ draft: 1, pool: POOL, captains: ['cap0', 'nobody'] }), null);
});

test('a captain takes back a pick while it’s the last one, and the organizer’s phone can take over a captain', () => {
  const d = draft();
  let rows = { [captainKey(DEV0)]: row(0, ['a']), [captainKey(DEV1)]: row(1, ['b']) };
  assert.deepEqual(undoFor(d, rows, 1), [], 'Red’s pick was the last');
  assert.equal(undoFor(d, rows, 0), null, 'Blue’s pick has been answered');
  // Blue's phone lost signal: the organizer picks for Blue from here, keeping Blue's pick
  const here = pickHere(d, rows, 0);
  assert.deepEqual(here.here, [true, false]);
  assert.deepEqual(here.picks[0], ['a']);
  rows = { ...rows, [captainKey(DEV1)]: row(1, ['b', 'c']) };
  assert.deepEqual(mergeDraft(here, rows).turn, 0);
  assert.deepEqual(pickFor(here, rows, 0, 'd'), ['a', 'd']);
  assert.equal(draftLink('https://x.app', 't_abc', 1), 'https://x.app/?draft=t_abc&c=1');
});

test('a draft’s rows on the trip table are never a round’s matches, and never get taken back', () => {
  const r = played('r1', { kind: 'singles', sides: [['a', 'b'], ['c', 'd']] });
  const remote = { [DRAFT_KEY]: draftRowLike(), [captainKey(DEV1)]: row(1, ['b']) };
  const s = { me: 'a', players: {}, rounds: { r1: r }, trips: { t_w: CUPTRIP }, plans: {}, cupRemote: { t_w: remote } };
  assert.deepEqual(cupEntries(s, 't_w').map(e => e.key), ['Lr1']);
  const posts = cupPosts(s, CUPTRIP, remote, 'P0123456789abcdef0123');
  assert.ok(posts.every(p => !isDraftKey(p.key)), 'nothing posted over a draft row');
});
function draftRowLike() {
  return { draft: 1, v: 1, pool: POOL, captains: ['cap0', 'cap1'], names: ['Blue', 'Red'], order: 'snake', first: 0, here: [false, false], picks: [[], []], at: OCT(1) };
}

test('the trip’s days show one chip a scheduled session, whatever its number of groups', () => {
  const sess = (day, session) => ({ trip: 't_rc', key: `d${day}s${session}g1`, day, session, label: 'Four-ball', kind: 'fourball', worth: 1, group: 1, groups: 3 });
  const plan = (id, date, teeTime, session = null) => ({ id, date, teeTime, ...(session ? { session } : {}) });
  const done = (id, at, session = null) => ({ id, createdAt: at, finishedAt: at, ...(session ? { session } : {}) });
  const chips = tripChips({
    done: [done('r1', OCT(16, 8), sess(1, 1)), done('r2', OCT(16, 8), sess(1, 1))],
    live: [{ id: 'r3', createdAt: OCT(16, 13), session: sess(1, 2) }],
    planned: [plan('a', '2026-10-16', '13:10', sess(1, 2)), plan('b', '2026-10-17', '08:00', sess(2, 1)), plan('c', '2026-10-17', '08:10', sess(2, 1)), plan('own', '2026-10-18', '09:00')],
  });
  assert.deepEqual(chips.map(c => [c.label, c.state]), [['Fri AM', 'done'], ['Fri PM', 'now'], ['Sat', 'planned'], ['Sun', 'planned']]);
  // A session with some groups done and the rest still to tee off is under way
  const mixed = tripChips({ done: [done('r1', OCT(16, 8), sess(1, 1))], live: [], planned: [plan('x', '2026-10-16', '08:20', sess(1, 1))] });
  assert.deepEqual(mixed.map(c => c.state), ['now']);
});

test('a draft carries the trip’s name for a captain’s phone that doesn’t know the trip', () => {
  const d = newDraft({ pool: POOL, captains: ['cap0', 'cap1'], names: ['Blue', 'Red'], title: 'Bandon 2026', now: OCT(1) });
  assert.equal(d.title, 'Bandon 2026');
  assert.equal(cleanDraft({ ...d, draft: 1, title: 'x'.repeat(50) }).title.length, 32);
  assert.equal(newDraft({ pool: POOL, captains: ['cap0', 'cap1'], names: ['Blue', 'Red'] }).title, null);
});
