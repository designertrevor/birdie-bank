// The Season preview on the Tab: real numbers from real rounds, and the sample group before there are enough.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { MIN_REAL_ROUNDS, SAMPLE, realRoundCount, sampleBoard, seasonBoard } from './season.js';
import { seasonAccess } from './entitlements.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  skins: { value: 2, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
};
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const oak = { ...flat9, id: 'oak', name: 'Oak Hollow' };
const NAMES = { me: 'Trevor Nielsen', mike: 'Mike Ross', sam: 'Sam Lee', dave: 'Dave Cho' };
const people = ids => ids.map(id => ({ id, name: NAMES[id] || id, index: 0 }));
const YEAR = 2026;
const at = (m, d) => new Date(YEAR, m - 1, d, 15).getTime();

/** A finished 9-hole round: everyone makes 4 except the scores given. */
function round(id, game, ids, holes = {}, { course = flat9, when = at(9, 5), extra = {} } = {}) {
  const r = createRound({ id, game, course, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.status = 'done';
  r.finishedAt = when;
  return Object.assign(r, extra);
}

function stateWith(rounds, extra = {}) {
  return {
    me: 'me',
    players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
    settlements: [],
    ...extra,
  };
}

const fixture = () => [
  round('r1', 'skins', ['me', 'mike', 'sam'], { 1: { me: 3 }, 2: { mike: 3 }, 3: { me: 3 } }, { when: at(9, 5) }),
  round('r2', 'stroke', ['me', 'mike', 'dave'], { 4: { me: 3 }, 5: { dave: 6 } }, { course: oak, when: at(9, 12) }),
  round('r3', 'skins', ['me', 'mike', 'sam', 'dave'], { 7: { sam: 2 } }, { when: at(9, 19) }),
];

test('the season board adds up exactly what roundResults says for each round', () => {
  const rounds = fixture();
  const b = seasonBoard(stateWith(rounds), YEAR);
  const expect = {};
  for (const r of rounds) for (const [id, v] of Object.entries(roundResults(r).balances)) expect[id] = Math.round(((expect[id] || 0) + v) * 100) / 100;
  assert.equal(b.rounds, 3);
  assert.deepEqual(Object.fromEntries(b.balances.map(x => [x.id, x.net])), expect);
  // Money moves between players, so the season sums to zero
  assert.equal(Math.round(b.balances.reduce((a, x) => a + x.net, 0) * 100), 0);
  assert.equal(b.balances.find(x => x.me).name, 'You');
  assert.equal(b.since, at(9, 5));
});

test('you against the friend you played most, your biggest day and your best game', () => {
  const rounds = fixture();
  const b = seasonBoard(stateWith(rounds), YEAR);
  assert.equal(b.rival.id, 'mike');
  assert.equal(b.rival.rounds, 3);
  const pairs = rounds.map(r => roundResults(r).pairs.me.mike ?? 0);
  assert.equal(b.rival.net, Math.round(pairs.reduce((a, v) => a + v, 0) * 100) / 100);
  assert.equal(b.rival.won + b.rival.lost + b.rival.even, 3);
  const nets = rounds.map(r => roundResults(r).balances.me);
  const best = Math.max(...nets);
  assert.equal(b.biggestDay.amount, best);
  assert.equal(b.biggestDay.id, rounds[nets.indexOf(best)].id);
  const byGame = {};
  rounds.forEach((r, i) => { byGame[r.game] = (byGame[r.game] || 0) + nets[i]; });
  const top = Object.entries(byGame).sort((a, c) => c[1] - a[1])[0];
  assert.equal(b.bestGame.game, top[0]);
});

test('only this season, only rounds you played, joined rounds included', () => {
  const rounds = fixture();
  const lastYear = round('old', 'skins', ['me', 'mike'], { 1: { me: 3 } }, { when: new Date(YEAR - 1, 5, 1).getTime() });
  const notMine = round('nm', 'skins', ['mike', 'sam'], { 1: { mike: 3 } }, { when: at(9, 20) });
  const live = { ...round('live', 'skins', ['me', 'mike'], {}, { when: at(9, 21) }), status: 'active' };
  // Joined from a link on this phone: you are `localMe` there
  const joined = round('j1', 'skins', ['guestme', 'sam'], { 2: { guestme: 3 } }, { when: at(9, 22), extra: { localMe: 'guestme' } });
  const st = stateWith([...rounds, lastYear, notMine, live, joined]);
  assert.equal(realRoundCount(st, YEAR), 4);
  const b = seasonBoard(st, YEAR);
  assert.equal(b.rounds, 4);
  // The joined round's "you" counts as you, not as a second person
  assert.equal(b.balances.filter(x => x.me).length, 1);
  assert.ok(!b.balances.some(x => x.id === 'guestme'));
});

test('one finished round shows the sample, two show your real season', () => {
  assert.equal(MIN_REAL_ROUNDS, 2);
  const [r1, r2] = fixture();
  assert.equal(realRoundCount(stateWith([]), YEAR), 0);
  assert.ok(realRoundCount(stateWith([r1]), YEAR) < MIN_REAL_ROUNDS);
  assert.ok(realRoundCount(stateWith([r1, r2]), YEAR) >= MIN_REAL_ROUNDS);
  // An empty season is safe to draw
  const empty = seasonBoard(stateWith([]), YEAR);
  assert.deepEqual([empty.rounds, empty.balances, empty.rival, empty.biggestDay, empty.bestGame, empty.since], [0, [], null, null, null, null]);
});

test('the sample group is Alex, Jordan, Pat, Lee and Casey, and never shares a name with someone real', () => {
  assert.deepEqual(SAMPLE.balances.map(b => b.name), ['Alex', 'Jordan', 'Pat', 'Lee', 'Casey']);
  assert.equal(Math.round(SAMPLE.balances.reduce((a, b) => a + b.net, 0)), 0);
  assert.deepEqual(sampleBoard(stateWith(fixture())).balances.map(b => b.name), ['Alex', 'Jordan', 'Pat', 'Lee', 'Casey']);
  // Someone real is called Pat or Alex: the sample swaps those names out
  const st = stateWith(fixture(), { players: { me: { id: 'me', name: 'Trevor' }, p1: { id: 'p1', name: 'Pat Moore' }, a1: { id: 'a1', name: 'alex' } } });
  const s = sampleBoard(st);
  const real = new Set(['trevor', 'pat', 'alex', ...Object.values(NAMES).map(n => n.split(' ')[0].toLowerCase())]);
  for (const b of s.balances) assert.ok(!real.has(b.name.toLowerCase()), b.name);
  assert.equal(new Set(s.balances.map(b => b.name)).size, 5);
  assert.ok(s.balances.every(b => b.id.startsWith('sample_')));
  assert.equal(s.sample, true);
});

test('season access: a preview for organizers, nothing for invited-only phones', () => {
  assert.deepEqual(seasonAccess(stateWith(fixture())), { access: 'preview' });
  assert.deepEqual(seasonAccess({ organizer: { games: [] }, rounds: {} }), { access: 'preview' });
  // Only ever joined from a link, or answered an RSVP: never Pro
  const invited = { rounds: { j1: { id: 'j1', localMe: 'guest', players: [] } }, plans: { p1: { host: false } } };
  assert.deepEqual(seasonAccess(invited), { access: 'none' });
  assert.deepEqual(seasonAccess({}), { access: 'none' });
});
