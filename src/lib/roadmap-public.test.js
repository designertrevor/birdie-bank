import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checklistLines, friendlyTitle, itemId, itemKind, publicRoadmap, shippedDate, PUBLIC_AREAS, TITLES } from './roadmap-public.js';

const ROADMAP = readFileSync(new URL('../../ROADMAP.md', import.meta.url), 'utf8');

const SAMPLE = `# Plan

## Current focus
- [ ] \`S1\` Not a checklist line, it's above the checklist

## The checklist by area

### 5. Setting up and playing a round
- [x] 16 games with the setup wizard
- [x] \`S2\` Snake (three-putts, each nine) and Hammer (double the hole): 18 games (2026-09-27)
- [ ] \`S2\` (partial) House rules for every game, the variations real groups play. Some exist (2026-09-27)
- [ ] \`S5\` New games: field skins across several groups, Calcutta, and rolling quota
- [x] \`S3\` New game: team best ball Built 2026-10-04 (overnight 7, shipped 2026-10-04).
- Note: not a checklist line

### 11. Upgrading and paywalls
- [ ] \`S2\` Stripe on the web for the test groups, with promo codes

### 7. The tab and settling up
- [ ] \`S3\` Split Pro on the Tab: when an organizer buys Pro, offer to split its cost
- [ ] \`S3\` Gentle reminders for "Birdie Bank" money: a nudge
- [x] \`S2\` **Carry it over:** either person can roll the balance (2026-09-29)

### 99. Some new area Trevor adds later
- [ ] \`S3\` Something in a new area

## Progress log
- [x] Not a checklist line either
`;

test('checklist lines come only from "The checklist by area", with their area, step and state', () => {
  const lines = checklistLines(SAMPLE);
  assert.equal(lines.length, 10);
  assert.deepEqual(lines[0], { areaNo: 5, area: 'Setting up and playing a round', done: true, partial: false, step: null, text: '16 games with the setup wizard', line: 9 });
  assert.equal(lines[2].partial, true);
  assert.equal(lines[2].step, 'S2');
  assert.equal(lines[3].done, false);
});

test('a line becomes a short title: no brackets, no detail after a colon or full stop', () => {
  assert.equal(friendlyTitle('Snake (three-putts, each nine) and Hammer (double the hole): 18 games (2026-09-27)'), 'Snake and Hammer');
  assert.equal(friendlyTitle('(partial) House rules for every game, the variations real groups play. Some exist'), 'House rules for every game, the variations real groups play');
  assert.equal(friendlyTitle('**Carry it over:** either person can roll the balance'), 'Carry it over');
  assert.equal(friendlyTitle('"Run it back" on a finished round: setup opens'), '"Run it back" on a finished round');
  assert.equal(friendlyTitle('Year in review ("Birdie Bank Wrapped")'), 'Year in review');
  assert.equal(friendlyTitle('New game: team best ball Built 2026-10-04 (overnight 7, shipped 2026-10-04).'), 'Team best ball');
  assert.equal(friendlyTitle('(partial) Request links on the Tab for every app. Venmo requests are built'), 'Request links on the Tab for every app');
  assert.equal(friendlyTitle('Gentle reminders for Birdie Bank money'), 'Gentle reminders for the app money');
  // Long ones stop at a comma, then at a word
  const long = friendlyTitle('A very long feature line that goes on and on, about many things that a golfer might want, and more');
  assert.ok(long.length <= 60, long);
  assert.ok(!/[,\s]$/.test(long));
});

test('the shipped date is the "shipped" one, else the last date on its own in brackets', () => {
  assert.equal(shippedDate('Built 2026-10-01 (overnight 6, shipped 2026-10-03): a thing'), '2026-10-03');
  assert.equal(shippedDate('Big Game (moved up from S5, 2026-09-27; widened 2026-09-30) (2026-10-05)'), '2026-10-05');
  assert.equal(shippedDate('One (2026-09-30). Two (2026-09-30, Trevor\'s review)'), '2026-09-30');
  assert.equal(shippedDate('Google works (2026-09-25), more later'), '2026-09-25');
  assert.equal(shippedDate('Built 2026-09-30 (overnight 5): a thing'), '2026-09-30');
  assert.equal(shippedDate('16 games with the setup wizard'), null);
});

test('ids are the first seven words, so checking a line off or marking it partial keeps its votes', () => {
  const open = itemId('Push reminders for upcoming rounds (the morning text is a share for now)');
  assert.equal(open, 'r-push-reminders-for-upcoming-rounds-the-morning');
  assert.equal(itemId('(partial) Push reminders for upcoming rounds (the morning text) Built 2026-11-01'), open);
  assert.equal(itemId('**Carry it over:** instead of'), 'r-carry-it-over-instead-of');
  assert.equal(itemId('What’s on the line stays in view'), 'r-whats-on-the-line-stays-in-view');
  assert.match(itemId('x'.repeat(200)), /^r-x{1,78}$/);
});

test('statuses: checked is Shipped with its date, (partial) is In progress, the rest Planned', () => {
  const items = publicRoadmap(SAMPLE);
  const by = Object.fromEntries(items.map(i => [i.title, i]));
  assert.equal(by['16 games with the setup wizard'].status, 'shipped');
  assert.equal(by['16 games with the setup wizard'].shipped, null);
  assert.equal(by['Snake and Hammer'].shipped, '2026-09-27');
  assert.equal(by['House rules for every game'].status, 'progress');
  assert.equal(by['Field skins, Calcutta and rolling quota'].status, 'planned');
  assert.equal(by['Team best ball'].shipped, '2026-10-04');
  assert.equal(by['Carry it over'].status, 'shipped');
});

test('private areas and lines stay out: paywalls, pricing, Pro and new areas', () => {
  const items = publicRoadmap(SAMPLE);
  const titles = items.map(i => i.title);
  assert.ok(!titles.some(t => /Stripe|Split Pro/.test(t)), titles.join(' | '));
  assert.ok(!titles.includes('Something in a new area'));
  assert.ok(items.every(i => Object.values(PUBLIC_AREAS).includes(i.area)));
});

test('new games are "game" items, for the "it shipped" note', () => {
  assert.equal(itemKind('New games: field skins', 5), 'game');
  assert.equal(itemKind('(partial) New game: Calcutta', 5), 'game');
  assert.equal(itemKind('New games: field skins', 7), 'feature');
  const items = publicRoadmap(SAMPLE);
  assert.equal(items.find(i => i.title === 'Team best ball').kind, 'game');
  assert.equal(items.find(i => i.title === 'Carry it over').kind, 'feature');
  // A hand-written kind, for lines that don't start "New game"
  const real = publicRoadmap(ROADMAP);
  assert.equal(real.find(i => i.title === 'Snake and Hammer').kind, 'game');
  assert.equal(real.find(i => i.title === 'Carry it over to next time').kind, 'feature');
});

test('the real ROADMAP.md: a sensible public list with nothing private in it', () => {
  const items = publicRoadmap(ROADMAP);
  assert.ok(items.length > 60, `only ${items.length} items`);
  for (const s of ['planned', 'progress', 'shipped']) assert.ok(items.some(i => i.status === s), `no ${s} items`);
  assert.equal(new Set(items.map(i => i.id)).size, items.length, 'ids are unique');
  const EM = String.fromCharCode(0x2014);
  for (const i of items) {
    const words = `${i.title} ${i.blurb || ''}`;
    assert.ok(!/Birdie Bank|Trevor|Reddit|overnight|SQL|Supabase|\bPro\b|paywall|creator|Stripe|\d{4}-\d{2}-\d{2}/i.test(words), words);
    assert.ok(!words.includes(EM), words);
    assert.ok(i.title.length <= 60, i.title);
    assert.match(i.id, /^r-[a-z0-9-]{1,78}$/);
    if (i.status === 'shipped' && i.shipped) assert.match(i.shipped, /^\d{4}-\d{2}-\d{2}$/);
  }
  // Business areas never show
  const raw = checklistLines(ROADMAP).filter(l => [11, 14, 15, 16, 18, 19, 22, 23].includes(l.areaNo)).map(l => itemId(l.text));
  assert.ok(raw.length > 20);
  assert.ok(!items.some(i => raw.includes(i.id)));
});

test('the hand-written titles still match ROADMAP.md (a rewritten line or two is fine: it falls back)', () => {
  const ids = new Set(checklistLines(ROADMAP).map(l => itemId(l.text)));
  const stale = Object.keys(TITLES).filter(id => !ids.has(id));
  assert.ok(stale.length <= Object.keys(TITLES).length / 10, `stale: ${stale.join(', ')}`);
});
