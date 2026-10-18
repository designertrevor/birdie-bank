// Odd names (ROADMAP area 25): apostrophes, accents, emoji and long names come through whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialsOf } from './avatars.js';
import { shortNames } from './short-names.js';
import { firstName } from './format.js';

const lone = s => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

test('initials keep an emoji whole', () => {
  assert.equal(initialsOf('🦅 Eagle'), '🦅');
  assert.equal(initialsOf('Sam 🦅', 2), 'S🦅');
  assert.equal(initialsOf("Seán O'Brien", 2), 'SO');
  assert.equal(initialsOf('élodie'), 'É');
  assert.ok(!lone(initialsOf('😀')));
});

test('short names with a shared first name keep an emoji last name whole', () => {
  const out = shortNames([['a', 'Sam 🦅'], ['b', 'Sam Gill']]);
  assert.equal(out.get('a'), 'Sam 🦅');
  assert.equal(out.get('b'), 'Sam G');
  for (const v of out.values()) assert.ok(!lone(v));
});

test("apostrophes, accents and right-to-left names pass through unchanged", () => {
  const out = shortNames([['a', "D'Angelo Russo"], ['b', 'José Núñez'], ['c', 'נועם כהן']]);
  assert.equal(out.get('a'), "D'Angelo");
  assert.equal(out.get('b'), 'José');
  assert.equal(out.get('c'), 'נועם');
  assert.equal(firstName("  O'Brien  "), "O'Brien");
});
