// Closest to the pin and long drive pots (ROADMAP area 5): side games where everyone puts in and the
// winner on each pot hole takes its share. Money first, then the words, then old rounds keep their money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRound, roundResults, gameView, potTable, potHoles, potHolesDefault, sideGameChoices, sideGamesOf, livePreview,
  joinGames, joinRule, leftRule, addPlayerToRound, wholeRoundOnly, changeBets, greeniesInPot, gameResults, POT_NONE,
} from './round.js';
import { optionsProblem, roundStakeLines, sideBetLine } from './stakes.js';
import { potHolesLine, potUnclaimedLine, sideExample, gamesLine } from './side-games.js';
import { revealSteps } from './reveal.js';
import { agreementItems } from './agreed.js';
import { pairBreakdown } from './where-from.js';
import { gameLabel } from './format.js';
import { minimalTransfers } from './golf.js';
import { oldRounds } from './overnight5-money.fixtures.js';

// Par 4, 3, 5 repeating: par 3s are 2, 5, 8, 11, 14, 17 and par 5s are 3, 6, 9, 12, 15, 18
const course = (n = 18, pars = [4, 3, 5]) => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: pars[i % pars.length], hdcp: i + 1 })) });
const SETTINGS = {
  hcPct: 100,
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 },
  dots: { value: 1, auto: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true } },
  bbb: { value: 1 },
  stroke: { stake: 5, payout: 'pot' },
  ctp: { stake: 5, unclaimed: 'carry' },
  drive: { stake: 5, unclaimed: 'carry' },
};
const cents = v => Math.round(v * 100);
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);

/** A round of `game` for players a..d (no handicaps), with pots as side games and scores on the first `upto` holes. */
function make({ game = 'stroke', pots = [{ game: 'ctp', settings: { stake: 5, unclaimed: 'carry' } }], n = 4, holes = 18, upto = 0, pars } = {}) {
  const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, n);
  const r = createRound({
    id: 'r', game, course: course(holes, pars), holesCount: holes, nine: 'front', players: ids.map(id => ({ id, name: `${id.toUpperCase()}nn Smith`, index: 10 })),
    settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false,
  });
  r.sideGames = structuredClone(pots);
  for (const h of r.holes.slice(0, upto)) r.scores[h.no] = Object.fromEntries(ids.map(id => [id, h.par]));
  return r;
}
const tap = (r, key, winners) => { for (const [no, pid] of Object.entries(winners)) r.marks[no] = { ...(r.marks[no] || {}), [key]: pid }; return r; };

test('closest to the pin: each par 3 is a share of the pot and its winner takes it', () => {
  const r = make({ upto: 18 });
  // $5 each from 4 players is $20 over 6 par 3s: $3.33 a par 3
  tap(r, 'ctp', { 2: 'a', 5: 'a', 8: 'b', 11: 'c', 14: 'a', 17: 'b' });
  const t = potTable(gameView(r, 'ctp'));
  assert.equal(t.pot, 20);
  assert.deepEqual(t.holes.map(h => h.no), [2, 5, 8, 11, 14, 17]);
  assert.equal(Math.round(t.worth * 100), 333);
  const g = roundResults(r).detail.byGame.ctp;
  assert.equal(g.label, 'Closest to the pin');
  // a took 3 shares ($10), b 2 ($6.67), c 1 ($3.33); everyone paid $5
  assert.deepEqual(g.balances, { a: 5, b: 1.67, c: -1.67, d: -5 });
  assert.equal(sumCents(g.balances), 0);
});

test('carry: a par 3 nobody wins rolls to the next one, and a carry left at the end goes back to everyone', () => {
  const r = make({ upto: 18 });
  tap(r, 'ctp', { 2: POT_NONE, 5: 'b', 8: POT_NONE, 11: POT_NONE, 14: 'c', 17: POT_NONE });
  const t = potTable(gameView(r, 'ctp'));
  const by = Object.fromEntries(t.holes.map(h => [h.no, h]));
  assert.equal(cents(by[5].value), cents(t.worth * 2));
  assert.equal(cents(by[5].carried), cents(t.worth));
  assert.equal(cents(by[14].value), cents(t.worth * 3));
  // Hole 17 nobody won: its share goes back, so only 5 shares were paid out
  assert.equal(cents(t.handedBack), cents(t.worth));
  assert.equal(cents(t.paidOut), cents(t.worth * 5));
  const b = roundResults(r).detail.byGame.ctp.balances;
  // Each paid 5 shares / 4 = $4.17; b took 2 shares ($6.67), c took 3 ($10)
  assert.deepEqual(b, { a: -4.16, b: 2.5, c: 5.83, d: -4.17 });
  assert.equal(sumCents(b), 0);
});

test('split: the shares nobody won are split across the holes that were won', () => {
  const r = make({ upto: 18, pots: [{ game: 'ctp', settings: { stake: 5, unclaimed: 'split' } }] });
  tap(r, 'ctp', { 2: 'a', 5: POT_NONE, 8: POT_NONE, 11: 'b', 14: POT_NONE, 17: POT_NONE });
  const b = roundResults(r).detail.byGame.ctp.balances;
  // The whole $20 pot over the 2 holes won: $10 each to a and b
  assert.deepEqual(b, { a: 5, b: 5, c: -5, d: -5 });
});

test('nobody wins anything: nobody pays, and a pot hole with nothing saved for it doesn’t count', () => {
  const r = make({ upto: 18 });
  tap(r, 'ctp', { 2: POT_NONE, 5: POT_NONE, 8: POT_NONE, 11: POT_NONE, 14: POT_NONE, 17: POT_NONE });
  assert.deepEqual(roundResults(r).detail.byGame.ctp.balances, { a: 0, b: 0, c: 0, d: 0 });
  const t = potTable(gameView(r, 'ctp'));
  assert.ok(t.holes.every(h => h.reached && h.winner === POT_NONE));
  // A pot added after the front nine: its par 3s there count only once tapped, never as one big carry
  const late = make({ upto: 12 });
  tap(late, 'ctp', { 11: 'a' });
  const lt = potTable(gameView(late, 'ctp'));
  assert.deepEqual(lt.holes.filter(h => h.reached).map(h => h.no), [11]);
  assert.equal(cents(lt.paidOut), cents(lt.worth));
  const steps = revealSteps(r, roundResults(r)).steps;
  assert.deepEqual(steps.find(s => s.key === 'side-ctp'), { key: 'side-ctp', label: 'Closest to the pin', text: 'Nobody won a par 3, nobody pays', tie: true });
});

test('only the pot holes reached count: a round stopped after 9 pays the front nine’s shares', () => {
  const r = make({ upto: 9 });
  tap(r, 'ctp', { 2: 'a', 5: 'a', 8: 'b' });
  const t = potTable(gameView(r, 'ctp'));
  assert.deepEqual(t.holes.filter(h => h.reached).map(h => h.no), [2, 5, 8]);
  assert.ok(t.holes.filter(h => !h.reached).every(h => h.winner === undefined));
  // 3 shares of $3.33 paid out, each pays $2.50: a +$4.17, b +$0.83
  assert.deepEqual(roundResults(r).detail.byGame.ctp.balances, { a: 4.17, b: 0.83, c: -2.5, d: -2.5 });
  // A winner tapped before the scores are in counts the hole too
  tap(r, 'ctp', { 11: 'c' });
  assert.ok(potTable(gameView(r, 'ctp')).holes.find(h => h.no === 11).reached);
});

test('long drive: every par 5 until holes are picked, the picked ones after, and par 4s on a course with no par 5', () => {
  const r = make({ pots: [{ game: 'drive', settings: { stake: 5, unclaimed: 'carry' } }], upto: 18 });
  const v = gameView(r, 'drive');
  assert.deepEqual(potHoles(v, 'drive').map(h => h.no), [3, 6, 9, 12, 15, 18]);
  assert.ok(potHolesDefault(v, 'drive'));
  r.sideGames[0].settings.holes = [1, 18, 40];
  const v2 = gameView(r, 'drive');
  assert.deepEqual(potHoles(v2, 'drive').map(h => h.no), [1, 18]);
  assert.ok(!potHolesDefault(v2, 'drive'));
  tap(r, 'drive', { 1: 'd', 18: 'd' });
  assert.deepEqual(roundResults(r).detail.byGame.drive.balances, { a: -5, b: -5, c: -5, d: 15 });
  const fours = make({ pots: [{ game: 'drive', settings: { stake: 5 } }], pars: [4, 3, 4], holes: 9 });
  assert.deepEqual(potHoles(gameView(fours, 'drive'), 'drive').map(h => h.no), [1, 3, 4, 6, 7, 9]);
  assert.equal(potHolesLine('drive', {}, fours.holes), 'Every par 4 (6 of them)');
  assert.equal(potHolesLine('drive', { holes: [1, 18] }, r.holes), 'Holes 1 and 18');
  assert.equal(potHolesLine('ctp', {}, r.holes), 'Every par 3 (6 of them)');
  assert.equal(potHolesLine('ctp', {}, make({ pars: [4, 5] }).holes), 'No par 3s on this course');
});

test('both pots in one round with a main game: everything adds up, zero-sum, with honest head to heads', () => {
  const r = make({ game: 'skins', upto: 18, pots: [{ game: 'ctp', settings: { stake: 5 } }, { game: 'drive', settings: { stake: 10, unclaimed: 'split' } }] });
  for (const h of r.holes) r.scores[h.no].a = h.par - (h.no % 4 === 0 ? 1 : 0);
  tap(r, 'ctp', { 2: 'b', 5: 'c', 8: POT_NONE, 11: 'b' });
  tap(r, 'drive', { 3: 'a', 6: 'd', 9: POT_NONE });
  const res = roundResults(r);
  const by = res.detail.byGame;
  assert.deepEqual(Object.keys(by), ['main', 'ctp', 'drive']);
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(cents(res.balances[id]), cents(by.main.balances[id]) + cents(by.ctp.balances[id]) + cents(by.drive.balances[id]));
  assert.equal(sumCents(res.balances), 0);
  for (const a of ['a', 'b', 'c', 'd']) {
    const owed = Object.values(res.pairs[a]).reduce((x, v) => x + cents(v), 0);
    assert.equal(owed, cents(res.balances[a]), `pairs add up for ${a}`);
  }
  // The settle-up squares everyone in the fewest payments
  assert.deepEqual(res.transfers, minimalTransfers(res.balances));
  // Where it comes from names each pot
  const items = pairBreakdown(r, 'b', 'a', res).items;
  assert.deepEqual(items.map(x => x.label), ['Skins', 'Closest to the pin', 'Long drive']);
  assert.equal(gamesLine(by, 'b'), `Skins ${'−'}$${Math.abs(by.main.balances.b)} · Closest to the pin +$${by.ctp.balances.b} · Long drive ${by.drive.balances.b < 0 ? '−' : '+'}$${Math.abs(by.drive.balances.b)}`.replace('−$0', '$0'));
  assert.equal(gameLabel(r), 'Skins + Closest to the pin + Long drive');
});

test('the pot is for the players who started: a late joiner or someone who left is out of it, and can’t win it', () => {
  let r = make({ n: 3, upto: 4 });
  r = addPlayerToRound(r, { id: 'late', name: 'Late Larry', index: 12 }, 5, ['main']);
  assert.deepEqual(joinGames(r, 'Larry', 5).find(g => g.key === 'ctp'), { key: 'ctp', label: 'Closest to the pin', on: false, disabled: true, reason: 'The pot is for the players who started.' });
  for (const h of r.holes.slice(4)) r.scores[h.no] = { a: h.par, b: h.par, c: h.par, late: h.par };
  r.left = { c: 14 };
  tap(r, 'ctp', { 2: 'a', 5: 'late', 8: 'c', 11: 'b' });
  const t = potTable(gameView(r, 'ctp'));
  assert.deepEqual(t.inPot, ['a', 'b']);
  // Larry and c can't take a share: those holes go to nobody (and carry)
  assert.equal(t.holes.find(h => h.no === 5).winner, POT_NONE);
  assert.equal(t.holes.find(h => h.no === 8).winner, POT_NONE);
  const b = roundResults(r).detail.byGame.ctp.balances;
  assert.equal(b.late, 0);
  assert.equal(b.c, 0);
  assert.equal(sumCents(b), 0);
  assert.match(joinRule(r, 'late'), /They sit out the closest to the pin pot\./);
  assert.match(leftRule(make(), 'a'), /They’re out of the closest to the pin pot\./);
  const two = make({ pots: [{ game: 'birdies', settings: { stake: 5, eagleShares: 2 } }, { game: 'ctp', settings: { stake: 5 } }] });
  assert.match(leftRule(two, 'a'), /They’re out of the birdie pot and closest to the pin pot\./);
});

test('with fewer than two in the pot, or no stake, nothing moves', () => {
  const r = make({ n: 2, upto: 18 });
  r.left = { b: 3 };
  tap(r, 'ctp', { 2: 'a', 5: 'a' });
  assert.deepEqual(roundResults(r).detail.byGame.ctp.balances, { a: 0, b: 0 });
  const z = make({ upto: 18, pots: [{ game: 'ctp', settings: { stake: 0 } }] });
  tap(z, 'ctp', { 2: 'a' });
  assert.deepEqual(roundResults(z).detail.byGame.ctp.balances, { a: 0, b: 0, c: 0, d: 0 });
  assert.equal(optionsProblem('ctp', { ctp: { stake: 0 } }), 'Each player has to put something in the pot.');
  assert.equal(optionsProblem('drive', { drive: { stake: 5 } }), null);
});

test('tapping the winner on the hole shows in the live money, carry included', () => {
  const r = make({ upto: 4 });
  tap(r, 'ctp', { 2: POT_NONE });
  const h5 = r.holes[4];
  const scores = { a: 3, b: 3, c: 3, d: 3 };
  const p = livePreview(r, h5, { scores, marks: { ctp: 'c' } });
  // Hole 5 is worth its share plus hole 2's carry: 2 shares of $3.33, each pays $1.67
  assert.deepEqual(p.byGame.ctp.balances, { a: -1.66, b: -1.67, c: 5, d: -1.67 });
  assert.equal(cents(p.delta.c), 500);
  // Nobody on hole 5: nothing moves yet, the carry grows
  assert.deepEqual(livePreview(r, h5, { scores, marks: { ctp: POT_NONE } }).byGame.ctp.balances, { a: 0, b: 0, c: 0, d: 0 });
});

test('no paying twice for being closest: no pot with Dots or Bingo Bango Bongo, and Junk’s greenies are off next to one', () => {
  assert.ok(!sideGameChoices('dots').includes('ctp'));
  assert.ok(!sideGameChoices('bbb').includes('ctp'));
  assert.ok(sideGameChoices('dots').includes('drive'));
  assert.ok(sideGameChoices('nassau', [{ game: 'dots' }]).includes('ctp'));
  assert.ok(!sideGameChoices('nassau', [{ game: 'ctp' }]).includes('ctp'));
  // A hand-made round can't have one either
  assert.deepEqual(sideGamesOf({ game: 'bbb', sideGames: [{ game: 'ctp', settings: {} }, { game: 'drive', settings: {} }] }).map(sg => sg.game), ['drive']);
  assert.deepEqual(sideGamesOf({ game: 'dots', sideGames: [{ game: 'ctp', settings: {} }] }).map(sg => sg.game), []);
  // Junk with a closest to the pin pot: a greenie pays nothing in Junk, the pot pays for it
  const r = make({ game: 'nassau', upto: 18, pots: [{ game: 'dots', settings: structuredClone(SETTINGS.dots) }, { game: 'ctp', settings: { stake: 5 } }] });
  r.marks[2] = { a: ['greenie', 'sandy'], ctp: 'a' };
  assert.ok(greeniesInPot(r));
  const junk = roundResults(r).detail.byGame.dots.balances;
  assert.deepEqual(junk, { a: 3, b: -1, c: -1, d: -1 }); // the sandy only
  assert.equal(gameView(r, 'dots').settings.dots.kinds.greenie, false);
  // The round's Junk settings are untouched, so taking the pot off brings the greenies back
  assert.equal(r.sideGames[0].settings.kinds.greenie, true);
  const without = { ...r, sideGames: [r.sideGames[0]] };
  assert.ok(!greeniesInPot(without));
  assert.deepEqual(roundResults(without).detail.byGame.dots.balances, { a: 6, b: -2, c: -2, d: -2 });
  // A Junk bet changed mid-round keeps its greenies off on the earlier holes too
  const changed = changeBets(r, { ...r.sideGames[0].settings, value: 2 }, 5, 'dots');
  assert.ok(changed.sideGames[0].betHistory?.length);
  assert.equal(gameView(changed, 'dots').betHistory[0].settings.kinds.greenie, false);
  assert.deepEqual(roundResults(changed).detail.byGame.dots.balances, { a: 3, b: -1, c: -1, d: -1 });
  // The first-tee card says so
  assert.ok(agreementItems(r).some(x => x.id === 'rule:dots:greenie' && x.on));
});

test('a pot always covers the whole round: a bet change reprices every hole', () => {
  assert.ok(wholeRoundOnly('ctp', { stake: 5 }, { stake: 10 }));
  assert.ok(wholeRoundOnly('drive', { stake: 5 }, { stake: 10 }));
  const r = make({ upto: 18 });
  tap(r, 'ctp', { 2: 'a' });
  const next = changeBets(r, { stake: 10, unclaimed: 'carry' }, 10, 'ctp');
  assert.equal(next.sideGames[0].betHistory, undefined);
  // $10 each is a $40 pot over 6 par 3s: a takes $6.67 of the $6.67 paid out, each paid $1.67
  assert.deepEqual(roundResults(next).detail.byGame.ctp.balances, { a: 5, b: -1.66, c: -1.67, d: -1.67 });
});

test('the words: bet lines, worked examples, reveal steps and the first-tee card', () => {
  assert.equal(sideBetLine('ctp', { stake: 5 }), '$5 each in the pot');
  assert.equal(sideBetLine('drive', { stake: 2 }), '$2 each in the pot');
  const r = make({ upto: 18, pots: [{ game: 'ctp', settings: { stake: 5 } }, { game: 'drive', settings: { stake: 5, unclaimed: 'split', holes: [18] } }] });
  assert.deepEqual(roundStakeLines(r).slice(1), [{ key: 'ctp', line: '$5 each in the pot' }, { key: 'drive', line: '$5 each in the pot' }]);
  assert.equal(sideExample('ctp', { stake: 5 }, 4, r.holes), 'Each player puts in $5, so the pot is $20. Closest to the pin on each par 3 takes $3.33, one of 6 shares. A par 3 nobody wins carries to the next one. Still carried after the last, it goes back to everyone.');
  assert.equal(sideExample('drive', { stake: 5, holes: [18] }, 4, r.holes), 'Each player puts in $5, so the pot is $20. The longest drive in the fairway on each long drive hole takes the whole pot. A long drive hole nobody wins carries to the next one. Still carried after the last, it goes back to everyone.');
  // Before a course is picked it can't count the holes
  assert.match(sideExample('ctp', { stake: 5 }, 3), /takes that hole’s share\./);
  assert.equal(potUnclaimedLine('ctp', { unclaimed: 'split' }), 'A par 3 nobody wins is split across the holes that were won.');
  tap(r, 'ctp', { 2: 'b', 8: 'b', 11: 'a' });
  tap(r, 'drive', { 18: 'c' });
  const steps = revealSteps(r, roundResults(r)).steps;
  assert.equal(steps.find(s => s.key === 'side-ctp').text, 'Bnn was closest on holes 2 and 8');
  assert.equal(steps.find(s => s.key === 'side-drive').text, 'Cnn had the long drive on hole 18');
  assert.equal(steps.find(s => s.key === 'side-drive').amount, 15);
  const card = agreementItems(r);
  assert.ok(card.some(x => x.id === 'rule:ctp:carry' && x.on && x.text === 'A par 3 nobody wins carries to the next'));
  assert.ok(card.some(x => x.id === 'rule:drive:split' && x.on));
  assert.ok(card.some(x => x.id === 'rule:ctp:holes' && x.text === 'Every par 3 (6 of them)'));
  assert.ok(card.some(x => x.id === 'rule:drive:holes' && x.text === 'Hole 18'));
  // A points round reads in points
  const pts = { ...r, playFor: { kind: 'points' } };
  assert.deepEqual(roundStakeLines(pts).slice(1).map(l => l.line), ['5 pts each in the pot', '5 pts each in the pot']);
});

test('old rounds keep their money: a pot key in a hole’s marks moves nothing, and a pot only adds its own money', () => {
  for (const { name, round } of oldRounds(160, 2026)) {
    const before = roundResults(round);
    // A stray pot mark on a round without a pot changes nothing
    const marked = structuredClone(round);
    for (const h of marked.holes) marked.marks[h.no] = { ...(marked.marks[h.no] || {}), ctp: marked.players[0].id, drive: marked.players[0].id };
    assert.deepEqual(roundResults(marked).balances, before.balances, `${name}: stray pot marks`);
    // The same round with a long drive pot added: every other game's money is exactly what it was
    const sgs = sideGamesOf(round);
    if (round.game === 'scramble' || sgs.length >= 3) continue;
    const plus = { ...marked, sideGames: [...sgs, { game: 'drive', settings: { stake: 5, unclaimed: 'carry' } }] };
    const after = roundResults(plus);
    const games = before.detail.byGame || { main: { balances: before.balances } };
    for (const [key, g] of Object.entries(games)) {
      for (const p of round.players) assert.equal(cents(after.detail.byGame[key].balances[p.id] || 0), cents(g.balances[p.id] || 0), `${name}: ${key} for ${p.id}`);
    }
    const pot = gameResults(gameView(plus, 'drive')).balances;
    for (const p of round.players) assert.equal(cents(after.balances[p.id]), cents(before.balances[p.id]) + cents(pot[p.id] || 0), `${name}: total for ${p.id}`);
  }
});
