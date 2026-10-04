// Challenges after the Overnight 7 review (challenges.js): one set up by the organizer (or the
// scorekeeper) between two other people, answers put in for someone who isn't on the app (their own
// answer from their own phone wins), a planned round's challenges moving with the plan when its
// round is kept for another day, and the Saturday preview carrying the plan's agreed challenges and
// kept side bets ("Dave v Mike, $20 match"). Old challenges and old rounds play exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { newPlan, planStart } from './plans.js';
import { setupForPlan } from './plan-setup.js';
import {
  PROXY, canMove, challengeHeadline, challengeLately, challengeLife, challengeLine, challengeNextText, challengePair, challengeSetUpText, challengeState,
  challengeStatusText, challengeToSend, challengeTone, challengeView, challengesForRound, challengesWith, isProxy, markSides, markerName, moveIdFor,
  movedFromFor, movedKeys, myChallenges, newChallenge, planChallenges, planOf, proxiedFor, proxyNote, setUpHere, setUpLine, sideOf, withMove,
} from './challenges.js';
import { pushChallenge } from './challenge-push.js';
import { pairBetLine, planPreview, previewCardModel, previewPairBets, previewText } from './preview.js';

const DAY = 86400000;
const NOW = new Date(2026, 9, 3, 21, 0).getTime(); // Saturday night, Oct 3
const PARS = [4, 4, 3, 4, 5, 3, 4, 4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 3];
const COURSE = { id: 'c1', name: 'Rancho Park', city: 'LA', tees: [{ name: 'Blue' }], holes: PARS.map((par, i) => ({ par, hdcp: i + 1 })) };
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' }, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' } };

let n = 0;
/** Moves one after another, a minute apart. `proxy`: put in for them by the organizer. */
function played(ch, ...moves) {
  let c = ch;
  for (const { proxy, ...m } of moves) c = withMove(c, { id: moveIdFor(`m${++n}`, proxy), at: (ch.at || 0) + ((c.moves || []).length + 1) * 60000, ...m }) || c;
  return c;
}
const dave = { who: 'dave', name: 'Dave Smith' };
const mike = { who: 'mike', name: 'Mike Jones' };
const trevor = { who: 'host', name: 'Trevor Nielsen' };
const base = (o = {}) => newChallenge({ id: 'c1', from: dave, to: mike, kind: 'match', stake: 20, now: NOW - DAY, ...o });
const plan = (o = {}) => newPlan({
  id: 'pl1', hostName: 'Trevor Nielsen', game: 'nassau', holesCount: 18, date: '2026-10-10', teeTime: '08:10', course: COURSE,
  people: [{ id: 'dave', name: 'Dave Smith' }, { id: 'mike', name: 'Mike Jones' }, { id: 'sam', name: 'Sam' }], ballot: { games: [], bets: [5] }, suggestedBet: 5, settings: SETTINGS, now: NOW - 2 * DAY, ...o,
});
/** Mike v Dave on the plan, set up by Trevor (the organizer). */
const setUp = (o = {}) => newChallenge({ id: 'c1', from: mike, to: dave, kind: 'match', stake: 20, setBy: trevor, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' }, now: NOW - DAY, ...o });
const hostState = (extra = {}) => ({ me: 'me', players: {}, plans: { pl1: { ...plan(), code: 'PLAN01' } }, ...extra });
const friendState = (localMe, extra = {}) => ({ me: 'x', players: {}, plans: { pl_PLAN01: { ...plan(), id: 'pl_PLAN01', host: false, code: 'PLAN01', localMe } }, ...extra });

// --------------------------- set up between two others ----------------------

test('set up between two others: both answer, and it’s agreed once both are in at the same amount', () => {
  const ch = setUp();
  assert.deepEqual(ch.setBy, { who: 'host', name: 'Trevor' });
  let s = challengeState(ch);
  assert.equal(s.status, 'open');
  assert.equal(s.turn, 'both');
  assert.deepEqual(s.ins, []);
  assert.equal(challengeStatusText(ch, null), 'Waiting on Mike and Dave');
  assert.equal(challengeStatusText(ch, 'from'), 'Your call');
  const mikeIn = played(ch, { side: 'from', move: 'accept' });
  s = challengeState(mikeIn);
  assert.equal(s.status, 'open');
  assert.equal(s.turn, 'to');
  assert.equal(challengeStatusText(mikeIn, null), 'Mike’s in. Waiting on Dave');
  assert.equal(challengeStatusText(mikeIn, 'from'), 'You’re in. Waiting on Dave');
  assert.equal(challengeStatusText(mikeIn, 'to'), 'Mike’s in. Your call');
  assert.equal(canMove(mikeIn, 'from', 'accept'), false); // Mike's in already
  const both = played(mikeIn, { side: 'to', move: 'accept' });
  assert.equal(challengeState(both).status, 'accepted');
  assert.equal(challengeState(both).stake, 20);
});

test('set up between two others: "Dave says $10" is a counter, and Mike taking it agrees it at $10', () => {
  const ch = played(setUp(), { side: 'from', move: 'accept' }, { side: 'to', move: 'counter', stake: 10 });
  const s = challengeState(ch);
  assert.equal(s.status, 'countered');
  assert.equal(s.turn, 'from');
  assert.deepEqual(s.ins, ['to']);
  assert.equal(challengeStatusText(ch, null), 'Dave said $10');
  const agreed = played(ch, { side: 'from', move: 'accept' });
  assert.equal(challengeState(agreed).status, 'accepted');
  assert.equal(challengeState(agreed).stake, 10);
  // Either one can pass while it's open, and that's a no
  assert.equal(challengeState(played(setUp(), { side: 'to', move: 'decline' })).status, 'declined');
});

test('the words say who set it up: "Trevor set up Mike v Dave, $20 match"', () => {
  const ch = setUp();
  assert.equal(setUpLine(ch), 'Trevor set up Mike v Dave, $20 match');
  assert.equal(challengeHeadline(ch, null, true), 'You set up Mike v Dave');
  assert.equal(challengeHeadline(ch, 'from'), 'Trevor set you up v Dave');
  assert.equal(challengeHeadline(ch, 'to'), 'Trevor set you up v Mike');
  assert.equal(challengeHeadline(ch, null), 'Trevor set up Mike v Dave');
  const text = challengeSetUpText(ch, 'https://x/?plan=PLAN01&p=mike', 'from', NOW).split('\n');
  assert.match(text[0], /^Mike, I set up you v Dave, a \$20 match on .+\. You in\?$/);
  assert.deepEqual(text.slice(1), ['Tap to accept, decline or name your own amount:', 'https://x/?plan=PLAN01&p=mike']);
  // A regular challenge reads as before
  assert.equal(challengeHeadline(base(), 'from'), 'You challenged Mike');
  assert.equal(challengeHeadline(base(), null), 'Dave challenged Mike');
});

test('the set-up text names the other one and the day, and needs no link', () => {
  const text = challengeSetUpText(setUp(), null, 'to', NOW);
  assert.match(text, /^Dave, I set up you v Mike, a \$20 match on .+\. You in\?$/);
  assert.equal(text.includes('Tap to accept'), false);
});

test('whoever set it up can call it off; nobody else can as the keeper on a regular challenge', () => {
  const ch = setUp();
  assert.equal(canMove(ch, 'keeper', 'withdraw'), true);
  const off = played(ch, { side: 'keeper', move: 'withdraw' });
  assert.equal(challengeState(off).status, 'off');
  assert.equal(challengeStatusText(off, 'from'), 'Trevor called it off');
  assert.equal(canMove(base(), 'keeper', 'withdraw'), false);
});

test('set up on a plan: it goes into the round between the two of them through the roll call', () => {
  const p = { ...plan(), code: 'PLAN01' };
  for (const who of ['dave', 'mike']) p.answers[who] = { name: who, status: 'in', at: 1 };
  const players = { me: { id: 'me', name: 'Trevor Nielsen' }, dave: { id: 'dave', name: 'Dave Smith' }, mike: { id: 'mike', name: 'Mike Jones' } };
  const ch = played(setUp(), { side: 'from', move: 'accept', proxy: true }, { side: 'to', move: 'accept', proxy: true });
  const state = { me: 'me', players, settings: SETTINGS, plans: { pl1: p }, challenges: { c1: ch } };
  const setup = planStart(state, p, ['host', 'dave', 'mike'], { course: COURSE });
  const r = createRound({ id: 'r1', game: 'skins', course: COURSE, holesCount: 18, players: Object.values(players).map(x => ({ ...x, index: null })), settings: SETTINGS, useHandicaps: false });
  const found = challengesForRound(state, r, { planId: 'pl1', idOf: setup.idOf, now: NOW });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].bet, { id: 'ch_c1', kind: 'match', sides: ['mike', 'dave'], stake: 20 });
});

test('set up from a Player card on the scorekeeper’s phone: both are players here, and it goes into their next round together', () => {
  const ch = { ...newChallenge({ id: 'c9', from: { who: 'mike', name: 'Mike' }, to: { who: 'dave', name: 'Dave' }, kind: 'hole', stake: 2, setBy: { who: 'me', name: 'Trevor' }, now: NOW - DAY }), mine: null, made: true };
  const agreed = played(ch, { side: 'from', move: 'accept', proxy: true }, { side: 'to', move: 'accept', proxy: true });
  const state = { me: 'me', players: {}, challenges: { c9: agreed } };
  assert.equal(sideOf(state, agreed), null);
  assert.equal(setUpHere(state, agreed), true);
  assert.deepEqual(markSides(state, agreed), ['from', 'to']);
  const r = createRound({ id: 'r1', game: 'skins', course: COURSE, holesCount: 18, players: [{ id: 'me', name: 'Trevor' }, { id: 'dave', name: 'Dave' }, { id: 'mike', name: 'Mike' }], settings: SETTINGS });
  assert.deepEqual(challengePair(state, agreed, r), ['mike', 'dave']);
  assert.equal(challengesForRound(state, r, { now: NOW })[0].bet.kind, 'hole');
  // It shows on both Player cards and on Up next (you're putting their answers in)
  assert.deepEqual(challengesWith({ ...state, challenges: { c9: ch } }, 'mike', NOW).map(c => c.id), ['c9']);
  assert.deepEqual(challengesWith({ ...state, challenges: { c9: ch } }, 'dave', NOW).map(c => c.id), ['c9']);
  assert.deepEqual(myChallenges({ ...state, challenges: { c9: ch } }, NOW).map(c => c.id), ['c9']);
  assert.match(challengeNextText({ ...state, challenges: { c9: ch } }, ch, NOW), /^Mark Mike and Dave’s answers/);
});

// --------------------------- answers put in for someone ---------------------

test('the organizer marks Mike in: it counts, and the move is marked as put in for him', () => {
  const ch = played(base({ plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } }), { side: 'to', move: 'accept', proxy: true });
  assert.equal(isProxy(ch.moves[0]), true);
  assert.ok(ch.moves[0].id.startsWith(PROXY));
  // The server keeps ids of up to 32 and sides 'from', 'to' or 'keeper': an answer put in for someone fits as it is
  assert.ok(ch.moves[0].id.length <= 32);
  assert.ok(['from', 'to'].includes(ch.moves[0].side));
  assert.equal(challengeState(ch).status, 'accepted');
  assert.equal(proxiedFor(ch, 'to').length, 1);
});

test('their own answer wins: Mike passing from his own phone replaces the organizer marking him in', () => {
  const marked = played(base(), { side: 'to', move: 'accept', proxy: true });
  assert.equal(challengeState(marked).status, 'accepted');
  // Mike can still answer himself (an answer put in for him is his to change), the organizer can't again
  assert.equal(canMove(marked, 'to', 'decline'), true);
  assert.equal(canMove(marked, 'to', 'decline', null, null, true), false);
  const own = played(marked, { side: 'to', move: 'decline' });
  assert.equal(challengeState(own).status, 'declined');
  assert.equal(proxiedFor(own, 'to').length, 0);
  // Whatever order the phones heard them in, every phone agrees
  const flipped = { ...own, moves: [...own.moves].reverse() };
  assert.deepEqual(challengeState(flipped), challengeState(own));
});

test('once someone answered from their own phone, an answer put in for them later is left out', () => {
  const own = played(base(), { side: 'to', move: 'counter', stake: 10 });
  const late = withMove(own, { id: moveIdFor('late', true), side: 'from', move: 'accept', at: NOW });
  assert.equal(challengeState(late).status, 'accepted'); // Dave's (from) marked answer still counts: he hasn't answered himself
  const markedForMike = withMove(own, { id: moveIdFor('late2', true), side: 'to', move: 'withdraw', at: NOW });
  assert.equal(markedForMike, null);
});

test('an answer of their own after the round started changes nothing that went into it', () => {
  const on = played(base(), { side: 'to', move: 'accept', proxy: true }, { side: 'keeper', move: 'on', roundId: 'r1' });
  assert.equal(challengeState(on).status, 'on');
  const late = withMove(on, { id: 'own1', side: 'to', move: 'decline', at: NOW + DAY });
  assert.equal(late, null);
  // Even if it got in somehow, it's after the round started: the marked answer and the round stand
  const forced = { ...on, moves: [...on.moves, { id: 'own1', side: 'to', move: 'decline', at: NOW + DAY }] };
  assert.equal(challengeState(forced).status, 'on');
});

test('who can put answers in: the organizer on a plan for anyone else, the phone that made one from a Player card', () => {
  const ch = base({ plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } });
  assert.deepEqual(markSides(hostState(), ch), ['from', 'to']);
  assert.deepEqual(markSides(hostState(), { ...ch, from: trevor }), ['to']); // Trevor's own challenge: Mike's answer
  assert.deepEqual(markSides(friendState('mike'), ch), []);
  assert.deepEqual(markSides({}, { ...base(), mine: 'from', made: true }), ['to']);
  assert.deepEqual(markSides({}, { ...base(), mine: 'to', made: false }), []);
  assert.equal(markerName(hostState(), ch), 'Trevor');
  assert.equal(markerName({}, setUp({ plan: null })), 'Trevor');
});

test('the card says when an answer was put in for someone, and that theirs counts', () => {
  const ch = played(base({ plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } }), { side: 'to', move: 'counter', stake: 10, proxy: true });
  assert.equal(proxyNote(friendState('mike'), ch, 'to', 'live'), 'Trevor marked your answer. Not right? Answer here and yours counts.');
  assert.equal(proxyNote(hostState(), ch, null, 'live'), 'You marked Mike’s answer. Their own answer counts if they give one.');
  assert.equal(proxyNote(friendState('dave'), ch, 'from', 'live'), 'Trevor marked Mike’s answer.');
  assert.equal(proxyNote(hostState(), base(), null, 'live'), null);
  assert.equal(challengeTone(ch, 'from', 'live'), 'mine');
});

test('Lately: an answer put in for you says who put it in; the phone that put it in hears nothing of its own taps', () => {
  const ch = played(setUp(), { side: 'from', move: 'accept', proxy: true }, { side: 'to', move: 'accept' });
  const mikes = friendState('mike', { challenges: { c1: ch } });
  assert.deepEqual(challengeLately(mikes, 0, NOW + DAY).map(r => r.text), ['Trevor set you up v Dave, a $20 match', 'Trevor marked you in for a $20 match', 'Dave is in for a $20 match']);
  const daves = friendState('dave', { challenges: { c1: ch } });
  assert.deepEqual(challengeLately(daves, 0, NOW + DAY).map(r => r.text), ['Trevor set you up v Mike, a $20 match', 'Mike is in for a $20 match']);
  const host = hostState({ challenges: { c1: ch } });
  assert.deepEqual(challengeLately(host, 0, NOW + DAY).map(r => r.text), ['Dave accepted the one with Mike']);
  const sams = friendState('sam', { challenges: { c1: ch } });
  assert.deepEqual(challengeLately(sams, 0, NOW + DAY).map(r => r.text), ['Trevor set up Mike v Dave', 'Mike accepted the one with Dave', 'Dave accepted the one with Mike']);
});

test('old challenges play exactly as before: no set-up, no answers put in for anyone', () => {
  const ch = played(base(), { side: 'to', move: 'counter', stake: 15 }, { side: 'from', move: 'accept' });
  const s = challengeState(ch);
  assert.equal(s.status, 'accepted');
  assert.equal(s.stake, 15);
  assert.equal(s.turn, null);
  assert.equal(challengeState(base()).turn, 'to');
  assert.equal(challengeStatusText(base(), 'to'), 'Your call');
  assert.equal(challengeStatusText(base(), 'from'), 'Waiting on Mike');
  // A move saved before answers could be put in for someone (any id) is that person's own
  const legacy = { ...base(), moves: [{ id: 'mabc123', side: 'to', move: 'accept', at: NOW }] };
  assert.equal(challengeState(legacy).status, 'accepted');
  assert.equal(isProxy(legacy.moves[0]), false);
});

// --------------------------- moved to another day ---------------------------

/** Plan A's round was set up and kept for another day: plan B, made from it on the organizer's phone. */
function movedPlans({ shared = true } = {}) {
  const a = { ...plan(), code: shared ? 'PLAN01' : null, status: 'started', roundId: 'r1' };
  a.answers.w_x = { name: 'Joe Walker', status: 'in', at: 2 };
  const b = newPlan({
    id: 'pl2', hostName: 'Trevor Nielsen', game: 'nassau', holesCount: 18, date: '2026-10-17', teeTime: '09:00', course: COURSE,
    people: [{ id: 'dave', name: 'Dave Smith' }, { id: 'mike', name: 'Mike Jones' }, { id: 'p_joe', name: 'Joe Walker' }], ballot: { games: [], bets: [5] }, suggestedBet: 5, settings: SETTINGS, now: NOW,
  });
  b.code = 'PLAN02';
  b.movedFrom = movedFromFor(a, b);
  return { a, b };
}

test('movedKeys: the organizer to the organizer, anyone on both by their key, a friend from the link by name', () => {
  const { a, b } = movedPlans();
  assert.deepEqual(movedKeys(a, b), { host: 'host', dave: 'dave', mike: 'mike', w_x: 'p_joe' });
  assert.deepEqual(b.movedFrom, [{ id: 'pl1', code: 'PLAN01', keys: { host: 'host', dave: 'dave', mike: 'mike', w_x: 'p_joe' } }]);
});

test('a challenge on a round kept for another day moves with the plan: live, on the new day, not "Missed the round"', () => {
  const { a, b } = movedPlans();
  const ch = played(base({ from: { who: 'w_x', name: 'Joe' }, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } }), { side: 'to', move: 'accept' });
  // Before the new plan: missed
  assert.equal(challengeLife({ plans: { pl1: a } }, ch, NOW), 'missed');
  assert.equal(challengeStatusText(ch, 'to', 'missed'), 'Missed the round');
  const state = { me: 'me', players: {}, plans: { pl1: a, pl2: b }, challenges: { c1: ch } };
  assert.equal(planOf(state, ch).id, 'pl2');
  assert.equal(challengeLife(state, ch, NOW), 'live');
  const v = challengeView(state, ch);
  assert.deepEqual(v.plan, { id: 'pl2', code: 'PLAN02', date: '2026-10-17' });
  assert.equal(v.from.who, 'p_joe');
  assert.equal(challengeLine(v, NOW).endsWith(challengeLine({ ...ch, plan: { date: '2026-10-17' } }, NOW).split(' · ').at(-1)), true);
  assert.deepEqual(planChallenges(state, b).map(c => c.id), ['c1']);
  assert.deepEqual(planChallenges(state, a), []);
  // The challenge itself never changes: what goes up is always as it was made
  assert.equal(state.challenges.c1.plan.id, 'pl1');
  assert.equal(state.challenges.c1.from.who, 'w_x');
});

test('the moved challenge goes into the new plan’s round, by the new plan’s keys', () => {
  const { a, b } = movedPlans();
  for (const who of ['dave', 'mike', 'p_joe']) b.answers[who] = { name: who, status: 'in', at: 1 };
  const ch = played(base({ from: { who: 'w_x', name: 'Joe' }, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } }), { side: 'to', move: 'accept' });
  const players = { me: { id: 'me', name: 'Trevor Nielsen' }, dave: { id: 'dave', name: 'Dave Smith' }, mike: { id: 'mike', name: 'Mike Jones' }, p_joe: { id: 'p_joe', name: 'Joe Walker' } };
  const state = { me: 'me', players, settings: SETTINGS, plans: { pl1: a, pl2: b }, challenges: { c1: ch } };
  const setup = planStart(state, b, ['host', 'mike', 'p_joe'], { course: COURSE });
  const r = createRound({ id: 'r2', game: 'skins', course: COURSE, holesCount: 18, players: Object.values(players).map(x => ({ ...x, index: null })), settings: SETTINGS, useHandicaps: false });
  const found = challengesForRound(state, r, { planId: 'pl2', idOf: setup.idOf, now: NOW });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].bet.sides, ['p_joe', 'mike']);
  // Not on the old plan's roll call
  assert.equal(challengesForRound(state, r, { planId: 'pl1', idOf: setup.idOf, now: NOW }).length, 0);
});

test('on a friend’s phone it moves once they have the new plan, found by the old plan’s code', () => {
  const { a, b } = movedPlans();
  const ch = base({ plan: { id: 'pl_PLAN01', code: 'PLAN01', date: '2026-10-10' } });
  const mikes = {
    me: 'x', players: {},
    plans: { pl_PLAN01: { ...a, id: 'pl_PLAN01', host: false, localMe: 'mike' }, pl_PLAN02: { ...b, id: 'pl_PLAN02', host: false, localMe: 'mike' } },
    challenges: { c1: ch },
  };
  assert.equal(planOf(mikes, ch).id, 'pl_PLAN02');
  assert.equal(sideOf(mikes, ch), 'to');
  assert.equal(challengeLife(mikes, ch, NOW), 'live');
});

test('moved twice: the newest plan carries both, and keys follow both moves', () => {
  const { a, b } = movedPlans();
  const b2 = { ...b, status: 'started', roundId: 'r2' };
  const c = newPlan({
    id: 'pl3', hostName: 'Trevor Nielsen', game: 'nassau', holesCount: 18, date: '2026-10-24', course: COURSE,
    people: [{ id: 'mike', name: 'Mike Jones' }, { id: 'p_joe', name: 'Joe Walker' }], ballot: { games: [], bets: [5] }, suggestedBet: 5, settings: SETTINGS, now: NOW,
  });
  c.code = 'PLAN03';
  c.movedFrom = movedFromFor(b2, c);
  assert.deepEqual(c.movedFrom.map(e => e.code), ['PLAN02', 'PLAN01']);
  assert.equal(c.movedFrom[1].keys.w_x, 'p_joe');
  const ch = base({ from: { who: 'w_x', name: 'Joe' }, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } });
  const state = { plans: { pl1: a, pl2: b2, pl3: c }, challenges: { c1: ch } };
  assert.equal(planOf(state, ch).id, 'pl3');
  assert.equal(challengeView(state, ch).from.who, 'p_joe');
});

test('a challenge made on a plan never shared, then moved: it goes up under the new plan, read by the new plan’s keys', async () => {
  const { a, b } = movedPlans({ shared: false });
  b.movedFrom = movedFromFor(a, b);
  const ch = { ...base({ from: { who: 'w_x', name: 'Joe' }, plan: { id: 'pl1', code: null, date: '2026-10-10' } }), mine: null, made: true, code: null, unsent: true };
  const sendAs = challengeToSend({ plans: { pl1: a, pl2: b } }, ch);
  assert.equal(sendAs.planCode, 'PLAN02');
  assert.equal(sendAs.ch.from.who, 'p_joe');
  assert.equal('viewed' in sendAs.ch, false);
  // With the old plan shared it goes up as it was made, under the old code
  const shared = movedPlans();
  assert.equal(challengeToSend({ plans: { pl1: shared.a, pl2: shared.b } }, { ...ch, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } }).planCode, 'PLAN01');
  // And through the push: the server gets the new plan's code and keys, and this phone keeps the same
  let state = structuredClone({ plans: { pl1: a, pl2: b }, challenges: { c1: ch } });
  const made = [];
  const adapter = { async create(code, planCode, meta) { made.push({ code, planCode, meta }); }, async addMove() {} };
  await pushChallenge({ getState: () => state, update: fn => { const d = structuredClone(state); fn(d); state = d; }, adapter, newCode: () => 'CHAL01' }, 'c1');
  assert.equal(made[0].planCode, 'PLAN02');
  assert.equal(made[0].meta.from.who, 'p_joe');
  assert.deepEqual(made[0].meta.plan, { code: 'PLAN02', date: '2026-10-17' });
  assert.equal(state.challenges.c1.from.who, 'p_joe');
  assert.equal(planOf(state, state.challenges.c1).id, 'pl2');
});

// --------------------------- the Saturday preview ---------------------------

const players = () => ({ me: { id: 'me', name: 'Trevor Nielsen', index: 2 }, mike: { id: 'mike', name: 'Mike Jones', index: 9 }, dave: { id: 'dave', name: 'Dave', index: 20 }, sam: { id: 'sam', name: 'Sam', index: null } });
function previewState({ playFor = null } = {}) {
  const p = { ...plan({ playFor }), code: 'PLAN01' };
  for (const who of ['dave', 'mike', 'sam']) p.answers[who] = { name: p.people.find(x => x.id === who).name, status: 'in', at: 5 };
  p.setup = setupForPlan({ game: 'nassau', courseId: 'c1', holesCount: 18, me: 'me', order: ['me', 'sam', 'dave', 'mike'], bets: [{ id: 'b1', kind: 'hole', sides: ['sam', 'me'], stake: 2 }] });
  const agreed = played(base({ id: 'c1', plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' }, unit: playFor?.kind === 'points' ? 'points' : 'money' }), { side: 'to', move: 'accept' });
  const open = base({ id: 'c2', from: { who: 'sam', name: 'Sam' }, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } });
  return { me: 'me', players: players(), rounds: {}, customCourses: { c1: COURSE }, settings: SETTINGS, plans: { pl1: p }, challenges: { c1: agreed, c2: open } };
}

test('the preview lists the kept side bets and the agreed challenges, "Dave v Mike, $20 match"; an open one isn’t on yet', () => {
  const state = previewState();
  const bets = previewPairBets(state, state.plans.pl1, { now: new Date(NOW) });
  assert.deepEqual(bets.map(x => pairBetLine(x)), ['Sam v Trevor, $2 a hole', 'Dave v Mike, $20 match']);
  assert.deepEqual(bets.map(x => x.source), ['bet', 'challenge']);
  const pv = planPreview(state, state.plans.pl1, { now: new Date(NOW) });
  assert.equal(pv.pairBets.length, 2);
});

test('a round kept for another day keeps the challenge’s bet in its setup, and the preview lists it once (2026-10-04)', () => {
  const state = previewState();
  const p = state.plans.pl1;
  p.setup = setupForPlan({ game: 'nassau', courseId: 'c1', holesCount: 18, me: 'me', order: ['me', 'sam', 'dave', 'mike'], bets: [{ id: 'b1', kind: 'hole', sides: ['sam', 'me'], stake: 2 }, { id: 'ch_c1', kind: 'match', sides: ['dave', 'mike'], stake: 20 }] });
  const bets = previewPairBets(state, p, { now: new Date(NOW) });
  assert.deepEqual(bets.map(x => pairBetLine(x)), ['Sam v Trevor, $2 a hole', 'Dave v Mike, $20 match']);
});

test('the image and the text carry them, with amounts hidden until they’re switched on', () => {
  const state = previewState();
  const pv = planPreview(state, state.plans.pl1, { now: new Date(NOW) });
  assert.deepEqual(previewCardModel(pv).pairBets, ['Sam v Trevor, per hole', 'Dave v Mike, match']);
  assert.deepEqual(previewCardModel(pv, { showAmounts: true }).pairBets, ['Sam v Trevor, $2 a hole', 'Dave v Mike, $20 match']);
  assert.ok(previewText(pv, { showAmounts: true }).split('\n').includes('Side bets: Sam v Trevor, $2 a hole; Dave v Mike, $20 match.'));
  assert.ok(previewText(pv).split('\n').includes('Side bets: Sam v Trevor, per hole; Dave v Mike, match.'));
  assert.equal(/\$/.test(JSON.stringify(previewCardModel(pv))), false);
});

test('a points plan’s side bets read in points, always shown; someone out takes their bets off the preview', () => {
  const state = previewState({ playFor: { kind: 'points' } });
  const pv = planPreview(state, state.plans.pl1, { now: new Date(NOW) });
  assert.deepEqual(previewCardModel(pv).pairBets, ['Sam v Trevor, 2 pts a hole', 'Dave v Mike, 20 pts match']);
  state.plans.pl1.answers.sam.status = 'out';
  state.plans.pl1.answers.mike.status = 'out';
  assert.deepEqual(previewPairBets(state, state.plans.pl1, { now: new Date(NOW) }), []);
});

test('a friend’s phone has no setup, so it shows the agreed challenges only; a plan with none says nothing new', () => {
  const state = previewState();
  const friend = { ...state, plans: { pl_PLAN01: { ...state.plans.pl1, id: 'pl_PLAN01', host: false, localMe: 'mike', setup: undefined } } };
  assert.deepEqual(previewPairBets(friend, friend.plans.pl_PLAN01, { now: new Date(NOW) }).map(x => pairBetLine(x)), ['Dave v Mike, $20 match']);
  const bare = { ...state, challenges: {}, plans: { pl1: { ...state.plans.pl1, setup: null } } };
  const pv = planPreview(bare, bare.plans.pl1, { now: new Date(NOW) });
  assert.deepEqual(pv.pairBets, []);
  assert.equal(previewText(pv).includes('Side bets'), false);
});

test('old rounds keep exactly their money: a finished round with a challenge bet in it reads the same', () => {
  const r = createRound({ id: 'r1', game: 'skins', course: COURSE, holesCount: 18, players: [{ id: 'dave', name: 'Dave' }, { id: 'mike', name: 'Mike' }], settings: SETTINGS, useHandicaps: false });
  r.bets = [{ id: 'ch_c1', kind: 'match', sides: ['dave', 'mike'], stake: 20 }];
  for (const h of r.holes) r.scores[h.no] = { dave: 4, mike: 4 };
  r.scores[1] = { dave: 3, mike: 5 };
  r.status = 'done';
  const before = JSON.stringify(roundResults(r));
  // Nothing about challenges (set up, answers put in, a plan moved) touches a round that's played
  const state = { me: 'me', players: {}, rounds: { r1: r }, challenges: { c1: played(setUp(), { side: 'from', move: 'accept', proxy: true }) } };
  challengesForRound(state, r, { now: NOW });
  challengeLately(state, 0, NOW);
  assert.equal(JSON.stringify(roundResults(r)), before);
});
