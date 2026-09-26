import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, injectMeta, joinPreview } from './og.js';

const HTML = `<head>
<meta name="description" content="Default">
<meta property="og:title" content="Birdie Bank">
<meta property="og:description" content="Play any game, settle every bet.">
<meta property="og:url" content="https://birdie-bank.vercel.app/">
<meta property="og:image:alt" content="Birdie Bank">
<meta name="twitter:title" content="Birdie Bank">
<meta name="twitter:description" content="Play any game, settle every bet.">
<title>Birdie Bank</title>
</head>`;

test('joinPreview: live round names the game, course and first names', () => {
  const p = joinPreview({ game: 'skins', course: { name: 'Birch Creek' }, status: 'active', holesCount: 18, players: [{ name: 'Trevor Nielsen' }, { name: 'Sam' }, { name: 'Jo Lee' }] });
  assert.equal(p.title, 'Join the Skins at Birch Creek');
  assert.match(p.description, /^Trevor, Sam and Jo · /);
  assert.match(p.description, /18 holes\. Tap to follow the money live/);
  assert.ok(!p.description.includes('Nielsen'));
});

test('joinPreview: finished round and missing data', () => {
  assert.equal(joinPreview({ game: 'nassau', course: { name: 'Oak' }, status: 'done', players: [] }).title, 'Nassau results at Oak');
  assert.equal(joinPreview(null), null);
  assert.equal(joinPreview({ game: 'nope', players: [] }), null);
  // Bad settings never throw
  assert.ok(joinPreview({ game: 'banker', course: { name: 'X' }, settings: {} }).title);
});

test('joinPreview: long groups are shortened', () => {
  const players = ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({ name }));
  assert.match(joinPreview({ game: 'skins', course: { name: 'X' }, players }).description, /^A, B, C and 3 more/);
});

test('injectMeta swaps preview tags and escapes', () => {
  const out = injectMeta(HTML, { title: 'Join the "Wolf" at <Pine>', description: 'A & B', url: 'https://x.test/?join=ABC123' });
  assert.match(out, /<meta property="og:title" content="Join the &quot;Wolf&quot; at &lt;Pine&gt;">/);
  assert.match(out, /<meta property="og:description" content="A &amp; B">/);
  assert.match(out, /<meta property="og:url" content="https:\/\/x.test\/\?join=ABC123">/);
  assert.match(out, /<meta name="twitter:description" content="A &amp; B">/);
  assert.match(out, /<title>Join the &quot;Wolf&quot; at &lt;Pine&gt;<\/title>/);
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});
