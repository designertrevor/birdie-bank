// Transport for upcoming rounds (planned rounds, RSVPs and votes). Two implementations with the
// same shape, like the live round adapters:
//   create(code, meta)   remove(code)
//   updateMeta(code, meta) -> false when the server kept the plan as it was (not the organizer's phone)
//   fetch(code) -> { meta, rsvps: [{ who, name, status, payApp, payHandle, at, self }], votes: [{ who, kind, choice }] } | null
//   setRsvp(code, { who, name, status, payApp, payHandle }) -> false when the server kept someone else's answer
//   setVote(code, who, kind, choice | null)
//   subscribe(code, cb) -> unsubscribe   (cb gets { type: 'changed' | 'deleted' | 'connected' })
// `self` on an RSVP: the person answered from their own phone, so only they can change it (once
// supabase/2026-10-04-plan-lock.sql has run; plan-lock.js has the rules). Before it runs, every
// answer is open and every write is kept, as before.
import { answerWrite, hostOf, planWrite } from './plan-lock.js';

// A plan is read and written only with its code: every request carries it in the x-plan-code
// header, and once supabase/2026-10-06-round-codes.sql is run the server shows a request only the
// plan its header names (until then the header is ignored). Table changes then reach nobody, so
// every write also pokes the plan's channel (a broadcast with no data) and the phones on it fetch again.
export const PLAN_HEADER = 'x-plan-code';
const POKE = 'poke';

/**
 * Pokes for a code's channel: `listen(ch, cb)` adds the poke to a channel being opened, `send(topic)`
 * tells the phones on it, over the open channel when this phone has one, else over HTTP.
 */
export function pokes(db) {
  const open = new Map(); // topic -> channel
  return {
    listen(topic, ch, cb) {
      open.set(topic, ch);
      return { ch: ch.on('broadcast', { event: POKE }, () => cb()), done: () => { if (open.get(topic) === ch) open.delete(topic); } };
    },
    send(topic) {
      try {
        const have = open.get(topic);
        if (have) { have.send({ type: 'broadcast', event: POKE, payload: {} })?.catch?.(() => {}); return; }
        const ch = db.channel(topic);
        Promise.resolve(ch.httpSend ? ch.httpSend(POKE, {}) : null).catch(() => {}).finally(() => { if (!open.has(topic)) db.removeChannel(ch); });
      } catch { /* no realtime: the others fetch when they wake */ }
    },
  };
}

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
  const withCode = (q, code) => q.setHeader(PLAN_HEADER, String(code));
  const poke = pokes(db);
  const topic = code => `plan-${code}`;
  // Every request for a plan's tables names the plan
  const req = (table, code, build) => withCode(build(db.from(table)), code);
  return {
    kind: 'supabase',
    async create(code, meta) {
      check(await req('planned_rounds', code, t => t.insert({ code, meta, updated_at: now() })));
    },
    async updateMeta(code, meta) {
      const r = await req('planned_rounds', code, t => t.update({ meta, updated_at: now() }).eq('code', code).select('code'));
      check(r);
      poke.send(topic(code));
      // The lock leaves a plan that isn't this phone's (or account's) as it is, so no row comes back
      return !Array.isArray(r.data) || r.data.length > 0;
    },
    async fetch(code) {
      const r = await req('planned_rounds', code, t => t.select('meta').eq('code', code).maybeSingle());
      check(r);
      if (!r.data) return null;
      const [a, v] = await Promise.all([
        // Every column, so by_self comes back once the plan lock SQL has added it (and nothing breaks before)
        req('plan_rsvps', code, t => t.select('*').eq('code', code)),
        req('plan_votes', code, t => t.select('who, kind, choice').eq('code', code)),
      ]);
      check(a); check(v);
      return {
        meta: r.data.meta,
        rsvps: a.data.map(x => ({ who: x.who, name: x.name, status: x.status, payApp: x.pay_app, payHandle: x.pay_handle, at: Date.parse(x.updated_at) || 0, self: x.by_self === true })),
        votes: v.data,
      };
    },
    async setRsvp(code, { who, name, status, payApp = null, payHandle = null }) {
      const r = await req('plan_rsvps', code, t => t.upsert({ code, who, name, status, pay_app: payApp, pay_handle: payHandle, updated_at: now() }).select('who'));
      check(r);
      poke.send(topic(code));
      // The lock leaves someone else's answer as it is, so no row comes back
      return !Array.isArray(r.data) || r.data.length > 0;
    },
    async setVote(code, who, kind, choice) {
      if (choice == null) check(await req('plan_votes', code, t => t.delete().eq('code', code).eq('who', who).eq('kind', kind)));
      else check(await req('plan_votes', code, t => t.upsert({ code, who, kind, choice: String(choice), updated_at: now() })));
      poke.send(topic(code));
    },
    subscribe(code, cb) {
      const changed = () => cb({ type: 'changed' });
      const heard = poke.listen(topic(code), db.channel(topic(code)), changed);
      const ch = heard.ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_rsvps', filter: `code=eq.${code}` }, changed)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_votes', filter: `code=eq.${code}` }, changed)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planned_rounds', filter: `code=eq.${code}` }, p => {
          cb({ type: p.eventType === 'DELETE' ? 'deleted' : 'changed' });
        })
        .subscribe(status => { if (status === 'SUBSCRIBED') cb({ type: 'connected' }); });
      return () => { heard.done(); db.removeChannel(ch); };
    },
    async remove(code) {
      check(await req('planned_rounds', code, t => t.delete().eq('code', code)));
      poke.send(topic(code));
    },
  };
}

// --------------------------- Local (dev/testing) ---------------------------
// localStorage + BroadcastChannel, so two tabs on one computer (one with ?profile=b) behave
// like the organizer's phone and a friend's. It plays the server's plan lock too (plan-lock.js),
// with `device()` as the writer, the way Supabase does once supabase/2026-10-04-plan-lock.sql is
// run. localStorage bb-lock-off = 1 turns it off, to try the app as it is before the SQL is run.

export function planLocalAdapter(device = () => null) {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bb-plan') : null;
  const key = code => `bb-plan:${code}`;
  const load = code => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const save = (code, v) => { localStorage.setItem(key(code), JSON.stringify(v)); bc?.postMessage({ code, type: 'changed' }); };
  const must = code => { const v = load(code); if (!v) throw new Error('Plan not found'); return v; };
  const lockOn = () => { try { return localStorage.getItem('bb-lock-off') !== '1'; } catch { return true; } };
  const writer = () => ({ dev: device() ?? null, user: null });
  // Who may write `who`'s answer (plan-lock.js), noting a new owner; null when it isn't theirs
  const answerAs = (v, who, take) => {
    if (!lockOn()) return 'open';
    const r = answerWrite({ host: v.host, hostWho: v.meta?.hostWho, who, owner: v.owners?.[who] ?? null, w: writer(), take });
    if (r.as != null && r.owner) v.owners = { ...v.owners, [who]: r.owner };
    return r.as;
  };
  return {
    kind: 'local',
    async create(code, meta) { save(code, { meta, rsvps: {}, votes: {}, host: lockOn() ? hostOf(writer()) : null, owners: {} }); },
    async updateMeta(code, meta) {
      const v = must(code);
      if (lockOn()) { const r = planWrite(v.host, writer()); if (!r.ok) return false; v.host = r.host; }
      v.meta = meta; save(code, v);
      return true;
    },
    async fetch(code) {
      const v = load(code);
      if (!v) return null;
      return { meta: v.meta, rsvps: Object.values(v.rsvps || {}), votes: Object.values(v.votes || {}) };
    },
    async setRsvp(code, row) {
      const v = must(code);
      const as = answerAs(v, row.who, true);
      if (as == null) return false;
      v.rsvps[row.who] = { ...row, at: Date.now(), self: as === 'self' };
      save(code, v);
      return true;
    },
    async setVote(code, who, kind, choice) {
      const v = must(code);
      if (answerAs(v, who, false) == null) return;
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
    async remove(code) {
      const v = load(code);
      if (v && lockOn() && !planWrite(v.host, writer()).ok) return;
      localStorage.removeItem(key(code)); bc?.postMessage({ code, type: 'deleted' });
    },
  };
}
