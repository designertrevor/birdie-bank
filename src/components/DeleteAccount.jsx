import { useState } from 'react';
import { Icon, useUI } from './ui.jsx';
import { deleteAccount, deleteAccountReady } from '../lib/profiles.js';

const NOT_YET = {
  unavailable: { title: 'Not available yet', text: 'Deleting your account isn’t switched on yet, so nothing was changed. It’s coming soon. If you need it now, tell us from “Report a bug or send an idea” and we’ll do it for you.' },
  offline: { title: 'No signal', text: 'Deleting your account needs a connection. Nothing was changed. Try again when you’re back online.' },
  'signed-out': { title: 'You’re signed out', text: 'Sign in to the account you want to delete, then try again.' },
  error: { title: 'Couldn’t delete your account', text: 'Something went wrong on our side, so nothing was changed. Try again in a minute.' },
};

/**
 * "Delete your account" for Settings, below Sign out. A warning first, then a check that the server
 * can do it (nothing changes when it can't), then the last confirm. Once it's done the phone signs
 * out and starts fresh.
 */
export function DeleteAccountButton() {
  const { ask } = useUI();
  const [busy, setBusy] = useState(false);
  const tell = reason => ask({ ...(NOT_YET[reason] || NOT_YET.error), actions: [], cancelLabel: 'OK' });

  const run = async () => {
    const go = await ask({
      title: 'Delete your account?',
      text: 'This deletes your profile, your photo and everything saved in your account: rounds, players, courses and payments, on every phone you’re signed in on. Friends keep their own copies of rounds you played together, with your name and every amount. Back up your data first if you might want it.',
      confirmLabel: 'Continue', danger: true,
    });
    if (!go) return;
    setBusy(true);
    try {
      const ready = await deleteAccountReady();
      if (ready !== 'ready') { await tell(ready); return; }
      const sure = await ask({
        title: 'This can’t be undone',
        text: 'Your account and everything in it will be gone for good, and this phone will start fresh.',
        confirmLabel: 'Delete my account', danger: true, cancelLabel: 'Keep my account',
      });
      if (!sure) return;
      const res = await deleteAccount();
      if (!res.ok) await tell(res.reason);
      // On success the phone is signed out and fresh, so the app goes back to the welcome screen
    } finally { setBusy(false); }
  };

  return (
    <button className="danger-link delete-account" onClick={run} disabled={busy} aria-busy={busy}>
      <Icon name="user-minus" /> {busy ? 'Checking…' : 'Delete your account'}
    </button>
  );
}
