import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_DEFAULT, askText, codeDay, dayCode, dayOptions, decodeDays, detailStates, encodeDays, leadingDay, lockNudge, lockText,
  MAX_DAY_OPTIONS, normalizePlan, offeredDays, shortDay, soonDays, waitingLine, whenLine,
} from './plan-open.js';
import { answersFrom, daysFit, daysKept, gameVoteChoice, inviteText, newPlan, nudgeText, parseGameVote, planChoice, planPeople, roomForADay, tally, upcomingPlans } from './plans.js';
import { cleanAsk, groupGames, newAskPlan } from './plan-ask.js';
import { planActivity } from './plan-basics.js';

const NOW = new Date(2026, 9, 20, 9); // Tue Oct 20, 2026
const SETTINGS = { skins: { value: 2, payout: 'per', carryover: true }, nassau: { front: 5, back: 5, total: 5 }, wolf: { point: 1 }, bestball: { front: 5, back: 5, total: 5 } };
const PEOPLE = [{ id: 'dave', name: 'Dave' }, { id: 'sam', name: 'Sam' }, { id: 'mike', name: 'Mike' }, { id: 'jordan', name: 'Jordan' }];
const ask = (over = {}) => newAskPlan({ id: 'pl1', hostName: 'Trevor Nielsen', people: PEOPLE, settings: SETTINGS, now: 1, ...over });
const answer = (plan, who, a) => { plan.answers[who] = { name: who[0].toUpperCase() + who.slice(1), at: 10, ...a }; return plan; };

// --------------------------- the codec -------------------------------------

test('days ride in a vote as short codes, soonest first', () => {
  assert.equal(dayCode('2026-01-01'), '0');
  assert.equal(codeDay(dayCode('2026-10-25')), '2026-10-25');
  assert.equal(codeDay(dayCode('2029-12-31')), '2029-12-31');
  assert.equal(dayCode('2025-12-31'), null);
  assert.equal(dayCode('2026-02-31'), null);
  assert.equal(codeDay('!!'), null);
  assert.equal(encodeDays(['2026-10-26', '2026-10-25', '2026-10-25', 'junk']), `${dayCode('2026-10-25')}.${dayCode('2026-10-26')}`);
  assert.deepEqual(decodeDays(encodeDays(['2026-10-31', '2026-10-25'])), ['2026-10-25', '2026-10-31']);
  // The latest days go first when there isn't room
  assert.equal(encodeDays(['2026-10-25', '2026-10-26', '2026-10-31'], 5), `${dayCode('2026-10-25')}.${dayCode('2026-10-26')}`);
});

test('a game vote carries the days after a second ~, and fits the 32 characters the server keeps', () => {
  const days = ['2026-10-25', '2026-11-01'];
  const enc = encodeDays(days);
  assert.equal(gameVoteChoice({ game: 'skins', days }), `skins~~${enc}`);
  assert.equal(gameVoteChoice({ days }), `~~${enc}`);
  assert.equal(gameVoteChoice({ game: 'nassau', sides: { skins: true }, days }), `nassau~skins~${enc}`);
  assert.equal(gameVoteChoice({ game: 'nassau', days: [] }), 'nassau');
  const long = gameVoteChoice({ game: 'stableford', sides: { skins: false, dots: false }, days: ['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08'] });
  assert.ok(long.length <= 32, long);
  assert.deepEqual(parseGameVote(`skins~~${enc}`), { game: 'skins', days });
  assert.deepEqual(parseGameVote(`~~${enc}`), { game: null, days });
  assert.deepEqual(parseGameVote(`nassau~skins~${enc}`), { game: 'nassau', sides: { skins: true }, days });
  // As phones before this read it: the first two parts only, so the game and side votes stay
  const [g, rest] = `nassau~skins~${enc}`.split('~');
  assert.deepEqual([g, rest], ['nassau', 'skins']);
  const back = answersFrom([{ who: 'dave', name: 'Dave', status: 'in' }], [{ who: 'dave', kind: 'game', choice: `~~${enc}` }]);
  assert.deepEqual(back.dave.days, days);
  assert.deepEqual(planPeople({ people: [{ id: 'dave', name: 'Dave' }], answers: back })[0].days, days);
});

test('day ticks stop at what one vote holds, so no ticked day is cut (long and short game ids)', () => {
  const WEEKENDS = ['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22'];
  const most = a => { let n = 0; while (n < WEEKENDS.length && daysFit({ ...a, days: WEEKENDS.slice(0, n + 1) })) n++; return n; };
  // "stableford~~" leaves 20 characters: seven days of "8f." fit, the eighth doesn't
  assert.equal(most({ game: 'stableford' }), 7);
  assert.equal(gameVoteChoice({ game: 'stableford', days: WEEKENDS.slice(0, 7) }).length, 32);
  assert.equal(roomForADay({ game: 'stableford', days: WEEKENDS.slice(0, 6) }, NOW), true);
  assert.equal(roomForADay({ game: 'stableford', days: WEEKENDS.slice(0, 7) }, NOW), false);
  // The review's repro: eight ticked on a Stableford vote would come back as seven
  assert.equal(daysFit({ game: 'stableford', days: WEEKENDS.slice(0, 8) }), false);
  assert.deepEqual(daysKept({ game: 'stableford', days: WEEKENDS.slice(0, 8) }), WEEKENDS.slice(0, 7));
  assert.deepEqual(parseGameVote(gameVoteChoice({ game: 'stableford', days: WEEKENDS.slice(0, 7) })).days, WEEKENDS.slice(0, 7));
  // Short ids hold more: Skins eight, BBB and no game vote nine, and every one reads back whole
  assert.equal(most({ game: 'skins' }), 8);
  assert.equal(most({ game: 'bbb' }), 9);
  assert.equal(most({}), 10);
  for (const game of ['skins', 'bbb']) {
    const n = most({ game });
    assert.deepEqual(parseGameVote(gameVoteChoice({ game, days: WEEKENDS.slice(0, n) })).days, WEEKENDS.slice(0, n));
    assert.equal(roomForADay({ game, days: WEEKENDS.slice(0, n - 1) }, NOW), true);
    assert.equal(roomForADay({ game, days: WEEKENDS.slice(0, n) }, NOW), false);
  }
  // Side game votes take room too, and the same count drives the "full" note
  const sides = { game: 'stableford', sides: { skins: true, dots: false } };
  assert.equal(most(sides), 3);
  assert.equal(roomForADay({ ...sides, days: WEEKENDS.slice(0, 3) }, NOW), false);
  // Nothing ticked always fits; a duplicate doesn't take room twice
  assert.equal(daysFit({ game: 'stableford', days: [] }), true);
  assert.equal(daysFit({ game: 'stableford', days: [...WEEKENDS.slice(0, 7), WEEKENDS[0]] }), true);
});

test('days on offer: the organizer adds up to MAX_DAY_OPTIONS, today on, the ones offered first keep their place', () => {
  const six = ['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08'];
  assert.equal(MAX_DAY_OPTIONS, 6);
  assert.deepEqual(offeredDays(six.slice(0, 4), ['2026-11-07', '2026-11-08', '2026-11-14'], NOW), six);
  assert.deepEqual(offeredDays(six, ['2026-10-21'], NOW), six);
  // A day already on offer, a past one, or junk adds nothing
  assert.deepEqual(offeredDays(['2026-10-24'], ['2026-10-24', '2026-10-19', 'junk'], NOW), ['2026-10-24']);
  assert.deepEqual(offeredDays(['2026-10-18', '2026-10-24'], [], NOW), ['2026-10-24']);
});

// --------------------------- the normalizer --------------------------------

test('normalizer: a plan saved before (a day, a game and a ballot) reads as all set, unchanged otherwise', () => {
  const old = newPlan({ id: 'o', hostName: 'Trevor', game: 'skins', holesCount: 18, date: '2026-10-25', teeTime: '08:10', course: { id: 'c', name: 'Riverside' }, people: PEOPLE, ballot: { games: ['nassau'], bets: [2, 5] }, suggestedBet: 2, settings: SETTINGS, now: 1 });
  delete old.when; delete old.groupPicks; delete old.ask;
  const n = normalizePlan(old);
  assert.deepEqual(n.when, { mode: 'set', days: [], part: null });
  assert.deepEqual(n.groupPicks, { game: false, bet: false });
  assert.equal(n.ask, null);
  assert.equal(n.date, '2026-10-25');
  assert.deepEqual(n.ballot, old.ballot);
  assert.deepEqual(n.answers, old.answers);
  const s = detailStates(old, { now: NOW });
  assert.equal(s.day.state, 'set');
  assert.equal(s.day.label, 'Sun Oct 25 · 8:10 AM');
  assert.equal(s.course.state, 'set');
  assert.deepEqual(s.game, { state: 'vote', label: 'skins suggested' });
  assert.equal(s.bet.state, 'vote');
});

test('normalizer: odd or missing fields read safely', () => {
  assert.equal(normalizePlan(null), null);
  const n = normalizePlan({ date: '2026-02-31', when: { mode: 'set', days: ['2026-10-25', 'x', '2026-10-25'], part: 'night' }, groupPicks: { game: 'yes' }, ask: '   ' });
  assert.equal(n.date, null);
  assert.deepEqual(n.when, { mode: 'options', days: ['2026-10-25'], part: null });
  assert.deepEqual(n.groupPicks, { game: false, bet: false });
  assert.equal(n.ask, null);
  assert.equal(normalizePlan({}).when.mode, 'open');
  // A day set wins over a stale mode
  assert.equal(normalizePlan({ date: '2026-10-25', when: { mode: 'options', days: ['2026-10-26'] } }).when.mode, 'set');
});

// --------------------------- the ask ---------------------------------------

test('the ask: nothing set is a plan with no day, any course, and the group picking the game and bet', () => {
  const p = ask();
  assert.equal(p.date, null);
  assert.equal(p.course, null);
  assert.equal(p.ask, ASK_DEFAULT);
  assert.deepEqual(p.when, { mode: 'open', days: [], part: null });
  assert.deepEqual(p.groupPicks, { game: true, bet: true });
  assert.deepEqual(p.ballot.games, ['skins', 'nassau', 'wolf', 'bestball']);
  assert.equal(p.answers.host.status, 'in');
  assert.equal(p.answers.host.game, undefined);
  assert.equal(p.answers.host.bet, null);
  const s = detailStates(p, { now: NOW });
  assert.deepEqual([s.day.state, s.course.state, s.game.state, s.bet.state], ['not', 'not', 'not', 'not']);
  assert.deepEqual([s.day.label, s.course.label, s.game.label, s.bet.label], ['Not yet', 'Any course', 'Group picks', 'Group picks']);
  // An older phone still reads a game and a bet from it
  assert.equal(planChoice(p).game, 'skins');
  assert.ok(planChoice(p).bet > 0);
});

test('the ask: a set game and bet, a set day, and a few days offered', () => {
  const set = ask({ pick: { game: 'nassau', bet: 10 }, when: { mode: 'set', date: '2026-10-25', part: 'morning' } });
  assert.equal(set.date, '2026-10-25');
  assert.deepEqual(set.ballot.games, ['nassau']);
  const s = detailStates(set, { now: NOW });
  assert.deepEqual(s.game, { state: 'set', label: 'nassau' });
  assert.deepEqual(s.bet, { state: 'set', label: '$10' });
  assert.equal(s.day.label, 'Sun Oct 25 · Morning');
  const betVote = ask({ pick: { game: 'wolf' } });
  assert.equal(detailStates(betVote, { now: NOW }).bet.state, 'not');
  assert.equal(betVote.answers.host.game, 'wolf');
  const opts = ask({ when: { mode: 'options', days: ['2026-10-31', '2026-10-25', 'x'] } });
  assert.deepEqual(opts.when.days, ['2026-10-25', '2026-10-31']);
  assert.deepEqual(opts.answers.host.days, ['2026-10-25', '2026-10-31']);
  assert.equal(detailStates(opts, { now: NOW }).day.state, 'vote');
  // Options with no days is not sure yet
  assert.equal(ask({ when: { mode: 'options', days: [] } }).when.mode, 'open');
  assert.equal(cleanAsk('  Golf   Sat? '), 'Golf Sat?');
  assert.equal(cleanAsk(''), ASK_DEFAULT);
});

test('group games: most played first, then the favourites', () => {
  const state = { rounds: { a: { status: 'done', game: 'banker' }, b: { status: 'done', game: 'banker' }, c: { status: 'done', game: 'wolf' }, d: { status: 'live', game: 'vegas' } } };
  assert.deepEqual(groupGames(state), ['banker', 'wolf', 'skins', 'nassau']);
  assert.deepEqual(groupGames({}), ['skins', 'nassau', 'wolf', 'bestball']);
});

// --------------------------- the day vote ----------------------------------

test('day options: the offered days and days friends add, who can make each, people out not counted', () => {
  const p = ask({ when: { mode: 'options', days: ['2026-10-25', '2026-10-31', '2026-10-18'] } });
  answer(p, 'dave', { status: 'in', days: ['2026-10-25', '2026-11-01'] });
  answer(p, 'sam', { status: 'maybe', days: ['2026-10-25'] });
  answer(p, 'mike', { status: 'out', days: ['2026-10-31'] });
  const o = dayOptions(p, NOW);
  // Oct 18 has gone by
  assert.deepEqual(o.map(x => x.iso), ['2026-10-25', '2026-10-31', '2026-11-01']);
  assert.deepEqual(o.map(x => x.votes), [3, 1, 1]);
  assert.deepEqual(o[0].ins, ['Trevor', 'Dave']);
  assert.deepEqual(o[0].maybes, ['Sam']);
  assert.equal(o[2].option, false);
  assert.equal(o[2].by, 'Dave');
  assert.equal(leadingDay(p, NOW).iso, '2026-10-25');
});

test('leading day: most votes, then most who are in, then the soonest; none before anyone picks', () => {
  const p = ask({ when: { mode: 'options', days: ['2026-10-25', '2026-10-31'] } });
  delete p.answers.host.days;
  assert.equal(leadingDay(p, NOW), null);
  answer(p, 'dave', { status: 'maybe', days: ['2026-10-25'] });
  answer(p, 'sam', { status: 'in', days: ['2026-10-31'] });
  assert.equal(leadingDay(p, NOW).iso, '2026-10-31');
  answer(p, 'sam', { status: 'maybe', days: ['2026-10-31'] });
  assert.equal(leadingDay(p, NOW).iso, '2026-10-25');
  assert.equal(detailStates(p, { now: NOW }).day.label, 'Sun Oct 25 leads');
  assert.equal(whenLine(p, NOW), 'No day yet · Sun Oct 25 leads');
});

test('lock nudge: one day clearly leads with most people able to make it', () => {
  const p = ask({ when: { mode: 'options', days: ['2026-10-25', '2026-10-31'] } });
  // Just the organizer: no nudge
  assert.equal(lockNudge(p, NOW), null);
  answer(p, 'dave', { status: 'in', days: ['2026-10-25'] });
  // Two of five (three haven't answered): not most yet
  assert.equal(lockNudge(p, NOW), null);
  answer(p, 'sam', { status: 'in', days: ['2026-10-25', '2026-10-31'] });
  const n = lockNudge(p, NOW);
  assert.deepEqual(n, { iso: '2026-10-25', votes: 3, of: 5, waiting: ['Mike', 'Jordan'], cant: [] });
  // A tie at the top is no nudge
  answer(p, 'mike', { status: 'in', days: ['2026-10-31'] });
  assert.equal(lockNudge(p, NOW), null);
  answer(p, 'jordan', { status: 'in', days: ['2026-10-31'] });
  assert.deepEqual(lockNudge(p, NOW), { iso: '2026-10-31', votes: 4, of: 5, waiting: [], cant: ['Dave'] });
  // Once the day is set, or called off, there's nothing to nudge
  assert.equal(lockNudge({ ...p, date: '2026-10-31' }, NOW), null);
  assert.equal(lockNudge({ ...p, status: 'off' }, NOW), null);
  assert.equal(waitingLine(['Jordan']), 'Jordan hasn’t answered');
  assert.equal(waitingLine(['Jordan', 'Mike', 'Sam']), 'Jordan, Mike and Sam haven’t answered');
});

test('game and bet votes on a group picks plan keep the ballot tally', () => {
  const p = ask();
  answer(p, 'dave', { status: 'in', game: 'wolf', bet: 2, betGame: 'wolf' });
  answer(p, 'sam', { status: 'in', game: 'wolf' });
  answer(p, 'mike', { status: 'in', game: 'nassau' });
  assert.equal(tally(p, 'game').winner, 'wolf');
  const s = detailStates(p, { now: NOW, name: g => g.toUpperCase(), unit: (g, b) => `${b} a point` });
  assert.deepEqual(s.game, { state: 'vote', label: 'WOLF leads' });
  assert.deepEqual(s.bet, { state: 'vote', label: '2 a point leads' });
});

// --------------------------- texts and Up next ------------------------------

test('texts: the ask with its days, nudges say soon, and the lock text', () => {
  const p = ask({ when: { mode: 'options', days: ['2026-10-25', '2026-10-31'], part: 'morning' }, course: { id: 'c', name: 'Riverside' } });
  assert.equal(askText(p, 'L', NOW), `${ASK_DEFAULT}\nThinking Sun Oct 25 or Sat Oct 31, morning. At Riverside.\nTap to say if you’re in and which days work:\nL`);
  assert.equal(inviteText(p, 'L', NOW), askText(p, 'L', NOW));
  assert.equal(askText(ask(), 'L', NOW), `${ASK_DEFAULT}\nTap to say if you’re in and when you can play:\nL`);
  assert.match(nudgeText(p, 'Dave', 'L', NOW), /you in for golf soon\?/);
  assert.equal(lockText({ ...p, date: '2026-10-25', teeTime: '08:40' }, 'L'), 'Golf’s on: Sun Oct 25 at 8:40 AM, Riverside.\nTap to see who’s in:\nL');
  assert.equal(lockText({ ...p, date: '2026-10-25' }, null), 'Golf’s on: Sun Oct 25 in the morning, Riverside.');
  assert.equal(shortDay('2026-10-25'), 'Sun Oct 25');
});

test('up next: plans with no day stay while they are on, after the ones with a day', () => {
  const state = { plans: {
    a: { id: 'a', status: 'planned', date: '2026-10-25' },
    b: { id: 'b', status: 'planned', date: null, createdAt: NOW.getTime() - 5 * 86400000 },
    c: { id: 'c', status: 'planned', createdAt: NOW.getTime() - 6 * 86400000 },
    d: { id: 'd', status: 'off', date: null, createdAt: NOW.getTime() - 86400000 },
    e: { id: 'e', status: 'off', date: null, createdAt: NOW.getTime() - 10 * 86400000 },
    f: { id: 'f', status: 'planned', date: '2026-10-22' },
  } };
  assert.deepEqual(upcomingPlans(state, NOW).map(p => p.id), ['f', 'a', 'c', 'b', 'd']);
});

test('up next: a plan with no day called off stays 3 days from when it was called off', () => {
  const DAY = 86400000;
  const state = { plans: {
    // Made 4 days ago, called off just now: friends still see "Called off"
    late: { id: 'late', status: 'off', date: null, createdAt: NOW.getTime() - 4 * DAY, offAt: NOW.getTime() - 60000 },
    // Called off 3 days ago and more: gone
    old: { id: 'old', status: 'off', date: null, createdAt: NOW.getTime() - 5 * DAY, offAt: NOW.getTime() - 3 * DAY - 1 },
    // Called off before offAt was kept: from when it was made, as before
    before: { id: 'before', status: 'off', date: null, createdAt: NOW.getTime() - 2 * DAY },
    beforeOld: { id: 'beforeOld', status: 'off', date: null, createdAt: NOW.getTime() - 4 * DAY },
  } };
  assert.deepEqual(upcomingPlans(state, NOW).map(p => p.id).sort(), ['before', 'late']);
});

test('up next: a plan with no day drops off after 30 days with nothing happening on it', () => {
  const DAY = 86400000;
  const at = n => NOW.getTime() - n * DAY;
  const state = { plans: {
    fresh: { id: 'fresh', status: 'planned', date: null, createdAt: at(29) },
    stale: { id: 'stale', status: 'planned', date: null, createdAt: at(31) },
    // Made long ago, but someone answered last week: still going
    answered: { id: 'answered', status: 'planned', date: null, createdAt: at(60), answers: { dave: { name: 'Dave', status: 'in', at: at(7) } } },
    quiet: { id: 'quiet', status: 'planned', date: null, createdAt: at(60), answers: { dave: { name: 'Dave', status: 'in', at: at(45) } } },
    // No time on it at all: kept, it can't be aged
    untimed: { id: 'untimed', status: 'planned', date: null },
    // A dated plan never ages this way, only by its day
    dated: { id: 'dated', status: 'planned', date: '2026-10-25', createdAt: at(90) },
  } };
  assert.deepEqual(upcomingPlans(state, NOW).map(p => p.id), ['dated', 'untimed', 'answered', 'fresh']);
  assert.equal(planActivity(state.plans.answered), at(7));
  assert.equal(planActivity(state.plans.stale), at(31));
  assert.equal(planActivity({}), 0);
});

test('soon days: the next weekend days from today', () => {
  assert.deepEqual(soonDays(NOW, 4), ['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01']);
  assert.deepEqual(soonDays(new Date(2026, 9, 25, 9), 2), ['2026-10-25', '2026-10-31']);
});
