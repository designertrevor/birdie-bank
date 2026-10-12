// The Record Book limit in React (record-book.js): the state a record view reads, and how many
// finished rounds it leaves out. With the paywall flag off this is the store's own state, untouched.
// Only the record views use it; the Tab and every money screen keep reading useStore().
import { useMemo } from 'react';
import { useStore } from './store.js';
import { PAYWALL_ON } from './paywall-flag.js';
import { useLifetimePro } from './pro-client.js';
import { canUsePro } from './entitlements.js';
import { recordBookLine, recordBookView } from './record-book.js';
import { roundsInProgress } from './rounds-live.js';

/** { state, hidden, total, limited, line }: `line` is the calm note to show, or null. */
export function useRecordBook() {
  const state = useStore();
  const { lifetime } = useLifetimePro();
  return useMemo(() => {
    // The one entitlement check (entitlements.js): the trial, a paid plan or Pro for life, and
    // always true with the flag off
    const pro = canUsePro(state, { gated: PAYWALL_ON, lifetime: lifetime === true });
    const view = recordBookView(state, { gated: PAYWALL_ON, pro });
    const live = roundsInProgress(state).length > 0;
    return { ...view, line: recordBookLine({ hidden: view.hidden, live }) };
  }, [state, lifetime]);
}
