// Payment apps: how each person likes to get paid, and links that open the right app.
// Birdie Bank never holds or moves money. These links only open the payer's own app,
// already filled in, and nobody is assumed to use any one app.
import { money } from './golf.js';
import { linksOf } from './people-links.js';
import { theirProfile } from './their-profile.js';
import { shareOut } from './share-out.js';

export const PAY_APPS = {
  venmo: { name: 'Venmo', label: 'Venmo username', placeholder: '@username' },
  cashapp: { name: 'Cash App', label: 'Cashtag', placeholder: '$cashtag' },
  paypal: { name: 'PayPal', label: 'PayPal.Me name', placeholder: 'paypal.me/name' },
  zelle: { name: 'Zelle', label: 'Zelle email or phone', placeholder: 'Email or phone' },
};
export const PAY_APP_IDS = Object.keys(PAY_APPS);

/** A handle as typed, cleaned for its app: no leading @ or $, no pasted link, no spaces. */
export function cleanHandle(app, raw) {
  let h = String(raw || '').trim();
  if (!h) return '';
  if (app === 'zelle') return h;
  h = h.replace(/^https?:\/\//i, '').replace(/^(www\.)?(venmo\.com\/(u\/)?|cash\.app\/|paypal\.me\/|paypal\.com\/paypalme\/)/i, '');
  h = h.split(/[/?#]/)[0];
  return h.replace(/^[@$]+/, '').replace(/\s+/g, '');
}

/** { app, handle } for a player record or round player, or null when they haven't said. Reads the old `venmo` field too. */
export function payInfo(p) {
  if (!p) return null;
  if (p.payApp && PAY_APPS[p.payApp] && p.payHandle) return { app: p.payApp, handle: p.payHandle };
  if (p.venmo) return { app: 'venmo', handle: p.venmo };
  return null;
}

/** The fields to copy onto a round's player, so friends who join the round can pay them too. */
export function payFields(p) {
  const info = payInfo(p);
  return info ? { payApp: info.app, payHandle: info.handle } : {};
}

/**
 * How someone gets paid: the app on their own profile first, once a seat of theirs is linked to
 * their account (their-profile.js), since they know best. Then what this phone has: their own
 * player record, then the newest round that carries it (friends met through a joined round only
 * exist there), then the same for any of their other ids (see people-links.js).
 */
export function payInfoFor(state, id) {
  return profilePayInfo(state, id) || savedPayInfo(state, id);
}

/** The app on a friend's own profile ({ app, handle }), or null when their profile has none (or it's you). */
export function profilePayInfo(state, id) {
  const prof = theirProfile(state, id);
  return (prof && payInfo({ payApp: prof.payApp, payHandle: prof.payHandle })) || null;
}

/** How someone gets paid from what this phone saved and the rounds it has, leaving out their profile. */
export function savedPayInfo(state, id) {
  const own = payInfo(state.players?.[id]);
  if (own) return own;
  const rounds = Object.values(state.rounds || {}).sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0));
  for (const r of rounds) {
    const info = payInfo(r.players?.find(p => p.id === id));
    if (info) return info;
  }
  const others = linksOf(state).groupOf(id).filter(x => x !== id);
  for (const x of others) { const own = payInfo(state.players?.[x]); if (own) return own; }
  for (const r of rounds) for (const x of others) {
    const info = payInfo(r.players?.find(p => p.id === x));
    if (info) return info;
  }
  // Someone in another group of a Big Game: their seat on the copy of that group's round (big-sync.js)
  for (const cards of Object.values(state.bigCards || {})) for (const c of Object.values(cards || {})) {
    const info = payInfo(c?.players?.find(p => p.id === id));
    if (info) return info;
  }
  return null;
}

/** The handle the way people write it: @name, $name, paypal.me/name, or the Zelle email or phone. */
export function handleText(info) {
  if (!info) return '';
  if (info.app === 'venmo') return `@${info.handle}`;
  if (info.app === 'cashapp') return `$${info.handle}`;
  if (info.app === 'paypal') return `paypal.me/${info.handle}`;
  return info.handle;
}

const amt = a => (Math.round(a * 100) / 100).toFixed(2);
/** Only a real amount of money gets a link or a request: more than a cent, never NaN or points. */
const realAmount = a => typeof a === 'number' && Number.isFinite(a) && Math.round(a * 100) > 0;

/**
 * A link that opens the payee's app to pay them `amount`, the way each app documents it:
 *   Venmo    venmo.com/<user>?txn=pay&amount=12.00&note=...
 *   Cash App cash.app/$<cashtag>/12.00 (the amount is prefilled; Cash App takes no note in the link)
 *   PayPal   paypal.me/<name>/12.00USD (the currency code, so it's never read as the payer's own currency)
 * Zelle has no pay or request link at all (it lives inside each bank's app), so it's null: the
 * app shows the Zelle email or phone to copy, with the amount, instead.
 */
export function payLink(info, amount, note = 'Birdie Bank') {
  if (!info?.handle || !realAmount(amount)) return null;
  const h = encodeURIComponent(info.handle);
  if (info.app === 'venmo') return `https://venmo.com/${h}?txn=pay&amount=${amt(amount)}&note=${encodeURIComponent(note)}`;
  if (info.app === 'cashapp') return `https://cash.app/$${h}/${amt(amount)}`;
  if (info.app === 'paypal') return `https://paypal.me/${h}/${amt(amount)}USD`;
  return null;
}

/**
 * A Venmo request to `payer`: venmo.com/<user>?txn=charge&amount=12.00&note=... Only Venmo can
 * prefill a request to someone else, so this needs the payer's Venmo, and you using Venmo too (or not
 * having picked an app yet). requestFor covers every other app.
 */
export function requestLink(payer, mine, amount, note = 'Birdie Bank') {
  if (payer?.app !== 'venmo' || !payer.handle || (mine && mine.app !== 'venmo') || !realAmount(amount)) return null;
  return `https://venmo.com/${encodeURIComponent(payer.handle)}?txn=charge&amount=${amt(amount)}&note=${encodeURIComponent(note)}`;
}

/**
 * How to ask `payer` for `amount` in the app you get paid on (`mine`): one for every app.
 *  • Venmo to Venmo (or you haven't picked an app yet and they use Venmo): a Venmo request to them,
 *    already filled in. Venmo is the only app that can prefill a request to someone else.
 *  • Otherwise, with an app of your own: a short message to send them (share sheet or a text) with
 *    your pay link for that amount (Venmo, Cash App, PayPal), or for Zelle your email or phone and
 *    the amount, since Zelle has no link.
 * { kind: 'link', app, url } | { kind: 'share', app, text } | null (no app to ask with, or no money).
 * `name` is the payer's name, for the message.
 */
export function requestFor({ payer = null, mine = null, amount, name = '', note = 'Golf' } = {}) {
  if (!realAmount(amount)) return null;
  const venmoAsk = requestLink(payer, mine, amount, note);
  if (venmoAsk) return { kind: 'link', app: 'venmo', url: venmoAsk };
  if (!mine?.handle || !PAY_APPS[mine.app]) return null;
  return { kind: 'share', app: mine.app, text: requestText({ name, amount, mine, note }) };
}

/** The message that asks for money with your pay link (or your Zelle and the amount). */
export function requestText({ name, amount, mine, note = 'Golf' }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const what = String(note || '').trim() || 'Golf';
  const lines = [`Hey ${first}, settling up from ${what === 'Golf' ? 'golf' : what}: ${money(amount)} to me.`];
  const link = payLink(mine, amount, what);
  if (link) lines.push(`${PAY_APPS[mine.app].name}, already filled in: ${link}`);
  else if (mine?.app === 'zelle') lines.push(`Zelle ${money(amount)} to ${handleText(mine)}`);
  return lines.join('\n');
}

/** Button words for paying someone through their app. */
export function payLabel(info) {
  return info ? `Pay on ${PAY_APPS[info.app].name}` : 'Pay';
}

/** A friendly nudge with the amount and, when you've added one, how to pay you. */
export function remindText({ name, amount, mine }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const lines = [`Hey ${first}, friendly reminder from the golf tab: you owe me ${money(amount)}.`];
  const link = payLink(mine, amount, 'Golf');
  if (link) lines.push(`${PAY_APPS[mine.app].name}: ${link}`);
  // Zelle has no link: the email or phone, and the amount to send there
  else if (mine) lines.push(`${PAY_APPS[mine.app].name}: ${handleText(mine)}${mine.app === 'zelle' ? ` (${money(amount)})` : ''}`);
  // No app name on the end: the name is a codename for now, and the reminder reads fine without it
  return lines.join('\n');
}

/**
 * Send a reminder (or any text): the phone's share sheet when there is one (Messages, WhatsApp,
 * anything), otherwise a text message with it filled in, otherwise copied (share-out.js shareOut, the
 * one way the app shares). Resolves to what happened.
 */
export function sendReminder(text) {
  return shareOut({ text });
}

/** What to copy and say for Zelle, which has no link: the handle, and a toast with the amount. */
export function zelleCopy(info, amount) {
  if (info?.app !== 'zelle' || !info.handle) return null;
  return { copy: info.handle, label: `Zelle ${money(amount)} to ${info.handle}` };
}

/** Copy a handle (for Zelle, which has no pay link). */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}
