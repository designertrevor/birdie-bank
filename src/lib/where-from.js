// Where each amount comes from (ROADMAP area 7, Trevor's call after his Banker round): the settle-up
// keeps the fewest payments, and tapping a person shows what's between the two of you game by game
// and side bet by side bet: "Zach and you: +$4 Banker, +$2 Closest to the pin". For one round, and
// across every finished money round on the Tab. The items always add up to the pair's honest head
// to head (roundResults().pairs), which is what you won from them, whoever ends up paying whom.
// One friend is one person whatever id a round has for them (see people-links.js). Pure, unit tested.
import { gameKeyLabel, roundResults } from './round.js';
import { meFor } from './format.js';
import { canonicalOf } from './pair-debts.js';
import { onTab, tabResults } from './play-for.js';
import { allTripPays, expensesBetween } from './trip-expenses.js';

const toCents = v => Math.round((Number(v) || 0) * 100);

/**
 * What `a` won from `b` in one round, game by game and bet by bet:
 * { total, items: [{ key, group, label, amount, bet? }] }. `total` is res.pairs[a][b]; the items
 * add up to it to the cent (a cent lost to rounding a three-way split goes on the biggest item).
 * Every game in the round is listed (a game square between you shows 0), then each side bet the
 * two of you had together. `group` names the item across rounds: the game it was, or the kind of bet.
 */
export function pairBreakdown(round, a, b, res = roundResults(round)) {
  const total = res.pairs?.[a]?.[b] ?? 0;
  const by = res.detail?.byGame;
  const gameGroup = key => `game:${key === 'main' ? round.game : key}`;
  if (!by) return { total, items: [{ key: 'main', group: gameGroup('main'), label: gameKeyLabel(round, 'main'), amount: total }] };
  const items = [];
  for (const [key, g] of Object.entries(by)) {
    if (key === 'bets') {
      for (const x of g.detail?.bets || []) {
        if (!x.sides.includes(a) || !x.sides.includes(b)) continue;
        const amount = x.sides[0] === a ? x.amount : -x.amount || 0;
        items.push({ key: `bet:${x.id}`, group: x.kind === 'custom' ? `bet:custom:${x.label.toLowerCase()}` : `bet:${x.kind}`, label: x.label, amount, bet: true });
      }
      continue;
    }
    // A player who wasn't in a game (a late joiner kept out of it) has nothing in it with anyone
    if (g.pairs && !(g.pairs[a] && b in g.pairs[a])) continue;
    items.push({ key, group: gameGroup(key), label: g.label, amount: Math.round((g.pairs?.[a]?.[b] ?? 0) * 100) / 100 || 0 });
  }
  const drift = toCents(total) - items.reduce((s, x) => s + toCents(x.amount), 0);
  if (drift && items.length) {
    const big = items.reduce((m, x) => (Math.abs(x.amount) > Math.abs(m.amount) ? x : m), items[0]);
    big.amount = (toCents(big.amount) + drift) / 100 || 0;
  }
  return { total, items };
}

/** Is this id you: one of `mine`, or linked to one of them. */
const mineOf = (state, mine) => {
  const who = canonicalOf(state);
  return id => mine.has(id) || mine.has(who(id));
};

/**
 * Where everything between you and one person comes from, across every finished money round you
 * both played (points and reward rounds aren't money, so they're left out, but for a reward round's
 * side bets played for money):
 * { rounds: [{ round, at, total, items }], totals: [{ group, label, amount }], net, paid, open,
 *   expenses: [{ expense, amount, at }], spent }.
 * `rounds` is newest first, each with its pairBreakdown from your side; `totals` adds each game
 * and kind of bet up across the rounds (biggest first, square ones left out); `net` is what you
 * won from them in all, `paid` what they paid you less what you paid them, `expenses` and `spent`
 * what trip expenses put between you (in dollars, positive when they owe you), and `open` what's
 * still between you two (net and spent, less paid). `ids` is every id that means you.
 */
export function breakdownWith(state, ids, other) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  const who = canonicalOf(state);
  const isMine = mineOf(state, mine);
  const O = who(other);
  const isThem = id => id != null && !isMine(id) && who(id) === O;
  const rounds = [];
  const totals = new Map();
  let net = 0, paid = 0;
  for (const r of Object.values(state.rounds || {})) {
    if (r.status !== 'done' || !onTab(r)) continue;
    const me = meFor(r, state);
    if (!mine.has(me) || isThem(me) || !r.players.some(p => p.id === me)) continue;
    const them = r.players.filter(p => isThem(p.id)).map(p => p.id);
    if (!them.length) continue;
    // A reward round counts only its side bets for money here (see tabResults)
    const res = tabResults(r);
    // Two players in one round are never one person, but if a round has them twice, both count
    const parts = them.map(id => pairBreakdown(r, me, id, res));
    const items = parts.flatMap(x => x.items);
    const total = Math.round(parts.reduce((s, x) => s + x.total, 0) * 100) / 100 || 0;
    net += toCents(total);
    for (const x of items) {
      const cur = totals.get(x.group) || { group: x.group, label: x.label, amount: 0 };
      cur.amount = (toCents(cur.amount) + toCents(x.amount)) / 100;
      totals.set(x.group, cur);
    }
    rounds.push({ round: r, at: r.finishedAt || r.createdAt || 0, total, items });
  }
  // Payments, and payments for trip expenses (trip-expenses.js)
  for (const s of [...(state.settlements || []), ...allTripPays(state)]) {
    if (isThem(s.from) && isMine(s.to)) paid += toCents(s.amount);
    else if (isMine(s.from) && isThem(s.to)) paid -= toCents(s.amount);
  }
  rounds.sort((x, y) => y.at - x.at);
  const list = [...totals.values()].filter(t => toCents(t.amount)).sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount) || x.label.localeCompare(y.label));
  // Trip expenses one of you paid for the other: not golf, so on their own lines
  const expenses = expensesBetween(state, isMine, isThem).map(x => ({ ...x, amount: x.amount / 100 }));
  const spent = expenses.reduce((a, x) => a + toCents(x.amount), 0);
  return { rounds, totals: list, net: net / 100, paid: paid / 100, open: (net + spent - paid) / 100, expenses, spent: spent / 100 };
}

/**
 * The breakdown in one line, from your side: "+$4 Banker, +$2 Closest to the pin". `fmt` formats
 * the amounts (points for a points round). Items square between you are left out unless all are.
 */
export function breakdownLine(items, fmt) {
  const shown = items.filter(x => toCents(x.amount));
  if (!shown.length) return 'All square';
  return shown.map(x => `${fmt(x.amount, { sign: true })} ${x.label}`).join(', ');
}
