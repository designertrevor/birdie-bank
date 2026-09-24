import { useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, Sheet, useUI } from '../components/ui.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { nameOf, outstanding, venmoLink } from '../lib/ledger.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';

export default function Ledger() {
  const nav = useNav();
  const state = useStore();
  const { showToast, ask } = useUI();
  const debts = outstanding(state);
  const [open, setOpen] = useState(null);
  const [partial, setPartial] = useState(false);
  const mineIds = myIds(state);
  const isMe = id => mineIds.has(id);
  const me = state.me;
  const mine = debts.filter(d => isMe(d.from) || isMe(d.to));
  const others = debts.filter(d => !isMe(d.from) && !isMe(d.to));
  const owedToMe = mine.filter(d => isMe(d.to)).reduce((a, d) => a + d.amount, 0);
  const iOwe = mine.filter(d => isMe(d.from)).reduce((a, d) => a + d.amount, 0);
  const history = [...state.settlements].sort((a, b) => b.at - a.at);
  const hasRounds = Object.values(state.rounds).some(r => r.status === 'done');

  const record = (d, amount) => {
    update(s => { s.settlements.push({ id: uid('s_'), from: d.from, to: d.to, amount, at: Date.now() }); });
    showToast(amount >= d.amount ? `${nameOf(state, d.from)} is square with ${nameOf(state, d.to)}` : `${money(amount)} recorded`);
    setOpen(null); setPartial(false);
  };
  const undo = async s => {
    if (!(await ask({ title: 'Undo this payment?', text: `${nameOf(state, s.from)} → ${nameOf(state, s.to)} ${money(s.amount)} will be owed again.`, confirmLabel: 'Undo payment' }))) return;
    update(st => { st.settlements = st.settlements.filter(x => x.id !== s.id); });
  };

  const row = d => {
    const youOwe = isMe(d.from), owedYou = isMe(d.to);
    const label = youOwe ? `You owe ${nameOf(state, d.to)}` : owedYou ? `${nameOf(state, d.from)} owes you` : `${nameOf(state, d.from)} owes ${nameOf(state, d.to)}`;
    return (
      <button key={d.from + d.to} className="ledger-row" onClick={() => setOpen(d)}>
        <div className="lr-info">
          <div className="lr-name">{label}</div>
          <div className="lr-status">From {d.rounds.length} round{d.rounds.length === 1 ? '' : 's'}</div>
        </div>
        <div className={`lr-big ${owedYou ? 'pos' : youOwe ? 'neg' : ''}`}>{money(d.amount)}</div>
      </button>
    );
  };

  const payee = open && state.players[open.to];
  const vlink = open && payee?.venmo ? venmoLink(payee.venmo, open.amount) : null;

  return (
    <Screen>
      <Header title="Ledger" />
      <div className="scroll">
        {debts.length === 0 ? (
          <Empty title={hasRounds ? 'All square' : 'Nothing owed yet'}
            text={hasRounds ? 'Everyone’s settled up. Time to go win it back.' : 'Finish a round and who-owes-who shows up here, netted across every round.'}
            action={!hasRounds && <button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            {me && (mine.length > 0) && (
              <div className="ledger-summary">
                <div><div className="bl">Owed to you</div><div className="lr-big pos">{money(owedToMe)}</div></div>
                <div><div className="bl">You owe</div><div className="lr-big neg">{money(iOwe)}</div></div>
              </div>
            )}
            {mine.length > 0 && <><div className="sec-label">You</div>{mine.map(row)}</>}
            {others.length > 0 && <><div className="sec-label">{mine.length ? 'Everyone else' : 'Outstanding'}</div>{others.map(row)}</>}
          </>
        )}
        {history.length > 0 && (
          <>
            <div className="sec-label">Payments</div>
            {history.slice(0, 30).map(s => (
              <div key={s.id} className="ledger-row static">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{nameOf(state, s.from)} paid {nameOf(state, s.to)}</div>
                  <div className="lr-status">{new Date(s.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <div className="lr-amt" style={{ marginRight: 8 }}>{money(s.amount)}</div>
                <button className="icon-btn sm" onClick={() => undo(s)} aria-label="Undo payment"><Icon name="arrow-counter-clockwise" /></button>
              </div>
            ))}
          </>
        )}
      </div>
      <BottomNav />

      <Sheet open={!!open && !partial} onClose={() => setOpen(null)} title="Settle up">
        {open && (
          <>
            <div className="block">
              <div style={{ fontSize: 15, color: 'var(--mute)', marginBottom: 4 }}>{nameOf(state, open.from)} owes {nameOf(state, open.to)}</div>
              <div className="d" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-.03em' }}>{money(open.amount)}</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>Netted across {open.rounds.length} round{open.rounds.length === 1 ? '' : 's'}</div>
            </div>
            {vlink && (
              <a className="sheet-item venmo" href={vlink} target="_blank" rel="noreferrer">
                <span><Icon name="paper-plane-tilt" fill /> Pay @{payee.venmo} on Venmo</span><Icon name="arrow-square-out" />
              </a>
            )}
            {!vlink && payee && <p className="field-help" style={{ padding: '0 20px 8px' }}>Add {payee.name}’s Venmo username in Players to get a pay link here.</p>}
            <button className="sheet-item" onClick={() => record(open, open.amount)}><span><Icon name="check-circle" fill /> Mark {money(open.amount)} as paid</span></button>
            <button className="sheet-item" onClick={() => setPartial(true)}><span><Icon name="coins" /> Record a partial payment</span></button>
          </>
        )}
      </Sheet>
      <Numpad open={partial} title="Amount paid" prefix="$" initial="" min={0.01} max={open?.amount} allowDecimal
        onClose={() => setPartial(false)} onDone={v => record(open, v)} />
    </Screen>
  );
}
