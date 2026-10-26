// Round setup's overview rows (setup-overview.js): what each row says, what's still to pick, what
// stops Create round, and where the first pass goes next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDICAPS_STEP, PLAY_FOR_STEP, betsProblem, canCreate, nextStep, overviewRows } from './setup-overview.js';

const course = {
  id: 'cc_logan', name: 'Logan River GC', custom: true,
  tees: [{ name: 'Blue', color: '#2457d6', rating: 71, slope: 125 }, { name: 'White', color: '#fff', rating: 69, slope: 120 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const names = { me: 'Trevor Nielsen', mike: 'Mike Allred', dave: 'Dave Olsen', jo: 'Jo Park' };
const opts = { hcPct: 100, skins: { value: 2, carryover: true, kind: 'net', payout: 'per' }, wolf: { point: 2, loneMultiplier: 2 }, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' }, bbb: { value: 1 } };
const full = { game: 'skins', course, holesCount: 18, nine: 'front', picked: ['me', 'mike', 'dave'], betting: ['me', 'mike', 'dave'], defaultTee: 'Blue', opts, names, done: [0, 1, 2, 3] };
const row = (rows, key) => rows.find(r => r.key === key);

test('a fresh setup: the steps are still to pick, in order, and Create round waits', () => {
  const rows = overviewRows({ picked: ['me'], betting: ['me'], opts, names, done: [] });
  assert.deepEqual(rows.map(r => r.key), ['game', 'course', 'players', 'bets', 'handicaps', 'playFor']);
  assert.deepEqual(rows.filter(r => r.state === 'todo').map(r => r.key), ['game', 'course', 'players', 'bets']);
  // Only the game can be picked first; the course needs a game
  assert.deepEqual(rows.filter(r => r.open).map(r => r.key), ['game', 'playFor']);
  assert.equal(nextStep(rows), 0);
  assert.equal(canCreate(rows), false);
  assert.equal(row(rows, 'playFor').value, 'Money');
  assert.equal(row(rows, 'handicaps').value, 'Off');
});

test('a game from a "Play this now" link: the pass goes on with the course', () => {
  const rows = overviewRows({ game: 'wolf', picked: ['me'], betting: ['me'], opts, names, done: [] });
  assert.equal(row(rows, 'game').value, 'Wolf');
  assert.equal(nextStep(rows), 1);
});

test('everything set: each row says what was picked, and Create round can go', () => {
  const rows = overviewRows({ ...full, tees: { dave: 'White' }, startHole: 10 });
  assert.equal(row(rows, 'course').sub, 'Mixed tees · 18 holes · Starts on 10');
  assert.equal(row(rows, 'players').value, 'Trevor, Mike and Dave');
  assert.equal(row(rows, 'bets').value, '$2 a skin · carryovers');
  assert.equal(nextStep(rows), null);
  assert.equal(canCreate(rows), true);
  assert.equal(row(rows, 'handicaps').step, HANDICAPS_STEP);
  assert.equal(row(rows, 'playFor').step, PLAY_FOR_STEP);
});

test('nine holes, points, handicaps at 80%, a side game and a side bet', () => {
  const rows = overviewRows({
    ...full, holesCount: 9, nine: 'back', playFor: { kind: 'points' }, useHc: true, opts: { ...opts, hcPct: 80 },
    sides: [{ game: 'ctp', settings: { stake: 5, unclaimed: 'carry' } }], bets: [{ id: 'b1', kind: 'match', sides: ['me', 'mike'], stake: 10 }],
  });
  assert.equal(row(rows, 'course').sub, 'Blue tees · 9 holes · Back 9');
  assert.equal(row(rows, 'playFor').value, 'Points');
  assert.match(row(rows, 'bets').value, /pts/);
  assert.match(row(rows, 'bets').sub, /1 side bet/);
  assert.equal(row(rows, 'handicaps').value, 'On, 80% of strokes');
});

test('a game changed from the overview to one the players don’t fit: Players says so and Create round waits', () => {
  const rows = overviewRows({ ...full, game: 'wolf' });
  assert.equal(row(rows, 'players').state, 'fix');
  assert.equal(row(rows, 'players').note, 'Add 1 more player');
  // The bets can't be opened until the players fit
  assert.equal(row(rows, 'bets').open, false);
  assert.equal(canCreate(rows), false);
});

test('teams that don’t fit stop Create round on the Bets row', () => {
  const four = { ...full, game: 'nassau', picked: ['me', 'mike', 'dave', 'jo'], betting: ['me', 'mike', 'dave', 'jo'] };
  assert.equal(row(overviewRows({ ...four, teams: [['me', 'jo'], ['mike', 'dave']] }), 'bets').state, 'set');
  assert.equal(row(overviewRows({ ...four, teams: [['me', 'jo'], ['mike', 'dave']] }), 'players').sub, '4 players · Trevor and Jo v Mike and Dave');
  // Dave left off the teams (players changed without the teams fitted)
  const bad = overviewRows({ ...four, teams: [['me', 'jo'], ['mike']] });
  assert.equal(row(bad, 'bets').state, 'fix');
  assert.equal(row(bad, 'bets').note, 'Put everyone on a team');
  assert.equal(betsProblem({ ...four, teams: [['me', 'jo'], ['mike']] }), 'Put everyone on a team');
  assert.equal(canCreate(bad), false);
});

test('a game played without strokes: the Handicaps row says so and doesn’t open', () => {
  const h = row(overviewRows({ ...full, game: 'bbb' }), 'handicaps');
  assert.equal(h.value, 'Not used');
  assert.equal(h.open, false);
});
