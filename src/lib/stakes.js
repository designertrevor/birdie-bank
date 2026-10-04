// What's on the line in a game: a one-line summary and a sanity check on its options.
import { money } from './golf.js';
import { POT_NAMES, betChanges, blindMultiplierOf, gameKeyLabel, sideGamesOf } from './round.js';
import { inUnits, pointsLines } from './play-for.js';
import { houseRulesLine } from './house-rules.js';

/** Why a game's options can't be used as they stand, or null when they're fine. */
export function optionsProblem(game, settings) {
  if (game === 'banker') {
    const b = settings.banker || {};
    if (b.min > b.max || b.defaultBet < b.min || b.defaultBet > b.max) return 'Default bet has to sit between the minimum and maximum.';
  }
  if (game === 'birdies' && !(settings.birdies?.stake > 0)) return 'Each player has to put something in the birdie pot.';
  if ((game === 'ctp' || game === 'drive') && !(settings[game]?.stake > 0)) return 'Each player has to put something in the pot.';
  return null;
}

/**
 * The bet line for a side game in setup and the round menu: "$2 a skin", "$1 a dot",
 * "$5 each in the birdie pot". `settings` is the side game's own block.
 */
export function sideBetLine(game, settings) {
  if (game === 'birdies') return `${money(settings?.stake ?? 0)} each in the birdie pot`;
  // Named, so a round with a pot as its main game and both side pots doesn't read "each in the pot" three times
  if (game === 'ctp' || game === 'drive') return `${money(settings?.stake ?? 0)} each in the ${POT_NAMES[game]}`;
  // The bet in its own unit ("$2 a skin"); the worked example under it covers the house rules
  return stakeSummary(game, { [game]: settings }).split(' · ')[0];
}

/**
 * Every game's bets in a round, main first: [{ key, line }]. Side games use their own settings,
 * and a side game whose bet changed mid-round says since when: "$3 a skin from hole 10".
 * A points or reward round reads in points ("5 pts a side"), side games included.
 */
export function roundStakeLines(round, { since = true } = {}) {
  return pointsLines(round, moneyStakeLines(round, since));
}

// `since` false leaves off "from hole 10", for a round set up again with the bets it ended on
function moneyStakeLines(round, since = true) {
  const lines = [{ key: 'main', line: stakeSummary(round.game, round.settings) }];
  for (const sg of sideGamesOf(round)) {
    const line = sideBetLine(sg.game, sg.settings);
    const from = line && since ? betChanges(round, sg.game).at(-1) : null;
    if (line) lines.push({ key: sg.game, line: from ? `${line} from hole ${from.no}` : line });
  }
  return lines;
}

/** A game's bet line from its own settings block: the main game's summary, or a side game's line. */
function betLineFor(round, key, block) {
  return key === 'main' ? stakeSummary(round.game, { ...round.settings, [round.game]: block }) : sideBetLine(key, block);
}

/**
 * A short note for a game whose bet changed mid-round, for the by-game table: "bet changed from
 * hole 10", or "bet changed on holes 5 and 12". '' when it never changed.
 */
export function betChangeNote(round, key) {
  const nos = betChanges(round, key).map(c => c.no);
  if (!nos.length) return '';
  if (nos.length === 1) return `bet changed from hole ${nos[0]}`;
  return `bet changed on holes ${nos.slice(0, -1).join(', ')} and ${nos.at(-1)}`;
}

/**
 * What each stretch of a game was played for, when its bet changed mid-round:
 * "Skins: $2 a skin on holes 1–9, $3 a skin from hole 10." '' when it never changed.
 */
export function betStretchLine(round, key) {
  const changes = betChanges(round, key);
  if (!changes.length) return '';
  const hist = key === 'main' ? round.betHistory : sideGamesOf(round).find(sg => sg.game === key)?.betHistory;
  const now = key === 'main' ? round.settings[round.game] : sideGamesOf(round).find(sg => sg.game === key)?.settings;
  const noAt = pos => round.holes[pos - 1]?.no ?? pos;
  const parts = hist.map((e, i) => {
    const start = i ? hist[i - 1].upto + 1 : 1;
    const holes = start === e.upto ? `hole ${noAt(start)}` : `holes ${noAt(start)}–${noAt(e.upto)}`;
    return `${betLineFor(round, key, e.settings)} on ${holes}`;
  });
  parts.push(`${betLineFor(round, key, now)} from hole ${changes.at(-1).no}`);
  // A points or reward round reads in points, like its other bet lines
  return inUnits(round, `${gameKeyLabel(round, key)}: ${parts.join(', ')}.`);
}

/** One line that says what's on the line, for menus and summaries. */
export function stakeSummary(game, settings) {
  const rules = houseRulesLine(game, settings?.[game]);
  const base = baseSummary(game, settings);
  return rules ? `${base} · ${rules}` : base;
}

function baseSummary(game, settings) {
  const s = settings;
  switch (game) {
    case 'banker': return `${money(s.banker.defaultBet)} default bet · ${money(s.banker.min)}–${money(s.banker.max)}`;
    case 'nassau': return `${money(s.nassau.front)} / ${money(s.nassau.back)} / ${money(s.nassau.total)}`;
    case 'skins': {
      const k = s.skins.kind === 'both' ? ' · net and gross' : s.skins.kind === 'gross' ? ' · gross' : '';
      if (s.skins.payout === 'pot') return `${money(s.skins.stake ?? s.skins.value)} each in the pot${k}`;
      return `${money(s.skins.value)} a skin${s.skins.carryover ? ' · carryovers' : ''}${k}`;
    }
    case 'hammer': return `${money(s.hammer.stake)} a hole · ${s.hammer.max ? `up to ${s.hammer.max} hammer${s.hammer.max === 1 ? '' : 's'}` : 'no limit'}`;
    case 'snake': return `${money(s.snake.stake)} ${s.snake.growth === 'grow' ? 'a three-putt' : s.snake.growth === 'double' ? `a snake, doubling${s.snake.cap ? ` to ${money(s.snake.stake * 2 ** s.snake.cap)}` : ''}` : 'a snake'}${s.snake.nines ? ' · each nine' : ''}`;
    // A no-break space keeps "blind 3×" together when the line wraps on a phone
    case 'wolf': return `${money(s.wolf.point)} a point · lone wolf\u00a0${s.wolf.loneMultiplier}×${s.wolf.blind ? ` · blind\u00a0${blindMultiplierOf(s.wolf)}×` : ''}`;
    case 'match': return `${money(s.match.stake)} a player`;
    case 'vegas': return `${money(s.vegas.point)} a point`;
    case 'sixes': return `${money(s.sixes.stake)} ${s.sixes.mode === 'holes' ? 'a hole up' : 'a match'}`;
    case 'scramble': return `${money(s.scramble.stake)} each in the pot`;
    case 'stroke': return s.stroke.payout === 'pot' ? `${money(s.stroke.stake)} each in the pot` : `${money(s.stroke.stake)} a stroke`;
    case 'stableford': return s.stableford.payout === 'pot' ? `${money(s.stableford.stake)} each in the pot` : `${money(s.stableford.stake)} a point`;
    case 'quota': return s.quota.payout === 'pot' ? `${money(s.quota.stake)} each in the pot` : `${money(s.quota.stake)} a point`;
    case 'nines': return `${money(s.nines.point)} a point`;
    case 'aces': return `${money(s.aces.ace)} ace · ${money(s.aces.deuce)} deuce`;
    case 'bbb': return `${money(s.bbb.value)} a point`;
    case 'dots': return `${money(s.dots.value)} a dot`;
    case 'rabbit': return `${money(s.rabbit.stake)} a rabbit`;
    case 'birdies': return `${money(s.birdies.stake)} each in the birdie pot`;
    case 'ctp': case 'drive': return `${money(s[game].stake)} each in the ${POT_NAMES[game]}`;
    default: return '';
  }
}

/**
 * The bet in its own unit, without the house rules: "$2 a skin", "$1 a point", "$5 a side".
 * The first part of the summary line, except a Nassau with the same bet on every leg reads "a side".
 */
export function stakeHeadline(game, settings) {
  const n = game === 'nassau' ? settings.nassau : null;
  if (n && n.front === n.back && n.back === n.total) return `${money(n.front)} a side`;
  return stakeSummary(game, settings).split(' · ')[0];
}
