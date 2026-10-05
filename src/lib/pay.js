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

/** A link that opens the payee's app to pay them `amount`. Zelle has no pay link, so it's null. */
export function payLink(info, amount, note = 'Birdie Bank') {
  if (!info?.handle) return null;
  const h = encodeURIComponent(info.handle);
  if (info.app === 'venmo') return `https://venmo.com/${h}?txn=pay&amount=${amt(amount)}&note=${encodeURIComponent(note)}`;
  if (info.app === 'cashapp') return `https://cash.app/$${h}/${amt(amount)}`;
  if (info.app === 'paypal') return `https://paypal.me/${h}/${amt(amount)}`;
  return null;
}

/**
 * A link that asks `payer` for money. Only Venmo can prefill a request to someone else, so this
 * needs the payer's Venmo, and you using Venmo too (or not having picked an app yet).
 */
export function requestLink(payer, mine, amount, note = 'Birdie Bank') {
  if (payer?.app !== 'venmo' || (mine && mine.app !== 'venmo')) return null;
  return `https://venmo.com/${encodeURIComponent(payer.handle)}?txn=charge&amount=${amt(amount)}&note=${encodeURIComponent(note)}`;
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
  else if (mine) lines.push(`${PAY_APPS[mine.app].name}: ${handleText(mine)}`);
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

/** Copy a handle (for Zelle, which has no pay link). */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}
