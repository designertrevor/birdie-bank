// Seeded rounds as they were saved before the house rules added 2026-10-05 (overnight 9): every game,
// the team games included, with the house rules from before (2026-09-30 and 2026-10-03) switched on at
// random, side games, pickups, presses, hammers, bet changes, players who leave or join partway.
// house-rules-o9.test.js checks their money matches o9-money.snapshot.json, taken with round.js as it
// was before tonight's rules went in (overnight9/next, bbe09e4), and again with every new rule's key
// saved as off. Only uses what round.js already had, so the same file builds the same rounds on both.
import { createRound, addPlayerToRound, changeBets, ADD_MID_ROUND, TEAM_GAMES, ONE_BALL_GAMES, canLeave } from './round.js';
import { oldRounds } from './overnight5-money.fixtures.js';
import { TEAM_DEFAULTS } from './settings.js';

const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The house rules from before tonight, laid over a round's settings at random (a new object). */
function withOldRules(settings, rnd) {
  const s = structuredClone(settings);
  const on = () => rnd() < 0.4;
  const set = (game, vals) => { if (s[game]) Object.assign(s[game], vals); };
  set('banker', { par3Triple: on(), birdies: ['off', 'gross', 'net'][Math.floor(rnd() * 3)] });
  set('nassau', { turnPress: on(), noLastPress: on(), teamScore: on() ? 'total' : 'best' });
  set('match', { teamScore: on() ? 'total' : 'best' });
  set('skins', { canadian: on(), validate: on(), backDouble: on() });
  set('wolf', { carry: on(), lastWolf: on() });
  set('hammer', { birdie: on(), who: on() ? 'trailing' : 'either' });
  set('vegas', { birdieDouble: on(), daytona: on() });
  set('sixes', { carry: on(), teamScore: on() ? 'total' : 'best' });
  set('scramble', { second: on() });
  set('stroke', { cap: on(), nassau: on() });
  set('stableford', { nassau: on() });
  set('quota', { minus: on(), nassau: on(), split: on() ? 'over' : 'top' });
  set('nines', { sweep: on(), birdie: on() });
  set('aces', { carry: on() });
  set('bbb', { sweep: on(), netBongo: on() });
  set('dots', { greenieCarry: on() });
  set('rabbit', { sixes: on() });
  set('snake', { fourPutt: on() });
  return s;
}

/** Team game rounds: Best ball, Shamble, Alternate shot and Chapman, every way they bet. */
function teamRounds(count, rnd) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const course = n => ({ id: 't', name: 'Team Course', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: [4, 5, 3, 4][i % 4], hdcp: ((i * 5) % n) + 1 })) });
  const out = [];
  for (let k = 0; k < count; k++) {
    const game = TEAM_GAMES[k % TEAM_GAMES.length];
    const n = ONE_BALL_GAMES.includes(game) ? 4 : pick([4, 6, 8]);
    const ids = Array.from({ length: n }, (_, i) => `q${i}`);
    const holes = rnd() < 0.3 ? 9 : 18;
    const settings = { hcPct: 100, ...structuredClone(TEAM_DEFAULTS) };
    Object.assign(settings[game], { format: pick(['nassau', 'total', 'hole']), scoring: pick(['match', 'stroke']), pressMode: pick(['off', 'manual', 'auto']), turnPress: rnd() < 0.4, count: n >= 6 && rnd() < 0.5 ? 2 : 1 });
    let r = createRound({
      id: `t${k}`, game, course: course(holes), holesCount: holes, nine: 'front', players: ids.map((id, i) => ({ id, name: `Teamer ${i}`, index: Math.floor(rnd() * 24) })),
      settings, hcPct: 100, useHandicaps: rnd() < 0.8, teams: [ids.slice(0, n / 2), ids.slice(n / 2)],
    });
    r.createdAt = 0;
    const units = ONE_BALL_GAMES.includes(game) ? r.teams.map(t => t.id) : ids;
    const upto = Math.floor(rnd() * (holes + 1));
    for (let i = 0; i < upto; i++) {
      const h = r.holes[i];
      r.scores[h.no] = Object.fromEntries(units.map(id => [id, rnd() < 0.05 ? 'X' : h.par - 1 + Math.floor(rnd() * 4)]));
      if (i === 3 && rnd() < 0.3) r = changeBets(r, { ...r.settings[game], perHole: 3, front: 6 }, i + 1);
      if (i > 2 && rnd() < 0.15) r.presses.push({ id: `tp${i}`, leg: holes === 18 && i >= 9 ? 'back' : 'front', start: i + 1, by: pick([0, 1]) });
    }
    if (upto === holes || rnd() < 0.2) r.status = 'done';
    out.push({ name: `team ${k} ${game}`, round: r });
  }
  return out;
}

/** [{ name, round }]: the overnight 5 rounds with the later house rules laid over them, then team game rounds. */
export function o9Rounds() {
  const rnd = seeded(909);
  const out = [];
  for (const { name, round } of oldRounds(264, 909)) {
    const r = structuredClone(round);
    r.settings = withOldRules(r.settings, rnd);
    // An earlier stretch played with a rule the other way, now and then
    for (const e of r.betHistory || []) if (rnd() < 0.5 && e.settings && typeof e.settings === 'object') Object.assign(e.settings, withOldRules({ [r.game]: e.settings }, rnd)[r.game]);
    // A player added partway on a game that takes one, if the old rounds didn't already
    if (ADD_MID_ROUND.includes(r.game) && !r.joined && r.holes.length > 3 && rnd() < 0.1) {
      const late = addPlayerToRound(r, { id: 'late2', name: 'Late Lou', index: 9 }, r.holes[2].no);
      out.push({ name: `${name} + late`, round: late });
      continue;
    }
    // Someone leaves partway, now and then
    if (!r.left && r.holes.length > 4 && rnd() < 0.08 && canLeave(r, r.players[0].id)) r.left = { [r.players[0].id]: r.holes[3].no };
    out.push({ name: `o9 ${name}`, round: r });
  }
  return [...out, ...teamRounds(40, rnd)];
}
