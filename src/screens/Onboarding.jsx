// Organizer onboarding: a welcome, four questions one a screen (with a payoff after three of
// them), your name with the friendly wagers note, then "Here's your group", which leads into
// getting the next round going (the one-screen ask, plan/PlanAsk.jsx: no day needed, the group
// answers from one link) and, when the flag is on, the paywall. Invited players arrive from a
// link and skip all of this.
import './onboarding.css';
import { Spot } from '../components/Spot.jsx';
import { GameArt } from '../components/GameArt.jsx';
import { Scene } from '../components/Scenes.jsx';
import { ArtImage } from '../components/ArtFile.jsx';
import { Stage } from '../components/Stage.jsx';
import { createContext, useContext, useEffect, useState } from 'react';
import { ArtIcon, Icon, Numpad, PickChip, PickMark, PickRow, Screen } from '../components/ui.jsx';
import { getState, update, uid } from '../lib/store.js';
import { track } from '../lib/analytics.js';
import { formatIndex } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { GAMES } from '../lib/round.js';
import { artFile } from '../lib/art-files.js';
import { playFromSearch } from '../lib/rule-links.js';
import { SignInSheet } from '../components/Account.jsx';
import { BuddyArt, BuddyFigure } from '../components/BuddyArt.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { BUDDIES, avatarModel, buddyAvatar } from '../lib/avatars.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import {
  MATHS, ONBOARD_GAMES, SETTLES, SIZES, answered, gameList, nextStep, organizerRecord, payoff, prevStep,
  progressOf, settleLabel, settleMath, sizeLabel, suggestedGame, toggleGame, asksAge, nameReady,
} from '../lib/onboarding.js';
import { AGE_COPY, setAgeAnswer } from '../lib/age.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { hasLifetimePro } from '../lib/pro-client.js';
import { shouldShowPaywall } from '../lib/paywall.js';

const QUESTION = {
  games: { q: 'What does your group play?', sub: 'Pick all that apply. You can play any of them later.' },
  size: { q: 'How many of you usually play?', options: SIZES },
  settle: { q: 'How do you settle up now?', options: SETTLES },
  math: { q: 'Who ends up doing the math?', options: MATHS },
};

// The group in the size question's picture: as many as you said, five at most (Crowd draws five)
const CROWD = ['visor', 'snapback', 'bucket', 'flatcap', 'shades'];
const crowdOf = size => CROWD.slice(0, Math.min(5, Number(size) || 4));

/**
 * The drawing at the top of each step. A scene is the setting behind a question: the first tee on
 * the welcome, the 19th hole for settling up, the table with the card out for the math. A spot is
 * one thing that reacts to what you've said: a hand of cards for the games, the group at the size
 * you picked, and on each payoff the answer it pays off (your payment app, the wallet, the tab).
 */
function artFor(step, a) {
  if (step === 'welcome') return { scene: 'course' };
  if (step === 'games') return { spot: 'cards' };
  if (step === 'size') return { spot: 'crowd', ids: crowdOf(a.size) };
  if (step === 'settle') return { scene: 'clubhouse' };
  if (step === 'math') return { scene: 'scorecard' };
  if (step === 'p-games') return { spot: 'shades' };
  if (step === 'p-settle') return { spot: { app: 'link', cash: 'wallet', tab: 'receipt' }[a.settle] || 'face-ok' };
  if (step === 'p-math') return { spot: a.math === 'me' ? 'skinsking' : 'card' };
  return null;
}

/**
 * A step's drawing, centred. A scene sits whole, the ground on its bottom edge, with the sticker
 * outline in the dark theme like every other drawing. A spot stands on its own. Decorative: screen
 * readers skip it.
 */
function StepArt({ art }) {
  if (!art) return null;
  if (art.scene) {
    const file = artFile('scenes', art.scene);
    return (
      <div className="ob-art ob-art-scene">
        {file ? (
          <svg viewBox="0 0 1792 1024" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
            <ArtImage file={file} w={1792} h={1024} />
          </svg>
        ) : <Scene kind={art.scene} />}
      </div>
    );
  }
  return (
    <div className="ob-art ob-art-spot">
      <Spot kind={art.spot} ids={art.ids} size={160} className="ob-spot" />
    </div>
  );
}

// The step on stage now. A page on its way out (Stage keeps it a beat to animate) goes inert, so
// its buttons can't be tapped or read twice while the next page comes in
const OnStage = createContext(null);
function Page({ step, children }) {
  const out = useContext(OnStage) !== step;
  return <div className={`ob-page ${step === 'welcome' ? 'first' : ''}`} inert={out} aria-hidden={out || undefined}>{children}</div>;
}

/** What's left before Continue, in one short line: "Add your name and tick Friendly wagers to go on." */
function stillToDo(left) {
  const l = left.filter(Boolean);
  if (!l.length) return null;
  const said = l.length === 1 ? l[0] : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
  return `${said[0].toUpperCase()}${said.slice(1)} to go on.`;
}

/** The welcome's game tags: they drift a little, and wiggle when tapped, since they look tappable. Decorative. */
const WELCOME_TAGS = [['bank', 'Banker'], ['flag-pennant', 'Nassau'], ['coins', 'Skins'], ['paw-print', 'Wolf'], ['dice-five', 'Vegas'], ['sword', 'Match play'], ['star', 'Stableford']];
function GameTag({ icon, name, i }) {
  const [wiggle, setWiggle] = useState(0);
  return (
    <span className={`chip ochre ob-tag ${wiggle ? 'wiggle' : ''}`} style={{ '--i': i }} aria-hidden="true"
      onPointerDown={() => setWiggle(w => w + 1)} onAnimationEnd={e => { if (e.animationName === 'tagWiggle') setWiggle(0); }}>
      <ArtIcon name={icon} /> {name}
    </span>
  );
}

/**
 * `onDone(routes)`: called when onboarding finishes, with the screens to open on top of Up next
 * ([name, params] pairs), just before the app switches over. `play`: a rule page's ?play= game to start with ticked.
 */
export default function Onboarding({ onDone, play = null }) {
  const [step, setStep] = useState('welcome');
  // Which way the last move went, so a step slides in from the side you're heading to and the one
  // it replaces leaves the other way (Stage.jsx)
  const [dir, setDir] = useState('push');
  // Arrived from "Play this now" on a game's rule page: that game is already ticked, and so it's
  // the one the first round suggests
  const [game] = useState(() => (play ? playFromSearch(`play=${encodeURIComponent(play)}`)?.game ?? null : null));
  const [a, setA] = useState(() => ({ games: GAMES[game] ? [game] : [], size: null, settle: null, math: null }));
  // Starting over from Settings: you're already saved, so your name and index come filled in
  const [name, setName] = useState(() => getState().players?.[getState().me]?.name || '');
  const [index, setIndex] = useState(() => getState().players?.[getState().me]?.index ?? null);
  const [buddy, setBuddy] = useState(null); // a Ball buddy to start with (your profile has the rest)
  const [agreed, setAgreed] = useState(false);
  const [age, setAge] = useState(null); // 'adult' | 'under', asked when the group plays for money (age.js)
  const [pad, setPad] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const acct = useAccount();

  // Signed in with an account that has no rounds yet: skip the welcome and prefill the name
  const [greeted, setGreeted] = useState(null);
  if (acct.user && acct.state === 'synced' && greeted !== acct.user.id) {
    setGreeted(acct.user.id);
    setSigningIn(false);
    if (step === 'welcome') { setDir('push'); setStep('games'); }
    if (!name) setName((acct.user.name || '').split(' ')[0]);
  }

  // The steps' outside drawings start loading on the welcome, so each is there when its page slides in
  useEffect(() => {
    for (const [kind, id] of [['scenes', 'clubhouse'], ['scenes', 'scorecard'], ['spots', 'cards'], ['spots', 'shades'], ['spots', 'link'], ['spots', 'wallet'], ['spots', 'receipt'], ['spots', 'face-ok'], ['spots', 'skinsking'], ['spots', 'card']]) {
      const f = artFile(kind, id);
      for (const url of [f?.light, f?.dark]) if (url) new Image().src = url;
    }
  }, []);

  // The buddy you pick starts loading now, so All set's card has your face on arrival, not a bare circle (onboarding-7)
  useEffect(() => {
    const f = buddy ? artFile('buddies', buddy) : null;
    for (const url of [f?.light, f?.dark]) if (url) new Image().src = url;
  }, [buddy]);

  // Near the end, warm what opens next (the ask, the paywall), so finishing never shows a blank frame
  // while their code loads
  const nearEnd = step === 'name' || step === 'group';
  useEffect(() => {
    if (!nearEnd) return;
    import('./NewRound.jsx').catch(() => {});
    import('./Paywall.jsx').catch(() => {});
  }, [nearEnd]);

  // Each step is a page of its own on the stage, so it starts at the top wherever the last one was scrolled to
  const next = () => { setDir('push'); setStep(nextStep(step)); };
  const back = () => { setDir('pop'); setStep(prevStep(step)); };
  const set = (k, v) => setA(x => ({ ...x, [k]: v }));

  // Save who you are and your answers, then open the ask for the next round (and the paywall under
  // it, so backing out of the ask still lands there). The ask starts from what you told us: the
  // games you play lead its ballot, and the one game you play is already picked.
  const finish = planNext => {
    const organizer = organizerRecord(a);
    const paywall = shouldShowPaywall({ organizer }, PAYWALL_ON, { pro: hasLifetimePro() }) ? [['paywall', { source: 'onboarding' }]] : [];
    const routes = planNext ? [...paywall, ['newRound', { ahead: true, onboarding: true, games: organizer.games }]] : paywall;
    onDone?.(routes);
    track('onboarding_finished', { path: planNext ? 'plan' : 'done', from: play ? 'rules' : 'app' });
    update(s => {
      // Starting over keeps you as the same player, so your rounds and the Tab stay yours
      const again = s.me && s.players[s.me] ? s.me : null;
      const id = again || uid('p_');
      if (again) { s.players[id].name = name.trim(); s.players[id].index = index; }
      else s.players[id] = { id, name: name.trim(), index, venmo: '', createdAt: Date.now() };
      s.me = id;
      if (buddy) s.profile = { ...(s.profile || {}), avatar: buddyAvatar(buddy), updatedAt: Date.now() };
      s.organizer = organizer;
      if (asksAge(a) && age) setAgeAnswer(s, age);
      s.onboarded = true;
    });
  };

  // `hint` says what's left when Continue can't go yet, so a grey button never looks broken
  const cta = (label = 'Continue', ok = true, hint = null) => (
    <div className="cta-wrap">
      <button className="full-btn" disabled={!ok} onClick={next}>{label} <Icon name="arrow-right" /></button>
      {!ok && hint && <p className="ob-hint" role="status">{hint}</p>}
    </div>
  );

  // One page per step: its scroll and its buttons. The back button and the progress bar stay put above them.
  const page = () => {
    if (step === 'welcome') {
      return (<>
        <div className="scroll ob-welcome">
          <StepArt art={artFor(step, a)} />
          <h1 className="onboard-title">Birdie Bank</h1>
          <p className="onboard-text">The bank for your golf game. Play any game, settle every bet, keep the Tab all season.</p>
          <div className="onboard-games" role="img" aria-label={`${WELCOME_TAGS.map(t => t[1]).join(', ')} and ${Object.keys(GAMES).length - WELCOME_TAGS.length} more games`}>
            {[...WELCOME_TAGS, ['dots-three-circle', `+ ${Object.keys(GAMES).length - WELCOME_TAGS.length} more games`]].map(([i, n], k) => (
              <GameTag key={n} icon={i} name={n} i={k} />
            ))}
          </div>
        </div>
        <div className="cta-wrap">
          <button className="full-btn" onClick={next}>Set up my group <Icon name="arrow-right" /></button>
          {accountsEnabled && <button className="full-btn outline" onClick={() => setSigningIn(true)}>I have an account</button>}
          <p className="pw-fine">Got a link from a friend? Open it and you’re in, no setup.</p>
        </div>
      </>);
    }

    if (step === 'games') {
      return (<>
        <div className="scroll ob-body">
          <StepArt art={artFor(step, a)} />
          <h1 className="ob-q d">{QUESTION.games.q}</h1>
          <p className="ob-sub">{QUESTION.games.sub}</p>
          <div className="ob-tiles">
            {/* The game a rule page sent you with leads the list, even when it isn't one of the usual eight */}
            {[...(GAMES[game] && !ONBOARD_GAMES.includes(game) ? [game] : []), ...ONBOARD_GAMES].map(k => {
              const g = GAMES[k];
              const on = a.games.includes(k);
              return (
                <button key={k} className={`ob-tile ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${g.name}: ${g.blurb}`} onClick={() => setA(x => ({ ...x, games: toggleGame(x.games, k) }))}>
                  <span className="ob-tile-top"><GameArt game={k} className="ob-tile-art" />{on && <PickMark on small />}</span>
                  <span className="ob-tile-name">{g.name}</span>
                  <span className="ob-tile-sub">{g.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
        {cta('Continue', answered('games', a), 'Pick at least one game to go on.')}
      </>);
    }

    if (QUESTION[step]) {
      const q = QUESTION[step];
      return (<>
        <div className="scroll ob-body">
          <StepArt art={artFor(step, a)} />
          <h1 className="ob-q d">{q.q}</h1>
          <div className="ob-choices" role="radiogroup" aria-label={q.q}>
            {q.options.map(o => {
              const on = a[step] === o.value;
              return (
                <PickRow key={o.value} radio on={on} label={o.sub ? `${o.label}. ${o.sub}` : o.label} className="ob-choice" onClick={() => set(step, o.value)}
                  title={o.label} sub={o.sub} />
              );
            })}
          </div>
        </div>
        {cta('Continue', answered(step, a), 'Pick one to go on.')}
      </>);
    }

    const p = payoff(step, a);
    if (p) {
      return (<>
        <div className="scroll ob-body ob-payoff">
          <StepArt art={artFor(step, a)} />
          <div className="eyebrow">{p.eyebrow}</div>
          <h1 className="ob-q d">{p.title}</h1>
          <p className="ob-sub">{p.text}</p>
          {step === 'p-games' && <SampleMoney game={suggestedGame(a)} />}
          {step === 'p-settle' && <FewestPayments size={a.size} />}
          {step === 'p-math' && <FourJobs />}
        </div>
        {cta()}
      </>);
    }

    if (step === 'name') {
      return (<>
        <div className="scroll ob-body ob-form">
          <h1 className="ob-q d">Last thing. What should the group call you?</h1>
          {acct.user && <p className="field-help" style={{ marginTop: 0 }}>Signed in as {acct.user.email}. Your rounds will save to your account.</p>}
          <label className="field-label" htmlFor="ob-name">Your name</label>
          <input id="ob-name" aria-label="Your name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
          <label className="field-label" htmlFor="ob-index">Handicap <span className="opt">optional</span></label>
          <button id="ob-index" className={`name-input ob-field-btn ${index == null ? 'empty' : ''}`} aria-label={index == null ? 'Handicap, optional. Add' : `Handicap ${formatIndex(index)}. Change`} onClick={() => setPad(true)}>
            <span>{index == null ? 'Add your index' : formatIndex(index)}</span><Icon name={index == null ? 'plus' : 'pencil-simple'} />
          </button>
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
          <button className={`list-item pick ob-agree ${agreed ? 'on' : ''}`} role="checkbox" aria-checked={agreed} aria-label="Friendly wagers only" aria-describedby="ob-agree-sub" onClick={() => {
            setAgreed(!agreed);
            // Ticked with the age question still to answer below the fold: bring it into view, since Continue waits on it
            if (!agreed && asksAge(a) && !age) requestAnimationFrame(() => document.querySelector('.ob-age')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
          }}>
            <PickMark on={agreed} add={false} />
            <div className="row-main">
              <div className="li-name">Friendly wagers only</div>
              <div className="li-sub" id="ob-agree-sub">Birdie Bank tracks bets between friends. It never holds, sends or collects money. Check that betting on golf is legal where you play.</div>
            </div>
          </button>
          {asksAge(a) && (
            <div className="ob-age">
              <div className="field-label" id="ob-age-q">{AGE_COPY.title}</div>
              <div className="chip-row flush" role="radiogroup" aria-labelledby="ob-age-q" aria-describedby="ob-age-help">
                {[['adult', AGE_COPY.yes], ['under', AGE_COPY.no]].map(([v, label]) => (
                  <PickChip key={v} radio on={age === v} onClick={() => setAge(v)}>{label}</PickChip>
                ))}
              </div>
              <p className="field-help" id="ob-age-help">{age === 'under'
                ? 'No problem. You can keep score and play for points or a reward. Money rounds wait until you’re 18.'
                : 'Playing for money is for adults: 18 or older, or the age where you live if it’s higher. We only ask once.'}</p>
            </div>
          )}
        </div>
        {cta('Continue', nameReady({ name, agreed, age }, a), stillToDo([
          !name.trim() && 'add your name',
          !agreed && 'tick Friendly wagers',
          asksAge(a) && !age && 'answer the age question',
        ]))}
      </>);
    }

    // "All set": who you are and what you told us, each line checked off, then the next round. What
    // each answer gets you was said on its payoff, so it isn't listed again here.
    const rows = [
      ['Your games', gameList(a.games)],
      ['Usually', sizeLabel(a.size)],
      ['Settling up', settleLabel(a.settle)],
      ['The math', 'Birdie Bank, every time'],
    ];
    const first = name.trim();
    // The finish gets its moment: your group, you first, at the size you said (onboarding-8)
    const crew = [...new Set([buddy || CROWD[0], ...crowdOf(a.size)])].slice(0, crowdOf(a.size).length);
    return (<>
      <div className="scroll ob-body ob-done">
        <StepArt art={{ spot: 'crowd', ids: crew }} />
        <div className="eyebrow">All set</div>
        <h1 className="ob-q d">{first}, your group is ready.</h1>
        <div className="block ob-review">
          <div className="ob-review-me">
            <Avatar name={first} model={buddy ? avatarModel(buddyAvatar(buddy), { name: first }) : null} size="lg" className="ob-review-av" />
            <div className="row-main">
              <div className="li-name">{first}</div>
              <div className="li-sub">Runs the group{index != null ? ` · ${formatIndex(index)} index` : ''}</div>
            </div>
          </div>
          {rows.map(([k, v], i) => (
            <div key={k} className="ob-review-row" style={{ '--i': i }}>
              <div className="row-main"><div className="ob-review-k">{k}</div><div className="ob-review-v">{v || '–'}</div></div>
              <Icon name="check-circle" fill className="ob-review-tick" />
            </div>
          ))}
        </div>
        <p className="ob-sub ob-next">No day needed. Send the group one link, see who’s in, and they help pick the day, the course and the game.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => finish(true)}>Get a round going <Icon name="arrow-right" /></button>
        <button className="full-btn outline" onClick={() => finish(false)}>I’ll do it later</button>
      </div>
    </>);
  };

  const progress = progressOf(step);
  return (
    <Screen className="ob-flow">
      {/* Hidden on the welcome rather than gone, so the bar fills from where it was as you move */}
      <div className={`ob-top ${step === 'welcome' ? 'off' : ''}`} aria-hidden={step === 'welcome' || undefined}>
        <button className="header-back" onClick={back} aria-label="Back" tabIndex={step === 'welcome' ? -1 : undefined}><Icon name="arrow-left" /></button>
        <div className="ob-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      <div className="ob-stage">
        <OnStage.Provider value={step}>
          <Stage id={step} dir={dir}>
            <Page step={step}>{page()}</Page>
          </Stage>
        </OnStage.Provider>
      </div>
      {signingIn && <SignInSheet open source="onboarding" onClose={() => setSigningIn(false)} title="Welcome back" text="Sign in and your rounds, players and the Tab come right back." />}
      <Numpad open={pad && step === 'name'} title="Handicap" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </Screen>
  );
}

/**
 * A made-up round in progress, drawn as a phone on the table (tilted, in a bezel, with a sticker)
 * so it reads as a picture of the app and not a piece of UI to tap: the money after hole 4.
 */
function SampleMoney({ game }) {
  const rows = [['You', 15], ['Mike', 5], ['Dave', -5], ['Sam', -15]];
  return (
    <div className="ob-mock" role="img" aria-label={`Example: ${GAMES[game]?.name || 'the game'} after hole 4, you up ${money(15)}, Mike up ${money(5)}, Dave down ${money(5)}, Sam down ${money(15)}`}>
      <div className="ob-phone">
        <div className="ob-phone-screen">
          <div className="ob-phone-bar"><span>Hole 4</span><span>{GAMES[game]?.name}</span></div>
          <div className="ob-money">
            {rows.map(([n, v], i) => (
              <div key={n} className={`ob-cell ${i === 0 ? 'lead' : ''}`}>
                <div className="li-sub">{n}</div>
                <div className={`ob-amt ${v > 0 ? 'up' : 'down'}`}>{money(v, { sign: true })}</div>
              </div>
            ))}
          </div>
          <div className="ob-phone-holes">{Array.from({ length: 9 }, (_, h) => <i key={h} className={h < 4 ? 'on' : ''} />)}</div>
        </div>
      </div>
      <span className="chip ochre ob-mock-tag">Live, hole by hole</span>
    </div>
  );
}

/**
 * The group as a ring of buddies, twice: every IOU between them as a tangle of grey lines, then
 * the few pink payments that square it. The numbers say how many; the picture says why it's easier.
 */
function FewestPayments({ size }) {
  const m = settleMath(size);
  // Two of you: one debt, one payment, so there's nothing to show being cut down
  if (m.debts <= m.payments) return null;
  const n = m.people;
  const who = BUDDIES.filter(b => b.shelf === 'buddies').map(b => b.id);
  const sz = n <= 4 ? 30 : n <= 8 ? 22 : 19;
  const R = 60 - sz / 2 - 2;
  const pts = Array.from({ length: n }, (_, i) => { const t = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [60 + R * Math.cos(t), 60 + R * Math.sin(t)]; });
  const nodes = pts.map(([x, y], i) => <BuddyFigure key={i} id={who[i % who.length]} x={x - sz / 2} y={y - sz / 2} size={sz} />);
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  // A payment runs from each of the others to the one who's up, stopping short of the ball
  const toward = ([x1, y1], [x2, y2], back) => { const d = Math.hypot(x2 - x1, y2 - y1); return [x2 - ((x2 - x1) / d) * back, y2 - ((y2 - y1) / d) * back]; };
  return (
    <div className="ob-iou" role="img" aria-label={`${m.debts} possible IOUs between ${n} of you, cut to ${m.payments} payments`}>
      <div className="ob-iou-side">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <g stroke="var(--mute-soft)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" opacity=".8">{pairs.map(([i, j]) => <path key={`${i}${j}`} d={`M${pts[i][0]} ${pts[i][1]} L${pts[j][0]} ${pts[j][1]}`} />)}</g>
          {nodes}
        </svg>
        <b className="ob-iou-n d">{m.debts}</b><span className="li-sub">IOUs to untangle</span>
      </div>
      <Icon name="arrow-right" className="ob-iou-arrow" />
      <div className="ob-iou-side on">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <defs><marker id="ob-iou-head" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8Z" fill="var(--pink-fill)" /></marker></defs>
          <g stroke="var(--pink-fill)" strokeWidth="2.6" strokeLinecap="round" markerEnd="url(#ob-iou-head)">{pts.slice(1).map((p, i) => { const [x2, y2] = toward(p, pts[0], sz / 2 + 5); const [x1, y1] = toward(pts[0], p, sz / 2 + 2); return <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} />; })}</g>
          {nodes}
        </svg>
        <b className="ob-iou-n d">{m.payments}</b><span className="li-sub">payments, and it’s square</span>
      </div>
    </div>
  );
}

/** The four jobs, each with "You" crossed out and a Birdie Bank stamp slapped over it, one after another. */
function FourJobs() {
  return (
    <ul className="block ob-jobs" aria-label="The four jobs, all Birdie Bank’s now: set up the game, keep the card, do the math, chase the payments">
      {['Set up the game', 'Keep the card', 'Do the math', 'Chase the payments'].map((t, i) => (
        <li key={t} style={{ '--i': i }}>
          <span className="ob-job-name">{t}</span>
          <span className="ob-job-who" aria-hidden="true"><s className="ob-job-you">You</s><b className="ob-stamp d">Birdie Bank</b></span>
        </li>
      ))}
    </ul>
  );
}
