// Who gets paid on which app: the handle on a player record, cleaned, and the fields a round's
// player carries. Split out of pay.js (which re-exports it) so the scoring code and Up next's
// first paint don't load the payment links and reminders. Pure, no imports.

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
