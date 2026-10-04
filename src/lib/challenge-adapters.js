// Transport for challenges (challenges.js), shaped like the plan adapters:
//   create(code, planCode | null, meta)
//   fetch(code) -> { meta, moves } | null
//   fetchForPlan(planCode) -> [{ code, meta, moves }]
//   addMove(code, planCode | null, { id, side, move, stake, roundId, at })
//   subscribe({ code } | { planCode }, cb) -> unsubscribe   (cb gets { type: 'changed' | 'connected' })
// Moves are only ever added, never changed, so two phones can't overwrite each other.
import { isMissingTable } from './plan-adapters.js';

/** Thrown when the challenges tables aren't on the server yet (supabase/2026-10-04-challenges.sql hasn't run). */
export class ChallengesOffError extends Error {
  constructor() { super('Challenges aren’t switched on yet'); this.name = 'ChallengesOffError'; }
}

const moveRow = m => ({ id: m.id, side: m.side, move: m.move, ...(m.stake != null ? { stake: Number(m.stake) } : {}), ...(m.roundId ? { roundId: m.roundId } : {}), at: Number(m.at) || 0 });

// --------------------------- Supabase -------------------------------------

export function challengeSupabaseAdapter(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new ChallengesOffError();
    throw error;
  };
  const movesOf = async codes => {
    if (!codes.length) return [];
    const r = await db.from('challenge_moves').select('code, id, side, move, stake, round_id, at').in('code', codes);
    check(r);
    return r.data.map(x => ({ code: x.code, ...moveRow({ ...x, roundId: x.round_id }) }));
  };
  return {
    kind: 'supabase',
    async create(code, planCode, meta) {
      // Insert only (the server never lets a challenge be changed): sending it again is a no-op
      check(await db.from('challenges').upsert({ code, plan_code: planCode, meta }, { onConflict: 'code', ignoreDuplicates: true }));
    },
    async fetch(code) {
      const r = await db.from('challenges').select('code, meta').eq('code', code).maybeSingle();
      check(r);
      if (!r.data) return null;
      return { meta: r.data.meta, moves: await movesOf([code]) };
    },
    async fetchForPlan(planCode) {
      const r = await db.from('challenges').select('code, meta').eq('plan_code', planCode);
      check(r);
      const moves = await movesOf(r.data.map(x => x.code));
      return r.data.map(x => ({ code: x.code, meta: x.meta, moves: moves.filter(m => m.code === x.code) }));
    },
    async addMove(code, planCode, m) {
      const row = moveRow(m);
      check(await db.from('challenge_moves').upsert({ code, plan_code: planCode, id: row.id, side: row.side, move: row.move, stake: row.stake ?? null, round_id: row.roundId ?? null, at: row.at }, { onConflict: 'code,id', ignoreDuplicates: true }));
    },
    subscribe({ code = null, planCode = null }, cb) {
      const changed = () => cb({ type: 'changed' });
      const filter = planCode ? `plan_code=eq.${planCode}` : `code=eq.${code}`;
      const ch = db.channel(`challenge-${planCode || code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter }, changed)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_moves', filter }, changed)
        .subscribe(status => { if (status === 'SUBSCRIBED') cb({ type: 'connected' }); });
      return () => { db.removeChannel(ch); };
    },
  };
}

// --------------------------- Local (dev/testing) ---------------------------
// localStorage + BroadcastChannel, so two tabs on one computer (one with ?profile=b) behave like
// two phones.

export function challengeLocalAdapter() {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('challenges') : null;
  const key = code => `challenge:${code}`;
  const load = code => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const save = (code, v) => { localStorage.setItem(key(code), JSON.stringify(v)); bc?.postMessage({ code, planCode: v.planCode || null }); };
  const all = () => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('challenge:')) { const v = load(k.slice(10)); if (v) out.push({ code: k.slice(10), ...v }); }
    }
    return out;
  };
  return {
    kind: 'local',
    async create(code, planCode, meta) { const v = load(code); save(code, v ? v : { planCode, meta, moves: {} }); },
    async fetch(code) {
      const v = load(code);
      return v ? { meta: v.meta, moves: Object.values(v.moves || {}) } : null;
    },
    async fetchForPlan(planCode) {
      return all().filter(v => v.planCode === planCode).map(v => ({ code: v.code, meta: v.meta, moves: Object.values(v.moves || {}) }));
    },
    async addMove(code, _planCode, m) {
      const v = load(code);
      if (!v) throw new Error('Challenge not found');
      if (!v.moves[m.id]) v.moves[m.id] = moveRow(m);
      save(code, v);
    },
    subscribe({ code = null, planCode = null }, cb) {
      const h = e => { if ((planCode && e.data?.planCode === planCode) || (code && e.data?.code === code)) cb({ type: 'changed' }); };
      bc?.addEventListener('message', h);
      setTimeout(() => cb({ type: 'connected' }), 0);
      return () => bc?.removeEventListener('message', h);
    },
  };
}
