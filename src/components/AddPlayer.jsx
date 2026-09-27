// Adding someone to a round that's under way, from the round menu or from a seat request
// ("Not on the list? Add me" on a join link). Their money counts from the hole they start on.
import { useMemo, useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { addPlayerProblem, addPlayerToRound, firstOpenHole, joinRule, roundStarted } from '../lib/round.js';
import { payFields } from '../lib/pay.js';
import { answerSeatRequest } from '../lib/sync.js';
import { cleanRequestName } from '../lib/sync-model.js';
import { firstName, sortedPlayers, strokesLabel } from '../lib/format.js';
import { buzz } from '../lib/delight.js';

/** Mounted only while open so it starts fresh each time. `request`: a seat request being answered. */
export function AddPlayerSheet({ round, request = null, onClose }) {
  const { showToast } = useUI();
  const state = useStore();
  const problem = addPlayerProblem(round);
  const started = roundStarted(round);
  const open = firstOpenHole(round);
  const saved = useMemo(() => sortedPlayers(state).filter(p => !round.players.some(x => x.id === p.id)), [state, round.players]);
  const [pick, setPick] = useState(null); // a saved player's id
  const [name, setName] = useState(request?.name || '');
  const person = pick ? state.players[pick] : null;
  // Someone with no handicap on file starts level with the low player ("No strokes"); adjust from there
  const lowHc = round.players.reduce((a, p) => (a == null || (p.plays ?? 0) < a.plays ? { plays: p.plays ?? 0, hc: p.courseHc ?? 0 } : a), null)?.hc ?? 0;
  const hcFrom = p => (p?.index != null ? Math.round(round.holesCount === 9 ? p.index / 2 : p.index) : lowHc);
  const [hc, setHc] = useState(lowHc);
  const [fromNo, setFromNo] = useState(open);
  const [busy, setBusy] = useState(false);
  const choose = id => { const p = id ? state.players[id] : null; setPick(id); setHc(hcFrom(p)); if (p) setName(p.name); };

  const cleanName = cleanRequestName(name);
  const newId = useMemo(() => uid('p_'), []);
  const player = { id: pick || newId, name: cleanName, index: person?.index ?? null, courseHc: hc, ...payFields(person) };
  const preview = cleanName && !problem && (open != null || !started) ? addPlayerToRound(round, player, started ? fromNo : null) : null;
  const added = preview?.players.at(-1);
  const pos = started && fromNo != null ? round.holes.findIndex(h => h.no === fromNo) + 1 : 1;
  const rule = preview && pos > 1 ? joinRule(preview, player.id) : null;
  // Holes they could start on: the ones from here on that nobody has scored yet
  const choices = round.holes.filter((h, i) => i >= Math.min(round.current || 0, round.holes.length - 1) && !Object.values(round.scores[h.no] || {}).some(v => v != null));

  const decline = async () => {
    setBusy(true);
    try { await answerSeatRequest(round.id, request.no, null); } catch { /* they'll keep waiting until they give up */ }
    onClose();
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    update(s => {
      const r = s.rounds[round.id];
      if (!r) return;
      Object.assign(r, addPlayerToRound(r, player, started ? fromNo : null));
      // Someone new goes in People too, like a guest added when setting up a round
      if (!s.players[player.id]) s.players[player.id] = { id: player.id, name: player.name, index: null, venmo: '', createdAt: Date.now() };
    });
    if (request) {
      try { await answerSeatRequest(round.id, request.no, player.id); }
      catch { showToast(`${firstName(player.name)} is in. Their phone couldn’t be told, so have them pick their name from the link`); onClose(); return; }
    }
    onClose();
    showToast(pos > 1 ? `${firstName(player.name)} is in from hole ${fromNo}` : `${firstName(player.name)} is in`);
    buzz(20);
  };

  return (
    <Sheet open onClose={onClose} title={request ? `${firstName(request.name)} wants in` : 'Add a player'} className="sheet sc-sheet">
      {problem || (started && open == null) ? (
        <>
          <p className="hint-card"><Icon name="info" fill /> {problem || 'Every hole has scores already, so there’s no hole left to start on.'}</p>
          <div className="cta-wrap">
            {request
              ? <button className="full-btn" disabled={busy} onClick={decline}>Let {firstName(request.name)} know</button>
              : <button className="full-btn" onClick={onClose}>OK</button>}
          </div>
        </>
      ) : (
        <>
          <p className="sheet-text">
            {started ? 'Holes already played stay as they are. The new player’s money counts from the hole they start on.' : 'Nothing’s scored yet, so they’re simply one more player.'}
          </p>
          <div style={{ padding: '0 20px 12px' }}>
            <label className="field-label" htmlFor="ap-name">Name</label>
            <input id="ap-name" className="name-input" value={name} maxLength={24} autoComplete="off" placeholder="e.g. Sam"
              onChange={e => { setName(e.target.value); if (pick) setPick(null); }} />
            {!request && saved.length > 0 && (
              <div className="chip-row" style={{ padding: '10px 0 0' }} role="radiogroup" aria-label="Saved players">
                {saved.slice(0, 12).map(p => (
                  <button key={p.id} role="radio" aria-checked={pick === p.id} className={`pill-btn sm ${pick === p.id ? 'on' : ''}`} onClick={() => choose(pick === p.id ? null : p.id)}>{p.name}</button>
                ))}
              </div>
            )}
          </div>
          {round.useHandicaps && (
            <div style={{ padding: '0 20px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Handicap for this round</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="sc-btn" aria-label="Lower handicap" onClick={() => setHc(v => Math.max(-10, v - 1))}><Icon name="minus" /></button>
                <span className="sc-num" aria-live="polite">{hc}</span>
                <button className="sc-btn" aria-label="Higher handicap" onClick={() => setHc(v => Math.min(54, v + 1))}><Icon name="plus" /></button>
                <span style={{ fontWeight: 700 }}>{added ? strokesLabel(added.plays) : '–'}</span>
              </div>
              {started && <p className="field-help">Nobody else’s strokes change.</p>}
            </div>
          )}
          {started && (
            <div style={{ padding: '0 20px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Starts on hole</div>
              <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label="Starts on hole">
                {choices.map(h => (
                  <button key={h.no} role="radio" aria-checked={fromNo === h.no} className={`pill-btn ap-hole ${fromNo === h.no ? 'on' : ''}`} onClick={() => setFromNo(h.no)}>{h.no}</button>
                ))}
              </div>
            </div>
          )}
          {rule && <p className="hint-card"><Icon name="scales" fill /> {rule}</p>}
          <div className="cta-wrap">
            <button className="full-btn" disabled={!preview || busy} onClick={apply}>
              {cleanName ? <>Add {firstName(cleanName)}{pos > 1 ? ` from hole ${fromNo}` : ''} <Icon name="user-plus" /></> : 'Type a name'}
            </button>
            {request && <button className="full-btn outline" disabled={busy} onClick={decline}>Not this time</button>}
          </div>
        </>
      )}
    </Sheet>
  );
}
