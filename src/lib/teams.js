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
  if (!Array.isArray(cfg.count) && teams.length !== cfg.count) return `${GAMES[game].name} is played in ${cfg.count === 2 ? 'two' : cfg.count} teams`;
  if (teams.some(t => t.length === 0)) return 'Every team needs at least one player';
  if (cfg.size && teams.some(t => t.length !== cfg.size)) return `${GAMES[game].name} needs teams of ${cfg.size}`;
  if (teams.flat().length !== picked.length) return 'Put everyone on a team';
  // Best ball and Shamble: two teams the same size, 2 v 2 up to 4 v 4
  if (cfg.even && teams.some(t => t.length !== teams[0].length)) {
    return picked.length % 2 ? `${GAMES[game].name} needs two teams the same size, so it takes 4, 6 or 8 players` : `${GAMES[game].name} needs two teams the same size`;
  }
  if (cfg.sizes && teams.some(t => t.length < cfg.sizes[0] || t.length > cfg.sizes[1])) return `${GAMES[game].name} needs teams of ${cfg.sizes[0]} to ${cfg.sizes[1]}`;
  return null;
}

