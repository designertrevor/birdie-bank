// The shared Tab's pieces: one person card's actions (Pay, I paid, Roll to next time, and the
// carry-over states), the "Paid $15 · just now" line with its undo, and the who-is-square strip.
// Used by the Tab and the person screen, so the card works the same in both places.
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, PickChip, Sheet, useUI } from './ui.jsx';
import { Avatar, PayButton, RequestButton } from './Pay.jsx';
import { update, useStore } from '../lib/store.js';
import { useRemind } from '../lib/useRemind.js';
import { nameOf } from '../lib/ledger.js';
import { PAY_APPS, payInfoFor } from '../lib/pay.js';
import { money } from '../lib/golf.js';
import { gameLabel, meFor, myIds } from '../lib/format.js';
import { buzz } from '../lib/delight.js';
import { ago, canonicalOf, recentPayment, roundRows, roundStatus, shortDate, stripRound } from '../lib/shared-tab.js';
import { CARRY_REASONS, cardCarry, sharedOwed } from '../lib/carry.js';
import { answerCarry, askCarry, markPaid, undoLastPayment, usePaymentsOff } from '../lib/tab-sync.js';
import { openRewards, rewardLineText } from '../lib/play-for.js';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { bettors } from '../lib/round.js';

const firstOf = name => name.split(' ')[0];

/**
 * Sheets opened from inside the scrolling list render at the screen, so they cover it like
 * every other sheet instead of opening inside the card.
 */
function AtScreen({ children }) {
  const [target, setTarget] = useState(null);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen')); }, []);
  return <><span ref={ref} hidden />{target && createPortal(children, target)}</>;
}

/** "Paid $15 on Cash App · just now", with Undo for the payer and "Didn’t get it?" for the one paid. */
export function RecentPaid({ meId, other, pay }) {
  const state = useStore();
  const { showToast } = useUI();
  const who = canonicalOf(state);
  const first = firstOf(nameOf(state, other));
  // One tap can record money both ways (the shared rounds, and the rest of the Tab), so net it
  const mineOut = pay.settlements.reduce((a, s) => a + (who(s.from) === who(meId) ? 1 : -1) * Math.round(s.amount * 100), 0);
  const iPaid = mineOut > 0 || (mineOut === 0 && who(pay.settlements[0].from) === who(meId));
  const total = Math.abs(mineOut) / 100;
  const app = payInfoFor(state, iPaid ? other : meId);
  const undo = () => {
    const redo = undoLastPayment(meId, other);
    if (redo) showToast(iPaid ? 'Payment taken back' : `Marked not paid. ${first} sees it too.`, { label: 'Undo', run: redo });
  };
  return (
    <div className="recent-paid">
      <span>{iPaid ? 'You paid' : `${first} paid`} {money(total)}{app ? ` on ${PAY_APPS[app.app].name}` : ''} · {ago(pay.at)}</span>
      <button className="link-btn" onClick={undo} aria-label={iPaid ? `Undo your ${money(total)} payment to ${first}` : `Didn’t get ${money(total)} from ${first}? Mark it not paid`}>
        {iPaid ? 'Undo' : 'Didn’t get it?'}
      </button>
    </div>
  );
}

/**
 * Everything you can do on one person's card: pay or remind, mark it paid, and roll it over.
 * `net` is what's on the Tab between you: positive when they owe you.
 */
export function PersonActions({ other, net, meId }) {
  const state = useStore();
  const { showToast } = useUI();
  const remind = useRemind();
  const off = usePaymentsOff();
  const [rolling, setRolling] = useState(false);
  const who = canonicalOf(state);
  const first = firstOf(nameOf(state, other));
  const owesMe = net > 0;
  const amount = Math.abs(net);
  const owed = net ? (owesMe ? { from: other, to: meId, amount } : { from: meId, to: other, amount }) : null;
  // Rolling it over only ever covers the rounds both phones have, so both show the same amount
  const shared = owed ? sharedOwed(state, meId, other) : null;
  const carry = cardCarry(state, meId, other, owed);
  const iAsked = carry && who(carry.by) === who(meId);
  const canRoll = !off && !carry && !!owed && !!shared && who(shared.from) === who(owed.from);
  const partOnly = !!shared && Math.round(shared.amount * 100) !== Math.round(amount * 100);
  const rest = owed && carry && shared ? Math.round((amount - carry.carried) * 100) / 100 : 0;
  const pay = recentPayment(state, meId, other);
  const myApp = payInfoFor(state, state.me);
  const theirApp = payInfoFor(state, other);

  const paid = () => {
    const { shared } = markPaid(owed);
    buzz(15);
    showToast(shared ? `Marked paid. ${first} sees it too.` : 'Marked paid', { label: 'Undo', run: () => undoLastPayment(meId, other) }, { tone: 'win' });
  };
  const answer = type => {
    answerCarry(carry, type);
    if (type === 'agree') showToast(`Carried over. ${first} sees it too.`);
    if (type === 'withdraw') showToast('Taken back');
  };

  return (
    <>
      {carry && (
        <div className={`carry-note ${carry.status}`}>
          {carry.status === 'asked' && iAsked && (
            <>
              <div className="cn-title">Asked {first} to roll it over</div>
              <div className="cn-sub">{money(carry.carried)} to next time{carry.reason ? <> · “{carry.reason}”</> : null}</div>
              <div className="cn-foot">
                <span className="cn-tag">Waiting on {first}</span>
                <button className="link-btn" onClick={() => answer('withdraw')} aria-label={`Take back asking ${first} to roll it over`}>Take it back</button>
              </div>
            </>
          )}
          {carry.status === 'asked' && !iAsked && (
            <>
              <div className="cn-title">{first} wants to roll {money(carry.carried)} to next time</div>
              {carry.reason && <div className="cn-sub">“{carry.reason}”</div>}
              <div className="pay-acts wrap">
                <button className="pay-btn ink" onClick={() => answer('agree')} aria-label={`Agree to roll ${money(carry.carried)} with ${first} to next time`}>Agree</button>
                <button className="pay-btn" onClick={() => answer('decline')}>{owesMe ? 'I’d rather get paid' : 'I’ll just pay'}</button>
              </div>
            </>
          )}
          {carry.status === 'agreed' && (
            <>
              <div className="cn-title">Carried over: {money(carry.carried)}</div>
              <div className="cn-sub">Agreed {shortDate(carry.answeredAt || carry.at)} · rolls to next time</div>
              {rest > 0 && <div className="cn-sub">From your shared rounds. The other {money(rest)} is still on the Tab.</div>}
              <div className="cn-foot"><span className="cn-tag">Carried over</span></div>
            </>
          )}
          {carry.status === 'declined' && (
            <div className="cn-sub">{iAsked ? `${first} would rather settle up.` : 'You said you’d rather settle up.'}</div>
          )}
        </div>
      )}
      {owed && (
        <div className="pay-acts wrap">
          {owesMe ? (
            <>
              {carry?.status !== 'agreed' && (
                <>
                  <button className="pay-btn" onClick={() => remind(other, amount)} aria-label={`Remind ${first} about ${money(amount)}`}><span className="pay-in"><Icon name="bell-ringing" fill /><span className="pay-lbl">Remind</span></span></button>
                  <RequestButton payer={theirApp} mine={myApp} amount={amount} note="Golf" who={other} />
                </>
              )}
              <button className="pay-btn ink" onClick={paid} aria-label={`${first} paid me ${money(amount)}`}><span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">{first} paid me</span></span></button>
            </>
          ) : (
            <>
              <PayButton info={theirApp} amount={amount} note="Golf" />
              <button className="pay-btn ink" onClick={paid} aria-label={`I paid ${first} ${money(amount)}`}><span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">I paid</span></span></button>
            </>
          )}
          {canRoll && (
            <button className={`pay-btn ${partOnly ? 'roll-part' : ''}`} onClick={() => setRolling(true)}
              aria-label={partOnly ? undefined : `Roll what’s between you and ${first} to next time`}><span className="pay-in"><Icon name="arrow-u-down-right" /><span className="pay-lbl">{partOnly ? `Roll ${money(shared.amount)} from your shared rounds to next time` : 'Roll to next time'}</span></span></button>
          )}
        </div>
      )}
      {pay && <RecentPaid meId={meId} other={other} pay={pay} />}
      <AtScreen>
        <CarrySheet open={rolling} onClose={() => setRolling(false)} owed={shared} first={first} iOwe={!owesMe}
          rest={partOnly ? Math.round((amount - shared.amount) * 100) / 100 : 0}
          onAsk={reason => {
            if (shared && askCarry({ ...shared, by: meId, reason })) showToast(`Asked ${first}`);
            setRolling(false);
          }} />
      </AtScreen>
    </>
  );
}

/** "Roll $15 to next time?": an optional one-tap reason, then ask. */
function CarrySheet({ open, onClose, owed, first, iOwe, rest, onAsk }) {
  const [reason, setReason] = useState(null);
  if (!owed) return null;
  // "Short till payday" only makes sense from the one who owes
  const reasons = iOwe ? CARRY_REASONS : CARRY_REASONS.filter(r => r !== 'Short till payday');
  return (
    <Sheet open={open} onClose={() => { setReason(null); onClose(); }} title={`Roll ${money(owed.amount)} to next time?`}>
      <p className="sheet-text">{first} gets a note to agree. Until {first} does, it’s still owed like normal.</p>
      {rest > 0 && <p className="sheet-text">This is what’s open from the rounds you shared live, which {first} sees too. The other {money(rest)} stays on the Tab as usual.</p>}
      {rest < 0 && <p className="sheet-text">This is what’s open from the rounds you shared live, which {first} sees too.</p>}
      <div className="eyebrow" style={{ padding: '0 20px 8px' }}>Add a reason (optional)</div>
      <div className="chip-row">
        {reasons.map(r => (
          <PickChip key={r} className="tap" on={reason === r} onClick={() => setReason(reason === r ? null : r)}>{r}</PickChip>
        ))}
      </div>
      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="full-btn" onClick={() => { onAsk(reason); setReason(null); }}>Ask {first}</button>
        <button className="full-btn outline" onClick={() => { setReason(null); onClose(); }}>Never mind</button>
      </div>
    </Sheet>
  );
}

const STATUS_WORD = { square: 'Square', owes: 'Owes', waiting: 'Waiting', carried: 'Carried' };

/**
 * Who's square in your latest shared round. Status only, never amounts: those stay between
 * the two people. Labelled by the round ("Last round · Sat, Sep 26"), never by the week.
 */
export function SquareStrip() {
  const state = useStore();
  const [open, setOpen] = useState(false);
  const pick = stripRound(state);
  const faces = useGroupAvatars(pick?.round.players);
  if (!pick) return null;
  const { round, latest } = pick;
  const status = roundStatus(round, roundRows(state, round));
  const me = meFor(round, state);
  // Anyone just playing had nothing to pay, so the strip leaves them off (shared-tab.js roundStatus)
  const people = bettors(round).map(p => ({ id: p.id, name: p.id === me ? 'You' : firstOf(p.name), st: status[p.id] || 'square' }));
  const square = people.filter(p => p.st === 'square').length;
  const date = new Date(round.finishedAt || round.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const label = latest ? `Last round · ${date}` : date;
  return (
    <>
      <div className="sq-strip" onClick={() => setOpen(true)}>
        <button className="sq-head" onClick={e => { e.stopPropagation(); setOpen(true); }} aria-label={`${label}: ${square} of ${people.length} square. See who`}>
          <span className="eyebrow">{label}</span>
          <span className="sq-count d">{square} of {people.length} square</span>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <ul className="sq-people">
          {people.map(p => (
            <li key={p.id} className={`sq-p ${p.st}`}>
              <Avatar model={faces.get(p.id)} />
              <span className="sq-word" aria-hidden="true">{STATUS_WORD[p.st]}</span>
              <span className="sr-only">{p.name}: {STATUS_WORD[p.st].toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </div>
      <AtScreen>
      <Sheet open={open} onClose={() => setOpen(false)} title="Who’s square">
        <p className="sheet-text">Everyone in this round sees this list. Amounts only show to the two people involved.</p>
        <ul className="sq-list">
          {people.map(p => (
            <li key={p.id} className={`sq-row ${p.st}`}>
              <Avatar model={faces.get(p.id)} />
              <span className="sq-name">{p.name}</span>
              <span className="sq-badge">{STATUS_WORD[p.st]}</span>
            </li>
          ))}
        </ul>
        <div style={{ padding: '8px 16px 0' }}>
          <button className="full-btn outline" onClick={() => setOpen(false)}>Close</button>
        </div>
      </Sheet>
      </AtScreen>
    </>
  );
}

/** Mark a reward done on this phone (or take it back): every share of it. Kept in the profile doc, never in cents. */
function setRewardDone(keys, on) {
  update(s => {
    const next = { ...(s.rewardsDone || {}) };
    for (const key of keys) { if (on) next[key] = Date.now(); else delete next[key]; }
    s.rewardsDone = next;
  });
}

/**
 * The rewards between you and one person (all of them without `other`): "You owe Sam lunch",
 * "Dave owes you a drink", each with a one-tap Done so it isn't forgotten. Not money: nothing
 * here is counted in dollars or in who's square.
 */
export function RewardLines({ other = null }) {
  const state = useStore();
  const { showToast } = useUI();
  const who = canonicalOf(state);
  const lines = openRewards(state, { ids: myIds(state), canon: who }).filter(l => other == null || l.other === who(other));
  if (!lines.length) return null;
  const done = l => {
    const keys = l.keys || [l.key];
    setRewardDone(keys, true);
    buzz(15);
    showToast(l.iOwe ? 'Done. Enjoy it together' : 'Done. Enjoy it', { label: 'Undo', run: () => setRewardDone(keys, false) });
  };
  return (
    <div className="reward-lines">
      {lines.map(l => {
        const text = rewardLineText(l, id => nameOf(state, id));
        return (
          <div key={l.key} className="reward-line">
            <Icon name="gift" fill className="rl-icon" />
            <div className="row-main">
              <div className="rl-text">{text}</div>
              <div className="rl-sub">{gameLabel(l.round)} · {l.round.course?.name || 'the course'} · {shortDate(l.at)}</div>
            </div>
            <button className="pay-btn ink rl-done" onClick={() => done(l)} aria-label={`${text}: mark it done`}>
              <span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">Done</span></span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
