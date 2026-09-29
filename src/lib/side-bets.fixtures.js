// Seeded rounds with side games, as rounds were saved before a side game's bet could change
// mid-round (no betHistory on any side game). side-bets.test.js checks their money never moves.
import { GAMES, createRound, sideGameChoices } from './round.js';
import { REV2_DEFAULTS } from './settings.js';

export const SETTINGS = {
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
export const SIDE_SETTINGS = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'split' },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  birdies: { stake: 5, eagleShares: 2 },
  snake: { stake: 2, growth: 'flat', nines: true, cap: 0 },
  rabbit: { stake: 5, mode: 'free', tiesFree: false },
};

const course = n => ({ id: 'c', name: 'Pebble Creek', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) });
const seeded = (seed = 11) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** [{ name, round }]: a few main games, each with side games on, some holes scored and marked. */
export function oldRoundFixtures() {
  const rnd = seeded(7);
  const mains = ['nassau', 'skins', 'wolf', 'stroke', 'banker', 'dots', 'match'];
  const combos = [['skins', 'dots'], ['birdies', 'snake'], ['rabbit', 'dots'], ['skins', 'birdies'], ['snake']];
  const out = [];
  for (const game of mains) {
    for (const combo of combos) {
      const allowed = sideGameChoices(game, []);
      if (!combo.every(c => allowed.includes(c))) continue;
      const count = game === 'wolf' || game === 'match' ? 4 : 3 + Math.floor(rnd() * 2);
      const ids = Array.from({ length: count }, (_, i) => `p${i}`);
      const teams = game === 'match' ? [ids.slice(0, 2), ids.slice(2)] : null;
      const holes = rnd() < 0.3 ? 9 : 18;
      const r = createRound({
        id: 'r', game, course: course(holes), holesCount: holes, players: ids.map((id, i) => ({ id, name: `Player ${id}`, index: i * 5 })),
        settings: structuredClone(SETTINGS), hcPct: 90, useHandicaps: true, teams,
      });
      r.sideGames = combo.map(g => ({ game: g, settings: structuredClone(SIDE_SETTINGS[g]) }));
      const upto = Math.max(3, Math.floor(rnd() * holes) + 1);
      for (let i = 0; i < upto; i++) {
        const h = r.holes[i];
        r.scores[h.no] = Object.fromEntries(ids.map(id => [id, h.par - 2 + Math.floor(rnd() * 5)]));
        const m = { snake: rnd() < 0.3 ? [ids[Math.floor(rnd() * ids.length)]] : [] };
        if (rnd() < 0.4) m[ids[Math.floor(rnd() * ids.length)]] = ['greenie'];
        r.marks[h.no] = m;
        if (game === 'banker') r.banker[h.no] = { banker: ids[i % ids.length], bets: Object.fromEntries(ids.filter((_, k) => k !== i % ids.length).map(id => [id, 5])), doubled: {}, doubleBack: false };
        if (game === 'wolf') r.wolf[h.no] = { wolf: ids[i % 4], partner: rnd() < 0.3 ? null : ids[(i + 1) % 4] };
      }
      out.push({ name: `${GAMES[game].name} + ${combo.join(' + ')}`, round: r });
    }
  }
  return out;
}
