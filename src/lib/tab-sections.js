// The Tab's two sections, "Owes you" and "You owe", and who's square, read off the payment plan the
// Tab already has (ledger.js outstanding). Display only: no money maths of its own, just the plan's
// lines between you and each person, netted the way the Tab always netted them (a friend you pass
// money on for can be on both sides of you, so it's one amount). Pure, tested in tab-sections.test.js.
import { headToHeadSummary, outstanding } from './ledger.js';
import { myIds } from './format.js';
import { canonicalOf, recentPayment } from './shared-tab.js';
import { allTripPays } from './trip-expenses.js';
import { openRewards } from './play-for.js';

const toCents = v => Math.round((Number(v) || 0) * 100);

/**
 * Everything the Tab lists, from one plan:
 *  • owesYou / youOwe: [{ id, net, debts }], `net` in dollars (positive when they owe you), biggest first
 *  • owedToYou / youOweTotal: each section's total in dollars, both positive; `net` is the difference
 *  • others: the plan's lines between two other people
 *  • recentSquare: [{ id, pay }] people you squared with lately, so the last payment can be taken back
 *  • rewardOnly: ids square on money with a reward still open between you ("You owe Sam lunch").
 *    Never an amount: rewards aren't dollars and never count in who's square
 *  • squareIds: everyone else you've played with, square
 * `plan`, `mine` and `h2h` can be passed in when the screen already has them.
 */
export function tabSections(state, { now = Date.now(), plan = outstanding(state, { now }), mine = myIds(state), h2h = null } = {}) {
  const isMe = id => mine.has(id);
  // One row per friend: what the plan has between you, netted in whole cents
  const byPerson = new Map();
  for (const t of plan) {
    if (isMe(t.from) === isMe(t.to)) continue;
    const other = isMe(t.from) ? t.to : t.from;
    const cur = byPerson.get(other) || { id: other, cents: 0, debts: [] };
    cur.cents += isMe(t.to) ? toCents(t.amount) : -toCents(t.amount);
    cur.debts.push(t);
    byPerson.set(other, cur);
  }
  const people = [...byPerson.values()].filter(p => p.cents).map(({ id, cents, debts }) => ({ id, net: cents / 100, debts }));
  const owesYou = people.filter(p => p.net > 0).sort((a, b) => b.net - a.net || a.id.localeCompare(b.id));
  const youOwe = people.filter(p => p.net < 0).sort((a, b) => a.net - b.net || a.id.localeCompare(b.id));
  const owed = owesYou.reduce((a, p) => a + toCents(p.net), 0);
  const owe = -youOwe.reduce((a, p) => a + toCents(p.net), 0);
  const others = plan.filter(t => !isMe(t.from) && !isMe(t.to));

  // People you squared with lately keep a card for a few days, so the last payment can be taken back
  const who = canonicalOf(state);
  const meId = state.me || [...mine][0] || null;
  const owing = new Set(people.map(p => p.id));
  const recentSquare = [...new Set([...(state.settlements || []), ...allTripPays(state)].flatMap(s => [s.from, s.to]).map(who))]
    .filter(id => meId && !isMe(id) && !owing.has(id))
    .map(id => ({ id, pay: recentPayment(state, meId, id, now) }))
    .filter(x => x.pay)
    .sort((a, b) => b.pay.at - a.pay.at);
  const recent = new Set(recentSquare.map(x => x.id));
  // Rewards from reward rounds: on the person's card, or a card of their own for someone square on money
  const rewardOnly = [...new Set(openRewards(state, { ids: mine, canon: who }).map(l => l.other))].filter(id => !owing.has(id) && !recent.has(id));
  const played = h2h || headToHeadSummary(state, mine);
  const squareIds = [...played.keys()].filter(id => !byPerson.has(id) && !recent.has(id) && !rewardOnly.includes(id));

  return { owesYou, youOwe, owedToYou: owed / 100, youOweTotal: owe / 100, net: (owed - owe) / 100, people, others, recentSquare, rewardOnly, squareIds, meId };
}

/** The summary card's lines: what's owed to you big, and what you owe under it ("You owe Jackson $8"). */
export function tabSummary(sections, nameOf) {
  const { owesYou, youOwe, owedToYou, youOweTotal } = sections;
  const first = id => String(nameOf(id) || '').split(' ')[0];
  const lead = owesYou.length ? { label: owesYou.length === 1 ? `${first(owesYou[0].id)} owes you` : 'People still owe you', amount: owedToYou, tone: 'pos' }
    : youOwe.length ? { label: youOwe.length === 1 ? `You owe ${first(youOwe[0].id)}` : `You owe ${youOwe.length} people`, amount: youOweTotal, tone: 'neg' }
    : null;
  const sub = owesYou.length && youOwe.length
    ? (youOwe.length === 1 ? { text: `You owe ${first(youOwe[0].id)}`, amount: youOweTotal } : { text: `You owe ${youOwe.length} people`, amount: youOweTotal })
    : null;
  return { lead, sub };
}
