// A tab for each crew or trip (ROADMAP area 7): the Tab's Everyone view, split by where the money
// came from. Every finished round with money on the Tab sits on exactly one tab: its trip's (a round
// counted for a trip), else the crew everyone else in it belongs to (you're in all your crews, and
// the smallest crew wins when more than one fits), else Other rounds. Each tab has its own fewest
// payments, from just its rounds and the payments for them, and the tabs add up to Everyone, person
// by person, to the cent.
//
// Payments: one tied to a round (its code, or its round id) belongs to that round's tab; one made
// from a crew's tab names the crew (`tab: 'crew:<id>'`); a trip's are the ones Settle the trip counts
// (trips.js tripStatus). A payment from Everyone tied to nothing pays the crews' tabs as they stood
// when it was made, the crew with the oldest round first, up to what the payer owes and the payee
// is owed there, once the trips have counted theirs; and since it paid the two people's net, a tab
// with one owing the other and a tab the other way round are netted against each other (a payment
// that squared rounds shared live does the same with its netted rows). Other rounds is what's left
// of Everyone with the trips and crews taken out, so the tabs always add up to it.
//
// Crews are saved lists on your phone, so a crew's tab is yours alone. The money in it is the same
// money the Tab has, and paying from it squares the rounds shared live on the shared Tab's own rows
// (shared-tab.js squareRows), so a friend's phone sees the payment on its Tab too. Pure, unit tested.
import { fewestPayments, outstanding } from './ledger.js';
import { canonicalOf, codeOf, finishedAt, lockedRounds, nettedId, nettedOn, openByPair, paidOn } from './pair-debts.js';
import { onTab, tabResults } from './play-for.js';
import { tripOfPayment } from './trip-pay.js';
import { tripStatus, tripsOf } from './trips.js';
import { squareRows } from './shared-tab.js';

export const OTHER = 'other';
export const crewKey = id => `crew:${id}`;
export const tripKey = id => `trip:${id}`;

const cents = v => Math.round((Number(v) || 0) * 100);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const moneyRounds = state => Object.values(state.rounds || {}).filter(r => r.status === 'done' && onTab(r));

/**
 * Your crews, each with who's in it (one id a person, you always in it): [{ id, name, members }],
 * smallest first, so a round both a foursome and the whole Saturday group fit counts for the foursome.
 */
export function crewsOf(state) {
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  return Object.values(state.crews || {}).filter(c => c?.id)
    .map(c => {
      const members = new Set((c.playerIds || []).map(who));
      if (me) members.add(me);
      return { id: c.id, name: String(c.name || '').trim() || 'Crew', members };
    })
    .filter(c => c.members.size >= 2)
    .sort((a, b) => a.members.size - b.members.size || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** The crew a round counts for: everyone else who played is in it. Null when no crew fits. */
export function crewOfRound(state, round, crews = crewsOf(state)) {
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const ids = [...new Set((round?.players || []).map(p => who(p.id)))].filter(id => id !== me);
  if (!ids.length) return null;
  return crews.find(c => ids.every(id => c.members.has(id))) || null;
}

/** Which tab a round is on: 'trip:<id>', 'crew:<id>' or 'other'. */
export function tabKeyOf(state, round, { trips = tripsOf(state), crews = crewsOf(state) } = {}) {
  if (round?.trip?.id && trips.has(round.trip.id)) return tripKey(round.trip.id);
  const crew = crewOfRound(state, round, crews);
  return crew ? crewKey(crew.id) : OTHER;
}

/** Each person's net in a list of payments to make, in cents: positive when they're owed. */
export function netsOf(lines) {
  const out = {};
  for (const t of lines) {
    out[t.from] = (out[t.from] || 0) - cents(t.amount);
    out[t.to] = (out[t.to] || 0) + cents(t.amount);
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/**
 * One tab's payments: what's open on its rounds shared live stays between the two people in them
 * (as both phones have it, pair-debts.js), the rest of `bal` (cents) is squared in the fewest
 * payments between people who played one of its rounds, and the two are netted to one line a pair:
 * [{ from, to, amount, shared, local }], with `shared` and `local` in cents, positive from `from` to
 * `to` (a part can run the other way when the pair's net doesn't).
 */
function planOf(state, bal, locked, together) {
  const direct = openByPair(state, locked);
  const rest = { ...bal };
  for (const d of direct) {
    rest[d.from] = (rest[d.from] || 0) + d.cents;
    rest[d.to] = (rest[d.to] || 0) - d.cents;
  }
  const loose = fewestPayments(Object.fromEntries(Object.entries(rest).map(([k, c]) => [k, c / 100])), { canPay: (a, b) => together.has(pairKey(a, b)) });
  const lines = new Map();
  const add = (from, to, part, c) => {
    const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
    const k = `${a}|${b}`;
    const line = lines.get(k) || { a, b, shared: 0, local: 0 };
    line[part] += sign * c;
    lines.set(k, line);
  };
  for (const d of direct) add(d.from, d.to, 'shared', d.cents);
  for (const t of loose) add(t.from, t.to, 'local', cents(t.amount));
  const out = [];
  for (const l of lines.values()) {
    const net = l.shared + l.local;
    if (!net) continue;
    const s = net > 0 ? 1 : -1;
    const [from, to] = s > 0 ? [l.a, l.b] : [l.b, l.a];
    out.push({ from, to, amount: Math.abs(net) / 100, shared: s * l.shared || 0, local: s * l.local || 0 });
  }
  return out.sort((x, y) => y.amount - x.amount || x.from.localeCompare(y.from) || x.to.localeCompare(y.to));
}

/** Pairs who played one of these rounds together. */
function togetherIn(state, rounds) {
  const who = canonicalOf(state);
  const out = new Set();
  for (const r of rounds) {
    const ids = [...new Set(r.players.map(p => who(p.id)))];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.add(pairKey(ids[i], ids[j]));
  }
  return out;
}

/**
 * Everyone and every tab on this phone:
 * - everyone: { lines, balances }: the Tab as it is (ledger.js outstanding), and each person's net in cents.
 * - tabs: [{ key, kind: 'trip' | 'crew' | 'other', id, name, rounds, lines, balances, since, lastAt, status? }],
 *   trips first (each with its tripStatus as `status`), then crews, then Other rounds. `rounds`
 *   are the tab's finished rounds with money, oldest first; `lines` its own fewest payments
 *   (shared and local parts in cents, see planOf; a trip's are Settle the trip's own);
 *   `balances` each person's net on it in cents. Every tab is listed, square ones too.
 * Person by person, the tabs' balances add up to Everyone's.
 */
export function tabsOf(state, { now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const trips = tripsOf(state);
  const crews = crewsOf(state);
  const everyone = outstanding(state, { now });
  const byKey = new Map();
  const roundKey = new Map(), codeKey = new Map();
  for (const r of moneyRounds(state).sort((a, b) => finishedAt(a) - finishedAt(b))) {
    const key = tabKeyOf(state, r, { trips, crews });
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
    roundKey.set(r.id, key);
    const code = codeOf(r);
    if (code && !codeKey.has(code)) codeKey.set(code, key);
  }
  const span = rounds => ({ since: rounds.length ? finishedAt(rounds[0]) : null, lastAt: rounds.length ? finishedAt(rounds.at(-1)) : null });

  // Trips: Settle the trip's own plan (trips.js), so the trip's tab and the trip page always agree
  const tripTabs = [];
  const countedBy = new Map(); // settlement id -> cents a trip counted of it
  for (const id of trips.keys()) {
    const st = tripStatus(state, id, { now });
    if (!st) continue;
    for (const x of st.counted || []) countedBy.set(x.settlement.id, (countedBy.get(x.settlement.id) || 0) + x.cents);
    const lines = st.plan.map(l => ({ from: l.from, to: l.to, amount: l.amount, shared: l.shared, local: l.local + l.plan + l.expense }));
    tripTabs.push({ key: tripKey(id), kind: 'trip', id, name: st.trip.name, rounds: st.money, lines, balances: netsOf(lines), status: st, ...span(st.money) });
  }

  // Crews: their rounds, less the payments for them, taken in the order they happened (rounds by
  // when they finished, payments by when they were made), so a payment only ever pays rounds that
  // were played before it
  const crewTabs = crews.map(c => {
    const rounds = byKey.get(crewKey(c.id)) || [];
    return { key: crewKey(c.id), kind: 'crew', id: c.id, name: c.name, members: c.members, rounds, bal: {}, ...span(rounds) };
  });
  const crewBy = new Map(crewTabs.map(t => [t.key, t]));
  // Other rounds as they stood at each moment, only to see what a payment from Everyone nets
  // across (its own balances at the end are what's left of Everyone, below)
  const otherRun = {};
  const balOf = key => (key === OTHER ? otherRun : crewBy.get(key)?.bal || null);
  const pay = (bal, f, t, c) => { bal[f] = (bal[f] || 0) + c; bal[t] = (bal[t] || 0) - c; };
  const events = [];
  for (const [key, rounds] of byKey) {
    const bal = balOf(key);
    if (!bal) continue; // a trip's rounds are the trip's
    for (const r of rounds) {
      events.push({ at: finishedAt(r), n: 0, id: r.id, run: () => { for (const [id, v] of Object.entries(tabResults(r).balances)) bal[who(id)] = (bal[who(id)] || 0) + cents(v); } });
      // A payment that squared two people's rounds shared live marks the rest of their open
      // transfers netted (shared-tab.js): those rounds' money went against each other, so on this
      // round's tab the netted part counts as paid, and the tabs it netted against even it out
      const code = codeOf(r);
      if (!code) continue;
      for (const t of tabResults(r).transfers) {
        if (!nettedOn(state, code, t)) continue;
        const open = cents(t.amount) - paidOn(state, r, code, t);
        const row = state.tabRows[`${code}|${nettedId(code, t.from, t.to)}`];
        if (open > 0) events.push({ at: row.at || 0, n: 1, id: row.id, run: () => pay(bal, who(t.from), who(t.to), open) });
      }
    }
  }
  for (const s of state.settlements || []) {
    if (tripOfPayment(s)) continue; // Settle the trip's, counted on the trip
    let key;
    if (s.tab) key = crewBy.has(s.tab) ? s.tab : OTHER;
    else if (s.code) key = codeKey.get(s.code) || OTHER;
    else if (s.roundId) key = roundKey.get(s.roundId) || OTHER;
    else { events.push({ at: s.at || 0, n: 1, id: String(s.id), run: () => payLoose(s) }); continue; }
    const bal = balOf(key);
    if (bal) events.push({ at: s.at || 0, n: 1, id: String(s.id), run: () => pay(bal, who(s.from), who(s.to), cents(s.amount)) });
  }
  // A payment from Everyone tied to nothing: what the trips didn't count pays the crews' tabs,
  // the crew with the oldest round first, as far as each has the payer owing and the payee owed
  // then, and the rest is Other rounds'. Paying on Everyone pays the two people's net across all
  // their rounds, so where one tab has the payer owing the payee and another the other way round,
  // the two are netted against each other, the way Everyone did
  const order = [...crewTabs].sort((a, b) => (a.since ?? Infinity) - (b.since ?? Infinity) || a.key.localeCompare(b.key));
  function payLoose(s) {
    const f = who(s.from), t = who(s.to);
    let left = cents(s.amount) - (countedBy.get(s.id) || 0);
    const bals = [...order.map(x => x.bal), otherRun];
    const owing = (bal, a, b) => Math.min(Math.max(0, -(bal[a] || 0)), Math.max(0, bal[b] || 0));
    for (const bal of bals) {
      if (left <= 0) break;
      const c = Math.min(left, owing(bal, f, t));
      if (c <= 0) continue;
      pay(bal, f, t, c);
      left -= c;
    }
    // Everyone passes money on through the group, so a payment can stand for what the payer owes
    // someone on one tab and what that someone owes the payee on another
    for (const p of bals) {
      for (const m of Object.keys(p).sort()) {
        if (left <= 0 || m === f || m === t) continue;
        for (const q of bals) {
          if (left <= 0) break;
          if (q === p) continue;
          const c = Math.min(left, owing(p, f, m), owing(q, m, t));
          if (c <= 0) continue;
          pay(p, f, m, c);
          pay(q, m, t, c);
          left -= c;
        }
      }
    }
    if (left > 0) pay(otherRun, f, t, left);
    for (const p of bals) {
      for (const q of bals) {
        if (p === q) continue;
        const c = Math.min(owing(p, f, t), owing(q, t, f));
        if (c <= 0) continue;
        pay(p, f, t, c);
        pay(q, t, f, c);
      }
    }
  }
  events.sort((a, b) => a.at - b.at || a.n - b.n || a.id.localeCompare(b.id));
  for (const e of events) e.run();
  const locked = new Set(lockedRounds(state, { now }).map(r => r.id));
  const crewOut = crewTabs.map(({ bal, ...t }) => {
    const lines = planOf(state, bal, t.rounds.filter(r => locked.has(r.id)), togetherIn(state, t.rounds));
    for (const k of Object.keys(bal)) if (!bal[k]) delete bal[k];
    return { ...t, lines, balances: bal };
  });

  // Other rounds: whatever of Everyone the trips and crews don't have
  const E = netsOf(everyone);
  const rest = { ...E };
  for (const t of [...tripTabs, ...crewOut]) for (const [id, c] of Object.entries(t.balances)) rest[id] = (rest[id] || 0) - c;
  for (const k of Object.keys(rest)) if (!rest[k]) delete rest[k];
  const otherRounds = byKey.get(OTHER) || [];
  const together = togetherIn(state, moneyRounds(state));
  for (const t of everyone) together.add(pairKey(t.from, t.to));
  const other = { key: OTHER, kind: 'other', id: OTHER, name: 'Other rounds', rounds: otherRounds, lines: planOf(state, rest, otherRounds.filter(r => locked.has(r.id)), together), balances: rest, ...span(otherRounds) };

  return { everyone: { lines: everyone, balances: E }, tabs: [...tripTabs, ...crewOut, other] };
}

/** One tab by key ('crew:<id>', 'trip:<id>' or 'other'), or null. */
export function tabOf(state, key, opts) {
  return tabsOf(state, opts).tabs.find(t => t.key === key) || null;
}

/**
 * The tabs worth a switch on the Tab: a crew with a finished round with money, a trip with money
 * on it (hidden ones only while they have something to settle), and Other rounds once any of those
 * shows and it has rounds or money of its own. Empty when there's only Everyone.
 */
export function switchTabs(all, { hidden = () => false } = {}) {
  const list = all.tabs.filter(t => {
    if (t.kind === 'crew') return t.rounds.length > 0;
    if (t.kind === 'trip') return t.lines.length > 0 || (!hidden(t.id) && (t.status.hasMoney || t.status.expenses.length > 0));
    return false;
  });
  if (!list.length) return [];
  const other = all.tabs.find(t => t.kind === 'other');
  if (other && (other.rounds.length || other.lines.length)) list.push(other);
  return list;
}

/**
 * One line of a crew's tab paid (or marked paid by someone keeping the crew's tab): the part on
 * its rounds shared live squares the pair on those rounds' transfers, rows every phone in them
 * gets, and the part from rounds only this phone has is a payment here that names the crew.
 * Returns { rows, settlements }, empty when the line is gone.
 */
export function crewPayment(state, crewId, from, to, { now = Date.now(), makeId = () => Math.random().toString(36).slice(2, 9), tab = null, line: given = null } = {}) {
  const t = tab || tabOf(state, crewKey(crewId), { now });
  const line = given || t?.lines.find(l => l.from === from && l.to === to);
  if (!t || !line) return { rows: [], settlements: [] };
  const locked = new Set(lockedRounds(state, { now }).map(r => r.id));
  const ids = new Set(t.rounds.filter(r => locked.has(r.id)).map(r => r.id));
  const rows = line.shared ? squareRows(state, line.from, line.to, ids, { now }).rows : [];
  const [lf, lt] = line.local > 0 ? [line.from, line.to] : [line.to, line.from];
  const settlements = line.local ? [{ id: `s_${makeId()}`, from: lf, to: lt, amount: Math.abs(line.local) / 100, at: now, tab: crewKey(crewId) }] : [];
  return { rows, settlements };
}
