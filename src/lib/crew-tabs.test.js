// A tab for each crew or trip: each tab has only its rounds, and the tabs add up to Everyone to the cent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabResults } from './play-for.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { outstanding, tabBalances } from './ledger.js';
import { tripPayment, tripStatus } from './trips.js';
import { NOW, OCT, TRIP, base, skins } from './crew-tabs.fixtures.js';
import { OTHER, crewKey, crewOfRound, crewPayment, crewsOf, netsOf, switchTabs, tabKeyOf, tabOf, tabsOf, tripKey } from './crew-tabs.js';

/** Every tab's balances added up, person by person. */
function summed(all) {
  const out = {};
  for (const t of all.tabs) for (const [id, c] of Object.entries(t.balances)) out[id] = (out[id] || 0) + c;
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
/** A round's balances in cents, zeros left out. */
const roundCents = r => Object.fromEntries(Object.entries(tabResults(r).balances).map(([k, v]) => [k, Math.round(v * 100)]).filter(([, c]) => c));
const tabBy = (all, key) => all.tabs.find(t => t.key === key);
/** What tabBalances has for each person, in cents, zeros left out. */
const balCents = s => Object.fromEntries(Object.entries(tabBalances(s, { now: NOW })).map(([k, v]) => [k, Math.round(v * 100)]).filter(([, c]) => c));

test('a round counts for the crew everyone else in it belongs to; you are in all your crews', () => {
  const s = base([]);
  const crews = crewsOf(s);
  assert.equal(crewOfRound(s, skins('x', ['t', 'a', 'b'], [], { at: OCT(1) }), crews)?.id, 'sat');
  assert.equal(crewOfRound(s, skins('x', ['t', 'a'], [], { at: OCT(1) }), crews)?.id, 'sat', 'some of the crew is still the crew');
  assert.equal(crewOfRound(s, skins('x', ['t', 'a', 'c'], [], { at: OCT(1) }), crews), null, 'a guest makes it another round');
  assert.equal(crewOfRound(s, skins('x', ['a', 'b'], [], { at: OCT(1) }), crews)?.id, 'sat', 'a crew round you only kept score for');
});

test('the smallest crew that fits wins, and a trip round is always the trip’s', () => {
  const s = base([], { crews: { big: { id: 'big', name: 'Everybody', playerIds: ['a', 'b', 'c'] }, sat: { id: 'sat', name: 'Saturday crew', playerIds: ['a', 'b'] } }, trips: { tp: TRIP } });
  assert.deepEqual(crewsOf(s).map(c => c.id), ['sat', 'big']);
  assert.equal(tabKeyOf(s, skins('x', ['t', 'a', 'b'], [], { at: OCT(1) })), crewKey('sat'));
  assert.equal(tabKeyOf(s, skins('x', ['t', 'a', 'c'], [], { at: OCT(1) })), crewKey('big'));
  assert.equal(tabKeyOf(s, skins('x', ['t', 'a', 'b'], [], { at: OCT(17), trip: true })), tripKey('tp'));
  assert.equal(tabKeyOf(s, skins('x', ['t', 'd'], [], { at: OCT(1) })), OTHER);
});

test('each tab has only its rounds, and the tabs add up to Everyone person by person', () => {
  const crew = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'a']], { at: OCT(3) });
  const guest = skins('r2', ['t', 'c'], [[1, 'c']], { at: OCT(5) });
  const trip = skins('r3', ['t', 'a'], [[1, 'a'], [2, 'a']], { at: OCT(17), trip: true });
  const s = base([crew, guest, trip], { trips: { tp: TRIP } });
  const all = tabsOf(s, { now: NOW });
  assert.deepEqual(summed(all), all.everyone.balances);
  assert.deepEqual(all.everyone.balances, balCents(s));
  const sat = tabBy(all, crewKey('sat'));
  assert.deepEqual(sat.rounds.map(r => r.id), ['r1']);
  assert.deepEqual(sat.balances, roundCents(crew));
  assert.deepEqual(tabBy(all, OTHER).balances, roundCents(guest));
  assert.deepEqual(tabBy(all, tripKey('tp')).balances, roundCents(trip));
  assert.deepEqual(tabBy(all, tripKey('tp')).lines.map(l => [l.from, l.to, l.amount]), tripStatus(s, 'tp', { now: NOW }).plan.map(l => [l.from, l.to, l.amount]), 'the trip’s tab is Settle the trip’s plan');
});

test('a payment from Everyone pays the crew’s tab first, then the rest, and the tabs still add up', () => {
  const crew = skins('r1', ['t', 'a'], [[1, 't'], [2, 't'], [3, 't']], { at: OCT(3) });
  const guest = skins('r2', ['t', 'a', 'c'], [[1, 't']], { at: OCT(5) });
  let s = base([crew, guest]);
  // a owes t $6 on the crew's round and $2 on the other
  const card = outstanding(s, { now: NOW }).find(l => l.from === 'a' && l.to === 't').amount;
  assert.equal(card, 8);
  s = { ...s, settlements: [{ id: 's1', from: 'a', to: 't', amount: 7, at: OCT(6) }] };
  const all = tabsOf(s, { now: NOW });
  assert.deepEqual(summed(all), all.everyone.balances);
  assert.deepEqual(tabBy(all, crewKey('sat')).lines, [], 'the crew’s $6 is paid first');
  assert.deepEqual(tabBy(all, OTHER).lines.map(l => [l.from, l.to, l.amount]).sort(), [['a', 't', 1], ['c', 't', 2]]);
});

test('paying a crew’s line squares the crew’s tab, takes the same off Everyone and leaves the other tabs alone', () => {
  const crew = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 'a'], [3, 't'], [4, 't']], { at: OCT(3) });
  const guest = skins('r2', ['t', 'a', 'c'], [[1, 'c']], { at: OCT(5) });
  let s = base([crew, guest]);
  const before = tabsOf(s, { now: NOW });
  const sat = tabBy(before, crewKey('sat'));
  assert.ok(sat.lines.length > 0);
  let n = 0;
  for (const line of sat.lines) {
    const { rows, settlements } = crewPayment(s, 'sat', line.from, line.to, { now: NOW, makeId: () => `p${n++}`, tab: sat, line });
    assert.deepEqual(rows, [], 'nothing shared live');
    s = applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
  }
  const after = tabsOf(s, { now: NOW + 1 });
  assert.deepEqual(tabBy(after, crewKey('sat')).lines, []);
  assert.deepEqual(tabBy(after, OTHER).balances, tabBy(before, OTHER).balances);
  assert.deepEqual(summed(after), after.everyone.balances);
  const diff = {};
  for (const [id, c] of Object.entries(before.everyone.balances)) diff[id] = c - (after.everyone.balances[id] || 0);
  for (const k of Object.keys(diff)) if (!diff[k]) delete diff[k];
  assert.deepEqual(diff, sat.balances, 'Everyone moved by exactly the crew’s tab');
});

test('a crew’s line on a round shared live is paid on the shared rows, so the friend’s phone sees it too', () => {
  const crew = skins('r1', ['t', 'a'], [[1, 't'], [2, 't']], { at: OCT(10), code: 'CRW001' });
  const other = skins('r2', ['t', 'a', 'c'], [[1, 'a']], { at: OCT(12), code: 'OTH001' });
  // Phone t has the crew; phone a doesn't (a's own phone, its own me)
  let mine = base([crew, other]);
  let theirs = { ...base([structuredClone(crew), structuredClone(other)]), me: 'a', crews: {} };
  const sat = tabOf(mine, crewKey('sat'), { now: NOW });
  const line = sat.lines[0];
  assert.deepEqual([line.from, line.to, line.amount, line.shared], ['a', 't', 4, 400]);
  const { rows, settlements } = crewPayment(mine, 'sat', 'a', 't', { now: NOW });
  assert.equal(settlements.length, 0);
  assert.ok(rows.length > 0 && rows.every(r => r.code === 'CRW001'));
  mine = applyRows(mine, rows);
  theirs = applyRows(theirs, rows);
  const pairOn = st => outstanding(st, { now: NOW + 1 }).filter(l => [l.from, l.to].sort().join() === 'a,t').map(l => [l.from, l.to, l.amount]);
  assert.deepEqual(pairOn(mine), [['t', 'a', 2]], 'only the other round is left');
  assert.deepEqual(pairOn(theirs), pairOn(mine), 'both phones agree');
  assert.deepEqual(tabOf(mine, crewKey('sat'), { now: NOW + 1 }).lines, []);
});

test('the tabs add up with a trip, a published Settle the trip payment and money from before the trip', () => {
  const pre = skins('r0', ['t', 'a'], [[1, 't']], { at: OCT(10) });
  const shared = skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'b']], { at: OCT(16), code: 'SHR001', trip: true });
  const local = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(17), trip: true });
  let s = base([pre, shared, local], { trips: { tp: TRIP } });
  assert.deepEqual(summed(tabsOf(s, { now: NOW })), tabsOf(s, { now: NOW }).everyone.balances);
  // Pay a's whole Tab line from Everyone: the trip counts its part, the crew's tab gets the rest
  const card = outstanding(s, { now: NOW }).find(l => l.from === 'a' && l.to === 't');
  const res = allocatePayment(s, { from: 'a', to: 't', amount: card.amount }, { now: NOW + 1000, makeId: () => 'p1' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows);
  const all = tabsOf(s, { now: NOW + 2000 });
  assert.deepEqual(summed(all), all.everyone.balances);
  const has = (t, a, b) => t.lines.some(l => [l.from, l.to].sort().join() === [a, b].sort().join());
  assert.ok(!has(tabBy(all, crewKey('sat')), 'a', 't'), 'square on the crew');
  assert.ok(!has(tabBy(all, tripKey('tp')), 'a', 't'), 'square on the trip');
});

test('a points round adds nothing, and a crew with no rounds has no switch of its own', () => {
  const pts = skins('r1', ['t', 'a'], [[1, 't']], { at: OCT(3) });
  pts.playFor = { kind: 'points' };
  const s = base([pts]);
  const all = tabsOf(s, { now: NOW });
  assert.deepEqual(all.everyone.balances, {});
  assert.deepEqual(switchTabs(all), []);
  const s2 = base([skins('r1', ['t', 'a'], [[1, 't']], { at: OCT(3) }), skins('r2', ['t', 'd'], [[1, 'd']], { at: OCT(4) })]);
  assert.deepEqual(switchTabs(tabsOf(s2, { now: NOW })).map(t => t.key), [crewKey('sat'), OTHER]);
});

test('Everyone and the trip’s Settle the trip are the same with or without crews (old rounds keep their money)', () => {
  const rounds = [
    skins('r0', ['t', 'a', 'b'], [[1, 't'], [2, 'b']], { at: OCT(8) }),
    skins('r1', ['t', 'a', 'b'], [[1, 'a'], [2, 'a']], { at: OCT(16), code: 'SHR001', trip: true }),
    skins('r2', ['t', 'c'], [[1, 'c']], { at: OCT(17), trip: true }),
  ];
  const settlements = [{ id: 's1', from: 'b', to: 't', amount: 1, at: OCT(9) }];
  const plain = base(structuredClone(rounds), { crews: {}, trips: { tp: TRIP }, settlements });
  const crewed = base(structuredClone(rounds), { trips: { tp: TRIP }, settlements });
  assert.deepEqual(outstanding(crewed, { now: NOW }), outstanding(plain, { now: NOW }));
  assert.deepEqual(tripStatus(crewed, 'tp', { now: NOW }).plan, tripStatus(plain, 'tp', { now: NOW }).plan);
  // A payment that names a crew is that crew's, never counted for the trip
  const tagged = { ...crewed, settlements: [...settlements, { id: 's2', from: 'a', to: 't', amount: 2, at: OCT(18), tab: crewKey('sat') }] };
  assert.deepEqual(tripStatus(tagged, 'tp', { now: NOW }).plan, tripStatus(crewed, 'tp', { now: NOW }).plan);
  assert.deepEqual(summed(tabsOf(tagged, { now: NOW })), netsOf(outstanding(tagged, { now: NOW })));
});

test('settling every crew and trip on its own leaves Everyone with just Other rounds, to the cent', () => {
  const crews = { sat: { id: 'sat', name: 'Saturday crew', playerIds: ['a', 'b'] }, big: { id: 'big', name: 'Big group', playerIds: ['a', 'b', 'c'] } };
  const rounds = [
    skins('r1', ['t', 'a', 'b'], [[1, 't'], [2, 'b'], [3, 'b'], [4, 'a']], { at: OCT(2) }),
    skins('r2', ['t', 'a', 'c'], [[1, 'c'], [2, 'c'], [3, 't']], { at: OCT(4), code: 'BIG001' }),
    skins('r3', ['t', 'b', 'c'], [[1, 'b']], { at: OCT(6), skin: 5 }),
    skins('r4', ['t', 'd'], [[1, 't'], [2, 't']], { at: OCT(8) }),
    skins('r5', ['t', 'a', 'd'], [[1, 'd']], { at: OCT(9), code: 'OTH001' }),
    skins('r6', ['t', 'a', 'b'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(16), code: 'TRP001', trip: true }),
    skins('r7', ['t', 'c'], [[1, 't']], { at: OCT(17), trip: true }),
  ];
  let s = base(rounds, { crews, trips: { tp: TRIP }, settlements: [{ id: 'early', from: 'b', to: 't', amount: 3, at: OCT(7) }] });
  const start = tabsOf(s, { now: NOW });
  assert.deepEqual(summed(start), start.everyone.balances);
  const otherBefore = tabBy(start, OTHER).balances;
  let n = 0;
  for (const key of [crewKey('sat'), crewKey('big')]) {
    const tab = tabBy(tabsOf(s, { now: NOW }), key);
    for (const line of tab.lines) {
      const { rows, settlements } = crewPayment(s, tab.id, line.from, line.to, { now: NOW, makeId: () => `c${n++}`, tab, line });
      s = applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
    }
  }
  for (const line of tripStatus(s, 'tp', { now: NOW }).plan) {
    const { rows, settlements } = tripPayment(s, 'tp', line.from, line.to, { now: NOW });
    s = applyRows({ ...s, settlements: [...s.settlements, ...settlements] }, rows);
  }
  const end = tabsOf(s, { now: NOW + 1 });
  for (const t of end.tabs) if (t.kind !== 'other') assert.deepEqual(t.lines, [], `${t.name} is square`);
  assert.deepEqual(tabBy(end, OTHER).balances, otherBefore, 'Other rounds untouched');
  assert.deepEqual(end.everyone.balances, otherBefore, 'Everyone is just Other rounds now');
});

test('a payment from Everyone made before a crew round pays the older round, never the crew’s', () => {
  const old = skins('r1', ['t', 'a', 'c'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(1) });
  const crew = skins('r2', ['t', 'a'], [[1, 'a']], { at: OCT(5) });
  const s = base([old, crew], { settlements: [{ id: 's1', from: 't', to: 'a', amount: 6, at: OCT(2) }] });
  const all = tabsOf(s, { now: NOW });
  assert.deepEqual(summed(all), all.everyone.balances);
  assert.deepEqual(tabBy(all, crewKey('sat')).lines.map(l => [l.from, l.to, l.amount]), [['t', 'a', 2]], 'the crew’s round, played after, is still owed');
  assert.deepEqual(tabBy(all, OTHER).lines.map(l => [l.from, l.to, l.amount]), [['c', 'a', 6]], 'what t paid squared the older round');
});

test('paying the whole card on Everyone squares two people on every tab when their rounds shared live ran opposite ways', () => {
  // t owes a $6 on the crew's round, a owes t $2 on another round: Everyone has t owing a $4
  const crew = skins('r1', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(3), code: 'CRW002' });
  const other = skins('r2', ['t', 'a', 'c'], [[1, 't']], { at: OCT(5), code: 'OTH002' });
  let s = base([crew, other]);
  const card = outstanding(s, { now: NOW }).find(l => l.from === 't' && l.to === 'a');
  assert.equal(card.amount, 4);
  const res = allocatePayment(s, { from: 't', to: 'a', amount: card.amount }, { now: NOW, makeId: () => 'p1' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows);
  const all = tabsOf(s, { now: NOW + 1 });
  assert.deepEqual(summed(all), all.everyone.balances);
  const between = (t, a, b) => t.lines.filter(l => [l.from, l.to].sort().join() === [a, b].sort().join());
  assert.deepEqual(between(tabBy(all, crewKey('sat')), 't', 'a'), [], 'the crew’s tab is square too, so nobody pays the $2 twice');
  assert.deepEqual(between(tabBy(all, OTHER), 't', 'a'), []);
  assert.deepEqual(tabBy(all, OTHER).lines.map(l => [l.from, l.to, l.amount]), [['c', 't', 2]]);
});

test('a payment from Everyone nets one tab against another between the two people, with no round shared', () => {
  // Two crews: t owes a $8 on one, a owes t $6 on the other (b breaks even); t pays the $2 Everyone has
  const crews = { duo: { id: 'duo', name: 'Duo', playerIds: ['a'] }, sat: { id: 'sat', name: 'Saturday crew', playerIds: ['a', 'b'] } };
  const one = skins('r1', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 'a'], [4, 'a']], { at: OCT(3) });
  const two = skins('r2', ['t', 'a', 'b'], [[1, 't'], [2, 't'], [3, 'b']], { at: OCT(5) });
  let s = base([one, two], { crews });
  const before = tabsOf(s, { now: NOW });
  assert.deepEqual(tabBy(before, crewKey('duo')).lines.map(l => [l.from, l.to, l.amount]), [['t', 'a', 8]]);
  assert.deepEqual(tabBy(before, crewKey('sat')).lines.map(l => [l.from, l.to, l.amount]), [['a', 't', 6]]);
  const card = outstanding(s, { now: NOW }).find(l => l.from === 't' && l.to === 'a');
  s = { ...s, settlements: [{ id: 's1', from: 't', to: 'a', amount: card.amount, at: NOW }] };
  const all = tabsOf(s, { now: NOW + 1 });
  assert.deepEqual(summed(all), all.everyone.balances);
  assert.ok(!outstanding(s, { now: NOW + 1 }).some(l => [l.from, l.to].sort().join() === 'a,t'), 'square on Everyone');
  for (const t of all.tabs) assert.deepEqual(t.lines, [], `square on ${t.name}`);
});

test('a payment Everyone passed on through someone pays the tabs it stands for, so settling all of Everyone squares every tab', () => {
  // t owes a $6 on the crew's round; on another round a owes t $2 and c owes t $2. Everyone passes c's $2 straight to a
  const crew = skins('r1', ['t', 'a'], [[1, 'a'], [2, 'a'], [3, 'a']], { at: OCT(3) });
  const other = skins('r2', ['t', 'a', 'c'], [[1, 't']], { at: OCT(5) });
  let s = base([crew, other]);
  let n = 0;
  for (let i = 0; i < 4; i++) {
    // You pay your line first, then c pays a
    const line = outstanding(s, { now: NOW + i }).sort((x, y) => (y.from === 't') - (x.from === 't'))[0];
    if (!line) break;
    s = { ...s, settlements: [...s.settlements, { id: `e${n++}`, from: line.from, to: line.to, amount: line.amount, at: NOW + i }] };
  }
  assert.deepEqual(outstanding(s, { now: NOW + 10 }), [], 'square on Everyone');
  const all = tabsOf(s, { now: NOW + 10 });
  assert.deepEqual(summed(all), {});
  for (const t of all.tabs) assert.deepEqual(t.lines, [], `square on ${t.name}`);
});

test('paying a whole card on Everyone pays the payer’s whole line on a crew’s tab, even when the payee owes someone else there', () => {
  // On the crew's tab you owe Al $2 and Bo owes you $20; Bo also owes you $4 on a round with a guest, shared live
  const r1 = skins('r1', ['t', 'a'], [[1, 'a']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'b'], [[1, 't'], [2, 't'], [3, 't'], [4, 't'], [5, 't'], [6, 't'], [7, 't'], [8, 't'], [9, 't']], { at: OCT(4), skin: 20 / 9 });
  const r3 = skins('r3', ['t', 'b', 'c'], [[1, 't'], [2, 't']], { at: OCT(5), code: 'SHR001' });
  const s = base([r1, r2, r3]);
  const line = outstanding(s, { now: NOW }).find(l => l.from === 'b' && l.to === 't');
  assert.equal(line.amount, 24);
  const res = allocatePayment(s, { from: 'b', to: 't', amount: line.amount }, { now: NOW, makeId: () => 'x1' });
  let paid = applyRows(s, res.rows);
  paid = { ...paid, settlements: [...paid.settlements, ...res.settlements] };
  const all = tabsOf(paid, { now: NOW + 1 });
  assert.ok(!all.everyone.lines.some(l => [l.from, l.to].includes('b')), 'Bo is square on Everyone');
  const sat = tabBy(all, crewKey('sat'));
  assert.deepEqual(sat.lines.map(l => [l.from, l.to, l.amount]), [['t', 'a', 2]], 'the crew’s tab only has what you owe Al');
  assert.deepEqual(tabBy(all, OTHER).lines.map(l => [l.from, l.to, l.amount]), [['c', 't', 4]], 'Other rounds has nothing between you and Bo');
  assert.deepEqual(summed(all), all.everyone.balances);
});

test('Other rounds keeps money between two people who never shared a round, through someone square there', () => {
  // Cal wins $6 off you, you win $6 off Dave: Everyone sends Dave's $6 on through you to Cal
  const r1 = skins('r1', ['t', 'c'], [[1, 'c'], [2, 'c'], [3, 'c']], { at: OCT(3) });
  const r2 = skins('r2', ['t', 'd'], [[1, 't'], [2, 't'], [3, 't']], { at: OCT(4) });
  const r3 = skins('r3', ['t', 'a'], [[1, 't']], { at: OCT(5) });
  const all = tabsOf(base([r1, r2, r3]), { now: NOW });
  const other = tabBy(all, OTHER);
  assert.deepEqual(other.balances, { d: -600, c: 600 });
  assert.deepEqual(netsOf(other.lines), other.balances, 'its lines add up to its balances');
  assert.deepEqual(other.lines.map(l => [l.from, l.to, l.amount]).sort(), [['d', 't', 6], ['t', 'c', 6]]);
});
