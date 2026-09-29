// Where a join link or a typed round code takes someone who is already set up. A round this
// phone already has opens as it is; anything else goes to the invite card (who asked you, the
// bets, the seats and "Not on the list? Add me"), the same one a brand-new phone sees.
import { cleanCode } from './sync-model.js';

/** The screen for round `code`: [name, params], or null when the code is no good. */
export function joinRoute(state, code) {
  const c = cleanCode(code);
  if (c.length !== 6) return null;
  const have = Object.values(state?.rounds || {}).find(r => r?.shared?.code === c);
  if (have) return [have.status === 'done' && !have.editing ? 'roundDetail' : 'play', { id: have.id }];
  return ['joinInvite', { code: c }];
}

/** Where to land once you're in: the round, or its results when it's already finished. */
export function afterJoin(id, done) {
  return [done ? 'roundDetail' : 'play', { id }];
}

/**
 * The team line on the invite's confirm card. A team named after its players ("Sam & Dave")
 * already says who you're with, so it stands alone; any other name gets "with A and B".
 * A mate counts as named when their first name is a whole word in the team name, any case.
 */
export function teamLine(teamName, mateFirstNames = []) {
  const name = teamName || '';
  const mates = (mateFirstNames || []).filter(Boolean);
  if (!mates.length) return name;
  const words = new Set(name.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const named = m => m.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).every(w => words.has(w));
  if (mates.every(named)) return name;
  const list = mates.length === 1 ? mates[0] : `${mates.slice(0, -1).join(', ')} and ${mates[mates.length - 1]}`;
  return `${name} with ${list}`;
}
