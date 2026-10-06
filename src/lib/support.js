// Where people write for help, in one place. Settings' Help row and the terms page (terms-page.js)
// read it, and the privacy page (public/privacy.html) has a %SUPPORT_EMAIL% placeholder that the
// build and the dev server fill in from it (vite.config.js legalPages), so changing the address
// here changes it everywhere.
import { APP_NAME } from './app-name.js';

/** The support inbox. A placeholder until the rename brings its own domain: change it here. */
export const SUPPORT_EMAIL = 'design@trevornielsen.com';

/** A mailto: link to support, with a subject so the message is easy to spot. */
export function helpMailto(subject = `Help with ${APP_NAME}`, email = SUPPORT_EMAIL) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

/** The placeholder public/privacy.html carries where the support address goes. */
export const SUPPORT_PLACEHOLDER = '%SUPPORT_EMAIL%';

/** A page with every support placeholder filled in with the address (HTML-safe). */
export function fillSupportEmail(html, email = SUPPORT_EMAIL) {
  const safe = String(email).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return String(html).split(SUPPORT_PLACEHOLDER).join(safe);
}
