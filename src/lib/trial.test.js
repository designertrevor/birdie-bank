// The Pro trial's timeline, its reminder and the never-a-surprise-charge rule (paywall rules, overnight 13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, REMIND_DAY, TRIAL_DAYS } from './paywall.js';
import {
  REMIND_LEAD_DAYS, activeTrial, chargeNotice, markReminded, putReminderAway, remindAt, safeToCharge, trialProgress, trialReminder,
} from './trial.js';

const DAY = 86400000;
const START = new Date(2026, 9, 1, 9).getTime(); // Thu Oct 1 2026, 9am local
const ENDS = START + TRIAL_DAYS * DAY;
const trial = (extra = {}) => ({ paywall: { choice: 'trial', plan: 'annual', trialEnds: ENDS, ...extra } });

test('the reminder lands at least two days before the trial ends', () => {
  assert.ok(TRIAL_DAYS - REMIND_DAY >= REMIND_LEAD_DAYS);
  assert.ok(ENDS - remindAt(ENDS) >= REMIND_LEAD_DAYS * DAY);
  // Even if the reminder day were set too late, it's pulled back to two days before
  assert.equal(remindAt(ENDS, { remind: 14 }), ENDS - 2 * DAY);
  assert.equal(remindAt(ENDS), START + REMIND_DAY * DAY);
});

test('only a running trial counts', () => {
  assert.equal(activeTrial(trial(), START).trialEnds, ENDS);
  assert.ok(activeTrial(trial(), START + DAY));
  assert.equal(activeTrial(trial(), ENDS), null);
  assert.equal(activeTrial({ paywall: { choice: 'free' } }, START), null);
  assert.equal(activeTrial({}, START), null);
  assert.equal(activeTrial({ paywall: { choice: 'trial', trialEnds: 'soon' } }, START), null);
});

test('the timeline says day N of 14, the end date and the price after', () => {
  const t = trialProgress(trial(), START + 2 * DAY + 3600000);
  assert.equal(t.day, 3);
  assert.equal(t.of, TRIAL_DAYS);
  assert.equal(t.daysLeft, 12);
  assert.equal(t.price, '$49.99 a year');
  assert.equal(t.plan, PLANS.annual);
  assert.equal(t.steps.length, 3);
  assert.equal(t.steps[0].done, true);
  assert.equal(t.steps[1].done, false);
  assert.equal(t.steps[1].title, `Day ${REMIND_DAY}`);
  assert.match(t.steps[2].text, /Then \$49\.99 a year, unless you cancel/);
  assert.match(t.steps[2].when, /Oct 15/);
  // The first and last moments stay inside 1..14
  assert.equal(trialProgress(trial(), START).day, 1);
  assert.equal(trialProgress(trial(), ENDS - 1).day, TRIAL_DAYS);
  assert.equal(trialProgress(trial(), ENDS - 1).daysLeft, 1);
  // Monthly says its own price; no trial, no timeline
  assert.equal(trialProgress(trial({ plan: 'monthly' }), START).price, '$6.99 a month');
  assert.equal(trialProgress({}, START), null);
  assert.equal(trialProgress(trial(), ENDS + 1), null);
});

test('the charge notice always has the end date and the price', () => {
  const n = chargeNotice(trial(), START);
  assert.match(n, /^Your trial ends Thu, Oct 15\. Then \$49\.99 a year, unless you cancel\. Nothing is charged before then\.$/);
  assert.equal(chargeNotice({}, START), null);
});

test('the reminder shows from the reminder day until the end, unless put away for this trial', () => {
  assert.equal(trialReminder(trial(), START + 5 * DAY), null);
  const r = trialReminder(trial(), remindAt(ENDS));
  assert.ok(r);
  assert.equal(r.daysLeft, 2);
  assert.equal(r.title, 'Your Pro trial ends in 2 days');
  assert.match(r.text, /Thu, Oct 15.*\$49\.99 a year/);
  assert.equal(trialReminder(trial(), ENDS - 3600000).title, 'Your Pro trial ends in 1 day');
  assert.equal(trialReminder(trial(), ENDS), null);
  // Put away: gone for this trial, back for a later one
  const away = { paywall: putReminderAway(trial().paywall, remindAt(ENDS)) };
  assert.equal(trialReminder(away, remindAt(ENDS) + 1000), null);
  assert.ok(trialReminder({ paywall: { ...away.paywall, trialEnds: ENDS + 30 * DAY } }, ENDS + 29 * DAY));
  // Never with Pro for life or a paid plan, and never while a round is live
  assert.equal(trialReminder(trial(), remindAt(ENDS), { lifetime: true }), null);
  assert.equal(trialReminder(trial(), remindAt(ENDS), { subscription: { plan: 'annual' } }), null);
  assert.equal(trialReminder(trial(), remindAt(ENDS), { allowed: false }), null);
});

test('marking the reminder keeps the first time it showed', () => {
  const a = markReminded(trial().paywall, 100);
  assert.equal(a.remindedAt, 100);
  assert.equal(markReminded(a, 200).remindedAt, 100);
  const b = putReminderAway(a, 300);
  assert.equal(b.remindedAt, 100);
  assert.equal(b.reminderSeen, ENDS);
});

test('never a surprise charge: only after the end, and only if the reminder showed two days before', () => {
  const reminded = { ...trial().paywall, remindedAt: remindAt(ENDS) };
  assert.equal(safeToCharge(reminded, ENDS - 1), false);
  assert.equal(safeToCharge(reminded, ENDS), true);
  // Never reminded (the phone wasn't opened): the charge waits
  assert.equal(safeToCharge(trial().paywall, ENDS + DAY), false);
  // Reminded too late (the day before): the charge waits
  assert.equal(safeToCharge({ ...trial().paywall, remindedAt: ENDS - DAY }, ENDS + DAY), false);
  assert.equal(safeToCharge({ choice: 'free' }, ENDS), false);
  assert.equal(safeToCharge(null, ENDS), false);
});
