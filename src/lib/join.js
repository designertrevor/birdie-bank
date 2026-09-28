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
