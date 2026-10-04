// "Any side bets on this hole?" (bet-prompt.js): which holes ask, what each one suggests, and every
// time it stays quiet: switched off, put away for the round, a hole already answered, a watching
// phone, a moment banner up, scores being typed, a hole scored or not next, a bet already covering
// it, too many bets, and a scramble pair that can't have a match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { addBet, MAX_BETS } from './pair-bets.js';
import { betPromptFor, markPrompt, promptSpots, spotCopy, spotDraft, PROMPT_MAX } from './bet-prompt.js';

// Pars 4 4 3 4 5 3 4 4 3 | 4 4 3 4 5 3 4 4 3: par 3s on 3, 6, 9, 12, 15, 18
const PARS = [4, 4, 3, 4, 5, 3, 4, 4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 3];
const course = (n, pars = PARS) => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: pars[i], hdcp: i + 1 })) });
const IDS = ['t', 'p', 'y', 'z'];

function stroke({ holes = 18, upto = 0, pars, startHole } = {}) {
  const r = createRound({
    id: 'r', game: 'stroke', course: course(holes, pars), holesCount: holes, startHole,
    players: IDS.map(id => ({ id, name: id.toUpperCase(), index: null })),
    settings: { hcPct: 100, stroke: { stake: 5, payout: 'pot' } }, hcPct: 100, useHandicaps: false,
  });
  r.holes.slice(0, upto).forEach(h => { r.scores[h.no] = Object.fromEntries(IDS.map(id => [id, h.par])); });
  return r;
}
function scramble(teams = [['a', 'b'], ['c', 'd']]) {
  return createRound({
    id: 's', game: 'scramble', course: course(9), holesCount: 9, players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase(), index: null })),
    teams, settings: { hcPct: 100, scramble: { stake: 5, payout: 'pot', drives: 0 } }, hcPct: 100, useHandicaps: false,
  });
}
const keeper = { me: 't', editable: true };
const bet = (kind, sides, more = {}) => ({ id: `${kind}-${sides.join('')}`, kind, sides, stake: 5, ...more });

test('an 18-hole round asks on the first hole, the first par 3 and the turn, never more than three', () => {
  assert.deepEqual(promptSpots(stroke()), [{ pos: 1, why: 'first' }, { pos: 3, why: 'par3' }, { pos: 10, why: 'turn' }]);
  assert.equal(PROMPT_MAX, 3);
  assert.ok(promptSpots(stroke()).length <= PROMPT_MAX);
});

test('a 9-hole round has no turn; a round with no par 3 after the first hole has no par 3 spot', () => {
  assert.deepEqual(promptSpots(stroke({ holes: 9 })), [{ pos: 1, why: 'first' }, { pos: 3, why: 'par3' }]);
  const noPar3 = stroke({ holes: 9, pars: [3, 4, 4, 4, 5, 4, 4, 4, 4] });
  assert.deepEqual(promptSpots(noPar3), [{ pos: 1, why: 'first' }]);
});

test('a par 3 at the turn stays the turn, and the par 3 spot is the first other one', () => {
  const pars = [4, 4, 4, 4, 5, 4, 4, 4, 4, 3, 4, 3, 4, 5, 3, 4, 4, 3];
  assert.deepEqual(promptSpots(stroke({ pars })), [{ pos: 1, why: 'first' }, { pos: 10, why: 'turn' }, { pos: 12, why: 'par3' }]);
});

test('the first hole suggests a match for the whole round, a par 3 closest to the pin from there on, the turn a match for the last nine', () => {
  const r = stroke();
  assert.deepEqual(spotDraft(r, { pos: 1, why: 'first' }), { kind: 'match', holes: [1, 18] });
  assert.deepEqual(spotDraft(r, { pos: 3, why: 'par3' }), { kind: 'ctp', holes: [3, 18] });
  assert.deepEqual(spotDraft(r, { pos: 10, why: 'turn' }), { kind: 'match', holes: [10, 18] });
  assert.equal(spotCopy(r, { pos: 3, why: 'par3' }).title, 'Closest to the pin?');
  assert.equal(spotCopy(r, { pos: 10, why: 'turn' }).title, 'A side bet for the back nine?');
  assert.equal(spotCopy(r, { pos: 1, why: 'first' }).title, 'Any side bets this round?');
});

test('a first hole that is a par 3 still suggests a match for the round; closest to the pin waits for the next par 3', () => {
  const r = stroke({ holes: 9, pars: [3, 4, 4, 3, 5, 4, 4, 4, 4] });
  const p = betPromptFor(r, 1, keeper);
  assert.equal(p.kind, 'match');
  assert.equal(p.title, 'Any side bets this round?');
  assert.deepEqual(p.holes, [1, 9]);
  assert.deepEqual(promptSpots(r), [{ pos: 1, why: 'first' }, { pos: 4, why: 'par3' }]);
});

test('a par 3 at the turn still asks about a back-nine match, so closest to the pin is never asked twice', () => {
  const pars = [4, 4, 3, 4, 5, 4, 4, 4, 4, 3, 4, 4, 4, 5, 3, 4, 4, 3];
  const r = stroke({ upto: 9, pars });
  const p = betPromptFor(r, 10, keeper);
  assert.equal(p.kind, 'match');
  assert.equal(p.title, 'A side bet for the back nine?');
  assert.deepEqual(p.holes, [10, 18]);
});

test('a shotgun start on another hole calls its turn the last nine, not the back nine', () => {
  const r = stroke({ startHole: 5, upto: 9 });
  assert.equal(r.holes[9].no, 14);
  assert.equal(betPromptFor(r, 10, keeper).title, 'A side bet for the last nine?');
});

test('a player’s own bet still on its way to the keeper’s phone counts, so the next spot stays quiet', () => {
  // Preston asked for a whole-round match with Tyler on hole 1; the keeper's phone hasn't put it in yet
  const r = stroke({ upto: 9 });
  r.betAsks = [{ no: -1, status: 'waiting', ask: { by: 'p', at: 1, op: 'add', id: 'm1', bet: bet('match', ['p', 'y'], { id: 'm1' }) } }];
  assert.equal(betPromptFor(r, 10, { me: 'p', editable: false }), null);
  // Zach isn't in it, so his phone still asks
  assert.equal(betPromptFor(r, 10, { me: 'z', editable: false })?.why, 'turn');
});

test('a round started on 10 calls its turn the front nine', () => {
  const r = stroke({ startHole: 10 });
  assert.equal(r.holes[9].no, 1);
  assert.equal(spotCopy(r, { pos: 10, why: 'turn' }).title, 'A side bet for the front nine?');
});

test('it shows on the keeper’s phone at each spot as the hole comes up, and not on the holes between', () => {
  assert.equal(betPromptFor(stroke(), 1, keeper)?.why, 'first');
  assert.equal(betPromptFor(stroke({ upto: 1 }), 2, keeper), null);
  assert.equal(betPromptFor(stroke({ upto: 2 }), 3, keeper)?.why, 'par3');
  assert.equal(betPromptFor(stroke({ upto: 9 }), 10, keeper)?.why, 'turn');
  for (let pos = 4; pos <= 9; pos++) assert.equal(betPromptFor(stroke({ upto: pos - 1 }), pos, keeper), null, `hole ${pos}`);
  for (let pos = 11; pos <= 18; pos++) assert.equal(betPromptFor(stroke({ upto: pos - 1 }), pos, keeper), null, `hole ${pos}`);
});

test('a player who isn’t keeping score sees it too, since they can add a bet they’re in', () => {
  assert.equal(betPromptFor(stroke(), 1, { me: 'p', editable: false })?.why, 'first');
});

test('never on a watching phone', () => {
  assert.equal(betPromptFor(stroke(), 1, { me: 'w', editable: false }), null);
  assert.equal(betPromptFor(stroke(), 1, { me: null, editable: false }), null);
});

test('never while a moment banner shows, or once scores are being typed on the hole', () => {
  assert.equal(betPromptFor(stroke(), 1, { ...keeper, moment: true }), null);
  assert.equal(betPromptFor(stroke(), 1, { ...keeper, scoring: true }), null);
});

test('off in Settings, or put away for the round, it never asks; a hole already answered doesn’t ask again', () => {
  assert.equal(betPromptFor(stroke(), 1, { ...keeper, on: false }), null);
  assert.equal(betPromptFor(stroke({ upto: 2 }), 3, { ...keeper, seen: { skip: true } }), null);
  assert.equal(betPromptFor(stroke({ upto: 2 }), 3, { ...keeper, seen: { done: [3] } }), null);
  // Opening the editor from the first hole still lets the par 3 ask
  assert.equal(betPromptFor(stroke({ upto: 2 }), 3, { ...keeper, seen: { done: [1] } })?.why, 'par3');
});

test('only on the next hole to play: a scored hole, or browsing ahead, asks nothing', () => {
  // Hole 3 scored, back on it to fix a score
  const r = stroke({ upto: 3 });
  assert.equal(betPromptFor(r, 3, keeper), null);
  // Jumped ahead to the turn with holes left to play
  assert.equal(betPromptFor(stroke({ upto: 4 }), 10, keeper), null);
});

test('never on a finished round or one being fixed', () => {
  const done = { ...stroke(), status: 'done' };
  assert.equal(betPromptFor(done, 1, keeper), null);
  const fixing = { ...stroke(), editing: true };
  assert.equal(betPromptFor(fixing, 1, keeper), null);
});

test('a bet that already covers the hole keeps it quiet, for the keeper any bet, for a player one of theirs', () => {
  const r = addBet(stroke(), bet('match', ['p', 'y']));
  assert.equal(betPromptFor(r, 1, keeper), null);
  // Zach isn't in that match, so his phone still asks
  assert.equal(betPromptFor(r, 1, { me: 'z', editable: false })?.why, 'first');
  // A match doesn't stop closest to the pin on the par 3
  const r3 = addBet(stroke({ upto: 2 }), bet('match', ['p', 'y']));
  assert.equal(betPromptFor(r3, 3, keeper)?.kind, 'ctp');
  const ctp = addBet(stroke({ upto: 2 }), bet('ctp', ['p', 'y']));
  assert.equal(betPromptFor(ctp, 3, keeper), null);
  // A back-nine match made at the start keeps the turn quiet
  const back = addBet(stroke({ upto: 9 }), bet('match', ['p', 'y'], { holes: [10, 18] }));
  assert.equal(betPromptFor(back, 10, keeper), null);
  // A front-nine match doesn't
  const front = addBet(stroke({ upto: 9 }), bet('match', ['p', 'y'], { holes: [1, 9] }));
  assert.equal(betPromptFor(front, 10, keeper)?.why, 'turn');
});

test('a round with as many side bets as it can take doesn’t ask', () => {
  let r = stroke();
  for (let i = 0; i < MAX_BETS; i++) r = addBet(r, { ...bet('custom', ['p', 'y']), id: `c${i}`, label: `Bet ${i}` });
  assert.equal(betPromptFor(r, 1, keeper), null);
});

test('a scramble: a player on a team asks for a match across teams, closest to the pin on a par 3', () => {
  const r = scramble();
  assert.equal(betPromptFor(r, 1, { me: 'a', editable: false })?.kind, 'match');
  assert.equal(betPromptFor(r, 1, { me: null, editable: true })?.kind, 'match');
  // Holes 1 and 2 scored by team: the par 3 asks for closest to the pin, which teammates can have
  r.holes.slice(0, 2).forEach(h => { r.scores[h.no] = Object.fromEntries(r.teams.map(t => [t.id, 4])); });
  assert.equal(betPromptFor(r, 3, { me: 'a', editable: false })?.kind, 'ctp');
});

test('never on a scramble pair that can’t bet: teammates with no one across from them get no match', () => {
  // Teams unknown (an old shared round): a match can never fit, so the first hole stays quiet
  const r = { ...scramble(), teams: null };
  assert.equal(betPromptFor(r, 1, { me: 'a', editable: false }), null);
  assert.equal(betPromptFor(r, 1, keeper), null);
});

test('a round with one player left on the hole has nobody to bet with', () => {
  const r = createRound({
    id: 'r2', game: 'stroke', course: course(9), holesCount: 9, players: [{ id: 'a', name: 'A', index: null }, { id: 'b', name: 'B', index: null }],
    settings: { hcPct: 100, stroke: { stake: 5, payout: 'pot' } }, hcPct: 100, useHandicaps: false,
  });
  r.left = { b: 0 };
  assert.equal(betPromptFor(r, 1, { me: 'a', editable: true }), null);
});

test('markPrompt records a hole answered or the round put away, and drops finished rounds as it goes', () => {
  const s = { rounds: { r: { status: 'active' }, old: { status: 'done' }, live: { status: 'active' } }, betPrompts: { old: { skip: true }, live: { done: [1] }, gone: { done: [3] } } };
  markPrompt(s, 'r', { pos: 1 });
  markPrompt(s, 'r', { pos: 3 });
  markPrompt(s, 'r', { pos: 3 });
  assert.deepEqual(s.betPrompts, { live: { done: [1] }, r: { done: [1, 3] } });
  markPrompt(s, 'r', { skip: true });
  assert.deepEqual(s.betPrompts.r, { done: [1, 3], skip: true });
});
