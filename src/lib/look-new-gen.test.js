// The new look's generated half (look-new.gen.css) matches styles.css: a change to an older rule's
// display face, weight or corners, or a merge that brings one in, needs the file written again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, OUT } from '../../scripts/look-new-css.mjs';

test('look-new.gen.css is up to date with styles.css (else run: node scripts/look-new-css.mjs)', () => {
  const saved = readFileSync(new URL(`../../${OUT}`, import.meta.url), 'utf8');
  assert.ok(saved === generate().css, 'look-new.gen.css is stale: run node scripts/look-new-css.mjs');
});

test('every new-look rule is scoped to the new look, so ?look=classic is today’s app', () => {
  for (const f of ['look-new.css', 'look-new.gen.css']) {
    const css = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
    for (const m of css.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
      for (const sel of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
        if (/^\(prefers-color-scheme/.test(sel)) continue;
        assert.match(sel, /^:root\[data-look="new"\]/, `${f}: ${sel}`);
      }
    }
  }
});
