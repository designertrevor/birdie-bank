import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_MAX_AGE, PLACE_MAX_AGE, keptFor, placeToSave, plainJSON, readPlace } from './place.js';

const SCREENS = ['play', 'roundDetail', 'plan', 'preview', 'rollCall', 'challenge', 'trip', 'tripSettle', 'newRound', 'person', 'settings', 'stats'];
const TABS = ['upnext', 'ledger', 'history', 'people'];
const NOW = 1_800_000_000_000;
const state = {
  onboarded: true,
  rounds: { r1: { id: 'r1', status: 'active' }, r2: { id: 'r2', status: 'done' } },
  plans: { p1: { id: 'p1' } },
  challenges: { c1: { id: 'c1' } },
};
const opts = { now: NOW, screens: SCREENS, tabs: TABS };
// Saved, then read back the way a reload does (through JSON)
const roundTrip = (place, at = NOW - 60000) => JSON.parse(JSON.stringify(placeToSave({ ...place, at })));

test('a reload mid-round comes back to the hole: the play screen, its open sheet and the typed score', () => {
  const saved = roundTrip({
    tab: 'upnext',
    stack: [{ name: 'play', params: { id: 'r1' }, key: 11 }],
    kept: { '11|hole:a:card': true, '11|hole:a:fixSheet': 'hole' },
    maps: { drafts: { 'r1:4': { draft: { me: 5, sam: 3 }, base: { me: 4, sam: 4 }, touched: { me: true, sam: true }, dirty: true, marks: null } } },
  });
  const back = readPlace(saved, state, opts);
  assert.deepEqual(back.stack, [{ name: 'play', params: { id: 'r1' }, key: 11 }]);
  assert.equal(back.tab, 'upnext');
  assert.deepEqual(back.kept, { '11|hole:a:card': true, '11|hole:a:fixSheet': 'hole' });
  assert.deepEqual(back.maps.drafts['r1:4'].draft, { me: 5, sam: 3 });
  assert.equal(back.maps.drafts['r1:4'].dirty, true);
});

test('a half-filled trip expense comes back with the trip screen, on the tab it was left on', () => {
  const saved = roundTrip({
    tab: 'ledger',
    stack: [{ name: 'trip', params: { id: 't1', view: 'expenses' }, key: 7 }],
    kept: { '7|trip:view': 'expenses', '7|expenses:open': 'new', '7|expense:new:what': 'Dinner', '7|expense:new:amount': '84.5', '7|expense:new:in': ['me', 'sam'] },
  });
  const back = readPlace(saved, state, opts);
  assert.equal(back.tab, 'ledger');
  assert.equal(back.stack[0].params.view, 'expenses');
  assert.equal(back.kept['7|expense:new:what'], 'Dinner');
  assert.equal(back.kept['7|expense:new:amount'], '84.5');
  assert.deepEqual(back.kept['7|expense:new:in'], ['me', 'sam']);
});

test('the screens under the top one come back too, in order, so back still walks them', () => {
  const saved = roundTrip({ tab: 'history', stack: [
    { name: 'roundDetail', params: { id: 'r2' }, key: 1 },
    { name: 'person', params: { id: 'sam' }, key: 2 },
    { name: 'stats', params: { range: { kind: 'all' } }, key: 3 },
  ] });
  assert.deepEqual(readPlace(saved, state, opts).stack.map(e => e.name), ['roundDetail', 'person', 'stats']);
});

test('a place older than four hours is stale: the next morning opens on Up next', () => {
  const saved = roundTrip({ tab: 'ledger', stack: [{ name: 'settings', params: {}, key: 1 }], kept: { '1|x': 1 } }, NOW - PLACE_MAX_AGE - 1);
  assert.equal(readPlace(saved, state, opts), null);
  const fresh = roundTrip({ tab: 'ledger', stack: [{ name: 'settings', params: {}, key: 1 }] }, NOW - PLACE_MAX_AGE + 1000);
  assert.equal(readPlace(fresh, state, opts).stack.length, 1);
});

test('unsaved scores outlive a stale place while their round is still going, up to a day', () => {
  const drafts = { 'r1:3': { draft: { me: 6 }, dirty: true }, 'r2:3': { draft: { me: 4 }, dirty: true } };
  const back = readPlace(roundTrip({ tab: 'upnext', stack: [{ name: 'play', params: { id: 'r1' }, key: 1 }], maps: { drafts } }, NOW - PLACE_MAX_AGE - 60000), state, opts);
  assert.deepEqual(back.stack, []);
  assert.equal(back.tab, null);
  // The finished round's draft is dropped, the live one's kept
  assert.deepEqual(Object.keys(back.maps.drafts), ['r1:3']);
  assert.equal(readPlace(roundTrip({ tab: 'upnext', maps: { drafts } }, NOW - DRAFT_MAX_AGE - 1), state, opts), null);
});

test('a round finished or deleted since is not brought back: the stack stops under it', () => {
  const saved = roundTrip({ tab: 'upnext', stack: [
    { name: 'plan', params: { id: 'p1' }, key: 1 },
    { name: 'play', params: { id: 'r2' }, key: 2 }, // finished on another phone
    { name: 'settings', params: {}, key: 3 },
  ], kept: { '1|a': 1, '2|b': 2, '3|c': 3 } });
  const back = readPlace(saved, state, opts);
  assert.deepEqual(back.stack.map(e => e.name), ['plan']);
  assert.deepEqual(back.kept, { '1|a': 1 });
  const gone = roundTrip({ tab: 'upnext', stack: [{ name: 'roundDetail', params: { id: 'nope' }, key: 1 }] });
  assert.deepEqual(readPlace(gone, state, opts).stack, []);
  const planGone = roundTrip({ tab: 'upnext', stack: [{ name: 'preview', params: { id: 'p9' }, key: 1 }] });
  assert.deepEqual(readPlace(planGone, state, opts).stack, []);
});

test('setup editing a plan, or started from one, is not brought back once that plan is gone', () => {
  const at = params => roundTrip({ tab: 'upnext', stack: [{ name: 'newRound', params, key: 1 }] });
  assert.equal(readPlace(at({ edit: 'p1' }), state, opts).stack.length, 1);
  assert.equal(readPlace(at({ fromPlan: 'p1', present: ['me'] }), state, opts).stack.length, 1);
  assert.equal(readPlace(at({ ahead: true }), state, opts).stack.length, 1);
  assert.deepEqual(readPlace(at({ edit: 'p9' }), state, opts).stack, []);
  assert.deepEqual(readPlace(at({ fromPlan: 'p9', present: ['me'] }), state, opts).stack, []);
});

test('the reveal and "open Add an expense" are not played again on the way back', () => {
  const saved = roundTrip({ tab: 'history', stack: [
    { name: 'roundDetail', params: { id: 'r2', celebrate: true }, key: 1 },
    { name: 'trip', params: { id: 't1', view: 'expenses', add: 123 }, key: 2 },
  ] });
  const back = readPlace(saved, state, opts);
  assert.deepEqual(back.stack[0].params, { id: 'r2' });
  assert.deepEqual(back.stack[1].params, { id: 't1', view: 'expenses' });
});

test('an unknown screen name or tab (an older version saved it) is left out', () => {
  const saved = roundTrip({ tab: 'season-old', stack: [{ name: 'gone', params: {}, key: 1 }, { name: 'settings', params: {}, key: 2 }] });
  assert.equal(readPlace(saved, state, opts), null);
});

test('nothing comes back before setup is done, or from junk in storage', () => {
  const saved = roundTrip({ tab: 'ledger', stack: [{ name: 'settings', params: {}, key: 1 }] });
  assert.equal(readPlace(saved, { ...state, onboarded: false }, opts), null);
  assert.equal(readPlace(null, state, opts), null);
  assert.equal(readPlace('x', state, opts), null);
  assert.equal(readPlace({ at: 'soon' }, state, opts), null);
  assert.equal(readPlace({ at: NOW + 60000, tab: 'ledger' }, state, opts), null); // a clock that went back
});

test('a screen pushed with a callback is where the saved stack ends', () => {
  const saved = placeToSave({ tab: 'upnext', at: NOW, stack: [
    { name: 'settings', params: {}, key: 1 },
    { name: 'newRound', params: { onDone: () => {} }, key: 2 },
    { name: 'person', params: { id: 'x' }, key: 3 },
  ] });
  assert.deepEqual(saved.stack.map(e => e.name), ['settings']);
});

test('kept values that are not plain JSON are not written', () => {
  const saved = placeToSave({ tab: 'upnext', at: NOW, stack: [], kept: { '1|a': new Set([1]), '1|b': [1, 2], '1|c': undefined, '1|d': NaN } });
  assert.deepEqual(saved.kept, { '1|b': [1, 2] });
});

test('plainJSON accepts what JSON keeps and refuses the rest', () => {
  assert.equal(plainJSON({ a: [1, 'x', null, { b: true }], c: undefined }), true);
  assert.equal(plainJSON(new Map()), false);
  assert.equal(plainJSON(() => 1), false);
  assert.equal(plainJSON(Infinity), false);
  assert.equal(plainJSON(new Date()), false);
});

test('closing a screen drops its kept values; the tab and the screens still open keep theirs', () => {
  const kept = { '1|a': 1, '2|b': 2, 'tab:ledger|open': 'sam', 'tab:history|filter': 'won' };
  assert.deepEqual(keptFor(kept, [1, 'tab:ledger']), { '1|a': 1, 'tab:ledger|open': 'sam' });
});

test('a plan link comes back only when its plan is on this phone, so a dead link never sticks', () => {
  const screens = [...SCREENS, 'planLink'];
  const saved = roundTrip({ tab: 'upnext', stack: [{ name: 'planLink', params: { code: 'ZZZZ99' }, key: 1 }] });
  assert.deepEqual(readPlace(saved, state, { ...opts, screens })?.stack ?? [], [], 'Plan not found: Up next');
  const found = { ...state, plans: { ...(state.plans || {}), p9: { id: 'p9', code: 'ZZZZ99' } } };
  assert.deepEqual(readPlace(saved, found, { ...opts, screens }).stack.map(e => e.name), ['planLink']);
});
