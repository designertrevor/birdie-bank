// A player leaving mid-round, and holes with a score missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRound, roundResults, holeComplete, scorers, bankerHoleSetup, wolfFor, wolfHoleSetup, sixesMatches, canLeave, roundNotes, totalsTable,
} from './round.js';
import { outstanding } from './ledger.js';
import { assemble, buildMeta, buildHoles } from './sync-model.js';

const SETTINGS = {
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 },
  skins: { value: 1, carryover: true },
  wolf: { point: 1, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'off', threshold: 2 },
  vegas: { point: 1, birdieFlip: false },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 1, payout: 'per' },
  stableford: { stake: 1, payout: 'per', modified: false },
  quota: { stake: 1, payout: 'per' },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true } },
  rabbit: { stake: 5, tiesFree: true },
};
const course = {
  id: 'c', name: 'Nine', city: 'Town', tees: [{ name: 'W', rating: 35, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const P = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: ['Ann', 'Bo', 'Cy', 'Di'][i], index: 0 }));
const mk = (game, n = 4, extra = {}) => createRound({ id: 'r', game, course, holesCount: 9, players: P.slice(0, n), settings: SETTINGS, hcPct: 100, useHandicaps: false, ...extra });
/** Score holes 1..9 from rows like { a: 4, b: 5 }. */
const play = (r, rows) => rows.forEach((s, i) => { if (s) r.scores[i + 1] = s; });
const sum = b => Math.round(Object.values(b).reduce((x, y) => x + y, 0) * 100) / 100;

test('a player who left has no score box and holes stay complete without them', () => {
  const r = mk('skins', 3);
  r.left = { c: 2 };
  assert.deepEqual(scorers(r, r.holes[1]).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(scorers(r, r.holes[2]).map(p => p.id), ['a', 'b']);
  r.scores[3] = { a: 4, b: 5 };
  assert.equal(holeComplete(r, r.holes[2]), true);
  r.scores[2] = { a: 4, b: 5 };
  assert.equal(holeComplete(r, r.holes[1]), false); // Cy was still playing hole 2
  assert.equal(canLeave(r, 'a'), false); // only two would be left
  assert.equal(canLeave(mk('skins', 3), 'a'), true);
});

test('skins: holes after a player leaves are paid by the players still on them', () => {
  const r = mk('skins', 3);
  r.left = { c: 1 };
  play(r, [{ a: 4, b: 5, c: 5 }, { a: 4, b: 4 }, { a: 3, b: 4 }]);
  const res = roundResults(r);
  // H1: Ann wins 1 skin from Bo and Cy (+2). H2 ties, carries. H3: Ann wins 2 skins from Bo alone (+2)
  assert.deepEqual(res.balances, { a: 4, b: -3, c: -1 });
  assert.equal(sum(res.balances), 0);
});

test('banker: the bank skips a player who left and they owe nothing after', () => {
  const r = mk('banker', 4);
  r.left = { b: 1 };
  // Hole 2 rotates to Bo, who has gone: Cy banks instead, and Bo has no bet
  const setup = bankerHoleSetup(r, 1);
  assert.equal(setup.banker, 'c');
  assert.deepEqual(Object.keys(setup.bets).sort(), ['a', 'd']);
  r.banker[1] = bankerHoleSetup(r, 0);
  r.banker[2] = setup;
  play(r, [{ a: 4, b: 3, c: 4, d: 4 }, { a: 3, c: 4, d: 5 }]);
  const res = roundResults(r);
  // H1 (Ann banks): Bo wins 5. H2 (Cy banks): Ann wins 5 from him, Di loses 5 to him
  assert.deepEqual(res.balances, { a: 0, b: 5, c: 0, d: -5 });
  // A setup saved before Bo left that still names him as banker doesn't count
  r.banker[3] = { banker: 'b', bets: { a: 5, c: 5, d: 5 }, doubled: {}, doubleBack: false };
  r.scores[3] = { a: 3, c: 4, d: 4 };
  assert.deepEqual(roundResults(r).balances, res.balances);
});

test('nassau 2 v 2: the partner carries the side; a side with nobody left stops the match', () => {
  const r = mk('nassau', 4, { teams: [['a', 'b'], ['c', 'd']] });
  r.left = { b: 3 };
  // Ann alone for A from hole 4. A wins 1-4 and 5-9 with Ann's ball
  play(r, Array.from({ length: 9 }, (_, i) => (i < 3 ? { a: 4, b: 4, c: 5, d: 5 } : { a: 4, c: 5, d: 5 })));
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 15, b: 15, c: -15, d: -15 });
  const s = mk('match', 2);
  s.left = { b: 2 };
  play(s, [{ a: 4, b: 5 }, { a: 4, b: 5 }, { a: 4 }, { a: 4 }]);
  assert.equal(holeComplete(s, s.holes[2]), true);
  assert.equal(roundResults(s).detail.lines[0].status.played, 2); // the match stopped when Bo left
  assert.deepEqual(roundResults(s).balances, { a: 10, b: -10 });
});

test('stroke play per stroke settles each pair on the holes both played; a pot leaves the leaver out', () => {
  const r = mk('stroke', 3);
  r.left = { c: 3 };
  play(r, Array.from({ length: 9 }, (_, i) => (i < 3 ? { a: 4, b: 5, c: 3 } : { a: 4, b: 5 })));
  const res = roundResults(r);
  // Ann v Bo over 9 holes: Ann 9 better. Cy v each over 3 holes: 3 better than Ann, 6 better than Bo
  assert.deepEqual(res.balances, { a: 6, b: -15, c: 9 });
  assert.equal(totalsTable(r).find(t => t.id === 'c').played, 3);
  r.settings = { ...r.settings, stroke: { stake: 5, payout: 'pot' } };
  assert.deepEqual(roundResults(r).balances, { a: 5, b: -5, c: 0 });
});

test('quota per point: a pair with a leaver compares a share of the quota', () => {
  const r = mk('quota', 2);
  r.players = r.players.map(p => ({ ...p, courseHc: p.id === 'a' ? 0 : 9 }));
  r.useHandicaps = true;
  // Quotas over 9: Ann 18, Bo 9. Bo leaves after 3 holes, so a third of the gap counts: 3 points
  r.left = { b: 3 };
  play(r, Array.from({ length: 9 }, (_, i) => (i < 3 ? { a: 4, b: 4 } : { a: 4 })));
  // Same points on the shared holes (2 each a hole), Ann gives 3 of quota
  assert.deepEqual(roundResults(r).balances, { a: -3, b: 3 });
});

test('points games: nines stops, aces goes on among the rest, bingo bango bongo and dots settle on shared holes', () => {
  const n = mk('nines', 3);
  n.left = { c: 1 };
  play(n, [{ a: 3, b: 4, c: 5 }, { a: 3, b: 4 }]);
  assert.equal(roundResults(n).detail.rows.length, 1);
  assert.deepEqual(roundResults(n).balances, { a: 2, b: 0, c: -2 });

  const a = mk('aces', 3);
  a.left = { c: 1 };
  play(a, [{ a: 3, b: 4, c: 5 }, { a: 3, b: 4 }]);
  // H1: Ann ace +4, Cy deuce -2 (Ann +1, Bo +1). H2, just the two: Ann ace from Bo +2, Bo deuce to Ann +1
  assert.deepEqual(roundResults(a).balances, { a: 8, b: -4, c: -4 });

  const b = mk('bbb', 3);
  b.left = { c: 1 };
  b.marks = { 1: { bingo: 'c', bango: 'c', bongo: 'a' }, 2: { bingo: 'a', bango: 'b', bongo: 'c' } };
  // Cy's bongo on hole 2 doesn't count: he'd left
  const rb = roundResults(b);
  assert.deepEqual(rb.detail.points, { a: 2, b: 1, c: 2 });
  assert.deepEqual(rb.balances, { a: 0, b: -3, c: 3 }); // Ann v Bo +1 over both holes; on hole 1 only, Cy +1 v Ann and +2 v Bo
  assert.equal(sum(rb.balances), 0);

  const d = mk('dots', 3);
  d.left = { c: 1 };
  play(d, [{ a: 3, b: 4, c: 4 }, { a: 3, b: 4 }]);
  // Ann's birdies: hole 1 paid by Bo and Cy, hole 2 by Bo only
  assert.deepEqual(roundResults(d).balances, { a: 3, b: -2, c: -1 });
});

test('wolf carries on as a threesome after a player leaves', () => {
  const r = mk('wolf', 4);
  r.left = { d: 1 };
  assert.deepEqual([1, 2, 3].map(i => wolfFor(r, i)), ['b', 'c', 'a']); // rotation among Ann, Bo, Cy
  r.wolf = { 2: { wolf: 'b', partner: 'd' } }; // a pick made before Di left doesn't stand
  assert.deepEqual(wolfHoleSetup(r, 1), { wolf: 'b', partner: undefined });
  r.wolf[2] = { wolf: 'b', partner: null };
  play(r, [null, { a: 5, b: 3, c: 5 }]);
  // Lone wolf 2x: Bo beats Ann and Cy, 2 from each
  assert.deepEqual(roundResults(r).balances, { a: -2, b: 4, c: -2, d: 0 });
});

test('vegas and sixes: fixed pairs stop counting once a player leaves', () => {
  const v = mk('vegas', 4, { teams: [['a', 'b'], ['c', 'd']] });
  v.left = { d: 1 };
  play(v, [{ a: 4, b: 4, c: 4, d: 5 }, { a: 4, b: 4, c: 9 }]);
  assert.deepEqual(roundResults(v).balances, { a: 1, b: 1, c: -1, d: -1 }); // 44 v 45 only
  assert.ok(roundResults(v).detail.vegas[1].short);

  const s = mk('sixes', 4);
  s.left = { d: 2 };
  // Match 1 (Ann & Bo v Cy & Di, holes 1-3) finishes with Cy alone for his side; matches 2 and 3 are off
  play(s, [{ a: 4, b: 4, c: 5, d: 5 }, { a: 4, b: 4, c: 5, d: 5 }, { a: 5, b: 5, c: 4 }, { a: 4, b: 4, c: 4 }]);
  const m = sixesMatches(s);
  assert.equal(m[0].status.played, 3);
  assert.ok(m[1].off && m[2].off);
  assert.deepEqual(roundResults(s).balances, { a: 5, b: 5, c: -5, d: -5 });
});

test('scramble: a team plays on without a player; a team with nobody left is out of the pot', () => {
  const r = mk('scramble', 4, { teams: [['a', 'b'], ['c'], ['d']] });
  r.left = { b: 1, d: 1 };
  assert.deepEqual(scorers(r, r.holes[1]).map(t => t.id), ['t0', 't1']);
  play(r, [{ t0: 4, t1: 4, t2: 3 }, { t0: 3, t1: 4 }]);
  // Team D led but left: out of the pot. Ann & Bo beat Cy: Cy's 5 goes to them
  assert.deepEqual(roundResults(r).balances, { a: 2.5, b: 2.5, c: -5, d: 0 });
});

test('rabbit: the rabbit runs loose when its holder leaves, and only those still there pay', () => {
  const r = mk('rabbit', 3);
  r.settings = { ...r.settings, rabbit: { stake: 5, tiesFree: false } };
  r.left = { c: 2 };
  // Cy catches it on hole 1 and leaves after hole 2 still holding it; the rest are halved
  play(r, Array.from({ length: 9 }, (_, i) => (i < 2 ? { a: 5, b: 5, c: i === 0 ? 3 : 5 } : { a: 4, b: 4 })));
  assert.equal(roundResults(r).detail.rabbit.legs[0].holder, null);
  assert.deepEqual(roundResults(r).balances, { a: 0, b: 0, c: 0 });
  r.scores[9] = { a: 4, b: 3 };
  const res = roundResults(r);
  assert.equal(res.detail.rabbit.legs[0].holder, 'b');
  assert.deepEqual(res.balances, { a: -5, b: 5, c: 0 });
});

test('a hole with a score missing is not counted, is named in the notes, and nothing breaks', () => {
  const r = mk('skins', 3);
  play(r, [{ a: 3, b: 4, c: 4 }, { a: 4, b: 3 }, { a: 4, b: 4, c: 3 }]);
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 1, b: -2, c: 1 }); // hole 2 ignored: Ann and Cy take a skin each
  const notes = roundNotes(r);
  assert.deepEqual(notes.map(n => n.text), ['Hole 2 not counted: no score for Cy.']);
  r.left = { c: 2 };
  r.scores[3] = { a: 4, b: 3 };
  assert.deepEqual(roundNotes(r).map(n => n.text), [
    'Cy left after hole 2. The holes after that are settled among the players still playing.',
    'Hole 2 not counted: no score for Cy.',
  ]);
  // Every game copes with a half-scored round, and the Ledger only sees clean numbers
  for (const game of ['banker', 'nassau', 'skins', 'wolf', 'match', 'vegas', 'sixes', 'scramble', 'stroke', 'stableford', 'quota', 'aces', 'bbb', 'dots', 'rabbit']) {
    const g = mk(game, 4, { teams: game === 'vegas' || game === 'nassau' || game === 'match' || game === 'scramble' ? [['a', 'b'], ['c', 'd']] : null });
    g.status = 'done';
    const ids = scorers(g).map(p => p.id);
    g.scores[1] = Object.fromEntries(ids.map(id => [id, 4]));
    g.scores[2] = { [ids[0]]: 5 };
    if (game === 'banker') g.banker[1] = bankerHoleSetup(g, 0);
    if (game === 'wolf') g.wolf[1] = { wolf: 'a', partner: 'b' };
    const out = roundResults(g);
    for (const v of Object.values(out.balances)) assert.ok(Number.isFinite(v), `${game} money is a number`);
    assert.equal(sum(out.balances), 0, `${game} sums to zero`);
    assert.ok(Array.isArray(outstanding({ rounds: { r: g }, settlements: [] })));
  }
  const nines = mk('nines', 3);
  nines.scores[1] = { a: 4 };
  assert.deepEqual(roundResults(nines).balances, { a: 0, b: 0, c: 0 });
});

test('who left travels with a shared round', () => {
  const r = mk('skins', 3);
  r.left = { c: 1 };
  play(r, [{ a: 4, b: 4, c: 4 }, { a: 4, b: 4 }]);
  const back = assemble(buildMeta(r), buildHoles(r));
  assert.deepEqual(back.left, { c: 1 });
  assert.equal(back.current, 2); // holes 1 and 2 are complete without Cy
});
