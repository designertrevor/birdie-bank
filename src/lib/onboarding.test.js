import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARD_GAMES, STEPS, answered, ballotGames, gameList, nextStep, organizerRecord, payoff, prevStep,
  progressOf, readyLines, settleMath, suggestedGame, toggleGame,
} from './onboarding.js';
import { GAMES } from './round.js';
import { MAX_BALLOT_GAMES } from './plans.js';

test('every game on the first question is a real game', () => {
  for (const k of ONBOARD_GAMES) assert.ok(GAMES[k], k);
});

test('steps run welcome to group, with a payoff after games, settle and math', () => {
  assert.equal(STEPS[0], 'welcome');
  assert.equal(STEPS.at(-1), 'group');
  assert.equal(nextStep('games'), 'p-games');
  assert.equal(nextStep('size'), 'settle');
  assert.equal(nextStep('p-math'), 'name');
  assert.equal(nextStep('group'), 'group');
  assert.equal(prevStep('games'), 'welcome');
  assert.equal(prevStep('welcome'), 'welcome');
  assert.equal(progressOf('welcome'), 0);
  assert.equal(progressOf('group'), 1);
  assert.ok(progressOf('size') > progressOf('games'));
});

test('Continue waits for an answer on each question', () => {
  assert.equal(answered('games', { games: [] }), false);
  assert.equal(answered('games', { games: ['skins'] }), true);
  assert.equal(answered('size', {}), false);
  assert.equal(answered('size', { size: '4' }), true);
  assert.equal(answered('settle', { settle: 'cash' }), true);
  assert.equal(answered('math', {}), false);
  assert.equal(answered('p-games', {}), true);
});

test('games keep the order they were tapped in', () => {
  let g = toggleGame([], 'wolf');
  g = toggleGame(g, 'skins');
  assert.deepEqual(g, ['wolf', 'skins']);
  assert.deepEqual(toggleGame(g, 'wolf'), ['skins']);
});

test('game lists read naturally', () => {
  assert.equal(gameList([]), 'Skins');
  assert.equal(gameList(['wolf']), 'Wolf');
  assert.equal(gameList(['wolf', 'skins']), 'Wolf and Skins');
  assert.equal(gameList(['wolf', 'skins', 'nassau', 'vegas']), 'Wolf, Skins and 2 more');
  assert.equal(gameList(['nope', 'match']), 'Match play');
});

test('the first game picked is the suggestion, and the rest go on the ballot', () => {
  assert.equal(suggestedGame({}), 'skins');
  assert.equal(suggestedGame({ games: ['nassau', 'skins'] }), 'nassau');
  assert.deepEqual(ballotGames({ games: ['nassau', 'skins'] }), ['skins']);
  const many = ballotGames({ games: ONBOARD_GAMES });
  assert.equal(many.length, MAX_BALLOT_GAMES - 1);
  assert.ok(!many.includes('skins'));
});

test('settle-up math is true for the group size', () => {
  assert.deepEqual(settleMath('4'), { people: 4, debts: 6, payments: 3 });
  assert.deepEqual(settleMath('8'), { people: 8, debts: 28, payments: 7 });
  assert.deepEqual(settleMath('12'), { people: 10, debts: 45, payments: 9 });
  assert.deepEqual(settleMath(undefined), { people: 4, debts: 6, payments: 3 });
});

test('payoffs speak to the answer, and never assume Venmo', () => {
  const g = payoff('p-games', { games: ['skins', 'wolf'] });
  assert.match(g.title, /Skins and Wolf/);
  assert.match(g.text, new RegExp(`all ${Object.keys(GAMES).length} games`));
  const app = payoff('p-settle', { settle: 'app' });
  assert.match(app.text, /Venmo, Cash App, PayPal or Zelle/);
  assert.match(payoff('p-settle', { settle: 'cash' }).title, /twenty/);
  assert.equal(payoff('p-settle', {}), null);
  assert.match(payoff('p-math', { math: 'me' }).title, /bank/);
  assert.equal(payoff('p-math', {}), null);
  assert.equal(payoff('size', { size: '4' }), null);
  for (const s of ['cash', 'tab', 'none']) assert.doesNotMatch(JSON.stringify(payoff('p-settle', { settle: s })), /Venmo/);
});

test('ready lines follow how they settle up', () => {
  assert.match(readyLines({ games: ['nassau'], settle: 'app' })[0], /Nassau/);
  assert.match(readyLines({ settle: 'app' })[2], /own app/);
  assert.match(readyLines({ settle: 'cash' })[2], /tab/);
});

test('the saved record drops unknown games', () => {
  const r = organizerRecord({ games: ['skins', 'bogus'], size: '4', settle: 'tab', math: 'me' }, 123);
  assert.deepEqual(r, { games: ['skins'], size: '4', settle: 'tab', math: 'me', at: 123 });
  assert.deepEqual(organizerRecord({}, 5), { games: [], size: null, settle: null, math: null, at: 5 });
});
