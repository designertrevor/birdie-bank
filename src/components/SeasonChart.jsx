import { money } from '../lib/golf.js';
import { BOX, axisFor, labelIndexes, pathOf, pointsOn, showDots, yOf } from '../lib/chart-axis.js';

const { w: W, h: H, padR, padB } = BOX;
const shortDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const tick = v => (v ? money(v) : '0');

/**
 * Your running net across a range of rounds, as a thin line over a dotted zero line, with three
 * amounts down the right (low, middle, high), the rounds' dates along the bottom, a small dot on
 * each round and a brighter one on the last. `series` is netSeries(): [{ id, t, amount, total }],
 * oldest first. Rounds are spaced evenly, so a busy week doesn't squash into one point; past a
 * couple of dozen rounds the dots go and the line speaks. Colours come from the theme tokens, so
 * it reads in light and dark. The maths is chart-axis.js, tested there.
 */
export function SeasonChart({ series, label }) {
  if (!series.length) return null;
  const totals = [0, ...series.map(p => p.total)];
  const axis = axisFor(totals, { include: 0 });
  const pts = pointsOn(totals, axis);
  const line = pathOf(pts);
  const zero = yOf(0, axis);
  const area = `${line} L${pts.at(-1).x.toFixed(1)} ${zero.toFixed(1)} L${pts[0].x.toFixed(1)} ${zero.toFixed(1)} Z`;
  const end = totals.at(-1);
  const tone = end > 0 ? 'up' : end < 0 ? 'down' : 'flat';
  const best = Math.max(...series.map(p => p.total)), worst = Math.min(...series.map(p => p.total));
  const summary = `${label}: your net over ${series.length} round${series.length === 1 ? '' : 's'} ended at ${money(end, { sign: true })}. High ${money(best, { sign: true })}, low ${money(worst, { sign: true })}.`;
  const last = pts.at(-1);
  const dots = showDots(totals.length);
  // The first point is the start (nothing on the line yet), so the dates label the rounds after it
  const days = labelIndexes(series.length, 4).map(i => ({ x: pts[i + 1].x, text: shortDay(series[i].t) }))
    .filter((d, i, arr) => !i || d.text !== arr[i - 1].text);
  return (
    <svg className={`season-chart ${tone}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      <line className="chart-zero" x1={0} x2={W - padR + 6} y1={zero} y2={zero} vectorEffect="non-scaling-stroke" />
      <path className="chart-area" d={area} />
      <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />
      {dots && pts.slice(1, -1).map((p, i) => <circle key={series[i].id} className="chart-dot pt" cx={p.x} cy={p.y} r={2.5} />)}
      <circle className="chart-dot last" cx={last.x} cy={last.y} r={4} />
      <g className="chart-axis" aria-hidden="true">
        {axis.ticks.map(v => <text key={v} x={W - 2} y={yOf(v, axis)} dy=".35em" textAnchor="end">{tick(v)}</text>)}
        {days.map(d => <text key={d.x} x={d.x} y={H - padB + 16} textAnchor={d.x < 30 ? 'start' : d.x > W - padR - 30 ? 'end' : 'middle'}>{d.text}</text>)}
      </g>
    </svg>
  );
}
