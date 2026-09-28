// "Lately" on Up next: newest first, the last 30 days, amounts only between you and the other
// person, your own amount only on recaps, and the "Last time out" round left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { latelyItems } from './lately.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const course = {
  id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'Blue', color: '#00f', rating: 36.0, slope: 120 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const PLAYERS = [
  { id: 'me', name: 'Trevor Nielsen', index: 10, tee: 'Blue' },
  { id: 'sam', name: 'Sam', index: 2, tee: 'Blue' },
  { id: 'mike', name: 'Mike', index: 5, tee: 'Blue' },
];
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 28, 12).getTime();

/** A finished 9-hole skins round where `winner` takes `holes` holes outright, the rest tied. */
function skins(id, at, { winner = 'me', holes = 1 } = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, nine: 'front', players: PLAYERS, settings: SETTINGS, hcPct: 100, useHandicaps: false });
  r.holes.forEach((h, i) => { r.scores[h.no] = Object.fromEntries(PLAYERS.map(p => [p.id, i < holes && p.id !== winner ? 5 : 4])); });
  return { ...r, status: 'done', createdAt: at, finishedAt: at };
}
function stateWith({ rounds = [], settlements = [], plans = {}, carries } = {}) {
  return {
    me: 'me',
    players: { me: { id: 'me', name: 'Trevor Nielsen' }, sam: { id: 'sam', name: 'Sam' }, mike: { id: 'mike', name: 'Mike' } },
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements, plans, customCourses: { c9: course },
    ...(carries ? { carries } : {}),
  };
}

test('lately: newest first across payments, answers and recaps', () => {
  const s = stateWith({
    rounds: [skins('old', NOW - 5 * DAY), skins('last', NOW - 1 * DAY)],
    settlements: [
      { id: 's1', from: 'sam', to: 'me', amount: 9, at: NOW - 2 * DAY, app: 'venmo' },
      { id: 's2', from: 'me', to: 'mike', amount: 15, at: NOW - 3 * DAY },
    ],
    plans: { p1: { id: 'p1', status: 'planned', host: true, hostWho: 'host', date: '2026-10-03', course: { name: 'Pebble Creek' },
      answers: { host: { name: 'Trevor', status: 'in', at: NOW - 10 * DAY }, d: { name: 'Dave', status: 'in', at: NOW - 4 * 60 * 60 * 1000 } } } },
  });
  const items = latelyItems(s, NOW);
  assert.deepEqual(items.map(i => i.text), [
    'Dave is in for Saturday',
    'Sam paid you $9',
    'You paid Mike $15',
    'Skins at Pebble Creek · You took it',
  ]);
  assert.match(items[1].sub, /^Venmo · /);
  assert.deepEqual(items[1].target, ['person', { id: 'sam' }]);
  assert.deepEqual(items[0].target, ['plan', { id: 'p1' }]);
  // Newest first all the way down
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].at >= items[i].at);
});

test('lately: only the last 30 days', () => {
  const s = stateWith({
    settlements: [
      { id: 'in', from: 'sam', to: 'me', amount: 5, at: NOW - 29 * DAY },
      { id: 'out', from: 'sam', to: 'me', amount: 7, at: NOW - 31 * DAY },
    ],
  });
  assert.deepEqual(latelyItems(s, NOW).map(i => i.id), ['pay:in']);
});

test('lately: a payment between two other people never shows the amount', () => {
  const s = stateWith({ settlements: [{ id: 'x', from: 'sam', to: 'mike', amount: 12.5, at: NOW - DAY }] });
  const [item] = latelyItems(s, NOW);
  assert.equal(item.text, 'Sam settled up with Mike');
  assert.doesNotMatch(`${item.text} ${item.sub}`, /\$|12/);
});

test('lately: a carry-over shows the amount only when you are one of the two', () => {
  const s = stateWith({ carries: [
    { id: 'c1', from: 'me', to: 'mike', amount: 15, at: NOW - DAY, status: 'agreed' },
    { id: 'c2', from: 'sam', to: 'mike', amount: 20, at: NOW - 2 * DAY, status: 'agreed' },
    { id: 'c3', from: 'sam', to: 'me', amount: 8, at: NOW - 3 * DAY, status: 'asked' },
  ] });
  assert.deepEqual(latelyItems(s, NOW).map(i => i.text), ['You and Mike rolled $15 to next time', 'Sam and Mike rolled it to next time']);
});

test('lately: a recap shows your own amount and nobody else’s', () => {
  // Sam wins 3 skins; you and Mike lose
  const s = stateWith({ rounds: [skins('a', NOW - 3 * DAY, { winner: 'sam', holes: 3 }), skins('b', NOW - DAY)] });
  const [recap] = latelyItems(s, NOW);
  assert.equal(recap.text, 'Skins at Pebble Creek · Sam took it');
  assert.match(recap.sub, /^You −\$\d/);
  const amounts = `${recap.text} ${recap.sub}`.match(/\$\d+(\.\d+)?/g);
  assert.equal(amounts.length, 1, 'only one amount: yours');
  assert.deepEqual(recap.target, ['roundDetail', { id: 'a' }]);
});

test('lately: the round in "Last time out" is left out', () => {
  const s = stateWith({ rounds: [skins('older', NOW - 3 * DAY), skins('newest', NOW - DAY)] });
  assert.deepEqual(latelyItems(s, NOW).map(i => i.id), ['recap:older']);
  assert.deepEqual(latelyItems(stateWith({ rounds: [skins('only', NOW - DAY)] }), NOW), []);
});

test('lately: today’s saved data with no carries or plans still works', () => {
  const s = { me: 'me', players: {}, rounds: {}, settlements: [] };
  assert.deepEqual(latelyItems(s, NOW), []);
});
