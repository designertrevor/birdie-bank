import { roundResults } from './round.js';

/**
 * Outstanding debts between players, netted across every finished round and
 * any payments recorded. Returns [{ from, to, amount, rounds: [roundId] }].
 */
export function outstanding(state) {
  const pair = new Map(); // "a|b" with a<b -> { net (positive = a owes b), rounds:Set }
  const key = (a, b) => (a < b ? [`${a}|${b}`, 1] : [`${b}|${a}`, -1]);
  const add = (from, to, amt, roundId) => {
    const [k, sign] = key(from, to);
    const cur = pair.get(k) || { net: 0, rounds: new Set() };
    cur.net += sign * amt;
    if (roundId) cur.rounds.add(roundId);
    pair.set(k, cur);
  };
  for (const r of Object.values(state.rounds)) {
    if (r.status !== 'done') continue;
    for (const t of roundResults(r).transfers) add(t.from, t.to, t.amount, r.id);
  }
  for (const s of state.settlements) add(s.to, s.from, s.amount); // a payment reduces what from owes to
  const out = [];
  for (const [k, v] of pair) {
    const cents = Math.round(v.net * 100);
    if (!cents) continue;
    const [a, b] = k.split('|');
    out.push(cents > 0 ? { from: a, to: b, amount: cents / 100, rounds: [...v.rounds] } : { from: b, to: a, amount: -cents / 100, rounds: [...v.rounds] });
  }
  return out.sort((x, y) => y.amount - x.amount);
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

/** Venmo link to pay `handle`, or with txn 'charge' to request money from them. */
export function venmoLink(handle, amount, note = 'Birdie Bank', txn = 'pay') {
  if (!handle) return null;
  return `https://venmo.com/${encodeURIComponent(handle)}?txn=${txn}&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
}
