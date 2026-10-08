// The gross scorecard, one column per hole: on a round's results, in the halfway sheet and the
// round menu while playing, and on a friend's round you're following. Its own file, so the play
// screen loads it without the whole results screen.
import { BuddyArt } from './BuddyArt.jsx';
import { bettingRound, cardOnly, holeComplete, isJustPlaying, isTeamGame, netFor, oneBall, playsHole, popsFor, scoreSummary, scorers, teamTable } from '../lib/round.js';
import { halfStrokesOn, netText, strokesWords } from '../lib/allowances.js';
import { strokeKey } from '../lib/stroke-key.js';
import { getsStrokes, toParOf, toParText, toParTone, toParWords } from '../lib/to-par.js';

/**
 * Gross scorecard, one column per hole. onHole makes columns tappable. Under each name, the
 * player's running to par (+3, E, −1) on the holes they've scored, and net too when anyone gets
 * strokes, so it shows without scrolling the card sideways.
 */
export function Scorecard({ round, current, onHole, holes = null }) {
  // `holes`: a part of the round (the halfway sheet's first nine); strokes still fall as the whole round deals them
  const out = holes || round.holes;
  const cls = (g, par) => (g === 'X' ? 'pu' : g <= par - 2 ? 'eagle' : g === par - 1 ? 'birdie' : g === par + 1 ? 'bogey' : g >= par + 2 ? 'dbl' : '');
  const hc = !!round.useHandicaps;
  const units = scorers(round);
  // Someone just playing gets no strokes: they're in no game (just-playing.js)
  const casual = p => isJustPlaying(round, p.id);
  const solo = cardOnly(round);
  const anyStrokes = hc && units.some(p => !casual(p) && out.some(h => popsFor(round, p, h) !== 0));
  // With half strokes each dot counts half, and the net total can end in ½
  const half = halfStrokesOn(round);
  // The dots are the main game's; a side game with its own % or half strokes gets its own key line
  const key = hc ? strokeKey(round) : { dots: '', lines: [] };
  // With onHole (during play), any cell in a hole's column jumps to that hole
  const colProps = no => (onHole ? { onClick: () => onHole(no), className: 'sc-tap' } : {});
  const netTotal = p => out.reduce((a, h) => { const n = holeComplete(round, h) ? netFor(round, p, h) : null; return n == null ? a : a + n; }, 0);
  // Best ball and Shamble: a row per team with its score on each hole, and the scores that made it underlined
  const tt = isTeamGame(round.game) && !oneBall(round.game) && round.teams?.length === 2 ? teamTable(bettingRound(round)) : null;
  const countedOn = (k, pid) => !!tt && tt.rows[k].counted.some(list => list.includes(pid));
  return (
    <div className="sc-wrap">
      <table className="sc-table scorecard">
        <thead>
          <tr>
            <th className="sticky">Hole</th>
            {out.map(h => (
              <th key={h.no} className={h.no === current ? 'cur' : ''}>
                {onHole
                  ? <button className="sc-col-btn" onClick={() => onHole(h.no)} aria-label={`Go to hole ${h.no}${round.holeFixes?.[h.no] ? ', fixed for this round' : ''}`}>{h.no}{round.holeFixes?.[h.no] && <span className="sc-fixed" aria-hidden="true" />}</button>
                  : <>{h.no}{round.holeFixes?.[h.no] && <><span className="sc-fixed" aria-hidden="true" /><span className="sr-only">, fixed</span></>}</>}
              </th>
            ))}
            <th>Tot</th>
            {anyStrokes && <th>Net</th>}
          </tr>
          <tr className="par-row"><td className="sticky">Par</td>{out.map(h => <td key={h.no} {...colProps(h.no)}>{h.par}</td>)}<td>{holes ? out.reduce((a, h) => a + (h.par || 0), 0) : round.par}</td>{anyStrokes && <td />}</tr>
          {hc && <tr className="hcp-row"><td className="sticky">HCP</td>{out.map(h => <td key={h.no} {...colProps(h.no)}>{h.hdcp ?? '–'}</td>)}<td />{anyStrokes && <td />}</tr>}
        </thead>
        <tbody>
          {units.map(p => {
            // Totals and to par over the holes shown, so a part of the round never counts holes past it
            const sum = scoreSummary(round, p.id, out);
            // Net under the name only for someone who gets strokes: "E net E" says nothing
            const showNet = anyStrokes && !casual(p) && getsStrokes(round, p);
            const par = toParOf(round, p, { withNet: showNet, holes: out });
            return (
              <tr key={p.id}>
                <td className="sticky">
                  <span className="sc-name">{p.team ? p.name : p.name.split(' ')[0]}</span>
                  {casual(p) && !solo && <span className="sc-jp">Just playing</span>}
                  {par.played > 0 && (
                    <span className="sc-topar">
                      <span className={`sc-par ${toParTone(par.gross)}`} role="img" aria-label={showNet ? `Gross ${toParWords(par.gross)}` : toParWords(par.gross)}>{toParText(par.gross)}</span>
                      {showNet && <span className={`sc-par net ${toParTone(par.net)}`} role="img" aria-label={`Net ${toParWords(par.net)}`}>net {toParText(par.net)}</span>}
                    </span>
                  )}
                </td>
                {out.map((h, k) => {
                  const g = round.scores[h.no]?.[p.id];
                  // A player who left shows an en dash on the holes after
                  // (an alternate shot or Chapman team needs both partners there, see scorers)
                  const gone = g == null && !(p.team ? scorers(round, h).some(u => u.id === p.id) : playsHole(round, p.id, h));
                  const st = hc && !gone && !casual(p) ? popsFor(round, p, h) : 0;
                  const tap = colProps(h.no);
                  return (
                    <td key={h.no} className={`${h.no === current ? 'cur' : ''} ${tap.className || ''}`} onClick={tap.onClick}>
                      <span className="sc-cell">
                        {gone ? <span className="empty-dot">–</span> : g == null ? <span className="empty-dot">·</span> : <span className={`sc-mark ${cls(g, h.par)} ${countedOn(k, p.id) ? 'sc-counts' : ''}`}>{g}</span>}
                        {st > 0 && <span className="sc-strokes" role="img" aria-label={`Gets ${strokesWords(st, half)}`}>{Array.from({ length: st }, (_, i) => <i key={i} />)}</span>}
                        {st < 0 && <span className="sc-strokes give" role="img" aria-label={`Gives back ${strokesWords(-st, half)}`}>{'–'.repeat(-st)}</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="tot">{sum.played ? sum.gross : '–'}</td>
                {anyStrokes && <td className="tot">{sum.played ? netText(netTotal(p)) : '–'}</td>}
              </tr>
            );
          })}
          {tt && round.teams.map((t, i) => {
            const played = tt.rows.filter(r => r.scores[i] != null);
            return (
              <tr key={t.id} className="sc-team-row">
                <td className="sticky">
                  <span className="sc-name">{t.name}</span>
                  <span className="sc-topar"><span className="sc-par">{tt.count === 2 ? 'best two' : 'best ball'}{hc ? ', net' : ''}</span></span>
                </td>
                {out.map((h, k) => {
                  const v = tt.rows[k].scores[i];
                  const tap = colProps(h.no);
                  return (
                    <td key={h.no} className={`${h.no === current ? 'cur' : ''} ${tap.className || ''}`} onClick={tap.onClick}>
                      <span className="sc-cell">{v == null ? <span className="empty-dot">·</span> : <span className="sc-mark">{netText(v)}</span>}</span>
                    </td>
                  );
                })}
                {/* The team scores are net with handicaps on, so with strokes given they add up in the Net column */}
                <td className="tot">{anyStrokes ? '' : played.length ? netText(played.reduce((a, r) => a + r.scores[i], 0)) : '–'}</td>
                {anyStrokes && <td className="tot">{played.length ? netText(played.reduce((a, r) => a + r.scores[i], 0)) : '–'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sc-legend">
        {/* Each mark stays on the same line as its words */}
        <span className="sc-key"><span className="sc-mark birdie">3</span> birdie <span className="key-critter"><BuddyArt id="birdie" bg="mint" /></span></span>
        <span className="sc-key"><span className="sc-mark eagle">2</span> eagle <span className="key-critter"><BuddyArt id="eagle" bg="teal" /></span></span>
        <span className="sc-key"><span className="sc-mark bogey">5</span> bogey</span>
        <span className="sc-key"><span className="sc-mark pu">X</span> picked up</span>
        {anyStrokes && <span className="sc-key"><span className="sc-strokes inline"><i /></span> {half ? 'half stroke' : 'gets a stroke'}</span>}
        {round.holeFixes && Object.keys(round.holeFixes).length > 0 && <span className="sc-key"><span className="sc-fixed inline" aria-hidden="true" /> par or HCP fixed</span>}
      </div>
      {key.lines.length > 0 && (
        <div className="sc-stroke-key">
          <span>{key.dots}.</span>
          {key.lines.map(l => <span key={l.key}>{l.text}.</span>)}
        </div>
      )}
    </div>
  );
}
