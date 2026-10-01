import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchMoment, roundMoment, freshHole, firstShowing, pickMoment, finalMoment, donePositions, moneyMoment } from './moments.js';
import { createRound } from './round.js';
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
  assert.equal(sq.text, 'Dave wins hole 2 to square it');
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
  assert.equal(m.text, 'Dave wins hole 10 to square it on the total');
});

test('no moment for a hole not scored yet', () => {
  assert.equal(matchMoment({}, 1, MATCH, { names }), null);
});

// ---------------------------------------------------------------------------
// Every game: skins, wolf, Vegas, the money lead, the last hole, and the rules for which one shows.

const SETTINGS = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  wolf: { point: 2, loneMultiplier: 2, blind: true, blindMultiplier: 3 },
  vegas: { point: 1, birdieFlip: true },
  nines: { point: 1 },
  stroke: { stake: 5, payout: 'pot' },
};
const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const PEOPLE = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss'].map((name, i) => ({ id: 'abcd'[i], name, index: 0 }));
function mk(game, { ids = 'abcd', holes = 9, settings = {}, teams = null, sideGames = null, playFor = null } = {}) {
  const s = structuredClone(SETTINGS);
  for (const [k, v] of Object.entries(settings)) s[k] = { ...s[k], ...v };
  const r = createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players: [...ids].map(id => PEOPLE.find(p => p.id === id)), settings: s, hcPct: 100, useHandicaps: false, teams });
  if (sideGames) r.sideGames = sideGames;
  if (playFor) r.playFor = playFor;
  return r;
}
/** Scores hole by hole: each entry is { a: 3 } over a par 4 for everyone. */
function play(r, holes) {
  holes.forEach((over, i) => { r.scores[r.holes[i].no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...over }; });
  return r;
}

test('skins: a skin won, and a carry of 3 or more ended is the bigger moment', () => {
  const one = roundMoment(play(mk('skins'), [{ b: 3 }]), 1);
  assert.equal(one.kind, 'skin');
  assert.equal(one.title, 'Bo wins the skin');
  // $2 from each of the other three, and the round's first lead on the same banner
  assert.equal(one.text, '$6, and the lead');
  // Holes 1 to 3 tied, Bo wins 4: the 3 carried skins and hole 4's, $24
  const big = roundMoment(play(mk('skins'), [{}, {}, {}, { b: 3 }]), 4);
  assert.equal(big.kind, 'bigskin');
  assert.equal(big.title, 'Bo takes 4 skins');
  assert.equal(big.text, '$24. That ends a 3-hole carry, and the lead');
  // A carry of 2 is a plain skin moment
  assert.equal(roundMoment(play(mk('skins'), [{}, {}, { b: 3 }]), 3).kind, 'skin');
  // A tied hole makes no moment
  assert.equal(roundMoment(play(mk('skins'), [{}]), 1), null);
});

test('skins: taking the money lead with the skin says so on the same banner', () => {
  // Ann wins 1 ($6 up), 2 ties, Bo wins 3 with the carry ($12) and goes top
  const m = roundMoment(play(mk('skins'), [{ a: 3 }, {}, { b: 3 }]), 3);
  assert.equal(m.kind, 'skin');
  assert.equal(m.title, 'Bo takes 2 skins');
  assert.equal(m.text, '$12, and the lead');
});

test('skins as a side game, and a points round reads in points', () => {
  const side = [{ game: 'skins', settings: SETTINGS.skins }];
  const m = roundMoment(play(mk('stroke', { sideGames: side }), [{ c: 3 }]), 1);
  assert.equal(m.title, 'Cy wins the skin');
  const pts = roundMoment(play(mk('skins', { playFor: { kind: 'points' } }), [{}, {}, {}, { b: 3 }]), 4);
  assert.equal(pts.text, '24 pts. That ends a 3-hole carry, and the lead');
  assert.doesNotMatch(pts.text, /\$/);
  // The pot payout counts shares, not dollars
  const pot = roundMoment(play(mk('skins', { settings: { skins: { payout: 'pot' } } }), [{ b: 3 }]), 1);
  assert.equal(pot.text, '1 share of the pot, and the lead');
});

test('wolf: a lone wolf or a blind wolf that wins, and one the pack gets', () => {
  const lone = mk('wolf');
  lone.wolf[1] = { wolf: 'a', partner: null };
  const win = roundMoment(play(lone, [{ a: 3 }]), 1);
  assert.equal(win.kind, 'lonewolf');
  assert.equal(win.title, 'Lone wolf wins');
  assert.equal(win.text, 'Ann takes $12 off the pack, and the lead'); // $2 x2 from each of three
  const blind = mk('wolf');
  blind.wolf[1] = { wolf: 'a', partner: null, blind: true };
  assert.equal(roundMoment(play(blind, [{ a: 3 }]), 1).text, 'Ann went blind and takes $18 off the pack, and the lead');
  const lost = mk('wolf');
  lost.wolf[1] = { wolf: 'a', partner: null };
  const down = roundMoment(play(lost, [{ d: 3 }]), 1);
  assert.equal(down.kind, 'wolfdown');
  assert.equal(down.title, 'The pack gets the wolf');
  assert.equal(down.text, 'Ann went lone and pays $12');
  // A wolf with a partner is an ordinary hole
  const pair = mk('wolf');
  pair.wolf[1] = { wolf: 'a', partner: 'b' };
  assert.equal(roundMoment(play(pair, [{ a: 3 }]), 1), null);
});

test('Vegas: a big swing on one hole, with or without a birdie flip', () => {
  const teams = [['a', 'b'], ['c', 'd']];
  // 3 and 4 make 34; 5 and 6 make 56, flipped to 65 by the birdie
  const flip = roundMoment(play(mk('vegas', { teams }), [{ a: 3, c: 5, d: 6 }]), 1);
  assert.equal(flip.kind, 'swing');
  assert.equal(flip.title, 'Big Vegas swing');
  assert.equal(flip.text, 'A birdie flips it. Ann & Bo win it 34 to 65, $31 each, and the lead');
  const plain = roundMoment(play(mk('vegas', { teams, settings: { vegas: { birdieFlip: false } } }), [{ a: 3, c: 5, d: 6 }]), 1);
  assert.equal(plain.text, 'Ann & Bo win it 34 to 56, $22 each, and the lead');
  // Birdies double: the same hole pays twice, and says why
  const doubled = roundMoment(play(mk('vegas', { teams, settings: { vegas: { birdieDouble: true } } }), [{ a: 3, c: 5, d: 6 }]), 1);
  assert.equal(doubled.text, 'A birdie flips it. Ann & Bo win it 34 to 65, doubled for the birdie: $62 each, and the lead');
  // 44 against 45 is an ordinary hole: only the round's first lead
  assert.equal(roundMoment(play(mk('vegas', { teams }), [{ d: 5 }]), 1).kind, 'money');
  assert.equal(roundMoment(play(mk('vegas', { teams }), [{ d: 5 }, { d: 5 }]), 2), null);
});

test('money lead: the first lead of the round, and the lead changing hands in any game', () => {
  // Nine point, three players: Ann wins 1, Bo wins 2 and 3
  const r = mk('nines', { ids: 'abc' });
  play(r, [{ a: 3 }]);
  // The first lead of the round gets a banner too
  const first = roundMoment(r, 1);
  assert.equal(first.kind, 'money');
  assert.equal(first.title, 'Ann takes the lead');
  assert.match(first.text, /^Up \$\d+ on the round$/);
  play(r, [{ a: 3 }, { b: 3 }]);
  assert.equal(roundMoment(r, 2), null); // Ann and Bo level: nobody leads
  play(r, [{ a: 3 }, { b: 3 }, { b: 3 }]);
  const m = roundMoment(r, 3);
  assert.equal(m.kind, 'money');
  assert.equal(m.title, 'Bo takes the lead');
  assert.match(m.text, /^Up \$\d+ on the round$/);
  // Keeping your own lead is quiet
  play(r, [{ a: 3 }, { b: 3 }, { b: 3 }, { b: 3 }]);
  assert.equal(roundMoment(r, 4), null);
});

test('money lead: a team leads together, and a reward round plays for the reward', () => {
  const teams = [['a', 'b'], ['c', 'd']];
  // Vegas by a point a hole: Ann & Bo, then Cy & Di twice
  const r = play(mk('vegas', { teams }), [{ d: 5 }, { a: 5 }, { a: 5 }]);
  const m = moneyMoment(r, 3);
  assert.equal(m.title, 'Cy & Di take the lead');
  assert.equal(m.text, 'Up $1 on the round');
  const lunch = play(mk('vegas', { teams, playFor: { kind: 'reward', reward: 'Lunch' } }), [{ d: 5 }, { a: 5 }, { a: 5 }]);
  assert.equal(moneyMoment(lunch, 3).text, 'Up 1 pt, in line for lunch');
});

test('priority: one moment per hole, the most exciting one', () => {
  const skin = { kind: 'skin' }, money = { kind: 'money' }, big = { kind: 'bigskin' }, wolf = { kind: 'blindwolf' };
  const nine = { kind: 'won', whole: false }, match = { kind: 'won', whole: true };
  assert.equal(pickMoment([skin, money]), money);
  assert.equal(pickMoment([money, big, skin]), big);
  assert.equal(pickMoment([big, wolf]), big);
  assert.equal(pickMoment([nine, big]), big);
  assert.equal(pickMoment([big, match]), match);
  assert.equal(pickMoment([null, null]), null);
  // A blind wolf that also takes the lead is one banner, on the wolf
  const r = mk('wolf');
  r.wolf[1] = { wolf: 'b', partner: null }; // Bo goes lone and wins: $12 up
  r.wolf[2] = { wolf: 'a', partner: null, blind: true };
  play(r, [{ b: 3 }, { a: 3 }]);
  const m = roundMoment(r, 2);
  assert.equal(m.kind, 'blindwolf');
  assert.equal(m.text, 'Ann went blind and takes $18 off the pack, and the lead');
});

test('which hole gets a moment: one new hole in play, never an edit, a burst or the last hole', () => {
  const r = play(mk('skins'), [{}, {}, {}]);
  const at = p => freshHole(r, [1, 2], p);
  assert.deepEqual(at([1, 2, 3]), { pos: 3, final: false });
  assert.equal(freshHole(r, [1], [1, 2, 3]), null); // a phone catching up
  assert.equal(freshHole(r, [1, 2, 3], [1, 2, 3]), null); // an edit
  assert.equal(freshHole(r, [1, 3], [1, 2, 3]), null); // a skipped hole filled in
  assert.equal(freshHole({ ...r, editing: true }, [1, 2], [1, 2, 3]), null);
  assert.equal(freshHole({ ...r, status: 'done' }, [1, 2], [1, 2, 3]), null);
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.equal(freshHole(r, all.slice(0, 8), all), null); // the last hole: the reveal says who won
  // The skipped hole that completes the round: it won't finish on its own, so say who won
  assert.deepEqual(freshHole(r, all.filter(p => p !== 4), all), { pos: 4, final: true });
  assert.deepEqual(donePositions(r), [1, 2, 3]);
});

test('a moment shows once per hole on a phone', () => {
  const shown = new Set();
  assert.equal(firstShowing(shown, 'r', 3), true);
  assert.equal(firstShowing(shown, 'r', 3), false);
  assert.equal(firstShowing(shown, 'r', 4), true);
  assert.equal(firstShowing(shown, 'other', 3), true);
});

test('who won the round, in money, points or the reward', () => {
  const r = play(mk('skins'), Array.from({ length: 9 }, (_, i) => (i === 0 ? { b: 3 } : {})));
  assert.equal(finalMoment(r).title, 'Bo wins the round');
  assert.match(finalMoment(r).text, /^Up \$6\. /);
  const pts = play(mk('skins', { playFor: { kind: 'points' } }), [{ b: 3 }]);
  assert.match(finalMoment(pts).text, /^Up 6 pts\. /);
  const lunch = play(mk('skins', { playFor: { kind: 'reward', reward: 'Lunch' } }), [{ b: 3 }]);
  assert.equal(finalMoment(lunch).title, 'Bo wins lunch');
  assert.equal(finalMoment(play(mk('skins'), [{}])).title, 'All square at the top');
});

test('money lead in Stroke play, and Match play still gets its own moments', () => {
  // Stroke play for a pot: Ann birdies 1, Bo birdies 2 and 3 and goes low
  const r = play(mk('stroke', { ids: 'abc' }), [{ a: 3 }, { b: 3 }, { b: 3 }]);
  const m = roundMoment(r, 3);
  assert.equal(m.kind, 'money');
  assert.equal(m.title, 'Bo takes the lead');
  // Match play: Dave squares it, then goes 1 up, as the match reads it
  const mp = play(mk('match', { ids: 'ab', settings: { match: { stake: 10, pressMode: 'off' } } }), [{ a: 3 }, { b: 3 }, { b: 3 }]);
  const ch = roundMoment(mp, 3);
  assert.equal(ch.title, 'Lead change');
  assert.equal(ch.text, 'Bo goes 1 up');
});

test('validate skins: a skin just won says what keeps it, and one that does not hold is its own moment', () => {
  const v = { settings: { skins: { validate: true } } };
  const won = roundMoment(play(mk('skins', v), [{}, {}, {}, { b: 3 }]), 4);
  assert.equal(won.kind, 'bigskin');
  // A validated skin isn't in the money until it holds, so it isn't the lead yet either
  assert.equal(won.text, '$24. That ends a 3-hole carry. Net par on 5 keeps them');
  assert.equal(roundMoment(play(mk('skins', v), [{ b: 3 }]), 1).text, '$6. Net par on 2 keeps it');
  // Bo makes 5 on the 5th and nobody wins it: his 4 skins go back in the carry
  const lost = roundMoment(play(mk('skins', v), [{}, {}, {}, { b: 3 }, { b: 5 }]), 5);
  assert.equal(lost.kind, 'skinlost');
  assert.equal(lost.title, 'Bo didn’t hold it');
  assert.equal(lost.text, 'No net par, so 4 skins go back in the carry');
  // Someone winning the hole they rode on is the bigger news: Cy takes all 5
  const taken = roundMoment(play(mk('skins', v), [{}, {}, {}, { b: 3 }, { b: 5, c: 3 }]), 5);
  assert.equal(taken.title, 'Cy takes 5 skins');
  // Without Validate nothing changes
  assert.equal(roundMoment(play(mk('skins'), [{ b: 3 }]), 1).text, '$6, and the lead');
});

test('validate skins: taking the money lead with the skin reads before what keeps it', () => {
  // Stroke play for $5 a stroke with a side Skins game: Bo's birdie on 2 wins him the skin and puts
  // him ahead on the strokes, so the lead is his now while the skin waits on hole 3
  const side = [{ game: 'skins', settings: { ...SETTINGS.skins, validate: true } }];
  const r = play(mk('stroke', { ids: 'ab', sideGames: side, settings: { stroke: { payout: 'per', stake: 5 } } }), [{ a: 3 }, { b: 2 }]);
  const m = roundMoment(r, 2);
  assert.equal(m.title, 'Bo wins the skin');
  assert.equal(m.text, '$2, and the lead. Net par on 3 keeps it');
});
