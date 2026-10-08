// The maths the small charts share (SeasonChart.jsx, TrendChart.jsx): an axis that lands on round
// numbers with three labels down the right (low, middle, high), where each point sits in the box,
// which bottom labels fit, and when there are too many points for a dot each. Pure, so it's tested
// here and the components only draw.

/** A step that reads well: 1, 2 or 5 times a power of ten, so the axis labels are round numbers. */
export function niceStep(span, parts = 2) {
  const raw = Math.abs(span || 1) / parts;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return round(m * mag);
}

// Steps like 0.5 drift in floating point, so every tick is settled to six places
const round = v => Number(v.toFixed(6));

/**
 * The axis for some values: { lo, hi, ticks } with the domain stretched to round numbers either
 * side and three ticks (low, middle, high) that are round numbers too. `include` is a value the
 * domain must hold (zero for money, the official index for the handicap guide). A flat set of
 * values gets a step of air either side, so the line sits in the middle instead of on an edge.
 */
export function axisFor(values, { include = null } = {}) {
  const all = include == null ? values : [...values, include];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) { lo -= 1; hi += 1; }
  // Three parts, so the line fills the box instead of sitting in half of it
  const step = niceStep(hi - lo, 3);
  let min = round(Math.floor(lo / step) * step);
  let max = round(Math.ceil(hi / step) * step);
  // An odd number of steps has no middle tick on a round number, so the tight side gets one more
  if (Math.round((max - min) / step) % 2) {
    if (lo - min <= max - hi) min = round(min - step); else max = round(max + step);
  }
  return { lo: min, hi: max, ticks: [min, round((min + max) / 2), max] };
}

/** The drawing box the charts share: the SVG size and the room kept for labels. */
export const BOX = { w: 320, h: 132, padL: 6, padR: 42, padT: 10, padB: 22 };

/**
 * Where a value sits on the y axis of `box`. The chart goes up with the value unless `invert`, which
 * the handicap guide uses: a lower index is better, so better goes up the chart like the money.
 */
export function yOf(v, axis, box = BOX, invert = false) {
  const span = axis.hi - axis.lo || 1;
  const inner = box.h - box.padT - box.padB;
  const share = invert ? (v - axis.lo) / span : (axis.hi - v) / span;
  return round(box.padT + share * inner);
}

/** Where the i-th of n points sits on the x axis: spaced evenly, and a lone point in the middle. */
export function xOf(i, n, box = BOX) {
  const inner = box.w - box.padL - box.padR;
  if (n <= 1) return round(box.padL + inner / 2);
  return round(box.padL + (i * inner) / (n - 1));
}

/** Every point's place: [{ x, y }], oldest first. */
export function pointsOn(values, axis, box = BOX, invert = false) {
  return values.map((v, i) => ({ x: xOf(i, values.length, box), y: yOf(v, axis, box, invert) }));
}

/** The SVG path through some points. */
export function pathOf(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * Which of n points get a label along the bottom: all of them up to `max`, otherwise the first, the
 * last and a few spaced evenly between, so the labels never crowd.
 */
export function labelIndexes(n, max = 5) {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  return [...new Set(Array.from({ length: max }, (_, i) => Math.round(i * step)))];
}

/** A dot on every point reads up to this many; past it only the last point gets one. */
export const DOT_MAX = 24;
export const showDots = n => n <= DOT_MAX;
