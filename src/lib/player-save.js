// Saving a player card (name, handicap index, how they get paid), shared by Edit player and your
// profile. Mutates a state draft.
import { cleanHandle } from './pay.js';

/**
 * Save `pid`'s card. Rounds still being played carry the payment app too, so friends in a shared
 * round get the new pay button (for you, that's every seat you hold).
 */
export function savePlayerCard(s, pid, { name, index = null, payApp = null, handle = '' }) {
  const cleaned = payApp ? cleanHandle(payApp, handle) : '';
  const pay = cleaned ? { payApp, payHandle: cleaned } : {};
  const { venmo: _old, payApp: _a, payHandle: _h, ...rest } = s.players[pid] || { createdAt: Date.now() };
  s.players[pid] = { ...rest, id: pid, name, index, ...pay };
  const seats = pid === s.me ? new Set([pid, ...Object.values(s.rounds).map(r => r.localMe).filter(Boolean)]) : new Set([pid]);
  for (const r of Object.values(s.rounds)) {
    if (r.status !== 'active') continue;
    for (const p of r.players) {
      if (!seats.has(p.id)) continue;
      delete p.payApp; delete p.payHandle;
      Object.assign(p, pay);
    }
  }
}
