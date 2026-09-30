// This phone's device key, for the server's keeper lock (see keeper-lock.js). The secret stays on the
// phone and goes with every request to the server (the x-bb-device header); only its hash is shared,
// in a round's meta, so nobody can pose as this phone from what they can read.
import { STORE_KEY } from './store.js';

const KEY = `bb-device:${STORE_KEY}`; // one per dev profile, so two tabs act like two phones

let secret = null;
/** The secret, made once and kept on the phone. */
export function deviceSecret() {
  if (secret) return secret;
  try { secret = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!secret || !/^[0-9a-f]{32,128}$/.test(secret)) {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    secret = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(KEY, secret); } catch { /* a new key each launch, then */ }
  }
  return secret;
}

/** SHA-256 of the secret as hex, the same as the server's encode(sha256(...), 'hex'). */
export async function hashSecret(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

let hash = null;
let ready = null;
/** Resolves once this phone's device hash is known (null where the browser can't hash, like plain http). */
export function deviceReady() {
  if (!ready) ready = (async () => { try { hash = await hashSecret(deviceSecret()); } catch { hash = null; } return hash; })();
  return ready;
}

/** This phone's device hash, or null until deviceReady() resolves (or when it can't be made). */
export function myDevice() { return hash; }
