// Trial top D, "Scoreboard": a two-cell scoreboard, the hole on the left and what's riding on the
// right, like a game's score header, with the money under it as a ranked leaderboard (leader first,
// a place number by each name). The idea it tests: two big numbers answer the two questions on a
// tee box (which hole, what's it worth) and ranking the money says who's winning without reading it.
// Pinned: the scoreboard and the leaderboard both stay put; the game's details (Nassau's tiles, the
// wolf's pick, the skins each player has won) scroll away with the rows.
import { Icon } from '../../../components/ui.jsx';
import { useMoneyStrip } from '../useMoneyStrip.jsx';
import { skinsWorth, strokesHere } from '../hole-info.js';
import { holeStakes } from './stakes.js';
import { Amount } from './MoneyNums.jsx';
import './top-shared.css';
import './top-d.css';

export function Pinned(t) {
  const { round, hole, units, solo, holeFixed, editable } = t;
  const m = useMoneyStrip(t);
  const s = holeStakes(t);
  const getting = strokesHere(round, hole, units, solo);
  // Place by money, ties sharing a place ("2, 2, 2")
  const ranked = [...m.rows].sort((a, b) => b.v - a.v);
  const place = r => ranked.findIndex(x => x.v === r.v) + 1;
  const riding = (
    <>
      <span className="td-lbl">{s.label}</span>
      <span className="td-big">{s.big}</span>
      {s.sub && <span className="td-sub">{s.sub}</span>}
    </>
  );
  return (
    <>
      <div className="td-board">
        <button type="button" className="td-cell td-hole" onClick={t.openCard} aria-label={`Open scorecard. Hole ${hole.no}, par ${hole.par}, HCP ${hole.hdcp ?? 'unknown'}${holeFixed ? ', fixed for this round' : ''}`}>
          <span className="td-lbl">Hole <span className="td-card"><Icon name="table" /> Card</span></span>
          <span className="td-hrow">
            <span className="td-big">{hole.no}</span>
            <span className="td-par"><span>Par {hole.par}</span><span>HCP {hole.hdcp ?? '–'}{holeFixed && ' · Fixed'}</span></span>
          </span>
          {getting && <span className="td-sub">{getting.length ? <><span className="stroke-dots" aria-hidden="true">●</span> {getting.length > 2 ? `${getting.length} get strokes` : `Strokes: ${getting.join(', ')}`}</> : 'No strokes here'}</span>}
        </button>
        {s.tap === 'bets' && editable
          ? <button type="button" className="td-cell td-ride" onClick={t.openBets} aria-label={`${s.label}: ${s.big}, ${s.sub}. Change the bet`}>{riding}</button>
          : <div className="td-cell td-ride">{riding}</div>}
      </div>
      <button type="button" className="td-ranks" aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
        {ranked.map(r => (
          <span key={r.id} className={`td-rank ${place(r) === 1 && r.v > 0 ? 'lead' : ''}`}>
            <span className="td-p"><span className="td-place" aria-hidden="true">{place(r)}</span>{r.name}</span>
            <Amount m={m} r={r} />
          </span>
        ))}
        <Icon name="caret-down" className="td-more" />
      </button>
      {m.sheet}
    </>
  );
}

export function Head(t) {
  // The scoreboard says what skins are worth; the skins each player has won are the detail under it
  const won = t.game === 'skins' ? skinsWorth(t.main, t.hole).won : null;
  return (
    <div className="td-game">
      {won && <p className="td-won">Skins won: {won.map(w => `${w.name} ${w.n}`).join(' · ')}</p>}
      {t.panels({ noSkins: true })}
    </div>
  );
}
