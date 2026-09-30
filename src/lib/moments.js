// Big moments in a head-to-head match (Match play and Nassau): the lead changes, it's all square,
// dormie, a nine is won, the match is won early. Pure: no DOM. Unit tested in moments.test.js.
import { matchStatus } from './golf.js';

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
