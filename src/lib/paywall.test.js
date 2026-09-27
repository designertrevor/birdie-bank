import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, PRICES_ARE_PLACEHOLDERS, REMIND_DAY, TRIAL_DAYS, VARIANTS, annualSavings, bucket, freePromise, isOrganizer, paywallAnswer, planStatus,
  perMonthLabel, pickVariant, priceLabel, readFlag, shouldShowPaywall, trialTimeline, variantFor,
} from './paywall.js';

test('prices are marked as placeholders', () => {
  assert.equal(PRICES_ARE_PLACEHOLDERS, true);
  assert.equal(priceLabel(PLANS.annual), '$49.99 a year');
  assert.equal(priceLabel(PLANS.monthly), '$6.99 a month');
  assert.equal(perMonthLabel(PLANS.annual), '$4.17 a month');
  assert.equal(perMonthLabel(PLANS.monthly), '$6.99 a month');
  assert.equal(annualSavings(), 40);
});

test('the trial reminds before it ends', () => {
  assert.ok(REMIND_DAY < TRIAL_DAYS);
  const tl = trialTimeline(new Date(2026, 8, 27, 9));
  assert.deepEqual(tl.map(s => s.key), ['today', 'remind', 'start']);
  assert.equal(tl[1].title, `Day ${REMIND_DAY}`);
  assert.equal(tl[1].when, 'Fri, Oct 9');
  assert.equal(tl[2].when, 'Sun, Oct 11');
  assert.doesNotMatch(tl[0].text, /set up/);
  assert.match(trialTimeline(new Date(), { planned: true })[0].text, /group link is ready/);
});

test('the free promise counts the games', () => {
  assert.ok(freePromise(18).includes('All 18 games'));
  assert.ok(freePromise(18).includes('Join any round from a link'));
});

test('a phone lands in the same bucket every time', () => {
  const b = bucket('p_abc');
  assert.equal(bucket('p_abc'), b);
  assert.ok(b >= 0 && b < 1);
  assert.notEqual(bucket('p_abd'), b);
});

test('variants are picked by weight and stay put', () => {
  const two = { a: { id: 'a', weight: 1 }, b: { id: 'b', weight: 1 } };
  const picks = { a: 0, b: 0 };
  for (let i = 0; i < 400; i++) picks[pickVariant(`k${i}`, two)]++;
  assert.ok(picks.a > 120 && picks.b > 120, JSON.stringify(picks));
  assert.equal(pickVariant('x', { a: { id: 'a', weight: 0 } }), null);
  assert.equal(pickVariant('x', { a: { id: 'a', weight: 0 }, b: { id: 'b', weight: 2 } }), 'b');
  assert.equal(pickVariant('anyone'), 'c');
  assert.ok(VARIANTS.c.freeWayOut);
  // Keeps the variant it already had, unless that one is gone
  assert.equal(variantFor({ paywall: { variant: 'b' } }, 'k1', two), 'b');
  assert.equal(variantFor({ paywall: { variant: 'gone' } }, 'k1', two), pickVariant('k1', two));
});

test('the flag is off by default, on in dev, and the address bar wins', () => {
  assert.deepEqual(readFlag({}), { on: false, remember: null });
  assert.equal(readFlag({ env: { DEV: true } }).on, true);
  assert.equal(readFlag({ env: { VITE_PAYWALL: 'on' } }).on, true);
  assert.equal(readFlag({ env: { DEV: true, VITE_PAYWALL: 'off' } }).on, false);
  assert.deepEqual(readFlag({ search: '?paywall=on' }), { on: true, remember: 'on' });
  assert.deepEqual(readFlag({ env: { DEV: true }, search: '?paywall=off' }), { on: false, remember: 'off' });
  assert.equal(readFlag({ saved: 'on' }).on, true);
  assert.equal(readFlag({ env: { VITE_PAYWALL: 'on' }, saved: 'off' }).on, false);
});

test('only organizers who came through onboarding see it, once', () => {
  const organizer = { organizer: { games: ['skins'] } };
  assert.equal(shouldShowPaywall(organizer, true), true);
  assert.equal(shouldShowPaywall(organizer, false), false);
  // An invited player (joined from a link or answered an RSVP) has no organizer record
  assert.equal(shouldShowPaywall({ onboarded: true, organizer: null }, true), false);
  assert.equal(shouldShowPaywall({ ...organizer, paywall: { variant: 'c', choice: 'free' } }, true), false);
  assert.equal(shouldShowPaywall({ ...organizer, paywall: { variant: 'c' } }, true), true);
});

test('the answer records the variant and only keeps a plan for a trial', () => {
  const t = paywallAnswer({ variant: 'c', choice: 'trial', plan: 'annual', now: 1000 });
  assert.equal(t.plan, 'annual');
  assert.equal(t.trialEnds, 1000 + TRIAL_DAYS * 86400000);
  const f = paywallAnswer({ variant: 'c', choice: 'free', plan: 'annual', now: 1000 });
  assert.equal(f.plan, null);
  assert.equal(f.trialEnds, null);
  assert.equal(f.source, 'onboarding');
});

test('the Pro preview is for organizers, not people who only joined', () => {
  assert.equal(isOrganizer({ organizer: { games: [] } }), true);
  assert.equal(isOrganizer({ rounds: { r1: { id: 'r1' } } }), true);
  assert.equal(isOrganizer({ rounds: { r1: { id: 'r1', localMe: 'guest' } } }), false);
  assert.equal(isOrganizer({ plans: { p1: { host: false } } }), false);
  assert.equal(isOrganizer({ plans: { p1: { host: true } } }), true);
  assert.equal(isOrganizer({}), false);
});

test('the Settings line shows the trial days left', () => {
  const now = 1_000_000;
  assert.equal(planStatus({}, now), 'Free · see what Pro adds');
  assert.equal(planStatus({ paywall: { choice: 'trial', trialEnds: now + 3.5 * 86400000 } }, now), 'Pro trial preview · 4 days left');
  assert.equal(planStatus({ paywall: { choice: 'trial', trialEnds: now + 3600000 } }, now), 'Pro trial preview · 1 day left');
  assert.equal(planStatus({ paywall: { choice: 'trial', trialEnds: now - 1 } }, now), 'Free · see what Pro adds');
});
