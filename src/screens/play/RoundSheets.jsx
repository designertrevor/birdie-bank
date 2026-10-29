// The round menu's sheets for the round itself (Play.jsx): its length, a player who left, and
// handing the card to another phone.
import { useMemo, useState } from 'react';
import { Icon, PickChip, Segmented, Sheet, useUI } from '../../components/ui.jsx';
import { update, useStore } from '../../lib/store.js';
import { GAMES, canLeave, defaultNine, holeComplete, isJustPlaying, leftRule, oneBall, playersLeft, resizeRound, scoredHolesDropped } from '../../lib/round.js';
import { findCourse } from '../../lib/courses.js';
import { handOffChoices } from '../../lib/keeper.js';
import { buzz } from '../../lib/delight.js';

// --------------------------- Round length ---------------------------------

/** Switch a round in progress between 9 and 18 holes. Mounted only while open so it starts fresh each time. */
export function HolesSheet({ round, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const [count, setCount] = useState(round.holesCount);
  const [nine, setNine] = useState(() => defaultNine(round));
  const g = GAMES[round.game];
  const changed = count !== round.holesCount;
  const preview = useMemo(() => (course && changed ? resizeRound(round, course, count, nine) : null), [round, course, changed, count, nine]);
  const dropped = preview ? scoredHolesDropped(round, preview.holes) : [];
  const hcChanges = preview && round.useHandicaps
    // Someone just playing has no strokes in any game, so theirs never show as changed
    ? round.players.map((p, i) => ({ name: p.name.split(' ')[0], from: p.plays, to: preview.players[i].plays, casual: isJustPlaying(round, p.id) })).filter(c => !c.casual && c.from !== c.to)
    : [];
  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      Object.assign(r, resizeRound(r, course, count, nine));
    });
    onClose();
    showToast(`Now playing ${count} holes`);
    buzz(20);
  };
  return (
    <Sheet open onClose={onClose} title="Round length">
      <p className="sheet-text">Scores you’ve entered stay put. Par, handicaps and strokes are worked out again for the new length.</p>
      <div style={{ padding: '0 20px 12px' }}>
        <Segmented label="Round length" value={count} onChange={setCount}
          options={[9, 18].map(n => ({ value: n, label: `${n} holes`, disabled: !g.holes.includes(n) }))} />
      </div>
      {changed && course && count === 9 && course.holes.length === 18 && (
        <div style={{ padding: '0 20px 12px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Which nine</div>
          <Segmented label="Which nine" value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
        </div>
      )}
      {!course && <p className="hint-card"><Icon name="info" fill /> This phone doesn’t have {round.course.name} saved, so the round length can’t be changed here.</p>}
      {course && count === 18 && course.holes.length === 9 && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      {dropped.length > 0 && (
        <p className="hint-card"><Icon name="warning" fill /> Scores on hole{dropped.length === 1 ? '' : 's'} {dropped.map(h => h.no).join(', ')} won’t count. They’re kept if you switch back.</p>
      )}
      {hcChanges.length > 0 && (
        <p className="hint-card"><Icon name="scales" fill /> Strokes: {hcChanges.map(c => `${c.name} ${c.from} → ${c.to}`).join(', ')}</p>
      )}
      {preview && round.presses.length > 0 && (
        <p className="hint-card"><Icon name="lightning" fill /> Presses so far will be removed, since the bets change with the length.</p>
      )}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!preview} onClick={apply}>
          {changed ? <>Switch to {count} holes <Icon name="arrow-right" /></> : 'No changes yet'}
        </button>
      </div>
    </Sheet>
  );
}

// --------------------------- A player left ---------------------------------

/**
 * Mark a player as gone after a hole, or bring them back. Holes they played keep counting;
 * from the next hole on they have no score box and the money is worked out without them.
 * Mounted only while open so it starts fresh each time.
 */
export function LeftSheet({ round, idx, onClose, onEnd }) {
  const { showToast } = useUI();
  const gone = playersLeft(round);
  const staying = round.players.filter(p => round.left?.[p.id] == null);
  const [pid, setPid] = useState(null);
  // Default: the last hole they finished. The hole on screen if it's fully scored, else the one before
  const [pos, setPos] = useState(() => (holeComplete(round, round.holes[idx]) ? idx + 1 : idx));
  const first = n => n.split(' ')[0];
  const person = round.players.find(p => p.id === pid);
  const afterNo = pos === 0 ? 0 : round.holes[pos - 1].no;
  const nobody = !staying.some(p => canLeave(round, p.id));
  // Holes to pick from: up to the one on screen, or further if later holes already have scores (fixing a round)
  const upto = Math.max(idx, round.holes.reduce((a, h, i) => (round.scores[h.no] ? i : a), -1));
  const effect = pid ? leftRule({ ...round, left: { ...round.left, [pid]: afterNo } }, pid) : null;

  const apply = () => {
    update(s => { const r = s.rounds[round.id]; r.left = { ...(r.left || {}), [pid]: afterNo }; });
    onClose();
    showToast(pos === 0 ? `${first(person.name)} is out of the round` : `${first(person.name)} left after hole ${afterNo}`);
    buzz(20);
  };
  const undo = p => {
    update(s => { const r = s.rounds[round.id]; const next = { ...(r.left || {}) }; delete next[p.id]; r.left = next; });
    const later = round.holes.filter((h, i) => i >= (gone.find(g => g.player.id === p.id)?.pos ?? 0) && holeComplete(round, h));
    onClose();
    showToast(later.length ? `${first(p.name)} is back. Add their scores for holes ${later.map(h => h.no).join(', ')}` : `${first(p.name)} is back`);
  };

  return (
    <Sheet open onClose={onClose} title="A player left">
      <p className="sheet-text">Holes they played still count. From the next hole on they have no score box, and the money is worked out among the players still playing.</p>
      {gone.length > 0 && (
        <>
          <div className="eyebrow" style={{ padding: '0 20px 8px' }}>Already left</div>
          {gone.map(g => (
            <div key={g.player.id} className="leg-row">
              <div className="leg-winner">{g.player.name}<div className="li-sub">{g.after === 0 ? 'Before the first hole' : `After hole ${g.after}`}</div></div>
              <button className="pill-btn sm" onClick={() => undo(g.player)}><Icon name="arrow-counter-clockwise" /> They’re back</button>
            </div>
          ))}
        </>
      )}
      {nobody ? (
        <>
          <p className="hint-card"><Icon name="info" fill /> {round.game === 'altshot' || round.game === 'chapman'
            ? `${GAMES[round.game].name} needs a team with both partners still playing to keep the game going.`
            : `At least two ${oneBall(round.game) ? 'teams' : 'players'} have to stay to keep the game going.`} To stop here, end the round: the holes played still count.</p>
          <div className="cta-wrap"><button className="full-btn" onClick={onEnd}><Icon name="flag-checkered" /> End round</button></div>
        </>
      ) : (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="field-label">Who left</div>
            <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label="Who left">
              {staying.map(p => (
                <PickChip key={p.id} radio on={pid === p.id} disabled={!canLeave(round, p.id)} onClick={() => setPid(p.id)}>{p.name}</PickChip>
              ))}
            </div>
          </div>
          {pid && (
            <div style={{ padding: '0 20px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Last hole they finished</div>
              <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label="Last hole they finished">
                <PickChip radio on={pos === 0} onClick={() => setPos(0)}>None</PickChip>
                {round.holes.slice(0, upto + 1).map((h, i) => (
                  <PickChip key={h.no} radio check={false} on={pos === i + 1} onClick={() => setPos(i + 1)}>{h.no}</PickChip>
                ))}
              </div>
            </div>
          )}
          {effect && <p className="hint-card"><Icon name="scales" fill /> {effect}</p>}
          <div className="cta-wrap">
            <button className="full-btn" disabled={!pid} onClick={apply}>
              {pid ? (pos === 0 ? `${first(person.name)} didn’t play` : `${first(person.name)} left after hole ${afterNo}`) : 'Pick who left'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// --------------------------- Hand off the card -----------------------------

/**
 * The keeper hands the card to another player. Only players whose phone took their seat can keep
 * score; watchers are never listed. Mounted only while open.
 */
export function HandOffSheet({ round, me, dirty, onPick, onClose }) {
  const choices = handOffChoices(round).filter(c => c.id !== me);
  return (
    <Sheet open onClose={onClose} title="Hand off the card">
      <p className="sheet-text">Only players in this round can keep score.</p>
      {dirty && <p className="hint-card"><Icon name="info" fill /> Save this hole first, so your scores go with the card.</p>}
      {choices.map(c => (
        <button key={c.id} className="sheet-item" disabled={dirty || !c.onApp} onClick={() => onPick(c.id)}
          aria-label={c.onApp ? `Hand the card to ${c.name}` : `${c.name}, not on the app yet`}>
          <span><Icon name="user-circle" fill /> {c.name}</span>
          <span style={{ fontSize: 13 }}>{c.onApp ? <Icon name="caret-right" /> : 'Not on the app yet'}</span>
        </button>
      ))}
      <div className="cta-wrap"><button className="full-btn outline" onClick={onClose}>Keep the card</button></div>
    </Sheet>
  );
}
