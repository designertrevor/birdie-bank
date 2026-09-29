// Named usuals: saved from a round, set up again the same way, capped at 5, and kept safe in sync.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { rematchSetup } from './rematch.js';
import {
  MAX_USUALS, addUsual, canAddUsual, defaultName, deleteUsual, markUsualPlayed, matchingUsual, renameUsual, sameAs, setupFromUsual,
  sortedUsuals, usualFromRound, usualsOf,
} from './usuals.js';
import { applyDoc, toDocs } from './cloud-model.js';

const course = {
  id: 'cc_pebble', name: 'Pebble Creek', city: 'Town', custom: true,
  tees: [{ name: 'White', color: '#fff', rating: 70, slope: 120 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, nassau: { front: 5, back: 5, total: 5 }, dots: { value: 1, auto: true, kinds: { greenie: true } } };

function baseState() {
  const players = {
    me: { id: 'me', name: 'Trevor Nielsen', index: 8 },
    dave: { id: 'dave', name: 'Dave Smith', index: 12 },
    al: { id: 'al', name: 'Al Brown', index: 4 },
  };
  const round = createRound({
    id: 'r1', game: 'skins', course, holesCount: 18, nine: 'front',
    players: Object.values(players).map(p => ({ ...p, tee: 'White', courseHcOverride: p.id === 'dave' ? 14 : undefined })),
    settings: SETTINGS, hcPct: 90,
  });
  round.status = 'done';
  round.finishedAt = Date.UTC(2026, 8, 26, 18);
  round.sideGames = [{ game: 'dots', settings: { value: 1, auto: true, kinds: { greenie: true } } }];
  return { me: 'me', players, customCourses: { [course.id]: course }, rounds: { r1: round }, settings: SETTINGS, usuals: [] };
}

test('default name is the game at the course', () => {
  const s = baseState();
  assert.equal(defaultName(s.rounds.r1), 'Skins at Pebble Creek');
});

test('a usual loads the same setup as running the round back', () => {
  const s = baseState();
  const u = usualFromRound(s, s.rounds.r1, { id: 'u1', now: 1 });
  assert.equal(u.name, 'Skins at Pebble Creek');
  assert.deepEqual(u.players, ['me', 'dave', 'al']);
  assert.equal(u.lastPlayedAt, s.rounds.r1.finishedAt);
  const fromUsual = setupFromUsual(s, u);
  const rematch = rematchSetup(s, s.rounds.r1);
  assert.deepEqual(fromUsual, rematch);
  assert.equal(fromUsual.step, 3);
  assert.equal(fromUsual.hcPct, 90);
  assert.deepEqual(fromUsual.hcOverride, { dave: 14 });
  assert.equal(fromUsual.sideGames[0].game, 'dots');
  // Saved through JSON (localStorage, the profile doc) it still loads the same
  assert.deepEqual(setupFromUsual(s, JSON.parse(JSON.stringify(u))), rematch);
});

test('a missing course opens on the course step, a missing player on the players', () => {
  const s = baseState();
  const u = usualFromRound(s, s.rounds.r1, { id: 'u1' });
  const noCourse = { ...s, customCourses: {} };
  assert.equal(setupFromUsual(noCourse, u).step, 1);
  assert.equal(setupFromUsual(noCourse, u).courseId, null);
  const { dave: _gone, ...rest } = s.players;
  const noDave = { ...s, players: rest };
  const setup = setupFromUsual(noDave, u);
  assert.equal(setup.step, 2);
  assert.deepEqual(setup.picked, ['me', 'al']);
  assert.deepEqual(setup.missing, ['Dave Smith']);
  assert.deepEqual(setup.hcOverride, {});
  // A game that no longer exists can't be set up
  assert.equal(setupFromUsual(s, { ...u, game: 'gone' }), null);
});

test('at most 5 usuals, no duplicates, rename and delete', () => {
  const s = baseState();
  const u = usualFromRound(s, s.rounds.r1, { id: 'u1' });
  assert.equal(addUsual(s, u), 'saved');
  assert.equal(addUsual(s, { ...u, id: 'u1b', name: 'Other name' }), 'same');
  for (let i = 2; i <= MAX_USUALS; i++) assert.equal(addUsual(s, { ...u, id: `u${i}`, holesCount: 9, nine: 'front', players: [`p${i}`] }), 'saved');
  assert.equal(usualsOf(s).length, 5);
  assert.equal(canAddUsual(s), false);
  assert.equal(addUsual(s, { ...u, id: 'u6', players: ['me'] }), 'full');
  assert.equal(usualsOf(s).length, 5);
  renameUsual(s, 'u1', '  Saturday skins  ');
  assert.equal(usualsOf(s)[0].name, 'Saturday skins');
  renameUsual(s, 'u1', '   ');
  assert.equal(usualsOf(s)[0].name, 'Saturday skins');
  deleteUsual(s, 'u3');
  assert.equal(usualsOf(s).length, 4);
  assert.equal(canAddUsual(s), true);
});

test('sameAs ignores names and player order, not bets', () => {
  const s = baseState();
  const u = usualFromRound(s, s.rounds.r1, { id: 'u1' });
  assert.equal(sameAs(u, { ...u, id: 'x', name: 'x', players: [...u.players].reverse() }), true);
  assert.equal(sameAs(u, { ...u, bets: { ...u.bets, value: 5 } }), false);
  assert.equal(sameAs(u, { ...u, sideGames: undefined }), false);
  addUsual(s, u);
  assert.equal(matchingUsual(s, s.rounds.r1)?.id, 'u1');
});

test('finishing a round started from a usual updates when it was last played', () => {
  const s = baseState();
  addUsual(s, usualFromRound(s, s.rounds.r1, { id: 'u1', now: 1 }));
  addUsual(s, { ...usualFromRound(s, s.rounds.r1, { id: 'u2', now: 2 }), players: ['me'], lastPlayedAt: null });
  markUsualPlayed(s, { usualId: 'u2' }, 99e12);
  assert.equal(usualsOf(s).find(u => u.id === 'u2').lastPlayedAt, 99e12);
  assert.deepEqual(sortedUsuals(s).map(u => u.id), ['u2', 'u1']);
  markUsualPlayed(s, { usualId: null }, 5);
  assert.equal(usualsOf(s).find(u => u.id === 'u1').lastPlayedAt, s.rounds.r1.finishedAt);
});

test('usuals sync in the profile doc, and an older profile without them keeps them', () => {
  const s = baseState();
  addUsual(s, usualFromRound(s, s.rounds.r1, { id: 'u1' }));
  assert.equal(toDocs({ ...s, crews: {}, settlements: [], favorites: [] })['profile:me'].data.usuals.length, 1);
  const draft = structuredClone({ ...s, favorites: [] });
  applyDoc(draft, 'profile', 'me', { me: 'me', onboarded: true, settings: {}, favorites: [] });
  assert.equal(draft.usuals.length, 1);
  applyDoc(draft, 'profile', 'me', { me: 'me', onboarded: true, settings: {}, favorites: [], usuals: [] });
  assert.equal(draft.usuals.length, 0);
  // A state from before usuals existed reads as an empty list
  assert.deepEqual(usualsOf({}), []);
  assert.deepEqual(usualsOf({ usuals: { bad: 1 } }), []);
});

test('review: a hole fix on a course that came with the app keeps usuals and rematches finding it', async () => {
  const { allCourses, courseWithHoleFix } = await import('./courses.js');
  const { rematchSetup } = await import('./rematch.js');
  const { setupFromUsual } = await import('./usuals.js');
  const { usualRound } = await import('./rounds.js');
  const real = allCourses({ customCourses: {} })[0];
  const copy = courseWithHoleFix(real, 0, { par: real.holes[0].par === 3 ? 4 : 3 }, { builtIn: true });
  const players = { me: { id: 'me', name: 'Trevor' }, mike: { id: 'mike', name: 'Mike' } };
  const r = { id: 'r1', game: 'skins', status: 'done', createdAt: 1, course: { id: real.id, name: real.name }, holesCount: 18, nine: 'front',
    players: [{ id: 'me', name: 'Trevor' }, { id: 'mike', name: 'Mike' }], settings: {}, holes: [], scores: {} };
  const state = { me: 'me', players, rounds: { r1: r }, customCourses: { [copy.id]: copy.course }, settings: {}, usuals: [] };
  assert.equal(rematchSetup(state, r)?.courseId, copy.id);
  assert.equal(usualRound(state)?.course.id, copy.id);
  const usual = { id: 'u1', game: 'skins', courseId: real.id, holesCount: 18, nine: 'front', players: ['me', 'mike'], settings: {} };
  assert.equal(setupFromUsual(state, usual)?.courseId, copy.id);
});
