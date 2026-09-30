// When two cards that were one person ("Same person as...") are split apart again, a payment
// recorded while they were one card sits on whichever id it was recorded against, so one card
// reads overpaid and the other still owing. This moves that payment, or the part of it that
// belongs to the other card, over to it, so both read right. Pure, unit tested.
//
// Only plain Tab payments move (no round code, no round id): payments on a round's transfers are
// recorded against the round's own seats, so they follow the right card already, and shared ones
// belong to both phones. The payer and the payee stay the same people, and nothing is added or
// lost, so every total stays the same: only which of the two cards a payment counts on changes.
import { tabBalances } from './ledger.js';
import { canonicalOf } from './pair-debts.js';

const cents = v => Math.round((Number(v) || 0) * 100);
const plain = s => s && !s.code && !s.roundId && s.from && s.to && cents(s.amount) > 0;

/**
 * The settlements once `keep` and `alias` are two people again, or null when nothing needs to
 * move. `state` is the phone as it is (still one person); `next` has the new { links, unlinks }.
 * Balances are positive when owed money: a card that paid more than it owed reads above zero, one
 * that still owes reads below it. When one card is over and the other under, the smaller of the
 * two gaps moves across: first payments the over card made, newest first, then payments the
 * under card received. A payment only partly moved is split in two rows (same time, same people).
 */
export function paymentsAfterSplit(state, next, keep, alias, { makeId = () => Math.random().toString(36).slice(2, 9) } = {}) {
  const after = { ...state, ...next };
  const who = canonicalOf(after);
  const K = who(keep), A = who(alias);
  if (!K || !A || K === A) return null;
  const bal = tabBalances(after);
  const bK = cents(bal[K]), bA = cents(bal[A]);
  if (!(bK > 0 && bA < 0) && !(bA > 0 && bK < 0)) return null;
  const [over, under] = bK > 0 ? [K, A] : [A, K];
  let left = Math.min(Math.abs(bK), Math.abs(bA));
  const list = (state.settlements || []).map(s => ({ ...s }));
  const added = [];
  const newest = (x, y) => (y.at || 0) - (x.at || 0);
  // Moving a payment the over card made to the under card, or one the under card got to the over card
  const moves = [
    { field: 'from', from: over, to: under },
    { field: 'to', from: under, to: over },
  ];
  for (const m of moves) {
    const pool = list.filter(s => plain(s) && who(s[m.field]) === m.from && who(m.field === 'from' ? s.to : s.from) !== m.to).sort(newest);
    for (const s of pool) {
      if (!left) break;
      const c = cents(s.amount);
      const part = Math.min(c, left);
      left -= part;
      if (part === c) s[m.field] = m.to;
      else {
        s.amount = (c - part) / 100;
        added.push({ ...s, id: `s_${makeId()}`, [m.field]: m.to, amount: part / 100 });
      }
    }
  }
  const out = [...list, ...added];
  const same = out.length === (state.settlements || []).length && out.every((s, i) => JSON.stringify(s) === JSON.stringify(state.settlements[i]));
  return same ? null : out;
}
