// Request links for every pay app: Venmo's prefilled request, and for Cash App, PayPal and Zelle a
// message with your own pay link (or your Zelle and the amount). Amounts are always dollars to the
// cent, and nothing is asked for when there's no money (a points or reward round has none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payLink, remindText, requestFor, requestLink, requestText, zelleCopy } from './pay.js';
import { createRound, roundResults } from './round.js';
import { tabResults } from './play-for.js';

const VENMO = { app: 'venmo', handle: 'trev' };
const CASH = { app: 'cashapp', handle: 'trevn' };
const PAYPAL = { app: 'paypal', handle: 'TrevN' };
const ZELLE = { app: 'zelle', handle: 'trev@example.com' };
const DAVE_VENMO = { app: 'venmo', handle: 'dave-s' };

test('pay links: each app\'s own documented format, with the amount to the cent', () => {
  assert.equal(payLink(VENMO, 12, 'Golf'), 'https://venmo.com/trev?txn=pay&amount=12.00&note=Golf');
  assert.equal(payLink(CASH, 7.5), 'https://cash.app/$trevn/7.50');
  assert.equal(payLink(PAYPAL, 20), 'https://paypal.me/TrevN/20.00USD', 'PayPal.Me takes the currency code after the amount');
  assert.equal(payLink(PAYPAL, 0.1 + 0.2), 'https://paypal.me/TrevN/0.30USD', 'floating point never leaks into a link');
  assert.equal(payLink(CASH, 1234.567), 'https://cash.app/$trevn/1234.57');
  assert.equal(payLink(ZELLE, 20), null, 'Zelle has no link');
});

test('pay links: no money, no link', () => {
  for (const a of [0, -5, NaN, Infinity, 0.004, '12', null, undefined]) {
    assert.equal(payLink(CASH, a), null, `amount ${a}`);
    assert.equal(requestLink(DAVE_VENMO, VENMO, a), null, `request amount ${a}`);
    assert.equal(requestFor({ payer: DAVE_VENMO, mine: CASH, amount: a }), null, `requestFor amount ${a}`);
  }
});

test('requests: Venmo to Venmo is a prefilled Venmo request to the payer', () => {
  const r = requestFor({ payer: DAVE_VENMO, mine: VENMO, amount: 12, name: 'Dave Smith' });
  assert.equal(r.kind, 'link');
  assert.equal(r.app, 'venmo');
  assert.equal(r.url, 'https://venmo.com/dave-s?txn=charge&amount=12.00&note=Golf');
  // Not picked an app yet: still a Venmo request when they use Venmo
  assert.equal(requestFor({ payer: DAVE_VENMO, mine: null, amount: 5 }).kind, 'link');
});

test('requests: every other app sends your own pay link for the amount', () => {
  const cash = requestFor({ payer: DAVE_VENMO, mine: CASH, amount: 12, name: 'Dave Smith' });
  assert.equal(cash.kind, 'share');
  assert.equal(cash.app, 'cashapp');
  assert.match(cash.text, /^Hey Dave, settling up from golf: \$12 to me\./);
  assert.match(cash.text, /Cash App, already filled in: https:\/\/cash\.app\/\$trevn\/12\.00$/);

  const pp = requestFor({ payer: null, mine: PAYPAL, amount: 8.5, name: 'Ann' });
  assert.equal(pp.app, 'paypal');
  assert.match(pp.text, /\$8\.50 to me/);
  assert.match(pp.text, /PayPal, already filled in: https:\/\/paypal\.me\/TrevN\/8\.50USD$/);

  // You use Venmo but they don't (or haven't said): your Venmo pay link, since Venmo can't request from nobody
  const v = requestFor({ payer: { app: 'zelle', handle: 'd@x.com' }, mine: VENMO, amount: 3, name: 'Dave' });
  assert.equal(v.kind, 'share');
  assert.match(v.text, /Venmo, already filled in: https:\/\/venmo\.com\/trev\?txn=pay&amount=3\.00&note=Golf/);
});

test('requests: Zelle has no link, so it\'s your email or phone and the amount', () => {
  const z = requestFor({ payer: DAVE_VENMO, mine: ZELLE, amount: 15, name: 'Dave' });
  assert.equal(z.kind, 'share');
  assert.equal(z.app, 'zelle');
  assert.match(z.text, /Zelle \$15 to trev@example\.com$/);
  assert.doesNotMatch(z.text, /https?:/);
  assert.deepEqual(zelleCopy(ZELLE, 15), { copy: 'trev@example.com', label: 'Zelle $15 to trev@example.com' });
  assert.equal(zelleCopy(CASH, 15), null);
  assert.match(remindText({ name: 'Dave', amount: 15, mine: ZELLE }), /Zelle: trev@example\.com \(\$15\)/);
});

test('requests: nothing to ask with when you have no app and they don\'t use Venmo', () => {
  assert.equal(requestFor({ payer: { app: 'cashapp', handle: 'dave' }, mine: null, amount: 5 }), null);
  assert.equal(requestFor({ payer: null, mine: null, amount: 5 }), null);
  assert.equal(requestFor({ payer: null, mine: { app: 'cashapp', handle: '' }, amount: 5 }), null);
});

test('requests: a trip or Big Game note names it, and no codename goes out', () => {
  const t = requestText({ name: 'Ann Lee', amount: 40, mine: CASH, note: 'Myrtle Beach' });
  assert.match(t, /^Hey Ann, settling up from Myrtle Beach: \$40 to me\./);
  assert.doesNotMatch(t, /Birdie Bank/);
  assert.doesNotMatch(requestText({ name: '', amount: 1, mine: CASH }), /Birdie Bank/);
  assert.match(requestText({ name: '', amount: 1, mine: CASH }), /^Hey there,/);
});

// The Tab, settle-up and every request button only ever see tabResults(): a points or reward
// round has no transfers there, so no request is ever built for it
const flat9 = { id: 'f9', name: 'Flat Nine', custom: true, tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
function skins(playFor) {
  const r = createRound({ id: 'r1', game: 'skins', course: flat9, holesCount: 9, players: ['t', 'd'].map(id => ({ id, name: id, index: 0 })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { t: 3, d: 5 };
  r.status = 'done';
  if (playFor) r.playFor = playFor;
  return r;
}

test('requests: points and reward rounds never put an amount in front of a request', () => {
  const money = skins(null);
  const moneyTransfers = tabResults(money).transfers;
  assert.equal(moneyTransfers.length, 1);
  const t = moneyTransfers[0];
  assert.ok(requestFor({ mine: CASH, amount: t.amount, name: 'Dave' }), 'a money round asks');
  assert.equal(t.amount, roundResults(money).transfers[0].amount, 'and for exactly what the round says');
  for (const pf of [{ kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }]) {
    const res = tabResults(skins(pf));
    assert.equal((res?.transfers || []).length, 0, `${pf.kind}: nothing to request`);
  }
});
