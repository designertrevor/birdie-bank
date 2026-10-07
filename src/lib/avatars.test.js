// Ball buddies avatars: the choice model (buddy, photo, initials), whose avatar shows for a person
// by any of their ids, no twins in a group, and the avatars a new round carries. No money changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { addRound } from './rounds.js';
import { payInfoFor } from './pay.js';
import { normalizeAvatar } from './profile-model.js';
import {
  BACKDROPS, BUDDIES, FALLBACK_TINTS, autoBuddyFor, avatarFor, avatarLabel, avatarModel, buddyAvatar, initialsAvatar,
  initialsOf, noTwins, personKey, photoAllowed, shareableAvatar, stampAvatars, tintFor,
} from './avatars.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const stateOf = (extra = {}) => ({
  me: 't', onboarded: true, players: { t: { id: 't', name: 'Trevor Nielsen' }, sam: { id: 'sam', name: 'Sam' }, ann: { id: 'ann', name: 'Ann' } },
  crews: {}, rounds: {}, settlements: [], links: {}, unlinks: [], profile: {}, accountOf: {}, profiles: {}, ...extra,
});
const PHOTO = { kind: 'photo', url: 'https://x.supabase.co/storage/v1/object/public/avatars/u/1.jpg', path: 'u/1.jpg' };
const PENDING = { kind: 'photo', url: 'data:image/jpeg;base64,AAAA', pending: true };

// ------------------------------- the choice model ---------------------------

test('choices: a good set of buddies, each with its own backdrop, and every backdrop readable', () => {
  assert.ok(BUDDIES.length >= 12, 'at least twelve buddies');
  assert.equal(new Set(BUDDIES.map(b => b.id)).size, BUDDIES.length, 'ids are unique');
  const bgs = new Set(BACKDROPS.map(b => b.id));
  for (const b of BUDDIES) assert.ok(bgs.has(b.bg), `${b.id} starts on a known backdrop`);
  for (const b of BACKDROPS) assert.match(b.hex, /^#[0-9a-f]{6}$/);
  assert.equal(BACKDROPS.find(b => b.id === 'teal').ink, '#ffffff', 'teal takes white initials');
  assert.ok(FALLBACK_TINTS.every(t => bgs.has(t)));
});

test('choices: a buddy keeps its backdrop, an unknown backdrop falls back to the buddy’s own', () => {
  assert.deepEqual(buddyAvatar('visor', 'teal'), { kind: 'buddy', id: 'visor', bg: 'teal' });
  assert.deepEqual(buddyAvatar('visor', 'neon'), { kind: 'buddy', id: 'visor', bg: 'peach' });
  assert.equal(buddyAvatar('jetpack'), null, 'an unknown buddy is no avatar');
  assert.deepEqual(initialsAvatar('mint', 2), { kind: 'initials', bg: 'mint', letters: 2 });
  assert.deepEqual(initialsAvatar('neon', 5), { kind: 'initials', bg: 'lav', letters: 1 });
});

test('choices: buddies and initials survive the profile cleaning (and its server round trip)', () => {
  assert.deepEqual(normalizeAvatar(buddyAvatar('crown', 'pink')), { kind: 'buddy', id: 'crown', bg: 'pink' });
  assert.deepEqual(normalizeAvatar({ kind: 'initials', bg: 'mint', letters: 2 }), { kind: 'initials', bg: 'mint', letters: 2 });
  assert.deepEqual(normalizeAvatar({ kind: 'initials', letters: 7 }), { kind: 'initials' }, 'bad letters are dropped');
  assert.equal(normalizeAvatar({ kind: 'emoji', value: 'x' }), null);
});

test('drawing: photo first, then a buddy, then initials on a pastel that stays the same for a person', () => {
  assert.equal(avatarModel(PHOTO, { name: 'Sam' }).kind, 'photo');
  assert.equal(avatarModel(PHOTO, { name: 'Sam' }).text, 'S', 'a photo keeps initials for when it won’t load');
  assert.deepEqual(avatarModel(buddyAvatar('beanie'), { name: 'Sam' }), { kind: 'buddy', buddy: 'beanie', bg: 'teal' });
  const a = avatarModel(null, { name: 'Sam', key: 'p_sam' });
  assert.equal(a.kind, 'buddy', 'nobody picked: a Ball buddy, not letters');
  assert.equal(a.auto, true);
  assert.equal(a.buddy, autoBuddyFor('p_sam').id);
  assert.ok(BUDDIES.find(b => b.id === a.buddy).shelf === 'buddies', 'a hat buddy, never a critter');
  assert.deepEqual(avatarModel(null, { name: 'Sam', key: 'p_sam' }), a, 'the same every time');
  assert.deepEqual(avatarModel(null, { name: '', key: '' }), { kind: 'initials', text: '?', bg: tintFor('') }, 'nothing to go on: a question mark');
  assert.equal(avatarModel({ kind: 'initials', bg: 'coral', letters: 2 }, { name: 'Trevor Nielsen' }).text, 'TN');
  assert.equal(avatarModel({ kind: 'initials', bg: 'coral', letters: 2 }, { name: 'Trevor Nielsen' }).bg, 'coral');
  // A buddy from a newer app shows as initials on its backdrop
  assert.deepEqual(avatarModel({ kind: 'buddy', id: 'jetpack', bg: 'mint' }, { name: 'Sam' }), { kind: 'initials', text: 'S', bg: 'mint' });
  assert.notEqual(avatarModel({ kind: 'photo', url: 'http://plain.example/x.jpg' }, { name: 'Sam' }).kind, 'photo', 'only https or a picture data link');
});

test('initials: one or two letters, and something for no name', () => {
  assert.equal(initialsOf('Trevor Nielsen'), 'T');
  assert.equal(initialsOf('Trevor Nielsen', 2), 'TN');
  assert.equal(initialsOf('  bo  ', 2), 'B');
  assert.equal(initialsOf('Ann Marie Lee', 2), 'AL');
  assert.equal(initialsOf(''), '?');
  assert.equal(initialsOf(null, 2), '?');
});

test('labels and sharing: a photo still on this phone never goes into a round', () => {
  assert.equal(avatarLabel(buddyAvatar('visor')), 'Visor');
  assert.equal(avatarLabel(PHOTO), 'Your photo');
  assert.equal(avatarLabel(null), 'Initials');
  assert.equal(shareableAvatar(PENDING), null);
  assert.deepEqual(shareableAvatar(PHOTO), PHOTO);
  assert.equal(shareableAvatar({ kind: 'nope' }), null);
});

// ------------------------------- whose avatar -------------------------------

test('whose: yours from your profile, by any of your ids, even a photo still on this phone', () => {
  const s = stateOf({ profile: { avatar: PENDING }, rounds: { r1: { id: 'r1', status: 'done', localMe: 'seat_t', players: [{ id: 'seat_t', name: 'Trevor' }, { id: 'sam', name: 'Sam' }] } } });
  assert.equal(avatarFor(s, 't').url, PENDING.url, 'your own phone shows the photo you just picked');
  assert.equal(avatarFor(s, 'seat_t')?.url, PENDING.url, 'a seat you took is you too');
  assert.equal(avatarFor(s, 'sam'), null);
});

test('whose: a friend’s comes from their account’s profile once any of their seats is linked', () => {
  const s = stateOf({
    players: { t: { id: 't', name: 'Trevor' }, sam: { id: 'sam', name: 'Sam', createdAt: 1 }, sam2: { id: 'sam2', name: 'Sammy', createdAt: 9 } },
    accountOf: { sam2: 'acct-sam' },
    profiles: { 'acct-sam': { name: 'Sam', avatar: buddyAvatar('shades') } },
  });
  assert.deepEqual(avatarFor(s, 'sam2'), buddyAvatar('shades'));
  assert.equal(avatarFor(s, 'sam'), null, 'a different record is someone else until it’s linked');
  const linked = { ...s, accountOf: { sam: 'acct-sam', sam2: 'acct-sam' } };
  assert.deepEqual(avatarFor(linked, 'sam'), buddyAvatar('shades'), 'two records on one account share it');
  assert.equal(personKey(linked, 'sam2'), personKey(linked, 'sam'), 'and the same fallback pastel');
});

test('whose: the profile wins over a saved card, then a round seat’s avatar is the fallback', () => {
  const seat = { id: 'ann', name: 'Ann', avatar: buddyAvatar('visor', 'mint') };
  const s = stateOf({ rounds: { r1: { id: 'r1', status: 'done', createdAt: 5, players: [{ id: 't', name: 'T' }, seat] } } });
  assert.deepEqual(avatarFor(s, 'ann'), buddyAvatar('visor', 'mint'), 'the avatar her seat carried');
  const saved = { ...s, players: { ...s.players, ann: { id: 'ann', name: 'Ann', avatar: buddyAvatar('crown') } } };
  assert.deepEqual(avatarFor(saved, 'ann'), buddyAvatar('crown'));
  const prof = { ...saved, accountOf: { ann: 'acct-ann' }, profiles: { 'acct-ann': { avatar: PHOTO } } };
  assert.deepEqual(avatarFor(prof, 'ann'), PHOTO);
  // A friend's photo that only lives on their phone is never shown
  const pend = { ...s, accountOf: { ann: 'acct-ann' }, profiles: { 'acct-ann': { avatar: PENDING } } };
  assert.deepEqual(avatarFor(pend, 'ann'), buddyAvatar('visor', 'mint'));
  assert.deepEqual(avatarFor(stateOf(), 'nobody', seat), buddyAvatar('visor', 'mint'), 'a seat passed in is the last fallback');
});

// ------------------------------- no twins -----------------------------------

test('no twins: the second of two matching buddies moves to another backdrop, only in this group', () => {
  const a = avatarModel(buddyAvatar('visor', 'peach'));
  const out = noTwins([a, a, a, avatarModel(PHOTO), avatarModel(PHOTO)]);
  assert.deepEqual(out[0], a, 'the first keeps theirs');
  assert.equal(out[1].buddy, 'visor');
  assert.notEqual(out[1].bg, 'peach');
  assert.equal(new Set(out.slice(0, 3).map(m => m.bg)).size, 3, 'three visors, three backdrops');
  assert.deepEqual(out[3], out[4], 'photos are left alone');
  const one = noTwins([a]);
  assert.deepEqual(one[0], a);
});

test('no twins: two Js on the same pastel get different colours too', () => {
  const j1 = avatarModel({ kind: 'initials' }, { name: 'Jake', key: 'k1' });
  const j2 = { ...j1 };
  const k = avatarModel({ kind: 'initials' }, { name: 'Kev', key: 'k1' });
  const out = noTwins([j1, j2, k]);
  assert.equal(out[0].bg, j1.bg);
  assert.notEqual(out[1].bg, j1.bg);
  assert.ok(FALLBACK_TINTS.includes(out[1].bg), 'initials stay on a pastel first');
  assert.equal(out[2].bg, k.bg, 'a different letter on the same colour is fine');
});

// ------------------------------- rounds carry them --------------------------

test('rounds: a new round carries the avatars this phone can share, and the money is exactly the same', () => {
  const s = stateOf({
    profile: { avatar: buddyAvatar('tourcap') },
    accountOf: { sam: 'acct-sam' }, profiles: { 'acct-sam': { avatar: PHOTO } },
    players: { t: { id: 't', name: 'Trevor' }, sam: { id: 'sam', name: 'Sam' }, ann: { id: 'ann', name: 'Ann' } },
  });
  const make = () => {
    const r = createRound({ id: 'r9', game: 'skins', course: flat9, holesCount: 9, players: ['t', 'sam', 'ann'].map(id => ({ id, name: s.players[id].name, index: 0 })), settings: { hcPct: 100, skins: { value: 5, carryover: true } }, hcPct: 100, useHandicaps: false });
    for (const h of r.holes) r.scores[h.no] = { t: 4, sam: 4, ann: 4 };
    r.scores[1].sam = 3; r.scores[4].t = 3;
    return r;
  };
  const plain = make();
  const draft = structuredClone(s);
  addRound(draft, make());
  const r = draft.rounds.r9;
  assert.deepEqual(r.players.find(p => p.id === 't').avatar, buddyAvatar('tourcap'));
  assert.deepEqual(r.players.find(p => p.id === 'sam').avatar, PHOTO);
  assert.equal(r.players.find(p => p.id === 'ann').avatar, undefined, 'nobody picked: nothing added');
  assert.deepEqual(roundResults(r).balances, roundResults(plain).balances, 'every amount is the same');
  // A photo still on this phone stays off the round
  const pend = structuredClone({ ...s, profile: { avatar: PENDING } });
  assert.equal(stampAvatars(pend, make()).players.find(p => p.id === 't').avatar, undefined);
});

test('rounds: an old round with no avatars plays and pays exactly as before', () => {
  const r = createRound({ id: 'old', game: 'skins', course: flat9, holesCount: 9, players: ['a', 'b'].map(id => ({ id, name: id, index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { a: 4, b: 5 };
  const before = roundResults(structuredClone(r)).balances;
  stampAvatars(stateOf(), r);
  assert.deepEqual(roundResults(r).balances, before);
  assert.ok(r.players.every(p => !('avatar' in p)));
});

test('rounds: the avatar known now replaces one copied in with the player, and a lookup on the draft never goes stale', () => {
  const s = stateOf({ profile: { avatar: buddyAvatar('crown') } });
  // A setup copied from an older round brings the avatar Trevor had then, and a photo still on a phone
  const old = createRound({ id: 'r10', game: 'skins', course: flat9, holesCount: 9, players: ['t', 'sam', 'ann'].map(id => ({ id, name: id, index: 0 })), settings: { hcPct: 100, skins: { value: 5, carryover: true } }, hcPct: 100, useHandicaps: false });
  const was = { t: buddyAvatar('visor'), sam: PENDING, ann: buddyAvatar('beanie') };
  for (const p of old.players) p.avatar = was[p.id];
  const draft = structuredClone(s);
  addRound(draft, old);
  const r = draft.rounds.r10;
  assert.deepEqual(r.players.find(p => p.id === 't').avatar, buddyAvatar('crown'), 'your avatar now, not the old one');
  assert.equal('avatar' in r.players.find(p => p.id === 'sam'), false, 'a photo still on a phone never rides along');
  assert.deepEqual(r.players.find(p => p.id === 'ann').avatar, buddyAvatar('beanie'), 'nothing newer known: the one she came with stays');
  // The draft becomes the next state (store.js update): what the new round carries shows on it
  assert.deepEqual(avatarFor(draft, 'ann'), buddyAvatar('beanie'));
});

test('photos: only a picture made on a phone or one in the app’s own photo bucket is ever drawn', () => {
  const host = 'https://x.supabase.co';
  assert.equal(photoAllowed(PHOTO.url, host), true);
  assert.equal(photoAllowed(PHOTO.url, `${host}/`), true, 'a trailing slash on the project URL is fine');
  assert.equal(photoAllowed(PENDING.url, host), true);
  assert.equal(photoAllowed('https://tracker.example/pixel.jpg', host), false, 'a link to anywhere else is never fetched');
  assert.equal(photoAllowed('https://x.supabase.co/storage/v1/object/public/other/1.jpg', host), false, 'only the avatars bucket');
  assert.equal(photoAllowed('https://x.supabase.co.evil.example/storage/v1/object/public/avatars/1.jpg', host), false);
  assert.equal(photoAllowed('http://x.supabase.co/storage/v1/object/public/avatars/1.jpg', host), false);
  assert.equal(photoAllowed('data:text/html;base64,AAAA', host), false);
  assert.equal(photoAllowed(null, host), false);
  assert.equal(photoAllowed('https://anywhere.example/a.jpg'), true, 'no project set up (tests, local dev): any https link');
});

// ------------------------------- pay app from a profile ---------------------

test('pay: a friend’s own profile fills in a missing payment app, and wins over a saved one', () => {
  const s = stateOf({ accountOf: { sam: 'acct-sam' }, profiles: { 'acct-sam': { payApp: 'venmo', payHandle: 'sam-golf' } } });
  assert.deepEqual(payInfoFor(s, 'sam'), { app: 'venmo', handle: 'sam-golf' });
  const saved = { ...s, players: { ...s.players, sam: { id: 'sam', name: 'Sam', payApp: 'cashapp', payHandle: 'samcash' } } };
  assert.deepEqual(payInfoFor(saved, 'sam'), { app: 'venmo', handle: 'sam-golf' }, 'their own profile wins (Trevor’s call, 2026-10-03)');
  assert.equal(payInfoFor(stateOf(), 'sam'), null);
});
