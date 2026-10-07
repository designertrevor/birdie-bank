// "Any side bets on this hole?" (bet-prompt.js): which holes ask, what each one suggests, and every
// time it stays quiet: switched off, put away for the round, a hole already answered, a watching
// phone, a moment banner up, scores being typed, a hole scored or not next, a bet already covering
// it, too many bets, and a scramble pair that can't have a match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { addBet, MAX_BETS } from './pair-bets.js';
import { betPromptFor, laterSpot, markPrompt, promptSpots, spotCopy, spotDraft, PROMPT_MAX } from './bet-prompt.js';

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

test('a group already playing a closest to the pin pot isn’t asked about closest to the pin, but still gets its match asks', () => {
  const pot = r => ({ ...r, sideGames: [{ game: 'ctp', settings: { stake: 5 } }] });
  assert.equal(betPromptFor(pot(stroke({ upto: 2 })), 3, keeper), null);
  assert.equal(betPromptFor(pot(stroke({ upto: 2 })), 3, { me: 'p', editable: false }), null);
  assert.equal(betPromptFor(pot(stroke()), 1, keeper)?.kind, 'match');
  assert.equal(betPromptFor(pot(stroke({ upto: 9 })), 10, keeper)?.why, 'turn');
  // Another side game doesn't count
  const skins = { ...stroke({ upto: 2 }), sideGames: [{ game: 'skins', settings: { value: 2 } }] };
  assert.equal(betPromptFor(skins, 3, keeper)?.kind, 'ctp');
});

test('the closest to the pin card says the bet runs on the par 3s after this one too, as the editor starts it', () => {
  const p = betPromptFor(stroke({ upto: 2 }), 3, keeper);
  assert.deepEqual(p.holes, [3, 18]);
  assert.match(p.text, /par 3s after/);
});

test('two players: no match ask on the first hole (the game is their match), closest to the pin and the turn still ask', () => {
  const two = (game = 'stroke', upto = 0) => {
    const r = createRound({
      id: 'r2', game, course: course(18), holesCount: 18, players: [{ id: 'a', name: 'A', index: null }, { id: 'b', name: 'B', index: null }],
      settings: { hcPct: 100, stroke: { stake: 5, payout: 'pot' }, nassau: { front: 5, back: 5, total: 5 }, match: { stake: 5 } }, hcPct: 100, useHandicaps: false,
    });
    r.holes.slice(0, upto).forEach(h => { r.scores[h.no] = { a: h.par, b: h.par }; });
    return r;
  };
  const k = { me: 'a', editable: true };
  for (const game of ['stroke', 'match', 'nassau', 'skins']) assert.equal(betPromptFor(two(game), 1, k), null, game);
  assert.equal(betPromptFor(two('stroke'), 1, { me: 'a', editable: false }), null);
  // Closest to the pin still asks on the first par 3
  assert.equal(betPromptFor(two('stroke', 2), 3, k)?.kind, 'ctp');
  assert.equal(betPromptFor(two('match', 2), 3, k)?.kind, 'ctp');
  // The turn's fresh match for the back nine still asks, but not in a Nassau, whose back nine is a bet already
  assert.equal(betPromptFor(two('stroke', 9), 10, k)?.why, 'turn');
  assert.equal(betPromptFor(two('match', 9), 10, k)?.why, 'turn');
  assert.equal(betPromptFor(two('nassau', 9), 10, k), null);
  // Three or more still get the first hole's ask
  assert.equal(betPromptFor(stroke(), 1, keeper)?.why, 'first');
});

test('a Nassau with three or four still asks at the turn', () => {
  const r = createRound({
    id: 'n', game: 'nassau', course: course(18), holesCount: 18, players: IDS.map(id => ({ id, name: id.toUpperCase(), index: null })),
    teams: [['t', 'p'], ['y', 'z']], settings: { hcPct: 100, nassau: { front: 5, back: 5, total: 5 } }, hcPct: 100, useHandicaps: false,
  });
  r.holes.slice(0, 9).forEach(h => { r.scores[h.no] = Object.fromEntries(IDS.map(id => [id, h.par])); });
  assert.equal(betPromptFor(r, 10, keeper)?.why, 'turn');
});

test('a round of two says "You two", never "Two of you" (2026-10-04)', () => {
  const r = stroke();
  const two = { ...r, players: r.players.slice(0, 2) };
  assert.match(spotCopy(two, { pos: 1, why: 'first' }).text, /^You two can/);
  assert.match(spotCopy(two, { pos: 3, why: 'par3' }).text, /You two can bet/);
  if (r.players.length > 2) assert.match(spotCopy(r, { pos: 1, why: 'first' }).text, /^Two of you can/);
});

// ---------------------------------------------------------------------------
// "Not this hole" (design review 2026-10-07, item 24): the card comes back later in the round

test('"Not this hole": closest to the pin comes back on the next par 3, a match at the next spot or three holes on', () => {
  const r = stroke(); // par 3s on 3, 6, 9, 12, 15, 18; the round's own spots are 1, 3 and 10
  assert.deepEqual(laterSpot(r, 3, 'ctp'), { pos: 6, why: 'later', kind: 'ctp' });
  assert.deepEqual(laterSpot(r, 6, 'ctp'), { pos: 9, why: 'later', kind: 'ctp' });
  // The last par 3 is the last hole: a one-hole closest to the pin is still a bet
  assert.deepEqual(laterSpot(r, 15, 'ctp'), { pos: 18, why: 'later', kind: 'ctp' });
  assert.equal(laterSpot(r, 18, 'ctp'), null);
  // A match put off on the first hole comes back at the par 3 spot, which the round asks on anyway (as itself)
  assert.deepEqual(laterSpot(r, 1, 'match'), { pos: 3, why: 'par3', kind: 'ctp' });
  // Put off at the turn: three holes on, and again, until two holes left is too few for a match
  assert.deepEqual(laterSpot(r, 10, 'match'), { pos: 13, why: 'later', kind: 'match' });
  assert.deepEqual(laterSpot(r, 13, 'match'), { pos: 16, why: 'later', kind: 'match' });
  assert.equal(laterSpot(r, 16, 'match'), null);
  // No par 3 left: closest to the pin falls back to the round's next spot
  const noPar3 = stroke({ pars: [4, 4, 3, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4] });
  assert.deepEqual(laterSpot(noPar3, 3, 'ctp'), { pos: 10, why: 'turn', kind: 'match' });
  // Nine holes: the par 3 on 3 comes back on 6, on 6 it comes back on 9, and on 9 there's nothing later
  assert.deepEqual(laterSpot(stroke({ holes: 9 }), 3, 'ctp'), { pos: 6, why: 'later', kind: 'ctp' });
  assert.deepEqual(laterSpot(stroke({ holes: 9 }), 6, 'ctp'), { pos: 9, why: 'later', kind: 'ctp' });
  assert.equal(laterSpot(stroke({ holes: 9 }), 9, 'ctp'), null);
  assert.equal(laterSpot(stroke({ holes: 9 }), 6, 'match'), null);
});

test('the card carries where "Not this hole" would bring it back, and nothing when the round has nowhere later', () => {
  assert.deepEqual(betPromptFor(stroke({ upto: 2 }), 3, keeper).later, { pos: 6, why: 'later', kind: 'ctp' });
  assert.deepEqual(betPromptFor(stroke(), 1, keeper).later, { pos: 3, why: 'par3', kind: 'ctp' });
  assert.deepEqual(betPromptFor(stroke({ upto: 9 }), 10, keeper).later, { pos: 13, why: 'later', kind: 'match' });
  // A 9-hole round's reminder on the last hole has no later, so the card there leaves the button out
  const seen = { done: [3, 6], later: { pos: 9, kind: 'ctp' } };
  const last = betPromptFor(stroke({ holes: 9, upto: 8 }), 9, { ...keeper, seen });
  assert.equal(last.why, 'later');
  assert.equal(last.later, null);
});

test('put off with "Not this hole", the card comes back on that hole with the kind it was put off from, then not again', () => {
  const s = { rounds: { r: { status: 'active' } }, betPrompts: {} };
  markPrompt(s, 'r', { pos: 3, later: { pos: 6, why: 'later', kind: 'ctp' } });
  assert.deepEqual(s.betPrompts.r, { done: [3], later: { pos: 6, kind: 'ctp' } });
  // Hole 3 is done; hole 6 isn't a spot of the round's own, but asks now
  assert.equal(betPromptFor(stroke({ upto: 2 }), 3, { ...keeper, seen: s.betPrompts.r }), null);
  assert.equal(betPromptFor(stroke({ upto: 5 }), 6, keeper), null);
  const p = betPromptFor(stroke({ upto: 5 }), 6, { ...keeper, seen: s.betPrompts.r });
  assert.equal(p.why, 'later');
  assert.equal(p.kind, 'ctp');
  assert.deepEqual(p.holes, [6, 18]);
  assert.equal(p.title, 'Closest to the pin?');
  assert.match(p.text, /^Another par 3\./);
  // Only on that hole, and the round's own spots still ask as themselves
  assert.equal(betPromptFor(stroke({ upto: 4 }), 5, { ...keeper, seen: s.betPrompts.r }), null);
  assert.equal(betPromptFor(stroke({ upto: 9 }), 10, { ...keeper, seen: s.betPrompts.r })?.why, 'turn');
  // Adding the bet from the reminder clears it
  markPrompt(s, 'r', { pos: 6 });
  assert.deepEqual(s.betPrompts.r, { done: [3, 6] });
  assert.equal(betPromptFor(stroke({ upto: 5 }), 6, { ...keeper, seen: s.betPrompts.r }), null);
  // A match put off at the turn comes back three holes on, for the rest of the way
  markPrompt(s, 'r', { pos: 10, later: { pos: 13, kind: 'match' } });
  const m = betPromptFor(stroke({ upto: 12 }), 13, { ...keeper, seen: s.betPrompts.r });
  assert.equal(m.kind, 'match');
  assert.deepEqual(m.holes, [13, 18]);
  assert.equal(m.title, 'A side bet for the rest of the way?');
  assert.match(m.text, /last 6 holes/);
  // "Not this round" still wins over a reminder
  markPrompt(s, 'r', { skip: true });
  assert.equal(betPromptFor(stroke({ upto: 12 }), 13, { ...keeper, seen: s.betPrompts.r }), null);
});
