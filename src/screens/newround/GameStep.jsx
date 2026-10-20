// Setup's first step (NewRound.jsx): your usuals, your games as rows, every other game as a tile,
// with each game's rules a tap away.
import { useMemo, useState } from 'react';
import { Icon, PickMark } from '../../components/ui.jsx';
import { GameArt } from '../../components/GameArt.jsx';
import { RulesSheet } from '../../components/Rules.jsx';
import { UsualsList } from '../../components/Usuals.jsx';
import { useStore } from '../../lib/store.js';
import { GAMES, GAME_GROUPS } from '../../lib/round.js';
import { gameLabel } from '../../lib/format.js';
import { roundStakeLines } from '../../lib/stakes.js';
import { useNav } from '../../lib/nav.js';

export function GameStep({ usual, onUsual, onPickUsual, planning, onPlan, game, setGame, onNext }) {
  const nav = useNav();
  const [rules, setRules] = useState(null);
  const u = usual?.round;
  const state = useStore();
  // Your games: what you've played lately, then what you said your group plays, at most four
  const mine = useMemo(() => {
    const played = Object.values(state.rounds || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => r.game);
    return [...new Set([...played, ...(state.organizer?.games || [])])].filter(k => GAMES[k]).slice(0, 4);
  }, [state.rounds, state.organizer]);
  return (
    <>
      <div className="scroll">
        {onPickUsual && <UsualsList onPick={onPickUsual} />}
        {u && (
          <button className="usual-card" onClick={onUsual}>
            <span className="eyebrow">Your usual</span>
            <span className="uc-title d">{gameLabel(u)} · {usual.course.name}</span>
            <span className="uc-sub">{u.players.map(p => p.name.split(' ')[0]).join(', ')} · {u.holesCount} holes · {roundStakeLines(u, { since: false }).map(l => l.line).join(' + ')}</span>
            <span className="uc-btn"><Icon name="arrow-counter-clockwise" /> Set it up again</span>
          </button>
        )}
        {/* Your games first, as full rows; every other game as a compact tile, rules a tap away */}
        {mine.length > 0 && <>
          <div className="sec-label">Your games</div>
          {mine.map(key => {
            const info = GAMES[key];
            return (
              <div key={key} className={`game-row ${game === key ? 'selected' : ''}`} role="radio" aria-checked={game === key} tabIndex={0} aria-label={`${info.name}: ${info.players}, ${info.blurb}`}
                onClick={() => setGame(game === key ? null : key)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGame(game === key ? null : key)}>
                <GameArt game={key} className="game-icon" />
                <div className="row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="gn">{info.name}</div>
                    <button className="rules-chip" onClick={e => { e.stopPropagation(); setRules(key); }} aria-label={`${info.name} rules`}><Icon name="info" /> Rules</button>
                  </div>
                  <div className="gs">{info.players} · {info.blurb}</div>
                </div>
                <PickMark on={game === key} add={false} />
              </div>
            );
          })}
        </>}
        {GAME_GROUPS.map(group => {
          const keys = Object.entries(GAMES).filter(([k, info]) => info.group === group && !mine.includes(k)).map(([k]) => k);
          if (!keys.length) return null;
          return (
            <div key={group}>
              <div className="sec-label">{group}</div>
              <div className="game-grid">
                {keys.map(key => {
                  const info = GAMES[key];
                  return (
                    <div key={key} className={`game-tile ${game === key ? 'selected' : ''}`} role="radio" aria-checked={game === key} tabIndex={0} aria-label={`${info.name}: ${info.players}, ${info.blurb}`}
                      onClick={() => setGame(game === key ? null : key)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGame(game === key ? null : key)}>
                      <span className="gt-top"><GameArt game={key} className="game-icon sm" />
                        <button className="gt-info" onClick={e => { e.stopPropagation(); setRules(key); }} aria-label={`${info.name} rules`}><Icon name="info" /></button></span>
                      <span className="gn">{info.name}</span>
                      <span className="gs">{game === key ? info.blurb : info.players}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* More than one group (8 to 20 players): one game across every group (BigGameSetup.jsx) */}
        {!planning && (
          <button className="quiet-row" onClick={() => nav.push('bigGameSetup')}>
            <Icon name="users-four" /> <span>More than one group? <u>Set up a Big Game</u></span>
          </button>
        )}
        <button className="quiet-row" onClick={() => nav.push('suggest', { kind: 'game' })}>
          <Icon name="chat-circle-dots" /> <span>Don’t see your game? <u>Tell us how it’s played</u></span>
        </button>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!game} onClick={onNext}>{game ? <>{planning ? 'Next: When' : 'Next: Course'} <Icon name="arrow-right" /></> : 'Pick a game'}</button>
        {!planning && onPlan && <button className="text-link cta-link" disabled={!game} onClick={onPlan}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
      <RulesSheet game={rules} open={!!rules} onClose={() => setRules(null)} />
    </>
  );
}
