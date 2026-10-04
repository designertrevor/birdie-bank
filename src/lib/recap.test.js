// The day-after recap: when it shows, who took it and how you did, who's paid (status for everyone,
// amounts only on your own lines), what carried, a moment or two, and that it never changes money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding } from './ledger.js';
import { RECAP_DAYS, currentRecap, recapDay, recapMoments, recapOf, recapRound, recapTransfers } from './recap.js';

const DAY = 864e5;
const NOW = new Date(2026, 8, 28, 9).getTime(); // a Monday morning
const YESTERDAY = new Date(2026, 8, 27, 16).getTime();
const course = { id: 'c9', name: 'Pebble Creek', city: 'Town', custom: true, tees: [{ name: 'Blue', color: '#00f', rating: 36, slope: 120 }], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const NAMES = { me: 'Trevor Nielsen', sam: 'Sam Ray', mike: 'Mike Lee', dave: 'Dave Ortiz' };

/** A finished 9-hole skins round: `scores` maps hole number to { id: gross } (missing players make 4). */
function skins(id, at, ids, scores = {}, more = {}) {
  const r = createRound({ id, game: 'skins', course, holesCount: 9, nine: 'front', players: ids.map(x => ({ id: x, name: NAMES[x], index: 0, tee: 'Blue' })), settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, scores[h.no]?.[p] ?? 4]));
  return { ...r, status: 'done', createdAt: at - 4 * 3600e3, finishedAt: at, ...more };
}
function stateWith(rounds, extra = {}) {
  return {
    me: 'me', players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])),
    rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, customCourses: { c9: course }, settings: {}, ...extra,
  };
}
// Sam wins holes 1 and 2 (a skin each) and Mike hole 3, so Sam takes it and the rest carry to nothing
const FOUR = ['me', 'sam', 'mike', 'dave'];
const SAM_DAY = { 1: { sam: 3 }, 2: { sam: 3 }, 3: { mike: 3 } };

test('recap: shows the day after the round, not the same day, and for a week', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY);
  const s = stateWith([r]);
  assert.equal(recapRound(s, YESTERDAY + 3600e3), null, 'the same evening is still "Last time out"');
  assert.equal(recapRound(s, NOW)?.id, 'r1');
  assert.equal(recapRound(s, new Date(2026, 8, 28, 0, 5).getTime())?.id, 'r1', 'just after midnight is the next day');
  assert.equal(recapRound(s, YESTERDAY + RECAP_DAYS * DAY)?.id, 'r1');
  assert.equal(recapRound(s, YESTERDAY + (RECAP_DAYS + 1) * DAY), null);
});

test('recap: put away on this phone, a newer round, or a round going on hides it', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY);
  assert.equal(recapRound(stateWith([r], { recapSeen: { r1: NOW } }), NOW), null);
  const live = { ...skins('r2', NOW, FOUR), status: 'active', finishedAt: null };
  assert.equal(recapRound(stateWith([r, live]), NOW), null);
  // A round finished today is the newest: it's "Last time out" until tomorrow, so no recap now
  const today = skins('r3', NOW - 3600e3, FOUR);
  assert.equal(recapRound(stateWith([r, today]), NOW), null);
  assert.equal(recapRound(stateWith([r, today]), NOW + DAY)?.id, 'r3');
});

test('recap: a round you only watched never gets a recap', () => {
  const watched = skins('w1', YESTERDAY, ['sam', 'mike'], SAM_DAY);
  assert.equal(recapRound(stateWith([watched]), NOW), null);
  const older = skins('r0', YESTERDAY - 2 * DAY, FOUR, SAM_DAY);
  assert.equal(recapRound(stateWith([older, watched]), NOW)?.id, 'r0');
});

test('recap: who took it and your own result, in the round’s unit', () => {
  const s = stateWith([skins('r1', YESTERDAY, FOUR, SAM_DAY)]);
  const rc = currentRecap(s, NOW);
  assert.equal(rc.when, 'Yesterday');
  assert.equal(rc.title, 'Skins at Pebble Creek');
  assert.equal(rc.headline, 'Sam took it');
  assert.match(rc.yours, /^You −\$\d+$/);
  // A points round reads in points, never dollars
  const pts = stateWith([skins('p1', YESTERDAY, FOUR, SAM_DAY, { playFor: { kind: 'points' } })]);
  const rp = currentRecap(pts, NOW);
  assert.match(rp.yours, /^You −\d+ pts?$/);
  assert.equal(rp.paid, null, 'nothing to pay on a points round');
  assert.doesNotMatch(JSON.stringify({ ...rp, round: null }), /\$/);
  // A reward round says who wins it and who's buying
  const lunch = stateWith([skins('l1', YESTERDAY, FOUR, SAM_DAY, { playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' } })]);
  const rl = currentRecap(lunch, NOW);
  assert.equal(rl.headline, 'Sam wins lunch');
  assert.match(rl.yours, /buying\.$|split it\.$/);
  assert.equal(rl.paid, null);
  // You win it, or you're the one buying: "You", never your own name
  const won = currentRecap(stateWith([skins('l2', YESTERDAY, FOUR, { 1: { me: 3 }, 2: { me: 3 } }, { playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' } })]), NOW);
  assert.equal(won.headline, 'You win lunch');
  const lost = currentRecap(stateWith([skins('l3', YESTERDAY, ['me', 'sam'], SAM_DAY, { playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' } })]), NOW);
  assert.equal(lost.headline, 'Sam wins lunch');
  assert.equal(lost.yours, 'You’re buying.');
  // Everyone level
  const level = currentRecap(stateWith([skins('e1', YESTERDAY, FOUR)]), NOW);
  assert.equal(level.headline, 'All square');
  assert.equal(level.yours, 'You broke even');
  assert.equal(level.paid, null);
});

test('recap: recapDay names the day before as Yesterday and dates the rest', () => {
  assert.equal(recapDay(YESTERDAY, NOW), 'Yesterday');
  assert.equal(recapDay(YESTERDAY - DAY, NOW), 'Sat, Sep 26');
});

test('recap: who’s paid is status for everyone, amounts only on lines you’re in', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY);
  const s = stateWith([r]);
  const rc = currentRecap(s, NOW);
  const res = roundResults(r);
  assert.ok(res.transfers.some(t => t.from !== 'me' && t.to !== 'me'), 'the fixture has a payment between two other people');
  assert.equal(rc.paid.total, 4);
  assert.deepEqual(rc.paid.people.map(p => p.name), ['You', 'Sam', 'Mike', 'Dave']);
  for (const p of rc.paid.people) assert.deepEqual(Object.keys(p).sort(), ['id', 'name', 'status'], 'no amount on anyone’s status');
  // Your lines name you, and only yours have amounts
  assert.ok(rc.paid.mine.length > 0);
  for (const l of rc.paid.mine) assert.match(l.text, /\bYou\b|\byou\b/);
  const mineAmounts = res.transfers.filter(t => t.from === 'me' || t.to === 'me').length;
  assert.equal(rc.paid.mine.length, mineAmounts);
  // Nobody else's payment amount shows anywhere on the card's paid section
  const others = res.transfers.filter(t => t.from !== 'me' && t.to !== 'me');
  const paidText = JSON.stringify(rc.paid);
  for (const t of others) {
    const mine = res.transfers.some(m => (m.from === 'me' || m.to === 'me') && m.amount === t.amount);
    if (!mine) assert.ok(!paidText.includes(`$${t.amount}`), `no $${t.amount} between two others`);
  }
});

test('recap: a payment on the round marks it paid; the rest stay open', () => {
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } });
  const s = stateWith([r], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 4, roundId: 'r1', at: NOW - 3600e3 }] });
  const rc = currentRecap(s, NOW);
  assert.equal(rc.paid.allSquare, true);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You paid Sam $4']);
  // Half of it paid: what's left, never more than the Tab has between you
  const half = stateWith([r], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 1.5, roundId: 'r1', at: NOW - 3600e3 }] });
  const rh = currentRecap(half, NOW);
  assert.deepEqual(rh.paid.mine.map(l => l.text), ['You owe Sam $2.50']);
  assert.deepEqual(rh.paid.people.map(p => p.status), ['owes', 'waiting']);
  assert.equal(rh.paid.square, 0);
});

test('recap: paid on the Tab since (no round on the payment) counts as paid; netted counts as square', () => {
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } });
  const s = stateWith([r], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 4, at: NOW - 3600e3 }] });
  const rc = currentRecap(s, NOW);
  assert.deepEqual(rc.paid.people.map(p => p.status), ['square', 'square']);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You paid Sam $4']);
  // A payment from before the round finished isn't a payment on it, but paid ahead the Tab has you square
  const early = stateWith([r], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 4, at: YESTERDAY - DAY }] });
  assert.deepEqual(recapTransfers(early, r, { now: NOW }).map(t => t.status), ['square']);
  // An older round the other way nets it on the Tab: square too, nobody is chased for it
  const older = skins('r0', YESTERDAY - 3 * DAY, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 } });
  const net = currentRecap(stateWith([older, r]), NOW);
  assert.deepEqual(net.paid.people.map(p => p.status), ['square', 'square']);
  assert.deepEqual(net.paid.mine.map(l => l.text), ['Your $4 to Sam evens out with what Sam owed you on the Tab']);
  // Sam owed you more from before: it comes off that, and the line says so
  const more = skins('r0', YESTERDAY - 3 * DAY, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 }, 3: { me: 3 }, 4: { me: 3 } });
  assert.deepEqual(currentRecap(stateWith([more, r]), NOW).paid.mine.map(l => l.text), ['Your $4 to Sam comes off what Sam owes you on the Tab']);
  // From Sam's phone, the other way round
  assert.deepEqual(currentRecap({ ...stateWith([more, r]), me: 'sam' }, NOW).paid.mine.map(l => l.text), ['Trevor’s $4 to you comes off what you owe Trevor on the Tab']);
});

test('recap: someone who owes you shows on your line with what the Tab has', () => {
  // Hole 2 ties, so hole 3 is worth two skins: four skins at $2
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { me: 3 }, 3: { me: 3 }, 4: { me: 3 } });
  const rc = currentRecap(stateWith([r]), NOW);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['Sam owes you $8']);
  assert.deepEqual(rc.paid.people.map(p => p.status), ['waiting', 'owes']);
});

test('recap: what carried, with an amount only on a carry you’re in', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY, { shareCode: 'ABCDEF', shared: { code: 'ABCDEF' } });
  const res = roundResults(r);
  const theirs = res.transfers.find(t => t.from !== 'me' && t.to !== 'me');
  const mine = res.transfers.find(t => t.from === 'me');
  const row = (t, id) => ({ code: 'ABCDEF', id, kind: 'carry', from: t.from, to: t.to, amount: t.amount, status: 'agreed', at: NOW - 3600e3, updatedAt: NOW - 3600e3 });
  const s = stateWith([r], { tabRows: {
    'ABCDEF|a': row(theirs, 'a'),
    'ABCDEF|b': row(mine, 'b'),
  } });
  const rc = currentRecap(s, NOW);
  const texts = rc.carried.map(c => c.text);
  assert.ok(texts.some(t => t === `You and ${NAMES[mine.to].split(' ')[0]} rolled $${mine.amount} to next time`), texts.join(' / '));
  const other = rc.carried.find(c => !c.mine);
  assert.equal(other.text, `${NAMES[theirs.from].split(' ')[0]} and ${NAMES[theirs.to].split(' ')[0]} rolled it to next time`);
  assert.doesNotMatch(other.text, /\$/);
  const st = recapTransfers(s, r, { now: NOW });
  assert.equal(st.find(t => t.from === theirs.from && t.to === theirs.to).status, 'carried');
  // Your carry is said once, under Rolled to next time, not again in Who's paid
  assert.equal(rc.paid.mine.some(l => l.status === 'carried'), false);
  assert.equal([...rc.paid.mine.map(l => l.text), ...texts].filter(t => /rolled/.test(t) && /^You/.test(t)).length, 1);
});

test('recap: a carry saved on this phone over more than this round shows only this round’s part', () => {
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } });
  const carry = { id: 'k1', from: 'me', to: 'sam', amount: 30, status: 'agreed', at: NOW - 3600e3, answeredAt: NOW - 3600e3, roundIds: ['r0', 'r1'], codes: [] };
  const rc = currentRecap(stateWith([r], { carries: [carry] }), NOW);
  assert.deepEqual(rc.carried.map(c => c.text), ['You and Sam rolled $4 to next time']);
  assert.deepEqual(rc.paid.people.map(p => p.status), ['carried', 'carried']);
});

test('recap: you come first when you share the top, "You and Sam", never "Sam and You"', () => {
  const pair = (more = {}) => skins('t1', YESTERDAY, ['sam', 'me', 'mike'], { 1: { sam: 3 }, 2: { me: 3 } }, more);
  assert.equal(currentRecap(stateWith([pair()]), NOW).headline, 'You and Sam split it');
  const lunch = pair({ playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' } });
  assert.equal(currentRecap(stateWith([lunch]), NOW).headline, 'You and Sam share lunch');
});

test('recap: a lunch round’s side bet for money is the only money on it', () => {
  const r = skins('l1', YESTERDAY, ['me', 'sam', 'mike'], SAM_DAY, {
    playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' },
    bets: [{ id: 'b1', kind: 'hole', sides: ['me', 'mike'], stake: 2, playFor: 'money' }],
  });
  const s = stateWith([r]);
  const rc = currentRecap(s, NOW);
  assert.ok(rc.paid, 'the money side bet has something to pay');
  // Mike won hole 5 on the bet: you owe him $2, the lunch points never show as dollars
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You owe Mike $2']);
  assert.match(rc.yours, /You −\$2 on side bets$/);
  assert.deepEqual(recapTransfers(s, r, { now: NOW }).map(t => [t.from, t.to, t.amount]), [['me', 'mike', 2]]);
});

test('recap: one friend is one person, whichever id the round has', () => {
  // Sam's own seat in the round is "sam2", linked to the Sam this phone has
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } });
  const swapped = { ...r, players: r.players.map(p => (p.id === 'sam' ? { ...p, id: 'sam2' } : p)), scores: Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, { me: v.me, sam2: v.sam }])) };
  const s = stateWith([swapped], { links: { sam2: 'sam' }, players: { ...stateWith([]).players, sam: { id: 'sam', name: 'Samuel Ray' } } });
  const rc = currentRecap(s, NOW);
  assert.equal(rc.headline, 'Samuel took it');
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You owe Samuel $4']);
});

test('recap moments: the biggest from the round as it happened, at most two, one of a kind', () => {
  // Holes 1 to 4 tie, so Mike's win on 5 ends a 4-hole carry: a big skin
  const r = skins('r1', YESTERDAY, FOUR, { 5: { mike: 3 }, 7: { sam: 3 }, 8: { sam: 3 } });
  const ms = recapMoments(r);
  assert.ok(ms.length >= 1 && ms.length <= 2);
  assert.equal(ms[0].kind, 'bigskin');
  assert.equal(ms[0].hole, 5);
  assert.equal(ms[0].title, 'Mike takes 5 skins');
  assert.match(ms[0].text, /4-hole carry/);
  assert.equal(new Set(ms.map(m => m.kind)).size, ms.length);
  // A quiet round has nothing to show
  assert.deepEqual(recapMoments(skins('q1', YESTERDAY, FOUR)), []);
});

test('recap: reading a round never changes it or any money', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY, { shareCode: 'ABCDEF', shared: { code: 'ABCDEF' } });
  const s = stateWith([r, skins('r0', YESTERDAY - 3 * DAY, FOUR, { 2: { dave: 3 } })], { settlements: [{ id: 's1', from: 'me', to: 'sam', amount: 2, at: NOW - DAY }] });
  const before = structuredClone(s);
  const balances = roundResults(r).balances;
  const tab = outstanding(s, { now: NOW });
  recapOf(s, r, NOW);
  currentRecap(s, NOW);
  assert.deepEqual(s, before);
  assert.deepEqual(roundResults(r).balances, balances);
  assert.deepEqual(outstanding(s, { now: NOW }), tab);
});

test('recap: money the Tab routes elsewhere is still owed by the payer, and never everyone square', () => {
  // Mike took two skins off everyone before; yesterday Sam took one. Overall Sam is level, Mike is
  // up, and you owe Mike everything you lost, yesterday's $2 included: you haven't paid it, so it's
  // never square for you, though Sam isn't waiting on anyone and Mike (who owes nobody) is square
  const before = skins('r0', YESTERDAY - 3 * DAY, ['me', 'sam', 'mike'], { 1: { mike: 3 }, 2: { mike: 3 } });
  const last = skins('r1', YESTERDAY, ['me', 'sam', 'mike'], { 1: { sam: 3 } });
  const s = stateWith([before, last]);
  const rc = currentRecap(s, NOW);
  assert.deepEqual(rc.paid.people.map(p => [p.name, p.status]), [['You', 'owes'], ['Sam', 'square'], ['Mike', 'square']]);
  assert.equal(rc.paid.allSquare, false);
  assert.equal(rc.paid.square, 2);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You still owe $2 from this round. The Tab has who to pay']);
});

test('recap: the payee owing someone else never squares what you owe them', () => {
  // Sam owes Dave $20 from before; yesterday you lost $4 to Sam. Nobody owes Sam on the Tab now
  // (his win goes to what he owes Dave), but you still owe that $4: the Tab has you paying Dave
  const before = skins('r0', YESTERDAY - 3 * DAY, ['sam', 'dave'], { 1: { dave: 3 }, 2: { dave: 3 }, 3: { dave: 3 }, 4: { dave: 3 }, 5: { dave: 3 }, 6: { dave: 3 }, 7: { dave: 3 }, 8: { dave: 3 }, 9: { dave: 3 } });
  // A level round all three played, so the Tab can have you pay Dave
  const level = skins('rx', YESTERDAY - 2 * DAY, ['me', 'sam', 'dave']);
  const last = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } });
  const s = stateWith([before, level, last]);
  const plan = outstanding(s, { now: NOW });
  assert.ok(!plan.some(d => d.to === 'sam'), 'nobody owes Sam on the Tab');
  assert.ok(plan.some(d => d.from === 'me'), 'you still pay someone');
  const [t] = recapTransfers(s, last, { now: NOW });
  assert.deepEqual([t.status, t.left, t.payeeDone], ['open', 400, true]);
  const rc = currentRecap(s, NOW);
  assert.deepEqual(rc.paid.people.map(p => [p.name, p.status]), [['You', 'owes'], ['Sam', 'square']]);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You still owe $4 from this round. The Tab has who to pay']);
  // Seen from Sam's phone, it's square for him: nothing is coming to him, so he isn't told it is
  const sams = { ...s, me: 'sam' };
  const theirs = currentRecap(sams, NOW);
  assert.deepEqual(theirs.paid.mine.map(l => [l.text, l.status]), [['Trevor’s $4 to you is squared on the Tab', 'square']]);
});

test('recap: a shared round is kept between the two of you, so the pair alone says if it’s open', () => {
  const r = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 }, 2: { sam: 3 } }, { shareCode: 'ABCDEF', shared: { code: 'ABCDEF' } });
  const rc = currentRecap(stateWith([r]), NOW);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You owe Sam $4']);
  // An older shared round the other way squares the pair
  const older = skins('r0', YESTERDAY - 3 * DAY, ['me', 'sam'], { 1: { me: 3 }, 2: { me: 3 } }, { shareCode: 'GHIJKL', shared: { code: 'GHIJKL' } });
  const net = currentRecap(stateWith([older, r]), NOW);
  assert.deepEqual(net.paid.people.map(p => p.status), ['square', 'square']);
});

test('recap: still owed but routed through someone else on the Tab says so, without a name', () => {
  // You owe Sam $2 from yesterday, and Sam is still owed (by Dave) and you still owe (Mike), but the
  // Tab's fewest payments send your money to Mike: the line doesn't send you to the wrong person
  const before = skins('r0', YESTERDAY - 3 * DAY, ['me', 'sam', 'mike', 'dave'], { 1: { mike: 3 }, 2: { mike: 3 }, 3: { sam: 3 } });
  const last = skins('r1', YESTERDAY, ['me', 'sam'], { 1: { sam: 3 } });
  const s = stateWith([before, last]);
  // Overall: you −$8, Sam +$4, Mike +$10, Dave −$6, so the Tab has you paying Mike and Dave paying Sam
  const [t] = recapTransfers(s, last, { now: NOW });
  assert.deepEqual([t.status, t.onTab, t.left], ['open', false, 200]);
  const rc = currentRecap(s, NOW);
  assert.deepEqual(rc.paid.mine.map(l => l.text), ['You still owe $2 from this round. The Tab has who to pay']);
  assert.deepEqual(rc.paid.people.map(p => p.status), ['owes', 'waiting']);
});

test('recap: a garbled round gives no recap instead of breaking Up next', () => {
  const r = skins('r1', YESTERDAY, FOUR, SAM_DAY);
  const bad = { ...r, holes: null };
  assert.equal(currentRecap(stateWith([bad]), NOW), null);
});
