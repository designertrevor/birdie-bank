// Split Pro on the Tab (ROADMAP area 7): when an organizer gets Pro, they can split its cost across
// their group ("$12.50 each for your foursome"). The purchase stays the organizer's own; the split
// only puts what each friend owes them on the Tab, the way a trip expense they paid for would, and
// it settles up through the Tab like any other money there. Behind the paywall flag: with it off
// no split shows and no split's money is on the Tab, even one made while it was on.
//
// A split, in state.proSplits (synced in your profile, kept split by split, the newer copy winning):
// { id, purchase, plan, price, by, organizerIn, people: [{ id, name, cents }], at, updatedAt, undone? }
// - id: 'pro:<purchase>'. One split per purchase, so two of your phones confirming the same
//   purchase write the same split (the newer wins) and it's never counted twice.
// - price: what the plan costs, in cents. people: everyone in the split with their share in cents,
//   the organizer (`by`) among them only when they pay a share too (organizerIn). The shares add up
//   to the price exactly.
// - undone: Undo keeps the split as a stub, so your other phones hear it's gone. Splitting again
//   writes over it.
//
// Money rules (written down for Trevor in overnight/o13-notes/split.md):
// - It never touches a round: no round, transfer or payment changes, only this collection.
// - Only the organizer's own phones carry it (their profile), and only a split whose `by` is this
//   phone's owner moves money here, so a friend's phone never counts it at all.
// - Each friend in it owes the organizer their share; the organizer's own share is theirs to keep.
// - The cents that don't divide evenly go to the organizer first when they're in it (so no friend
//   is asked for a cent more than an even share), then to friends in order of their id, so the same
//   people always get the same shares, whatever order they were ticked in.
// Pure, unit tested.
import { PAYWALL_ON } from './paywall-flag.js';
import { canonicalOf } from './pair-debts.js';
import { usualsOf } from './usuals.js';

export const MIN_SPLIT = 2;
export const MAX_SPLIT = 8;
const MAX_PRICE = 99999;

// The paywall flag, read once at startup. Tests turn it on and off with setSplitsOn.
let on = PAYWALL_ON;
/** Whether splits show and count on this phone: the paywall flag. */
export const splitsOn = () => on;
/** For tests: turn splits on or off. */
export function setSplitsOn(v) { on = !!v; }

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Each person's share of `total` cents: [{ id, cents }], adding up to `total` exactly, or null when
 * it can't be split (no friend in it, fewer than 2 or more than 8 people, a price that isn't whole
 * cents). `friends` are the people besides the organizer; `organizerIn` puts the organizer in it
 * too, first, so the cents that don't divide evenly land on them before any friend. Friends go in
 * order of their id, so the shares never depend on the order they were picked in.
 */
export function splitShares(total, friends, { organizer, organizerIn = true } = {}) {
  if (!Number.isInteger(total) || total <= 0 || total > MAX_PRICE * 100) return null;
  const ids = [...new Set((friends || []).filter(id => isStr(id) && id !== organizer))].sort();
  if (!ids.length) return null;
  if (organizerIn && !isStr(organizer)) return null;
  const people = organizerIn ? [organizer, ...ids] : ids;
  if (people.length < MIN_SPLIT || people.length > MAX_SPLIT) return null;
  const base = Math.floor(total / people.length);
  let left = total - base * people.length;
  return people.map(id => {
    const extra = left > 0 ? 1 : 0;
    left -= extra;
    return { id, cents: base + extra };
  });
}

/**
 * "$12.50 each": the share most people pay, for the headline. $49.99 for a foursome is three shares
 * of $12.50 and one of $12.49, so it's $12.50 (a tie goes to the larger share).
 */
export function eachCents(shares) {
  if (!shares?.length) return 0;
  const count = new Map();
  for (const s of shares) count.set(s.cents, (count.get(s.cents) || 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** True when the shares aren't all the same (odd cents), so a line saying "each" says "about". */
export function sharesVary(shares) {
  return new Set((shares || []).map(s => s.cents)).size > 1;
}

/** The split's id for a purchase: the paywall answer's time (the trial preview), or a subscription's id later. */
export function splitIdFor(state) {
  const at = Number(state?.paywall?.at);
  return Number.isFinite(at) && at > 0 ? `pro:${at}` : null;
}

/**
 * A new split, ready to save: the shares from splitShares and each person's name. Null when the
 * shares can't be worked out.
 */
export function newSplit({ id, purchase, plan, price, by, friends, organizerIn = true, names = {}, now = Date.now() }) {
  const shares = splitShares(price, friends, { organizer: by, organizerIn });
  if (!shares || !isStr(id) || !isStr(by)) return null;
  return cleanSplit({
    id, purchase, plan, price, by, organizerIn,
    people: shares.map(s => ({ id: s.id, name: String(names[s.id] || '').slice(0, 40), cents: s.cents })),
    at: now, updatedAt: now,
  });
}

/**
 * A split as it came from your account, a backup or the sheet, tidied, or null when it isn't one
 * (shares that don't add up to the price, someone in it twice, too few or too many people). An
 * undone one comes back as its stub.
 */
export function cleanSplit(s) {
  if (!isObj(s) || !isStr(s.id) || !isStr(s.by)) return null;
  const updatedAt = Number(s.updatedAt) || 0;
  if (s.undone) return { id: s.id, by: s.by, undone: true, at: Number(s.at) || 0, updatedAt };
  const price = Number(s.price);
  if (!Number.isInteger(price) || price <= 0 || price > MAX_PRICE * 100) return null;
  if (!Array.isArray(s.people) || s.people.length < MIN_SPLIT || s.people.length > MAX_SPLIT) return null;
  const people = s.people.map(p => (isObj(p) && isStr(p.id) && Number.isInteger(p.cents) && p.cents >= 0
    ? { id: p.id, name: String(p.name || '').slice(0, 40), cents: p.cents } : null));
  if (people.some(p => !p) || new Set(people.map(p => p.id)).size !== people.length) return null;
  if (people.reduce((a, p) => a + p.cents, 0) !== price) return null;
  const organizerIn = people.some(p => p.id === s.by);
  if (organizerIn !== !!s.organizerIn) return null;
  if (!people.some(p => p.id !== s.by)) return null;
  return {
    id: s.id, purchase: Number(s.purchase) || null, plan: isStr(s.plan) ? s.plan : null, price, by: s.by, organizerIn,
    people, at: Number(s.at) || 0, updatedAt,
  };
}

/** Undo a split: its stub, newer than what's there, so every one of your phones drops it. */
export function undoneSplit(s, now = Date.now()) {
  return { id: s.id, by: s.by, undone: true, at: s.at || 0, updatedAt: Math.max(now, (Number(s.updatedAt) || 0) + 1) };
}

/**
 * Keep the newer copy of each split (by updatedAt; an undone one wins a tie), for splits coming from
 * your account or a backup. Returns the merged map, or `cur` itself when nothing changed.
 */
export function mergeSplits(cur = {}, incoming = []) {
  let out = cur || {};
  const start = out;
  for (const raw of incoming) {
    const s = cleanSplit(raw);
    if (!s) continue;
    const have = out[s.id] ? cleanSplit(out[s.id]) : null;
    if (have && have.by !== s.by) continue; // a split never changes hands
    if (have && (have.updatedAt > s.updatedAt || (have.updatedAt === s.updatedAt && (have.undone || !s.undone)))) continue;
    if (have && JSON.stringify(have) === JSON.stringify(s)) continue;
    if (out === start) out = { ...start };
    out[s.id] = s;
  }
  return out;
}

/**
 * Your split standing (not undone), tidied, or null. One split stands at a time: while one does,
 * nothing offers another (a second trial answer from the Season preview would otherwise be a new
 * purchase and split the price again), and only it is on the Tab. When two of your phones each
 * split before they synced (each with its own trial answer, so two purchases), the newest split
 * stands, on every phone alike (by when it was made, then its id), so the price is never on the
 * Tab twice; Undo it and the other stands. Undo it first to split again.
 */
export function activeSplit(state) {
  if (!state?.proSplits || !state.me) return null;
  const who = canonicalOf(state);
  const me = who(state.me);
  const mine = Object.values(state.proSplits).map(cleanSplit).filter(s => s && !s.undone && who(s.by) === me);
  return mine.sort((a, b) => (b.at || 0) - (a.at || 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0] || null;
}

/**
 * Every split standing on this phone as Tab money, in the shape trip money has (trip-expenses.js
 * resolveExpense): { id, pro: true, what, tripId: null, payer, parts, balances, cents, names, at }.
 * `payer` is the organizer, `parts` each friend's share (the organizer's own share isn't owed to
 * anyone, so it isn't a part), `balances` adds up to 0. Empty with the flag off, and for any split
 * someone else made (only your own splits put money on your Tab).
 */
export function allSplitMoney(state, { flag = splitsOn() } = {}) {
  if (!flag || !state?.proSplits || !state.me) return [];
  const who = canonicalOf(state);
  const me = who(state.me);
  const out = [];
  // Only the split standing (activeSplit): never two at once, even from two phones that split before syncing
  const standing = activeSplit(state);
  for (const s of standing ? [standing] : []) {
    const parts = s.people.filter(p => who(p.id) !== me && p.cents > 0).map(p => ({ id: who(p.id), cents: p.cents, part: null }));
    if (!parts.length) continue;
    const balances = { [me]: 0 };
    for (const p of parts) { balances[p.id] = (balances[p.id] || 0) - p.cents; balances[me] += p.cents; }
    const names = {};
    for (const p of s.people) if (p.name) names[who(p.id)] = p.name;
    out.push({
      id: s.id, pro: true, what: 'Pro', tripId: null, split: 'equal', payer: me, parts, balances,
      cents: parts.reduce((a, p) => a + p.cents, 0), price: s.price, names, by: me, at: s.at, updatedAt: s.updatedAt, raw: s,
    });
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0) || a.id.localeCompare(b.id));
}

/** The pairs splits put money between (organizer and each friend), as "a|b" keys. */
export function splitPairs(list) {
  const out = new Set();
  for (const x of list) for (const p of x.parts) if (p.id !== x.payer && p.cents) out.add(pairKey(p.id, x.payer));
  return out;
}

/**
 * What splits put between you and one person: [{ expense, amount, at }] newest first, amount in
 * cents, positive when they owe you. As trip-expenses.js expensesBetween, so the person's card and
 * Where it comes from list them with the rest.
 */
export function splitsBetween(state, isMine, isThem) {
  const out = [];
  for (const x of allSplitMoney(state)) {
    let c = 0;
    if (isMine(x.payer)) for (const p of x.parts) if (isThem(p.id)) c += p.cents;
    if (c) out.push({ expense: x, amount: c, at: x.at || 0 });
  }
  return out;
}

/**
 * Who the organizer can split with: their usuals' players (the most recently played first), their
 * crews' members (smallest crew first), then everyone else saved on this phone. One row a person,
 * you left out. `picked` starts on the group they most likely mean: the latest usual, else the
 * smallest crew, else the first three people, capped so the split stays at 8 with you in it.
 * Returns { people: [{ id, name }], picked: [id] }.
 */
export function splitCandidates(state) {
  const who = canonicalOf(state);
  const me = state?.me ? who(state.me) : null;
  const seen = new Map();
  const nameOf = (id, fallback = '') => state.players?.[id]?.name || fallback || 'Someone';
  const add = (id, name) => {
    if (!isStr(id)) return null;
    const p = state.players?.[id];
    if (p?.mergedInto) return add(p.mergedInto, name);
    const k = who(id);
    if (!k || k === me) return null;
    if (!seen.has(k)) seen.set(k, { id: k, name: nameOf(k, nameOf(id, name)) });
    return k;
  };
  const groups = [];
  const usuals = [...usualsOf(state)].sort((a, b) => (b.lastPlayedAt || b.createdAt || 0) - (a.lastPlayedAt || a.createdAt || 0));
  for (const u of usuals) groups.push((u.players || []).map(id => add(id, u.names?.[id])).filter(Boolean));
  const crews = Object.values(state.crews || {}).filter(c => c?.id).sort((a, b) => (a.playerIds?.length || 0) - (b.playerIds?.length || 0));
  for (const c of crews) groups.push((c.playerIds || []).map(id => add(id)).filter(Boolean));
  for (const p of Object.values(state.players || {})) if (p?.id && !p.mergedInto) add(p.id, p.name);
  const people = [...seen.values()];
  const group = groups.find(g => g.length) || people.slice(0, 3).map(p => p.id);
  const picked = [...new Set(group)].slice(0, MAX_SPLIT - 1);
  return { people, picked };
}

/** "your foursome", "the two of you", "the 6 of you": who's in it, you included when you are. */
export function groupWord(n) {
  if (n === 2) return 'the two of you';
  if (n === 3) return 'the three of you';
  if (n === 4) return 'your foursome';
  return `the ${n} of you`;
}

/**
 * Payments for a split: what a payment from the Tab puts toward Pro split with the group carries
 * `tab: 'pro'` (shared-tab.js allocatePayment), the way a payment from a crew's tab names the crew,
 * so a trip never counts it as paying the trip's rounds (trips.js) and a crew's tab never takes it
 * (crew-tabs.js puts it on Other rounds, where the split's money is).
 */
export const SPLIT_TAB = 'pro';
export const isSplitPayment = s => s?.tab === SPLIT_TAB;
/**
 * Whether a payment counts on this phone's Tab: every payment does, but a payment for a split only
 * with the flag on, so with it off the Tab is as if no split was ever made (no split's money, and
 * no payment for one leaving the organizer owing it back).
 */
export const countsPayment = s => splitsOn() || !isSplitPayment(s);

/**
 * The pairs splits put money between, for who can pay whom on the Tab: the split standing's
 * (organizer and each friend), and any two people with a payment for a split between them, so a
 * split undone after a friend paid still has a line for the organizer to pay it back.
 */
export function splitPayPairs(state, list = allSplitMoney(state)) {
  const out = splitPairs(list);
  if (!splitsOn()) return out;
  const who = canonicalOf(state);
  for (const s of state?.settlements || []) {
    if (!isSplitPayment(s)) continue;
    const f = who(s.from), t = who(s.to);
    if (f && t && f !== t) out.add(pairKey(f, t));
  }
  return out;
}

/**
 * What's open between two people on Pro splits, in cents: positive when `from` owes `to`. The split
 * standing (allSplitMoney, so nothing with the flag off) less the payments for splits between them.
 */
export function splitOpen(state, from, to) {
  const who = canonicalOf(state);
  const F = who(from), T = who(to);
  let c = 0;
  for (const x of allSplitMoney(state)) {
    for (const p of x.parts) {
      if (x.payer === T && p.id === F) c += p.cents;
      if (x.payer === F && p.id === T) c -= p.cents;
    }
  }
  for (const s of state?.settlements || []) {
    if (!isSplitPayment(s)) continue;
    const f = who(s.from), t = who(s.to), a = Math.round((Number(s.amount) || 0) * 100);
    if (f === F && t === T) c -= a;
    else if (f === T && t === F) c += a;
  }
  return c;
}
