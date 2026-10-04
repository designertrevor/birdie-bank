// A live captains' draft for a team points trip (Trip Mode, 2026-10-04): two captains take turns
// picking their teams from everyone going, each on their own phone, and both phones (and the
// organizer's) see every pick as it's made.
//
// It rides the trip's matches table on the server (`trip_cup`, cup-sync.js), with no new SQL:
// - the organizer's phone posts the draft itself under the key 'Ldraft': who's in the pool, the
//   two captains, the order, which captain picks first, a version (`v`, new each time it starts
//   over) and the picks made on the organizer's phone, for any captain picking there;
// - each captain's phone posts its own row ('Ldraft-' and its device key): which captain it is
//   and its picks, in order.
// Each phone can only change its own row, so the picks are put together the same way on every
// phone (mergeDraft): turn by turn in the draft order, each captain's next pick from their own
// list, skipping anyone already taken. A captain's pick only counts on their turn, so two phones
// can never take the same player. When everyone is picked, the organizer's phone puts the teams on
// the trip like any other edit (cup.js teams), and the trip's rounds get their matches.
//
// Until that table is on the server (or with no signal) the draft runs on one phone, passed
// around, as it always has (Cup.jsx TeamsPicker). Pure, unit tested.

export const DRAFT_KEY = 'Ldraft';
export const DRAFT_ORDERS = {
  snake: { name: 'Snake', blurb: 'A, B, B, A, A, B: whoever picks second gets two in a row' },
  turns: { name: 'Take turns', blurb: 'A, B, A, B: one pick each, the same captain first every time' },
};

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** A captain's own row's key: 'Ldraft-' and the first 20 characters of the phone's device key. */
export const captainKey = dev => (isStr(dev) && /^[0-9a-f]{20}/.test(dev) ? `${DRAFT_KEY}-${dev.slice(0, 20)}` : null);
/** Whether a trip_cup row is part of a draft (never a round's matches). */
export const isDraftKey = key => key === DRAFT_KEY || String(key).startsWith(`${DRAFT_KEY}-`);

/**
 * Which captain picks each pick (0 or 1), for `n` picks: snake (A, B, B, A, A, B...) or taking
 * turns (A, B, A, B...), from `first` (the captain who picks first).
 */
export function draftOrder(n, { order = 'snake', first = 0 } = {}) {
  const a = first === 1 ? 1 : 0, b = 1 - a;
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    if (order === 'turns') return i % 2 ? b : a;
    const round = Math.floor(i / 2), pos = i % 2;
    return round % 2 === 0 ? (pos ? b : a) : (pos ? a : b);
  });
}

/** The draft as the organizer's phone posted it, tidied, or null: { v, pool, captains, names, order, first, here, picks, byName, at }. */
export function cleanDraft(raw) {
  if (!isObj(raw) || raw.draft !== 1 || !Array.isArray(raw.pool) || !Array.isArray(raw.captains)) return null;
  const seen = new Set();
  const pool = raw.pool.filter(p => isObj(p) && isStr(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, 24)
    .map(p => ({ id: p.id, name: String(p.name || '').trim().slice(0, 40) || 'Player', index: Number.isFinite(Number(p.index)) && p.index !== null && p.index !== '' ? Number(p.index) : null }));
  const ids = new Set(pool.map(p => p.id));
  const captains = [0, 1].map(i => (isStr(raw.captains[i]) && ids.has(raw.captains[i]) ? raw.captains[i] : null));
  if (!captains[0] || !captains[1] || captains[0] === captains[1]) return null;
  const list = l => (Array.isArray(l) ? l.filter(id => ids.has(id)).slice(0, 24) : []);
  return {
    v: Number.isInteger(raw.v) && raw.v > 0 ? raw.v : 1,
    pool, captains,
    names: [0, 1].map(i => String(raw.names?.[i] || '').trim().slice(0, 16) || ['Blue', 'Red'][i]),
    order: raw.order === 'turns' ? 'turns' : 'snake',
    first: raw.first === 1 ? 1 : 0,
    here: [0, 1].map(i => raw.here?.[i] === true),
    picks: [0, 1].map(i => list(raw.picks?.[i])),
    byName: isStr(raw.byName) ? raw.byName.slice(0, 40) : null,
    at: Number(raw.at) || 0,
  };
}

/** A captain's phone's row, tidied, or null: { seat, v, picks, name, at }. */
export function cleanCaptainRow(raw) {
  if (!isObj(raw) || raw.draft !== 1 || (raw.seat !== 0 && raw.seat !== 1)) return null;
  return {
    seat: raw.seat, v: Number.isInteger(raw.v) ? raw.v : 0,
    picks: Array.isArray(raw.picks) ? raw.picks.filter(isStr).slice(0, 24) : [],
    name: isStr(raw.name) ? raw.name.slice(0, 40) : null,
    at: Number(raw.at) || 0,
  };
}

/**
 * The phone picking for each captain: the organizer's phone for a captain it picks for (`here`),
 * else the first phone that opened that captain's link for this version of the draft (the earliest
 * row). `rows`: { key: data } from the server. [{ key, row } | null, ...] by captain.
 */
export function seatPhones(draft, rows) {
  return [0, 1].map(seat => {
    if (draft.here[seat]) return null;
    const mine = Object.entries(rows || {}).filter(([k]) => k !== DRAFT_KEY && isDraftKey(k))
      .map(([key, raw]) => ({ key, row: cleanCaptainRow(raw) }))
      .filter(x => x.row && x.row.seat === seat && x.row.v === draft.v)
      .sort((a, b) => a.row.at - b.row.at || a.key.localeCompare(b.key));
    return mine[0] || null;
  });
}

/**
 * The draft so far, put together the same way on every phone: { teams: [[ids], [ids]] (captain
 * first, then their picks), picks: [{ seat, id }], turn (the captain to pick, null when it's done),
 * done, left (ids still to pick) }. Each captain's picks come from the organizer's phone when it
 * picks for them, else from their own phone's row (seatPhones). Turn by turn in the draft order,
 * the captain's next pick counts unless that player is taken already (or isn't in the pool); a
 * captain who hasn't picked yet holds the draft there.
 */
export function mergeDraft(draft, rows = {}) {
  const phones = seatPhones(draft, rows);
  const lists = [0, 1].map(s => (draft.here[s] ? draft.picks[s] : phones[s]?.row.picks || []));
  const pool = new Set(draft.pool.map(p => p.id));
  const taken = new Set(draft.captains);
  const teams = [[draft.captains[0]], [draft.captains[1]]];
  const picks = [];
  const at = [0, 0];
  const n = draft.pool.filter(p => !taken.has(p.id)).length;
  const order = draftOrder(n, draft);
  let turn = null;
  for (const seat of order) {
    const list = lists[seat];
    while (at[seat] < list.length && (taken.has(list[at[seat]]) || !pool.has(list[at[seat]]))) at[seat]++;
    if (at[seat] >= list.length) { turn = seat; break; }
    const id = list[at[seat]++];
    taken.add(id);
    teams[seat].push(id);
    picks.push({ seat, id });
  }
  const left = draft.pool.map(p => p.id).filter(id => !taken.has(id));
  return { teams, picks, turn: left.length ? turn : null, done: !left.length, left };
}

/**
 * This captain's list after picking `id` on their turn (the picks they've made that count, then
 * this one), or null when it isn't their turn or that player is gone.
 */
export function pickFor(draft, rows, seat, id) {
  const now = mergeDraft(draft, rows);
  if (now.done || now.turn !== seat || !now.left.includes(id)) return null;
  return [...now.picks.filter(p => p.seat === seat).map(p => p.id), id];
}

/**
 * This captain's list with their last pick taken back, or null when it isn't the draft's last pick
 * (once the other captain has picked after it, it stands).
 */
export function undoFor(draft, rows, seat) {
  const now = mergeDraft(draft, rows);
  const last = now.picks.at(-1);
  if (!last || last.seat !== seat) return null;
  return now.picks.filter(p => p.seat === seat).slice(0, -1).map(p => p.id);
}

/** A new draft for the organizer's phone to post: pool, captains, names, order and who picks first. */
export function newDraft({ pool, captains, names, order = 'snake', first = 0, here = [false, false], byName = null, v = 1, now = Date.now() }) {
  return cleanDraft({ draft: 1, v, pool, captains, names, order, first, here, picks: [[], []], byName, at: now });
}

/**
 * The draft as it goes to the server (the organizer's row). `here` and `picks` say which captains
 * pick on the organizer's phone, and what they've picked there.
 */
export const draftRow = d => ({ draft: 1, v: d.v, pool: d.pool, captains: d.captains, names: d.names, order: d.order, first: d.first, here: d.here, picks: d.picks, byName: d.byName, at: d.at });

/**
 * The organizer's phone takes over picking for a captain (no signal on theirs, say): what that
 * captain has picked so far stays theirs, and the next picks are made here.
 */
export function pickHere(draft, rows, seat) {
  const now = mergeDraft(draft, rows);
  const mine = now.picks.filter(p => p.seat === seat).map(p => p.id);
  return { ...draft, here: draft.here.map((h, i) => (i === seat ? true : h)), picks: draft.picks.map((l, i) => (i === seat ? mine : l)) };
}

/** The teams the draft made, as the cup keeps them ([[{ id, name }], ...]), from the pool's names. */
export function draftTeams(draft, merged) {
  const name = id => draft.pool.find(p => p.id === id)?.name || 'Player';
  return merged.teams.map(t => t.map(id => ({ id, name: name(id) })));
}

/** The link that opens a captain's side of the draft on their own phone. */
export function draftLink(origin, tripId, seat) {
  return `${origin}/?draft=${encodeURIComponent(tripId)}&c=${seat === 1 ? 1 : 0}`;
}

/** A trip id from a draft link, or null. */
export function cleanTripId(v) {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}
