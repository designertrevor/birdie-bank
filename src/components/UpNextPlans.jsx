// The middle of Up next: the upcoming rounds, the card that plans the next one, a new organizer's
// first steps and the way into friends' rounds. Up next draws it on the first paint; with a trip
// about it comes just after instead (UpNextMore.jsx), once the trip's standing is worked out, so a
// trip's rounds never show under Upcoming first and then move under the trip.
import { useState } from 'react';
import { Icon } from './ui.jsx';
import { Spot } from './Spot.jsx';
import { Later, part } from './Later.jsx';
import { useStore } from '../lib/store.js';
import { roundsInProgress } from '../lib/rounds-live.js';
import { GAMES, cardOnly } from '../lib/round.js';
import { useNav } from '../lib/nav.js';
import { RSVP_LABEL, countsLine, dayLabel, daysUntil, planChoice, planCounts, whenLabel } from '../lib/plan-basics.js';
import { countdownLine, weekdayOf } from '../lib/countdown.js';

const ChallengesSection = part(() => import('./UpNextMore.jsx'), 'ChallengesSection');
const TripSheet = part(() => import('./Trips.jsx'), 'TripSheet');
const FriendsUpNext = part(() => import('./FriendsFeed.jsx'), 'FriendsUpNext');

/**
 * Upcoming rounds through the Friends row. `plans` are the upcoming plans not under a trip on now
 * (`onNow`, the trips' standings, or none); `last` is the newest finished round, for "Run it back".
 */
export function PlansAndNext({ plans, onNow, live, last, anyChallenges, onJoin }) {
  const hasHistory = !!last;
  return (
    <>
      {plans.length > 0 && <div className="sec-label">Upcoming</div>}
      {plans.map(p => <UpcomingCard key={p.id} plan={p} />)}
      {anyChallenges && <Later><ChallengesSection /></Later>}
      {/* Starting a round at the course (or running the last one back) stays one tap, plans or not; a Big Game on the calendar isn't a trip, so Start a trip stays */}
      {live.length === 0 && <PlanNext last={last} fresh={!hasHistory} planned={plans.length > 0 || onNow.length > 0} trip={!onNow.some(t => t.trip.format !== 'big')} onJoin={onJoin} />}
      {!hasHistory && <FirstSteps />}

      {/* Friends' rounds you're not in, live, and the way into the group feed (friend-feed.js) */}
      <Later><FriendsUpNext show={hasHistory || plans.length > 0 || onNow.length > 0} /></Later>
    </>
  );
}

/**
 * An upcoming round: the countdown ("Saturday, 2 days"), the group's game so far, the course and
 * who's in. A round still on opens its preview from the strip under it.
 */
export function UpcomingCard({ plan }) {
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
function PlanNext({ last, fresh, planned = false, trip = false, onJoin = null }) {
  const nav = useNav();
  const [tripping, setTripping] = useState(false);
  const again = last && GAMES[last.game] && !cardOnly(last);
  return (
    <>
      <div className="plan-card">
        <Spot kind="tee" size={92} className="pc-mascot" plate={false} />
        <span className="eyebrow">{planned ? 'Something else' : fresh ? 'Welcome to the first tee' : 'Nothing on the calendar'}</span>
        <div className="pc-title d">{planned ? 'Playing now, or another day?' : 'Plan your next round'}</div>
        <div className="pc-sub">{planned
          ? 'Start a round at the course in one tap, or plan another one for later.'
          : fresh
          ? 'Pick a game, a course and your group. Birdie Bank keeps score, does the math and settles up.'
          : 'Pick the game, the course and the bets. Everyone joins from a link.'}</div>
        <div className="pc-actions">
          <button className="pc-btn" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>
          {again && <button className="pc-btn ghost" onClick={() => nav.push('newRound', { rematch: last.id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>}
        </div>
        {onJoin && <button className="pc-join" onClick={onJoin}>Got a code? <u>Join a friend’s round</u></button>}
      </div>
      {/* The other ways to play, as three small tiles under the card */}
      <div className="sec-label">More ways to play</div>
      <div className={`more-tiles ${trip ? '' : 'two'}`}>
        <button className="more-tile" onClick={() => nav.push('newRound', { ahead: true })}><Spot kind="calendar" size={64} /><span>Plan ahead</span></button>
        {trip && <button className="more-tile" onClick={() => setTripping(true)}><Spot kind="suitcase" size={64} /><span>Start a trip</span></button>}
        <button className="more-tile" onClick={() => nav.push('bigGameSetup')}><Spot kind="crowd" size={64} /><span>Big Game</span></button>
      </div>
      {tripping && <Later><TripSheet open onClose={() => setTripping(false)} onDone={t => { setTripping(false); nav.push('trip', { id: t.id }); }} /></Later>}
    </>
  );
}

/** A brand new organizer's first three steps, each ticked off as it happens. */
function FirstSteps() {
  const nav = useNav();
  const state = useStore();
  const people = Object.keys(state.players || {}).filter(id => id !== state.me).length;
  const rounds = Object.values(state.rounds || {});
  // A round already going opens for its link (Invite is in its menu); otherwise sending one starts with a round
  const active = roundsInProgress(state)[0] || null;
  const steps = [
    { done: people > 0, title: 'Add your group', sub: 'The people you play with', go: () => nav.setTab('people') },
    { done: rounds.length > 0, title: 'Start a round', sub: 'Pick a game and a course', go: () => nav.push('newRound') },
    { done: rounds.some(r => r.shared), title: 'Send the group the link', sub: active ? 'Invite the group from the round menu' : 'They follow the money live', go: () => (active ? nav.push('play', { id: active.id }) : nav.push('newRound')) },
  ];
  if (steps.every(x => x.done)) return null;
  return (
    <>
      <div className="sec-label">Your first round</div>
      <ol className="first-steps">
        {steps.map((x, i) => (
          <li key={x.title}>
            <button className={`fs-row ${x.done ? 'done' : ''}`} onClick={x.go} disabled={x.done}>
              <span className="fs-num" aria-hidden="true">{x.done ? <Icon name="check" /> : i + 1}</span>
              <span className="row-main"><span className="fs-title">{x.title}</span><span className="fs-sub">{x.done ? 'Done' : x.sub}</span></span>
              {!x.done && <Icon name="caret-right" />}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
