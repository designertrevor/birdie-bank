// The "Play for" choice in setup and the plan flow: Money (as always), Points (bragging rights)
// or a reward the winner gets ("Lunch", "A drink" or one typed in), with who's buying it.
import { useState } from 'react';
import { Segmented } from './ui.jsx';
import { REWARDS, REWARD_MAX, cleanReward, playForOf, storedPlayFor } from '../lib/play-for.js';

/**
 * `value` is the stored playFor (null for money), `onChange` gets the new one (null for money).
 * `planning`: the words fit a plan the group answers later.
 */
export default function PlayForPicker({ value, onChange, planning = false }) {
  const pf = playForOf({ playFor: value });
  // The custom reward being typed, kept while switching chips so it isn't lost
  const [custom, setCustom] = useState(() => (pf.kind === 'reward' && !REWARDS.includes(pf.reward) ? pf.reward : ''));
  const isCustom = pf.kind === 'reward' && !REWARDS.includes(pf.reward);
  const [typing, setTyping] = useState(isCustom);
  const set = next => onChange(storedPlayFor(next));
  const reward = (r, owes = pf.owes) => set({ kind: 'reward', reward: r, owes: owes || 'last' });

  const kinds = [
    { value: 'money', label: 'Money' },
    { value: 'points', label: 'Points' },
    { value: 'reward', label: 'A reward' },
  ];
  const pickKind = k => {
    if (k === 'reward') reward(pf.kind === 'reward' ? pf.reward : (typing && cleanReward(custom)) || REWARDS[0], pf.owes || 'last');
    else set({ kind: k });
  };
  const help = pf.kind === 'points'
    ? 'Bragging rights: the bets below count as points, so $5 is 5 pts. No money changes hands.'
    : pf.kind === 'reward'
      ? `Whoever wins the round gets it, and ${pf.owes === 'everyone' ? 'everyone else owes them one each' : 'last place is buying'}. No money changes hands, unless you play a side bet for money.`
      : planning ? 'The group plays for money, and it goes on the Tab.' : 'Played for money, and it goes on the Tab.';

  return (
    <div className="block play-for">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Play for</div>
      <Segmented label="Play for" className="press-mode-row" btn="pm-btn" value={pf.kind} onChange={pickKind} options={kinds} />
      {pf.kind === 'reward' && (
        <>
          <div className="chip-row pf-chips" role="radiogroup" aria-label="The reward">
            {REWARDS.map(r => (
              <button key={r} type="button" role="radio" aria-checked={!typing && pf.reward === r} className={`pill-btn sm ${!typing && pf.reward === r ? 'on' : ''}`}
                onClick={() => { setTyping(false); reward(r); }}>{r}</button>
            ))}
            <button type="button" role="radio" aria-checked={typing} className={`pill-btn sm ${typing ? 'on' : ''}`}
              onClick={() => { setTyping(true); if (cleanReward(custom)) reward(cleanReward(custom)); }}>Custom</button>
          </div>
          {typing && (
            <>
              <label className="field-label" htmlFor="pf-custom">The reward</label>
              <input id="pf-custom" className="name-input" value={custom} maxLength={REWARD_MAX} placeholder="e.g. Dinner, a round of beers" autoComplete="off" enterKeyHint="done"
                onChange={e => { setCustom(e.target.value); reward(cleanReward(e.target.value) || REWARDS[0]); }} />
            </>
          )}
          <div className="eyebrow" style={{ margin: '14px 0 10px' }}>Who’s buying</div>
          <Segmented label="Who’s buying" className="press-mode-row" btn="pm-btn" value={pf.owes} onChange={o => reward(pf.reward, o)}
            options={[{ value: 'last', label: 'Last place' }, { value: 'everyone', label: 'Everyone else' }]} />
        </>
      )}
      <p className="field-help">{help}</p>
    </div>
  );
}
