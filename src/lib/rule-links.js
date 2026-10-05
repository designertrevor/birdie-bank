// The addresses of the public rule pages and their "Play this now" links: /rules/wolf for Wolf,
// /?play=wolf to open setup with it picked. Its own small file (GAMES and nothing else), so the
// app can read a ?play= link without loading the page builder (rule-pages.js).
import { GAMES, GAME_GROUPS, SIDE_GAMES } from './round.js';

/** Side games that are never a main game, so their page adds them to a round instead. */
export const SIDE_ONLY = Object.keys(SIDE_GAMES).filter(k => !GAMES[k]);

/** Every game with a page: the main games in the order setup shows them, then the side-only ones. */
export const RULE_KEYS = [
  ...GAME_GROUPS.flatMap(g => Object.keys(GAMES).filter(k => GAMES[k].group === g)),
  ...Object.keys(GAMES).filter(k => !GAME_GROUPS.includes(GAMES[k].group)),
  ...SIDE_ONLY,
];

// Clean URLs read as the game's name; keys that already do are used as they are
const SLUGS = {
  match: 'match-play', bestball: 'best-ball', altshot: 'alternate-shot', stroke: 'stroke-play',
  aces: 'aces-and-deuces', bbb: 'bingo-bango-bongo', birdies: 'birdie-pot', ctp: 'closest-to-the-pin', drive: 'long-drive',
};
// Other names people search for, so /?play=junk or a hand-typed /rules link still finds the game
const ALIASES = {
  junk: 'dots', garbage: 'dots', trash: 'dots', hollywood: 'sixes', 'round-robin': 'sixes', foursomes: 'altshot',
  'four-ball': 'bestball', fourball: 'bestball', pinehurst: 'chapman', chicago: 'quota', 'acey-deucey': 'aces',
  'split-sixes': 'nines', '5-3-1': 'nines', bbb: 'bbb', ctp: 'ctp', 'long-drive': 'drive',
};

/** The page's slug for a game key: "wolf", "match-play". */
export const ruleSlug = key => SLUGS[key] || key;

/** The game a slug, key or other name points to ("match-play", "match", "Junk"), or null. */
export function ruleKeyOf(name) {
  const s = String(name ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/\/+$/, '');
  if (!s) return null;
  if (RULE_KEYS.includes(s)) return s;
  const bySlug = RULE_KEYS.find(k => ruleSlug(k) === s);
  if (bySlug) return bySlug;
  return ALIASES[s] && RULE_KEYS.includes(ALIASES[s]) ? ALIASES[s] : null;
}

/** "/rules/wolf", or "/rules" for the index. */
export const rulePath = key => (key ? `/rules/${ruleSlug(key)}` : '/rules');
/** The file the build writes for a page, under dist: a folder with an index.html, so /rules/wolf needs no rewrite. */
export const ruleFile = key => (key ? `rules/${ruleSlug(key)}/index.html` : 'rules/index.html');
/** The link that opens setup with the game picked. */
export const playPath = key => `/?play=${ruleSlug(key)}`;

/**
 * What a "Play this now" link asks for, from the page's address: { game } for a main game,
 * { side } for a side-only game, or null. Read from ?play= (a slug, key or other name).
 */
export function playFromSearch(search) {
  let raw = null;
  try { raw = new URLSearchParams(search || '').get('play'); } catch { return null; }
  const key = ruleKeyOf(raw);
  if (!key) return null;
  return GAMES[key] ? { game: key } : { side: key };
}

/** The game's name as the pages show it. */
export const ruleName = key => GAMES[key]?.name || SIDE_GAMES[key]?.label || key;
