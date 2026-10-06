// Profile card: your own numbers from the places the app already keeps them (the year in review,
// the handicap trend, your profile's favorite game, the nemesis on Players), no dollar figure
// unless Show amounts is on, and a nemesis whose profile is Only you is never named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCT, base, skins } from './crew-tabs.fixtures.js';
import { yearInReview } from './wrapped.js';
import { nemesis } from './rivalry.js';
import { profileStats } from './profile-model.js';
import { handicapTrend } from './hc-trend.js';
import { myIdSet } from './deep-stats.js';
import { GUIDE_NOTE, nemesisText, profileCard, profileCardModel } from './profile-card.js';

const Y = 2026;
const DOLLAR = /\$/;

/** Trevor ('t') loses to Adam twice and beats Bo once, all money rounds at $2 a skin. */
function season() {
  const r1 = skins('r1', ['t', 'a'], [[1, 'a'], [2, 'a']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(4) });
  const r3 = skins('r3', ['t', 'b'], [[1, 't']], { at: OCT(5) });
  const s = base([r1, r2, r3]);
  s.players.t = { id: 't', name: 'Trevor Nielsen', index: 12.4 };
  s.players.a = { id: 'a', name: 'Adam Smith' };
  return s;
}

test('the card reads the same numbers as the year in review, the profile, the trend and Players', () => {
  const s = season();
  const card = profileCard(s, { year: Y });
  const y = yearInReview(s, Y);
  assert.equal(card.name, 'Trevor Nielsen');
  assert.equal(card.index, 12.4);
  assert.equal(card.guide, handicapTrend(s).guide);
  assert.equal(card.season.rounds, y.rounds);
  assert.deepEqual(card.season.record, y.record);
  assert.deepEqual(card.season.record, { won: 1, lost: 2, even: 0 });
  assert.deepEqual(card.season.money, { net: y.money.net, rounds: y.money.rounds });
  assert.deepEqual(card.favoriteGame, profileStats(s).favoriteGame);
  const n = nemesis(s, myIdSet(s));
  assert.equal(card.nemesis.id, n.id);
  assert.equal(card.nemesis.net, n.net);
  assert.deepEqual([card.nemesis.won, card.nemesis.lost, card.nemesis.rounds], [0, 2, 2]);
  assert.equal(card.avatar.text, 'TN');
});

test('amounts are off by default: no dollar figure in the image, its alt text or the text', () => {
  const s = season();
  const off = profileCardModel(profileCard(s, { year: Y }));
  assert.ok(!DOLLAR.test(JSON.stringify(off)), JSON.stringify(off));
  assert.match(off.text, /Nemesis: Adam, 0–2 over 2 money rounds/);
  const on = profileCardModel(profileCard(s, { year: Y }), { showAmounts: true });
  assert.match(on.text, /Nemesis: Adam, down \$6 over 2 money rounds/);
  assert.match(on.text, /2026 money: [−-]\$4 over 3 rounds/);
  assert.match(on.alt, /2026 money/);
});

test('the nemesis is a first name only, and unnamed when their profile is Only you', () => {
  const s = season();
  const named = profileCardModel(profileCard(s, { year: Y }));
  assert.equal(named.tiles[5].value, 'Adam');
  assert.doesNotMatch(named.text, /Smith/);
  // Adam's account came back with no stats: his profile is Only you
  const hidden = { ...s, accountOf: { a: 'acct-a' }, profiles: { 'acct-a': { name: 'Adam Smith', stats: null } } };
  const card = profileCard(hidden, { year: Y });
  assert.equal(card.nemesis.name, null);
  const m = profileCardModel(card, { showAmounts: true });
  assert.doesNotMatch(JSON.stringify(m), /Adam/);
  assert.equal(m.tiles[5].value, 'Your nemesis');
  assert.match(m.text, /Nemesis: Your nemesis, down \$6/);
  assert.equal(nemesisText(null), null);
});

test('the trend shows only as a guide, labelled on the tile, the note and the text', () => {
  const s = season();
  const card = { ...profileCard(s, { year: Y }), guide: 11.8 };
  const m = profileCardModel(card);
  assert.equal(m.tiles[1].value, '11.8');
  assert.match(m.tiles[1].label, /not official/);
  assert.equal(m.note, GUIDE_NOTE);
  assert.match(m.text, /Trend from my rounds: 11\.8 \(a guide, not an official index\)/);
  assert.match(m.alt, /not an official index/);
  const none = profileCardModel({ ...card, guide: null });
  assert.equal(none.tiles[1].value, '–');
  assert.equal(none.note, null);
  assert.doesNotMatch(none.text, /Trend/);
});

test('a new player with no rounds and no index still gets a card, with en dashes for the gaps', () => {
  const s = base([]);
  s.players.t = { id: 't', name: 'Trevor' };
  const m = profileCardModel(profileCard(s, { year: Y }), { showAmounts: true });
  assert.deepEqual(m.tiles.map(t => t.value), ['–', '–', '0', '–', '–', 'None yet']);
  assert.equal(m.sections.length, 0);
  assert.match(m.text, /2026 season: 0 rounds$/m);
  assert.ok(!DOLLAR.test(JSON.stringify(m)));
});

test('only ever your own card: it reads state.me, never the person you were looking at', () => {
  const s = season();
  const mine = profileCard(s, { year: Y });
  const other = profileCard({ ...s, me: 't' }, { year: Y });
  assert.deepEqual(mine, other);
  assert.equal(profileCard({ ...s, me: null }, { year: Y }).nemesis, null);
});

test('a buddy avatar with no picture to draw yet falls back to your initials, not a question mark', () => {
  const s = season();
  s.profile = { avatar: { kind: 'buddy', id: 'flatcap', bg: 'ochre' } };
  const card = profileCard(s, { year: Y });
  assert.equal(card.avatar.kind, 'buddy');
  assert.equal(profileCardModel(card).avatar.text, 'TN');
});
