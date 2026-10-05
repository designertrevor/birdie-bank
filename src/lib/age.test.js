// The age check: when "Are you 18 or older?" shows (only before money starts) and what each answer
// unlocks (money) or keeps (score, points and reward rounds). Saved once on your profile, kept
// across signing in, never on the row other people can see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGE_COPY, MONEY_AGE, ageAnswer, ageLine, keepAgeAnswer, moneyOff, moneyOk, needsAgeCheck, playsForMoney, setAgeAnswer } from './age.js';
import { createRound } from './round.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { profileOf, toRow } from './profile-model.js';
import { asksAge, nameReady } from './onboarding.js';

const flat9 = { id: 'f9', name: 'Flat Nine', custom: true, tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
function round({ playFor = null, bets = null } = {}) {
  const r = createRound({ id: 'r1', game: 'skins', course: flat9, holesCount: 9, players: ['me', 'd'].map(id => ({ id, name: id, index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  if (playFor) r.playFor = playFor;
  if (bets) r.bets = bets;
  return r;
}
const LUNCH = { kind: 'reward', reward: 'Lunch', owes: 'last' };
const fresh = () => ({ me: 'me', players: { me: { id: 'me', name: 'Sam' } }, crews: {}, customCourses: {}, rounds: {}, settlements: [], profile: {} });
const answered = a => { const s = fresh(); setAgeAnswer(s, a, 1000); return s; };

test('age: 18 is the floor, and the copy says the age where you live can be higher', () => {
  assert.equal(MONEY_AGE, 18);
  assert.match(AGE_COPY.title, /18 or older\?$/);
  assert.match(AGE_COPY.text, /18 or older, or the age where you live/);
  assert.match(AGE_COPY.text, /keep score and play for points or a reward/);
  assert.doesNotMatch(Object.values(AGE_COPY).join(' '), /\u2014|Birdie Bank/);
});

test('age: which rounds play for money', () => {
  assert.equal(playsForMoney(round()), true, 'a money round (no playFor) does');
  assert.equal(playsForMoney(round({ playFor: { kind: 'points' } })), false);
  assert.equal(playsForMoney(round({ playFor: LUNCH })), false);
  const cash = round({ playFor: LUNCH, bets: [{ id: 'b1', kind: 'hole', sides: ['me', 'd'], stake: 5, playFor: 'money' }] });
  assert.equal(playsForMoney(cash), true, 'a reward round with a side bet for money does');
  const pts = round({ playFor: LUNCH, bets: [{ id: 'b1', kind: 'hole', sides: ['me', 'd'], stake: 5, playFor: 'points' }] });
  assert.equal(playsForMoney(pts), false);
  assert.equal(playsForMoney(null), false);
});

test('age: the check shows before money, only until you say you\'re 18 or older', () => {
  assert.equal(needsAgeCheck(fresh(), round()), true, 'first money round: asked');
  assert.equal(needsAgeCheck(answered('adult'), round()), false, 'said yes: never again');
  assert.equal(needsAgeCheck(answered('under'), round()), true, 'said under 18: money asks again, so they can change it');
  assert.equal(needsAgeCheck(fresh(), round({ playFor: { kind: 'points' } })), false, 'points never ask');
  assert.equal(needsAgeCheck(fresh(), round({ playFor: LUNCH })), false, 'a reward never asks');
});

test('age: a round in progress is never stopped by it', () => {
  assert.equal(needsAgeCheck(fresh(), round(), { inProgress: true }), false);
  assert.equal(needsAgeCheck(answered('under'), round(), { inProgress: true }), false);
});

test('age: what each answer unlocks', () => {
  const none = fresh();
  assert.equal(ageAnswer(none), null);
  assert.equal(moneyOk(none), false);
  assert.equal(moneyOff(none), false, 'not asked yet is not under 18: setup still starts on money');
  const adult = answered('adult');
  assert.equal(moneyOk(adult), true);
  assert.equal(moneyOff(adult), false);
  const under = answered('under');
  assert.equal(moneyOk(under), false);
  assert.equal(moneyOff(under), true, 'under 18: setup starts on points');
  assert.match(ageLine(adult), /money rounds are on/);
  assert.match(ageLine(under), /points and reward rounds only/);
  assert.match(ageLine(none), /before your first money round/);
});

test('age: saving keeps the rest of the profile, and ignores anything but the two answers', () => {
  const s = fresh();
  s.profile = { avatar: { kind: 'buddy', id: 'birdie' }, privacy: { profile: 'hidden' } };
  setAgeAnswer(s, 'adult', 5);
  assert.deepEqual(s.profile.age, { answer: 'adult', at: 5 });
  assert.equal(s.profile.avatar.id, 'birdie');
  assert.equal(s.profile.privacy.profile, 'hidden');
  setAgeAnswer(s, 'maybe', 6);
  assert.deepEqual(s.profile.age, { answer: 'adult', at: 5 });
  const bare = {};
  setAgeAnswer(bare, 'under', 7);
  assert.deepEqual(bare.profile, { age: { answer: 'under', at: 7 } });
  assert.equal(ageAnswer({ profile: { age: { answer: 'yes' } } }), null, 'a stray value reads as not asked');
});

test('age: the answer goes to your account with your profile, and an answer from before signing in is kept', () => {
  const phone = answered('adult');
  // Up to the account: the profile doc carries it
  assert.deepEqual(toDocs(phone)['profile:me'].data.profile.age, { answer: 'adult', at: 1000 });
  // Down from an account that has no answer yet: this phone's stays
  const draft = answered('adult');
  applyDoc(draft, 'profile', 'me', { me: 'me', profile: { avatar: null, updatedAt: 9 } });
  assert.equal(ageAnswer(draft), 'adult');
  assert.equal(draft.profile.updatedAt, 9, 'the rest is the account\'s');
  // Down from an account that has one: the account's wins, as everything in the profile does
  const other = answered('under');
  applyDoc(other, 'profile', 'me', { me: 'me', profile: { age: { answer: 'adult', at: 2 } } });
  assert.equal(ageAnswer(other), 'adult');
  assert.equal(keepAgeAnswer(null, { age: { answer: 'adult' } }), null);
  assert.deepEqual(keepAgeAnswer({}, {}), {});
});

test('age: never on the profile row other people see', () => {
  const s = answered('under');
  const row = toRow(profileOf(s), 'user-1');
  assert.ok(row);
  assert.doesNotMatch(JSON.stringify(row), /under|"age"/);
});

test('age: onboarding asks only when the group plays for money, and needs an answer then', () => {
  for (const settle of ['app', 'cash', 'tab']) assert.equal(asksAge({ settle }), true, settle);
  assert.equal(asksAge({ settle: 'none' }), false, 'a group that mostly doesn\'t is asked at its first money round');
  assert.equal(asksAge({}), false);
  const a = { settle: 'app' };
  assert.equal(nameReady({ name: 'Sam', agreed: true, age: null }, a), false);
  assert.equal(nameReady({ name: 'Sam', agreed: true, age: 'under' }, a), true, 'under 18 still gets in, to points');
  assert.equal(nameReady({ name: 'Sam', agreed: true, age: 'adult' }, a), true);
  assert.equal(nameReady({ name: 'Sam', agreed: true, age: null }, { settle: 'none' }), true);
  assert.equal(nameReady({ name: ' ', agreed: true, age: 'adult' }, a), false);
  assert.equal(nameReady({ name: 'Sam', agreed: false, age: 'adult' }, a), false);
});
