// The gallery on a live shared round: friends watching from their Friends feed react and trash
// talk on the round itself (lib/friend-feed.js, talk-sync.js 'follow:' threads), and the players
// see the newest of it here, mid-round, with the whole talk one tap away. It's the same talk the
// round's results show once it's over.
import { useState } from 'react';
import { Icon, Sheet } from './ui.jsx';
import { TalkSection } from './Talk.jsx';
import { useStore } from '../lib/store.js';
import { commentsOn, emojiOf, reactionsOn, roundTalk, talkName } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

// Rounds whose talk sheet is open: the hole remounts on every save, and the sheet stays open across it
const OPEN = new Set();

/** A bar under the round's top with the newest comment (or the reactions), once there's any talk. */
export function GalleryBar({ round }) {
  const state = useStore();
  const [open, setOpenRaw] = useState(() => OPEN.has(round?.id));
  const setOpen = v => { if (v) OPEN.add(round.id); else OPEN.delete(round.id); setOpenRaw(v); };
  const on = !!round?.shared && !round.shared.ended && round.status === 'active';
  const ctx = roundTalk(round, state);
  useTalkSync(on ? [ctx.key] : [], { live: true });
  if (!on) return null;
  const rows = state.talk?.[ctx.key] || {};
  const comments = commentsOn(rows, 'round');
  const reacts = reactionsOn(rows, 'round');
  if (!comments.length && !reacts.length) return null;
  const last = comments.at(-1);
  const who = last ? talkName(state, last, { me: ctx.who, seatName: ctx.seatName }) : null;
  const emojis = reacts.map(r => `${r.emoji}${r.count > 1 ? ` ${r.count}` : ''}`).join('  ');
  const more = [comments.length > 1 ? `${comments.length} comments` : null, emojis || null].filter(Boolean).join(' · ');
  return (
    <>
      <button className="seat-req gallery-bar" onClick={() => setOpen(true)}
        aria-label={`Trash talk${last ? `. ${who}: ${last.body}` : ''}${more ? `. ${more}` : ''}. Open it`}>
        <Icon name="chat-circle-dots" fill />
        <span className="sr-text">
          <span className="gb-line">{last ? <><strong>{who}</strong>: {last.body}</> : <strong>{reacts.map(r => emojiOf(r.key)).join(' ')}</strong>}</span>
          <span className="sr-sub">{more ? `${more} · ` : ''}Tap for the trash talk</span>
        </span>
        <Icon name="caret-right" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Trash talk">
        <TalkSection ctx={ctx} on="round" title="This round" />
      </Sheet>
    </>
  );
}
