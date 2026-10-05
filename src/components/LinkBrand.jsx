// The branded top of a page opened from one of the app's links by someone without the app (a
// round's join link, a plan's RSVP link, a challenge, a captain's draft): the app's mark and name
// and that it runs right here, plus "How it works" under the invite card. The name comes from the
// one constant (app-name.js), so the rename changes it here too.
import { Icon } from './ui.jsx';
import { APP_NAME } from '../lib/app-name.js';
import { BROWSER_LINE, howItWorks } from '../lib/link-landing.js';

export function LinkBrand() {
  return (
    <div className="link-brand">
      <img className="lb-mark" src="/icon.svg" alt="" width="30" height="30" />
      <span className="lb-name">{APP_NAME}</span>
      <span className="lb-pill"><Icon name="globe-simple" /> {BROWSER_LINE}</span>
    </div>
  );
}

/** "How it works" in three numbered steps for `kind` ('join', 'plan' or 'challenge'). */
export function LinkHowTo({ kind }) {
  const steps = howItWorks(kind);
  if (!steps.length) return null;
  return (
    <section className="link-howto" aria-label="How it works">
      <h2 className="lh-title">How it works</h2>
      <ol>
        {steps.map((s, i) => <li key={s}><span className="lh-num" aria-hidden="true">{i + 1}</span><span>{s}</span></li>)}
      </ol>
    </section>
  );
}
