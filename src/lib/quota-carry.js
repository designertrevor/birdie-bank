// "Quota moves after the round" (Quota's house rule quota.adjust, 2026-10-05): a league's quotas move
// with each result, so the next Quota round a player plays with the rule on starts from where their
// last one left them. The move itself is games.js quotaAdjusted and round.js nextQuotas; this finds it.
// A carried quota is saved in the new round (round.quotas = { pid: quota }), so every phone in a shared
// round plays the same quotas and the round keeps its money whatever is played after it.
import { nextQuotas } from './round.js';
import { linksOf } from './people-links.js';

/**
 * Quotas to carry into a new Quota round of `holesCount` holes: { pid: { quota, from, roundId } } for
 * each player in `playerIds` whose last finished Quota round with the rule on gave them a next quota.
 * `from` is that round's quota. One person is one person across their linked ids (people-links.js).
 * A quota from an 18-hole round is halved for nine holes (and doubled the other way), rounded.
 */
export function carriedQuotas(state, playerIds, holesCount) {
  const rounds = Object.values(state?.rounds || {})
    .filter(r => r?.game === 'quota' && r.status === 'done' && (r.settings?.quota?.adjust === 'one' || r.settings?.quota?.adjust === 'half'))
    .sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0));
  if (!rounds.length) return {};
  const links = linksOf(state);
  const person = id => links.personOf(id);
  const out = {};
  for (const pid of playerIds) {
    const me = person(pid);
    for (const r of rounds) {
      const seat = (r.players || []).find(p => person(p.id) === me);
      if (!seat) continue;
      const next = nextQuotas(r)[seat.id];
      // Their last round with the rule on decides it; one they didn't finish leaves their quota as it is
      if (next) {
        const n = r.holes?.length || 18;
        out[pid] = { quota: n === holesCount ? next.next : Math.round(next.next * holesCount / n), from: next.quota, roundId: r.id };
      }
      break;
    }
  }
  return out;
}

/** "Ann 26 · Bo 31": the carried quotas in a line, by first name. '' when none. */
export function carriedLine(carried, nameOf) {
  return Object.entries(carried || {}).map(([pid, c]) => `${String(nameOf(pid) || '').split(' ')[0]} ${c.quota}`).join(' · ');
}
