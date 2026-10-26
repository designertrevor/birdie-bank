// The live view's hole-by-hole story (hole-story.js): a line per scored hole, newest first, whose
// amounts add up to the round's money, and what the next Skins hole is worth with the carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, createRound, roundResults, scorers } from './round.js';
import { TEAM_DEFAULTS } from './settings.js';
import { holeStory, moneyRace, nextUp } from './hole-story.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: i === 2 ? 3 : 4, hdcp: i + 1 })) };
const PEOPLE = [{ id: 'a', name: 'Ann Lee' }, { id: 'b', name: 'Bo Diaz' }, { id: 'c', name: 'Cy Park' }, { id: 'd', name: 'Di Moss' }];
const SETTINGS = {
  hcPct: 100, skins: { value: 2, carryover: true }, banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 }, wolf: { point: 2, loneMultiplier: 2 }, match: { stake: 10, pressMode: 'off', threshold: 2 },
  vegas: { point: 1, birdieFlip: true }, sixes: { stake: 5, mode: 'match' }, scramble: { stake: 5 }, stroke: { stake: 5, payout: 'pot' },
  stableford: { stake: 1, payout: 'per', modified: false }, quota: { stake: 1, payout: 'per' }, nines: { point: 1 }, aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 }, dots: { value: 1, auto: true, kinds: {} }, rabbit: { stake: 5, tiesFree: true }, hammer: { stake: 5, max: 3, who: 'either' },
  snake: { stake: 5, growth: 'flat', nines: false }, ...TEAM_DEFAULTS,
};
const skins = () => createRound({ id: 's', game: 'skins', course: flat9, holesCount: 9, players: PEOPLE, settings: SETTINGS, hcPct: 100, useHandicaps: false });
const card = (r, rows) => { rows.forEach((s, i) => { r.scores[r.holes[i].no] = s; }); return r; };

test('a Skins round: newest first, ties carry, and the skin with the carry says so', () => {
  const r = card(skins(), [{ a: 4, b: 4, c: 4, d: 4 }, { a: 3, b: 4, c: 4, d: 5 }, { a: 3, b: 3, c: 3, d: 3 }]);
  const story = holeStory(r);
  assert.deepEqual(story.map(s => s.no), [3, 2, 1]);
  assert.equal(story[2].title, 'Tied, so it carries');
  assert.match(story[1].title, /Ann takes 2 skins/);
  assert.equal(story[1].amount, 12);
  assert.equal(story[0].moved, false);
  const next = nextUp(r);
  assert.equal(next.hole.no, 4);
  assert.equal(next.worth, '2 skins · $12');
  assert.equal(next.carried, 1);
});

test('a birdie that moves nothing still makes the story', () => {
  const r = card(skins(), [{ a: 3, b: 3, c: 4, d: 4 }]);
  assert.equal(holeStory(r)[0].title, 'Ann and Bo birdied');
});

test('every game: the holes add up to the round', () => {
  for (const game of Object.keys(GAMES)) {
    const teams = GAMES[game].teams ? [['a', 'b'], ['c', 'd']] : null;
    const r = createRound({ id: 'g', game, course: flat9, holesCount: 9, players: PEOPLE, settings: SETTINGS, hcPct: 100, useHandicaps: false, teams });
    let k = 0;
    for (const h of r.holes.slice(0, 6)) {
      r.scores[h.no] = Object.fromEntries(scorers(r).map((u, i) => [u.id, h.par + ((i + k++) % 3) - 1]));
    }
    const story = holeStory(r);
    const res = roundResults(r);
    for (const p of r.players) {
      const sum = story.reduce((a, s) => a + Math.round((s.delta[p.id] || 0) * 100), 0);
      assert.ok(Math.abs(sum - Math.round(res.balances[p.id] * 100)) <= 1, `${game}: ${p.id} holes add to ${res.balances[p.id]} (got ${sum / 100})`);
    }
    const race = moneyRace(r);
    assert.equal(race.rows.length, r.players.length);
    assert.ok(race.rows.every(x => x.share >= 0 && x.share <= 1));
  }
});
