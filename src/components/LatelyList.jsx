// The "Lately" rows: payments, carry-overs, answers and round recaps (see lib/lately.js), and the
// trash talk on rounds and plans (lib/talk.js).
import { Icon } from './ui.jsx';
import { TalkCount } from './TalkCount.jsx';
import { useNav } from '../lib/nav.js';
import { useStore } from '../lib/store.js';

const LOOK = {
  payment: { icon: 'hand-coins', tint: 'mint' },
  carry: { icon: 'arrow-bend-up-right', tint: 'lav' },
  rsvp: { icon: 'calendar-check', tint: 'peach' },
  recap: { icon: 'flag-pennant', tint: 'ochre' },
  talk: { icon: 'chat-circle-dots', tint: 'pink' },
  react: { icon: 'smiley', tint: 'lav' },
};

export function LatelyList({ items }) {
  const nav = useNav();
  const talk = useStore(s => s.talk);
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
              {it.kind === 'recap' && <TalkCount rows={talk?.[`round:${it.target?.[1]?.id}`]} />}
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
