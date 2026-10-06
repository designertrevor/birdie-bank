import { formatIndex } from '../lib/format.js';

const W = 320, H = 96, PAD_X = 6, PAD_Y = 12;

/**
 * Your handicap guide after each round (hc-trend.js handicapTrend points), as a small line in the
 * season chart's style, with the official index you entered as a dashed line when there is one.
 * Rounds are spaced evenly. Only the points with a guide (from the third round on) are drawn.
 */
export function TrendChart({ points, official = null }) {
  const vals = points.filter(p => p.guide != null).map(p => p.guide);
  if (!vals.length) return null;
  const all = official == null ? vals : [...vals, official];
  const hi = Math.max(...all), lo = Math.min(...all);
  const span = hi - lo || 1;
  const x = i => (vals.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (vals.length - 1));
  const y = v => (hi === lo ? H / 2 : PAD_Y + ((hi - v) * (H - PAD_Y * 2)) / span);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const first = vals[0], end = vals.at(-1);
  const summary = `Your guide over ${vals.length} round${vals.length === 1 ? '' : 's'}: from ${formatIndex(first)} to ${formatIndex(end)}${official == null ? '' : `, against an official index of ${formatIndex(official)}`}.`;
  // A lower guide is the better way to go
  const tone = end < first - 0.05 ? 'up' : end > first + 0.05 ? 'down' : 'flat';
  const [lx, ly] = pts.at(-1);
  return (
    <svg className={`season-chart trend-chart ${tone}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      {official != null && <line className="chart-zero" x1={0} x2={W} y1={y(official)} y2={y(official)} vectorEffect="non-scaling-stroke" />}
      {vals.length > 1 && <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />}
      <circle className="chart-dot" cx={lx} cy={ly} r={4} />
    </svg>
  );
}
