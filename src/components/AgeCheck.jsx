// The one-time "Are you 18 or older?" before money (age.js). Asked with the app's own confirm
// sheet, saved on your profile, and never asked again once you've said yes.
import { useCallback } from 'react';
import { useUI } from './ui.jsx';
import { getState, update } from '../lib/store.js';
import { AGE_COPY, moneyOk, setAgeAnswer } from '../lib/age.js';

/**
 * Returns `check()`, which resolves to 'adult' (go ahead with money), 'under' (saved: keep it to
 * points or a reward) or null (closed without answering: nothing is saved, nothing goes ahead).
 * `force: true` asks even after a yes, so Settings can change the answer.
 */
export function useAgeCheck() {
  const { ask } = useUI();
  return useCallback(async ({ force = false } = {}) => {
    if (!force && moneyOk(getState())) return 'adult';
    const answer = await ask({
      title: AGE_COPY.title,
      text: AGE_COPY.text,
      actions: [{ label: AGE_COPY.yes, value: 'adult' }, { label: AGE_COPY.no, value: 'under', secondary: true }],
      cancelLabel: 'Not now',
    });
    if (answer === 'adult' || answer === 'under') update(s => setAgeAnswer(s, answer));
    return answer || null;
  }, [ask]);
}
