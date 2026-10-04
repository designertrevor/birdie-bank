// What the newer share cards say: the recap, trip standings and the cup, plus the text that goes
// with a challenge. Each card is drawn in the results image's style (share-cards-image.js), and each
// comes with plain text for the group thread and alt text for the image.
//
// Every model is plain strings, worked out here and tested in share-cards.test.js:
//  • `showAmounts` comes from share.js amountsRule: with it off no dollar figure appears anywhere
//    (the order, the points, the moments and who's square still read). Points never hide.
//  • Names, never "You": the card goes to the group, so it reads the same to everyone in it.
//  • Who's paid is a count, never who owes: nobody gets called out in the group text.
//  • Nothing here changes any amount: it only reads the rounds, the trip and the cup.
import { roundResults } from './round.js';
import { gameLabel, roundDate } from './format.js';
import { money } from './golf.js';
import { nameOf } from './ledger.js';
import { countsMoney, points } from './play-for.js';
import { recapOf } from './recap.js';
import { shareCardModel } from './shareImage.js';
import { tripDates } from './trips.js';
import { cupHeadline, cupPoints } from './cup.js';
import { HOLES_LABEL, challengeAsk, challengeState } from './challenges.js';
import { cleanBetLabel } from './pair-bets.js';
import { dayLabel } from './plans.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';
const list = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const MONEY = /\$/;
/** "birdie-bank.vercel.app/?join=AB12" for the image's footer: the link without its https://. */
export const shortUrl = url => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Places that share on equal values: [10, 10, 3] is 1, 1, 3. */
function placesOf(values) {
  let place = 0;
  return values.map((v, i) => { if (i === 0 || v !== values[i - 1]) place = i + 1; return place; });
}

/**
 * The alt text for any card made here: what it says, in order, as one paragraph. The image's
 * words and its alt text come from the same model, so a hidden amount is hidden from both.
 */
export function cardAlt(kind, m) {
  const parts = [`${kind}: ${[m.title, m.meta].filter(Boolean).join(', ')}`];
  if (m.teams?.length) parts.push(m.teams.map(t => `${t.name} ${t.points}`).join(', '));
  parts.push([m.headline, m.sub].filter(Boolean).join(' '));
  if (m.accent) parts.push(m.accent);
  if (m.rows.length) parts.push(m.rows.map(r => `${r.place}. ${r.name}${r.value ? ` ${r.value}` : ''}`).join(', '));
  for (const s of m.sections) if (s.lines.length) parts.push(`${s.label}: ${s.lines.join('; ')}`);
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.');
}

/** The card as text for the group thread (the link is added when it's shared). */
export function cardText(m) {
  const lines = [[m.title, m.meta].filter(Boolean).join(' · ')];
  if (m.teams?.length) lines.push(m.teams.map(t => `${t.name} ${t.points}`).join(', '));
  lines.push([m.headline, m.sub].filter(Boolean).join(' '));
  if (m.accent) lines.push(m.accent);
  if (m.rows.length) { lines.push(''); for (const r of m.rows) lines.push(`${r.place}. ${r.name}${r.value ? ` ${r.value}` : ''}`); }
  for (const s of m.sections) if (s.lines.length) { lines.push('', `${s.label}:`); lines.push(...s.lines); }
  return lines.join('\n').trim();
}

// --------------------------- the recap --------------------------------------

/**
 * The recap card for a finished round: who took it and the order (the results card's own words),
 * a moment or two, and who's square as a count. A moment that names an amount drops its line with
 * amounts off, keeping its title.
 */
export function recapCardModel(state, round, { showAmounts = false, now = Date.now(), link = null } = {}) {
  const res = roundResults(round);
  const show = countsMoney(round) ? showAmounts : true;
  const base = shareCardModel(round, res, { showAmounts: show });
  const rc = recapOf(state, round, now);
  const moments = rc.moments.map(m => (show || !MONEY.test(m.text) ? `Hole ${m.hole}: ${m.title}. ${m.text}` : `Hole ${m.hole}: ${m.title}`));
  const paid = rc.paid;
  const rolled = rc.carried.length;
  const sq = [];
  if (paid) sq.push(paid.allSquare ? 'Everyone’s square' : `${paid.square} of ${paid.total} square`);
  if (rolled) sq.push(rolled === 1 ? 'One rolled to next time' : `${rolled} rolled to next time`);
  const m = {
    eyebrow: 'The recap',
    title: round.course?.name || 'The round',
    meta: `${roundDate(round)} · ${gameLabel(round)}`,
    headline: base.headline, sub: base.sub, big: base.big,
    accent: base.reward,
    rows: base.standings.map(p => ({ place: p.place, name: p.name, value: p.amount, sign: p.sign })),
    sections: [
      { label: 'Moments', lines: moments },
      { label: 'Who’s paid', lines: sq },
    ].filter(s => s.lines.length),
    footer: shortUrl(link) || 'See the whole round in the app',
  };
  return { ...m, alt: cardAlt('Recap', m) };
}

// --------------------------- trip standings ---------------------------------

/**
 * Trip standings for the group: everyone's money across the trip's rounds (the cup stake in it once
 * decided), or their points on a trip played for points, best first, with the cup's score when
 * there is one. `st` is trips.js tripStatus.
 */
export function tripCardModel(state, st, { showAmounts = false, link = null } = {}) {
  const { trip } = st;
  const byPoints = !st.standings.length && !!st.points;
  const rowsIn = byPoints
    ? Object.entries(st.points).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id))
    : st.standings.map(p => ({ id: p.id, v: p.amount }));
  const show = byPoints ? true : showAmounts;
  const fmt = byPoints ? points : money;
  const places = placesOf(rowsIn.map(r => r.v));
  const rows = rowsIn.map((r, i) => ({ place: places[i], name: nameOf(state, r.id), value: show ? fmt(r.v, { sign: true }) : null, sign: Math.sign(r.v) }));
  const over = st.phase === 'ready' || st.phase === 'square';
  const top = rowsIn[0];
  const tops = top ? rowsIn.filter(r => r.v === top.v) : [];
  let headline, sub = '';
  if (!rowsIn.length) headline = st.done.length ? 'Played for rewards' : 'Nothing played yet';
  else if (rowsIn.every(r => Math.abs(r.v) < 0.005)) headline = 'All square';
  else {
    const names = tops.map(r => first(nameOf(state, r.id)));
    headline = tops.length > 1 ? `${list(names)} ${over ? 'top the trip' : 'lead'}` : `${names[0]} ${over ? 'takes the trip' : 'leads'}`;
    if (show) sub = `${fmt(top.v, { sign: true })}${tops.length > 1 ? ' each' : ''}`;
  }
  const rounds = st.done.length;
  const m = {
    eyebrow: over ? 'That’s the trip' : 'Trip standings',
    title: trip.name,
    meta: [tripDates(trip), trip.where, rounds ? `${rounds} round${rounds === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
    headline, sub, big: !!sub && !byPoints,
    accent: byPoints ? 'Played for points' : null,
    rows: rows.slice(0, 10),
    sections: [
      ...(st.cup ? [{ label: 'The cup', lines: [cupHeadline(st.cup)] }] : []),
      ...(rows.length > 10 ? [{ label: 'And', lines: [`${rows.length - 10} more on the trip`] }] : []),
    ],
    footer: shortUrl(link) || trip.name,
  };
  return { ...m, alt: cardAlt('Trip standings', m) };
}

// --------------------------- the cup ----------------------------------------

/**
 * The cup's scoreboard: each team's points, the headline, the stake (a dollar figure, so only with
 * amounts on), and the leaderboard's points (never money, so they always show). `cup` is
 * trips.js cupStatus.
 */
export function cupCardModel(state, trip, cup, { showAmounts = false, link = null } = {}) {
  const [a, b] = cup.score.points;
  const lead = a > b ? 0 : b > a ? 1 : null;
  const board = cup.leaderboard;
  const places = placesOf(board.map(p => p.points));
  const live = cup.score.live.length;
  const stake = cup.def.stake > 0 ? (showAmounts ? `${money(cup.def.stake)} a person on the cup` : 'Something’s on the cup') : null;
  const m = {
    eyebrow: cup.final ? 'The cup is decided' : 'The cup',
    title: trip.name,
    meta: [tripDates(trip), `${cup.score.done} match${cup.score.done === 1 ? '' : 'es'} played`, live ? `${live} in play` : ''].filter(Boolean).join(' · '),
    teams: [0, 1].map(i => ({ name: cup.names[i], points: cupPoints(cup.score.points[i]), lead: lead === i, won: cup.final && cup.winner === i })),
    headline: cupHeadline(cup), sub: '', big: false,
    accent: stake,
    rows: board.slice(0, 8).map((p, i) => ({
      place: places[i], name: p.id ? nameOf(state, p.id) : p.name, team: p.team,
      value: `${cupPoints(p.points)} pt${p.points === 1 ? '' : 's'}`, sign: 0, sub: `${p.won}-${p.lost}-${p.halved}`,
    })),
    sections: board.length > 8 ? [{ label: 'And', lines: [`${board.length - 8} more on the leaderboard`] }] : [],
    footer: shortUrl(link) || '1 point a win, ½ a halved match',
  };
  return { ...m, alt: cardAlt('Cup scoreboard', m) };
}

// --------------------------- a challenge ------------------------------------

/**
 * A challenge for the group thread (not the invite to the one challenged, which has its own words):
 * "Dave challenged Mike to a $20 match on Saturday. Mike's in." With amounts off the stake is
 * left out ("to a match"); points always show.
 */
export function challengeGroupText(ch, { showAmounts = false, now = Date.now() } = {}) {
  const s = challengeState(ch);
  const show = ch.unit === 'points' ? true : showAmounts;
  const plain = { match: 'a match', hole: 'a bet a hole', ctp: 'closest to the pin', custom: cleanBetLabel(ch.label) || 'a side bet' }[ch.kind] || 'a side bet';
  const what = show ? challengeAsk(ch) : plain;
  const day = ch.plan ? dayLabel(ch.plan.date, new Date(now)) : null;
  const when = day ? (day === 'Today' || day === 'Tomorrow' ? ` ${day.toLowerCase()}` : ` on ${day}`) : ' next time they play';
  const holes = ch.holes !== 'all' ? ` on the ${HOLES_LABEL[ch.holes].toLowerCase()}` : '';
  const a = first(ch.from.name), b = first(ch.to.name);
  const by = k => first((k === 'keeper' ? ch.setBy : ch[k])?.name || b);
  const lead = ch.setBy
    ? `${first(ch.setBy.name)} set up ${a} v ${b}, ${what}${holes}${when}.`
    : `${a} challenged ${b} to ${what}${holes}${when}.`;
  const tail = s.status === 'on' ? 'It’s on in the round.'
    : s.status === 'accepted' ? 'It’s on.'
    : s.status === 'declined' ? `${by(s.by)} passed this time.`
    : s.status === 'off' ? 'It’s off.'
    : s.status === 'countered' ? `${by(s.by)} came back with ${show ? challengeAsk(ch, s.stake) : 'another amount'}.`
    : s.turn === 'both' ? `Waiting on ${a} and ${b}.`
    : `Waiting on ${first(ch[s.turn]?.name || b)}.`;
  return `${lead} ${tail}`;
}
