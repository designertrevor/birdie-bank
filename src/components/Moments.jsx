// Big moments during a head-to-head match: a banner for a lead change, all square, dormie or a nine won,
// and a full screen for a match won before the last hole. The maths is in lib/moments.js.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { gameView, nassauWinners, nassauAmounts, roundLegs, sides, sideNames, sideGamesOf, holeComplete } from '../lib/round.js';
import { nassauBets } from '../lib/golf.js';
import { matchMoment } from '../lib/moments.js';
import { buzz, confetti, confettiFrom } from '../lib/delight.js';

const ICON = { won: 'trophy', halved: 'handshake', change: 'arrows-left-right', dormie: 'lock-simple', square: 'scales', lead: 'arrow-circle-up' };
const BANNER_MS = 3200;

/**
 * Watches the match and shows the moment for each newly scored hole, on every phone (the keeper's and
 * the ones following along). Only a single new hole counts: a burst of holes arriving at once, a fixed
 * score on an earlier hole, or the last hole (the end-of-round reveal takes over) shows nothing.
 * `onFinish` ends the round from the match-won screen (the keeper only).
 */
export function MatchMoments({ round, onFinish }) {
  const match = round.game === 'match' || round.game === 'nassau';
  const main = match ? gameView(round, 'main') : null;
  const winners = main ? nassauWinners(main) : null;
  const [moment, setMoment] = useState(null);
  // The match as last shown: when a hole's result arrives, work out its moment (set during render, like MoneyBar)
  const key = winners ? JSON.stringify(winners) : '';
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    const m = winners && newMoment(round, main, seen ? JSON.parse(seen) : {}, winners);
    if (m) setMoment(m);
  }

  if (!moment) return null;
  const close = () => setMoment(null);
  return moment.level === 'big'
    ? <MatchWon key={moment.id} moment={moment} onClose={close} onFinish={onFinish && !moment.more ? () => { close(); onFinish(); } : null} />
    : <MomentBanner key={moment.id} moment={moment} onClose={close} />;
}

function newMoment(round, main, before, winners) {
  const fresh = Object.keys(winners).map(Number).filter(p => before[p] === undefined);
  if (fresh.length !== 1 || round.status !== 'active' || round.editing) return null;
  const pos = fresh[0];
  // Only the newest hole in play: filling in a skipped earlier hole is a fix, not a moment
  if (pos === round.holes.length || Object.keys(winners).some(p => Number(p) > pos)) return null;
  const m = matchMoment(winners, pos, roundLegs(main), {
    names: sideNames(round).map(n => (round.teams ? n : n.split(' ')[0])),
    plural: sides(main).map(s => !!round.teams && s.length > 1),
    holeNo: round.holes[pos - 1]?.no ?? pos,
  });
  if (!m) return null;
  // What's still in play after the match is won: presses and side games keep going
  if (m.level === 'big') {
    const bets = nassauBets(winners, main.presses || [], nassauAmounts(main), roundLegs(main));
    m.more = bets.some(b => !b.status.done) || sideGamesOf(round).length > 0;
    m.left = round.holes.filter(h => !holeComplete(round, h)).length;
  }
  return { ...m, id: `${pos}:${m.kind}:${m.leg}` };
}

/** A card that drops in under the header, cheers a little and leaves on its own. Tap to dismiss. */
function MomentBanner({ moment, onClose }) {
  const ref = useRef(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    // Confetti for a win or a lead change; the rest get a buzz and the pop
    if (moment.kind === 'won' || moment.kind === 'change') confettiFrom(ref.current?.querySelector('.mo-ic'), 28);
    buzz(moment.kind === 'won' || moment.kind === 'change' ? [20, 40, 20] : 15);
    const t = setTimeout(() => setOut(true), BANNER_MS);
    return () => clearTimeout(t);
  }, [moment]);
  return (
    <button ref={ref} type="button" className={`moment-banner k-${moment.kind} ${out ? 'out' : ''}`} onClick={() => setOut(true)}
      onAnimationEnd={e => { if (out && e.target === e.currentTarget) onClose(); }} role="status" aria-live="polite">
      <span className="mo-ic"><Icon name={ICON[moment.kind]} fill /></span>
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
