// The parts of Up next that load just after it: the day-after recap, challenges, lines for the group
// text and Lately. They need the moments, the challenge rules and the trash talk, which the first
// screen shouldn't wait for (see UpNext.jsx), and each one works out its own list.
import { useEffect, useMemo } from 'react';
import { Icon } from './ui.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { currentRecap } from '../lib/recap.js';
import { callouts } from '../lib/callouts.js';
import { latelyItems } from '../lib/lately.js';
import { recentTalkKeys, withTalk } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';
import { myChallenges } from '../lib/challenges.js';
import { CalloutsCard, RecapCard } from './Recap.jsx';
import { ChallengesUpNext } from './Challenges.jsx';
import { LatelyList } from './LatelyList.jsx';
import { refreshPlans } from '../lib/plan-sync.js';
import { refreshTab } from '../lib/tab-sync.js';
import { refreshChallenges } from '../lib/challenge-sync.js';
import { useTripPlans } from '../lib/trip-plan-sync.js';
import { useCupSync } from '../lib/cup-sync.js';

const LATELY_ON_HOME = 3;

/**
 * Keeps Up next fresh, showing nothing: answers, votes, payments and challenges that came in since
 * last time, trip plans and a team points trip's matches from other phones.
 */
export function UpNextSync() {
  useStore(); // the trip and cup hooks read the state as it is on each render, so this one follows it as Up next did
  useTripPlans();
  useCupSync();
  useEffect(() => { refreshPlans(); refreshTab(); refreshChallenges(); }, []);
  return null;
}

/** The day after a round: its recap (see recap.js). */
export function RecapSection() {
  const state = useStore();
  const recap = useMemo(() => currentRecap(state), [state]);
  if (!recap) return null;
  return (
    <>
      <div className="sec-label">The recap</div>
      <RecapCard recap={recap} />
    </>
  );
}

/** Challenges you're in that are still going, your call first. */
export function ChallengesSection() {
  const list = useStore(s => myChallenges(s));
  return <ChallengesUpNext list={list} />;
}

/** A few lines for the group text (see callouts.js). */
export function CalloutsSection() {
  const state = useStore();
  const lines = useMemo(() => callouts(state), [state]);
  if (!lines.length) return null;
  return (
    <>
      <div className="sec-label">For the group text</div>
      <CalloutsCard items={lines} />
    </>
  );
}

/**
 * Lately: payments, answers, challenges and the trash talk. The recap's round (`recapId`) isn't in
 * it too (Lately skips the newest finished round, which can be one you only watched).
 */
export function LatelySection({ recapId = null }) {
  const nav = useNav();
  const state = useStore();
  const lately = withTalk(latelyItems(state).filter(i => i.id !== `recap:${recapId}`), state);
  useTalkSync(recentTalkKeys(state));
  if (!lately.length) return null;
  return (
    <>
      <div className="sec-label">Lately</div>
      <LatelyList items={lately.slice(0, LATELY_ON_HOME)} />
      {lately.length > LATELY_ON_HOME && (
        <button className="lately-all" onClick={() => nav.push('lately')}>See all {lately.length} <Icon name="caret-right" /></button>
      )}
    </>
  );
}
