// Calcutta, a side game (overnight 14, 2026-10-20). Before the first tee every player (or every team,
// in a team game) goes up for auction and the highest bidder owns them; a player can buy themselves.
// The bids make the pot, and after the round the pot pays the owners of the top finishers in the main
// game. Pure maths, no imports, so tests can load it alone; the round glue (who finished where) is
// calcuttaTable in round.js.
//
// Money is worked in whole cents (integers) from start to finish, so the pot always adds to zero:
// every cent a buyer pays in is a cent some owner is paid out.
//
// Published rules, checked 2026-10-20: Live Tourney, "What is a Calcutta in golf?"
// https://www.livetourney.com/blog/what-is-a-calcutta-in-golf (players sold at auction to make the pool,
// paid to the owners of the top finishers by place, and a "50% buy-back": the player pays the winning
// bidder half the price for half the winnings). Groups pick their own splits; 70/30 and 60/30/10 are
// the run's brief (Live Tourney's example is 70/20/10 after a house take, and here there's no house take).
//
// House rules here:
//  • payout 'top2' (the usual): 70% to first and 30% to second with 4 or more entries, all of it to
//    first with fewer. 'top3': 60/30/10 with 5 or more entries (fewer play as 'top2').
//  • buyBack: a player bought by someone else can buy half of themselves back for half the price. They
//    pay half the bid (here: into the pot, in place of half the owner's bid, which is the same money) and
//    take half of whatever their entry wins.
// Ties share the places they cover: two tied for first split first and second between them.
// Where a spare cent goes (money review, 2026-10-20), always the same way for the same round:
//  • a place's prize: never, since whole-dollar bids at whole-percent splits are whole cents (any
//    remainder would go to first);
//  • a tie: the tied entries share their places' prizes, the spare cents to the one auctioned first
//    ($31 three ways is $10.34, $10.33, $10.33);
//  • a buy-back: the owner takes the odd cent of the half, and a team's half is shared among its
//    players in the team's order, the spare cents to the first.

/** Quick amounts on the auction sheet, in whole dollars (or points). */
export const CALCUTTA_CHIPS = [5, 10, 20, 25, 50, 100];

/** The most one bid can be, in whole dollars (or points): a guard against a slip on the keypad. */
export const CALCUTTA_MAX_BID = 999;

const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D'];
const firstOf = n => String(n || '').trim().split(/\s+/)[0] || '?';

/**
 * What goes up for auction: [{ id, name, players: [pid] }]. One entry a player, or one a team when the
 * round is played in teams (two or more teams and at least one with two or more players). `players` is
 * [{ id, name }]; `teams` is the round's teams ([{ id, name, players }]) or setup's arrays of player ids.
 * A team's entry id is its team id ('t0', 't1', as buildTeams in round.js makes them), so an auction run
 * in setup still finds its teams in the round.
 */
export function calcuttaEntries({ players = [], teams = null } = {}) {
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const list = Array.isArray(teams) ? teams.map((t, i) => (Array.isArray(t)
    ? { id: `t${i}`, name: null, players: t }
    : { id: t?.id ?? `t${i}`, name: t?.name ?? null, players: Array.isArray(t?.players) ? t.players : [] }))
    .map(t => ({ ...t, players: t.players.filter(pid => byId[pid]) })).filter(t => t.players.length) : [];
  if (list.length >= 2 && list.some(t => t.players.length > 1)) {
    return list.map((t, i) => ({
      id: t.id,
      name: t.name || (t.players.length <= 2 ? t.players.map(pid => firstOf(byId[pid].name)).join(' & ') : TEAM_NAMES[i] || `Team ${i + 1}`),
      players: t.players,
    }));
  }
  return players.map(p => ({ id: p.id, name: p.name, players: [p.id] }));
}

/** The split of the pot by place, in whole percent, for `count` entries sold. */
export function calcuttaSplits(count, payout = 'top2') {
  if (count < 2) return [];
  if (payout === 'top3' && count >= 5) return [60, 30, 10];
  if (count >= 4) return [70, 30];
  return [100];
}

/** A sale that counts: a buyer who is in the Calcutta and a bid of a whole dollar or more. */
export function validSale(sale, buyers) {
  if (!sale || typeof sale !== 'object') return false;
  const bid = sale.bid;
  return Number.isInteger(bid) && bid >= 1 && bid <= CALCUTTA_MAX_BID && (!buyers || buyers.includes(sale.buyer));
}

/**
 * The sales that still count for these `entries` and `buyers` (player ids): an auction run in setup can
 * outlive a change of players or teams, and a sale for an entry or a buyer no longer there is dropped.
 */
export function liveSales(sales, entries, buyers) {
  const ids = new Set(entries.map(e => e.id));
  return Object.fromEntries(Object.entries(sales || {}).filter(([id, sale]) => ids.has(id) && validSale(sale, buyers)));
}

/** `cents` shared as evenly as whole cents allow among `n`, the spare cents to the first ones. */
function shareCents(cents, n) {
  if (n <= 0) return [];
  const base = Math.floor(cents / n);
  const spare = cents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < spare ? 1 : 0));
}

const tidy = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null);

/**
 * The Calcutta's money. `entries` from calcuttaEntries, `sales` { entryId: { buyer, bid, back? } },
 * `scores` { entryId: number } with higher better (null for an entry with no finish, which ranks last),
 * `buyers` the player ids in the Calcutta, `started` whether the main game has a hole in (until then
 * nobody has finished anywhere and nothing is paid). Returns
 *   { pot, splits, sold: [{ id, name, players, buyer, bid, back, score, place, tied, prize, owners }],
 *     unsold: [id], paidIn: { pid }, paidOut: { pid }, deltas: { pid } }
 * in dollars (whole cents). `deltas` add to exactly zero. With fewer than two entries sold, nothing moves.
 */
export function calcuttaMoney({ entries = [], sales = {}, scores = {}, buyers = [], payout = 'top2', buyBack = false, started = true } = {}) {
  const ids = [...new Set(buyers)];
  const zero = () => Object.fromEntries(ids.map(id => [id, 0]));
  const inC = zero(), outC = zero();
  const sold = [], unsold = [];
  for (const e of entries) {
    const sale = sales?.[e.id];
    if (!validSale(sale, ids)) { unsold.push(e.id); continue; }
    // Buying back half only means something when the owner isn't one of the entry's own players
    const back = !!buyBack && !!sale.back && !e.players.includes(sale.buyer);
    const backers = back ? e.players.filter(pid => ids.includes(pid)) : [];
    sold.push({ id: e.id, name: e.name, players: e.players, buyer: sale.buyer, bid: sale.bid, back: back && backers.length > 0, backers, score: tidy(scores?.[e.id]) });
  }
  const potC = sold.reduce((a, s) => a + s.bid * 100, 0);
  const splits = calcuttaSplits(sold.length, payout);
  const prizesC = splits.map(p => Math.floor(potC * p / 100));
  if (prizesC.length) prizesC[0] += potC - prizesC.reduce((a, v) => a + v, 0);
  // Every bid is paid in: the owner pays it all, or with a buy-back half, the player(s) the other half
  for (const s of sold) {
    const bidC = s.bid * 100;
    if (s.back) {
      const half = bidC / 2; // a whole dollar bid, so always whole cents
      inC[s.buyer] += bidC - half;
      shareCents(half, s.backers.length).forEach((c, i) => { inC[s.backers[i]] += c; });
    } else inC[s.buyer] += bidC;
  }
  // Places: best score first, entries with no finish last, ties in the order they were auctioned
  const order = sold.map((s, i) => ({ s, i })).sort((a, b) => {
    const x = a.s.score, y = b.s.score;
    if (x == null || y == null) return (x == null) - (y == null) || a.i - b.i;
    return y - x || a.i - b.i;
  }).map(o => o.s);
  let pos = 0;
  while (pos < order.length) {
    let end = pos + 1;
    while (end < order.length && order[end].score === order[pos].score) end++;
    const group = order.slice(pos, end);
    const poolC = started ? prizesC.slice(pos, end).reduce((a, v) => a + v, 0) : 0;
    const each = shareCents(poolC, group.length);
    group.forEach((s, k) => { s.place = pos + 1; s.tied = group.length > 1; s.prizeC = each[k]; });
    pos = end;
  }
  for (const s of sold) {
    const p = s.prizeC || 0;
    s.owners = [];
    if (s.back) {
      const theirs = Math.floor(p / 2);
      outC[s.buyer] += p - theirs;
      s.owners.push({ id: s.buyer, share: 0.5, amount: (p - theirs) / 100 });
      shareCents(theirs, s.backers.length).forEach((c, i) => {
        outC[s.backers[i]] += c;
        s.owners.push({ id: s.backers[i], share: 0.5 / s.backers.length, amount: c / 100 });
      });
    } else {
      outC[s.buyer] += p;
      s.owners.push({ id: s.buyer, share: 1, amount: p / 100 });
    }
    s.prize = p / 100;
    delete s.prizeC;
  }
  const dollars = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / 100 || 0]));
  // Fewer than two sold, or nothing finished yet: the bids are there to see, and nobody owes anything
  const moves = sold.length >= 2 && started;
  const deltas = Object.fromEntries(ids.map(id => [id, moves ? (outC[id] - inC[id]) / 100 || 0 : 0]));
  return {
    pot: potC / 100, splits, sold: order, unsold,
    paidIn: moves ? dollars(inC) : dollars(zero()), paidOut: moves ? dollars(outC) : dollars(zero()), deltas,
  };
}

/** "70/30", "60/30/10", "All to first": the split in words, for `count` entries sold. */
export function splitsLine(count, payout = 'top2') {
  const s = calcuttaSplits(count, payout);
  if (!s.length) return 'Needs two sold';
  if (s.length === 1) return 'All to first';
  return s.join('/');
}

/** "1st", "2nd", "3rd", "4th"; tied places read "T2". */
export function calcuttaPlace(place, tied = false) {
  const n = place;
  const sfx = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return tied ? `T${n}` : `${n}${sfx}`;
}
