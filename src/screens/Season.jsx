// Season, opened from the Tab: your real season from your own rounds.
// Before launch it's open to everyone with no Pro labels, and under 2 rounds it says so.
// With the paywall flag on it's the Pro preview: under 2 rounds a short tour with a sample group,
// and "Try free for 14 days" opens the same paywall preview as onboarding. Nothing is charged.
// History and Players keep showing your own season for free; this is a new combined view.
import { useState } from 'react';
import { Empty, Header, Icon, Screen } from '../components/ui.jsx';
import FreePromise from '../components/FreePromise.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { recordText } from '../lib/ledger.js';
import { TRIAL_DAYS, planStatus } from '../lib/paywall.js';
import { seasonAccess } from '../lib/entitlements.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { MIN_REAL_ROUNDS, realRoundCount, sampleBoard, seasonBoard } from '../lib/season.js';

const DASH = '–';
const shortDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const signed = v => money(v, { sign: true });

export default function Season() {
  const nav = useNav();
  const state = useStore();
  const [free, setFree] = useState(false);
  const { access } = seasonAccess(state, undefined, { gated: PAYWALL_ON });
  const n = realRoundCount(state);
  const real = n >= MIN_REAL_ROUNDS;
  const trial = () => nav.push('paywall', { source: 'season' });
  // Already on the trial preview: say so instead of offering (and restarting) the 14 days
  const [now] = useState(() => Date.now());
  const onTrial = state.paywall?.choice === 'trial' && state.paywall.trialEnds > now;

  if (access === 'none') {
    return (
      <Screen>
        <Header title="Season" onBack={nav.pop} />
        <div className="scroll"><Empty title="Nothing here yet" text="Your rounds and the Tab are on the other screens." /></div>
      </Screen>
    );
  }

  if (access === 'open') {
    return (
      <Screen className="season">
        <Header title="Season" onBack={nav.pop} />
        {real
          ? <><p className="season-sub">Built from your {n} rounds</p><RealSeason state={state} /></>
          : <div className="scroll"><Empty title="Your season starts here" text={`Play ${MIN_REAL_ROUNDS} rounds this year and your season shows here: everyone’s totals, you against your most-played friend, your biggest day and best game.`} /></div>}
      </Screen>
    );
  }

  return (
    <Screen className="season">
      <Header title={real ? 'Season' : 'See what Pro does'} onBack={nav.pop} />
      <p className="season-sub">{real ? `Preview · built from your ${n} rounds` : `Preview · a sample group until you’ve played ${MIN_REAL_ROUNDS} rounds`}</p>
      {real ? <RealSeason state={state} preview /> : <Tour trialButton={<TrialButton onTrial={onTrial} status={planStatus(state, now)} onClick={trial} />} onFree={() => setFree(true)} />}
      {real && (
        <div className="cta-wrap">
          <TrialButton onTrial={onTrial} status={planStatus(state, now)} onClick={trial} />
          <button className="link-btn center" onClick={() => setFree(true)}>What stays free forever</button>
        </div>
      )}
      <FreePromise open={free} onClose={() => setFree(false)} />
    </Screen>
  );
}

/** "Try free for 14 days", or where the trial preview stands when it's already on. */
function TrialButton({ onTrial, status, onClick }) {
  if (onTrial) return <p className="field-help" role="status" style={{ textAlign: 'center' }}>{status}. Nothing is charged.</p>;
  return <button className="full-btn" onClick={onClick}>Try free for {TRIAL_DAYS} days <Icon name="arrow-right" /></button>;
}

function RealSeason({ state, preview = false }) {
  const nav = useNav();
  const b = seasonBoard(state);
  return (
    <div className="scroll">
      {preview && <div className="season-banner" role="note"><Icon name="star" fill /> <span><b>Preview.</b> Your real rounds. Pro keeps it.</span></div>}
      <div className="sec-label">Since {shortDay(b.since)} · {b.rounds} rounds</div>
      <Balances rows={b.balances} />
      <div className="block kv-block">
        <Kv k={b.rival ? `You vs ${b.rival.name.split(' ')[0]}` : 'You vs a friend'} v={b.rival ? `${recordText(b.rival)} · ${signed(b.rival.net)}` : DASH} />
        <Kv k="Biggest day" v={b.biggestDay ? `${signed(b.biggestDay.amount)} · ${b.biggestDay.course || shortDay(b.biggestDay.at)}` : DASH} />
        <Kv k="Best game" v={b.bestGame ? `${b.bestGame.name}, ${signed(b.bestGame.net)}` : DASH} />
      </div>
      <p className="field-help pad">Only you see this. It adds up the rounds you played this season, every game in them included.</p>
      <button className="text-link stats-link" onClick={() => nav.push('stats', { range: { kind: 'season', year: b.year } })}>
        <Icon name="chart-bar" fill /> <span className="row-main">Your stats for the season<span className="sl-sub">By game and course, presses, skins and biggest wins</span></span> <Icon name="caret-right" />
      </button>
    </div>
  );
}

/** Everyone's season as bars either side of zero. The amounts are in the text; the bars are decoration. */
function Balances({ rows, sample = false }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.net)));
  return (
    <ul className="block season-bals" aria-label={sample ? 'Sample season balances' : 'Season balances'}>
      {rows.map(r => (
        <li key={r.id} className={`season-bal ${r.me ? 'me' : ''}`}>
          <span className="sb-name">{r.name}</span>
          <span className="sb-track left" aria-hidden="true">{r.net < 0 && <i style={{ width: `${(-r.net / max) * 100}%` }} />}</span>
          <span className="sb-track right" aria-hidden="true">{r.net > 0 && <i style={{ width: `${(r.net / max) * 100}%` }} />}</span>
          <span className={`sb-amt ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}`}>{r.net ? signed(r.net) : '$0'}</span>
        </li>
      ))}
    </ul>
  );
}

const Kv = ({ k, v }) => (
  <div className="kv-row"><span className="kv-k">{k}</span><span className="kv-v">{v}</span></div>
);

const SampleTag = () => <span className="sample-tag">Sample</span>;

/** The fallback: three steps with a sample group, ending on the trial. */
function Tour({ trialButton, onFree }) {
  const state = useStore();
  const s = sampleBoard(state);
  const nm = id => s.names[id];
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Season tab', text: 'Your group’s whole season in one place, a few rounds in.',
      body: <>
        <Balances rows={s.balances} sample />
        <div className="block kv-block">
          <Kv k={`${nm(s.rival.a)} vs ${nm(s.rival.b)}`} v={`${recordText(s.rival)} · ${signed(s.rival.net)}`} />
          <Kv k="Biggest day" v={`${signed(s.biggestDay.amount)} · ${s.biggestDay.course}`} />
          <Kv k="Best game" v={s.bestGame.name} />
        </div>
      </>,
    },
    {
      title: 'Your usuals', text: 'The games your group plays most, one tap each.',
      body: (
        <div className="block tour-card">
          <div className="eyebrow">Your usual</div>
          <div className="tour-big">{s.usual.game} · {s.usual.bet} · {s.usual.course}</div>
          <div className="li-sub">{s.balances.slice(0, 4).map(b => b.name).join(', ')}</div>
        </div>
      ),
    },
    {
      title: 'Upcoming rounds', text: 'Who’s in for the next round, before the day.',
      body: (
        <div className="block tour-counts">
          {[[s.rsvp.in, 'In'], [s.rsvp.maybe, 'Maybe'], [s.rsvp.out, 'Out'], [s.rsvp.none, 'No reply']].map(([v, l]) => (
            <div key={l}><div className="tour-big">{v}</div><div className="li-sub">{l}</div></div>
          ))}
        </div>
      ),
    },
  ];
  const cur = steps[step];
  const last = step === steps.length - 1;
  return (
    <>
      <div className="scroll">
        <div className="tour-dots" role="list" aria-label="Tour progress">
          {steps.map((x, i) => (
            <span key={x.title} role="listitem" aria-label={`Step ${i + 1} of ${steps.length}: ${x.title}${i === step ? ', showing now' : ''}`}
              className={`tour-dot ${i <= step ? 'on' : ''}`} />
          ))}
        </div>
        <div className="tour-head">
          <SampleTag />
          <h2 className="d tour-title" aria-live="polite">{cur.title}</h2>
          <p className="li-sub">{cur.text}</p>
        </div>
        {cur.body}
        <p className="field-help pad">A made-up group, so it never looks like real money. Your own season shows here after {MIN_REAL_ROUNDS} rounds.</p>
      </div>
      <div className="cta-wrap">
        {last
          ? trialButton
          : <button className="full-btn" onClick={() => setStep(step + 1)}>Next <Icon name="arrow-right" /></button>}
        <button className="link-btn center" onClick={onFree}>What stays free forever</button>
      </div>
    </>
  );
}
