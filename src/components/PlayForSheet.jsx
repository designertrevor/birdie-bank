// What a round is played for, changed once it's under way, from the round menu (Games and bets):
// money, points or a reward, the same choice setup offers. It counts for the whole round, and the
// sheet says what goes on or comes off the Tab before it's saved (worked out with tabResults, so a
// reward round's side bets for money count and nothing else does). The engine is lineup.js.
import { useState } from 'react';
import { Icon, Sheet, Toggle, useUI } from './ui.jsx';
import PlayForPicker from './PlayFor.jsx';
import { update } from '../lib/store.js';
import { holesPlayed } from '../lib/round.js';
import { betsOf } from '../lib/pair-bets.js';
import { playForOf, rewardNoun } from '../lib/play-for.js';
import { changePlayFor, standingLine, tabLine } from '../lib/lineup.js';
import { buzz } from '../lib/delight.js';

/** Mounted only while open, so it starts from the round as it is each time. */
export function PlayForSheet({ round, onClose }) {
  const { showToast } = useUI();
  const [value, setValue] = useState(round.playFor ?? null);
  const was = playForOf(round);
  const pf = playForOf({ playFor: value });
  const bets = betsOf(round).length;
  // Into a reward from money or points: each side bet between two is for money or points. From
  // money they stay for money (the two agreed money), from points they stay points
  const askCash = bets > 0 && pf.kind === 'reward' && was.kind !== 'reward';
  const [cash, setCash] = useState(was.kind === 'money');
  const opts = askCash ? { cashBets: cash } : {};
  const after = changePlayFor(round, value, opts);
  const same = after === round;
  const played = holesPlayed(round).length > 0;
  const tab = same ? null : tabLine(round, after);
  const stand = same ? null : standingLine(after);

  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      if (r) s.rounds[round.id] = changePlayFor(r, value, opts);
    });
    onClose();
    showToast(pf.kind === 'points' ? 'Playing for points now. Nothing from this round goes on the Tab.'
      : pf.kind === 'reward' ? `Playing for ${rewardNoun(pf.reward)} now, every hole.`
        : 'Playing for money now. It goes on the Tab.');
    buzz(20);
  };

  return (
    <Sheet open onClose={onClose} title="Play for" className="sc-sheet">
      <p className="sheet-text">A change here counts for the whole round, holes already played too. The bets stay as they are: a $5 bet is worth 5 pts.</p>
      <PlayForPicker value={value} onChange={setValue} />
      {askCash && (
        <div className="toggle-row">
          <div>
            <div className="toggle-lbl" id="pf-cash-lbl">Side bets stay for money</div>
            <div className="toggle-sub" id="pf-cash-sub">{cash
              ? `${bets === 1 ? 'The side bet between two players keeps' : `The ${bets} side bets between two players keep`} paying in dollars, on the Tab.`
              : `${bets === 1 ? 'The side bet goes' : `The ${bets} side bets go`} to points with the rest.`}</div>
          </div>
          <Toggle on={cash} onChange={setCash} labelledBy="pf-cash-lbl" describedBy="pf-cash-sub" />
        </div>
      )}
      {!same && (
        <div className="hint-card fix-impact" role="status">
          <Icon name="scales" fill />
          <div>
            <div className="eyebrow">What this changes</div>
            {!played
              ? <p>Nothing has been played yet, so nothing moves.</p>
              : <>
                <p><strong>{tab || 'Nothing goes on or comes off the Tab.'}</strong></p>
                {stand && <p>{stand}</p>}
              </>}
          </div>
        </div>
      )}
      <div className="cta-wrap">
        <button className="full-btn" disabled={same} onClick={apply}>{same ? 'No change yet' : <>Save for the whole round <Icon name="check" /></>}</button>
      </div>
    </Sheet>
  );
}
