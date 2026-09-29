// A side game's bet changed mid-round (ROADMAP area 5): the same rules as the main game's bet
// changes, kept on the side game's own entry (round.sideGames[i].betHistory). Counts from the next
// hole with "Whole round" as the option, a pot always covers the whole round, and a Snake or
// Rabbit already under way keeps its bet. Rounds from before have no side history, so their money
// is exactly what it always was (checked against a snapshot taken before this change).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPlayerToRound, betChanges, betsChanged, changeBets, createRound, gameResults, gameView, roundResults, settingsAt, wholeRoundOnly,
} from './round.js';
import { betChangeNote, betStretchLine, roundStakeLines } from './stakes.js';
import { rematchSetup } from './rematch.js';
import { revealSteps } from './reveal.js';
import { SETTINGS, SIDE_SETTINGS, oldRoundFixtures } from './side-bets.fixtures.js';

const flat = n => ({ id: `f${n}`, name: 'Flat', city: 'Town', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });

/** A round of `game` on a flat par-4 course, no handicaps, with side games from { key: settings }. */
function mk(game, ids, sides = {}, { holes = 18, settings = SETTINGS } = {}) {
  const r = createRound({
    id: 'r', game, course: flat(holes), holesCount: holes, players: ids.map(id => ({ id, name: id.toUpperCase() })),
    settings: structuredClone(settings), hcPct: 100, useHandicaps: false,
  });
  r.sideGames = Object.entries(sides).map(([g, s]) => ({ game: g, settings: structuredClone(s) }));
  return r;
}
/** Score holes by playing position (1-based): { pos: { pid: gross } }; everyone else gets par. Every hole played has marks. */
function play(round, upto, special = {}, marks = {}) {
  round.holes.slice(0, upto).forEach((h, i) => {
    round.scores[h.no] = { ...Object.fromEntries(round.players.map(p => [p.id, 4])), ...(special[i + 1] || {}) };
    round.marks[h.no] = { snake: [], ...(marks[i + 1] || {}) };
  });
  return round;
}
const side = (round, key) => roundResults(round).detail.byGame[key].balances;
const cents = v => Math.round(v * 100);
const sumCents = o => Object.values(o).reduce((a, v) => a + cents(v), 0);
const sgOf = (round, key) => round.sideGames.find(sg => sg.game === key);
const SKINS = { ...SIDE_SETTINGS.skins, carryover: false };

test('a side Skins bet changed from hole 10 pays holes 1 to 9 at the old bet and 10 on at the new', () => {
  // Mike wins holes 2 and 12 outright, no carryovers, $2 a skin to start
  const r = play(mk('nassau', ['t', 'm', 'd', 's'], { skins: SKINS }), 18, { 2: { m: 3 }, 12: { m: 3 } });
  assert.deepEqual(side(r, 'skins'), { t: -4, m: 12, d: -4, s: -4 });
  const from10 = changeBets(r, { ...SKINS, value: 5 }, 10, 'skins');
  assert.deepEqual(side(from10, 'skins'), { t: -7, m: 21, d: -7, s: -7 });
  assert.equal(settingsAt(gameView(from10, 'skins'), 9).skins.value, 2);
  assert.equal(settingsAt(gameView(from10, 'skins'), 10).skins.value, 5);
  assert.equal(sgOf(from10, 'skins').settings.value, 5);
  assert.deepEqual(sgOf(from10, 'skins').betHistory, [{ upto: 9, settings: SKINS }]);
  assert.equal(betsChanged(from10, 'skins'), true);
  assert.equal(betsChanged(from10), false);
  assert.deepEqual(betChanges(from10, 'skins'), [{ pos: 10, no: 10 }]);
  // The same change on Skins as the main game pays exactly the same
  const main = play(mk('skins', ['t', 'm', 'd', 's'], {}, { settings: { ...SETTINGS, skins: SKINS } }), 18, { 2: { m: 3 }, 12: { m: 3 } });
  assert.deepEqual(gameResults(changeBets(main, { ...SKINS, value: 5 }, 10)).balances, side(from10, 'skins'));
  // `round` is not changed
  assert.equal(sgOf(r, 'skins').betHistory, undefined);
  assert.equal(sgOf(r, 'skins').settings.value, 2);
});

test('side Skins carried into the change keep their value, the new hole is at the new bet', () => {
  // Holes 1 to 9 all tie at $2 and carry; the bet goes to $5 from 10 and Mike wins hole 10
  const s = { ...SIDE_SETTINGS.skins, carryover: true, lastCarry: 'void' };
  const r = changeBets(play(mk('nassau', ['t', 'm', 'd', 's'], { skins: s }), 18, { 10: { m: 3 } }), { ...s, value: 5 }, 10, 'skins');
  // 9 × $2 + $5 = $23 from each of three
  assert.deepEqual(side(r, 'skins'), { t: -23, m: 69, d: -23, s: -23 });
});

test('a Skins pot and a Birdie pot always change for the whole round', () => {
  assert.equal(wholeRoundOnly('birdies', { stake: 5 }, { stake: 10 }), true);
  assert.equal(wholeRoundOnly('skins', { payout: 'pot' }, { payout: 'pot' }), true);
  assert.equal(wholeRoundOnly('skins', { payout: 'per' }, { payout: 'pot' }), true);
  assert.equal(wholeRoundOnly('dots', {}, {}), false);
  assert.equal(wholeRoundOnly('snake', {}, {}), false);
  assert.equal(wholeRoundOnly('rabbit', {}, {}), false);

  const pot = { ...SIDE_SETTINGS.skins, payout: 'pot', stake: 10 };
  const r = play(mk('nassau', ['t', 'm', 'd'], { skins: pot, birdies: SIDE_SETTINGS.birdies }), 18, { 2: { m: 3 }, 5: { t: 3 }, 7: { m: 3 } });
  const skins = changeBets(r, { ...pot, stake: 20 }, 10, 'skins');
  assert.equal(betsChanged(skins, 'skins'), false);
  assert.equal(sgOf(skins, 'skins').settings.stake, 20);
  // Exactly the round played for $20 from the first hole
  const fresh = play(mk('nassau', ['t', 'm', 'd'], { skins: { ...pot, stake: 20 }, birdies: SIDE_SETTINGS.birdies }), 18, { 2: { m: 3 }, 5: { t: 3 }, 7: { m: 3 } });
  assert.deepEqual(side(skins, 'skins'), side(fresh, 'skins'));

  const birdies = changeBets(r, { stake: 10, eagleShares: 2 }, 10, 'birdies');
  assert.equal(betsChanged(birdies, 'birdies'), false);
  assert.equal(sgOf(birdies, 'birdies').betHistory, undefined);
  // Mike has two birdies and Trevor one, so a $10 pot of 30 splits 20 and 10
  assert.deepEqual(side(birdies, 'birdies'), { t: 0, m: 10, d: -10 });
  assert.deepEqual(side(r, 'birdies'), { t: 0, m: 5, d: -5 });
});

test('a Junk bet change prices each dot at the bet on its hole', () => {
  // A sandy on hole 1 ($1 from each) and one on hole 10 ($2 from each)
  const r = play(mk('nassau', ['a', 'b', 'c'], { dots: { ...SIDE_SETTINGS.dots, auto: false } }), 18, {}, { 1: { a: ['sandy'] }, 10: { a: ['sandy'] } });
  const from10 = changeBets(r, { ...SIDE_SETTINGS.dots, auto: false, value: 2 }, 10, 'dots');
  assert.deepEqual(side(from10, 'dots'), { a: 6, b: -3, c: -3 });
  assert.deepEqual(side(changeBets(r, { ...SIDE_SETTINGS.dots, auto: false, value: 2 }, null, 'dots'), 'dots'), { a: 8, b: -4, c: -4 });
});

test('a Snake or Rabbit already under way keeps its bet, the next leg is for the new one', () => {
  // Snake each nine at $2: a three-putts on hole 3 (holds the front), b on hole 12 (holds the back)
  const snake = { ...SIDE_SETTINGS.snake, nines: true };
  const r = play(mk('nassau', ['a', 'b', 'c'], { snake }), 18, {}, { 3: { snake: ['a'] }, 12: { snake: ['b'] } });
  assert.deepEqual(side(r, 'snake'), { a: -4 + 2, b: 2 - 4, c: 4 });
  // From hole 5: the front snake was under way, so it stays $2; the back is $5
  assert.deepEqual(side(changeBets(r, { ...snake, stake: 5 }, 5, 'snake'), 'snake'), { a: -4 + 5, b: 2 - 10, c: 7 });
  // From hole 12: the back snake started on 10, so it stays $2 as well
  assert.deepEqual(side(changeBets(r, { ...snake, stake: 5 }, 12, 'snake'), 'snake'), side(r, 'snake'));
  // One snake for the round: it's always under way, so only "Whole round" changes it
  const one = play(mk('nassau', ['a', 'b', 'c'], { snake: { ...snake, nines: false } }), 18, {}, { 12: { snake: ['b'] } });
  assert.deepEqual(side(changeBets(one, { ...snake, nines: false, stake: 5 }, 5, 'snake'), 'snake'), { a: 2, b: -4, c: 2 });
  assert.deepEqual(side(changeBets(one, { ...snake, nines: false, stake: 5 }, null, 'snake'), 'snake'), { a: 5, b: -10, c: 5 });

  // Rabbit at $5, set free: a catches it on hole 2 and holds the front, b on hole 11 and holds the back
  const rabbit = SIDE_SETTINGS.rabbit;
  const rr = play(mk('nassau', ['a', 'b', 'c'], { rabbit }), 18, { 2: { a: 3 }, 11: { b: 3 } });
  assert.deepEqual(side(rr, 'rabbit'), { a: 10 - 5, b: -5 + 10, c: -10 });
  assert.deepEqual(side(changeBets(rr, { ...rabbit, stake: 10 }, 5, 'rabbit'), 'rabbit'), { a: 10 - 10, b: -5 + 20, c: -15 });
  assert.deepEqual(side(changeBets(rr, { ...rabbit, stake: 10 }, 12, 'rabbit'), 'rabbit'), side(rr, 'rabbit'));
});

test('"Whole round" clears a side game’s history and reprices every hole', () => {
  const r = play(mk('nassau', ['t', 'm', 'd', 's'], { skins: SKINS }), 18, { 2: { m: 3 }, 12: { m: 3 } });
  const from10 = changeBets(r, { ...SKINS, value: 5 }, 10, 'skins');
  const whole = changeBets(from10, { ...SKINS, value: 5 }, null, 'skins');
  assert.equal(betsChanged(whole, 'skins'), false);
  assert.equal('betHistory' in sgOf(whole, 'skins'), false);
  assert.deepEqual(side(whole, 'skins'), { t: -10, m: 30, d: -10, s: -10 });
  // From the first hole is the whole round too
  assert.equal(betsChanged(changeBets(r, { ...SKINS, value: 5 }, 1, 'skins'), 'skins'), false);
});

test('side game history: later changes, an earlier change, and neighbouring equal stretches merge', () => {
  let r = mk('nassau', ['t', 'm'], { skins: SKINS });
  const at = pos => settingsAt(gameView(r, 'skins'), pos).skins.value;
  r = changeBets(r, { ...SKINS, value: 5 }, 10, 'skins'); // 1–9 at $2, 10+ at $5
  r = changeBets(r, { ...SKINS, value: 10 }, 15, 'skins'); // 10–14 at $5, 15+ at $10
  assert.deepEqual([1, 9, 10, 14, 15, 18].map(at), [2, 2, 5, 5, 10, 10]);
  assert.deepEqual(betChanges(r, 'skins').map(c => c.no), [10, 15]);
  // The same bet again from a later hole adds nothing
  r = changeBets(r, { ...SKINS, value: 10 }, 17, 'skins');
  assert.deepEqual(sgOf(r, 'skins').betHistory.map(e => e.upto), [9, 14]);
  // Back to $5 from 15 joins the $5 stretch to what's in force now
  r = changeBets(r, { ...SKINS, value: 5 }, 15, 'skins');
  assert.deepEqual(sgOf(r, 'skins').betHistory.map(e => e.upto), [9]);
  // An earlier change drops the later ones
  r = changeBets(r, { ...SKINS, value: 1 }, 5, 'skins');
  assert.deepEqual([4, 5, 12, 18].map(at), [2, 1, 1, 1]);
  // Back to what the earlier holes were played for: one bet for the whole round
  r = changeBets(r, SKINS, 5, 'skins');
  assert.equal(betsChanged(r, 'skins'), false);
});

test('old rounds with side games give exactly the money they always did', () => {
  const snap = JSON.parse(readFileSync(new URL('./side-bets.snapshot.json', import.meta.url), 'utf8'));
  const fixtures = oldRoundFixtures();
  assert.equal(fixtures.length, Object.keys(snap).length);
  for (const { name, round } of fixtures) {
    const res = roundResults(round);
    const byGame = Object.fromEntries(Object.entries(res.detail.byGame).map(([k, g]) => [k, g.balances]));
    assert.deepEqual(byGame, snap[name], name);
    assert.equal(sumCents(res.balances), 0, name);
    // A side game with no history reads its own settings on every hole
    for (const sg of round.sideGames) assert.equal(gameView(round, sg.game).betHistory, undefined);
  }
});

test('side bets changed at random: every game still sums to zero and the parts add up', () => {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let checked = 0;
  for (const { name, round } of oldRoundFixtures()) {
    let r = round;
    for (const sg of round.sideGames) {
      const key = sg.game;
      const amount = key === 'skins' ? 'value' : key === 'dots' ? 'value' : 'stake';
      const from = 1 + Math.floor(rnd() * r.holes.length);
      r = changeBets(r, { ...sg.settings, [amount]: 1 + Math.floor(rnd() * 9) }, from, key);
      if (rnd() < 0.5) r = changeBets(r, { ...sg.settings, [amount]: 1 + Math.floor(rnd() * 9) }, 1 + Math.floor(rnd() * r.holes.length), key);
    }
    const res = roundResults(r);
    assert.equal(sumCents(res.balances), 0, name);
    for (const [k, g] of Object.entries(res.detail.byGame)) assert.equal(sumCents(g.balances), 0, `${name} ${k}`);
    // The main game never moves
    assert.deepEqual(res.detail.byGame.main.balances, roundResults(round).detail.byGame.main.balances, name);
    for (const id of Object.keys(res.balances)) {
      const parts = Object.values(res.detail.byGame).reduce((a, g) => a + cents(g.balances[id]), 0);
      assert.ok(Math.abs(parts - cents(res.balances[id])) <= 3, name);
    }
    checked++;
  }
  assert.ok(checked >= 20);
});

test('a late joiner in a side game plays for the bet in force on each hole', () => {
  // t, m and d play Nassau and Skins; x joins on hole 6 for Skins only, and Skins goes to $5 from 10
  let r = play(mk('nassau', ['t', 'm', 'd'], { skins: SKINS }), 5, { 2: { m: 3 } });
  r = addPlayerToRound(r, { id: 'x', name: 'X' }, 6, ['skins']);
  play(r, 18, { 2: { m: 3 }, 12: { x: 3 } });
  for (const h of r.holes.slice(0, 5)) delete r.scores[h.no].x;
  r = changeBets(r, { ...SKINS, value: 5 }, 10, 'skins');
  const res = roundResults(r);
  // Hole 2 at $2 from t and d; hole 12 at $5 from each of the three others
  assert.deepEqual(res.detail.byGame.skins.balances, { t: -2 - 5, m: 4 - 5, d: -2 - 5, x: 15 });
  assert.equal(res.detail.byGame.main.balances.x, 0);
  assert.equal(sumCents(res.balances), 0);
});

test('the main game’s bet history never reaches a side game, and a side game’s never reaches the main game', () => {
  const base = play(mk('skins', ['t', 'm', 'd'], { dots: { ...SIDE_SETTINGS.dots, auto: false } }, { settings: { ...SETTINGS, skins: SKINS } }), 18,
    { 2: { m: 3 }, 12: { t: 3 } }, { 1: { d: ['sandy'] }, 11: { d: ['greenie'] } });
  const before = roundResults(base).detail.byGame;
  // A main game change: the side game's money and entry stay as they were
  const main = changeBets(base, { ...SKINS, value: 10 }, 10);
  assert.ok(main.betHistory?.length);
  assert.deepEqual(main.sideGames, base.sideGames);
  assert.equal(gameView(main, 'dots').betHistory, undefined);
  assert.deepEqual(roundResults(main).detail.byGame.dots.balances, before.dots.balances);
  // A side game change: round.betHistory and round.settings stay as they were, and so does the main money
  const junk = changeBets(base, { ...SIDE_SETTINGS.dots, auto: false, value: 3 }, 10, 'dots');
  assert.equal(junk.betHistory, undefined);
  assert.deepEqual(junk.settings, base.settings);
  assert.deepEqual(roundResults(junk).detail.byGame.main.balances, before.main.balances);
  assert.equal(gameView(junk, 'main').betHistory, undefined);
  // Both at once, each with its own history
  const both = changeBets(main, { ...SIDE_SETTINGS.dots, auto: false, value: 3 }, 12, 'dots');
  assert.deepEqual(both.betHistory, main.betHistory);
  assert.deepEqual(betChanges(both).map(c => c.no), [10]);
  assert.deepEqual(betChanges(both, 'dots').map(c => c.no), [12]);
  // Junk: sandy on 1 at $1 (+2), greenie on 11 at $1 (before the change on 12)
  assert.deepEqual(roundResults(both).detail.byGame.dots.balances, { t: -2, m: -2, d: 4 });
  // A side key the round doesn't have changes nothing
  assert.equal(changeBets(base, { value: 9 }, 5, 'rabbit'), base);
});

test('bet lines, the by-game note and the round detail say when a side bet changed', () => {
  const r = changeBets(mk('nassau', ['t', 'm', 'd'], { skins: SKINS, dots: SIDE_SETTINGS.dots }), { ...SKINS, value: 3 }, 10, 'skins');
  assert.deepEqual(roundStakeLines(r).map(l => l.line), ['$5 / $5 / $5', '$3 a skin from hole 10', '$1 a dot']);
  assert.equal(betChangeNote(r, 'skins'), 'bet changed from hole 10');
  assert.equal(betChangeNote(r, 'dots'), '');
  assert.equal(betChangeNote(r, 'main'), '');
  assert.equal(betStretchLine(r, 'skins'), 'Skins: $2 a skin on holes 1–9, $3 a skin from hole 10.');
  const twice = changeBets(r, { ...SKINS, value: 1 }, 15, 'skins');
  assert.equal(betChangeNote(twice, 'skins'), 'bet changed on holes 10 and 15');
  assert.equal(betStretchLine(twice, 'skins'), 'Skins: $2 a skin on holes 1–9, $3 a skin on holes 10–14, $1 a skin from hole 15.');
  assert.equal(betStretchLine(changeBets(r, { ...SKINS, value: 3 }, 2, 'skins'), 'skins'), 'Skins: $2 a skin on hole 1, $3 a skin from hole 2.');
  // The main game uses its own summary
  const main = changeBets(r, { ...SETTINGS.nassau, back: 10 }, 10);
  assert.equal(betStretchLine(main, 'main'), 'Nassau: $5 / $5 / $5 on holes 1–9, $5 / $10 / $5 from hole 10.');
  // A round or meta without holes (a usual, a live invite) still reads
  assert.deepEqual(roundStakeLines({ game: 'nassau', settings: SETTINGS, sideGames: r.sideGames }).map(l => l.line)[1], '$3 a skin from hole 10');
  // The reveal still plays one step per side game
  assert.equal(revealSteps(r, roundResults(r)).steps.filter(s => s.key.startsWith('side-')).length, 2);
});

test('Run it back starts side games at the bets they ended on, with no history', () => {
  const r = changeBets(play(mk('nassau', ['t', 'm'], { skins: SKINS }), 18), { ...SKINS, value: 3 }, 10, 'skins');
  const state = { players: { t: { id: 't', name: 'T' }, m: { id: 'm', name: 'M' } }, courses: {}, me: 't', settings: SETTINGS };
  const s = rematchSetup(state, r);
  assert.deepEqual(s.sideGames, [{ game: 'skins', settings: { ...SKINS, value: 3 } }]);
});
