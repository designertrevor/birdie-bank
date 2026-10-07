// Organizer onboarding: a welcome, four questions one a screen (with a payoff after three of
// them), your name with the friendly wagers note, then "Here's your group", which leads into
// setting up the next round (the plan flow: the organizer suggests, the group votes) and, when
// the flag is on, the paywall. Invited players arrive from a link and skip all of this.
import { Spot, SpotScene } from '../components/Spot.jsx';
import { GameArt } from '../components/GameArt.jsx';
import { Scene, sceneShows } from '../components/Scenes.jsx';
import { useEffect, useState } from 'react';
import { ArtIcon, Icon, Numpad, PickChip, PickMark, PickRow, Screen } from '../components/ui.jsx';
import { update, uid } from '../lib/store.js';
import { formatIndex } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { GAMES } from '../lib/round.js';
import { playFromSearch } from '../lib/rule-links.js';
import { SignInSheet } from '../components/Account.jsx';
import { BuddyArt, BuddyFigure } from '../components/BuddyArt.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { BUDDIES, buddyAvatar } from '../lib/avatars.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import {
  MATHS, ONBOARD_GAMES, SETTLES, SIZES, answered, ballotGames, gameList, nextStep, organizerRecord, payoff, prevStep,
  progressOf, readyLines, settleLabel, settleMath, sizeLabel, suggestedGame, toggleGame, asksAge, nameReady,
} from '../lib/onboarding.js';
import { AGE_COPY, setAgeAnswer } from '../lib/age.js';
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
 * ([name, params] pairs), just before the app switches over. `play`: a rule page's ?play= game to start with ticked.
 */
/**
 * The setting behind each question: the tee for the games and the group (a foursome on the size
 * question, since most groups are four at most), the 19th hole for settling up, the table with the
 * card out for the math. Each question has its own; none repeats the one before.
 */
function sceneFor(step) {
  if (step === 'games') return { kind: 'course', ids: ['visor', 'snapback', 'bucket'] };
  if (step === 'size') return { kind: 'course', ids: ['visor', 'snapback', 'bucket', 'flatcap'] };
  if (step === 'settle') return { kind: 'clubhouse', ids: ['visor', 'snapback', 'bucket', 'shades'] };
  if (step === 'math') return { kind: 'scorecard', ids: ['flatcap', 'visor', 'snapback', 'bucket'] };
  return null;
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

/** The ball that walks you through setup, reacting to what you've said so far. */
function guideFor(step, a) {
  if (step === 'games') return 'tee';
  if (step === 'size') return 'crowd';
  if (step === 'settle') return 'wallet';
  if (step === 'math') return 'card';
  if (step === 'p-games') return 'face-great';
  if (step === 'p-settle') return a.settle === 'none' ? 'face-ok' : 'highfive';
  if (step === 'p-math') return 'shades';
  return null;
}

export default function Onboarding({ onDone, play = null }) {
  const [step, setStep] = useState('welcome');
  // Arrived from "Play this now" on a game's rule page: that game is already ticked, and so it's
  // the one the first round suggests
  const [game] = useState(() => (play ? playFromSearch(`play=${encodeURIComponent(play)}`)?.game ?? null : null));
  const [a, setA] = useState(() => ({ games: GAMES[game] ? [game] : [], size: null, settle: null, math: null }));
  const [name, setName] = useState('');
  const [index, setIndex] = useState(null);
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
    if (step === 'welcome') setStep('games');
    if (!name) setName((acct.user.name || '').split(' ')[0]);
  }

  // Each step starts at the top: the scroll is one element across steps, so a name step scrolled to
  // the age question would otherwise open the review with its title out of view
  useEffect(() => { document.querySelector('.onboard .scroll')?.scrollTo(0, 0); }, [step]);

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
      if (asksAge(a) && age) setAgeAnswer(s, age);
      s.onboarded = true;
    });
  };

  if (step === 'welcome') {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <Scene kind="course" ids={['bucket', 'shades', 'snapback', 'visor']} className="ob-scene" />
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
        {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} title="Welcome back" text="Sign in and your rounds, players and the Tab come right back." />}
      </Screen>
    );
  }

  // The back button and the progress bar. On a question with a scene, the scene runs from the
  // very top of the phone (behind the status bar) and this bar sits over its sky.
  const scene = sceneFor(step);
  const top = (
    <div className={`ob-head ${scene && sceneShows(scene.kind) ? 'scenic' : ''}`}>
      {scene && <Scene key={step} {...scene} className="ob-scene" />}
      <div className="ob-top">
        <button className="header-back" onClick={back} aria-label="Back"><Icon name="arrow-left" /></button>
        <div className="ob-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressOf(step) * 100)}>
          <i style={{ width: `${progressOf(step) * 100}%` }} />
        </div>
      </div>
    </div>
  );
  // `hint` says what's left when Continue can't go yet, so a grey button never looks broken
  const cta = (label = 'Continue', ok = true, hint = null) => (
    <div className="cta-wrap">
      <button className="full-btn" disabled={!ok} onClick={next}>{label} <Icon name="arrow-right" /></button>
      {!ok && hint && <p className="ob-hint" role="status">{hint}</p>}
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
                <PickRow key={o.value} radio on={on} label={o.sub ? `${o.label}. ${o.sub}` : o.label} className="ob-choice" onClick={() => set(step, o.value)}
                  title={o.label} sub={o.sub} />
              );
            })}
          </div>
        </div>
        {cta('Continue', answered(step, a), 'Pick one to go on.')}
      </Screen>
    );
  }

  const p = payoff(step, a);
  if (p) {
    return (
      <Screen className="onboard">
        {top}
        <div className="scroll ob-body">
          {guideFor(step, a) && <Spot key={step} kind={guideFor(step, a)} size={84} className="ob-guide" ids={['visor', 'snapback']} />}
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
        {cta('Continue', nameReady({ name, agreed, age }, a), [
          !name.trim() && 'add your name',
          !agreed && 'tick Friendly wagers only',
          asksAge(a) && !age && 'answer the age question',
        ].filter(Boolean).join(', then ').replace(/^./, c => `To go on, ${c}`) + '.')}
        <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
          onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
      </Screen>
    );
  }

  // "All set": who you are, what you told us (each line checked off), what's ready, then the next round
  const rows = [
    ['Your games', gameList(a.games)],
    ['Usually', sizeLabel(a.size)],
    ['Settling up', settleLabel(a.settle)],
    ['The math', 'Birdie Bank, every time'],
  ];
  const first = name.trim();
  return (
    <Screen className="onboard">
      {top}
      <div className="scroll ob-body">
        <div className="eyebrow">All set</div>
        <h1 className="ob-q d">{first}, your group is ready.</h1>
        <div className="block ob-review">
          <div className="ob-review-me">
            <Avatar name={first} model={buddy ? buddyAvatar(buddy) : null} size="lg" className="ob-review-av" />
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
        <ul className="pw-list ob-ready">
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
      <span className="chip pink ob-mock-tag">Live, hole by hole</span>
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
