// "Just playing, no bet": a no-pressure way into a round for a friend who doesn't want to compete.
// They're on the card and their scores count for the group's scorecard and to-par, but they're out
// of every game, side game and side bet, have nothing on the Tab, get no nudges, moments or callouts
// aimed at them, and finish on a friendly "Nice round" with their score instead of a money reveal.
// The engine side (round.justPlaying, bettingRound) is in round.js; this is the setup rules and the
// words. Pure, unit tested in just-playing-ui.test.js.
import { GAMES, MAX_SIDE_PLAYERS, anyJustPlaying, bettors, cardOnly, isJustPlaying, oneBall, parOf } from './round.js';
import { first, plural } from './nice-round.js';

// The tag and the friendly finish are in nice-round.js, so a round's row on Up next reads them alone
export { JUST_PLAYING_TAG, niceRound } from './nice-round.js';

/** The seat's name on the Players step, the add-a-player sheet and the invite card. */
export const JUST_PLAYING = 'Just playing, no bet';
/** What it means, in one line, under the choice. */
export const JUST_PLAYING_HELP = 'On the card with everyone, out of every bet. Nothing on the Tab.';
/** The most people in one round, the ones just playing included. */
export const MAX_GROUP = MAX_SIDE_PLAYERS;


export { anyJustPlaying, bettors, cardOnly, isJustPlaying };

/**
 * Whether a game can have someone just playing. Not the one-ball games (Scramble, Alternate shot,
 * Chapman): every ball there is a team's, so everyone is on a team and in its bet.
 */
export function canJustPlay(game) {
  return !!GAMES[game] && !oneBall(game);
}

/** Why a game can't have anyone just playing, or null when it can. */
export function cantJustPlay(game) {
  if (!GAMES[game] || canJustPlay(game)) return null;
  return `Everyone plays on a team in ${GAMES[game].name}, so nobody can sit out the bet.`;
}

/** The most players the Players step lets you pick: past the game's own cap when someone can be just playing. */
export function maxPicked(game) {
  const g = GAMES[game];
  if (!g) return MAX_GROUP;
  return canJustPlay(game) ? Math.max(g.max, MAX_GROUP) : g.max;
}

/** "4", "3 to 8": how many betting players a game takes. */
function howMany(g) {
  return g.min === g.max ? `${g.min}` : g.max >= MAX_GROUP ? `at least ${g.min}` : `${g.min} to ${g.max}`;
}

/**
 * The Players step's head count, with anyone just playing left out of the game's numbers:
 * { valid, bettors, casual, text } where `text` is what the button says when it can't go on.
 * Wolf with three betting players and a friend just playing: "Needs 4 betting players".
 */
export function pickedCheck(game, picked = [], justPlaying = []) {
  const g = GAMES[game];
  const jp = canJustPlay(game) ? picked.filter(pid => justPlaying.includes(pid)) : [];
  const n = picked.length - jp.length;
  const out = { valid: false, bettors: n, casual: jp.length, text: null };
  if (!g) return out;
  if (picked.length > maxPicked(game)) {
    const over = picked.length - maxPicked(game);
    return { ...out, text: `Remove ${plural(over, 'player')}` };
  }
  if (n < g.min) {
    const need = g.min - n;
    return { ...out, text: jp.length ? `Needs ${howMany(g)} betting players` : `Add ${need} more player${need === 1 ? '' : 's'}` };
  }
  if (n > g.max) {
    const over = n - g.max;
    return { ...out, text: `${g.name} is for ${g.min === g.max ? g.max : `up to ${g.max}`}. Mark ${over} just playing` };
  }
  return { ...out, valid: true };
}

/**
 * Who's just playing, as a sentence's start for the setup screens: "Sam is", "You are", "You and Sam
 * are", "Sam, Bo and Al are". `ids` in order, `me` your id (said as "You"), `nameOf(id)` a name.
 */
export function justPlayingWho(ids = [], me = null, nameOf = id => id) {
  const names = ids.map(id => (id === me ? 'You' : String(nameOf(id) || '').trim() || 'Someone'));
  if (!names.length) return '';
  const list = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 && names[0] !== 'You' ? 'is' : 'are'}`;
}

/**
 * The Players step's count line, short enough for one line: "4 picked (4)", or with someone just
 * playing, the betting count against the game's range, "4 betting (2–8)" (who's just playing is
 * said under it).
 */
export function pickedLine(game, picked = [], justPlaying = []) {
  const g = GAMES[game];
  const c = pickedCheck(game, picked, justPlaying);
  const range = g ? (g.min === g.max ? `${g.min}` : `${g.min}–${g.max}`) : '';
  if (!c.casual) return `${picked.length} picked (${range})`;
  return `${c.bettors} betting (${range})`;
}

/**
 * Why nobody can be added just playing right now, or null when someone can. Someone just playing is
 * in no game, so even a game with set sides or a full group of betting players (Wolf's four) takes
 * them: only a one-ball game and a group of MAX_GROUP don't.
 */
export function addJustPlayingProblem(round) {
  if (!round) return 'This round is gone.';
  const no = cantJustPlay(round.game);
  if (no) return no;
  if (round.players.length >= MAX_GROUP) return `A round is for up to ${MAX_GROUP} players, and the group is full.`;
  return null;
}

/** What the reveal's subtitle says to someone just playing in a betting round: the bets happened, but not to them. */
export const NICE_ROUND_NOTE = 'You played this one for fun, so there’s nothing for you to pay or collect.';

/**
 * A round's label when it's only a card: "Just keeping score". Null for a round with a game, which
 * keeps its game's name.
 */
export function cardOnlyLabel(round) {
  return cardOnly(round) ? 'Just keeping score' : null;
}

/** "Sam is just playing", "Sam and Jo are just playing": a note for the round's results. */
export function justPlayingNote(round) {
  const names = (round?.players || []).filter(p => isJustPlaying(round, p.id)).map(p => first(p.name));
  if (!names.length || cardOnly(round)) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${who} ${names.length === 1 ? 'was' : 'were'} just playing: on the card, out of the money.`;
}

/**
 * "Just keep my own score": a card of your own from a friend's invite, on the same course, holes and
 * tees, with no game. You're its only player and you're just playing, so nothing in it is ever money,
 * points or a result (it's played for points so it never touches the Tab either way). It stays on
 * this phone: the group's round is untouched. `meta` is the shared round's meta (sync-model.js),
 * `me` { id, name, index }.
 */
export function cardOnlyRound({ id, meta, me, at = Date.now() }) {
  const holes = (meta?.holes || []).map(h => ({ ...h }));
  const host = typeof meta?.hostName === 'string' && meta.hostName.trim() ? meta.hostName.trim() : null;
  return {
    id, game: 'stroke', status: 'active', createdAt: at, finishedAt: null,
    course: { id: meta?.course?.id ?? null, name: meta?.course?.name || 'Golf', city: meta?.course?.city ?? null, tees: (meta?.course?.tees || []).map(t => ({ name: t.name, color: t.color })) },
    holesCount: meta?.holesCount || holes.length, nine: meta?.nine ?? null,
    holes, par: parOf(holes),
    useHandicaps: false, hcPct: 100,
    players: [{ id: me.id, name: me.name, tee: null, index: me.index ?? null, courseHc: 0, courseHcOverride: null, plays: 0 }],
    teams: null,
    settings: { ...structuredClone(meta?.settings || {}), stroke: { stake: 0, payout: 'per' } },
    scores: {}, banker: {}, wolf: {}, marks: {}, presses: [], pressSeq: 0, current: 0, left: {},
    justPlaying: { [me.id]: true },
    playFor: { kind: 'points' },
    // Where it came from, for the card's subtitle ("From Trevor's round"). Never the group's code: it
    // opens their live round, and this card's meta would carry it to anyone it's shared with
    cardFrom: { host },
  };
}

/** "From Trevor's round": where a card of your own came from, or null. */
export function cardFromLine(round) {
  if (!cardOnly(round) || !round.cardFrom) return null;
  const host = round.cardFrom.host ? first(round.cardFrom.host) : null;
  return host ? `Your own card, from ${host}’s round` : 'Your own card, from the group’s round';
}
