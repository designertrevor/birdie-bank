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
// Kept to these two light imports so pay.js (which the round engine imports) can share through it
import { linksOf } from './people-links.js';
import { theirProfile } from './their-profile.js';

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

/** The line under Show amounts: what's on the card, or who kept their money off it. */
export function amountsNote(rule, { onText, offText }) {
  if (rule.held.length) return `Amounts stay off: ${list(rule.held)} ${rule.held.length === 1 ? 'keeps' : 'keep'} their money private`;
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

/** The app itself, for a card with no round or plan of its own (a trip, the cup). */
export function appLink(origin) {
  return originOf(origin) || null;
}

/** The text with the link on a line of its own at the end (once, even if it's already in it). */
export function withLink(text, url) {
  const t = String(text || '').trim();
  if (!url || t.includes(url)) return t;
  return t ? `${t}\n${url}` : url;
}

/** A file name from a few words: "recap-pebble-creek-2026-10-03.png". */
export function slugName(prefix, words, date = null) {
  const slug = String(words || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'golf';
  const d = date == null ? null : new Date(date);
  const pad = n => String(n).padStart(2, '0');
  const when = d && !Number.isNaN(d.getTime()) ? `-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  return `${prefix}-${slug}${when}.png`;
}

// --------------------------- sharing ----------------------------------------

/** The browser's own pieces, for shareOut. */
export function browserEnv() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return {
    nav,
    phone: !!nav && /iPhone|iPad|Android/i.test(nav.userAgent || ''),
    makeFile: img => (typeof File === 'undefined' ? null : new File([img.blob], img.name, { type: img.blob.type || 'image/png' })),
    copy: async text => { try { await nav.clipboard.writeText(text); return true; } catch { return false; } },
    save: img => {
      try {
        const url = img.url || URL.createObjectURL(img.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = img.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (!img.url) setTimeout(() => URL.revokeObjectURL(url), 10000);
        return true;
      } catch { return false; }
    },
    sms: text => { location.href = `sms:?&body=${encodeURIComponent(text)}`; return true; },
  };
}

/**
 * Share into the group text. `payload`: { title, text, url, image: { blob, name, url? } | null }.
 * Resolves to what happened: 'shared', 'cancelled', 'sms', 'copied', 'saved' (the image only),
 * 'copied-saved' (the text copied and the image saved) or 'failed'.
 */
export async function shareOut({ title = '', text = '', url = null, image = null } = {}, env = browserEnv()) {
  const { nav } = env;
  const body = withLink(text, url);
  if (image?.blob) {
    const file = env.makeFile(image);
    if (file && nav?.canShare?.({ files: [file] })) {
      // The text goes with it where the app takes both (Messages does); the link is in it
      const data = body && nav.canShare({ files: [file], text: body }) ? { files: [file], text: body } : { files: [file] };
      if (title) data.title = title;
      try { await nav.share(data); return 'shared'; }
      catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
    }
    const copied = body ? await env.copy(body) : false;
    const saved = env.save(image);
    return copied && saved ? 'copied-saved' : saved ? 'saved' : copied ? 'copied' : 'failed';
  }
  if (!body) return 'failed';
  if (nav?.share) {
    try { await nav.share(title ? { title, text: body } : { text: body }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  if (env.phone && env.sms?.(body)) return 'sms';
  return (await env.copy(body)) ? 'copied' : 'failed';
}

/** The toast after a share, or null when the share sheet said it all. `what`: "Results", "The recap". */
export function shareToast(result, what = 'It') {
  if (result === 'copied') return `${what} copied. Paste it in the group text`;
  if (result === 'copied-saved') return 'Image saved and the text copied. Paste them in the group text';
  if (result === 'saved') return 'Image saved to your downloads';
  if (result === 'failed') return 'Couldn’t share on this device';
  return null;
}
