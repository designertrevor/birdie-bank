import { useEffect, useMemo, useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES, holeComplete } from '../lib/round.js';
import { gameLabel, myIds } from '../lib/format.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/shared-tab.js';
import { openRewards, rewardLineText } from '../lib/play-for.js';
import { money } from '../lib/golf.js';
import { RoundRow } from '../components/RoundRow.jsx';
import { activeRounds, lastResult, myTab } from '../lib/history.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { JoinSheet } from '../components/Live.jsx';
import { syncConfigured } from '../lib/sync.js';
import { RSVP_LABEL, countsLine, daysUntil, planChoice, planCounts, upcomingPlans, whenLabel } from '../lib/plans.js';
import { refreshPlans } from '../lib/plan-sync.js';
import { countdownLine, weekdayOf } from '../lib/preview.js';
import { refreshTab } from '../lib/tab-sync.js';
import { latelyItems } from '../lib/lately.js';
import { recentTalkKeys, withTalk } from '../lib/talk.js';
import { useTalkSync } from '../lib/talk-sync.js';
import { LatelyList } from '../components/LatelyList.jsx';
import { updateSafe } from '../lib/app-update.js';
import { applyUpdate, useUpdateReady } from '../lib/sw-update.js';
import { TripSheet, TripUpNext } from '../components/Trips.jsx';
import { currentTrips } from '../lib/trips.js';
import { useTripPlans } from '../lib/trip-plan-sync.js';
import { currentRecap } from '../lib/recap.js';
import { callouts } from '../lib/callouts.js';
import { CalloutsCard, RecapCard } from '../components/Recap.jsx';
import { ChallengesUpNext } from '../components/Challenges.jsx';
import { myChallenges } from '../lib/challenges.js';
import { refreshChallenges } from '../lib/challenge-sync.js';
import { useCupSync } from '../lib/cup-sync.js';

const LATELY_ON_HOME = 3;

/** Home: what's next for you. A round to finish, what you owe and are owed, and how the last one went. */
export default function UpNext() {
  const nav = useNav();
  const state = useStore();
  useTripPlans();
  useCupSync();
  // (A join link opened by someone already set up goes straight to the invite card: see App.)
  const [joining, setJoining] = useState(false);
  const live = activeRounds(state);
  const last = lastResult(state);
  const tab = myTab(state);
  // Square on money can still leave a reward to sort out ("You owe Sam lunch"), which isn't money
  const rewards = tab.people ? [] : openRewards(state, { ids: myIds(state), canon: canonicalOf(state) });
  const squareText = !rewards.length ? 'You’re all square. Nobody owes you, you owe nobody.'
    : `Square on money. ${rewards.length === 1 ? `${rewardLineText(rewards[0], id => nameOf(state, id))}.` : `${rewards.length} rewards to sort out.`}`;
  const hasHistory = !!last;
  // A trip on now leads with where you stand, its planned rounds grouped under it
  const trips = currentTrips(state);
  const onTrip = new Set(trips.flatMap(t => t.planned.map(p => p.id)));
  const plans = upcomingPlans(state).filter(p => !onTrip.has(p.id));
  // The day after a round: its recap, then a few lines for the group text (see recap.js, callouts.js)
  const recap = useMemo(() => currentRecap(state), [state]);
  // The recap's round isn't in Lately too (Lately skips the newest finished round, which can be one you only watched)
  const lately = withTalk(latelyItems(state).filter(i => i.id !== `recap:${recap?.id}`), state);
  const lines = useMemo(() => callouts(state), [state]);
  useTalkSync(recentTalkKeys(state));
  // Challenges you're in that are still going: your call first
  const challenges = myChallenges(state);
  // A new version only shows up here once no round is going on, so a tap never cuts into one
  const updateReady = useUpdateReady() && updateSafe(state);
  // Pick up answers and votes that came in since last time
  useEffect(() => { refreshPlans(); refreshTab(); refreshChallenges(); }, []);

  return (
    <Screen>
      <Header title="Up next" right={<AvatarButton />} />
      <div className="scroll">
        {updateReady && (
          <button className="update-note" onClick={applyUpdate}>
            <Icon name="arrow-clockwise" />
            <span className="row-main"><b>Update ready</b> <span className="un-sub">Tap to refresh</span></span>
          </button>
        )}
        {recap && (
          <>
            <div className="sec-label">The recap</div>
            <RecapCard recap={recap} />
          </>
        )}

        {live.map(r => {
          const played = r.holes.filter(h => holeComplete(r, h)).length;
          return (
            <button key={r.id} className="resume-card" onClick={() => nav.push('play', { id: r.id })}>
              <div className="resume-pulse" aria-hidden="true" />
              <div className="row-main">
                <div className="bl" style={{ color: 'rgba(255,255,255,.8)' }}>{played ? 'Round in progress' : 'Ready to tee off'}</div>
                <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{gameLabel(r)} · {r.course.name}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{played} of {r.holes.length} holes · {r.players.map(p => p.name.split(' ')[0]).join(', ')}</div>
              </div>
              <span className="resume-go"><Icon name="play" fill /></span>
            </button>
          );
        })}

        {trips.map(t => <TripUpNext key={t.trip.id} status={t} renderPlan={p => <UpcomingCard key={p.id} plan={p} />} />)}

        {plans.length > 0 && <div className="sec-label">Upcoming</div>}
        {plans.map(p => <UpcomingCard key={p.id} plan={p} />)}
        <ChallengesUpNext list={challenges} />
        {/* Starting a round at the course (or running the last one back) stays one tap, plans or not */}
        {live.length === 0 && <PlanNext last={last?.round} fresh={!hasHistory} planned={plans.length > 0 || trips.length > 0} trip={trips.length === 0} />}

        {syncConfigured && live.length === 0 && (
          <button className="add-row join-row" aria-label="Join a friend’s round" onClick={() => setJoining(true)}>
            <div className="add-ci"><Icon name="broadcast" fill /></div><span className="add-lbl">Join a friend’s round</span>
          </button>
        )}

        {lines.length > 0 && (
          <>
            <div className="sec-label">For the group text</div>
            <CalloutsCard items={lines} />
          </>
        )}

        {lately.length > 0 && (
          <>
            <div className="sec-label">Lately</div>
            <LatelyList items={lately.slice(0, LATELY_ON_HOME)} />
            {lately.length > LATELY_ON_HOME && (
              <button className="lately-all" onClick={() => nav.push('lately')}>See all {lately.length} <Icon name="caret-right" /></button>
            )}
          </>
        )}

        {hasHistory && (
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

            {/* The recap already shows the last round, so it isn't there twice */}
            {recap?.id !== last.round.id && (
              <>
                <div className="sec-label">Last time out</div>
                <RoundRow round={last.round} state={state} className="card" withYear />
              </>
            )}
          </>
        )}
      </div>
      <BottomNav />
      {joining && <JoinSheet open onClose={() => setJoining(false)} />}
    </Screen>
  );
}

/**
 * An upcoming round: the countdown ("Saturday, 2 days"), the group's game so far, the course and
 * who's in. A round still on opens its preview from the strip under it.
 */
function UpcomingCard({ plan }) {
  const nav = useNav();
  const { game } = planChoice(plan);
  const c = planCounts(plan);
  const me = plan.host ? plan.hostWho : plan.localMe;
  const mine = plan.answers?.[me]?.status;
  const off = plan.status === 'off' || (plan.gone && plan.status !== 'started'); // a started round goes on either way
  const started = plan.status === 'started' && !off;
  // Still to come: a plan from yesterday that never started has nothing left to count down to
  const ahead = !off && !started && (daysUntil(plan.date) ?? 0) >= 0;
  const card = (
    <button className={`upcoming-card ${off ? 'off' : ''} ${ahead ? 'has-preview' : ''}`} onClick={() => nav.push('plan', { id: plan.id })}>
      <div className="row-main">
        <div className="eyebrow">{ahead ? countdownLine(plan) : whenLabel(plan)}{off ? (plan.status === 'off' ? ' · Called off' : ' · Deleted') : started ? ' · The round is on' : ''}</div>
        <div className="uc-title d">{GAMES[game]?.name || 'Golf'} · {plan.course?.name || 'Course to be set'}</div>
        <div className="uc-sub">{off ? `Organized by ${plan.host ? 'you' : plan.hostName || 'a friend'}` : started ? (plan.liveCode ? 'Tap to follow along' : 'Teeing off now') : countsLine(c)}</div>
      </div>
      {!off && !started && <span className={`who-status ${mine || 'none'}`}>{mine ? `You’re ${RSVP_LABEL[mine].toLowerCase()}` : 'Answer'}</span>}
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  if (!ahead) return card;
  const day = weekdayOf(plan);
  return (
    <div className="uc-wrap">
      {card}
      <button className="uc-preview" onClick={() => nav.push('preview', { id: plan.id })}>
        <Icon name="binoculars" fill />
        <span className="row-main"><b>{day ? `${day} preview` : 'The preview'}</b> <span className="uc-pv-sub">Strokes, head to head, a card for the group</span></span>
        <Icon name="caret-right" />
      </button>
    </div>
  );
}

/** The prompt to set up the next round, with a one-tap "same again" when there's a last one. */
function PlanNext({ last, fresh, planned = false, trip = false }) {
  const nav = useNav();
  const [tripping, setTripping] = useState(false);
  return (
    <div className="plan-card">
      <span className="eyebrow">{planned ? 'Something else' : fresh ? 'Welcome to the first tee' : 'Nothing on the calendar'}</span>
      <div className="pc-title d">{planned ? 'Playing now, or another day?' : 'Plan your next round'}</div>
      <div className="pc-sub">{planned
        ? 'Start a round at the course in one tap, or plan another one for later.'
        : fresh
        ? 'Pick a game, a course and your group. Birdie Bank keeps score, does the math and settles up.'
        : 'Pick the game, the course and the bets. Everyone joins from a link.'}</div>
      <div className="pc-actions">
        <button className="pc-btn" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>
        {last && GAMES[last.game] && (
          <button className="pc-btn ghost" onClick={() => nav.push('newRound', { rematch: last.id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>
        )}
        <button className="pc-btn ghost" onClick={() => nav.push('newRound', { ahead: true })}><Icon name="calendar-plus" /> Plan ahead</button>
        {trip && <button className="pc-btn ghost" onClick={() => setTripping(true)}><Icon name="suitcase-rolling" /> Start a trip</button>}
      </div>
      <TripSheet open={tripping} onClose={() => setTripping(false)} onDone={t => { setTripping(false); nav.push('trip', { id: t.id }); }} />
    </div>
  );
}
