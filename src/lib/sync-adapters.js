// Transport for live shared rounds. Two implementations with the same shape:
//   create(code, meta, holes)   upsertMeta(code, meta)   upsertHole(code, holeNo, data)
//   fetch(code) -> { meta, holes: {holeNo: data} } | null
//   subscribe(code, cb) -> unsubscribe   (cb gets {type:'meta'|'hole'|'deleted', ...})
//   remove(code)
import { holeAllowed, lockTrack, lockedMeta, removeAllowed } from './keeper-lock.js';

// --------------------------- Supabase -------------------------------------
// A round is read and written only with its code: every request for live_rounds and live_holes
// carries the code in the x-round-code header, and once supabase/2026-10-06-round-codes.sql is run
// the server shows a request only the round its header names, so nobody can list rounds. Until
// then the header is simply ignored.
//
// Realtime can't see request headers, so after that SQL its table changes reach nobody. Phones
// hear each other another way: every write sends a poke on the round's channel (a broadcast that
// says only "hole 7 changed", never the data), and the phones listening fetch that part again with
// the code. A phone also hears its own write back (the server's copy, which the keeper lock may
// have kept), and while a round is open, phones that hear nothing from the table changes check
// again every POLL_MS in case a poke went missing. On a server without the SQL the table changes
// still come through as before.

export const CODE_HEADER = 'x-round-code';
export const POLL_MS = 20000;
const POKE = 'poke';

export function supabaseAdapter(db, { pollMs = POLL_MS } = {}) {
  const check = ({ error }) => { if (error) throw error; };
  const now = () => new Date().toISOString();
  const withCode = (q, code) => q.setHeader(CODE_HEADER, String(code));
  const topic = code => `live-${code}`;
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const later = fn => setTimeout(fn, 0);

  // One channel per round code on this phone, shared by everything listening to it (live sync,
  // a seat request, a friend's round on screen), so one stopping doesn't stop the others
  const hubs = new Map(); // code -> { ch, cbs, connected, tableLive, seen, timer, busy }
  const emit = (code, ev) => {
    const hub = hubs.get(code);
    if (!hub) return;
    if (ev.type === 'meta') hub.seen.meta = JSON.stringify(ev.data);
    if (ev.type === 'hole') hub.seen[ev.holeNo] = JSON.stringify(ev.data ?? null);
    [...hub.cbs].forEach(cb => cb(ev));
  };

  async function readMeta(code) {
    const r = await withCode(db.from('live_rounds').select('meta').eq('code', code), code).maybeSingle();
    check(r);
    return r.data ? r.data.meta : null;
  }
  async function readHoles(code, holeNo) {
    let q = db.from('live_holes').select('hole_no, data').eq('code', code);
    if (holeNo != null) q = q.eq('hole_no', holeNo);
    const h = await withCode(q, code);
    check(h);
    return h.data || [];
  }
  async function fetchRound(code) {
    const meta = await readMeta(code);
    if (meta == null) return null;
    const holes = await readHoles(code);
    return { meta, holes: Object.fromEntries(holes.map(x => [x.hole_no, x.data])) };
  }

  // A poke or a table change came in: fetch what it names and tell the listeners
  async function refresh(code, what = {}) {
    if (!hubs.has(code)) return;
    try {
      if (what.kind === 'hole' && Number.isInteger(what.holeNo)) {
        const [row] = await readHoles(code, what.holeNo);
        emit(code, { type: 'hole', holeNo: what.holeNo, data: row ? row.data : null });
        return;
      }
      const meta = await readMeta(code);
      if (meta == null) emit(code, { type: 'deleted' });
      else if (what.kind !== 'deleted') emit(code, { type: 'meta', data: meta });
    } catch { /* no signal: the next poke, check or reconnect catches up */ }
  }

  // The safety net: the whole round, telling the listeners only what changed since they last heard
  async function poll(code) {
    const hub = hubs.get(code);
    if (!hub || hub.busy || hub.tableLive || !visible()) return;
    hub.busy = true;
    try {
      const remote = await fetchRound(code);
      if (hubs.get(code) !== hub) return;
      if (!remote) { emit(code, { type: 'deleted' }); return; }
      if (JSON.stringify(remote.meta) !== hub.seen.meta) emit(code, { type: 'meta', data: remote.meta });
      for (const [no, data] of Object.entries(remote.holes)) {
        if (JSON.stringify(data ?? null) !== hub.seen[no]) emit(code, { type: 'hole', holeNo: Number(no), data });
      }
    } catch { /* no signal: try again on the next tick */ } finally {
      hub.busy = false;
    }
  }

  // Tell the other phones on this round that something changed. Best effort: their check catches it
  function poke(code, what) {
    const hub = hubs.get(code);
    try {
      if (hub?.connected) { hub.ch.send({ type: 'broadcast', event: POKE, payload: what })?.catch?.(() => {}); return; }
      // Nothing on this phone listens to the round (a seat request from the join screen): send it over HTTP
      const ch = db.channel(topic(code));
      Promise.resolve(ch.httpSend ? ch.httpSend(POKE, what) : null).catch(() => {}).finally(() => { if (!hubs.has(code)) db.removeChannel(ch); });
    } catch { /* no realtime: the others check again */ }
  }

  function openHub(code) {
    const hub = { ch: null, cbs: new Set(), connected: false, tableLive: false, seen: {}, timer: null, busy: false };
    hubs.set(code, hub);
    const table = () => { hub.tableLive = true; };
    hub.ch = db.channel(topic(code))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_holes', filter: `code=eq.${code}` }, p => {
        table();
        if (p.new?.hole_no != null) emit(code, { type: 'hole', holeNo: p.new.hole_no, data: p.new.data });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rounds', filter: `code=eq.${code}` }, p => {
        table();
        // A delete is checked first: it comes with only the round's code, and only once it's really gone does the round end
        if (p.eventType === 'DELETE') { if (!p.old?.code || p.old.code === code) refresh(code, { kind: 'deleted' }); }
        else if (p.new?.meta) emit(code, { type: 'meta', data: p.new.meta });
      })
      .on('broadcast', { event: POKE }, msg => refresh(code, msg?.payload || {}))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { hub.connected = true; emit(code, { type: 'connected' }); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') hub.connected = false;
      });
    if (pollMs > 0) hub.timer = setInterval(() => poll(code), pollMs);
    return hub;
  }

  return {
    kind: 'supabase',
    async create(code, meta, holes) {
      check(await withCode(db.from('live_rounds').insert({ code, meta, updated_at: now() }), code));
      const rows = Object.entries(holes).map(([no, data]) => ({ code, hole_no: Number(no), data, updated_at: now() }));
      if (rows.length) check(await withCode(db.from('live_holes').upsert(rows), code));
    },
    async upsertMeta(code, meta) {
      const r = await withCode(db.from('live_rounds').update({ meta, updated_at: now() }).eq('code', code).select('meta'), code);
      check(r);
      const kept = r.data?.[0]?.meta;
      // After the push that sent it has noted it, the way a table change would arrive
      if (kept) later(() => emit(code, { type: 'meta', data: kept }));
      poke(code, { kind: 'meta' });
    },
    async upsertHole(code, holeNo, data) {
      const r = await withCode(db.from('live_holes').upsert({ code, hole_no: holeNo, data, updated_at: now() }).select('hole_no, data'), code);
      check(r);
      const row = r.data?.[0];
      if (row) later(() => emit(code, { type: 'hole', holeNo: row.hole_no, data: row.data }));
      poke(code, { kind: 'hole', holeNo });
    },
    fetch: fetchRound,
    subscribe(code, cb) {
      const hub = hubs.get(code) || openHub(code);
      hub.cbs.add(cb);
      // Joining a channel already open: this listener is connected straight away
      if (hub.connected) later(() => { if (hub.cbs.has(cb)) cb({ type: 'connected' }); });
      return () => {
        hub.cbs.delete(cb);
        if (hub.cbs.size || hubs.get(code) !== hub) return;
        hubs.delete(code);
        clearInterval(hub.timer);
        db.removeChannel(hub.ch);
      };
    },
    async remove(code) {
      check(await withCode(db.from('live_rounds').delete().eq('code', code), code));
      poke(code, { kind: 'deleted' });
    },
  };
}

// --------------------------- Local (dev/testing) ---------------------------
// Uses localStorage + BroadcastChannel so two tabs on one computer behave like two phones.
// It plays the server's keeper lock too (keeper-lock.js), with `device()` as the writer, the way
// Supabase does once supabase/2026-09-30-keeper-lock.sql is run. localStorage bb-lock-off = 1 turns
// it off, to try the app as it is before the SQL is run.

export function localAdapter(device = () => null) {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bb-live') : null;
  const key = code => `bb-live:${code}`;
  const load = code => { try { return JSON.parse(localStorage.getItem(key(code))); } catch { return null; } };
  const save = (code, v) => localStorage.setItem(key(code), JSON.stringify(v));
  const lockOn = () => { try { return localStorage.getItem('bb-lock-off') !== '1'; } catch { return true; } };
  // Supabase's realtime tells the writer too; BroadcastChannel doesn't, so this tab's own listeners hear it here
  const mine = new Set();
  const tell = msg => { bc?.postMessage(msg); mine.forEach(h => h({ data: msg })); };
  return {
    kind: 'local',
    async create(code, meta, holes) {
      const kept = lockOn() ? lockedMeta(null, meta, device()) : meta;
      save(code, { meta: kept, holes, lock: lockTrack(null, kept) });
    },
    async upsertMeta(code, meta) {
      const v = load(code); if (!v) throw new Error('Round not found');
      if (!lockOn()) { v.meta = meta; save(code, v); bc?.postMessage({ code, type: 'meta', data: meta }); return; }
      const kept = lockedMeta(v.meta, meta, device(), { askSeenAt: v.lock?.askSeenAt || 0 });
      v.lock = lockTrack(v.meta, kept, v.lock);
      v.meta = kept; save(code, v);
      tell({ code, type: 'meta', data: kept });
    },
    async upsertHole(code, holeNo, data) {
      const v = load(code); if (!v) throw new Error('Round not found');
      if (lockOn() && !holeAllowed(v.meta, holeNo, device(), v.lock?.prevDev)) {
        // Left as the server has it, and this phone hears the server's copy back
        if (holeNo in v.holes) tell({ code, type: 'hole', holeNo, data: v.holes[holeNo] });
        return;
      }
      v.holes[holeNo] = data; save(code, v); bc?.postMessage({ code, type: 'hole', holeNo, data });
    },
    async fetch(code) { const v = load(code); return v && { meta: v.meta, holes: v.holes }; },
    subscribe(code, cb) {
      const h = e => { if (e.data?.code === code) cb(e.data); };
      bc?.addEventListener('message', h);
      mine.add(h);
      setTimeout(() => cb({ type: 'connected' }), 0);
      return () => { bc?.removeEventListener('message', h); mine.delete(h); };
    },
    async remove(code) {
      const v = load(code);
      if (lockOn() && v && !removeAllowed(v.meta, device())) return;
      localStorage.removeItem(key(code)); bc?.postMessage({ code, type: 'deleted' });
    },
  };
}
