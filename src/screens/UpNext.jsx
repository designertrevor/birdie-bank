import { Suspense, lazy, useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES, cardOnly, holeComplete } from '../lib/round.js';
import { gameLabel, myIds } from '../lib/format.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/shared-tab.js';
import { openRewards, rewardLineText } from '../lib/play-for.js';
import { money } from '../lib/golf.js';
import { RoundRow } from '../components/RoundRow.jsx';
import { activeRounds, lastResult, myTab } from '../lib/history.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { syncConfigured } from '../lib/supabase.js';
import { RSVP_LABEL, countsLine, dayLabel, daysUntil, planChoice, planCounts, upcomingPlans, whenLabel } from '../lib/plans.js';
import { countdownLine, weekdayOf } from '../lib/countdown.js';
import { updateSafe } from '../lib/app-update.js';
import { applyUpdate, useUpdateReady } from '../lib/sw-update.js';
import { currentTrips } from '../lib/trips.js';
import { recapRound } from '../lib/recap-round.js';

// Up next paints first with what's always on it: rounds going on, plans, the Tab. The rest loads
// right after (its files are saved for offline like every other), each part in its own boundary so
// the cards above never wait or blank: the recap, challenges, reminders, callouts, Lately and trips.
const more = () => import('../components/UpNextMore.jsx');
const trips = () => import('../components/Trips.jsx');
// A part that can't load (no signal before the app was ever saved offline) is left off, never the whole screen
const part = (load, name) => lazy(() => load().then(m => ({ default: m[name] }), () => ({ default: () => null })));
const RecapSection = part(more, 'RecapSection');
const ChallengesSection = part(more, 'ChallengesSection');
const CalloutsSection = part(more, 'CalloutsSection');
const LatelySection = part(more, 'LatelySection');
const UpNextSync = part(more, 'UpNextSync');
const TripUpNext = part(trips, 'TripUpNext');
const TripSheet = part(trips, 'TripSheet');
const JoinSheet = part(() => import('../components/Live.jsx'), 'JoinSheet');
const RemindersUpNext = part(() => import('../components/Reminders.jsx'), 'RemindersUpNext');
const FriendsUpNext = part(() => import('../components/FriendsFeed.jsx'), 'FriendsUpNext');
const ShippedUpNext = part(() => import('../components/RoadmapUpNext.jsx'), 'ShippedUpNext');
// Start fetching straight away, alongside the first paint, rather than when React gets to them
if (typeof window !== 'undefined') more().catch(() => {});
const Later = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

/** Home: what's next for you. A round to finish, what you owe and are owed, and how the last one went. */
export default function UpNext() {
  const nav = useNav();
  const state = useStore();
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
  const onNow = currentTrips(state);
  const onTrip = new Set(onNow.flatMap(t => t.planned.map(p => p.id)));
  const plans = upcomingPlans(state).filter(p => !onTrip.has(p.id));
  // The day after a round: its recap, then a few lines for the group text (see recap.js, callouts.js).
  // Only which round it's about is worked out here; the card loads with the rest (UpNextMore.jsx)
  const recapId = recapRound(state)?.id ?? null;
  const anyChallenges = Object.keys(state.challenges || {}).length > 0;
  // A new version only shows up here once no round is going on, so a tap never cuts into one
  const updateReady = useUpdateReady() && updateSafe(state);

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
        {recapId && <Later><RecapSection /></Later>}

        {live.map(r => {
          const played = r.holes.filter(h => holeComplete(r, h)).length;
          return (
            <button key={r.id} className="resume-card" onClick={() => nav.push('play', { id: r.id })}>
              <div className="resume-pulse" aria-hidden="true" />
              <div className="row-main">
                <div className="bl resume-eyebrow">{played ? 'Round in progress' : 'Ready to tee off'}</div>
                <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{r.trip?.format === 'big' ? r.trip.name : gameLabel(r)} · {r.course.name}</div>
                <div className="resume-sub">{played} of {r.holes.length} holes · {r.players.map(p => p.name.split(' ')[0]).join(', ')}</div>
              </div>
              <span className="resume-go"><Icon name="play" fill /></span>
            </button>
          );
        })}

        {onNow.length > 0 && <Later>{onNow.map(t => <TripUpNext key={t.trip.id} status={t} renderPlan={p => <UpcomingCard key={p.id} plan={p} />} />)}</Later>}

        {/* A tee time to book and friendly payment reminders: there's no push yet, so these are the reminders */}
        <Later><RemindersUpNext /></Later>
        {/* Something you asked for or voted for on the roadmap shipped: said once (roadmap.js) */}
        <Later><ShippedUpNext /></Later>

        {plans.length > 0 && <div className="sec-label">Upcoming</div>}
        {plans.map(p => <UpcomingCard key={p.id} plan={p} />)}
        {anyChallenges && <Later><ChallengesSection /></Later>}
        {/* Starting a round at the course (or running the last one back) stays one tap, plans or not; a Big Game on the calendar isn't a trip, so Start a trip stays */}
        {live.length === 0 && <PlanNext last={last?.round} fresh={!hasHistory} planned={plans.length > 0 || onNow.length > 0} trip={!onNow.some(t => t.trip.format !== 'big')} />}

        {syncConfigured && live.length === 0 && (
          <button className="add-row join-row" aria-label="Join a friend’s round" onClick={() => setJoining(true)}>
            <div className="add-ci"><Icon name="broadcast" fill /></div><span className="add-lbl">Join a friend’s round</span>
          </button>
        )}

        {/* Friends' rounds you're not in, live, and the way into the group feed (friend-feed.js) */}
        <Later><FriendsUpNext show={hasHistory || plans.length > 0 || onNow.length > 0} /></Later>

        <Later><CalloutsSection /></Later>
        <Later><LatelySection recapId={recapId} /></Later>

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
            {recapId !== last.round.id && (
              <>
                <div className="sec-label">Last time out</div>
                <RoundRow round={last.round} state={state} className="card" withYear />
              </>
            )}
          </>
        )}
      </div>
      <BottomNav />
      {/* Picks up answers, votes, payments and trip news that came in since last time */}
      <Later><UpNextSync /></Later>
      {joining && <Later><JoinSheet open onClose={() => setJoining(false)} /></Later>}
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
  const me = plan.host ? plan.hostWho : plan.localMe;
  const mine = plan.answers?.[me]?.status;
  // A trip's scheduled round for a group you organized but aren't in (trip-templates.js marks you
  // out of it): you're not one of its players, so you're neither counted out nor "out"
  const notIn = !!(plan.host && plan.session && mine === 'out');
  const c = (n => (notIn ? { ...n, out: Math.max(0, n.out - 1) } : n))(planCounts(plan));
  const off = plan.status === 'off' || (plan.gone && plan.status !== 'started'); // a started round goes on either way
  // Kept for another day: the new plan isn't on this phone yet, so this one says where it went
  const moved = !off && plan.movedTo ? plan.movedTo : null;
  const started = plan.status === 'started' && !off && !moved;
  // Still to come: a plan from yesterday that never started has nothing left to count down to
  const ahead = !off && !started && !moved && (daysUntil(plan.date) ?? 0) >= 0;
  const card = (
    <button className={`upcoming-card ${off ? 'off' : ''} ${ahead ? 'has-preview' : ''}`} onClick={() => nav.push('plan', { id: plan.id })}>
      <div className="row-main">
        <div className="eyebrow">{ahead ? countdownLine(plan) : whenLabel(plan)}{off ? (plan.status === 'off' ? ' · Called off' : ' · Deleted') : moved ? ' · Moved' : started ? ' · The round is on' : ''}</div>
        {/* A round a trip's schedule planned (trip-templates.js) leads with its matches */}
        <div className="uc-title d">{plan.session?.line || `${GAMES[game]?.name || 'Golf'} · ${plan.course?.name || 'Course to be set'}`}</div>
        <div className="uc-sub">{off ? `Organized by ${plan.host ? 'you' : plan.hostName || 'a friend'}` : moved ? `Moved to ${moved.date ? dayLabel(moved.date) : 'another day'}${moved.code ? '. Tap for the new plan' : ''}` : started ? (plan.liveCode ? 'Tap to follow along' : 'Teeing off now') : plan.session?.line ? `${GAMES[game]?.name || 'Golf'} · ${plan.course?.name || 'Course to be set'} · ${countsLine(c)}` : countsLine(c)}</div>
      </div>
      {!off && !started && !moved && !notIn && <span className={`who-status ${mine || 'none'}`}>{mine ? `You’re ${RSVP_LABEL[mine].toLowerCase()}` : 'Answer'}</span>}
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  if (!ahead) return card;
  // Today's or tomorrow's round says so, rather than naming today's weekday
  const until = daysUntil(plan.date);
  const day = until === 0 ? 'Today’s' : until === 1 ? 'Tomorrow’s' : weekdayOf(plan);
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
        {last && GAMES[last.game] && !cardOnly(last) && (
          <button className="pc-btn ghost" onClick={() => nav.push('newRound', { rematch: last.id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>
        )}
        <button className="pc-btn ghost" onClick={() => nav.push('newRound', { ahead: true })}><Icon name="calendar-plus" /> Plan ahead</button>
        {trip && <button className="pc-btn ghost" onClick={() => setTripping(true)}><Icon name="suitcase-rolling" /> Start a trip</button>}
        <button className="pc-btn ghost" onClick={() => nav.push('bigGameSetup')}><Icon name="users-four" /> Big Game</button>
      </div>
      {tripping && <Later><TripSheet open onClose={() => setTripping(false)} onDone={t => { setTripping(false); nav.push('trip', { id: t.id }); }} /></Later>}
    </div>
  );
}
