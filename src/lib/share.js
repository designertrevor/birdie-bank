// One way to share anything into the group's own text thread: the results image, the preview, the
// recap, trip standings, the cup, a challenge, callouts and the plan's group link all go through
// shareOut(), so each is one tap and works the same everywhere.
//
// The rules:
//  • The phone's share sheet when it can take the image (Messages, WhatsApp, Save Image), with the
//    text and a short link back to the round or plan riding along. A device that can't share files
//    (most desktops) copies the text and saves the image instead. Text alone uses the share sheet,
//    else a text message on a phone, else the clipboard.
//  • Show amounts starts off and remembers your choice (settings.shareAmounts, Trevor 2026-09-27),
//    the same switch for every card. Points and rewards are never money, so they always show.
//  • A card never shows anyone's money they keep to themselves. Your own money is yours to share.
//    Someone whose profile is Only you (profile-model.js: their profile reaches this phone without
//    its stats) keeps theirs off every card, and since the money between a few people adds up to
//    nothing, one person's hidden amount could be worked out from the rest: so a card shows
//    amounts for everyone on it or for no one. A friend with no account has no setting, so their
//    money follows the round, which everyone in it already sees.
// The pure parts are tested in share.test.js; shareOut takes its browser pieces as `env` so the
// tests can stand in for them.
import { linksOf } from './people-links.js';
import { theirProfile } from './their-profile.js';
// shareOut lives in share-out.js so pay.js (which the first screen loads) shares without the rest of this file
export { browserEnv, shareOut, withLink } from './share-out.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
// Every id that means you on this phone (format.js myIds) and a round's live code (pair-debts.js codeOf)
const myIds = state => new Set([state.me, ...Object.values(state.rounds || {}).map(r => r?.localMe)].filter(Boolean));
const codeOf = round => round?.shareCode || round?.shared?.code || null;
const list = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** The money switch, remembered on this phone (off until you turn it on). */
export const shareAmountsOn = state => state?.settings?.shareAmounts === true;

/**
 * Whether someone keeps their money off shared cards: a friend whose account's profile came back
 * as Only you (it carries no stats), or whose account has no profile this phone may see. You never
 * do on your own phone, and a player with no account has no setting to keep.
 */
export function keepsMoneyPrivate(state, id) {
  if (!state || id == null) return false;
  const L = linksOf(state);
  const person = L.personOf(id);
  const mine = myIds(state);
  const group = L.groupOf(person);
  if (group.some(x => mine.has(x)) || mine.has(person)) return false;
  const accounts = isObj(state.accountOf) ? state.accountOf : {};
  if (!group.some(x => accounts[x])) return false;
  const prof = theirProfile(state, id);
  return !isObj(prof) || !isObj(prof.stats);
}

/**
 * Whether a card shows its amounts: { show, held, money }.
 * - `money`: the card has dollars on it (a points or reward card never does, so it always shows).
 * - `on`: the Show amounts switch.
 * - `people`: [{ id, name }] whose money is on the card.
 * `show` is true for a card with no money, or with the switch on and nobody on it keeping their
 * money private. `held` names who kept it off (with the switch on), for the line under it.
 */
export function amountsRule(state, { money = true, on = false, people = [] } = {}) {
  if (!money) return { show: true, held: [], money: false };
  const held = people.filter(p => keepsMoneyPrivate(state, p.id)).map(p => first(p.name) || 'Someone');
  return { show: !!on && held.length === 0, held: on ? [...new Set(held)] : [], money: true };
}

/** Who kept their money off a card, for a line: "Sam keeps their money private". */
export const heldNote = held => `${list(held)} ${held.length === 1 ? 'keeps' : 'keep'} their money private`;

/** The line under Show amounts: what's on the card, or who kept their money off it. */
export function amountsNote(rule, { onText, offText }) {
  if (rule.held.length) return `Amounts stay off: ${heldNote(rule.held)}`;
  return rule.show ? onText : offText;
}

// --------------------------- links ------------------------------------------

const originOf = origin => origin ?? (typeof location !== 'undefined' ? location.origin : '');

/** The short link back to a round: its live link when it was shared, else the app. */
export function roundLink(round, origin) {
  const code = codeOf(round);
  const o = originOf(origin);
  return code ? `${o}/?join=${code}` : o || null;
}

/**
 * The link a round's results or recap goes out with: its live link, unless someone in a money
 * round keeps their money private. Anyone with the live link can watch the round, and watching
 * shows everyone's money, so then it's the app alone, the way the card keeps their amounts off.
 */
export function shareRoundLink(state, round, { money = true, origin } = {}) {
  // Someone just playing has no money in the round, so their setting holds nobody else's back
  if (money && (round?.players || []).some(p => !round.justPlaying?.[p.id] && keepsMoneyPrivate(state, p.id))) return appLink(origin);
  return roundLink(round, origin);
}

/**
 * The live link a line about a round goes out with (a callout), or null: only for a round shared
 * live, and never when someone in a money round keeps their money private (shareRoundLink). A
 * bare link to the app adds nothing to a line, so then it goes alone.
 */
export function liveLinkFor(state, round, { money = true, origin } = {}) {
  if (!codeOf(round)) return null;
  const link = shareRoundLink(state, round, { money, origin });
  return link === roundLink(round, origin) ? link : null;
}

/** The app itself, for a card with no round or plan of its own (a trip, the cup). */
export function appLink(origin) {
  return originOf(origin) || null;
}

/** A file name from a few words: "recap-pebble-creek-2026-10-03.png". */
export function slugName(prefix, words, date = null) {
  const slug = String(words || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'golf';
  const d = date == null ? null : new Date(date);
  const pad = n => String(n).padStart(2, '0');
  const when = d && !Number.isNaN(d.getTime()) ? `-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  return `${prefix}-${slug}${when}.png`;
}

/** The toast after a share, or null when the share sheet said it all. `what`: "Results", "Recap". */
export function shareToast(result, what = 'It') {
  if (result === 'copied') return `${what} copied. Paste it in the group text`;
  if (result === 'copied-saved') return 'Image saved and the text copied. Paste them in the group text';
  if (result === 'saved') return 'Image saved to your downloads';
  if (result === 'failed') return 'Couldn’t share on this device';
  return null;
}
