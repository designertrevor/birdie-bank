// Big moments in a head-to-head match (Match play and Nassau): the lead changes, it's all square,
// dormie, a nine is won, the match is won early. Pure: no DOM. Unit tested in moments.test.js.
import { matchStatus, nassauBets } from './golf.js';
import { sideSplit } from './games.js';
import {
  gameKeys, gameResults, gameView, hammerTable, holeComplete, nassauAmounts, nassauWinners, roundLegs, roundResults, settingsAt,
  sideGamesOf, sideNames, sides, sixesMatches, skinsKinds, skinsTable, vegasTable, wolfHoleResult,
} from './round.js';
import { playForOf, rewardNoun, rewardOutcome, unitFmt } from './play-for.js';

// Most exciting first. When several legs move on one hole (the front 9 and the total move together
// on holes 1 to 9), the most exciting one is shown, and the whole match wins a tie.
const RANK = { won: 7, halved: 6, change: 5, dormie: 4, square: 3, lead: 2 };

/**
 * The moment for the hole just scored at playing position `pos`, or null.
 * `winners` maps position to 0, 1 or null (halved) and includes `pos`.
 * `legs` is { key: { start, end, label } } (roundLegs), `names` the two sides' names,
 * `plural` whether each side is a team (for "win" or "wins"), `holeNo` the hole's number on the course.
 * Returns { kind, leg, whole, leader, by, left, level: 'big' | 'medium', title, text }.
 */
export function matchMoment(winners, pos, legs, { names, plural = [false, false], holeNo = pos } = {}) {
  if (winners[pos] === undefined) return null;
  const keys = Object.keys(legs);
  const wholeKey = keys.includes('match') ? 'match' : 'total';
  const found = [];
  for (const key of keys) {
    const l = legs[key];
    if (pos < l.start || pos > l.end) continue;
    const before = matchStatus({ ...winners, [pos]: undefined }, l.start, l.end);
    const after = matchStatus(winners, l.start, l.end);
    if (before.done) continue; // already decided: later holes don't change it
    const kind = momentKind(winners, pos, l, before, after);
    if (kind) found.push({ key, kind, before, after });
  }
  if (!found.length) return null;
  found.sort((a, b) => RANK[b.kind] - RANK[a.kind] || (b.key === wholeKey) - (a.key === wholeKey));
  const { key, kind, after } = found[0];
  const whole = key === wholeKey;
  // Nassau says which bet moved ("on the back 9"); a single match doesn't need to
  const on = keys.length > 1 ? ` on the ${legs[key].label.replace(/^[A-Z]/, c => c.toLowerCase())}` : '';
  const leg = legs[key].label.replace(/^[A-Z]/, c => c.toLowerCase());
  const who = after.leader == null ? null : names[after.leader];
  const other = after.leader == null ? null : names[1 - after.leader];
  const s = i => (plural[i] ? '' : 's'); // "Trevor wins", "Sam & Dave win"
  const up = `${after.by} up`;
  const base = { kind, leg: key, whole, leader: after.leader, by: after.by, left: after.left };
  if (kind === 'won') {
    const score = after.left > 0 ? `${after.by}&${after.left}` : up;
    return whole
      ? { ...base, level: 'big', title: `${who} win${s(after.leader)} the match`, text: score }
      : { ...base, level: 'medium', title: `${who} win${s(after.leader)} the ${leg}`, text: score };
  }
  if (kind === 'halved') return { ...base, level: 'medium', title: `The ${leg} is halved`, text: 'All square at the end, so nobody wins it' };
  if (kind === 'change') return { ...base, level: 'medium', title: 'Lead change', text: `${who} ${plural[after.leader] ? 'go' : 'goes'} ${up}${on}` };
  if (kind === 'dormie') return { ...base, level: 'medium', title: 'Dormie', text: `${who} ${plural[after.leader] ? 'are' : 'is'} ${up} with ${after.left} to play${on}. ${other} ${plural[1 - after.leader] ? 'have' : 'has'} to win every hole.` };
  if (kind === 'square') return { ...base, level: 'medium', title: 'All square', text: `${names[winners[pos]]} win${s(winners[pos])} hole ${holeNo} to square it${on}` };
  return { ...base, level: 'medium', title: `${who} take${s(after.leader)} the lead`, text: `${up}${on}` };
}

function momentKind(winners, pos, l, before, after) {
  if (after.done) return after.leader == null ? 'halved' : 'won';
  if (after.dormie && !before.dormie) return 'dormie';
  if (after.leader == null && before.leader != null) return 'square';
  if (after.leader != null && before.leader == null) {
    // Who led last, before it went back to all square: the other side means the lead changed hands
    let last = null;
    for (let p = l.start; p < pos; p++) {
      const st = matchStatus(winners, l.start, p);
      if (st.leader != null) last = st.leader;
    }
    return last != null && last !== after.leader ? 'change' : 'lead';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Big moments in every game: a skin won (bigger when it ends a long carry), a lone or blind wolf,
// a big Vegas swing, the money lead changing hands, and who won the round once every hole is in.
// At most one per hole: roundMoment() gathers what the hole made and shows the most exciting one.

/** Most exciting first. A whole match won takes the full screen; everything else is a banner. */
export const PRIORITY = {
  won: 100, final: 95, sixtriple: 92, bigskin: 90, sixsweep: 88, blindwolf: 85, hammerback: 84, banksweep: 82, lonewolf: 80,
  sixwon: 78, bankbust: 76, swing: 75, bankbirdie: 74, bankbig: 72, wolfdown: 70, fold: 68,
  // The match moments keep their own order (RANK above) among themselves
  nine: 65, hammer: 62, halved: 60, sixhalved: 58, change: 55, dormie: 50, square: 45, money: 40, lead: 35, skinlost: 30, skin: 20,
};
/** A carry this long (skins carried into the hole) makes the skin a bigger moment. */
export const BIG_CARRY = 3;
/** A Vegas hole this many points apart is a big swing. */
export const VEGAS_SWING = 20;
const EPS = 0.005;
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';

/** The playing positions with every score in, as a list: [1, 2, 3, 5]. */
export function donePositions(round) {
  return round.holes.map((h, i) => (holeComplete(round, h) ? i + 1 : null)).filter(Boolean);
}

/**
 * Which hole, if any, earns a moment now that the scored holes went from `before` to `after`
 * (lists of playing positions). Only one new hole counts: a burst of holes (a phone catching up, or
 * opening the round) is quiet, and so is an edit (no new hole). The newest hole in play gets its
 * moment, except the last one: finishing plays the Final results reveal, which says who won. Filling
 * in a skipped hole is quiet too, unless it's the one that completes the round: the round won't
 * finish on its own then, so it says who won. Returns { pos, final } or null.
 */
export function freshHole(round, before, after) {
  if (!round || round.status !== 'active' || round.editing) return null;
  const was = new Set(before);
  const fresh = after.filter(p => !was.has(p));
  if (fresh.length !== 1) return null;
  const pos = fresh[0];
  const n = round.holes.length;
  if (after.length === n) return pos === n ? null : { pos, final: true };
  if (pos === n || after.some(p => p > pos)) return null;
  return { pos, final: false };
}

/** Whether a moment was already shown on this phone (`shown` is a Set kept for the session), marking it if not. */
export function firstShowing(shown, roundId, pos) {
  const key = `${roundId}:${pos}`;
  if (shown.has(key)) return false;
  shown.add(key);
  return true;
}

/** How exciting a moment is (PRIORITY): a Nassau nine won ranks below a whole match won. */
export const rankOf = m => Math.max(m.boost ?? 0, m.kind === 'won' && !m.whole ? PRIORITY.nine : PRIORITY[m.kind] ?? 0);

/** The most exciting of a hole's moments, or null. Ties go to the first found. */
export function pickMoment(list) {
  let best = null;
  for (const m of list) if (m && (!best || rankOf(m) > rankOf(best))) best = m;
  return best;
}

/** The unit a round reads in: "$12" for money, "12 pts" for points and reward rounds. */
function fmtOf(round) { return unitFmt(round); }

/** Who leads the round's money: one player, or a whole team level at the top. Null when nobody leads alone. */
export function moneyLeader(round, balances) {
  const ids = round.players.map(p => p.id);
  const top = Math.max(...ids.map(id => balances[id] || 0));
  if (!(top > EPS)) return null;
  const tops = ids.filter(id => top - (balances[id] || 0) < EPS);
  if (tops.length === 1) return { key: tops[0], ids: tops, name: first(round.players.find(p => p.id === tops[0])?.name), plural: false, amount: top };
  const team = round.teams?.find(t => t.players.length === tops.length && t.players.every(id => tops.includes(id)));
  return team ? { key: tops.slice().sort().join(','), ids: tops, name: team.name, plural: true, amount: top } : null;
}

/** The round with only the holes up to playing position `pos` scored. */
function through(round, pos) {
  const r = { ...round, scores: { ...round.scores }, marks: { ...(round.marks || {}) } };
  round.holes.forEach((h, i) => { if (i + 1 > pos) { delete r.scores[h.no]; delete r.marks[h.no]; } });
  return r;
}

/**
 * The money lead changed hands on the hole at `pos`, or someone took the round's first lead:
 * "Ann takes the lead, up $12". Keeping your own lead (or retaking it after going level) is quiet.
 */
export function moneyMoment(round, pos) {
  const after = moneyLeader(round, roundResults(round).balances);
  if (!after) return null;
  // Who led last before this hole: straight before it, or before the round went level at the top
  let last = null;
  for (let p = pos - 1; p >= 1 && !last; p--) last = moneyLeader(round, roundResults(through(round, p)).balances);
  if (last?.key === after.key) return null;
  const pf = playForOf(round);
  const up = `Up ${fmtOf(round)(after.amount)}`;
  const text = pf.kind === 'reward' ? `${up}, in line for ${rewardNoun(pf.reward)}` : `${up} on the round`;
  return { kind: 'money', hero: after.key, title: `${after.name} take${after.plural ? '' : 's'} the lead`, text };
}

/**
 * A skin won on the hole at `pos`, in the main game or a side Skins game. The biggest if there are two
 * kinds. With Validate skins, a skin just won says what keeps it, and a skin that didn't hold on this
 * hole (its winner missed net par) is a moment of its own when nobody wins the hole.
 */
export function skinsMoment(round, pos) {
  let best = null, lost = null;
  for (const key of gameKeys(round)) {
    const view = gameView(round, key);
    if (!view || view.game !== 'skins' || !view.settings.skins) continue;
    const kinds = skinsKinds(view);
    for (const kind of kinds) {
      const rows = skinsTable(view, kind).rows;
      const row = rows[pos - 1];
      const prev = rows[pos - 2];
      if (prev?.lost && (!lost || prev.lostSkins > lost.skins)) lost = { who: prev.lost, skins: prev.lostSkins || 1, kind, kinds };
      if (!row?.winner) continue;
      if (best && best.skins >= row.skins) continue;
      const pot = view.settings.skins.payout === 'pot';
      const amount = pot ? 0 : row.parts.reduce((a, p) => a + p.worth * p.payers.length, 0);
      best = { row, kind, kinds, pot, amount, skins: row.skins };
    }
  }
  const nameOf = id => first(round.players.find(p => p.id === id)?.name);
  if (!best) {
    if (!lost) return null;
    const of = lost.kinds.length > 1 ? `${lost.kind} ` : '';
    const text = lost.skins === 1 ? `No net par, so the ${of}skin goes back in the carry` : `No net par, so ${lost.skins} ${of}skins go back in the carry`;
    return { kind: 'skinlost', hero: null, title: `${nameOf(lost.who)} didn’t hold it`, text };
  }
  const { row, kind, kinds, pot, amount, skins } = best;
  const who = nameOf(row.winner);
  const of = kinds.length > 1 ? `${kind} ` : '';
  const carried = skins - 1;
  const title = skins === 1 ? `${who} wins the ${of}skin` : `${who} takes ${skins} ${of}skins`;
  const worth = pot ? `${skins} ${skins === 1 ? 'share' : 'shares'} of the pot` : fmtOf(round)(amount);
  const next = round.holes[pos]?.no;
  const keep = row.pending && next != null ? `. Net par on ${next} keeps ${skins === 1 ? 'it' : 'them'}` : '';
  const text = carried >= BIG_CARRY ? `${worth}. That ends a ${carried}-hole carry${keep}` : `${worth}${keep}`;
  return { kind: carried >= BIG_CARRY ? 'bigskin' : 'skin', hero: row.winner, title, text, ...(keep ? { keep } : {}) };
}

/** A lone or blind wolf on the hole at `pos`: one that wins, or one the pack gets. */
export function wolfMoment(round, pos) {
  const main = gameView(round, 'main');
  if (main.game !== 'wolf') return null;
  const hole = round.holes[pos - 1];
  const r = hole && wolfHoleResult(main, hole);
  if (!r || r.winner == null || r.teamA.length !== 1) return null;
  const id = r.teamA[0];
  const who = first(round.players.find(p => p.id === id)?.name);
  const amt = fmtOf(round)(Math.abs(r.deltas[id]));
  if (r.winner === 'wolf') {
    return r.blind
      ? { kind: 'blindwolf', hero: id, title: 'Blind wolf wins', text: `${who} went blind and takes ${amt} off the pack` }
      : { kind: 'lonewolf', hero: id, title: 'Lone wolf wins', text: `${who} takes ${amt} off the pack` };
  }
  return { kind: 'wolfdown', hero: null, title: `The pack gets the ${r.blind ? 'blind ' : ''}wolf`, text: `${who} went ${r.blind ? 'blind' : 'lone'} and pays ${amt}` };
}

/** A Vegas hole won by VEGAS_SWING points or more: "Ann & Bo win it 34 to 56, $22 each". */
export function vegasMoment(round, pos) {
  const main = gameView(round, 'main');
  if (main.game !== 'vegas' || round.teams?.length !== 2) return null;
  const row = vegasTable(main)[pos - 1];
  if (!row?.played || Math.abs(row.diff) < VEGAS_SWING) return null;
  const w = row.diff > 0 ? 0 : 1; // the lower number wins
  const team = round.teams[w];
  const each = fmtOf(round)(Math.abs(row.diff) * row.point);
  const flip = row.flipped[1 - w] ? 'A birdie flips it. ' : '';
  // Birdies double (house rule): say why the hole paid 2× or 3×
  const mult = row.mult === 3 ? ', tripled for the eagle:' : row.mult === 2 ? ', doubled for the birdie:' : ',';
  return {
    kind: 'swing', hero: team.players.slice().sort().join(','), title: 'Big Vegas swing',
    text: `${flip}${team.name} win it ${row.numbers[w]} to ${row.numbers[1 - w]}${mult} ${each} each`,
  };
}

/** Match play and Nassau: matchMoment() for the hole at `pos`, with the round's names and what's still in play. */
export function matchRoundMoment(round, pos) {
  const main = gameView(round, 'main');
  if (main.game !== 'match' && main.game !== 'nassau') return null;
  const winners = nassauWinners(main);
  const m = matchMoment(winners, pos, roundLegs(main), {
    names: sideNames(round).map(n => (round.teams ? n : first(n))),
    plural: sides(main).map(s => !!round.teams && s.length > 1),
    holeNo: round.holes[pos - 1]?.no ?? pos,
  });
  if (!m) return null;
  if (m.level === 'big') {
    // What's still in play after the match is won: presses and side games keep going
    const bets = nassauBets(winners, main.presses || [], nassauAmounts(main), roundLegs(main));
    m.more = bets.some(b => !b.status.done) || sideGamesOf(round).length > 0;
    m.left = round.holes.filter(h => !holeComplete(round, h)).length;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Sixes, Banker and Hammer (overnight 6). Each reads the money straight from gameResults() or the
// game's own table, so a banner never shows an amount the Tab doesn't.

/** A Banker hole that moves this many default bets for the banker is a big one. */
export const BANKER_BIG = 4;
const pairName = (round, ids) => ids.map(id => first(round.players.find(p => p.id === id)?.name)).join(' & ');
const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/**
 * Sixes: one of the six-hole matches is won (with holes to spare, or swept without losing a hole), a
 * player wins all three with three partners, or a match is halved (and its bet carries, with the house
 * rule). Over 9 holes the matches are three holes each, so they read as "threes". With "every hole
 * pays", a match only counts when its last hole is in. `heroes` is the winning pair.
 */
export function sixesMoment(round, pos) {
  const main = gameView(round, 'main');
  if (main.game !== 'sixes' || main.players.length !== 4) return null;
  const matches = sixesMatches(main);
  const i = matches.findIndex(m => pos >= m.seg.start && pos <= m.seg.end);
  const m = matches[i];
  if (!m || m.off || m.winners[pos] === undefined) return null;
  const ms = settingsAt(main, m.seg.start).sixes;
  const holesMode = ms.mode === 'holes';
  const before = matchStatus({ ...m.winners, [pos]: undefined }, m.seg.start, m.seg.end);
  const after = m.status;
  // A match is decided once it can't be caught; with every hole paying, only when its last hole is in
  if (holesMode ? after.left > 0 : before.done || !after.done) return null;
  const len = m.seg.end - m.seg.start + 1;
  const label = `${['first', 'middle', 'last'][i]} ${len === 6 ? 'six' : WORDS[len]?.toLowerCase() || len}`;
  const fmt = fmtOf(round);
  const detail = gameResults(main).detail.matches[i];
  // Holes each side won in this match
  const won = [0, 1].map(side => Object.values(m.winners).filter(w => w === side).length);
  if (after.leader == null || (holesMode && !detail.net)) {
    if (holesMode) return { kind: 'sixhalved', title: `The ${label} is split`, text: `${won[0]} holes each, so nobody wins it` };
    const next = matches[i + 1];
    if (ms.carry && next && !next.off) {
      return { kind: 'sixhalved', title: `The ${label} is halved`, text: `${fmt(ms.stake + (detail.carried || 0))} carries into the next ${len === 6 ? 'six' : 'match'}` };
    }
    return { kind: 'sixhalved', title: `The ${label} is halved`, text: 'All square at the end, so nobody wins it' };
  }
  const w = after.leader;
  const heroes = m.sides[w];
  const who = pairName(round, heroes);
  const each = `${fmt(Math.abs(detail.net))} each`;
  const lost = won[1 - w];
  if (holesMode) {
    return lost === 0
      ? { kind: 'sixsweep', heroes, title: `${who} sweep the ${label}`, text: `Won ${won[w]} holes and lost none: ${each}` }
      : { kind: 'sixwon', heroes, title: `${who} take the ${label}`, text: `${won[w]} holes to ${lost}: ${each}` };
  }
  // Three for three: one player won every match, each with a different partner
  const triple = i === 2 && heroes.find(pid => matches.every(x => x.status.done && x.status.leader != null && x.sides[x.status.leader].includes(pid)));
  if (triple) {
    return { kind: 'sixtriple', heroes: [triple], hero: triple, title: `${first(round.players.find(p => p.id === triple)?.name)} goes 3 for 3`, text: `Won every match with every partner. ${each} on this one` };
  }
  const score = after.left > 0 ? `${after.by}&${after.left}` : `${after.by} up`;
  const carry = detail.carried ? ` with the ${fmt(detail.carried)} carry` : '';
  if (lost === 0 && after.by >= 2) {
    return { kind: 'sixsweep', heroes, title: `${who} sweep the ${label}`, text: `${score} and ${pairName(round, m.sides[1 - w])} never won a hole: ${each}${carry}` };
  }
  const spare = after.left > 0 ? ` with ${after.left} to spare` : '';
  return { kind: 'sixwon', heroes, title: `${who} win the ${label}${spare}`, text: `${score}: ${each}${carry}` };
}

/**
 * Banker: the banker beats every bet on the hole (or loses every one), a birdie or eagle doubles a bet
 * that lands, or the hole moves BANKER_BIG default bets or more for the banker, in that order. The
 * amounts are the game's own results for the hole.
 */
export function bankerMoment(round, pos) {
  const main = gameView(round, 'main');
  const hole = round.holes[pos - 1];
  if (main.game !== 'banker' || !hole) return null;
  const h = gameResults(main).detail.holes.find(x => x.no === hole.no);
  if (!h) return null;
  const nameOf = id => first(round.players.find(p => p.id === id)?.name);
  const fmt = fmtOf(round);
  const bank = h.banker, bk = nameOf(bank);
  const bets = h.matchups;
  const take = h.deltas[bank] || 0;
  const birdies = bets.filter(x => x.birdie > 1 && x.result !== 'push');
  const bankBirdie = birdies.filter(x => x.result === 'loss');
  if (bets.length >= 2 && bets.every(x => x.result === 'loss')) {
    const how = bankBirdie.length ? `, and a birdie doubles it: ${fmt(take)}` : `: ${fmt(take)}`;
    return { kind: 'banksweep', hero: bank, title: `${bk} sweeps the table`, text: `Beat all ${bets.length} as banker${how}` };
  }
  if (bets.length >= 2 && bets.every(x => x.result === 'win')) {
    return { kind: 'bankbust', hero: null, title: 'The table beats the bank', text: `All ${bets.length} beat ${bk}, who pays out ${fmt(-take)}` };
  }
  if (birdies.length) {
    // The banker's own birdie doubles every bet it beats; else the biggest player birdie
    const eagle = (bankBirdie.length ? bankBirdie : birdies).some(x => x.birdie >= 4);
    const word = eagle ? 'eagle doubles it twice' : 'birdie doubles it';
    const title = eagle ? 'Eagle double' : 'Birdie double';
    if (bankBirdie.length) {
      const amt = bankBirdie.reduce((a, x) => a + x.amount, 0);
      const off = bankBirdie.length === 1 ? nameOf(bankBirdie[0].pid) : `${bankBirdie.length} players`;
      return { kind: 'bankbirdie', hero: bank, title, text: `${bk}’s ${word}: ${fmt(amt)} off ${off}` };
    }
    const top = birdies.reduce((a, x) => (x.amount > a.amount ? x : a));
    return { kind: 'bankbirdie', hero: top.pid, title, text: `${nameOf(top.pid)}’s ${word}: ${fmt(top.amount)} off ${bk}` };
  }
  const base = settingsAt(main, pos).banker?.defaultBet || 0;
  if (!(base > 0) || Math.abs(take) < BANKER_BIG * base - EPS) return null;
  const dbl = bets.some(x => x.mult > 1) ? ' with the doubles' : '';
  return take > 0
    ? { kind: 'bankbig', hero: bank, title: 'Big banker hole', text: `${bk} banks ${fmt(take)}${dbl}` }
    : { kind: 'bankbig', hero: null, title: 'Big banker hole', text: `${bk} pays out ${fmt(-take)} as banker${dbl}` };
}

/**
 * Hammer: a hammer back (two or more on one hole, played out), a fold (the hole goes at the value before
 * the last hammer), or a single hammer taken and won. A halved hole with one hammer is quiet.
 * Amounts are what each player on the winning side takes, with the uneven-sides split.
 */
export function hammerMoment(round, pos) {
  const main = gameView(round, 'main');
  if (main.game !== 'hammer') return null;
  const row = hammerTable(main)[pos - 1];
  const n = row?.hammers.length || 0;
  if (!row || !n || row.winner === undefined) return null;
  const sd = sides(main);
  const team = !!main.teams;
  const names = sideNames(main).map(x => (team ? x : first(x)));
  const s = i => (team && sd[i].length > 1 ? '' : 's');
  const heroOf = i => sd[i].slice().sort().join(',');
  const fmt = fmtOf(round);
  const amtFor = (i, value) => {
    const [a, b] = sideSplit(value, sd[0].length, sd[1].length, i);
    return `${fmt(Math.abs(i === 0 ? a : b))}${sd[i].length > 1 ? ' each' : ''}`;
  };
  if (row.conceded != null) {
    const f = row.conceded, t = 1 - f;
    return { kind: 'fold', hero: heroOf(t), title: `${names[f]} fold${s(f)}`, text: `${names[t]} take${s(t)} the hole for ${amtFor(t, row.value)}, half what it was playing for` };
  }
  const w = row.winner;
  if (n >= 2) {
    const title = n === 2 ? 'Hammer back' : `${WORDS[n] || n} hammers`;
    const how = n === 2 ? `${names[row.hammers[0]]} hammered, ${names[row.hammers[1]]} hammered back` : 'Hammered back and forth';
    const end = w == null ? 'and it’s halved' : `and ${names[w]} win${s(w)} it: ${amtFor(w, row.value)}`;
    return { kind: 'hammerback', hero: w == null ? null : heroOf(w), boost: n >= 3 ? PRIORITY.sixsweep : 0, title, text: `${how}, ${end}` };
  }
  if (w == null) return null;
  const thrower = row.hammers[0];
  return w === thrower
    ? { kind: 'hammer', hero: heroOf(w), title: 'The hammer lands', text: `${names[w]} hammered and win${s(w)} it: ${amtFor(w, row.value)}` }
    : { kind: 'hammer', hero: heroOf(w), title: 'Hammer taken', text: `${names[w]} took the hammer and win${s(w)} it: ${amtFor(w, row.value)}` };
}

/** Every hole scored: who won the round, for when it doesn't finish on its own (a skipped hole filled in last). */
export function finalMoment(round) {
  const res = roundResults(round);
  const pf = playForOf(round);
  const nudge = 'Every hole’s in. Finish the round to settle up';
  if (pf.kind === 'reward') return { kind: 'final', title: rewardOutcome(round, res).win.replace(/\.$/, ''), text: nudge };
  const lead = moneyLeader(round, res.balances);
  if (!lead) return { kind: 'final', title: 'All square at the top', text: nudge };
  return { kind: 'final', title: `${lead.name} win${lead.plural ? '' : 's'} the round`, text: `Up ${fmtOf(round)(lead.amount)}. ${nudge}` };
}

/**
 * The one moment for the hole just scored at playing position `pos`, or null: the most exciting of
 * everything the hole made (PRIORITY). When a skin, a wolf or a Vegas swing also puts its winner in
 * the money lead, that banner says so ("$12, and the lead") and ranks as high as the lead change would.
 * Returns { kind, title, text, level, id, ... } (`level` 'big' only for a whole match won early).
 */
export function roundMoment(round, pos) {
  const found = [
    matchRoundMoment(round, pos), skinsMoment(round, pos), wolfMoment(round, pos), vegasMoment(round, pos),
    sixesMoment(round, pos), bankerMoment(round, pos), hammerMoment(round, pos),
  ].filter(Boolean);
  let lead = moneyMoment(round, pos);
  const same = lead && found.find(m => m.hero && m.hero === lead.hero);
  // A Sixes pair: one of the two takes the round's lead with the match ("$5 each. Ann takes the lead")
  const pair = lead && !same && found.find(m => m.heroes?.includes(lead.hero));
  if (same) {
    // "$15, and the lead. Net par on 14 keeps it": what keeps a validated skin stays last
    const body = same.keep ? same.text.slice(0, -same.keep.length) : same.text;
    Object.assign(same, { text: `${body}, and the lead${same.keep || ''}`, boost: Math.max(same.boost || 0, PRIORITY.money) });
    lead = null;
  } else if (pair) {
    Object.assign(pair, { text: `${pair.text}. ${lead.title}`, boost: Math.max(pair.boost || 0, PRIORITY.money) });
    lead = null;
  }
  const top = pickMoment([...found, lead]);
  if (!top) return null;
  const m = { level: 'medium', ...top };
  return { ...m, id: `${pos}:${m.kind}${m.leg ? `:${m.leg}` : ''}` };
}
