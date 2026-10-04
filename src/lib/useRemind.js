import { useUI } from '../components/ui.jsx';
import { update, useStore } from './store.js';
import { nameOf } from './ledger.js';
import { payInfoFor, remindText, sendReminder } from './pay.js';
import { noteNudge } from './nudges.js';

/**
 * Remind someone what they owe you: share sheet or a text, with how to pay you. Resolves to what
 * happened (sendReminder's 'shared', 'sms', 'copied', 'cancelled' or 'failed'). A reminder sent counts as this week's nudge for them, so
 * Up next doesn't suggest another one right after (see nudges.js).
 */
export function useRemind() {
  const state = useStore();
  const { showToast } = useUI();
  return async (id, amount) => {
    const name = nameOf(state, id);
    const text = remindText({ name, amount, mine: payInfoFor(state, state.me) });
    const r = await sendReminder(text);
    if (r === 'copied') showToast(`Reminder copied. Paste it to ${name.split(' ')[0]}`);
    if (r === 'failed') showToast('Couldn’t share on this device');
    if (r === 'shared' || r === 'sms' || r === 'copied') update(s => noteNudge(s, id));
    return r;
  };
}
