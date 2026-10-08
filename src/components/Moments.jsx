// Big moments during a round: a banner when a skin is won (bigger for a long carry), a lone or blind
// wolf, a big Vegas swing, a Sixes match won or swept, a Banker sweep or birdie double, a Hammer back
// or fold, the money lead changing hands, a Match play or Nassau lead change, all square, dormie or a
// nine won, and a full screen for a match won before the last hole. One per hole at most. The maths
// is in lib/moments.js. After the ninth hole of eighteen, the halfway sheet (lib/halfway.js): where
// things stand and every score so far, after the hole's own banner if it had one, never on top of it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Sheet } from './ui.jsx';
import { AvatarArt } from './Avatar.jsx';
import { Scorecard } from './Scorecard.jsx';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { donePositions, finalMoment, firstShowing, freshHole, roundMoment } from '../lib/moments.js';
import { atHalfway, halfwayFor } from '../lib/halfway.js';
import { buzz, confetti, confettiFrom } from '../lib/delight.js';

const ICON = {
  won: 'trophy', halved: 'handshake', change: 'arrows-left-right', dormie: 'lock-simple', square: 'scales', lead: 'arrow-circle-up',
  skin: 'coins', bigskin: 'coins', skinlost: 'arrow-u-up-left', lonewolf: 'paw-print', blindwolf: 'paw-print', wolfdown: 'paw-print', swing: 'dice-five',
  money: 'crown-simple', final: 'flag-checkered',
  sixwon: 'arrows-clockwise', sixsweep: 'broom', sixtriple: 'medal', sixhalved: 'handshake',
  banksweep: 'bank', bankbust: 'piggy-bank', bankbirdie: 'bird', bankbig: 'bank',
  hammer: 'hammer', hammerback: 'hammer', fold: 'hand-palm',
};
// The ones that throw confetti and buzz twice; the rest get a single buzz and the pop
const CHEER = new Set([
  'won', 'change', 'bigskin', 'lonewolf', 'blindwolf', 'swing', 'money', 'final',
  'sixwon', 'sixsweep', 'sixtriple', 'banksweep', 'bankbirdie', 'bankbig', 'hammer', 'hammerback',
]);
// The biggest ones stay up a second longer and throw more confetti
const BIG = new Set(['bigskin', 'final', 'sixsweep', 'sixtriple', 'banksweep', 'hammerback']);
const BANNER_MS = 3200;
// Holes this phone has already shown a moment for ("roundId:pos"), so undoing and rescoring a hole,
// or leaving the round and coming back, never shows it twice
const SHOWN = new Set();
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Watches the round and shows the moment for each newly scored hole, on every phone (the keeper's and
 * the ones following along). Only a single new hole counts (see freshHole): a burst of holes arriving
 * at once, a fixed score on an earlier hole, or the last hole (the end-of-round reveal takes over)
 * shows nothing. `onFinish` ends the round from the match-won screen (the keeper only). `onShowing`
 * hears whether a moment (or the halfway sheet) is up, so the "Any side bets?" card waits until it's gone.
 */
export function RoundMoments({ round, onFinish, onShowing = null }) {
  const done = donePositions(round);
  const [moment, setMoment] = useState(null);
  // The halfway sheet's model, worked out as the ninth hole lands so a tenth coming in meanwhile doesn't change it
  const [half, setHalf] = useState(null);
  // The holes as last seen: when a new one is in, work out its moment (set during render, like MoneyBar)
  const key = done.join(',');
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    const fresh = freshHole(round, seen ? seen.split(',').map(Number) : [], done);
    const m = fresh && (fresh.final ? { ...finalMoment(round), level: 'medium', id: `${fresh.pos}:final` } : roundMoment(round, fresh.pos));
    if (m && firstShowing(SHOWN, round.id, fresh.pos)) setMoment(m);
    if (atHalfway(round, fresh) && firstShowing(SHOWN, round.id, 'half')) setHalf(halfwayFor(round));
  }

  // Before paint, so the card is never drawn under a moment that just arrived (reduced motion skips its fade)
  useLayoutEffect(() => { onShowing?.(!!moment || !!half); }, [moment, half, onShowing]);
  if (!moment && !half) return null;
  const close = () => setMoment(null);
  return (
    <>
      {moment && (moment.level === 'big'
        ? <MatchWon key={moment.id} moment={moment} onClose={close} onFinish={onFinish && !moment.more ? () => { close(); onFinish(); } : null} />
        : <MomentBanner key={moment.id} moment={moment} round={round} onClose={close} />)}
      {/* The ninth hole's own banner goes first; the sheet comes up once it has left, so the two never stack */}
      {half && !moment && <HalfwaySheet model={half} round={round} onClose={() => setHalf(null)} />}
    </>
  );
}

/**
 * Halfway through eighteen (lib/halfway.js): where things stand after nine as a bottom sheet, with
 * the game's own summary, everyone's money so far and the first nine's card. Display only: the
 * money is what the bar already shows.
 */
function HalfwaySheet({ model, round, onClose }) {
  const faces = useGroupAvatars(round.players);
  useEffect(() => { buzz([15, 30, 15]); }, []);
  return (
    <Sheet open onClose={onClose} title="Halfway" className="sc-sheet">
      <div className="hw-head">
        <div className="hw-title d">{model.title}</div>
        <p className="hw-text">{model.text}</p>
      </div>
      {model.steps.length > 0 && (
        <div className="hw-card">
          <div className="rv-card-title">{model.stepsTitle}</div>
          {model.steps.map(s => (
            <div key={s.key} className={`hw-row ${s.tie ? 'tie' : ''}`}>
              <div className="hw-main">
                <div className="hw-label">{s.label}</div>
                {s.text && <div className="hw-line">{s.text}</div>}
              </div>
              {s.value && <div className="hw-val">{s.value}</div>}
            </div>
          ))}
        </div>
      )}
      {model.standings && (
        <div className="hw-card">
          <div className="rv-card-title">{model.money ? 'Money so far' : 'Points so far'}</div>
          {model.standings.map(p => (
            <div key={p.id} className="hw-row">
              {faces.get(p.id) && <AvatarArt model={faces.get(p.id)} size="sm" />}
              <div className="hw-main"><div className="hw-line">{p.name}</div></div>
              <div className={`hw-val ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{model.fmt(p.amount, { sign: true })}</div>
            </div>
          ))}
        </div>
      )}
      <div className="sec-label hw-sec">Every score so far</div>
      <Scorecard round={round} holes={model.holes} />
      <div className="cta-wrap"><button className="full-btn" onClick={onClose}>Play on <Icon name="arrow-right" /></button></div>
    </Sheet>
  );
}

/** A card that rises above the buttons (the money bar stays in view), cheers a little and leaves on its own. Tap to dismiss. */
function MomentBanner({ moment, round, onClose }) {
  const faces = useGroupAvatars(round?.players);
  const hero = moment.hero && faces.get(moment.hero);
  const ref = useRef(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    // Confetti for a win or a lead change; the rest get a buzz and the pop
    const cheer = CHEER.has(moment.kind);
    if (cheer) confettiFrom(ref.current?.querySelector('.mo-ic'), BIG.has(moment.kind) && moment.kind !== 'final' ? 48 : 28);
    buzz(cheer ? [20, 40, 20] : 15);
    const t = setTimeout(() => setOut(true), BIG.has(moment.kind) ? BANNER_MS + 1000 : BANNER_MS);
    return () => clearTimeout(t);
  }, [moment]);
  // With reduced motion there's no exit animation to wait for, so it just goes
  useEffect(() => { if (out && reduced()) onClose(); }, [out, onClose]);
  return (
    <button ref={ref} type="button" className={`moment-banner k-${moment.kind} ${out ? 'out' : ''}`} onClick={() => setOut(true)}
      onAnimationEnd={e => { if (out && e.target === e.currentTarget) onClose(); }} role="status" aria-live="polite">
      {/* The player it's about, as their buddy; a moment about nobody in particular keeps its icon */}
      <span className={`mo-ic ${hero ? 'mo-face' : ''}`}>{hero ? <AvatarArt model={hero} /> : <Icon name={ICON[moment.kind]} fill />}</span>
      <span className="mo-txt"><span className="mo-title">{moment.title}</span><span className="mo-sub">{moment.text}</span></span>
    </button>
  );
}

/** The match is over before the last hole: a full screen to say so, like finishing a lesson. */
function MatchWon({ moment, onClose, onFinish }) {
  const ref = useRef(null);
  const btn = useRef(null);
  useEffect(() => {
    btn.current?.focus();
    buzz([30, 60, 30, 60, 80]);
    const burst = () => {
      const r = ref.current?.querySelector('.mw-trophy')?.getBoundingClientRect();
      if (r) confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
    };
    const a = setTimeout(burst, 250), b = setTimeout(burst, 900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const holes = `${moment.left} hole${moment.left === 1 ? '' : 's'}`;
  // On the page itself, above the toasts: the hole's money toast would sit on the buttons
  return createPortal(
    <div ref={ref} className="match-won" role="dialog" aria-modal="true" aria-labelledby="mw-title" aria-describedby="mw-sub">
      <div className="mw-rays" aria-hidden="true" />
      <div className="mw-body">
        <div className="mw-trophy"><Icon name="trophy" fill /></div>
        <p className="mw-eyebrow">Match over</p>
        <h2 id="mw-title" className="mw-title">{moment.title}</h2>
        <p className="mw-score">{moment.text}</p>
        <p id="mw-sub" className="mw-sub">
          {moment.more ? `Presses or side games are still going, so keep scoring the last ${holes}.` : `The match can’t be caught with ${holes} to play.`}
        </p>
      </div>
      <div className="mw-actions">
        <button ref={btn} type="button" className="full-btn" onClick={onClose}>Keep playing</button>
        {onFinish && <button type="button" className="full-btn outline" onClick={onFinish}>Finish the round here</button>}
      </div>
    </div>,
    document.body,
  );
}
