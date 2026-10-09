// The end-of-round race: everyone's total counts up from zero on the reveal, and the leaderboard
// rows reorder as the totals pass each other, so the Ball buddies on them race up the board and
// the winner lands on top last. Pure: the reveal (Finale.jsx) asks for a frame at the time since
// it opened and draws it; the tests ask for the whole run of orders.

/** The count's easing: fast off the line, settling into the final amount. */
export const easeOut = k => 1 - Math.pow(1 - k, 3);

/**
 * The race for a set of results. `standings` is res.standings (best first, the order the board
 * ends in); `start` is the order the rows line up in before anything counts (the round's players,
 * so the start gives nothing away). Timing is revealTiming's: the totals start at `stepsEnd`, the
 * last place first and the winner last, `stagger` apart, each counting for `count` ms.
 * Returns { lanes, end }: each lane is { id, amount, delay, duration, start, final }.
 */
export function racePlan(standings, { start = null, stepsEnd = 0, stagger = 0, count = 1000 } = {}) {
  const n = standings.length;
  const ids = standings.map(p => p.id);
  // The start order: the given ids that are on the board, then anyone it left out
  const line = [...(start || []).filter(id => ids.includes(id)), ...ids.filter(id => !(start || []).includes(id))];
  const lanes = standings.map((p, i) => ({
    id: p.id, amount: p.amount, delay: stepsEnd + (n - 1 - i) * stagger, duration: count,
    start: line.indexOf(p.id), final: i,
  }));
  const end = lanes.reduce((m, l) => Math.max(m, l.delay + l.duration), 0);
  return { lanes, end };
}

/** How far one lane's count has got at `t` ms: 0 before its turn, 1 once it has landed. */
function progress(lane, t) {
  if (t >= lane.delay + lane.duration) return 1;
  return Math.min(1, Math.max(0, (t - lane.delay) / lane.duration));
}

/**
 * The board at `t` ms after the reveal opened (Infinity for the end, as a skip or reduced motion
 * shows it). Returns { order, rows, done }: `order` is the ids top to bottom, and each row (by id)
 * is { value, shown, phase, place }. `value` is the exact count so far and decides the order;
 * `shown` is what the row prints: whole numbers while counting, then the exact amount; `phase` is
 * 'wait', 'count' or 'done'; `place` shares a number on equal totals, and is null while a row
 * hasn't started counting. Rows level on the same value keep their start order until they have
 * all landed, then take the results' order, so the last frame is res.standings exactly.
 */
export function raceFrame(plan, t) {
  const rows = {};
  for (const l of plan.lanes) {
    const k = progress(l, t);
    const done = k >= 1;
    // Exactly the amount once landed; the eased count before (0 stays 0, never −0)
    const value = done ? l.amount : l.amount * easeOut(k) || 0;
    const phase = done ? 'done' : t >= l.delay ? 'count' : 'wait';
    rows[l.id] = { value, shown: done ? l.amount : Math.round(value) || 0, phase, place: null };
  }
  // A level group sorts by the results once everyone in it has landed
  const landed = new Map();
  for (const l of plan.lanes) {
    const v = rows[l.id].value;
    landed.set(v, (landed.get(v) ?? true) && rows[l.id].phase === 'done');
  }
  const lanes = [...plan.lanes].sort((a, b) => {
    const va = rows[a.id].value, vb = rows[b.id].value;
    if (va !== vb) return vb - va;
    return landed.get(va) ? a.final - b.final : a.start - b.start;
  });
  for (const l of plan.lanes) {
    if (rows[l.id].phase === 'wait') continue;
    const v = rows[l.id].value;
    rows[l.id].place = 1 + plan.lanes.filter(o => rows[o.id].value > v).length;
  }
  return { order: lanes.map(l => l.id), rows, done: t >= plan.end };
}

/**
 * Every order the board passes through, sampled every `step` ms: [{ at, order }], starting with the
 * line-up and ending with the results' order. What the tests check, and a picture of the race.
 */
export function raceOrders(plan, { step = 16 } = {}) {
  const out = [{ at: 0, order: raceFrame(plan, 0).order }];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  for (let t = step; t < plan.end + step; t += step) {
    const { order } = raceFrame(plan, Math.min(t, plan.end));
    if (!same(order, out.at(-1).order)) out.push({ at: Math.min(t, plan.end), order });
  }
  return out;
}

/** Who passed whom between two orders: the ids that moved up, for the little hop as they go by. */
export function movedUp(before, after) {
  return after.filter((id, i) => before.indexOf(id) > i);
}
