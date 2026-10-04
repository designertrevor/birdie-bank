import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countdown, countdownLine, toGoLabel, pairRecords, planPreview, previewCardModel, previewImageName, previewPeople, previewRecords,
  previewStrokes, previewText, recordSentence, savedPlayerFor, strokeHolesText, strokesLine,
} from './preview.js';
import { newPlan, planStart } from './plans.js';
import { createRound, popsFor } from './round.js';
import { headToHeadSummary } from './ledger.js';

const SETTINGS = {
  hcPct: 100,
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' },
  match: { stake: 10, pressMode: 'off', threshold: 2 },
  bbb: { value: 1 },
  birdies: { stake: 5, eagleShares: 2 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true } },
  scramble: { stake: 5, drives: 0 },
};
// Par 72, every hole a par 4, and the stroke index is the hole number (hole 1 is the hardest)
const COURSE = {
  id: 'c1', name: 'Rancho Park', city: 'LA',
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
  tees: [{ name: 'Blue', rating: 72, slope: 113 }],
};
// Thursday 1 October 2026, 5:10 in the morning
const NOW = new Date(2026, 9, 1, 5, 10);

const players = () => ({
  me: { id: 'me', name: 'Trevor Nielsen', index: 2 },
  mike: { id: 'mike', name: 'Mike Jones', index: 9 },
  dave: { id: 'dave', name: 'Dave', index: 20 },
  sam: { id: 'sam', name: 'Sam', index: null },
});
const baseState = () => ({ me: 'me', players: players(), rounds: {}, customCourses: { c1: COURSE }, settings: SETTINGS, settlements: [], carries: [] });

const plan = (over = {}) => {
  const p = newPlan({
    id: 'pl1', hostName: 'Trevor Nielsen', game: over.game || 'skins', holesCount: over.holesCount || 18, nine: over.nine, date: over.date || '2026-10-03', teeTime: '08:10',
    course: COURSE, people: [{ id: 'mike', name: 'Mike Jones' }, { id: 'dave', name: 'Dave' }, { id: 'sam', name: 'Sam' }],
    ballot: { games: over.ballotGames || [], bets: [2], sides: over.sides || [] }, suggestedBet: over.bet ?? 2, settings: SETTINGS, useHc: over.useHc ?? true,
    hcPct: over.hcPct ?? null, halfStrokes: over.halfStrokes || false, sidePcts: over.sidePcts || null, playFor: over.playFor || null, now: 1,
  });
  return p;
};
const say = (p, who, status) => { p.answers[who] = { ...(p.answers[who] || {}), name: p.people.find(x => x.id === who)?.name || who, status, at: 5 }; return p; };
const allIn = p => { for (const w of ['mike', 'dave']) say(p, w, 'in'); return p; };

/** A finished 1 v 1 match: `winner` takes hole 1, every other hole is halved. */
let seq = 0;
function match(state, a, b, winner, { at = new Date(2026, 5, 1).getTime(), playFor = null, stake = 10 } = {}) {
  const id = `r${++seq}`;
  const pl = [a, b].map(x => ({ id: x, name: state.players[x]?.name || x, index: null, tee: 'Blue' }));
  const r = createRound({ id, game: 'match', course: COURSE, holesCount: 18, nine: 'front', players: pl, settings: { match: { stake, pressMode: 'off' } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { [a]: 4, [b]: 4 };
  if (winner) r.scores[1] = { [a]: winner === a ? 3 : 5, [b]: winner === b ? 3 : 5 };
  r.status = 'done';
  r.finishedAt = at;
  if (playFor) r.playFor = playFor;
  state.rounds[id] = r;
  return r;
}

// --------------------------- the countdown ----------------------------------

test('countdown: the day and how many days, never "this week"', () => {
  assert.equal(countdown({ date: '2026-10-03' }, NOW).label, 'Saturday, 2 days');
  assert.deepEqual([countdown({ date: '2026-10-03' }, NOW).big, countdown({ date: '2026-10-03' }, NOW).unit], ['2', 'days']);
  assert.equal(countdown({ date: '2026-10-02' }, NOW).label, 'Tomorrow');
  assert.deepEqual([countdown({ date: '2026-10-02' }, NOW).big, countdown({ date: '2026-10-02' }, NOW).unit], ['1', 'day']);
  assert.equal(countdown({ date: '2026-10-10' }, NOW).label, 'Sat, Oct 10, 9 days');
  assert.equal(countdown({ date: '2026-09-30' }, NOW).label, 'Yesterday');
  assert.equal(countdown({ date: '' }, NOW), null);
  for (let d = 2; d < 20; d++) {
    const iso = `2026-10-${String(d).padStart(2, '0')}`;
    assert.doesNotMatch(countdown({ date: iso }, NOW).label, /week/i);
  }
});

test('countdown: on the day it counts down to the tee time', () => {
  assert.equal(countdown({ date: '2026-10-01', teeTime: '08:10' }, NOW).label, 'Today, in 3 hours');
  assert.equal(countdown({ date: '2026-10-01', teeTime: '05:55' }, NOW).label, 'Today, in 45 minutes');
  assert.equal(countdown({ date: '2026-10-01', teeTime: '06:20' }, NOW).label, 'Today, in 1 hour');
  assert.equal(countdown({ date: '2026-10-01', teeTime: '05:00' }, NOW).label, 'Today');
  assert.equal(countdown({ date: '2026-10-01' }, NOW).label, 'Today');
  assert.equal(countdown({ date: '2026-10-01' }, NOW).big, 'Today');
});

test('how long to go, for the plan page', () => {
  assert.equal(toGoLabel({ date: '2026-10-03' }, NOW), '2 days to go');
  assert.equal(toGoLabel({ date: '2026-10-02' }, NOW), 'Tomorrow');
  assert.equal(toGoLabel({ date: '2026-10-01', teeTime: '08:10' }, NOW), 'Today, in 3 hours');
  assert.equal(toGoLabel({ date: '2026-09-30' }, NOW), '');
});

test('the Up next line: the countdown and the tee time', () => {
  assert.equal(countdownLine({ date: '2026-10-03', teeTime: '08:10' }, NOW), 'Saturday, 2 days · 8:10 AM');
  assert.equal(countdownLine({ date: '2026-10-02', teeTime: null }, NOW), 'Tomorrow');
});

// --------------------------- who is who -------------------------------------

test('people: you, invited friends by id, and a friend from the link by name', () => {
  const s = baseState();
  const p = allIn(plan());
  p.answers.g_1 = { name: 'Sam', status: 'in', at: 9 };
  const people = previewPeople(s, p);
  assert.deepEqual(people.map(x => [x.name, x.player?.id ?? null, x.me]), [['Trevor', 'me', true], ['Mike', 'mike', false], ['Dave', 'dave', false], ['Sam', 'sam', false]]);
});

test('people: on a friend\'s phone you are your own card and others match by unique first name', () => {
  const s = { ...baseState(), me: 'mine', players: { mine: { id: 'mine', name: 'Mike Jones', index: 9 }, t: { id: 't', name: 'Trevor Nielsen', index: 2 }, d1: { id: 'd1', name: 'Dave Smith', index: 20 }, d2: { id: 'd2', name: 'Dave Brown', index: 5 } } };
  const p = allIn(plan());
  p.host = false;
  p.localMe = 'mike';
  assert.equal(savedPlayerFor(s, p, { who: 'mike', name: 'Mike' }).id, 'mine');
  assert.equal(savedPlayerFor(s, p, { who: 'host', name: 'Trevor' }).id, 't');
  // Two saved Daves: no guessing
  assert.equal(savedPlayerFor(s, p, { who: 'dave', name: 'Dave' }), null);
});

// --------------------------- strokes ----------------------------------------

test('strokes: off the low player, on the hardest holes, most strokes first', () => {
  const s = baseState();
  const st = previewStrokes(s, allIn(plan()));
  assert.equal(st.status, 'on');
  // Course handicaps 2, 9 and 20 at a 72 rating and 113 slope: 0, 7 and 18 off the low
  assert.deepEqual(st.rows.map(r => [r.name, r.plays]), [['Dave', 18], ['Mike', 7], ['Trevor', 0]]);
  assert.deepEqual(st.rows[1].strokes.map(x => x.no), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(strokeHolesText(st.rows[1], 18), '1, 2, 3, 4, 5, 6 and 7');
  assert.equal(strokeHolesText(st.rows[0], 18), 'every hole');
  assert.equal(strokesLine(st.rows[1], 18), 'Mike gets 7 strokes: 1, 2, 3, 4, 5, 6 and 7');
  assert.equal(strokesLine(st.rows[2], 18), 'You play off the low, no strokes');
  assert.equal(strokesLine(st.rows[2], 18, { you: false }), 'Trevor plays off the low, no strokes');
});

test('strokes: more than 18 gives two on the hardest holes', () => {
  const s = baseState();
  s.players.dave.index = 24; // 24 off 2 is 22: one on every hole, two on 1 to 4
  const st = previewStrokes(s, allIn(plan()));
  assert.equal(st.rows[0].plays, 22);
  assert.equal(strokeHolesText(st.rows[0], 18), 'every hole, two on 1, 2, 3 and 4');
});

test('strokes: the preview is exactly what the roll call starts the round with', () => {
  for (const over of [{}, { hcPct: 90 }, { holesCount: 9, nine: 'back' }, { game: 'nassau', holesCount: 9 }]) {
    const s = baseState();
    const p = over.game === 'nassau' ? say(plan(over), 'mike', 'in') : allIn(plan(over));
    const st = previewStrokes(s, p);
    const setup = planStart(s, p, p.people.map(x => x.id).filter(w => p.answers[w]?.status === 'in').concat('host'), { course: COURSE });
    const round = createRound({ id: 'x', game: setup.game, course: COURSE, holesCount: setup.holesCount, nine: setup.nine, startHole: null, players: setup.players, settings: setup.settings, hcPct: setup.hcPct, useHandicaps: true });
    assert.deepEqual(st.holes.map(h => h.no), round.holes.map(h => h.no));
    for (const rp of round.players) {
      const row = st.rows.find(r => r.name === rp.name.split(' ')[0]);
      assert.equal(row.plays, rp.plays, `${rp.name} ${JSON.stringify(over)}`);
      assert.deepEqual(row.strokes.map(x => x.no), round.holes.filter(h => popsFor(round, rp, h) > 0).map(h => h.no));
    }
  }
});

test('strokes: 9 holes on the back nine go on the back nine\'s hardest holes', () => {
  const st = previewStrokes(baseState(), allIn(plan({ holesCount: 9, nine: 'back' })));
  const mike = st.rows.find(r => r.name === 'Mike');
  // Half of 9 rounds to 5, half of 2 to 1: 4 strokes, on 10 to 13
  assert.equal(mike.plays, 4);
  assert.deepEqual(mike.strokes.map(x => x.no), [10, 11, 12, 13]);
});

test('strokes: a usual\'s %, half strokes and a side game\'s own % come along', () => {
  const st = previewStrokes(baseState(), allIn(plan({ hcPct: 90, halfStrokes: true, sides: ['birdies', 'dots'], sidePcts: { birdies: 80, dots: 80 } })));
  assert.equal(st.pct, 90);
  assert.equal(st.half, true);
  assert.equal(st.rows.find(r => r.name === 'Mike').plays, 6); // 8 off 2
  // The Birdie pot counts strokes at its own %; Junk doesn't count strokes, so it has nothing to say
  assert.deepEqual(st.notes, ['Birdie pot plays off 80% of strokes']);
});

test('strokes: handicaps off, a game without strokes, scramble, a missing course, one player', () => {
  const s = baseState();
  const off = previewStrokes(s, allIn(plan({ useHc: false })));
  assert.equal(off.status, 'off');
  assert.equal(off.rows.find(r => r.name === 'Mike').plays, 7); // what handicaps would give
  assert.equal(previewStrokes(s, allIn(plan({ game: 'bbb' }))).status, 'noStrokes');
  assert.equal(previewStrokes(s, allIn(plan({ game: 'scramble' }))).status, 'scramble');
  // Alternate shot and Chapman play off a team handicap too, set with the teams
  for (const game of ['altshot', 'chapman']) assert.equal(previewStrokes(s, allIn(plan({ game }))).status, 'scramble');
  assert.equal(previewStrokes({ ...s, customCourses: {} }, allIn(plan())).status, 'noCourse');
  assert.equal(previewStrokes(s, plan()).status, 'few');
});

test('strokes: someone with no handicap plays off 0, as the round will', () => {
  const s = baseState();
  const p = say(say(plan(), 'mike', 'in'), 'sam', 'in');
  const st = previewStrokes(s, p);
  const sam = st.rows.find(r => r.name === 'Sam');
  assert.equal(sam.noIndex, true);
  assert.equal(sam.plays, 0);
  assert.equal(st.rows.find(r => r.name === 'Trevor').plays, 2);
});

// --------------------------- records ----------------------------------------

test('records: Mike is 3 and 1 against Dave this season', () => {
  const s = baseState();
  for (const w of ['mike', 'mike', 'dave', 'mike']) match(s, 'mike', 'dave', w);
  const recs = previewRecords(s, allIn(plan()), { now: NOW });
  const md = recs.find(r => [r.a, r.b].sort().join() === 'dave,mike');
  assert.equal(md.scope, 'season');
  assert.deepEqual([md.aName, md.rec.won, md.rec.lost], ['Mike', 3, 1]);
  assert.equal(recordSentence(md.rec, md.aName, md.bName, { scope: md.scope }), 'Mike is 3 and 1 against Dave this season');
  // Pairs that never played together are left out
  assert.equal(recs.length, 1);
});

test('records: led from your side or theirs, and all square', () => {
  const s = baseState();
  match(s, 'me', 'mike', 'mike');
  match(s, 'me', 'mike', 'mike');
  match(s, 'me', 'dave', 'me');
  match(s, 'me', 'dave', 'dave');
  match(s, 'me', 'dave', null);
  const recs = previewRecords(s, allIn(plan()), { now: NOW });
  const line = r => recordSentence(r.rec, r.aName, r.bName, { scope: r.scope, aIsYou: r.aMe, bIsYou: r.bMe });
  const lines = recs.map(line);
  assert.ok(lines.includes('Mike is 2 and 0 against you this season'));
  assert.ok(lines.includes('You and Dave are all square, 1 and 1 this season (1 even)'));
});

test('records: last season only falls back to all time; this season wins when there is one', () => {
  const s = baseState();
  const old = new Date(2025, 6, 1).getTime();
  match(s, 'mike', 'dave', 'mike', { at: old });
  match(s, 'mike', 'dave', 'mike', { at: old });
  let md = previewRecords(s, allIn(plan()), { now: NOW })[0];
  assert.equal(md.scope, 'all');
  assert.equal(recordSentence(md.rec, md.aName, md.bName, { scope: md.scope }), 'Mike is 2 and 0 against Dave');
  match(s, 'mike', 'dave', 'dave');
  md = previewRecords(s, allIn(plan()), { now: NOW })[0];
  assert.equal(md.scope, 'season');
  assert.equal(recordSentence(md.rec, md.aName, md.bName, { scope: md.scope }), 'Dave is 1 and 0 against Mike this season');
});

test('records: points rounds count in the record, never in dollars', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike', { stake: 10 });
  match(s, 'mike', 'dave', 'mike', { playFor: { kind: 'points' } });
  const r = pairRecords(s, ['mike', 'dave'], { now: NOW }).get('mike|dave').all;
  assert.deepEqual([r.rounds, r.won, r.lost, r.net, r.moneyRounds], [2, 2, 0, 10, 1]);
  assert.equal(recordSentence(r, 'Mike', 'Dave', { amounts: true }), 'Mike is 2 and 0 against Dave, up $10');
  assert.equal(recordSentence(r, 'Mike', 'Dave'), 'Mike is 2 and 0 against Dave');
  // Only points between them: no money line even with amounts on
  const p = baseState();
  match(p, 'mike', 'dave', 'mike', { playFor: { kind: 'points' } });
  assert.equal(recordSentence(pairRecords(p, ['mike', 'dave'], { now: NOW }).get('mike|dave').all, 'Mike', 'Dave', { amounts: true }), 'Mike is 1 and 0 against Dave');
});

test('records: one friend with two ids is one person', () => {
  const s = baseState();
  s.players.mike2 = { id: 'mike2', name: 'Mike J', index: 9, mergedInto: 'mike' };
  match(s, 'mike', 'dave', 'mike');
  match(s, 'mike2', 'dave', 'mike2');
  const recs = previewRecords(s, allIn(plan()), { now: NOW });
  assert.equal(recs.length, 1);
  assert.deepEqual([recs[0].aName, recs[0].rec.won, recs[0].rec.lost], ['Mike', 2, 0]);
});

test('records: a round they were both in counts once, with money from the leader\'s side', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'dave', { stake: 10 });
  match(s, 'mike', 'dave', 'mike', { stake: 5 });
  match(s, 'mike', 'dave', 'mike', { stake: 5 });
  const md = previewRecords(s, allIn(plan()), { now: NOW })[0];
  assert.equal(recordSentence(md.rec, md.aName, md.bName, { amounts: true }), 'Mike is 2 and 1 against Dave');
  match(s, 'mike', 'dave', 'dave', { stake: 20 });
  const sq = previewRecords(s, allIn(plan()), { now: NOW })[0];
  assert.match(recordSentence(sq.rec, sq.aName, sq.bName, { amounts: true }), /^(Mike|Dave) and (Mike|Dave) are all square, 2 and 2, (Mike|Dave)’s down \$20$/);
});

// --------------------------- the whole preview and sharing ------------------

test('the preview: the voted game and bet, side games, who is in and maybe', () => {
  const s = baseState();
  const p = say(say(plan({ sides: ['dots'] }), 'mike', 'in'), 'dave', 'maybe');
  const pv = planPreview(s, p, { now: NOW });
  assert.equal(pv.gameName, 'Skins');
  assert.equal(pv.bet, '$2 a skin');
  assert.equal(pv.betFull, '$2 a skin · carryovers');
  assert.deepEqual(pv.sides.map(x => x.label), ['Junk']);
  assert.deepEqual(pv.ins, ['Trevor', 'Mike']);
  assert.deepEqual(pv.maybes, ['Dave']);
  assert.equal(pv.waiting, 1);
  assert.equal(pv.when, 'Saturday · 8:10 AM');
  assert.equal(pv.countdown.label, 'Saturday, 2 days');
});

test('the image: money hidden by default, shown with the switch', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike');
  const pv = planPreview(s, allIn(plan({ sides: ['dots'] })), { now: NOW });
  const hidden = previewCardModel(pv);
  assert.doesNotMatch(JSON.stringify(hidden), /\$/);
  assert.equal(hidden.sub, 'Plus Junk');
  assert.equal(hidden.eyebrow, 'Saturday preview');
  assert.equal(hidden.toGo, '2 days to go');
  assert.deepEqual([hidden.countBig, hidden.countUnit], ['2', 'days']);
  assert.equal(hidden.inLine, '3 in: Trevor, Mike and Dave');
  assert.deepEqual(hidden.records, ['Mike is 1 and 0 against Dave this season']);
  assert.deepEqual(hidden.strokes.map(x => [x.name, x.count]), [['Dave', '18'], ['Mike', '7']]);
  assert.equal(hidden.strokesNote, 'Trevor plays off the low');
  const shown = previewCardModel(pv, { showAmounts: true });
  assert.equal(shown.sub, '$2 a skin · Junk, $1 a dot');
  assert.deepEqual(shown.records, ['Mike is 1 and 0 against Dave this season, up $10']);
  assert.doesNotMatch(JSON.stringify(hidden), /week/i);
});

test('the image: a points plan always shows its points and never dollars', () => {
  const pv = planPreview(baseState(), allIn(plan({ playFor: { kind: 'points' } })), { now: NOW });
  const m = previewCardModel(pv);
  assert.match(m.sub, /^2 pts a skin/);
  assert.equal(m.playFor, 'For bragging rights');
  assert.doesNotMatch(JSON.stringify(m), /\$/);
});

test('the image: no handicaps says straight up', () => {
  const m = previewCardModel(planPreview(baseState(), allIn(plan({ useHc: false })), { now: NOW }));
  assert.equal(m.strokesNote, 'No handicaps, everyone plays straight up');
  assert.deepEqual(m.strokes, []);
});

test('the text: what, when, who, strokes and records, money only with the switch', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike');
  const pv = planPreview(s, allIn(plan()), { now: NOW });
  const t = previewText(pv, { link: 'https://x/?plan=ABC' });
  assert.equal(t.split('\n')[0], '2 days to go. Rancho Park, Saturday · 8:10 AM.');
  assert.equal(t.split('\n')[1], 'Game: Skins.');
  assert.match(t, /3 in: Trevor, Mike and Dave\./);
  assert.match(t, /Strokes: Dave gets 18: every hole; Mike gets 7: 1, 2, 3, 4, 5, 6 and 7\. Trevor plays off the low\./);
  assert.match(t, /Mike is 1 and 0 against Dave this season\./);
  assert.equal(t.split('\n').at(-1), 'https://x/?plan=ABC');
  assert.doesNotMatch(t, /\$/);
  assert.match(previewText(pv, { showAmounts: true }), /Game: Skins, \$2 a skin/);
});

test('the preview reads the state and never changes it', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike');
  const p = allIn(plan());
  const before = JSON.stringify([s, p]);
  planPreview(s, p, { now: NOW });
  assert.equal(JSON.stringify([s, p]), before);
});

test('the image file name', () => {
  assert.equal(previewImageName({ course: { name: 'Rancho Park' }, date: '2026-10-03' }), 'preview-rancho-park-2026-10-03.png');
});

// --------------------------- review fixes -----------------------------------

test('people: on the organizer\'s phone a link answer matches only as the roll call will (full name), so strokes agree', () => {
  const s = baseState();
  // "Mike" answered from the group link; the saved player is "Mike Jones", so the roll call saves a new Mike
  const p = say(plan(), 'dave', 'in');
  p.answers.g_mike = { name: 'Mike', status: 'in', at: 9 };
  const people = previewPeople(s, p);
  assert.equal(people.find(x => x.who === 'g_mike').player, null);
  const st = previewStrokes(s, p);
  const setup = planStart(s, p, ['host', 'dave', 'g_mike'], { course: COURSE, newId: () => 'new_mike' });
  const round = createRound({ id: 'x', game: setup.game, course: COURSE, holesCount: setup.holesCount, nine: setup.nine, startHole: null, players: setup.players, settings: setup.settings, hcPct: setup.hcPct, useHandicaps: true });
  for (const rp of round.players) assert.equal(st.rows.find(r => r.name === rp.name.split(' ')[0]).plays, rp.plays, rp.name);
  assert.equal(st.rows.find(r => r.name === 'Mike').noIndex, true);
  // The same answer with the full name is the saved Mike
  p.answers.g_mike.name = 'Mike Jones';
  assert.equal(previewPeople(s, p).find(x => x.who === 'g_mike').player.id, 'mike');
});

test('strokes: a side game % the roll call ignores is not mentioned, and half strokes follow halfStrokesOffered', () => {
  const st = previewStrokes(baseState(), allIn(plan({ sides: ['birdies'], sidePcts: { birdies: 0 } })));
  assert.deepEqual(st.notes, []);
  // Half strokes on Stroke play with only Junk alongside: no match or skins to use them
  const stroke = previewStrokes(baseState(), allIn(plan({ game: 'stroke', halfStrokes: true, sides: ['dots'] })));
  assert.equal(stroke.half, false);
});

test('records: the same head to head as the Players list, lunch rounds\' money side bets in dollars from tabResults', () => {
  const s = baseState();
  match(s, 'me', 'mike', 'me', { stake: 10 });
  match(s, 'me', 'mike', 'mike', { playFor: { kind: 'points' } });
  // A lunch round Mike wins on the games, with a $2 a hole side bet for money he also wins
  const lunch = match(s, 'me', 'mike', 'mike', { playFor: { kind: 'reward', reward: 'Lunch' } });
  lunch.bets = [{ id: 'b1', kind: 'hole', sides: ['me', 'mike'], stake: 2, playFor: 'money' }];
  // A lunch round with nothing for money, halved
  match(s, 'me', 'mike', null, { playFor: { kind: 'reward', reward: 'Lunch' } });
  const mine = pairRecords(s, ['me', 'mike'], { now: NOW }).get('me|mike').all;
  const players = headToHeadSummary(s, new Set(['me'])).get('mike');
  assert.deepEqual([mine.rounds, mine.won, mine.lost, mine.even, mine.net], [players.rounds, players.won, players.lost, players.even, players.net]);
  assert.deepEqual([mine.rounds, mine.won, mine.lost, mine.even, mine.net, mine.moneyRounds], [4, 1, 2, 1, 8, 2]);
});

test('the image: a lunch plan shows no dollars, with or without the switch', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike', { stake: 10 });
  const pv = planPreview(s, allIn(plan({ playFor: { kind: 'reward', reward: 'Lunch' } })), { now: NOW });
  for (const showAmounts of [false, true]) {
    assert.doesNotMatch(JSON.stringify(previewCardModel(pv, { showAmounts })), /\$/);
    assert.doesNotMatch(previewText(pv, { showAmounts }), /\$/);
  }
});

test('the text: a plan with no date yet reads cleanly', () => {
  const p = allIn(plan());
  p.date = null;
  const t = previewText(planPreview(baseState(), p, { now: NOW }));
  assert.equal(t.split('\n')[0], 'Rancho Park, 8:10 AM.');
});

test('records carry the saved players\' ids for their avatars', () => {
  const s = baseState();
  match(s, 'mike', 'dave', 'mike');
  const r = previewRecords(s, allIn(plan()), { now: NOW })[0];
  assert.deepEqual([r.aId, r.bId], ['mike', 'dave']);
});
