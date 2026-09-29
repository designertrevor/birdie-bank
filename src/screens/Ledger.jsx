// The Tab: your net with each friend across every round, squared in the fewest payments.
import { useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented, useUI } from '../components/ui.jsx';
import FreePromise from '../components/FreePromise.jsx';
import { Avatar, SettleSheet } from '../components/Pay.jsx';
import { PersonActions, RecentPaid, RewardLines, SquareStrip } from '../components/TabCard.jsx';
import { useStore } from '../lib/store.js';
import { headToHeadSummary, nameOf, outstanding } from '../lib/ledger.js';
import { canonicalOf, paymentGroups, recentPayment } from '../lib/shared-tab.js';
import { sharedDebts } from '../lib/pair-debts.js';
import { undoPayments, useTabSync } from '../lib/tab-sync.js';
import { money } from '../lib/golf.js';
import { myIds } from '../lib/format.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { isOrganizer } from '../lib/paywall.js';
import { openRewards } from '../lib/play-for.js';

const first = name => name.split(' ')[0];

export default function Ledger() {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  useTabSync({ live: true });
  const plan = outstanding(state);
  const [open, setOpen] = useState(null);
  const [free, setFree] = useState(false);
  // Before launch Season is open to everyone who has played a round. With the paywall flag on it's
  // the Pro preview again: organizers only, with the Pro tag
  const showSeason = PAYWALL_ON ? isOrganizer(state) : Object.values(state.rounds).some(r => r.status === 'done');
  const mine = myIds(state);
  const isMe = id => mine.has(id);

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
  // One row per tap: a tap that paid several rounds, or went both ways, is one payment
  const history = paymentGroups(state);
  const hasRounds = Object.values(state.rounds).some(r => r.status === 'done');
  const hasShared = sharedDebts(state).length > 0;

  // One tap, no confirm: it can be put back from the toast, and a shared payment updates both phones
  const undo = s => {
    const redo = undoPayments(s.settlements);
    showToast(`${nameOf(state, s.from).split(' ')[0]} owes ${nameOf(state, s.to).split(' ')[0]} again`, { label: 'Undo', run: redo });
  };
  // People you squared with lately keep a card for a few days, so the last payment can be taken back
  const who = canonicalOf(state);
  const meId = state.me || [...mine][0] || null;
  const recentSquare = [...new Set(state.settlements.flatMap(s => [s.from, s.to]).map(who))]
    .filter(id => meId && !isMe(id) && !people.some(p => p.id === id))
    .map(id => ({ id, pay: recentPayment(state, meId, id) }))
    .filter(x => x.pay)
    .sort((a, b) => b.pay.at - a.pay.at);
  // Rewards from reward rounds ("You owe Sam lunch"): on the person's card, or a card of their own
  // for someone square on money (a Square card of their own carries it). Never counted in dollars or in who's square.
  const rewardOnly = [...new Set(openRewards(state, { ids: mine, canon: who }).map(l => l.other))].filter(id => !people.some(p => p.id === id) && !recentSquare.some(x => x.id === id));
  const squareNames = [...h2h.keys()].filter(id => !byPerson.has(id) && !recentSquare.some(x => x.id === id)).map(id => first(nameOf(state, id)));

  // The same Settle up sheet the person screen opens for a part payment
  const partDebt = p => {
    const amount = Math.abs(p.net);
    if (p.debts.length === 1) return p.debts[0];
    return p.net > 0 ? { from: p.id, to: state.me, amount } : { from: state.me, to: p.id, amount };
  };

  const personRow = p => {
    const name = nameOf(state, p.id);
    const owesMe = p.net > 0;
    const amount = Math.abs(p.net);
    const n = h2h.get(p.id)?.rounds || 0;
    const me = owesMe ? p.debts[0].to : p.debts[0].from;
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
        <PersonActions other={p.id} net={p.net} meId={state.me || me} />
        <button className="link-btn tab-part" onClick={() => setOpen(partDebt(p))}>Paid part of it?</button>
        <RewardLines other={p.id} />
      </div>
    );
  };

  const squareCard = ({ id, pay }) => {
    const name = nameOf(state, id);
    return (
      <div key={id} className="tab-card square-card">
        <button className="tab-person" onClick={() => nav.push('person', { id })} aria-label={`Square with ${name}. See the story`}>
          <Avatar name={name} />
          <div className="row-main">
            <div className="tp-name">Square with {first(name)}</div>
            <div className="tp-sub">All paid up</div>
          </div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <RecentPaid meId={meId} other={id} pay={pay} />
        <RewardLines other={id} />
      </div>
    );
  };

  const rewardCard = id => {
    const name = nameOf(state, id);
    return (
      <div key={`reward:${id}`} className="tab-card">
        <button className="tab-person" onClick={() => nav.push('person', { id })} aria-label={`${name}. See the story`}>
          <Avatar name={name} />
          <div className="row-main">
            <div className="tp-name">{name}</div>
            <div className="tp-sub">Square on money</div>
          </div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
        <RewardLines other={id} />
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
      <Header title="Tab" right={<AvatarButton />} />
      <div className="scroll">
        {showSeason && (
          <div className="tab-view">
            <Segmented label="Tab view" className="press-mode-row" btn="pm-btn" value="person"
              onChange={v => v === 'season' && nav.push('season')}
              options={[{ value: 'person', label: 'By person' }, { value: 'season', label: PAYWALL_ON ? <>Season<span className="pro-tag"><span className="sr-only">, </span>Pro</span></> : 'Season' }]} />
          </div>
        )}
        <SquareStrip />
        {plan.length === 0 ? (
          <Empty title={hasRounds ? 'All square' : 'Nothing owed yet'}
            text={hasRounds ? 'Everyone’s settled up. Time to go win it back.' : 'Finish a round and the tab fills in. Money nets out across every round, so you pay less often.'}
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
            {recentSquare.map(squareCard)}
            {squareNames.length > 0 && people.length > 0 && <p className="field-help pad">All square with {listNames(squareNames)}.</p>}
            {others.length > 0 && (
              <>
                <div className="sec-label">{people.length ? 'Everyone else' : 'Who owes who'}</div>
                {others.map(otherRow)}
              </>
            )}
            <p className="field-help pad">Netted across every round, then squared in the fewest payments. Nobody is asked to pay someone they haven’t played with.{hasShared ? ' Money from rounds you shared live stays between the two players, so both phones agree on it.' : ''}</p>
          </>
        )}
        {rewardOnly.map(rewardCard)}
        {plan.length === 0 && recentSquare.map(squareCard)}
        {history.length > 0 && (
          <>
            <div className="sec-label">Payments</div>
            {history.slice(0, 30).map(s => (
              <div key={s.key} className="ledger-row static">
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
        {/* The free-forever list is held until Trevor says so: only with the paywall preview flag */}
        {PAYWALL_ON && (
          <div className="tab-free">
            <span className="tf-title">The Tab is free, always</span>
            <button className="link-btn" onClick={() => setFree(true)}>See what’s free forever</button>
          </div>
        )}
      </div>
      <BottomNav />
      <SettleSheet debt={open} onClose={() => setOpen(null)} />
      <FreePromise open={free} onClose={() => setFree(false)} />
    </Screen>
  );
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
