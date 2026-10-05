// The shared Tab's transport on the server, kept apart from the queue in tab-sync.js so it loads
// without the app around it (and tests can drive it with a stand-in client):
//   fetchRows(codes) -> rows   upsertRow(row)   subscribe(codes, cb) -> unsubscribe
import { isMissingTable } from './plan-adapters.js';

/** Thrown when the round_payments table isn't on the server yet. */
export class TabOffError extends Error {
  constructor() { super('The shared Tab isn’t switched on yet'); this.name = 'TabOffError'; }
}

/** The server refused this one row for good (bad data), so retrying won't help. */
export class BadRowError extends Error {
  constructor(cause) { super(cause?.message || 'Row refused'); this.name = 'BadRowError'; this.cause = cause; }
}

const iso = ms => new Date(ms || Date.now()).toISOString();
const toDb = r => ({
  code: r.code, id: r.id, kind: r.kind, from_id: r.from, to_id: r.to, amount: Number(r.amount) || 0, status: r.status,
  by_id: r.by || null, reason: r.reason ? String(r.reason).slice(0, 60) : null, created_at: iso(r.at), updated_at: iso(r.updatedAt),
});
const fromDb = x => ({
  code: x.code, id: x.id, kind: x.kind, from: x.from_id, to: x.to_id, amount: Number(x.amount) || 0, status: x.status,
  by: x.by_id || null, reason: x.reason || null, at: Date.parse(x.created_at) || 0, updatedAt: Date.parse(x.updated_at) || 0,
});

// Payments are read and written only with their round's code in the x-round-code header (a comma
// list when reading several rounds), and once supabase/2026-10-06-round-codes.sql is run the
// server shows a request only those rounds' rows (until then the header is ignored). Table changes
// then reach nobody, so an open Tab also checks again every TAB_CHECK_MS.
export const TAB_HEADER = 'x-round-code';
export const TAB_CHECK_MS = 30000;
const CODES_PER_READ = 100;

export function supabaseTab(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new TabOffError();
    // A row the table can never take (a check it fails): drop it rather than block the queue behind it
    if (/^2[23]/.test(String(error.code || ''))) throw new BadRowError(error);
    throw error;
  };
  return {
    kind: 'supabase',
    async fetchRows(codes) {
      if (!codes.length) return [];
      const out = [];
      for (let i = 0; i < codes.length; i += CODES_PER_READ) {
        const some = codes.slice(i, i + CODES_PER_READ);
        const r = await db.from('round_payments').select('*').in('code', some).setHeader(TAB_HEADER, some.join(','));
        check(r);
        out.push(...(r.data || []).map(fromDb));
      }
      return out;
    },
    async upsertRow(row) { check(await db.from('round_payments').upsert(toDb(row)).setHeader(TAB_HEADER, String(row.code))); },
    subscribe(codes, cb) {
      if (!codes.length) return () => {};
      const ch = db.channel(`tab-${codes.join('-').slice(0, 60)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_payments', filter: `code=in.(${codes.join(',')})` }, p => {
          if (p.new?.code) cb(fromDb(p.new));
        })
        .subscribe();
      return () => { db.removeChannel(ch); };
    },
  };
}
