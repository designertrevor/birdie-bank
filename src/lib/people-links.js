// One friend, one person. The same friend can have several player ids: the record each organizer
// saved for them on their own phone, plus their own id when they sign up and host. This works out
// which ids are the same person, from data already on the phone, so it needs no signal:
// - claims: a round's `claims` map (seat id -> the claimer's own id), written when someone joins a
//   shared round from a link in that seat (see sync.js);
// - state.links ({ aliasId: keptId }): "Same person as..." on a Player card;
// - state.unlinks ([[a, b]]): "Not the same person", which breaks a claim (or link) between two ids,
//   so an automatic link stays undone when the round arrives again.
// - state.accountOf ({ playerId: accountId }): which account each id belongs to, from the server
//   (profiles.js). Two ids on the same account are one person, on every phone, with no merging by hand.
// Your own ids (state.me, the seat you took in each joined round, and any id on your own account)
// are always one person: you.
//
// Only the grouping changes. Money per round is never touched: every sum just adds the same
// round balances under one id instead of two, so balances still add up to zero.
// Pure, unit tested. Nothing here imports app state helpers, so format.js can use it.

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const roundTime = r => r?.finishedAt || r?.createdAt || 0;

/** The unlinks saved on the phone, as a set of pair keys. */
function brokenPairs(state) {
  const out = new Set();
  for (const p of Array.isArray(state?.unlinks) ? state.unlinks : []) {
    if (Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string' && p[0] !== p[1]) out.add(pairKey(p[0], p[1]));
  }
  return out;
}

/** Player ids by account: Map(accountId -> ids sorted), from state.accountOf. */
export function accountGroups(state) {
  const out = new Map();
  const map = isObj(state?.accountOf) ? state.accountOf : {};
  for (const id of Object.keys(map).sort()) {
    const acct = map[id];
    if (typeof acct !== 'string' || !acct || !id) continue;
    if (!out.has(acct)) out.set(acct, []);
    out.get(acct).push(id);
  }
  return out;
}

/**
 * Every link on this phone, in the order they're applied: your own ids first (always), then the
 * manual links, then ids on the same account, then round claims, oldest round first.
 * [{ a, b, kind: 'me' | 'manual' | 'account' | 'claim', roundId? }]
 * Links broken by an unlink are left out (yours never are).
 */
export function linkEdges(state) {
  const me = state?.me || null;
  const rounds = Object.values(state?.rounds || {}).filter(r => r && Array.isArray(r.players));
  const broken = brokenPairs(state);
  const edges = [];
  const mine = new Set(me ? [me] : []);
  for (const r of rounds) if (r.localMe) mine.add(r.localMe);
  const accounts = accountGroups(state);
  // Every id on your own account is you too
  const myAccount = me && isObj(state?.accountOf) ? state.accountOf[me] : null;
  if (myAccount) for (const id of accounts.get(myAccount) || []) mine.add(id);
  if (me) for (const id of [...mine].sort()) if (id !== me) edges.push({ a: id, b: me, kind: 'me' });
  const links = isObj(state?.links) ? state.links : {};
  for (const alias of Object.keys(links).sort()) {
    const kept = links[alias];
    if (typeof kept !== 'string' || !kept || kept === alias || broken.has(pairKey(alias, kept))) continue;
    edges.push({ a: alias, b: kept, kind: 'manual' });
  }
  // A duplicate merged from its edit screen (player.mergedInto) is the same kind of link
  const players = isObj(state?.players) ? state.players : {};
  for (const id of Object.keys(players).sort()) {
    const kept = players[id]?.mergedInto;
    if (typeof kept !== 'string' || !kept || kept === id || links[id] === kept || broken.has(pairKey(id, kept))) continue;
    edges.push({ a: id, b: kept, kind: 'manual' });
  }
  // Ids on the same account: each one joins the first, unless "Not the same person" broke that pair
  for (const [acct, ids] of [...accounts].sort(([x], [y]) => x.localeCompare(y))) {
    if (acct === myAccount) continue;
    for (const id of ids.slice(1)) {
      if (broken.has(pairKey(ids[0], id))) continue;
      edges.push({ a: id, b: ids[0], kind: 'account' });
    }
  }
  const sorted = [...rounds].sort((x, y) => roundTime(x) - roundTime(y) || String(x.id).localeCompare(String(y.id)));
  for (const r of sorted) {
    if (!isObj(r.claims)) continue;
    for (const seat of Object.keys(r.claims).sort()) {
      const who = r.claims[seat];
      if (typeof who !== 'string' || !who || who === seat || broken.has(pairKey(seat, who))) continue;
      if (!r.players.some(p => p.id === seat)) continue; // a seat that isn't in the round
      // Someone else claiming one of your own seats is a mistake: you stay you on this phone
      if (mine.has(seat) && who !== me) continue;
      if (mine.has(who) && who !== me) continue;
      edges.push({ a: seat, b: who, kind: 'claim', roundId: r.id });
    }
  }
  return edges;
}

/**
 * Who is who on this phone. Returns:
 * - personOf(id): the one id this person goes by here (their own id when they aren't linked);
 * - groupOf(id): every id that is this person, the kept one first;
 * - isAlias(id): the id is linked to someone kept under another id;
 * - edges: the links that were applied.
 * The kept id is picked the same way every time: you (state.me) first, then a player saved on this
 * phone that isn't an alias, then any id that isn't an alias, then the oldest saved player, then
 * the smallest id. Two players in the same round are never one person, so a link that would join
 * them is skipped (your own ids always join).
 */
export function linksOf(state) {
  const me = state?.me || null;
  const players = isObj(state?.players) ? state.players : {};
  const links = isObj(state?.links) ? state.links : {};
  const rounds = Object.values(state?.rounds || {}).filter(r => r && Array.isArray(r.players));
  const parent = new Map();
  const inRounds = new Map(); // root -> Set of round ids its ids played in
  const find = x => {
    if (!parent.has(x)) { parent.set(x, x); return x; }
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(x) !== root) { const next = parent.get(x); parent.set(x, root); x = next; }
    return root;
  };
  for (const r of rounds) {
    for (const p of r.players) {
      const root = find(p.id);
      if (!inRounds.has(root)) inRounds.set(root, new Set());
      inRounds.get(root).add(r.id);
    }
  }
  const union = (a, b, force) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return true;
    const sa = inRounds.get(ra) || new Set(), sb = inRounds.get(rb) || new Set();
    if (!force) for (const id of sa) if (sb.has(id)) return false;
    const [big, small] = sa.size >= sb.size ? [ra, rb] : [rb, ra];
    parent.set(small, big);
    inRounds.set(big, new Set([...sa, ...sb]));
    inRounds.delete(small);
    return true;
  };
  const applied = [];
  for (const e of linkEdges(state)) if (union(e.a, e.b, e.kind === 'me')) applied.push(e);

  const members = new Map(); // root -> ids
  for (const id of parent.keys()) {
    const root = find(id);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(id);
  }
  const alias = id => (Object.prototype.hasOwnProperty.call(links, id) || !!players[id]?.mergedInto) && applied.some(e => e.kind === 'manual' && e.a === id);
  const rank = id => [
    id === me ? 0 : 1,
    players[id] && !alias(id) ? 0 : 1,
    alias(id) ? 1 : 0,
    Number(players[id]?.createdAt) || Infinity,
  ];
  const better = (x, y) => {
    const a = rank(x), b = rank(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return x < y;
  };
  const kept = new Map(); // root -> kept id
  const groups = new Map(); // root -> ids, kept first
  for (const [root, ids] of members) {
    const best = ids.reduce((x, y) => (better(y, x) ? y : x));
    kept.set(root, best);
    groups.set(root, [best, ...ids.filter(i => i !== best).sort()]);
  }
  const personOf = id => (id == null || !parent.has(id) ? id : kept.get(find(id)));
  const groupOf = id => (id == null || !parent.has(id) ? [id] : groups.get(find(id)));
  return { personOf, groupOf, isAlias: id => personOf(id) !== id, edges: applied };
}

/** Every id any round or saved player on this phone uses. */
function knownIds(state) {
  const ids = new Set(Object.keys(state?.players || {}));
  for (const r of Object.values(state?.rounds || {})) for (const p of r?.players || []) ids.add(p.id);
  return ids;
}

/** The two people have played a round together, so they can't be one person. */
export function playedTogether(state, a, b) {
  const L = linksOf(state);
  const A = new Set(L.groupOf(a)), B = new Set(L.groupOf(b));
  return Object.values(state?.rounds || {}).some(r => (r?.players || []).some(p => A.has(p.id)) && (r?.players || []).some(p => B.has(p.id)));
}

/**
 * The other ids a Player card also shows up as: [{ id, name, manual }], where `manual` says it
 * was linked with "Same person as..." rather than from a claimed seat. Only ids that appear on
 * this phone (a saved player or a seat in a round) are listed.
 */
export function aliasesOf(state, id, nameOf = x => state?.players?.[x]?.name || x) {
  const L = linksOf(state);
  const keep = L.personOf(id);
  const known = knownIds(state);
  const group = L.groupOf(keep);
  const manual = new Set();
  for (const e of L.edges) if (e.kind === 'manual') { manual.add(e.a); manual.add(e.b); }
  return group.filter(x => x !== keep && known.has(x)).map(x => ({ id: x, name: nameOf(x), manual: manual.has(x) }));
}

/**
 * People a card can be merged with: everyone else on this phone who goes by their own id, isn't
 * you, isn't already this person and never played a round with them. Returns kept ids.
 */
export function mergeCandidates(state, id, mine = new Set()) {
  const L = linksOf(state);
  const keep = L.personOf(id);
  const out = new Set();
  for (const x of knownIds(state)) {
    const p = L.personOf(x);
    if (p === keep || mine.has(p) || mine.has(x) || (state?.me && p === state.me)) continue;
    out.add(p);
  }
  return [...out].filter(p => !playedTogether(state, keep, p));
}

/**
 * "Same person as...": `alias` becomes part of the card you're on (`keep`), which stays the one
 * kept. Returns the new { links, unlinks }, or null when they can't be one person (you, or two
 * people who played together). Every saved player of the other person points at the card, and
 * any earlier "Not the same person" between the two is taken back.
 */
export function mergePeople(state, keep, alias) {
  if (!keep || !alias) return null;
  const L = linksOf(state);
  const K = L.personOf(keep), A = L.personOf(alias);
  if (K === A || !K || !A) return null;
  const me = state?.me;
  if (me && (K === me || A === me)) return null;
  if (playedTogether(state, K, A)) return null;
  const inK = new Set(L.groupOf(K)), inA = new Set(L.groupOf(A));
  const links = { ...(isObj(state?.links) ? state.links : {}) };
  // An old link from this card's side to the other one (left over from an undone merge) would make
  // both sides aliases, and the card you're on might not be the one kept
  for (const x of inK) if (inA.has(links[x])) delete links[x];
  for (const x of inA) if (x === A || state?.players?.[x]) links[x] = K;
  const unlinks = (Array.isArray(state?.unlinks) ? state.unlinks : [])
    .filter(p => !(Array.isArray(p) && ((inK.has(p[0]) && inA.has(p[1])) || (inA.has(p[0]) && inK.has(p[1])))));
  return { links, unlinks };
}

/**
 * "Not the same person": takes `alias` out of the person kept as `keep`, whether it came from a
 * claimed seat (it's unlinked, so it stays apart when the round arrives again) or from "Same
 * person as..." (the link is removed). Everyone else in the group stays together. Returns the
 * new { links, unlinks }, or null when there's nothing to take apart. Player records are never deleted.
 */
export function unmergePerson(state, keep, alias) {
  const L = linksOf(state);
  const K = L.personOf(keep);
  const group = L.groupOf(K);
  if (!alias || alias === K || !group.includes(alias)) return null;
  if (state?.me && K === state.me) return null; // your own ids stay yours
  const links = { ...(isObj(state?.links) ? state.links : {}) };
  const unlinks = (Array.isArray(state?.unlinks) ? state.unlinks : []).slice();
  const had = new Set(unlinks.filter(Array.isArray).map(p => pairKey(p[0], p[1])));
  for (const e of L.edges) {
    if (e.a !== alias && e.b !== alias) continue;
    if (e.kind === 'manual') {
      if (links[e.a] === e.b) delete links[e.a];
    } else if (!had.has(pairKey(e.a, e.b))) {
      unlinks.push([e.a, e.b]);
      had.add(pairKey(e.a, e.b));
    }
  }
  // Anyone who was only joined through the alias stays with the card
  const next = linksOf({ ...state, links, unlinks });
  for (const x of group) {
    if (x === alias || next.personOf(x) === next.personOf(K) || next.personOf(x) === next.personOf(alias)) continue;
    links[next.personOf(x)] = next.personOf(K);
  }
  return { links, unlinks };
}

/**
 * The claims map for a round when `me` takes `seat` in it, or null when nothing changes. Anyone
 * holds one seat per round, so a claim of another seat by the same person is replaced.
 */
export function claimSeat(round, seat, me) {
  if (!round || !seat || !me || seat === me || !(round.players || []).some(p => p.id === seat)) return null;
  const cur = isObj(round.claims) ? round.claims : {};
  const others = Object.entries(cur).filter(([k, v]) => v === me && k !== seat);
  if (cur[seat] === me && !others.length) return null;
  const next = Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== me));
  next[seat] = me;
  return next;
}

/**
 * Claims from two copies of a round as one, for when both phones changed them at once: `primary`
 * (the merged copy) wins, and a claim from `extra` is added when its person and its seat aren't
 * in `primary` yet. Returns undefined when neither has any.
 */
export function mergeClaims(primary, extra) {
  const a = isObj(primary) ? primary : {}, b = isObj(extra) ? extra : {};
  if (!Object.keys(a).length && !Object.keys(b).length) return undefined;
  const out = { ...a };
  const who = new Set(Object.values(a));
  for (const [seat, id] of Object.entries(b)) {
    if (seat in out || who.has(id)) continue;
    out[seat] = id;
    who.add(id);
  }
  return out;
}
