// Printable sheets (print-sheets.js): pairings from a trip's flights, carts two to a cart with the
// odd one out alone, where groups start, results that are the app's own numbers (roundResults,
// tripStatus, bigStatus) and never worked out again, and pages that never lose a row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { newTrip, tripStamp, tripStatus } from './trips.js';
import { BIG_FORMAT, cleanBig } from './big-game.js';
import { bigStatus } from './big-money.js';
import { money } from './golf.js';
import {
  applyStarts, balancedChunks, blockSize, cartPairs, cartSigns, groupsFromFlights, hcText, longDate, needsStarts, pairingPages,
  paginate, printEvent, resultBlocks, roundEvent, roundSheetResults, startSlots, startText, tripEvent,
} from './print-sheets.js';

const EM = String.fromCharCode(0x2014);
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { t: 'Trevor Nielsen', s: 'Sam Ray', m: 'Mike Lee', d: 'Dave Ortiz', a: 'Ann Cole', b: 'Bob Diaz', c: 'Cal Park', e: 'Eve Shaw', f: 'Fay Lin', g: 'Gus Hart', h: 'Hal Moss' };
const players = ids => Object.fromEntries(ids.map(id => [id, { id, name: NAMES[id] }]));
const stateOf = (rounds = [], extra = {}) => ({
  me: 't', players: players(Object.keys(NAMES)), rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
  settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, settings: {}, accountOf: {}, profiles: {}, ...extra,
});

function round(id, ids, { game = 'skins', settings = { skins: { value: 2, carryover: true } }, scores = {}, trip = null, playFor = null, useHandicaps = false, index = {} } = {}) {
  const r = createRound({ id, game, course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x], index: index[x] ?? 0 })), settings: { hcPct: 100, ...settings }, hcPct: 100, useHandicaps });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(scores[h.no] || {}) };
  r.createdAt = OCT(16, 8);
  r.status = 'done';
  r.finishedAt = OCT(16, 13);
  if (trip) r.trip = tripStamp(trip);
  if (playFor) r.playFor = playFor;
  return r;
}

// --------------------------- carts and groups ---------------------------

test('carts: two to a cart in the group’s order, the odd one out rides alone', () => {
  assert.deepEqual(cartPairs(['a', 'b', 'c', 'd']), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(cartPairs(['a', 'b', 'c']), [['a', 'b'], ['c']]);
  assert.deepEqual(cartPairs(['a', 'b', 'c', 'd', 'e']), [['a', 'b'], ['c', 'd'], ['e']]);
  assert.deepEqual(cartPairs(['a']), [['a']]);
  assert.deepEqual(cartPairs([]), []);
});

test('cart signs: one a cart with the group, the cart number, where it starts and what’s on the line', () => {
  const event = {
    line: '$20 net pot',
    sessions: [{ key: 's', label: null, groups: [
      { key: 'g1', n: 1, name: 'Group 1', when: '8:00 AM', hole: 1, players: ['a', 'b', 'c'].map(id => ({ id, name: NAMES[id] })), game: null, bets: [], matches: null },
      { key: 'g2', n: 2, name: 'Group 2', when: null, hole: null, players: ['d', 'e', 'f', 'g', 'h'].map(id => ({ id, name: NAMES[id] })), game: 'Skins', bets: ['$2 a skin'], matches: null },
    ] }],
  };
  const signs = cartSigns(event);
  assert.equal(signs.length, 5, 'three players take two carts, five take three');
  assert.deepEqual(signs.map(x => [x.group, x.cart, x.carts, x.names.length]), [['Group 1', 1, 2, 2], ['Group 1', 2, 2, 1], ['Group 2', 1, 3, 2], ['Group 2', 2, 3, 2], ['Group 2', 3, 3, 1]]);
  assert.deepEqual(signs[1].names, ['Cal Park']);
  assert.equal(signs[0].start, 'Hole 1 · 8:00 AM');
  assert.equal(signs[0].line, '$20 net pot', 'a group with no bets of its own shows the event’s');
  assert.equal(signs[2].start, null, 'no start set: the sign leaves a line to write on');
  assert.equal(signs[2].line, 'Skins · $2 a skin');
  const bigSigns = cartSigns({ line: '$20 net pot', sessions: [{ key: 's', groups: [{ key: 'g', name: 'Group 1', players: [{ id: 'a', name: 'Ann' }], bets: ['Gus v Ann: $10 match'] }] }] });
  assert.equal(bigSigns[0].line, '$20 net pot · Gus v Ann: $10 match', 'a Big Game group: the field’s game and its own side bets');
  // Every player is on exactly one sign
  assert.deepEqual(signs.flatMap(x => x.names).sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => NAMES[id]).sort());
});

test('groups: cut as even as they go, never a lone player at the end', () => {
  const list = n => Array.from({ length: n }, (_, i) => i);
  assert.deepEqual(balancedChunks(list(8), 4).map(x => x.length), [4, 4]);
  assert.deepEqual(balancedChunks(list(5), 4).map(x => x.length), [3, 2]);
  assert.deepEqual(balancedChunks(list(6), 4).map(x => x.length), [3, 3]);
  assert.deepEqual(balancedChunks(list(9), 4).map(x => x.length), [3, 3, 3]);
  assert.deepEqual(balancedChunks(list(3), 4).map(x => x.length), [3]);
  assert.deepEqual(balancedChunks([], 4), []);
});

test('pairings from flights: each flight in its own groups, numbered across the field, with each index', () => {
  const flights = [
    ['t', 's', 'm', 'd', 'a', 'b'].map(id => ({ id, name: NAMES[id] })),
    ['c', 'e', 'f', 'g', 'h'].map(id => ({ id, name: NAMES[id] })),
  ];
  const idx = { t: 4.2, s: -1, m: 8 };
  const groups = groupsFromFlights(flights, { hcOf: id => idx[id] });
  assert.deepEqual(groups.map(g => [g.name, g.sub, g.players.length]), [['Group 1', 'Flight A', 3], ['Group 2', 'Flight A', 3], ['Group 3', 'Flight B', 3], ['Group 4', 'Flight B', 2]]);
  assert.deepEqual(groups[0].players.map(p => p.hc), ['4.2', '+1.0', '8.0']);
  assert.equal(groups[1].players[0].hc, null, 'no index: blank, not zero');
  // A flight player is in one group only
  assert.equal(new Set(groups.flatMap(g => g.players.map(p => p.id))).size, 11);
});

test('a trip with flights and no rounds planned prints its flights as the pairings', () => {
  const trip = newTrip({ id: 't_fl', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', where: 'Bandon Dunes', by: 't', people: ['s', 'm', 'd', 'a', 'b', 'c', 'e'], flights: [
    ['t', 's', 'm', 'd'].map(id => ({ id, name: NAMES[id] })), ['a', 'b', 'c', 'e'].map(id => ({ id, name: NAMES[id] })),
  ], now: OCT(1) });
  const state = stateOf([], { trips: { [trip.id]: trip } });
  state.players.t.index = 6.4;
  const ev = tripEvent(state, trip.id, { now: OCT(2) });
  assert.equal(ev.title, 'Bandon 2026');
  assert.equal(ev.date, 'Oct 16 to 18, 2026');
  assert.equal(ev.course, 'Bandon Dunes');
  assert.equal(ev.sessions.length, 1);
  assert.deepEqual(ev.sessions[0].groups.map(g => [g.name, g.sub, g.players.map(p => p.id)]), [['Group 1', 'Flight A', ['t', 's', 'm', 'd']], ['Group 2', 'Flight B', ['a', 'b', 'c', 'e']]]);
  assert.equal(ev.sessions[0].groups[0].players[0].hc, '6.4');
  assert.ok(needsStarts(ev), 'flights have no tee times, so the organizer can pick them');
  assert.ok(ev.results.empty, 'nothing played yet');
  assert.deepEqual(pairingPages(ev).map(p => p.groups.length), [2]);
});

test('a trip planned round prints its tee time, who’s in, the game and the bet', () => {
  const trip = newTrip({ id: 't_pl', name: 'Fall Trip', start: '2026-10-24', end: '2026-10-25', by: 't', people: ['s', 'm'], now: OCT(1) });
  const plan = {
    id: 'p1', v: 1, status: 'planned', host: true, hostWho: 'host', hostName: 'Trevor', game: 'skins', holesCount: 18, date: '2026-10-24', teeTime: '08:10', useHc: false,
    course: { id: 'c1', name: 'Pacific Dunes' }, people: [{ id: 'host', name: 'Trevor' }, { id: 's', name: 'Sam' }, { id: 'm', name: 'Mike' }, { id: 'd', name: 'Dave' }],
    ballot: { games: ['skins'], bets: [2], betsByGame: { skins: [2] }, rules: { skins: { value: 2, carryover: true } } },
    suggested: { game: 'skins', bet: 2, bets: { skins: 2 } },
    answers: { host: { name: 'Trevor', status: 'in', game: 'skins', bet: 2, betGame: 'skins' }, s: { name: 'Sam', status: 'in' }, d: { name: 'Dave', status: 'out' } },
    trip: tripStamp(trip), code: null,
  };
  const state = stateOf([], { trips: { [trip.id]: trip }, plans: { p1: plan } });
  const ev = tripEvent(state, trip.id, { now: OCT(20) });
  const g = ev.sessions[0].groups[0];
  assert.equal(ev.sessions[0].date, 'Sat, Oct 24, 2026');
  assert.equal(ev.sessions[0].course, 'Pacific Dunes');
  assert.equal(g.when, '8:10 AM');
  assert.deepEqual(g.players.map(p => p.name), ['Trevor Nielsen', 'Sam Ray', 'Mike Lee'], 'Dave said he’s out; full names from this phone');
  assert.equal(g.game, 'Skins');
  assert.match(g.bets[0], /\$2/);
  assert.equal(needsStarts(ev), false, 'the plan has its tee time');
});

// --------------------------- where groups start ---------------------------

test('starts: tee times off the first tee, a shotgun spread around the course, or left to write in', () => {
  assert.deepEqual(startSlots(3, { mode: 'tee', first: '08:00', gap: 10 }), [{ when: '8:00 AM', hole: 1 }, { when: '8:10 AM', hole: 1 }, { when: '8:20 AM', hole: 1 }]);
  assert.deepEqual(startSlots(2, { mode: 'tee', first: '11:55', gap: 8 }).map(x => x.when), ['11:55 AM', '12:03 PM']);
  assert.deepEqual(startSlots(3, { mode: 'shotgun', first: '13:00', holes: 18 }).map(x => [x.when, x.hole]), [['1:00 PM', 1], ['1:00 PM', 7], ['1:00 PM', 13]]);
  assert.deepEqual(startSlots(4, { mode: 'shotgun', holes: 2 }).map(x => x.hole), ['1A', '2A', '1B', '2B']);
  assert.deepEqual(startSlots(2), [{ when: null, hole: null }, { when: null, hole: null }]);
  assert.equal(startText({ hole: 7, when: '8:10 AM' }), 'Hole 7 · 8:10 AM');
  assert.equal(startText({ hole: null, when: null }), null);
});

test('starts: only a session with none of its own takes the pick', () => {
  const g = (key, extra = {}) => ({ key, n: 1, name: key, when: null, hole: null, players: [], bets: [], ...extra });
  const ev = { sessions: [{ key: 'a', groups: [g('a1'), g('a2')] }, { key: 'b', groups: [g('b1', { when: '9:00 AM' }), g('b2')] }] };
  const out = applyStarts(ev, { mode: 'tee', first: '07:30', gap: 12 });
  assert.deepEqual(out.sessions[0].groups.map(x => x.when), ['7:30 AM', '7:42 AM']);
  assert.deepEqual(out.sessions[1].groups.map(x => x.when), ['9:00 AM', null], 'a session with a tee time keeps what it has');
  assert.equal(ev.sessions[0].groups[0].when, null, 'the event itself is left as it was');
});

// --------------------------- results that match the app ---------------------------

const samDay = (extra = {}) => round('r1', ['t', 's', 'm', 'd'], { scores: { 1: { s: 3 }, 2: { s: 3 }, 3: { m: 3 }, 5: { t: 5 } }, ...extra });

test('round results: the standings, the money and who pays who are roundResults’ own', () => {
  const r = samDay();
  const state = stateOf([r]);
  const res = roundResults(r);
  const sheet = roundSheetResults(state, r);
  assert.deepEqual(sheet.standings.map(p => [p.id, p.amount]), res.standings.map(p => [p.id, p.amount]));
  assert.deepEqual(sheet.standings.map(p => p.value), res.standings.map(p => money(p.amount, { sign: true })));
  assert.deepEqual(sheet.owes, res.transfers.map(t => ({ from: NAMES[t.from], to: NAMES[t.to], amount: money(t.amount) })));
  assert.ok(sheet.owes.length > 0);
  assert.equal(sheet.headline, 'Sam Ray wins the day');
  assert.deepEqual(sheet.podium.map(p => p.id), res.standings.slice(0, 3).map(p => p.id));
  assert.equal(sheet.standings[0].score, '34 (-2)', 'each player’s score from the card, as the app writes it');
  // Every standing adds back to zero, as the round's money does
  assert.equal(Math.round(res.standings.reduce((a, p) => a + p.amount, 0) * 100), 0);
});

test('round results: a side game adds a by-game table whose totals are the standings', () => {
  const r = samDay({ game: 'stroke', settings: { stroke: { stake: 5, payout: 'pot', cap: false, nassau: false } } });
  r.sideGames = [{ game: 'skins', settings: { value: 2, carryover: true } }];
  const res = roundResults(r);
  const sheet = roundSheetResults(stateOf([r]), r);
  const t = sheet.tables.find(x => x.title === 'By game');
  assert.ok(t, 'by game table');
  assert.deepEqual(t.columns, ['Stroke play', 'Skins', 'Total']);
  assert.equal(t.columns.at(-1), 'Total');
  assert.equal(t.columns.length, Object.keys(res.detail.byGame).length + 1);
  for (const row of t.rows) {
    const p = res.standings.find(x => x.name === row.name);
    assert.equal(row.cells.at(-1), money(res.balances[p.id], { sign: true }));
  }
});

test('round results: a points round reads in whole points and nobody pays', () => {
  const r = samDay({ playFor: { kind: 'points' } });
  const sheet = roundSheetResults(stateOf([r]), r);
  assert.equal(sheet.owes.length, 0);
  assert.equal(sheet.owesTitle, null);
  assert.ok(sheet.standings.every(p => /pts?$/.test(p.value)), 'points, never dollars');
  assert.doesNotMatch(JSON.stringify(sheet.standings), /\$/);
  assert.match(sheet.notes.join(' '), /points/);
});

test('round results: all square has no podium and says so', () => {
  const r = round('r2', ['t', 's', 'm']);
  const sheet = roundSheetResults(stateOf([r]), r);
  assert.equal(sheet.headline, 'All square');
  assert.deepEqual(sheet.podium, []);
  assert.deepEqual(sheet.owes, []);
});

test('round event: its one group with start hole and handicaps when the round uses them', () => {
  const r = round('r3', ['t', 's', 'm'], { useHandicaps: true, index: { t: 9, s: 2, m: -1 } });
  const ev = roundEvent(stateOf([r]), r);
  const g = ev.sessions[0].groups[0];
  assert.equal(ev.title, 'Flat Nine');
  assert.equal(ev.date, longDate(r.finishedAt));
  assert.equal(g.hole, 1);
  assert.deepEqual(g.players.map(p => p.hc), r.players.map(p => hcText(p.courseHc)));
  assert.equal(hcText(-2), '+2');
  assert.equal(g.game, 'Skins');
  assert.equal(needsStarts(ev), false);
  assert.equal(cartSigns(ev).length, 2);
  const noHc = roundEvent(stateOf([samDay()]), samDay());
  assert.ok(noHc.sessions[0].groups[0].players.every(p => p.hc === null), 'no handicaps on the round: none on the sheet');
});

test('trip results: the standings and Settle the trip’s payments are tripStatus’ own', () => {
  const trip = newTrip({ id: 't_m', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-16', by: 't', people: ['s', 'm', 'd'], now: OCT(1) });
  const r = samDay({ trip });
  const state = stateOf([r], { trips: { [trip.id]: trip } });
  const now = OCT(18);
  const st = tripStatus(state, trip.id, { now });
  const ev = tripEvent(state, trip.id, { now });
  assert.deepEqual(ev.results.standings.map(p => [p.id, p.amount]), st.standings.map(p => [p.id, p.amount]));
  assert.deepEqual(ev.results.owes.map(o => o.amount), st.plan.map(t => money(t.amount)));
  assert.equal(ev.results.owesTitle, 'Settle the trip');
  const games = ev.results.tables.find(t => t.title === 'Money by game');
  assert.ok(games);
  assert.deepEqual(games.rows.map(x => x.cells.at(-1)), st.standings.map(p => money(p.amount, { sign: true })));
});

// A Big Game: two foursomes, a $20 gross pot paying 50/30/20, finished
test('Big Game: groups with handicaps, what’s on the line, and the money as its page has it', () => {
  const NM = { a: 'Ann', b: 'Bob', c: 'Cal', d: 'Dave', e: 'Eve', f: 'Fay', g: 'Gus', h: 'Hal' };
  const G1 = ['a', 'b', 'c', 'd'], G2 = ['e', 'f', 'g', 'h'];
  const big = cleanBig({
    v: 2, hcPct: 100, useHandicaps: true, people: Object.fromEntries(Object.entries(NM).map(([id, name]) => [id, { name, hc: 0 }])),
    groups: [{ id: 'g1', name: 'Group 1', players: G1, keeper: 'b', roundId: 'r1', code: 'BIGAAA' }, { id: 'g2', name: 'Group 2', players: G2, keeper: 'g', roundId: 'r2', code: 'BIGBBB' }],
    pot: { on: true, kind: 'gross', stake: 20, places: [50, 30, 20] }, skins: { on: false }, teams: { on: false }, bets: [{ id: 'x1', kind: 'match', sides: ['g', 'd'], stake: 10 }],
  });
  const trip = newTrip({ id: 't_big', name: 'Saturday Big Game', start: '2026-10-17', end: '2026-10-17', by: 'a', format: BIG_FORMAT, big, now: OCT(10) });
  const SC = { 1: { a: 3 }, 2: { e: 3 }, 3: { b: 3 }, 6: { g: 2 } };
  const gr = (id, ids, code) => {
    const r = createRound({ id, game: 'stroke', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NM[x], index: 0 })), settings: { stroke: { stake: 0, payout: 'pot', cap: false, nassau: false } }, hcPct: 100, useHandicaps: false });
    for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, SC[h.no]?.[p] ?? 4]));
    r.createdAt = OCT(17, 8); r.status = 'done'; r.finishedAt = OCT(17, 15); r.trip = tripStamp(trip); r.shareCode = code;
    return r;
  };
  const rounds = [gr('r1', G1, 'BIGAAA'), gr('r2', G2, 'BIGBBB')];
  const state = { me: 'a', players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: { [trip.id]: trip }, settings: {} };
  const now = OCT(17, 20);
  const ev = printEvent(state, 'big', trip.id, { now });
  assert.equal(ev.kind, 'big');
  assert.equal(ev.date, 'Sat, Oct 17, 2026');
  assert.deepEqual(ev.sessions[0].groups.map(g => [g.name, g.players.length, g.hole]), [['Group 1', 4, 1], ['Group 2', 4, 1]]);
  assert.ok(ev.sessions[0].groups[0].players.every(p => p.hc === '0'));
  assert.match(ev.line, /\$20 gross pot/);
  assert.deepEqual(ev.sessions[0].groups[0].bets, ['Gus v Dave: $10 match'], 'a side bet shows on the group of each player in it');
  const bs = bigStatus(state, trip.id);
  const st = tripStatus(state, trip.id, { now });
  assert.ok(bs.final);
  assert.equal(ev.results.headline, 'Final results');
  assert.deepEqual(ev.results.standings.map(p => p.id), bs.results.pot.map(r => r.id));
  assert.deepEqual(ev.results.standings.map(p => p.value), bs.results.pot.map(r => money((bs.results.balances[r.id] || 0) / 100, { sign: true })));
  assert.deepEqual(ev.results.owes.map(o => o.amount), st.plan.map(t => money(t.amount)));
  assert.ok(ev.results.owes.length > 0);
  const table = ev.results.tables.find(t => t.title === 'Money by part');
  assert.deepEqual(table.columns, ['Pot', 'Bets', 'Total']);
});

// --------------------------- pages ---------------------------

test('pages: blocks fill a page, a long table splits with “(continued)”, and no row is lost', () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ name: `P${i}`, cells: ['+$1'] }));
  const blocks = [{ kind: 'headline', size: 3 }, { kind: 'table', title: 'Money by game', columns: ['Skins'], rows }, { kind: 'note', text: 'x', size: 1 }];
  const pages = paginate(blocks, { first: 26, rest: 29 });
  assert.ok(pages.length >= 3);
  const tables = pages.flat().filter(b => b.kind === 'table');
  assert.equal(tables.flatMap(b => b.rows).length, 70);
  assert.deepEqual(tables.map(b => b.title), ['Money by game', ...tables.slice(1).map(() => 'Money by game (continued)')]);
  for (const [i, p] of pages.entries()) assert.ok(p.reduce((a, b) => a + blockSize(b), 0) <= (i === 0 ? 26 : 29) + 0.001, `page ${i + 1} fits`);
  assert.equal(pages.at(-1).at(-1).kind, 'note');
});

test('pages: a pairings session longer than a page goes on, a session never shares a page', () => {
  const groups = n => Array.from({ length: n }, (_, i) => ({ key: `g${i}`, players: [] }));
  const pages = pairingPages({ sessions: [{ key: 'd1', groups: groups(8) }, { key: 'd2', groups: groups(2) }] });
  assert.deepEqual(pages.map(p => [p.session.key, p.groups.length, p.part, p.parts]), [['d1', 6, 1, 2], ['d1', 2, 2, 2], ['d2', 2, 1, 1]]);
});

test('results blocks: headline, podium, standings, who pays who, tables and notes, in that order', () => {
  const r = samDay();
  const blocks = resultBlocks(roundSheetResults(stateOf([r]), r));
  assert.deepEqual(blocks.map(b => b.kind), ['headline', 'podium', 'standings', 'owes', 'note']);
  assert.deepEqual(resultBlocks({ empty: 'Nothing yet' }).map(b => b.kind), ['empty']);
});

test('the sheets’ words have no em dash', () => {
  const r = samDay();
  const ev = roundEvent(stateOf([r]), r);
  assert.doesNotMatch(JSON.stringify([ev, cartSigns(ev), pairingPages(ev).length]), new RegExp(EM));
});
