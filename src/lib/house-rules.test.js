// House rules added 2026-09-29: blind wolf, and the Hogan and Arnie junk dots. Hand-worked cases on a
// flat nine (par 4s, handicaps off), so every number can be checked on a napkin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, livePreview, changeBets, wolfHoleResult } from './round.js';
import { DOT_KINDS, DOT_PARS } from './games.js';
import { stakeSummary } from './stakes.js';
import { dotsNote, sideExample } from './side-games.js';
import { mergeSettings } from './settings.js';
import { revealSteps } from './reveal.js';
import { readFileSync } from 'node:fs';

const OLD_WOLF = { point: 2, loneMultiplier: 2 }; // a round made before blind wolf
const SETTINGS = {
  hcPct: 100,
  wolf: { point: 2, loneMultiplier: 2, blind: true, blindMultiplier: 3 },
  dots: { value: 1, auto: false, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: true } },
};
const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const P = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: ['Ann', 'Bo', 'Cy', 'Di'][i], index: 0 }));
function mk(game, { wolf = {}, dots = {}, sideGames = null } = {}) {
  const settings = { ...structuredClone(SETTINGS), wolf: { ...SETTINGS.wolf, ...wolf }, dots: { ...SETTINGS.dots, ...dots } };
  const r = createRound({ id: 'r', game, course, holesCount: 9, players: P, settings, hcPct: 100, useHandicaps: false });
  if (sideGames) r.sideGames = sideGames;
  return r;
}
/** Par for everyone on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
const zero = b => Math.round(Object.values(b).reduce((x, v) => x + v * 100, 0));

// ---------------------------------------------------------------------------
// Blind wolf

test('blind wolf wins and loses at 3× (the default): each of the three pays or gets 3 points', () => {
  const win = scores(mk('wolf'), 1, { 1: { a: 3 } });
  win.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  // $2 a point × 3 × three players: up $18
  assert.deepEqual(bal(win), { a: 18, b: -6, c: -6, d: -6 });
  const lose = scores(mk('wolf'), 1, { 1: { a: 5 } });
  lose.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  assert.deepEqual(bal(lose), { a: -18, b: 6, c: 6, d: 6 });
  assert.equal(zero(bal(win)), 0);
  assert.equal(zero(bal(lose)), 0);
});

test('blind wolf at 4×', () => {
  const r = scores(mk('wolf', { wolf: { blindMultiplier: 4 } }), 2, { 1: { a: 3 }, 2: { b: 6 } });
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true }, 2: { wolf: 'b', partner: null, blind: true } };
  // Hole 1: Ann wins 8 from each (+24). Hole 2: Bo loses 8 to each (-24).
  assert.deepEqual(bal(r), { a: 24 + 8, b: -8 - 24, c: -8 + 8, d: -8 + 8 });
  assert.equal(zero(bal(r)), 0);
});

test('a round saved with blind on but no multiplier reads as 3×', () => {
  const r = scores(mk('wolf'), 1, { 1: { a: 3 } });
  delete r.settings.wolf.blindMultiplier;
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  assert.deepEqual(bal(r), { a: 18, b: -6, c: -6, d: -6 });
});

test('the same scores: partner, lone and blind', () => {
  const on = { 1: { a: 3 } };
  const partner = scores(mk('wolf'), 1, on);
  partner.wolf = { 1: { wolf: 'a', partner: 'b' } };
  const lone = scores(mk('wolf'), 1, on);
  lone.wolf = { 1: { wolf: 'a', partner: null } };
  const blind = scores(mk('wolf'), 1, on);
  blind.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  assert.deepEqual(bal(partner), { a: 4, b: 4, c: -4, d: -4 });
  assert.deepEqual(bal(lone), { a: 12, b: -4, c: -4, d: -4 });
  assert.deepEqual(bal(blind), { a: 18, b: -6, c: -6, d: -6 });
  // A stray blind flag next to a partner is just a partner hole
  const odd = scores(mk('wolf'), 1, on);
  odd.wolf = { 1: { wolf: 'a', partner: 'b', blind: true } };
  assert.deepEqual(bal(odd), bal(partner));
  assert.equal(wolfHoleResult(odd, odd.holes[0]).blind, undefined);
  assert.equal(wolfHoleResult(blind, blind.holes[0]).blind, true);
});

test('a tied blind wolf hole pushes', () => {
  const r = scores(mk('wolf'), 1);
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
});

test('bets changed mid-round with blind wolf count from the next hole', () => {
  const r = scores(mk('wolf'), 3, { 1: { a: 3 }, 3: { c: 3 } });
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true }, 2: { wolf: 'b', partner: 'a' }, 3: { wolf: 'c', partner: null, blind: true } };
  // From hole 3: $4 a point, blind 4×. Hole 1 stays $2 at 3×.
  const c = changeBets(r, { point: 4, loneMultiplier: 2, blind: true, blindMultiplier: 4 }, 3);
  assert.deepEqual(bal(c), { a: 18 - 16, b: -6 - 16, c: -6 + 48, d: -6 - 16 });
  assert.equal(zero(bal(c)), 0);
  // "Whole round" prices every hole at the new bets
  const w = changeBets(r, { point: 4, loneMultiplier: 2, blind: true, blindMultiplier: 4 }, null);
  assert.deepEqual(bal(w), { a: 48 - 16, b: -16 - 16, c: -16 + 48, d: -16 - 16 });
  // Turning blind wolf off later leaves a hole already called blind as it was played
  const off = changeBets(r, { point: 2, loneMultiplier: 2, blind: false, blindMultiplier: 3 }, 3);
  assert.deepEqual(bal(off), bal(r));
});

test('blind wolf after a player leaves: the wolf plays the two still there', () => {
  const r = scores(mk('wolf'), 2, { 2: { b: 3 } });
  r.left = { d: 1 };
  delete r.scores[2].d;
  r.wolf = { 1: { wolf: 'a', partner: 'd' }, 2: { wolf: 'b', partner: null, blind: true } };
  // Hole 1 ties. Hole 2: Bo blind 3× against Ann and Cy, $6 from each
  assert.deepEqual(bal(r), { a: -6, b: 12, c: -6, d: 0 });
  assert.equal(zero(bal(r)), 0);
});

test('old wolf rounds pay exactly what they did: no blind keys, lone and partner holes', () => {
  const r = scores(mk('wolf'), 4, { 1: { a: 3 }, 2: { b: 5 }, 3: { c: 3, d: 3 }, 4: { d: 5 } });
  r.settings.wolf = { ...OLD_WOLF };
  r.wolf = { 1: { wolf: 'a', partner: null }, 2: { wolf: 'b', partner: null }, 3: { wolf: 'c', partner: 'd' }, 4: { wolf: 'd', partner: 'a' } };
  // 1: Ann lone wins 4 from each. 2: Bo lone loses 4 to each. 3: Cy and Di win 2 from each of Ann and Bo.
  // 4: Di and Ann tie Bo and Cy on best ball (Ann's 4), a push.
  assert.deepEqual(bal(r), { a: 12 + 4 - 4, b: -4 - 12 - 4, c: -4 + 4 + 4, d: -4 + 4 + 4 });
  assert.equal(zero(bal(r)), 0);
  // Same money with the new defaults on the round, as long as nobody called blind
  const n = structuredClone(r);
  n.settings.wolf = { ...SETTINGS.wolf, blindMultiplier: 4 };
  assert.deepEqual(bal(n), bal(r));
});

test('the live preview and the saved hole agree on a blind wolf', () => {
  const r = scores(mk('wolf'), 1);
  const hole = r.holes[1];
  const pending = { scores: { a: 3, b: 4, c: 4, d: 4 }, wolf: { wolf: 'b', partner: null, blind: true } };
  // Ann's birdie beats Bo, the blind wolf: he pays each of the three $6
  assert.deepEqual(livePreview(r, hole, pending).delta, { a: 6, b: -18, c: 6, d: 6 });
  // Bo makes the birdie instead
  pending.scores = { a: 4, b: 3, c: 4, d: 4 };
  assert.deepEqual(livePreview(r, hole, pending).delta, { a: -6, b: 18, c: -6, d: -6 });
  r.scores[2] = pending.scores;
  r.wolf[2] = pending.wolf;
  assert.deepEqual(bal(r), { a: -6, b: 18, c: -6, d: -6 });
});

test('the reveal names a blind wolf', () => {
  const r = scores(mk('wolf'), 1, { 1: { a: 3 } });
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true } };
  r.status = 'done';
  const steps = revealSteps(r, roundResults(r))?.steps || [];
  assert.ok(steps.some(s => /blind wolf/.test(typeof s.text === 'function' ? s.text('a') : String(s.text))), JSON.stringify(steps));
});

test('the bets line says blind wolf when it is on', () => {
  assert.equal(stakeSummary('wolf', { wolf: SETTINGS.wolf }), '$2 a point · lone wolf 2× · blind 3×');
  assert.equal(stakeSummary('wolf', { wolf: { ...SETTINGS.wolf, blindMultiplier: 4 } }), '$2 a point · lone wolf 2× · blind 4×');
  assert.equal(stakeSummary('wolf', { wolf: OLD_WOLF }), '$2 a point · lone wolf 2×');
  assert.equal(stakeSummary('wolf', { wolf: { ...SETTINGS.wolf, blind: false } }), '$2 a point · lone wolf 2×');
});

test('new rounds default to blind wolf on at 3×, Hogan and Arnie off', () => {
  // store.js needs the browser, so read its defaults as text
  const src = readFileSync(new URL('./store.js', import.meta.url), 'utf8');
  assert.match(src, /wolf: \{ point: 2, loneMultiplier: 2, blind: true, blindMultiplier: 3 \}/);
  assert.match(src, /arnie: false, hogan: false \}/);
});

// ---------------------------------------------------------------------------
// Hogan and Arnie

test('Hogan and Arnie are dots on par 4s and 5s', () => {
  assert.equal(DOT_KINDS.hogan.name, 'Hogan');
  assert.match(DOT_KINDS.hogan.help, /fairway and the green in regulation/);
  assert.match(DOT_KINDS.arnie.help, /Par or better without ever being on the fairway/);
  assert.deepEqual(DOT_PARS.hogan, [4, 5]);
  assert.deepEqual(DOT_PARS.arnie, [4, 5]);
});

test('a Hogan pays when Hogans are on, and not when they are off', () => {
  const on = scores(mk('dots'), 2);
  on.marks = { 1: { a: ['hogan'] }, 2: { b: ['hogan', 'sandy'] } };
  // Ann: 1 dot, $1 from each of three. Bo: 2 dots, $2 from each of three.
  assert.deepEqual(bal(on), { a: 3 - 2, b: -1 + 6, c: -1 - 2, d: -1 - 2 });
  assert.equal(zero(bal(on)), 0);
  const off = scores(mk('dots', { dots: { kinds: { ...SETTINGS.dots.kinds, hogan: false } } }), 2);
  off.marks = structuredClone(on.marks);
  assert.deepEqual(bal(off), { a: -1, b: 3, c: -1, d: -1 });
});

test('an old Junk round (no Hogan key, no Hogan marks) pays the same', () => {
  const r = scores(mk('dots'), 2);
  r.settings.dots = { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } };
  r.scores[2].c = 3;
  r.marks = { 1: { a: ['sandy'], b: ['arnie'] } };
  // Ann's sandy and Cy's birdie count; Bo's Arnie is off in this round
  assert.deepEqual(bal(r), { a: 3 - 1, b: -1 - 1, c: -1 + 3, d: -1 - 1 });
});

test('Junk as a side game counts a Hogan', () => {
  const r = scores(mk('wolf'), 2, { 1: { a: 3 } });
  r.sideGames = [{ game: 'dots', settings: { value: 2, auto: false, kinds: { greenie: true, hogan: true } } }];
  r.wolf = { 1: { wolf: 'a', partner: null, blind: true }, 2: { wolf: 'b', partner: 'c' } };
  r.marks = { 2: { d: ['hogan'] } };
  const res = roundResults(r);
  assert.deepEqual(res.detail.byGame.dots.balances, { a: -2, b: -2, c: -2, d: 6 });
  assert.deepEqual(res.detail.byGame.main.balances, { a: 18, b: -6, c: -6, d: -6 });
  assert.deepEqual(res.balances, { a: 16, b: -8, c: -8, d: 0 });
  assert.equal(zero(res.balances), 0);
  // With Hogans off in the side game the mark is ignored
  r.sideGames[0].settings.kinds.hogan = false;
  assert.deepEqual(roundResults(r).detail.byGame.dots.balances, { a: 0, b: 0, c: 0, d: 0 });
});

test('setup words for Arnie and Hogan', () => {
  assert.equal(dotsNote({ greenie: true }), '');
  assert.equal(dotsNote({ hogan: true }), 'Hogan: par or better after hitting the fairway and the green in regulation. Par 4s and 5s only.');
  assert.match(dotsNote({ arnie: true, hogan: true }), /^Arnie: .* Hogan: .* Par 4s and 5s only\.$/);
  assert.equal(sideExample('dots', { value: 1, kinds: { hogan: true } }), 'Hogans. One hogan in a foursome: the other 3 each pay you $1.');
});

// ---------------------------------------------------------------------------
// Saved defaults: an older profile never wipes a new house rule

test('mergeSettings lays saved defaults over the phone’s, game by game', () => {
  const phone = { theme: 'system', skins: { value: 2, carryover: true }, wolf: { point: 2, loneMultiplier: 2, blind: true, blindMultiplier: 3 }, dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false, hogan: false } } };
  const saved = { rev: 3, theme: 'dark', wolf: { point: 5, loneMultiplier: 3 }, dots: { value: 2, auto: true, kinds: { greenie: false, sandy: true, barkie: true, chipin: true, polie: true, arnie: true } } };
  const m = mergeSettings(phone, saved);
  assert.deepEqual(m.wolf, { point: 5, loneMultiplier: 3, blind: true, blindMultiplier: 3 });
  assert.equal(m.dots.kinds.hogan, false);
  assert.equal(m.dots.kinds.arnie, true);
  assert.equal(m.dots.kinds.greenie, false);
  assert.equal(m.theme, 'dark');
  assert.deepEqual(m.skins, phone.skins);
  // Nothing saved: the phone's as they are
  assert.deepEqual(mergeSettings(phone, undefined), phone);
});

// ---------------------------------------------------------------------------
// Review: randomized checks (seeded, so a failure repeats)

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

test('random wolf rounds: a blind hole is the lone hole at the blind multiplier, and balances sum to zero', () => {
  const rnd = rng(42);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pickOf = a => a[Math.floor(rnd() * a.length)];
  for (let t = 0; t < 300; t++) {
    const n = int(3, 5);
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, index: int(0, 18) }));
    const point = pickOf([1, 2, 0.25, 0.35, 1.5]);
    const loneMultiplier = pickOf([2, 3]), blindMultiplier = pickOf([3, 4, undefined]);
    const wolf = { point, loneMultiplier, blind: true, ...(blindMultiplier ? { blindMultiplier } : {}) };
    const r = createRound({ id: 'x', game: 'wolf', course, holesCount: 9, players, settings: { hcPct: 100, wolf }, hcPct: 100, useHandicaps: rnd() < 0.5 });
    if (rnd() < 0.25) r.left = { [`p${n - 1}`]: int(0, 8) };
    const played = int(1, 9);
    r.holes.slice(0, played).forEach((h, i) => {
      const gone = id => r.left?.[id] != null && h.no > r.left[id];
      r.scores[h.no] = Object.fromEntries(players.filter(p => !gone(p.id)).map(p => [p.id, int(2, 7)]));
      const on = Object.keys(r.scores[h.no]);
      const w = on[i % on.length];
      const lone = rnd() < 0.5;
      r.wolf[h.no] = lone ? { wolf: w, partner: null, ...(rnd() < 0.5 ? { blind: true } : {}) } : { wolf: w, partner: pickOf(on.filter(id => id !== w)) };
    });
    const res = roundResults(r);
    assert.ok(zero(res.balances) === 0, `sum ${JSON.stringify(res.balances)}`);
    for (const h of r.holes.slice(0, played)) {
      const setup = r.wolf[h.no];
      const got = wolfHoleResult(r, h);
      if (!got) continue;
      assert.ok(zero(got.deltas) === 0);
      if (!setup.blind) continue;
      const plain = structuredClone(r);
      delete plain.wolf[h.no].blind;
      const base = wolfHoleResult(plain, h);
      const k = (blindMultiplier ?? 3) / loneMultiplier;
      for (const id of Object.keys(got.deltas)) assert.ok(Math.abs(got.deltas[id] - base.deltas[id] * k) < 1e-9, `hole ${h.no} ${id}`);
    }
  }
});

test('random old wolf rounds: new default keys on the round never move money unless blind was called', () => {
  const rnd = rng(7);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let t = 0; t < 200; t++) {
    const r = scores(mk('wolf'), 9);
    r.settings.wolf = { point: int(1, 5), loneMultiplier: 2 + int(0, 1) };
    r.holes.forEach((h, i) => {
      for (const p of P) r.scores[h.no][p.id] = int(3, 6);
      const w = P[i % 4].id;
      r.wolf[h.no] = { wolf: w, partner: rnd() < 0.4 ? null : P[(i + 1 + int(0, 2)) % 4].id === w ? null : P[(i + 1 + int(0, 2)) % 4].id };
    });
    const before = bal(r);
    const n = structuredClone(r);
    n.settings.wolf = { ...n.settings.wolf, blind: true, blindMultiplier: 4 };
    assert.deepEqual(bal(n), before);
  }
});
