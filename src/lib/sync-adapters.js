// Transport for live shared rounds. Two implementations with the same shape:
//   create(code, meta, holes)   upsertMeta(code, meta)   upsertHole(code, holeNo, data)
//   fetch(code) -> { meta, holes: {holeNo: data} } | null
//   subscribe(code, cb) -> unsubscribe   (cb gets {type:'meta'|'hole'|'deleted', ...})
//   remove(code)

// --------------------------- Supabase -------------------------------------

export function supabaseAdapter(db) {
  const check = ({ error }) => { if (error) throw error; };
  const now = () => new Date().toISOString();
  return {
    kind: 'supabase',
    async create(code, meta, holes) {
      check(await db.from('live_rounds').insert({ code, meta, updated_at: now() }));
      const rows = Object.entries(holes).map(([no, data]) => ({ code, hole_no: Number(no), data, updated_at: now() }));
      if (rows.length) check(await db.from('live_holes').upsert(rows));
    },
    async upsertMeta(code, meta) {
      check(await db.from('live_rounds').update({ meta, updated_at: now() }).eq('code', code));
    },
    async upsertHole(code, holeNo, data) {
      check(await db.from('live_holes').upsert({ code, hole_no: holeNo, data, updated_at: now() }));
    },
    async fetch(code) {
      const r = await db.from('live_rounds').select('meta').eq('code', code).maybeSingle();
      check(r);
      if (!r.data) return null;
      const h = await db.from('live_holes').select('hole_no, data').eq('code', code);
      check(h);
      return { meta: r.data.meta, holes: Object.fromEntries(h.data.map(x => [x.hole_no, x.data])) };
    },
    subscribe(code, cb) {
      const ch = db.channel(`live-${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_holes', filter: `code=eq.${code}` }, p => {
          if (p.new?.hole_no != null) cb({ type: 'hole', holeNo: p.new.hole_no, data: p.new.data });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rounds', filter: `code=eq.${code}` }, p => {
          if (p.eventType === 'DELETE') cb({ type: 'deleted' });
          else if (p.new?.meta) cb({ type: 'meta', data: p.new.meta });
        })
        .subscribe(status => { if (status === 'SUBSCRIBED') cb({ type: 'connected' }); });
      return () => { db.removeChannel(ch); };
    },
    async remove(code) {
      check(await db.from('live_rounds').delete().eq('code', code));
    },
  };
}

// --------------------------- Local (dev/testing) ---------------------------
// Uses localStorage + BroadcastChannel so two tabs on one computer behave like two phones.

export function localAdapter() {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bb-live') : null;
  const key = code => `bb-live:${code}`;
  const load = code => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const save = (code, v) => localStorage.setItem(key(code), JSON.stringify(v));
  return {
    kind: 'local',
    async create(code, meta, holes) { save(code, { meta, holes }); },
    async upsertMeta(code, meta) {
      const v = load(code); if (!v) throw new Error('Round not found');
      v.meta = meta; save(code, v); bc?.postMessage({ code, type: 'meta', data: meta });
    },
    async upsertHole(code, holeNo, data) {
      const v = load(code); if (!v) throw new Error('Round not found');
      v.holes[holeNo] = data; save(code, v); bc?.postMessage({ code, type: 'hole', holeNo, data });
    },
    async fetch(code) { return load(code); },
    subscribe(code, cb) {
      const h = e => { if (e.data?.code === code) cb(e.data); };
      bc?.addEventListener('message', h);
      setTimeout(() => cb({ type: 'connected' }), 0);
      return () => bc?.removeEventListener('message', h);
    },
    async remove(code) { localStorage.removeItem(key(code)); bc?.postMessage({ code, type: 'deleted' }); },
  };
}
