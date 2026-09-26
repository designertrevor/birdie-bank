// The end of a round in three beats: the money reveal, settling up, and a results card to share.
import { useEffect, useRef, useState } from 'react';
import { Header, Icon, Toggle, useUI } from './ui.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { GAMES, roundResults } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { venmoLink } from '../lib/ledger.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { meFor, roundDate, roundPlayerName, shareRound } from '../lib/format.js';
import { markRoundAsked, roundAsked } from '../lib/feedback.js';
import { useNav } from '../lib/nav.js';
import { revealSteps, revealTiming } from '../lib/reveal.js';
import { IMAGE_H, IMAGE_W, renderShareImage, shareImageName } from '../lib/shareImage.js';

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 up to `target`, easing out, and holds the final value once done. `skip` jumps to the end. */
function useCountUp(target, { delay = 0, duration = 1100, skip = false } = {}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const still = skip || reducedMotion();
    let raf, t0 = null;
    const tick = t => {
      if (t0 == null) t0 = t;
      const k = still ? 1 : Math.min(1, Math.max(0, (t - t0 - delay) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3)) * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration, skip]);
  return v;
}

function CountRow({ place, name, amount, me, delay, duration, skip }) {
  const v = useCountUp(amount, { delay, duration, skip });
  const done = v === amount;
  return (
    <div className={`reveal-row ${place === 1 && amount > 0 && done ? 'top' : ''}`}>
      <div className="sr">{place}</div>
      <div className="sn">{name}{me ? ' (you)' : ''}</div>
      {/* Whole dollars while counting, then the exact amount: $2.50 used to land on "+$3" */}
      <div className={`reveal-amt ${done && amount > 0 ? 'pos' : done && amount < 0 ? 'neg' : ''}`}>{money(done ? amount : Math.round(v), { sign: true })}</div>
    </div>
  );
}

function StepAmount({ amount, skip }) {
  const v = useCountUp(amount, { duration: 380, skip });
  return money(Math.round(v));
}

/** One bet resolving: what it was, who took it, and for how much. Laid out from the start so nothing jumps. */
function RevealStep({ step, on, skip }) {
  let val = '–';
  if (step.value) val = step.value;
  else if (step.amount != null) val = on ? <StepAmount amount={step.amount} skip={skip} /> : money(0);
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
  const top = res.standings[0];
  const tied = res.standings.filter(p => p.amount === top.amount).length > 1;
  const square = res.standings.every(p => p.amount === 0);
  const count = res.standings.length;
  const { title: stepsTitle, steps } = revealSteps(round, res);
  const nSteps = steps.length;
  const t = revealTiming(nSteps, count);
  // Coming back to this beat (or reduced motion) shows the end state straight away
  const [skipped, setSkipped] = useState(() => instant || reducedMotion());
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const done = skipped || landed;
  const visible = skipped ? nSteps : shown;

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
  const winnerTitle = square ? 'All square' : side ? `${side.name} take it` : tied ? `${leaderNames} tie for top` : `${top.name.split(' ')[0]} takes it`;
  const title = done || !nSteps ? winnerTitle : 'Adding it up';
  return (
    <>
      <Header title="Final results" small />
      <div className="scroll" onClick={() => { if (!done) setSkipped(true); }}>
        <div className="reveal-head" ref={hero}>
          <div className="eyebrow">{round.course.name} · {GAMES[round.game].name}</div>
          <div className="reveal-title d" key={title}>{title}</div>
          <div className={`rv-skip ${done ? 'gone' : ''}`} aria-hidden={done}>Tap to skip</div>
        </div>
        {nSteps > 0 && (
          <div className="rv-card">
            <div className="rv-card-title">{stepsTitle}</div>
            {steps.map((s, i) => <RevealStep key={s.key} step={s} on={i < visible} skip={skipped} />)}
          </div>
        )}
        {/* Losers land first, the winner last. Equal money shares a place, so partners both land on top */}
        {res.standings.map((p, i) => (
          <CountRow key={p.id} place={res.standings.findIndex(q => q.amount === p.amount) + 1} name={p.name} amount={p.amount} me={p.id === me}
            delay={t.stepsEnd + (count - 1 - i) * t.stagger} duration={t.count} skip={skipped} />
        ))}
        {extra}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onNext}>{res.transfers.length ? <>Who pays who <Icon name="arrow-right" /></> : <>Share results <Icon name="arrow-right" /></>}</button>
        <button className="full-btn outline" onClick={onDetail}>See the full breakdown</button>
      </div>
    </>
  );
}

/** Beat 2: the fewest payments, each with a Venmo link and a way to mark it paid right here. */
export function SettleUp({ round, res, onBack, onNext }) {
  const state = useStore();
  const { showToast } = useUI();
  const me = meFor(round, state);
  const name = id => roundPlayerName(round, id).split(' ')[0];
  const paidFor = t => state.settlements.find(s => s.roundId === round.id && s.from === t.from && s.to === t.to);
  const paidCount = res.transfers.filter(paidFor).length;
  const note = `${GAMES[round.game].name} at ${round.course.name}`;

  const toggle = t => {
    const s = paidFor(t);
    if (s) {
      update(st => { st.settlements = st.settlements.filter(x => x.id !== s.id); });
      return;
    }
    update(st => { st.settlements.push({ id: uid('s_'), from: t.from, to: t.to, amount: t.amount, at: Date.now(), roundId: round.id }); });
    buzz(15);
    showToast(`${name(t.from)} is square with ${name(t.to)}`);
  };
  // You're owed: request from them. Otherwise: a link to pay whoever's owed.
  const venmoFor = t => {
    const payer = state.players[t.from], payee = state.players[t.to];
    if (t.to === me && payer?.venmo) return { href: venmoLink(payer.venmo, t.amount, note, 'charge'), label: 'Venmo request', aria: `Request ${money(t.amount)} from @${payer.venmo} on Venmo` };
    if (payee?.venmo) return { href: venmoLink(payee.venmo, t.amount, note), label: 'Pay on Venmo', aria: `Pay @${payee.venmo} ${money(t.amount)} on Venmo` };
    return null;
  };
  const missingVenmo = res.transfers.some(t => !venmoFor(t));
  const n = res.transfers.length;

  return (
    <>
      <Header title="Settle up" onBack={onBack} />
      <div className="scroll">
        <div className="settle-lede">
          <div className="d settle-count">{n} payment{n === 1 ? '' : 's'} square{n === 1 ? 's' : ''} everyone up</div>
          <p>Every bet is netted first, so nobody sends money that just comes back to them.</p>
        </div>
        {res.transfers.map(t => {
          const paid = !!paidFor(t);
          const v = venmoFor(t);
          return (
            <div key={t.from + t.to} className={`pay-card ${paid ? 'paid' : ''}`}>
              <div className="pay-who">
                <span className="pf">{name(t.from)}{t.from === me ? ' (you)' : ''}</span>
                <span className="pa"><Icon name="arrow-right" /></span>
                <span className="pt">{name(t.to)}{t.to === me ? ' (you)' : ''}</span>
                <span className="pm">{money(t.amount)}</span>
              </div>
              <div className="pay-acts">
                {v && !paid && (
                  <a className="pay-btn venmo" href={v.href} target="_blank" rel="noreferrer" aria-label={v.aria}><Icon name="paper-plane-tilt" fill /><span className="pay-lbl">{v.label}</span></a>
                )}
                <button className={`pay-btn ${paid ? 'done' : ''}`} onClick={() => toggle(t)} aria-pressed={paid}>
                  <Icon name={paid ? 'check-circle' : 'circle'} fill={paid} /> {paid ? 'Paid' : 'Mark paid'}
                </button>
              </div>
            </div>
          );
        })}
        <p className="field-help pad">
          {paidCount === n ? 'All paid. Nice and tidy.' : `${paidCount} of ${n} paid. Anything left stays on the season tab in the Ledger.`}
          {missingVenmo ? ' Add Venmo usernames in Players to get pay links.' : ''}
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
export function ShareCard({ round, res, onBack, onDone }) {
  const { showToast } = useUI();
  const [showAmounts, setShowAmounts] = useState(true);
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
  const share = async () => {
    if (ready && typeof File !== 'undefined') {
      const file = new File([img.blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Birdie Bank results' }); return; }
        catch (e) { if (e?.name === 'AbortError') return; }
      }
    }
    shareRound(round, res, showToast, { amounts: showAmounts });
  };
  const save = () => {
    if (!ready) return;
    const a = document.createElement('a');
    a.href = img.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <Header title="Share" onBack={onBack} />
      <div className="scroll">
        {img ? (
          <img className="share-img" src={img.url} width={IMAGE_W} height={IMAGE_H}
            alt={`Results card: ${round.course.name}, ${GAMES[round.game].name}. ${res.standings.map((p, i) => `${i + 1}. ${p.name}${showAmounts ? ` ${money(p.amount, { sign: true })}` : ''}`).join(', ')}`} />
        ) : (
          <div className="share-card">
            <div className="sc-brand">Birdie Bank</div>
            <div className="sc-meta">{round.course.name} · {roundDate(round)} · {GAMES[round.game].name}</div>
            <div className="sc-big d">{tops.length ? <>{tops.map(p => p.name.split(' ')[0]).join(' & ')}{showAmounts && <><br />{money(tops[0].amount, { sign: true })}</>}</> : 'All square'}</div>
            <div className="sc-list">
              {res.standings.map(p => (
                <div key={p.id} className="sc-line"><span>{p.name}</span>{showAmounts && <span>{money(p.amount, { sign: true })}</span>}</div>
              ))}
            </div>
          </div>
        )}
        <div className="toggle-row share-toggle">
          <div><div className="toggle-lbl">Show amounts</div><div className="toggle-sub">{showAmounts ? 'Dollar figures are on the image' : 'Only the order and the bets, no money'}</div></div>
          <Toggle on={showAmounts} onChange={setShowAmounts} label="Show amounts" />
        </div>
        <HowWasIt round={round} />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={share}><Icon name="share-network" /> Send to the group chat</button>
        <div className="cta-row">
          <button className="full-btn outline" onClick={save} disabled={!ready}><Icon name="download-simple" /> Save image</button>
          <button className="full-btn outline" onClick={onDone}>Done</button>
        </div>
      </div>
    </>
  );
}

// "How was it?" shows once per round: the first time it appears it's saved as asked on this phone,
// and it stays put for the rest of this visit until answered or dismissed.
const shownNow = new Set();
const answered = new Set();
const RECENT = 3 * 24 * 60 * 60 * 1000; // only ask about rounds that just finished

const REACTIONS = [
  { key: 'great', icon: 'smiley', label: 'Great', kind: 'feature', lead: 'Glad it was a good one. Anything that would make the next round even better?' },
  { key: 'ok', icon: 'smiley-meh', label: 'Just OK', kind: 'feature', lead: 'Thanks for saying so. What would have made it better?' },
  { key: 'off', icon: 'smiley-sad', label: 'Something was off', kind: 'bug', lead: 'Sorry about that. Tell us what went wrong and we’ll look into it.' },
];

/** A small, dismissible check-in after a round. A reaction opens the feature or bug form with the round attached. */
export function HowWasIt({ round }) {
  const nav = useNav();
  const [show] = useState(() => {
    if (!nav || round.status !== 'done' || answered.has(round.id)) return false;
    if (Date.now() - (round.finishedAt || round.createdAt || 0) > RECENT) return false;
    return shownNow.has(round.id) || !roundAsked(round.id);
  });
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!show) return;
    shownNow.add(round.id);
    markRoundAsked(round.id);
  }, [show, round.id]);
  if (!show || gone) return null;

  const close = () => { answered.add(round.id); setGone(true); };
  const pick = r => {
    close();
    nav.push('suggest', { kind: r.kind, lead: r.lead, roundId: round.id, extra: { reaction: r.key, roundGame: GAMES[round.game]?.name || round.game } });
  };
  return (
    <div className="checkin" role="group" aria-labelledby={`checkin-${round.id}`}>
      <div className="checkin-head">
        <span className="checkin-q" id={`checkin-${round.id}`}>How was it?</span>
        <button className="checkin-x" onClick={close} aria-label="No thanks"><Icon name="x" /></button>
      </div>
      <div className="checkin-opts">
        {REACTIONS.map(r => <button key={r.key} className="pill-btn" onClick={() => pick(r)}><Icon name={r.icon} /> {r.label}</button>)}
      </div>
    </div>
  );
}
