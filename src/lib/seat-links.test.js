// Seat links before launch: a player id is linked to an account only from what the server saw for
// itself (the phone that took a seat), never from the account's own saved data. The spec for
// link_my_players() in supabase/2026-10-04-seat-links.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkMyPlayers, ownIdFree, seatInGroup, strongSeats } from './seat-links.js';

// Trevor organizes from his phone. He saved Dave as p_dave. Dave joins from his own phone.
const TREVOR_PHONE = 'dev-trevor';
const DAVE_PHONE = 'dev-dave';
const MAL_PHONE = 'dev-mal';
const round = (code, extra = {}) => ({
  code, sealed: true,
  meta: {
    hostDev: TREVOR_PHONE,
    players: [{ id: 't_me' }, { id: 'p_dave' }, { id: 'p_sam' }],
    devs: { t_me: TREVOR_PHONE, p_dave: DAVE_PHONE },
    claims: { p_dave: 'd_me' },
    ...extra,
  },
});
// Saved rounds in everyone's account: Trevor's (some shared from his phone), and Dave's copy
const SAVED = [
  { user: 'trevor', players: ['t_me', 'p_dave', 'p_sam'], hostDev: null }, // last month, not shared
  { user: 'trevor', players: ['t_me', 'p_dave', 'p_sam'], hostDev: TREVOR_PHONE },
  { user: 'dave', players: ['t_me', 'p_dave', 'p_sam'], hostDev: TREVOR_PHONE },
];

test('the seat a friend took on their own phone links to their account', () => {
  const r = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [round('R1')], saved: SAVED });
  assert.deepEqual(r.mine.sort(), ['d_me', 'p_dave']);
  assert.deepEqual(r.links.find(l => l.playerId === 'p_dave'), { playerId: 'p_dave', user: 'dave', dev: DAVE_PHONE, roundCode: 'R1' });
  // Dave's own id: nobody else has it, so it's his
  assert.equal(r.links.find(l => l.playerId === 'd_me').roundCode, null);
});

test('the organizer’s own id links from the round their phone shared and plays in', () => {
  const r = linkMyPlayers({ me: 'trevor', device: TREVOR_PHONE, myPlayer: 't_me', liveRounds: [round('R1')], saved: SAVED });
  assert.deepEqual(r.mine, ['t_me']);
  assert.equal(r.links[0].roundCode, 'R1');
});

test('your own word links nothing: a profile id or a claim without the phone that took the seat', () => {
  // Mallory puts Dave's seat id in her profile and claims it in the round, from her own phone
  const live = [round('R1', { claims: { p_dave: 'p_dave', p_sam: 'p_dave' } })];
  const r = linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 'p_dave', liveRounds: live, saved: SAVED });
  assert.deepEqual(r.mine, []);
  // Or Trevor's own id
  assert.deepEqual(linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 't_me', liveRounds: live, saved: SAVED }).mine, []);
  // No device key (an older app), no seats
  assert.deepEqual(strongSeats({ me: 'dave', device: null, myPlayer: 'd_me', liveRounds: [round('R1')], saved: SAVED }), []);
});

test('a round someone made up with another group’s player ids in it links nothing', () => {
  // Mallory shares her own round with Trevor's id for Dave, and takes that seat
  const fake = { code: 'FAKE', sealed: true, meta: { hostDev: MAL_PHONE, players: [{ id: 'p_dave' }], devs: { p_dave: MAL_PHONE }, claims: { p_dave: 'm_me' } } };
  const r = linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 'm_me', liveRounds: [fake], saved: SAVED });
  assert.deepEqual(r.mine, ['m_me']);
  // Even with her own id set to it
  const own = { ...fake, meta: { ...fake.meta, claims: {} } };
  assert.deepEqual(linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 'p_dave', liveRounds: [own], saved: SAVED }).mine, []);
  // Her own made-up saved rounds don't help her either
  assert.equal(seatInGroup([...SAVED, { user: 'mal', players: ['p_dave'], hostDev: MAL_PHONE }], 'p_dave', MAL_PHONE, 'mal'), false);
});

test('a round shared before the keeper lock (not sealed) proves nothing', () => {
  const old = { ...round('OLD'), sealed: false };
  assert.deepEqual(strongSeats({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [old], saved: SAVED }), []);
});

test('the group: everyone else with the id has played a round from the same organizer’s phone', () => {
  assert.equal(seatInGroup(SAVED, 'p_dave', TREVOR_PHONE, 'dave'), true);
  // Someone who has p_dave only in a round from another phone (the organizer's old one, say)
  const other = [...SAVED, { user: 'al', players: ['p_dave'], hostDev: 'dev-old' }];
  assert.equal(seatInGroup(other, 'p_dave', TREVOR_PHONE, 'dave'), false);
  // A deleted round doesn't count
  assert.equal(seatInGroup([...SAVED, { user: 'al', players: ['p_dave'], hostDev: 'dev-old', deleted: true }], 'p_dave', TREVOR_PHONE, 'dave'), true);
  assert.equal(seatInGroup(SAVED, 'p_dave', null, 'dave'), false);
});

test('your own id with nobody else to know it links; once others have it, only a seat proves it', () => {
  assert.equal(ownIdFree({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [], saved: SAVED }), true);
  assert.equal(ownIdFree({ me: 'mal', device: MAL_PHONE, myPlayer: 't_me', liveRounds: [], saved: SAVED }), false);
  // A live round has it as a seat another phone holds
  assert.equal(ownIdFree({ me: 'mal', device: MAL_PHONE, myPlayer: 't_me', liveRounds: [round('R1')], saved: [] }), false);
});

test('switching seats takes the first one off, but a link stays once its round is gone', () => {
  // Dave tapped Sam's seat by mistake, then switched to his own
  const wrong = round('R1', { devs: { t_me: TREVOR_PHONE, p_sam: DAVE_PHONE }, claims: { p_sam: 'd_me' } });
  let r = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [wrong], saved: SAVED });
  assert.ok(r.mine.includes('p_sam'));
  const fixed = round('R1', { devs: { t_me: TREVOR_PHONE, p_sam: DAVE_PHONE, p_dave: DAVE_PHONE }, claims: { p_dave: 'd_me' } });
  r = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [fixed], saved: SAVED, links: r.links });
  assert.deepEqual(r.mine.sort(), ['d_me', 'p_dave']);
  // The round is tidied away: the link stays
  r = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [], saved: SAVED, links: r.links });
  assert.deepEqual(r.mine.sort(), ['d_me', 'p_dave']);
});

test('signing in on another phone never removes what the first phone linked', () => {
  const first = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [round('R1')], saved: SAVED });
  // On his laptop the round's claims no longer show him (say someone rewrote them); the phone's link stays
  const laptop = linkMyPlayers({ me: 'dave', device: 'dev-laptop', myPlayer: 'd_me', liveRounds: [round('R1', { claims: {} })], saved: SAVED, links: first.links });
  assert.deepEqual(laptop.mine.sort(), ['d_me', 'p_dave']);
});

test('links made before the new rule stay with their account, and no seat moves a link to another account', () => {
  const before = [
    { playerId: 'p_sam', user: 'mal', dev: null, roundCode: null }, // linked before the rule
    { playerId: 'old_seat', user: 'dave', dev: null, roundCode: null },
  ];
  // Dave's run keeps his old link and Mallory's
  const r = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [], saved: SAVED, links: before });
  assert.ok(r.mine.includes('old_seat'));
  assert.ok(r.links.some(l => l.playerId === 'p_sam' && l.user === 'mal'));
  // Sam takes his seat on his own phone: Mallory linked it first, so it stays hers (as before the rule)
  const live = [round('R2', { devs: { t_me: TREVOR_PHONE, p_sam: 'dev-sam' }, claims: { p_sam: 's_me' } })];
  const sam = linkMyPlayers({ me: 'sam', device: 'dev-sam', myPlayer: 's_me', liveRounds: live, saved: SAVED, links: r.links });
  assert.ok(!sam.mine.includes('p_sam'));
  assert.equal(sam.links.find(l => l.playerId === 'p_sam').user, 'mal');
  // A seat nobody had yet links to whoever takes it first
  const fresh = linkMyPlayers({ me: 'sam', device: 'dev-sam', myPlayer: 's_me', liveRounds: live, saved: SAVED, links: [] });
  assert.ok(fresh.mine.includes('p_sam'));
  // Then anyone in the group with the link who takes that seat on their phone gets nothing
  const stolen = [round('R3', { devs: { t_me: TREVOR_PHONE, p_sam: MAL_PHONE }, claims: { p_sam: 'm_me' } })];
  const mal = linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 'm_me', liveRounds: stolen, saved: SAVED, links: fresh.links });
  assert.ok(!mal.mine.includes('p_sam'));
  assert.equal(mal.links.find(l => l.playerId === 'p_sam').user, 'sam');
});

test('a friend’s link made before the new rule can’t be taken by someone in the group taking their seat', () => {
  // Dave linked p_dave before the rule. Mallory has the live link and takes Dave's seat on her phone
  const before = [{ playerId: 'p_dave', user: 'dave', dev: null, roundCode: null }];
  const live = [round('R4', { devs: { t_me: TREVOR_PHONE, p_dave: MAL_PHONE }, claims: { p_dave: 'm_me' } })];
  const mal = linkMyPlayers({ me: 'mal', device: MAL_PHONE, myPlayer: 'm_me', liveRounds: live, saved: SAVED, links: before });
  assert.ok(!mal.mine.includes('p_dave'));
  assert.equal(mal.links.find(l => l.playerId === 'p_dave').user, 'dave');
  // Dave's own phone brings his old link up to date
  const dave = linkMyPlayers({ me: 'dave', device: DAVE_PHONE, myPlayer: 'd_me', liveRounds: [round('R1')], saved: SAVED, links: before });
  assert.deepEqual(dave.links.find(l => l.playerId === 'p_dave'), { playerId: 'p_dave', user: 'dave', dev: DAVE_PHONE, roundCode: 'R1' });
});

test('on the phone: your own id still reads as you while the server hasn’t linked it yet', async () => {
  const { applyPeople } = await import('./profile-model.js');
  const draft = { me: 't_me', accountOf: {}, profiles: {} };
  // The server links only the seat (say Trevor's own id is in rounds from his old phone)
  applyPeople(draft, [{ player_id: 'p_old', user_id: 'u-trevor', visible: false }], { asked: ['t_me', 'p_old'], myAccount: 'u-trevor' });
  assert.equal(draft.accountOf.t_me, 'u-trevor');
  assert.equal(draft.accountOf.p_old, 'u-trevor');
});
