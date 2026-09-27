// What's on the line in a game: a one-line summary and a sanity check on its options.
import { money } from './golf.js';

/** Why a game's options can't be used as they stand, or null when they're fine. */
export function optionsProblem(game, settings) {
  if (game === 'banker') {
    const b = settings.banker || {};
    if (b.min > b.max || b.defaultBet < b.min || b.defaultBet > b.max) return 'Default bet has to sit between the minimum and maximum.';
  }
  return null;
}

/** One line that says what's on the line, for menus and summaries. */
export function stakeSummary(game, settings) {
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
    case 'snake': return `${money(s.snake.stake)} ${s.snake.growth === 'grow' ? 'a three-putt' : s.snake.growth === 'double' ? 'a snake, doubling' : 'a snake'}${s.snake.nines ? ' · each nine' : ''}`;
    case 'wolf': return `${money(s.wolf.point)} a point · lone wolf ${s.wolf.loneMultiplier}×`;
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
    default: return '';
  }
}
