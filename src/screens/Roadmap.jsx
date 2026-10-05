// The roadmap: what's planned, what's being built and what shipped, made from ROADMAP.md when the
// app is built (roadmap-public.js). Vote for what you want next (one vote each), talk about it, and
// see your own ideas from "Suggest something". From Settings, from Suggest something, after sending
// an idea (it opens on yours), and on the web at /roadmap for anyone, read only, with no sign-in.
import { useEffect, useMemo, useRef, useState } from 'react';
import BASE from 'virtual:roadmap';
import { Avatar } from '../components/Avatar.jsx';
import { Header, Icon, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { SignInSheet } from '../components/Account.jsx';
import { useNav } from '../lib/nav.js';
import { useAccount } from '../lib/cloud.js';
import {
  ANON_NAME, STATUS_LABEL, agoLabel, canVote, commentCount, myIdeas, myVote, roadmapItems, section, shippedLabel,
  tabFor, voteCount,
} from '../lib/roadmap.js';
import { addComment, deleteComment, loadComments, myCommentName, refreshRoadmap, toggleRoadmapVote, useRoadmap } from '../lib/roadmap-sync.js';

/** Shipped is long, so it starts with the newest few. */
const SHIPPED_FIRST = 20;
/** Where an id sits in a held order; anything new goes after. */
const place = (order, id) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };

/**
 * `highlight` opens on that item (or your idea) and marks it; `sent` ('sent' | 'queued') says thanks
 * for an idea just sent; `web` is the read-only page; `ids` shows each item's id (for Trevor).
 */
export default function Roadmap({ highlight = null, sent = null, web = false, ids = false, onStart = null }) {
  const nav = useNav();
  const { showToast } = useUI();
  const { local, server } = useRoadmap();
  const acct = useAccount();
  const items = useMemo(() => roadmapItems(BASE, server.requests), [server.requests]);
  const ideas = useMemo(() => (web ? [] : myIdeas(local, server.mine, items)), [web, local, server.mine, items]);
  const [tab, setTab] = useState(() => (highlight ? tabFor(items, highlight, ideas) : 'planned'));
  // Opening on an item shows the whole of Shipped, so an older one is there to scroll to
  const [allShipped, setAllShipped] = useState(() => !!highlight);
  const [talking, setTalking] = useState(null);
  const [toldLocal, setToldLocal] = useState(false);
  // Once you vote, the list holds its order for this visit, so the card you tapped doesn't jump away
  const [held, setHeld] = useState({});
  const scrolled = useRef(false);

  useEffect(() => { refreshRoadmap(); }, []);

  // Open on the highlighted item: once, after it's on screen
  useEffect(() => {
    if (!highlight || scrolled.current) return;
    const el = document.getElementById(`rm-${highlight}`) || document.getElementById(`rm-idea-${highlight.replace(/^q-/, '')}`);
    if (!el) return;
    scrolled.current = true;
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  });

  const ctx = { counts: server.counts, local, myVotes: server.myVotes };
  const sorted = section(items, tab, ctx);
  const rows = held[tab] ? [...sorted].sort((a, b) => place(held[tab], a.id) - place(held[tab], b.id)) : sorted;
  const shown = tab === 'shipped' && !allShipped ? rows.slice(0, SHIPPED_FIRST) : rows;
  const count = s => items.filter(i => i.status === s).length;
  // Your ideas show on their item too: listed as its own, or folded into one already there
  const yours = new Set(ideas.filter(i => i.state !== 'waiting').map(i => i.itemId));
  const waiting = ideas.filter(i => i.state === 'waiting');

  const vote = item => {
    if (!held[tab]) setHeld(h => ({ ...h, [tab]: rows.map(i => i.id) }));
    const on = toggleRoadmapVote(item.id);
    // Signed out, the vote stays on this phone: say so once a visit, with the way to make it count
    if (on && !acct.user && !toldLocal) {
      setToldLocal(true);
      showToast('Voted. Sign in from Settings so it counts for everyone');
    }
  };

  const goTo = idea => {
    const item = items.find(i => i.id === idea.itemId);
    if (!item) return;
    setTab(item.status);
    if (item.status === 'shipped') setAllShipped(true);
    requestAnimationFrame(() => document.getElementById(`rm-${item.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  return (
    <Screen className="roadmap">
      <Header title="Roadmap" onBack={web ? null : nav.pop} small={web}
        right={web ? <a className="header-btn rm-open" href="/" onClick={e => { if (onStart) { e.preventDefault(); onStart(); } }}>Open the app</a> : null} />
      <div className="scroll">
        <p className="rm-intro">What’s coming next, picked by the golfers who use it. {web ? 'Vote and comment in the app.' : 'Vote for the ones you want most.'}</p>
        {sent && (
          <p className="hint-card rm-thanks" role="status">
            <Icon name="check-circle" fill />
            <span>{sent === 'sent'
              ? 'Thanks, it’s in. Your idea is at the top. Once we’ve had a look, everyone can vote for it.'
              : 'No signal right now, so your idea is saved on your phone and sends by itself. It’s at the top for now.'}</span>
          </p>
        )}

        <div className="rm-tabs">
          <Segmented label="Roadmap" className="press-mode-row" btn="pm-btn" value={tab} onChange={setTab}
            options={['planned', 'progress', 'shipped'].map(s => ({ value: s, label: <>{STATUS_LABEL[s]} <span className="rm-n">{count(s)}</span></>, aria: `${STATUS_LABEL[s]}, ${count(s)}` }))} />
        </div>

        {tab === 'planned' && ideas.length > 0 && (
          <>
            <div className="sec-label">Your ideas</div>
            <ul className="rm-ideas" role="list">
              {ideas.map(i => <IdeaRow key={i.id} idea={i} items={items} highlight={highlight} onGo={goTo} />)}
            </ul>
            {waiting.length > 0 && <p className="rm-note">Only you see an idea until it’s on the roadmap. Then everyone can vote for it.</p>}
            <div className="sec-label">Everything planned</div>
          </>
        )}

        {shown.length === 0 && <p className="rm-empty">{tab === 'progress' ? 'Nothing in the works right now. Check what’s planned.' : 'Nothing here yet.'}</p>}
        <ol className="rm-list" role="list">
          {shown.map(item => (
            <RoadmapCard key={item.id} item={item} web={web} ids={ids} mine={yours.has(item.id)} flash={highlight === item.id}
              voted={myVote(local, server.myVotes, item.id)} votes={voteCount(item.id, ctx)} comments={commentCount(item.id, server.counts)}
              commentsOn={server.state !== 'off'} onVote={() => vote(item)} onTalk={() => setTalking(item)} />
          ))}
        </ol>
        {tab === 'shipped' && !allShipped && rows.length > SHIPPED_FIRST && (
          <button className="lately-all rm-all" onClick={() => setAllShipped(true)}>Show all {rows.length} <Icon name="caret-down" /></button>
        )}

        {web ? (
          <a className="set-row rm-cta" href="/" onClick={e => { if (onStart) { e.preventDefault(); onStart(); } }}>
            <div className="set-icon"><Icon name="golf" fill /></div>
            <div className="row-main"><div className="set-name">Got an idea?</div><div className="set-sub">Open the app to vote, comment and send one in</div></div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </a>
        ) : (
          <button className="set-row rm-cta" onClick={() => nav.push('suggest')}>
            <div className="set-icon"><Icon name="lightbulb" fill /></div>
            <div className="row-main"><div className="set-name">Got an idea?</div><div className="set-sub">A game, a feature, anything. It lands right here</div></div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}
      </div>
      {talking && <TalkSheet item={talking} web={web} serverOn={server.state !== 'off'} onClose={() => setTalking(null)} />}
    </Screen>
  );
}

/** One item: its area, title and blurb, comments, and the vote on the right. */
function RoadmapCard({ item, web, ids, mine, flash, voted, votes, comments, commentsOn, onVote, onTalk }) {
  const votable = canVote(item, { web });
  const voteLabel = `${votes} ${votes === 1 ? 'vote' : 'votes'}`;
  return (
    <li id={`rm-${item.id}`} className={`rm-card ${flash ? 'flash' : ''}`}>
      <div className="rm-main">
        <span className="eyebrow rm-area">{item.area}</span>
        <h3 className="rm-title">{item.title}</h3>
        {item.blurb && <p className="rm-blurb">{item.blurb}</p>}
        <div className="rm-meta">
          {item.status === 'shipped' && <span className="rm-when"><Icon name="check-circle" fill /> {shippedLabel(item.shipped)}</span>}
          {item.status === 'progress' && <span className="rm-when building"><Icon name="hammer" fill /> Being built</span>}
          {mine && <span className="rm-tag">Your idea</span>}
          {(commentsOn || comments > 0) && (
            <button type="button" className="rm-talk" onClick={onTalk} aria-label={comments ? `${comments} ${comments === 1 ? 'comment' : 'comments'} on ${item.title}` : `Comment on ${item.title}`}>
              <Icon name="chat-circle" fill /> {comments || (web ? 'Comments' : 'Comment')}
            </button>
          )}
        </div>
        {ids && <code className="rm-id">{item.id}</code>}
      </div>
      {votable ? (
        <button type="button" className={`rm-vote ${voted ? 'on' : ''}`} aria-pressed={voted} onClick={onVote}
          aria-label={voted ? `You voted for ${item.title}, ${voteLabel}. Tap to take it back` : `Vote for ${item.title}, ${voteLabel}`}>
          {/* Voted: the plain bold check, never the filled square that reads as a checkbox */}
          <Icon name={voted ? 'check' : 'arrow-fat-up'} fill={!voted} />
          <span className="rm-count">{votes}</span>
        </button>
      ) : votes > 0 ? (
        <div className="rm-vote static"><Icon name="arrow-fat-up" fill /><span className="rm-count" aria-hidden="true">{votes}</span><span className="sr-only">{voteLabel}</span></div>
      ) : null}
    </li>
  );
}

const IDEA_STATE = {
  waiting: { tag: 'Waiting for a look', wait: true },
  listed: { tag: 'On the roadmap' },
  merged: { tag: 'Part of the roadmap' },
};

/** One of your ideas, and what became of it. */
function IdeaRow({ idea, items, highlight, onGo }) {
  const linked = idea.state !== 'waiting' ? items.find(i => i.id === idea.itemId) : null;
  const st = IDEA_STATE[idea.state];
  const flash = highlight && (highlight === idea.itemId || highlight === `q-${idea.id}`);
  const body = (
    <>
      <span className={`rm-idea-ic ${idea.kind}`} aria-hidden="true"><Icon name={idea.kind === 'game' ? 'cards' : idea.kind === 'course' ? 'map-trifold' : 'lightbulb'} fill /></span>
      <span className="row-main">
        <span className="rm-idea-title">{idea.title}</span>
        <span className="rm-idea-sub">
          <span className={`rm-tag ${st.wait ? 'wait' : ''}`}>{st.tag}</span>
          {idea.state === 'merged' && linked && <span className="rm-idea-in">in “{linked.title}”</span>}
        </span>
      </span>
      {linked && <Icon name="caret-right" />}
    </>
  );
  return (
    <li id={`rm-idea-${idea.id}`} className={flash ? 'flash' : ''}>
      {linked ? <button type="button" className="rm-idea" onClick={() => onGo(idea)}>{body}</button> : <div className="rm-idea">{body}</div>}
    </li>
  );
}

/** The talk on one item: everyone reads it; signed-in people in the app add to it. */
function TalkSheet({ item, web, serverOn, onClose }) {
  const { showToast } = useUI();
  const acct = useAccount();
  // The sheet opens for one item and closes with it, so these start from what's known when it opens
  const [rows, setRows] = useState(() => (serverOn ? null : []));
  const [state, setState] = useState(() => (serverOn ? 'loading' : 'off'));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const name = myCommentName();

  useEffect(() => {
    if (!serverOn) return undefined;
    let live = true;
    loadComments(item.id).then(r => { if (live) { setRows(r.rows); setState(r.state); } });
    return () => { live = false; };
  }, [item.id, serverOn]);

  const send = async e => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const row = await addComment(item.id, text);
      setRows(r => [...(r || []), row]);
      setText('');
    } catch (err) { showToast(err.message); }
    setBusy(false);
  };
  const remove = async c => {
    try { await deleteComment(item.id, c.id); setRows(r => r.filter(x => x.id !== c.id)); showToast('Comment deleted'); }
    catch (err) { showToast(err.message); }
  };

  return (
    <Sheet open onClose={onClose} title={item.title}>
      <div className="rm-sheet">
        {state === 'loading' && <p className="talk-empty">Loading…</p>}
        {state === 'off' && <p className="talk-empty">Comments open soon. Votes count already.</p>}
        {(state === 'offline' || state === 'error') && <p className="talk-empty">Couldn’t load the comments. Check your signal and try again.</p>}
        {state === 'on' && rows.length === 0 && <p className="talk-empty">No comments yet. {web ? 'Start the conversation in the app.' : 'Say what you’d use it for.'}</p>}
        {rows?.length > 0 && (
          <ul className="talk-list" role="list">
            {rows.map(c => (
              <li key={c.id} className={`talk-item ${c.mine ? 'mine' : ''}`}>
                <Avatar name={c.name || ANON_NAME} size="sm" />
                <div className="ti-main">
                  <div className="ti-head">
                    <span className="ti-name">{c.mine ? 'You' : c.name || ANON_NAME}</span>
                    <span className="ti-when">{agoLabel(c.at)}</span>
                  </div>
                  <p className="ti-body">{c.body}</p>
                </div>
                {c.mine && !web && <button type="button" className="icon-btn sm ti-del" onClick={() => remove(c)} aria-label="Delete your comment"><Icon name="trash" /></button>}
              </li>
            ))}
          </ul>
        )}

        {state === 'on' && !web && (acct.user ? (
          <>
            <form className="talk-compose" onSubmit={send}>
              <label className="sr-only" htmlFor={`rm-c-${item.id}`}>Add a comment</label>
              <input id={`rm-c-${item.id}`} className="text-input" value={text} maxLength={500} onChange={e => setText(e.target.value)}
                placeholder="Add a comment…" autoComplete="off" enterKeyHint="send" />
              <button type="submit" className="icon-btn talk-send" disabled={!text.trim() || busy} aria-label="Post comment"><Icon name="paper-plane-right" fill /></button>
            </form>
            <p className="field-help">{name ? `Posting as ${name}. Everyone can read it.` : `Posting as “${ANON_NAME}”. Your first name shows when your profile is open to everyone.`}</p>
          </>
        ) : (
          <div className="rm-signin">
            <p className="field-help">Sign in to join the conversation. Anyone can read it.</p>
            <button type="button" className="rc-btn ink" onClick={() => setSigningIn(true)}><Icon name="sign-in" /> Sign in to comment</button>
          </div>
        ))}
        {web && <p className="field-help">Open the app to vote and comment.</p>}
      </div>
      {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} title="Sign in to comment" text="Sign in once and your votes count for everyone, and you can join the conversation on any idea." />}
    </Sheet>
  );
}
