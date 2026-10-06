import test from 'node:test';
import assert from 'node:assert/strict';
import { claimCard, endUpNextVisit, getSlot, shippedNone, upNextCard } from './upnext-card.js';

test('It shipped goes ahead of What’s new when both have something', () => {
  assert.equal(upNextCard({ shipped: 'ready', whatsNew: true }), 'shipped');
  assert.equal(upNextCard({ shipped: 'none', whatsNew: true }), 'whatsNew');
  assert.equal(upNextCard({ shipped: 'none', whatsNew: false }), null);
});

test('What’s new waits while It shipped is still finding out', () => {
  assert.equal(upNextCard({ shipped: 'pending', whatsNew: true }), null);
  assert.equal(upNextCard(), null);
});

test('the card on screen keeps the visit: nothing swaps in after it', () => {
  assert.equal(upNextCard({ showing: 'whatsNew', shipped: 'ready', whatsNew: true }), 'whatsNew');
  assert.equal(upNextCard({ showing: 'shipped', shipped: 'ready', whatsNew: true }), 'shipped');
});

test('one card a visit, and the other waits for the next visit', () => {
  endUpNextVisit();
  assert.equal(claimCard('whatsNew'), false); // It shipped hasn't said yet
  assert.equal(claimCard('shipped'), true);
  assert.equal(claimCard('whatsNew'), false);
  const before = getSlot();
  assert.equal(claimCard('whatsNew'), false);
  assert.equal(getSlot(), before); // asking again changes nothing
  endUpNextVisit();
  shippedNone();
  assert.equal(claimCard('whatsNew'), true);
  assert.equal(claimCard('shipped'), false); // came late: told next visit
  endUpNextVisit();
  assert.deepEqual(getSlot(), { showing: null, shipped: 'pending', whatsNew: false });
});
