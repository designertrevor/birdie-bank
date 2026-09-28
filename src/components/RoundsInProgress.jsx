// "Rounds in progress": pick which round to carry on with, or start another one.
// Every round stays saved while you're in a different one.
import { Icon, Sheet } from './ui.jsx';
import { update, useStore } from '../lib/store.js';
import { gameLabel } from '../lib/format.js';
import { holesScored, roundsInProgress } from '../lib/rounds.js';
import { useNav } from '../lib/nav.js';

export function RoundsInProgressSheet({ open, onClose, currentId = null }) {
  const nav = useNav();
  const rounds = useStore(roundsInProgress);
  const go = id => {
    onClose();
    if (id === currentId) return;
    update(s => { s.activeRoundId = id; });
    nav.reset('upnext', ['play', { id }]);
  };
  const another = () => { onClose(); nav.reset('upnext', ['newRound']); };
  return (
    <Sheet open={open} onClose={onClose} title="Rounds in progress">
      <p className="sheet-text">Every round stays saved. Pick one to carry on, or start another.</p>
      {rounds.map(r => (
        <button key={r.id} className={`sheet-item ${r.id === currentId ? 'selected' : ''}`} onClick={() => go(r.id)} aria-current={r.id === currentId || undefined}>
          <div className="row-main">
            <div>{gameLabel(r) || 'Round'} · {r.course.name}</div>
            <span className="set-sub" style={{ display: 'block' }}>
              {r.id === currentId ? 'Playing now · ' : ''}{holesScored(r)} of {r.holes.length} holes · {r.players.map(p => p.name.split(' ')[0]).join(', ')}
            </span>
          </div>
          <Icon name={r.id === currentId ? 'check' : 'caret-right'} />
        </button>
      ))}
      <div style={{ padding: '4px 16px 16px' }}>
        <button className="full-btn outline" onClick={another}><Icon name="plus" /> Start another round</button>
      </div>
    </Sheet>
  );
}
