// The parts of Up next that load just after it: the day-after recap, the trips on now and the
// plans under them, challenges, lines for the group text, Lately and the Tab at a glance. They need
// the money (ledger.js, trips.js), the moments, the challenge rules and the trash talk, which the
// first screen shouldn't wait for (see UpNext.jsx), and each one works out its own list.
import { useEffect, useMemo } from 'react';
import { Icon } from './ui.jsx';
import { Later, part } from './Later.jsx';
import { RoundRow } from './RoundRow.jsx';
import { PlansAndNext, UpcomingCard } from './UpNextPlans.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { currentRecap, recapRound } from '../lib/recap.js';
import { currentTrips } from '../lib/trips.js';
import { upcomingPlans } from '../lib/plan-basics.js';
import { lastResult, myTab } from '../lib/history.js';
import { myIds } from '../lib/format.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/shared-tab.js';
import { openRewards, rewardLineText } from '../lib/play-for.js';
import { money } from '../lib/golf.js';
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
import { useBigSync } from '../lib/big-sync.js';

const LATELY_ON_HOME = 3;
const TripUpNext = part(() => import('./Trips.jsx'), 'TripUpNext');

/** The trips on now (trips.js), where you stand on each, with its planned rounds grouped under it. */
export function TripsNow() {
  const state = useStore();
  const onNow = useMemo(() => currentTrips(state), [state]);
  if (!onNow.length) return null;
  return <Later>{onNow.map(t => <TripUpNext key={t.trip.id} status={t} renderPlan={p => <UpcomingCard key={p.id} plan={p} />} />)}</Later>;
}

/** The upcoming rounds and the next-round card when a trip is about: the plans a trip on now groups are left to it. */
export function PlansLater({ live, last, anyChallenges, onJoin }) {
  const state = useStore();
  const onNow = useMemo(() => currentTrips(state), [state]);
  const onTrip = new Set(onNow.flatMap(t => t.planned.map(p => p.id)));
  const plans = upcomingPlans(state).filter(p => !onTrip.has(p.id));
  return <PlansAndNext plans={plans} onNow={onNow} live={live} last={last} anyChallenges={anyChallenges} onJoin={onJoin} />;
}

/** The Tab at a glance (what you're owed and owe) and the last round out, for anyone with a finished round. */
export function TabGlance() {
  const nav = useNav();
  const state = useStore();
  const last = lastResult(state);
  if (!last) return null;
  const tab = myTab(state);
  // Square on money can still leave a reward to sort out ("You owe Sam lunch"), which isn't money
  const rewards = tab.people ? [] : openRewards(state, { ids: myIds(state), canon: canonicalOf(state) });
  const squareText = !rewards.length ? 'You’re all square. Nobody owes you, you owe nobody.'
    : `Square on money. ${rewards.length === 1 ? `${rewardLineText(rewards[0], id => nameOf(state, id))}.` : `${rewards.length} rewards to sort out.`}`;
  // The recap already shows the last round, so it isn't there twice
  const recapId = recapRound(state)?.id ?? null;
  return (
    <>
      <div className="sec-label">The Tab</div>
      <button className="tab-glance" onClick={() => nav.setTab('ledger')} aria-label={tab.people ? `The Tab: owed to you ${money(tab.owed)}, you owe ${money(tab.owe)}` : `The Tab: ${squareText}`}>
        {tab.people ? (
          <>
            <div><div className="bl">Owed to you</div><div className={`lr-big ${tab.owed ? 'pos' : ''}`}>{tab.owed ? money(tab.owed) : '–'}</div></div>
            <div><div className="bl">You owe</div><div className={`lr-big ${tab.owe ? 'neg' : ''}`}>{tab.owe ? money(tab.owe) : '–'}</div></div>
          </>
        ) : (
          <div className="tg-square"><Icon name={rewards.length ? 'gift' : 'handshake'} fill /> <span>{squareText}</span></div>
        )}
        <span className="chevron"><Icon name="caret-right" /></span>
      </button>

      {recapId !== last.round.id && (
        <>
          <div className="sec-label">Last time out</div>
          <RoundRow round={last.round} state={state} className="card" withYear />
        </>
      )}
    </>
  );
}

/**
 * Keeps Up next fresh, showing nothing: answers, votes, payments and challenges that came in since
 * last time, trip plans and a team points trip's matches from other phones.
 */
export function UpNextSync() {
  useStore(); // the trip and cup hooks read the state as it is on each render, so this one follows it as Up next did
  useTripPlans();
  useCupSync();
  // A Big Game's other groups (big-sync.js)
  useBigSync();
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
 * Lately: payments, answers, challenges and the trash talk. The recap's round isn't in it too
 * (Lately skips the newest finished round, which can be one you only watched).
 */
export function LatelySection() {
  const nav = useNav();
  const state = useStore();
  const recapId = recapRound(state)?.id ?? null;
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
