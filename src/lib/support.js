// Where people write for help, in one place. Settings' Help row and the terms page (terms-page.js)
// both read it, so changing the address here changes it everywhere the app shows it. The privacy
// page (public/privacy.html) is plain HTML and spells its contact address out on its own.
import { APP_NAME } from './app-name.js';

/** The support inbox. A placeholder until the rename brings its own domain: change it here. */
export const SUPPORT_EMAIL = 'design@trevornielsen.com';

/** A mailto: link to support, with a subject so the message is easy to spot. */
export function helpMailto(subject = `Help with ${APP_NAME}`, email = SUPPORT_EMAIL) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
