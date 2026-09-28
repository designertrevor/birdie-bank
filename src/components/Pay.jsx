// Paying, requesting and reminding, shared by the Tab, player cards and the end-of-round settle-up.
// Pay buttons only ever show to the person paying or the person owed, and use the payee's own app.
import { useState } from 'react';
import { Icon, Numpad, Sheet, useUI } from './ui.jsx';
import { useStore } from '../lib/store.js';
import { markPaid } from '../lib/tab-sync.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { nameOf } from '../lib/ledger.js';
import { PAY_APPS, copyText, handleText, payInfoFor, payLabel, payLink, requestLink } from '../lib/pay.js';
import { useRemind } from '../lib/useRemind.js';

/** A friend's initial in a circle. */
export function Avatar({ name, size = '' }) {
  return <span className={`avatar ${size}`} aria-hidden="true">{(name || '?').trim()[0]?.toUpperCase() || '?'}</span>;
}

/** Pay someone through their app. Zelle has no pay link, so it shows their handle and copies it. */
export function PayButton({ info, amount, note, className = 'pay-btn', children }) {
  const { showToast } = useUI();
  if (!info) return null;
  const app = PAY_APPS[info.app].name;
  const link = payLink(info, amount, note);
  if (link) {
    return (
      <a className={`${className} app-${info.app}`} href={link} target="_blank" rel="noreferrer" aria-label={`Pay ${handleText(info)} ${money(amount)} on ${app}`}>
        <span className="pay-in"><Icon name="paper-plane-tilt" fill /><span className="pay-lbl">{children || payLabel(info)}</span></span>
      </a>
    );
  }
  const copy = async () => showToast(await copyText(info.handle) ? `Copied ${info.handle}. Paste it in ${app}` : `${app}: ${info.handle}`);
  return (
    <button className={`${className} app-${info.app}`} onClick={copy} aria-label={`Copy ${info.handle} to pay ${money(amount)} on ${app}`}>
      <span className="pay-in"><Icon name="copy" /><span className="pay-lbl">{app}: {info.handle}</span></span>
    </button>
  );
}

/** Ask for the money in their app (only Venmo can prefill a request). */
export function RequestButton({ payer, mine, amount, note, className = 'pay-btn' }) {
  const link = requestLink(payer, mine, amount, note);
  if (!link) return null;
  return (
    <a className={`${className} app-venmo`} href={link} target="_blank" rel="noreferrer" aria-label={`Request ${money(amount)} from ${handleText(payer)} on Venmo`}>
      <span className="pay-in"><Icon name="hand-coins" fill /><span className="pay-lbl">Request</span></span>
    </a>
  );
}

/** Record a payment on the Tab: tied to the shared round transfers between the two when there are any, so both phones see it. */
function recordPayment(from, to, amount) {
  return markPaid({ from, to, amount });
}

/**
 * Settle up one payment from the Tab's plan: pay or request in the right app when it's yours,
 * then mark it paid, in full or in part. For other people's payments it only records.
 */
export function SettleSheet({ debt, onClose }) {
  const state = useStore();
  const { showToast } = useUI();
  const remind = useRemind();
  const [partial, setPartial] = useState(false);
  const mine = myIds(state);
  const you = id => (mine.has(id) ? 'you' : nameOf(state, id).split(' ')[0]);
  const record = amount => {
    recordPayment(debt.from, debt.to, amount);
    const who = mine.has(debt.from) ? 'You’re' : `${nameOf(state, debt.from).split(' ')[0]} is`;
    showToast(amount >= debt.amount ? `${who} square with ${you(debt.to)}` : `${money(amount)} recorded`);
    setPartial(false);
    onClose();
  };
  const iPay = debt && mine.has(debt.from), imOwed = debt && mine.has(debt.to);
  const payee = debt && payInfoFor(state, debt.to);
  const payer = debt && payInfoFor(state, debt.from);
  const myApp = payInfoFor(state, state.me);
  const note = 'Golf';
  const lede = debt && (iPay ? `You owe ${nameOf(state, debt.to)}` : imOwed ? `${nameOf(state, debt.from)} owes you` : `${nameOf(state, debt.from)} owes ${nameOf(state, debt.to)}`);
  return (
    <>
      <Sheet open={!!debt && !partial} onClose={onClose} title="Settle up">
        {debt && (
          <>
            <div className="block">
              <div style={{ fontSize: 15, color: 'var(--mute)', marginBottom: 4 }}>{lede}</div>
              <div className="d" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.03em' }}>{money(debt.amount)}</div>
            </div>
            {iPay && <PayButton info={payee} amount={debt.amount} note={note} className="sheet-item" />}
            {iPay && !payee && <p className="field-help" style={{ padding: '0 20px 8px' }}>Ask {nameOf(state, debt.to).split(' ')[0]} which payment app they use and add it to their player card for a pay button here.</p>}
            {imOwed && <RequestButton payer={payer} mine={myApp} amount={debt.amount} note={note} className="sheet-item" />}
            {imOwed && <button className="sheet-item" onClick={() => remind(debt.from, debt.amount)}><span><Icon name="bell-ringing" fill /> Remind {nameOf(state, debt.from).split(' ')[0]}</span></button>}
            <button className="sheet-item" onClick={() => record(debt.amount)}><span><Icon name="check-circle" fill /> Mark {money(debt.amount)} paid</span></button>
            <button className="sheet-item" onClick={() => setPartial(true)}><span><Icon name="coins" /> They paid part of it</span></button>
          </>
        )}
      </Sheet>
      <Numpad open={partial} title="Amount paid" prefix="$" initial="" min={0.01} max={debt?.amount} allowDecimal
        onClose={() => setPartial(false)} onDone={v => record(v)} />
    </>
  );
}
