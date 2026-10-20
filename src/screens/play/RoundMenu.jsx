// The round menu (Play.jsx): the three things people open mid-round as tiles, then short grouped
// lists for this hole, the games and bets, the players and the round, and feedback at the bottom.
import { Icon, Sheet } from '../../components/ui.jsx';
import { Spot } from '../../components/Spot.jsx';
import { useStore } from '../../lib/store.js';
import { GAMES, SIDE_GAMES, bettors, gameKeys, noHandicap, oneBall, playersLeft, sideGamesOf } from '../../lib/round.js';
import { isLocked } from '../../lib/agreed.js';
import { lineupKind, lineupMenuText } from '../../lib/lineup.js';
import { courseTeeLabel } from '../../lib/hole-fix.js';
import { findCourse } from '../../lib/courses.js';
import { roundStakeLines } from '../../lib/stakes.js';
import { playForShort } from '../../lib/play-for.js';
import { roundsInProgress } from '../../lib/rounds.js';
import { syncConfigured } from '../../lib/sync.js';
import { betsOf } from '../../lib/pair-bets.js';
import { useNav } from '../../lib/nav.js';

/** One row in the round menu: an icon, what it is, and its current setting on the right. */
function MenuRow({ icon, label, value = null, onClick, danger = false }) {
  return (
    <button className={`menu-row ${danger ? 'danger' : ''}`} onClick={onClick}>
      <Icon name={icon} /><span className="mr-label">{label}</span>
      {value != null && value !== '' && <span className="mr-value">{value}</span>}
      <Icon name="caret-right" className="mr-caret" />
    </button>
  );
}

/**
 * Each `on…` opens what its row names (the menu closes first); `onFix` takes the fix sheet's kind
 * ('hole' | 'tee' | 'hc' | 'lineup' | 'playFor'), `onAgreed` 'lock' or 'view', `onRules` a game key.
 * `doneEditing` and `endEarly` close the menu themselves.
 */
export function RoundMenu({ open, onClose, round, hole, game, editable, solo, me, amKeeper, onCard, onBets, onLive, onFix, onGames, onPairs, onAgreed, onRules, onHand, onAdd, onLeft, onHoles, onSwitch, doneEditing, endEarly }) {
  const nav = useNav();
  const others = useStore(s => roundsInProgress(s).filter(r => r.id !== round.id).length);
  const localCourse = useStore(s => findCourse(s, round.course.id));
  return (
    <Sheet open={open} onClose={onClose} title="Round">
      {/* The three things people open mid-round, as tiles; the rest in short grouped lists */}
      <div className="menu-tiles">
        <button className="menu-tile" onClick={() => { onClose(); onCard(); }}><Icon name="table" /><span>Scorecard</span></button>
        {editable && !solo && <button className="menu-tile" onClick={() => { onClose(); onBets(); }}><Icon name="coins" /><span>Bets</span></button>}
        {syncConfigured && <button className="menu-tile" onClick={() => { onClose(); onLive(); }}><Icon name="broadcast" /><span>{round.shared ? 'Live' : 'Invite'}</span></button>}
      </div>
      {editable && <>
        <div className="menu-sec">This hole</div>
        <div className="menu-group">
          <MenuRow icon="wrench" label={`Fix par or HCP · hole ${hole.no}`} onClick={() => { onClose(); onFix('hole'); }} />
        </div>
      </>}
      {!solo && <>
      <div className="menu-sec">Games and bets</div>
      <div className="menu-group">
        {/* Changing the game is for the phone keeping score (see keeper.js) */}
        {editable && <>
        <MenuRow icon="coins" label="Bets" value={roundStakeLines(round).map(l => l.line).join(' + ')} onClick={() => { onClose(); onBets(); }} />
        {game !== 'bbb' && (
          <MenuRow icon="scales" label="Handicaps" value={round.useHandicaps === false ? 'Off' : noHandicap(round).length ? `On, ${noHandicap(round).length} with none` : 'On'} onClick={() => { onClose(); onFix('hc'); }} />
        )}
        {/* What it's played for changes while the round is going on, not when fixing a finished one */}
        {round.status === 'active' && !round.editing && (
          <MenuRow icon="trophy" label="Play for" value={playForShort(round)} onClick={() => { onClose(); onFix('playFor'); }} />
        )}
        {!oneBall(game) && (
          <MenuRow icon="plus-circle" label={sideGamesOf(round).length ? 'Side games' : 'Add a side game'} value={sideGamesOf(round).length || null} onClick={() => { onClose(); onGames(); }} />
        )}
        </>}
        {/* Two-player side bets: everyone sees them; the phone keeping score, or either player in a bet, changes them */}
        {(editable || betsOf(round).length > 0 || bettors(round).some(p => p.id === me)) && (
          <MenuRow icon="hand-coins" label="Side bets" value={betsOf(round).length || null} onClick={() => { onClose(); onPairs(); }} />
        )}
        {(isLocked(round) || editable) && (
          <MenuRow icon="handshake" label={isLocked(round) ? 'What we agreed' : 'First-tee rules card'}
            value={isLocked(round) && round.agreed.changes?.length ? `${round.agreed.changes.length} change${round.agreed.changes.length > 1 ? 's' : ''}` : null}
            onClick={() => { onClose(); onAgreed(isLocked(round) ? 'view' : 'lock'); }} />
        )}
        {gameKeys(round).map(k => (
          <MenuRow key={k} icon="book-open" label={`${k === 'main' ? GAMES[game].name : SIDE_GAMES[k].label} rules`} onClick={() => { onClose(); onRules(k); }} />
        ))}
      </div>
      </>}
      {(syncConfigured || editable) && <>
      <div className="menu-sec">Players</div>
      <div className="menu-group">
        {syncConfigured && (
          <MenuRow icon="broadcast" label={round.shared ? 'Live' : 'Invite the group'} value={round.shared ? `Code ${round.shared.code}` : null} onClick={() => { onClose(); onLive(); }} />
        )}
        {amKeeper && round.status === 'active' && !round.editing && (
          <MenuRow icon="pencil-simple" label="Hand off the card" value="You’re keeping score" onClick={() => { onClose(); onHand(); }} />
        )}
        {editable && <>
        <MenuRow icon="user-plus" label="Add a player" onClick={() => { onClose(); onAdd(); }} />
        <MenuRow icon="user-minus" label="A player left" value={playersLeft(round).length ? playersLeft(round).map(x => x.player.name.split(' ')[0]).join(', ') : null} onClick={() => { onClose(); onLeft(); }} />
        {/* Sides or teams, the playing order, and who throws the first hammer (see lineup.js) */}
        {!solo && (lineupKind(round) || game === 'hammer') && (
          <MenuRow icon={lineupKind(round) === 'order' ? 'list-numbers' : game === 'hammer' && !lineupKind(round) ? 'hammer' : 'users-three'} label={lineupMenuText(round)} onClick={() => { onClose(); onFix('lineup'); }} />
        )}
        </>}
      </div>
      </>}
      {(editable || round.status === 'active') && <>
      <div className="menu-sec">Round</div>
      <div className="menu-group">
        {editable && <>
        <MenuRow icon="flag-pennant" label="Round length" value={`${round.holesCount} holes`} onClick={() => { onClose(); onHoles(); }} />
        <MenuRow icon="sliders-horizontal" label="Course and tee" value={courseTeeLabel(round, localCourse) || null} onClick={() => { onClose(); onFix('tee'); }} />
        </>}
        {round.status === 'active' && (
          <MenuRow icon="stack" label={others ? 'Rounds in progress' : 'Start another round'} value={others ? others + 1 : null} onClick={() => { onClose(); onSwitch(); }} />
        )}
      </div>
      </>}
      {editable && (
        <div className="menu-group">
          {round.editing
            ? <MenuRow icon="check-circle" label="Done fixing scores" onClick={doneEditing} />
            : <MenuRow icon="flag-checkered" label="End round" onClick={endEarly} danger />}
        </div>
      )}
      {/* Feedback stays easy to find, at the bottom where it doesn't shout over the round */}
      <button className="feedback-row" onClick={() => { onClose(); nav.push('suggest', { roundId: round.id }); }}>
        <Spot kind="megaphone" size={52} />
        <span className="fb-words"><strong>Something off, or got an idea?</strong><small>Tell us. This round’s details come along.</small></span>
        <Icon name="caret-right" />
      </button>
    </Sheet>
  );
}
