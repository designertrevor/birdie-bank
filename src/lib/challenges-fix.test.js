// Challenges review fixes (2026-10-04): an answer of your own heard after the round went in with one
// put in for you never undoes it (so one agreed challenge is one side bet), a challenge already in a
// round on this phone never goes into another, and a round kept for another day carries each
// challenge to the right person or leaves it waiting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { newPlan } from './plans.js';
import {
  canMove, challengeNextText, challengeState, challengeView, challengesForRound, lateAnswers, mergeMoves, moveIdFor, movedKeys, newChallenge, proxyNote, withMove,
} from './challenges.js';

const DAY = 864e5;
const NOW = new Date(2026, 9, 3, 9).getTime();
const COURSE = { id: 'c1', name: 'X', city: 'Y', tees: [], holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const SET = { hcPct: 100, skins: { value: 2, carryover: true } };
const twoRound = id => createRound({ id, game: 'skins', course: COURSE, holesCount: 18, players: [{ id: 'me', name: 'Trevor' }, { id: 'mike', name: 'Mike' }], settings: SET });

/** Trevor marks Mike in, Mike counters $10 from his own phone (no signal), Trevor starts the round at $20, then they sync. */
function race() {
  const made = newChallenge({ id: 'c1', from: { who: 'me', name: 'Trevor' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, now: NOW - DAY });
  let t = { ...made, mine: 'from', made: true, code: 'CH1' };
  let m = { ...made, mine: 'to', made: false, code: 'CH1' };
  t = withMove(t, { id: moveIdFor('a1', true), side: 'to', move: 'accept', at: NOW - 3600e3 });
  m = { ...m, moves: mergeMoves(m.moves, t.moves) };
  m = withMove(m, { id: 'own1', side: 'to', move: 'counter', stake: 10, at: NOW - 1800e3 });
  t = withMove(t, { id: 'on1', side: 'keeper', move: 'on', roundId: 'r1', at: NOW });
  const all = mergeMoves(t.moves, m.moves);
  return { t: { ...t, moves: all }, m: { ...m, moves: all } };
}

test('an own answer heard after the round went in with the one put in for you leaves it in the round', () => {
  const { t, m } = race();
  for (const ch of [t, m]) {
    const s = challengeState(ch);
    assert.equal(s.status, 'on');
    assert.equal(s.stake, 20);
    assert.equal(s.roundId, 'r1');
  }
  // Nobody can take it up again, so it never goes into a second round
  assert.equal(canMove(t, 'from', 'accept'), false);
  const state = { me: 'me', players: { mike: { id: 'mike', name: 'Mike' } }, challenges: { c1: t }, rounds: {} };
  assert.deepEqual(challengesForRound(state, twoRound('r2'), { now: NOW + DAY }), []);
  // Mike's phone says his answer came too late, and where to change the amount
  assert.equal(lateAnswers(m, 'to').length, 1);
  assert.match(proxyNote({ me: 'x', players: {} }, m, 'to'), /came after the round started, so it’s in at \$20/);
  assert.equal(proxyNote({ me: 'me', players: {} }, t, 'from'), null);
});

test('an own answer before the round went in still wins over the one put in for them', () => {
  const made = newChallenge({ id: 'c1', from: { who: 'me', name: 'Trevor' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, now: NOW - DAY });
  let ch = withMove(made, { id: moveIdFor('a1', true), side: 'to', move: 'accept', at: NOW - 3600e3 });
  ch = { ...ch, moves: mergeMoves(ch.moves, [{ id: 'own1', side: 'to', move: 'counter', stake: 10, at: NOW - 1800e3 }]) };
  assert.equal(challengeState(ch).status, 'countered');
  assert.equal(challengeState(ch).stake, 10);
  assert.deepEqual(lateAnswers(ch, 'to'), []);
});

test('a challenge already in a round on this phone never goes into another', () => {
  const made = newChallenge({ id: 'c1', from: { who: 'me', name: 'Trevor' }, to: { who: 'mike', name: 'Mike' }, kind: 'match', stake: 20, now: NOW - DAY });
  const ch = withMove({ ...made, mine: 'from', made: true }, { id: 'acc', side: 'to', move: 'accept', at: NOW - 3600e3 });
  const r1 = { ...twoRound('r1'), bets: [{ id: 'ch_c1', kind: 'match', stake: 20, players: ['me', 'mike'] }] };
  const state = { me: 'me', players: { mike: { id: 'mike', name: 'Mike' } }, challenges: { c1: ch }, rounds: { r1 } };
  assert.deepEqual(challengesForRound(state, twoRound('r2'), { now: NOW }), []);
  assert.equal(challengesForRound({ ...state, rounds: {} }, twoRound('r2'), { now: NOW }).length, 1);
});

test('a round kept for another day carries each challenge by id, never to someone else by the same name', () => {
  const plan = (id, people) => newPlan({ id, hostName: 'Trevor', game: 'skins', holesCount: 18, date: '2026-10-10', teeTime: '08:00', course: COURSE, people, ballot: { games: [], bets: [5] }, suggestedBet: 5, settings: SET, now: NOW });
  // Joe came in from the link (w_x) and got p_joe at the roll call; a different Joe is on the new plan too
  const a = { ...plan('pl1', [{ id: 'dave', name: 'Dave' }]), code: 'PLAN01', status: 'started', roundId: 'r1', rollIds: { w_x: 'p_joe', dave: 'dave' } };
  a.answers.w_x = { name: 'Joe', status: 'in', at: 2 };
  const b = { ...plan('pl2', [{ id: 'dave', name: 'Dave' }, { id: 'p_joe', name: 'Joe' }, { id: 'p_joe2', name: 'Joe' }]), code: 'PLAN02' };
  assert.equal(movedKeys(a, b).w_x, 'p_joe');
  // No roll call kept (a plan from before): the only Joe on each plan
  const { rollIds: _r, ...legacy } = a;
  assert.equal(movedKeys(legacy, { ...b, people: b.people.filter(p => p.id !== 'p_joe2') }).w_x, 'p_joe');
  // Two Joes on the new plan, or the old Joe's not on it but another one is: nobody's guessed
  assert.equal(movedKeys(legacy, b).w_x, undefined);
  const c = { ...plan('pl3', [{ id: 'dave', name: 'Dave' }, { id: 'p_other', name: 'Joe' }]), code: 'PLAN03' };
  assert.equal(movedKeys(a, c).w_x, undefined, 'the roll call says who Joe was, and he isn’t on it');
  // The challenge waits on the new plan, and says why
  const ch = withMove(newChallenge({ id: 'c1', from: { who: 'w_x', name: 'Joe' }, to: { who: 'dave', name: 'Dave' }, kind: 'match', stake: 20, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' }, now: NOW - DAY }), { id: 'acc', side: 'to', move: 'accept', at: NOW - 3600e3 });
  const moved = { ...c, movedFrom: [{ id: 'pl1', code: 'PLAN01', keys: movedKeys(a, c) }] };
  const state = { me: 'me', players: {}, plans: { pl1: a, pl3: moved }, challenges: { c1: ch } };
  const view = challengeView(state, ch);
  assert.deepEqual(view.waitingFor, ['Joe']);
  assert.match(challengeNextText(state, view, NOW), /Joe isn’t on the new plan yet/);
});
