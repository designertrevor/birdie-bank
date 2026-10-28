// The top of the round in progress (Play.jsx): the header and progress line, the money bar, the
// banners (who has the card, asking for it, fixing scores, someone wanting in, a finished round) and
// the hole tile that opens the scorecard.
import { Icon } from '../../components/ui.jsx';
import { LivePill } from '../../components/Live.jsx';
import { GalleryBar } from '../../components/Gallery.jsx';
import { BigBar } from '../../components/BigGame.jsx';
import { addPlayerProblem, isJustPlaying, strokesFor } from '../../lib/round.js';
import { addJustPlayingProblem } from '../../lib/just-playing.js';
import { BIG_FORMAT } from '../../lib/big-game.js';
import { firstName, gameLabel } from '../../lib/format.js';
import { onTab } from '../../lib/play-for.js';
import { bigBoardOnly, ownMoney } from '../../lib/play-screen.js';
import { ASK_MS, clockText } from '../../lib/keeper.js';
import { useNav } from '../../lib/nav.js';
import { CardBar, MoneyBar } from './MoneyBar.jsx';

/** The header, the line that shows how far through the round, and the money strip (or the Big Game's board, or the card). */
export function PlayHeader({ round, idx, hole, solo, theme, preview, onLive, onMenu, noMoney = false }) {
  const nav = useNav();
  return (
    <>
    <div className="play-top">
      <button className="header-close" onClick={() => nav.pop()} aria-label="Leave round (it stays saved)"><Icon name="caret-down" /></button>
      <div className="play-title">
        <h1 className="play-course">{round.course.name}</h1>
        <div className="play-progress">{round.trip?.format === 'big' && !ownMoney(round) ? round.trip.name : gameLabel(round)} · Hole {idx + 1} of {round.holes.length} {round.shared && <button className="pill-link" onClick={() => onLive()}><LivePill round={round} /></button>}</div>
      </div>
      <button className="header-close" onClick={() => onMenu()} aria-label="Round menu"><Icon name="dots-three" /></button>
    </div>
    {/* How far through the round, as a line under the header (the words above say it for screen readers) */}
    <div className="play-track" aria-hidden="true"><span style={{ transform: `scaleX(${(idx + 1) / round.holes.length})` }} /></div>
    {/* A Big Game's group round with no money of its own shows the game across every group instead */}
    {/* The live money view (a phone watching the round) has the race instead, so no strip over it */}
    {noMoney ? null : solo ? <CardBar round={round} /> : bigBoardOnly(round) ? <BigBar round={round} /> : <MoneyBar round={round} hole={hole} preview={preview} themed={!!theme} />}
    {round.trip?.format === BIG_FORMAT && ownMoney(round) && (
      <button className="big-link" onClick={() => nav.push('bigGame', { id: round.trip.id })}><Icon name="users-four" fill /> {round.trip.name}: the board across every group <Icon name="caret-right" /></button>
    )}
    </>
  );
}

/**
 * The banners under the money bar. `card` is useKeeperCard's state for a shared round; `onLetIn`
 * opens the add player sheet for a seat request.
 */
export function PlayBanners({ round, card, editable, dirty, requests, doneEditing, onLetIn }) {
  const nav = useNav();
  const { sharedLive, keeper, amKeeper, inRound, cardAsk, now, left, declined, tookBy, tookName, holderName, askCard, takeBack, takeCard, giveCard, keepCard } = card;
  return (
    <>
    {/* Only the other phones see who has the card; the keeper's own Hand off lives in the round menu, since it's rarely used */}
    {sharedLive && keeper && !amKeeper && round.status === 'active' && !round.editing && (
      <div className="seat-req keeper-bar" role="status">
        <Icon name="pencil-simple" fill />
        <span className="sr-text">
          {tookBy && left == null && !declined ? <><strong>{tookName}</strong> took the card</> : <><strong>{holderName}</strong> is keeping score</>}
          {left > 0 && <span className="sr-sub">Asked. {holderName} can say yes or no. <button className="link-btn inline" onClick={takeBack}>Undo<span className="sr-only">: take back asking {holderName} for the card</span></button></span>}
          {left == null && declined && <span className="sr-sub">{holderName} said no, so they’re keeping it.</span>}
        </span>
        {inRound && (left === 0
          ? <button className="pill-btn" onClick={takeCard}>Take the card</button>
          : left > 0
            ? <button className="pill-btn ghost" disabled aria-live="off" aria-label={`You can take the card in ${Math.ceil(left / 1000)} seconds if ${holderName} doesn’t answer`}>Take the card in <span className="sr-clock">{clockText(left)}</span></button>
            : <button className="pill-btn" onClick={askCard}>{declined ? 'Ask again' : 'Ask for it'}</button>)}
      </div>
    )}
    {/* Friends watching from their feed, and the players, trash talking mid-round */}
    <GalleryBar round={round} />
    {amKeeper && cardAsk && round.status === 'active' && (
      <div className="seat-req" role="status">
        <Icon name="hand-grabbing" fill />
        <span className="sr-text">
          <strong>{firstName(round.players.find(p => p.id === cardAsk.by)?.name || '')}</strong> asked for the card. Hand it over?
          <span className="sr-sub">With no answer, they can take it in {clockText(Math.max(0, cardAsk.at + ASK_MS - now))}.</span>
        </span>
        <button className="pill-btn" disabled={dirty} onClick={() => giveCard(cardAsk.by)}>Yes<span className="sr-only">, hand it over</span></button>
        <button className="pill-btn ghost" onClick={keepCard}>No<span className="sr-only">, keep it</span></button>
      </div>
    )}
    {round.editing && editable && (
      <button className="finished-banner" onClick={doneEditing}>
        <Icon name="pencil-simple" fill /> Fixing scores. {onTab(round) ? 'The Tab updates' : 'The points update'} as you save. Done <Icon name="arrow-right" />
      </button>
    )}
    {requests[0] && round.status === 'active' && editable && (
      <div className="seat-req" role="status">
        <Icon name="user-plus" fill />
        <span className="sr-text"><strong>{requests[0].name}</strong> wants to join{requests[0].justPlaying ? ', just playing' : ''}{requests.length > 1 ? ` (+${requests.length - 1} more)` : ''}</span>
        {/* Anyone can come in just playing, so only a round that can't take even that says why */}
        <button className="pill-btn" onClick={() => onLetIn(requests[0])}>{addJustPlayingProblem(round) && (requests[0].justPlaying || addPlayerProblem(round)) ? 'See why' : 'Let in'}</button>
      </div>
    )}
    {round.status === 'done' && !round.editing && (
      <button className="finished-banner" onClick={() => nav.reset('history', ['roundDetail', { id: round.id }])}>
        <Icon name="flag-checkered" fill /> The scorekeeper finished this round. See results <Icon name="arrow-right" />
      </button>
    )}
    </>
  );
}

/**
 * Hole, par and HCP on one line (Layout Lab A), with who gets a stroke here under it, as one button
 * that opens the scorecard. The hole number is big; the rest is one quiet line.
 */
export function HoleMeta({ round, hole, units, solo, holeFixed, onOpen }) {
  // Who gets a stroke here, up top, so a birdie that doesn't move the money makes sense. Someone just
  // playing has no game to get strokes in. Past two names it gives the count; each row says who
  const getting = round.useHandicaps && !solo
    ? units.filter(u => !isJustPlaying(round, u.id) && strokesFor(round, u, hole) > 0).map(u => u.team ? u.name : u.name.split(' ')[0])
    : null;
  return (
    <button type="button" className="hole-line" onClick={onOpen} aria-label={holeFixed ? `Open scorecard. Hole ${hole.no}’s par or HCP was fixed for this round` : 'Open scorecard'}>
      <span className="hl-no" aria-hidden="true">{hole.no}</span>
      <span className="hl-main">
        <span className="hl-meta">Par {hole.par} · HCP {hole.hdcp ?? '–'}{holeFixed && <span className="fixed-tag">Fixed</span>}</span>
        {getting && <span className="hl-strokes"><span className="stroke-dots" aria-hidden="true">●</span>{getting.length ? `Strokes: ${getting.length > 2 ? `${getting.length} players` : getting.join(', ')}` : 'No strokes here'}</span>}
      </span>
      <span className="hl-card"><Icon name="table" /> Card</span>
    </button>
  );
}
