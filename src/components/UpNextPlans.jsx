// The top of Up next: the countdown to the next round, the upcoming rounds, the card that starts
// one (with Run it back), a new organizer's first steps and the ways to get one going later. Up
// next draws it on the first paint; with a trip about it comes just after instead (UpNextMore.jsx),
// once the trip's standing is worked out, so a trip's rounds never show under Upcoming first and
// then move under the trip.
import { useState } from 'react';
import { Icon } from './ui.jsx';
import { Spot } from './Spot.jsx';
import { Later, part } from './Later.jsx';
import { CountdownStrip } from './UpNextCountdown.jsx';
import { useStore } from '../lib/store.js';
import { roundsInProgress } from '../lib/rounds-live.js';
import { GAMES, cardOnly } from '../lib/round.js';
import { useNav } from '../lib/nav.js';
import { RSVP_LABEL, countsLine, dayLabel, daysUntil, planChoice, planCounts, whenLabel } from '../lib/plan-basics.js';
import { countdownLine, weekdayOf } from '../lib/countdown.js';
import { STATE_LABEL, detailStates, leadingDay, lockNudge, normalizePlan, shortDay } from '../lib/plan-open.js';
import '../screens/plan/plan.css';

const TripSheet = part(() => import('./Trips.jsx'), 'TripSheet');

/**
 * The one next thing (Layout Lab A): the countdown strip, the upcoming rounds, then the card to
 * start one. `plans` are the upcoming plans not under a trip on now (`onNow`, the trips'
 * standings, or none); `last` is the newest finished round, for "Run it back". The other ways to
 * play (MoreWays) sit lower on Up next, after your golf and Lately.
 */
export function PlansAndNext({ plans, onNow, live, last, onJoin }) {
  const hasHistory = !!last;
  const planned = plans.length > 0 || onNow.length > 0;
  return (
    <>
      {live.length === 0 && <CountdownStrip plans={plans} />}
      {plans.length > 0 && <h2 className="sec-label">Upcoming</h2>}
      {plans.map(p => <UpcomingCard key={p.id} plan={p} />)}
      {/* Starting a round at the course (or running the last one back) stays one tap, plans or not */}
      {live.length === 0 && <StartCard last={last} fresh={!hasHistory} planned={planned} onJoin={onJoin} />}
      {!hasHistory && <FirstSteps />}
    </>
  );
}

/**
 * An upcoming round: the countdown ("Saturday, 2 days"), the group's game so far, the course and
 * who's in. A round still on opens its preview from the strip under it. A plan with no day yet
 * (plan-open.js) says so where the countdown goes, with the leading day and its four details' states.
 */
export function UpcomingCard({ plan: saved }) {
  const nav = useNav();
  const plan = normalizePlan(saved);
  if (!plan.date && plan.status === 'planned' && !plan.gone) return <OpenPlanCard plan={plan} />;
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

/**
 * A plan with no day yet: "No day yet" (with the day that leads), who's in, the game and bet as
 * small state tags once they're set or up for a vote, and one quiet line for what's still open.
 * The day sits in the eyebrow and the course in the title, so neither repeats as a tag. Once a day
 * clearly leads, the organizer gets "Lock in" right on the card: it opens the plan's lock sheet.
 */
function OpenPlanCard({ plan }) {
  const nav = useNav();
  const me = plan.host ? plan.hostWho : plan.localMe;
  const mine = plan.answers?.[me]?.status;
  const lead = leadingDay(plan);
  const nudge = plan.host ? lockNudge(plan) : null;
  const st = detailStates(plan, { name: g => GAMES[g]?.name || 'A game' });
  const tags = [['Game', st.game], ['Bet', st.bet]].filter(([, s]) => s.state !== 'not');
  const open = [['course', st.course], ['game', st.game], ['bet', st.bet]].filter(([, s]) => s.state === 'not').map(([k]) => k);
  const card = (
    <button className="upcoming-card open-plan" onClick={() => nav.push('plan', { id: plan.id })}>
      <div className="row-main">
        <div className="eyebrow">{nudge ? `Ready to lock in ${shortDay(nudge.iso)}` : lead ? `No day yet · ${shortDay(lead.iso)} leads` : 'No day yet'}</div>
        <div className="uc-title d">{plan.course?.name ? `Golf soon? · ${plan.course.name}` : 'Golf soon?'}</div>
        <div className="uc-sub">{countsLine(planCounts(plan))}</div>
        {/* What's set or up for a vote; what isn't yet is the quiet line under it */}
        {tags.length > 0 && (
          <div className="uc-tags">
            {tags.map(([k, s]) => <span key={k} className={`st-tag sm ${s.state}`}><span className="sr-only">{k}: {STATE_LABEL[s.state]}, </span>{s.label}</span>)}
          </div>
        )}
        {open.length > 0 && <div className="uc-open">Still open: {open.join(', ')}</div>}
      </div>
      {/* The organizer about to lock it in is in anyway: the Lock in row says what matters */}
      {!nudge && <span className={`who-status ${mine || 'none'}`}>{mine ? `You’re ${RSVP_LABEL[mine].toLowerCase()}` : 'Answer'}</span>}
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  if (!nudge) return card;
  return (
    <div className="uc-wrap open-plan-wrap">
      {card}
      <button className="uc-preview uc-lock" onClick={() => nav.push('plan', { id: plan.id, lock: true })}>
        <Icon name="lock-simple" fill />
        <span className="row-main"><b>Lock in {shortDay(nudge.iso)}</b> <span className="uc-pv-sub">{nudge.votes} of {nudge.of} can make it</span></span>
        <Icon name="caret-right" />
      </button>
    </div>
  );
}

/**
 * Starting a round: big, illustrated and the one tinted card when nothing's planned (the one next
 * thing). With something planned it's just its buttons on the canvas under "Playing now?", side by
 * side and filling the width, so the plans keep the colour and the attention. Start a round is the
 * main action, with a one-tap "same again" beside it when there's a last one.
 */
function StartCard({ last, fresh, planned = false, onJoin = null }) {
  const nav = useNav();
  const again = last && GAMES[last.game] && !cardOnly(last);
  const acts = (
    <div className={`un-start-acts ${again ? '' : 'solo'}`}>
      <button className="un-btn" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>
      {again && <button className="un-btn ghost" onClick={() => nav.push('newRound', { rematch: last.id })}><Icon name="arrow-counter-clockwise" /> Run it back</button>}
    </div>
  );
  const join = onJoin && <button className="un-join" onClick={onJoin}>Got a code? <u>Join a friend’s round</u></button>;
  if (planned) {
    return (
      <section className="un-group un-now" aria-labelledby="un-now">
        <h2 className="sec-label" id="un-now">Playing now?</h2>
        {acts}
        {join}
      </section>
    );
  }
  return (
    <div className="un-start">
      <Spot kind="tee" size={104} className="un-start-art" plate={false} />
      <span className="un-eyebrow">{fresh ? 'Welcome to the first tee' : 'Nothing on the calendar'}</span>
      <h2 className="un-start-title">{fresh ? 'Your first round' : 'Play a round'}</h2>
      <div className="un-start-sub">{fresh
        ? 'Pick a game, a course and your group. Birdie Bank keeps score, does the math and settles up.'
        : 'Pick the game, the course and the bets. Everyone follows along from a link.'}</div>
      {acts}
      {join}
    </div>
  );
}

/**
 * The other ways to play: three equal rows in one white card, each with its art, a name and one
 * line. Get a round going (a day and the group, asked ahead) is always here; Start a trip goes
 * while a trip is on (`trip` false). The art carries the colour.
 */
export function MoreWays({ trip = false }) {
  const nav = useNav();
  const [tripping, setTripping] = useState(false);
  const rows = [
    { key: 'ask', art: 'calendar', title: 'Get a round going', sub: 'No day needed yet. Ask the group', go: () => nav.push('newRound', { ahead: true }) },
    trip && { key: 'trip', art: 'suitcase', title: 'Start a trip', sub: 'A few days of golf on one Tab', go: () => setTripping(true) },
    { key: 'big', art: 'crowd', title: 'Big Game', sub: 'A few groups, one leaderboard', go: () => nav.push('bigGameSetup') },
  ].filter(Boolean);
  return (
    <section className="un-group" aria-labelledby="un-ways">
      <h2 className="sec-label" id="un-ways">More ways to play</h2>
      <div className="un-ways-card">
        {rows.map(r => (
          <button key={r.key} className="un-way" onClick={r.go}>
            <Spot kind={r.art} size={56} plate={false} />
            <span className="row-main"><span className="un-way-title">{r.title}</span><span className="un-way-sub">{r.sub}</span></span>
            <Icon name="caret-right" />
          </button>
        ))}
      </div>
      {tripping && <Later><TripSheet open onClose={() => setTripping(false)} onDone={t => { setTripping(false); nav.push('trip', { id: t.id }); }} /></Later>}
    </section>
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
    // Start a round is the big button above, so this step says so rather than being a second one
    { done: rounds.length > 0, title: 'Start a round', sub: 'With the Start a round button above', go: null },
    { done: rounds.some(r => r.shared), title: 'Send the group the link', sub: active ? 'Invite the group from the round menu' : 'They follow the money live', go: () => (active ? nav.push('play', { id: active.id }) : nav.push('newRound')) },
  ];
  if (steps.every(x => x.done)) return null;
  return (
    <section className="un-group" aria-labelledby="un-steps">
      <h2 className="sec-label" id="un-steps">Three steps to get going</h2>
      <ol className="first-steps">
        {steps.map((x, i) => (
          <li key={x.title}>
            {x.go && !x.done ? (
              <button className="fs-row" onClick={x.go}>
                <span className="fs-num" aria-hidden="true">{i + 1}</span>
                <span className="row-main"><span className="fs-title">{x.title}</span><span className="fs-sub">{x.sub}</span></span>
                <Icon name="caret-right" />
              </button>
            ) : (
              <div className={`fs-row static ${x.done ? 'done' : ''}`}>
                <span className="fs-num" aria-hidden="true">{x.done ? <Icon name="check" /> : i + 1}</span>
                <span className="row-main"><span className="fs-title">{x.title}</span><span className="fs-sub">{x.done ? 'Done' : x.sub}</span></span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
