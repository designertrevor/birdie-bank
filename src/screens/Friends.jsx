// The group feed: friends' rounds going on now (with Watch), plans you're invited to, and lately:
// friends' finished rounds, settle-ups, recaps and the trash talk (see lib/friend-feed.js).
import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { LatelyList } from '../components/LatelyList.jsx';
import { FeedStatusNote, FriendRoundCard } from '../components/FriendsFeed.jsx';
import { useFriendRounds } from '../lib/feed-sync.js';
import { SignInSheet } from '../components/Account.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { groupFeed } from '../lib/friend-feed.js';
import { followThread, recentTalkKeys } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';

export default function Friends() {
  const nav = useNav();
  const state = useStore();
  const { rounds, feed } = useFriendRounds();
  const [signingIn, setSigningIn] = useState(false);
  const { live, plans, lately } = useMemo(() => groupFeed(state, { rounds }), [state, rounds]);
  // The talk on your rounds and plans, and on the friends' rounds you watch
  useTalkSync([...recentTalkKeys(state), ...rounds.filter(v => v.following && v.talk !== false).map(v => followThread(v.code))]);
  const empty = !live.length && !plans.length && !lately.length;
  return (
    <Screen>
      <Header title="Friends" onBack={nav.pop} />
      <div className="scroll">
        <FeedStatusNote status={feed.status} onSignIn={() => setSigningIn(true)} />
        {empty ? (
          <Empty illo="sleep" title="Quiet out there" text="When people you’ve played with tee off, their rounds show up here live, even ones you’re not in. Plans you’re invited to, settle-ups and trash talk show up too." />
        ) : (
          <>
            {live.length > 0 && <div className="sec-label">Playing now</div>}
            {live.map(v => <FriendRoundCard key={v.id} view={v} />)}
            {plans.length > 0 && <div className="sec-label">Coming up</div>}
            {plans.length > 0 && <LatelyList items={plans} />}
            {lately.length > 0 && <div className="sec-label">Lately</div>}
            {lately.length > 0 && <LatelyList items={lately} />}
          </>
        )}
        <div className="fr-privacy">
          <p className="field-help">Friends show up here by their profile setting. Only you keeps someone out, and amounts show only for people who turned on Show my money. You show up for your friends the same way.</p>
          <button className="text-link fr-privacy-link" onClick={() => nav.push('profile')}><Icon name="lock-simple" /> Your profile setting</button>
        </div>
      </div>
      <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} title="See friends’ rounds" text="Sign in to see the rounds people you’ve played with are playing, even ones you’re not in, and keep your own rounds safe." />
    </Screen>
  );
}
