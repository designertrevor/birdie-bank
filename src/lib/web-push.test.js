import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from 'node:crypto';
import { encryptPayload, okEndpoint, pushRequest, vapidHeader, vapidKeys } from './web-push.js';

const b64u = b => Buffer.from(b).toString('base64url');

// RFC 8291 Appendix A
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

/** The browser's side of RFC 8291, to read back what we sent. */
function decrypt(body, uaPrivate, auth) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(uaPrivate, 'base64url'));
  const shared = ecdh.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, Buffer.from(auth, 'base64url'), info, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const data = body.subarray(21 + idlen);
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  assert.equal(out[out.length - 1], 2);
  return out.subarray(0, out.length - 1).toString('utf8');
}

test('payload encryption matches the worked example in RFC 8291 byte for byte', () => {
  const body = encryptPayload(RFC.plaintext, { p256dh: RFC.uaPublic, auth: RFC.auth }, { salt: Buffer.from(RFC.salt, 'base64url'), serverPrivate: RFC.asPrivate });
  assert.equal(b64u(body), RFC.body);
});

test('a browser can read back what we encrypt with fresh keys', () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = b64u(Buffer.alloc(16, 7));
  const text = JSON.stringify({ title: 'Dalton is in', body: 'For Saturday at Birch Creek.' });
  const body = encryptPayload(text, { p256dh: b64u(ua.getPublicKey()), auth });
  assert.equal(decrypt(body, b64u(ua.getPrivateKey()), auth), text);
});

test('bad subscription keys are refused', () => {
  assert.throws(() => encryptPayload('x', { p256dh: 'short', auth: RFC.auth }));
});

test('VAPID keys come from the private key alone, and need a subject', () => {
  const c = createECDH('prime256v1');
  c.generateKeys();
  const v = vapidKeys(c.getPrivateKey('base64url'), 'mailto:hello@example.com');
  assert.equal(v.publicKey, c.getPublicKey('base64url'));
  assert.equal(vapidKeys(c.getPrivateKey('base64url'), ''), null);
  assert.equal(vapidKeys(c.getPrivateKey('base64url'), 'hello@example.com'), null);
  assert.equal(vapidKeys('nope', 'mailto:a@b.c'), null);
  assert.equal(vapidKeys('', 'mailto:a@b.c'), null);
});

test('the VAPID header is an ES256 token for the push service, signed with our key', () => {
  const c = createECDH('prime256v1');
  c.generateKeys();
  const v = vapidKeys(c.getPrivateKey('base64url'), 'mailto:hello@example.com');
  const now = Date.UTC(2026, 9, 8);
  const h = vapidHeader('https://fcm.googleapis.com/fcm/send/abc', v, now);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m);
  assert.equal(m[4], v.publicKey);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:hello@example.com');
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  const pub = c.getPublicKey();
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  assert.equal(verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')), true);
});

test('a push request carries the encrypted body and the headers push services need', () => {
  const c = createECDH('prime256v1');
  c.generateKeys();
  const v = vapidKeys(c.getPrivateKey('base64url'), 'mailto:hello@example.com');
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const sub = { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc', p256dh: b64u(ua.getPublicKey()), auth: b64u(Buffer.alloc(16, 1)) };
  const { url, init } = pushRequest(sub, { title: 'Round finished' }, v, { topic: 'finished:AB12CD!' });
  assert.equal(url, sub.endpoint);
  assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(init.headers.TTL, '86400');
  assert.equal(init.headers.Topic, 'finishedAB12CD');
  assert.equal(JSON.parse(decrypt(init.body, b64u(ua.getPrivateKey()), sub.auth)).title, 'Round finished');
});

test('only https push services, never a local address', () => {
  assert.equal(okEndpoint('https://fcm.googleapis.com/fcm/send/x'), true);
  assert.equal(okEndpoint('http://fcm.googleapis.com/x'), false);
  assert.equal(okEndpoint('https://localhost/x'), false);
  assert.equal(okEndpoint('https://169.254.169.254/latest'), false);
  assert.equal(okEndpoint('nope'), false);
});

test('only the browsers\' push services: any other https host, a private address or a lookalike is never sent to', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/x', 'https://android.googleapis.com/gcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/QO-x',
    'https://wns2-by3p.notify.windows.com/w/?token=x',
  ]) assert.equal(okEndpoint(ok), true, ok);
  for (const bad of [
    'https://evil.example.com/x', 'https://172.16.0.1/x', 'https://0.0.0.0/x', 'https://[::1]/x',
    'https://fcm.googleapis.com.evil.com/x', 'https://evilpush.apple.com/x', 'https://storage.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x',
  ]) assert.equal(okEndpoint(bad), false, bad);
});

test('a push never follows a redirect', () => {
  const v = vapidKeys(b64u(Buffer.alloc(32, 7)), 'mailto:a@b.co');
  const ua = createECDH('prime256v1'); ua.generateKeys();
  const { init } = pushRequest({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: b64u(ua.getPublicKey()), auth: b64u(Buffer.alloc(16, 1)) }, { title: 'x' }, v);
  assert.equal(init.redirect, 'manual');
});
