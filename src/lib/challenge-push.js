// Sending challenges made on this phone, and the moves made on them, to the server (challenge-sync.js
// wires these to the store and the adapter; they're kept apart so they can be tested in Node).
// - A challenge's code is kept on the phone before it goes up, so a retry, or two refreshes running
//   at once, always send the same challenge, never a second copy under another code.
// - A move made while the challenge is on its way is marked unsent and goes up on the next refresh,
//   instead of being lost.
// `deps`: { getState, update, adapter, newCode }.
import { planOf } from './challenges.js';

// Fields that stay on this phone: which side it is, whether it was made here, and the retry flags
const LOCAL_ONLY = ['code', 'pendingCode', 'mine', 'made', 'unsent', 'unsentMoves', 'syncedAt', 'moves'];

/** The shared part of a challenge (what the other phones read). The plan goes by its code. */
export function challengeMeta(ch) {
  const meta = {};
  for (const [k, v] of Object.entries(ch)) if (!LOCAL_ONLY.includes(k)) meta[k] = v;
  if (meta.plan) meta.plan = { code: meta.plan.code ?? null, date: meta.plan.date ?? null };
  return meta;
}

/** The plan code a challenge goes up under (null for one from a Player card), or undefined while its plan isn't shared yet. */
export function planCodeOf(state, ch) {
  if (!ch.plan) return null;
  const plan = planOf(state, ch);
  return plan?.code || ch.plan.code || undefined;
}

/** Send a challenge made here (and every move on it so far). Resolves true once it's on the server. */
export async function pushChallenge({ getState, update, adapter, newCode }, id) {
  const ch = getState().challenges?.[id];
  if (!ch || !adapter) return false;
  const planCode = planCodeOf(getState(), ch);
  if (planCode === undefined) return false; // its plan goes up first
  let code = ch.code || ch.pendingCode;
  if (!code) {
    const fresh = newCode();
    update(s => { const c = s.challenges?.[id]; if (c && !c.code && !c.pendingCode) c.pendingCode = fresh; });
    code = getState().challenges?.[id]?.pendingCode || fresh;
  }
  const meta = challengeMeta({ ...ch, plan: ch.plan ? { ...ch.plan, code: planCode } : null });
  await adapter.create(code, planCode, meta);
  const sent = new Set();
  for (const m of ch.moves || []) { await adapter.addMove(code, planCode, m); sent.add(m.id); }
  update(s => {
    const c = s.challenges?.[id];
    if (!c) return;
    c.code = code;
    delete c.pendingCode;
    if (c.plan) c.plan.code = planCode;
    delete c.unsent;
    const rest = (c.moves || []).filter(m => !sent.has(m.id));
    if (rest.length) c.unsentMoves = Object.fromEntries(rest.map(m => [m.id, true]));
    else delete c.unsentMoves;
    c.syncedAt = Date.now();
  });
  return true;
}

/** Send the moves on a challenge that didn't go up when they were made. Only the ones sent come off the list. */
export async function pushMoves({ getState, update, adapter }, id) {
  const ch = getState().challenges?.[id];
  if (!ch?.code || !ch.unsentMoves || !adapter) return;
  const planCode = planCodeOf(getState(), ch) ?? null;
  const sent = [];
  for (const m of ch.moves || []) if (ch.unsentMoves[m.id]) { await adapter.addMove(ch.code, planCode, m); sent.push(m.id); }
  update(s => {
    const c = s.challenges?.[id];
    if (!c?.unsentMoves) return;
    const known = new Set((c.moves || []).map(m => m.id));
    for (const k of Object.keys(c.unsentMoves)) if (sent.includes(k) || !known.has(k)) delete c.unsentMoves[k];
    if (!Object.keys(c.unsentMoves).length) delete c.unsentMoves;
  });
}
