import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchMoment } from './moments.js';
import { nassauLegs } from './golf.js';

const MATCH = { match: { start: 1, end: 18, label: 'Match' } };
const NASSAU = nassauLegs(18);
const names = ['Trevor', 'Dave'];
// Winners by position from a list: 0, 1 or null (halved)
const w = list => Object.fromEntries(list.map((x, i) => [i + 1, x]));

test('taking the lead from all square, and extending it is quiet', () => {
  const m = matchMoment(w([0]), 1, MATCH, { names });
  assert.equal(m.kind, 'lead');
  assert.equal(m.title, 'Trevor takes the lead');
  assert.equal(m.text, '1 up');
  assert.equal(matchMoment(w([0, 0]), 2, MATCH, { names }), null);
  assert.equal(matchMoment(w([0, null]), 2, MATCH, { names }), null);
});

test('all square after trailing, then a lead change', () => {
  const sq = matchMoment(w([0, 1]), 2, MATCH, { names, holeNo: 2 });
  assert.equal(sq.kind, 'square');
  assert.equal(sq.text, 'Dave wins 2 to square it');
  const ch = matchMoment(w([0, 1, null, 1]), 4, MATCH, { names });
  assert.equal(ch.kind, 'change');
  assert.equal(ch.title, 'Lead change');
  assert.equal(ch.text, 'Dave goes 1 up');
  // Retaking your own lead after it was squared is just taking the lead
  assert.equal(matchMoment(w([0, 1, 0]), 3, MATCH, { names }).kind, 'lead');
});

test('dormie, then the match won early is the big moment', () => {
  // 3 up after 15: dormie
  const fifteen = [0, 0, 0, ...Array(12).fill(null)];
  const d = matchMoment(w(fifteen), 15, MATCH, { names });
  assert.equal(d.kind, 'dormie');
  assert.equal(d.text, 'Trevor is 3 up with 3 to play. Dave has to win every hole.');
  // Halving 16 closes it out 3&2
  const won = matchMoment(w([...fifteen, null]), 16, MATCH, { names });
  assert.equal(won.kind, 'won');
  assert.equal(won.level, 'big');
  assert.equal(won.whole, true);
  assert.equal(won.title, 'Trevor wins the match');
  assert.equal(won.text, '3&2');
  // After that, nothing: the match is decided
  assert.equal(matchMoment(w([...fifteen, null, 1]), 17, MATCH, { names }), null);
});

test('teams read as plural', () => {
  const m = matchMoment(w([1]), 1, MATCH, { names: ['Ann & Bo', 'Cy & Di'], plural: [true, true] });
  assert.equal(m.title, 'Cy & Di take the lead');
});

test('Nassau: a nine won is a medium moment, the total wins ties', () => {
  // Front and total move together: taking the lead reports it once, on the total
  const first = matchMoment(w([0]), 1, NASSAU, { names });
  assert.equal(first.leg, 'total');
  assert.equal(first.text, '1 up on the total');
  // 1 up through 8, halve 9: the front 9 is won 1 up (medium), the total only moves quietly
  const nine = matchMoment(w([0, null, null, null, null, null, null, null, null]), 9, NASSAU, { names });
  assert.equal(nine.kind, 'won');
  assert.equal(nine.leg, 'front');
  assert.equal(nine.level, 'medium');
  assert.equal(nine.title, 'Trevor wins the front 9');
  assert.equal(nine.text, '1 up');
  // 2 up with one to play closes the front out 2&1 on the 8th
  assert.equal(matchMoment(w([0, 0, null, null, null, null, null, null]), 8, NASSAU, { names }).text, '2&1');
  // A halved front nine
  const halved = matchMoment(w([0, 1, null, null, null, null, null, null, null]), 9, NASSAU, { names });
  assert.equal(halved.kind, 'halved');
  assert.equal(halved.title, 'The front 9 is halved');
});

test('Nassau: a lead change on the back that squares the total picks the bigger moment', () => {
  // Trevor 1 up on the total after 9 (won hole 1); Dave wins 10: back goes Dave 1 up, total goes all square
  const nine = [0, ...Array(8).fill(null)];
  const m = matchMoment(w([...nine, 1]), 10, NASSAU, { names, holeNo: 10 });
  assert.equal(m.kind, 'square');
  assert.equal(m.leg, 'total');
  assert.equal(m.text, 'Dave wins 10 to square it on the total');
});

test('no moment for a hole not scored yet', () => {
  assert.equal(matchMoment({}, 1, MATCH, { names }), null);
});
