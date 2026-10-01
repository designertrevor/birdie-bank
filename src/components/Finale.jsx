// The end of a round in three beats: the money reveal, settling up, and a results card to share.
import { useEffect, useRef, useState } from 'react';
import { Header, Icon, Toggle, useUI } from './ui.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { roundResults } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { payInfoFor } from '../lib/pay.js';
import { PayButton, RequestButton } from './Pay.jsx';
import { AvatarArt } from './Avatar.jsx';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { gameLabel, meFor, placeOf, roundDate, roundPlayerName, shareRound } from '../lib/format.js';
import { gamesLine } from '../lib/side-games.js';
import { markRoundAsked, roundAsked, submitReaction } from '../lib/feedback.js';
import { codeOf } from '../lib/shared-tab.js';
import { markTransfer, undoPayments, useTabSync } from '../lib/tab-sync.js';
import { useNav } from '../lib/nav.js';
import { revealSteps, revealTiming } from '../lib/reveal.js';
import { IMAGE_H, IMAGE_W, renderShareImage, shareImageName } from '../lib/shareImage.js';
import { countsMoney, playForOf, rewardOutcome, unitFmt } from '../lib/play-for.js';

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts from 0 up to `target`, easing out, and holds the final value once done. `skip` jumps to the end.
 * Also returns the phase ('wait' before the delay, 'count', then 'done') so CSS can dim, wake and pop the number.
 */
function useCountUp(target, { delay = 0, duration = 1100, skip = false } = {}) {
  const [v, setV] = useState(() => (skip || reducedMotion() ? target : 0));
  const [phase, setPhase] = useState(() => (skip || reducedMotion() ? 'done' : 'wait'));
  useEffect(() => {
    const still = skip || reducedMotion();
    let raf, t0 = null;
    const tick = t => {
      if (t0 == null) t0 = t;
      const k = still ? 1 : Math.min(1, Math.max(0, (t - t0 - delay) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3)) * 100) / 100);
      setPhase(k >= 1 ? 'done' : t - t0 >= delay ? 'count' : 'wait');
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // No animation frames (a phone in low-power mode, a tab in the background, a screenshot tool):
    // land on the real amount anyway, so a bet that reads "1 up" never sits at $0
    const land = setTimeout(() => { cancelAnimationFrame(raf); setV(target); setPhase('done'); }, delay + duration + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(land); };
  }, [target, delay, duration, skip]);
  return [v, phase];
}

function CountRow({ place, name, face, amount, me, delay, duration, skip, games = '', fmt = money, index = 0 }) {
  const [v, phase] = useCountUp(amount, { delay, duration, skip });
  const done = v === amount;
  // Motion hooks: --i staggers the entrance, the phase dims the number until its turn, then pops it when it lands
  const motion = `${phase}${phase === 'done' && amount !== 0 ? ' landed' : ''}`;
  return (
    <div className={`reveal-row ${place === 1 && amount > 0 && done ? 'top' : ''}`} style={{ '--i': index }}>
      <div className="sr">{place}</div>
      {face && <AvatarArt model={face} size="sm" className="rv-av" />}
      <div className="sn">{name}{me ? ' (you)' : ''}{games && <span className="rv-games">{games}</span>}</div>
      {/* Whole dollars while counting, then the exact amount: $2.50 used to land on "+$3" */}
      <div className={`reveal-amt ${motion} ${done && amount > 0 ? 'pos' : done && amount < 0 ? 'neg' : ''}`}>{fmt(done ? amount : Math.round(v), { sign: true })}</div>
    </div>
  );
}

function StepAmount({ amount, skip, fmt = money }) {
  const [v, phase] = useCountUp(amount, { duration: 380, skip });
  // Whole dollars while counting, then the exact amount (a split skin or pot share can have cents)
  return <span className={`rv-n ${phase === 'done' && amount ? 'landed' : ''}`}>{fmt(v === Math.round(amount * 100) / 100 ? v : Math.round(v))}</span>;
}

/** One bet resolving: what it was, who took it, and for how much. Laid out from the start so nothing jumps. */
function RevealStep({ step, on, skip, fmt = money }) {
  let val = '–';
  if (step.value) val = step.value;
  else if (step.amount != null) val = on ? <StepAmount amount={step.amount} skip={skip} fmt={fmt} /> : fmt(0);
  return (
    <div className={`rv-step ${on ? 'on' : ''} ${step.tie ? 'tie' : ''}`} aria-hidden={!on}>
      <div className="rv-main">
        <div className="rv-label">{step.label}</div>
        {step.text && <div className="rv-text">{step.text}</div>}
      </div>
      <div className="rv-val">{val}</div>
    </div>
  );
}

/**
 * Beat 1: the bets resolve one by one (legs and presses, skins, points), then everyone's
 * total counts up from $0, the winner last to land. Tap anywhere to jump to the end.
 */
export function Reveal({ round, res, onNext, onDetail, extra, instant = false }) {
  const state = useStore();
  const hero = useRef();
  const me = meFor(round, state);
  const faces = useGroupAvatars(round.players);
  const top = res.standings[0];
  const tied = res.standings.filter(p => p.amount === top.amount).length > 1;
  const square = res.standings.every(p => p.amount === 0);
  const count = res.standings.length;
  const { title: stepsTitle, steps } = revealSteps(round, res);
  // A points or reward round counts up in points, and has nobody to pay
  const fmt = unitFmt(round);
  const pays = countsMoney(round) && res.transfers.length > 0;
  const reward = playForOf(round).kind === 'reward';
  const nSteps = steps.length;
  const t = revealTiming(nSteps, count);
  // Coming back to this beat (or reduced motion) shows the end state straight away
  const [skipped, setSkipped] = useState(() => instant || reducedMotion());
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const done = skipped || landed;
  const visible = skipped ? nSteps : shown;
  // Every bet has resolved: the card tightens (see .rv-card.compact), so the totals land on one screen
  const resolved = nSteps > 0 && visible >= nSteps;
  const scroller = useRef();
  useEffect(() => {
    if (!(resolved || done) || instant) return;
    // A long card or long names can still push the last total off a phone screen: bring it up, and
    // again when the totals land (an exact amount like +$33.34 is wider, so a row can grow)
    const id = setTimeout(() => {
      const el = scroller.current;
      const rows = el?.querySelectorAll('.reveal-row');
      const last = rows?.[rows.length - 1];
      if (!last) return;
      // The buttons float over the bottom of the scroll, so the screen ends where they start
      const cta = el.parentElement?.querySelector('.cta-wrap');
      const bottom = Math.min(el.getBoundingClientRect().bottom, cta ? cta.getBoundingClientRect().top : Infinity);
      const over = last.getBoundingClientRect().bottom - bottom + 12;
      if (over > 0) el.scrollBy({ top: over, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, done ? 500 : 120); // after the last total's landing pop
    return () => clearTimeout(id);
  }, [resolved, done, instant]);

  useEffect(() => {
    if (skipped) return;
    const timers = Array.from({ length: nSteps }, (_, i) => setTimeout(() => { setShown(i + 1); buzz(6); }, i * t.gap + 150));
    timers.push(setTimeout(() => setLanded(true), t.landed));
    return () => timers.forEach(clearTimeout);
  }, [skipped, nSteps, t.gap, t.landed]);
  useEffect(() => {
    if (!done || square || instant) return;
    confettiFrom(hero.current, 70);
    buzz([20, 40, 20]);
  }, [done, square, instant]);

  // Partners who won together are one winning side, not a tie
  const leaders = res.standings.filter(p => p.amount === top.amount).map(p => p.id);
  const side = tied && round.teams?.find(tm => tm.players.length === leaders.length && tm.players.every(pid => leaders.includes(pid)));
  const leaderNames = res.standings.filter(p => leaders.includes(p.id)).map(p => p.name.split(' ')[0]).join(' & ');
  // A reward round says what's won: "Ann wins lunch", "Ann and Bo share a drink"
  const prize = reward ? rewardOutcome(round, res) : null;
  const winnerTitle = prize?.winners.length ? prize.win.replace(/\.$/, '')
    : square ? 'All square' : side ? `${side.name} take it` : tied ? `${leaderNames} tie for top` : `${top.name.split(' ')[0]} takes it`;
  const title = done || !nSteps ? winnerTitle : 'Adding it up';
  // Both titles share one grid cell and crossfade, so the swap never moves the rows below
  const titles = nSteps ? ['Adding it up', winnerTitle] : [winnerTitle];
  return (
    <>
      <Header title="Final results" small />
      <div ref={scroller} className={`scroll rv-scroll ${skipped ? 'rv-still' : ''}`} onClick={() => { if (!done) setSkipped(true); }}>
        <div className="reveal-head" ref={hero}>
          <div className="eyebrow">{round.course.name} · {gameLabel(round)}</div>
          <div className="reveal-title d">
            {titles.map(x => <span key={x} className={`rt ${x === title ? '' : 'out'}`} aria-hidden={x !== title}>{x}</span>)}
          </div>
          <div className={`rv-skip ${done ? 'gone' : ''}`} aria-hidden={done}>Tap to skip</div>
        </div>
        {nSteps > 0 && (
          <div className={`rv-card ${resolved ? 'compact' : ''}`}>
            <div className="rv-card-title">{stepsTitle}</div>
            {steps.map((s, i) => <RevealStep key={s.key} step={s} on={i < visible} skip={skipped} fmt={fmt} />)}
          </div>
        )}
        {/* Losers land first, the winner last. Equal money shares a place, so partners both land on top */}
        {res.standings.map((p, i) => (
          <CountRow key={p.id} place={placeOf(res.standings, res.standings.indexOf(p))} name={p.name} face={faces.get(p.id)} amount={p.amount} me={p.id === me}
            delay={t.stepsEnd + (count - 1 - i) * t.stagger} duration={t.count} skip={skipped} games={gamesLine(res.detail?.byGame, p.id, fmt)} fmt={fmt} index={i} />
        ))}
        {/* A reward round: who wins it and who's buying, where the payments would be */}
        {reward && <div className={`rv-reward-wrap ${done ? 'on' : ''}`} aria-hidden={!done}><RewardCard round={round} res={res} /></div>}
        {extra}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onNext}>{pays ? <>Who pays who <Icon name="arrow-right" /></> : <>Share results <Icon name="arrow-right" /></>}</button>
        <button className="full-btn outline" onClick={onDetail}>See the full breakdown</button>
      </div>
    </>
  );
}

/**
 * A reward round's result, where the payments would be: "Sam wins lunch. Dave's buying." No
 * pay buttons: it isn't money. The Tab keeps a line on each person card until it's marked done.
 */
export function RewardCard({ round, res }) {
  const me = useStore(s => meFor(round, s));
  const o = rewardOutcome(round, res);
  if (!o) return null;
  const square = !o.winners.length;
  // Only a reward you win or owe goes on this phone's Tab, so only then does the card say so
  const mine = o.winners.includes(me) || o.owers.includes(me);
  return (
    <div className={`reward-card ${square ? 'square' : ''}`}>
      <Icon name={square ? 'handshake' : 'gift'} fill className="rc-icon" />
      <div className="rc-text">
        <div className="rc-win d">{o.win}</div>
        <div className="rc-buy">{o.buy}</div>
        {!square && <div className="rc-note">{mine ? 'It stays on your Tab until it’s done. ' : ''}No money changes hands.</div>}
      </div>
    </div>
  );
}

/** Beat 2: the fewest payments, a pay or request button for yours (in the payee's own app), and a way to mark each paid. */
export function SettleUp({ round, res, onBack, onNext }) {
  const state = useStore();
  const { showToast } = useUI();
  const me = meFor(round, state);
  const name = id => roundPlayerName(round, id).split(' ')[0];
  const paidFor = t => state.settlements.find(s => s.roundId === round.id && s.from === t.from && s.to === t.to);
  const paidCount = res.transfers.filter(paidFor).length;
  const note = `${gameLabel(round)} at ${round.course.name}`;

  // A shared round's payments go to both phones (one row per transfer, so two marks count once)
  const code = codeOf(round);
  useTabSync({ live: !!code });
  const toggle = t => {
    const s = paidFor(t);
    if (s) {
      // One tap, no confirm: the toast puts it back
      const redo = undoPayments([s]);
      showToast(`${name(t.from)} owes ${name(t.to)} again`, { label: 'Undo', run: redo });
      return;
    }
    markTransfer(round, t, code);
    buzz(15);
    showToast(`${name(t.from)} is square with ${name(t.to)}`, { label: 'Undo', run: () => {
      const x = getState().settlements.findLast(z => z.roundId === round.id && z.from === t.from && z.to === t.to);
      if (x) undoPayments([x]);
    } });
  };
  // Pay buttons only for your own payments: pay in the payee's app, or request when you're owed
  const myApp = payInfoFor(state, state.me);
  const missingApp = res.transfers.some(t => t.from === me && !payInfoFor(state, t.to));
  const n = res.transfers.length;

  return (
    <>
      <Header title="Settle up" onBack={onBack} />
      <div className="scroll">
        <div className="settle-lede">
          <div className="d settle-count">{n} payment{n === 1 ? '' : 's'} square{n === 1 ? 's' : ''} everyone up</div>
          <p>Every bet is netted first, so nobody sends money that just comes back to them.</p>
        </div>
        {res.transfers.map((t, i) => {
          const paid = !!paidFor(t);
          return (
            <div key={t.from + t.to} className={`pay-card ${paid ? 'paid' : ''}`} style={{ '--i': i }}>
              <div className="pay-who">
                <span className="pf">{name(t.from)}{t.from === me ? ' (you)' : ''}</span>
                <span className="pa"><Icon name="arrow-right" /></span>
                <span className="pt">{name(t.to)}{t.to === me ? ' (you)' : ''}</span>
                <span className="pm">{money(t.amount)}</span>
              </div>
              <div className="pay-acts">
                {!paid && t.from === me && <PayButton info={payInfoFor(state, t.to)} amount={t.amount} note={note} />}
                {!paid && t.to === me && <RequestButton payer={payInfoFor(state, t.from)} mine={myApp} amount={t.amount} note={note} />}
                <button className={`pay-btn ${paid ? 'done' : ''}`} onClick={() => toggle(t)} aria-pressed={paid}>
                  <Icon name={paid ? 'check-circle' : 'circle'} fill={paid} /> {paid ? 'Paid' : 'Mark paid'}
                </button>
              </div>
            </div>
          );
        })}
        <p className="field-help pad">
          {paidCount === n ? 'All paid. Nice and tidy.' : `${paidCount} of ${n} paid. Anything left stays on the Tab.`}
          {missingApp ? ' Add each person’s payment app in Players to get pay buttons.' : ''}
        </p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onNext}>Share results <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}

/**
 * Beat 3: a results image sized for stories and the group chat. The PNG is drawn ahead of time
 * so the share sheet opens straight from the tap (iOS drops the share if we make it wait).
 */
export function ShareCard({ round, res, onBack, onDone, doneLabel = 'Done' }) {
  const { showToast } = useUI();
  // Off by default so nobody posts the money by accident; your choice is remembered
  const moneyOn = useStore(s => !!s.settings.shareAmounts);
  // Points are bragging rights, not money, so a points or reward round always shows them
  const isMoney = countsMoney(round);
  const showAmounts = isMoney ? moneyOn : true;
  const fmt = unitFmt(round);
  const reward = rewardOutcome(round, res);
  const setShowAmounts = on => update(s => { s.settings.shareAmounts = on; });
  const [img, setImg] = useState(null); // { blob, url, amounts }
  // Everyone tied for the top, so a shared win isn't credited to whoever sorted first
  const tops = res.standings.filter(p => p.amount > 0 && p.amount === res.standings[0].amount);

  useEffect(() => {
    let alive = true;
    renderShareImage(round, roundResults(round), { showAmounts })
      .then(blob => { if (alive) setImg({ blob, url: URL.createObjectURL(blob), amounts: showAmounts }); })
      .catch(() => { if (alive) setImg(null); });
    return () => { alive = false; };
  }, [round, showAmounts]);
  // Free each image once a newer one replaces it
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  const ready = img && img.amounts === showAmounts;
  const fileName = shareImageName(round);
  // Phones get the system share sheet (Messages, Instagram, Save Image), never a download page.
  // Only a device that can't share files (most desktops) downloads the PNG instead.
  const shareImage = async () => {
    if (!ready || typeof File === 'undefined') return;
    const file = new File([img.blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* closed the sheet */ }
      return;
    }
    const a = document.createElement('a');
    a.href = img.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Image saved to your downloads');
  };
  const shareTextOnly = () => shareRound(round, res, showToast, { amounts: showAmounts });

  return (
    <>
      <Header title="Share" onBack={onBack} />
      <div className="scroll">
        {img ? (
          <img className="share-img" src={img.url} width={IMAGE_W} height={IMAGE_H}
            alt={`Results card: ${round.course.name}, ${gameLabel(round)}. ${res.standings.map((p, i) => `${placeOf(res.standings, i)}. ${p.name}${showAmounts ? ` ${fmt(p.amount, { sign: true })}` : ''}`).join(', ')}${reward ? `. ${reward.text}` : ''}`} />
        ) : (
          <div className="share-card">
            <div className="sc-brand">Birdie Bank</div>
            <div className="sc-meta">{round.course.name} · {roundDate(round)} · {gameLabel(round)}</div>
            <div className="sc-big d">{tops.length ? <>{tops.map(p => p.name.split(' ')[0]).join(' & ')}{showAmounts && <><br />{fmt(tops[0].amount, { sign: true })}</>}</> : 'All square'}</div>
            {reward && <div className="sc-meta">{reward.text}</div>}
            <div className="sc-list">
              {res.standings.map(p => (
                <div key={p.id} className="sc-line"><span>{p.name}</span>{showAmounts && <span>{fmt(p.amount, { sign: true })}</span>}</div>
              ))}
            </div>
          </div>
        )}
        {isMoney && (
          <div className="toggle-row share-toggle">
            <div><div className="toggle-lbl">Show amounts</div><div className="toggle-sub">{showAmounts ? 'Dollar figures are on the image' : 'Only the order and the bets, no money'}</div></div>
            <Toggle on={showAmounts} onChange={setShowAmounts} label="Show amounts" />
          </div>
        )}
        <HowWasIt round={round} />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={shareImage} disabled={!ready}><Icon name="share-network" /> {ready ? 'Share image' : 'Making the image…'}</button>
        <div className="cta-row">
          <button className="full-btn outline" onClick={shareTextOnly}><Icon name="text-aa" /> Share as text</button>
          <button className="full-btn outline" onClick={onDone}>{doneLabel}</button>
        </div>
      </div>
    </>
  );
}

// "How was Birdie Bank today?" shows once per round: the first time it appears it's saved as asked on this phone,
// and it stays put for the rest of this visit until answered or dismissed.
const shownNow = new Set();
const answered = new Set();
const RECENT = 3 * 24 * 60 * 60 * 1000; // only ask about rounds that just finished

const REACTIONS = [
  { key: 'great', icon: 'smiley', label: 'Great', kind: 'feature', lead: 'Glad it was a good one. Anything that would make the next round even better?' },
  { key: 'ok', icon: 'smiley-meh', label: 'Just OK', kind: 'feature', lead: 'Thanks for saying so. What would have made it better?' },
  { key: 'off', icon: 'smiley-sad', label: 'Something was off', kind: 'bug', lead: 'Sorry about that. Tell us what went wrong and we’ll look into it.' },
];

/**
 * A small, dismissible check-in after a round. One tap saves the reaction as feedback straight
 * away (it waits on the phone with no signal), then offers a form to say more.
 */
export function HowWasIt({ round }) {
  const nav = useNav();
  const [show] = useState(() => {
    if (!nav || round.status !== 'done' || answered.has(round.id)) return false;
    if (Date.now() - (round.finishedAt || round.createdAt || 0) > RECENT) return false;
    return shownNow.has(round.id) || !roundAsked(round.id);
  });
  const [gone, setGone] = useState(false);
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (!show) return;
    shownNow.add(round.id);
    markRoundAsked(round.id);
  }, [show, round.id]);
  if (!show || gone) return null;

  const close = () => { answered.add(round.id); setGone(true); };
  const extra = r => ({ reaction: r.key, roundGame: gameLabel(round) || round.game });
  const pick = r => {
    answered.add(round.id);
    setPicked(r);
    submitReaction({ reaction: r.key, label: r.label, details: extra(r), roundId: round.id }).catch(() => { /* stays queued */ });
  };
  const more = () => {
    close();
    nav.push('suggest', { kind: picked.kind, lead: picked.lead, roundId: round.id, extra: extra(picked) });
  };
  return (
    <div className="checkin" role="group" aria-labelledby={`checkin-${round.id}`}>
      <div className="checkin-head">
        <span className="checkin-q" id={`checkin-${round.id}`} aria-live="polite">{picked ? 'Thanks, that helps.' : 'How was Birdie Bank today?'}</span>
        <button className="checkin-x" onClick={close} aria-label={picked ? 'Close' : 'No thanks'}><Icon name="x" /></button>
      </div>
      <div className="checkin-opts">
        {picked
          ? <button className="pill-btn" onClick={more}><Icon name="chat-circle-dots" /> Tell us more</button>
          : REACTIONS.map(r => <button key={r.key} className="pill-btn" onClick={() => pick(r)}><Icon name={r.icon} /> {r.label}</button>)}
      </div>
    </div>
  );
}
