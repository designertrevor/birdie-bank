// One friend: what's on the Tab between you, your record, and the round-by-round story behind it.
import { useState } from 'react';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { Avatar, SettleSheet } from '../components/Pay.jsx';
import { PersonActions } from '../components/TabCard.jsx';
import { useTabSync } from '../lib/tab-sync.js';
import { useStore } from '../lib/store.js';
import { nameOf, outstanding, personStory, recordText, tabWith } from '../lib/ledger.js';
import { PAY_APPS, handleText, payInfoFor } from '../lib/pay.js';
import { money } from '../lib/golf.js';
import { formatIndex, gameLabel, keptId, myIds, roundDate } from '../lib/format.js';
import { useNav } from '../lib/nav.js';

export default function Person({ id: opened }) {
  const nav = useNav();
  const state = useStore();
  // A merged duplicate opens as the player it was merged into
  const id = keptId(state, opened);
  useTabSync();
  const [open, setOpen] = useState(null);
  const mine = myIds(state);
  const name = nameOf(state, id);
  const firstName = name.split(' ')[0];
  const player = state.players[id];
  const info = payInfoFor(state, id);
  const plan = outstanding(state);
  const tab = tabWith(plan, mine, id);
  const story = personStory(state, mine, id);
  const amount = Math.abs(tab);
  const between = plan.filter(t => (t.from === id && mine.has(t.to)) || (t.to === id && mine.has(t.from)));
  const debt = between.length === 1 ? between[0]
    : tab > 0 ? { from: id, to: state.me, amount } : { from: state.me, to: id, amount };
  // What's still open between just the two of you, before the group's fewest payments reroute it
  const direct = Math.round((story.net - story.paid) * 100) / 100;
  const rerouted = Math.abs(direct - tab) >= 0.01;
  const when = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Screen>
      <Header title={name} onBack={nav.pop}
        right={id !== state.me && <button className="header-btn" onClick={() => nav.push('playerEdit', { id })}>Edit</button>} />
      <div className="scroll">
        <div className="person-hero">
          <Avatar name={name} size="lg" />
          <div className="ph-sub">
            {info ? `${PAY_APPS[info.app].name} ${handleText(info)}` : 'No payment app yet'}
            {player?.index != null ? ` · Index ${formatIndex(player.index)}` : ''}
          </div>
          <div className="eyebrow" style={{ marginTop: 14 }}>{tab > 0 ? `${firstName} owes you` : tab < 0 ? `You owe ${firstName}` : 'On the Tab'}</div>
          <div className={`tab-big d ${tab > 0 ? 'pos' : tab < 0 ? 'neg' : ''}`}>{tab ? money(amount) : 'All square'}</div>
        </div>

        <div className="pad-x">
          <PersonActions other={id} net={tab} meId={state.me || (tab > 0 ? debt.to : debt.from)} />
        </div>
        {tab !== 0 && (
          <button className="quiet-row" onClick={() => setOpen(debt)}>
            <Icon name="coins" /> <span>Paid part of it? <u>Settle up</u></span>
          </button>
        )}

        {story.rounds > 0 && (
          <div className="stat-tiles">
            <div><div className="eyebrow">Rounds</div><div className="st-v d">{story.rounds}</div></div>
            <div><div className="eyebrow">Record</div><div className="st-v d">{recordText(story)}</div><div className="st-s">won, lost{story.even ? ', even' : ''}</div></div>
            <div><div className="eyebrow">Head to head</div><div className={`st-v d ${story.net > 0 ? 'pos' : story.net < 0 ? 'neg' : ''}`}>{money(story.net, { sign: true })}</div></div>
          </div>
        )}
        {rerouted && story.rounds > 0 && (
          <p className="field-help pad">
            Just between you two, {direct > 0 ? `${firstName} owes you ${money(direct)}` : direct < 0 ? `you owe ${firstName} ${money(-direct)}` : 'you’re square'}.
            The Tab squares the whole group in the fewest payments, so some money is passed on through people you both play with.
          </p>
        )}

        <div className="sec-label">The story</div>
        {story.items.length === 0 && <p className="hint-card"><Icon name="flag-pennant" fill /> No finished rounds with {firstName} yet. Play one and every bet between you shows up here.</p>}
        {story.items.map(it => it.kind === 'carry' ? (
          <div key={it.id} className="ledger-row static">
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>Carried over · agreed {when(it.at)}</div>
              <div className="lr-status">{it.amount > 0 ? `${firstName} owes you` : `You owe ${firstName}`}, rolls into your next round</div>
            </div>
            <div className="lr-amt d story-amt">{money(Math.abs(it.amount))}</div>
          </div>
        ) : it.kind === 'round' ? (
          <button key={it.id} className="ledger-row" onClick={() => nav.push('roundDetail', { id: it.id })}>
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{gameLabel(it.round)} · {it.round.course.name}</div>
              <div className="lr-status">{roundDate(it.round)}</div>
            </div>
            <div className={`lr-amt d story-amt ${it.amount > 0 ? 'pos' : it.amount < 0 ? 'neg' : ''}`}>{it.amount ? money(it.amount, { sign: true }) : 'Even'}</div>
          </button>
        ) : (
          <div key={it.id} className="ledger-row static">
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{it.amount > 0 ? `${firstName} paid you` : `You paid ${firstName}`}</div>
              <div className="lr-status">{when(it.at)}</div>
            </div>
            <div className="lr-amt d story-amt">{money(Math.abs(it.amount))}</div>
          </div>
        ))}
      </div>
      <SettleSheet debt={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
