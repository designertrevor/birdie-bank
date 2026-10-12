// Who has Pro and on which plan: Pro for life for early testers, the trial preview, and Free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canUsePro, currentPlan, hasPro, isPro, seasonAccess } from './entitlements.js';
import { PLANS, TRIAL_DAYS, planStatus, shouldShowPaywall } from './paywall.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 9, 12);
const trial = (plan = 'monthly', endsIn = 9 * DAY) => ({ organizer: { games: [] }, rounds: {}, paywall: { choice: 'trial', plan, trialEnds: NOW + endsIn } });

test('Pro for life wins over everything, and there is nothing to cancel', () => {
  const p = currentPlan(trial(), { lifetime: true, now: NOW });
  assert.equal(p.id, 'lifetime');
  assert.equal(p.pro, true);
  assert.equal(p.cancel, false);
  assert.equal(isPro({}, { lifetime: true }), true);
});

test('the trial says its plan and days left, and is not a paid plan', () => {
  const p = currentPlan(trial('monthly', 9 * DAY - 1000), { now: NOW });
  assert.equal(p.id, 'trial');
  assert.equal(p.plan, PLANS.monthly);
  assert.equal(p.daysLeft, 9);
  assert.equal(p.cancel, true);
  assert.equal(isPro(trial()), false);
  // A trial with no plan saved comes after with the default plan
  assert.equal(currentPlan({ paywall: { choice: 'trial', trialEnds: NOW + DAY } }, { now: NOW }).plan, PLANS.annual);
  // Ended: Free
  assert.equal(currentPlan(trial('annual', -1), { now: NOW }).id, 'free');
  assert.ok(TRIAL_DAYS >= 9);
});

test('a paid plan only comes from a subscription, which nothing passes yet', () => {
  const p = currentPlan({}, { subscription: { plan: 'annual', renews: NOW + 300 * DAY }, now: NOW });
  assert.equal(p.id, 'annual');
  assert.equal(p.cancel, true);
  assert.equal(isPro({}, { subscription: { plan: 'monthly' } }), true);
  assert.equal(currentPlan({}, { subscription: { plan: 'weekly' }, now: NOW }).id, 'free');
  assert.deepEqual(currentPlan({ paywall: { choice: 'free' } }, { now: NOW }), { id: 'free', pro: false, plan: null, cancel: false });
});

test('a lifetime holder gets the whole Season and never sees the paywall', () => {
  const invited = { rounds: { j1: { id: 'j1', localMe: 'guest', players: [] } } };
  assert.deepEqual(seasonAccess(invited, undefined, { lifetime: true }), { access: 'pro' });
  assert.deepEqual(seasonAccess({ organizer: {}, rounds: {} }, undefined, { lifetime: true }), { access: 'pro' });
  // The trial unlocks everything (paywall rules, overnight 13): the whole Season, not the preview
  assert.deepEqual(seasonAccess(trial(), undefined, { now: NOW }), { access: 'pro' });
  // Once it ends, an organizer is back to the preview
  assert.deepEqual(seasonAccess(trial('annual', -1), undefined, { now: NOW }), { access: 'preview' });
  // With the paywall off everyone is open, Pro or not
  assert.deepEqual(seasonAccess(invited, undefined, { gated: false, lifetime: true }), { access: 'open' });
  assert.equal(shouldShowPaywall({ organizer: {} }, true), true);
  assert.equal(shouldShowPaywall({ organizer: {} }, true, { pro: true }), false);
  assert.equal(shouldShowPaywall({ organizer: {} }, false, { pro: false }), false);
});

test('the Settings line thanks a lifetime holder', () => {
  assert.equal(planStatus(trial(), NOW, { lifetime: true }), 'Pro for life. Thanks for testing early');
  assert.match(planStatus(trial(), NOW), /^Pro trial preview · 9 days left$/);
});

test('the one entitlement check: true on the trial, a paid plan and Pro for life, false on Free', () => {
  assert.equal(hasPro(trial(), { now: NOW }), true);
  assert.equal(hasPro(trial('annual', 1000), { now: NOW }), true);
  assert.equal(hasPro(trial('annual', -1), { now: NOW }), false);
  assert.equal(hasPro({}, { lifetime: true, now: NOW }), true);
  assert.equal(hasPro({}, { subscription: { plan: 'monthly' }, now: NOW }), true);
  assert.equal(hasPro({}, { now: NOW }), false);
  assert.equal(hasPro({ paywall: { choice: 'free' } }, { now: NOW }), false);
  assert.equal(hasPro(null, { now: NOW }), false);
});

test('canUsePro: everything is open with the paywall flag off, and gated on hasPro with it on', () => {
  assert.equal(canUsePro({}, { gated: false, now: NOW }), true);
  assert.equal(canUsePro(null, { gated: false }), true);
  assert.equal(canUsePro({}, { gated: true, now: NOW }), false);
  assert.equal(canUsePro(trial(), { gated: true, now: NOW }), true);
  assert.equal(canUsePro({}, { gated: true, lifetime: true, now: NOW }), true);
  // Gated is the default, so a caller that forgets the flag never unlocks Pro by mistake
  assert.equal(canUsePro({}, { now: NOW }), false);
});
