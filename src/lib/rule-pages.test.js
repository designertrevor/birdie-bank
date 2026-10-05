// The public rule pages (rule-pages.js): every game gets one at a clean address, the "Play this
// now" link finds its way back to setup, and each page carries its own title, description and
// preview tags. The build renders the sections from rules-content.jsx; here they're stand-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAMES, SIDE_GAMES } from './round.js';
import { APP_NAME, SITE_URL } from './app-name.js';
import {
  RULE_KEYS, SIDE_ONLY, playFromSearch, playPath, renderRulePage, renderRulesIndex, robotsTxt, ruleFacts, ruleFile,
  ruleKeyOf, rulePageMeta, rulePath, ruleSlug, rulesIndexMeta, sitemapXml,
} from './rule-pages.js';

const EM = String.fromCharCode(0x2014);
const metaOf = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`))?.[1];

test('rule pages: one for every game in GAMES and every side game, each with rules to render', () => {
  for (const k of Object.keys(GAMES)) assert.ok(RULE_KEYS.includes(k), `page for ${k}`);
  for (const k of Object.keys(SIDE_GAMES)) assert.ok(RULE_KEYS.includes(k), `page for side game ${k}`);
  assert.equal(new Set(RULE_KEYS).size, RULE_KEYS.length, 'no game twice');
  assert.deepEqual(SIDE_ONLY.sort(), ['birdies', 'ctp', 'drive']);
  // The build reads each page's sections from rules-content.jsx, so every key must be there
  const src = readFileSync(new URL('../components/rules-content.jsx', import.meta.url), 'utf8');
  const have = new Set([...src.slice(src.indexOf('export const RULES = {')).matchAll(/^ {2}(\w+): \{$/gm)].map(m => m[1]));
  for (const k of RULE_KEYS) assert.ok(have.has(k), `rules-content has ${k}`);
});

test('rule pages: clean, unique addresses that map back to the game', () => {
  const slugs = RULE_KEYS.map(ruleSlug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(rulePath('wolf'), '/rules/wolf');
  assert.equal(rulePath('match'), '/rules/match-play');
  assert.equal(rulePath('bbb'), '/rules/bingo-bango-bongo');
  assert.equal(rulePath('ctp'), '/rules/closest-to-the-pin');
  assert.equal(rulePath(null), '/rules');
  // Written as a folder's index.html, so /rules/wolf works on any static host
  assert.equal(ruleFile('wolf'), 'rules/wolf/index.html');
  assert.equal(ruleFile('aces'), 'rules/aces-and-deuces/index.html');
  assert.equal(ruleFile(null), 'rules/index.html');
  for (const k of RULE_KEYS) {
    assert.equal(ruleKeyOf(ruleSlug(k)), k, `slug ${k}`);
    assert.equal(ruleKeyOf(k), k, `key ${k}`);
  }
});

test('rule pages: names people type find the game, anything else finds nothing', () => {
  assert.equal(ruleKeyOf('Match Play'), 'match');
  assert.equal(ruleKeyOf('  WOLF '), 'wolf');
  assert.equal(ruleKeyOf('junk'), 'dots');
  assert.equal(ruleKeyOf('hollywood'), 'sixes');
  assert.equal(ruleKeyOf('foursomes'), 'altshot');
  assert.equal(ruleKeyOf('four-ball'), 'bestball');
  assert.equal(ruleKeyOf('acey-deucey'), 'aces');
  assert.equal(ruleKeyOf('wolf/'), 'wolf');
  for (const bad of ['', null, undefined, 'nope', '../etc', 'wolf<script>', 'constructor', '__proto__']) assert.equal(ruleKeyOf(bad), null, String(bad));
});

test('play links: "Play this now" opens setup with the game, a side-only game as a side game', () => {
  assert.equal(playPath('wolf'), '/?play=wolf');
  assert.equal(playPath('match'), '/?play=match-play');
  assert.deepEqual(playFromSearch('?play=wolf'), { game: 'wolf' });
  assert.deepEqual(playFromSearch('?play=match-play'), { game: 'match' });
  assert.deepEqual(playFromSearch('play=junk'), { game: 'dots' });
  assert.deepEqual(playFromSearch('?play=closest-to-the-pin'), { side: 'ctp' });
  assert.deepEqual(playFromSearch('?play=birdie-pot'), { side: 'birdies' });
  assert.equal(playFromSearch('?play=nope'), null);
  assert.equal(playFromSearch('?join=ABC123'), null);
  assert.equal(playFromSearch(''), null);
  assert.equal(playFromSearch(undefined), null);
  // Every page's button lands on its own game
  for (const k of RULE_KEYS) {
    const to = playFromSearch(playPath(k).slice(1));
    assert.equal(to.game || to.side, k);
    assert.equal(!!to.side, SIDE_ONLY.includes(k));
  }
});

test('rule facts: players, holes and a one-line pitch from GAMES, or the sheet for a side game', () => {
  assert.deepEqual(ruleFacts('wolf', '4 players exactly · Rotating wolf'), { players: '4 players exactly', holes: '9 or 18 holes', pitch: 'Pick a partner each hole, or go it alone.', group: 'Classics', side: false });
  // A blurb that already ends a sentence keeps its own stop
  assert.ok(!ruleFacts('hammer').pitch.endsWith('..'));
  const ctp = ruleFacts('ctp', '2–8 players · A side game · A pot for the par 3s');
  assert.equal(ctp.players, '2–8 players');
  assert.equal(ctp.pitch, 'A pot for the par 3s.');
  assert.equal(ctp.side, true);
  assert.equal(ctp.group, 'Side games');
  // No sub line at all still reads
  assert.ok(ruleFacts('drive').pitch.length > 5);
});

test('rule page: its own title, description, address and preview tags', () => {
  const html = renderRulePage({ key: 'wolf', title: 'How to play Wolf', sub: '4 players exactly · Rotating wolf', sections: [['Overview', '<p>The <strong>wolf</strong> rotates.</p>'], ['Scoring', '<ul><li>Low side wins.</li></ul>']] });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>How to play Wolf: golf betting game rules · /);
  assert.ok(html.includes(`<title>How to play Wolf: golf betting game rules · ${APP_NAME}</title>`), 'the name comes from the one constant');
  assert.equal(metaOf(html, 'property', 'og:title'), 'How to play Wolf');
  assert.equal(metaOf(html, 'name', 'twitter:title'), 'How to play Wolf');
  assert.equal(metaOf(html, 'property', 'og:url'), `${SITE_URL}/rules/wolf`);
  assert.equal(metaOf(html, 'property', 'og:site_name'), APP_NAME);
  assert.equal(metaOf(html, 'property', 'og:image'), `${SITE_URL}/og-image.png`);
  assert.equal(metaOf(html, 'name', 'twitter:card'), 'summary_large_image');
  const d = metaOf(html, 'name', 'description');
  assert.equal(d, metaOf(html, 'property', 'og:description'));
  assert.match(d, /^Pick a partner each hole, or go it alone\. 4 players exactly\./);
  assert.ok(d.length <= 200, 'short enough for a search result');
  assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/rules/wolf">`));
  // Sections in order, as the build rendered them
  assert.ok(html.indexOf('<h2>Overview</h2><p>The <strong>wolf</strong> rotates.</p>') < html.indexOf('<h2>Scoring</h2>'));
  // The button, twice: up top and after the rules
  assert.equal(html.split('href="/?play=wolf"').length - 1, 2);
  assert.match(html, /Play this now/);
  // Links to the index and the other classics
  assert.ok(html.includes('href="/rules"'));
  assert.ok(html.includes('href="/rules/nassau"'));
  assert.ok(!html.includes('href="/rules/wolf"'), 'not to itself');
  // Light and dark, from the app's tokens
  assert.match(html, /prefers-color-scheme: dark/);
  assert.ok(!html.includes(EM), 'no em dashes');
  assert.ok(!/\bPro\b/.test(html), 'nothing labelled Pro');
});

test('rule page: a side game says how to add it, and headings and titles are escaped', () => {
  const html = renderRulePage({ key: 'ctp', title: 'How to play <Closest> & "pin"', sub: '2–8 players · A side game · A pot for the par 3s', sections: [['Who <wins>', '<p>x</p>']] });
  assert.ok(html.includes('<h1>How to play &lt;Closest&gt; &amp; &quot;pin&quot;</h1>'));
  assert.ok(html.includes('<h2>Who &lt;wins&gt;</h2>'));
  assert.ok(html.includes('Add Closest to the pin to your next round'));
  assert.ok(html.includes('href="/?play=closest-to-the-pin"'));
  assert.match(html, /<title>[^<]*golf side game rules/);
  assert.ok(html.includes('More side games'));
  // The app never holds anyone's money: it keeps track of the pot, it doesn't keep it
  const d = rulePageMeta('ctp', { sub: '2–8 players · A side game · A pot for the par 3s' }).description;
  assert.match(d, /keeps track of the pot/);
  assert.ok(!/keeps the pot|holds the pot/.test(d), d);
});

test('rule page meta: a page from another origin points at itself', () => {
  const m = rulePageMeta('nassau', { title: 'How to play Nassau', sub: '2–4 players · Three bets in one round' }, 'https://x.test');
  assert.equal(m.url, 'https://x.test/rules/nassau');
  assert.equal(m.shareTitle, 'How to play Nassau');
  // No title passed: one is made from the name
  assert.equal(rulePageMeta('bbb').heading, 'How to play Bingo Bango Bongo');
});

test('rules index: every game, grouped like setup, with its own preview tags', () => {
  const html = renderRulesIndex({ ctp: '2–8 players · A side game · A pot for the par 3s' });
  for (const k of RULE_KEYS) assert.ok(html.includes(`href="${rulePath(k)}"`), `links ${k}`);
  for (const g of ['Classics', 'Head to head', 'Team', 'Full round', 'Points', 'Side games']) assert.ok(html.includes(`<h2>${g}</h2>`), g);
  assert.ok(html.indexOf('<h2>Classics</h2>') < html.indexOf('<h2>Side games</h2>'));
  assert.equal(metaOf(html, 'property', 'og:url'), `${SITE_URL}/rules`);
  assert.equal(metaOf(html, 'property', 'og:title'), rulesIndexMeta().shareTitle);
  assert.ok(rulesIndexMeta().title.includes(String(RULE_KEYS.length)));
  assert.ok(!html.includes(EM));
});

test('sitemap and robots list the app and every rule page', () => {
  const xml = sitemapXml('https://x.test');
  assert.match(xml, /^<\?xml/);
  assert.ok(xml.includes('<loc>https://x.test/</loc>'));
  assert.ok(xml.includes('<loc>https://x.test/rules</loc>'));
  for (const k of RULE_KEYS) assert.ok(xml.includes(`<loc>https://x.test${rulePath(k)}</loc>`));
  assert.equal(robotsTxt('https://x.test'), 'User-agent: *\nAllow: /\nSitemap: https://x.test/sitemap.xml\n');
});

test('the service worker never saves a rule page as the app, and the app never precaches them', () => {
  const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("url.pathname === '/' || url.pathname === '/index.html' ? '/' : url.pathname"));
  const vite = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  const skip = new RegExp(vite.match(/const SKIP = \/(.+)\/;/)[1]);
  assert.ok(skip.test('rules/wolf/index.html'));
  assert.ok(skip.test('rules/index.html'));
  assert.ok(skip.test('sitemap.xml'));
  assert.ok(!skip.test('index.html'));
  assert.ok(!skip.test('assets/rules-abc.js'));
  // /rules and /rules/wolf reach the built pages on Vercel
  const v = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(v.rewrites.map(r => [r.source, r.destination]), [['/rules', '/rules/index.html'], ['/rules/:slug', '/rules/:slug/index.html']]);
});

test('"Play this now" is wired: App reads ?play=, setup takes the game or side game, onboarding ticks it', () => {
  const src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  const app = src('../App.jsx');
  assert.match(app, /get\('play'\)/);
  assert.ok(!app.includes("from './lib/rule-links.js'"), 'the first screen never loads the game names');
  assert.match(app, /name: 'newRound', params: \{ play: playAt \}/);
  assert.match(app, /<Onboarding play=\{playAt\}/);
  assert.match(app, /get\('play'\)\) history\.replaceState/, 'the link is tidied out of the address bar');
  const setup = src('../screens/NewRound.jsx');
  assert.match(setup, /const preGame = gameIn \?\? fromPlay\?\.game \?\? null;/);
  assert.match(setup, /const preSide = fromPlay\?\.side \?\? null;/);
  assert.match(src('../screens/Onboarding.jsx'), /games: GAMES\[game\] \? \[game\] : \[\]/);
});

test('new copy reads the app name from the one constant, never spelled out', () => {
  for (const f of ['./rule-pages.js', './rule-links.js', './link-landing.js', './link-target.js', './og.js', '../components/LinkBrand.jsx', '../components/Rules.jsx']) {
    assert.ok(!readFileSync(new URL(f, import.meta.url), 'utf8').includes('Birdie Bank'), f);
  }
});
