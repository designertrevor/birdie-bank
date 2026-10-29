// The money sheet's hole by hole (useMoneyStrip.jsx).
import { holeComplete, roundResults } from '../../lib/round.js';

/**
 * Each scored hole's money, in playing order: everyone's totals with the holes up to it, less the
 * totals before it (so a carried skin lands on the hole that won it). Display only: the money comes
 * from roundResults, as everywhere else.
 */
function holeByHole(full) {
  const rows = [];
  const kept = {};
  let before = {};
  for (const h of full.holes) {
    if (!holeComplete(full, h)) continue;
    kept[h.no] = full.scores[h.no];
    const now = roundResults({ ...full, scores: { ...kept } }).balances;
    rows.push({ hole: h, d: Object.fromEntries(Object.keys(now).map(id => [id, Math.round(((now[id] || 0) - (before[id] || 0)) * 100) / 100])) });
    before = now;
  }
  return rows;
}

/** The money sheet's hole by hole: a row per scored hole, what each player won or lost on it. */
export function HoleByHole({ full, players, fmt }) {
  const rows = holeByHole(full);
  if (!rows.length) return null;
  return (
    <>
      <h2 className="sec-label">Hole by hole</h2>
      <div className="money-table-wrap ms-holes">
        <table className="sc-table money-table">
          <thead><tr><th style={{ textAlign: 'left', paddingLeft: 12 }}>Hole</th>{players.map(p => <th key={p.id}>{p.name.split(' ')[0]}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.hole.no}>
                <td>{r.hole.no}</td>
                {players.map(p => { const v = r.d[p.id] || 0; return <td key={p.id} className={v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}>{v ? fmt(v, { sign: true }) : '–'}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
