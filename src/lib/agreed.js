// The first-tee rules card: everything the group agreed before hole 1, in plain words, and what
// changed after. Trips that argue on day one argue all weekend, so it's settled on the first tee.
//
// round.agreed (absent on older rounds, which never show the card):
//   { at, by, hole, gimmes, mulligans, seen, changes }  locked in: `at` the time, `by` the player id of
//     the phone that locked it (null when unknown), `hole` the hole it was locked on when that was
//     after the first tee (else null), `gimmes` and `mulligans` the group's calls (recorded,
//     never scored), `seen` the agreement as last recorded ([{ id, label, text, on }], for spotting
//     changes) and `changes` what changed after, [{ hole, text, at }].
//   { skipped }  the card was skipped (the time). It can still be locked in from the round menu.
// It lives in the round's meta, so it syncs to every phone in a shared round. Only the phone keeping
// score locks it or records changes (see keeper.js).
import { GAMES, gameKeyLabel, gameKeys, holesPlayed, sideGamesOf } from './round.js';
import { sideBetLine, stakeSummary } from './stakes.js';
import { inUnits } from './play-for.js';
import { gamePct, halfStrokesOn } from './allowances.js';
import { houseRulesLine } from './house-rules.js';

export const GIMMES = [
  { value: 'none', label: 'None', text: 'None. Everything gets putted out.' },
  { value: 'leather', label: 'Inside the leather', text: 'Inside the leather' },
  { value: 'keeper', label: 'Keeper’s call', text: 'The scorekeeper’s call' },
];
export const MULLIGANS = [
  { value: 'none', label: 'None', text: 'None' },
  { value: 'nine', label: '1 a nine', text: 'One a nine' },
  { value: 'round', label: '1 a round', text: 'One a round' },
];
const textOf = (list, v) => (list.find(o => o.value === v) || list[0]).text;

const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';
const strokesText = n => (!n ? 'scratch' : `${n} stroke${Math.abs(n) === 1 ? '' : 's'}`);

/**
 * A game's house rules, on or off: [{ id, text, on }]. The card lists the ones that are on; a change
 * mid-round says which one went on or off. Options that set the bet itself are in the bet line.
 */
export function houseRulesFor(game, s) {
  if (!s) return [];
  const r = (id, text, on) => ({ id, text, on: !!on });
  switch (game) {
    case 'skins': return [
      // Net is the usual, so only gross (or both) is worth saying
      r('kind', { net: 'Net skins', gross: 'Gross skins', both: 'Net and gross skins' }[s.kind || 'net'] || 'Net skins', (s.kind || 'net') !== 'net'),
      r('carryover', 'Carryovers', s.carryover),
      r('lastCarry', { void: 'A carry left after the last hole goes unclaimed', split: 'A carry left after the last hole is split', playoff: 'A carry left after the last hole is played off' }[s.lastCarry || 'void'], s.carryover),
      r('canadian', 'Canadian skins (a natural birdie beats a net one)', s.canadian && s.kind !== 'gross'),
      r('validate', 'Validate skins (net par on the next hole keeps a skin)', s.validate),
    ];
    case 'nassau': return [
      r('turnPress', 'Press at the turn', s.turnPress),
      r('noLastPress', 'No press on the last hole', s.noLastPress && s.pressMode !== 'off'),
    ];
    case 'banker': return [
      r('ties', 'Ties go to the banker', s.ties === 'banker'),
      r('birdies', s.birdies === 'net' ? 'Net birdies double' : 'Birdies double', s.birdies && s.birdies !== 'off'),
    ];
    case 'wolf': return [
      r('lone', `Lone wolf ${s.loneMultiplier ?? 2}×`, true),
      r('blind', `Blind wolf ${s.blindMultiplier ?? 3}×`, s.blind),
      r('carry', 'Tied holes carry to the next one won', s.carry),
    ];
    case 'hammer': return [r('who', 'Only the side behind throws the first hammer', s.who === 'trailing')];
    case 'vegas': return [r('birdieFlip', 'Birdie flip', s.birdieFlip), r('birdieDouble', 'Birdies double, eagles triple', s.birdieDouble)];
    case 'sixes': return [r('carry', 'A halved match carries to the next', s.carry && s.mode !== 'holes')];
    case 'scramble': return [r('drives', `${s.drives} drives each`, s.drives)];
    case 'stroke': return [r('cap', 'Net double bogey max', s.cap)];
    case 'nines': return [r('sweep', 'Win a hole by 2 and take all 9', s.sweep)];
    case 'aces': return [r('carry', 'Ties carry', s.carry)];
    case 'bbb': return [r('sweep', 'All three on one hole count double', s.sweep)];
    case 'dots': return [r('auto', 'Birdies count as junk', s.auto)];
    case 'snake': return [r('nines', 'A snake for each nine', s.nines)];
    default: return [];
  }
}

/** Presses as set, for a game that has them ('' when it doesn't). */
export function pressesText(round) {
  const s = round.settings?.[round.game];
  if (!s || !('pressMode' in s) || (round.game !== 'nassau' && round.game !== 'match')) return '';
  const down = `${s.threshold || 2} down`;
  return { off: 'No presses', manual: `Press when ${down}`, auto: `Auto press at ${down}` }[s.pressMode] || 'No presses';
}

/** A game's settings block: the main game's, or a side game's own. */
function blockOf(round, key) {
  return key === 'main' ? round.settings?.[round.game] : sideGamesOf(round).find(sg => sg.game === key)?.settings;
}

/**
 * Everything agreed, as items: [{ id, group, label, text, on? }]. Groups: 'strokes', 'bets', 'rules'
 * (with `on`) and 'calls' (gimmes, mulligans, presses). `choices` are the gimmes and mulligans, from
 * round.agreed unless given.
 */
export function agreementItems(round, choices = round.agreed) {
  const items = [];
  if (!round.useHandicaps) items.push({ id: 'strokes', group: 'strokes', label: 'Strokes', text: 'None, it’s gross' });
  else {
    if ((round.hcPct ?? 100) !== 100) items.push({ id: 'hcPct', group: 'strokes', label: 'Handicaps', text: `${round.hcPct}% of each` });
    // A side game at its own %, and half strokes, are agreed up front like the rest
    for (const sg of round.sideGames || []) {
      if (sg && gamePct(round, sg.game) !== gamePct(round)) items.push({ id: `hcPct:${sg.game}`, group: 'strokes', label: gameKeyLabel(round, sg.game), text: `${gamePct(round, sg.game)}% of each` });
    }
    if (halfStrokesOn(round)) items.push({ id: 'half', group: 'strokes', label: 'Half strokes', text: 'Each stroke counts as half' });
    for (const p of round.players) items.push({ id: `strokes:${p.id}`, group: 'strokes', label: firstName(p.name), text: strokesText(p.plays) });
  }
  for (const key of gameKeys(round)) {
    const block = blockOf(round, key);
    const game = key === 'main' ? round.game : key;
    const label = gameKeyLabel(round, key);
    // Skins and Wolf keep their house rules out of the bet line, since they're listed as rules below
    const full = key === 'main' ? stakeSummary(game, round.settings) : sideBetLine(game, block);
    // The newer house rules' tags come off the bet line too, since they're listed as rules
    const tags = houseRulesLine(game, block);
    const bet = game === 'skins' || game === 'wolf' ? full.split(' · ')[0] : tags && full.endsWith(` · ${tags}`) ? full.slice(0, -(tags.length + 3)) : full;
    items.push({ id: `bet:${key}`, group: 'bets', label, text: inUnits(round, bet) });
    for (const h of houseRulesFor(game, block)) items.push({ id: `rule:${key}:${h.id}`, group: 'rules', label, text: h.text, on: h.on });
  }
  const presses = pressesText(round);
  if (presses) items.push({ id: 'presses', group: 'calls', label: 'Presses', text: presses });
  items.push({ id: 'gimmes', group: 'calls', label: 'Gimmes', text: textOf(GIMMES, choices?.gimmes) });
  items.push({ id: 'mulligans', group: 'calls', label: 'Mulligans', text: textOf(MULLIGANS, choices?.mulligans) });
  return items;
}

/** Whether the rules card is locked in. */
export function isLocked(round) {
  return !!round?.agreed?.at;
}

/** Lock it in: the agreement as it stands, with the group's gimmes and mulligans. */
export function lockAgreement(round, { gimmes = 'none', mulligans = 'none' } = {}, by = null, now = Date.now()) {
  const choices = { gimmes, mulligans };
  const seen = agreementItems(round, choices).map(({ id, label, text, on }) => (on === undefined ? { id, label, text } : { id, label, text, on }));
  // Locked in from the round menu after some holes were played: say on which hole
  const hole = holesPlayed(round).length ? round.holes[Math.min(round.current ?? 0, round.holes.length - 1)]?.no ?? null : null;
  return { at: now, by, hole, gimmes, mulligans, seen, changes: [] };
}

/** Whether the keeper's phone should put the card up: a live round with no hole scored and nothing agreed or skipped yet. */
export function showFirstTee(round) {
  return !!round && round.status === 'active' && !round.editing && !round.agreed && !holesPlayed(round).length
    && !Object.values(round.scores || {}).some(s => s && Object.values(s).some(v => v != null));
}

// "$5 a skin" -> 5, for "raised" or "lowered"
const amountOf = t => { const m = String(t).match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };

/** One change in words: "Skins raised to $5 a skin", "Skins: Validate skins ... on", "Dave joins, 4 strokes". */
export function changeText(before, after) {
  if (!before) {
    if (after.id.startsWith('strokes:')) return `${after.label} joins, ${after.text}`;
    if (after.id.startsWith('bet:')) return `${after.label} added: ${after.text}`;
    if (after.id.startsWith('rule:')) return after.on ? `${after.label}: ${after.text}` : null;
    return `${after.label}: ${after.text}`;
  }
  if (!after) {
    if (before.id.startsWith('bet:')) return `${before.label} dropped`;
    if (before.id.startsWith('strokes:')) return `${before.label} is out`;
    return null;
  }
  if (after.id.startsWith('rule:')) {
    // The last carry only matters with carryovers, which say so themselves
    if (!after.on && after.id.endsWith(':lastCarry')) return null;
    if (!!before.on !== !!after.on) return `${after.label}: ${after.on ? after.text : `${before.text}, off`}`;
    if (before.text !== after.text && after.on) return `${after.label}: ${after.text}`;
    return null;
  }
  if (before.text === after.text) return null;
  if (after.id.startsWith('bet:')) {
    const [a, b] = [before.text.split(' · '), after.text.split(' · ')];
    const [x, y] = [amountOf(a[0]), amountOf(b[0])];
    if (x != null && y != null && x !== y && a.slice(1).join() === b.slice(1).join()) return `${after.label} ${y > x ? 'raised' : 'lowered'} to ${b[0]}`;
    return `${after.label} now ${after.text}`;
  }
  if (after.id.startsWith('strokes:')) return `${after.label} now gets ${after.text === 'scratch' ? 'no strokes' : after.text}`;
  return `${after.label}: ${after.text}`;
}

/**
 * What changed since the agreement was last recorded, as a new round.agreed with the changes listed
 * against the hole the group is on, or null when nothing changed (or nothing is locked in).
 */
export function noteChanges(round, now = Date.now()) {
  const agreed = round?.agreed;
  if (!isLocked(round) || !Array.isArray(agreed.seen)) return null;
  const cur = agreementItems(round).map(({ id, label, text, on }) => (on === undefined ? { id, label, text } : { id, label, text, on }));
  const was = new Map(agreed.seen.map(x => [x.id, x]));
  const is = new Map(cur.map(x => [x.id, x]));
  const texts = [];
  for (const x of cur) {
    const was1 = was.get(x.id);
    if (was1 && was1.text === x.text && !!was1.on === !!x.on) continue;
    const t = changeText(was1, x);
    if (t) texts.push(t);
  }
  for (const x of agreed.seen) if (!is.has(x.id)) { const t = changeText(x, null); if (t) texts.push(t); }
  const same = agreed.seen.length === cur.length && cur.every(x => { const w = was.get(x.id); return w && w.text === x.text && !!w.on === !!x.on && w.label === x.label; });
  if (same) return null;
  const hole = round.holes?.[Math.min(round.current ?? 0, round.holes.length - 1)]?.no ?? 1;
  return { ...agreed, seen: cur, changes: [...(agreed.changes || []), ...texts.map(text => ({ hole, text, at: now }))] };
}

/** "Hole 7: Skins raised to $5 a skin". */
export function changeLine(c) {
  return `Hole ${c.hole}: ${c.text}`;
}

/** Who locked it in, in words: "Locked in by Mike", "You locked it in" (on their phone) or "Locked in". */
export function lockedBy(round, me = null) {
  const by = round.agreed?.by;
  if (by != null && by === me) return 'You locked it in';
  const p = round.players?.find(x => x.id === by);
  return p ? `Locked in by ${firstName(p.name)}` : 'Locked in';
}

/** The game's name, for the card's heading. */
export function roundGameName(round) {
  return GAMES[round.game]?.name || 'the game';
}
