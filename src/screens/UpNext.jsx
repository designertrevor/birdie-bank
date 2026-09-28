import { useEffect, useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES, holeComplete } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { RoundRow } from '../components/RoundRow.jsx';
import { activeRounds, lastResult, myTab } from '../lib/history.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { JoinSheet } from '../components/Live.jsx';
import { syncConfigured } from '../lib/sync.js';
import { RSVP_LABEL, countsLine, planChoice, planCounts, upcomingPlans, whenLabel } from '../lib/plans.js';
import { refreshPlans } from '../lib/plan-sync.js';
import { refreshTab } from '../lib/tab-sync.js';

/** Home: what's next for you. A round to finish, what you owe and are owed, and how the last one went. */
export default function UpNext() {
  const nav = useNav();
  const state = useStore();
  // A join link opened by someone already set up lands here and opens the join sheet
  const [joinCode] = useState(() => { try { const c = sessionStorage.getItem('bb-join'); sessionStorage.removeItem('bb-join'); return c; } catch { return null; } });
  const [joining, setJoining] = useState(!!joinCode);
  const live = activeRounds(state);
  const last = lastResult(state);
  const tab = myTab(state);
  const hasHistory = !!last;
  const plans = upcomingPlans(state);
  // Pick up answers and votes that came in since last time
  useEffect(() => { refreshPlans(); refreshTab(); }, []);

  return (
    <Screen>
      <Header title="Up next" right={<AvatarButton />} />
      <div className="scroll">
        {live.map(r => {
          const played = r.holes.filter(h => holeComplete(r, h)).length;
          return (
            <button key={r.id} className="resume-card" onClick={() => nav.push('play', { id: r.id })}>
              <div className="resume-pulse" aria-hidden="true" />
              <div className="row-main">
                <div className="bl" style={{ color: 'rgba(255,255,255,.8)' }}>{played ? 'Round in progress' : 'Ready to tee off'}</div>
                <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{GAMES[r.game]?.name} · {r.course.name}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{played} of {r.holes.length} holes · {r.players.map(p => p.name.split(' ')[0]).join(', ')}</div>
              </div>
              <span className="resume-go"><Icon name="play" fill /></span>
            </button>
          );
        })}

        {plans.length > 0 && <div className="sec-label">Upcoming</div>}
        {plans.map(p => <UpcomingCard key={p.id} plan={p} />)}
        {/* Starting a round at the course (or running the last one back) stays one tap, plans or not */}
        {live.length === 0 && <PlanNext last={last?.round} fresh={!hasHistory} planned={plans.length > 0} />}

        {syncConfigured && live.length === 0 && (
          <button className="add-row join-row" onClick={() => setJoining(true)}>
            <div className="add-ci"><Icon name="broadcast" fill /></div><span className="add-lbl">Join a friend’s round</span>
          </button>
        )}

        {hasHistory && (
          <>
            <div className="sec-label">Your tab</div>
            <button className="tab-glance" onClick={() => nav.setTab('ledger')} aria-label={tab.people ? `Your tab: owed to you ${money(tab.owed)}, you owe ${money(tab.owe)}` : 'Your tab: you’re all square'}>
              {tab.people ? (
                <>
                  <div><div className="bl">Owed to you</div><div className={`lr-big ${tab.owed ? 'pos' : ''}`}>{tab.owed ? money(tab.owed) : '–'}</div></div>
                  <div><div className="bl">You owe</div><div className={`lr-big ${tab.owe ? 'neg' : ''}`}>{tab.owe ? money(tab.owe) : '–'}</div></div>
                </>
              ) : (
                <div className="tg-square"><Icon name="handshake" fill /> <span>You’re all square. Nobody owes you, you owe nobody.</span></div>
              )}
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>

            <div className="sec-label">Last time out</div>
            <RoundRow round={last.round} state={state} className="card" withYear />
          </>
        )}
      </div>
      <BottomNav />
      {joining && <JoinSheet open initialCode={joinCode || ''} onClose={() => setJoining(false)} />}
    </Screen>
  );
}

/** An upcoming round: when, the group's game so far, the course and who's in. */
function UpcomingCard({ plan }) {
  const nav = useNav();
  const { game } = planChoice(plan);
  const c = planCounts(plan);
  const me = plan.host ? plan.hostWho : plan.localMe;
  const mine = plan.answers?.[me]?.status;
  const off = plan.status === 'off' || (plan.gone && plan.status !== 'started'); // a started round goes on either way
  const started = plan.status === 'started' && !off;
  return (
    <button className={`upcoming-card ${off ? 'off' : ''}`} onClick={() => nav.push('plan', { id: plan.id })}>
      <div className="row-main">
        <div className="eyebrow">{whenLabel(plan)}{off ? (plan.status === 'off' ? ' · Called off' : ' · Deleted') : started ? ' · The round is on' : ''}</div>
        <div className="uc-title d">{GAMES[game]?.name || 'Golf'} · {plan.course?.name || 'Course to be set'}</div>
        <div className="uc-sub">{off ? `Organized by ${plan.host ? 'you' : plan.hostName || 'a friend'}` : started ? (plan.liveCode ? 'Tap to follow along' : 'Teeing off now') : countsLine(c)}</div>
      </div>
      {!off && !started && <span className={`who-status ${mine || 'none'}`}>{mine ? `You’re ${RSVP_LABEL[mine].toLowerCase()}` : 'Answer'}</span>}
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}

/** The prompt to set up the next round, with a one-tap "same again" when there's a last one. */
function PlanNext({ last, fresh, planned = false }) {
  const nav = useNav();
  return (
    <div className="plan-card">
      <span className="eyebrow">{planned ? 'Something else' : fresh ? 'Welcome to the bank' : 'Nothing on the calendar'}</span>
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
      </div>
    </div>
  );
}
