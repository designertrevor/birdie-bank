// The end of a round in three beats: the money reveal, settling up, and a results card to share.
import { useEffect, useRef, useState } from 'react';
import { Header, Icon, useUI } from './ui.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { GAMES } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { venmoLink } from '../lib/ledger.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { meFor, roundDate, roundPlayerName, shareRound } from '../lib/format.js';
import { markRoundAsked, roundAsked } from '../lib/feedback.js';
import { useNav } from '../lib/nav.js';

/** Counts from 0 up to `target`, easing out, and holds the final value once done. */
function useCountUp(target, { delay = 0, duration = 1100 } = {}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf, t0 = null;
    const tick = t => {
      if (t0 == null) t0 = t;
      const k = still ? 1 : Math.min(1, Math.max(0, (t - t0 - delay) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3)) * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return v;
}

function CountRow({ place, name, amount, me, delay }) {
  const v = useCountUp(amount, { delay });
  const done = v === amount;
  return (
    <div className={`reveal-row ${place === 1 && amount > 0 ? 'top' : ''}`}>
      <div className="sr">{place}</div>
      <div className="sn">{name}{me ? ' (you)' : ''}</div>
      <div className={`reveal-amt ${done && amount > 0 ? 'pos' : done && amount < 0 ? 'neg' : ''}`}>{money(Math.round(v), { sign: true })}</div>
    </div>
  );
}

/** Beat 1: everyone's total counts up from $0, the winner last to land. */
export function Reveal({ round, res, onNext, onDetail, extra }) {
  const state = useStore();
  const hero = useRef();
  const me = meFor(round, state);
  const top = res.standings[0];
  const tied = res.standings.filter(p => p.amount === top.amount).length > 1;
  const square = res.standings.every(p => p.amount === 0);
  const count = res.standings.length;
  useEffect(() => {
    if (square) return;
    const t = setTimeout(() => { confettiFrom(hero.current, 70); buzz([20, 40, 20]); }, 1400);
    return () => clearTimeout(t);
  }, [square]);
  const title = square ? 'All square' : tied ? `${res.standings.filter(p => p.amount === top.amount).map(p => p.name.split(' ')[0]).join(' & ')} tie for top` : `${top.name.split(' ')[0]} takes it`;
  return (
    <>
      <Header title="Final results" small />
      <div className="scroll">
        <div className="reveal-head" ref={hero}>
          <div className="eyebrow">{round.course.name} · {GAMES[round.game].name}</div>
          <div className="reveal-title d">{title}</div>
        </div>
        {/* Losers land first, the winner last */}
        {res.standings.map((p, i) => (
          <CountRow key={p.id} place={i + 1} name={p.name} amount={p.amount} me={p.id === me} delay={(count - 1 - i) * 180} />
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

/** Beat 3: a results card sized for the group chat. */
export function ShareCard({ round, res, onBack, onDone }) {
  const { showToast } = useUI();
  const top = res.standings[0];
  return (
    <>
      <Header title="Share" onBack={onBack} />
      <div className="scroll">
        <div className="share-card">
          <div className="sc-brand">Birdie Bank</div>
          <div className="sc-meta">{round.course.name} · {roundDate(round)} · {GAMES[round.game].name}</div>
          <div className="sc-big d">{top.amount > 0 ? <>{top.name.split(' ')[0]}<br />{money(top.amount, { sign: true })}</> : 'All square'}</div>
          <div className="sc-list">
            {res.standings.map(p => (
              <div key={p.id} className="sc-line"><span>{p.name}</span><span>{money(p.amount, { sign: true })}</span></div>
            ))}
          </div>
        </div>
        <HowWasIt round={round} />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => shareRound(round, res, showToast)}><Icon name="share-network" /> Send to the group chat</button>
        <button className="full-btn outline" onClick={onDone}>Done</button>
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
