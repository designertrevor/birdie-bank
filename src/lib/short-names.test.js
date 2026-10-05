// Short names: first names unless two people share one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortNames } from './short-names.js';

test('first names, with a last initial or the whole name where two people share a first name', () => {
  const s = shortNames([['a', 'Sam Ortiz'], ['b', 'Sam Guest'], ['c', 'Mike Hill'], ['d', 'Dave']]);
  assert.deepEqual([...s.values()], ['Sam O', 'Sam G', 'Mike', 'Dave']);
  const same = shortNames([['a', 'Sam Ortiz'], ['b', 'Sam Owens'], ['c', 'sam']]);
  assert.deepEqual([...same.values()], ['Sam Ortiz', 'Sam Owens', 'sam']);
  assert.equal(shortNames([['x', '  ']], 'Player').get('x'), 'Player');
});
