// One friend, one person: claimed seats and "Same person as..." join a friend's ids on every
// screen that adds money up, and the money itself never changes, only where it's grouped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { headToHeadSummary, nameOf, outstanding, personStory, roundsTogether, tabBalances, tabWith } from './ledger.js';
import { headToHead, myTab } from './history.js';
import { seasonBoard } from './season.js';
import { seasonStats, sortedPlayers } from './format.js';
import { payInfoFor } from './pay.js';
import { canonicalOf, pairDebt, paidOn, sharedDebts } from './pair-debts.js';
import { allocatePayment, applyRows, carryRowId } from './shared-tab.js';
import { activeCarry, carryReducer, carryRows, carrySplit, sharedOwed, splitCodes, splitRounds } from './carry.js';
import { applyDoc, toDocs } from './cloud-model.js';
import { metaToKeep, metaToSend } from './keeper.js';
import { aliasesOf, claimSeat, linkEdges, linksOf, mergeCandidates, mergeClaims, mergePeople, playedTogether, unmergePerson } from './people-links.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;

/** A finished 9-hole skins round; `wins` is [[winner, hole], ...], every other hole halved. */
function round(id, ids, wins = [], { code = null, daysAgo = 1, localMe, skin = 5, claims, names = {} } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: names[x] || x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [w, no] of wins) r.scores[no][w] = 3;
  r.status = 'done';
  r.finishedAt = NOW - daysAgo * DAY;
  if (code) r.shareCode = code;
  if (localMe !== undefined) r.localMe = localMe;
  if (claims) r.claims = claims;
  return r;
}
const player = (id, name, createdAt = 1) => ({ id, name, index: null, createdAt });
const stateOf = (me, rounds, extra = {}) => ({
  me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, links: {}, unlinks: [], ...extra,
});
const sum = o => Math.round(Object.values(o).reduce((a, v) => a + v, 0) * 100) / 100;
const round2 = v => Math.round(v * 100) / 100;

/**
 * Trevor (t) organizes and saved Sam as p_sam. Sam signed up (his own id zs) and hosts too, where
 * Trevor is Sam's q_t. Both rounds were shared live and both people joined the other's round:
 * - r1, Trevor's: t, p_sam, p_ann. Sam won 2 skins from both. Sam claimed p_sam.
 * - r2, Sam's: zs, q_t. Trevor won 1 skin. Trevor claimed q_t.
 * - r3, Trevor's, only on his phone: t, p_sam. Trevor won 3 skins.
 */
function world({ claims = true } = {}) {
  const r1 = () => round('r1', ['t', 'p_sam', 'p_ann'], [['p_sam', 1], ['p_sam', 2]], { code: 'AAAAAA', daysAgo: 5, claims: claims ? { p_sam: 'zs' } : undefined, names: { t: 'Trevor', p_sam: 'Sam', p_ann: 'Ann' } });
  const r2 = () => round('r2', ['zs', 'q_t'], [['q_t', 1]], { code: 'BBBBBB', daysAgo: 3, claims: claims ? { q_t: 't' } : undefined, names: { zs: 'Sam R.', q_t: 'Trevor' } });
  const r3 = round('r3', ['t', 'p_sam'], [['t', 1], ['t', 2], ['t', 3]], { daysAgo: 1, names: { t: 'Trevor', p_sam: 'Sam' } });
  const trevor = stateOf('t', [r1(), { ...r2(), localMe: 'q_t' }, r3], { players: { t: player('t', 'Trevor'), p_sam: player('p_sam', 'Sam', 5), p_ann: player('p_ann', 'Ann', 6) } });
  const sam = stateOf('zs', [{ ...r1(), localMe: 'p_sam' }, r2()], { players: { zs: player('zs', 'Sam R.'), q_t: player('q_t', 'Trevor', 3) } });
  return { trevor, sam };
}

// ------------------------------- the links -------------------------------------

test('links: a claimed seat is the claimer, on the organizer’s phone and on the claimer’s', () => {
  const { trevor, sam } = world();
  const T = linksOf(trevor);
  assert.equal(T.personOf('zs'), 'p_sam', 'Sam’s own id goes by the player Trevor saved');
  assert.equal(T.personOf('p_sam'), 'p_sam');
  assert.equal(T.personOf('q_t'), 't');
  assert.equal(T.personOf('p_ann'), 'p_ann', 'nobody else moves');
  assert.equal(T.personOf('nobody'), 'nobody', 'an id the phone doesn’t know is itself');
  assert.deepEqual(T.groupOf('zs'), ['p_sam', 'zs'], 'the kept id comes first');
  const S = linksOf(sam);
  assert.equal(S.personOf('p_sam'), 'zs', 'you are always you');
  assert.equal(S.personOf('t'), 'q_t', 'Trevor goes by the player Sam saved');
});

test('links: without claims nothing is linked, and canonicalOf is what it always was', () => {
  const { trevor } = world({ claims: false });
  const who = canonicalOf(trevor);
  assert.equal(who('zs'), 'zs');
  assert.equal(who('p_sam'), 'p_sam');
  assert.equal(who('q_t'), 't', 'your seat in a joined round is still you');
  assert.equal(linkEdges(trevor).filter(e => e.kind !== 'me').length, 0);
});

test('links: a friend claimed in three hosts’ rounds is one person on a phone that has them all', () => {
  const ra = round('ra', ['a', 'a_sam', 'c'], [], { code: 'A1', claims: { a_sam: 'zs', c: 'zc' } });
  const rb = round('rb', ['b', 'b_sam', 'b_c'], [], { code: 'B1', claims: { b_sam: 'zs', b_c: 'zc' } });
  const rs = round('rs', ['zs', 's_c'], [], { code: 'S1', claims: { s_c: 'zc' } });
  const carl = stateOf('zc', [{ ...ra, localMe: 'c' }, { ...rb, localMe: 'b_c' }, { ...rs, localMe: 's_c' }]);
  const L = linksOf(carl);
  assert.equal(L.personOf('a_sam'), L.personOf('b_sam'));
  assert.equal(L.personOf('b_sam'), L.personOf('zs'));
  assert.deepEqual([...L.groupOf('zs')].sort(), ['a_sam', 'b_sam', 'zs']);
  // With no saved player the kept id is simply the smallest, the same every time
  assert.equal(L.personOf('zs'), 'a_sam');
  // Carl's own seats are all Carl
  for (const id of ['c', 'b_c', 's_c']) assert.equal(L.personOf(id), 'zc');
});

test('links: the kept id is you, then a saved player that isn’t an alias, then the oldest saved player, then the smallest id', () => {
  const r = round('r', ['x_2', 'y'], [], { claims: { x_2: 'x_9' } });
  const base = stateOf('me', [r, round('r0', ['me', 'x_1'], [], { claims: { x_1: 'x_9' } })]);
  assert.equal(linksOf(base).personOf('x_9'), 'x_1', 'nothing saved: the smallest id');
  const saved = { ...base, players: { x_2: player('x_2', 'X', 1) } };
  assert.equal(linksOf(saved).personOf('x_1'), 'x_2', 'a saved player wins');
  const two = { ...base, players: { x_1: player('x_1', 'X', 9), x_2: player('x_2', 'X', 2) } };
  assert.equal(linksOf(two).personOf('x_1'), 'x_2', 'two saved players: the oldest');
  const aliased = { ...two, links: { x_2: 'x_1' } };
  assert.equal(linksOf(aliased).personOf('x_2'), 'x_1', 'the one merged away is never kept');
});

test('links: “Not the same person” breaks a claimed link, and it stays broken when the round comes again', () => {
  const { trevor } = world();
  const next = unmergePerson(trevor, 'p_sam', 'zs');
  assert.deepEqual(next.unlinks, [['p_sam', 'zs']]);
  const apart = { ...trevor, ...next };
  assert.equal(linksOf(apart).personOf('zs'), 'zs');
  // The round arrives again with the same claim: still apart
  const again = { ...apart, rounds: { ...apart.rounds, r1: { ...apart.rounds.r1, claims: { p_sam: 'zs' } } } };
  assert.equal(linksOf(again).personOf('zs'), 'zs');
  // And merging them by hand takes the break back
  const merged = { ...again, ...mergePeople(again, 'p_sam', 'zs') };
  assert.deepEqual(merged.unlinks, []);
  assert.equal(linksOf(merged).personOf('zs'), 'p_sam');
});

test('links: cycles in the manual links end in one person, picked the same way every time', () => {
  const s = stateOf('me', [round('r1', ['me', 'a']), round('r2', ['me', 'b']), round('r3', ['me', 'c'])], { links: { a: 'b', b: 'c', c: 'a' } });
  const L = linksOf(s);
  assert.equal(L.personOf('a'), L.personOf('b'));
  assert.equal(L.personOf('b'), L.personOf('c'));
  assert.equal(L.personOf('a'), 'a');
  assert.equal(linksOf({ ...s, links: { c: 'a', a: 'b', b: 'c' } }).personOf('c'), 'a', 'key order doesn’t matter');
  // Links to yourself or to nothing are ignored
  assert.equal(linksOf({ ...s, links: { a: 'a', b: '', c: null } }).personOf('a'), 'a');
  assert.equal(linksOf({ ...s, links: { a: 'a', b: '', c: null } }).personOf('b'), 'b');
});

test('links: two players in the same round are never one person', () => {
  // A bad claim (two seats in one round) and a bad manual link are both skipped
  const r = round('r', ['me', 'a', 'b'], [], { claims: { a: 'zz', b: 'zz' } });
  const s = stateOf('me', [r], { links: { a: 'b' } });
  const L = linksOf(s);
  assert.notEqual(L.personOf('a'), L.personOf('b'));
  assert.ok(playedTogether(s, 'a', 'b'));
  assert.equal(mergePeople(s, 'a', 'b'), null);
});

test('links: someone else claiming your seat never makes them you', () => {
  const r = round('r', ['t', 'p_sam'], [], { code: 'X', claims: { t: 'zs' } });
  const s = stateOf('t', [r]);
  assert.equal(linksOf(s).personOf('zs'), 'zs');
  assert.equal(canonicalOf(s)('zs'), 'zs');
  // A claim of your seat in a joined round by someone else is ignored too
  const j = round('j', ['h', 'q_t'], [], { code: 'Y', localMe: 'q_t', claims: { q_t: 'intruder' } });
  assert.equal(canonicalOf(stateOf('t', [j]))('intruder'), 'intruder');
});

test('links: you can’t merge yourself, and merge candidates leave out you, the same person and people who played together', () => {
  const { trevor } = world();
  const mine = new Set(['t', 'q_t']);
  assert.equal(mergePeople(trevor, 't', 'p_ann'), null);
  assert.equal(mergePeople(trevor, 'p_ann', 't'), null);
  // Everyone in r1 played together, so nobody here can be merged
  assert.deepEqual(mergeCandidates(trevor, 'p_sam', mine), []);
  const withBob = { ...trevor, players: { ...trevor.players, bob: player('bob', 'Bob', 9) } };
  assert.deepEqual(mergeCandidates(withBob, 'p_sam', mine), ['bob']);
  assert.deepEqual(mergeCandidates(withBob, 'bob', mine).sort(), ['p_ann', 'p_sam']);
});

// ------------------------------- the money -------------------------------------

test('money: every round returns exactly the same money before and after linking, and it all adds to zero', () => {
  const { trevor } = world();
  const { trevor: unlinked } = world({ claims: false });
  for (const id of Object.keys(trevor.rounds)) {
    assert.deepEqual(roundResults(trevor.rounds[id]).balances, roundResults(unlinked.rounds[id]).balances);
    assert.equal(sum(roundResults(trevor.rounds[id]).balances), 0);
  }
  const before = tabBalances(unlinked), after = tabBalances(trevor);
  assert.equal(sum(before), 0);
  assert.equal(sum(after), 0);
  // Same money, grouped: Sam's two ids add up to the one person
  assert.equal(round2(after.p_sam), round2(before.p_sam + before.zs));
  assert.equal(after.zs, undefined);
  assert.equal(after.t, before.t);
  assert.equal(after.p_ann, before.p_ann);
});

test('money: the shared Tab pair after linking is exactly the two split pairs added up', () => {
  const { trevor } = world();
  const { trevor: unlinked } = world({ claims: false });
  const opts = { now: NOW };
  const split = pairDebt(unlinked, 't', 'p_sam', opts) + pairDebt(unlinked, 't', 'zs', opts);
  assert.equal(pairDebt(trevor, 't', 'p_sam', opts), split);
  assert.equal(pairDebt(trevor, 't', 'zs', opts), split, 'either of Sam’s ids is Sam');
  // One pair between them, not two
  assert.equal(sharedDebts(trevor, opts).filter(d => [d.from, d.to].includes('p_sam') && [d.from, d.to].includes('t')).length, 1);
  assert.equal(sharedDebts(trevor, opts).some(d => [d.from, d.to].includes('zs')), false);
});

test('money: both phones work out the same amount between Trevor and Sam', () => {
  const { trevor, sam } = world();
  const opts = { now: NOW };
  // Positive when the first owes the second: Trevor owes Sam on the shared rounds
  const onTrevor = pairDebt(trevor, 't', 'p_sam', opts);
  const onSam = pairDebt(sam, 'q_t', 'zs', opts);
  assert.equal(onTrevor, onSam);
  assert.ok(onTrevor > 0);
  assert.deepEqual(sharedOwed(trevor, 't', 'p_sam', NOW).amount, sharedOwed(sam, 'zs', 'q_t', NOW).amount);
});

test('money: payments recorded under raw ids per round still count after linking (paidOn)', () => {
  const { trevor } = world();
  // Trevor paid Sam what he owed on Sam's round (r2 transfer is q_t -> zs), recorded before any link
  const r2 = trevor.rounds.r2;
  const t = roundResults(r2).transfers[0];
  assert.deepEqual([t.from, t.to], ['zs', 'q_t'], 'Sam owes Trevor on r2');
  const paid = { ...trevor, settlements: [{ id: 'p1', from: 'zs', to: 'q_t', amount: t.amount, at: NOW, code: 'BBBBBB', roundId: 'r2' }] };
  assert.equal(paidOn(paid, r2, 'BBBBBB', t), Math.round(t.amount * 100));
  const before = pairDebt(trevor, 't', 'p_sam', { now: NOW });
  const after = pairDebt(paid, 't', 'p_sam', { now: NOW });
  assert.equal(after - before, Math.round(t.amount * 100), 'the payment moved the pair by exactly its amount');
  assert.equal(sum(tabBalances(paid)), 0);
});

test('money: paying the whole card writes rows in each round’s own ids', () => {
  const { trevor } = world();
  const card = tabWith(outstanding(trevor, { now: NOW }), new Set(['t']), 'p_sam');
  assert.equal(card, 10, 'Sam owes Trevor $10 on the whole Tab, though Trevor owes Sam $5 on the shared rounds');
  const { rows, settlements } = allocatePayment(trevor, { from: 'p_sam', to: 't', amount: card }, { now: NOW, makeId: () => 'x' });
  assert.ok(rows.length > 0);
  // Every row names ids from its own round, never the linked ones
  for (const row of rows) {
    const r = Object.values(trevor.rounds).find(x => x.shareCode === row.code);
    const ids = new Set(r.players.map(p => p.id));
    assert.ok(ids.has(row.from) && ids.has(row.to), `${row.id} uses the round’s ids`);
  }
  const after = applyRows({ ...trevor, settlements: [...trevor.settlements, ...settlements] }, rows);
  assert.equal(tabWith(outstanding(after, { now: NOW }), new Set(['t']), 'p_sam'), 0, 'square after paying the card');
  assert.equal(pairDebt(after, 't', 'p_sam', { now: NOW }), 0);
});

test('money: a carry saved under Sam’s old id still nets against him once linked', () => {
  const { trevor: unlinked } = world({ claims: false });
  // Before the link: Trevor and zs (Sam's own id) had rolled r2 over
  const owed = sharedOwed(unlinked, 't', 'zs', NOW);
  assert.deepEqual(owed, { from: 'zs', to: 't', amount: 5 });
  const split = carrySplit(unlinked, owed.from, owed.to, owed.amount, NOW);
  const ask = carryReducer(null, { type: 'ask', ...owed, by: 't', at: NOW, roundIds: splitRounds(split), codes: splitCodes(split) });
  const agreed = carryReducer(ask, { type: 'agree', at: NOW + 1 });
  const rows = carryRows(unlinked, agreed, { now: NOW + 1, split });
  const saved = applyRows(unlinked, rows);
  assert.equal(saved.carries.length, 1);
  // Now the claim arrives: the old carry belongs to Sam
  const { trevor } = world();
  const linked = { ...trevor, carries: saved.carries, tabRows: saved.tabRows };
  const found = activeCarry(linked, 't', 'p_sam', { from: 'p_sam', to: 't', amount: 5 });
  assert.equal(found?.status, 'agreed');
  assert.equal(found.carried, 5);
  // The carry's rows arriving again after the link don't make a second carry
  const again = applyRows(linked, rows.map(r => ({ ...r, updatedAt: NOW + 2 })));
  assert.equal(again.carries.length, 1);
  assert.equal(again.tabRows[`BBBBBB|${carryRowId('BBBBBB', 'zs', 'q_t')}`].from, 'zs', 'rows keep the round’s own ids');
  // And the carry moves no money
  assert.deepEqual(tabBalances(again), tabBalances(trevor));
});

// ------------------------------- the screens -----------------------------------

test('screens: head to head, record and the story put Sam’s ids together', () => {
  const { trevor } = world();
  const { trevor: unlinked } = world({ claims: false });
  const mine = new Set(['t', 'q_t']);
  const h = headToHeadSummary(trevor, mine);
  assert.equal(h.has('zs'), false);
  const sam = h.get('p_sam');
  const a = headToHeadSummary(unlinked, mine);
  assert.equal(sam.rounds, a.get('p_sam').rounds + a.get('zs').rounds);
  assert.equal(sam.net, round2(a.get('p_sam').net + a.get('zs').net));
  assert.equal(sam.won + sam.lost + sam.even, sam.rounds);
  // The story, opened with either id, is the same three rounds
  const story = personStory(trevor, mine, 'p_sam');
  assert.equal(story.rounds, 3);
  assert.deepEqual(personStory(trevor, mine, 'zs'), story);
  assert.equal(story.net, sam.net);
  // History's head to head and the season agree
  assert.deepEqual(Object.keys(headToHead(Object.values(trevor.rounds), trevor)), ['p_sam'], 'Ann came out even with Trevor');
  assert.equal(headToHead(Object.values(trevor.rounds), trevor).p_sam, sam.net);
  const year = new Date(NOW).getFullYear();
  const board = seasonBoard(trevor, year);
  assert.equal(board.rival.id, 'p_sam');
  assert.equal(board.rival.rounds, 3);
  assert.equal(board.balances.some(b => b.id === 'zs'), false);
  assert.equal(sum(Object.fromEntries(board.balances.map(b => [b.id, b.net]))), 0);
  assert.equal(seasonStats(trevor, year).h2h.p_sam, sam.net);
  assert.equal(seasonStats(trevor, year).h2h.zs, undefined);
});

test('screens: the Tab has one row for Sam, rounds together follow him, and myTab is unchanged in total', () => {
  const { trevor } = world();
  const { trevor: unlinked } = world({ claims: false });
  const plan = outstanding(trevor, { now: NOW });
  assert.equal(plan.some(t => t.from === 'zs' || t.to === 'zs'), false);
  const together = roundsTogether(trevor);
  assert.deepEqual(together.get('p_sam|t').sort(), ['r1', 'r2', 'r3']);
  assert.equal(myTab(trevor).net, myTab(unlinked).net, 'what you’re owed in all never changes');
});

test('screens: names, pay apps and pickers follow the link; aliases list the other ids', () => {
  const { trevor } = world();
  const withPay = { ...trevor, rounds: { ...trevor.rounds, r2: { ...trevor.rounds.r2, players: trevor.rounds.r2.players.map(p => (p.id === 'zs' ? { ...p, payApp: 'venmo', payHandle: 'samr' } : p)) } } };
  assert.equal(payInfoFor(withPay, 'p_sam')?.handle, 'samr', 'Sam’s app from his own round shows on his card');
  assert.equal(nameOf(trevor, 'zs'), 'Sam R.');
  assert.equal(nameOf({ ...trevor, rounds: { r1: trevor.rounds.r1 } }, 'zs'), 'Sam', 'an id only known through a link takes the person’s name');
  assert.deepEqual(aliasesOf(trevor, 'p_sam', x => nameOf(trevor, x)), [{ id: 'zs', name: 'Sam R.', manual: false }]);
  assert.deepEqual(aliasesOf(trevor, 'zs').map(a => a.id), ['zs'], 'opened with the alias it still lists the other ids of the kept card');
  // A player merged by hand stays out of the pickers until it's unlinked
  const two = { ...trevor, players: { ...trevor.players, p_sam2: player('p_sam2', 'Sammy', 9) } };
  const merged = { ...two, ...mergePeople(two, 'p_sam', 'p_sam2') };
  assert.deepEqual(merged.links, { p_sam2: 'p_sam' });
  assert.deepEqual(sortedPlayers(merged).map(p => p.id), ['t', 'p_ann', 'p_sam']);
  assert.ok(merged.players.p_sam2, 'the record is never deleted');
  const back = { ...merged, ...unmergePerson(merged, 'p_sam', 'p_sam2') };
  assert.deepEqual(back.links, {});
  assert.deepEqual(sortedPlayers(back).map(p => p.id), ['t', 'p_ann', 'p_sam', 'p_sam2']);
});

test('merge and undo: the card you merge from is kept, and undo puts everything back', () => {
  const s = stateOf('t', [round('r1', ['t', 'a'], [['a', 1]]), round('r2', ['t', 'b'], [['t', 1], ['t', 2]])], {
    players: { t: player('t', 'T'), a: player('a', 'Al', 1), b: player('b', 'Albert', 5) },
  });
  // Merging the older record into the newer one keeps the newer one, since that's the card you're on
  const next = mergePeople(s, 'b', 'a');
  const m = { ...s, ...next };
  assert.equal(linksOf(m).personOf('a'), 'b');
  assert.deepEqual(tabBalances(m), { t: 5, b: -5 });
  assert.equal(sum(tabBalances(m)), 0);
  const h = headToHeadSummary(m, new Set(['t'])).get('b');
  assert.deepEqual(h, { rounds: 2, won: 1, lost: 1, even: 0, net: 5 });
  // Undo
  const u = { ...m, ...unmergePerson(m, 'b', 'a') };
  assert.deepEqual(tabBalances(u), tabBalances(s));
  assert.equal(linksOf(u).personOf('a'), 'a');
});

test('merge and undo: taking one id out of a group keeps the rest of the group together', () => {
  // Sam claimed seats in two hosts' rounds, and Trevor merged a third record by hand
  const ra = round('ra', ['h1', 'a_sam'], [], { claims: { a_sam: 'zs' } });
  const rb = round('rb', ['h2', 'b_sam'], [], { claims: { b_sam: 'zs' } });
  const rc = round('rc', ['t', 'p_sam'], []);
  const s = stateOf('t', [ra, rb, rc], { players: { t: player('t', 'T'), p_sam: player('p_sam', 'Sam') }, links: { zs: 'p_sam' } });
  const L = linksOf(s);
  assert.deepEqual([...L.groupOf('p_sam')].sort(), ['a_sam', 'b_sam', 'p_sam', 'zs']);
  // "Not the same person" on zs, the id joining everything
  const next = unmergePerson(s, 'p_sam', 'zs');
  const u = linksOf({ ...s, ...next });
  assert.equal(u.personOf('zs'), 'zs');
  assert.equal(u.personOf('a_sam'), 'p_sam', 'the others stay with the card');
  assert.equal(u.personOf('b_sam'), 'p_sam');
  assert.equal(unmergePerson(s, 'p_sam', 'nobody'), null);
  assert.equal(unmergePerson(s, 'p_sam', 'p_sam'), null, 'the kept card itself can’t be taken out');
});

// ------------------------------- claims and sync -------------------------------

test('claims: taking a seat claims it once; a second seat in the same round replaces the first', () => {
  const r = round('r', ['h', 'a', 'b'], []);
  assert.deepEqual(claimSeat(r, 'a', 'zs'), { a: 'zs' });
  const once = { ...r, claims: { a: 'zs' } };
  assert.equal(claimSeat(once, 'a', 'zs'), null, 'the same claim again changes nothing');
  assert.deepEqual(claimSeat(once, 'b', 'zs'), { b: 'zs' });
  assert.deepEqual(claimSeat({ ...r, claims: { a: 'zc' } }, 'b', 'zs'), { a: 'zc', b: 'zs' });
  assert.equal(claimSeat(r, 'a', null), null, 'a guest with no profile claims nothing');
  assert.equal(claimSeat(r, 'nope', 'zs'), null);
  assert.equal(claimSeat(r, 'a', 'a'), null);
});

test('claims: two phones claiming at once both keep theirs, and a phone that can’t edit may send its claim', () => {
  assert.deepEqual(mergeClaims({ a: 'x' }, { b: 'y' }), { a: 'x', b: 'y' });
  assert.deepEqual(mergeClaims({ a: 'x' }, { a: 'y', c: 'x' }), { a: 'x' }, 'a seat and a person claim once');
  assert.equal(mergeClaims(undefined, null), undefined);
  const base = { game: 'skins', players: [{ id: 'h' }, { id: 'a' }, { id: 'b' }], onApp: {} };
  // A phone that isn't keeping score sends its claim
  const sent = metaToSend(base, { ...base, game: 'nassau', claims: { a: 'za' } }, { editor: false, me: 'a' });
  assert.deepEqual(sent.claims, { a: 'za' });
  assert.equal(sent.game, 'skins', 'and still nothing else');
  // Both claimed at once: each phone keeps both
  const mine = { ...base, claims: { a: 'za' } }, theirs = { ...base, claims: { b: 'zb' } };
  assert.deepEqual(metaToKeep(base, mine, theirs, { editor: false, me: 'a' }).claims, { a: 'za', b: 'zb' });
  assert.deepEqual(metaToKeep(base, theirs, mine, { editor: true, me: 'h' }).claims, { a: 'za', b: 'zb' });
  // Without claims anywhere the meta is left as it was
  assert.equal('claims' in metaToKeep(base, base, { ...base, game: 'wolf' }, { editor: true, me: 'h' }), false);
});

test('claims: a copy that hasn’t caught up never drops a claim, and an older app passes them through', () => {
  const base = { game: 'skins', players: [{ id: 'a' }, { id: 'b' }], claims: { a: 'za' } };
  const sent = metaToSend(base, { game: 'skins', players: [{ id: 'a' }, { id: 'b' }] }, { editor: false, me: 'b' });
  assert.deepEqual(sent.claims, { a: 'za' });
  // What an older version sends from a phone that isn't keeping score: the server's copy with its own open keys laid over
  const oldSend = (b, local) => { const out = { ...b }; for (const k of ['keeper', 'cardAsk', 'onApp']) { if (k in local) out[k] = local[k]; else delete out[k]; } return out; };
  assert.deepEqual(oldSend(base, { game: 'skins' }).claims, { a: 'za' });
});

test('profile: links and unlinks ride in the profile doc, and an older profile keeps the phone’s', () => {
  const s = { ...stateOf('t', []), crews: {}, customCourses: {}, links: { a: 'b' }, unlinks: [['c', 'd']], settings: {}, favorites: [] };
  const doc = toDocs(s)['profile:me'].data;
  assert.deepEqual(doc.links, { a: 'b' });
  assert.deepEqual(doc.unlinks, [['c', 'd']]);
  const fresh = { players: {}, crews: {}, customCourses: {}, rounds: {}, settlements: [], settings: {}, links: {}, unlinks: [] };
  applyDoc(fresh, 'profile', 'me', doc);
  assert.deepEqual(fresh.links, { a: 'b' });
  assert.deepEqual(fresh.unlinks, [['c', 'd']]);
  const kept = { ...fresh };
  applyDoc(kept, 'profile', 'me', { me: 't', onboarded: true, settings: {}, favorites: [] });
  assert.deepEqual(kept.links, { a: 'b' }, 'an older profile doesn’t wipe them');
  assert.deepEqual(kept.unlinks, [['c', 'd']]);
});

test('state from before links existed (no links, no unlinks, junk values) works as it always did', () => {
  const { trevor } = world({ claims: false });
  const old = { ...trevor };
  delete old.links; delete old.unlinks;
  assert.deepEqual(tabBalances(old), tabBalances(trevor));
  assert.deepEqual(linksOf({ ...old, links: 'junk', unlinks: [[1, 2], 'x', null] }).personOf('p_sam'), 'p_sam');
  assert.equal(linksOf(undefined).personOf('a'), 'a');
  assert.equal(linksOf({}).personOf('a'), 'a');
});
