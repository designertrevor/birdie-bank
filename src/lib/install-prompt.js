// Android's own install prompt: Chrome fires beforeinstallprompt once, early, when the app can be
// installed. Kept here (imported by main.jsx, so it's listening before that happens) for the
// "Add it to your Home Screen" card's one-tap Install app. iPhone has no such prompt.
let deferred = null;
const listeners = new Set();
const tell = () => listeners.forEach(l => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    // Ours to show from the card, not the browser's mini bar
    e.preventDefault();
    deferred = e;
    tell();
  });
  window.addEventListener('appinstalled', () => { deferred = null; tell(); });
}

/** Whether Chrome's install prompt is ready to show. */
export function canPrompt() { return !!deferred; }

export function subscribePrompt(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Show Chrome's install prompt: 'accepted', 'dismissed', or null when there's none. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return null;
  deferred = null;
  tell();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome || null;
  } catch { return null; }
}
