// The "Lately" rows: payments, carry-overs, answers, challenges and round recaps (see lib/lately.js),
// and the trash talk on rounds and plans (lib/talk.js). The Friends feed adds friends' finished
// rounds, the plans you're invited to (lib/friend-feed.js) and brags (lib/feed-brags.js).
import { Icon } from './ui.jsx';
import { TalkCount } from './TalkCount.jsx';
import { useNav } from '../lib/nav.js';
import { useStore } from '../lib/store.js';
import { Avatar } from './Avatar.jsx';
import { GameArt } from './GameArt.jsx';
import { GAMES } from '../lib/round.js';
import { planSeatAvatar } from '../lib/plan-faces.js';

const LOOK = {
  payment: { icon: 'hand-coins', tint: 'mint' },
  carry: { icon: 'arrow-bend-up-right', tint: 'lav' },
  rsvp: { icon: 'calendar-check', tint: 'peach' },
  challenge: { icon: 'sword', tint: 'lav' },
  recap: { icon: 'flag-pennant', tint: 'ochre' },
  talk: { icon: 'chat-circle-dots', tint: 'pink' },
  react: { icon: 'smiley', tint: 'lav' },
  friend: { icon: 'users-three', tint: 'mint' },
  plan: { icon: 'envelope-simple', tint: 'peach' },
  brag: { icon: 'star', tint: 'ochre' },
};

/** Who a row is about: their face, or on a plan the face that plan carries for them (plan-faces.js). */
function LatelyFace({ face }) {
  const me = useStore(s => s.me);
  const plan = useStore(s => (face.plan ? s.plans?.[face.plan] : null));
  const props = plan ? planSeatAvatar(plan, face.who, me) : { id: face.id, seat: null };
  return <Avatar id={props.id} seat={props.seat} name={face.name} size="sm" className="lately-face" />;
}

export function LatelyList({ items }) {
  const nav = useNav();
  const talk = useStore(s => s.talk);
  return (
    <ul className="lately-list" role="list">
      {items.map(it => {
        // A brag brings its own game's icon and colour (feed-brags.js bragLook)
        const base = LOOK[it.kind] || LOOK.recap;
        const look = { icon: it.icon || base.icon, tint: it.tint || base.tint };
        const body = (
          <>
            {/* A feed about people leads with their faces, a round with its game's sticker; the rest keep their icon (history-15) */}
            {it.face ? <LatelyFace face={it.face} />
              : it.game && GAMES[it.game] ? <GameArt game={it.game} size={32} className="lately-art" />
              : <span className={`lately-ic ${look.tint}`} aria-hidden="true"><Icon name={look.icon} fill /></span>}
            <span className="lately-main">
              <span className="lately-text">{it.text}</span>
              {it.sub && <span className="lately-sub">{it.sub}</span>}
              {it.kind === 'recap' && <TalkCount rows={talk?.[`round:${it.target?.[1]?.id}`]} />}
              {it.talkKey && <TalkCount rows={talk?.[it.talkKey]} />}
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
