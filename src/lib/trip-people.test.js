// Who's going on a trip: everyone you could take (usuals, everyone you've played with, one row a
// person), search, adding a name, and the join link for a trip set up without picking anyone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { newPlan } from './plans.js';
import { newTrip, tripGoing, tripPlanDay, tripStatus } from './trips.js';
import { SEARCH_FROM, cleanPersonName, filterInvitees, inviteeLine, nameToAdd, savePerson, submitTyped, tripAnswers, tripInviteText, tripInvitees, tripLinkPlan } from './trip-people.js';

const course = { id: 'c1', name: 'Pebble Creek', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const SEP = day => new Date(2026, 8, day, 12).getTime();

function round(id, people, at, extra = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, players: people.map(([pid, name, index = 0]) => ({ id: pid, name, index })), settings: { hcPct: 100, skins: { value: 2, carryover: true } }, hcPct: 100, useHandicaps: false });
  r.createdAt = at - 3600e3;
  r.finishedAt = at;
  r.status = 'done';
  return { ...r, ...extra };
}
const P = (id, name, index = null, extra = {}) => ({ id, name, index, venmo: '', createdAt: 1, ...extra });

function world(extra = {}) {
  const rounds = [
    round('r1', [['me', 'Trevor'], ['sam', 'Sam Ortiz', 12], ['chris', 'Chris Wade', 10], ['josh', 'Josh Ruiz', 15]], SEP(12)),
    round('r2', [['me', 'Trevor'], ['ben', 'Ben Hall', 22], ['tom', 'Tom Ford', 6]], SEP(19)),
    round('r3', [['me', 'Trevor'], ['sam', 'Sam Ortiz', 12], ['chris', 'Chris Wade', 10]], SEP(26)),
    // A round you only watched: its players aren't people you played with
    round('r4', [['zed', 'Zed Stone'], ['yan', 'Yan Wu']], SEP(27)),
  ];
  return {
    me: 'me',
    players: { me: P('me', 'Trevor Nielsen', 8), sam: P('sam', 'Sam Ortiz', 12.1), dave: P('dave', 'Dave Park', 18) },
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
    usuals: [{ id: 'u1', name: 'Saturday skins', game: 'skins', players: ['me', 'sam', 'greg'], names: { me: 'Trevor', sam: 'Sam Ortiz', greg: 'Greg Lane' } }],
    links: {}, unlinks: [], accountOf: {}, profiles: {}, plans: {}, trips: {}, settlements: [], carries: [], tabRows: {},
    ...extra,
  };
}

test('everyone you could take: saved players, everyone from your rounds and your usuals, never you', () => {
  const list = tripInvitees(world());
  const ids = list.map(p => p.id);
  assert.deepEqual(new Set(ids), new Set(['sam', 'dave', 'chris', 'josh', 'ben', 'tom', 'greg']));
  assert.ok(!ids.includes('me'));
  // Watched, not played: not on it
  assert.ok(!ids.includes('zed') && !ids.includes('yan'));
});

test('usuals first, then whoever you played with most lately, then the rest by name', () => {
  const list = tripInvitees(world());
  assert.deepEqual(list.map(p => p.id), ['sam', 'greg', 'chris', 'ben', 'tom', 'josh', 'dave']);
  const sam = list[0];
  assert.equal(sam.usual, true);
  assert.equal(sam.rounds, 2);
  assert.equal(sam.saved, true);
  // A round-only friend keeps the name and index the round had
  const chris = list.find(p => p.id === 'chris');
  assert.equal(chris.name, 'Chris Wade');
  assert.equal(chris.index, 10);
  assert.equal(chris.saved, false);
  // A usual-only friend keeps the usual's name
  assert.equal(list.find(p => p.id === 'greg').name, 'Greg Lane');
  // A saved player's index wins over a round's
  assert.equal(sam.index, 12.1);
});

test('the same person under two ids is one row, under the id they go by here', () => {
  // Chris claimed his seat in r3 with his own id; a link says chris2 is Chris
  const s = world({ links: { chris2: 'chris' } });
  s.rounds.r5 = round('r5', [['me', 'Trevor'], ['chris2', 'Chris W.', 10]], SEP(28));
  const list = tripInvitees(s);
  const chrises = list.filter(p => p.name.startsWith('Chris'));
  assert.equal(chrises.length, 1);
  assert.equal(chrises[0].id, 'chris');
  assert.equal(chrises[0].rounds, 3);
  // A merged duplicate saved on the phone is the person it was merged into
  const m = world({ players: { ...world().players, sam2: P('sam2', 'Sammy', null, { mergedInto: 'sam' }) }, links: {} });
  assert.equal(tripInvitees(m).filter(p => p.id === 'sam' || p.id === 'sam2').length, 1);
});

test('your own other ids are never on the list', () => {
  const s = world({ accountOf: { me: 'acct1', me2: 'acct1' } });
  s.rounds.r6 = round('r6', [['me2', 'Trevor N'], ['ben', 'Ben Hall', 22]], SEP(29));
  assert.ok(!tripInvitees(s).some(p => p.id === 'me2' || p.id === 'me'));
});

test('someone picked before stays on the list even with no round on this phone', () => {
  const s = world();
  s.players.old = P('old', 'Old Friend', 5);
  const list = tripInvitees(s, { picked: ['old', 'gone'] });
  assert.ok(list.some(p => p.id === 'old'));
  // An id this phone knows nothing about still shows, by a placeholder name, so it can be unpicked
  assert.equal(list.find(p => p.id === 'gone').name, 'Someone');
});

test('search: any part of the name, any case, in the list order; a long list gets the box', () => {
  const list = tripInvitees(world());
  assert.deepEqual(filterInvitees(list, 'ch').map(p => p.id), ['chris']);
  assert.deepEqual(filterInvitees(list, '  O ').map(p => p.id), ['sam', 'tom', 'josh']);
  assert.equal(filterInvitees(list, '').length, list.length);
  assert.equal(SEARCH_FROM, 8);
});

test('adding a name: you, someone on the list, or someone new', () => {
  const s = world();
  const list = tripInvitees(s);
  assert.equal(nameToAdd(s, list, '   '), null);
  assert.deepEqual(nameToAdd(s, list, 'trevor nielsen'), { kind: 'self' });
  assert.deepEqual(nameToAdd(s, list, ' chris  wade '), { kind: 'existing', id: 'chris' });
  assert.deepEqual(nameToAdd(s, list, 'Nate   Diaz'), { kind: 'new', name: 'Nate Diaz' });
  assert.equal(cleanPersonName('x'.repeat(40)).length, 24);
});

test('the keyboard’s Done never saves a half-typed search as a new player', () => {
  const s = world();
  const list = tripInvitees(s);
  const done = q => submitTyped(s, list, filterInvitees(list, q), q);
  // Several matches: still searching, so nothing is added or picked
  assert.equal(done('o'), null);
  // One match: that person
  assert.deepEqual(done('ch'), { kind: 'pick', id: 'chris' });
  // The whole name of someone on the list: them, even with other matches
  assert.deepEqual(done('sam ortiz'), { kind: 'pick', id: 'sam' });
  // Nobody matches: someone new
  assert.deepEqual(done('Nate  Diaz'), { kind: 'add', name: 'Nate Diaz' });
  assert.deepEqual(done('Trevor Nielsen'), { kind: 'self' });
  assert.equal(done('  '), null);
});

test('a usual’s player with no name anywhere isn’t a row of Someone, unless picked already', () => {
  const s = world({ usuals: [{ id: 'u1', name: 'Saturday skins', game: 'skins', players: ['me', 'sam', 'ghost'], names: { sam: 'Sam Ortiz', ghost: '' } }] });
  assert.ok(!tripInvitees(s).some(p => p.id === 'ghost'));
  assert.equal(tripInvitees(s, { picked: ['ghost'] }).find(p => p.id === 'ghost').name, 'Someone');
});

test('picking someone from a round saves them as a player, and never changes a saved one', () => {
  const s = world();
  const chris = tripInvitees(s).find(p => p.id === 'chris');
  savePerson(s, chris, 99);
  assert.deepEqual(s.players.chris, { id: 'chris', name: 'Chris Wade', index: 10, venmo: '', createdAt: 99 });
  const before = structuredClone(s.players.sam);
  savePerson(s, { id: 'sam', name: 'Somebody else', index: 1 });
  assert.deepEqual(s.players.sam, before);
  // Saving keeps them one row, under the same id
  assert.equal(tripInvitees(s).filter(p => p.id === 'chris').length, 1);
});

test('the line under each name', () => {
  assert.equal(inviteeLine({ usual: true, rounds: 12, index: 4 }), 'Usual · 12 rounds together');
  assert.equal(inviteeLine({ usual: false, rounds: 1, index: 4 }), '1 round together');
  assert.equal(inviteeLine({ usual: false, rounds: 0, index: 4 }), 'Index 4');
  assert.equal(inviteeLine({ usual: false, rounds: 0, index: null }), 'In your players');
});

// --------------------------- skipping, and the join link ---------------------------

const NOW = new Date(2026, 9, 5, 12);
const future = () => newTrip({ id: 't1', name: 'Bandon 2027', start: '2026-10-16', end: '2026-10-18', where: 'Bandon Dunes', by: 'me', people: [], now: NOW.getTime() });

test('a trip started without picking anyone is just the organizer, and plans its first round on its first day', () => {
  const trip = future();
  const s = world({ trips: { t1: trip } });
  assert.deepEqual(trip.people, []);
  assert.deepEqual(tripGoing(s, trip), ['me']);
  assert.equal(tripStatus(s, 't1', NOW.getTime()).phase, 'soon');
  assert.equal(tripPlanDay(trip, '2026-10-05'), '2026-10-16');
});

function tripPlan(id, { host = true, date = '2026-10-16', answers = {} } = {}) {
  const p = newPlan({ id, hostName: 'Trevor', game: 'skins', holesCount: 18, date, teeTime: '08:10', course: { id: 'c1', name: 'Pebble Creek' }, people: [], ballot: { games: [], bets: [5] }, suggestedBet: 5, now: NOW.getTime() });
  return { ...p, host, trip: { id: 't1', name: 'Bandon 2027' }, answers: { ...p.answers, ...answers } };
}

test('the link: the trip’s soonest planned round this phone organizes, or none yet', () => {
  const trip = future();
  assert.equal(tripLinkPlan(world({ trips: { t1: trip } }), 't1', NOW), null);
  const theirs = tripPlan('pl0', { host: false, date: '2026-10-16' });
  const later = tripPlan('pl2', { date: '2026-10-17' });
  const first = tripPlan('pl1', { date: '2026-10-16' });
  const s = world({ trips: { t1: trip }, plans: { pl0: theirs, pl2: later, pl1: first } });
  assert.equal(tripLinkPlan(s, 't1', NOW).id, 'pl1');
  // A round called off, or one on another trip, isn't the link
  s.plans.pl1 = { ...first, status: 'off' };
  assert.equal(tripLinkPlan(s, 't1', NOW).id, 'pl2');
});

test('the text with the link names the trip, then the round', () => {
  const text = tripInviteText(future(), tripPlan('pl1'), 'https://x.test/?plan=ABC123', NOW);
  const [line1, ...rest] = text.split('\n');
  assert.equal(line1, 'Bandon 2027, Oct 16 to 18 at Bandon Dunes.');
  assert.match(rest.join('\n'), /Pebble Creek/);
  assert.equal(rest.at(-1), 'https://x.test/?plan=ABC123');
  assert.ok(!text.includes(String.fromCharCode(0x2014)));
});

test('who answered the link and isn’t going yet: in or maybe, one a name', () => {
  const trip = { ...future(), people: ['sam'] };
  const p1 = tripPlan('pl1', { answers: {
    g1: { name: 'Chris', status: 'in', at: 1 },
    g2: { name: 'Josh', status: 'maybe', at: 2 },
    g3: { name: 'Ben', status: 'out', at: 3 },
    sam: { name: 'Sam', status: 'in', at: 4 },
  } });
  const p2 = tripPlan('pl2', { date: '2026-10-17', answers: { g9: { name: 'chris', status: 'in', at: 5 }, g8: { name: 'Tom', status: 'in', at: 6 } } });
  const s = world({ trips: { t1: trip }, plans: { pl1: p1, pl2: p2 } });
  const got = tripAnswers(s, trip, NOW);
  assert.deepEqual(got.map(a => [a.name, a.status]), [['Chris', 'in'], ['Josh', 'maybe'], ['Tom', 'in']]);
  // Nobody here is a saved player, so no id; someone saved by that name gets theirs, for the same avatar
  assert.deepEqual(got.map(a => a.id), [null, null, null]);
  const saved = world({ trips: { t1: trip }, plans: { pl1: p1, pl2: p2 } });
  saved.players.josh = P('josh', 'Josh', 15);
  assert.equal(tripAnswers(saved, trip, NOW).find(a => a.name === 'Josh').id, 'josh');
});
