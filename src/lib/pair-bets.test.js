// Side bets between two players inside a bigger round (pair-bets.js) and where each amount comes
// from (where-from.js). Each kind on its own, strokes that only count between the two, a bet made
// from a hole partway through, the by-game table and the head to head, the breakdown adding up to
// the pair's net, and old rounds (no bets) giving exactly the money they always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, gameResults, livePreview, roundResults, BETS_LABEL } from './round.js';
import {
  addBet, betLine, betMoneyText, betResult, nextPos, betStatusText, betStrokes, betsMoney, betsOf, betsToTap, changeBet, cleanBet, ctpHoles, nineRange, removeBet, setBetWinner, suggestedStrokes,
} from './pair-bets.js';
import { breakdownLine, breakdownWith, pairBreakdown } from './where-from.js';
import { oldRounds } from './overnight5-money.fixtures.js';
import { buildMeta, buildHoles, assemble } from './sync-model.js';
import { revealSteps } from './reveal.js';
import { seasonBoard } from './season.js';
import { tabBalances, personStory } from './ledger.js';
import { gamesLine } from './side-games.js';
import { money } from './golf.js';
import { points } from './play-for.js';
import { agreementItems, lockAgreement, noteChanges } from './agreed.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./overnight5-money.snapshot.json', import.meta.url), 'utf8'));
const cents = v => Math.round(v * 100) || 0;
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);
const moneyOf = r => {
  const res = roundResults(r);
  const byGame = res.detail.byGame ? Object.fromEntries(Object.entries(res.detail.byGame).map(([k, v]) => [k, v.balances])) : undefined;
  return { balances: res.balances, pairs: res.pairs, ...(byGame ? { byGame } : {}) };
};

// Holes 1 to 9: pars 4 4 3 4 5 3 4 4 3, HCP 1 to 9 in order (hole 1 hardest)
const PARS = [4, 4, 3, 4, 5, 3, 4, 4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 3];
const course = n => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: PARS[i], hdcp: i + 1 })) });
const SETTINGS = { hcPct: 100, banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' }, skins: { value: 2, carryover: false } };

/** A Banker round for four (Trevor, Preston, Tyler, Zach) with no handicaps, everyone par unless `special` says. */
function banker({ holes = 9, special = {}, upto = holes, hc = false, idx = {} } = {}) {
  const ids = ['t', 'p', 'y', 'z'];
  const r = createRound({
    id: 'r', game: 'banker', course: course(holes), holesCount: holes,
    players: ids.map(id => ({ id, name: { t: 'Trevor N', p: 'Preston', y: 'Tyler', z: 'Zach' }[id], index: idx[id] ?? null })),
    settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: hc,
  });
  r.holes.slice(0, upto).forEach((h, i) => {
    r.scores[h.no] = { ...Object.fromEntries(ids.map(id => [id, h.par])), ...(special[i + 1] || {}) };
    r.banker[h.no] = { banker: ids[i % 4], bets: Object.fromEntries(ids.filter((_, k) => k !== i % 4).map(id => [id, 5])), doubled: {}, doubleBack: false };
  });
  return r;
}
const bet = (kind, sides, stake, more = {}) => ({ id: `${kind}-${sides.join('')}`, kind, sides, stake, ...more });
const withBets = (r, ...bets) => bets.reduce((x, b) => addBet(x, b), r);

test('a match bet goes to whoever wins more holes between the two, gross with no strokes', () => {
  // Preston wins holes 2 and 5, Tyler wins hole 7: Preston 1 up after 9
  const r = withBets(banker({ special: { 2: { p: 3 }, 5: { p: 4 }, 7: { y: 3 } } }), bet('match', ['p', 'y'], 10));
  const [res] = betsMoney(r).list;
  assert.equal(res.amount, 10);
  assert.deepEqual(res.balances, { p: 10, y: -10 });
  assert.equal(betStatusText(r, res), 'Preston 1 up');
  assert.deepEqual(res.wins, [2, 1]);
  // Square match: nobody pays
  const sq = withBets(banker({ special: { 2: { p: 3 }, 7: { y: 3 } } }), bet('match', ['p', 'y'], 10));
  assert.equal(betsMoney(sq).list[0].amount, 0);
  assert.equal(betStatusText(sq, betsMoney(sq).list[0]), 'Halved');
  // Closed out early: Preston wins 1 to 5, 5&4 with four to play
  const closed = withBets(banker({ upto: 5, special: Object.fromEntries([1, 2, 3, 4, 5].map(i => [i, { p: PARS[i - 1] - 1 }])) }), bet('match', ['p', 'y'], 10));
  const c = betsMoney(closed).list[0];
  assert.equal(c.amount, 10);
  assert.equal(betStatusText(closed, c), 'Preston 5&4');
});

test('strokes in a bet count only between the two, on the bet’s hardest holes, never in the group game', () => {
  // Tyler gets 2 strokes: holes 1 and 2 are the hardest. Preston birdies 2 (3 v Tyler's net 3: halved)
  // and Tyler bogeys 1 (net par, halved with Preston's par)
  const special = { 1: { y: 5 }, 2: { p: 3 }, 4: { y: 3 } };
  const plain = banker({ special });
  const r = withBets(plain, bet('match', ['p', 'y'], 10, { strokes: { to: 'y', count: 2 } }));
  assert.deepEqual(betStrokes(r, r.bets[0]), { to: 'y', by: { 1: 1, 2: 1 } });
  const res = betResult(r, r.bets[0]);
  assert.deepEqual(res.holes.slice(0, 2).map(h => h.winner), [null, null]);
  assert.equal(res.amount, -10, 'Tyler wins hole 4 and the match');
  // Gross, the same holes go the other way: Preston wins 1 and 2, Tyler 4
  assert.equal(betResult(plain, bet('match', ['p', 'y'], 10)).amount, 10);
  // The group's Banker money is exactly what it is without the bet
  const res2 = roundResults(r);
  assert.deepEqual(res2.detail.byGame.main.balances, gameResults(plain).balances);
  assert.deepEqual(r.players, plain.players, 'nobody’s strokes in the round change');
  // The round's own handicaps never count in the bet: with handicaps on, the bet is still gross plus its strokes
  const hc = banker({ special, hc: true, idx: { t: 5, p: 2, y: 20, z: 10 } });
  assert.ok(hc.players.find(p => p.id === 'y').plays > 0);
  const hcBet = withBets(hc, bet('match', ['p', 'y'], 10, { strokes: { to: 'y', count: 2 } }));
  assert.equal(betResult(hcBet, hcBet.bets[0]).amount, -10);
  // Strokes listed hole by hole instead of by HCP
  const listed = withBets(plain, bet('hole', ['p', 'y'], 2, { strokes: { to: 'y', count: 1, on: [4] } }));
  assert.deepEqual(betStrokes(listed, listed.bets[0]).by, { 4: 1 });
});

test('more strokes than holes wrap: two on the hardest first', () => {
  const r = withBets(banker({ holes: 9 }), bet('hole', ['p', 'y'], 1, { strokes: { to: 'p', count: 11 } }));
  const by = betStrokes(r, r.bets[0]).by;
  assert.equal(by[1], 2);
  assert.equal(by[2], 2);
  assert.equal(by[3], 1);
  assert.equal(Object.values(by).reduce((a, n) => a + n, 0), 11);
});

test('a per-hole bet pays the stake for every hole won outright, ties push, pickups are net double bogey', () => {
  const r = withBets(banker({ special: { 1: { p: 3 }, 2: { p: 3 }, 3: { y: 2 }, 4: { y: 'X' }, 6: { p: 'X', y: 'X' } } }), bet('hole', ['p', 'y'], 2));
  const res = betResult(r, r.bets[0]);
  assert.deepEqual(res.wins, [3, 1]);
  assert.equal(res.amount, 4);
  assert.equal(betStatusText(r, res), 'Preston 3 holes, Tyler 1');
});

test('closest to the pin pays per par 3 tapped, only par 3s inside the bet’s holes', () => {
  let r = withBets(banker(), bet('ctp', ['p', 'z'], 5));
  assert.deepEqual(ctpHoles(r, r.bets[0]).map(x => x.hole.no), [3, 6, 9]);
  assert.equal(betStatusText(r, betResult(r, r.bets[0])), '3 par 3s to play');
  r = setBetWinner(r, r.bets[0].id, 3, 'p');
  r = setBetWinner(r, r.bets[0].id, 6, 'p');
  r = setBetWinner(r, r.bets[0].id, 9, 'z');
  r = setBetWinner(r, r.bets[0].id, 4, 'z'); // a par 4: never counts
  const res = betResult(r, r.bets[0]);
  assert.equal(res.amount, 5);
  assert.equal(betStatusText(r, res), 'Preston 2 of 3 par 3s');
  // Cleared: back to nothing on that hole
  const cleared = setBetWinner(r, r.bets[0].id, 9, null);
  assert.equal(betResult(cleared, cleared.bets[0]).amount, 10);
  // Holes 4 to 9 only: hole 3's tap doesn't count
  const back = changeBet(r, r.bets[0].id, { ...r.bets[0], holes: [4, 9] });
  assert.equal(betResult(back, back.bets[0]).amount, 0);
  assert.deepEqual(back.bets[0].winners, r.bets[0].winners, 'taps stay when the holes change');
  // The scorekeeper gets a tap on par 3s only
  assert.deepEqual(betsToTap(r, r.holes[2]).map(b => b.id), [r.bets[0].id]);
  assert.deepEqual(betsToTap(r, r.holes[3]), []);
});

test('a custom bet is tapped once, and can be changed or cleared on the hole it was tapped', () => {
  let r = withBets(banker(), bet('custom', ['t', 'y'], 20, { label: '  Longest   drive  ' }));
  assert.equal(r.bets[0].label, 'Longest drive');
  assert.equal(betResult(r, r.bets[0]).amount, 0);
  assert.equal(betResult(r, r.bets[0]).open, true);
  assert.equal(betsToTap(r, r.holes[0]).length, 1);
  r = setBetWinner(r, r.bets[0].id, 7, 'y');
  assert.equal(betResult(r, r.bets[0]).amount, -20);
  assert.equal(betStatusText(r, betResult(r, r.bets[0])), 'Tyler won');
  // Decided: it's only on hole 7 from now on
  assert.equal(betsToTap(r, r.holes[0]).length, 0);
  assert.equal(betsToTap(r, r.holes[6]).length, 1);
  r = setBetWinner(r, r.bets[0].id, 7, null);
  assert.equal(betResult(r, r.bets[0]).amount, 0);
  assert.equal(r.bets[0].at, undefined);
});

test('a bet made from hole 10 on only counts holes 10 to 18, and its strokes go on those holes', () => {
  // Preston wins holes 1 to 3 (before the bet), Tyler wins 12
  const base = banker({ holes: 18, special: { 1: { p: 3 }, 2: { p: 3 }, 3: { p: 2 }, 12: { y: 2 } } });
  const r = withBets(base, bet('match', ['p', 'y'], 10, { holes: [10, 18], strokes: { to: 'y', count: 1 } }));
  const res = betResult(r, r.bets[0]);
  assert.equal(res.amount, -10);
  assert.deepEqual(res.holes.map(h => h.no), [10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(betStrokes(r, r.bets[0]).by, { 10: 1 }, 'hole 10 is the hardest of holes 10 to 18');
  assert.equal(betLine(r, r.bets[0], money), 'Preston v Tyler · $10 match · From hole 10 · Tyler gets 1 stroke');
  // Holes still to play: the match counts for whoever is ahead right now
  const half = withBets(banker({ holes: 18, upto: 12, special: { 12: { y: 2 } } }), bet('match', ['p', 'y'], 10, { holes: [10, 18] }));
  assert.equal(betResult(half, half.bets[0]).amount, -10);
  assert.equal(betStatusText(half, betResult(half, half.bets[0])), 'Tyler 1 up');
  // A stretch in the middle
  const mid = cleanBet(base, bet('hole', ['p', 'y'], 1, { holes: [4, 6] }));
  assert.deepEqual(mid.holes, [4, 6]);
  assert.equal(betLine(base, mid, money), 'Preston v Tyler · $1 a hole · Holes 4–6');
  // The whole round saves no holes
  assert.equal(cleanBet(base, bet('hole', ['p', 'y'], 1, { holes: [1, 18] })).holes, undefined);
});

test('side bets feed the by-game table, the totals, the head to head and the fewest payments', () => {
  const plain = banker({ special: { 2: { p: 3 }, 5: { p: 4 }, 7: { y: 3 } } });
  let r = withBets(plain, bet('match', ['p', 'y'], 10), bet('ctp', ['z', 'p'], 2));
  r = setBetWinner(r, 'ctp-zp', 3, 'z');
  const res = roundResults(r);
  const main = gameResults(plain);
  assert.deepEqual(Object.keys(res.detail.byGame), ['main', 'bets']);
  assert.equal(res.detail.byGame.bets.label, BETS_LABEL);
  assert.deepEqual(res.detail.byGame.bets.balances, { t: 0, p: 8, y: -10, z: 2 });
  for (const id of ['t', 'p', 'y', 'z']) assert.equal(cents(res.balances[id]), cents(main.balances[id] + res.detail.byGame.bets.balances[id]), id);
  assert.equal(sumCents(res.balances), 0);
  assert.equal(cents(res.pairs.p.y), cents(main.pairs.p.y + 10));
  assert.equal(cents(res.pairs.y.p), -cents(res.pairs.p.y));
  assert.equal(cents(res.pairs.z.p), cents(main.pairs.z.p + 2));
  assert.equal(cents(res.pairs.t.p), cents(main.pairs.t.p), 'Trevor has no bet with Preston');
  // The fewest payments square the new balances
  const owed = Object.fromEntries(Object.keys(res.balances).map(id => [id, 0]));
  for (const t of res.transfers) { owed[t.from] -= cents(t.amount); owed[t.to] += cents(t.amount); }
  for (const id of Object.keys(owed)) assert.equal(owed[id], cents(res.balances[id]));
  // The games line, the reveal and the live preview carry them
  assert.equal(gamesLine(res.detail.byGame, 'p'), `Banker ${money(main.balances.p, { sign: true })} · Side bets +$8`);
  assert.equal(gamesLine(res.detail.byGame, 't'), `Banker ${money(main.balances.t, { sign: true })}`, 'no bet, no side bets in the line');
  assert.equal(betMoneyText(r, res.detail.byGame.bets.detail.bets[0], money), 'Preston +$10');
  assert.equal(betMoneyText(r, { ...res.detail.byGame.bets.detail.bets[0], amount: -4 }, money), 'Tyler +$4');
  assert.equal(nextPos(r), 9, 'every hole is in: the last one');
  assert.equal(nextPos(banker({ upto: 4 })), 5);
  const steps = revealSteps(r, res).steps;
  assert.ok(steps.some(s => s.key === 'bet-match-py' && s.label === 'Match · Preston v Tyler' && s.amount === 10));
  assert.ok(steps.some(s => s.key === 'bet-ctp-zp' && s.amount === 2));
  const live = livePreview(r, r.holes[8]);
  assert.deepEqual(live.byGame.bets.balances, res.detail.byGame.bets.balances);
  // What hole 3 adds includes Zach's closest to the pin there
  const on3 = livePreview(r, r.holes[2]);
  const bare = livePreview(removeBet(r, 'ctp-zp'), r.holes[2]);
  assert.equal(cents(on3.delta.z), cents(bare.delta.z + 2));
  assert.equal(cents(on3.delta.p), cents(bare.delta.p - 2));
});

test('points rounds count side bets in points, the same numbers', () => {
  const r = withBets({ ...banker({ special: { 2: { p: 3 } } }), playFor: { kind: 'points' } }, bet('hole', ['p', 'y'], 2));
  const res = roundResults(r);
  assert.equal(res.detail.byGame.bets.balances.p, 2);
  assert.equal(betLine(r, r.bets[0], points), 'Preston v Tyler · 2 pts a hole');
});

test('a scramble keeps closest to the pin and custom bets, never a match or per-hole bet', () => {
  const r = { players: [{ id: 'a' }, { id: 'b' }], game: 'scramble', holes: [], bets: [bet('match', ['a', 'b'], 5), bet('ctp', ['a', 'b'], 5), bet('custom', ['a', 'b'], 5)] };
  assert.deepEqual(betsOf(r).map(b => b.kind), ['ctp', 'custom']);
});

test('bets the app could never make are left out, so they move no money', () => {
  const plain = banker({ special: { 2: { p: 3 } } });
  const junk = { ...plain, bets: [
    null, 'x', { id: 'a', kind: 'poker', sides: ['p', 'y'], stake: 5 }, { id: 'b', kind: 'match', sides: ['p', 'p'], stake: 5 },
    { id: 'c', kind: 'match', sides: ['p', 'ghost'], stake: 5 }, { id: 'd', kind: 'match', sides: ['p', 'y'], stake: -5 },
    { id: 'e', kind: 'match', sides: ['p', 'y'], stake: '5' }, { id: 'f', kind: 'match', sides: ['p'], stake: 5 }, { kind: 'match', sides: ['p', 'y'], stake: 5 },
  ] };
  assert.deepEqual(betsOf(junk), []);
  assert.deepEqual(roundResults(junk), gameResults(plain));
  // The same id twice counts once
  const twice = { ...plain, bets: [bet('hole', ['p', 'y'], 1), bet('hole', ['p', 'y'], 1)] };
  assert.equal(betsOf(twice).length, 1);
});

test('a player who left: the holes after it don’t count in their bets', () => {
  const r = withBets(banker({ special: { 2: { p: 3 }, 6: { y: 2 }, 7: { y: 3 } } }), bet('hole', ['p', 'y'], 1));
  r.left = { y: 5 };
  // Holes 6 on aren't played by Tyler: only hole 2 counts
  for (const h of r.holes.slice(5)) delete r.scores[h.no].y;
  assert.equal(betResult(r, r.bets[0]).amount, 1);
  assert.equal(betsToTap(r, r.holes[5]).length, 0);
});

test('changing a bet keeps its winners unless the people in it change, and removing the last drops bets', () => {
  let r = withBets(banker(), bet('ctp', ['p', 'y'], 5));
  r = setBetWinner(r, 'ctp-py', 3, 'p');
  const more = changeBet(r, 'ctp-py', { ...r.bets[0], stake: 10 });
  assert.equal(betResult(more, more.bets[0]).amount, 10);
  const other = changeBet(r, 'ctp-py', { ...r.bets[0], sides: ['p', 'z'] });
  assert.equal(other.bets[0].winners, undefined);
  const gone = removeBet(r, 'ctp-py');
  assert.equal('bets' in gone, false);
  assert.deepEqual(roundResults(gone), gameResults(banker()));
  assert.equal(r.bets.length, 1, '`round` is not changed');
});

test('suggested strokes come from the two course handicaps', () => {
  const r = banker({ hc: true, idx: { t: 5, p: 2, y: 9, z: 10 } });
  const s = suggestedStrokes(r, 'p', 'y');
  assert.equal(s.to, 'y');
  assert.equal(s.count, Math.round(r.players[2].courseHc - r.players[1].courseHc));
  assert.equal(suggestedStrokes(banker(), 'p', 'y'), null, 'no handicaps, no suggestion');
});

test('side bets ride in the live round record and come back the same', () => {
  let r = withBets(banker({ special: { 2: { p: 3 } } }), bet('match', ['p', 'y'], 10, { strokes: { to: 'y', count: 2 } }), bet('ctp', ['p', 'z'], 2));
  r = setBetWinner(r, 'ctp-pz', 3, 'z');
  const meta = buildMeta(r);
  assert.deepEqual(meta.bets, r.bets);
  const back = assemble(JSON.parse(JSON.stringify(meta)), JSON.parse(JSON.stringify(buildHoles(r))));
  assert.deepEqual(roundResults(back), roundResults(r));
});

test('old rounds (no bets) give exactly the money they always did, and an empty list changes nothing', () => {
  const rounds = oldRounds(300, 2026);
  for (const { name, round } of rounds) {
    assert.deepEqual(moneyOf(round), SNAPSHOT[name], name);
    assert.deepEqual(moneyOf({ ...round, bets: [] }), SNAPSHOT[name], `${name} with an empty list`);
  }
});

test('on old rounds a bet adds exactly its own money and every breakdown adds up to the pair', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  for (const { name, round } of oldRounds(120, 99)) {
    const ids = round.players.map(p => p.id);
    if (ids.length < 2) continue;
    let r = structuredClone(round);
    const kinds = r.game === 'scramble' ? ['ctp', 'custom'] : ['match', 'hole', 'ctp', 'custom'];
    for (let k = 0; k < 3; k++) {
      const a = pick(ids); const b = pick(ids.filter(x => x !== a));
      const kind = pick(kinds);
      const from = 1 + Math.floor(rnd() * r.holes.length);
      r = addBet(r, { id: `x${k}`, kind, sides: [a, b], stake: pick([1, 2, 5, 10, 2.5]), holes: [from, r.holes.length], label: 'Longest drive', strokes: rnd() < 0.5 ? { to: pick([a, b]), count: Math.floor(rnd() * 6) } : undefined });
      if (kind === 'ctp') for (const h of r.holes) if (h.par === 3 && rnd() < 0.6) r = setBetWinner(r, `x${k}`, h.no, pick([a, b]));
      if (kind === 'custom' && rnd() < 0.7) r = setBetWinner(r, `x${k}`, r.holes[0].no, pick([a, b]));
    }
    const before = roundResults(round), after = roundResults(r);
    const bets = betsMoney(r);
    assert.equal(sumCents(after.balances), 0, name);
    for (const id of ids) assert.equal(cents(after.balances[id]), cents(before.balances[id]) + cents(bets.balances[id]), `${name} ${id}`);
    // Every game but the bets keeps its money
    for (const [k, g] of Object.entries(before.detail.byGame || { main: { balances: before.balances } })) {
      assert.deepEqual(after.detail.byGame[k].balances, Object.fromEntries(ids.map(id => [id, g.balances[id] || 0])), `${name} ${k}`);
    }
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      assert.equal(cents(after.pairs[a][b]), cents(-after.pairs[b][a]), `${name} ${a}/${b} both ways`);
      const bd = pairBreakdown(r, a, b, after);
      assert.equal(bd.items.reduce((s, x) => s + cents(x.amount), 0), cents(after.pairs[a][b]), `${name} ${a}/${b} breakdown`);
      const old = pairBreakdown(round, a, b, before);
      assert.equal(old.items.reduce((s, x) => s + cents(x.amount), 0), cents(before.pairs[a][b]), `${name} ${a}/${b} old breakdown`);
    }
  }
});

test('where each amount comes from in one round: by game and by side bet, from your side', () => {
  const plain = banker({ special: { 2: { p: 3 }, 5: { p: 4 }, 7: { y: 3 } } });
  let r = withBets(plain, bet('match', ['p', 'y'], 10), bet('ctp', ['y', 'p'], 2));
  r = setBetWinner(r, 'ctp-yp', 3, 'p');
  const bd = pairBreakdown(r, 'y', 'p');
  const main = gameResults(plain).pairs.y.p;
  assert.deepEqual(bd.items.map(x => [x.label, x.amount]), [['Banker', main], ['Match', -10], ['Closest to the pin', -2]]);
  assert.equal(cents(bd.total), cents(main - 12));
  assert.equal(breakdownLine(bd.items, money), `${main ? `${money(main, { sign: true })} Banker, ` : ''}−$10 Match, −$2 Closest to the pin`);
  // Trevor and Zach have no bet: just the game
  assert.deepEqual(pairBreakdown(r, 't', 'z').items.map(x => x.label), ['Banker']);
  // A round with one game only
  assert.deepEqual(pairBreakdown(plain, 'p', 'y').items, [{ key: 'main', group: 'game:banker', label: 'Banker', amount: gameResults(plain).pairs.p.y }]);
  assert.equal(breakdownLine([{ label: 'Banker', amount: 0 }], money), 'All square');
});

test('where it comes from across rounds on the Tab: one person whatever their id, payments taken off', () => {
  // Two finished rounds with Zach: one under his own id, one under a seat that's linked to him
  const r1 = withBets(banker({ special: { 2: { z: 3 } } }), bet('ctp', ['t', 'z'], 2));
  const one = { ...setBetWinner(r1, 'ctp-tz', 3, 't'), id: 'r1', status: 'done', finishedAt: 1000 };
  const r2 = banker({ special: { 4: { t: 3 } } });
  r2.players = r2.players.map(p => (p.id === 'z' ? { ...p, id: 'z2' } : p));
  for (const h of r2.holes) {
    const s = r2.scores[h.no]; if (s) { s.z2 = s.z; delete s.z; }
    const bk = r2.banker[h.no]; if (bk) { if (bk.banker === 'z') bk.banker = 'z2'; if ('z' in bk.bets) { bk.bets.z2 = bk.bets.z; delete bk.bets.z; } }
  }
  const two = { ...withBets(r2, bet('match', ['z2', 't'], 5)), id: 'r2', status: 'done', finishedAt: 2000 };
  const pts = { ...banker({ special: { 1: { z: 2 } } }), id: 'r3', status: 'done', finishedAt: 3000, playFor: { kind: 'points' } };
  const state = {
    me: 't', players: { t: { name: 'Trevor N' }, z: { name: 'Zach' } }, links: { z2: 'z' },
    rounds: { r1: one, r2: two, r3: pts }, settlements: [{ id: 's', from: 'z', to: 't', amount: 3, at: 2500 }],
  };
  const w = breakdownWith(state, new Set(['t']), 'z2');
  assert.deepEqual(w.rounds.map(x => x.round.id), ['r2', 'r1'], 'newest first, the points round left out');
  const h2h1 = roundResults(one).pairs.t.z, h2h2 = roundResults(two).pairs.t.z2;
  assert.equal(cents(w.net), cents(h2h1 + h2h2));
  assert.equal(w.paid, 3);
  assert.equal(cents(w.open), cents(h2h1 + h2h2 - 3));
  // The totals add each game and kind of bet across the rounds
  const total = Object.fromEntries(w.totals.map(t => [t.label, t.amount]));
  assert.equal(total['Closest to the pin'], 2);
  assert.equal(cents(total.Banker), cents(roundResults(one).detail.byGame.main.pairs.t.z + gameResults(r2).pairs.t.z2));
  assert.equal(w.totals.reduce((s, t) => s + cents(t.amount), 0), cents(w.net));
  // The Tab and the person's story see the same money as before the bets were split out
  assert.equal(cents(personStory(state, new Set(['t']), 'z').net), cents(w.net));
  assert.equal(sumCents(tabBalances(state)), 0);
  // The season counts side bets on a line of their own
  const season = seasonBoard({ ...state, rounds: { r1: { ...one, finishedAt: Date.UTC(2026, 5, 1) } } }, 2026);
  assert.equal(season.rounds, 1);
});

test('the rules card lists side bets, notes one added or changed mid-round, and never a tapped winner', () => {
  const r0 = withBets(banker({ holes: 18, upto: 0 }), bet('ctp', ['p', 'z'], 2));
  const items = agreementItems(r0).filter(x => x.id.startsWith('bet:pair:'));
  assert.deepEqual(items.map(x => [x.label, x.text]), [['Closest to the pin, Preston v Zach', '$2 a par 3']]);
  let r = { ...r0, agreed: lockAgreement(r0, {}, 't', 1) };
  // Played to hole 9, then a match from hole 10, then a closest-to-the-pin tap
  r = { ...r, ...banker({ holes: 18, upto: 9 }), bets: r.bets, agreed: r.agreed };
  r = withBets(r, bet('match', ['p', 'y'], 10, { holes: [10, 18] }));
  const a1 = noteChanges(r, 2);
  assert.deepEqual(a1.changes.map(c => c.text), ['Match, Preston v Tyler added: $10 match · From hole 10']);
  r = { ...r, agreed: a1 };
  r = setBetWinner(r, 'ctp-pz', 3, 'p');
  assert.equal(noteChanges(r, 3), null);
  r = changeBet(r, 'match-py', { ...r.bets[1], stake: 20 });
  assert.equal(noteChanges(r, 4).changes.at(-1).text, 'Match, Preston v Tyler raised to $20 match');
  // Points rounds read in points
  assert.equal(agreementItems({ ...r0, playFor: { kind: 'points' } }).find(x => x.id.startsWith('bet:pair:')).text, '2 pts a par 3');
});

test('changing a bet to the whole round or to no strokes takes the old holes and strokes off', () => {
  let r = withBets(banker({ holes: 18 }), bet('match', ['p', 'y'], 10, { holes: [4, 18], strokes: { to: 'y', count: 2 } }));
  // The editor hands over the whole bet as it is now: a whole-round bet with no strokes has neither field
  const edited = cleanBet(r, { ...r.bets[0], holes: [1, 18], strokes: undefined });
  assert.equal('holes' in edited, false);
  r = changeBet(r, 'match-py', edited);
  assert.equal('holes' in r.bets[0], false, 'back to the whole round');
  assert.equal('strokes' in r.bets[0], false, 'no strokes any more');
  assert.equal(betLine(r, r.bets[0], money), 'Preston v Tyler · $10 match');
  // A custom bet changed to a match drops its name and its winner
  let c = withBets(banker(), bet('custom', ['p', 'y'], 5, { label: 'Longest drive' }));
  c = setBetWinner(c, 'custom-py', 2, 'p');
  c = changeBet(c, 'custom-py', cleanBet(c, { id: 'custom-py', kind: 'match', sides: ['p', 'y'], stake: 5 }));
  assert.deepEqual(c.bets[0], { id: 'custom-py', kind: 'match', sides: ['p', 'y'], stake: 5 });
});

test('the front and back nine follow hole numbers, so a round that starts on 10 has its front nine second', () => {
  const r = banker({ holes: 18, upto: 0 });
  assert.deepEqual(nineRange(r, 'front'), [1, 9]);
  assert.deepEqual(nineRange(r, 'back'), [10, 18]);
  const from10 = { ...r, holes: [...r.holes.slice(9), ...r.holes.slice(0, 9)] };
  assert.deepEqual(nineRange(from10, 'front'), [10, 18]);
  assert.deepEqual(nineRange(from10, 'back'), [1, 9]);
  const b = cleanBet(from10, bet('match', ['p', 'y'], 5, { holes: nineRange(from10, 'front') }));
  assert.equal(betLine(from10, b, money), 'Preston v Tyler · $5 match · From hole 1');
  assert.equal(nineRange(banker(), 'back'), null, 'a nine-hole round on the front has no back nine');
});

test('the season counts side bets as a game only in rounds you had a bet in', () => {
  const at = Date.UTC(2026, 5, 1);
  const theirs = { ...withBets(banker({ special: { 2: { p: 3 } } }), bet('hole', ['p', 'y'], 5)), id: 'a', status: 'done', finishedAt: at };
  const mine = { ...withBets(banker({ special: { 2: { t: 3 } } }), bet('hole', ['t', 'y'], 5)), id: 'b', status: 'done', finishedAt: at + 1 };
  const state = { me: 't', players: { t: { name: 'Trevor N' } }, rounds: { a: theirs }, settlements: [] };
  assert.equal(seasonBoard(state, 2026).bestGame?.name === BETS_LABEL, false);
  const both = seasonBoard({ ...state, rounds: { a: theirs, b: mine } }, 2026);
  assert.equal(both.rounds, 2);
  // Trevor won hole 2 off Tyler in round b: $5 in side bets, from the one round he had a bet in
  const sideNet = roundResults(mine).detail.byGame.bets.balances.t;
  assert.equal(sideNet, 5);
});
