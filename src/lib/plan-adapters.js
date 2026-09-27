// Transport for upcoming rounds (planned rounds, RSVPs and votes). Two implementations with the
// same shape, like the live round adapters:
//   create(code, meta)   updateMeta(code, meta)   remove(code)
//   fetch(code) -> { meta, rsvps: [{ who, name, status, payApp, payHandle, at }], votes: [{ who, kind, choice }] } | null
//   setRsvp(code, { who, name, status, payApp, payHandle })   setVote(code, who, kind, choice | null)
//   subscribe(code, cb) -> unsubscribe   (cb gets { type: 'changed' | 'deleted' | 'connected' })

/** Thrown when the upcoming rounds tables aren't on the server yet (the SQL hasn't been run). */
export class PlansOffError extends Error {
  constructor() { super('Group links aren’t switched on yet'); this.name = 'PlansOffError'; }
}

/** Postgres "no such table", or PostgREST "not in the schema cache". */
export function isMissingTable(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') return true;
  return /does not exist|schema cache/i.test(error.message || '');
}

// --------------------------- Supabase -------------------------------------

export function planSupabaseAdapter(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new PlansOffError();
    throw error;
  };
  const now = () => new Date().toISOString();
  return {
    kind: 'supabase',
    async create(code, meta) {
      check(await db.from('planned_rounds').insert({ code, meta, updated_at: now() }));
    },
    async updateMeta(code, meta) {
      check(await db.from('planned_rounds').update({ meta, updated_at: now() }).eq('code', code));
    },
    async fetch(code) {
      const r = await db.from('planned_rounds').select('meta').eq('code', code).maybeSingle();
      check(r);
      if (!r.data) return null;
      const [a, v] = await Promise.all([
        db.from('plan_rsvps').select('who, name, status, pay_app, pay_handle, updated_at').eq('code', code),
        db.from('plan_votes').select('who, kind, choice').eq('code', code),
      ]);
      check(a); check(v);
      return {
        meta: r.data.meta,
        rsvps: a.data.map(x => ({ who: x.who, name: x.name, status: x.status, payApp: x.pay_app, payHandle: x.pay_handle, at: Date.parse(x.updated_at) || 0 })),
        votes: v.data,
      };
    },
    async setRsvp(code, { who, name, status, payApp = null, payHandle = null }) {
      check(await db.from('plan_rsvps').upsert({ code, who, name, status, pay_app: payApp, pay_handle: payHandle, updated_at: now() }));
    },
    async setVote(code, who, kind, choice) {
      if (choice == null) check(await db.from('plan_votes').delete().eq('code', code).eq('who', who).eq('kind', kind));
      else check(await db.from('plan_votes').upsert({ code, who, kind, choice: String(choice), updated_at: now() }));
    },
    subscribe(code, cb) {
      const changed = () => cb({ type: 'changed' });
      const ch = db.channel(`plan-${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_rsvps', filter: `code=eq.${code}` }, changed)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_votes', filter: `code=eq.${code}` }, changed)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planned_rounds', filter: `code=eq.${code}` }, p => {
          cb({ type: p.eventType === 'DELETE' ? 'deleted' : 'changed' });
        })
        .subscribe(status => { if (status === 'SUBSCRIBED') cb({ type: 'connected' }); });
      return () => { db.removeChannel(ch); };
    },
    async remove(code) {
      check(await db.from('planned_rounds').delete().eq('code', code));
    },
  };
}

// --------------------------- Local (dev/testing) ---------------------------
// localStorage + BroadcastChannel, so two tabs on one computer (one with ?profile=b) behave
// like the organizer's phone and a friend's.

export function planLocalAdapter() {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bb-plan') : null;
  const key = code => `bb-plan:${code}`;
  const load = code => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const save = (code, v) => { localStorage.setItem(key(code), JSON.stringify(v)); bc?.postMessage({ code, type: 'changed' }); };
  const must = code => { const v = load(code); if (!v) throw new Error('Plan not found'); return v; };
  return {
    kind: 'local',
    async create(code, meta) { save(code, { meta, rsvps: {}, votes: {} }); },
    async updateMeta(code, meta) { const v = must(code); v.meta = meta; save(code, v); },
    async fetch(code) {
      const v = load(code);
      if (!v) return null;
      return { meta: v.meta, rsvps: Object.values(v.rsvps || {}), votes: Object.values(v.votes || {}) };
    },
    async setRsvp(code, row) {
      const v = must(code);
      v.rsvps[row.who] = { ...row, at: Date.now() };
      save(code, v);
    },
    async setVote(code, who, kind, choice) {
      const v = must(code);
      if (choice == null) delete v.votes[`${who}:${kind}`];
      else v.votes[`${who}:${kind}`] = { who, kind, choice: String(choice) };
      save(code, v);
    },
    subscribe(code, cb) {
      const h = e => { if (e.data?.code === code) cb({ type: e.data.type }); };
      bc?.addEventListener('message', h);
      setTimeout(() => cb({ type: 'connected' }), 0);
      return () => bc?.removeEventListener('message', h);
    },
    async remove(code) { localStorage.removeItem(key(code)); bc?.postMessage({ code, type: 'deleted' }); },
  };
}
