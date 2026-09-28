// The Tab: who owes whom across every finished round, less payments recorded. Pure, unit tested.
import { roundResults } from './round.js';
import { roundCents } from './games.js';
import { meFor, myIds } from './format.js';

const toCents = v => Math.round((Number(v) || 0) * 100);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * The fewest payments that square a set of balances (positive = owed money), across the whole
 * group rather than pair by pair. Works in whole cents without making or losing one; if the
 * balances don't sum to zero at all, the difference comes off the biggest balance on that side, so
 * the plan always squares. `canPay(a, b)` (optional) says whether a can pay b directly, for example only people
 * who have played together. Money that can't go direct is passed along the shortest chain of
 * people who can. Returns [{ from, to, amount }], biggest first.
 */
export function fewestPayments(balances, { canPay = null } = {}) {
  const ids = Object.keys(balances);
  // Whole cents that keep the total: a split pot's spare cent goes to whoever rounding shorted most
  const rounded = roundCents(Object.fromEntries(ids.map(id => [id, Number(balances[id]) || 0])));
  const left = Object.fromEntries(ids.map(id => [id, toCents(rounded[id])]));
  const drift = ids.reduce((a, id) => a + left[id], 0);
  if (drift) {
    const side = ids.filter(id => Math.sign(left[id]) === Math.sign(drift)).sort((a, b) => Math.abs(left[b]) - Math.abs(left[a]));
    if (side.length) left[side[0]] -= drift;
  }
  const ok = (a, b) => a !== b && (!canPay || canPay(a, b));
  const flows = new Map(); // "from>to" -> cents
  const send = (from, to, c) => {
    const back = flows.get(`${to}>${from}`) || 0;
    if (back) {
      const net = back - c;
      flows.delete(`${to}>${from}`);
      if (net > 0) flows.set(`${to}>${from}`, net);
      else if (net < 0) flows.set(`${from}>${to}`, -net);
    } else flows.set(`${from}>${to}`, (flows.get(`${from}>${to}`) || 0) + c);
    left[from] += c; left[to] -= c;
  };
  const debtors = () => ids.filter(id => left[id] < 0).sort((a, b) => left[a] - left[b]);
  const creditors = () => ids.filter(id => left[id] > 0).sort((a, b) => left[b] - left[a]);

  // 1. Exact matches: someone owed what another owes settles in one payment
  for (const d of debtors()) {
    const c = creditors().find(x => left[x] === -left[d] && ok(d, x));
    if (c) send(d, c, left[c]);
  }
  // 2. The biggest debt goes to the biggest creditor they can pay; each payment squares someone
  for (;;) {
    let paid = false;
    for (const d of debtors()) {
      const c = creditors().find(x => ok(d, x));
      if (!c) continue;
      send(d, c, Math.min(-left[d], left[c]));
      paid = true;
      break;
    }
    if (!paid) break;
  }
  // 3. Anything left can only go through people in between
  for (;;) {
    let d = null, path = null;
    for (const x of debtors()) { path = shortestPath(x, id => left[id] > 0, ids, ok); if (path) { d = x; break; } }
    if (!path) break;
    const c = path.at(-1);
    const amount = Math.min(-left[d], left[c]);
    for (let i = 0; i < path.length - 1; i++) send(path[i], path[i + 1], amount);
    // The people in between pass it on, so they end up where they started
  }
  return [...flows].map(([k, c]) => { const [from, to] = k.split('>'); return { from, to, amount: c / 100 }; })
    .sort((a, b) => b.amount - a.amount || a.from.localeCompare(b.from));
}

function shortestPath(start, isEnd, ids, ok) {
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur !== start && isEnd(cur)) {
      const path = [cur];
      while (prev.get(path[0]) !== null) path.unshift(prev.get(path[0]));
      return path;
    }
    for (const n of ids) if (!prev.has(n) && ok(cur, n)) { prev.set(n, cur); queue.push(n); }
  }
  return null;
}

const doneRounds = state => Object.values(state.rounds || {}).filter(r => r.status === 'done');

/**
 * You can have more than one id (your own, plus the seat you took in each joined round). On the Tab
 * they are all one person, so a payment recorded against one of them squares a debt on another.
 */
function canonical(state) {
  const mine = myIds(state);
  return id => (state.me && mine.has(id) ? state.me : id);
}

/** Everyone's running balance across finished rounds, less payments recorded. Positive = owed money. */
export function tabBalances(state) {
  const bal = {};
  const who = canonical(state);
  const add = (id, v) => { const k = who(id); bal[k] = (bal[k] || 0) + v; };
  for (const r of doneRounds(state)) {
    for (const [id, v] of Object.entries(roundResults(r).balances)) add(id, v);
  }
  for (const s of state.settlements || []) { add(s.from, s.amount); add(s.to, -s.amount); }
  return bal;
}

/** Finished rounds each pair played together, by "a|b" key (ids sorted). */
export function roundsTogether(state) {
  const out = new Map();
  const who = canonical(state);
  for (const r of doneRounds(state)) {
    const ids = [...new Set(r.players.map(p => who(p.id)))];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (!out.has(k)) out.set(k, []);
      out.get(k).push(r.id);
    }
  }
  return out;
}

/**
 * The Tab's payment plan: the fewest payments across the whole group, only ever between people
 * who have played a round together (friends from different groups never get asked to pay each
 * other). Returns [{ from, to, amount, rounds: [roundId] }], where rounds are the finished rounds
 * the two played together.
 */
export function outstanding(state) {
  const together = roundsTogether(state);
  const plan = fewestPayments(tabBalances(state), { canPay: (a, b) => together.has(pairKey(a, b)) });
  return plan.map(t => ({ ...t, rounds: together.get(pairKey(t.from, t.to)) || [] }));
}

/**
 * Everything between you and one person, for the round-by-round story: each finished round you
 * both played with the honest head-to-head (what you won from them, bet by bet), each payment
 * between you and each agreed carry-over. Newest first. `ids` is every id that means you.
 */
export function personStory(state, ids, other) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  const items = [];
  let won = 0, lost = 0, even = 0, net = 0, paid = 0;
  for (const r of doneRounds(state)) {
    const me = meFor(r, state);
    // A round you only watched is not a round you played with them
    if (!mine.has(me) || me === other || !r.players.some(p => p.id === other) || !r.players.some(p => p.id === me)) continue;
    const amount = roundResults(r).pairs[me]?.[other] ?? 0;
    if (amount > 0) won++; else if (amount < 0) lost++; else even++;
    net += amount;
    items.push({ kind: 'round', id: r.id, round: r, amount, at: r.finishedAt || r.createdAt || 0 });
  }
  for (const s of state.settlements || []) {
    // amount: what the payment did for your side (they paid you: +, you paid them: -)
    if (s.from === other && mine.has(s.to)) { items.push({ kind: 'payment', id: s.id, settlement: s, amount: s.amount, at: s.at || 0 }); paid += s.amount; }
    else if (mine.has(s.from) && s.to === other) { items.push({ kind: 'payment', id: s.id, settlement: s, amount: -s.amount, at: s.at || 0 }); paid -= s.amount; }
  }
  // Agreed carry-overs get their own line. They move no money, so net and paid stay as they are
  for (const k of state.carries || []) {
    if (k.status !== 'agreed') continue;
    const theyOwe = k.from === other && mine.has(k.to), iOwe = mine.has(k.from) && k.to === other;
    if (theyOwe || iOwe) items.push({ kind: 'carry', id: k.id, carry: k, amount: theyOwe ? k.amount : -k.amount, at: k.answeredAt || k.at || 0 });
  }
  items.sort((a, b) => b.at - a.at);
  const c = v => Math.round(v * 100) / 100 || 0;
  return { items, rounds: won + lost + even, won, lost, even, net: c(net), paid: c(paid) };
}

/**
 * Your honest head-to-head with everyone you've played a finished round with:
 * Map(id -> { rounds, won, lost, even, net }), where net is what you've won from them in all.
 */
export function headToHeadSummary(state, ids) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  const out = new Map();
  for (const r of doneRounds(state)) {
    const me = meFor(r, state);
    if (!mine.has(me) || !r.players.some(p => p.id === me)) continue; // watched rounds aren't yours
    const pairs = roundResults(r).pairs[me] || {};
    for (const p of r.players) {
      if (p.id === me || mine.has(p.id)) continue;
      const cur = out.get(p.id) || { rounds: 0, won: 0, lost: 0, even: 0, net: 0 };
      const v = pairs[p.id] ?? 0;
      cur.rounds++;
      if (v > 0) cur.won++; else if (v < 0) cur.lost++; else cur.even++;
      cur.net = Math.round((cur.net + v) * 100) / 100;
      out.set(p.id, cur);
    }
  }
  return out;
}

/** "3–1" or "3–1–2": won, lost and (when there are any) even rounds. */
export function recordText({ won, lost, even }) {
  return even ? `${won}\u2013${lost}\u2013${even}` : `${won}\u2013${lost}`;
}

/** What the Tab's plan has between you and `other`: positive when they pay you, negative when you pay them. */
export function tabWith(plan, ids, other) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  let c = 0;
  for (const t of plan) {
    if (t.from === other && mine.has(t.to)) c += toCents(t.amount);
    if (t.to === other && mine.has(t.from)) c -= toCents(t.amount);
  }
  return c / 100;
}

/** Player name lookup that also covers people who were removed but still appear in rounds. */
export function nameOf(state, id) {
  if (state.players[id]) return state.players[id].name;
  for (const r of Object.values(state.rounds)) {
    const p = r.players.find(x => x.id === id);
    if (p) return p.name;
  }
  return 'Someone';
}
