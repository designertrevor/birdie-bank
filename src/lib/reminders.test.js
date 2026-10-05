// Tee time reminders and gentle payment nudges: when each shows, when it doesn't, and that
// neither ever moves money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { mergeBackup, parseBackup } from './backup.js';
import { mapCourse } from './courseApi.js';
import { isoDate, newPlan, planMeta } from './plans.js';
import {
  bookedText, cleanBookingUrl, courseBookingUrl, linkSite, markBooked, planBookingUrl, remindDayChoices, remindOnLabel,
  rebookIfMoved, setBooking, suggestedRemindOn, teeTimeDue, teeTimeLine, teeTimeReminders, tomorrowIso,
} from './tee-reminders.js';
import {
  NUDGE_CHOICES, NUDGE_DEFAULT, lastNudged, noteNudge, nudgeChoiceLabel, nudgeDays, nudgeLine, owedSince, paymentNudges, sinceDay,
} from './nudges.js';

const DAY = 864e5;
// Thursday Oct 1 2026, mid-morning, local time
const NOW_D = new Date(2026, 9, 1, 10, 0);
const NOW = NOW_D.getTime();
const dayOff = n => isoDate(new Date(2026, 9, 1 + n));

// --------------------------- tee time reminders ----------------------------

const COURSE = { id: 'birch-creek', name: 'Birch Creek GC', city: 'Smithfield, UT' };
function plan(extra = {}) {
  const p = newPlan({ id: 'p1', hostName: 'Trevor Nielsen', game: 'nassau', holesCount: 18, date: dayOff(3), teeTime: null, course: COURSE, people: [], ballot: { games: ['nassau'], bets: [5] }, suggestedBet: 5, now: NOW });
  return { ...p, ...extra };
}

test('booking links: a pasted address becomes a safe https link, anything else is dropped', () => {
  assert.equal(cleanBookingUrl('foreupsoftware.com/index.php/booking/123'), 'https://foreupsoftware.com/index.php/booking/123');
  assert.equal(cleanBookingUrl('  https://www.birchcreekgolf.com/tee-times  '), 'https://www.birchcreekgolf.com/tee-times');
  assert.equal(cleanBookingUrl('http://golf.example.org'), 'http://golf.example.org/');
  assert.equal(cleanBookingUrl('javascript:alert(1)'), '');
  assert.equal(cleanBookingUrl('data:text/html,hi'), '');
  assert.equal(cleanBookingUrl('call the pro shop'), '');
  assert.equal(cleanBookingUrl('birchcreek'), '', 'a word with no dot is not a site');
  assert.equal(cleanBookingUrl(''), '');
  assert.equal(cleanBookingUrl(`https://a.com/${'x'.repeat(400)}`), '', 'too long');
  assert.equal(linkSite('https://www.birchcreekgolf.com/tee-times'), 'birchcreekgolf.com');
});

test('booking links: the one you saved for a course wins, then the course database, and a corrected course keeps it', () => {
  const state = { customCourses: { 'gca-7k2m9qb4': { id: 'gca-7k2m9qb4', name: 'Pine Hollow', bookingUrl: 'https://pinehollow.example.com/book' } }, courseLinks: {} };
  assert.equal(courseBookingUrl(state, { id: 'gca-7k2m9qb4' }), 'https://pinehollow.example.com/book', 'from the course database');
  state.courseLinks['gca-7k2m9qb4'] = 'https://foreupsoftware.com/pine';
  assert.equal(courseBookingUrl(state, { id: 'gca-7k2m9qb4' }), 'https://foreupsoftware.com/pine', 'yours wins');
  assert.equal(courseBookingUrl(state, { id: 'nowhere' }), '');
  // A link saved on a built-in course still finds it once you correct the scorecard
  const fixed = { customCourses: { 'birch-creek-custom': { id: 'birch-creek-custom', name: 'Birch Creek GC', replaces: 'birch-creek', holes: [] } }, courseLinks: { 'birch-creek': 'https://birchcreek.example.com' } };
  assert.equal(courseBookingUrl(fixed, { id: 'birch-creek' }), 'https://birchcreek.example.com/');
});

test('booking links: the plan keeps its link for its own course, and a changed course goes back to that course’s link', () => {
  const state = { customCourses: {}, courseLinks: { other: 'https://other.example.com/' } };
  const p = plan();
  setBooking(p, { url: 'birchcreek.example.com/tee' });
  assert.deepEqual(p.booking, { url: 'https://birchcreek.example.com/tee', courseId: 'birch-creek' });
  assert.equal(planBookingUrl(state, p), 'https://birchcreek.example.com/tee');
  p.course = { id: 'other', name: 'Other GC' };
  assert.equal(planBookingUrl(state, p), 'https://other.example.com/');
  setBooking(p, { url: '' });
  assert.equal(p.booking, undefined, 'clearing the only thing on it takes it off');
});

test('booking links: the course database’s website comes through, an unsafe one never does', () => {
  const tee = { tee_name: 'Blue', course_rating: 71, slope_rating: 125, holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, handicap: i + 1 })) };
  const base = { id: '7k2m9qb4', club_name: 'Pine Hollow', course_name: 'Pine Hollow', location: { city: 'Logan', state: 'UT' }, tees: { male: [tee] } };
  assert.equal(mapCourse({ course: { ...base, website: 'www.pinehollow.example.com' } }).bookingUrl, 'https://www.pinehollow.example.com/');
  assert.equal(mapCourse({ course: { ...base, website: 'javascript:alert(1)' } }).bookingUrl, undefined);
  assert.equal('bookingUrl' in mapCourse({ course: base }), false, 'nothing sent, nothing added');
});

test('tee time: the reminder days run from today to the day before the round, two weeks at most', () => {
  const days = remindDayChoices(plan(), NOW_D);
  assert.deepEqual(days.map(d => d.iso), [dayOff(0), dayOff(1), dayOff(2)]);
  assert.equal(days[0].top, 'Today');
  assert.deepEqual(remindDayChoices(plan({ date: dayOff(0) }), NOW_D).map(d => d.iso), [dayOff(0)], 'a round today offers today');
  assert.deepEqual(remindDayChoices(plan({ date: dayOff(-1) }), NOW_D), [], 'gone by');
  const far = remindDayChoices(plan({ date: dayOff(30) }), NOW_D);
  assert.equal(far.length, 14);
  assert.equal(far.at(-1).iso, dayOff(29));
  assert.equal(suggestedRemindOn(plan({ date: dayOff(10) }), NOW_D), dayOff(7), 'three days before');
  assert.equal(suggestedRemindOn(plan({ date: dayOff(2) }), NOW_D), dayOff(0), 'today when that’s gone by');
});

test('tee time: due from the reminder day you picked until it’s booked', () => {
  const p = plan();
  assert.equal(teeTimeDue(p, NOW_D), false, 'no reminder day picked');
  setBooking(p, { remindOn: dayOff(1) });
  assert.equal(teeTimeDue(p, NOW_D), false, 'the day hasn’t come');
  assert.equal(teeTimeDue(p, new Date(NOW + DAY)), true, 'the day it’s set for');
  assert.equal(teeTimeDue(p, new Date(NOW + 2 * DAY)), true, 'and after, until it’s booked');
  assert.equal(teeTimeDue(p, new Date(NOW + 4 * DAY)), false, 'the round has gone by');
  markBooked(p, '08:10', NOW + DAY);
  assert.equal(p.teeTime, '08:10');
  assert.deepEqual(p.booked, { at: NOW + DAY });
  assert.equal(teeTimeDue(p, new Date(NOW + 2 * DAY)), false, 'booked');
});

test('tee time: only the organizer, only a plan that’s still on, and Tomorrow puts it off a day', () => {
  const due = plan({ booking: { remindOn: dayOff(0) } });
  assert.equal(teeTimeDue(due, NOW_D), true);
  assert.equal(teeTimeDue({ ...due, host: false }, NOW_D), false, 'a friend’s phone never asks them to book');
  assert.equal(teeTimeDue({ ...due, status: 'off' }, NOW_D), false, 'called off');
  assert.equal(teeTimeDue({ ...due, status: 'started' }, NOW_D), false, 'started');
  assert.equal(teeTimeDue({ ...due, gone: true }, NOW_D), false, 'deleted');
  assert.equal(teeTimeDue({ ...due, movedTo: { id: 'p2' } }, NOW_D), false, 'moved to another day: the new plan has its own');
  const snoozed = { ...due, teeSnooze: tomorrowIso(NOW_D) };
  assert.equal(teeTimeDue(snoozed, NOW_D), false, 'Tomorrow');
  assert.equal(teeTimeDue(snoozed, new Date(NOW + DAY)), true, 'back the next day');
  // Picking a day again clears Tomorrow
  setBooking(snoozed, { remindOn: dayOff(0) });
  assert.equal(snoozed.teeSnooze, undefined);
});

test('tee time: a reminder day left after a round moved earlier counts as the day before it', () => {
  const p = plan({ date: dayOff(2), booking: { remindOn: dayOff(5) } });
  assert.equal(teeTimeDue(p, NOW_D), false);
  assert.equal(teeTimeDue(p, new Date(NOW + DAY)), true, 'the day before the round');
  const today = plan({ date: dayOff(0), booking: { remindOn: dayOff(3) } });
  assert.equal(teeTimeDue(today, NOW_D), true, 'a round today: today');
});

test('tee time: Up next lists the ones due, soonest round first', () => {
  const a = { ...plan({ id: 'a', date: dayOff(5), booking: { remindOn: dayOff(0) } }) };
  const b = { ...plan({ id: 'b', date: dayOff(2), booking: { remindOn: dayOff(0) } }) };
  const c = { ...plan({ id: 'c', date: dayOff(2) }) };
  assert.deepEqual(teeTimeReminders({ plans: { a, b, c } }, NOW_D).map(p => p.id), ['b', 'a']);
  assert.deepEqual(teeTimeReminders({}, NOW_D), []);
});

test('tee time: the booking and Booked ride with the shared plan; Tomorrow stays on this phone', () => {
  const p = plan();
  setBooking(p, { url: 'birchcreek.example.com', remindOn: dayOff(1) });
  p.teeSnooze = dayOff(1);
  markBooked(p, '07:30', NOW);
  p.teeSnooze = dayOff(2);
  const meta = planMeta(p);
  assert.deepEqual(meta.booking, { url: 'https://birchcreek.example.com/', courseId: 'birch-creek', remindOn: dayOff(1) });
  assert.deepEqual(meta.booked, { at: NOW });
  assert.equal(meta.teeTime, '07:30');
  assert.equal('teeSnooze' in meta, false);
});

test('tee time: the card line, the reminder label and the text for the group', () => {
  const p = plan({ teeTime: '08:10' });
  assert.equal(teeTimeLine(p, NOW_D), 'Sunday at Birch Creek GC');
  assert.equal(teeTimeLine({ date: null, course: null }, NOW_D), 'Your next round');
  assert.equal(remindOnLabel({ booking: { remindOn: dayOff(0) } }, NOW_D), 'Reminder on Up next today');
  assert.equal(remindOnLabel({ booking: { remindOn: dayOff(1) } }, NOW_D), 'Reminder on Up next tomorrow');
  assert.equal(remindOnLabel({ booking: { remindOn: dayOff(2) } }, NOW_D), 'Reminder on Up next Saturday');
  assert.equal(remindOnLabel({}, NOW_D), '');
  assert.equal(bookedText(p, 'https://x.example/?plan=ABCDEF', NOW_D), 'Tee time’s booked: Sunday at 8:10 AM, Birch Creek GC.\nTap to say if you’re in:\nhttps://x.example/?plan=ABCDEF');
  assert.equal(bookedText({ ...p, date: dayOff(1), teeTime: null }, null, NOW_D), 'Tee time’s booked: tomorrow, Birch Creek GC.');
  for (const t of [bookedText(p, null, NOW_D), teeTimeLine(p, NOW_D)]) assert.doesNotMatch(t, /this week|next week/i);
});

// --------------------------- payment nudges --------------------------------

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
function round(id, ids, holes = {}, { code = null, daysAgo = 1, playFor = null } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (playFor) r.playFor = playFor;
  return r;
}
const stateOf = (me, rounds, extra = {}) => ({
  me, players: { b: { id: 'b', name: 'Mike Jones' }, c: { id: 'c', name: 'Dave' } }, rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
  settlements: [], carries: [], tabRows: {}, nudges: {}, settings: {}, ...extra,
});
// B lost two skins to A: B owes A $4
const twoSkins = { 1: { a: 3, b: 4 }, 2: { a: 3, b: 4 } };

test('nudges: settings default to a week, and Off is a choice', () => {
  assert.equal(NUDGE_DEFAULT, 7);
  assert.deepEqual(NUDGE_CHOICES, [0, 3, 7, 14]);
  assert.equal(nudgeDays({}), 7);
  assert.equal(nudgeDays({ nudgeDays: 0 }), 0);
  assert.equal(nudgeDays({ nudgeDays: 14 }), 14);
  assert.equal(nudgeDays({ nudgeDays: 5 }), 7, 'anything unknown is the default');
  assert.deepEqual(NUDGE_CHOICES.map(nudgeChoiceLabel), ['Off', '3 days', '1 week', '2 weeks']);
});

test('nudges: suggested once someone has owed you for the days you picked, not before, and not when Off', () => {
  const fresh = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 5 })]);
  assert.deepEqual(paymentNudges(fresh, { now: NOW }), [], 'five days: not yet');
  const old = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 8 })]);
  const [n, ...rest] = paymentNudges(old, { now: NOW });
  assert.equal(rest.length, 0);
  assert.equal(n.id, 'b');
  assert.equal(n.amount, 4);
  assert.equal(n.days, 8);
  assert.equal(n.since, NOW - 8 * DAY);
  assert.equal(paymentNudges({ ...fresh, settings: { nudgeDays: 3 } }, { now: NOW }).length, 1, 'three days picked');
  assert.deepEqual(paymentNudges({ ...old, settings: { nudgeDays: 0 } }, { now: NOW }), [], 'Off');
  assert.equal(paymentNudges({ ...old, settings: { nudgeDays: 14 } }, { now: NOW }).length, 0, 'two weeks picked');
});

test('nudges: only money owed to you, never what you owe and never a few cents', () => {
  const iOwe = stateOf('a', [round('r1', ['a', 'b'], { 1: { a: 4, b: 3 }, 2: { a: 4, b: 3 } }, { daysAgo: 10 })]);
  assert.deepEqual(paymentNudges(iOwe, { now: NOW }), []);
  // Settled down to 50 cents
  const cents = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 10 })], { settlements: [{ id: 's1', from: 'b', to: 'a', amount: 3.5, at: NOW - 20 * DAY }] });
  assert.equal(outstanding(cents, { now: NOW })[0].amount, 0.5);
  assert.deepEqual(paymentNudges(cents, { now: NOW }), []);
});

test('nudges: the clock starts from the first round after the last payment between you', () => {
  // Paid up after the first round, then a new debt five days ago
  const r1 = round('r1', ['a', 'b'], twoSkins, { daysAgo: 20 });
  const r2 = round('r2', ['a', 'b'], twoSkins, { daysAgo: 5 });
  const paid = stateOf('a', [r1, r2], { settlements: [{ id: 's1', from: 'b', to: 'a', amount: 4, at: NOW - 15 * DAY }] });
  assert.equal(owedSince(paid, 'b', 'a', ['r1', 'r2']), NOW - 5 * DAY);
  assert.deepEqual(paymentNudges(paid, { now: NOW }), [], 'the new debt is five days old');
  assert.equal(paymentNudges(paid, { now: NOW + 3 * DAY }).length, 1, 'and nudges once it’s a week old');
  // A payment after every round with money still open (part paid): no round to date it from
  const part = stateOf('a', [r1], { settlements: [{ id: 's1', from: 'b', to: 'a', amount: 2, at: NOW - 10 * DAY }] });
  assert.equal(owedSince(part, 'b', 'a', ['r1']), null);
  assert.deepEqual(paymentNudges(part, { now: NOW }), []);
});

test('nudges: never about money agreed to carry over or asked to roll; rolled money starts fresh from the round it rolled into', () => {
  const r1 = round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA', daysAgo: 20 });
  const asked = stateOf('a', [r1], { carries: [{ id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'asked', by: 'b', at: NOW - 15 * DAY }] });
  assert.deepEqual(paymentNudges(asked, { now: NOW }), [], 'asked to roll');
  const agreed = stateOf('a', [r1], { carries: [{ id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'agreed', by: 'b', at: NOW - 15 * DAY, answeredAt: NOW - 14 * DAY }] });
  assert.deepEqual(paymentNudges(agreed, { now: NOW }), [], 'agreed carry');
  const declined = stateOf('a', [r1], { carries: [{ id: 'k:b>a:1', from: 'b', to: 'a', amount: 4, status: 'declined', by: 'b', at: NOW - 15 * DAY, answeredAt: NOW - 14 * DAY }] });
  assert.equal(paymentNudges(declined, { now: NOW }).length, 1, '“I’d rather get paid” leaves it open');
  // The carry rolled into the next round together: the clock starts there
  const r2 = round('r2', ['a', 'b'], {}, { code: 'BBBBBB', daysAgo: 4 });
  const rolled = { ...agreed, rounds: { r1, r2 } };
  assert.equal(owedSince(rolled, 'b', 'a', ['r1', 'r2']), NOW - 4 * DAY);
  assert.deepEqual(paymentNudges(rolled, { now: NOW }), [], 'four days since it rolled');
  assert.equal(paymentNudges(rolled, { now: NOW + 3 * DAY })[0]?.days, 7, 'then a week after');
});

test('nudges: never more than once a week per person, on any of their ids', () => {
  const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 10 })]);
  noteNudge(s, 'b', NOW - 3 * DAY);
  assert.equal(lastNudged(s, 'b'), NOW - 3 * DAY);
  assert.deepEqual(paymentNudges(s, { now: NOW }), [], 'nudged three days ago');
  assert.equal(paymentNudges(s, { now: NOW + 4 * DAY }).length, 1, 'a week later, once more');
  // Nudged under a seat id that's linked to Mike: still him
  const linked = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 10 })], { links: { zb: 'b' }, nudges: { zb: NOW - DAY } });
  assert.deepEqual(paymentNudges(linked, { now: NOW }), []);
  // Old entries fall away so the map stays small
  const tidy = stateOf('a', [], { nudges: { old: NOW - 90 * DAY } });
  noteNudge(tidy, 'b', NOW);
  assert.deepEqual(tidy.nudges, { b: NOW });
});

test('nudges: points and lunch rounds owe no money, so they never nudge', () => {
  for (const playFor of [{ kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }]) {
    const s = stateOf('a', [round('r1', ['a', 'b'], twoSkins, { daysAgo: 10, playFor })]);
    assert.deepEqual(paymentNudges(s, { now: NOW }), [], playFor.kind);
  }
});

test('nudges: most owed first', () => {
  const r1 = round('r1', ['a', 'b'], twoSkins, { daysAgo: 10 });
  const r2 = round('r2', ['a', 'c'], { 1: { a: 3, c: 4 }, 2: { a: 3, c: 4 }, 3: { a: 3, c: 4 } }, { daysAgo: 9 });
  const s = stateOf('a', [r1, r2]);
  assert.deepEqual(paymentNudges(s, { now: NOW }).map(n => [n.id, n.amount]), [['c', 6], ['b', 4]]);
});

test('nudges and tee times never move money: the Tab is the same before and after', () => {
  const r1 = round('r1', ['a', 'b'], twoSkins, { code: 'AAAAAA', daysAgo: 10 });
  const s = stateOf('a', [r1]);
  const before = { tab: tabBalances(s, { now: NOW }), plan: outstanding(s, { now: NOW }) };
  paymentNudges(s, { now: NOW });
  noteNudge(s, 'b', NOW);
  s.courseLinks = { f9: 'https://flat.example.com/' };
  assert.deepEqual(tabBalances(s, { now: NOW }), before.tab);
  assert.deepEqual(outstanding(s, { now: NOW }), before.plan);
  assert.deepEqual(before.tab, { a: 4, b: -4 });
});

test('nudges: the line is friendly and says the day, never how late it is', () => {
  const sat = new Date(2026, 8, 26, 15).getTime(); // the Saturday before NOW
  assert.equal(nudgeLine('Mike Jones', 18, sat, { now: NOW, fmt: v => `$${v}` }), 'Mike still owes you $18 from Saturday');
  assert.equal(sinceDay(new Date(2026, 8, 12).getTime(), NOW), 'Sep 12');
  assert.equal(nudgeLine('', 5, NOW - 8 * DAY, { now: NOW }), 'A friend still owes you $5 from Sep 23');
  for (const t of [nudgeLine('Mike', 18, sat, { now: NOW })]) assert.doesNotMatch(t, /overdue|late|week|days/i);
});

test('nudges and booking links ride in your profile, and an older profile keeps this phone’s', () => {
  const base = { me: 'a', onboarded: true, settings: {}, favorites: [], players: {}, crews: {}, customCourses: {}, rounds: {}, settlements: [], carries: [], courseLinks: { f9: 'https://flat.example.com/' }, nudges: { b: NOW } };
  const doc = toDocs(base)['profile:me'];
  assert.deepEqual(doc.data.courseLinks, { f9: 'https://flat.example.com/' });
  assert.deepEqual(doc.data.nudges, { b: NOW });
  const other = { ...base, courseLinks: {}, nudges: {} };
  applyDoc(other, 'profile', 'me', doc.data);
  assert.deepEqual(other.courseLinks, base.courseLinks);
  assert.deepEqual(other.nudges, base.nudges);
  const kept = { ...base };
  applyDoc(kept, 'profile', 'me', { me: 'a', onboarded: true, settings: {}, favorites: [] });
  assert.deepEqual(kept.courseLinks, base.courseLinks);
  assert.deepEqual(kept.nudges, base.nudges);
});

test('booking links come back from a backup', () => {
  const file = JSON.stringify({ format: 'birdie-bank-backup', backupVersion: 1, data: { players: {}, courseLinks: { f9: 'https://flat.example.com/' }, nudges: { b: NOW } } });
  const parsed = parseBackup(file);
  assert.equal(parsed.ok, true);
  const { state } = mergeBackup({ players: {}, rounds: {}, courseLinks: {} }, parsed.data);
  assert.deepEqual(state.courseLinks, { f9: 'https://flat.example.com/' });
  assert.equal(parseBackup(JSON.stringify({ format: 'birdie-bank-backup', backupVersion: 1, data: { players: {}, courseLinks: 'x' } })).ok, false, 'a damaged one is refused');
});

// --------------------------- review fixes ----------------------------------

test('nudges: one card per person, what they owe you on all your ids added up and less what you owe them', () => {
  // No account yet, two rounds each with its own seat for you: the Tab adds them up, so does the card
  const r1 = { ...round('r1', ['a', 'b'], twoSkins, { daysAgo: 10 }), localMe: 'a' };
  const r2 = { ...round('r2', ['a2', 'b'], { 1: { a2: 3, b: 4 } }, { daysAgo: 9 }), localMe: 'a2' };
  const s = stateOf(null, [r1, r2]);
  const plan = outstanding(s, { now: NOW });
  assert.equal(plan.filter(t => t.from === 'b').length, 2, 'two lines on the Tab for Mike');
  const list = paymentNudges(s, { now: NOW });
  assert.deepEqual(list.map(n => [n.id, n.amount]), [['b', 6]], 'one card for Mike, $4 and $2');
  assert.equal(list[0].since, NOW - 10 * DAY, 'from the first of those rounds');
  // He won $2 back from your other seat: the card is what he owes you overall
  const back = { ...round('r2', ['a2', 'b'], { 1: { a2: 4, b: 3 } }, { daysAgo: 9 }), localMe: 'a2' };
  assert.deepEqual(paymentNudges(stateOf(null, [r1, back]), { now: NOW }).map(n => [n.id, n.amount]), [['b', 2]]);
});

test('nudges: a lunch round’s side bet for money is on the Tab, so it nudges in dollars', () => {
  const lunch = { kind: 'reward', reward: 'Lunch', owes: 'last' };
  const r = round('r1', ['a', 'b'], {}, { daysAgo: 10, playFor: lunch });
  r.bets = [{ id: 'sb1', kind: 'custom', sides: ['a', 'b'], stake: 5, label: 'Side bet', winner: 'a', at: 1, playFor: 'money' }];
  const s = stateOf('a', [r]);
  assert.deepEqual(outstanding(s, { now: NOW }).map(t => [t.from, t.to, t.amount]), [['b', 'a', 5]]);
  assert.deepEqual(paymentNudges(s, { now: NOW }).map(n => [n.id, n.amount]), [['b', 5]]);
});

test('tee time: a plan moved to another day or course isn’t booked any more; a new tee time alone keeps it', () => {
  const p = plan({ teeTime: '08:10' });
  markBooked(p, '08:10', NOW);
  assert.equal(rebookIfMoved(p, { date: p.date, courseId: COURSE.id }), false);
  assert.ok(p.booked, 'same day and course');
  assert.equal(rebookIfMoved(p, { date: dayOff(4), courseId: COURSE.id }), true);
  assert.equal(p.booked, undefined, 'a new day');
  markBooked(p, '08:10', NOW);
  p.teeSnooze = dayOff(1);
  rebookIfMoved(p, { date: p.date, courseId: 'other' });
  assert.equal(p.booked, undefined, 'a new course');
  assert.equal(p.teeSnooze, undefined);
  p.booking = { url: 'https://birchcreek.example.com/', courseId: COURSE.id, remindOn: dayOff(1) };
  p.date = dayOff(4);
  assert.equal(teeTimeDue(p, new Date(2026, 9, 2, 9)), true, 'and the reminder shows again');
});

test('nudges: another phone’s older profile never brings back a card you just put away', () => {
  const s = { nudges: { b: NOW, c: NOW - 30 * DAY } };
  applyDoc(s, 'profile', 'me', { me: 'a', nudges: { b: NOW - 10 * DAY, c: NOW - DAY, d: NOW - 2 * DAY } });
  assert.deepEqual(s.nudges, { b: NOW, c: NOW - DAY, d: NOW - 2 * DAY });
});

test('nudges: the clock starts at the round that left them owing you, never an older one you came out of square', () => {
  // Square ten days ago, then two skins lost to you two days ago
  const even = round('r1', ['a', 'b'], {}, { daysAgo: 10 });
  const lost = round('r2', ['a', 'b'], twoSkins, { daysAgo: 2 });
  const s = stateOf('a', [even, lost]);
  assert.equal(owedSince(s, 'b', 'a', ['r1', 'r2']), NOW - 2 * DAY);
  assert.deepEqual(paymentNudges(s, { now: NOW }), [], 'two days, not ten');
  assert.equal(paymentNudges(s, { now: NOW + 5 * DAY })[0]?.days, 7);
  // Owing you, then back to square between you, then owing again: from the last time it started
  const won = round('r3', ['a', 'b'], { 1: { a: 4, b: 3 }, 2: { a: 4, b: 3 } }, { daysAgo: 12 });
  const back = stateOf('a', [round('r0', ['a', 'b'], twoSkins, { daysAgo: 14 }), won, lost]);
  assert.equal(owedSince(back, 'b', 'a', ['r0', 'r3', 'r2']), NOW - 2 * DAY);
  // Still owing from the first: the first is when it started
  const still = stateOf('a', [round('r0', ['a', 'b'], twoSkins, { daysAgo: 14 }), even, lost]);
  assert.equal(owedSince(still, 'b', 'a', ['r0', 'r1', 'r2']), NOW - 14 * DAY);
});

test('nudges: never about a line the books rolled to next season, even with no round shared live to ask on', () => {
  const r1 = round('r1', ['a', 'b'], twoSkins, { daysAgo: 20 });
  const book = { id: 'bk_1', scope: 'all', name: '2026 season', closedAt: NOW - 19 * DAY, lines: [{ from: 'b', to: 'a', cents: 400, how: 'rolled' }] };
  const s = stateOf('a', [r1], { books: { bk_1: book } });
  assert.equal(outstanding(s, { now: NOW })[0].amount, 4, 'still owed on the Tab');
  assert.equal(owedSince(s, 'b', 'a', ['r1']), null);
  assert.deepEqual(paymentNudges(s, { now: NOW }), []);
  // A line the books marked paid never stops one
  const paidLine = stateOf('a', [r1], { books: { bk_1: { ...book, lines: [{ ...book.lines[0], how: 'paid' }] } } });
  assert.equal(paymentNudges(paidLine, { now: NOW }).length, 1);
  // A new round after the close starts the clock again
  const after = stateOf('a', [r1, round('r2', ['a', 'b'], twoSkins, { daysAgo: 9 })], { books: { bk_1: book } });
  assert.equal(paymentNudges(after, { now: NOW })[0]?.since, NOW - 9 * DAY);
});
