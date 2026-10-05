// "Just playing, no bet": someone on the card who is out of every game. The rule these tests hold the
// engine to: the betting players' money is exactly what it would be if the player just playing
// weren't in the round at all, in every game, with side games and side bets, added partway through,
// with handicaps changed, and hole by hole while the score goes in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES, ONE_BALL_GAMES, TEAM_GAMES, addPlayerToRound, anyJustPlaying, bankerHoleSetup, bettingRound, bettors, canLeave, cardOnly, changeHandicaps,
  createRound, gameView, isJustPlaying, livePreview, playsGame, roundResults, sides, turnOrder, wolfFor, wolfHoleSetup,
} from './round.js';
import { REV2_DEFAULTS, TEAM_DEFAULTS } from './settings.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'per' },
  stableford: { ...REV2_DEFAULTS.stableford },
  quota: { ...REV2_DEFAULTS.quota },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { ...REV2_DEFAULTS.rabbit },
  hammer: { stake: 5, max: 3, who: 'either' },
  snake: { stake: 5, growth: 'double' },
  ...structuredClone(TEAM_DEFAULTS),
};
const SIDE = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per' },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  birdies: { stake: 5, eagleShares: 2 },
  snake: { stake: 3, growth: 'double' },
  rabbit: { ...REV2_DEFAULTS.rabbit },
  ctp: { stake: 5 },
  drive: { stake: 5 },
};
const course = n => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) });
const seeded = (seed = 11) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BETTING_GAMES = Object.keys(GAMES).filter(g => !ONE_BALL_GAMES.includes(g));

/**
 * Two copies of one round: `a` with the betting players alone, `b` with the same players and the
 * same scores, bets and marks plus `jp` people just playing (their own scores on every hole). The
 * players just playing get the lowest handicaps, so they would set the low if they counted.
 */
function twins(game, rnd, { holes = 18, n = null, jp = 1, at = 'start', sideGames = [], bets = false } = {}) {
  const g = GAMES[game];
  const count = n ?? Math.max(g.min || 2, Math.min(g.max || 4, 2 + Math.floor(rnd() * 4)));
  const ids = Array.from({ length: count }, (_, i) => `p${i}`);
  const needsTeams = game === 'vegas' || game === 'match' || TEAM_GAMES.includes(game);
  if (needsTeams && count % 2) return null;
  const teams = needsTeams || (g.teams && count === 4) ? [ids.slice(0, count / 2), ids.slice(count / 2)] : null;
  const jps = Array.from({ length: jp }, (_, i) => `j${i}`);
  const people = ids.map((id, i) => ({ id, name: `Player ${id}`, index: 6 + i * 5 }));
  const casual = jps.map(id => ({ id, name: `Friend ${id}`, index: 0 }));
  const make = list => createRound({
    id: 'r', game, course: course(holes), holesCount: holes, players: list, settings: structuredClone(SETTINGS), hcPct: 90, useHandicaps: true, teams,
    justPlaying: list === people ? [] : jps,
  });
  const a = make(people);
  const b = make(at === 'start' ? [...casual, ...people] : at === 'middle' ? [people[0], ...casual, ...people.slice(1)] : [...people, ...casual]);
  for (const r of [a, b]) {
    if (sideGames.length) r.sideGames = sideGames.map(k => ({ game: k, settings: structuredClone(SIDE[k]) }));
  }
  if (bets) {
    const list = [
      { id: 'b1', kind: 'match', sides: [ids[0], ids[1]], stake: 5 },
      { id: 'b2', kind: 'hole', sides: [ids[1], ids[0]], stake: 2 },
    ];
    a.bets = structuredClone(list);
    // A bet with someone just playing never counts (setup never offers one; a garbled round can't make one count)
    b.bets = [...structuredClone(list), { id: 'b3', kind: 'match', sides: [jps[0], ids[0]], stake: 50 }];
  }
  const upto = 1 + Math.floor(rnd() * holes);
  for (let i = 0; i < upto; i++) {
    const h = a.holes[i];
    const sc = Object.fromEntries(ids.map(id => [id, h.par - 2 + Math.floor(rnd() * 5)]));
    a.scores[h.no] = { ...sc };
    // Whoever is just playing makes birdies and eagles: they'd win everything if they counted
    b.scores[h.no] = { ...sc, ...Object.fromEntries(jps.map(id => [id, h.par - 2])) };
    const m = {};
    if (game === 'hammer' && rnd() < 0.4) m.hammers = [0];
    if (game === 'snake' || sideGames.includes('snake')) m.snake = rnd() < 0.3 ? [ids[Math.floor(rnd() * ids.length)]] : [];
    if (game === 'bbb') { m.bingo = ids[0]; m.bango = ids[1]; m.bongo = ids[Math.floor(rnd() * ids.length)]; }
    if ((game === 'dots' || sideGames.includes('dots')) && rnd() < 0.5) m[ids[0]] = ['greenie'];
    if (sideGames.includes('ctp') && h.par === 3) m.ctp = ids[Math.floor(rnd() * ids.length)];
    if (sideGames.includes('drive') && h.par !== 3) m.drive = ids[Math.floor(rnd() * ids.length)];
    if (Object.keys(m).length) { a.marks[h.no] = structuredClone(m); b.marks[h.no] = structuredClone(m); }
    if (game === 'banker') {
      const setup = bankerHoleSetup(a, i);
      a.banker[h.no] = structuredClone(setup);
      // The scorekeeper's phone sets up the hole from the main game's view, which has nobody just playing
      b.banker[h.no] = structuredClone(bankerHoleSetup(gameView(b, 'main'), i));
    }
    if (game === 'wolf') {
      const w = wolfHoleSetup(a, i).wolf;
      a.wolf[h.no] = { wolf: w, partner: rnd() < 0.3 ? null : ids.find(x => x !== w) };
      b.wolf[h.no] = { wolf: wolfHoleSetup(gameView(b, 'main'), i).wolf, partner: a.wolf[h.no].partner };
    }
  }
  return { a, b, ids, jps };
}

/** The betting players' side of a result: everything about them, nothing about anyone else. */
function betting(res, ids) {
  const keep = o => Object.fromEntries(ids.map(id => [id, o?.[id]]));
  return {
    balances: keep(res.balances),
    pairs: Object.fromEntries(ids.map(x => [x, keep(res.pairs[x])])),
    transfers: res.transfers,
    standings: res.standings,
    detail: res.detail,
    cash: res.cash ? betting({ ...res.cash, cash: null, detail: null }, ids) : null,
  };
}

function sameMoney(t, msg) {
  const ra = roundResults(t.a);
  const rb = roundResults(t.b);
  assert.deepEqual(betting(rb, t.ids), betting(ra, t.ids), msg);
  for (const j of t.jps) {
    assert.equal(rb.balances[j], 0, `${msg}: ${j} has no money`);
    assert.ok(Object.values(rb.pairs[j]).every(v => v === 0), `${msg}: ${j} has no head to head`);
    assert.ok(t.ids.every(x => rb.pairs[x][j] === 0), `${msg}: nobody has a head to head with ${j}`);
    assert.ok(!rb.standings.some(p => p.id === j), `${msg}: ${j} isn't in the standings`);
    assert.ok(!rb.transfers.some(x => x.from === j || x.to === j), `${msg}: ${j} pays nobody`);
  }
}

test('every game: the betting players’ money is exactly what it would be without the player just playing', () => {
  const rnd = seeded(5);
  let checked = 0;
  for (const game of BETTING_GAMES) {
    for (let k = 0; k < 14; k++) {
      const at = ['start', 'middle', 'end'][k % 3];
      const t = twins(game, rnd, { holes: k % 2 ? 9 : 18, jp: 1 + (k % 2), at });
      if (!t) continue;
      sameMoney(t, `${game} #${k} (${at})`);
      checked++;
    }
  }
  assert.ok(checked > 150, `checked ${checked}`);
});

test('every game with side games and side bets: still exactly the money without them', () => {
  const rnd = seeded(17);
  const combos = [['skins'], ['dots'], ['birdies'], ['snake'], ['rabbit'], ['ctp'], ['drive'], ['skins', 'birdies'], ['dots', 'ctp', 'drive'], ['snake', 'birdies', 'drive']];
  for (const game of BETTING_GAMES) {
    combos.forEach((combo, k) => {
      const t = twins(game, rnd, { holes: k % 2 ? 9 : 18, sideGames: combo, bets: k % 2 === 0, at: k % 3 ? 'start' : 'end' });
      if (!t) return;
      sameMoney(t, `${game} + ${combo.join('+')}`);
    });
  }
});

test('a points or reward round: the points and the side bets for money are the same without them', () => {
  const rnd = seeded(23);
  for (const game of ['stroke', 'skins', 'nassau', 'wolf', 'banker']) {
    for (const playFor of [{ kind: 'points' }, { kind: 'reward', reward: 'lunch' }]) {
      const t = twins(game, rnd, { bets: true, n: 4 });
      if (!t) continue;
      for (const r of [t.a, t.b]) { r.playFor = structuredClone(playFor); for (const b of r.bets) b.playFor = 'money'; }
      sameMoney(t, `${game} ${playFor.kind}`);
    }
  }
});

test('hole by hole while scores go in: the money bar moves exactly as it would without them', () => {
  const rnd = seeded(31);
  for (const game of BETTING_GAMES) {
    const t = twins(game, rnd, { holes: 9, sideGames: ['skins'] });
    if (!t) continue;
    for (const h of t.a.holes.slice(0, 4)) {
      const pa = livePreview(t.a, h);
      const pb = livePreview(t.b, h);
      for (const id of t.ids) {
        assert.equal(pb.balances[id], pa.balances[id], `${game} hole ${h.no}: ${id}`);
        assert.equal(pb.delta[id], pa.delta[id], `${game} hole ${h.no}: ${id} on the hole`);
      }
      for (const j of t.jps) assert.equal(pb.delta[j], 0, `${game} hole ${h.no}: ${j} moves nothing`);
    }
  }
});

test('strokes: someone just playing never sets the low, so the betting players get the strokes they would without them', () => {
  const rnd = seeded(41);
  const t = twins('stroke', rnd, { n: 3 });
  for (const id of t.ids) assert.equal(t.b.players.find(p => p.id === id).plays, t.a.players.find(p => p.id === id).plays, id);
  // The friend is the best player here, so they play off the betting players' low and give strokes back
  const friend = t.b.players.find(p => p.id === 'j0');
  assert.ok(friend.plays < 0, `friend plays ${friend.plays}`);
  // Changing handicaps partway keeps it that way
  for (const opts of [{ hcPct: 80 }, { hcPct: 100, players: { p1: { courseHc: 2 } } }, { useHandicaps: false }]) {
    const a = changeHandicaps(t.a, course(18), opts);
    const b = changeHandicaps(t.b, course(18), opts);
    for (const id of t.ids) assert.equal(b.players.find(p => p.id === id).plays, a.players.find(p => p.id === id).plays, `${JSON.stringify(opts)} ${id}`);
    assert.deepEqual(betting(roundResults(b), t.ids), betting(roundResults(a), t.ids), JSON.stringify(opts));
  }
});

test('added partway as just playing: nobody’s strokes or money move', () => {
  const rnd = seeded(53);
  for (const game of BETTING_GAMES) {
    const t = twins(game, rnd, { holes: 18, jp: 0, n: GAMES[game].min === GAMES[game].max ? GAMES[game].min : 4 });
    if (!t) continue;
    // Before the first score, and from a hole partway through
    for (const fromNo of [null, 5]) {
      const a = structuredClone(t.a);
      if (fromNo == null) { a.scores = {}; a.marks = {}; a.banker = {}; a.wolf = {}; }
      const b = addPlayerToRound(a, { id: 'late', name: 'Late Friend', index: 0 }, fromNo, null, { justPlaying: true });
      assert.ok(isJustPlaying(b, 'late'));
      for (const h of b.holes) if (b.scores[h.no]) b.scores[h.no] = { ...b.scores[h.no], late: h.par - 2 };
      for (const p of a.players) assert.equal(b.players.find(x => x.id === p.id).plays, p.plays, `${game} ${fromNo}: ${p.id} strokes`);
      assert.deepEqual(betting(roundResults(b), t.ids), betting(roundResults(a), t.ids), `${game} from ${fromNo}`);
      assert.equal(b.gamesFor, a.gamesFor, `${game}: no games list for someone just playing`);
    }
  }
});

test('a betting player added before the first score keeps the betting players’ low', () => {
  const t = twins('stroke', seeded(3), { n: 2 });
  t.a.scores = {}; t.b.scores = {};
  const a = addPlayerToRound(t.a, { id: 'p9', name: 'New', index: 12 });
  const b = addPlayerToRound(t.b, { id: 'p9', name: 'New', index: 12 });
  for (const p of a.players) assert.equal(b.players.find(x => x.id === p.id).plays, p.plays, p.id);
});

test('rotations, sides and teams leave them out', () => {
  const rnd = seeded(61);
  const wolf = twins('wolf', rnd, { n: 4, at: 'start' });
  const main = gameView(wolf.b, 'main');
  assert.deepEqual(main.players.map(p => p.id), wolf.ids);
  assert.deepEqual(turnOrder(main, 0), wolf.ids);
  for (let i = 0; i < 18; i++) assert.ok(!wolf.jps.includes(wolfFor(main, i)), `hole ${i + 1}`);
  const banker = twins('banker', rnd, { n: 3, at: 'start' });
  for (let i = 0; i < 9; i++) {
    const s = bankerHoleSetup(gameView(banker.b, 'main'), i);
    assert.ok(!banker.jps.includes(s.banker) && !Object.keys(s.bets).some(id => banker.jps.includes(id)), `banker hole ${i + 1}`);
  }
  // Match play's two sides are the two betting players, even with the friend first on the list
  const match = twins('match', rnd, { n: 2, at: 'start' });
  assert.deepEqual(sides(gameView(match.b, 'main')), [['p0'], ['p1']]);
  // Teams handed to createRound with someone just playing in them: they come off the team
  const r = createRound({
    id: 'r', game: 'bestball', course: course(18), holesCount: 18, players: ['a', 'b', 'c', 'd', 'j'].map(id => ({ id, name: id, index: 5 })),
    settings: structuredClone(SETTINGS), hcPct: 100, teams: [['a', 'b', 'j'], ['c', 'd']], justPlaying: ['j'],
  });
  assert.deepEqual(r.teams.map(t => t.players), [['a', 'b'], ['c', 'd']]);
  assert.ok(!playsGame(r, 'j', 'main') && playsGame(r, 'a', 'main'));
});

test('the round view: bettingRound drops them and nothing else, and a round with nobody just playing is untouched', () => {
  const t = twins('skins', seeded(71), { n: 3, sideGames: ['birdies'], bets: true });
  assert.equal(bettingRound(t.a), t.a);
  assert.equal(gameView(t.a, 'main'), t.a);
  const v = bettingRound(t.b);
  assert.deepEqual(v.players.map(p => p.id), t.ids);
  assert.ok(!('justPlaying' in v));
  assert.ok(Object.values(v.scores).every(s => !('j0' in s)));
  assert.deepEqual(v.bets.map(b => b.id), ['b1', 'b2']);
  assert.deepEqual(bettors(t.b).map(p => p.id), t.ids);
  assert.ok(anyJustPlaying(t.b) && !anyJustPlaying(t.a));
  // A flag left behind for someone no longer in the round means nothing
  assert.ok(!anyJustPlaying({ ...t.a, justPlaying: { gone: true } }));
});

test('leaving: someone just playing can head in any time, a betting player still needs two to play on', () => {
  const t = twins('skins', seeded(5), { n: 2, jp: 1 });
  assert.equal(canLeave(t.b, 'j0'), true);
  assert.equal(canLeave(t.b, 'p0'), false);
  const three = twins('skins', seeded(5), { n: 3, jp: 1 });
  assert.equal(canLeave(three.b, 'p0'), true);
  // Someone just playing who left changes nobody's money either
  const left = { ...three.b, left: { j0: 3 } };
  assert.deepEqual(betting(roundResults(left), three.ids), betting(roundResults(three.a), three.ids));
});

test('a card only round: everyone just playing, nothing changes hands', () => {
  const r = createRound({
    id: 'solo', game: 'stroke', course: course(9), holesCount: 9, players: [{ id: 'me', name: 'Sam', index: 14 }], settings: structuredClone(SETTINGS),
    hcPct: 100, useHandicaps: false, justPlaying: ['me'],
  });
  r.scores[1] = { me: 5 };
  assert.ok(cardOnly(r));
  const res = roundResults(r);
  assert.deepEqual(res.balances, { me: 0 });
  assert.deepEqual(res.transfers, []);
  assert.deepEqual(res.standings, []);
  assert.ok(!cardOnly({ ...r, justPlaying: {} }));
});
