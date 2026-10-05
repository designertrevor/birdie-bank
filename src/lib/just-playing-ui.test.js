// "Just playing, no bet" around the app: the setup rules and the words (just-playing.js), the card of
// your own from an invite, the seat flag travelling with the live round, and everything that reads a
// round (the Tab, History, stats, head to head, callouts, the recap, the feed, the side bet card,
// Run it back) leaving someone just playing out of anything about money or pressure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayerToRound, createRound, roundResults, strokeChanges, changeHandicaps } from './round.js';
import {
  JUST_PLAYING, addJustPlayingProblem, canJustPlay, cantJustPlay, cardFromLine, cardOnlyRound, justPlayingNote, maxPicked, niceRound, pickedCheck, pickedLine,
} from './just-playing.js';
import { applyMeta, assemble, buildMeta, buildRequest, readRequest } from './sync-model.js';
import { onTab, tabMoneyOf, tabResultsFor } from './play-for.js';
import { gameLabel, holeMoneyLine } from './format.js';
import { finalMoment } from './moments.js';
import { myMoney, myNet } from './history.js';
import { headToHeadSummary, personStory } from './ledger.js';
import { calloutCandidates } from './callouts.js';
import { recapOf } from './recap.js';
import { roundView } from './friend-feed.js';
import { betPromptFor } from './bet-prompt.js';
import { betsOf } from './pair-bets.js';
import { rematchSetup } from './rematch.js';
import { revealSteps } from './reveal.js';
import { deepStats } from './deep-stats.js';
import { roundStatus } from './shared-tab.js';
import { seasonRounds } from './season.js';
import { agreementItems } from './agreed.js';

const DAY = 864e5;
const NOW = new Date(2026, 9, 5, 9).getTime();
const course = { id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true, tees: [{ name: 'Blue', color: '#00f', rating: 36, slope: 120 }], holes: Array.from({ length: 9 }, (_, i) => ({ par: i === 2 ? 3 : 4, hdcp: i + 1 })) };
const NAMES = { me: 'Trevor Nielsen', sam: 'Sam Ray', mike: 'Mike Lee', dave: 'Dave Ortiz', jo: 'Jo Park' };
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'per' }, wolf: { point: 2, loneMultiplier: 2 } };

function round(id, daysAgo, ids, { scores = {}, game = 'skins', jp = [], ...more } = {}) {
  const r = createRound({
    id, game, course, holesCount: 9, nine: 'front', players: ids.map(x => ({ id: x, name: NAMES[x], index: 10, tee: 'Blue' })),
    settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false, justPlaying: jp,
  });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, scores[h.no]?.[p] ?? 4]));
  const at = NOW - daysAgo * DAY;
  return { ...r, status: 'done', createdAt: at - 4 * 3600e3, finishedAt: at, ...more };
}
function stateWith(rounds, extra = {}) {
  return {
    me: 'me', players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, customCourses: { c9: course }, settings: {}, ...extra,
  };
}
// Jo, just playing, birdies every hole: she'd win everything if she counted
const joBirdies = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, { jo: 3 }]));

test('the Players step counts only the betting players for the game', () => {
  // Wolf is for exactly four betting players: a friend just playing is a fifth on the card
  assert.equal(pickedCheck('wolf', ['a', 'b', 'c', 'd', 'j'], ['j']).valid, true);
  assert.deepEqual(pickedCheck('wolf', ['a', 'b', 'c', 'j'], ['j']), { valid: false, bettors: 3, casual: 1, text: 'Wolf needs 4 betting players' });
  assert.equal(pickedCheck('wolf', ['a', 'b', 'c', 'd', 'e'], []).text, 'Wolf is for 4. Mark 1 just playing');
  assert.equal(pickedCheck('banker', ['a', 'b', 'j'], ['j']).text, 'Banker needs at least 3 betting players');
  assert.equal(pickedCheck('aces', ['a', 'b', 'j'], ['j']).text, 'Aces & Deuces needs 3 to 4 betting players');
  assert.equal(pickedCheck('skins', ['a', 'j'], ['j']).text, 'Skins needs at least 2 betting players');
  // A singles match with a friend along for the walk
  assert.equal(pickedCheck('match', ['a', 'b', 'j'], ['j']).valid, true);
  assert.equal(pickedLine('match', ['a', 'b', 'j'], ['j']), '3 picked · 2 betting (2–8), 1 just playing');
  assert.equal(pickedLine('vegas', ['a', 'b', 'c', 'd'], []), '4 picked (4)');
  // Nobody marked: the old words
  assert.equal(pickedCheck('skins', ['a'], []).text, 'Add 1 more player');
  // The group tops out at 8, just playing included; a game capped lower takes more people when they can be just playing
  assert.equal(maxPicked('wolf'), 8);
  assert.equal(maxPicked('vegas'), 8);
  assert.equal(pickedCheck('skins', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], ['9']).text, 'Remove 1 player');
  // A one-ball game: everyone's on a team, so nobody can sit out; a mark left from another game counts as betting
  assert.equal(canJustPlay('scramble'), false);
  assert.equal(maxPicked('altshot'), 4);
  assert.match(cantJustPlay('scramble'), /Everyone plays on a team in Scramble/);
  assert.equal(cantJustPlay('wolf'), null);
  assert.deepEqual(pickedCheck('altshot', ['a', 'b', 'c', 'j'], ['j']), { valid: true, bettors: 4, casual: 0, text: null });
});

test('adding someone just playing: even a full game with set sides takes them, a one-ball game and a group of 8 don’t', () => {
  const wolf = round('w', 0, ['me', 'sam', 'mike', 'dave'], { game: 'wolf', status: 'active' });
  assert.equal(addJustPlayingProblem(wolf), null);
  const added = addPlayerToRound(wolf, { id: 'jo', name: 'Jo Park' }, 4, null, { justPlaying: true });
  assert.deepEqual(roundResults(added).balances, { ...roundResults(wolf).balances, jo: 0 });
  const eight = { ...wolf, players: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P ${i}` })) };
  assert.match(addJustPlayingProblem(eight), /up to 8 players/);
  assert.match(addJustPlayingProblem({ ...wolf, game: 'scramble' }), /Everyone plays on a team/);
});

test('the friendly finish: their score, to par and the good holes, never money', () => {
  const r = round('r1', 0, ['me', 'sam', 'jo'], { jp: ['jo'], scores: { 1: { jo: 3 }, 2: { jo: 4 }, 3: { jo: 1 }, 4: { jo: 6 } } });
  const n = niceRound(r, 'jo');
  assert.equal(n.title, 'Nice round, Jo');
  assert.equal(n.score, 3 + 4 + 1 + 6 + 4 * 5);
  assert.equal(n.toPar, '−1');
  assert.equal(n.line, 'All 9 holes, with 1 eagle, 1 birdie and 6 pars.');
  assert.doesNotMatch(JSON.stringify(n), /\$/);
  assert.equal(justPlayingNote(r), 'Jo was just playing: on the card, out of the money.');
  assert.equal(justPlayingNote(round('r2', 0, ['me', 'sam'])), null);
  // Part of the round: "Through"
  const part = { ...r, scores: { 1: { me: 4, sam: 4, jo: 4 } } };
  assert.equal(niceRound(part, 'jo').line, 'Through 1 of 9 holes, with 1 par.');
  assert.equal(niceRound({ ...r, scores: {} }, 'jo'), null);
});

test('Just keep my own score: a card of your own from the invite, with no game and nothing on the Tab', () => {
  const group = round('g', 0, ['me', 'sam', 'mike'], { status: 'active', hostName: 'Trevor Nielsen' });
  const card = cardOnlyRound({ id: 'mine', meta: buildMeta(group), me: { id: 'jo', name: 'Jo Park', index: 12 }, code: 'ABC123', at: NOW });
  assert.equal(card.players.length, 1);
  assert.deepEqual(card.justPlaying, { jo: true });
  assert.equal(card.holes.length, 9);
  assert.equal(card.par, 35);
  assert.equal(gameLabel(card), 'Just keeping score');
  assert.equal(cardFromLine(card), 'Your own card, from Trevor’s round');
  card.scores[1] = { jo: 5 };
  assert.deepEqual(roundResults(card).balances, { jo: 0 });
  assert.equal(onTab(card), false);
  assert.equal(tabMoneyOf(card, 'jo'), null);
  assert.equal(holeMoneyLine(card, card.holes[0], { jo: 0 }), 'Hole 1 saved');
  assert.deepEqual(finalMoment(card), { kind: 'final', title: 'Every hole’s in', text: 'Finish the round to see your card' });
  // The group's round is untouched
  assert.equal(group.players.length, 3);
});

test('the seat flag travels with the live round, so every phone agrees on who is just playing', () => {
  const host = round('live', 0, ['me', 'sam', 'jo'], { jp: ['jo'], status: 'active' });
  const meta = buildMeta(host);
  assert.deepEqual(meta.justPlaying, { jo: true });
  // Another phone builds the round from the server's copy
  const other = assemble(meta, {});
  assert.deepEqual(other.justPlaying, { jo: true });
  assert.deepEqual(roundResults(other).balances, roundResults(host).balances);
  // ...and a phone that had the round before anyone was just playing picks it up
  const before = round('live', 0, ['me', 'sam'], { status: 'active' });
  const added = addPlayerToRound(before, { id: 'jo', name: 'Jo Park' }, null, null, { justPlaying: true });
  const stale = structuredClone(before);
  applyMeta(stale, buildMeta(added));
  assert.deepEqual(stale.justPlaying, { jo: true });
  assert.deepEqual(stale.players.map(p => p.id), ['me', 'sam', 'jo']);
});

test('Add me, just playing: the seat request says so, and an older request reads as it always did', () => {
  const r = buildRequest('Jo', 5, { justPlaying: true });
  assert.deepEqual(r, { request: { name: 'Jo', at: 5, status: 'waiting', justPlaying: true } });
  assert.equal(readRequest(r).justPlaying, true);
  assert.deepEqual(buildRequest('Jo', 5), { request: { name: 'Jo', at: 5, status: 'waiting' } });
  assert.ok(!('justPlaying' in readRequest(buildRequest('Jo', 5))));
});

test('the Tab, History and stats: nothing of theirs, and their round is never a money round for them', () => {
  const r = round('r1', 1, ['me', 'sam', 'jo'], { jp: ['jo'], scores: joBirdies });
  const state = stateWith([r], { me: 'jo' });
  assert.equal(tabMoneyOf(r, 'jo'), null);
  assert.equal(tabResultsFor(r, 'jo'), null);
  assert.equal(myMoney(r, state), null);
  assert.equal(myNet(r, state), null);
  const stats = deepStats(state);
  assert.equal(stats.rounds, 1);
  assert.deepEqual(stats.record, { won: 0, lost: 0, even: 0 });
  assert.equal(stats.dollars.rounds, 0);
  assert.equal(stats.points.rounds, 0);
  assert.deepEqual(stats.games, []);
  // The who's-square strip has nobody just playing in it
  assert.deepEqual(Object.keys(roundStatus(r, [])), ['me', 'sam']);
  // ...and the season's money is the rounds you had money in
  const year = new Date(NOW).getFullYear();
  assert.deepEqual(seasonRounds(state, year).map(x => x.id), []);
  assert.deepEqual(seasonRounds(stateWith([r]), year).map(x => x.id), ['r1']);
});

test('head to head and rivalry: a round either of you was just playing had no bet between you', () => {
  const casual = round('r1', 2, ['me', 'sam', 'jo'], { jp: ['jo'], scores: { 1: { sam: 3 } } });
  const bet = round('r2', 1, ['me', 'jo'], { scores: { 1: { jo: 3 } } });
  const state = stateWith([casual, bet]);
  const story = personStory(state, ['me'], 'jo');
  assert.deepEqual(story.items.filter(i => i.kind === 'round').map(i => i.id), ['r2']);
  assert.equal(story.rounds, 1);
  assert.equal(headToHeadSummary(state, ['me']).get('jo').rounds, 1);
  // Jo's own view of the round she was just playing: not in her story with anyone
  const hers = stateWith([casual], { me: 'jo' });
  assert.equal(personStory(hers, ['jo'], 'me').rounds, 0);
});

test('callouts: nobody just playing is called out, and their rounds never break a streak', () => {
  const last = round('r3', 1, ['me', 'sam', 'jo'], { jp: ['jo'], scores: joBirdies });
  const lines = calloutCandidates(stateWith([last]), NOW);
  assert.ok(!lines.some(c => /Jo\b/.test(c.text)), JSON.stringify(lines.map(c => c.text)));
  // Sam won twice, then was just playing: still a streak of two
  const won = id => round(id, 5, ['me', 'sam'], { scores: { 1: { sam: 3 } } });
  const sat = round('r9', 1, ['me', 'sam', 'mike'], { jp: ['sam'] });
  const streak = calloutCandidates(stateWith([{ ...won('a'), finishedAt: NOW - 6 * DAY }, won('b'), sat]), NOW).find(c => c.id === 'streak:sam');
  assert.ok(streak, 'streak kept');
  assert.match(streak.text, /won 2 in a row/);
});

test('the recap: their own score, and who’s paid leaves them out', () => {
  const r = round('r1', 1, ['me', 'sam', 'jo'], { jp: ['jo'], scores: { 1: { sam: 3 } } });
  const mine = recapOf(stateWith([r], { me: 'jo' }), r, NOW);
  assert.equal(mine.yours, 'You shot 36 (+1)');
  const group = recapOf(stateWith([r]), r, NOW);
  assert.ok(group.paid.people.every(p => p.id !== 'jo'));
  const card = cardOnlyRound({ id: 'c', meta: buildMeta(r), me: { id: 'jo', name: 'Jo Park' }, at: NOW });
  card.scores = r.scores;
  card.status = 'done';
  card.finishedAt = NOW - DAY;
  assert.equal(recapOf(stateWith([card], { me: 'jo' }), card, NOW).headline, 'Nice round');
});

test('the friends feed: on the board after the betting players, no place and no amount, and their privacy holds nobody back', () => {
  const r = round('r1', 0, ['me', 'sam', 'jo'], { jp: ['jo'], scores: { 1: { sam: 3 } }, status: 'active' });
  const people = { me: { friend: true, money: true }, sam: { friend: true, money: true }, jo: { friend: true, money: false } };
  const v = roundView(r, { code: 'X', people });
  assert.deepEqual(v.players.map(p => p.id), ['sam', 'me', 'jo']);
  const jo = v.players.find(p => p.id === 'jo');
  assert.equal(jo.place, null);
  assert.equal(jo.amountText, null);
  assert.equal(jo.justPlaying, true);
  assert.ok(v.players.find(p => p.id === 'sam').amountText, 'Sam’s money still shows');
});

test('side bets: never offered to or made with someone just playing', () => {
  const r = round('r1', 0, ['me', 'sam', 'jo'], { jp: ['jo'], status: 'active' });
  r.scores = {};
  r.bets = [{ id: 'b1', kind: 'match', sides: ['me', 'jo'], stake: 5 }, { id: 'b2', kind: 'match', sides: ['me', 'sam'], stake: 5 }];
  assert.deepEqual(betsOf(r).map(b => b.id), ['b2']);
  r.bets = [];
  // Jo's phone, not keeping score: no "Any side bets?" card for her
  assert.equal(betPromptFor(r, 1, { me: 'jo', editable: false }), null);
  // With two betting players the game is already their head to head, so the first hole asks nothing either
  assert.equal(betPromptFor(r, 1, { me: 'me', editable: true }), null);
});

test('Run it back keeps them just playing, and the teams are the betting players’', () => {
  const r = createRound({
    id: 'bb', game: 'bestball', course, holesCount: 9, players: ['me', 'sam', 'mike', 'dave', 'jo'].map(x => ({ id: x, name: NAMES[x], index: 5 })),
    settings: { hcPct: 100, bestball: { format: 'nassau', stake: 5 } }, hcPct: 100, teams: [['me', 'sam'], ['mike', 'dave']], justPlaying: ['jo'],
  });
  const state = stateWith([{ ...r, status: 'done', finishedAt: NOW }]);
  const setup = rematchSetup(state, state.rounds.bb);
  assert.deepEqual(setup.justPlaying, ['jo']);
  assert.ok(setup.teams.flat().every(id => id !== 'jo'));
  // A round with nobody just playing sets up as it always did
  assert.ok(!('justPlaying' in rematchSetup(state, { ...r, justPlaying: undefined })));
});

test('the reveal and fixing strokes never name them', () => {
  const r = round('r1', 0, ['me', 'sam', 'jo'], { jp: ['jo'], scores: joBirdies });
  r.sideGames = [{ game: 'birdies', settings: { stake: 5, eagleShares: 2 } }];
  const { steps } = revealSteps(r, roundResults(r));
  assert.ok(!steps.some(s => /Jo\b/.test(`${s.label} ${s.text}`)), JSON.stringify(steps));
  // Turning handicaps on moves nobody's strokes for the player just playing into the "what changes" list
  const on = changeHandicaps({ ...r, players: r.players.map((p, i) => ({ ...p, courseHc: [10, 4, 0][i] })) }, course, { useHandicaps: true });
  assert.ok(strokeChanges(r, on).every(c => c.id !== 'jo'));
  assert.ok(strokeChanges(r, on).some(c => c.id === 'me'));
});

test('the seat name', () => {
  assert.equal(JUST_PLAYING, 'Just playing, no bet');
});

test('the first-tee card says who is just playing, and lists strokes for the betting players only', () => {
  const r = createRound({
    id: 'ft', game: 'skins', course, holesCount: 9, players: ['me', 'sam', 'jo'].map((x, i) => ({ id: x, name: NAMES[x], index: [10, 4, 0][i] })),
    settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: true, justPlaying: ['jo'],
  });
  const items = agreementItems(r, {});
  assert.deepEqual(items.find(i => i.id === 'justPlaying'), { id: 'justPlaying', group: 'lineup', label: 'Just playing', text: 'Jo. On the card, no bet' });
  assert.ok(!items.some(i => i.id === 'strokes:jo'));
  assert.ok(items.some(i => i.id === 'strokes:me'));
  // Nobody just playing: no line for it
  assert.ok(!agreementItems({ ...r, justPlaying: undefined }, {}).some(i => i.id === 'justPlaying'));
});
