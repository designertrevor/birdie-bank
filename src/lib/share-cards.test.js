// The newer share cards (share-cards.js): the recap, trip standings, the cup and a challenge for
// the group. Amounts hidden by default, held back for privacy, points always shown, names never
// "You", nobody named for owing, alt text and text from the same model, and no money changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { newTrip, tripStamp, tripStatus } from './trips.js';
import { newChallenge, withMove } from './challenges.js';
import { amountsRule } from './share.js';
import { cardAlt, cardText, challengeGroupText, cupCardModel, recapCardModel, shortUrl, tripCardModel } from './share-cards.js';

const DOLLAR = /\$/;
const EM = String.fromCharCode(0x2014);
const HOUR = 36e5;
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const NAMES = { t: 'Trevor Nielsen', s: 'Sam Ray', m: 'Mike Lee', d: 'Dave Ortiz' };
const TRIP = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', where: 'Oregon', by: 't', now: OCT(1) });

function round(id, ids, holes = {}, { at = OCT(16), trip = TRIP, code = null, skin = 2, playFor = null } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x], index: 0 })), settings: { hcPct: 100, skins: { value: skin, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * HOUR;
  r.status = 'done';
  r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (code) r.shareCode = code;
  if (playFor) r.playFor = playFor;
  return r;
}
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const FOUR = ['t', 's', 'm', 'd'];
const stateOf = (rounds, extra = {}) => ({
  me: 't', players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: { [TRIP.id]: TRIP }, settings: {},
  accountOf: {}, profiles: {}, ...extra,
});
const ONLY_YOU = { accountOf: { s: 'acct-s' }, profiles: { 'acct-s': { name: 'Sam Ray', stats: null } } };

// --------------------------- the recap --------------------------------------

// Sam takes holes 1 and 2, Mike hole 3: Sam takes it
const samDay = () => round('r1', FOUR, wins(FOUR, [1, 's'], [2, 's'], [3, 'm']), { at: OCT(3, 16), trip: null, code: 'AB12' });

test('recap card: off by default it has the order and the moments but not a dollar', () => {
  const r = samDay();
  const m = recapCardModel(stateOf([r]), r, { now: OCT(4, 9), link: 'https://golf.test/?join=AB12' });
  assert.equal(m.eyebrow, 'The recap');
  assert.equal(m.title, 'Flat Nine');
  assert.match(m.meta, /^Oct 3 · Skins$/);
  assert.equal(m.headline, 'Sam');
  assert.equal(m.sub, 'takes it');
  assert.deepEqual(m.rows.map(x => [x.place, x.name, x.value]), [[1, 'Sam Ray', null], [2, 'Mike Lee', null], [3, 'Trevor Nielsen', null], [3, 'Dave Ortiz', null]]);
  assert.ok(m.sections.find(s => s.label === 'Moments')?.lines.length > 0);
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
  assert.doesNotMatch(cardText(m), DOLLAR);
  assert.equal(m.footer, 'golf.test/?join=AB12');
});

test('recap card: with amounts on, the round\'s money; who\'s paid is a count, never who owes', () => {
  const r = samDay();
  const m = recapCardModel(stateOf([r]), r, { showAmounts: true, now: OCT(4, 9) });
  assert.equal(m.sub, '+$10');
  assert.equal(m.rows[0].value, '+$10');
  const paid = m.sections.find(s => s.label === 'Who’s paid');
  assert.deepEqual(paid.lines, ['0 of 4 square']);
  assert.doesNotMatch(cardText(m), /owe/i);
  assert.doesNotMatch(JSON.stringify(m), /\bYou\b/);
});

test('recap card: someone who keeps their money private keeps it off, and so does everyone else', () => {
  const r = samDay();
  const s = stateOf([r], ONLY_YOU);
  const rule = amountsRule(s, { on: true, people: r.players });
  assert.equal(rule.show, false);
  const m = recapCardModel(s, r, { showAmounts: rule.show, now: OCT(4, 9) });
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
  assert.doesNotMatch(m.alt, DOLLAR);
});

test('recap card: a points round always shows its points and never a dollar', () => {
  const r = round('r1', FOUR, wins(FOUR, [1, 's']), { at: OCT(3, 16), trip: null, playFor: { kind: 'points' } });
  const m = recapCardModel(stateOf([r]), r, { now: OCT(4, 9) });
  assert.equal(m.rows[0].value, '+6 pts');
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
});

// --------------------------- trip standings ---------------------------------

function bandon() {
  return [
    round('r1', FOUR, wins(FOUR, [1, 't'], [2, 't'], [3, 's']), { at: OCT(16, 15) }),
    round('r2', FOUR, wins(FOUR, [1, 'd'], [4, 's'], [5, 's']), { at: OCT(17, 11) }),
    round('r3', ['t', 's', 'm'], wins(['t', 's', 'm'], [2, 'm'], [6, 't']), { at: OCT(17, 17) }),
  ];
}

test('trip card: the standings in order, money only with the switch', () => {
  const s = stateOf(bandon());
  const st = tripStatus(s, TRIP.id, { now: OCT(17, 20) });
  const off = tripCardModel(s, st);
  assert.equal(off.eyebrow, 'Trip standings');
  assert.equal(off.title, 'Bandon 2026');
  assert.equal(off.meta, 'Oct 16 to 18 · Oregon · 3 rounds');
  assert.equal(off.rows.length, st.standings.length);
  assert.ok(off.rows.every(r => r.value === null));
  assert.doesNotMatch(JSON.stringify(off) + cardText(off), DOLLAR);
  const on = tripCardModel(s, st, { showAmounts: true });
  assert.deepEqual(on.rows.map(r => r.value), st.standings.map(p => (p.amount > 0 ? `+$${p.amount}` : p.amount < 0 ? `−$${-p.amount}` : '$0')));
  assert.equal(on.headline, 'Sam and Trevor lead', 'level at the top, so both lead');
  assert.match(on.sub, /^\+\$\d+ each$/);
  assert.match(on.alt, /^Trip standings: Bandon 2026, Oct 16 to 18 · Oregon · 3 rounds\./);
});

test('trip card: over, the leader takes the trip; private money holds every amount back', () => {
  const s = stateOf(bandon(), ONLY_YOU);
  const st = tripStatus(s, TRIP.id, { now: OCT(20) });
  const people = st.standings.map(p => ({ id: p.id, name: NAMES[p.id] }));
  const rule = amountsRule(s, { on: true, people });
  assert.equal(rule.show, false);
  assert.deepEqual(rule.held, ['Sam']);
  const m = tripCardModel(s, st, { showAmounts: rule.show });
  assert.equal(m.eyebrow, 'That’s the trip');
  assert.match(m.headline, /takes the trip$|top the trip$/);
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
});

test('trip card: a points trip shows points, never dollars, with the switch off', () => {
  const pts = { kind: 'points' };
  const s = stateOf([round('r1', FOUR, wins(FOUR, [1, 's']), { at: OCT(16, 15), playFor: pts })]);
  const st = tripStatus(s, TRIP.id, { now: OCT(17) });
  const m = tripCardModel(s, st);
  assert.equal(m.accent, 'Played for points');
  assert.equal(m.rows[0].name, 'Sam Ray');
  assert.equal(m.rows[0].value, '+6 pts');
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
});

test('trip card: building it changes nothing on the phone', () => {
  const s = stateOf(bandon());
  const before = JSON.stringify(s);
  const st = tripStatus(s, TRIP.id, { now: OCT(17, 20) });
  tripCardModel(s, st, { showAmounts: true });
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(tripStatus(s, TRIP.id, { now: OCT(17, 20) }).standings, st.standings);
});

// --------------------------- the cup ----------------------------------------

function cupOf({ final = false, winner = null, stake = 20 } = {}) {
  return {
    names: ['Blue', 'Red'], final, winner, def: { stake },
    score: { points: [3.5, 2.5], done: 6, live: [] },
    leaderboard: [
      { key: 't', id: 't', name: 'Trevor Nielsen', team: 0, played: 3, won: 2, lost: 0, halved: 1, points: 2.5 },
      { key: 's', id: 's', name: 'Sam Ray', team: 1, played: 3, won: 2, lost: 1, halved: 0, points: 2 },
      { key: 'n:joe', id: null, name: 'Joe', team: 0, played: 1, won: 1, lost: 0, halved: 0, points: 1 },
    ],
  };
}

test('cup card: the teams\' points, the leaderboard in points, the stake only with amounts on', () => {
  const s = stateOf([]);
  const off = cupCardModel(s, TRIP, cupOf());
  assert.deepEqual(off.teams.map(t => [t.name, t.points, t.lead]), [['Blue', '3½', true], ['Red', '2½', false]]);
  assert.equal(off.headline, 'Blue leads 3½ to 2½');
  assert.equal(off.accent, 'Something’s on the cup');
  assert.deepEqual(off.rows.map(r => [r.place, r.name, r.value, r.team]), [[1, 'Trevor Nielsen', '2½ pts', 0], [2, 'Sam Ray', '2 pts', 1], [3, 'Joe', '1 pt', 0]]);
  assert.doesNotMatch(JSON.stringify(off), DOLLAR);
  const on = cupCardModel(s, TRIP, cupOf(), { showAmounts: true });
  assert.equal(on.accent, '$20 a person on the cup');
  assert.match(on.alt, /^Cup scoreboard: Bandon 2026, .*Blue 3½, Red 2½\. Blue leads 3½ to 2½\. \$20 a person on the cup\. 1\. Trevor Nielsen 2½ pts/);
  const decided = cupCardModel(s, TRIP, { ...cupOf({ final: true, winner: 0, stake: 0 }) });
  assert.equal(decided.eyebrow, 'The cup is decided');
  assert.equal(decided.headline, 'Blue wins the cup 3½ to 2½');
  assert.equal(decided.accent, null);
});

// --------------------------- a challenge ------------------------------------

test('challenge for the group: who and what, the stake only with amounts on, points always', () => {
  const ch = newChallenge({ id: 'c1', from: { who: 'd', name: 'Dave Ortiz' }, to: { who: 'm', name: 'Mike Lee' }, kind: 'match', stake: 20, plan: { id: 'p1', date: '2026-10-10' }, now: OCT(5) });
  const now = OCT(5);
  assert.equal(challengeGroupText(ch, { now }), 'Dave challenged Mike to a match on Saturday. Waiting on Mike.');
  assert.equal(challengeGroupText(ch, { showAmounts: true, now }), 'Dave challenged Mike to a $20 match on Saturday. Waiting on Mike.');
  const yes = withMove(ch, { id: 'x1', side: 'to', move: 'accept', at: now + 1 });
  assert.equal(challengeGroupText(yes, { now }), 'Dave challenged Mike to a match on Saturday. It’s on.');
  const pts = newChallenge({ id: 'c2', from: { who: 'd', name: 'Dave' }, to: { who: 'm', name: 'Mike' }, kind: 'hole', stake: 5, unit: 'points', now });
  assert.equal(challengeGroupText(pts, { now }), 'Dave challenged Mike to 5 pts a hole next time they play. Waiting on Mike.');
  const hole = newChallenge({ id: 'c3', from: { who: 'd', name: 'Dave' }, to: { who: 'm', name: 'Mike' }, kind: 'hole', stake: 5, holes: 'back', now });
  assert.equal(challengeGroupText(hole, { now }), 'Dave challenged Mike to a hole-by-hole bet on the back 9 next time they play. Waiting on Mike.');
  assert.equal(challengeGroupText(hole, { showAmounts: true, now }), 'Dave challenged Mike to $5 a hole on the back 9 next time they play. Waiting on Mike.');
});

// --------------------------- the words --------------------------------------

test('words: short links, alt text that reads the card, and no long dash anywhere', () => {
  assert.equal(shortUrl('https://golf.test/'), 'golf.test');
  assert.equal(shortUrl('https://golf.test/?join=AB12'), 'golf.test/?join=AB12');
  const r = samDay();
  const s = stateOf([r]);
  const all = [recapCardModel(s, r, { showAmounts: true, now: OCT(4, 9) }), tripCardModel(stateOf(bandon()), tripStatus(stateOf(bandon()), TRIP.id, { now: OCT(17, 20) }), { showAmounts: true }), cupCardModel(s, TRIP, cupOf(), { showAmounts: true })];
  for (const m of all) {
    assert.equal(m.alt, cardAlt(m.alt.split(':')[0], m));
    for (const t of [m.alt, cardText(m), JSON.stringify(m)]) assert.ok(!t.includes(EM));
  }
});
