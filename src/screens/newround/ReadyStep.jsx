// Round ready (NewRound.jsx): the round just set up, inviting the group before the first tee, and
// Tee off.
import { useState } from 'react';
import { Callout, Icon } from '../../components/ui.jsx';
import { Spot } from '../../components/Spot.jsx';
import { GameArt } from '../../components/GameArt.jsx';
import { ShareSheet } from '../../components/Live.jsx';
import { SaveUsualButton } from '../../components/Usuals.jsx';
import { useGroupAvatars } from '../../lib/useAvatars.js';
import { useStore } from '../../lib/store.js';
import { bettors, isJustPlaying } from '../../lib/round.js';
import { roundStakeLines } from '../../lib/stakes.js';
import { syncConfigured } from '../../lib/sync.js';
import { holesScored, roundsInProgress } from '../../lib/rounds.js';
import { gameLabel, hcPctLabel } from '../../lib/format.js';
import { pctsDiffer } from '../../lib/allowances.js';
import { countsMoney, playForLine, playForShort } from '../../lib/play-for.js';
import { roundGameIds, roundTheme, themeVars } from '../../lib/round-theme.js';

/** After setup: invite the group before the first tee, then start. */
export function ReadyStep({ round, onStart, onLater }) {
  const [sharing, setSharing] = useState(false);
  const others = useStore(roundsInProgress).filter(r => r.id !== round.id);
  // Anyone just playing has a line of their own: they're on the card, not in the game
  const names = (round.teams || bettors(round)).map(p => p.name.split(' ')[0]);
  const casualNames = round.players.filter(p => isJustPlaying(round, p.id)).map(p => p.name.split(' ')[0]);
  const first = round.holes[0];
  // The group on the first tee: everyone's buddy (a photo or initials stands in as a stock buddy)
  const avatars = useGroupAvatars(round.players);
  const crew = round.players.slice(0, 5).map((p, i) => {
    const m = avatars.get(p.id);
    return m?.kind === 'buddy' ? m.buddy : ['visor', 'bucket', 'snapback', 'flatcap', 'beanie'][i];
  });
  const what = countsMoney(round) ? 'the money' : 'the scores';
  // The main game's theme starts here and carries into the round: the card wears its colour, with
  // every game's art on top (the main game first and biggest)
  const theme = roundTheme(round);
  const games = roundGameIds(round);
  return (
    <>
      <div className="scroll">
        <div className="ready-hero">
          <Spot kind="crowd" ids={crew} size={220} className="ready-crew" plate={false} />
          <div className="ready-title d">You’re set for {gameLabel(round)}</div>
        </div>
        <div className={`block ready-card ${theme ? 'themed' : ''}`} style={themeVars(theme)}>
          {games.length > 0 && (
            <div className="ready-games" aria-hidden="true">
              {games.map((g, i) => <GameArt key={g} game={g} className={`ready-art ${i ? 'side' : 'main'}`} />)}
            </div>
          )}
          <div className="ready-row"><span>Course</span><b>{round.course.name}{round.nine ? ` · ${round.nine === 'front' ? 'Front' : 'Back'} 9` : ''}</b></div>
          <div className="ready-row"><span>{round.teams ? 'Teams' : 'Players'}</span><b>{round.teams ? round.teams.map(t => t.name).join(' v ') : names.join(', ')}</b></div>
          {casualNames.length > 0 && <div className="ready-row"><span>Just playing</span><b>{casualNames.join(', ')}</b></div>}
          <div className="ready-row"><span>On the line</span><b>{roundStakeLines(round).map(l => l.line).join(' + ')}</b></div>
          {playForLine(round) && <div className="ready-row"><span>Playing for</span><b>{playForShort(round)}</b></div>}
          <div className="ready-row"><span>Handicaps</span><b>{round.useHandicaps ? `${pctsDiffer(round) ? 'Set by game' : hcPctLabel(round.hcPct)}${round.halfStrokes ? ', half strokes' : ''}` : 'Off'}</b></div>
        </div>
        {others.map(o => (
          <p key={o.id} className="hint-card"><Icon name="pause-circle" fill /> Your {gameLabel(o)} round at {o.course.name} ({holesScored(o)} of {o.holes.length} holes) is saved. Switch back any time from Rounds in progress in the round menu.</p>
        ))}
        {syncConfigured && (round.shared ? (
          <p className="hint-card"><Icon name="broadcast" fill /> The group has the link. They can follow {what} live.
            <button className="text-link inline" onClick={() => setSharing(true)}>Send it again</button></p>
        ) : (
          <Callout spot="link" title={`Let the group watch ${what} live`}
            action={<button className="pill-btn co-act dark" onClick={() => setSharing(true)}><Icon name="share-network" /> Invite the group</button>}>
            No download. They just open a link on their own phone.
          </Callout>
        ))}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onStart}>Tee off on hole {first.no} <Icon name="arrow-right" /></button>
        <div className="ready-more">
          <SaveUsualButton round={round} className="text-link" />
          {onLater && <button className="text-link" onClick={onLater}><Icon name="calendar-plus" /> Schedule for later</button>}
        </div>
      </div>
      <ShareSheet round={round} open={sharing} onClose={() => setSharing(false)} />
    </>
  );
}
