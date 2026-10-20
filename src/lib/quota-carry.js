// "Quota moves after the round" (Quota's house rule quota.adjust, 2026-10-05): a league's quotas move
// with each result, so the next Quota round a player plays with the rule on starts from where their
// last one left them. The move itself is games.js quotaAdjusted and round.js nextQuotas; this finds it.
// A carried quota is saved in the new round (round.quotas = { pid: quota }), so every phone in a shared
// round plays the same quotas and the round keeps its money whatever is played after it.
import { nextQuotas, teamQuotaOn } from './round.js';
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
  // Each round's next quotas are worked out once, however many players look in it
  const cache = new Map();
  const nextOf = r => { if (!cache.has(r.id)) cache.set(r.id, nextQuotas(r)); return cache.get(r.id); };
  const out = {};
  for (const pid of playerIds) {
    const me = person(pid);
    for (const r of rounds) {
      const seat = (r.players || []).find(p => person(p.id) === me);
      if (!seat) continue;
      const next = nextOf(r)[seat.id];
      // Their last round with the rule on decides it; one they didn't finish leaves their quota as it is
      if (next) {
        const n = r.holes?.length || 18;
        const scale = v => (n === holesCount ? v : Math.round(v * holesCount / n));
        // `last`: the quota they played to last time, at this round's length, so setup can say how far it moved
        out[pid] = { quota: scale(next.next), from: next.quota, last: scale(next.quota), roundId: r.id };
      }
      break;
    }
  }
  return out;
}

/** "up 2", "down 1", "same as": how far a carried quota moved from the one played to last time. */
export function movedWords(c) {
  const d = c?.last != null ? c.quota - c.last : 0;
  return d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'the same as';
}

/**
 * "Ann 26 (up 2) · Bo 31 (down 1)": the carried quotas in a line, by first name, each with how far it
 * moved since last time. `skip` leaves one player out (yours, said on its own). '' when none.
 */
export function carriedLine(carried, nameOf, skip = null) {
  return Object.entries(carried || {}).filter(([pid]) => pid !== skip).map(([pid, c]) => {
    const w = movedWords(c);
    return `${String(nameOf(pid) || '').split(' ')[0]} ${c.quota}${w === 'the same as' ? '' : ` (${w})`}`;
  }).join(' · ');
}

/** "Your quota is 31, up 2 from last time." (or "the same as last time"), or '' when yours isn't carried. */
export function myQuotaLine(carried, me) {
  const c = me ? carried?.[me] : null;
  if (!c) return '';
  const w = movedWords(c);
  return `Your quota is ${c.quota}, ${w === 'the same as' ? 'the same as' : `${w} from`} last time.`;
}

/**
 * A new Quota round's house rules that need more than its settings, put right when the round is made
 * (from setup or from a plan's roll call). Team quota stays on only when the round has its teams: a
 * round made without them (three players, or per point) plays everyone for themselves, so its settings
 * say so and the bet line and first-tee card match the money. "Quota moves after the round" puts each
 * player's carried quota on the round. Changes `round` and returns it; any other game is left alone.
 */
export function withQuotaRules(state, round) {
  if (round?.game !== 'quota' || !round.settings?.quota) return round;
  const q = round.settings.quota;
  if (q.team && !teamQuotaOn(round)) round.settings.quota = { ...q, team: false };
  if (q.adjust === 'one' || q.adjust === 'half') {
    const carried = carriedQuotas(state, round.players.map(p => p.id), round.holes.length);
    if (Object.keys(carried).length) round.quotas = Object.fromEntries(Object.entries(carried).map(([pid, c]) => [pid, c.quota]));
  }
  return round;
}
