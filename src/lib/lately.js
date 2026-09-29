// "Lately" on Up next: what happened with your group in the last 30 days, newest first, built
// only from data this phone already has: payments recorded on the Tab, carry-overs (once they
// exist), who answered an upcoming round, and recaps of finished rounds.
//
// Money stays between the two people in it: an amount shows only when you are one of them.
// Anything between two other people says who, never how much.
//
// Payments from the shared Tab land in state.settlements like any other payment. One "I paid"
// can fill several round transfers at once, so settlements between the same two people recorded
// at the same moment show as one row. Carry-overs come from state.carries (see carry.js): only
// agreed ones show, dated when they were agreed (answeredAt).
import { GAMES, roundResults } from './round.js';
import { money } from './golf.js';
import { gameLabel, meFor, myIds } from './format.js';
import { nameOf } from './ledger.js';
import { dayLabel } from './plans.js';
import { PAY_APPS } from './pay.js';
import { lastResult, roundTime } from './history.js';
import { paymentGroups } from './shared-tab.js';
import { countsMoney, rewardOutcome, unitFmt } from './play-for.js';

export const LATELY_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const cents = v => Math.round(v * 100) / 100;

/** "Just now", "2h ago", "Yesterday", "3 days ago", "Sep 12". */
export function agoLabel(at, now = Date.now()) {
  const t = typeof now === 'number' ? now : now.getTime();
  const mins = Math.floor((t - at) / 60000);
  if (mins < 60) return mins < 2 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Everything about carries that counts as agreed. Today's saved data has none. */
function agreedCarries(list) {
  return (Array.isArray(list) ? list : []).filter(c => c && c.from && c.to && (c.status == null || c.status === 'agreed'));
}

/**
 * Lately items, newest first: [{ id, kind, at, text, sub, target }], where kind is 'payment',
 * 'carry', 'rsvp' or 'recap' and target is a [screen, params] pair to open (or null).
 * The round shown in "Last time out" is left out, since Up next already shows it.
 */
export function latelyItems(state, now = Date.now(), { carries = state?.carries, days = LATELY_DAYS } = {}) {
  const t = typeof now === 'number' ? now : now.getTime();
  const since = t - days * DAY;
  const inWindow = at => typeof at === 'number' && at >= since && at <= t + 60000;
  const mine = myIds(state);
  const name = id => first(nameOf(state, id));
  const items = [];

  // Payments recorded on the Tab: one tap that filled several round transfers is one payment
  // (or went both ways: the shared rounds one way, the rest of the Tab the other, netted)
  const taps = paymentGroups({ ...state, settlements: (state.settlements || []).filter(s => inWindow(s.at) && s.from && s.to) })
    .filter(g => g.amount > 0)
    .map(g => {
      const lead = g.settlements.find(s => s.from === g.from && s.to === g.to) || g.settlements[0];
      return { ...lead, from: g.from, to: g.to, amount: g.amount, roundId: g.settlements.find(s => s.roundId)?.roundId || null, app: g.settlements.find(s => s.app)?.app || null };
    });
  for (const s of taps) {
    const fromMe = mine.has(s.from), toMe = mine.has(s.to);
    if (fromMe && toMe) continue; // you paying you across two phones
    const app = PAY_APPS[s.app]?.name;
    const when = agoLabel(s.at, t);
    const round = s.roundId && state.rounds?.[s.roundId] ? ['roundDetail', { id: s.roundId }] : null;
    if (toMe || fromMe) {
      const other = toMe ? s.from : s.to;
      items.push({
        id: `pay:${s.id}`, kind: 'payment', at: s.at,
        text: toMe ? `${name(other)} paid you ${money(s.amount)}` : `You paid ${name(other)} ${money(s.amount)}`,
        sub: app ? `${app} · ${when}` : when,
        target: ['person', { id: other }],
      });
    } else {
      items.push({ id: `pay:${s.id}`, kind: 'payment', at: s.at, text: `${name(s.from)} settled up with ${name(s.to)}`, sub: when, target: round });
    }
  }

  // Carry-overs both sides agreed to (from the shared Tab, when it lands)
  for (const c of agreedCarries(carries)) {
    const at = c.answeredAt ?? c.agreedAt ?? c.at;
    if (!inWindow(at)) continue;
    const fromMe = mine.has(c.from), toMe = mine.has(c.to);
    if (fromMe && toMe) continue;
    const other = fromMe ? c.to : toMe ? c.from : null;
    items.push({
      id: `carry:${c.id}`, kind: 'carry', at,
      text: other
        ? `You and ${name(other)} rolled ${Number(c.amount) > 0 ? money(c.amount) : 'it'} to next time`
        : `${name(c.from)} and ${name(c.to)} rolled it to next time`,
      sub: agoLabel(at, t),
      target: other ? ['person', { id: other }] : null,
    });
  }

  // Who answered an upcoming round (not you)
  for (const plan of Object.values(state.plans || {})) {
    if (!plan || plan.status !== 'planned') continue;
    const me = plan.host ? plan.hostWho : plan.localMe;
    const day = dayLabel(plan.date, new Date(t));
    for (const [who, a] of Object.entries(plan.answers || {})) {
      if (who === me || !a?.status || !inWindow(a.at)) continue;
      const n = first(a.name);
      const text = a.status === 'in' ? `${n} is in for ${day}` : a.status === 'out' ? `${n} is out for ${day}` : a.status === 'maybe' ? `${n} is a maybe for ${day}` : null;
      if (!text) continue;
      items.push({ id: `rsvp:${plan.id}:${who}`, kind: 'rsvp', at: a.at, text, sub: [plan.course?.name, agoLabel(a.at, t)].filter(Boolean).join(' · '), target: ['plan', { id: plan.id }] });
    }
  }

  // Finished rounds: who took it, and only your own amount (in points for a points or reward
  // round, which is never money; a reward round says who's buying instead)
  const shown = lastResult(state)?.round?.id;
  for (const r of Object.values(state.rounds || {})) {
    if (r?.status !== 'done' || r.id === shown || !inWindow(roundTime(r)) || !GAMES[r.game]) continue;
    const bal = roundResults(r).balances;
    const me = meFor(r, state);
    const top = Math.max(...Object.values(bal));
    const winners = top > 0.004 ? r.players.filter(p => Math.abs(bal[p.id] - top) < 0.005) : [];
    const who = winners.map(p => (mine.has(p.id) ? 'You' : first(p.name)));
    const took = !who.length ? 'All square' : who.length === 1 ? `${who[0]} took it` : `${who.slice(0, -1).join(', ')} and ${who.at(-1)} split it`;
    const played = me && r.players.some(p => p.id === me);
    const amount = played ? cents(bal[me] ?? 0) : null;
    const fmt = unitFmt(r);
    const reward = rewardOutcome(r, roundResults(r));
    const yours = amount == null ? null : amount === 0 ? (countsMoney(r) ? 'You broke even' : 'You were level') : `You ${fmt(amount, { sign: true })}`;
    items.push({
      id: `recap:${r.id}`, kind: 'recap', at: roundTime(r),
      text: `${gameLabel(r)} at ${r.course?.name || 'the course'} · ${took}`,
      sub: [reward ? reward.buy : yours, agoLabel(roundTime(r), t)].filter(Boolean).join(' · '),
      target: ['roundDetail', { id: r.id }],
    });
  }

  return items.sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id)));
}
