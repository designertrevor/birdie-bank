import { useState } from 'react';
import { Icon, Segmented, Sheet } from './ui.jsx';
import { gameKeys } from '../lib/round.js';
import { GIMMES, MULLIGANS, agreementItems, changeLine, isLocked, lockedBy } from '../lib/agreed.js';

/**
 * The first-tee rules card, one screen: each player's strokes, the bets, the house rules that are on,
 * and the group's calls on gimmes and mulligans (recorded, never scored), plus presses as set.
 * `mode` 'lock' is the keeper's card before hole 1 ("Lock it in", or skip it); 'view' is "What we
 * agreed" from the round menu, with every change since listed against its hole. `canEdit` lets the
 * keeper's phone change gimmes and mulligans after locking (the change is listed like any other).
 * Only 'lock' uses `initial`, `onLock` and `onSkip`; only 'view' uses `onCalls` and `onClose`.
 */
export function FirstTeeSheet({ round, open, mode = 'view', canEdit = false, me = null, initial = null, onLock, onSkip, onCalls, onClose }) {
  // The card starts from the calls the group made last time (`initial`), else none
  const [calls, setCalls] = useState(() => ({ gimmes: initial?.gimmes || 'none', mulligans: initial?.mulligans || 'none' }));
  if (!open) return null;
  const locking = mode === 'lock';
  // Before locking, the card reads the calls being picked; after, what was locked in
  const shown = locking ? calls : { gimmes: round.agreed?.gimmes || 'none', mulligans: round.agreed?.mulligans || 'none' };
  const items = agreementItems(round, shown);
  const group = g => items.filter(x => x.group === g);
  const oneGame = gameKeys(round).length === 1;
  const rules = group('rules').filter(x => x.on);
  const presses = items.find(x => x.id === 'presses');
  const pick = (key, v) => {
    if (locking) setCalls(c => ({ ...c, [key]: v }));
    else onCalls?.({ ...shown, [key]: v });
  };
  const changes = round.agreed?.changes || [];
  const call = (key, list, title) => (
    <div className="ft-call">
      <div className="ft-h">{title}</div>
      {locking || canEdit
        ? <div className="ft-seg"><Segmented label={title} className="press-mode-row" btn="pm-btn" value={shown[key]} onChange={v => pick(key, v)} options={list.map(o => ({ value: o.value, label: o.label }))} /></div>
        : <div className="ft-line">{items.find(x => x.id === key)?.text}</div>}
    </div>
  );
  return (
    <Sheet open onClose={locking ? onSkip : onClose} title={locking ? 'First tee' : 'What we agreed'}>
      <div className="ft-card">
        <p className="ft-lede">
          {locking ? `Settle it here, so nobody argues about it on ${round.holes.at(-1)?.no ?? 18}.`
            : isLocked(round) ? `${lockedBy(round, me)} ${round.agreed.hole ? `on hole ${round.agreed.hole}` : 'on the first tee'}. Anything changed since is listed with its hole.` : 'Not locked in yet.'}
        </p>
        {!locking && isLocked(round) && (
          <div className="ft-sec ft-since">
            <div className="ft-h">Changed since</div>
            {changes.length
              ? <ul className="ft-list ft-changes">{changes.map((c, i) => <li key={i}>{changeLine(c)}</li>)}</ul>
              : <div className="ft-line">Nothing. It’s all as agreed.</div>}
          </div>
        )}
        <div className="ft-sec">
          <div className="ft-h">Strokes</div>
          <div className="ft-chips">
            {group('strokes').map(x => <span key={x.id} className="ft-chip"><strong>{x.label}</strong> {x.text}</span>)}
          </div>
        </div>
        <div className="ft-sec">
          <div className="ft-h">Bets</div>
          {group('bets').map(x => (
            <div key={x.id} className="ft-row"><span className="ft-k">{x.label}</span><span className="ft-v">{x.text}</span></div>
          ))}
        </div>
        <div className="ft-sec">
          <div className="ft-h">House rules</div>
          {rules.length
            ? <ul className="ft-list">{rules.map(x => <li key={x.id}>{oneGame ? x.text : <><strong>{x.label}:</strong> {x.text}</>}</li>)}</ul>
            : <div className="ft-line">None. Straight up.</div>}
          {presses && <div className="ft-row"><span className="ft-k">Presses</span><span className="ft-v">{presses.text}</span></div>}
        </div>
        <div className="ft-sec">
          {call('gimmes', GIMMES, 'Gimmes')}
          {call('mulligans', MULLIGANS, 'Mulligans')}
          <p className="field-help">Gimmes and mulligans are on the honor system: the app records the call, it doesn’t score it.</p>
        </div>
      </div>
      <div className="cta-wrap">
        {locking
          ? <>
            <button className="full-btn" onClick={() => onLock(calls)}><Icon name="lock-simple" fill /> Lock it in</button>
            <button className="ft-skip" onClick={onSkip}>Skip for now</button>
          </>
          : <button className="full-btn outline" onClick={onClose}>Done</button>}
      </div>
    </Sheet>
  );
}
