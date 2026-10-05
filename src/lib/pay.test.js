import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanHandle, handleText, payFields, payInfo, payInfoFor, payLink, remindText, requestLink } from './pay.js';

test('pay: handles are cleaned for each app', () => {
  assert.equal(cleanHandle('venmo', ' @trev-n '), 'trev-n');
  assert.equal(cleanHandle('venmo', 'https://venmo.com/u/trev-n'), 'trev-n');
  assert.equal(cleanHandle('cashapp', '$trevn'), 'trevn');
  assert.equal(cleanHandle('cashapp', 'https://cash.app/$trevn'), 'trevn');
  assert.equal(cleanHandle('paypal', 'paypal.me/TrevN'), 'TrevN');
  assert.equal(cleanHandle('zelle', ' trev@example.com '), 'trev@example.com');
  assert.equal(cleanHandle('zelle', '(555) 123-4567'), '(555) 123-4567');
});

test('pay: the old Venmo field still counts, and a chosen app wins', () => {
  assert.deepEqual(payInfo({ venmo: 'old' }), { app: 'venmo', handle: 'old' });
  assert.deepEqual(payInfo({ venmo: 'old', payApp: 'cashapp', payHandle: 'new' }), { app: 'cashapp', handle: 'new' });
  assert.equal(payInfo({ payApp: 'zelle', payHandle: '' }), null);
  assert.equal(payInfo(null), null);
  assert.deepEqual(payFields({ payApp: 'paypal', payHandle: 'x' }), { payApp: 'paypal', payHandle: 'x' });
  assert.deepEqual(payFields({}), {});
});

test('pay: links open the payee\'s own app, and Zelle has none', () => {
  assert.equal(payLink({ app: 'venmo', handle: 'mike' }, 12, 'Skins'), 'https://venmo.com/mike?txn=pay&amount=12.00&note=Skins');
  assert.equal(payLink({ app: 'cashapp', handle: 'mike' }, 7.5), 'https://cash.app/$mike/7.50');
  assert.equal(payLink({ app: 'paypal', handle: 'mike' }, 20), 'https://paypal.me/mike/20.00USD');
  assert.equal(payLink({ app: 'zelle', handle: 'mike@x.com' }, 20), null);
  assert.equal(handleText({ app: 'cashapp', handle: 'mike' }), '$mike');
});

test('pay: only Venmo can prefill a request', () => {
  assert.match(requestLink({ app: 'venmo', handle: 'dave' }, { app: 'venmo', handle: 'me' }, 5), /venmo\.com\/dave\?txn=charge&amount=5\.00/);
  assert.ok(requestLink({ app: 'venmo', handle: 'dave' }, null, 5), 'no app picked yet still gets a request');
  assert.equal(requestLink({ app: 'venmo', handle: 'dave' }, { app: 'zelle', handle: 'me' }, 5), null);
  assert.equal(requestLink({ app: 'cashapp', handle: 'dave' }, null, 5), null);
});

test('pay: a joined round carries handles for people who aren\'t in your players', () => {
  const state = {
    players: { me: { id: 'me', name: 'Me' } },
    rounds: {
      old: { createdAt: 1, players: [{ id: 'mike', payApp: 'venmo', payHandle: 'old-mike' }] },
      new: { createdAt: 2, players: [{ id: 'mike', payApp: 'cashapp', payHandle: 'mike' }] },
    },
  };
  assert.deepEqual(payInfoFor(state, 'mike'), { app: 'cashapp', handle: 'mike' });
  assert.equal(payInfoFor(state, 'me'), null);
});

test('pay: the reminder names the amount and how to pay', () => {
  const t = remindText({ name: 'Dave Smith', amount: 12, mine: { app: 'cashapp', handle: 'trev' } });
  assert.match(t, /^Hey Dave, /);
  assert.match(t, /you owe me \$12\./);
  assert.match(t, /Cash App: https:\/\/cash\.app\/\$trev\/12\.00/);
  assert.match(remindText({ name: 'Dave', amount: 5, mine: { app: 'zelle', handle: 't@x.com' } }), /Zelle: t@x\.com/);
  assert.doesNotMatch(remindText({ name: 'Dave', amount: 5, mine: null }), /Venmo/);
  assert.doesNotMatch(t, /Birdie Bank/, 'the app’s name is a codename for now: never in a text that goes out');
});
