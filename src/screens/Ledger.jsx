// The Tab: your net with each friend across every round, squared in the fewest payments.
import { useState } from 'react';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton, SettleSheet } from '../components/Pay.jsx';
import { useRemind } from '../lib/useRemind.js';
import { update, useStore } from '../lib/store.js';
import { headToHeadSummary, nameOf, outstanding } from '../lib/ledger.js';
import { payInfoFor } from '../lib/pay.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';

const first = name => name.split(' ')[0];

export default function Ledger() {
  const nav = useNav();
  const state = useStore();
  const { ask } = useUI();
  const remind = useRemind();
  const plan = outstanding(state);
  const [open, setOpen] = useState(null);
  const mine = myIds(state);
  const isMe = id => mine.has(id);
  const myApp = payInfoFor(state, state.me);

  // One row per friend: what the plan has between you (a friend you pass money on for can be both ways, so it's netted)
  const byPerson = new Map();
  for (const t of plan) {
    if (isMe(t.from) === isMe(t.to)) continue;
    const other = isMe(t.from) ? t.to : t.from;
    const cur = byPerson.get(other) || { id: other, net: 0, debts: [] };
    cur.net = Math.round((cur.net + (isMe(t.to) ? t.amount : -t.amount)) * 100) / 100;
    cur.debts.push(t);
    byPerson.set(other, cur);
  }
  const people = [...byPerson.values()].filter(p => p.net).sort((a, b) => b.net - a.net);
  const others = plan.filter(t => !isMe(t.from) && !isMe(t.to));
  const overall = Math.round(people.reduce((a, p) => a + p.net, 0) * 100) / 100;
  const h2h = headToHeadSummary(state, mine);
  const square = [...h2h.keys()].filter(id => !byPerson.has(id)).map(id => first(nameOf(state, id)));
  const history = [...state.settlements].sort((a, b) => b.at - a.at);
  const hasRounds = Object.values(state.rounds).some(r => r.status === 'done');

  const undo = async s => {
    if (!(await ask({ title: 'Undo this payment?', text: `${nameOf(state, s.from)} → ${nameOf(state, s.to)} ${money(s.amount)} will be owed again.`, confirmLabel: 'Undo payment' }))) return;
    update(st => { st.settlements = st.settlements.filter(x => x.id !== s.id); });
  };

  const personRow = p => {
    const name = nameOf(state, p.id);
    const owesMe = p.net > 0;
    const amount = Math.abs(p.net);
    const n = h2h.get(p.id)?.rounds || 0;
    const debt = p.debts.length === 1 ? p.debts[0] : owesMe
      ? { from: p.id, to: state.me || p.debts[0].to, amount }
      : { from: state.me || p.debts[0].from, to: p.id, amount };
    return (
      <div key={p.id} className="tab-card">
        <button className="tab-person" onClick={() => nav.push('person', { id: p.id })} aria-label={`${name}: ${owesMe ? 'owes you' : 'you owe'} ${money(amount)}. See the story`}>
          <Avatar name={name} />
          <div className="row-main">
            <div className="tp-name">{name}</div>
            <div className="tp-sub">{owesMe ? 'Owes you' : 'You owe'}{n ? ` · ${n} round${n === 1 ? '' : 's'} together` : ''}</div>
          </div>
          <div className={`tp-amt ${owesMe ? 'pos' : 'neg'}`}>{money(amount)}</div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <div className="pay-acts">
          {owesMe ? (
            <>
              <button className="pay-btn" onClick={() => remind(p.id, amount)} aria-label={`Remind ${first(name)} about ${money(amount)}`}><span className="pay-in"><Icon name="bell-ringing" fill /><span className="pay-lbl">Remind</span></span></button>
              <RequestButton payer={payInfoFor(state, p.id)} mine={myApp} amount={amount} note="Golf" />
            </>
          ) : <PayButton info={payInfoFor(state, p.id)} amount={amount} note="Golf" />}
          <button className="pay-btn ink" onClick={() => setOpen(debt)} aria-label={`Settle up with ${first(name)}`}><span className="pay-in"><Icon name="handshake" fill /><span className="pay-lbl">Settle up</span></span></button>
        </div>
      </div>
    );
  };

  const otherRow = d => (
    <button key={d.from + d.to} className="ledger-row" onClick={() => setOpen(d)}>
      <div className="lr-info">
        <div className="lr-name" style={{ fontSize: 16 }}>{nameOf(state, d.from)} owes {nameOf(state, d.to)}</div>
      </div>
      <div className="lr-amt">{money(d.amount)}</div>
    </button>
  );

  return (
    <Screen>
      <Header title="Tab" />
      <div className="scroll">
        {plan.length === 0 ? (
          <Empty title={hasRounds ? 'All square' : 'Nothing owed yet'}
            text={hasRounds ? 'Everyone’s settled up. Time to go win it back.' : 'Finish a round and who owes who shows up here, netted across every round.'}
            action={!hasRounds && <button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            {people.length > 0 && (
              <div className="tab-overall">
                <div className="eyebrow">Overall</div>
                <div className={`tab-big d ${overall > 0 ? 'pos' : overall < 0 ? 'neg' : ''}`}>
                  {overall > 0 ? `You’re up ${money(overall)}` : overall < 0 ? `You’re down ${money(-overall)}` : 'You’re even'}
                </div>
              </div>
            )}
            {people.map(personRow)}
            {square.length > 0 && people.length > 0 && <p className="field-help pad">All square with {listNames(square)}.</p>}
            {others.length > 0 && (
              <>
                <div className="sec-label">{people.length ? 'Everyone else' : 'Outstanding'}</div>
                {others.map(otherRow)}
              </>
            )}
            <p className="field-help pad">Netted across every round, then squared in the fewest payments. Nobody is asked to pay someone they haven’t played with.</p>
          </>
        )}
        {history.length > 0 && (
          <>
            <div className="sec-label">Payments</div>
            {history.slice(0, 30).map(s => (
              <div key={s.id} className="ledger-row static">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{isMe(s.from) ? 'You' : nameOf(state, s.from)} paid {isMe(s.to) ? 'you' : nameOf(state, s.to)}</div>
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
      <SettleSheet debt={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
