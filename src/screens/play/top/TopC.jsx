// Trial top C, "The header is the hole": the screen's header says the hole itself ("Hole 3 of 18",
// par and HCP, with Card beside the menu) instead of the course, and the money sits in the same band
// under it. The idea it tests: today's header and hole line say "Hole 3" twice in two places; one
// band that answers "where am I and how am I doing" frees the page for the game and the rows.
// Pinned: the whole band, hole and money together. The game's panel (as today) scrolls away.
import { Icon } from '../../../components/ui.jsx';
import { LivePill } from '../../../components/Live.jsx';
import { BIG_FORMAT } from '../../../lib/big-game.js';
import { gameLabel } from '../../../lib/format.js';
import { ownMoney } from '../../../lib/play-screen.js';
import { useNav } from '../../../lib/nav.js';
import { useMoneyStrip } from '../useMoneyStrip.jsx';
import { strokesHere } from '../hole-info.js';
import { Amount } from './MoneyNums.jsx';
import './top-c.css';
import './top-shared.css';

export function Header(t) {
  const { round, hole, idx, holeFixed } = t;
  const nav = useNav();
  const m = useMoneyStrip(t);
  return (
    <>
      <div className="tc-band">
        <div className="tc-top">
          <button className="header-close" onClick={() => nav.pop()} aria-label="Leave round (it stays saved)"><Icon name="caret-down" /></button>
          <button type="button" className="tc-title" onClick={t.openCard} aria-label={`Hole ${hole.no}, ${idx + 1} of ${round.holes.length}, par ${hole.par}. Open scorecard`}>
            <span className="tc-hole">Hole {hole.no}<span className="tc-of"> of {round.holes.length}</span></span>
            <span className="tc-sub">
              Par {hole.par} · HCP {hole.hdcp ?? '–'}{holeFixed && <span className="fixed-tag">Fixed</span>}
            </span>
          </button>
          {round.shared && <button className="pill-link" onClick={t.onLive}><LivePill round={round} /></button>}
          <button type="button" className="tc-card" onClick={t.openCard} aria-label="Open scorecard"><Icon name="table" /> Card</button>
          <button className="header-close" onClick={t.onMenu} aria-label="Round menu"><Icon name="dots-three" /></button>
        </div>
        <button type="button" className="tc-money" aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
          {m.rows.map(r => (
            <span key={r.id} className={`tc-item ${r.lead ? 'lead' : ''}`}>
              <span className="tc-p">{r.name}</span>
              <Amount m={m} r={r} />
            </span>
          ))}
          <Icon name="caret-down" className="tc-more" />
        </button>
        {/* How far through the round, as the band's bottom edge */}
        <div className="tc-track" aria-hidden="true"><span style={{ transform: `scaleX(${(idx + 1) / round.holes.length})` }} /></div>
      </div>
      {round.trip?.format === BIG_FORMAT && ownMoney(round) && (
        <button className="big-link" onClick={() => nav.push('bigGame', { id: round.trip.id })}><Icon name="users-four" fill /> {round.trip.name}: the board across every group <Icon name="caret-right" /></button>
      )}
      {m.sheet}
    </>
  );
}

export function Head(t) {
  // Who gets a stroke here: the header has no room for it beside Card, so it leads the game's part
  const getting = strokesHere(t.round, t.hole, t.units, t.solo);
  return (
    <div className="tc-game">
      {/* The course and the games, which the header gave up for the hole */}
      <p className="tc-eyebrow">{gameLabel(t.round)} · {t.round.course.name}</p>
      {getting && (
        <p className="tc-strokes">{getting.length
          ? <><span className="stroke-dots" aria-hidden="true">●</span> Strokes here: {getting.length > 3 ? `${getting.length} players` : getting.join(', ')}</>
          : 'No strokes here'}</p>
      )}
      {t.panels()}
    </div>
  );
}
