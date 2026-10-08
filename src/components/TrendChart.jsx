import { formatIndex } from '../lib/format.js';
import { BOX, axisFor, labelIndexes, pathOf, pointsOn, showDots, yOf } from '../lib/chart-axis.js';

const { w: W, h: H, padR, padB } = BOX;
const shortDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Your handicap guide after each round (hc-trend.js handicapTrend points), in the season chart's
 * style: a thin line with a dot on each round and a brighter one on the last, three index values
 * down the right, the rounds' dates along the bottom, and the official index you entered as the
 * dotted baseline when there is one. Rounds are spaced evenly. Only the points with a guide (from
 * the third round on) are drawn. The maths is chart-axis.js, tested there.
 */
export function TrendChart({ points, official = null }) {
  const shown = points.filter(p => p.guide != null);
  const vals = shown.map(p => p.guide);
  if (!vals.length) return null;
  const axis = axisFor(vals, { include: official });
  // Upside down on purpose: a lower handicap is better, so better goes up the chart, like the money
  const pts = pointsOn(vals, axis, BOX, true);
  const line = pathOf(pts);
  const first = vals[0], end = vals.at(-1);
  const summary = `Your guide over ${vals.length} round${vals.length === 1 ? '' : 's'}: from ${formatIndex(first)} to ${formatIndex(end)}${official == null ? '' : `, against an official index of ${formatIndex(official)}`}.`;
  // A lower guide is the better way to go
  const tone = end < first - 0.05 ? 'up' : end > first + 0.05 ? 'down' : 'flat';
  const last = pts.at(-1);
  const dots = showDots(vals.length);
  const days = labelIndexes(shown.length, 4).map(i => ({ x: pts[i].x, text: shortDay(shown[i].t) }))
    .filter((d, i, arr) => !i || d.text !== arr[i - 1].text);
  return (
    <svg className={`season-chart trend-chart ${tone}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      {official != null && <line className="chart-zero" x1={0} x2={W - padR + 6} y1={yOf(official, axis, BOX, true)} y2={yOf(official, axis, BOX, true)} vectorEffect="non-scaling-stroke" />}
      {vals.length > 1 && <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />}
      {dots && pts.slice(0, -1).map((p, i) => <circle key={shown[i].id} className="chart-dot pt" cx={p.x} cy={p.y} r={2.5} />)}
      <circle className="chart-dot last" cx={last.x} cy={last.y} r={4} />
      <g className="chart-axis" aria-hidden="true">
        {axis.ticks.map(v => <text key={v} x={W - 2} y={yOf(v, axis, BOX, true)} dy=".35em" textAnchor="end">{formatIndex(v)}</text>)}
        {days.map(d => <text key={d.x} x={d.x} y={H - padB + 16} textAnchor={d.x < 30 ? 'start' : d.x > W - padR - 30 ? 'end' : 'middle'}>{d.text}</text>)}
      </g>
    </svg>
  );
}
