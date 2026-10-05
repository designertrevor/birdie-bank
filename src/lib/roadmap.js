// The roadmap screen's rules: what's on the list, how votes count, your own ideas, and the
// "it's live" note on Up next. Pure, so the tests cover it; roadmap-sync.js does the saving and
// the server calls, and the list itself comes from ROADMAP.md (roadmap-public.js).
//
// The pieces it works with:
//  • base: the public list built from ROADMAP.md, [{ id, title, blurb, area, status, shipped, step, kind, order }]
//  • server: what the server last said (all optional, empty until supabase/2026-10-07-roadmap.sql runs)
//      counts   { [item]: { votes, comments } }
//      requests [{ id: 'q-…', title, status, kind, shipped_on }]   ideas Trevor put on the roadmap
//      mine     [{ id, kind, item, status, title, shipped_on }]    your own ideas, and what became of them
//      myVotes  [item]                                             what your account has voted for
//  • local: this phone's own record, kept in roadmap-sync.js
//      votes { [item]: { on, at, synced } }   a vote (or a vote taken back) and whether the server has it
//      sent  [{ id, kind, title, at }]        ideas sent from this phone (feedback ids)
//      told  { [item]: at }                   "it's live" notes already shown

export const STATUSES = ['planned', 'progress', 'shipped'];
export const STATUS_LABEL = { planned: 'Planned', progress: 'In progress', shipped: 'Shipped' };
const STEP_RANK = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, Later: 6 };
/** An "it's live" note only for something that shipped in the last this-many days. */
export const NOTE_DAYS = 45;
const DAY = 86400e3;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const list = v => (Array.isArray(v) ? v : []);
export const ITEM_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** An empty local record. */
export function emptyLocal() { return { votes: {}, sent: [], told: {} }; }

/** A local record read back from storage, with anything odd left out. */
export function cleanLocal(raw) {
  const src = isObj(raw) ? raw : {};
  const votes = {};
  if (isObj(src.votes)) {
    for (const [id, v] of Object.entries(src.votes)) {
      if (ITEM_ID.test(id) && isObj(v)) votes[id] = { on: v.on === true, at: Number(v.at) || 0, synced: v.synced === true };
    }
  }
  const sent = list(src.sent).filter(s => isObj(s) && typeof s.id === 'string' && /^[0-9a-f-]{36}$/i.test(s.id))
    .map(s => ({ id: s.id.toLowerCase(), kind: ['game', 'feature', 'course'].includes(s.kind) ? s.kind : 'feature', title: String(s.title || '').slice(0, 120), at: Number(s.at) || 0 }));
  const told = {};
  if (isObj(src.told)) for (const [id, at] of Object.entries(src.told)) if (ITEM_ID.test(id)) told[id] = Number(at) || 0;
  return { votes, sent, told };
}

/** The item id an idea sent in gets once it's on the roadmap as its own item. */
export const requestItemId = feedbackId => `q-${String(feedbackId).toLowerCase()}`;

/** A request's area name on the list, by its kind. */
const REQUEST_AREA = { game: 'Games and rounds', course: 'Courses', feature: 'Ideas from golfers' };

/**
 * The whole list: the items from ROADMAP.md, then the ideas Trevor put on the roadmap as their own
 * items (public title and status only). Each is { id, title, blurb, area, status, shipped, step, kind, order, request }.
 */
export function roadmapItems(base, requests = []) {
  const out = list(base).filter(i => isObj(i) && ITEM_ID.test(i.id) && STATUSES.includes(i.status)).map(i => ({ ...i, request: false }));
  const seen = new Set(out.map(i => i.id));
  for (const r of list(requests)) {
    if (!isObj(r) || !ITEM_ID.test(String(r.id || '')) || seen.has(r.id)) continue;
    const title = String(r.title || '').trim();
    if (!title || !STATUSES.includes(r.status)) continue;
    seen.add(r.id);
    out.push({
      id: r.id, title: title.slice(0, 80), blurb: null, area: REQUEST_AREA[r.kind] || REQUEST_AREA.feature,
      status: r.status, shipped: r.status === 'shipped' ? (r.shipped_on || null) : null, step: null,
      kind: r.kind === 'game' ? 'game' : r.kind === 'course' ? 'course' : 'feature', order: out.length, request: true,
    });
  }
  return out;
}

// --------------------------- votes -------------------------------------------

/** Whether you've voted for an item: this phone's latest say, else what the server has for your account. */
export function myVote(local, myVotes, id) {
  const v = local?.votes?.[id];
  if (v) return v.on;
  return list(myVotes).includes(id);
}

/**
 * The count to show: the server's count, plus your vote while the server doesn't have it yet, minus
 * it while a vote you took back is still on the server. Never below 0.
 */
export function voteCount(id, { counts = {}, local = null, myVotes = [] } = {}) {
  const base = Math.max(0, Number(counts?.[id]?.votes) || 0);
  const onServer = list(myVotes).includes(id);
  const mine = myVote(local, myVotes, id);
  return Math.max(0, base + (mine && !onServer ? 1 : 0) - (!mine && onServer ? 1 : 0));
}

/** Comments on an item, as the server last counted them. */
export const commentCount = (id, counts = {}) => Math.max(0, Number(counts?.[id]?.comments) || 0);

/**
 * Whether you can vote for an item here: not on the web page (read only), and not once it has
 * shipped (there's nothing left to push for). An idea still waiting for a look isn't on the list yet.
 */
export function canVote(item, { web = false } = {}) {
  return !web && !!item && item.status !== 'shipped' && !item.waiting;
}

/** The local record with your vote for an item flipped. One vote per item: tapping again takes it back. */
export function toggleVote(local, id, myVotes = [], now = Date.now()) {
  const base = local || emptyLocal();
  const on = !myVote(base, myVotes, id);
  return { ...base, votes: { ...base.votes, [id]: { on, at: now, synced: false } } };
}

/** Votes (and votes taken back) the server doesn't have yet: [{ item, on, at }]. */
export function pendingVotes(local) {
  return Object.entries(local?.votes || {}).filter(([, v]) => !v.synced).map(([item, v]) => ({ item, on: v.on, at: v.at }));
}

/** The local record once the server has these votes. A vote changed again since stays pending. */
export function markVotesSynced(local, sent) {
  const votes = { ...(local?.votes || {}) };
  for (const s of list(sent)) {
    const v = votes[s.item];
    if (v && v.at === s.at && v.on === s.on) votes[s.item] = { ...v, synced: true };
  }
  return { ...(local || emptyLocal()), votes };
}

/** This phone's votes the server already has: [{ item, on, at }]. */
export function syncedVotes(local) {
  return Object.entries(local?.votes || {}).filter(([, v]) => v.synced).map(([item, v]) => ({ item, on: v.on, at: v.at }));
}

/**
 * The local record without these sent votes, once the server's list of your votes has been read
 * after them: from then on that list says whether you voted (another phone may have changed it).
 * A vote tapped again since stays.
 */
export function dropSynced(local, sent) {
  const votes = { ...(local?.votes || {}) };
  for (const s of list(sent)) {
    const v = votes[s.item];
    if (v && v.synced && v.at === s.at && v.on === s.on) delete votes[s.item];
  }
  return { ...(local || emptyLocal()), votes };
}

// --------------------------- your ideas --------------------------------------

/** A short title for an idea sent from "Suggest something": the game's name, or the idea's first line. */
export function requestTitle(kind, values = {}) {
  const raw = kind === 'game' ? values.name : kind === 'course' ? values.name : values.idea;
  const line = String(raw || '').split('\n').map(s => s.trim()).find(Boolean) || '';
  if (line.length <= 70) return line;
  const cut = line.slice(0, 70).lastIndexOf(' ');
  return `${line.slice(0, cut > 30 ? cut : 70)}…`;
}

/** The local record with an idea sent from this phone added (newest 50 kept). */
export function addSent(local, { id, kind, title, at = Date.now() }) {
  const base = local || emptyLocal();
  const sent = [...base.sent.filter(s => s.id !== id), { id: String(id).toLowerCase(), kind, title: String(title || '').slice(0, 120), at }].slice(-50);
  return { ...base, sent };
}

/**
 * Your own ideas, newest first: the ones sent from this phone and the ones the server knows are
 * yours (another phone, same account). Each is { id, itemId, title, kind, state, linkedTo }:
 *  • 'waiting': not on the roadmap yet, and only you see it
 *  • 'listed':  on the roadmap as its own item (itemId)
 *  • 'merged':  folded into an item already on the list (linkedTo)
 * Course requests aren't roadmap items, so they're left out until Trevor lists one.
 */
export function myIdeas(local, mine = [], items = []) {
  const byId = new Map(list(mine).filter(m => isObj(m) && m.id).map(m => [String(m.id).toLowerCase(), m]));
  const known = new Set(list(items).map(i => i.id));
  const out = [];
  const add = (id, kind, title, at) => {
    const m = byId.get(id);
    const own = requestItemId(id);
    const linked = m?.item && m.item !== own ? m.item : null;
    const state = linked ? 'merged' : m?.item === own ? 'listed' : 'waiting';
    if (kind === 'course' && state === 'waiting') return;
    out.push({ id, itemId: linked || own, title: (state === 'listed' && m?.title) || title || 'Your idea', kind, state, linkedTo: linked && known.has(linked) ? linked : null, at });
  };
  for (const s of list(local?.sent)) add(s.id, s.kind, s.title, s.at);
  for (const [id, m] of byId) if (!out.some(o => o.id === id)) add(id, m.kind, m.title, 0);
  return out.sort((a, b) => b.at - a.at);
}

/** The items you asked for (listed as their own, or folded into another), by item id, with the kind of idea. */
function requestedItems(mine) {
  const out = new Map();
  for (const m of list(mine)) if (isObj(m) && m.item) out.set(m.item, m.kind || 'feature');
  return out;
}

// --------------------------- sections ----------------------------------------

/**
 * One tab of the list, in order: Planned and In progress by votes (most first), then by how soon
 * ROADMAP.md has them, then file order; Shipped newest first, ones with no date last.
 */
export function section(items, status, { counts = {}, local = null, myVotes = [] } = {}) {
  const rows = list(items).filter(i => i.status === status);
  if (status === 'shipped') {
    return rows.sort((a, b) => (b.shipped || '').localeCompare(a.shipped || '') || a.order - b.order);
  }
  const votes = new Map(rows.map(i => [i.id, voteCount(i.id, { counts, local, myVotes })]));
  return rows.sort((a, b) => votes.get(b.id) - votes.get(a.id)
    || (STEP_RANK[a.step] || 9) - (STEP_RANK[b.step] || 9)
    || a.order - b.order);
}

/** Which tab an item is on, for opening the roadmap on it. */
export function tabFor(items, id, ideas = []) {
  const idea = list(ideas).find(i => i.itemId === id || requestItemId(i.id) === id);
  const target = idea?.state === 'merged' ? idea.itemId : id;
  const item = list(items).find(i => i.id === target);
  return item ? item.status : 'planned';
}

// --------------------------- "it's live" -------------------------------------

const ASKED_LINE = {
  game: 'The game you asked for is live',
  course: 'The course you asked for is in',
  feature: 'The idea you sent in is live',
};

/**
 * The "it's live" notes for Up next, newest first: something you asked for or voted for has
 * shipped, and this phone hasn't told you yet. Each is { key, itemId, title, line }. Only items that
 * shipped in the last NOTE_DAYS days with a date, so a new phone doesn't dig up old news. Asking
 * wins over voting for the line ("The game you asked for is live").
 */
export function shippedNotes(items, { local = null, mine = [], myVotes = [], now = Date.now() } = {}) {
  const asked = requestedItems(mine);
  const told = local?.told || {};
  const out = [];
  for (const item of list(items)) {
    if (item.status !== 'shipped' || told[item.id] != null) continue;
    const when = item.shipped ? Date.parse(`${item.shipped}T12:00:00Z`) : NaN;
    if (!Number.isFinite(when) || now - when > NOTE_DAYS * DAY || when - now > 2 * DAY) continue;
    let line = null;
    if (asked.has(item.id)) line = ASKED_LINE[asked.get(item.id)] || ASKED_LINE.feature;
    else if (myVote(local, myVotes, item.id)) line = item.kind === 'game' ? 'A game you voted for is live' : 'Something you voted for is live';
    if (!line) continue;
    out.push({ key: item.id, itemId: item.id, title: item.title, line, shipped: item.shipped });
  }
  return out.sort((a, b) => b.shipped.localeCompare(a.shipped));
}

/** The local record with these notes marked as shown, so each one shows once. */
export function markTold(local, keys, now = Date.now()) {
  const base = local || emptyLocal();
  const told = { ...base.told };
  for (const k of list(keys)) if (ITEM_ID.test(k)) told[k] = now;
  return { ...base, told };
}

// --------------------------- server ------------------------------------------

/**
 * The server isn't set up for the roadmap yet (the SQL hasn't run): a missing table or function.
 * Anything else (no signal, a real error) is not this.
 */
export function roadmapOff(error) {
  if (!error) return false;
  const code = String(error.code || '');
  if (['42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true;
  return /does not exist|schema cache|could not find the function/i.test(error.message || '');
}

/** Counts from roadmap_counts() rows: { [item]: { votes, comments } }. */
export function countsFromRows(rows) {
  const out = {};
  for (const r of list(rows)) {
    if (!isObj(r) || !ITEM_ID.test(String(r.item || ''))) continue;
    out[r.item] = { votes: Math.max(0, Number(r.votes) || 0), comments: Math.max(0, Number(r.comments) || 0) };
  }
  return out;
}

/** "A golfer" stands in for anyone whose profile isn't open to everyone. */
export const ANON_NAME = 'A golfer';

/**
 * The name a comment goes out under: your first name when your profile is open to Everyone (the one
 * profile setting), else none, and it shows as "A golfer". The roadmap is public.
 */
export function commentName(name, privacyLevel) {
  if (privacyLevel !== 'everyone') return null;
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return first ? first.slice(0, 40) : null;
}

/** How long ago, short: "Just now", "5m", "3h", "Oct 4". */
export function agoLabel(at, now = Date.now()) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Shipped Oct 4", or "From the start" for the first things built. */
export function shippedLabel(date) {
  if (!date) return 'From the start';
  const t = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(t)) return 'Shipped';
  return `Shipped ${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}
