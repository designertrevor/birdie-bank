// Field skins in the Big Game (big-game.js skinsBoard, skinsMoney, skinsNow), with the house rules
// added 2026-10-08: what's carried past the last hole (shared by every skin, the last-hole ties, or
// paid back), Canadian skins, validate with a net par, and birdies win two skins.
//
// The money check:
// 1. Old money unchanged: a game without the new rules pays exactly what the code before them paid
//    (a frozen copy of it below) on thousands of random fields, carries on and off.
// 2. An oracle: a plain, separate working of field skins from the raw scores, with exact integer
//    cents, compared to the cent with the real code on thousands of seeded random fields (2 to 6
//    groups of 2 to 4, 9 and 18 holes, missing scores, pickups, players leaving and joining, gross and
//    net with strokes, every house rule), and every field's money adds up to $0.
// 3. Ties, carries, a pot that doesn't split evenly and a player who drops out, by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allot, bigField, bigLines, bigResults, cleanBig, scoreOn, skinsBoard, skinsMoney, skinsNow, skinsPlayers, skinsRulesLine,
} from './big-game.js';

// --------------------------- Fields ------------------------------------------------

/** A seeded random number generator (mulberry32), so every run sees the same fields. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A field from a plain description: `groups` [{ players: [{ id, hc }], scores: { no: { id: score } },
 * left?: { id: no }, joined?: { id: no } }], `holes` [{ no, par, rank }]. Every group finished.
 */
function makeField({ groups, holes, skins, useHandicaps = true, hcPct = 100, ended = false }) {
  const people = {};
  for (const g of groups) for (const p of g.players) people[p.id] = { name: p.id, hc: p.hc };
  const big = cleanBig({
    v: 1, hcPct, useHandicaps, people,
    groups: groups.map((g, i) => ({ id: `g${i}`, name: `Group ${i + 1}`, players: g.players.map(p => p.id) })),
    pot: { on: false }, teams: { on: false }, bets: [], skins: { on: true, ...skins },
    ...(ended ? { endedAt: 1, frozen: Object.fromEntries(groups.map((g, i) => [`g${i}`, g.frozen]).filter(([, f]) => f)) } : {}),
  });
  const cards = {};
  groups.forEach((g, i) => {
    cards[`g${i}`] = {
      id: `r${i}`, status: g.done === false ? 'active' : 'done',
      players: g.players.map(p => ({ id: p.id, name: p.id, courseHc: p.hc })),
      holes: holes.map(h => ({ ...h, hdcp: h.rank })),
      scores: g.scores, left: g.left || {}, joined: g.joined || {},
    };
  });
  const field = bigField(big, g => cards[g.id], { ended });
  return { big, field };
}

const PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];

/** A random field: its plain description and the house rules. */
function randomSpec(seed) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const n = r() < 0.5 ? 9 : 18;
  const ranks = Array.from({ length: n }, (_, i) => i + 1).sort(() => r() - 0.5);
  const holes = Array.from({ length: n }, (_, i) => ({ no: i + 1, par: PARS[i], rank: ranks[i] }));
  const groupN = 2 + Math.floor(r() * 5);
  let k = 0;
  // Some fields score wildly (few ties), some tightly (ties everywhere)
  const spread = pick([[0, 1], [-1, 0, 0, 1], [-2, -1, 0, 0, 0, 1, 1, 2, 3], [-1, 0, 1, 2]]);
  const groups = [];
  for (let gi = 0; gi < groupN; gi++) {
    const size = 2 + Math.floor(r() * 3);
    const players = Array.from({ length: size }, () => ({ id: `p${k++}`, hc: r() < 0.1 ? -Math.floor(r() * 4) : Math.floor(r() * 30) }));
    const left = {}, joined = {};
    for (const p of players) {
      if (r() < 0.1) left[p.id] = Math.floor(r() * n); // after hole 0 (before the first) to n - 1
      else if (r() < 0.05) joined[p.id] = 2 + Math.floor(r() * (n - 2));
    }
    const scores = {};
    for (const h of holes) {
      scores[h.no] = {};
      for (const p of players) {
        const x = r();
        if (x < 0.03) continue; // never scored
        scores[h.no][p.id] = x < 0.05 ? 'X' : Math.max(1, h.par + pick(spread));
      }
    }
    groups.push({ players, scores, left, joined });
  }
  const all = groups.flatMap(g => g.players.map(p => p.id));
  const out = r() < 0.2 ? all.filter(() => r() < 0.2) : [];
  const skins = {
    kind: pick(['net', 'gross']), stake: pick([1, 2, 5, 7.5, 10, 13.33, 20, 0.01]), carry: r() < 0.5, out,
    leftover: pick(['share', 'split', 'back']),
    canadian: r() < 0.4, validate: r() < 0.4, birdieDouble: r() < 0.4, exact: true,
  };
  // Now and then the organizer closes the game with a group still out there, thru some hole: only the
  // holes it had scored count (a later score never moves the money)
  let ended = false;
  if (r() < 0.12) {
    ended = true;
    const g = groups[0];
    const thru = Math.floor(r() * n);
    g.done = false;
    for (const h of holes) if (h.no > thru) g.scores[h.no] = {};
    g.frozen = holes.filter(h => Object.keys(g.scores[h.no]).length).map(h => h.no);
    // A score put in after the close is on the card but not in the frozen holes
    if (thru < n) g.scores[thru + 1] = Object.fromEntries(g.players.map(p => [p.id, 1]));
    g.late = thru + 1;
  }
  return { groups, holes, skins, useHandicaps: r() < 0.8, hcPct: pick([100, 95, 90, 80, 85]), ended };
}

// --------------------------- The oracle ---------------------------------------------

/**
 * Field skins worked out plainly, straight from the description, never from big-game.js: each
 * player's money in cents ({ id: cents }) for everyone in the skins, or null when there are no skins.
 */
function oracle(spec) {
  const { groups, holes, skins } = spec;
  const N = holes.length;
  const roster = [];
  for (const g of groups) for (const p of g.players) if (!skins.out.includes(p.id)) roster.push({ ...p, g });
  const stake = Math.round(skins.stake * 100);
  if (roster.length < 2 || !stake) return null;
  const pool = stake * roster.length;

  // A player's score on the hole at index i: null when they have none (not scored, not on the card then)
  const scoreAt = (p, i) => {
    const h = holes[i];
    const left = p.g.left?.[p.id];
    if (left != null && i + 1 > left) return null;
    const joined = p.g.joined?.[p.id];
    if (joined != null && i + 1 < joined) return null;
    if (p.g.late === h.no) return null; // scored after the game was closed
    const raw = p.g.scores[h.no]?.[p.id];
    if (raw == null) return null;
    let strokes = 0;
    const playing = spec.useHandicaps ? Math.round(p.hc * spec.hcPct / 100) : 0;
    if (playing > 0) {
      strokes = Math.floor(playing / N);
      if (h.rank <= playing % N) strokes += 1;
    } else if (playing < 0) {
      // A plus handicap gives strokes back on the easiest holes first
      const give = -playing;
      strokes = -Math.floor(give / N);
      if (h.rank > N - (give % N)) strokes -= 1;
    }
    const gross = raw === 'X' ? h.par + 2 + Math.max(0, strokes) : raw;
    return { gross, net: gross - strokes, par: h.par };
  };

  // Each hole on its own: who won it (and whether with a birdie), or a tie, or nobody played it
  const holeOutcome = i => {
    const h = holes[i];
    const in_ = roster.map(p => ({ p, s: scoreAt(p, i) })).filter(x => x.s);
    if (!in_.length) return { kind: 'none' };
    const val = x => (skins.kind === 'gross' ? x.s.gross : x.s.net);
    const low = Math.min(...in_.map(val));
    let lows = in_.filter(x => val(x) === low);
    if (lows.length > 1 && skins.canadian && skins.kind === 'net' && low < h.par) {
      const natural = lows.filter(x => x.s.gross < x.s.par);
      if (natural.length) {
        const best = Math.min(...natural.map(x => x.s.gross));
        const at = natural.filter(x => x.s.gross === best);
        if (at.length === 1) lows = at;
      }
    }
    if (lows.length > 1) return { kind: 'tie', tied: lows.map(x => x.p.id) };
    const w = lows[0];
    return { kind: 'win', who: w.p.id, birdie: !!skins.birdieDouble && w.s.gross < w.s.par };
  };
  const outcomes = holes.map((_, i) => holeOutcome(i));
  // Validate: a skin stands unless its winner plays the next hole over net par (the last hole's always stands)
  for (let i = 0; i < N - 1; i++) {
    const o = outcomes[i];
    if (o.kind !== 'win' || !skins.validate) continue;
    const p = roster.find(x => x.id === o.who);
    const next = scoreAt(p, i + 1);
    if (next && next.net > next.par) outcomes[i] = { kind: 'lost' };
  }

  const count = {};
  const order = [];
  for (const o of outcomes) {
    if (o.kind !== 'win') continue;
    if (!(o.who in count)) { count[o.who] = 0; order.push(o.who); }
    count[o.who] += o.birdie ? 2 : 1;
  }
  const totalSkins = Object.values(count).reduce((a, x) => a + x, 0);
  const result = {};
  if (!totalSkins) {
    for (const p of roster) result[p.id] = 0;
    return result;
  }
  // Weights as whole numbers (scaled by a common denominator), in the order the cents are handed out
  let weights;
  if (!skins.carry) weights = order.map(id => [id, count[id]]);
  else {
    const units = {};
    let riding = 0;
    for (const o of outcomes) {
      riding += 1;
      if (o.kind === 'win') { units[o.who] = (units[o.who] || 0) + riding + (o.birdie ? 1 : 0); riding = 0; }
    }
    const L = riding;
    const last = outcomes[N - 1];
    const rule = skins.leftover;
    if (rule === 'split' && L && last.kind === 'tie') {
      const k = last.tied.length;
      const w = new Map(order.map(id => [id, units[id] * k]));
      for (const id of roster.map(p => p.id)) if (last.tied.includes(id)) w.set(id, (w.get(id) || 0) + L);
      weights = [...w];
    } else if (rule === 'back' && L) {
      const n = roster.length;
      const w = new Map(order.map(id => [id, units[id] * n]));
      for (const p of roster) w.set(p.id, (w.get(p.id) || 0) + L);
      weights = [...w];
    } else weights = order.map(id => [id, units[id] * totalSkins + count[id] * L]);
  }
  // Exact shares in cents: rounded down, then a cent each to the biggest remainders, ties in order
  const W = weights.reduce((a, [, w]) => a + w, 0);
  const parts = weights.map(([id, w], i) => ({ id, cents: Math.floor((pool * w) / W), rem: (pool * w) % W, i }));
  let spare = pool - parts.reduce((a, x) => a + x.cents, 0);
  for (const x of [...parts].sort((a, b) => b.rem - a.rem || a.i - b.i)) { if (!spare) break; x.cents++; spare--; }
  for (const p of roster) result[p.id] = -stake;
  for (const x of parts) result[x.id] += x.cents;
  return result;
}

// --------------------------- The code before the house rules (frozen 2026-10-08) -----------

function oldSkinsBoard(big, field) {
  const ids = skinsPlayers(big);
  const out = [];
  let carry = 0;
  for (const h of field.holes) {
    const scores = ids.map(id => ({ id, s: scoreOn(field, id, h.no) }));
    if (scores.some(x => x.s == null)) { out.push({ no: h.no, state: 'open', winner: null, score: null, tied: [], carry: 0 }); continue; }
    const live = scores.filter(x => !x.s.out).map(x => ({ id: x.id, v: big.skins.kind === 'gross' ? x.s.gross : x.s.net }));
    const worth = 1 + (big.skins.carry ? carry : 0);
    if (!live.length) { out.push({ no: h.no, state: 'none', winner: null, score: null, tied: [], carry: worth }); carry = big.skins.carry ? carry + 1 : 0; continue; }
    const low = Math.min(...live.map(x => x.v));
    const at = live.filter(x => x.v === low);
    if (at.length === 1) { out.push({ no: h.no, state: 'won', winner: at[0].id, score: low, tied: [], carry: worth }); carry = 0; }
    else { out.push({ no: h.no, state: 'tied', winner: null, score: low, tied: at.map(x => x.id), carry: worth }); carry = big.skins.carry ? carry + 1 : 0; }
  }
  return out;
}

function oldSkinsMoney(big, field, board = oldSkinsBoard(big, field)) {
  const ids = skinsPlayers(big);
  const stake = Math.round((Number(big.skins.stake) || 0) * 100);
  const skins = {};
  for (const h of board) if (h.state === 'won') skins[h.winner] = (skins[h.winner] || 0) + 1;
  if (!big.skins.on || !stake || ids.length < 2) return { pool: 0, skins, won: {}, balances: {}, perSkin: 0, leftover: 0 };
  const pool = stake * ids.length;
  const total = Object.values(skins).reduce((a, n) => a + n, 0);
  let won;
  let leftover = 0;
  if (!total) won = Object.fromEntries(ids.map(id => [id, stake]));
  else if (!big.skins.carry) won = allot(pool, Object.entries(skins).map(([id, n]) => ({ id, w: n })));
  else {
    const decided = board.filter(h => h.state !== 'open');
    const units = {};
    for (const h of decided) if (h.state === 'won') units[h.winner] = (units[h.winner] || 0) + h.carry;
    const last = decided.at(-1);
    leftover = last && last.state !== 'won' ? last.carry : 0;
    const w = Object.entries(units).map(([id, u]) => ({ id, w: u + (skins[id] * leftover) / total }));
    won = allot(pool, w);
  }
  const balances = Object.fromEntries(ids.map(id => [id, (won[id] || 0) - stake]));
  return { pool, skins, won, balances, perSkin: total ? Math.round(pool / total) : 0, leftover };
}

const sum = o => Object.values(o).reduce((a, x) => a + x, 0);
const SIMS = 4000;

// --------------------------- 1. Old money unchanged ----------------------------------------

test(`old money: a game without the new house rules pays exactly what it did, ${SIMS} random fields`, t => {
  let carried = 0, plain = 0, live = 0, drift = 0;
  for (let seed = 1; seed <= SIMS; seed++) {
    const spec = randomSpec(seed);
    // The game as saved before the house rules: no leftover, canadian, validate or birdieDouble keys
    const { kind, stake, carry, out } = spec.skins;
    const old = { ...spec, skins: { kind, stake, carry, out } };
    // Every few fields, one group still playing, so the live boards are the same too
    if (seed % 5 === 0) { old.groups = old.groups.map((g, i) => (i ? g : { ...g, done: false })); live++; }
    const { big, field } = makeField(old);
    assert.equal(Object.keys(big.skins).sort().join(), 'carry,kind,on,out,stake', 'the saved game has no new keys');
    assert.deepEqual(skinsBoard(big, field).map(h => [h.no, h.state, h.winner, h.score, h.tied, h.carry]), oldSkinsBoard(big, field).map(h => [h.no, h.state, h.winner, h.score, h.tied, h.carry]), `seed ${seed}`);
    const m = skinsMoney(big, field);
    assert.deepEqual(m, oldSkinsMoney(big, field), `seed ${seed}`);
    if (carry) carried++; else plain++;
    // Against the oracle: the same to the cent but where two remainders tie and the floating split
    // hands the spare cent to the other one of them, never more than a cent, and still $0 in all
    if (seed % 5) {
      const want = oracle({ ...old, skins: { ...old.skins, leftover: 'share' } });
      if (!want) continue;
      assert.equal(sum(m.balances), 0);
      const off = Object.keys(want).filter(id => m.balances[id] !== want[id]);
      assert.ok(off.every(id => Math.abs(m.balances[id] - want[id]) === 1), `seed ${seed}`);
      if (off.length) drift++;
    }
  }
  assert.ok(carried > 1000 && plain > 1000 && live > 500);
  t.diagnostic(`old games: ${SIMS} fields the same as before; ${drift} of them a cent apart from the exact split on a tied remainder (kept, so their money never moves)`);
});

// --------------------------- 2. The oracle ----------------------------------------------

test(`oracle: field skins to the cent on ${SIMS} random fields, every house rule, adding up to $0`, t => {
  const seen = { carry: 0, plain: 0, net: 0, gross: 0, split: 0, back: 0, share: 0, canadian: 0, validate: 0, birdieDouble: 0, lost: 0, birdie: 0, canadianWin: 0, left: 0, odd: 0, refund: 0, ended: 0, groups: new Set(), holes: new Set() };
  for (let seed = 10001; seed < 10001 + SIMS; seed++) {
    const spec = randomSpec(seed);
    const { big, field } = makeField(spec);
    assert.ok(field.final);
    const m = skinsMoney(big, field);
    const want = oracle(spec);
    if (!want) { assert.deepEqual(m.balances, {}, `seed ${seed}`); continue; }
    assert.deepEqual(m.balances, want, `seed ${seed}`);
    assert.equal(sum(m.balances), 0, `seed ${seed} adds up to $0`);
    // And through the whole game: the settle-up lines square everyone's skins money
    const res = bigResults(big, field);
    const back = {};
    for (const l of bigLines(res.balances)) { back[l.from] = (back[l.from] || 0) - l.cents; back[l.to] = (back[l.to] || 0) + l.cents; }
    for (const [id, c] of Object.entries(want)) assert.equal(back[id] || 0, c, `seed ${seed} settle ${id}`);
    // What we covered
    const board = skinsBoard(big, field);
    seen[spec.skins.carry ? 'carry' : 'plain']++;
    seen[spec.skins.kind]++;
    if (spec.skins.carry) seen[spec.skins.leftover]++;
    for (const r of ['canadian', 'validate', 'birdieDouble']) if (spec.skins[r]) seen[r]++;
    if (board.some(h => h.state === 'lost')) seen.lost++;
    if (board.some(h => h.birdie)) seen.birdie++;
    if (board.some(h => h.canadian)) seen.canadianWin++;
    if (spec.groups.some(g => Object.keys(g.left).length)) seen.left++;
    if (spec.ended) seen.ended++;
    if (Object.values(m.won).some(c => c % 100)) seen.odd++;
    if (Object.values(m.balances).every(c => c === 0)) seen.refund++;
    seen.groups.add(spec.groups.length); seen.holes.add(spec.holes.length);
  }
  for (const k of ['carry', 'plain', 'net', 'gross', 'split', 'back', 'share', 'canadian', 'validate', 'birdieDouble', 'lost', 'birdie', 'canadianWin', 'left', 'odd', 'refund', 'ended']) assert.ok(seen[k] >= 20, `${k}: ${seen[k]}`);
  assert.deepEqual([...seen.groups].sort(), [2, 3, 4, 5, 6]);
  assert.deepEqual([...seen.holes].sort((a, b) => a - b), [9, 18]);
  t.diagnostic(`oracle: ${SIMS} fields, ${JSON.stringify({ ...seen, groups: undefined, holes: undefined })}`);
});

// --------------------------- 3. By hand ----------------------------------------------

const H9 = Array.from({ length: 9 }, (_, i) => ({ no: i + 1, par: 4, rank: i + 1 }));
/** Two or three groups, everyone a 4 on every hole but `odd`: { no: { id: score } }. Scratch players. */
function handField(skins, odd = {}, { ids = [['a', 'b'], ['c', 'd'], ['e', 'f']], left = {}, hc = {}, holes = H9 } = {}) {
  const groups = ids.map(list => ({
    players: list.map(id => ({ id, hc: hc[id] || 0 })),
    scores: Object.fromEntries(holes.map(h => [h.no, Object.fromEntries(list.map(id => [id, odd[h.no]?.[id] ?? 4]).filter(([id]) => odd[h.no]?.[id] !== null))])),
    left: Object.fromEntries(Object.entries(left).filter(([id]) => list.includes(id))),
  }));
  const spec = { groups, holes, skins: { kind: 'net', stake: 10, carry: false, out: [], exact: true, ...skins }, useHandicaps: true, hcPct: 100 };
  return { spec, ...makeField(spec) };
}

test('ties: a two-way tie across two groups is no skin, and a tie on every hole pays everyone back', () => {
  // Ann (group 1) and Eve (group 3) both make 3 on hole 2; Cal alone a 3 on 5
  const { big, field, spec } = handField({}, { 2: { a: 3, e: 3 }, 5: { c: 3 } });
  const board = skinsBoard(big, field);
  assert.deepEqual([board[1].state, board[1].tied], ['tied', ['a', 'e']]);
  const m = skinsMoney(big, field);
  assert.deepEqual(m.balances, { a: -1000, b: -1000, c: 5000, d: -1000, e: -1000, f: -1000 }, 'the one skin takes the $60 pot');
  assert.deepEqual(m.balances, oracle(spec));
  // Everyone a 4 everywhere: nine ties, nobody wins, everyone gets theirs back (with carries too, any leftover rule)
  for (const skins of [{}, { carry: true }, { carry: true, leftover: 'split' }, { carry: true, leftover: 'back' }]) {
    const flat = handField(skins);
    assert.ok(skinsBoard(flat.big, flat.field).every(h => h.state === 'tied'));
    assert.ok(Object.values(skinsMoney(flat.big, flat.field).balances).every(c => c === 0));
  }
});

test('carries: a tie carries into the last hole, and what’s carried past it goes by its rule', () => {
  // Ties on 1 to 8, Bob alone a 3 on 9: his skin takes all nine holes
  const into = handField({ carry: true }, { 9: { b: 3 } });
  const last = skinsBoard(into.big, into.field).at(-1);
  assert.deepEqual([last.winner, last.carry], ['b', 9]);
  assert.equal(skinsMoney(into.big, into.field).balances.b, 5000);

  // Ann alone on 1, Cal alone on 2, then ties to the end: 7 holes carried past the last
  // (Dave and Eve tied for low on 9 at 3). $60 pot, $60 / 9 holes a hole.
  const odd = { 1: { a: 3 }, 2: { c: 3 }, 9: { d: 3, e: 3 } };
  const share = handField({ carry: true }, odd);
  const ms = skinsMoney(share.big, share.field);
  assert.equal(ms.leftover, 7);
  // Shared by every skin: each skin 1 hole + 3.5 carried = $30 each
  assert.deepEqual(ms.balances, { a: 2000, b: -1000, c: 2000, d: -1000, e: -1000, f: -1000 });
  // Last-hole ties: Dave and Eve share the 7 holes; Ann and Cal one hole each ($6.67)
  const split = handField({ carry: true, leftover: 'split' }, odd);
  const mp = skinsMoney(split.big, split.field);
  assert.deepEqual(mp.won, { a: 667, c: 667, d: 2333, e: 2333 });
  assert.equal(sum(mp.balances), 0);
  // Paid back: the 7 holes ($46.67) back to all six: $7.78 each (7/54 of the pot, $7.777...), and
  // Ann and Cal $14.44 (13/54, $14.444...), the four spare cents to the four biggest remainders
  const back = handField({ carry: true, leftover: 'back' }, odd);
  const mb = skinsMoney(back.big, back.field);
  assert.deepEqual(mb.won, { a: 1444, c: 1444, b: 778, d: 778, e: 778, f: 778 });
  assert.equal(sum(mb.balances), 0);
  for (const f of [share, split, back]) assert.deepEqual(skinsMoney(f.big, f.field).balances, oracle(f.spec));
  // Last-hole ties but nobody played the last hole: shared by every skin instead
  const gone = handField({ carry: true, leftover: 'split' }, { 1: { a: 3 }, 2: { c: 3 }, 9: { a: null, b: null, c: null, d: null, e: null, f: null } });
  assert.equal(skinsBoard(gone.big, gone.field).at(-1).state, 'none');
  assert.deepEqual(skinsMoney(gone.big, gone.field).balances, { a: 2000, b: -1000, c: 2000, d: -1000, e: -1000, f: -1000 });
});

test('a pot that doesn’t split evenly: rounded down, spare cents to the biggest remainders, ties to whoever won a skin first', () => {
  // $10 each from ten players, a $100 pot over three skins: $33.33 each, a cent spare
  const ids = [['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i', 'j']];
  const odd = { 3: { c: 3 }, 1: { h: 3 }, 6: { a: 3 } };
  const f = handField({ stake: 10 }, odd, { ids });
  const m = skinsMoney(f.big, f.field);
  // Hal won first (hole 1), so the spare cent is his
  assert.deepEqual(m.won, { h: 3334, c: 3333, a: 3333 });
  assert.equal(sum(m.balances), 0);
  assert.deepEqual(m.balances, oracle(f.spec));
  // A cent each from five players and two skins: 5 cents, 2.5 each, the spare one to the first skin (Eve's, on 1)
  const tiny = handField({ stake: 0.01 }, { 2: { b: 3 }, 1: { e: 3 } }, { ids: [['a', 'b'], ['c', 'd'], ['e']] });
  assert.deepEqual(skinsMoney(tiny.big, tiny.field).won, { e: 3, b: 2 });
  assert.deepEqual(skinsMoney(tiny.big, tiny.field).balances, oracle(tiny.spec));
  // A game from before keeps its floating split: here the same, as it is unless two remainders tie
  const before = handField({ stake: 0.01, exact: false }, { 2: { b: 3 }, 1: { e: 3 } }, { ids: [['a', 'b'], ['c', 'd'], ['e']] });
  assert.deepEqual(skinsMoney(before.big, before.field).won, { e: 3, b: 2 });
  assert.equal(skinsRulesLine({ carry: true, leftover: 'back', kind: 'net', canadian: true, validate: true, birdieDouble: true }),
    'ties carry, and what’s carried past the last hole is paid back · a natural birdie beats a net one · a skin holds with net par on the next hole · a birdie wins two skins');
});

test('a player who drops out mid-round keeps the skins they won, pays in, and plays for nothing after', () => {
  // Bob wins 2, leaves after 4; on 6 he'd have a 2 on the card, but he's gone, so Fay's 3 takes it
  const f = handField({ carry: true }, { 2: { b: 3 }, 6: { b: 2, f: 3 } }, { left: { b: 4 } });
  const board = skinsBoard(f.big, f.field);
  assert.deepEqual(board.filter(h => h.state === 'won').map(h => [h.no, h.winner]), [[2, 'b'], [6, 'f']]);
  const m = skinsMoney(f.big, f.field);
  assert.equal(m.balances.b + 1000 > 0, true, 'Bob still collects for his skin');
  assert.equal(sum(m.balances), 0);
  assert.deepEqual(m.balances, oracle(f.spec));
  // Validate: Bob won 4 and left, so he never plays 5 and keeps it
  const v = handField({ validate: true }, { 4: { b: 3 } }, { left: { b: 4 } });
  assert.equal(skinsBoard(v.big, v.field)[3].state, 'won');
});

test('validate, Canadian and birdie skins across groups', () => {
  // Ann wins 1 with a 3, then a 5 on 2 (net bogey): lost, and with carries it rides on 2, where Dave's 3 takes both
  const v = handField({ validate: true, carry: true }, { 1: { a: 3 }, 2: { a: 5, d: 3 } });
  const b = skinsBoard(v.big, v.field);
  assert.deepEqual([b[0].state, b[0].lost, b[1].winner, b[1].carry], ['lost', 'a', 'd', 2]);
  assert.deepEqual(skinsMoney(v.big, v.field).balances, oracle(v.spec));
  // While Ann hasn't played 2 yet, her skin is waiting on it
  const wait = handField({ validate: true }, { 1: { a: 3 }, 2: { a: null, b: null } });
  const live = makeField({ ...wait.spec, groups: wait.spec.groups.map((g, i) => (i ? g : { ...g, done: false })) });
  assert.deepEqual([skinsBoard(live.big, live.field)[0].state, skinsBoard(live.big, live.field)[0].pending], ['won', true]);
  // Canadian: Cal (9 over nine holes, a stroke a hole) nets 3 with a 4, Eve makes a natural 3: Eve's
  const c = handField({ canadian: true }, { 1: { e: 3 } }, { hc: { c: 9 } });
  assert.deepEqual([skinsBoard(c.big, c.field)[0].winner, skinsBoard(c.big, c.field)[0].canadian], ['e', true]);
  const plain = handField({}, { 1: { e: 3 } }, { hc: { c: 9 } });
  assert.equal(skinsBoard(plain.big, plain.field)[0].state, 'tied', 'without it they tie');
  // Birdies win two skins: Dave (a 1, his stroke on hole 1) wins 1 with a net birdie, one skin; Fay's
  // natural birdie on 3 is two. Three skins in the $60 pot, $20 each
  const d = handField({ birdieDouble: true }, { 3: { f: 3 } }, { hc: { d: 1 } });
  const md = skinsMoney(d.big, d.field);
  assert.deepEqual(md.skins, { d: 1, f: 2 });
  assert.deepEqual(md.won, { d: 2000, f: 4000 });
  assert.deepEqual(md.balances, oracle(d.spec));
});

test('the board as it stands: what each skin is worth now, and who has them', () => {
  const f = handField({}, { 1: { a: 3 }, 4: { c: 3 }, 5: { a: 3 } });
  const now = skinsNow(f.big, f.field);
  assert.equal(now.perSkin, 2000, '$60 over three skins');
  assert.deepEqual(now.players.map(p => [p.id, p.skins, p.holes, p.cents]), [['a', 2, [1, 5], 4000], ['c', 1, [4], 2000]]);
  const c = handField({ carry: true }, { 3: { a: 3 } });
  const cn = skinsNow(c.big, c.field);
  assert.equal(cn.perHole, 6000 / 9);
  assert.equal(Math.round(cn.holes[3]), 2000, 'three holes, $20');
  assert.equal(Math.round(cn.riding), 4000, 'six holes riding past the last');
});
