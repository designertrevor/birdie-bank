// The "Lately" rows: payments, carry-overs, answers, challenges and round recaps (see lib/lately.js).
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';

const LOOK = {
  payment: { icon: 'hand-coins', tint: 'mint' },
  carry: { icon: 'arrow-bend-up-right', tint: 'lav' },
  rsvp: { icon: 'calendar-check', tint: 'peach' },
  challenge: { icon: 'sword', tint: 'lav' },
  recap: { icon: 'flag-pennant', tint: 'ochre' },
};

export function LatelyList({ items }) {
  const nav = useNav();
  return (
    <ul className="lately-list" role="list">
      {items.map(it => {
        const look = LOOK[it.kind] || LOOK.recap;
        const body = (
          <>
            <span className={`lately-ic ${look.tint}`} aria-hidden="true"><Icon name={look.icon} fill /></span>
            <span className="lately-main">
              <span className="lately-text">{it.text}</span>
              {it.sub && <span className="lately-sub">{it.sub}</span>}
            </span>
            {it.target && <span className="chevron" aria-hidden="true"><Icon name="caret-right" /></span>}
          </>
        );
        return (
          <li key={it.id}>
            {it.target
              ? <button className="lately-row" onClick={() => nav.push(...it.target)} aria-label={[it.text, it.sub].filter(Boolean).join('. ')}>{body}</button>
              : <div className="lately-row static">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
