// Merging duplicate players keeps rounds as they are and adds up the Tab and records under one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { headToHeadSummary, nameOf, outstanding, personStory, tabWith } from './ledger.js';
import { sortedPlayers } from './format.js';
import { mergePlayer, mergedInto, unmergePlayer } from './merge.js';

const SETTINGS = { hcPct: 100, stroke: { stake: 5, payout: 'pot' }, skins: { value: 2, carryover: true } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };

/** A finished skins round where `winner` takes hole 1 and everything else halves. */
function round(id, players, winner) {
  const ids = players.map(p => p.id);
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: players.map(p => ({ ...p, index: 0 })), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, h.no === 1 && p !== winner ? 5 : 4]));
  r.status = 'done';
  r.finishedAt = 1000 + Number(id.replace(/\D/g, ''));
  return r;
}

function state() {
  // Adam you added, and Adam from a round his phone started (his own id for himself)
  const r1 = round('r1', [{ id: 'me', name: 'Trevor' }, { id: 'p_adam', name: 'Adam' }], 'me');
  const r2 = round('r2', [{ id: 'x_me', name: 'Trevor' }, { id: 'x_adam', name: 'Adam' }], 'x_me');
  r2.localMe = 'x_me';
  return {
    me: 'me',
    players: { me: { id: 'me', name: 'Trevor' }, p_adam: { id: 'p_adam', name: 'Adam' }, p_dal: { id: 'p_dal', name: 'Dalton', payApp: 'venmo', payHandle: 'dal' }, p_dal2: { id: 'p_dal2', name: 'Dalton', index: 8 } },
    crews: { c1: { id: 'c1', name: 'Sat', playerIds: ['me', 'p_dal2'] } },
    rounds: { r1, r2 },
    settlements: [],
    carries: [],
  };
}

test('merge: a joined-round duplicate adds into one person on the Tab and their record', () => {
  const s = state();
  const mine = new Set(['me', 'x_me']);
  assert.equal(headToHeadSummary(s, mine).size, 2);
  mergePlayer(s, 'x_adam', 'p_adam', { name: 'Adam' });
  const h2h = headToHeadSummary(s, mine);
  assert.deepEqual([...h2h.keys()], ['p_adam']);
  assert.equal(h2h.get('p_adam').rounds, 2);
  assert.equal(h2h.get('p_adam').won, 2);
  const plan = outstanding(s);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].from, 'p_adam');
  assert.equal(tabWith(plan, mine, 'p_adam'), plan[0].amount);
  const story = personStory(s, mine, 'x_adam');
  assert.equal(story.rounds, 2);
  assert.equal(nameOf(s, 'x_adam'), 'Adam');
  // The rounds themselves are never rewritten
  assert.equal(s.rounds.r2.players[1].id, 'x_adam');
});

test('merge: a payment recorded on the duplicate squares the kept player', () => {
  const s = state();
  const mine = new Set(['me', 'x_me']);
  mergePlayer(s, 'x_adam', 'p_adam', { name: 'Adam' });
  const owed = tabWith(outstanding(s), mine, 'p_adam');
  s.settlements.push({ id: 's1', from: 'x_adam', to: 'x_me', amount: owed, at: 5 });
  assert.equal(outstanding(s).length, 0);
});

test('merge: two saved players, the kept one takes what it was missing and the crews follow', () => {
  const s = state();
  mergePlayer(s, 'p_dal2', 'p_dal');
  assert.equal(s.players.p_dal.index, 8);
  assert.equal(s.players.p_dal.payHandle, 'dal');
  assert.deepEqual(s.crews.c1.playerIds, ['me', 'p_dal']);
  assert.deepEqual(sortedPlayers(s).map(p => p.id), ['me', 'p_adam', 'p_dal']);
  assert.deepEqual(mergedInto(s, 'p_dal').map(p => p.id), ['p_dal2']);
});

test('unmerge: the duplicate comes back on its own, and a joined-only one leaves no record', () => {
  const s = state();
  mergePlayer(s, 'x_adam', 'p_adam', { name: 'Adam' });
  mergePlayer(s, 'p_dal2', 'p_dal');
  unmergePlayer(s, 'x_adam');
  unmergePlayer(s, 'p_dal2');
  assert.equal(s.players.x_adam, undefined);
  assert.equal(s.players.p_dal2.mergedInto, undefined);
  assert.equal(headToHeadSummary(s, new Set(['me', 'x_me'])).size, 2);
});

test('merge: never you, never into itself, and a chain lands on the kept player', () => {
  const s = state();
  assert.equal(mergePlayer(s, 'me', 'p_adam'), false);
  assert.equal(mergePlayer(s, 'p_adam', 'me'), false);
  assert.equal(mergePlayer(s, 'p_adam', 'p_adam'), false);
  mergePlayer(s, 'x_adam', 'p_adam', { name: 'Adam' });
  mergePlayer(s, 'p_adam', 'p_dal');
  assert.equal(s.players.x_adam.mergedInto, 'p_dal');
  assert.equal(headToHeadSummary(s, new Set(['me', 'x_me'])).get('p_dal').rounds, 2);
});
