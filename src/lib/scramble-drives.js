// Scramble (and Shamble, 2026-10-03) house rule: a minimum number of drives each player's tee shot has to be used.
// No money moves on it; it keeps a team honest so the long hitter doesn't hit every tee shot.
// round.settings.scramble.drives is the minimum (0 or unset: off, today's default). The scorekeeper taps
// whose drive the team used on each hole; it's saved in the hole's marks as { drives: { teamId: pid } }.
// Sources, checked 2026-09-30 (common minimums are 2 or 3 drives each over 18, 4 in a Texas scramble):
//  LiveTourney, "Two-man scramble rules" https://www.livetourney.com/blog/two-man-scramble-rules
//  FAU Golf Classic rules https://business.fau.edu/golf-classic/classic-rules/index.php (3 tee shots per player)
import { playsHole } from './round.js';

/** Games that can play for minimum drives: a scramble, and a shamble (which starts from the team's pick of drive). */
export const DRIVE_GAMES = ['scramble', 'shamble'];

/** The minimum drives each player needs, or 0 when the rule is off. */
export function drivesNeeded(round) {
  return DRIVE_GAMES.includes(round?.game) ? Number(round.settings?.[round.game]?.drives) || 0 : 0;
}

/**
 * Drives used so far, team by team: [{ id, name, left, players: [{ id, name, drives, short }], tight }].
 * `left` is the team's holes still to tag (not yet marked), `short` how many more that player needs,
 * and `tight` says the drives still owed fill every hole left, so from now on the team has no choice.
 */
export function scrambleDrives(round) {
  const need = drivesNeeded(round);
  if (!need || !round.teams) return [];
  const names = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  return round.teams.map(t => {
    const count = Object.fromEntries(t.players.map(pid => [pid, 0]));
    let left = 0;
    for (const h of round.holes) {
      if (!t.players.some(pid => playsHole(round, pid, h))) continue;
      const pid = round.marks?.[h.no]?.drives?.[t.id];
      if (pid in count) count[pid]++;
      else left++;
    }
    // Only the players still in the round owe drives: someone who left early is off the hook.
    // Once every hole is tagged, the players who played the team's last hole still count, so the results can flag a shortfall.
    const last = [...round.holes].reverse().find(h => t.players.some(pid => playsHole(round, pid, h)));
    const still = t.players.filter(pid => round.holes.some(h => playsHole(round, pid, h) && !round.marks?.[h.no]?.drives?.[t.id])
      || (!left && last && playsHole(round, pid, last)));
    const players = t.players.map(pid => ({ id: pid, name: names[pid], drives: count[pid], short: still.includes(pid) ? Math.max(0, need - count[pid]) : 0 }));
    const owed = players.reduce((a, p) => a + p.short, 0);
    return { id: t.id, name: t.name, left, players, tight: owed > 0 && left > 0 && owed >= left };
  });
}

const firstName = n => (n || '').split(' ')[0];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Who is still short of the minimum: [{ id, name, team, short, left, tight }], one row per player.
 * `left` is the team's holes still to tag. A quiet flag only: nothing here blocks scoring or moves money.
 * With `soon`, only rows worth flagging mid-round: the team is in its last third of holes, or it is tight.
 */
export function drivesShortfall(round, { soon = false } = {}) {
  const teams = scrambleDrives(round);
  const third = Math.max(3, Math.ceil((round?.holes?.length || 18) / 3));
  const out = [];
  for (const t of teams) {
    if (soon && !(t.tight || t.left <= third)) continue;
    for (const p of t.players) if (p.short > 0) out.push({ id: p.id, name: p.name, team: t.name, short: p.short, left: t.left, tight: t.tight });
  }
  return out;
}

/**
 * "Ann needs 2 more drives with 4 holes left" mid-round, or "Ann came up 2 drives short" once nothing is left
 * or the round is done (`done`).
 */
export function shortfallText(s, { done = false } = {}) {
  return s.left > 0 && !done
    ? `${firstName(s.name)} needs ${s.short} more drive${s.short === 1 ? '' : 's'} with ${plural(s.left, 'hole')} left`
    : `${firstName(s.name)} came up ${plural(s.short, 'drive')} short`;
}
