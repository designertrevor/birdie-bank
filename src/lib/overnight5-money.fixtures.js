// Seeded rounds as they were saved before overnight 5 (no half strokes, no per-game %, none of the
// new house rules, no side game bet history): every game, side games, pickups, unfinished holes,
// presses, hammers, a player who leaves, a player added partway and a bet changed mid-round.
// overnight5-money.test.js checks their money matches a snapshot taken with main's round.js
// before overnight 5 was merged, and layers tonight's new options on top of them.
// Only uses what main's round.js already had, so the same file builds the same rounds on both.
import {
  GAMES, ADD_MID_ROUND, createRound, addPlayerToRound, changeBets, sideGameChoices, nassauPressOptions, canLeave,
} from './round.js';

/** Games added after the snapshot was taken, left out of the seeded rounds. */
const ADDED_SINCE = ['bestball', 'shamble', 'altshot', 'chapman'];

export const OLD_SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate', birdies: 'off' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2, turnPress: false, noLastPress: false },
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  hammer: { stake: 5, max: 3, who: 'either' },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'pot' },
  stableford: { stake: 5, payout: 'pot', modified: false },
  quota: { stake: 5, payout: 'pot' },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { stake: 5, mode: 'free', tiesFree: false },
  snake: { stake: 5, growth: 'double', nines: false, cap: 4 },
  birdies: { stake: 5, eagleShares: 2 },
};

const SIDE = {
  skins: [{ value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'split' }, { value: 3, carryover: true, kind: 'both', payout: 'per', stake: 10, lastCarry: 'void' }, { value: 1, carryover: false, kind: 'gross', payout: 'pot', stake: 10, lastCarry: 'void' }],
  dots: [OLD_SETTINGS.dots],
  birdies: [{ stake: 5, eagleShares: 2 }],
  snake: [{ stake: 2, growth: 'flat', nines: true, cap: 0 }, { stake: 1, growth: 'double', nines: false, cap: 4 }],
  rabbit: [{ stake: 5, mode: 'free', tiesFree: false }, { stake: 3, mode: 'steal', tiesFree: true }],
};

const course = n => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5, 4, 4, 3][i % 6], hdcp: ((i * 7) % n) + 1 })) });
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Bump every money figure in a block (never a threshold, multiplier or cap)
const raise = (s, by) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' && !['threshold', 'loneMultiplier', 'cap', 'eagleShares', 'min'].includes(k) ? v + by : v]));

/** [{ name, round }]: `count` seeded rounds over every game. */
export function oldRounds(count = 160, seed = 2026) {
  const rnd = seeded(seed);
  const pick = a => a[Math.floor(rnd() * a.length)];
  // The games there were when the snapshot was taken, so games added since (the team games, 2026-10-03)
  // don't shift the seeded rounds: these rounds have to stay exactly the ones the snapshot holds
  const games = Object.keys(GAMES).filter(g => !ADDED_SINCE.includes(g));
  const out = [];
  for (let k = 0; k < count; k++) {
    const game = games[k % games.length];
    const g = GAMES[game];
    let n = Math.max(g.min, Math.min(g.max, 6, 2 + Math.floor(rnd() * 5)));
    if (game === 'hammer') n = rnd() < 0.5 ? 2 : 4;
    if (game === 'match' || game === 'scramble') n = Math.max(2, n);
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    let teams = null;
    if (game === 'vegas' || (game === 'hammer' && n === 4) || (game === 'nassau' && n === 4 && rnd() < 0.5)) teams = [ids.slice(0, n / 2), ids.slice(n / 2)];
    if (game === 'match') { const cut = n === 2 ? 1 : pick([1, Math.floor(n / 2)]); teams = [ids.slice(0, cut), ids.slice(cut)]; }
    if (game === 'scramble') { const t = n >= 4 && rnd() < 0.5 ? 2 : Math.min(n, 2 + Math.floor(rnd() * 3)); teams = Array.from({ length: t }, (_, i) => ids.filter((_, j) => j % t === i)); }
    const holes = rnd() < 0.35 ? 9 : 18;
    const useHandicaps = rnd() < 0.85;
    const settings = structuredClone(OLD_SETTINGS);
    if (game === 'sixes') settings.sixes.mode = pick(['match', 'holes']);
    if (game === 'stroke' || game === 'stableford' || game === 'quota') settings[game].payout = pick(['pot', 'per']);
    if (game === 'skins') Object.assign(settings.skins, { kind: pick(['net', 'gross', 'both']), carryover: rnd() < 0.7, lastCarry: pick(['void', 'split', 'playoff']), payout: rnd() < 0.2 ? 'pot' : 'per' });
    if (game === 'nassau' || game === 'match') settings[game].pressMode = pick(['auto', 'manual', 'off']);
    let r = createRound({
      id: `r${k}`, game, course: course(holes), holesCount: holes, nine: 'front', players: ids.map((id, i) => ({ id, name: `Player ${i}`, index: Math.floor(rnd() * 28) })),
      settings, hcPct: pick([100, 100, 90, 80]), useHandicaps, teams,
    });
    r.createdAt = 0;
    // Side games, as setup offers them
    if (game !== 'scramble') {
      const want = Math.floor(rnd() * 3);
      const sgs = [];
      for (let j = 0; j < want; j++) {
        // The side games setup offered then: the closest to the pin and long drive pots came later
        const opts = sideGameChoices(game, sgs).filter(k => SIDE[k]);
        if (!opts.length) break;
        const key = pick(opts);
        sgs.push({ game: key, settings: structuredClone(pick(SIDE[key])) });
      }
      if (sgs.length) r.sideGames = sgs;
    }
    const scorerIds = () => (game === 'scramble' ? r.teams.map(t => t.id) : r.players.map(p => p.id));
    const upto = Math.floor(rnd() * (holes + 1));
    const changeAt = rnd() < 0.35 ? 1 + Math.floor(rnd() * holes) : -1;
    const leaveAt = rnd() < 0.2 ? Math.floor(rnd() * holes) : -1;
    const joinAt = ADD_MID_ROUND.includes(game) && rnd() < 0.25 ? 1 + Math.floor(rnd() * (holes - 1)) : -1;
    for (let i = 0; i < upto; i++) {
      const h = r.holes[i];
      if (i === joinAt) r = addPlayerToRound(r, { id: 'late', name: 'Late Larry', index: 12 }, h.no);
      if (i === changeAt) r = changeBets(r, raise(r.settings[game], 1 + Math.floor(rnd() * 3)), i + 1);
      // Presses the app offers at this hole
      if ((game === 'nassau' || game === 'match') && i > 0 && r.settings[game].pressMode !== 'off') {
        for (const o of nassauPressOptions(r, h.no)) if (rnd() < 0.5) r.presses.push({ id: `p-${o.leg}-${h.no}`, leg: o.leg, start: i + 1, by: o.trailing, auto: true });
      }
      const on = scorerIds().filter(id => r.left?.[id] == null || false);
      const sc = {};
      for (const id of on) {
        if (r.left?.[id] != null) continue;
        const x = rnd();
        sc[id] = x < 0.07 ? 'X' : h.par - 2 + Math.floor(rnd() * 6);
      }
      // Now and then a hole is left with a score missing
      if (rnd() < 0.05 && on.length) delete sc[on[0]];
      r.scores[h.no] = sc;
      const pids = r.players.map(p => p.id);
      const m = { snake: rnd() < 0.3 ? [pick(pids)] : [] };
      if (rnd() < 0.4) m[pick(pids)] = [pick(['greenie', 'sandy', 'barkie', 'chipin'])];
      if (game === 'bbb') { m.bingo = pick(pids); m.bango = pick(pids); m.bongo = rnd() < 0.9 ? pick(pids) : null; }
      if (game === 'hammer') {
        const hs = []; while (hs.length < 3 && rnd() < 0.4) hs.push(hs.length % 2);
        m.hammers = hs; m.conceded = hs.length && rnd() < 0.2 ? 1 - hs.at(-1) : null;
      }
      r.marks[h.no] = m;
      if (game === 'banker') {
        const banker = pids[i % pids.length];
        r.banker[h.no] = { banker, bets: Object.fromEntries(pids.filter(id => id !== banker).map(id => [id, 1 + Math.floor(rnd() * 10)])), doubled: rnd() < 0.2 ? { [pick(pids)]: true } : {}, doubleBack: rnd() < 0.1 };
      }
      if (game === 'wolf') r.wolf[h.no] = { wolf: pids[i % 4], partner: rnd() < 0.3 ? null : pids[(i + 1) % 4] };
      if (i === leaveAt) {
        const who = pick(pids);
        if (canLeave(r, who)) r.left = { ...(r.left || {}), [who]: h.no };
      }
    }
    if (upto === holes || rnd() < 0.2) r.status = 'done';
    if (game === 'skins' && r.settings.skins.lastCarry === 'playoff' && rnd() < 0.7) r.skinsPlayoff = { net: 'p0', gross: 'p1' };
    out.push({ name: `${k} ${g.name}${r.sideGames ? ` + ${r.sideGames.map(s => s.game).join(' + ')}` : ''}`, round: r });
  }
  return out;
}
