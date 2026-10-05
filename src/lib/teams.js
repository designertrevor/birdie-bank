// Splitting players into teams for the team games.
import { GAMES } from './round.js';

/**
 * Team quota (Quota's house rule quota.team, 2026-10-05): two to four teams, usually pairs. Quota has no
 * teams of its own in GAMES, so setup and the round menu use this when the rule is on.
 */
export const QUOTA_TEAMS = { count: [2, 4], pairs: true };

/**
 * How a game splits into teams with these settings: GAMES' own, or QUOTA_TEAMS for team quota (a pot,
 * four players or more). Null when the game isn't played in teams.
 */
export function teamsCfg(game, settings, players = 4) {
  if (GAMES[game]?.teams) return GAMES[game].teams;
  const q = settings?.quota;
  if (game === 'quota' && q?.team && q.payout === 'pot' && players >= 4) return QUOTA_TEAMS;
  return null;
}

/** Split the picked players into a starting set of teams for the game. `cfg` stands in for GAMES' own (team quota). */
export function defaultTeams(game, picked, cfg = GAMES[game]?.teams) {
  if (!cfg) return null;
  if (cfg.optional && picked.length <= 2) return null;
  // Team quota starts in pairs: 4 players make two teams, 6 three, 8 four (an odd one out joins the last)
  const count = cfg.pairs ? Math.min(cfg.count[1], Math.max(cfg.count[0], Math.floor(picked.length / 2))) : Array.isArray(cfg.count) ? cfg.count[0] : cfg.count;
  const groups = Array.from({ length: count }, () => []);
  picked.forEach((pid, i) => groups[Math.floor(i * count / picked.length)].push(pid));
  return groups;
}

/** What's wrong with a team split, or null when it's fine. `cfg` stands in for GAMES' own (team quota). */
export function teamsProblem(game, teams, picked, cfg = GAMES[game]?.teams) {
  if (!cfg) return null;
  if (cfg.optional && picked.length <= 2) return null;
  if (!teams) return 'Split the players into teams';
  if (!Array.isArray(cfg.count) && teams.length !== cfg.count) return `${GAMES[game].name} is played in ${cfg.count === 2 ? 'two' : cfg.count} teams`;
  if (Array.isArray(cfg.count) && (teams.length < cfg.count[0] || teams.length > cfg.count[1])) return `${GAMES[game].name} is played in ${cfg.count[0]} to ${cfg.count[1]} teams`;
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

