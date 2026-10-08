// The one-line insights (data-insights.js): each says which way things went from the numbers it's
// given, says so quietly under a few rounds, and never claims a direction the data doesn't hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSIGHT_MIN, hallInsight, statsInsight, tabInsight, trendInsight, waitText } from './data-insights.js';

const series = totals => totals.map((total, i) => ({ id: `r${i}`, t: i, amount: 0, total }));
const line = (name, rounds, won, lost, net = 0, moneyRounds = rounds) => ({
  key: name, name, rounds, record: { won, lost, even: rounds - won - lost }, dollars: { net, rounds: moneyRounds }, points: { net: 0, rounds: 0 },
});
const stats = (won, lost, even = 0, games = []) => ({ rounds: won + lost + even, record: { won, lost, even }, games });

test('waitText counts the rounds still needed in words', () => {
  assert.equal(waitText(0), 'Three more rounds and this starts to mean something.');
  assert.equal(waitText(2), 'One more round and this starts to mean something.');
  assert.equal(waitText(1, 5), '4 more rounds and this starts to mean something.');
});

test('the Tab waits under three rounds but still has a headline', () => {
  assert.deepEqual(tabInsight([]), { kind: 'wait', label: 'Early days', headline: 'Nothing on the line yet.', text: waitText(0) });
  const two = tabInsight(series([10, -5]));
  assert.equal(two.kind, 'wait');
  assert.equal(two.headline, 'Down this season.');
  assert.equal(two.text, 'One more round and this starts to mean something.');
  assert.equal(tabInsight(series([10, 0])).headline, 'Square this season.');
});

test('the Tab reads the climb over the last rounds against the season average', () => {
  const up = tabInsight(series([-10, 0, 20, 40, 45, 60, 80]), { window: 6 });
  assert.equal(up.kind, 'up');
  assert.equal(up.label, 'Trending up');
  assert.equal(up.headline, 'Up this season.');
  // From -10 (the point before the last six) to 80 is $90, and 80 beats the average
  assert.equal(up.text, 'Your net has climbed $90 over the last 6 rounds and is above your season average.');
  // Fewer rounds than the window: from zero
  const short = tabInsight(series([5, 10, 15]), { window: 6 });
  assert.equal(short.text, 'Your net has climbed $15 over the last 3 rounds and is above your season average.');
});

test('the Tab says slipped but still above when a lead is shrinking', () => {
  const s = series([20, 60, 100, 95, 90, 85, 80]);
  const r = tabInsight(s, { window: 3 });
  assert.equal(r.kind, 'down');
  assert.equal(r.headline, 'Up this season.');
  assert.equal(r.text, 'Your net has slipped $15 over the last 3 rounds but is still above your season average.');
  const low = tabInsight(series([0, -5, -10, -20]), { window: 2 });
  assert.equal(low.text, 'Your net has slipped $15 over the last 2 rounds and is below your season average.');
});

test('the Tab holds steady when nothing moved, and names the scope', () => {
  const r = tabInsight(series([10, 10, 10, 10]), { window: 3, scope: 'overall' });
  assert.equal(r.kind, 'flat');
  assert.equal(r.headline, 'Up overall.');
  assert.equal(r.text, 'Your net hasn’t moved over the last 3 rounds.');
  assert.match(tabInsight(series([0, 5, 9, 12]), { scope: 'overall' }).text, /overall average/);
});

test('your stats wait, then read the record and the best game', () => {
  assert.equal(statsInsight(stats(1, 1)).kind, 'wait');
  const nassau = line('Nassau', 4, 3, 1, 40);
  const skins = line('Skins', 3, 1, 2, -10);
  const win = statsInsight(stats(4, 2, 0, [skins, nassau]));
  assert.equal(win.kind, 'up');
  assert.equal(win.label, 'Winning record');
  assert.equal(win.text, 'You’ve won 4 of 6 rounds, and Nassau has been your best game, +$40 over 4 rounds.');
  const loss = statsInsight(stats(2, 4, 1, [nassau]));
  assert.equal(loss.kind, 'down');
  assert.equal(loss.text, 'You’ve lost 4 of 7 rounds, but Nassau has been your best game, +$40 over 4 rounds.');
  const even = statsInsight(stats(2, 2, 0, []));
  assert.equal(even.kind, 'flat');
  assert.equal(even.text, 'You’ve won 2 and lost 2 of 4 rounds.');
});

test('your stats read the best game by record when no money is ahead', () => {
  const wolf = line('Wolf', 3, 2, 1, 0, 0);
  const r = statsInsight(stats(3, 1, 0, [wolf]));
  assert.equal(r.text, 'You’ve won 3 of 4 rounds, and Wolf has been your best game, 2–1 over 3 rounds.');
  // Rounds with no result of your own (a Big Game with no money) say so instead of a record
  assert.equal(statsInsight({ rounds: 3, record: { won: 0, lost: 0, even: 0 }, games: [] }).text, '3 rounds played, none with a result of your own yet.');
});

test('the handicap trend reads the guide coming down or creeping up, with the official index', () => {
  const pts = g => g.map((guide, i) => ({ id: `r${i}`, t: i, guide }));
  const down = trendInsight({ points: pts([14.0, 13.6, 13.1, 12.8]), guide: 12.8, official: 13.6, rounds: 4 }, { window: 5 });
  assert.equal(down.kind, 'up');
  assert.equal(down.label, 'Coming down');
  assert.equal(down.text, 'Your guide has come down 1.2 over the last 3 rounds, and it’s 0.8 better than your official index.');
  const up = trendInsight({ points: pts([null, null, 12.0, 12.4, 12.9]), guide: 12.9, official: null, rounds: 5 });
  assert.equal(up.kind, 'down');
  assert.equal(up.text, 'Your guide has gone up 0.9 over the last 2 rounds.');
  const flat = trendInsight({ points: pts([12.4, 12.3, 12.5]), guide: 12.5, official: 12.3, rounds: 3 });
  assert.equal(flat.kind, 'flat');
  assert.equal(flat.text, 'Your guide has held at about 12.5 over the last 2 rounds, and it’s about the same as your official index.');
});

test('the handicap trend waits without a guide and names a first one', () => {
  assert.equal(trendInsight({ points: [], guide: null, official: null, rounds: 1 }).text, waitText(1));
  const first = trendInsight({ points: [{ id: 'r', t: 0, guide: 11.2 }], guide: 11.2, official: 12, rounds: 3 });
  assert.equal(first.label, 'First guide');
  assert.equal(first.text, 'Your first guide is 11.2, and it’s 0.8 better than your official index.');
});

test('the hall of fame names the leader, the gap and who is climbing', () => {
  const name = id => ({ t: 'Trevor', a: 'Adam', b: 'Ben' })[id];
  const season = { rounds: 5, champion: { id: 'a', cents: 4000 }, money: [{ id: 'a', cents: 4000 }, { id: 't', cents: 500 }, { id: 'b', cents: -4500 }] };
  const movers = { rounds: 3, rows: [{ id: 't', cents: 2000 }, { id: 'b', cents: -2000 }] };
  const me = hallInsight(season, movers, { me: 't', name });
  assert.equal(me.kind, 'up');
  assert.equal(me.label, 'Climbing');
  assert.equal(me.text, 'Adam leads you by $35, and you have climbed the most, +$20 over the last 3 rounds.');
  const lead = hallInsight(season, movers, { me: 'a', name });
  assert.equal(lead.label, 'In front');
  assert.equal(lead.text, 'You lead Trevor by $35, and Trevor has climbed the most, +$20 over the last 3 rounds.');
  const chasing = hallInsight(season, movers, { me: 'b', name });
  assert.equal(chasing.kind, 'down');
  assert.equal(chasing.label, 'Chasing');
  const outside = hallInsight(season, movers, { me: 'x', name });
  assert.equal(outside.kind, 'flat');
  assert.equal(outside.text, 'Adam leads Trevor by $35, and Trevor has climbed the most, +$20 over the last 3 rounds.');
});

test('the hall of fame says still climbing for a leader who keeps gaining, and waits early', () => {
  const name = id => ({ t: 'Trevor', a: 'Adam' })[id];
  const season = { rounds: 4, champion: { id: 'a', cents: 4000 }, money: [{ id: 'a', cents: 4000 }, { id: 't', cents: -4000 }] };
  const r = hallInsight(season, { rounds: 2, rows: [{ id: 'a', cents: 1500 }, { id: 't', cents: -1500 }] }, { me: 't', name });
  assert.equal(r.text, 'Adam leads you by $80, still climbing at +$15 over the last 2 rounds.');
  assert.equal(hallInsight({ rounds: 2, champion: null, money: [] }).kind, 'wait');
  assert.equal(hallInsight({ rounds: INSIGHT_MIN, champion: null, money: [{ id: 'a', cents: 0 }] }).text, 'Nobody is up after 3 rounds.');
  const level = hallInsight({ rounds: 3, champion: { id: 'a', cents: 1000 }, money: [{ id: 'a', cents: 1000 }, { id: 't', cents: 1000 }] }, { rounds: 0, rows: [] }, { me: 't', name });
  assert.equal(level.text, 'Adam and you are level at the top.');
});

test('no insight sentence carries an exclamation mark or an em dash', () => {
  const all = [
    tabInsight(series([-10, 0, 20, 40])), statsInsight(stats(4, 2, 0, [line('Nassau', 4, 3, 1, 40)])),
    trendInsight({ points: [{ guide: 14 }, { guide: 13 }], guide: 13, official: 14, rounds: 2 }),
    hallInsight({ rounds: 3, champion: { id: 'a', cents: 100 }, money: [{ id: 'a', cents: 100 }] }, { rounds: 1, rows: [{ id: 'a', cents: 100 }] }, { me: 'a' }),
  ];
  const banned = new RegExp(`[!${String.fromCharCode(0x2014)}]`);
  for (const i of all) {
    assert.doesNotMatch(i.text, banned);
    assert.doesNotMatch(i.label, banned);
  }
});
