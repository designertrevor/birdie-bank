import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_TITLES, cardNotes, cleanSeen, firstSeen, markSeen, monthLabel, newSince, releaseGroups, shippedItems } from './whats-new.js';
import { publicRoadmap } from './roadmap-public.js';

const item = (id, status, shipped = null, order = 0) => ({ id, title: `Item ${id}`, status, shipped, order });
const V1 = [item('a', 'shipped', '2026-09-01', 0), item('b', 'shipped', '2026-09-20', 1), item('c', 'planned', null, 2)];
// The next build: c shipped, and d was checked off late with an older date
const V2 = [item('a', 'shipped', '2026-09-01', 0), item('b', 'shipped', '2026-09-20', 1), item('c', 'shipped', '2026-10-05', 2), item('d', 'shipped', '2026-08-15', 3)];
const NOW = Date.parse('2026-10-06T12:00:00Z');

test('only shipped items, newest first, undated ones last', () => {
  const ids = shippedItems([...V2, item('e', 'shipped', null, 4), item('f', 'progress')]).map(i => i.id);
  assert.deepEqual(ids, ['c', 'b', 'a', 'd', 'e']);
});

test('someone new to the app has nothing to catch up on', () => {
  const rec = firstSeen(V1, { now: NOW });
  assert.deepEqual(newSince(V1, rec), []);
  assert.equal(cardNotes(V1, rec), null);
});

test('someone who already had rounds hears about the last two weeks once', () => {
  const rec = firstSeen(V2, { returning: true, now: NOW });
  assert.deepEqual(newSince(V2, rec).map(i => i.id), ['c']);
});

test('an update with newly shipped items shows them once, then never again', () => {
  const rec = markSeen(V1, NOW);
  const card = cardNotes(V2, rec);
  assert.deepEqual(card.items.map(i => i.id), ['c', 'd']);
  assert.equal(card.more, 0);
  const after = markSeen(V2, NOW);
  assert.equal(cardNotes(V2, after), null);
});

test('an item checked off late with an older date still counts as new', () => {
  assert.ok(newSince(V2, markSeen(V1)).some(i => i.id === 'd'));
});

test('never during a round, and the card waits for the round to end', () => {
  const rec = markSeen(V1, NOW);
  assert.equal(cardNotes(V2, rec, { safe: false }), null);
  assert.ok(cardNotes(V2, rec, { safe: true }));
});

test('no record yet means nothing to show until one is set up', () => {
  assert.equal(cardNotes(V2, cleanSeen(null)), null);
  assert.deepEqual(newSince(V2, { seen: null }), []);
});

test('the card names a few and counts the rest', () => {
  const many = Array.from({ length: 7 }, (_, i) => item(`n${i}`, 'shipped', `2026-10-0${i + 1}`, i));
  const card = cardNotes(many, { seen: [], at: 0 });
  assert.equal(card.items.length, CARD_TITLES);
  assert.equal(card.more, 7 - CARD_TITLES);
  assert.equal(card.items[0].id, 'n6');
});

test('a stored record is read back safely', () => {
  assert.deepEqual(cleanSeen(undefined), { seen: null, at: 0 });
  assert.deepEqual(cleanSeen('junk'), { seen: null, at: 0 });
  assert.deepEqual(cleanSeen({ seen: ['a', 4, null], at: '9' }), { seen: ['a'], at: 9 });
});

test('the screen groups by month and marks what is new', () => {
  const groups = releaseGroups(V2, markSeen(V1));
  assert.deepEqual(groups.map(g => g.label), ['October 2026', 'September 2026', 'August 2026']);
  assert.equal(groups[0].items[0].fresh, true);
  assert.equal(groups[1].items[0].fresh, false);
  assert.equal(monthLabel(null), 'Earlier');
  // Opened from the Up next card, which already counted its items as seen
  const fromCard = releaseGroups(V2, markSeen(V2), cardNotes(V2, markSeen(V1)).ids);
  assert.deepEqual(fromCard.flatMap(g => g.items).filter(i => i.fresh).map(i => i.id), ['c', 'd']);
  assert.equal(monthLabel('2026-01-31'), 'January 2026');
});

test('the real roadmap gives release notes with titles and dates', () => {
  const items = publicRoadmap(readFileSync(new URL('../../ROADMAP.md', import.meta.url), 'utf8'));
  const shipped = shippedItems(items);
  assert.ok(shipped.length > 10);
  assert.ok(shipped.every(i => i.title && i.id));
  assert.ok(releaseGroups(items, markSeen(items)).every(g => g.items.every(i => !i.fresh)));
});
