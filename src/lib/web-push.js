// Sending one web push from the server (api/push.js, api/push-tee.js), with Node's own crypto so
// there's no new dependency: the VAPID header that says the push comes from us (RFC 8292) and the
// payload encrypted for that one browser (RFC 8291, aes128gcm). Server only: the app never imports this.
//
// Keys, as `npx web-push generate-vapid-keys` or the one-line command in api/push.js makes them:
// the public key is 65 bytes (uncompressed P-256 point) and the private key 32 bytes, both base64url.
import { Buffer } from 'node:buffer';
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto';

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(String(s || ''), 'base64url');

/**
 * The VAPID keys from a private key (and the subject: a mailto: or https: address the push
 * services can reach us at), or null when either is missing or the key isn't one. The public key
 * is worked out from the private one, so it always matches.
 */
export function vapidKeys(privateKey, subject) {
  if (!privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return null;
  try {
    let d = fromB64u(privateKey);
    // A key with leading zero bytes can come out a byte or two short
    if (d.length >= 30 && d.length < 32) d = Buffer.concat([Buffer.alloc(32 - d.length), d]);
    if (d.length !== 32) return null;
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(d);
    const pub = ecdh.getPublicKey();
    const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
    return { publicKey: b64u(pub), key, subject };
  } catch {
    return null;
  }
}

/** The Authorization header for a push to `endpoint`: a 12-hour ES256 token for its origin. */
export function vapidHeader(endpoint, vapid, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject }));
  const input = `${head}.${claims}`;
  const sig = sign('sha256', Buffer.from(input), { key: vapid.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${input}.${b64u(sig)}, k=${vapid.publicKey}`;
}

/**
 * The payload encrypted for one browser (RFC 8291): salt, record size and our one-time public key,
 * then the text and its tag, as one record. `salt` and `serverPrivate` are only passed by tests.
 */
export function encryptPayload(text, { p256dh, auth }, { salt = randomBytes(16), serverPrivate = null } = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Bad subscription keys');
  const ecdh = createECDH('prime256v1');
  if (serverPrivate) ecdh.setPrivateKey(fromB64u(serverPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // One record: the text, then the 0x02 that marks the last record (no padding)
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/**
 * The fetch for one push: { url, init }. TTL a day (a phone off overnight still gets it in the
 * morning); `topic` lets a newer push about the same thing replace one not delivered yet.
 */
export function pushRequest(sub, payload, vapid, { ttl = 86400, urgency = 'normal', topic = '', now = Date.now() } = {}) {
  const body = encryptPayload(JSON.stringify(payload), sub);
  const headers = {
    Authorization: vapidHeader(sub.endpoint, vapid, now),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl),
    Urgency: urgency,
  };
  // A push service takes a topic of up to 32 base64url characters
  const t = String(topic || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (t) headers.Topic = t;
  return { url: sub.endpoint, init: { method: 'POST', headers, body } };
}

/** Only ever send to a real push service over https (an endpoint is something a browser gave us). */
export function okEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname);
  } catch { return false; }
}
