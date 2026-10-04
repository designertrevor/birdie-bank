// The day-after recap card and the callouts card on Up next (see lib/recap.js and lib/callouts.js).
import { Icon, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { update } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { sendReminder } from '../lib/pay.js';
import { useGroupAvatars } from '../lib/useAvatars.js';

const STATUS_WORD = { square: 'Square', owes: 'Owes', waiting: 'Waiting', carried: 'Carried' };
const MOMENT_ICON = { won: 'trophy', final: 'trophy', bigskin: 'fire', skin: 'coins', lonewolf: 'paw-print', blindwolf: 'paw-print', wolfdown: 'paw-print', hammer: 'hammer', hammerback: 'hammer', swing: 'arrows-down-up' };

/** Put the recap away for this round, on this phone. */
function dismissRecap(roundId) {
  update(s => { s.recapSeen = { ...(s.recapSeen || {}), [roundId]: Date.now() }; });
}

/** The last round, the day after: who took it, a moment or two, who's paid and what carried. */
export function RecapCard({ recap }) {
  const nav = useNav();
  const faces = useGroupAvatars(recap.round.players);
  const { paid, carried, moments } = recap;
  const open = () => nav.push(...recap.target);
  return (
    <section className="recap-card" aria-label={`Recap: ${recap.title}`}>
      <button className="recap-x" onClick={() => dismissRecap(recap.id)} aria-label="Done with the recap"><Icon name="x" /></button>
      <button className="recap-head" onClick={open} aria-label={`${recap.when}. ${recap.title}. ${recap.headline}${recap.yours ? `. ${recap.yours}` : ''}. See the round`}>
        <span className="eyebrow">{recap.when} · {recap.title}</span>
        <span className="recap-title d">{recap.headline}</span>
        {recap.yours && <span className="recap-yours">{recap.yours}</span>}
      </button>

      {moments.length > 0 && (
        <ul className="recap-moments">
          {moments.map(m => (
            <li key={m.id}>
              <span className="recap-mi" aria-hidden="true"><Icon name={MOMENT_ICON[m.kind] || 'sparkle'} fill /></span>
              <span className="recap-mt"><b>{m.title}</b><span>Hole {m.hole} · {m.text}</span></span>
            </li>
          ))}
        </ul>
      )}

      {paid && (
        <div className="recap-block">
          <div className="recap-bh">
            <span className="bl">Who’s paid</span>
            <span className="recap-count">{paid.allSquare ? 'Everyone’s square' : `${paid.square} of ${paid.total} square`}</span>
          </div>
          <ul className="sq-people">
            {paid.people.map(p => (
              <li key={p.id} className={`sq-p ${p.status}`}>
                <Avatar model={faces.get(p.id)} />
                <span className="sq-word" aria-hidden="true">{STATUS_WORD[p.status]}</span>
                <span className="sr-only">{p.name}: {STATUS_WORD[p.status].toLowerCase()}</span>
              </li>
            ))}
          </ul>
          {paid.mine.length > 0 && (
            <ul className="recap-mine">
              {paid.mine.map(l => <li key={l.id} className={l.status}>{l.text}</li>)}
            </ul>
          )}
          <p className="recap-note">Amounts only show to the two people involved.</p>
        </div>
      )}

      {carried.length > 0 && (
        <div className="recap-block">
          <div className="recap-bh"><span className="bl">Rolled to next time</span></div>
          <ul className="recap-mine">
            {carried.map(c => <li key={c.id} className="carried">{c.text}</li>)}
          </ul>
        </div>
      )}

      <div className="recap-actions">
        <button className="recap-btn" onClick={open}><Icon name="flag-pennant" /> See the round</button>
        {paid && !paid.allSquare && <button className="recap-btn" onClick={() => nav.setTab('ledger')}><Icon name="hand-coins" /> Open the Tab</button>}
      </div>
    </section>
  );
}

/** Callouts: a few lines for the group text, each one tap to post. */
export function CalloutsCard({ items }) {
  const { showToast } = useUI();
  const share = async text => {
    const how = await sendReminder(text);
    if (how === 'copied') showToast('Copied. Paste it in the group text');
    else if (how === 'failed') showToast('Couldn’t open sharing on this device');
  };
  const off = () => {
    update(s => { s.settings.callouts = false; });
    showToast('Callouts are off. Turn them back on in Settings');
  };
  return (
    <section className="callouts" aria-label="Callouts for the group text">
      <ul className="callout-list">
        {items.map(c => (
          <li key={c.id}>
            <button className="callout-row" onClick={() => share(c.text)} aria-label={`Share: ${c.text}`}>
              <span className="callout-text">{c.text}</span>
              <span className="callout-go" aria-hidden="true"><Icon name="share-network" /></span>
            </button>
          </li>
        ))}
      </ul>
      <button className="callout-off" onClick={off}>Turn off callouts</button>
    </section>
  );
}
