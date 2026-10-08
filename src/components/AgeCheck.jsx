// The one-time "Are you 18 or older?" before money (age.js). Asked with the app's own confirm
// sheet, saved on your profile, and never asked again once you've said yes. The sheet has the two
// answers as buttons; closing it (the X, the scrim or Escape) is "not now": nothing is saved and
// nothing goes ahead, and it's asked again the next time money comes up.
import { useCallback } from 'react';
import { useUI } from './ui.jsx';
import { getState, update } from '../lib/store.js';
import { AGE_COPY, bigPlaysForMoney, moneyOk, setAgeAnswer } from '../lib/age.js';

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
      text: force ? AGE_COPY.again : AGE_COPY.text,
      actions: [{ label: AGE_COPY.yes, value: 'adult' }, { label: AGE_COPY.no, value: 'under', secondary: true }],
      // Closing without an answer is the sheet's X, so it doesn't look like a third answer
      cancelLabel: 'Not now', cancelX: true,
    });
    if (answer === 'adult' || answer === 'under') update(s => setAgeAnswer(s, answer));
    return answer || null;
  }, [ask]);
}

/**
 * The same check for a Big Game before its groups start: true to go ahead (no money in it, or a yes),
 * false otherwise. A no says why; the game stays saved, so someone 18 or older can start it.
 */
export function useBigAgeCheck() {
  const check = useAgeCheck();
  const { showToast } = useUI();
  return useCallback(async big => {
    if (!bigPlaysForMoney(big) || moneyOk(getState())) return true;
    const answer = await check();
    if (answer === 'under') showToast('Money games are for 18 or older, so it’s saved but not started');
    return answer === 'adult';
  }, [check, showToast]);
}
