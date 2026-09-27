// A seeded sweep over every game: random scores, a bet change partway through (from the next hole
// on) and sometimes a second one, on 9 and 18 holes, pots and per-point payouts. Whatever happens,
// no crash, balances add up to zero and every amount is whole cents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, changeBets, GAMES } from './round.js';
import { REV2_DEFAULTS } from './settings.js';

const settings = (payout, sixes) => ({
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'auto', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: sixes },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout },
  stableford: { ...REV2_DEFAULTS.stableford, payout },
  quota: { ...REV2_DEFAULTS.quota, payout },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { ...REV2_DEFAULTS.rabbit },
});
const course = n => ({ id: 'c', name: 'C', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) });
// Bump every money figure in a game's settings (not thresholds or multipliers)
const raise = (s, by) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' && k !== 'threshold' && k !== 'loneMultiplier' ? v * 2 + by : v]));

test('every game: bets changed mid-round still add up to zero, in whole cents', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [payout, sixes] of [['pot', 'match'], ['per', 'holes']]) {
    for (const game of Object.keys(GAMES)) {
      const g = GAMES[game];
      for (let k = 0; k < 25; k++) {
        const n = Math.max(g.min || 2, Math.min(g.max || 4, 2 + Math.floor(rnd() * 4)));
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        const needsTeams = game === 'scramble' || game === 'vegas' || game === 'match';
        if (needsTeams && n % 2) continue;
        const teams = needsTeams || (g.teams && n === 4) ? [ids.slice(0, n / 2), ids.slice(n / 2)] : null;
        const holes = rnd() < 0.5 ? 9 : 18;
        let r = createRound({
          id: 'r', game, course: course(holes), holesCount: holes, players: ids.map((id, i) => ({ id, name: id, index: i * 5 })),
          settings: settings(payout, sixes), hcPct: 90, useHandicaps: true, teams,
        });
        const scorers = game === 'scramble' ? r.teams.map(t => t.id) : ids;
        const upto = 1 + Math.floor(rnd() * holes);
        for (let i = 0; i < upto; i++) {
          const h = r.holes[i];
          r.scores[h.no] = Object.fromEntries(scorers.map(id => [id, h.par - 1 + Math.floor(rnd() * 4)]));
          if (i === Math.floor(upto / 2)) r = changeBets(r, raise(r.settings[game], 1), i + 2);
        }
        if (rnd() < 0.4) r = changeBets(r, raise(r.settings[game], 3), upto + 1);
        const { balances } = roundResults(r);
        const cents = Object.values(balances).map(v => v * 100);
        assert.ok(cents.every(c => Number.isFinite(c) && Math.abs(c - Math.round(c)) < 1e-6), `${game}: ${JSON.stringify(balances)}`);
        assert.equal(Math.round(cents.reduce((a, c) => a + c, 0)) + 0, 0, `${game} ${payout}: ${JSON.stringify(balances)}`);
      }
    }
  }
});
