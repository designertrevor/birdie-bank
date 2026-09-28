// Shared display helpers and derived stats (kept out of component files for fast refresh).
import { GAMES, SIDE_GAMES, roundResults, scoreSummary } from './round.js';
import { money } from './golf.js';

/**
 * A round's games in one name: "Nassau", or "Nassau + Skins + Junk" with side games. Works on a
 * round or a live round's meta (anything with `game` and optional `sideGames`).
 */
export function gameLabel(round) {
  const main = GAMES[round?.game]?.name || '';
  const sides = (Array.isArray(round?.sideGames) ? round.sideGames : []).map(sg => SIDE_GAMES[sg?.game]?.label).filter(Boolean);
  return [main, ...sides].filter(Boolean).join(' + ');
}

export function formatIndex(i) {
  if (i == null) return '–';
  const v = Math.abs(i);
  const s = Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v * 10) / 10);
  return (i < 0 ? '+' : '') + s;
}

/** Handicap allowance in words: "Full strokes", "90% of strokes". */
export function hcPctLabel(pct) {
  return pct == null || pct >= 100 ? 'Full strokes' : `${pct}% of strokes`;
}

export function playerLabel(p, me) {
  return p.id === me ? `${p.name} (you)` : p.name;
}

export function sortedPlayers(state) {
  return Object.values(state.players).sort((a, b) => (a.id === state.me ? -1 : b.id === state.me ? 1 : a.name.localeCompare(b.name)));
}

export function roundDate(r) {
  return new Date(r.finishedAt || r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(r.createdAt).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Plain-text results. With `amounts: false` it lists the order only, no money and no settle-up. */
/** A standing's place: equal money shares a place (1, 1, 3, 3), same as the reveal and the image. */
export function placeOf(standings, i) {
  return standings.findIndex(q => q.amount === standings[i].amount) + 1;
}

export function shareText(round, res, { amounts = true } = {}) {
  const lines = [`${gameLabel(round)} at ${round.course.name} · ${roundDate(round)}`];
  res.standings.forEach((p, i) => lines.push(amounts ? `${placeOf(res.standings, i)}. ${p.name} ${money(p.amount, { sign: true })}` : `${placeOf(res.standings, i)}. ${p.name}`));
  if (amounts && res.transfers.length) {
    lines.push('', 'Settle up:');
    res.transfers.forEach(t => lines.push(`${roundPlayerName(round, t.from)} → ${roundPlayerName(round, t.to)} ${money(t.amount)}`));
  }
  lines.push('', 'Scored with Birdie Bank · birdie-bank.vercel.app');
  return lines.join('\n');
}
export const roundPlayerName = (round, id) => round.players.find(p => p.id === id)?.name || '?';

/**
 * One line for the toast after saving a hole: who gained the most on it. Everyone tied for the
 * most is named (partners win together), and a whole team is named by its team name.
 */
export function holeMoneyLine(round, hole, delta) {
  const best = Math.max(0, ...round.players.map(p => delta[p.id] || 0));
  if (!best) return `Hole ${hole.no} saved. No money moved`;
  const top = round.players.filter(p => delta[p.id] === best).map(p => p.id);
  const team = round.teams?.find(t => t.players.length === top.length && t.players.every(pid => top.includes(pid)));
  const who = team ? team.name : top.map(pid => roundPlayerName(round, pid).split(' ')[0]).join(' & ');
  return `Hole ${hole.no}: ${who} ${money(best, { sign: true })}`;
}

export async function shareRound(round, res, showToast, opts) {
  const text = shareText(round, res, opts);
  try {
    if (navigator.share) { await navigator.share({ title: 'Birdie Bank results', text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); showToast('Results copied. Paste them in the group chat'); }
  catch { showToast('Couldn’t open sharing on this device'); }
}

/** Which player in a round is "you" on this phone (joined rounds carry their own). */
export function meFor(round, state) { return round.localMe ?? state.me; }

/** Every player id that means "you" on this phone. */
export function myIds(state) {
  const ids = new Set(state.me ? [state.me] : []);
  for (const r of Object.values(state.rounds)) if (r.localMe) ids.add(r.localMe);
  return ids;
}

export function seasonStats(state, year = new Date().getFullYear()) {
  const rounds = Object.values(state.rounds)
    .filter(r => r.status === 'done' && new Date(r.finishedAt || r.createdAt).getFullYear() === year && r.players.some(p => p.id === meFor(r, state)))
    .sort((a, b) => (a.finishedAt || a.createdAt) - (b.finishedAt || b.createdAt));
  let total = 0, birdies = 0, streak = 0, best = null;
  const h2h = {};
  for (const r of rounds) {
    const me = meFor(r, state);
    const res = roundResults(r);
    const amt = res.balances[me] || 0;
    total += amt;
    streak = amt > 0 ? streak + 1 : 0;
    const s = scoreSummary(r, me);
    birdies += s.birdies + s.eagles;
    if (!best || amt > best.amount) best = { amount: amt, round: r };
    // Honest head-to-head from the bets themselves, not from who happened to pay whom
    for (const [pid, v] of Object.entries(res.pairs[me] || {})) h2h[pid] = Math.round(((h2h[pid] || 0) + v) * 100) / 100;
  }
  return { rounds: rounds.length, total, birdies, streak, best, h2h };
}

/** Strokes for the round in words: "Gets 5 strokes", "Gives 1 stroke", "No strokes". */
export function strokesLabel(plays) {
  const n = Math.abs(plays || 0);
  if (!n) return 'No strokes';
  return `${plays > 0 ? 'Gets' : 'Gives'} ${n} stroke${n === 1 ? '' : 's'}`;
}

/** First name, for tight spots like tiles and the money bar. */
export const firstName = name => String(name || '').trim().split(/\s+/)[0];
