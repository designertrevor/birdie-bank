// Who keeps score in a shared round: one keeper who can hand off, read-only for the others,
// watchers never edit, and a player can take the card after 10 quiet minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEEPER_QUIET_MS, keeperOf, keeperMe, isKeeper, canEdit, keeperName, canTakeCard, handOffChoices,
  hostKeeper, handOff, keeperSaved, askForCard, clearAsk, openAsk, seatTaken, metaToSend,
} from './keeper.js';

const T0 = 1_800_000_000_000;
const players = [{ id: 'trev', name: 'Trevor Nielsen' }, { id: 'mike', name: 'Mike Hart' }, { id: 'dave', name: 'Dave Lo' }];
const shared = (extra = {}, host = true) => ({ id: 'r', status: 'active', hostName: 'Trevor', players, shared: { code: 'ABC123', host }, ...extra });

test('a round that isn\'t shared is always yours to edit', () => {
  const r = { id: 'r', status: 'active', players };
  assert.equal(canEdit(r, 'anyone', false), true);
  assert.equal(canEdit(r, null, false), true);
  assert.equal(keeperOf(r), null);
});

test('legacy: a shared round with no keeper yet edits on any player phone and the host, never a watcher', () => {
  const r = shared();
  assert.equal(canEdit(r, 'mike', false), true);
  assert.equal(canEdit(r, 'trev', true), true);
  assert.equal(canEdit(r, 'watcher', false), false);
  assert.equal(canEdit(r, null, false), false);
  // An organizer who isn't playing still edits from the phone that started it
  assert.equal(canEdit(r, 'org', true), true);
});

test('the keeper edits and the other players read', () => {
  const r = shared(handOff('mike', null, T0));
  assert.equal(canEdit(r, 'mike', false), true);
  assert.equal(canEdit(r, 'dave', false), false);
  // The host phone handed it off, so it reads too
  assert.equal(canEdit(r, 'trev', true), false);
  assert.equal(isKeeper(r, 'mike', false), true);
  assert.equal(isKeeper(r, 'trev', true), false);
  assert.equal(keeperName(r), 'Mike');
});

test('keeper id null: the phone that started the round keeps score, playing or not', () => {
  const r = shared(hostKeeper(T0));
  assert.equal(canEdit(r, 'org', true), true);
  assert.equal(canEdit(r, 'trev', true), true);
  assert.equal(canEdit(r, 'trev', false), false); // Trevor's seat taken on some other phone
  assert.equal(canEdit(r, 'mike', false), false);
  assert.equal(isKeeper(r, 'org', true), true);
  assert.equal(keeperName(r), 'Trevor');
  assert.equal(keeperName({ ...r, hostName: '' }), 'The organizer');
});

test('watchers never edit, even a finished round, and players can fix a finished round as before', () => {
  const done = shared({ status: 'done', ...handOff('mike', null, T0) }, false);
  assert.equal(canEdit(done, 'watcher', false), false);
  assert.equal(canEdit(done, 'dave', false), true);
  assert.equal(canEdit(done, 'trev', true), true);
});

test('keeperMe: the host phone is the organizer; a joined phone is its seat, and a watcher is nobody', () => {
  const state = { me: 'mike' };
  assert.equal(keeperMe(shared({}, true), state), 'mike');
  assert.equal(keeperMe({ ...shared({}, false), localMe: 'dave' }, state), 'dave');
  // A watcher whose own id happens to be a player in this round is still a watcher
  assert.equal(keeperMe({ ...shared({}, false), localMe: null }, state), null);
  assert.equal(keeperMe({ id: 'r', players }, state), 'mike');
});

test('take the card: only after 10 minutes with no save, only a player who isn\'t the keeper', () => {
  const r = shared(handOff('mike', null, T0));
  assert.equal(canTakeCard(r, 'dave', T0 + KEEPER_QUIET_MS - 1), false);
  assert.equal(canTakeCard(r, 'dave', T0 + KEEPER_QUIET_MS), true);
  assert.equal(canTakeCard(r, 'mike', T0 + KEEPER_QUIET_MS * 3), false); // the keeper
  assert.equal(canTakeCard(r, 'watcher', T0 + KEEPER_QUIET_MS * 3), false);
  // A save starts the clock again
  const saved = { ...r, ...keeperSaved(r, T0 + 9 * 60000) };
  assert.equal(canTakeCard(saved, 'dave', T0 + KEEPER_QUIET_MS), false);
  assert.equal(canTakeCard(saved, 'dave', T0 + 19 * 60000), true);
  // Not once the round is finished or being fixed, and not in a round with no keeper
  assert.equal(canTakeCard({ ...r, status: 'done' }, 'dave', T0 + KEEPER_QUIET_MS * 3), false);
  assert.equal(canTakeCard({ ...r, editing: true }, 'dave', T0 + KEEPER_QUIET_MS * 3), false);
  assert.equal(canTakeCard(shared(), 'dave', T0 + KEEPER_QUIET_MS * 3), false);
});

test('take the card: clock skew between phones', () => {
  const r = shared(handOff('mike', null, T0));
  // The keeper's clock runs 5 minutes fast: its save looks like it's in the future, so it counts as just now
  const fast = { ...r, ...keeperSaved(r, T0 + 5 * 60000) };
  assert.equal(canTakeCard(fast, 'dave', T0 + 60000), false);
  // The keeper's clock runs 20 minutes slow: this phone heard the save a minute ago by its own clock
  const slow = { ...r, ...keeperSaved(r, T0 - 20 * 60000) };
  assert.equal(canTakeCard(slow, 'dave', T0 + 60000), true);
  assert.equal(canTakeCard(slow, 'dave', T0 + 60000, T0), false);
  assert.equal(canTakeCard(slow, 'dave', T0 + KEEPER_QUIET_MS, T0), true);
});

test('hand off: players on the app can take it, watchers are never listed, and an ask clears', () => {
  let r = shared({ ...hostKeeper(T0), ...seatTaken(shared(), 'trev', T0) });
  r = { ...r, ...seatTaken(r, 'mike', T0 + 1), ...seatTaken(r, 'watcher', T0 + 2) };
  assert.deepEqual(r.onApp, { trev: T0, mike: T0 + 1 });
  assert.deepEqual(handOffChoices(r).map(c => [c.id, c.onApp]), [['trev', true], ['mike', true], ['dave', false]]);
  r = { ...r, ...askForCard('mike', T0 + 5) };
  assert.deepEqual(openAsk(r), { by: 'mike', at: T0 + 5 });
  r = { ...r, ...handOff('mike', null, T0 + 10, 6) };
  assert.equal(openAsk(r), null);
  assert.deepEqual(keeperOf(r), { id: 'mike', since: T0 + 10, by: null, lastSaveAt: T0 + 10, hole: 6 });
  // The keeper isn't offered to themselves
  assert.deepEqual(handOffChoices(r).map(c => c.id), ['trev', 'dave']);
  // An ask from the keeper, or from someone not playing, isn't an ask
  assert.equal(openAsk({ ...r, ...askForCard('mike') }), null);
  assert.equal(openAsk({ ...r, ...askForCard('watcher') }), null);
  assert.deepEqual(clearAsk(), { cardAsk: null });
});

test('metaToSend: a phone not keeping score can only send the keeper, the ask, who is on the app and its own payment app', () => {
  const base = { game: 'wolf', settings: { wolf: { point: 1 } }, players: [{ id: 'mike', name: 'Mike' }, { id: 'dave', name: 'Dave' }], keeper: { id: 'mike' } };
  const local = { game: 'skins', settings: { wolf: { point: 9 } }, players: [{ id: 'mike', name: 'Mikey' }, { id: 'dave', name: 'Dave', payApp: 'venmo', payHandle: '@dave' }], keeper: { id: 'dave' }, cardAsk: { by: 'dave', at: 1 }, onApp: { dave: 1 } };
  const sent = metaToSend(base, local, { editor: false, me: 'dave' });
  assert.equal(sent.game, 'wolf');
  assert.deepEqual(sent.settings, base.settings);
  assert.deepEqual(sent.players, [{ id: 'mike', name: 'Mike' }, { id: 'dave', name: 'Dave', payApp: 'venmo', payHandle: '@dave' }]);
  assert.deepEqual(sent.keeper, { id: 'dave' });
  assert.deepEqual(sent.cardAsk, { by: 'dave', at: 1 });
  assert.deepEqual(sent.onApp, { dave: 1 });
  assert.equal(metaToSend(base, local, { editor: true, me: 'dave' }), local);
  assert.equal(metaToSend(null, local, { editor: false, me: 'dave' }), null);
});
