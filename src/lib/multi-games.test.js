// Several games at once: a main game plus up to two side games (Skins, Junk, Birdie pot).
// Old rounds (one game, no sideGames) must show exactly the money they always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sideGamesOf,   createRound, roundResults, gameResults, gameView, livePreview, changeBets, GAMES, SIDE_GAMES,
  sideGameChoices, gameKeys, birdiePotShares, MAX_GAMES,
} from './round.js';
import { birdiePot, birdieShares } from './games.js';
import { minimalTransfers } from './golf.js';
import { REV2_DEFAULTS } from './settings.js';
import { gameLabel, shareText } from './format.js';
import { roundStakeLines, sideBetLine, optionsProblem } from './stakes.js';
import { revealSteps } from './reveal.js';
import { buildMeta, assemble } from './sync-model.js';
import { rematchSetup } from './rematch.js';
import { sideExample, gamesLine, nassauOpenNote } from './side-games.js';
import { joinRule, leftRule, resizeRound, addPlayerToRound } from './round.js';
import { shareCardModel } from './shareImage.js';
import { joinPreview } from './og.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2 },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'pot' },
  stableford: { ...REV2_DEFAULTS.stableford },
  quota: { ...REV2_DEFAULTS.quota },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { ...REV2_DEFAULTS.rabbit },
  hammer: { stake: 5, max: 3, who: 'either' },
  snake: { stake: 5, growth: 'double', nines: false, cap: 4 },
  birdies: { stake: 5, eagleShares: 2 },
};
const SIDE_SETTINGS = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'split' },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  birdies: { stake: 5, eagleShares: 2 },
};
const course = n => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) });
const cents = v => Math.round(v * 100);
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);

/** A seeded round of `game` with scores (and marks where the game has them) on some holes. */
function fixture(game, rnd, { holes = 18, n = null } = {}) {
  const g = GAMES[game];
  const count = n ?? Math.max(g.min || 2, Math.min(g.max || 4, 2 + Math.floor(rnd() * 4)));
  const ids = Array.from({ length: count }, (_, i) => `p${i}`);
  const needsTeams = game === 'scramble' || game === 'vegas' || game === 'match';
  if (needsTeams && count % 2) return null;
  const teams = needsTeams || (g.teams && count === 4) ? [ids.slice(0, count / 2), ids.slice(count / 2)] : null;
  const r = createRound({
    id: 'r', game, course: course(holes), holesCount: holes, players: ids.map((id, i) => ({ id, name: `Player ${id}`, index: i * 5 })),
    settings: structuredClone(SETTINGS), hcPct: 90, useHandicaps: true, teams,
  });
  const scorers = game === 'scramble' ? r.teams.map(t => t.id) : ids;
  const upto = 1 + Math.floor(rnd() * holes);
  for (let i = 0; i < upto; i++) {
    const h = r.holes[i];
    r.scores[h.no] = Object.fromEntries(scorers.map(id => [id, h.par - 2 + Math.floor(rnd() * 5)]));
    const m = {};
    if (game === 'hammer' && rnd() < 0.4) m.hammers = [0];
    if (game === 'snake') m.snake = rnd() < 0.3 ? [ids[Math.floor(rnd() * ids.length)]] : [];
    if (game === 'bbb') { m.bingo = ids[0]; m.bango = ids[1]; m.bongo = ids[Math.floor(rnd() * ids.length)]; }
    if (game === 'dots' && rnd() < 0.5) m[ids[0]] = ['greenie'];
    if (Object.keys(m).length) r.marks[h.no] = m;
    if (game === 'banker') r.banker[h.no] = { banker: ids[i % ids.length], bets: Object.fromEntries(ids.filter((_, k) => k !== i % ids.length).map(id => [id, 5])), doubled: {}, doubleBack: false };
    if (game === 'wolf') r.wolf[h.no] = { wolf: ids[i % 4], partner: rnd() < 0.3 ? null : ids[(i + 1) % 4] };
  }
  return r;
}

const seeded = (seed = 11) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('old rounds: every game, with no side games, shows exactly the money it always did', () => {
  const rnd = seeded(3);
  for (const game of Object.keys(GAMES)) {
    for (let k = 0; k < 12; k++) {
      let r = fixture(game, rnd, { holes: k % 2 ? 9 : 18 });
      if (!r) continue;
      if (k % 3 === 0) r = changeBets(r, structuredClone(r.settings[game]), 2);
      assert.deepEqual(roundResults(r), gameResults(r), `${game} #${k}`);
      // An empty or unknown sideGames list is the same as none
      assert.deepEqual(roundResults({ ...r, sideGames: [] }), gameResults(r), `${game} #${k} empty`);
      assert.deepEqual(roundResults({ ...r, sideGames: [{ game: 'nope', settings: {} }] }), gameResults(r), `${game} #${k} unknown`);
    }
  }
});

test('every main game with each side game, and with two: balances sum to zero and the payments square everyone', () => {
  const rnd = seeded(29);
  const combos = [['skins'], ['dots'], ['birdies'], ['skins', 'dots'], ['skins', 'birdies'], ['dots', 'birdies']];
  let checked = 0;
  for (const game of Object.keys(GAMES)) {
    for (const combo of combos) {
      for (let k = 0; k < 4; k++) {
        const base = fixture(game, rnd, { holes: k % 2 ? 9 : 18 });
        if (!base) continue;
        const allowed = sideGameChoices(game, []);
        if (!combo.every(c => allowed.includes(c))) continue;
        const r = { ...base, sideGames: combo.map(g => ({ game: g, settings: structuredClone(SIDE_SETTINGS[g]) })) };
        // Some Junk dots on the side game, next to whatever marks the main game has
        if (combo.includes('dots')) for (const h of r.holes.slice(0, 3)) if (r.scores[h.no]) r.marks[h.no] = { ...(r.marks[h.no] || {}), p1: ['sandy'] };
        const res = roundResults(r);
        const ids = r.players.map(p => p.id);
        assert.equal(sumCents(res.balances), 0, `${game}+${combo}: ${JSON.stringify(res.balances)}`);
        for (const v of Object.values(res.balances)) assert.ok(Number.isInteger(Math.round(v * 1e6) / 1e4), `${game}: whole cents`);
        // By game adds up to the total (to the cent)
        assert.deepEqual(Object.keys(res.detail.byGame), ['main', ...combo]);
        for (const id of ids) {
          const parts = Object.values(res.detail.byGame).reduce((a, g) => a + cents(g.balances[id]), 0);
          assert.ok(Math.abs(parts - cents(res.balances[id])) <= combo.length + 1, `${game}+${combo} ${id}: ${parts} v ${res.balances[id]}`);
        }
        // Each game's own money is what the engine gives that game alone
        assert.deepEqual(res.detail.byGame.main.balances, Object.fromEntries(ids.map(id => [id, gameResults(base).balances[id]])));
        // The fewest payments square everyone
        const left = { ...res.balances };
        for (const t of res.transfers) { left[t.from] = cents(left[t.from]) / 100 + t.amount; left[t.to] = cents(left[t.to]) / 100 - t.amount; }
        for (const id of ids) assert.equal(cents(left[id]), 0, `${game}+${combo}: ${id} not square`);
        assert.ok(res.transfers.length <= ids.length - 1);
        // Head to head is antisymmetric
        for (const a of ids) for (const b of ids) if (a !== b) assert.equal(res.pairs[a][b], -res.pairs[b][a] || 0);
        checked++;
      }
    }
  }
  assert.ok(checked > 200, `checked ${checked}`);
});

test('the wireframe example: +17, -3, -5, -9 settles in 3 payments', () => {
  const t = minimalTransfers({ tre: 17, mike: -3, dave: -5, sam: -9 });
  assert.equal(t.length, 3);
  assert.deepEqual(t.map(x => [x.from, x.to, x.amount]), [['sam', 'tre', 9], ['dave', 'tre', 5], ['mike', 'tre', 3]]);
});

test('Nassau + Skins + Junk: pairs sum across games and the total matches the parts', () => {
  const r = createRound({
    id: 'r', game: 'nassau', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase() })), settings: structuredClone(SETTINGS), teams: [['a', 'b'], ['c', 'd']],
  });
  r.sideGames = [{ game: 'skins', settings: { ...SIDE_SETTINGS.skins, lastCarry: 'void' } }, { game: 'dots', settings: { ...SIDE_SETTINGS.dots, auto: false } }];
  // a wins hole 1 outright; b gets a greenie on 2; everything else halved
  r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par, c: h.par, d: h.par }; });
  r.scores[1].a = 3;
  r.marks[2] = { b: ['greenie'] };
  const res = roundResults(r);
  const main = gameResults(r);
  const skins = gameResults(gameView(r, 'skins'));
  const junk = gameResults(gameView(r, 'dots'));
  assert.deepEqual(skins.balances, { a: 6, b: -2, c: -2, d: -2 });
  assert.deepEqual(junk.balances, { a: -1, b: 3, c: -1, d: -1 });
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(res.balances[id], main.balances[id] + skins.balances[id] + junk.balances[id]);
  for (const [a, b] of [['a', 'b'], ['a', 'c'], ['b', 'd']]) {
    assert.equal(res.pairs[a][b], Math.round((main.pairs[a][b] + skins.pairs[a][b] + junk.pairs[a][b]) * 100) / 100);
  }
  assert.equal(res.detail.byGame.skins.label, 'Skins');
  assert.equal(res.detail.byGame.dots.label, 'Junk');
  assert.equal(res.detail.byGame.main.label, 'Nassau');
  // The main game's detail is still where the screens look for it
  assert.ok(res.detail.lines);
  assert.equal(gameLabel(r), 'Nassau + Skins + Junk');
  assert.match(shareText(r, res), /^Nassau \+ Skins \+ Junk at Pebble Creek/);
});

test('a side game ignores the main game’s bet changes', () => {
  let r = createRound({
    id: 'r', game: 'skins', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c'].map(id => ({ id, name: id })), settings: structuredClone(SETTINGS),
  });
  r = changeBets(r, { ...r.settings.skins, value: 10 }, 4);
  assert.ok(r.betHistory?.length);
  r.sideGames = [{ game: 'dots', settings: { ...SIDE_SETTINGS.dots, value: 1 } }];
  const v = gameView(r, 'dots');
  assert.equal(v.betHistory, undefined);
  assert.equal(v.settings.dots.value, 1);
  assert.equal(v.game, 'dots');
  assert.equal(v.teams, null);
  // The main game still sees its history
  assert.equal(gameView(r, 'main').betHistory, r.betHistory);
});

test('Hammer or Snake marks and Junk dots live side by side on a hole', () => {
  for (const game of ['hammer', 'snake']) {
    const r = createRound({
      id: 'r', game, course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
      players: ['a', 'b'].map(id => ({ id, name: id })), settings: structuredClone(SETTINGS),
    });
    r.sideGames = [{ game: 'dots', settings: { ...SIDE_SETTINGS.dots, auto: false } }];
    r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par }; r.marks[h.no] = game === 'snake' ? { snake: [] } : {}; });
    r.marks[1] = game === 'snake' ? { snake: ['b'], a: ['sandy'] } : { hammers: [0], a: ['sandy'] };
    r.scores[1].a = r.holes[0].par - 1;
    const res = roundResults(r);
    assert.deepEqual(res.detail.byGame.dots.balances, { a: 1, b: -1 }, game);
    assert.deepEqual(gameResults(r).balances, res.detail.byGame.main.balances, game);
    // The main game's own marks still count
    assert.ok(res.detail.byGame.main.balances.a > 0, game);
  }
});

test('birdie pot: shares split the pot, an eagle is two shares, no birdies means nobody pays', () => {
  assert.equal(birdieShares(3, 4), 1);
  assert.equal(birdieShares(2, 4), 2);
  assert.equal(birdieShares(2, 4, 3), 3);
  assert.equal(birdieShares(4, 4), 0);
  assert.deepEqual(birdiePot({ a: 0, b: 0, c: 0, d: 0 }, 5), { a: 0, b: 0, c: 0, d: 0 });
  assert.deepEqual(birdiePot({ a: 1, b: 0, c: 0, d: 0 }, 5), { a: 15, b: -5, c: -5, d: -5 });
  assert.deepEqual(birdiePot({ a: 2, b: 1, c: 0, d: 0 }, 5), { a: 8.33, b: 1.67, c: -5, d: -5 });
  const r = createRound({
    id: 'r', game: 'stroke', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c'].map(id => ({ id, name: id })), settings: structuredClone(SETTINGS),
  });
  r.sideGames = [{ game: 'birdies', settings: { stake: 5, eagleShares: 2 } }];
  r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par, c: h.par }; });
  assert.deepEqual(roundResults(r).detail.byGame.birdies.balances, { a: 0, b: 0, c: 0 });
  r.scores[1].a = r.holes[0].par - 2; // eagle: 2 shares
  r.scores[3].b = r.holes[2].par - 1; // birdie: 1 share
  r.scores[4].c = 'X';
  const t = birdiePotShares(gameView(r, 'birdies'));
  assert.deepEqual(t.shares, { a: 2, b: 1, c: 0 });
  assert.deepEqual(roundResults(r).detail.byGame.birdies.balances, { a: 5, b: 0, c: -5 });
});

test('side game choices: none with Scramble, no clashes, at most 4 games', () => {
  assert.deepEqual(sideGameChoices('scramble'), []);
  assert.deepEqual(sideGameChoices('nassau'), ['skins', 'dots', 'birdies', 'snake', 'rabbit']);
  // Skins and Rabbit both pay for winning a hole outright, so only one of them
  assert.deepEqual(sideGameChoices('skins'), ['dots', 'birdies', 'snake']);
  assert.deepEqual(sideGameChoices('rabbit'), ['dots', 'birdies', 'snake']);
  assert.deepEqual(sideGameChoices('dots'), ['skins', 'birdies', 'snake', 'rabbit']);
  assert.deepEqual(sideGameChoices('snake'), ['skins', 'dots', 'birdies', 'rabbit']);
  // Junk and Bingo Bango Bongo both pay for closest
  assert.deepEqual(sideGameChoices('bbb'), ['skins', 'birdies', 'snake', 'rabbit']);
  assert.deepEqual(sideGameChoices('nassau', [{ game: 'skins' }]), ['dots', 'birdies', 'snake']);
  assert.deepEqual(sideGameChoices('nassau', [{ game: 'rabbit' }]), ['dots', 'birdies', 'snake']);
  // One Birdie pot a round, like every other side game
  assert.deepEqual(sideGameChoices('nassau', [{ game: 'birdies' }]), ['skins', 'dots', 'snake', 'rabbit']);
  assert.deepEqual(sideGamesOf({ game: 'nassau', sideGames: [{ game: 'birdies', settings: {} }, { game: 'birdies', settings: {} }] }).map(sg => sg.game), ['birdies']);
  assert.deepEqual(sideGameChoices('nassau', [{ game: 'skins' }, { game: 'dots' }, { game: 'snake' }]), []);
  // A Birdie pot already on isn't offered a second time
  assert.deepEqual(sideGameChoices('vegas', [{ game: 'birdies' }]), ['skins', 'dots', 'snake', 'rabbit']);
  assert.deepEqual(sideGameChoices('vegas', [{ game: 'skins' }, { game: 'birdies' }]), ['dots', 'snake']);
  assert.equal(MAX_GAMES, 4);
  // A hand-made round can't pay Skins and Rabbit together: the second one is dropped
  assert.deepEqual(sideGamesOf({ game: 'nassau', sideGames: [{ game: 'skins', settings: {} }, { game: 'rabbit', settings: {} }] }).map(sg => sg.game), ['skins']);
  assert.deepEqual(sideGamesOf({ game: 'rabbit', sideGames: [{ game: 'skins', settings: {} }] }), []);
  // Junk on a Bingo Bango Bongo round from before the rule keeps its money
  assert.deepEqual(sideGamesOf({ game: 'bbb', sideGames: [{ game: 'dots', settings: {} }] }).map(sg => sg.game), ['dots']);
  // GAMES is untouched: the picker still shows 18 games
  assert.equal(Object.keys(GAMES).length, 18);
  assert.ok(Object.keys(SIDE_GAMES).every(k => k === 'birdies' || GAMES[k]));
});

test('livePreview counts the side games in the hole’s money', () => {
  const r = createRound({
    id: 'r', game: 'nassau', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b'].map(id => ({ id, name: id })), settings: structuredClone(SETTINGS),
  });
  r.sideGames = [{ game: 'skins', settings: SIDE_SETTINGS.skins }, { game: 'dots', settings: { ...SIDE_SETTINGS.dots, auto: false } }];
  const h = r.holes[0];
  const { delta } = livePreview(r, h, { scores: { a: h.par - 1, b: h.par }, marks: { a: ['greenie'] } });
  // Skins $2 and one dot $1 from b. Nassau pays nothing on its own until a leg is decided, but its
  // live number follows the Nassau rules as built, so compare against the engine rather than guess
  const nassauOnly = livePreview({ ...r, sideGames: undefined }, h, { scores: { a: h.par - 1, b: h.par } }).delta;
  assert.equal(delta.a, Math.round((nassauOnly.a + 3) * 100) / 100);
  assert.equal(delta.b, Math.round((nassauOnly.b - 3) * 100) / 100);
});

test('gamesFor: a player out of a game counts 0 there and is still in the others', () => {
  const r = createRound({
    id: 'r', game: 'stroke', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c'].map(id => ({ id, name: id })), settings: { ...structuredClone(SETTINGS), stroke: { stake: 1, payout: 'per' } },
  });
  r.sideGames = [{ game: 'skins', settings: { ...SIDE_SETTINGS.skins, carryover: false } }];
  r.gamesFor = { c: ['skins'] };
  r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par, c: h.par }; });
  r.scores[1].c = r.holes[0].par - 1;
  r.scores[2].a = r.holes[1].par - 1;
  const res = roundResults(r);
  assert.equal(res.detail.byGame.main.balances.c, 0);
  assert.deepEqual(res.detail.byGame.skins.balances, { a: 2, b: -4, c: 2 });
  assert.equal(sumCents(res.balances), 0);
  assert.deepEqual(gameKeys(r), ['main', 'skins']);
});

test('bet lines for every game in a round', () => {
  const r = { game: 'nassau', settings: SETTINGS, sideGames: [{ game: 'skins', settings: SIDE_SETTINGS.skins }, { game: 'dots', settings: SIDE_SETTINGS.dots }] };
  assert.deepEqual(roundStakeLines(r).map(l => l.line), ['$5 / $5 / $5', '$2 a skin', '$1 a dot']);
  assert.deepEqual(roundStakeLines({ ...r, sideGames: [{ game: 'birdies', settings: SIDE_SETTINGS.birdies }] }).map(l => l.line), ['$5 / $5 / $5', '$5 each in the birdie pot']);
  // A fourth side game is past the 4-game cap: it isn't counted, so it isn't listed either
  const four = [...r.sideGames, { game: 'birdies', settings: SIDE_SETTINGS.birdies }, { game: 'snake', settings: { stake: 5, growth: 'flat' } }];
  assert.equal(roundStakeLines({ ...r, sideGames: four }).length, 4);
  assert.equal(sideBetLine('birdies', { stake: 5 }), '$5 each in the birdie pot');
  assert.equal(optionsProblem('birdies', { birdies: { stake: 0 } }) != null, true);
  assert.equal(optionsProblem('birdies', { birdies: { stake: 5 } }), null);
  assert.equal(gameLabel({ game: 'skins' }), 'Skins');
});

/** Nassau 2 v 2 with Skins and Junk over 9 holes: a wins hole 1, b has a greenie on 2. */
function threeGames() {
  const r = createRound({
    id: 'r', game: 'nassau', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: `${id.toUpperCase()} Smith` })), settings: structuredClone(SETTINGS), teams: [['a', 'b'], ['c', 'd']],
  });
  r.sideGames = [{ game: 'skins', settings: { ...SIDE_SETTINGS.skins, lastCarry: 'void' } }, { game: 'dots', settings: { ...SIDE_SETTINGS.dots, auto: false } }];
  r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par, c: h.par, d: h.par }; });
  r.scores[1].a = 3;
  r.marks[2] = { b: ['greenie'] };
  return r;
}

test('the reveal plays the main game, then one step per side game; the image and share text follow', () => {
  const r = threeGames();
  const res = roundResults(r);
  const { steps } = revealSteps(r, res);
  const side = steps.filter(x => x.key.startsWith('side-'));
  assert.deepEqual(side.map(x => x.label), ['Skins', 'Junk']);
  assert.equal(side[0].text, 'A won 1 skin');
  assert.equal(side[0].amount, 6);
  assert.equal(side[1].text, 'B had 1 dot');
  // Old rounds keep their steps exactly
  const old = { ...r, sideGames: undefined };
  assert.deepEqual(revealSteps(old, roundResults(old)), revealSteps(old, gameResults(old)));
  assert.ok(!revealSteps(old, roundResults(old)).steps.some(x => x.key.startsWith('side-')));
  // Games in small type under each name
  assert.equal(gamesLine(res.detail.byGame, 'a'), `Nassau ${res.detail.byGame.main.balances.a >= 0 ? '+' : '−'}$${Math.abs(res.detail.byGame.main.balances.a)} · Skins +$6 · Junk −$1`);
  const card = shareCardModel(r, res);
  assert.match(card.meta, /Nassau \+ Skins \+ Junk$/);
  // With amounts off, no dollar figure appears on the card
  assert.ok(!JSON.stringify(shareCardModel(r, res, { showAmounts: false }).bets).includes('$'));
});

test('a side game with nothing won is a push in the reveal', () => {
  const r = threeGames();
  r.scores[1].a = r.holes[0].par;
  r.marks = {};
  const side = revealSteps(r, roundResults(r)).steps.filter(x => x.key.startsWith('side-'));
  assert.deepEqual(side.map(x => [x.text, !!x.tie]), [['No skins won', true], ['No dots', true]]);
});

test('side games ride in the live meta, and Junk dots ride with the hole', () => {
  const r = threeGames();
  const meta = buildMeta(r);
  assert.deepEqual(meta.sideGames, r.sideGames);
  const back = assemble(meta, []);
  assert.deepEqual(back.sideGames, r.sideGames);
  assert.equal(gameLabel(meta), 'Nassau + Skins + Junk');
  const p = joinPreview({ ...meta, status: 'active' });
  assert.match(p.title, /Nassau \+ Skins \+ Junk/);
  assert.match(p.description, /\$2 a skin/);
  // A meta with a garbled sideGames field still previews
  assert.ok(joinPreview({ ...meta, sideGames: 'x' }).title.includes('Nassau'));
});

test('Run it back copies the side games with their own bets', () => {
  const r = { ...threeGames(), status: 'done', course: { id: 'c9', name: 'Pebble Creek' } };
  const c9 = { ...course(9), id: 'c9' };
  const state = { me: 'a', players: Object.fromEntries(r.players.map(p => [p.id, { id: p.id, name: p.name }])), rounds: { r }, customCourses: { c9 } };
  const s = rematchSetup(state, r);
  assert.deepEqual(s.sideGames, r.sideGames);
  assert.notEqual(s.sideGames, r.sideGames);
  const plain = rematchSetup(state, { ...r, sideGames: undefined });
  assert.equal('sideGames' in plain, false);
});

test('worked examples and notes read plainly', () => {
  assert.equal(sideExample('skins', SIDE_SETTINGS.skins, 4), 'Win a hole outright, win the skin. Ties carry. Win 3 skins in a foursome and the other 3 each pay you $6.');
  assert.equal(sideExample('dots', { value: 1, kinds: { greenie: true, sandy: true, chipin: true } }, 4), 'Greenies, sandies, chip-ins. One greenie in a foursome: the other 3 each pay you $1.');
  assert.equal(sideExample('birdies', { stake: 5, eagleShares: 2 }, 4), 'Every net birdie takes a share of the $20 pot, and a net eagle takes 2. No birdies, nobody pays.');
  for (const t of [sideExample('skins', SIDE_SETTINGS.skins, 3), sideExample('dots', SIDE_SETTINGS.dots, 2)]) assert.ok(!/week/i.test(t));
  const r = threeGames();
  r.scores = { 1: r.scores[1] };
  assert.match(nassauOpenNote(r, roundResults(r).detail.byGame), /whoever is ahead/);
  assert.equal(nassauOpenNote({ ...r, game: 'skins' }, roundResults(r).detail.byGame), null);
});

test('join and leave rules: unchanged without side games, a word on each side game with them', () => {
  const r = threeGames();
  const old = { ...r, sideGames: undefined, left: { d: 3 } };
  const withSides = { ...r, left: { d: 3 } };
  assert.ok(leftRule(withSides, 'd').startsWith(leftRule(old, 'd')));
  assert.match(leftRule(withSides, 'd'), /Skins and Junk carry on among the players still there\.$/);
  const pot = { ...r, sideGames: [{ game: 'birdies', settings: SIDE_SETTINGS.birdies }] };
  assert.match(joinRule(pot, 'a'), /birdie pot is for the players who started/);
  assert.equal(joinRule({ ...r, sideGames: undefined }, 'a'), joinRule(old, 'a'));
});

test('changing the round length or the main bet keeps the side games as they were', () => {
  const r = threeGames();
  const c = course(18);
  const longer = resizeRound(r, c, 18);
  assert.deepEqual(longer.sideGames, r.sideGames);
  assert.equal(sumCents(roundResults(longer).balances), 0);
  const raised = changeBets(r, { ...r.settings.nassau, front: 10 }, 3);
  assert.deepEqual(raised.sideGames, r.sideGames);
  assert.deepEqual(roundResults(raised).detail.byGame.skins.balances, roundResults(r).detail.byGame.skins.balances);
});

test('a garbled round can never count a side game twice', () => {
  const r = threeGames();
  const skins = r.sideGames.find(sg => sg.game === 'skins');
  const once = roundResults({ ...r, sideGames: [skins] }).balances;
  // The same side game listed twice counts once
  assert.deepEqual(roundResults({ ...r, sideGames: [skins, skins] }).balances, once);
  assert.equal(gameLabel({ ...r, sideGames: [skins, skins] }), 'Nassau + Skins');
  assert.equal(roundStakeLines({ ...r, sideGames: [skins, skins] }).length, 2);
  // Junk on a Dots round would pay the same dots twice, so it's dropped
  const dots = { ...r, game: 'dots', teams: null, presses: [], sideGames: [{ game: 'dots', settings: SIDE_SETTINGS.dots }] };
  assert.deepEqual(roundResults(dots).balances, gameResults({ ...dots, sideGames: undefined }).balances);
  // Nothing on a Scramble, nothing past the cap, and a non-list is no side games at all
  assert.deepEqual(gameKeys({ ...r, game: 'scramble' }), ['main']);
  const four = [...r.sideGames, { game: 'birdies', settings: SIDE_SETTINGS.birdies }, { game: 'birdies', settings: SIDE_SETTINGS.birdies }];
  assert.equal(gameKeys({ ...r, sideGames: four }).length, MAX_GAMES);
  assert.deepEqual(gameKeys({ ...r, sideGames: { game: 'skins' } }), ['main']);
});

test('late joiners, players who left, pickups and a shorter round: side games stay zero-sum', () => {
  const rnd = seeded(42);
  for (const game of ['skins', 'stroke', 'stableford', 'quota', 'aces', 'bbb', 'dots', 'rabbit', 'banker']) {
    for (let k = 0; k < 12; k++) {
      const r0 = fixture(game, rnd, { n: 3 });
      if (!r0) continue;
      r0.sideGames = sideGameChoices(game, []).slice(0, 2).map(g => ({ game: g, settings: structuredClone(SIDE_SETTINGS[g]) }));
      for (const h of r0.holes) if (r0.scores[h.no] && rnd() < 0.1) r0.scores[h.no].p1 = 'X';
      if (k % 2) r0.left = { p2: r0.holes[5 + k].no };
      const from = r0.holes[2 + (k % 6)].no;
      const r = addPlayerToRound(r0, { id: 'late', name: 'Late Comer', index: 12 }, from);
      for (const h of r.holes) if (r.scores[h.no] && h.no >= from) r.scores[h.no].late = h.par - 1;
      const res = roundResults(r);
      assert.equal(sumCents(res.balances), 0, game);
      if (res.detail.byGame.birdies) assert.equal(res.detail.byGame.birdies.balances.late, 0, 'a late joiner is out of the birdie pot');
      for (const g of Object.values(res.detail.byGame)) assert.equal(sumCents(g.balances), 0, `${game} ${g.label}`);
      const nine = resizeRound(r, course(18), 9);
      assert.deepEqual(nine.sideGames, r.sideGames);
      assert.equal(sumCents(roundResults(nine).balances), 0);
    }
  }
});

test('Snake and Rabbit as side games: their own money next to the main game', () => {
  const r = createRound({
    id: 'r', game: 'stroke', course: course(9), holesCount: 9, useHandicaps: false, hcPct: 100,
    players: ['a', 'b', 'c'].map(id => ({ id, name: id })), settings: { ...structuredClone(SETTINGS), stroke: { stake: 1, payout: 'per' } },
  });
  r.sideGames = [{ game: 'snake', settings: { stake: 5, growth: 'flat', nines: false, cap: 0 } }, { game: 'rabbit', settings: { stake: 5, mode: 'free', tiesFree: false } }];
  r.holes.forEach(h => { r.scores[h.no] = { a: h.par, b: h.par, c: h.par }; r.marks[h.no] = { snake: [] }; });
  r.scores[1].a = r.holes[0].par - 1; // a catches the rabbit and holds it through 9
  r.marks[4] = { snake: ['c'] };      // c three-putts and holds the snake
  const res = roundResults(r);
  assert.deepEqual(res.detail.byGame.snake.balances, { a: 5, b: 5, c: -10 });
  assert.deepEqual(res.detail.byGame.rabbit.balances, { a: 10, b: -5, c: -5 });
  assert.equal(sumCents(res.balances), 0);
});

test('side Skins: one line of house rules, from the settings the side game carries', async () => {
  const { skinsRulesLine } = await import('./side-games.js');
  assert.equal(skinsRulesLine({ value: 2, carryover: true }), 'Net · $2 a skin · last carry unclaimed');
  assert.equal(skinsRulesLine({ value: 2, stake: 5, payout: 'pot', kind: 'gross', carryover: true, lastCarry: 'split' }), 'Gross · $5 each in the pot · last carry split');
  assert.equal(skinsRulesLine({ value: 3, kind: 'both', carryover: true, lastCarry: 'playoff' }), 'Net and gross · $3 a skin · last carry played off');
  assert.equal(skinsRulesLine({ value: 1, carryover: false, lastCarry: 'split' }), 'Net · $1 a skin · no carryovers');
});
