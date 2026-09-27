// History time ranges, month totals, the season line, the Tab at a glance and "Run it back".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import {
  activeRounds, defaultRange, headToHead, isLatest, lastResult, monthGroups, myNet, myTab, netSeries,
  rangeBounds, rangeLabel, rangeOfKind, roundsInRange, shiftRange,
} from './history.js';
import { rematchSetup } from './rematch.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 } };
const course = {
  id: 'c9', name: 'Nine', city: 'Town', custom: true,
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }, { name: 'Blue', color: '#00f', rating: 36.0, slope: 120 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const PLAYERS = [
  { id: 'me', name: 'Trevor', index: 10, tee: 'Blue' },
  { id: 'bo', name: 'Bo', index: 2, tee: 'Red' },
];

/** A finished 9-hole skins round where `winner` takes `holes` holes outright, the rest tied. */
function skins(id, date, { winner = 'me', holes = 1, players = PLAYERS, extra = {} } = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, nine: 'front', players, settings: SETTINGS, hcPct: 100, useHandicaps: false });
  r.holes.forEach((h, i) => { r.scores[h.no] = Object.fromEntries(players.map(p => [p.id, i < holes && p.id !== winner ? 5 : 4])); });
  return { ...r, status: 'done', createdAt: date.getTime(), finishedAt: date.getTime(), ...extra };
}
function stateWith(rounds, extra = {}) {
  return {
    me: 'me', players: { me: { id: 'me', name: 'Trevor' }, bo: { id: 'bo', name: 'Bo' } },
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], activeRoundId: null,
    customCourses: { c9: course }, ...extra,
  };
}

const NOW = new Date(2026, 8, 27, 12); // Sep 27 2026

test('ranges: season, month and custom bounds, labels and stepping', () => {
  assert.deepEqual(defaultRange(NOW), { kind: 'season', year: 2026 });
  const [s0, s1] = rangeBounds({ kind: 'season', year: 2026 });
  assert.equal(s0, new Date(2026, 0, 1).getTime());
  assert.equal(s1, new Date(2027, 0, 1).getTime());

  const month = rangeOfKind('month', { kind: 'season', year: 2026 }, NOW);
  assert.deepEqual(month, { kind: 'month', year: 2026, month: 8 });
  assert.equal(rangeLabel(month, NOW), 'September 2026');
  assert.deepEqual(shiftRange(month, -9), { kind: 'month', year: 2025, month: 11 });
  assert.deepEqual(shiftRange({ kind: 'month', year: 2025, month: 11 }, 1), { kind: 'month', year: 2026, month: 0 });
  assert.ok(isLatest(month, NOW));
  assert.ok(!isLatest(shiftRange(month, -1), NOW));
  // An older season picked, then Month: December of that season
  assert.deepEqual(rangeOfKind('month', { kind: 'season', year: 2025 }, NOW), { kind: 'month', year: 2025, month: 11 });

  // Custom: the last 30 days, both ends included, reversed dates still work
  const custom = rangeOfKind('custom', month, NOW);
  assert.deepEqual(custom, { kind: 'custom', from: '2026-08-29', to: '2026-09-27' });
  assert.equal(rangeLabel(custom, NOW), 'Aug 29 to Sep 27');
  const [c0, c1] = rangeBounds({ kind: 'custom', from: '2026-09-27', to: '2026-09-01' });
  assert.equal(c0, new Date(2026, 8, 1).getTime());
  assert.equal(c1, new Date(2026, 8, 28).getTime());
  assert.equal(rangeLabel({ kind: 'custom', from: '2025-12-30', to: '' }, NOW), 'Since Dec 30, 2025');
  assert.deepEqual(rangeBounds({ kind: 'custom', from: '', to: '' }), [-Infinity, Infinity]);
});

test('rounds in a range, grouped by month with count and your net', () => {
  const a = skins('a', new Date(2026, 8, 20), { holes: 2 });              // you win 2 skins
  const b = skins('b', new Date(2026, 8, 3), { winner: 'bo', holes: 1 }); // you lose 1
  const c = skins('c', new Date(2026, 7, 15), { holes: 1 });
  const old = skins('old', new Date(2025, 6, 1), { holes: 3 });
  const others = skins('o', new Date(2026, 8, 10), { players: [{ id: 'x', name: 'Xi', index: 5 }, { id: 'y', name: 'Yu', index: 5 }], winner: 'x' });
  const live = { ...skins('live', new Date(2026, 8, 26)), status: 'active' };
  const state = stateWith([a, b, c, old, others, live]);

  const season = roundsInRange(state, { kind: 'season', year: 2026 });
  assert.deepEqual(season.map(r => r.id), ['a', 'o', 'b', 'c']); // newest first, no live or old rounds

  const amt = r => roundResults(r).balances.me;
  assert.ok(amt(a) > 0 && amt(b) < 0);
  assert.equal(myNet(others, state), null); // you weren't in it

  const groups = monthGroups(season, state, NOW);
  assert.deepEqual(groups.map(g => [g.key, g.label, g.count, g.played]), [['2026-09', 'September', 3, 2], ['2026-08', 'August', 1, 1]]);
  assert.equal(groups[0].net, amt(a) + amt(b));
  assert.equal(groups[1].net, amt(c));
  assert.equal(monthGroups([old], state, NOW)[0].label, 'July 2025');

  const sept = roundsInRange(state, { kind: 'month', year: 2026, month: 8 });
  assert.deepEqual(sept.map(r => r.id), ['a', 'o', 'b']);
});

test('season line: running total oldest first, only rounds you played', () => {
  const a = skins('a', new Date(2026, 8, 20), { holes: 2 });
  const b = skins('b', new Date(2026, 8, 3), { winner: 'bo', holes: 1 });
  const c = skins('c', new Date(2026, 7, 15), { holes: 1 });
  const state = stateWith([a, b, c]);
  const s = netSeries(roundsInRange(state, defaultRange(NOW)), state);
  assert.deepEqual(s.map(p => p.id), ['c', 'b', 'a']);
  const amt = r => roundResults(r).balances.me;
  assert.deepEqual(s.map(p => p.total), [amt(c), amt(c) + amt(b), amt(c) + amt(b) + amt(a)]);
  // Head to head for the same rounds nets out against Bo
  assert.deepEqual(headToHead([a, b, c], state), { bo: amt(a) + amt(b) + amt(c) });
});

test('Up next: tab at a glance, last result and rounds in progress', () => {
  const a = skins('a', new Date(2026, 8, 20), { holes: 2 });
  const b = skins('b', new Date(2026, 8, 21), { winner: 'bo', holes: 1 });
  const live1 = { ...skins('l1', new Date(2026, 8, 25)), status: 'active', createdAt: 1 };
  const live2 = { ...skins('l2', new Date(2026, 8, 26)), status: 'active', createdAt: 2 };
  const state = stateWith([a, b, live1, live2], { activeRoundId: 'l1' });
  const net = roundResults(a).balances.me + roundResults(b).balances.me;
  assert.ok(net > 0);
  assert.deepEqual(myTab(state), { owed: net, owe: 0, net, people: 1 });
  // A payment squares it
  const paid = { ...state, settlements: [{ id: 's', from: 'bo', to: 'me', amount: net, at: 1 }] };
  assert.deepEqual(myTab(paid), { owed: 0, owe: 0, net: 0, people: 0 });
  assert.equal(lastResult(state).round.id, 'b');
  assert.equal(lastResult(state).amount, roundResults(b).balances.me);
  assert.equal(lastResult(stateWith([])), null);
  // The one the Play button resumes comes first, then newest
  assert.deepEqual(activeRounds(state).map(r => r.id), ['l1', 'l2']);
});

test('Run it back: same game, course, group, tees and bets', () => {
  const r = skins('a', new Date(2026, 8, 20));
  r.settings.skins = { value: 5, carryover: false };
  r.players[1].courseHcOverride = 3;
  const setup = rematchSetup(stateWith([r]), r);
  assert.equal(setup.game, 'skins');
  assert.equal(setup.courseId, 'c9');
  assert.equal(setup.holesCount, 9);
  assert.deepEqual(setup.picked, ['me', 'bo']);
  assert.deepEqual(setup.missing, []);
  assert.deepEqual(setup.tees, { me: 'Blue', bo: 'Red' });
  assert.deepEqual(setup.hcOverride, { bo: 3 });
  assert.deepEqual(setup.bets, { value: 5, carryover: false });
  assert.equal(setup.useHc, false);
  assert.equal(setup.step, 3); // straight to the bets to confirm
  // A copy: changing the setup never touches the old round
  setup.bets.value = 9;
  assert.equal(r.settings.skins.value, 5);
});

test('Run it back: teams carry over, joined rounds map you, missing players and courses', () => {
  const four = [...PLAYERS, { id: 'cy', name: 'Cy', index: 8 }, { id: 'di', name: 'Di', index: 12 }];
  const n = createRound({ id: 'n', game: 'nassau', course, holesCount: 9, nine: 'front', players: four, settings: SETTINGS, hcPct: 80, teams: [['me', 'cy'], ['bo', 'di']] });
  const everyone = stateWith([n], { players: Object.fromEntries(four.map(p => [p.id, p])) });
  const s = rematchSetup(everyone, n);
  assert.deepEqual(s.teams, [['me', 'cy'], ['bo', 'di']]);
  assert.equal(s.hcPct, 80);

  // Di isn't saved on this phone: setup opens on the players with a fresh team split
  const noDi = stateWith([n], { players: Object.fromEntries(four.slice(0, 3).map(p => [p.id, p])) });
  const s2 = rematchSetup(noDi, n);
  assert.deepEqual(s2.picked, ['me', 'bo', 'cy']);
  assert.deepEqual(s2.missing, ['Di']);
  assert.equal(s2.step, 2);

  // A joined round: you were 'guest7' in it, which is you here
  const joined = { ...skins('j', new Date(2026, 8, 20), { players: [{ id: 'guest7', name: 'Trevor', index: 10, tee: 'Blue' }, PLAYERS[1]] }), localMe: 'guest7' };
  const s3 = rematchSetup(stateWith([joined]), joined);
  assert.deepEqual(s3.picked, ['me', 'bo']);
  assert.deepEqual(s3.tees, { me: 'Blue', bo: 'Red' });

  // The course was removed from this phone: pick one again
  const gone = { ...skins('g', new Date(2026, 8, 20)), course: { id: 'nowhere', name: 'Gone' } };
  assert.equal(rematchSetup(stateWith([gone]), gone).step, 1);
  assert.equal(rematchSetup(stateWith([]), { ...gone, game: 'nope' }), null);
});

test('old or odd saved rounds: no dates, no holesCount, you on both sides', () => {
  // A round saved without dates sorts last instead of breaking the sort
  const undated = { ...skins('u', new Date(2026, 8, 20)), createdAt: undefined, finishedAt: undefined };
  const dated = skins('d', new Date(2026, 8, 21));
  const state = stateWith([undated, dated]);
  assert.equal(lastResult(state).round.id, 'd');
  assert.deepEqual(roundsInRange(state, { kind: 'custom', from: '', to: '' }).map(r => r.id), ['d', 'u']);

  // An older round without holesCount still runs it back at its length
  const course18 = { ...course, id: 'c18', holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
  const full = { ...createRound({ id: 'f', game: 'skins', course: course18, holesCount: 18, players: PLAYERS, settings: SETTINGS, hcPct: 100 }), status: 'done' };
  delete full.holesCount;
  assert.equal(full.holes.length, 18);
  assert.equal(rematchSetup(stateWith([full], { customCourses: { c18: course18 } }), full).holesCount, 18);

  // Money between you here and you in a joined round isn't owed to anybody
  const joined = { ...skins('j', new Date(2026, 8, 20), { players: [{ id: 'guest7', name: 'Trevor', index: 10 }, { id: 'me', name: 'Trevor', index: 10 }], winner: 'guest7' }), localMe: 'guest7' };
  assert.deepEqual(myTab(stateWith([joined])), { owed: 0, owe: 0, net: 0, people: 0 });
});
