// The round so far, hole by hole, for the group's live view (components/LiveMoney.jsx) and a
// friend's round: one line per scored hole saying what happened, newest first, and what the next
// hole is worth. Built from the match moments (moments.js) and the money each hole moved
// (livePreview), so it says what the banners said when the hole was saved. Display only.
import { cardOnly, holeComplete, livePreview, roundResults, scorers, skinsKinds, skinsTable } from './round.js';
import { roundMoment } from './moments.js';
import { scoreName } from './golf.js';
import { countsMoney, unitFmt } from './play-for.js';

const first = name => (name || '').split(' ')[0];

/** The round with only the holes up to playing position `pos` scored (and their marks). */
export function upTo(round, pos) {
  const r = { ...round, scores: { ...round.scores }, marks: { ...(round.marks || {}) } };
  round.holes.forEach((h, i) => { if (i + 1 > pos) { delete r.scores[h.no]; delete r.marks[h.no]; } });
  return r;
}

/** The best score on a hole when it's under par: "Ann birdied", "Ann and Bo birdied", "Cy made an eagle". */
function scoringLine(round, hole) {
  const s = round.scores[hole.no] || {};
  const units = scorers(round, hole).filter(u => typeof s[u.id] === 'number');
  if (!units.length) return null;
  const low = Math.min(...units.map(u => s[u.id]));
  if (low >= hole.par) return null;
  const who = units.filter(u => s[u.id] === low).map(u => (u.team ? u.name : first(u.name)));
  const names = who.length > 2 ? `${who.length} players` : who.join(' and ');
  const name = scoreName(low, hole.par);
  if (name === 'Birdie') return `${names} birdied`;
  return `${names} made ${name === 'Hole in one' ? 'a hole in one' : `an ${name.toLowerCase()}`}`;
}

/**
 * Every scored hole, newest first: [{ no, pos, par, title, text, winners, amount, moved }]. `title`
 * is the moment's headline when the hole made one ("Ann takes 2 skins"), else what happened in plain
 * words; `text` the detail; `winners` who the hole paid most and `amount` how much (0 when nothing
 * moved). The holes' amounts add up to the round's balances (the tests check it).
 */
export function holeStory(round) {
  if (cardOnly(round)) return [];
  const fmt = unitFmt(round);
  const word = countsMoney(round) ? 'money' : 'points';
  const out = [];
  round.holes.forEach((hole, i) => {
    if (!holeComplete(round, hole)) return;
    const pos = i + 1;
    const r = upTo(round, pos);
    const delta = livePreview(r, hole).delta;
    const best = Math.max(0, ...round.players.map(p => delta[p.id] || 0));
    const winners = best > 0 ? round.players.filter(p => delta[p.id] === best).map(p => p.id) : [];
    const team = round.teams?.find(t => t.players.length === winners.length && t.players.every(id => winners.includes(id)));
    const who = team ? team.name : winners.map(id => first(round.players.find(p => p.id === id)?.name)).join(' & ');
    const m = roundMoment(r, pos);
    const scored = scoringLine(round, hole);
    let title, text;
    if (m) {
      title = m.title;
      // The amount already sits at the end of the line, so the moment's text drops it when it leads with it
      const amt = fmt(best);
      text = best > 0 && m.text.startsWith(amt) ? m.text.slice(amt.length).replace(/^, and the lead/, 'Takes the lead').replace(/^[.,]\s*/, '') : m.text;
      if (text) text = text[0].toUpperCase() + text.slice(1);
    }
    else if (best > 0) { title = `${who} ${fmt(best, { sign: true })}`; text = scored ? `${scored}.` : ''; }
    else {
      const carries = round.game === 'skins' && round.settings?.skins?.carryover !== false;
      title = scored ? `${scored}` : carries ? 'Tied, so it carries' : `No ${word} moved`;
      text = scored ? (carries ? 'Tied, so it carries.' : `No ${word} moved.`) : '';
    }
    out.push({ no: hole.no, pos, par: hole.par, title, text, winners, amount: best, delta, moved: best > 0 });
  });
  return out.reverse();
}

/**
 * The hole being played next and, in Skins, what it's worth: { hole, pos, worth } or null when every
 * hole is in. `worth` is "2 skins · $12" (the carry counted), or null for other games.
 */
export function nextUp(round) {
  const i = round.holes.findIndex(h => !holeComplete(round, h));
  if (i < 0) return null;
  const hole = round.holes[i];
  let worth = null, carried = 0;
  if (round.game === 'skins' && round.settings?.skins) {
    const fmt = unitFmt(round);
    const cfg = round.settings.skins;
    const pot = cfg.payout === 'pot';
    const kinds = skinsKinds(round);
    worth = kinds.map(kind => {
      const t = skinsTable(round, kind);
      const row = t.rows.find(r => r.hole.no === hole.no);
      const n = row?.pot ?? 1;
      carried = Math.max(carried, n - 1);
      const tag = kinds.length > 1 ? `${kind === 'net' ? 'Net' : 'Gross'} ` : '';
      return pot ? `${tag}${n} skin${n > 1 ? 's' : ''}` : `${tag}${n} skin${n > 1 ? 's' : ''} · ${fmt(row?.purse ?? t.value * (round.players.length - 1))}`;
    }).join(' · ');
  }
  return { hole, pos: i + 1, worth, carried };
}

/** Everyone's money now, best first, with the biggest amount either way for the race's bars. */
export function moneyRace(round) {
  const res = roundResults(round);
  const rows = res.standings.map(p => ({ id: p.id, name: p.name, amount: p.amount }));
  const most = Math.max(0, ...rows.map(r => Math.abs(r.amount)));
  return { rows: rows.map(r => ({ ...r, share: most ? Math.abs(r.amount) / most : 0 })), most };
}
