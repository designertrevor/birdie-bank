import { useEffect, useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { Later, part } from '../components/Later.jsx';
import { CardStack, StackSlot } from '../components/CardStack.jsx';
import { MoreWays, PlansAndNext } from '../components/UpNextPlans.jsx';
import { useStore } from '../lib/store.js';
import { activeRounds } from '../lib/rounds-live.js';
import { holeComplete } from '../lib/round.js';
import { gameLabel } from '../lib/format.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { syncConfigured } from '../lib/supabase.js';
import { upcomingPlans } from '../lib/plan-basics.js';
import { updateSafe } from '../lib/app-update.js';
import { applyUpdate, useUpdateReady } from '../lib/sw-update.js';
import { TILES_FROM, anyTrips, doneCount, lastDoneRound } from '../lib/upnext-first.js';
import { endUpNextVisit } from '../lib/upnext-card.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import './upnext.css';

// Up next paints first with what it can tell without the Tab's money: rounds going on, the plans
// and the card for the next round. The rest loads right after (its files are saved for offline
// like every other), each part in its own boundary so the cards above never wait or blank: the
// recap, the trips, challenges, reminders, the number tiles, callouts, Lately and the Tab at a
// glance (UpNextMore.jsx).
//
// The order is the overhaul's (Layout Lab A with E's cards and C's tiles), cut down after the
// audit (2026-10-28): the one next thing on top (a round going on, the countdown and the upcoming
// rounds, or the card to start one), then Heads up, your golf, the recap and Lately, the other ways
// to play, and one "More" row at the foot that folds open the quieter things (friends' rounds,
// lines for the group text, the last round out).
const more = () => import('../components/UpNextMore.jsx');
const RecapSection = part(more, 'RecapSection');
const TripsNow = part(more, 'TripsNow');
const PlansLater = part(more, 'PlansLater');
const LatelySection = part(more, 'LatelySection');
const TabGlance = part(more, 'TabGlance');
const StatTiles = part(more, 'StatTiles');
const ChallengesSection = part(more, 'ChallengesSection');
const UpNextSync = part(more, 'UpNextSync');
const MoreFold = part(more, 'MoreFold');
const WaysLater = part(more, 'WaysLater');
const JoinSheet = part(() => import('../components/Live.jsx'), 'JoinSheet');
const FriendsUpNext = part(() => import('../components/FriendsFeed.jsx'), 'FriendsUpNext');
const RemindersUpNext = part(() => import('../components/Reminders.jsx'), 'RemindersUpNext');
const ShippedUpNext = part(() => import('../components/RoadmapUpNext.jsx'), 'ShippedUpNext');
const WhatsNewUpNext = part(() => import('../components/WhatsNewUpNext.jsx'), 'WhatsNewUpNext');
const TrialReminderUpNext = part(() => import('../components/TrialReminderUpNext.jsx'), 'TrialReminderUpNext');
const InstallUpNext = part(() => import('../components/InstallUpNext.jsx'), 'InstallUpNext');
// Start fetching straight away, alongside the first paint, rather than when React gets to them
if (typeof window !== 'undefined') more().catch(() => {});

/** Home: what's next for you. A round to finish, what you owe and are owed, and how the last one went. */
export default function UpNext() {
  const nav = useNav();
  const state = useStore();
  // (A join link opened by someone already set up goes straight to the invite card: see App.)
  const [joining, setJoining] = useState(false);
  // It shipped and What's new: one a visit, and leaving starts the next (upnext-card.js)
  useEffect(() => endUpNextVisit, []);
  const live = activeRounds(state);
  const last = lastDoneRound(state);
  const hasHistory = !!last;
  // A trip on now leads with where you stand, its planned rounds grouped under it. Which trips are on
  // takes the money (trips.js), so with any trip about the trips and the plans come just after the
  // first paint together, and a trip's rounds never show under Upcoming first and then move
  const trips = anyTrips(state);
  const plans = trips ? null : upcomingPlans(state);
  const anyChallenges = Object.keys(state.challenges || {}).length > 0;
  // C's number tiles only once there's enough to count: never a row of zeros for someone new
  const tiles = doneCount(state) >= TILES_FROM;
  // A new version only shows up here once no round is going on, so a tap never cuts into one
  const updateReady = useUpdateReady() && updateSafe(state);
  const onJoin = syncConfigured ? () => setJoining(true) : null;

  return (
    <Screen className="upnext">
      <Header title="Up next" right={<AvatarButton />} />
      <div className="scroll">
        {updateReady && (
          <button className="update-note" onClick={applyUpdate}>
            <Icon name="arrow-clockwise" />
            <span className="row-main"><b>Update ready</b> <span className="un-sub">Tap to refresh</span></span>
          </button>
        )}
        {/* Two or more going: a label says so, and only the first keeps the pink, the rest go quiet */}
        {live.length > 1 && <h2 className="sec-label">Going now</h2>}
        {live.map((r, i) => {
          const played = r.holes.filter(h => holeComplete(r, h)).length;
          return (
            <button key={r.id} className={`resume-card ${i > 0 ? 'quiet' : ''}`} onClick={() => nav.push('play', { id: r.id })}>
              <div className="row-main">
                <div className="bl resume-eyebrow"><span className="resume-pulse" aria-hidden="true" />{played ? 'Round in progress' : 'Ready to tee off'}</div>
                <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{r.trip?.format === 'big' ? r.trip.name : gameLabel(r)} · {r.course.name}</div>
                <div className="resume-sub">{played} of {r.holes.length} holes · {r.players.map(p => p.name.split(' ')[0]).join(', ')}</div>
              </div>
              <span className="resume-go"><Icon name="play" fill /></span>
            </button>
          );
        })}

        {trips && <Later><TripsNow /></Later>}

        {/* The one next thing: the countdown, the upcoming rounds, Start a round with Run it back, and Get a round going */}
        {trips
          ? <Later><PlansLater live={live} last={last} onJoin={onJoin} /></Later>
          : <PlansAndNext plans={plans} onNow={[]} live={live} last={last} onJoin={onJoin} />}

        {/* Reminders, It shipped and What's new share one slot: the first card shows, the rest wait
            behind it ("2 more"), so the screen stays calm */}
        <CardStack>
          {/* The Pro trial ends in two days or less: the end date and the price, first (paywall flag only, trial.js) */}
          {PAYWALL_ON && <StackSlot at={-1}><Later><TrialReminderUpNext /></Later></StackSlot>}
          {/* A tee time to book and friendly payment reminders: there's no push yet, so these are the reminders */}
          {/* In a phone's browser: add it to the Home Screen, on top while it's there (install-card.js) */}
          <StackSlot at={-1}><Later><InstallUpNext /></Later></StackSlot>
          <StackSlot at={0}><Later><RemindersUpNext /></Later></StackSlot>
          {/* Something you asked for or voted for on the roadmap shipped: said once (roadmap.js) */}
          <StackSlot at={1}><Later><ShippedUpNext /></Later></StackSlot>
          {/* What landed in this update: said once, never while a round is going on (whats-new.js) */}
          <StackSlot at={2}><Later><WhatsNewUpNext /></Later></StackSlot>
        </CardStack>

        {anyChallenges && <Later><ChallengesSection /></Later>}

        {/* The look back: your numbers once there are a few rounds (before that the Tab at a
            glance), then the day-after recap (see recap.js) */}
        {tiles ? <Later><StatTiles /></Later> : hasHistory && <Later><TabGlance /></Later>}
        <Later><RecapSection /></Later>

        {/* A friend's round going on now (friend-feed.js), then Lately */}
        <Later><FriendsUpNext only="live" /></Later>
        <Later><LatelySection /></Later>

        {/* The other ways to play: Start a trip goes while a trip is on, which takes the money */}
        {trips ? <Later><WaysLater /></Later> : <MoreWays trip />}

        {/* The quieter things, folded: friends' rounds, lines for the group text, the last round out */}
        {hasHistory && <Later><MoreFold /></Later>}
      </div>
      <BottomNav />
      {/* Picks up answers, votes, payments and trip news that came in since last time */}
      <Later><UpNextSync /></Later>
      {joining && <Later><JoinSheet open onClose={() => setJoining(false)} /></Later>}
    </Screen>
  );
}
