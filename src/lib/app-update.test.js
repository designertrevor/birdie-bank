import test from 'node:test';
import assert from 'node:assert/strict';
import { openedFromLink, roundHoldsUpdate, updateAction, updateSafe } from './app-update.js';

const rounds = (...list) => ({ rounds: Object.fromEntries(list.map((r, i) => [`r${i}`, { id: `r${i}`, ...r }])) });

test('a round being played keeps the update waiting', () => {
  assert.equal(updateSafe(rounds({ status: 'active' })), false);
  assert.equal(roundHoldsUpdate({ status: 'active' }), true);
});

test('a round you are only watching keeps it waiting too', () => {
  assert.equal(updateSafe(rounds({ status: 'active', shared: { code: 'ABCD', host: false }, localMe: null })), false);
});

test('a finished round reopened to fix scores keeps it waiting', () => {
  assert.equal(updateSafe(rounds({ status: 'done', editing: true })), false);
});

test('finished rounds alone are safe, and so is a phone with no rounds at all', () => {
  assert.equal(updateSafe(rounds({ status: 'done' }, { status: 'done', finishedAt: 5 })), true);
  assert.equal(updateSafe({ rounds: {} }), true);
  assert.equal(updateSafe({}), true);
  assert.equal(updateSafe(null), true);
});

test('one round in progress among finished ones is enough to wait', () => {
  assert.equal(updateSafe(rounds({ status: 'done' }, { status: 'active' }, { status: 'done' })), false);
});

test('a new version mid-round always waits, launching or not', () => {
  assert.equal(updateAction({ waiting: true, safe: false }), 'wait');
  assert.equal(updateAction({ waiting: true, safe: false, launching: true }), 'wait');
});

test('with no round going, it applies at launch and is offered otherwise', () => {
  assert.equal(updateAction({ waiting: true, safe: true, launching: true }), 'apply');
  assert.equal(updateAction({ waiting: true, safe: true }), 'offer');
});

test('nothing to do when no new version is waiting', () => {
  assert.equal(updateAction({ waiting: false, safe: true, launching: true }), 'wait');
  assert.equal(updateAction({ waiting: false, safe: true }), 'wait');
});

test('opened from a join, plan or sign-in link, it never reloads at launch (the link would be lost)', () => {
  assert.equal(updateAction({ waiting: true, safe: true, launching: true, fromLink: true }), 'offer');
  assert.equal(openedFromLink('?join=ABCD', ''), true);
  assert.equal(openedFromLink('?plan=WXYZ&p=2', ''), true);
  assert.equal(openedFromLink('?code=abc', ''), true);
  assert.equal(openedFromLink('', '#access_token=abc'), true);
  assert.equal(openedFromLink('', ''), false);
  assert.equal(openedFromLink('?', '#'), false);
});
