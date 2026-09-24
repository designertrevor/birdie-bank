// Splitting players into teams for the team games.
import { GAMES } from './round.js';

/** Split the picked players into a starting set of teams for the game. */
export function defaultTeams(game, picked) {
  const cfg = GAMES[game]?.teams;
  if (!cfg) return null;
  if (cfg.optional && picked.length <= 2) return null;
  const count = Array.isArray(cfg.count) ? cfg.count[0] : cfg.count;
  const groups = Array.from({ length: count }, () => []);
  picked.forEach((pid, i) => groups[Math.floor(i * count / picked.length)].push(pid));
  return groups;
}

/** What's wrong with a team split, or null when it's fine. */
export function teamsProblem(game, teams, picked) {
  const cfg = GAMES[game]?.teams;
  if (!cfg) return null;
  if (cfg.optional && picked.length <= 2) return null;
  if (!teams) return 'Split the players into teams';
  if (teams.some(t => t.length === 0)) return 'Every team needs at least one player';
  if (cfg.size && teams.some(t => t.length !== cfg.size)) return `Teams of ${cfg.size}`;
  if (teams.flat().length !== picked.length) return 'Put everyone on a team';
  return null;
}

