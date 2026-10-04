import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACE_KEY } from './place.js';

// kept.js saves to localStorage: a stand-in for node, filled the way a phone left it
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const state = { onboarded: true, rounds: { r1: { id: 'r1', status: 'active' } }, plans: {}, challenges: {} };
const names = { screens: ['play', 'settings', 'trip'], tabs: ['upnext', 'ledger'] };
const wait = ms => new Promise(r => setTimeout(r, ms));
store.set(PLACE_KEY, JSON.stringify({
  at: Date.now() - 5 * 60000, // five minutes in the GPS app
  tab: 'upnext',
  stack: [{ name: 'play', params: { id: 'r1' }, key: 42 }],
  kept: { '42|hole:x:menu': true, '99|old': 1 },
  maps: { drafts: { 'r1:7': { draft: { me: 3 }, dirty: true } } },
}));
const { forgetPlace, keptMap, notePlace, startPlace } = await import('./kept.js');

test('launch after the phone dropped the page: the same screen, its typed score, then saving as it changes', async () => {
  const back = startPlace(state, names);
  assert.deepEqual(back, { tab: 'upnext', stack: [{ name: 'play', params: { id: 'r1' }, key: 42 }] });
  const drafts = keptMap('drafts');
  assert.deepEqual(drafts.get('r1:7').draft, { me: 3 });
  assert.deepEqual(drafts.keys(), ['r1:7']);

  // The next hole's typing is saved too, without waiting for the app to go to the background
  notePlace('upnext', back.stack);
  drafts.set('r1:8', { draft: { me: 5 }, dirty: true });
  await wait(450);
  const saved = JSON.parse(store.get(PLACE_KEY));
  assert.deepEqual(saved.stack, back.stack);
  assert.deepEqual(saved.kept, { '42|hole:x:menu': true }); // the closed screen's value went with it
  assert.deepEqual(Object.keys(saved.maps.drafts).sort(), ['r1:7', 'r1:8']);

  // Leaving the round's screen keeps its unsaved scores (they're the round's, not the screen's)
  notePlace('ledger', []);
  drafts.delete('r1:7');
  await wait(450);
  const after = JSON.parse(store.get(PLACE_KEY));
  assert.equal(after.tab, 'ledger');
  assert.deepEqual(after.stack, []);
  assert.deepEqual(after.kept, {});
  assert.deepEqual(Object.keys(after.maps.drafts), ['r1:8']);
});

test('after a crash the place is forgotten, so the next launch opens on Up next', async () => {
  forgetPlace();
  assert.equal(store.has(PLACE_KEY), false);
  keptMap('drafts').set('r1:9', { draft: { me: 4 } });
  await wait(450);
  assert.equal(store.has(PLACE_KEY), false); // nothing written until a screen changes
  notePlace('upnext', []);
  await wait(450);
  assert.equal(store.has(PLACE_KEY), true);
});
