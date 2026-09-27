import { money } from '../lib/golf.js';

const W = 320, H = 120, PAD_X = 6, PAD_Y = 12;

/**
 * Your running net across a range of rounds, as a small line over a zero line.
 * `series` is netSeries(): [{ id, t, amount, total }], oldest first. Rounds are spaced evenly,
 * so a busy week doesn't squash into one point. Colours come from the theme tokens, so it
 * reads in light and dark.
 */
export function SeasonChart({ series, label }) {
  if (!series.length) return null;
  const totals = [0, ...series.map(p => p.total)];
  const hi = Math.max(0, ...totals), lo = Math.min(0, ...totals);
  const span = hi - lo || 1;
  const x = i => PAD_X + (i * (W - PAD_X * 2)) / (totals.length - 1);
  const y = v => PAD_Y + ((hi - v) * (H - PAD_Y * 2)) / span;
  const pts = totals.map((v, i) => [x(i), y(v)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const zero = y(0);
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${zero.toFixed(1)} L${pts[0][0].toFixed(1)} ${zero.toFixed(1)} Z`;
  const end = totals.at(-1);
  const tone = end > 0 ? 'up' : end < 0 ? 'down' : 'flat';
  const best = Math.max(...series.map(p => p.total)), worst = Math.min(...series.map(p => p.total));
  const summary = `${label}: your net over ${series.length} round${series.length === 1 ? '' : 's'} ended at ${money(end, { sign: true })}. High ${money(best, { sign: true })}, low ${money(worst, { sign: true })}.`;
  const [lx, ly] = pts.at(-1);
  return (
    <svg className={`season-chart ${tone}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      <line className="chart-zero" x1={0} x2={W} y1={zero} y2={zero} vectorEffect="non-scaling-stroke" />
      <path className="chart-area" d={area} />
      <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />
      <circle className="chart-dot" cx={lx} cy={ly} r={4} />
    </svg>
  );
}
