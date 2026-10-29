// Friends, in two views: the group feed (friends' rounds going on now with Watch, plans you're
// invited to, and lately: friends' finished rounds, brags, settle-ups, recaps and the trash talk; see
// lib/friend-feed.js and lib/feed-brags.js), and the friends list (everyone you've played with,
// across all your crews, and people your friends played with that you might know; lib/friends-list.js).
import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented } from '../components/ui.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { LatelyList } from '../components/LatelyList.jsx';
import { FeedStatusNote, FriendRoundCard } from '../components/FriendsFeed.jsx';
import { useFriendRounds } from '../lib/feed-sync.js';
import { SignInSheet } from '../components/Account.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { groupFeed } from '../lib/friend-feed.js';
import { feedBrags } from '../lib/feed-brags.js';
import { playedWith, recordLine, suggestedFriends, togetherLine } from '../lib/friends-list.js';
import { followThread, recentTalkKeys } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

const VIEWS = [{ value: 'feed', label: 'Feed' }, { value: 'list', label: 'Friends' }];

export default function Friends({ view: opened = 'feed' }) {
  const nav = useNav();
  const state = useStore();
  const { rounds, feed } = useFriendRounds();
  const [view, setView] = useState(opened === 'list' ? 'list' : 'feed');
  const [signingIn, setSigningIn] = useState(false);
  return (
    <Screen>
      <Header title="Friends" onBack={nav.pop} />
      <div className="scroll">
        <Segmented label="Show" className="press-mode-row fr-views" btn="pm-btn" value={view} onChange={setView} options={VIEWS} />
        <FeedStatusNote status={feed.status} onSignIn={() => setSigningIn(true)} />
        {view === 'list' ? <FriendsList state={state} rounds={rounds} /> : <GroupFeed state={state} rounds={rounds} />}
        <div className="fr-privacy">
          <p className="field-help">
            {view === 'list'
              ? 'Suggestions come from your friends’ rounds that reached your feed: only people with an account, and only when their profile setting let that round reach you. Only you keeps someone out.'
              : 'Friends show up here by their profile setting. Only you keeps someone out, and amounts show only for people who turned on Show my money. You show up for your friends the same way.'}
          </p>
          <button className="text-link fr-privacy-link" onClick={() => nav.push('profile')}><Icon name="lock-simple" /> Your profile setting</button>
        </div>
      </div>
      <SignInSheet open={signingIn} source="friends" onClose={() => setSigningIn(false)} title="See friends’ rounds" text="Sign in to see the rounds people you’ve played with are playing, even ones you’re not in, and keep your own rounds safe." />
    </Screen>
  );
}

/** The group feed: live rounds, plans you're invited to, and lately (with the brags among them). */
function GroupFeed({ state, rounds }) {
  const { live, plans, lately } = useMemo(() => {
    const g = groupFeed(state, { rounds });
    const brags = feedBrags(state, { rounds });
    return { ...g, lately: [...brags, ...g.lately].sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id))) };
  }, [state, rounds]);
  // The talk on your rounds and plans, and on the friends' rounds you watch
  useTalkSync([...recentTalkKeys(state), ...rounds.filter(v => v.following && v.talk !== false).map(v => followThread(v.code))]);
  if (!live.length && !plans.length && !lately.length) {
    return <Empty illo="tumbleweed" title="Quiet out there" text="When people you’ve played with tee off, their rounds show up here live, even ones you’re not in. Plans you’re invited to, big wins, birdie runs, settle-ups and trash talk show up too." />;
  }
  return (
    <>
      {live.length > 0 && <div className="sec-label">Playing now</div>}
      {live.map(v => <FriendRoundCard key={v.id} view={v} />)}
      {plans.length > 0 && <div className="sec-label">Coming up</div>}
      {plans.length > 0 && <LatelyList items={plans} />}
      {lately.length > 0 && <div className="sec-label">Lately</div>}
      {lately.length > 0 && <LatelyList items={lately} />}
    </>
  );
}

/** Everyone you've played with, then people one step out. */
function FriendsList({ state, rounds }) {
  const nav = useNav();
  const friends = useMemo(() => playedWith(state), [state]);
  const suggested = useMemo(() => suggestedFriends(state, rounds), [state, rounds]);
  return (
    <>
      <div className="sec-label">Played with{friends.length > 0 ? ` · ${friends.length}` : ''}</div>
      {friends.length === 0 && (
        <Empty illo="crowd" title="Nobody yet" text="Everyone you finish a round with shows up here, from every crew, with your record against them." />
      )}
      {/* One card of rows with hairlines, like the Players list beside it (players-7) */}
      {friends.length > 0 && <div className="fr-list">{friends.map(f => {
        const record = recordLine(f);
        return (
          <button key={f.id} className="set-row person-row fr-friend" onClick={() => nav.push('person', { id: f.id })}
            aria-label={[f.name, togetherLine(f), record, f.crews.length ? `In ${f.crews.join(', ')}` : null].filter(Boolean).join('. ')}>
            <Avatar id={f.id} name={f.name} />
            <div className="row-main">
              <div className="set-name fr-person">{f.name}</div>
              <div className="set-sub">{togetherLine(f)}</div>
              {(record || f.crews.length > 0) && <div className="set-sub">{[record, f.crews.join(', ')].filter(Boolean).join(' · ')}</div>}
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        );
      })}</div>}
      {suggested.length > 0 && (
        <>
          <div className="sec-label">Suggested</div>
          <p className="field-help pad fr-sugg-help">People your friends played with lately. Tap one to see the round.</p>
          <div className="fr-list">{suggested.map(s => (
            <button key={s.key} className="set-row person-row fr-friend" onClick={() => nav.push(...s.target)} aria-label={`${s.name.replace(/\.$/, '')}, ${s.viaText}. ${s.sub}`}>
              <Avatar id={s.seat} name={s.name} />
              <div className="row-main">
                <div className="set-name fr-person">{s.name}</div>
                <div className="set-sub fr-via">{s.viaText}</div>
                <div className="set-sub">{s.sub}</div>
              </div>
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>
          ))}</div>
        </>
      )}
    </>
  );
}
