// The Tab's money check (overhaul, 2026-10-26): the two sections, "Owes you" and "You owe", show
// exactly what the Tab's own functions have between you and each person. A seeded sweep of random
// rounds and payments, then the rules: same amount per person as tabWith(outstanding()), the
// totals' difference is your net, nobody on both sides, square people on neither, whole cents, and
// money that isn't dollars (points, rewards) never shows an amount. Plus a guard that Paid and
// Roll to next time still call the same functions with the same arguments as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRound } from './round.js';
import { headToHeadSummary, outstanding, tabBalances, tabWith } from './ledger.js';
import { canonicalOf } from './pair-debts.js';
import { myIds } from './format.js';
import { tabSections, tabSummary } from './tab-sections.js';

const SETTINGS = {
  hcPct: 100,
  skins: { value: 2, carryover: true },
  stroke: { stake: 5, payout: 'pot' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'off', threshold: 2 },
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
};
const course = { id: 'c', name: 'Course', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: [4, 3, 5][i % 3], hdcp: i + 1 })) };
const POOL = ['mike', 'dave', 'jack', 'sam', 'lee'];
const isWholeCents = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const c = v => Math.round(v * 100);

/** A random finished round: 2 to 4 players, usually with you in it, sometimes in a seat of your own. */
function randomRound(rnd, i) {
  const n = 2 + Math.floor(rnd() * 3);
  const withMe = rnd() < 0.85;
  const seat = withMe && rnd() < 0.15 ? `seat${i}` : 'me';
  const others = [...POOL].sort(() => rnd() - 0.5).slice(0, withMe ? n - 1 : n);
  const ids = withMe ? [seat, ...others] : others;
  const game = ids.length === 2 && rnd() < 0.3 ? 'nassau' : rnd() < 0.5 ? 'skins' : 'stroke';
  const r = createRound({ id: `r${i}`, game, course, holesCount: 9, players: ids.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), index: 0 })), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(id => [id, h.par - 1 + Math.floor(rnd() * 4)]));
  r.status = 'done';
  r.finishedAt = 1000 + i;
  if (seat !== 'me') r.localMe = seat;
  // Some rounds aren't for money: points, or a reward (lunch), which never put dollars on the Tab
  const kind = rnd();
  if (kind < 0.1) r.playFor = { kind: 'points' };
  else if (kind < 0.2) r.playFor = { kind: 'reward', reward: 'Lunch', owes: 'last' };
  return r;
}

/** 30+ seeded states: random rounds, then random payments, some of them squaring a person exactly. */
function* states(count = 40) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < count; k++) {
    const rounds = {};
    const nRounds = 1 + Math.floor(rnd() * 8);
    for (let i = 0; i < nRounds; i++) { const r = randomRound(rnd, k * 10 + i); rounds[r.id] = r; }
    const state = { me: 'me', players: {}, rounds, settlements: [] };
    const plan = outstanding(state);
    for (const [j, t] of plan.entries()) {
      const roll = rnd();
      // Pay a line in full (that person goes square), part of it, or leave it
      if (roll < 0.3) state.settlements.push({ id: `s${k}-${j}`, from: t.from, to: t.to, amount: t.amount, at: 2000 + j });
      else if (roll < 0.5) state.settlements.push({ id: `s${k}-${j}`, from: t.from, to: t.to, amount: Math.round(t.amount * 100 * rnd()) / 100, at: 2000 + j });
    }
    yield state;
  }
}

test('tab sections: every person shows what the Tab has between you, on one side only', () => {
  let n = 0, both = 0, square = 0, rewards = 0;
  for (const state of states(80)) {
    n++;
    const now = 10_000;
    const plan = outstanding(state, { now });
    const mine = myIds(state);
    const s = tabSections(state, { now, plan, mine });
    const ids = list => list.map(p => p.id);

    // 1. Each person's amount is the existing function's amount, to the cent, on the right side
    for (const p of s.owesYou) assert.equal(c(p.net), c(tabWith(plan, mine, p.id)), `owes you: ${p.id}`);
    for (const p of s.youOwe) assert.equal(c(p.net), c(tabWith(plan, mine, p.id)), `you owe: ${p.id}`);
    assert.ok(s.owesYou.every(p => p.net > 0) && s.youOwe.every(p => p.net < 0));

    // 2. Nobody on both sides, and everyone the plan has money with you for is on one of them
    const owes = new Set(ids(s.owesYou)), owe = new Set(ids(s.youOwe));
    assert.ok(![...owes].some(id => owe.has(id)), 'somebody is on both sides');
    const withMe = new Set(plan.filter(t => mine.has(t.from) !== mine.has(t.to)).map(t => (mine.has(t.from) ? t.to : t.from)));
    for (const id of withMe) {
      const v = c(tabWith(plan, mine, id));
      if (v) assert.ok(owes.has(id) || owe.has(id), `${id} has ${v} cents on the Tab but isn't listed`);
    }
    if (s.owesYou.length && s.youOwe.length) both++;

    // 3. The totals: owes you minus you owe is your net, the plan's own and the balances' too
    assert.equal(c(s.owedToYou) - c(s.youOweTotal), c(s.net));
    const planNet = plan.reduce((a, t) => a + (mine.has(t.to) && !mine.has(t.from) ? c(t.amount) : mine.has(t.from) && !mine.has(t.to) ? -c(t.amount) : 0), 0);
    assert.equal(c(s.net), planNet, 'net is the plan’s lines with you');
    const who = canonicalOf(state);
    const bal = tabBalances(state, { now });
    const balNet = [...new Set([...mine].map(who))].reduce((a, id) => a + c(bal[id] || 0), 0);
    // The plan works in whole cents from the balances (fewestPayments): a split pot's spare cent can move
    assert.ok(Math.abs(c(s.net) - balNet) <= 1, `net ${c(s.net)} v balances ${balNet}`);

    // 4. Square people show in neither section, and the Tab has nothing between you
    for (const id of [...s.squareIds, ...s.recentSquare.map(x => x.id)]) {
      square++;
      assert.ok(!owes.has(id) && !owe.has(id), `${id} is square but listed`);
      assert.equal(c(tabWith(plan, mine, id)), 0, `${id} is square but owes`);
    }
    // Everyone you played with is somewhere: a section, square, or a reward of their own
    for (const id of headToHeadSummary(state, mine).keys()) {
      assert.ok(owes.has(id) || owe.has(id) || s.squareIds.includes(id) || s.recentSquare.some(x => x.id === id) || s.rewardOnly.includes(id), `${id} is missing`);
    }

    // 5. Whole cents everywhere
    for (const v of [s.owedToYou, s.youOweTotal, s.net, ...s.owesYou.map(p => p.net), ...s.youOwe.map(p => p.net)]) assert.ok(isWholeCents(v), `${v} isn't whole cents`);

    // 6. Money that isn't dollars never shows an amount: a reward-only person is an id, nothing more
    for (const id of s.rewardOnly) {
      rewards++;
      assert.equal(typeof id, 'string');
      assert.ok(!owes.has(id) && !owe.has(id));
    }

    // The summary card reads the same totals
    const sum = tabSummary(s, id => id);
    if (s.owesYou.length) assert.equal(c(sum.lead.amount), c(s.owedToYou));
    else if (s.youOwe.length) assert.equal(c(sum.lead.amount), c(s.youOweTotal));
    else assert.equal(sum.lead, null);
    if (sum.sub) assert.equal(c(sum.sub.amount), c(s.youOweTotal));
  }
  assert.ok(n >= 30, 'at least 30 seeded states');
  // The sweep reached the interesting cases
  assert.ok(both >= 3, `some states have people on both sides (${both})`);
  assert.ok(square > 0, 'some states have square people');
  assert.ok(rewards > 0, "some states have a reward with someone square on money");
});

test('tab sections: points and reward rounds add no amount to anyone', () => {
  for (const state of states(30)) {
    const money = { ...state, rounds: Object.fromEntries(Object.entries(state.rounds).filter(([, r]) => !r.playFor)) };
    const a = tabSections(state, { now: 10_000 });
    const b = tabSections(money, { now: 10_000 });
    const amounts = s => Object.fromEntries([...s.owesYou, ...s.youOwe].map(p => [p.id, c(p.net)]));
    assert.deepEqual(amounts(a), amounts(b), 'a points or lunch round moved money');
  }
});

test('tab sections: all square, and nothing played', () => {
  assert.deepEqual(tabSections({ me: 'me', players: {}, rounds: {}, settlements: [] }).owesYou, []);
  const state = [...states(40)].find(s => outstanding(s).length);
  const paid = { ...state, settlements: [...state.settlements, ...outstanding(state).map((t, i) => ({ id: `all${i}`, from: t.from, to: t.to, amount: t.amount, at: 9000 + i }))] };
  const s = tabSections(paid, { now: 10_000 });
  assert.equal(s.owesYou.length + s.youOwe.length, 0);
  assert.equal(s.net, 0);
});

// Paid and Roll to next time on a person card: the same calls with the same arguments as before
// the overhaul (TabCard.jsx PersonActions), and the Tab hands each card the section's net
test('person card: Paid and Roll call the same functions with the same arguments', () => {
  const src = fs.readFileSync(new URL('../components/TabCard.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const owed = net ? (owesMe ? { from: other, to: meId, amount } : { from: meId, to: other, amount }) : null;'), 'what Paid pays is built the same way');
  assert.ok(src.includes('const { shared } = markPaid(owed);'), 'Paid records markPaid(owed)');
  assert.ok(src.includes('const shared = owed ? sharedOwed(state, meId, other) : null;'), 'Roll covers the shared rounds, as before');
  assert.ok(src.includes('if (shared && askCarry({ ...shared, by: meId, reason })) showToast(`Asked ${first}`);'), 'Roll asks askCarry with the same fields');
  assert.ok(src.includes("const canRoll = !off && !carry && !!owed && !!shared && who(shared.from) === who(owed.from);"), 'Roll shows in the same cases');
  assert.ok(src.includes('{ label: \'Undo\', run: () => undoLastPayment(meId, other) }'), 'Paid’s undo is the same');
  const tab = fs.readFileSync(new URL('../screens/Ledger.jsx', import.meta.url), 'utf8');
  assert.ok(tab.includes('<PersonActions other={p.id} net={p.net} meId={state.me || me} />'), 'the Tab passes the section’s net and the same meId');
  assert.ok(tab.includes("const me = owesMe ? p.debts[0].to : p.debts[0].from;"), 'meId falls back the same way');
});
