// Organizer onboarding: a welcome, four questions one a screen (with a payoff after three of
// them), your name with the friendly wagers note, then "Here's your group", which leads into
// setting up the next round (the plan flow: the organizer suggests, the group votes) and, when
// the flag is on, the paywall. Invited players arrive from a link and skip all of this.
import { useState } from 'react';
import { BallIllo, Icon, Numpad, Screen } from '../components/ui.jsx';
import { update, uid } from '../lib/store.js';
import { formatIndex } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { GAMES } from '../lib/round.js';
import { SignInSheet } from '../components/Account.jsx';
import { BuddyArt } from '../components/BuddyArt.jsx';
import { BUDDIES, buddyAvatar } from '../lib/avatars.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import {
  MATHS, ONBOARD_GAMES, SETTLES, SIZES, answered, ballotGames, gameList, nextStep, organizerRecord, payoff, prevStep,
  progressOf, readyLines, settleLabel, settleMath, sizeLabel, suggestedGame, toggleGame,
} from '../lib/onboarding.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { shouldShowPaywall } from '../lib/paywall.js';

const QUESTION = {
  games: { q: 'What does your group play?', sub: 'Pick all that apply. You can play any of them later.' },
  size: { q: 'How many of you usually play?', options: SIZES },
  settle: { q: 'How do you settle up now?', options: SETTLES },
  math: { q: 'Who ends up doing the math?', options: MATHS },
};

/**
 * `onDone(routes)`: called when onboarding finishes, with the screens to open on top of Up next
 * ([name, params] pairs), just before the app switches over.
 */
export default function Onboarding({ onDone }) {
  const [step, setStep] = useState('welcome');
  const [a, setA] = useState({ games: [], size: null, settle: null, math: null });
  const [name, setName] = useState('');
  const [index, setIndex] = useState(null);
  const [buddy, setBuddy] = useState(null); // a Ball buddy to start with (your profile has the rest)
  const [agreed, setAgreed] = useState(false);
  const [pad, setPad] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const acct = useAccount();

  // Signed in with an account that has no rounds yet: skip the welcome and prefill the name
  const [greeted, setGreeted] = useState(null);
  if (acct.user && acct.state === 'synced' && greeted !== acct.user.id) {
    setGreeted(acct.user.id);
    setSigningIn(false);
    if (step === 'welcome') setStep('games');
    if (!name) setName((acct.user.name || '').split(' ')[0]);
  }

  const go = s => setStep(s);
  const next = () => go(nextStep(step));
  const back = () => go(prevStep(step));
  const set = (k, v) => setA(x => ({ ...x, [k]: v }));

  // Save who you are and your answers, then open the next round's plan (and the paywall under it,
  // so backing out of the plan still lands there)
  const finish = planNext => {
    const organizer = organizerRecord(a);
    const paywall = shouldShowPaywall({ organizer }, PAYWALL_ON) ? [['paywall', { source: 'onboarding' }]] : [];
    const routes = planNext
      ? [...paywall, ['newRound', { ahead: true, game: suggestedGame(a), ballot: ballotGames(a), onboarding: true }]]
      : paywall;
    onDone?.(routes);
    update(s => {
      const id = uid('p_');
      s.players[id] = { id, name: name.trim(), index, venmo: '', createdAt: Date.now() };
      s.me = id;
      if (buddy) s.profile = { ...(s.profile || {}), avatar: buddyAvatar(buddy), updatedAt: Date.now() };
      s.organizer = organizer;
      s.onboarded = true;
    });
  };

  if (step === 'welcome') {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" />
          <h1 className="onboard-title">Birdie Bank</h1>
          <p className="onboard-text">The bank for your golf game. Play any game, settle every bet, keep the Tab all season.</p>
          <div className="onboard-games">
            {[['bank', 'Banker'], ['flag-pennant', 'Nassau'], ['coins', 'Skins'], ['paw-print', 'Wolf'], ['dice-five', 'Vegas'], ['sword', 'Match play'], ['star', 'Stableford'], ['dots-three-circle', `+ ${Object.keys(GAMES).length - 7} more games`]].map(([i, n]) => (
              <span key={n} className="chip ochre"><Icon name={i} fill /> {n}</span>
            ))}
          </div>
        </div>
        <div className="cta-wrap">
          <button className="full-btn" onClick={next}>Set up my group <Icon name="arrow-right" /></button>
          {accountsEnabled && <button className="full-btn outline" onClick={() => setSigningIn(true)}>I have an account</button>}
          <p className="pw-fine">Got a link from a friend? Open it and you’re in, no setup.</p>
        </div>
        {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} title="Welcome back" text="Sign in and your rounds, players and the Tab come right back." />}
      </Screen>
    );
  }

  const top = (
    <div className="ob-top">
      <button className="header-back" onClick={back} aria-label="Back"><Icon name="arrow-left" /></button>
      <div className="ob-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressOf(step) * 100)}>
        <i style={{ width: `${progressOf(step) * 100}%` }} />
      </div>
    </div>
  );
  const cta = (label = 'Continue', ok = true) => (
    <div className="cta-wrap">
      <button className="full-btn" disabled={!ok} onClick={next}>{label} <Icon name="arrow-right" /></button>
    </div>
  );

  if (step === 'games') {
    return (
      <Screen className="onboard">
        {top}
        <div className="scroll ob-body">
          <h1 className="ob-q d">{QUESTION.games.q}</h1>
          <p className="ob-sub">{QUESTION.games.sub}</p>
          <div className="ob-tiles">
            {ONBOARD_GAMES.map(k => {
              const g = GAMES[k];
              const on = a.games.includes(k);
              return (
                <button key={k} className={`ob-tile ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${g.name}: ${g.blurb}`} onClick={() => setA(x => ({ ...x, games: toggleGame(x.games, k) }))}>
                  <span className="ob-tile-top"><Icon name={g.icon} fill />{on && <Icon name="check-circle" fill className="ob-tick" />}</span>
                  <span className="ob-tile-name">{g.name}</span>
                  <span className="ob-tile-sub">{g.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
        {cta('Continue', answered('games', a))}
      </Screen>
    );
  }

  if (QUESTION[step]) {
    const q = QUESTION[step];
    return (
      <Screen className="onboard">
        {top}
        <div className="scroll ob-body">
          <h1 className="ob-q d">{q.q}</h1>
          <div role="radiogroup" aria-label={q.q}>
            {q.options.map(o => {
              const on = a[step] === o.value;
              return (
                <button key={o.value} role="radio" aria-checked={on} aria-label={o.sub ? `${o.label}. ${o.sub}` : o.label} className={`list-item ob-choice ${on ? 'on' : ''}`} onClick={() => set(step, o.value)}>
                  <div className="row-main">
                    <div className="li-name">{o.label}</div>
                    {o.sub && <div className="li-sub">{o.sub}</div>}
                  </div>
                  <span className={`li-check ${on ? 'on' : ''}`}>{on && <Icon name="check" />}</span>
                </button>
              );
            })}
          </div>
        </div>
        {cta('Continue', answered(step, a))}
      </Screen>
    );
  }

  const p = payoff(step, a);
  if (p) {
    return (
      <Screen className="onboard">
        {top}
        <div className="scroll ob-body">
          <div className="eyebrow">{p.eyebrow}</div>
          <h1 className="ob-q d">{p.title}</h1>
          <p className="ob-sub">{p.text}</p>
          {step === 'p-games' && <SampleMoney game={suggestedGame(a)} />}
          {step === 'p-settle' && <FewestPayments size={a.size} />}
          {step === 'p-math' && <FourJobs />}
        </div>
        {cta()}
      </Screen>
    );
  }

  if (step === 'name') {
    return (
      <Screen className="onboard">
        {top}
        <div className="scroll ob-body">
          <h1 className="ob-q d">Last thing. What should the group call you?</h1>
          {acct.user && <p className="field-help" style={{ marginTop: 0 }}>Signed in as {acct.user.email}. Your rounds will save to your account.</p>}
          <label className="field-label" htmlFor="ob-name">Your name</label>
          <input id="ob-name" aria-label="Your name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
          <label className="field-label" htmlFor="ob-index">Handicap index <span className="opt">optional</span></label>
          <button id="ob-index" className="amt-btn field-btn" aria-label={index == null ? 'Handicap index, optional. Add' : `Handicap index ${formatIndex(index)}. Change`} onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
          <p className="field-help">No handicap? Leave it blank. When you do use them, the best player gets no strokes and everyone else gets the difference.</p>
          <div className="field-label" id="ob-buddy">Pick a Ball buddy <span className="opt">optional</span></div>
          <div className="av-grid ob-buddies" role="radiogroup" aria-labelledby="ob-buddy">
            {BUDDIES.slice(0, 8).map(b => (
              <button key={b.id} type="button" role="radio" aria-checked={buddy === b.id} aria-label={b.name} className={`av-pick sm ${buddy === b.id ? 'on' : ''}`} onClick={() => setBuddy(buddy === b.id ? null : b.id)}>
                <span className="avatar av-buddy av-tile"><BuddyArt id={b.id} bg={b.bg} /></span>
                {buddy === b.id && <span className="av-check" aria-hidden="true"><Icon name="check" /></span>}
              </button>
            ))}
          </div>
          <p className="field-help">Friends see it on seats and the Tab. Add a photo or pick another any time from your profile.</p>
          <button className={`list-item ob-agree ${agreed ? 'on' : ''}`} role="checkbox" aria-checked={agreed} aria-label="Friendly wagers only" aria-describedby="ob-agree-sub" onClick={() => setAgreed(v => !v)}>
            <span className={`li-check ${agreed ? 'on' : ''}`}>{agreed && <Icon name="check" />}</span>
            <div className="row-main">
              <div className="li-name">Friendly wagers only</div>
              <div className="li-sub" id="ob-agree-sub">Birdie Bank tracks bets between friends. It never holds, sends or collects money. Check that betting on golf is legal where you play.</div>
            </div>
          </button>
        </div>
        {cta('Continue', !!name.trim() && agreed)}
        <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
          onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
      </Screen>
    );
  }

  // "Here's your group": what they told us, what's ready, then the next round
  const rows = [
    ['Plays', gameList(a.games)],
    ['Size', sizeLabel(a.size)],
    ['Settles', settleLabel(a.settle)],
    ['Math', 'Birdie Bank'],
  ];
  return (
    <Screen className="onboard">
      {top}
      <div className="scroll ob-body">
        <h1 className="ob-q d">Here’s your group, {name.trim()}</h1>
        <div className="block ob-card">
          <div className="ob-card-head"><span className="eyebrow">Your group</span><span className="chip pink">You’re the bank</span></div>
          {rows.map(([k, v]) => <div key={k} className="ready-row"><span>{k}</span><b>{v || '–'}</b></div>)}
        </div>
        <ul className="block pw-list">
          {readyLines(a).map(t => <li key={t}><Icon name="check-circle" fill /> {t}</li>)}
        </ul>
        <p className="ob-sub">Pick the day and the course, suggest a game and a bet, and the group votes from one link. About 30 seconds.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => finish(true)}>Set up your next round <Icon name="arrow-right" /></button>
        <button className="full-btn outline" onClick={() => finish(false)}>I’ll do it later</button>
      </div>
    </Screen>
  );
}

/** A made-up live money bar, so the payoff shows what the money looks like mid-round. */
function SampleMoney({ game }) {
  const rows = [['You', 15], ['Mike', 5], ['Dave', -5], ['Sam', -15]];
  return (
    <div className="block ob-sample" aria-label="Example: the money after hole 4">
      <div className="ob-card-head"><span className="eyebrow">The money · hole 4</span><span className="eyebrow">{GAMES[game]?.name}</span></div>
      <div className="ob-money">
        {rows.map(([n, v], i) => (
          <div key={n} className={`ob-cell ${i === 0 ? 'lead' : ''}`}>
            <div className="li-sub">{n}</div>
            <div className={`ob-amt ${v > 0 ? 'up' : 'down'}`}>{money(v, { sign: true })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Debts between the group against the payments that square them. */
function FewestPayments({ size }) {
  const m = settleMath(size);
  // Two of you: one debt, one payment, so there's nothing to show being cut down
  if (m.debts <= m.payments) return null;
  return (
    <div className="block ob-sample ob-fewest">
      <div><div className="ob-big d">{m.debts}</div><div className="li-sub">possible debts between {m.people} of you</div></div>
      <Icon name="arrow-right" />
      <div><div className="ob-big d">{m.payments}</div><div className="li-sub">payments at most to square up</div></div>
    </div>
  );
}

function FourJobs() {
  return (
    <ul className="block pw-list ob-sample">
      {['Set up the game', 'Keep the card', 'Do the math', 'Chase the payments'].map(t => (
        <li key={t}><Icon name="check-circle" fill /> <span style={{ flex: 1 }}>{t}</span><span className="li-sub">Birdie Bank</span></li>
      ))}
    </ul>
  );
}
