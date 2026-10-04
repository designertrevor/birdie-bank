// Callouts: friendly lines for the group text. Trying to break the never-mean rules: nobody else is
// ever ribbed or shown with money, nobody is called out for owing you, money only in lines about you,
// an off switch, points never as dollars, and a seeded sweep of random groups and rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { CALLOUT_DAYS, calloutCandidates, callouts, calloutsOn, neverMean } from './callouts.js';

const DAY = 864e5;
const NOW = new Date(2026, 8, 28, 9).getTime();
const course = { id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true, tees: [{ name: 'Blue', color: '#00f', rating: 36, slope: 120 }], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const NAMES = { me: 'Trevor Nielsen', sam: 'Sam Ray', mike: 'Mike Lee', dave: 'Dave Ortiz', al: 'Al Diaz' };
const FIRST = Object.fromEntries(Object.entries(NAMES).map(([id, n]) => [id, n.split(' ')[0]]));

function round(id, daysAgo, ids, scores = {}, { game = 'skins', ...more } = {}) {
  const settings = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'per' } };
  const r = createRound({ id, game, course, holesCount: 9, nine: 'front', players: ids.map(x => ({ id: x, name: NAMES[x], index: 0, tee: 'Blue' })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, scores[h.no]?.[p] ?? 4]));
  const at = NOW - daysAgo * DAY;
  return { ...r, status: 'done', createdAt: at - 4 * 3600e3, finishedAt: at, ...more };
}
function stateWith(rounds, extra = {}) {
  return {
    me: 'me', players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, customCourses: { c9: course }, settings: {}, ...extra,
  };
}
/** Sam wins `n` skins outright on holes 1..n. */
const samWins = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { sam: 3 }]));

/** Everything the rules promise about one line, given who "me" is. */
function assertKind(c, label = '') {
  assert.ok(neverMean(c), `${label} ${c.text}`);
  if (c.about !== 'me') {
    assert.doesNotMatch(c.text, /\$/, `${label} money about someone else: ${c.text}`);
    assert.equal(c.money, false, label);
    assert.equal(c.tone, 'cheer', label);
  }
  assert.doesNotMatch(c.text, /owes? me|owed to me|you owe/i, `${label} ${c.text}`);
  assert.ok(!c.text.includes(String.fromCharCode(0x2014)), 'no long dash');
}

test('neverMean: someone else is only ever cheered, never shown with money', () => {
  assert.equal(neverMean({ about: 'sam', tone: 'cheer', money: false, text: 'Sam has won 3 in a row. Somebody stop Sam.' }), true);
  assert.equal(neverMean({ about: 'sam', tone: 'cheer', money: false, text: 'Sam still owes $40.' }), false);
  assert.equal(neverMean({ about: 'sam', tone: 'cheer', money: true, text: 'Sam is up big.' }), false);
  assert.equal(neverMean({ about: 'sam', tone: 'self', money: false, text: 'Sam made a birdie.' }), false);
  assert.equal(neverMean({ about: 'sam', tone: 'cheer', money: false, text: 'Sam hasn’t won a skin in 3 weeks.' }), false);
  assert.equal(neverMean({ about: 'sam', tone: 'cheer', money: false, text: 'Sam lost again.' }), false);
  assert.equal(neverMean({ about: 'group', tone: 'cheer', money: false, text: 'Dave is down 12 pts.' }), false);
  assert.equal(neverMean({ about: 'group', tone: 'cheer', money: false, text: 'Mike finished last place.' }), false);
  assert.equal(neverMean({ about: 'group', tone: 'cheer', money: false, text: 'Everyone’s square from Pebble Creek. Clean books.' }), true);
});

test('neverMean: you can rib yourself and share your own money, never what someone owes you', () => {
  assert.equal(neverMean({ about: 'me', tone: 'self', money: true, text: 'I owe Sam $10. It’s coming, promise.' }), true);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: false, text: 'No skins for me in my last 3 skins games. I’m due.' }), true);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: true, text: 'Sam owes me $40.' }), false);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: true, text: 'Still owed to me: $40.' }), false);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: true, text: 'Pay up, you owe me $40.' }), false);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: false, text: `I am the worst${String.fromCharCode(0x2014)}ever.` }), false);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: false, text: 'What a loser.' }), false);
  assert.equal(neverMean({ about: 'me', tone: 'self', money: false, text: '   ' }), false);
  assert.equal(neverMean(null), false);
});

test('callouts: the last round’s winner, skins and birdies, about other people with no money', () => {
  const s = stateWith([round('r1', 1, ['me', 'sam', 'mike'], samWins(3))]);
  const lines = calloutCandidates(s, NOW);
  const texts = lines.map(c => c.text);
  assert.ok(texts.includes('Sam took 3 skins at Pebble Creek. Skin collector.'), texts.join(' / '));
  assert.ok(texts.includes('Sam won the day at Pebble Creek. Tip of the cap.'));
  assert.ok(texts.includes('Sam made 3 birdies at Pebble Creek. Hot putter.'));
  for (const c of lines) assertKind(c);
});

test('callouts: what you owe is yours to share; what someone owes you never shows', () => {
  const owe = stateWith([round('r1', 1, ['me', 'sam'], samWins(2))]);
  const mine = calloutCandidates(owe, NOW).find(c => c.kind === 'iowe');
  assert.equal(mine.text, 'I owe Sam $4. It’s coming, promise.');
  assert.equal(mine.about, 'me');
  // Sam owes you: there's no line about it at all, named or not
  const owed = stateWith([round('r1', 1, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 } })]);
  const all = calloutCandidates(owed, NOW);
  assert.equal(all.some(c => c.kind === 'iowe'), false);
  for (const c of all) assert.doesNotMatch(c.text, /\bowe/i, c.text);
});

test('callouts: a win streak for someone else cheers them; yours is a brag of your own', () => {
  const s = stateWith([round('a', 1, ['me', 'sam'], samWins(1)), round('b', 5, ['me', 'sam'], samWins(1)), round('c', 9, ['me', 'sam'], samWins(1)), round('d', 12, ['me', 'sam'], { 1: { me: 3 } })]);
  const streak = calloutCandidates(s, NOW).find(c => c.kind === 'streak');
  assert.equal(streak.text, 'Sam has won 3 in a row. Somebody stop Sam.');
  const me = stateWith([round('a', 1, ['me', 'sam'], { 1: { me: 3 } }), round('b', 5, ['me', 'sam'], { 1: { me: 3 } })]);
  assert.equal(calloutCandidates(me, NOW).find(c => c.kind === 'streak').text, 'I’ve won 2 in a row. Come and get me.');
  // Nobody is ever told they've lost a few in a row
  for (const c of calloutCandidates(s, NOW)) assertKind(c);
});

test('callouts: a skins drought is only ever your own', () => {
  const s = stateWith([1, 3, 6].map((d, i) => round(`r${i}`, d, ['me', 'sam', 'mike'], samWins(2))));
  const dry = calloutCandidates(s, NOW).find(c => c.kind === 'drought');
  assert.equal(dry.text, 'No skins for me in my last 3 skins games. I’m due.');
  assert.equal(dry.about, 'me');
  // Mike hasn't won a skin either, and nothing says so
  assert.equal(calloutCandidates(s, NOW).some(c => /Mike/.test(c.text)), false);
});

test('callouts: your season in dollars from the Tab, points rounds never in it', () => {
  const s = stateWith([
    round('m1', 1, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 } }),
    round('m2', 4, ['me', 'sam'], { 1: { me: 3 } }),
    round('p1', 7, ['me', 'sam'], samWins(9), { playFor: { kind: 'points' } }),
  ]);
  const net = calloutCandidates(s, NOW).find(c => c.kind === 'net');
  assert.equal(net.text, 'Up $6 on the season. I’ll take it.');
  // The points round's 18 points (it would be $18) never shows up as money
  for (const c of calloutCandidates(s, NOW)) assert.doesNotMatch(c.text, /\$18|\$12/);
  // A lunch round's side bet for money counts as dollars, its lunch points don't
  const lunch = stateWith([
    round('m1', 1, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 } }),
    round('l1', 3, ['me', 'sam'], { 4: { sam: 3 } }, { playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' }, bets: [{ id: 'b1', kind: 'hole', sides: ['me', 'sam'], stake: 3, playFor: 'money' }] }),
  ]);
  assert.equal(calloutCandidates(lunch, NOW).find(c => c.kind === 'net').text, 'Up $1 on the season. I’ll take it.');
});

test('callouts: a points round winner is cheered with no dollars anywhere', () => {
  const s = stateWith([round('p1', 1, ['me', 'sam', 'mike'], samWins(3), { playFor: { kind: 'points' } })]);
  const lines = callouts(s, NOW);
  assert.ok(lines.length > 0);
  for (const c of lines) { assert.doesNotMatch(c.text, /\$/); assertKind(c); }
});

test('callouts: everyone square from the last round, status only', () => {
  const r = round('r1', 1, ['me', 'sam', 'mike'], samWins(1));
  const s = stateWith([r], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 2, roundId: 'r1', at: NOW }, { id: 's2', from: 'mike', to: 'sam', amount: 2, roundId: 'r1', at: NOW }] });
  const sq = calloutCandidates(s, NOW).find(c => c.kind === 'square');
  assert.equal(sq.text, 'Everyone’s square from Pebble Creek. Clean books.');
  assert.equal(calloutCandidates(stateWith([r]), NOW).some(c => c.kind === 'square'), false);
});

test('callouts: the off switch, and nothing once your last round is old news', () => {
  const r = round('r1', 1, ['me', 'sam'], samWins(3));
  assert.equal(calloutsOn(stateWith([r])), true);
  assert.ok(callouts(stateWith([r]), NOW).length > 0);
  assert.equal(calloutsOn(stateWith([r], { settings: { callouts: false } })), false);
  assert.deepEqual(callouts(stateWith([r], { settings: { callouts: false } }), NOW), []);
  const old = round('r1', CALLOUT_DAYS + 1, ['me', 'sam'], samWins(3));
  assert.deepEqual(callouts(stateWith([old]), NOW), []);
  assert.deepEqual(callouts(stateWith([]), NOW), []);
});

test('callouts: at most three, one with money, two about you, and not all about one person', () => {
  const s = stateWith([
    round('a', 1, ['me', 'sam', 'mike'], { ...samWins(3), 5: { me: 2 } }),
    round('b', 4, ['me', 'sam', 'mike'], samWins(2)),
    round('c', 8, ['me', 'sam', 'mike'], samWins(2)),
  ]);
  const lines = callouts(s, NOW);
  assert.ok(lines.length <= 3);
  assert.ok(lines.filter(c => c.money).length <= 1);
  assert.ok(lines.filter(c => c.about === 'me').length <= 2);
  const sam = lines.filter(c => c.about === 'sam' || c.people?.includes('sam')).length;
  assert.ok(sam < lines.length || lines.length === 1, lines.map(c => c.text).join(' / '));
  assert.equal(callouts(s, NOW, { limit: 1 }).length, 1);
});

test('callouts: a seeded sweep of random groups never makes an unkind line', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = a => a[Math.floor(rand() * a.length)];
  const people = ['me', 'sam', 'mike', 'dave', 'al'];
  for (let n = 0; n < 60; n++) {
    const rounds = [];
    const count = 1 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const ids = ['me', ...people.slice(1).filter(() => rand() < 0.7)];
      if (ids.length < 2) ids.push('sam');
      const scores = {};
      for (let h = 1; h <= 9; h++) scores[h] = Object.fromEntries(ids.map(p => [p, pick([2, 3, 4, 4, 4, 5, 6])]));
      const playFor = pick([null, null, { kind: 'points' }, { kind: 'reward', reward: 'Lunch', owes: 'last' }]);
      const game = pick(['skins', 'skins', 'stroke']);
      const r = round(`r${n}-${i}`, 1 + i * 3 + Math.floor(rand() * 3), ids, scores, { game, ...(playFor ? { playFor } : {}) });
      rounds.push(r);
    }
    const settlements = rand() < 0.5 ? [{ id: `s${n}`, from: pick(people), to: pick(people), amount: pick([2, 5, 10]), at: NOW - DAY }] : [];
    const s = stateWith(rounds, { settlements });
    for (const c of calloutCandidates(s, NOW)) assertKind(c, `sweep ${n}`);
    const shown = callouts(s, NOW);
    assert.ok(shown.length <= 3);
    for (const c of shown) {
      assertKind(c, `sweep ${n}`);
      // A dollar amount only ever sits in a line about you
      if (/\$/.test(c.text)) assert.equal(c.about, 'me');
      // Another person's name never sits next to a word about losing or owing, unless it's you owing them
      for (const id of people.slice(1)) {
        if (!c.text.includes(FIRST[id])) continue;
        if (c.kind === 'iowe') { assert.match(c.text, new RegExp(`^I owe ${FIRST[id]} \\$`)); continue; }
        assert.doesNotMatch(c.text, /\blost\b|\blose|\bowes?\b|\bdown\b|\bdue\b|\bno skins\b/i, c.text);
      }
    }
  }
});
