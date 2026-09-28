// "Your usuals" in round setup, and the "Save as a usual" sheet (see lib/usuals.js).
import { useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { getState, update, uid, useStore } from '../lib/store.js';
import { GAMES } from '../lib/round.js';
import { allCourses } from '../lib/courses.js';
import { gameLabel } from '../lib/format.js';
import { roundStakeLines } from '../lib/stakes.js';
import {
  MAX_USUALS, addUsual, canAddUsual, deleteUsual, matchingUsual, renameUsual, sortedUsuals, usualAsRound, usualFromRound,
} from '../lib/usuals.js';

const shortDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const first = n => String(n || '').split(' ')[0];

function UsualRow({ usual, onPick, onMore }) {
  const state = useStore();
  const course = allCourses(state).find(c => c.id === usual.courseId);
  const like = usualAsRound(state, usual);
  const bets = GAMES[usual.game] ? roundStakeLines(like).map(l => l.line).join(' + ') : '';
  const names = usual.players.map(pid => first(state.players[pid]?.name || usual.names?.[pid])).filter(Boolean).join(', ');
  const when = usual.lastPlayedAt ? `Last played ${shortDate(usual.lastPlayedAt)}` : 'Not played yet';
  return (
    <div className="usual-row">
      <button className="usual-main" onClick={() => onPick(usual)} disabled={!GAMES[usual.game]}>
        <span className="ur-name">{usual.name}</span>
        <span className="ur-sub">{[gameLabel(like), bets, course?.name || usual.courseName].filter(Boolean).join(' · ')}</span>
        <span className="ur-sub soft">{[names, when].filter(Boolean).join(' · ')}</span>
      </button>
      <button className="icon-btn ur-more" aria-label={`Options for ${usual.name}`} onClick={() => onMore(usual)}><Icon name="dots-three" /></button>
    </div>
  );
}

/** The saved usuals list for the first setup step. One tap sets it up; "More" renames or deletes. */
export function UsualsList({ onPick }) {
  const usuals = useStore(sortedUsuals);
  const [more, setMore] = useState(null);
  if (!usuals.length) return null;
  return (
    <>
      <div className="sec-label">Your usuals</div>
      {usuals.map(u => <UsualRow key={u.id} usual={u} onPick={onPick} onMore={setMore} />)}
      {more && <UsualOptions usual={more} onClose={() => setMore(null)} />}
    </>
  );
}

function UsualOptions({ usual, onClose }) {
  const { ask, showToast } = useUI();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(usual.name);
  const del = async () => {
    onClose();
    const ok = await ask({ title: `Delete ${usual.name}?`, text: 'Your rounds stay as they are. This only removes the one-tap setup.', confirmLabel: 'Delete usual', danger: true });
    if (!ok) return;
    update(s => deleteUsual(s, usual.id));
    showToast('Usual deleted');
  };
  const save = () => {
    if (!name.trim()) return;
    update(s => renameUsual(s, usual.id, name));
    onClose();
    showToast('Renamed');
  };
  return (
    <Sheet open onClose={onClose} title={renaming ? 'Rename usual' : usual.name}>
      {renaming ? (
        <div style={{ padding: '0 20px' }}>
          <label className="field-label" htmlFor="usual-rename">Name</label>
          <input id="usual-rename" className="text-input" value={name} maxLength={40} autoFocus onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} />
          <div className="cta-wrap" style={{ padding: '16px 0 0' }}>
            <button className="full-btn" disabled={!name.trim()} onClick={save}>Save</button>
          </div>
        </div>
      ) : (
        <>
          <button className="sheet-item" onClick={() => setRenaming(true)}><span><Icon name="pencil-simple" /> Rename</span><Icon name="caret-right" /></button>
          <button className="sheet-item" onClick={del}><span><Icon name="trash" /> Delete</span><Icon name="caret-right" /></button>
        </>
      )}
    </Sheet>
  );
}

/**
 * "Save as a usual" for a round this phone set up: a button that opens the naming sheet, or says
 * it's saved already. Hidden for rounds joined from another phone.
 */
export function SaveUsualButton({ round, className = 'full-btn outline' }) {
  const state = useStore();
  const [open, setOpen] = useState(false);
  if (!round || round.localMe || !GAMES[round.game]) return null;
  const saved = matchingUsual(state, round);
  if (saved) return <p className="field-help pad usual-saved"><Icon name="check-circle" fill /> Saved as a usual: {saved.name}</p>;
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><Icon name="bookmark-simple" /> Save as a usual</button>
      {open && <SaveUsualSheet round={round} onClose={() => setOpen(false)} />}
    </>
  );
}

function SaveUsualSheet({ round, onClose }) {
  const { showToast } = useUI();
  const full = useStore(s => !canAddUsual(s));
  const [name, setName] = useState(() => usualFromRound(getState(), round, { id: '_' })?.name || '');
  const save = () => {
    const s = getState();
    const u = usualFromRound(s, round, { id: uid('u_'), name });
    if (!u) return;
    let result = null;
    update(d => { result = addUsual(d, u); });
    onClose();
    showToast(result === 'saved' ? `Saved. ${u.name} is one tap away in setup.` : result === 'same' ? 'That one’s already a usual' : `You have ${MAX_USUALS} usuals. Delete one to save another.`);
  };
  return (
    <Sheet open onClose={onClose} title="Save as a usual">
      <div style={{ padding: '0 20px' }}>
        <label className="field-label" htmlFor="usual-name">Name</label>
        <input id="usual-name" className="text-input" value={name} maxLength={40} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !full && name.trim() && save()} />
        <p className="field-help">Game, bet, course and players. Rename or delete it any time.</p>
        {full && <p className="field-error" role="status">You have {MAX_USUALS} usuals. Delete one to save another.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={full || !name.trim()} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
