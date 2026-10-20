// Setup's pure helpers (setup-screen.js), moved out of NewRound.jsx when it was split up: last time's
// bets laid over the defaults, names in a list, the next Saturday, the bet vote's neighbours, a
// plan's roll call as a setup, the challenge note, a day chip's name, tee counts and plain holes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betChoices, isoDate, newPlan } from './plans.js';
import { challengeNote, dayName, listNames, nearbyBets, nextSaturday, plainHoles, planSetup, teeCount, withBets } from './setup-screen.js';

test('an earlier round’s bets and handicap percentage go over the setup options', () => {
  const opts = { hcPct: 100, skins: { value: 2 }, nassau: { front: 5 } };
  assert.equal(withBets(opts, null), opts, 'nothing to lay over');
  const out = withBets(opts, { game: 'skins', bets: { value: 5 }, hcPct: 80, halfStrokes: 1 });
  assert.deepEqual(out, { hcPct: 80, skins: { value: 5 }, nassau: { front: 5 }, halfStrokes: true });
  // No bets kept: only the percentage (or the options' own) and half strokes off
  assert.deepEqual(withBets(opts, { game: 'skins' }), { ...opts, halfStrokes: false });
  const bets = { value: 5 };
  assert.notEqual(withBets(opts, { game: 'skins', bets }).skins, bets, 'a copy, never the round’s own');
});

test('names read as a list', () => {
  assert.equal(listNames([]), '');
  assert.equal(listNames(['Dave']), 'Dave');
  assert.equal(listNames(['Dave', 'Mike']), 'Dave and Mike');
  assert.equal(listNames(['Dave', 'Mike', 'Sam']), 'Dave, Mike and Sam');
});

test('a plan is for next Saturday, today when it’s Saturday', () => {
  assert.equal(nextSaturday(new Date(2026, 9, 20)), '2026-10-24'); // a Tuesday
  assert.equal(nextSaturday(new Date(2026, 9, 24)), '2026-10-24');
  assert.equal(nextSaturday(new Date(2026, 9, 25)), '2026-10-31');
  assert.equal(nextSaturday(new Date(2026, 11, 28)), '2027-01-02', 'over the new year');
});

test('the bet vote puts the amounts around the suggestion on the ballot', () => {
  for (const bet of [1, 5, 20]) {
    assert.ok(!nearbyBets(bet).includes(bet));
    assert.deepEqual(nearbyBets(bet), betChoices(bet).filter(b => b !== bet));
  }
});

test('a planned round’s roll call fills setup in', () => {
  const settings = { hcPct: 100, skins: { value: 2, carryover: true } };
  const plan = newPlan({
    id: 'pl', hostName: 'Ann', game: 'skins', holesCount: 9, date: '2026-10-24', course: { id: 'f9', name: 'Flat' },
    people: [{ id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }], settings, suggestedBet: 2, now: 1,
  });
  const course = { id: 'f9', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
  const players = { a: { id: 'a', name: 'Ann', index: 0 }, b: { id: 'b', name: 'Bo', index: 0 }, c: { id: 'c', name: 'Cy', index: 0 } };
  const state = { me: 'a', players, settings, plans: { pl: plan }, rounds: {}, customCourses: { f9: course } };
  assert.equal(planSetup(state, 'nope', [], () => 'p_new'), null, 'a plan that is gone');
  const s = planSetup(state, 'pl', [plan.hostWho, 'b', 'c'], () => 'p_new');
  assert.equal(s.game, 'skins');
  assert.equal(s.courseId, 'f9');
  assert.deepEqual(s.picked, ['a', 'b', 'c']);
  assert.equal(s.step, 3, 'everything is in: straight to the bets');
  // The course isn't on this phone: the course step
  assert.equal(planSetup({ ...state, customCourses: {} }, 'pl', [plan.hostWho, 'b', 'c'], () => 'p_new').step, 1);
  // Only the host came: the players step, since Skins needs two
  assert.equal(planSetup(state, 'pl', [plan.hostWho], () => 'p_new').step, 2);
});

test('the challenges setup brought in are named in one line', () => {
  const round = { players: [{ id: 'a', name: 'Dave Lee' }, { id: 'b', name: 'Mike Ray' }, { id: 'c', name: 'Sam Doe' }] };
  assert.equal(challengeNote(round, [{ id: 'b1', sides: ['a', 'b'] }]), '', 'a side bet made here is not a challenge');
  const one = challengeNote(round, [{ id: 'ch_x1', sides: ['a', 'b'] }]);
  const two = challengeNote(round, [{ id: 'ch_x1', sides: ['a', 'b'] }, { id: 'ch_x2', sides: ['b', 'c'] }]);
  assert.equal(one, 'Dave and Mike’s challenge is in as a side bet. Tap it to change it, or take it off for today.');
  assert.equal(two, 'Dave and Mike’s and Mike and Sam’s challenges are in as side bets. Tap one to change it, or take it off for today.');
  // A challenge with someone not in the round any more is left out
  assert.equal(challengeNote(round, [{ id: 'ch_x3', sides: ['a', 'z'] }]), '');
});

test('a day chip says its day in full, and today and tomorrow say so', () => {
  const now = new Date();
  const today = isoDate(now);
  const tmrw = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  assert.match(dayName(today), /^Today, /);
  assert.match(dayName(tmrw), /^Tomorrow, /);
  assert.equal(dayName('2020-10-03'), 'Saturday, October 3');
});

test('tee counts and plain holes', () => {
  assert.equal(teeCount(1), '1 tee');
  assert.equal(teeCount(4), '4 tees');
  assert.deepEqual(plainHoles(9, 'front').map(h => h.no), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(plainHoles(9, 'back').map(h => h.no), [10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.equal(plainHoles(18, 'back').length, 18);
  assert.equal(plainHoles(18, 'back')[0].no, 1, 'the back nine only counts on a nine');
});
