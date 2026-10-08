import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { Later, part } from '../components/Later.jsx';
import { PlansAndNext } from '../components/UpNextPlans.jsx';
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
import { anyTrips, lastDoneRound } from '../lib/upnext-first.js';
import { endUpNextVisit } from '../lib/upnext-card.js';

// Up next paints first with what it can tell without the Tab's money: rounds going on, the plans
// and the card for the next round. The rest loads right after (its files are saved for offline
// like every other), each part in its own boundary so the cards above never wait or blank: the
// recap, the trips, challenges, reminders, callouts, Lately and the Tab at a glance (UpNextMore.jsx).
const more = () => import('../components/UpNextMore.jsx');
const RecapSection = part(more, 'RecapSection');
const TripsNow = part(more, 'TripsNow');
const PlansLater = part(more, 'PlansLater');
const CalloutsSection = part(more, 'CalloutsSection');
const LatelySection = part(more, 'LatelySection');
const TabGlance = part(more, 'TabGlance');
const UpNextSync = part(more, 'UpNextSync');
const JoinSheet = part(() => import('../components/Live.jsx'), 'JoinSheet');
const RemindersUpNext = part(() => import('../components/Reminders.jsx'), 'RemindersUpNext');
const ShippedUpNext = part(() => import('../components/RoadmapUpNext.jsx'), 'ShippedUpNext');
const WhatsNewUpNext = part(() => import('../components/WhatsNewUpNext.jsx'), 'WhatsNewUpNext');
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
  // A new version only shows up here once no round is going on, so a tap never cuts into one
  const updateReady = useUpdateReady() && updateSafe(state);
  const onJoin = syncConfigured ? () => setJoining(true) : null;

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
        {/* The day after a round: its recap, then a few lines for the group text (see recap.js, callouts.js) */}
        <Later><RecapSection /></Later>

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

        {trips && <Later><TripsNow /></Later>}

        {/* Reminders, It shipped and What's new share one slot: the first card shows, the rest wait
            behind it ("2 more"), so the next round stays near the top */}
        <CardStack>
          {/* A tee time to book and friendly payment reminders: there's no push yet, so these are the reminders */}
          <Later><RemindersUpNext /></Later>
          {/* Something you asked for or voted for on the roadmap shipped: said once (roadmap.js) */}
          <Later><ShippedUpNext /></Later>
          {/* What landed in this update: said once, never while a round is going on (whats-new.js) */}
          <Later><WhatsNewUpNext /></Later>
        </CardStack>

        {trips
          ? <Later><PlansLater live={live} last={last} anyChallenges={anyChallenges} onJoin={onJoin} /></Later>
          : <PlansAndNext plans={plans} onNow={[]} live={live} last={last} anyChallenges={anyChallenges} onJoin={onJoin} />}

        <Later><CalloutsSection /></Later>
        <Later><LatelySection /></Later>
        {/* The Tab at a glance and the last round out, once there's a finished round */}
        {hasHistory && <Later><TabGlance /></Later>}
      </div>
      <BottomNav />
      {/* Picks up answers, votes, payments and trip news that came in since last time */}
      <Later><UpNextSync /></Later>
      {joining && <Later><JoinSheet open onClose={() => setJoining(false)} /></Later>}
    </Screen>
  );
}

/**
 * A pile of cards with only the top one showing, and a "2 more" button that fans the rest out. The
 * cards come and go on their own (each loads later and can be dismissed), so it counts what's there.
 */
function CardStack({ children }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Mark every card after the first as waiting while it's piled, along with each waiting card's own
    // section label (the labels just before it); the top card keeps its label
    const read = () => {
      const cards = [...el.querySelectorAll('.remind-card')];
      cards.forEach((c, i) => {
        const wait = !open && i > 0;
        c.classList.toggle('cs-wait', wait);
        for (let p = c.previousElementSibling; p && !p.classList.contains('remind-card'); p = p.previousElementSibling) {
          if (p.classList.contains('sec-label')) p.classList.toggle('cs-wait', wait);
        }
      });
      setN(cards.length);
    };
    read();
    // Watched for cards coming and going, and for a card React re-renders with a new className
    // (which drops the waiting mark). Toggling a class that's already right makes no record, so no loop.
    const mo = new MutationObserver(read);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [open]);
  return (
    <div ref={ref} className={`card-stack ${n > 1 && !open ? 'piled' : ''}`}>
      {children}
      {n > 1 && (
        <button className="cs-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : `${n - 1} more`} <Icon name={open ? 'caret-up' : 'caret-down'} />
        </button>
      )}
    </div>
  );
}
