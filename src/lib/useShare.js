// The React side of share.js: the remembered Show amounts switch, and sharing a line of text (a
// callout, a challenge, the plan's link) with the toast that says what happened.
import { useUI } from '../components/ui.jsx';
import { update } from './store.js';
import { shareOut, shareToast } from './share.js';

/** Turn the remembered Show amounts switch on or off (the same switch for every card). */
export const setShareAmounts = on => update(s => { s.settings.shareAmounts = !!on; });

/**
 * Share something with no image and say so when it only got copied. Returns
 * share(text, { url, what, copied }), resolving to what shareOut did.
 */
export function useShareText() {
  const { showToast } = useUI();
  return async (text, { url = null, what = 'It', copied = null } = {}) => {
    const r = await shareOut({ text, url });
    const msg = r === 'copied' && copied ? copied : shareToast(r, what);
    if (msg) showToast(msg);
    return r;
  };
}
