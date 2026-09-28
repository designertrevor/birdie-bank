import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answersFrom, betChoices, betLabel, betOf, betUnitLabel, betVoteChoice, countsLine, dayLabel, daysUntil, inviteText,
  morningText, newPlan, parseBetVote, planChoice, planCounts, planMeta, planPeople, planRules, planStart, playersProblem,
  rollCallDefault, rsvpFor, tally, timeLabel,
  upcomingPlans, whenLabel, withBet,
} from './plans.js';

const SETTINGS = {
  hcPct: 100, shareAmounts: true,
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' },
  wolf: { point: 2, loneMultiplier: 2 },
  banker: { defaultBet: 5, min: 1, max: 20 },
  aces: { ace: 2, deuce: 1 },
  stroke: { stake: 5, payout: 'pot' },
};
const COURSE = { id: 'c1', name: 'Rancho Park', city: 'LA', holes: Array.from({ length: 18 }, (_, i) => ({ no: i + 1, par: 4, hcp: i + 1 })), tees: [{ name: 'Blue' }, { name: 'White' }] };

const base = () => newPlan({
  id: 'pl1', hostWho: 'me', hostName: 'Trevor Nielsen', game: 'skins', holesCount: 18, date: '2026-10-03', teeTime: '08:10',
  course: COURSE, people: [{ id: 'me', name: 'Trevor Nielsen' }, { id: 'mike', name: 'Mike Jones' }, { id: 'dave', name: 'Dave' }, { id: 'sam', name: 'Sam' }],
  ballot: { games: ['nassau', 'wolf'], bets: [2, 5] }, suggestedBet: 2, now: 1,
});
const answer = (plan, who, a) => { plan.answers[who] = { name: who, at: 10, ...a }; return plan; };

test('a new plan has the organizer in, first names only, and their suggestion first on the ballot', () => {
  const p = base();
  assert.deepEqual(p.people.map(x => x.name), ['Trevor', 'Mike', 'Dave', 'Sam']);
  assert.deepEqual(p.ballot.games, ['skins', 'nassau', 'wolf']);
  assert.deepEqual(p.ballot.bets, [2, 5]);
  assert.deepEqual([p.suggested.game, p.suggested.bet], ['skins', 2]);
  assert.equal(p.answers.me.status, 'in');
  assert.deepEqual(planCounts(p), { in: 1, maybe: 0, out: 0, waiting: 3 });
});

test('counts: in, maybe, out and who has not answered, with guests from the group link', () => {
  const p = base();
  answer(p, 'mike', { status: 'in' });
  answer(p, 'dave', { status: 'maybe' });
  answer(p, 'g_x', { name: 'Bo', status: 'out' });
  assert.deepEqual(planCounts(p), { in: 2, maybe: 1, out: 1, waiting: 1 });
  assert.equal(countsLine(planCounts(p)), '2 in · 1 maybe · 1 out · 1 hasn’t answered');
  assert.equal(planPeople(p).at(-1).name, 'Bo');
  assert.equal(planPeople(p).at(-1).invited, false);
});

test('vote: with no votes but the organizer, the suggestion stands', () => {
  const p = base();
  const t = tally(p, 'game');
  assert.equal(t.winner, 'skins');
  assert.equal(t.total, 1);
  assert.deepEqual(t.rows.map(r => r.votes), [1, 0, 0]);
});

test('vote: the group decides, even against the organizer', () => {
  const p = base();
  answer(p, 'mike', { status: 'in', game: 'nassau', bet: 5 });
  answer(p, 'dave', { status: 'maybe', game: 'nassau', bet: 5 });
  assert.deepEqual(planChoice(p), { game: 'nassau', bet: 5 });
  const t = tally(p, 'game');
  assert.equal(t.rows.find(r => r.choice === 'nassau').leading, true);
  assert.equal(t.rows.find(r => r.choice === 'skins').suggested, true);
});

test('vote: a tie goes to the organizer’s suggestion', () => {
  const p = base();
  answer(p, 'mike', { status: 'in', game: 'wolf', bet: 5 });
  assert.equal(tally(p, 'game').winner, 'skins');
  assert.equal(tally(p, 'bet').winner, 2);
});

test('vote: a tie without the suggestion goes to the one listed first', () => {
  const p = base();
  p.answers.me.game = null;
  answer(p, 'mike', { status: 'in', game: 'wolf' });
  answer(p, 'dave', { status: 'in', game: 'nassau' });
  assert.equal(tally(p, 'game').winner, 'nassau');
});

test('vote: people who are out do not vote, and votes off the ballot are ignored', () => {
  const p = base();
  answer(p, 'mike', { status: 'out', game: 'wolf' });
  answer(p, 'dave', { status: 'out', game: 'wolf' });
  answer(p, 'sam', { status: 'in', game: 'banker', bet: 99 });
  const t = tally(p, 'game');
  assert.equal(t.winner, 'skins');
  assert.equal(t.total, 1);
  assert.equal(tally(p, 'bet').total, 1);
});

test('bet as one number: read and set for each kind of game', () => {
  assert.equal(betOf('skins', SETTINGS), 2);
  assert.equal(betOf('skins', { skins: { ...SETTINGS.skins, payout: 'pot' } }), 10);
  const n = withBet('nassau', SETTINGS, 10);
  assert.deepEqual([n.nassau.front, n.nassau.back, n.nassau.total], [10, 10, 10]);
  assert.equal(n.nassau.pressMode, 'manual');
  assert.equal(SETTINGS.nassau.front, 5, 'the original is untouched');
  const b = withBet('banker', SETTINGS, 50);
  assert.deepEqual([b.banker.defaultBet, b.banker.min, b.banker.max], [50, 1, 50]);
  const a = withBet('aces', SETTINGS, 5);
  assert.deepEqual([a.aces.ace, a.aces.deuce], [5, 2.5]);
  assert.equal(betLabel('skins', SETTINGS, 5), '$5 a skin · carryovers');
  assert.equal(betLabel('stroke', SETTINGS, 10), '$10 each in the pot');
});

test('roll call: everyone who said in starts checked', () => {
  const p = base();
  answer(p, 'mike', { status: 'in' });
  answer(p, 'dave', { status: 'maybe' });
  assert.deepEqual(rollCallDefault(p), ['me', 'mike']);
});

test('roll call: starts with the voted game and bet, in the plan’s order, with the middle tee', () => {
  const p = base();
  answer(p, 'mike', { status: 'in', game: 'nassau', bet: 5 });
  answer(p, 'dave', { status: 'in', game: 'nassau', bet: 5 });
  const state = { me: 'me', settings: SETTINGS, players: { me: { id: 'me', name: 'Trevor Nielsen', index: 8 }, mike: { id: 'mike', name: 'Mike Jones', index: 12 }, dave: { id: 'dave', name: 'Dave', index: 20 } } };
  const s = planStart(state, p, ['dave', 'me', 'mike'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.equal(s.game, 'nassau');
  assert.equal(s.settings.nassau.front, 5);
  assert.equal(s.settings.shareAmounts, undefined);
  assert.deepEqual(s.players.map(x => x.id), ['me', 'mike', 'dave']);
  assert.equal(s.players[0].tee, 'Blue');
  assert.deepEqual(s.teams, [['me', 'mike'], ['dave']]);
  assert.deepEqual(s.newPlayers, []);
});

test('roll call: friends from the group link are saved as players, with their payment app', () => {
  const p = base();
  answer(p, 'g_1', { name: 'Bo', status: 'in', payApp: 'cashapp', payHandle: 'bo' });
  answer(p, 'g_2', { name: 'mike jones', status: 'in' });
  const state = { me: 'me', settings: SETTINGS, players: { me: { id: 'me', name: 'Trevor' }, mike: { id: 'mike', name: 'Mike Jones' } } };
  let n = 0;
  const s = planStart(state, p, ['me', 'g_1', 'g_2'], { course: COURSE, newId: () => `new${++n}` });
  assert.deepEqual(s.players.map(x => x.id), ['me', 'new1', 'mike']);
  assert.deepEqual(s.newPlayers, [{ id: 'new1', name: 'Bo', index: null, createdAt: s.newPlayers[0].createdAt, payApp: 'cashapp', payHandle: 'bo' }]);
});

test('roll call: a head count that does not fit the game says why', () => {
  const p = base();
  p.suggested.game = 'wolf';
  p.answers.me.game = 'wolf';
  const state = { me: 'me', settings: SETTINGS, players: { me: { id: 'me', name: 'Trevor' }, mike: { id: 'mike', name: 'Mike' } } };
  const s = planStart(state, p, ['me', 'mike'], { course: COURSE });
  assert.equal(s.problem, 'Wolf is for exactly 4. You have 2.');
  assert.equal(planStart(state, base(), ['me'], { course: COURSE }).problem, 'Skins needs at least 2 players. You have 1.');
  assert.equal(planStart(state, base(), ['me', 'mike'], {}).problem, 'That course isn’t saved on this phone');
  assert.equal(playersProblem('banker', 9), 'Banker takes up to 8 players. You have 9.');
});

test('shared plan: local fields stay on the phone, answers come back from the rows', () => {
  const p = base();
  p.code = 'ABCDEF';
  const meta = planMeta(p);
  assert.equal(meta.code, undefined);
  assert.equal(meta.answers, undefined);
  assert.equal(meta.host, undefined);
  const a = answersFrom(
    [{ who: 'mike', name: 'Mike', status: 'in', at: 5 }, { who: 'x', name: 'X', status: 'nope' }],
    [{ who: 'mike', kind: 'game', choice: 'wolf' }, { who: 'mike', kind: 'bet', choice: '5' }, { who: 'ghost', kind: 'game', choice: 'wolf' }],
  );
  assert.deepEqual(a, { mike: { name: 'Mike', status: 'in', at: 5, game: 'wolf', bet: 5 } });
});

test('dates: today, tomorrow, this week, later', () => {
  const now = new Date(2026, 8, 28, 9); // Monday, Sep 28
  assert.equal(daysUntil('2026-09-28', now), 0);
  assert.equal(dayLabel('2026-09-28', now), 'Today');
  assert.equal(dayLabel('2026-09-29', now), 'Tomorrow');
  assert.equal(dayLabel('2026-10-03', now), 'Saturday');
  assert.equal(dayLabel('2026-10-10', now), 'Sat, Oct 10');
  assert.equal(timeLabel('08:10'), '8:10 AM');
  assert.equal(timeLabel('13:05'), '1:05 PM');
  assert.equal(timeLabel('00:30'), '12:30 AM');
  assert.equal(whenLabel({ date: '2026-10-03', teeTime: '08:10' }, now), 'Saturday · 8:10 AM');
});

test('up next: soonest first, finished or old plans drop off', () => {
  const now = new Date(2026, 8, 28, 9);
  const state = { plans: {
    a: { id: 'a', status: 'planned', date: '2026-10-03', teeTime: '09:00' },
    b: { id: 'b', status: 'planned', date: '2026-10-03', teeTime: '07:30' },
    c: { id: 'c', status: 'started', date: '2026-09-28', host: true },
    d: { id: 'd', status: 'planned', date: '2026-09-20' },
    e: { id: 'e', status: 'off', date: '2026-09-29' },
    f: { id: 'f', status: 'started', date: '2026-09-28', host: false, liveCode: 'QWERTY' },
    g: { id: 'g', status: 'started', date: '2026-09-20', host: false },
  } };
  // The organizer has the round itself; a friend keeps the plan to follow along
  assert.deepEqual(upcomingPlans(state, now).map(p => p.id), ['f', 'e', 'b', 'a']);
  assert.deepEqual(upcomingPlans({ plans: { x: null } }, now), []);
});

test('shared plan: this phone’s retry flags and its own round never go to friends', () => {
  const p = base();
  p.unsent = { host: true };
  p.metaUnsent = true;
  p.roundId = 'r_1';
  const meta = planMeta(p);
  assert.equal(meta.unsent, undefined);
  assert.equal(meta.metaUnsent, undefined);
  assert.equal(meta.roundId, undefined);
});

test('roll call: a saved player with no name does not trip up matching friends by name', () => {
  const p = base();
  answer(p, 'g_1', { name: 'Bo', status: 'in' });
  const state = { me: 'me', settings: SETTINGS, players: { me: { id: 'me', name: 'Trevor' }, old: { id: 'old' } } };
  const s = planStart(state, p, ['me', 'g_1'], { course: COURSE, newId: () => 'n1' });
  assert.deepEqual(s.players.map(x => x.id), ['me', 'n1']);
});

test('players card: a friend’s answer to the next plan you organized', () => {
  const now = new Date(2026, 8, 28, 9);
  const p = answer(base(), 'mike', { status: 'maybe' });
  const state = { plans: { pl1: p } };
  assert.equal(rsvpFor(state, 'mike', now).status, 'maybe');
  assert.equal(rsvpFor(state, 'dave', now).status, null);
  assert.equal(rsvpFor(state, 'nobody', now), null);
});

test('texts: the invite and the morning text name the day, the course, who is in and the group’s pick', () => {
  const now = new Date(2026, 9, 3, 6); // the morning of
  const p = base();
  answer(p, 'mike', { name: 'Mike', status: 'in', game: 'skins', bet: 5 });
  answer(p, 'dave', { name: 'Dave', status: 'in', bet: 5 });
  assert.equal(morningText(p, 'https://x/?plan=ABCDEF', SETTINGS, now),
    'Golf today! Rancho Park, tee time 8:10 AM.\nIn: Trevor, Mike and Dave.\nGame: Skins, $5 a skin · carryovers.\nhttps://x/?plan=ABCDEF');
  const early = new Date(2026, 8, 28, 9);
  assert.match(inviteText(p, 'L', early), /^Golf Saturday at 8:10 AM\? Rancho Park\.\nThinking Skins\./);
});

// --------------------------- the bet vote, per game ---------------------------

const perGame = () => newPlan({
  id: 'pl2', hostWho: 'me', hostName: 'Trevor Nielsen', game: 'skins', holesCount: 18, date: '2026-10-03', teeTime: '08:10',
  course: COURSE, people: [{ id: 'me', name: 'Trevor' }, { id: 'mike', name: 'Mike' }, { id: 'dave', name: 'Dave' }, { id: 'sam', name: 'Sam' }],
  ballot: { games: ['nassau', 'wolf'], bets: [1, 5] }, suggestedBet: 2, settings: SETTINGS, now: 1,
});
const STATE = { me: 'me', settings: SETTINGS, players: { me: { id: 'me', name: 'Trevor' }, mike: { id: 'mike', name: 'Mike' }, dave: { id: 'dave', name: 'Dave' }, sam: { id: 'sam', name: 'Sam' } } };

test('bet choices: a step down, the usual bet and a step up on the ladder', () => {
  assert.deepEqual(betChoices(5), [2, 5, 10]);
  assert.deepEqual(betChoices(1), [1, 2]);
  assert.deepEqual(betChoices(50), [20, 50]);
  assert.deepEqual(betChoices(3), [2, 3, 5]);
});

test('ballot: each game has its own amounts around its usual bet, in its own unit', () => {
  const p = perGame();
  assert.deepEqual(p.ballot.betsByGame, { skins: [1, 2, 5], nassau: [2, 5, 10], wolf: [1, 2, 5] });
  assert.deepEqual(p.suggested.bets, { skins: 2, nassau: 5, wolf: 2 });
  assert.deepEqual(p.ballot.rules.nassau, SETTINGS.nassau, 'the organizer’s house rules ride along for friends');
  assert.deepEqual(p.answers.me, { name: 'Trevor', status: 'in', game: 'skins', bet: 2, betGame: 'skins', at: 1 });
  // A friend's phone with other house rules still shows the organizer's units
  const rules = planRules(p, { skins: { value: 9, payout: 'pot', stake: 20 } });
  assert.equal(betUnitLabel('nassau', rules, 5), '$5 a side');
  assert.equal(betUnitLabel('wolf', rules, 1), '$1 a point');
  assert.equal(betUnitLabel('skins', rules, 2), '$2 a skin');
  assert.equal(betLabel('nassau', rules, 10), '$10 a side');
  assert.deepEqual(tally(p, 'bet', 'nassau').rows.map(r => betUnitLabel('nassau', rules, r.choice)), ['$2 a side', '$5 a side', '$10 a side']);
});

test('tally per game: the bet is the one voted for the winning game', () => {
  const p = perGame();
  answer(p, 'mike', { status: 'in', game: 'nassau', bet: 10, betGame: 'nassau' });
  answer(p, 'dave', { status: 'in', game: 'nassau', bet: 10, betGame: 'nassau' });
  answer(p, 'sam', { status: 'in', game: 'wolf', bet: 1, betGame: 'wolf' });
  const t = tally(p, 'bet');
  assert.equal(t.game, 'nassau');
  assert.equal(t.total, 2, 'votes for other games’ bets do not count');
  assert.deepEqual(t.rows.map(r => [r.choice, r.votes]), [[2, 0], [5, 0], [10, 2]]);
  assert.deepEqual(planChoice(p), { game: 'nassau', bet: 10 });
  assert.equal(tally(p, 'bet', 'wolf').winner, 1);
  assert.equal(tally(p, 'bet', 'skins').winner, 2);
});

test('tally per game: a tie goes to the organizer’s suggestion for that game', () => {
  const p = perGame();
  answer(p, 'mike', { status: 'in', game: 'nassau', bet: 10, betGame: 'nassau' });
  answer(p, 'dave', { status: 'in', game: 'nassau', bet: 5, betGame: 'nassau' });
  assert.deepEqual(planChoice(p), { game: 'nassau', bet: 5 });
  // Nobody voted a bet for the winning game: its suggestion stands, not the skins amount
  const q = perGame();
  answer(q, 'mike', { status: 'in', game: 'nassau' });
  answer(q, 'dave', { status: 'in', game: 'nassau' });
  assert.deepEqual(planChoice(q), { game: 'nassau', bet: 5 });
});

test('tee off: starts the voted game with the amount voted for that game and the rules on the ballot', () => {
  const p = perGame();
  answer(p, 'mike', { status: 'in', game: 'nassau', bet: 10, betGame: 'nassau' });
  answer(p, 'dave', { status: 'in', game: 'nassau', bet: 10, betGame: 'nassau' });
  answer(p, 'sam', { status: 'in', game: 'wolf', bet: 1, betGame: 'wolf' });
  const state = { ...STATE, settings: { ...SETTINGS, nassau: { ...SETTINGS.nassau, pressMode: 'auto' } } };
  const s = planStart(state, p, ['me', 'mike', 'dave', 'sam'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.equal(s.game, 'nassau');
  assert.equal(s.bet, 10);
  assert.deepEqual([s.settings.nassau.front, s.settings.nassau.back, s.settings.nassau.total], [10, 10, 10]);
  assert.equal(s.settings.nassau.pressMode, 'manual', 'the house rules the group saw on the ballot');
  assert.equal(s.settings.skins.value, 2);
  assert.equal(morningText(p, 'L', SETTINGS, new Date(2026, 9, 3, 6)).split('\n')[2], 'Game: Nassau, $10 a side.');
});

test('old plans with one amount for every game still load, vote and tee off', () => {
  // Saved before bets were per game: one list of amounts, one suggestion, votes with no game
  const old = {
    id: 'old', v: 1, status: 'planned', createdAt: 1, host: true, hostWho: 'me', hostName: 'Trevor',
    game: 'skins', holesCount: 18, nine: 'front', date: '2026-10-03', teeTime: '08:10', useHc: true,
    course: { id: 'c1', name: 'Rancho Park', city: 'LA' },
    people: [{ id: 'me', name: 'Trevor' }, { id: 'mike', name: 'Mike' }, { id: 'dave', name: 'Dave' }],
    ballot: { games: ['skins', 'nassau', 'wolf'], bets: [2, 5] },
    suggested: { game: 'skins', bet: 2 },
    answers: { me: { name: 'Trevor', status: 'in', game: 'skins', bet: 2, at: 1 } },
    code: null,
  };
  assert.deepEqual(tally(old, 'bet', 'wolf').rows.map(r => r.choice), [2, 5], 'the one list serves every game');
  answer(old, 'mike', { status: 'in', game: 'nassau', bet: 5 });
  assert.deepEqual(planChoice(old), { game: 'skins', bet: 2 }, 'a tie still goes to the suggestion');
  answer(old, 'dave', { status: 'in', game: 'nassau', bet: 5 });
  assert.deepEqual(planChoice(old), { game: 'nassau', bet: 5 });
  const s = planStart(STATE, old, ['me', 'mike', 'dave'], { course: COURSE });
  assert.equal(s.problem, null);
  assert.equal(s.settings.nassau.front, 5);
  assert.equal(s.settings.nassau.pressMode, 'manual');
  assert.match(morningText(old, 'L', SETTINGS, new Date(2026, 9, 3, 6)), /Game: Nassau, \$5 a side\./);
  // Someone votes again on the new version: their vote now names its game, and still counts
  answer(old, 'mike', { status: 'in', game: 'nassau', bet: 2, betGame: 'nassau' });
  answer(old, 'dave', { status: 'in', game: 'nassau', bet: 2, betGame: 'nassau' });
  assert.deepEqual(planChoice(old), { game: 'nassau', bet: 2 });
});

test('bet votes on the server: the game rides along, and old votes still read', () => {
  assert.equal(betVoteChoice({ bet: 10, betGame: 'nassau' }), 'nassau:10');
  assert.equal(betVoteChoice({ bet: 5 }), '5');
  assert.equal(betVoteChoice({ bet: null, betGame: 'nassau' }), null);
  assert.deepEqual(parseBetVote('nassau:10'), { bet: 10, betGame: 'nassau' });
  assert.deepEqual(parseBetVote('5'), { bet: 5 });
  assert.equal(parseBetVote('bogus:5'), null);
  assert.equal(parseBetVote('nassau:0'), null);
  assert.ok('stableford:50'.length <= 32, 'fits the server’s 32 characters');
  const a = answersFrom(
    [{ who: 'mike', name: 'Mike', status: 'in', at: 5 }, { who: 'dave', name: 'Dave', status: 'in', at: 6 }],
    [{ who: 'mike', kind: 'bet', choice: 'wolf:1' }, { who: 'dave', kind: 'bet', choice: '5' }],
  );
  assert.deepEqual([a.mike.bet, a.mike.betGame, a.dave.bet, a.dave.betGame], [1, 'wolf', 5, undefined]);
});
