// What the top of the scoring screen says about the hole (PlayTop.jsx's headline, HolePanels.jsx's
// skins panel).
import { isJustPlaying, skinsKinds, skinsTable, strokesFor } from '../../lib/round.js';
import { unitFmt } from '../../lib/play-for.js';

/**
 * Who gets a stroke here, up top, so a birdie that doesn't move the money makes sense: first names (a
 * team by its name), or null with no handicaps or no game. Someone just playing has no game to get
 * strokes in. Past two names the hole line gives the count; each row says who.
 */
export function strokesHere(round, hole, units, solo) {
  return round.useHandicaps && !solo
    ? units.filter(u => !isJustPlaying(round, u.id) && strokesFor(round, u, hole) > 0).map(u => u.team ? u.name : u.name.split(' ')[0])
    : null;
}

/**
 * What a skins hole is worth, for the skins panel: per kind (net and gross), the skins riding and the
 * money when each skin has a price; the skins each player has won; and what the bet chip says.
 */
export function skinsWorth(round, hole) {
  const money = unitFmt(round); // points in a points or reward round
  const kinds = skinsKinds(round);
  const cfg = round.settings.skins;
  const pot = cfg.payout === 'pot';
  const counts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  const parts = kinds.map(kind => {
    const t = skinsTable(round, kind);
    t.rows.filter(r => r.winner).forEach(r => { counts[r.winner] += r.skins; });
    const row = t.rows.find(r => r.hole.no === hole.no);
    const n = row?.pot ?? 1;
    return { tag: kinds.length > 1 ? (kind === 'net' ? 'Net' : 'Gross') : '', skins: n, money: pot ? null : money(row?.purse ?? t.value * (round.players.length - 1)) };
  });
  const worth = parts.map(x => `${x.tag ? `${x.tag} ` : ''}${x.skins} skin${x.skins > 1 ? 's' : ''}${x.money ? ` · ${x.money}` : ''}`);
  const won = round.players.map(p => ({ id: p.id, name: p.name.split(' ')[0], n: Math.round(counts[p.id] * 10) / 10 }));
  const price = pot ? `${money(cfg.stake ?? cfg.value)} each in` : `${money(cfg.value)} a skin`;
  return { parts, worth, won, price, pot };
}

