// Adding a player once the round is under way: their money counts from the hole they join.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADD_MID_ROUND, createRound, roundResults, holeComplete, scorers, addPlayerToRound, addPlayerProblem, firstOpenHole, roundNotes, rabbitTable, bankerHoleSetup,
  gameView, wolfFor, skinsTable, joinGames, joinRule, leftRule, birdiePotShares,
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

// --------------------------- Picking games when added (side games) -----------------------------
// Decided 2026-09-29: after letting someone in, the scorekeeper picks which games they play and from
// which hole. A player who can't join a fixed-side main game can still play the side games.

const SIDE = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  dots: { value: 1, auto: true, kinds: { greenie: true } },
  birdies: { stake: 5, eagleShares: 2 },
};
const withSides = (r, games) => { r.sideGames = games.map(g => ({ game: g, settings: structuredClone(SIDE[g]) })); return r; };
const pickWolves = r => r.holes.forEach((h, i) => { if (r.scores[h.no]) r.wolf[h.no] = { wolf: wolfFor(gameView(r, 'main'), i), partner: null }; });

test('Wolf plus Skins: a 5th player on Skins only from hole 6 leaves the wolf money exactly as the foursome had it', () => {
  const four = withSides(mk('wolf', 4), ['skins']);
  // Holes 1 to 5: a tie on 4 and 5 builds a two-skin carry among the foursome
  play(four, [{ a: 3, b: 4, c: 4, d: 4 }, { a: 4, b: 3, c: 4, d: 5 }, { a: 5, b: 4, c: 4, d: 3 }, { a: 4, b: 4, c: 5, d: 5 }, { a: 4, b: 4, c: 4, d: 4 }]);
  four.current = 5;
  assert.equal(addPlayerProblem(four), null); // Wolf is full, but Skins takes him
  const five = structuredClone(addPlayerToRound(four, Zed, 6, ['skins']));
  assert.deepEqual(five.gamesFor, { z: ['skins'] });
  assert.deepEqual(five.joined, { z: 6 });
  // Holes 6 to 9: Zed wins 6 outright, a wins 7, then ties
  const late = [{ a: 4, b: 4, c: 4, d: 4, z: 3 }, { a: 3, b: 4, c: 4, d: 4, z: 4 }, { a: 4, b: 4, c: 4, d: 4, z: 4 }, { a: 5, b: 4, c: 4, d: 4, z: 4 }];
  const lateFour = late.map(s => { const { z, ...rest } = s; void z; return rest; });
  play(five, [null, null, null, null, null, ...late]);
  play(four, [null, null, null, null, null, ...lateFour]);
  pickWolves(four); pickWolves(five);
  // The main game never sees Zed: same rotation, same wolf money
  assert.deepEqual(gameView(five, 'main').players.map(p => p.id), ['a', 'b', 'c', 'd']);
  five.holes.forEach((h, i) => assert.equal(wolfFor(gameView(five, 'main'), i), wolfFor(four, i)));
  const res5 = roundResults(five), res4 = roundResults(four);
  const wolf4 = res4.detail.byGame.main.balances;
  assert.deepEqual({ ...res5.detail.byGame.main.balances }, { ...wolf4, z: 0 });
  // Skins: Zed takes hole 6's skin from all four (4 x $2), then pays a $2 for hole 7, and no share of
  // the carry from 4 and 5 either way
  const sk = res5.detail.byGame.skins.balances;
  assert.equal(sk.z, 6);
  // a wins 7: its own skin plus the carry from 4 and 5. That carry is only the foursome's, so Zed
  // pays for hole 7's own skin and nothing more
  const skinsView = gameView(five, 'skins');
  const row7 = skinsTable(skinsView).rows[6];
  assert.equal(row7.winner, 'a');
  const zedPaid = row7.parts.filter(pt => pt.payers.includes('z')).reduce((x, pt) => x + pt.worth, 0);
  assert.equal(zedPaid, 2);
  assert.equal(sum(res5.balances), 0);
  // And the round's notes say what he's in
  assert.match(roundNotes(five).find(n => n.kind === 'joined').text, /Zed joined on hole 6\. Wolf is played in set sides, so they sit it out\. They play Skins from there\. Skins already carrying stay with the players who built them\./);
});

test('holeComplete of the main game ignores a side-only player\'s missing score', () => {
  const r = withSides(mk('wolf', 4), ['skins']);
  play(r, [{ a: 4, b: 4, c: 4, d: 4 }]);
  const x = addPlayerToRound(r, Zed, 2, ['skins']);
  x.scores[2] = { a: 4, b: 4, c: 4, d: 4 };
  assert.equal(holeComplete(gameView(x, 'main'), x.holes[1]), true);
  assert.equal(holeComplete(gameView(x, 'skins'), x.holes[1]), false);
  assert.equal(holeComplete(x, x.holes[1]), false); // the card still wants his score
});

test('addPlayerProblem with and without side games', () => {
  // No side games: as before
  assert.match(addPlayerProblem(mk('nassau', 2)), /played in set sides/);
  assert.match(addPlayerProblem(mk('wolf', 4)), /group is full/);
  // A fixed-side main game with a side game that takes players: someone can join the side game
  assert.equal(addPlayerProblem(withSides(mk('nassau', 2), ['dots'])), null);
  assert.equal(addPlayerProblem(withSides(mk('vegas', 4, { teams: [['a', 'b'], ['c', 'd']] }), ['skins'])), null);
  // Only a birdie pot, once under way: nothing takes a late joiner
  const pot = withSides(mk('sixes', 4), ['birdies']);
  assert.equal(addPlayerProblem(pot), null); // before the first score the pot still takes them
  play(pot, [{ a: 4, b: 4, c: 4, d: 4 }]);
  assert.match(addPlayerProblem(pot), /Sixes is for 4 players/);
  // The main game's cap counts only its own players: Wolf is full at 4, side games go to 8
  const big = withSides(mk('wolf', 4), ['skins']);
  let r = big;
  for (const id of ['v', 'w', 'x', 'y']) r = addPlayerToRound(r, { id, name: id.toUpperCase() }, null, ['skins']);
  assert.equal(r.players.length, 8);
  assert.match(addPlayerProblem(r), /up to 8 players/);
  // A main game that takes joiners counts its own players, not the side-only ones
  const sk = withSides(mk('stroke', 3), ['dots']);
  const withSideOnly = addPlayerToRound(sk, Zed, null, ['dots']);
  assert.equal(gameView(withSideOnly, 'main').players.length, 3);
  assert.equal(addPlayerProblem(withSideOnly), null);
});

test('joinGames: one switch per game with a plain reason', () => {
  const r = withSides(mk('wolf', 4, { course: eighteen, holesCount: 18 }), ['skins', 'dots']);
  play(r, [{ a: 4, b: 4, c: 4, d: 4 }]);
  const g = joinGames(r, 'Chris', 6);
  assert.deepEqual(g.map(x => [x.key, x.on, x.disabled]), [['main', false, true], ['skins', true, false], ['dots', true, false]]);
  assert.equal(g[0].reason, 'Wolf is played in set sides, so Chris sits it out.');
  assert.equal(g[1].reason, 'From hole 6. Skins already carrying stay with the players who built them.');
  const b = withSides(mk('stroke', 3), ['birdies']);
  play(b, [{ a: 4, b: 4, c: 4 }]);
  const gb = joinGames(b, 'Chris', 4);
  assert.deepEqual(gb.map(x => [x.key, x.on, x.disabled]), [['main', true, false], ['birdies', false, true]]);
  assert.equal(gb[1].reason, 'The pot is for the players who started.');
  assert.equal(gb[0].reason, 'Their money counts from there: they settle with each player on the holes they both played.');
});

test('gamesFor absent means today\'s behavior', () => {
  const r = withSides(mk('skins', 3), ['dots']);
  play(r, [{ a: 4, b: 5, c: 5 }]);
  const x = addPlayerToRound(r, Zed, 3);
  assert.equal(x.gamesFor, undefined);
  // Picking every game is the same as not picking: nothing is written
  const y = addPlayerToRound(r, Zed, 3, ['main', 'dots']);
  assert.equal(y.gamesFor, undefined);
  assert.deepEqual(roundResults(y), roundResults(x));
  assert.equal(joinRule(x, 'z'), 'They play for the skins from there on. Skins already carrying stay with the players who built them. They’re in Junk from there.');
});

test('a Birdie pot joiner is excluded, and a side-only player never moves the main game\'s strokes', () => {
  const r = withSides(mk('stroke', 3, { useHandicaps: true, players: [{ ...P[0], courseHcOverride: 2 }, { ...P[1], courseHcOverride: 6 }, { ...P[2], courseHcOverride: 10 }] }), ['birdies', 'skins']);
  const before = r.players.map(p => p.plays);
  // Before any score, added to the side games only: nobody else's strokes move
  const x = addPlayerToRound(r, { id: 'z', name: 'Zed', courseHc: 0 }, null, ['birdies', 'skins']);
  assert.deepEqual(x.players.slice(0, 3).map(p => p.plays), before);
  // Late, the birdie pot leaves him out even if the list says otherwise
  play(r, [{ a: 4, b: 4, c: 4 }]);
  const y = addPlayerToRound(r, Zed, 2, ['birdies', 'skins']);
  play(y, [null, { a: 4, b: 4, c: 4, z: 3 }]);
  assert.deepEqual(birdiePotShares(gameView(y, 'birdies')).inPot, ['a', 'b', 'c']);
  assert.equal(roundResults(y).detail.byGame.birdies.balances.z, 0);
  assert.match(joinRule(y, 'z'), /birdie pot is for the players who started/);
});

test('a side-only player leaving leaves the main game as it was', () => {
  const r = withSides(mk('wolf', 4), ['skins']);
  play(r, [{ a: 4, b: 4, c: 4, d: 4 }]);
  const x = addPlayerToRound(r, Zed, 2, ['skins']);
  assert.match(leftRule(x, 'z'), /^Wolf carries on as it was: they weren’t in it\./);
});

test('games with an order or sides never see a side-only player: same money as without them', () => {
  const extra = { hammer: { stake: 5, max: 3, who: 'either' }, snake: { stake: 5, growth: 'double', nines: false, cap: 4 } };
  const cases = [['wolf'], ['banker'], ['sixes'], ['nassau'], ['vegas', [['a', 'b'], ['c', 'd']]], ['match', [['a', 'b'], ['c', 'd']]], ['hammer'], ['snake']];
  const rows = [{ a: 3, b: 4, c: 5, d: 4 }, { a: 4, b: 3, c: 4, d: 5 }, { a: 5, b: 4, c: 3, d: 4 }, { a: 4, b: 5, c: 4, d: 3 }, { a: 4, b: 4, c: 4, d: 5 }, { a: 3, b: 5, c: 4, d: 4 }, { a: 4, b: 4, c: 3, d: 4 }, { a: 5, b: 3, c: 4, d: 4 }, { a: 4, b: 4, c: 5, d: 3 }];
  for (const [game, teams] of cases) {
    const base = withSides(mk(game, 4, { settings: { ...structuredClone(SETTINGS), ...extra }, ...(teams ? { teams } : {}) }), ['skins']);
    // Zed is added before the first score, to Skins only, so he's on every hole
    const five = structuredClone(addPlayerToRound(base, Zed, null, ['skins']));
    const four = structuredClone(base);
    for (const r of [four, five]) {
      rows.forEach((s, i) => { r.scores[r.holes[i].no] = r === five ? { ...s, z: 4 } : { ...s }; });
      const v = gameView(r, 'main');
      r.holes.forEach((h, i) => {
        if (game === 'wolf') r.wolf[h.no] = { wolf: wolfFor(v, i), partner: null };
        if (game === 'banker') r.banker[h.no] = bankerHoleSetup(v, i);
      });
    }
    const m4 = roundResults(four).detail.byGame.main.balances;
    const m5 = roundResults(five).detail.byGame.main.balances;
    assert.deepEqual(m5, { ...m4, z: 0 }, game);
    assert.equal(sum(roundResults(five).balances), 0, game);
  }
});
