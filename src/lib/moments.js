// Big moments in a head-to-head match (Match play and Nassau): the lead changes, it's all square,
// dormie, a nine is won, the match is won early. Pure: no DOM. Unit tested in moments.test.js.
import { matchStatus, nassauBets } from './golf.js';
import {
  gameKeys, gameView, holeComplete, nassauAmounts, nassauWinners, roundLegs, roundResults, sideGamesOf, sideNames, sides,
  skinsKinds, skinsTable, vegasTable, wolfHoleResult,
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
  if (kind === 'square') return { ...base, level: 'medium', title: 'All square', text: `${names[winners[pos]]} win${s(winners[pos])} ${holeNo} to square it${on}` };
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
  won: 100, final: 95, bigskin: 90, blindwolf: 85, lonewolf: 80, swing: 75, wolfdown: 70,
  // The match moments keep their own order (RANK above) among themselves
  nine: 65, halved: 60, change: 55, dormie: 50, square: 45, money: 40, lead: 35, skin: 20,
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

/** The money lead changed hands on the hole at `pos`: "Ann takes the lead, up $12". */
export function moneyMoment(round, pos) {
  const after = moneyLeader(round, roundResults(round).balances);
  if (!after) return null;
  // Who led last before this hole: straight before it, or before the round went level at the top
  let last = null;
  for (let p = pos - 1; p >= 1 && !last; p--) last = moneyLeader(round, roundResults(through(round, p)).balances);
  if (!last || last.key === after.key) return null;
  const pf = playForOf(round);
  const up = `Up ${fmtOf(round)(after.amount)}`;
  const text = pf.kind === 'reward' ? `${up}, in line for ${rewardNoun(pf.reward)}` : `${up} on the round`;
  return { kind: 'money', hero: after.key, title: `${after.name} take${after.plural ? '' : 's'} the lead`, text };
}

/** A skin won on the hole at `pos`, in the main game or a side Skins game. The biggest if there are two kinds. */
export function skinsMoment(round, pos) {
  let best = null;
  for (const key of gameKeys(round)) {
    const view = gameView(round, key);
    if (!view || view.game !== 'skins' || !view.settings.skins) continue;
    const kinds = skinsKinds(view);
    for (const kind of kinds) {
      const row = skinsTable(view, kind).rows[pos - 1];
      if (!row?.winner) continue;
      if (best && best.skins >= row.skins) continue;
      const pot = view.settings.skins.payout === 'pot';
      const amount = pot ? 0 : row.parts.reduce((a, p) => a + p.worth * p.payers.length, 0);
      best = { row, kind, kinds, pot, amount, skins: row.skins };
    }
  }
  if (!best) return null;
  const { row, kind, kinds, pot, amount, skins } = best;
  const who = first(round.players.find(p => p.id === row.winner)?.name);
  const of = kinds.length > 1 ? `${kind} ` : '';
  const carried = skins - 1;
  const title = skins === 1 ? `${who} wins the ${of}skin` : `${who} takes ${skins} ${of}skins`;
  const worth = pot ? `${skins} ${skins === 1 ? 'share' : 'shares'} of the pot` : fmtOf(round)(amount);
  const text = carried >= BIG_CARRY ? `${worth}. That ends a ${carried}-hole carry` : worth;
  return { kind: carried >= BIG_CARRY ? 'bigskin' : 'skin', hero: row.winner, title, text };
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
  return {
    kind: 'swing', hero: team.players.slice().sort().join(','), title: 'Big Vegas swing',
    text: `${flip}${team.name} win it ${row.numbers[w]} to ${row.numbers[1 - w]}, ${each} each`,
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
  const found = [matchRoundMoment(round, pos), skinsMoment(round, pos), wolfMoment(round, pos), vegasMoment(round, pos)].filter(Boolean);
  let lead = moneyMoment(round, pos);
  const same = lead && found.find(m => m.hero && m.hero === lead.hero);
  if (same) {
    Object.assign(same, { text: `${same.text}, and the lead`, boost: PRIORITY.money });
    lead = null;
  }
  const top = pickMoment([...found, lead]);
  if (!top) return null;
  const m = { level: 'medium', ...top };
  return { ...m, id: `${pos}:${m.kind}${m.leg ? `:${m.leg}` : ''}` };
}
