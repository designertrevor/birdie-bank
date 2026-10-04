// Close the books: a closed season keeps its totals, closing squares or rolls every line exactly,
// both phones agree, and no round changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRows } from './shared-tab.js';
import { outstanding } from './ledger.js';
import { cardCarry } from './carry.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { crewKey, netsOf, tabOf, tabsOf } from './crew-tabs.js';
import { ALL, ROLL_REASON, bookScopeName, booksOf, closeBooks, closePreview, defaultBookName, lineKey, myBookNet, openRounds, rolledIn, seasonTotals } from './books.js';
import { NOW, OCT, base, skins } from './crew-tabs.fixtures.js';
import { withClosedBooks } from './history.js';

const SAT = crewKey('sat');
let n = 0;
const makeId = () => `id${n++}`;

/** Put a close on a phone the way tab-sync.js does: the rows, the payments and the marker. */
function apply(s, res) {
  const next = applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows);
  return { ...next, books: { ...(s.books || {}), [res.book.id]: res.book } };
}
const pick = (lines, how) => Object.fromEntries(lines.map(l => [lineKey(l), how]));
const pair = (s, a, b) => outstanding(s, { now: NOW + 5000 }).filter(l => [l.from, l.to].sort().join() === [a, b].sort().join()).map(l => [l.from, l.to, l.amount]);

test('closing a crew’s books with every line paid squares its tab and takes exactly that off Everyone', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 'a'], [3, 't'], [4, 'b'], [5, 't']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a', 'c'], [[1, 'c']], { at: OCT(5) });
  let s = base([r1, r2]);
  const before = tabsOf(s, { now: NOW });
  const prev = closePreview(s, SAT, { now: NOW });
  assert.deepEqual(prev.rounds.map(r => r.id), ['r1']);
  assert.deepEqual(prev.totals, seasonTotals(s, [r1]));
  const res = closeBooks(s, SAT, { picks: pick(prev.lines, 'paid'), now: NOW, makeId });
  assert.equal(res.book.name, '2026 season');
  assert.equal(res.book.crewName, 'Saturday crew');
  assert.deepEqual(res.book.rounds, ['r1']);
  assert.ok(res.book.lines.every(l => l.how === 'paid'));
  const rounds = structuredClone(s.rounds);
  s = apply(s, res);
  assert.deepEqual(s.rounds, rounds, 'no round is rewritten');
  const after = tabsOf(s, { now: NOW + 1 });
  assert.deepEqual(tabOf(s, SAT, { now: NOW + 1 }).lines, []);
  const moved = {};
  for (const [id, c] of Object.entries(before.everyone.balances)) moved[id] = c - (after.everyone.balances[id] || 0);
  for (const k of Object.keys(moved)) if (!moved[k]) delete moved[k];
  assert.deepEqual(moved, before.tabs.find(t => t.key === SAT).balances);
});

test('rolled lines stay owed into the next season, exactly, and the next season starts after the close', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'b']], { at: OCT(3) });
  let s = base([r1]);
  const prev = closePreview(s, SAT, { now: NOW });
  const linesBefore = prev.lines.map(l => [l.from, l.to, l.amount]);
  // Pay the biggest line, roll the rest
  const picks = { ...pick(prev.lines, 'rolled'), [lineKey(prev.lines[0])]: 'paid' };
  const res = closeBooks(s, SAT, { picks, now: NOW, makeId });
  s = apply(s, res);
  const left = tabOf(s, SAT, { now: NOW + 1 }).lines.map(l => [l.from, l.to, l.amount]);
  assert.deepEqual(left, linesBefore.slice(1), 'what was rolled is what’s owed, to the cent');
  assert.equal(rolledIn(s, SAT), res.book.lines.filter(l => l.how === 'rolled').reduce((c, l) => c + (l.to === 't' ? l.cents : l.from === 't' ? -l.cents : 0), 0));
  assert.deepEqual(openRounds(s, SAT, { now: NOW + 1 }), [], 'a new season, no rounds yet');
  const r2 = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(22) });
  s = { ...s, rounds: { ...s.rounds, r2 } };
  assert.deepEqual(openRounds(s, SAT, { now: OCT(23) }).map(r => r.id), ['r2']);
  assert.equal(closePreview(s, SAT, { now: OCT(23) }).since, NOW, 'the season runs from the last close');
  assert.equal(defaultBookName(s, SAT, OCT(23)), '2026 season 2');
  assert.equal(defaultBookName(s, ALL, OCT(23)), '2026 season', 'each tab names its own');
});

test('a rolled line with someone you shared a round live with asks them to roll it, and their phone sees the ask', () => {
  const r1 = skins('r1', ['t', 'a'], [[1, 't'], [2, 't'], [3, 't']], { at: OCT(12), code: 'CRW001' });
  let mine = base([r1]);
  let theirs = { ...base([structuredClone(r1)]), me: 'a', crews: {} };
  const tabBefore = [outstanding(mine, { now: NOW }), outstanding(theirs, { now: NOW })];
  const prev = closePreview(mine, SAT, { now: NOW });
  const res = closeBooks(mine, SAT, { picks: pick(prev.lines, 'rolled'), now: NOW, makeId });
  assert.equal(res.carries.length, 1);
  assert.equal(res.carries[0].reason, ROLL_REASON);
  assert.ok(res.rows.every(r => r.kind === 'carry' && r.code === 'CRW001'));
  mine = apply(mine, res);
  theirs = applyRows(theirs, res.rows);
  const ask = cardCarry(theirs, 'a', 't', { from: 'a', to: 't', amount: 6 }, NOW + 1);
  assert.equal(ask?.status, 'asked');
  assert.equal(ask.amount, 6);
  assert.equal(ask.reason, ROLL_REASON);
  assert.deepEqual([outstanding(mine, { now: NOW }), outstanding(theirs, { now: NOW })], tabBefore, 'rolling moves no money on either phone');
  // Closing again with the ask still open doesn't ask twice
  const again = closeBooks(mine, SAT, { picks: pick(closePreview(mine, SAT, { now: NOW + 2 }).lines, 'rolled'), now: NOW + 2, makeId });
  assert.equal(again.carries.length, 0);
  // With the shared Tab off, a rolled line is only kept in the book
  const offline = closeBooks(base([structuredClone(r1)]), SAT, { now: NOW, ask: false, makeId });
  assert.deepEqual([offline.carries, offline.rows], [[], []]);
  assert.equal(offline.book.lines[0].how, 'rolled');
});

test('closing the whole Tab with every line paid leaves it square, and the friend’s phone agrees', () => {
  const shared = skins('r1', ['t', 'a', 'b'], [[1, 'a'], [2, 'a'], [3, 't']], { at: OCT(12), code: 'ALL001' });
  const local = skins('r2', ['t', 'a', 'c'], [[1, 't'], [2, 'c']], { at: OCT(14) });
  let mine = base([shared, local]);
  let theirs = { ...base([structuredClone(shared)]), me: 'a', crews: {} };
  const prev = closePreview(mine, ALL, { now: NOW });
  assert.deepEqual(prev.lines, outstanding(mine, { now: NOW }));
  const res = closeBooks(mine, ALL, { picks: pick(prev.lines, 'paid'), now: NOW, makeId });
  assert.equal(res.book.scope, ALL);
  assert.equal(bookScopeName(mine, res.book), 'Everyone');
  mine = apply(mine, res);
  theirs = applyRows(theirs, res.rows);
  assert.deepEqual(outstanding(mine, { now: NOW + 1 }), []);
  assert.deepEqual(pair(theirs, 'a', 't'), [], 'square on the friend’s phone too');
  assert.deepEqual(netsOf(outstanding(mine, { now: NOW + 1 })), {});
});

test('a closed season keeps its totals and rounds, whatever happens to the Tab later', () => {
  const r1 = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 'a'], [3, 't']], { at: OCT(3) });
  let s = base([r1]);
  const res = closeBooks(s, SAT, { name: '  Fall   league ', now: NOW, makeId });
  s = apply(s, res);
  const [book] = booksOf(s);
  assert.equal(book.name, 'Fall league');
  assert.equal(myBookNet(s, book), seasonTotals(s, [r1]).find(t => t.id === 't').cents);
  assert.deepEqual(book.totals.map(t => t.name), book.totals.map(t => t.id.toUpperCase()));
  // The crew is renamed, then deleted: the season still says who it was for
  s = { ...s, crews: { sat: { ...s.crews.sat, name: 'Sunday crew' } } };
  assert.equal(bookScopeName(s, book), 'Sunday crew');
  s = { ...s, crews: {} };
  assert.equal(bookScopeName(s, book), 'Saturday crew');
  assert.deepEqual(booksOf(s, ALL), []);
});

test('closed seasons ride in your profile, and an older profile without them keeps this phone’s', () => {
  const s = base([skins('r1', ['t', 'a'], [[1, 't']], { at: OCT(3) })]);
  const res = closeBooks(s, SAT, { now: NOW, makeId });
  const withBook = apply(s, res);
  const doc = toDocs(withBook)['profile:me'].data;
  assert.deepEqual(doc.books, withBook.books);
  const draft = structuredClone({ ...s, books: {} });
  applyDoc(draft, 'profile', 'me', doc);
  assert.deepEqual(draft.books, withBook.books);
  const older = { ...doc };
  delete older.books;
  applyDoc(draft, 'profile', 'me', older);
  assert.deepEqual(draft.books, withBook.books);
});

test('History puts a closed season in among the month’s rounds, where it closed', () => {
  const r1 = skins('r1', ['t', 'a'], [[1, 't']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(12) });
  const book = { id: 'b1', closedAt: OCT(8), name: '2026 season' };
  const items = withClosedBooks([r2, r1], [book, { id: 'b2', closedAt: OCT(40), name: 'later' }], '2026-10', { kind: 'all' }, ['2026-11', '2026-10']);
  assert.deepEqual(items.map(x => x.round?.id || x.book.id), ['r2', 'b1', 'r1']);
  assert.deepEqual(withClosedBooks([r2, r1], [book], '2026-10', { kind: 'custom', from: '2026-10-10', to: '2026-10-31' }).map(x => x.round?.id || x.book.id), ['r2', 'r1'], 'outside the range on show');
  assert.deepEqual(withClosedBooks([r1], [{ id: 'b3', closedAt: OCT(1), name: 'x' }], '2026-10').map(x => x.round?.id || x.book.id), ['r1', 'b3']);
  // Closed in November with no November rounds on show: at the top of October, the newest month before it
  const nov = { id: 'b4', closedAt: new Date(2026, 10, 3).getTime(), name: 'fall' };
  assert.deepEqual(withClosedBooks([r2, r1], [nov], '2026-10', { kind: 'all' }, ['2026-10', '2026-09']).map(x => x.round?.id || x.book.id), ['b4', 'r2', 'r1']);
  assert.deepEqual(withClosedBooks([r1], [nov], '2026-09', { kind: 'all' }, ['2026-10', '2026-09']).map(x => x.round?.id || x.book.id), ['r1'], 'only once');
  // Closed before every month on show: at the bottom of the oldest
  const aug = { id: 'b5', closedAt: new Date(2026, 7, 3).getTime(), name: 'summer' };
  assert.deepEqual(withClosedBooks([r1], [aug], '2026-09', { kind: 'all' }, ['2026-10', '2026-09']).map(x => x.round?.id || x.book.id), ['r1', 'b5']);
});
