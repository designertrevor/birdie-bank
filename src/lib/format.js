// Shared display helpers and derived stats (kept out of component files for fast refresh).
import { GAMES, roundResults, scoreSummary } from './round.js';
import { money } from './golf.js';

export function formatIndex(i) {
  if (i == null) return '—';
  const v = Math.abs(i);
  const s = Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v * 10) / 10);
  return (i < 0 ? '+' : '') + s;
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

export function shareText(round, res) {
  const lines = [`${GAMES[round.game].name} at ${round.course.name} · ${roundDate(round)}`];
  res.standings.forEach((p, i) => lines.push(`${i + 1}. ${p.name} ${money(p.amount, { sign: true })}`));
  if (res.transfers.length) {
    lines.push('', 'Settle up:');
    res.transfers.forEach(t => lines.push(`${roundPlayerName(round, t.from)} → ${roundPlayerName(round, t.to)} ${money(t.amount)}`));
  }
  lines.push('', 'Tracked with Birdie Bank');
  return lines.join('\n');
}
export const roundPlayerName = (round, id) => round.players.find(p => p.id === id)?.name || '?';

export async function shareRound(round, res, showToast) {
  const text = shareText(round, res);
  try {
    if (navigator.share) { await navigator.share({ title: 'Birdie Bank results', text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); showToast('Results copied — paste them in the group chat'); }
  catch { showToast('Couldn’t share on this device'); }
}

export function seasonStats(state, year = new Date().getFullYear()) {
  const me = state.me;
  const rounds = Object.values(state.rounds)
    .filter(r => r.status === 'done' && new Date(r.finishedAt || r.createdAt).getFullYear() === year && r.players.some(p => p.id === me))
    .sort((a, b) => (a.finishedAt || a.createdAt) - (b.finishedAt || b.createdAt));
  let total = 0, birdies = 0, streak = 0, best = null;
  const h2h = {};
  for (const r of rounds) {
    const res = roundResults(r);
    const amt = res.balances[me] || 0;
    total += amt;
    streak = amt > 0 ? streak + 1 : 0;
    const s = scoreSummary(r, me);
    birdies += s.birdies + s.eagles;
    if (!best || amt > best.amount) best = { amount: amt, round: r };
    for (const t of res.transfers) {
      if (t.to === me) h2h[t.from] = (h2h[t.from] || 0) + t.amount;
      if (t.from === me) h2h[t.to] = (h2h[t.to] || 0) - t.amount;
    }
  }
  return { rounds: rounds.length, total, birdies, streak, best, h2h };
}
