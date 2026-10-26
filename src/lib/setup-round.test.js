// The round setup saves, for a spread of choices (setup-round.js). Setup's screens moved to a
// summary-first overview on 2026-10-26 (overhaul/setup): every step now returns to one overview, but
// the round each set of choices saves must be exactly what it was before. The expected rounds in
// setup-round.expected.json were written from the setup code as it was before the overview, and each
// case also checks the money by hand, so a change to setup's screens can't quietly change a bet.
// UPDATE_SETUP_ROUNDS=1 node --test src/lib/setup-round.test.js writes the file again (only do that
// for a change to a round's shape that's meant, and say so in the commit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSetupRound, finishSetupRound, fitHoles, noHandicapIds, setupTeams } from './setup-round.js';
import { GAMES, sideGamesOf } from './round.js';
import { canJustPlay } from './just-playing.js';
import { withBets } from './setup-screen.js';
import { addUsual, usualFromRound } from './usuals.js';

const EXPECTED = new URL('./setup-round.expected.json', import.meta.url);

const course = {
  id: 'cc_logan', name: 'Logan River GC', city: 'Logan', custom: true,
  tees: [{ name: 'Blue', color: '#2457d6', rating: 71.4, slope: 128 }, { name: 'White', color: '#ffffff', rating: 69.2, slope: 121 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: [4, 5, 3, 4, 4, 3, 5, 4, 4][i % 9], hdcp: ((i * 7) % 18) + 1 })),
};

// The settings a phone keeps (store.js DEFAULT_SETTINGS, the games used here) plus the personal ones
// setup must leave out of a round
const SETTINGS = {
  theme: 'system', hcPct: 100, shareAmounts: true, shareScores: true, betPrompt: true,
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void', backDouble: false, birdieDouble: false },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2, turnPress: false, noLastPress: false, teamScore: 'best', bye: 'off' },
  wolf: { point: 2, loneMultiplier: 2, blind: false, blindPlus: 1 },
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off', par3Triple: false, pressAll: false },
  match: { stake: 10, pressMode: 'off', threshold: 2, teamScore: 'best', bye: 'off' },
  stroke: { stake: 5, payout: 'pot', cap: false, nassau: false, gross: false },
  vegas: { point: 1, birdieFlip: true, birdieDouble: false, daytona: false, max9: false },
  ctp: { stake: 5, unclaimed: 'carry' },
  birdies: { stake: 5, eagleShares: 2 },
  dots: { value: 1, auto: true, greenieCarry: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: false } },
};

function phone() {
  const players = {
    me: { id: 'me', name: 'Trevor Nielsen', index: 8.4, venmo: 'trev' },
    mike: { id: 'mike', name: 'Mike Allred', index: 12.1 },
    dave: { id: 'dave', name: 'Dave Olsen', index: 18 },
    jo: { id: 'jo', name: 'Jo Park', index: 3.2 },
    sam: { id: 'sam', name: 'Sam Reyes', index: null },
  };
  return { me: 'me', players, customCourses: { [course.id]: course }, favorites: [], rounds: {}, plans: {}, settings: structuredClone(SETTINGS), usuals: [], challenges: {}, trips: {} };
}

/**
 * Setup's picks as useSetupState keeps them, from a few choices, then the round useStartRound
 * builds from them. `pre` is what setup starts from (Run it back, a usual), as withBets lays it on.
 */
function roundFor(s, c) {
  const picked = c.picked;
  const casualIds = canJustPlay(c.game) ? picked.filter(pid => (c.justPlaying || []).includes(pid)) : [];
  const betting = casualIds.length ? picked.filter(pid => !casualIds.includes(pid)) : picked;
  const opts = { ...withBets(structuredClone(s.settings), c.pre || null), ...(c.opts || {}) };
  for (const [g, v] of Object.entries(c.bets || {})) opts[g] = { ...opts[g], ...v };
  const teams = c.teams === undefined ? setupTeams({ game: c.game, teams: null, betting }) : c.teams;
  const sides = sideGamesOf({ game: c.game, sideGames: c.sideGames || [] });
  const useHc = !!c.useHc;
  const hcOverride = c.hcOverride || {};
  const noHc = noHandicapIds(s, { useHc, game: c.game, betting, hcOverride });
  const { round, settings, challengesIn } = buildSetupRound(s, {
    id: c.id, game: c.game, course, holesCount: c.holesCount ?? 18, nine: c.nine ?? 'front', startHole: c.startHole ?? null,
    orderedPicked: picked, betting, tees: c.tees || {}, defaultTee: 'Blue', hcOverride, opts, sides, useHc, noHc, teams, casualIds,
    playFor: c.playFor ?? null, shownBets: c.bets2 || [],
  });
  finishSetupRound(s, round, { game: c.game, course, tripPick: c.trip || null, usualId: c.usualId || null });
  return { round, settings, challengesIn };
}

const CASES = [
  { id: 'r_skins', game: 'skins', picked: ['me', 'mike', 'dave'] },
  { id: 'r_skins_gross9', game: 'skins', picked: ['me', 'mike', 'dave', 'jo'], holesCount: 9, nine: 'back', startHole: 14, bets: { skins: { value: 5, kind: 'gross', carryover: false } } },
  { id: 'r_nassau_hc', game: 'nassau', picked: ['me', 'mike', 'dave', 'jo'], useHc: true, opts: { hcPct: 80, halfStrokes: true }, teams: [['me', 'jo'], ['mike', 'dave']],
    sideGames: [{ game: 'skins', settings: { value: 1, carryover: true, kind: 'net', payout: 'per' } }, { game: 'ctp', settings: { stake: 5, unclaimed: 'carry' } }],
    bets2: [{ id: 'b_1', kind: 'match', sides: ['me', 'mike'], stake: 20 }, { id: 'b_2', kind: 'hole', sides: ['dave', 'jo'], stake: 2, holes: [1, 9] }] },
  { id: 'r_wolf_points', game: 'wolf', picked: ['dave', 'me', 'jo', 'mike'], playFor: { kind: 'points' }, bets: { wolf: { blind: true, carry: true } } },
  { id: 'r_bestball_reward', game: 'bestball', picked: ['me', 'mike', 'dave', 'jo'], useHc: true, playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' },
    bets2: [{ id: 'b_3', kind: 'ctp', sides: ['me', 'dave'], stake: 5, playFor: 'money' }] },
  { id: 'r_banker_casual', game: 'banker', picked: ['me', 'mike', 'dave', 'sam'], justPlaying: ['sam'], tees: { dave: 'White' }, hcOverride: { mike: 10 }, useHc: true },
  { id: 'r_stroke_nohc', game: 'stroke', picked: ['me', 'sam', 'jo'], useHc: true },
  { id: 'r_match_sides', game: 'match', picked: ['me', 'mike', 'dave'], teams: [['me'], ['mike', 'dave']], sideGames: [{ game: 'birdies', settings: { stake: 5, eagleShares: 2 } }, { game: 'dots', settings: structuredClone(SETTINGS.dots) }] },
  { id: 'r_vegas', game: 'vegas', picked: ['me', 'mike', 'dave', 'jo'], useHc: true, opts: { hcPct: 90 } },
];

const strip = r => JSON.parse(JSON.stringify(r));

function allRounds() {
  const realNow = Date.now;
  Date.now = () => 1790000000000; // createRound stamps createdAt
  try {
    const s = phone();
    const out = {};
    for (const c of CASES) out[c.id] = strip(roundFor(s, c));
    // Counted for a trip, started from a saved usual
    const done = roundFor(s, { id: 'r_done', game: 'skins', picked: ['me', 'mike', 'dave'] }).round;
    done.status = 'done';
    s.rounds.r_done = done;
    addUsual(s, usualFromRound(s, done, { id: 'u_sat', now: 1 }));
    const trip = { id: 't_vegas', name: 'Mesquite', start: '2026-11-06', end: '2026-11-08', people: ['me', 'mike', 'dave'], format: 'stroke' };
    out.r_trip_usual = strip(roundFor(s, { id: 'r_trip_usual', game: 'skins', picked: ['me', 'mike', 'dave'], usualId: 'u_sat', trip }));
    return out;
  } finally { Date.now = realNow; }
}

test('every spread of choices saves the same round as setup did before the overview', () => {
  const got = allRounds();
  if (process.env.UPDATE_SETUP_ROUNDS) writeFileSync(EXPECTED, `${JSON.stringify(got, null, 1)}\n`);
  const want = JSON.parse(readFileSync(EXPECTED, 'utf8'));
  assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort());
  for (const id of Object.keys(want)) assert.deepEqual(got[id], want[id], id);
});

test('the money in each round, checked by hand', () => {
  const r = allRounds();
  // Skins from the phone's settings, personal settings left out
  assert.equal(r.r_skins.round.settings.skins.value, 2);
  assert.equal(r.r_skins.round.useHandicaps, false);
  assert.ok(!('shareAmounts' in r.r_skins.round.settings) && !('betPrompt' in r.r_skins.round.settings) && !('shareScores' in r.r_skins.round.settings));
  assert.equal(r.r_skins.settings.skins.value, 2, 'kept as next time’s default');
  // Nine holes on the back, starting on 14, gross skins at $5 with no carryovers
  assert.equal(r.r_skins_gross9.round.holes.length, 9);
  assert.equal(r.r_skins_gross9.round.holes[0].no, 14);
  assert.equal(r.r_skins_gross9.round.nine, 'back');
  assert.deepEqual([r.r_skins_gross9.round.settings.skins.value, r.r_skins_gross9.round.settings.skins.kind, r.r_skins_gross9.round.settings.skins.carryover], [5, 'gross', false]);
  // Nassau at 80% with half strokes, two side games, two side bets (one on the front nine)
  const n = r.r_nassau_hc.round;
  assert.equal(n.hcPct, 80);
  assert.equal(n.halfStrokes, true);
  assert.equal(n.useHandicaps, true);
  assert.deepEqual(n.teams.map(t => t.players), [['me', 'jo'], ['mike', 'dave']]);
  assert.deepEqual(n.sideGames.map(sg => sg.game), ['skins', 'ctp']);
  assert.deepEqual(n.bets.map(b => [b.id, b.stake, b.holes || null]), [['b_1', 20, null], ['b_2', 2, [1, 9]]]);
  assert.equal(r.r_nassau_hc.settings.halfStrokes, undefined, 'half strokes are never next time’s default');
  // Wolf for points with blind wolf and carries on, in the order picked
  assert.deepEqual(r.r_wolf_points.round.playFor, { kind: 'points' });
  assert.deepEqual(r.r_wolf_points.round.players.map(p => p.id), ['dave', 'me', 'jo', 'mike']);
  assert.equal(r.r_wolf_points.round.settings.wolf.blind, true);
  // Best ball for lunch, its side bet still for cash
  assert.equal(r.r_bestball_reward.round.playFor.reward, 'Lunch');
  assert.equal(r.r_bestball_reward.round.bets[0].playFor, 'money');
  assert.equal(r.r_bestball_reward.round.teams.length, 2);
  // Banker with Sam just playing: on the card, out of the game, Dave off the whites, Mike's handicap typed in
  const b = r.r_banker_casual.round;
  assert.deepEqual(b.justPlaying, { sam: true });
  assert.equal(b.players.find(p => p.id === 'dave').tee, 'White');
  assert.equal(b.players.find(p => p.id === 'mike').courseHcOverride, 10);
  // Sam has no handicap: plays as scratch, handicaps stay on for the others
  assert.equal(r.r_stroke_nohc.round.useHandicaps, true);
  assert.equal(r.r_stroke_nohc.round.players.find(p => p.id === 'sam').courseHc, 0);
  // Match play two against one, a birdie pot and dots on top
  assert.deepEqual(r.r_match_sides.round.sideGames.map(sg => sg.game), ['birdies', 'dots']);
  assert.equal(r.r_vegas.round.hcPct, 90);
  // Counted for the trip and started from the saved usual
  assert.equal(r.r_trip_usual.round.trip.id, 't_vegas');
  assert.equal(r.r_trip_usual.round.usualId, 'u_sat');
});

test('nobody with a handicap: the round plays without them', () => {
  const s = phone();
  const { round } = roundFor(s, { id: 'r_x', game: 'stroke', picked: ['sam'], useHc: true });
  assert.equal(round.useHandicaps, false);
  assert.deepEqual(noHandicapIds(s, { useHc: true, game: 'stroke', betting: ['sam', 'me'], hcOverride: {} }), ['sam']);
  assert.deepEqual(noHandicapIds(s, { useHc: true, game: 'stroke', betting: ['sam'], hcOverride: { sam: 4 } }), []);
  assert.deepEqual(noHandicapIds(s, { useHc: true, game: 'bbb', betting: ['sam'], hcOverride: {} }), []);
});

test('a choice changed from the overview saves the same round as making it in order', () => {
  const realNow = Date.now;
  Date.now = () => 1790000000000;
  try {
    const s = phone();
    // In order: Nassau, 9 holes, four players, then the Bets step fits the teams
    const inOrder = roundFor(s, { id: 'r_same', game: 'nassau', holesCount: 9, picked: ['me', 'mike', 'dave', 'jo'] }).round;
    // From the overview: Skins with three first, then the game changed to Nassau and Jo added from
    // their rows. Back on the overview the holes and teams are fitted the same way the steps fit them
    let holesCount = 9;
    let teams = setupTeams({ game: 'skins', teams: null, betting: ['me', 'mike', 'dave'] });
    holesCount = fitHoles('nassau', holesCount);
    teams = setupTeams({ game: 'nassau', teams, betting: ['me', 'mike', 'dave'] });
    teams = setupTeams({ game: 'nassau', teams, betting: ['me', 'mike', 'dave', 'jo'] });
    const fromOverview = roundFor(s, { id: 'r_same', game: 'nassau', holesCount, picked: ['me', 'mike', 'dave', 'jo'], teams }).round;
    assert.deepEqual(strip(fromOverview), strip(inOrder));
  } finally { Date.now = realNow; }
});

test('teams: kept while they fit, fresh when the players or the game change', () => {
  const t = [['me', 'jo'], ['mike', 'dave']];
  assert.equal(setupTeams({ game: 'nassau', teams: t, betting: ['me', 'jo', 'mike', 'dave'] }), t);
  assert.notEqual(setupTeams({ game: 'nassau', teams: t, betting: ['me', 'jo', 'mike'] }), t);
  // Three scramble teams, then Best ball (two teams only)
  const three = [['me'], ['jo'], ['mike', 'dave']];
  assert.equal(setupTeams({ game: 'scramble', teams: three, betting: ['me', 'jo', 'mike', 'dave'] }), three);
  assert.equal(setupTeams({ game: 'bestball', teams: three, betting: ['me', 'jo', 'mike', 'dave'] }).length, 2);
  // A team points trip's pairs, when they fit
  const cup = [['me', 'mike'], ['jo', 'dave']];
  assert.deepEqual(setupTeams({ game: 'nassau', teams: null, betting: ['me', 'jo', 'mike', 'dave'], tripCup: true, cupTeams: () => cup }), cup);
});

test('holes: a game that can’t be played over the holes picked takes its first', () => {
  for (const [g, info] of Object.entries(GAMES)) {
    assert.ok(info.holes.includes(fitHoles(g, 18)), g);
    assert.ok(info.holes.includes(fitHoles(g, 9)), g);
  }
  assert.equal(fitHoles('skins', 9), 9);
  assert.equal(fitHoles(null, 9), 9);
});
