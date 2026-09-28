// Adding a player once the round is under way: their money counts from the hole they join.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADD_MID_ROUND, createRound, roundResults, holeComplete, scorers, addPlayerToRound, addPlayerProblem, firstOpenHole, roundNotes, rabbitTable, bankerHoleSetup,
} from './round.js';
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
const hole = (par, hdcp) => ({ par, hdcp });
const nine = { id: 'c', name: 'Nine', city: 'Town', tees: [{ name: 'W', rating: 35, slope: 113 }], holes: Array.from({ length: 9 }, (_, i) => hole(4, i + 1)) };
const eighteen = { ...nine, holes: Array.from({ length: 18 }, (_, i) => hole(4, i + 1)) };
const P = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: ['Ann', 'Bo', 'Cy', 'Di'][i], index: 0 }));
const mk = (game, n = 3, extra = {}) => createRound({ id: 'r', game, course: nine, holesCount: 9, players: P.slice(0, n), settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false, ...extra });
const play = (r, rows) => rows.forEach((s, i) => { if (s) r.scores[r.holes[i].no] = s; });
const sum = b => Math.round(Object.values(b).reduce((x, y) => x + y, 0) * 100) / 100 + 0;
const Zed = { id: 'z', name: 'Zed Park', index: 0 };

test('nobody can join a game with fixed sides, or a full group', () => {
  const nassau = mk('nassau', 2);
  // Even before the first score: a third player would have no side in a head-to-head game
  assert.match(addPlayerProblem(nassau), /played in set sides/);
  const match = mk('match', 4, { teams: [['a', 'b'], ['c', 'd']] });
  assert.match(addPlayerProblem(match), /played in set sides/);
  play(nassau, [{ a: 4, b: 4 }]);
  assert.match(addPlayerProblem(nassau), /set up for the players who started/);
  assert.match(addPlayerProblem(mk('wolf', 4)), /group is full/);
  const skins = mk('skins');
  play(skins, [{ a: 4, b: 4, c: 4 }]);
  assert.equal(addPlayerProblem(skins), null);
});

test('before any score a new player is simply one more, and strokes are worked out again', () => {
  const r = mk('skins', 2, { useHandicaps: true, players: [{ ...P[0], courseHcOverride: 2 }, { ...P[1], courseHcOverride: 2 }] });
  const next = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: -2 }, 1);
  assert.equal(next.players.length, 3);
  assert.deepEqual(next.joined, {});
  // Zed plays off 2 better than the old low, so Ann and Bo now get 4 each
  assert.deepEqual(next.players.map(p => p.plays), [4, 4, 0]);
  assert.equal(r.players.length, 2); // not mutated
});

test('under way: the new player starts on the chosen hole and nobody else\'s strokes move', () => {
  const r = mk('skins', 2, { useHandicaps: true, players: [{ ...P[0], courseHcOverride: 2 }, { ...P[1], courseHcOverride: 8 }] });
  play(r, [{ a: 4, b: 4 }, { a: 4, b: 4 }]);
  const was = r.players.map(p => p.plays);
  r.current = 2;
  assert.equal(firstOpenHole(r), 3);
  const better = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: 0 }, 3);
  assert.deepEqual(better.players.slice(0, 2).map(p => p.plays), was);
  assert.equal(better.players[2].plays, -2); // gives 2 to the old low
  const worse = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: 7 }, 3);
  assert.equal(worse.players[2].plays, 5);
  assert.deepEqual(worse.joined, { z: 3 });
});

test('a joiner has no score box before their hole and holes stay complete without them', () => {
  const r = mk('skins');
  play(r, [{ a: 4, b: 5, c: 5 }]);
  const x = addPlayerToRound(r, Zed, 3);
  assert.deepEqual(scorers(x, x.holes[1]).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(scorers(x, x.holes[2]).map(p => p.id), ['a', 'b', 'c', 'z']);
  x.scores[2] = { a: 4, b: 4, c: 4 };
  assert.equal(holeComplete(x, x.holes[1]), true);
  x.scores[3] = { a: 4, b: 4, c: 4 };
  assert.equal(holeComplete(x, x.holes[2]), false); // Zed plays hole 3
});

test('skins: holes before the joiner are paid without them, and a carry from before they joined is not theirs', () => {
  const r = mk('skins');
  play(r, [{ a: 3, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 3);
  x.scores[3] = { a: 5, b: 5, c: 5, z: 3 };
  const res = roundResults(x);
  // H1: Ann 1 skin from Bo and Cy. H2 ties, carries among the three. H3: Zed wins only the 3rd's own skin
  assert.deepEqual(res.balances, { a: 2 - 1, b: -1 - 1, c: -1 - 1, z: 3 });
  assert.equal(sum(res.balances), 0);
  assert.equal(res.detail.skins.rows[2].skins, 1);
  assert.equal(res.detail.skins.rows[2].kept, 1, 'the 2nd still carries among Ann, Bo and Cy');
});

// A carry stays with the players who built it (2026-09-28)
const pairsBalance = res => {
  for (const [a, row] of Object.entries(res.pairs)) {
    assert.equal(Math.round(Object.values(row).reduce((x, y) => x + y, 0) * 100) / 100 + 0, res.balances[a], `${a}'s head to head adds up to their money`);
  }
};

test('skins carry: built before the join and won by an original player', () => {
  const r = mk('skins');
  play(r, [{ a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 3);
  x.scores[3] = { a: 3, b: 4, c: 4, z: 4 };
  const res = roundResults(x);
  // Ann takes 3 skins: the 2 carried, $2 each from Bo and Cy only, and the 3rd, $1 each from all three
  assert.deepEqual(res.balances, { a: 4 + 3, b: -3, c: -3, z: -1 });
  assert.equal(res.detail.skins.rows[2].skins, 3);
  assert.equal(res.detail.skinsWon.a.amount, 7);
  assert.equal(sum(res.balances), 0);
  assert.equal(res.pairs.z.a, -1, 'Zed only paid Ann for the hole he played');
  pairsBalance(res);
  // Both kinds: the same rule on the gross skins too, so twice the money with handicaps off
  const both = structuredClone(x);
  both.settings.skins.kind = 'both';
  assert.deepEqual(roundResults(both).balances, { a: 14, b: -6, c: -6, z: -2 });
});

test('skins carry: the late joiner wins their first hole and the old carry keeps going', () => {
  const r = mk('skins');
  play(r, [{ a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 3);
  x.scores[3] = { a: 4, b: 4, c: 4, z: 3 };
  x.scores[4] = { a: 4, b: 3, c: 4, z: 4 };
  const res = roundResults(x);
  const rows = res.detail.skins.rows;
  assert.deepEqual([rows[2].winner, rows[2].pot, rows[2].skins, rows[2].kept], ['z', 3, 1, 2]);
  // H3: Zed $1 from each of three. H4: Bo takes the 4th ($1 from three) and the 2 carried ($2 from Ann and Cy)
  assert.deepEqual([rows[3].winner, rows[3].skins], ['b', 3]);
  assert.match(roundNotes(x)[0].text, /stay with the players who built them/);
  assert.deepEqual(res.balances, { a: -1 - 1 - 2, b: -1 + 3 + 4, c: -1 - 1 - 2, z: 3 - 1 });
  assert.equal(sum(res.balances), 0);
  pairsBalance(res);
});

test('skins carry: a tie with the joiner in it carries for everyone, the older carry only for its builders', () => {
  const r = mk('skins');
  play(r, [{ a: 4, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 2);
  x.scores[2] = { a: 3, b: 4, c: 4, z: 3 }; // Ann and Zed tie: carries
  x.scores[3] = { a: 4, b: 4, c: 4, z: 3 };
  const res = roundResults(x);
  // Zed takes the 2nd (he was in it) and the 3rd, $2 from each of three. The 1st still carries
  assert.deepEqual(res.balances, { a: -2, b: -2, c: -2, z: 6 });
  assert.equal(res.detail.skins.rows[2].skins, 2);
  assert.equal(res.detail.skins.rows[2].kept, 1);
  assert.equal(sum(res.balances), 0);
  pairsBalance(res);
});

test('skins carry: after the last hole the old carry goes to its builders (split, playoff, void)', () => {
  // Holes 1 to 8 tie. Zed joins on the 5th and wins the 9th outright; Ann and Bo are low of the rest
  const make = lastCarry => {
    const r = mk('skins');
    r.settings.skins.lastCarry = lastCarry;
    play(r, [1, 2, 3, 4].map(() => ({ a: 4, b: 4, c: 4 })));
    const x = addPlayerToRound(r, Zed, 5);
    for (let i = 5; i <= 8; i++) x.scores[i] = { a: 4, b: 4, c: 4, z: 4 };
    x.scores[9] = { a: 4, b: 4, c: 5, z: 3 };
    return x;
  };
  // Zed takes the 5th to 8th and the 9th: $5 from each of three. The 1st to 4th are left over
  const v = roundResults(make('void'));
  assert.deepEqual(v.balances, { a: -5, b: -5, c: -5, z: 15 });
  assert.equal(v.detail.skins.unclaimed, 4);
  // Split: Ann and Bo share them, $4 from Cy
  const s = roundResults(make('split'));
  assert.deepEqual(s.balances, { a: -3, b: -3, c: -9, z: 15 });
  assert.equal(s.detail.skins.unclaimed, 0);
  assert.deepEqual(s.detail.skins.end.tied, ['a', 'b']);
  pairsBalance(s);
  // Playoff: only Ann or Bo can win it, and the winner gets $4 from each of the other two
  const p = make('playoff');
  p.skinsPlayoff = { net: 'z' };
  assert.deepEqual(roundResults(p).balances, v.balances);
  p.skinsPlayoff = { net: 'a' };
  assert.deepEqual(roundResults(p).balances, { a: 3, b: -9, c: -9, z: 15 });
  for (const res of [v, s, roundResults(p)]) assert.equal(sum(res.balances), 0);
});

test('skins carry, pot: the carry from before the join counts for whoever of the builders wins it', () => {
  const r = mk('skins');
  r.settings.skins = { value: 1, carryover: true, payout: 'pot', stake: 10 };
  play(r, [{ a: 4, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 2);
  x.scores[2] = { a: 4, b: 4, c: 4, z: 3 }; // Zed's skin: he's out of the pot, and the 1st keeps carrying
  x.scores[3] = { a: 4, b: 3, c: 4, z: 4 }; // Bo: the 3rd and the carried 1st
  x.scores[4] = { a: 3, b: 4, c: 4, z: 4 }; // Ann: the 4th
  for (let i = 5; i <= 9; i++) x.scores[i] = { a: 4, b: 4, c: 4, z: 4 };
  const res = roundResults(x);
  // Bo 2 skins, Ann 1, of a $30 pot
  assert.deepEqual(res.balances, { a: 0, b: 10, c: -10, z: 0 });
  assert.equal(sum(res.balances), 0);
  pairsBalance(res);
});

test('skins pot: the joiner is out of the pot and their skins do not count', () => {
  const r = mk('skins');
  r.settings.skins = { value: 1, carryover: true, payout: 'pot', stake: 10 };
  play(r, [{ a: 3, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 2);
  for (let i = 2; i <= 9; i++) x.scores[i] = { a: 4, b: 4, c: 4, z: 3 };
  const res = roundResults(x);
  // Only Ann won a skin among the three in the pot, so she takes their $30
  assert.deepEqual(res.balances, { a: 20, b: -10, c: -10, z: 0 });
});

test('a player added mid-round brings their payment app with them', () => {
  const r = mk('skins');
  play(r, [{ a: 3, b: 4, c: 4 }]);
  const x = addPlayerToRound(r, { ...Zed, payApp: 'cashapp', payHandle: '$zed' }, 2);
  const z = x.players.find(p => p.id === 'z');
  assert.equal(z.payApp, 'cashapp');
  assert.equal(z.payHandle, '$zed');
});

test('stroke per stroke: the joiner settles with each player on the holes they both played', () => {
  const r = mk('stroke');
  play(r, [{ a: 4, b: 6, c: 5 }]);
  const x = addPlayerToRound(r, Zed, 2);
  x.scores[2] = { a: 4, b: 4, c: 4, z: 3 };
  const res = roundResults(x);
  // H1: Ann +2 v Bo, +1 v Cy; Cy +1 v Bo. H2: Zed beats all three by 1
  assert.deepEqual(res.balances, { a: 3 - 1, b: -3 - 1, c: 0 - 1, z: 3 });
  assert.equal(sum(res.balances), 0);
});

test('stroke pot: the joiner is not in the pot', () => {
  const r = mk('stroke');
  r.settings.stroke = { stake: 5, payout: 'pot' };
  play(r, [{ a: 4, b: 5, c: 5 }]);
  const x = addPlayerToRound(r, Zed, 2);
  for (let i = 2; i <= 9; i++) x.scores[i] = { a: 4, b: 4, c: 4, z: 3 };
  const res = roundResults(x);
  assert.equal(res.balances.z, 0);
  assert.deepEqual(res.balances, { a: 10, b: -5, c: -5, z: 0 });
  assert.match(roundNotes(x).find(n => n.kind === 'joined').text, /^Zed joined on hole 2\. The pot is for the players who started/);
});

test('quota per point: a pair with a joiner compares a share of the quota', () => {
  const r = mk('quota', 2, { useHandicaps: true, players: [{ ...P[0], courseHcOverride: 0 }, { ...P[1], courseHcOverride: 9 }] });
  play(r, Array.from({ length: 4 }, () => ({ a: 4, b: 4 })));
  const x = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: 9 }, 5);
  for (let i = 5; i <= 9; i++) x.scores[i] = { a: 4, b: 4, z: 4 };
  const res = roundResults(x);
  assert.equal(sum(res.balances), 0);
  // Ann and Bo played every hole together, so their whole quotas count; Zed only shares 5 of 9 holes
  assert.ok(res.balances.z > 0);
});

test('banker: the joiner bets from their hole and the rotation takes them in', () => {
  const r = mk('banker');
  r.banker[1] = bankerHoleSetup(r, 0);
  play(r, [{ a: 4, b: 3, c: 4 }]);
  const x = addPlayerToRound(r, Zed, 2);
  const setup = bankerHoleSetup(x, 1);
  assert.equal(setup.banker, 'b');
  assert.deepEqual(Object.keys(setup.bets).sort(), ['a', 'c', 'z']);
  x.banker[2] = setup;
  x.scores[2] = { a: 4, b: 4, c: 4, z: 3 };
  const res = roundResults(x);
  // H1 (Ann banks): Bo wins 5, Cy pushes. H2 (Bo banks): Zed wins 5 from Bo
  assert.deepEqual(res.balances, { a: -5, b: 0, c: 0, z: 5 });
});

test('rabbit: a joiner sits out the leg already running and is in on the next', () => {
  const r = createRound({ id: 'r', game: 'rabbit', course: eighteen, holesCount: 18, players: P.slice(0, 3), settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false });
  r.settings.rabbit.tiesFree = false; // ties change nothing, so the rabbit stays caught
  for (let i = 1; i <= 4; i++) r.scores[i] = { a: 4, b: 4, c: 4 };
  const x = addPlayerToRound(r, Zed, 5);
  for (let i = 5; i <= 18; i++) x.scores[i] = { a: 4, b: 4, c: 4, z: 4 };
  x.scores[6] = { a: 4, b: 4, c: 4, z: 2 }; // Zed's birdie on the front doesn't catch the rabbit
  x.scores[12] = { a: 4, b: 4, c: 4, z: 3 };
  const t = rabbitTable(x);
  assert.equal(t.legs[0].holder, null);
  assert.deepEqual(t.legs[0].payers, ['a', 'b', 'c']);
  assert.equal(t.legs[1].holder, 'z');
  const res = roundResults(x);
  assert.deepEqual(res.balances, { a: -5, b: -5, c: -5, z: 15 });
  assert.match(roundNotes(x)[0].text, /sit out the front nine rabbit/);
});

test('a joined player survives the trip through live sharing', () => {
  const r = mk('skins');
  play(r, [{ a: 4, b: 5, c: 5 }]);
  const x = addPlayerToRound(r, Zed, 2);
  x.scores[2] = { a: 4, b: 4, c: 4, z: 3 };
  const back = assemble(JSON.parse(JSON.stringify(buildMeta(x))), JSON.parse(JSON.stringify(buildHoles(x))));
  assert.deepEqual(back.joined, { z: 2 });
  assert.deepEqual(roundResults(back).balances, roundResults(x).balances);
});

test('every game that takes a late joiner still balances to zero', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const course = { ...eighteen, holes: eighteen.holes.map((h, i) => hole(3 + (i % 3), i + 1)) };
  const players = P.slice(0, 3).map((p, i) => ({ ...p, index: [3, 12, 20][i] }));
  for (const game of ADD_MID_ROUND) for (const holesCount of [9, 18]) for (const payout of ['pot', 'per']) {
    for (let k = 0; k < 8; k++) {
      const settings = structuredClone(SETTINGS);
      for (const g of ['stroke', 'stableford', 'quota']) settings[g].payout = payout;
      let r = createRound({ id: 'r', game, course, holesCount, players, settings, hcPct: 100, useHandicaps: true });
      const fill = (x, i) => {
        const h = x.holes[i];
        if (game === 'banker') x.banker[h.no] = bankerHoleSetup(x, i);
        x.scores[h.no] = Object.fromEntries(scorers(x, h).map(p => [p.id, h.par - 2 + Math.floor(rnd() * 4)]));
      };
      const from = 2 + Math.floor(rnd() * (holesCount - 2));
      for (let i = 0; i < from - 1; i++) fill(r, i);
      assert.equal(addPlayerProblem(r), null);
      r = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: Math.floor(rnd() * 20) - 2 }, r.holes[from - 1].no);
      for (let i = from - 1; i < holesCount; i++) fill(r, i);
      assert.equal(sum(roundResults(r).balances), 0, `${game}, ${holesCount} holes, joined on ${from}`);
    }
  }
});
