// The money bar under the round's header, or the card bar when everyone is just playing (Play.jsx).
import { useState } from 'react';
import { Sheet } from '../../components/ui.jsx';
import { GameArt } from '../../components/GameArt.jsx';
import { ByGameTable } from '../../components/SideGames.jsx';
import { bettingRound, holeComplete, isJustPlaying, playsHole } from '../../lib/round.js';
import { JUST_PLAYING_TAG, niceRound } from '../../lib/just-playing.js';
import { money } from '../../lib/golf.js';
import { countsMoney, unitFmt, wholeDelta } from '../../lib/play-for.js';
import { nassauOpenNote } from '../../lib/side-games.js';

/**
 * A card kept with no game (everyone just playing): each player's score so far and to par, where the
 * money bar would be. Nothing here is money.
 */
export function CardBar({ round }) {
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  return (
    <div className="money-bar card-bar" role="group" aria-label="Your card so far">
      <div className="mb-head">
        <span>Just keeping score</span>
        <span>{played ? `Thru ${played} hole${played === 1 ? '' : 's'}` : 'No holes yet'}</span>
      </div>
      <div className="mb-items" style={{ gridTemplateColumns: `repeat(${round.players.length}, minmax(0, 1fr))` }}>
        {round.players.map(p => {
          const n = niceRound(round, p.id);
          return (
            <div key={p.id} className="mb-item">
              <div className="mb-p">{p.name.split(' ')[0]}</div>
              <div className={`mb-a card-par ${n ? n.tone : ''}`}>{n ? n.toPar : 'E'}</div>
              <div className="mb-d">{n ? `${n.score} so far` : '\u00a0'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Everyone's money, pinned under the header from the first hole, updating as scores go in. */
export function MoneyBar({ round: full, hole, preview, art = null }) {
  // The bar is the betting players' money: anyone just playing is named under it, with no amount
  const round = bettingRound(full);
  const casual = full.players.filter(p => isJustPlaying(full, p.id)).map(p => p.name.split(' ')[0]);
  // Holes counted besides this one, so going back to a saved hole doesn't count it twice ("Thru 3 + this one" on hole 3)
  const saved = holeComplete(round, hole);
  const played = round.holes.filter(h => holeComplete(round, h)).length - (saved ? 1 : 0);
  const pending = saved || Object.values(preview.delta).some(Boolean);
  const top = Math.max(...Object.values(preview.balances));
  // Pop the amounts that just changed
  const [prev, setPrev] = useState(preview.balances);
  const [changed, setChanged] = useState([]);
  if (prev !== preview.balances) {
    setChanged(round.players.filter(p => prev[p.id] !== preview.balances[p.id]).map(p => p.id));
    setPrev(preview.balances);
  }
  // With side games the bar is one total per person, and a tap shows each game's money
  const byGame = preview.byGame || null;
  // A reward round's side bets for money: dollars of their own, apart from the points (see roundResults' `cash`)
  const cash = preview.cash || null;
  const cashLine = cash && round.players.filter(p => cash.balances[p.id]).map(p => `${p.name.split(' ')[0]} ${money(cash.balances[p.id], { sign: true })}`).join(', ');
  const [open, setOpen] = useState(false);
  // A points or reward round counts the same numbers as points (never money)
  const fmt = unitFmt(round);
  const word = countsMoney(round) ? 'Money' : 'Points';
  const thru = played ? (pending ? `Thru ${played} + this hole` : `Thru ${played} hole${played === 1 ? '' : 's'}`) : pending ? 'This hole' : `Everyone starts at ${fmt(0)}`;
  const Box = byGame ? 'button' : 'div';
  // A button's label replaces what's in it, so it carries everyone's total too
  const said = round.players.map(p => `${p.name.split(' ')[0]} ${fmt(preview.balances[p.id], { sign: true })}`).join(', ');
  // and the dollar side bets line under it in a reward round, which the label would hide as well
  const cashSaid = cash ? `. Side bets for money: ${cashLine || 'all square'}` : '';
  const boxProps = byGame
    ? { type: 'button', className: `money-bar mb-tap ${art ? 'themed' : ''}`, 'aria-label': `${word} so far, ${thru.toLowerCase()}: ${said}${cashSaid}. Show by game`, 'aria-haspopup': 'dialog', onClick: () => setOpen(true) }
    : { className: `money-bar ${art ? 'themed' : ''}`, role: 'group', 'aria-label': `${word} so far` };
  // Not a live region: it changes on every tap. The saved hole's result is announced by the toast.
  return (
    <>
    <Box {...boxProps}>
      <div className="mb-head">
        {/* The main game's art on the bar's band: the round's theme */}
        <span className="mb-word">{art && <GameArt game={art} className="mb-art" />}{word}</span>
        <span>{byGame ? `${thru} · Tap for games` : thru}</span>
      </div>
      <div className="mb-items" style={{ gridTemplateColumns: `repeat(${round.players.length}, minmax(0, 1fr))` }}>
        {round.players.map(p => {
          const v = preview.balances[p.id];
          // In points, the hole's change is the whole total less the whole total before, so they agree
          const d = countsMoney(round) ? preview.delta[p.id] : wholeDelta(v, preview.delta[p.id]);
          return (
            <div key={p.id} className={`mb-item ${top > 0 && v === top ? 'lead' : ''}`}>
              <div className="mb-p">{p.name.split(' ')[0]}</div>
              <div key={changed.includes(p.id) ? v : 'same'} className={`mb-a ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''} ${changed.includes(p.id) ? 'bump' : ''}`}>{fmt(v, { sign: true })}</div>
              <div className="mb-d">{d ? `${fmt(d, { sign: true })} this hole` : round.left?.[p.id] != null ? 'Left' : round.joined?.[p.id] != null && !playsHole(round, p.id, hole) ? `From hole ${round.joined[p.id]}` : '\u00a0'}</div>
            </div>
          );
        })}
      </div>
      {cash && <div className="mb-cash">Side bets for money · {cashLine || 'All square'}</div>}
      {casual.length > 0 && <div className="mb-jp">{JUST_PLAYING_TAG} · {casual.join(', ')}</div>}
    </Box>
    {byGame && (
      <Sheet open={open} onClose={() => setOpen(false)} title="By game" className="sc-sheet">
        <p className="sheet-text">{word} so far ({thru.toLowerCase()}). Every game adds up into one total each.</p>
        <ByGameTable round={round} byGame={byGame} total={preview.balances} fmt={fmt} />
        {cash && (
          <>
            <p className="sheet-text">Side bets for money, in dollars. They go on the Tab and stay out of the points.</p>
            <ByGameTable round={round} byGame={{ cash: { label: cash.label, balances: cash.balances } }} total={cash.balances} fmt={money} caption="Side bets for money" />
          </>
        )}
        {nassauOpenNote(round, byGame) && <p className="field-help" style={{ padding: '0 20px' }}>{nassauOpenNote(round, byGame)}</p>}
        <div className="cta-wrap"><button className="full-btn outline" onClick={() => setOpen(false)}>Close</button></div>
      </Sheet>
    )}
    </>
  );
}
