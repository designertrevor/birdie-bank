// A course's booking page as a link that's safe to open. Its own small file so the course
// database mapping (courseApi.js) can use it without the plan code.

const MAX_URL = 300;

/**
 * A booking link as typed or pasted, made safe to open: "foreupsoftware.com/x" becomes
 * "https://foreupsoftware.com/x". Anything that isn't a web address comes back as ''.
 */
export function cleanBookingUrl(raw) {
  let s = String(raw || '').trim();
  if (!s || s.length > MAX_URL || /\s/.test(s)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  let u;
  try { u = new URL(s); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  // A host needs a dot ("golf.com"), so a stray word never becomes a link
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return '';
  return u.href;
}

/** "foreupsoftware.com": the link's site, for the card. */
export function linkSite(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
