// Trash talk: reactions, comments and quick jabs on a finished round, its settle-up lines, its side
// bets between two players, and an upcoming round (see lib/talk.js and lib/talk-sync.js).
import { useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { Avatar } from './Avatar.jsx';
import { useStore } from '../lib/store.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { agoLabel } from '../lib/lately.js';
import { MAX_BODY, REACTIONS, commentsOn, jabsFor, reactionsOn, talkName } from '../lib/talk.js';
import { talkCounts } from '../lib/talk-counts.js';
import { postComment, react, takeBack, useTalkReach } from '../lib/talk-sync.js';

/** The line under the talk that says who sees it. */
function ReachNote({ ctx, reach }) {
  if (!ctx.who) return <p className="field-help pad">{ctx.kind === 'plan' ? 'Pick who you are on the plan to join in.' : 'You watched this one, so the talk is the players’.'}</p>;
  if (!reach.can) return <p className="field-help pad">Only the players’ phones can join in on this round.</p>;
  // A round never shared (or a plan with no link) is on this phone whether comments are on or not
  if (!reach.linked) {
    return <p className="field-help pad">{ctx.kind === 'plan'
      ? 'Only on your phone until the plan has its group link.'
      : 'Only on this phone: this round wasn’t shared live, so the others can’t see it.'}</p>;
  }
  if (reach.off) return <p className="field-help pad">Saved on this phone. The others see it once comments are switched on.</p>;
  return <p className="field-help pad">Everyone in the {ctx.kind === 'plan' ? 'plan' : 'round'} sees it. Keep it friendly.</p>;
}

/** All five reactions, each with its count, one tap to add yours or take it back. */
function ReactionPills({ ctx, on, rows, canTap }) {
  const state = useStore();
  const canon = canonicalOf(state);
  const picked = Object.fromEntries(reactionsOn(rows, on, { me: ctx.who, canon }).map(r => [r.key, r]));
  return (
    <div className="talk-reacts" role="group" aria-label="Reactions">
      {REACTIONS.map(r => {
        const p = picked[r.key];
        const label = `${r.label}${p ? `, ${p.count}` : ''}${p?.mine ? ', yours' : ''}`;
        const body = <><span className="tr-emoji" aria-hidden="true">{r.emoji}</span>{p && <span className="tr-n">{p.count}</span>}</>;
        return canTap
          ? <button key={r.key} type="button" className={`talk-react ${p?.mine ? 'on' : ''}`} aria-pressed={!!p?.mine} aria-label={label}
              onClick={() => react(ctx.key, { on, who: ctx.who, name: ctx.myName, emoji: r.key })}>{body}</button>
          : p ? <span key={r.key} className="talk-react static" aria-label={label}>{body}</span> : null;
      })}
    </div>
  );
}

/** The comments on one thing, oldest first, with Delete on your own. */
function CommentList({ ctx, on, rows }) {
  const state = useStore();
  const { showToast } = useUI();
  const list = commentsOn(rows, on);
  if (!list.length) return null;
  const remove = c => {
    const undo = takeBack(ctx.key, c.id);
    if (undo) showToast('Comment deleted', { label: 'Undo', run: undo });
  };
  return (
    <ul className="talk-list" role="list">
      {list.map(c => {
        const name = talkName(state, c, { me: ctx.who, seatName: ctx.seatName });
        return (
          <li key={c.id} className={`talk-item ${name === 'You' ? 'mine' : ''}`}>
            <Avatar id={c.who} name={c.name || name} size="sm" />
            <div className="ti-main">
              <div className="ti-head">
                <span className="ti-name">{name}</span>
                {c.jab && <span className="ti-jab"><Icon name="lightning" fill /> Jab</span>}
                <span className="ti-when">{agoLabel(c.at)}</span>
              </div>
              <p className="ti-body">{c.body}</p>
            </div>
            {c.mine && <button type="button" className="icon-btn sm ti-del" onClick={() => remove(c)} aria-label="Delete your comment"><Icon name="trash" /></button>}
          </li>
        );
      })}
    </ul>
  );
}

/** Write a comment, or pick a jab from the list (one tap sends it, with Undo). */
function Composer({ ctx, on }) {
  const { showToast } = useUI();
  const [text, setText] = useState('');
  const send = e => {
    e.preventDefault();
    if (postComment(ctx.key, { on, who: ctx.who, name: ctx.myName, body: text })) setText('');
  };
  const jab = j => {
    const id = postComment(ctx.key, { on, who: ctx.who, name: ctx.myName, jab: j.key });
    if (id) showToast('Jab sent', { label: 'Undo', run: () => takeBack(ctx.key, id) });
  };
  return (
    <>
      <div className="talk-jabs" role="group" aria-label="Quick jabs">
        {jabsFor(on, { money: ctx.moneyOn ? ctx.moneyOn(on) : true }).map(j => <button key={j.key} type="button" className="pill-btn sm talk-jab" onClick={() => jab(j)}>{j.text}</button>)}
      </div>
      <form className="talk-compose" onSubmit={send}>
        <label className="sr-only" htmlFor={`talk-${ctx.key}-${on}`}>Add a comment</label>
        <input id={`talk-${ctx.key}-${on}`} className="text-input" value={text} maxLength={MAX_BODY} onChange={e => setText(e.target.value)}
          placeholder="Say something…" autoComplete="off" enterKeyHint="send" />
        <button type="submit" className="icon-btn talk-send" disabled={!text.trim()} aria-label="Post comment"><Icon name="paper-plane-right" fill /></button>
      </form>
    </>
  );
}

function useCtx(ctx) {
  const rows = useStore(s => s.talk?.[ctx.key]) || {};
  const reach = useTalkReach(ctx.key);
  return { rows, reach, canTalk: !!ctx.who && reach.can };
}

/**
 * The talk on a whole round or plan: the reactions, the comments, the jabs and a box to write in.
 * `on` is 'round' or 'plan'.
 */
export function TalkSection({ ctx, on, title = 'Trash talk' }) {
  const { rows, reach, canTalk } = useCtx(ctx);
  const quiet = !commentsOn(rows, on).length;
  // Someone who can't join in (a watcher) sees the talk only once there is some
  if (!canTalk && quiet && !reactionsOn(rows, on).length) return null;
  return (
    <section className="talk" aria-label={title}>
      <div className="sec-label">{title}</div>
      <div className="talk-card">
        <ReactionPills ctx={ctx} on={on} rows={rows} canTap={canTalk} />
        <CommentList ctx={ctx} on={on} rows={rows} />
        {quiet && canTalk && <p className="talk-empty">Nobody’s said anything yet. Pick a jab or write your own.</p>}
        {canTalk && <Composer ctx={ctx} on={on} />}
      </div>
      <ReachNote ctx={ctx} reach={reach} />
    </section>
  );
}

/**
 * A small bar under one settle-up line or side bet: its reactions, a button to add one, and its
 * comments in a sheet. `title` names the thing ("Sam pays Mike").
 */
export function TalkBar({ ctx, on, title }) {
  const { rows, reach, canTalk } = useCtx(ctx);
  const [tray, setTray] = useState(false);
  const [open, setOpen] = useState(false);
  const state = useStore();
  const picked = reactionsOn(rows, on, { me: ctx.who, canon: canonicalOf(state) });
  const { comments } = talkCounts(rows, on);
  if (!canTalk && !picked.length && !comments) return null;
  return (
    <div className="talk-bar">
      {picked.map(r => canTalk
        ? <button key={r.key} type="button" className={`talk-react sm ${r.mine ? 'on' : ''}`} aria-pressed={r.mine} aria-label={`${r.label}, ${r.count}${r.mine ? ', yours' : ''}`}
            onClick={() => react(ctx.key, { on, who: ctx.who, name: ctx.myName, emoji: r.key })}><span aria-hidden="true">{r.emoji}</span><span className="tr-n">{r.count}</span></button>
        : <span key={r.key} className="talk-react sm static" aria-label={`${r.label}, ${r.count}`}><span aria-hidden="true">{r.emoji}</span><span className="tr-n">{r.count}</span></span>)}
      {canTalk && (
        <button type="button" className={`talk-react sm add ${tray ? 'on' : ''}`} aria-expanded={tray} aria-label={`React to ${title}`} onClick={() => setTray(t => !t)}>
          <Icon name="smiley" /><Icon name="plus" className="tr-plus" />
        </button>
      )}
      {(canTalk || comments > 0) && (
        <button type="button" className="talk-react sm" onClick={() => setOpen(true)} aria-label={comments ? `${comments} comment${comments === 1 ? '' : 's'} on ${title}` : `Comment on ${title}`}>
          <Icon name="chat-circle" fill={comments > 0} />{comments > 0 && <span className="tr-n">{comments}</span>}
        </button>
      )}
      {tray && canTalk && (
        <div className="talk-tray" role="group" aria-label={`React to ${title}`}>
          {REACTIONS.map(r => {
            const mine = picked.find(p => p.key === r.key)?.mine;
            return <button key={r.key} type="button" className={`talk-react ${mine ? 'on' : ''}`} aria-pressed={!!mine} aria-label={r.label}
              onClick={() => { react(ctx.key, { on, who: ctx.who, name: ctx.myName, emoji: r.key }); setTray(false); }}><span aria-hidden="true">{r.emoji}</span></button>;
          })}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="talk-sheet">
          <ReactionPills ctx={ctx} on={on} rows={rows} canTap={canTalk} />
          <CommentList ctx={ctx} on={on} rows={rows} />
          {!comments && canTalk && <p className="talk-empty">Nothing yet. Pick a jab or write your own.</p>}
          {canTalk && <Composer ctx={ctx} on={on} />}
        </div>
        <ReachNote ctx={ctx} reach={reach} />
      </Sheet>
    </div>
  );
}
