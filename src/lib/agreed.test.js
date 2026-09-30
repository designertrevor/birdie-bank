// The first-tee rules card: what's on it, locking it in, and changes listed against the hole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, changeBets, gameResults } from './round.js';
import { agreementItems, changeLine, houseRulesFor, lockAgreement, noteChanges, showFirstTee, pressesText } from './agreed.js';

const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const P = ['a', 'b', 'c'].map((id, i) => ({ id, name: ['Ann Lee', 'Bo Ray', 'Cy Doe'][i], index: 0 }));
const SETTINGS = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'auto', threshold: 2, turnPress: true, noLastPress: false },
  dots: { value: 1, auto: true, kinds: { greenie: true } },
};
function mk(game = 'skins') {
  const r = createRound({ id: 'r', game, course, holesCount: 9, players: P, settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: true });
  r.players[1].plays = 4; r.players[2].plays = 1;
  return r;
}
const byId = items => Object.fromEntries(items.map(x => [x.id, x]));

test('the card shows strokes, bets, house rules on, and the calls', () => {
  const r = mk('nassau');
  r.sideGames = [{ game: 'skins', settings: { ...SETTINGS.skins, canadian: true } }];
  const it = byId(agreementItems(r, { gimmes: 'leather', mulligans: 'nine' }));
  assert.equal(it['strokes:a'].text, 'scratch');
  assert.equal(it['strokes:b'].text, '4 strokes');
  assert.equal(it['strokes:c'].text, '1 stroke');
  assert.equal(it['bet:main'].text, '$5 / $5 / $5');
  assert.equal(it['bet:skins'].text, '$2 a skin');
  assert.equal(it['rule:main:turnPress'].on, true);
  assert.equal(it['rule:skins:canadian'].on, true);
  assert.equal(it['rule:skins:validate'].on, false);
  assert.equal(it.presses.text, 'Auto press at 2 down');
  assert.equal(it.gimmes.text, 'Inside the leather');
  assert.equal(it.mulligans.text, 'One a nine');
});

test('gross rounds and games without presses say so plainly', () => {
  const r = mk('skins');
  r.useHandicaps = false;
  const it = byId(agreementItems(r));
  assert.equal(it.strokes.text, 'None, it’s gross');
  assert.equal(it.presses, undefined);
  assert.equal(pressesText(r), '');
  assert.equal(it.gimmes.text, 'None. Everything gets putted out.');
});

test('the card is up only before any score, and not once it was locked or skipped', () => {
  const r = mk();
  assert.equal(showFirstTee(r), true);
  assert.equal(showFirstTee({ ...r, agreed: { skipped: 1 } }), false);
  assert.equal(showFirstTee({ ...r, agreed: lockAgreement(r) }), false);
  assert.equal(showFirstTee({ ...r, scores: { 1: { a: 4 } } }), false);
  assert.equal(showFirstTee({ ...r, status: 'done' }), false);
});

test('nothing changed, nothing noted; an unlocked round notes nothing', () => {
  const r = mk();
  assert.equal(noteChanges(r), null);
  r.agreed = lockAgreement(r, { gimmes: 'none', mulligans: 'none' }, 'a', 100);
  assert.equal(noteChanges(r), null);
});

test('a bet raised on hole 7 is listed as "Hole 7: Skins raised to $5 a skin"', () => {
  let r = mk();
  r.agreed = lockAgreement(r, {}, 'a', 100);
  r.current = 6;
  r = changeBets(r, { ...r.settings.skins, value: 5 }, 7);
  const next = noteChanges(r, 200);
  assert.deepEqual(next.changes, [{ hole: 7, text: 'Skins raised to $5 a skin', at: 200 }]);
  assert.equal(changeLine(next.changes[0]), 'Hole 7: Skins raised to $5 a skin');
  // Recorded once: the same round again notes nothing new
  assert.equal(noteChanges({ ...r, agreed: next }), null);
});

test('house rules, gimmes, strokes and side games changed later are each listed', () => {
  let r = mk();
  r.agreed = lockAgreement(r, { gimmes: 'none', mulligans: 'none' }, 'a', 100);
  r.current = 3;
  r = changeBets(r, { ...r.settings.skins, validate: true }, 4);
  r.agreed = { ...r.agreed, gimmes: 'leather' };
  r.players = r.players.map(p => (p.id === 'b' ? { ...p, plays: 3 } : p));
  r.sideGames = [{ game: 'dots', settings: SETTINGS.dots }];
  const texts = noteChanges(r, 5).changes.map(c => changeLine(c));
  assert.deepEqual(texts.sort(), [
    'Hole 4: Bo now gets 3 strokes',
    'Hole 4: Gimmes: Inside the leather',
    'Hole 4: Junk added: $1 a dot',
    'Hole 4: Junk: Birdies count as junk',
    'Hole 4: Skins: Validate skins (net par on the next hole keeps a skin)',
  ].sort());
});

test('turning a house rule off says so', () => {
  let r = mk();
  r.agreed = lockAgreement(r, {}, 'a', 100);
  r = changeBets(r, { ...r.settings.skins, carryover: false }, 1);
  const texts = noteChanges(r, 5).changes.map(c => c.text);
  assert.deepEqual(texts, ['Skins: Carryovers, off']);
});

test('the card never touches the money', () => {
  const r = mk();
  r.scores = { 1: { a: 3, b: 4, c: 4 } };
  const before = gameResults(r).balances;
  r.agreed = lockAgreement(r, { gimmes: 'leather', mulligans: 'round' }, 'a', 100);
  assert.deepEqual(gameResults(r).balances, before);
});

test('house rules read the same when a setting was never saved', () => {
  assert.deepEqual(houseRulesFor('skins', { value: 2 }).filter(h => h.on).map(h => h.id), []);
  assert.deepEqual(houseRulesFor('nope', {}), []);
});

test('locked in on the first tee has no hole; locked in later says which', () => {
  const r = mk();
  assert.equal(lockAgreement(r).hole, null);
  r.scores = { 1: { a: 4, b: 4, c: 4 }, 2: { a: 4, b: 4, c: 4 } };
  r.current = 2;
  assert.equal(lockAgreement(r).hole, 3);
});

test('merge: the rules card lists the newer house rules, a side game at its own % and half strokes', () => {
  const four = [...P, { id: 'd', name: 'Di Poe', index: 0 }];
  const vegas = createRound({ id: 'v', game: 'vegas', course, holesCount: 9, players: four, teams: [['a', 'b'], ['c', 'd']],
    settings: { vegas: { point: 1, birdieFlip: true, birdieDouble: true } }, hcPct: 100, useHandicaps: true });
  const items = agreementItems(vegas);
  assert.equal(byId(items)['rule:main:birdieDouble'].on, true);
  assert.equal(byId(items)['rule:main:birdieDouble'].text, 'Birdies double, eagles triple');
  assert.ok(!byId(items)['bet:main'].text.includes('birdies double'));

  const r = mk('nassau');
  r.halfStrokes = true;
  r.sideGames = [{ game: 'skins', hcPct: 80, settings: structuredClone(SETTINGS.skins) }];
  const more = byId(agreementItems(r));
  assert.equal(more.half.text, 'Each stroke counts as half');
  assert.equal(more['hcPct:skins'].text, '80%, nobody gets strokes');
  // Each player's strokes in the side game, at its own %
  r.players = r.players.map((p, i) => ({ ...p, courseHc: [0, 10, 15][i], plays: [0, 10, 15][i] }));
  assert.equal(byId(agreementItems(r))['hcPct:skins'].text, '80%: Bo 8, Cy 12');
});

test('a scramble card lists each team’s strokes, not each player’s', () => {
  const four = [...P, { id: 'd', name: 'Di Moss', index: 0 }];
  const r = createRound({ id: 's', game: 'scramble', course, holesCount: 9, players: four, teams: [['a', 'b'], ['c', 'd']],
    settings: { scramble: { stake: 5, payout: 'pot', drives: 3 } }, hcPct: 100, useHandicaps: true });
  r.teams[1].plays = 2;
  const it = byId(agreementItems(r));
  const strokes = agreementItems(r).filter(x => x.group === 'strokes');
  assert.equal(strokes.length, 2);
  assert.equal(it[`strokes:${r.teams[0].id}`].text, 'scratch');
  assert.equal(it[`strokes:${r.teams[1].id}`].text, '2 strokes');
  assert.equal(it[`strokes:${r.teams[1].id}`].label, r.teams[1].name);
});
