import test from 'node:test';
import assert from 'node:assert/strict';
import { planFaces, planSeatAvatar, stampPlanFaces } from './plan-faces.js';
import { avatarFor } from './avatars.js';

// Trevor's phone: his own face in his profile, Riley's and Tyler's on their player cards
const CAP = { kind: 'buddy', id: 'snapback', bg: 'lav' };
const SHADES = { kind: 'buddy', id: 'shades', bg: 'pink' };
const COWBOY = { kind: 'buddy', id: 'cowboy', bg: 'lav' };
const trevorPhone = () => ({
  me: 'p_trevor',
  profile: { avatar: CAP },
  players: {
    p_trevor: { id: 'p_trevor', name: 'Trevor' },
    p_riley: { id: 'p_riley', name: 'Riley', avatar: SHADES },
    p_tyler: { id: 'p_tyler', name: 'Tyler', avatar: COWBOY },
    p_cody: { id: 'p_cody', name: 'Cody' },
  },
  rounds: {},
});
const plan = () => ({
  id: 'pl_1', host: true, hostWho: 'host', hostName: 'Trevor',
  people: [{ id: 'host', name: 'Trevor' }, { id: 'p_riley', name: 'Riley' }, { id: 'p_tyler', name: 'Tyler' }, { id: 'p_cody', name: 'Cody' }],
});

// What an <Avatar> shows for these props on a phone with `state`
const shown = (state, { id, seat }) => avatarFor(state, id, seat);

test('the organizer stamps their own face and everyone else it knows', () => {
  const p = stampPlanFaces(trevorPhone(), plan());
  assert.deepEqual(p.hostAvatar, CAP);
  assert.deepEqual(p.faces, { p_riley: SHADES, p_tyler: COWBOY });
  assert.equal(planFaces(trevorPhone(), { ...plan(), people: [{ id: 'host' }, { id: 'p_cody' }] }), null);
  // A friend's copy is never stamped from the friend's phone
  const friendCopy = { ...plan(), host: false };
  assert.equal(stampPlanFaces(trevorPhone(), friendCopy).faces, undefined);
});

test("each person shows their own face on the organizer's phone", () => {
  const s = trevorPhone();
  const p = stampPlanFaces(s, plan());
  assert.deepEqual(shown(s, planSeatAvatar(p, 'host', s.me)), CAP);
  assert.deepEqual(shown(s, planSeatAvatar(p, 'p_riley', s.me)), SHADES);
  assert.deepEqual(shown(s, planSeatAvatar(p, 'p_tyler', s.me)), COWBOY);
});

test("each person shows their own face on a friend's phone (Riley's, from Trevor's link)", () => {
  const stamped = stampPlanFaces(trevorPhone(), plan());
  // Riley's phone: her own ids, her own face in her profile, a Tyler of her own with another id
  const riley = {
    me: 'r_me', profile: { avatar: SHADES },
    players: { r_me: { id: 'r_me', name: 'Riley' }, r_tyler: { id: 'r_tyler', name: 'Tyler' }, p_tyler: { id: 'p_tyler', name: 'Someone else', avatar: { kind: 'buddy', id: 'beanie', bg: 'mint' } } },
    rounds: {},
  };
  const p = { ...stamped, host: false, localMe: 'p_riley' };
  // Trevor is his own red cap, not a face his name hashes to
  assert.deepEqual(shown(riley, planSeatAvatar(p, 'host', riley.me)), CAP);
  assert.deepEqual(shown(riley, planSeatAvatar(p, undefined, riley.me)), CAP);
  // Riley (you) is Riley, never the organizer
  assert.deepEqual(shown(riley, planSeatAvatar(p, 'p_riley', riley.me)), SHADES);
  // Tyler is the face Trevor's phone has for him, even though Riley's phone has a p_tyler of its own
  assert.deepEqual(shown(riley, planSeatAvatar(p, 'p_tyler', riley.me)), COWBOY);
});

test("a friend with no face of their own shows the one the organizer has for them", () => {
  const stamped = stampPlanFaces(trevorPhone(), plan());
  const guest = { me: null, profile: {}, players: {}, rounds: {} };
  const p = { ...stamped, host: false, localMe: 'p_riley' };
  assert.deepEqual(shown(guest, planSeatAvatar(p, 'p_riley', guest.me)), SHADES);
});

test('a plan shared before faces were carried falls back without swapping anyone', () => {
  const old = { ...plan(), host: false, localMe: 'p_riley' };
  assert.deepEqual(planSeatAvatar(old, 'host', 'r_me'), { id: null, seat: null });
  assert.deepEqual(planSeatAvatar(old, 'p_riley', 'r_me'), { id: 'r_me', seat: null });
  assert.deepEqual(planSeatAvatar(old, 'p_tyler', 'r_me'), { id: 'p_tyler', seat: null });
});
