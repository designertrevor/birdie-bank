// One challenge from a Player card (a planned round's live on its plan): who and what, where it
// stands, Accept, Counter or Decline, and sending it again. Also where a challenge link
// (?challenge=CODE) opens, for someone set up or, with no install and no paywall, for anyone.
import { useEffect, useState } from 'react';
import { BallIllo, Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { ChallengeCard, ChallengeExtras } from '../components/Challenges.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { challengeNextText, challengeView, cleanChallenge, planOf } from '../lib/challenges.js';
import { openChallengeLink, pickChallengeSide, useChallengesLive } from '../lib/challenge-sync.js';
import { ChallengesOffError } from '../lib/challenge-adapters.js';

export default function ChallengeScreen({ id }) {
  const nav = useNav();
  const ch = useStore(s => cleanChallenge(s.challenges?.[id]));
  return (
    <Screen>
      <Header title="Challenge" small onBack={nav.pop} />
      {ch ? <ChallengeBody ch={ch} onGone={nav.pop} /> : <div className="scroll"><Empty title="This challenge is gone" text="It was taken off this phone." /></div>}
    </Screen>
  );
}

/** The challenge itself, kept fresh while it's on screen. */
function ChallengeBody({ ch: raw, onGone, standalone = false, onSkip }) {
  const nav = useNav();
  const state = useStore();
  // As it reads here: on the plan its round moved to, if it did
  const ch = challengeView(state, raw);
  const plan = planOf(state, ch);
  // Set up between you and someone else, opened from its link: which one are you?
  const pick = !ch.plan && ch.setBy && !ch.made && !ch.mine;
  useChallengesLive(ch.plan ? { planCode: plan?.code || null } : { code: ch.code });
  const next = challengeNextText(state, ch);
  return (
    <>
      <div className="scroll ch-page">
        <BallIllo className="ch-illo" />
        {pick && (
          <div className="block ch-pick">
            <p className="ch-mark">{ch.setBy.name} set this up between two of you. Which one are you?</p>
            <div className="ch-actions" role="group" aria-label="Which one are you?">
              {['from', 'to'].map(x => <button key={x} className="pill-btn" onClick={() => pickChallengeSide(ch.id, x)}>I’m {ch[x].name}</button>)}
            </div>
          </div>
        )}
        <ChallengeCard ch={ch} />
        {next && <p className="field-help pad">{next}</p>}
        {plan && !standalone && <button className="text-link" onClick={() => nav.push('plan', { id: plan.id })}><Icon name="calendar-check" /> See the round</button>}
        <ChallengeExtras ch={ch} onGone={onGone} />
        <p className="field-help pad">Friendly wagers only. Nobody holds or moves money here. You settle up yourselves.</p>
      </div>
      {standalone && <div className="cta-wrap"><button className="full-btn outline" onClick={onSkip}>Start my own round instead</button></div>}
    </>
  );
}

/**
 * Opened from a challenge link. Finds it, keeps it on this phone and shows it. `standalone`: someone
 * who hasn't set up the app, who answers with no account and never sees a paywall.
 */
export function ChallengeLink({ code, standalone = false, onSkip }) {
  const nav = useNav();
  const [id, setId] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const ch = useStore(s => (id ? cleanChallenge(s.challenges?.[id]) : null));

  useEffect(() => {
    let cancelled = false;
    openChallengeLink(code)
      .then(found => { if (cancelled) return; if (found) { setId(found); setErr(null); } else setErr('missing'); })
      .catch(e => { if (!cancelled) setErr(e instanceof ChallengesOffError ? 'off' : 'offline'); });
    return () => { cancelled = true; };
  }, [code, tries]);

  if (ch) {
    return (
      <Screen className={standalone ? 'plan-standalone' : ''}>
        {!standalone && <Header title="Challenge" small onBack={nav.pop} />}
        <ChallengeBody ch={ch} standalone={standalone} onSkip={onSkip} onGone={standalone ? onSkip : nav.pop} />
      </Screen>
    );
  }
  const missing = err === 'missing' || err === 'off';
  return (
    <Screen className="onboard">
      {!standalone && <Header title="Challenge" small onBack={nav.pop} />}
      <div className="scroll onboard-body">
        <BallIllo className="onboard-illo" face={!err} />
        <h1 className="onboard-title" style={{ fontSize: 34 }} aria-live="polite">{err ? (err === 'off' ? 'Not quite ready' : missing ? 'Challenge not found' : 'No signal') : 'Finding the challenge…'}</h1>
        <p className="onboard-text" aria-live="polite">
          {!err && <>Code {code}</>}
          {err === 'off' && <>Challenges aren’t switched on yet. Tell whoever sent it your answer in person.</>}
          {err === 'missing' && <>We can’t find challenge {code}. The link may be old. Ask for a fresh one.</>}
          {err === 'offline' && <>Couldn’t get the challenge. Check your signal and try again.</>}
        </p>
      </div>
      {err && (
        <div className="cta-wrap">
          {!missing && <button className="full-btn" onClick={() => { setErr(null); setTries(t => t + 1); }}>Try again <Icon name="arrow-clockwise" /></button>}
          {standalone && <button className={`full-btn ${missing ? '' : 'outline'}`} onClick={onSkip}>Start my own round instead</button>}
        </div>
      )}
    </Screen>
  );
}
