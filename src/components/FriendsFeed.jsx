// Friends' rounds in the feed: a card for each (live with Watch, or finished), Up next's Friends
// section, and the line that says what the feed can see (see lib/friend-feed.js and lib/feed-sync.js).
import { Spot } from './Spot.jsx';
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';
import { friendsLine, statusLine, upNextFriends } from '../lib/friend-feed.js';
import { useFriendRounds, watchRound } from '../lib/feed-sync.js';
import { accountsEnabled } from '../lib/cloud.js';

/**
 * One friend's round: what's on ("Live · Hole 8 of 18"), the game and course, who's up and who you
 * know in it. A live one you don't watch yet has Watch under it.
 */
export function FriendRoundCard({ view }) {
  const nav = useNav();
  const live = view.status === 'live';
  const watch = () => {
    // A round you only watch from a code is already following live on this phone
    if (view.source !== 'watching') watchRound(view.code);
    nav.push(...view.target);
  };
  const card = (
    <button className="upcoming-card fr-card" onClick={() => nav.push(...view.target)}
      aria-label={`${statusLine(view)}. ${view.title}. ${view.line}. ${friendsLine(view)}${view.following ? '. You’re watching' : ''}`}>
      <div className="row-main">
        <div className={`eyebrow fr-eyebrow ${live ? '' : 'done'}`}>
          {live && <span className="fr-dot" aria-hidden="true" />}{statusLine(view)}{view.following && live ? ' · Watching' : ''}
        </div>
        <div className="uc-title d">{view.title}</div>
        <div className="fr-line">{view.line}</div>
        <div className="uc-sub">{friendsLine(view)}</div>
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  if (!live || view.following || view.source === 'watching') return <div className="uc-wrap">{card}</div>;
  return (
    <div className="uc-wrap">
      {card}
      <button className="uc-preview fr-watch" onClick={watch}>
        <Icon name="eye" fill />
        <span className="row-main"><b>Watch</b> <span className="uc-pv-sub">{view.talk === false ? 'Follow along live' : 'Follow along live, cheer and trash talk'}</span></span>
        <Icon name="caret-right" />
      </button>
    </div>
  );
}

/** What the feed can see right now, when it isn't everything (signed out, not switched on, no signal). */
export function FeedStatusNote({ status, onSignIn = null }) {
  if (status === 'signed-out' && accountsEnabled) {
    return (
      <div className="fr-note">
        <Icon name="user-circle" fill />
        <span className="row-main">Sign in to see friends’ rounds you’re not in. Until then this shows what’s on this phone.</span>
        {onSignIn && <button className="pill-btn" onClick={onSignIn}>Sign in</button>}
      </div>
    );
  }
  const text = status === 'off' ? 'Friends’ rounds you’re not in show up here once the feed is switched on. For now it’s what’s on this phone.'
    : status === 'offline' ? 'No signal. This is what the feed had last time.'
    : status === 'error' ? 'Couldn’t reach the feed just now. This is what it had last time.'
    : null;
  if (!text) return null;
  return <div className="fr-note"><Icon name={status === 'offline' ? 'wifi-slash' : 'info'} fill /><span className="row-main">{text}</span></div>;
}

/**
 * Up next's Friends section: friends' rounds going on now (the ones you watch first) and any that
 * finished in the last day, then the way into the whole group feed. `show` keeps it off a brand new
 * phone until there's something to see.
 */
export function FriendsUpNext({ show = true }) {
  const nav = useNav();
  const { rounds } = useFriendRounds();
  const list = upNextFriends(rounds);
  if (!show && !list.length) return null;
  return (
    <>
      <div className="sec-label fr-head">Friends{list.length > 0 && <span className="fr-live"><span className="live-dot" aria-hidden="true" />{list.length} playing now</span>}</div>
      {list.map(v => <FriendRoundCard key={v.id} view={v} />)}
      <button className="lately-all fr-all" onClick={() => nav.push('friends')}>
        <Spot kind="crowd" size={40} className="fr-crowd" /> {list.length ? 'The group feed' : 'Friends’ rounds and the group feed'} <Icon name="caret-right" />
      </button>
    </>
  );
}
