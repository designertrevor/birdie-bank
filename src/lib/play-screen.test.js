// The round in progress's pure helpers (play-screen.js), moved out of Play.jsx when it was split up:
// the hole's remount key, where Save goes, the double tap guard, a Big Game round's own money and
// what the banker has on the line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { holeMountKey, isSameTap, nextHoleIdx, onTheLine, ownMoney } from './play-screen.js';

const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const P = ['a', 'b', 'c'].map((id, i) => ({ id, name: ['Ann Lee', 'Bo Ray', 'Cy Doe'][i], index: 0 }));
const mk = (game = 'skins', settings = { skins: { value: 2, carryover: true } }) => createRound({ id: 'r', game, course, holesCount: 9, players: P, settings: structuredClone(settings), hcPct: 100, useHandicaps: false });
const score = (r, no, v = 4) => { r.scores[no] = Object.fromEntries(r.players.map(p => [p.id, v])); };

test('the hole remounts when what it shows changes, and only then', () => {
  const r = mk();
  const key = holeMountKey(r);
  assert.equal(key, holeMountKey(structuredClone(r)), 'the same round gives the same key');
  const changes = [
    x => { x.current = 1; },
    x => { x.holesCount = 18; },
    x => { x.left = { b: 3 }; },
    x => { x.joined = { c: 2 }; },
    x => { x.players = [...x.players, { id: 'd', name: 'Di' }]; },
    x => { x.players = [x.players[1], x.players[0], x.players[2]]; },
    x => { x.teams = [{ players: ['a', 'b'] }, { players: ['c'] }]; },
    x => { x.sideGames = [{ game: 'dots', settings: {} }]; },
    x => { x._remote = { 1: 5 }; },
    x => { x.holes[0].par = 5; },
  ];
  for (const fn of changes) {
    const x = structuredClone(r);
    fn(x);
    assert.notEqual(holeMountKey(x), key, fn.toString());
  }
  // A score saved on another hole, or the same left and joined in another order, leave it alone
  const y = structuredClone(r);
  score(y, 5);
  assert.equal(holeMountKey(y), key);
  const a = { ...structuredClone(r), left: { b: 3, c: 4 } };
  const b = { ...structuredClone(r), left: { c: 4, b: 3 } };
  assert.equal(holeMountKey(a), holeMountKey(b));
  // Past the last hole it reads the last one
  assert.equal(holeMountKey({ ...structuredClone(r), current: 40 }).endsWith(':4'), true);
});

test('Save goes to the next hole, or back to the first one still unscored when fixing', () => {
  const r = mk();
  assert.equal(nextHoleIdx(r, 0), 1);
  assert.equal(nextHoleIdx(r, 8), 8, 'the last hole stays put');
  for (const no of [1, 2, 3]) score(r, no);
  assert.equal(nextHoleIdx(r, 0), 3, 'fixing hole 1 goes on to the first hole with no scores');
  for (let no = 1; no <= 9; no++) score(r, no);
  assert.equal(nextHoleIdx(r, 2), 3, 'every hole scored: just the next one');
});

test('a second tap on Save right after a save is the same tap', () => {
  const last = { hole: 3, at: 1000 };
  assert.equal(isSameTap(null, 4, false, 1100, 800), false, 'no save yet');
  assert.equal(isSameTap(last, 4, false, 1100, 800), true);
  assert.equal(isSameTap(last, 4, false, 1800, 800), false, 'after the gap it is a new tap');
  assert.equal(isSameTap(last, 4, true, 1100, 800), false, 'a score touched on the new hole');
  assert.equal(isSameTap(last, 3, false, 1100, 800), false, 'the same hole saved again');
});

test('a Big Game group round has money of its own only with a game, a bet, side games or side bets', () => {
  assert.equal(ownMoney(mk('stroke', { stroke: { stake: 0 } })), false);
  assert.equal(ownMoney(mk('stroke', { stroke: { stake: 5 } })), true);
  assert.equal(ownMoney(mk()), true);
  assert.equal(ownMoney({ ...mk('stroke', { stroke: { stake: 0 } }), sideGames: [{ game: 'dots', settings: {} }] }), true);
  assert.equal(ownMoney({ ...mk('stroke', { stroke: { stake: 0 } }), bets: [{ id: 'b1', kind: 'match', sides: ['a', 'b'], stake: 5 }] }), true);
});

test('what the banker has on the line', () => {
  assert.equal(onTheLine(null), 0);
  const b = { bets: { a: 5, b: 2, c: 3 }, doubled: {}, doubleBack: false };
  assert.equal(onTheLine(b), 10);
  assert.equal(onTheLine({ ...b, doubled: { a: true } }), 15, 'a press doubles that bet');
  assert.equal(onTheLine({ ...b, doubled: { a: true }, doubleBack: true }), 25, 'pressed back: 4x');
  assert.equal(onTheLine({ ...b, doubled: { a: true }, doubleBack: true }, 3), 50, 'a par 3 that triples: 9x');
  assert.equal(onTheLine({ ...b, doubled: { a: true }, doubleBack: true }, 2, true), 30, 'pressing everyone doubles the rest too');
});
