// One friend: what's on the Tab between you, your record, and the round-by-round story behind it.
import { useState } from 'react';
import { Header, Icon, Screen, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, SettleSheet } from '../components/Pay.jsx';
import { PersonActions, RewardLines } from '../components/TabCard.jsx';
import { useTabSync } from '../lib/tab-sync.js';
import { uid, update, useStore } from '../lib/store.js';
import { nameOf, outstanding, personStory, tabWith } from '../lib/ledger.js';
import { PAY_APPS, handleText, payInfoFor } from '../lib/pay.js';
import { money } from '../lib/golf.js';
import { formatIndex, gameLabel, myIds, roundDate } from '../lib/format.js';
import { useNav } from '../lib/nav.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { aliasesOf, linksOf, mergeCandidates, mergePeople, unmergePerson } from '../lib/people-links.js';
import { paymentsAfterSplit } from '../lib/unmerge-payments.js';
import { playForLine, unitFmt } from '../lib/play-for.js';
import { nemesis, rivalry } from '../lib/rivalry.js';
import { RivalryCard } from '../components/Rivalry.jsx';
import { usePersonProfile } from '../lib/profiles.js';
import { friendView, sinceText } from '../lib/profile-view.js';

export default function Person({ id: opened }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  useTabSync();
  const [open, setOpen] = useState(null);
  const [merging, setMerging] = useState(false);
  const mine = myIds(state);
  // Any of a friend's ids opens the one card kept for them (see people-links.js)
  const kept = canonicalOf(state)(opened);
  const id = kept === state.me ? opened : kept;
  const name = nameOf(state, id);
  const firstName = name.split(' ')[0];
  const player = state.players[id];
  const info = payInfoFor(state, id);
  // Their own profile, once a seat of theirs is linked to their account: only what they let people
  // they've played with see (profile-view.js)
  const fv = friendView(usePersonProfile(id), player);
  const plan = outstanding(state);
  const tab = tabWith(plan, mine, id);
  const story = personStory(state, mine, id);
  // You against them, all time, from the same story (the Record Book)
  const rv = rivalry(state, mine, id);
  const nem = nemesis(state, mine);
  const amount = Math.abs(tab);
  const between = plan.filter(t => (t.from === id && mine.has(t.to)) || (t.to === id && mine.has(t.from)));
  const debt = between.length === 1 ? between[0]
    : tab > 0 ? { from: id, to: state.me, amount } : { from: state.me, to: id, amount };
  // What's still open between just the two of you, before the group's fewest payments reroute it
  const direct = Math.round((story.net - story.paid) * 100) / 100;
  const rerouted = Math.abs(direct - tab) >= 0.01;
  const when = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Same person: the other ids this card also covers, and merging another player into it
  // A seat you claimed from your other phone is you too, so no "Same person as..." on it
  const isMine = mine.has(id) || kept === state.me;
  const aliases = isMine ? [] : aliasesOf(state, id, x => nameOf(state, x));
  const candidates = merging ? mergeCandidates(state, id, mine).map(x => ({ id: x, name: nameOf(state, x) })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const before = () => ({ links: state.links || {}, unlinks: state.unlinks || [] });
  // Two cards apart again: a payment recorded while they were one follows the card it belongs to
  const apart = (s, next, keep, alias) => {
    const moved = paymentsAfterSplit(s, next, keep, alias, { makeId: () => uid() });
    s.links = next.links; s.unlinks = next.unlinks;
    if (moved) s.settlements = moved;
  };
  const restore = was => update(s => { s.links = was.links; s.unlinks = was.unlinks; });
  const merge = other => {
    const next = mergePeople(state, id, other.id);
    setMerging(false);
    if (!next) { showToast(`Couldn’t merge ${other.name}`); return; }
    const was = before();
    update(s => { s.links = next.links; s.unlinks = next.unlinks; });
    showToast(`${other.name} and ${name} are one person now`, { label: 'Undo', run: () => update(s => apart(s, was, id, other.id)) });
  };
  const separate = a => {
    const next = unmergePerson(state, id, a.id);
    if (!next) return;
    const was = before();
    update(s => apart(s, next, id, a.id));
    showToast(`${a.name} is a separate person again`, { label: 'Undo', run: () => restore(was) });
  };
  const sameSub = (x, whole = false) => {
    const ids = new Set(whole ? linksOf(state).groupOf(x) : [x]);
    const played = Object.values(state.rounds).filter(r => r.players.some(p => ids.has(p.id)));
    const rounds = played.length;
    const saved = state.players[x] ? 'Saved player' : null;
    // In the picker, the last round they played, so two cards with the same name can be told apart
    const last = whole && played.sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0))[0];
    const lastText = last ? `${rounds === 1 ? '' : 'last '}${roundDate(last)}${last.course?.name ? ` at ${last.course.name}` : ''}` : null;
    return [saved, rounds ? `${rounds} round${rounds === 1 ? '' : 's'}` : null, lastText].filter(Boolean).join(' · ') || 'No rounds yet';
  };

  return (
    <Screen>
      <Header title={name} onBack={nav.pop}
        right={id !== state.me && <button className="header-btn" onClick={() => nav.push('playerEdit', { id })}>Edit</button>} />
      <div className="scroll">
        <div className="person-hero">
          <Avatar id={id} name={name} size="lg" />
          <div className="ph-sub">
            {info ? `${PAY_APPS[info.app].name} ${handleText(info)}` : 'No payment app yet'}
            {player?.index != null ? ` · Index ${formatIndex(player.index)}` : fv?.index != null ? ` · Index ${formatIndex(fv.index)}` : ''}
          </div>
          {fv?.homeCourse && <div className="ph-sub pf-home-line"><Icon name="flag-pennant" fill /> Home course: {fv.homeCourse.name}</div>}
          <div className="eyebrow" style={{ marginTop: 14 }}>{tab > 0 ? `${firstName} owes you` : tab < 0 ? `You owe ${firstName}` : 'On the Tab'}</div>
          <div className={`tab-big d ${tab > 0 ? 'pos' : tab < 0 ? 'neg' : ''}`}>{tab ? money(amount) : 'All square'}</div>
        </div>

        <div className="pad-x">
          <PersonActions other={id} net={tab} meId={state.me || (tab > 0 ? debt.to : debt.from)} />
          <RewardLines other={id} />
        </div>
        {tab !== 0 && (
          <button className="quiet-row" onClick={() => setOpen(debt)}>
            <Icon name="coins" /> <span>Paid part of it? <u>Settle up</u></span>
          </button>
        )}

        <RivalryCard rv={rv} name={name} isNemesis={!isMine && nem?.id === id} />
        {rerouted && story.rounds > 0 && (
          <p className="field-help pad">
            Just between you two, {direct > 0 ? `${firstName} owes you ${money(direct)}` : direct < 0 ? `you owe ${firstName} ${money(-direct)}` : 'you’re square'}.
            The Tab squares the whole group in the fewest payments, so some money is passed on through people you both play with.
          </p>
        )}

        {fv?.tiles.length > 0 && (
          <>
            <div className="sec-label">{firstName}’s profile</div>
            <div className="pf-tiles">
              {fv.tiles.map(t => (
                <div key={t.key} className={`pf-tile ${t.key === 'net' || t.key === 'best' ? 'money' : ''}`}>
                  <div className="eyebrow">{t.label}</div>
                  <div className={`pf-v d ${t.tone || ''}`}>{t.value}</div>
                  {t.sub && <div className="st-s">{t.sub}</div>}
                </div>
              ))}
            </div>
            <p className="field-help pad">{[sinceText(fv.since), `All of ${firstName}’s rounds, not just yours together.`].filter(Boolean).join(' · ')}</p>
          </>
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
              <div className="lr-status">{roundDate(it.round)}{it.money === false ? ` · ${playForLine(it.round)}` : ''}</div>
            </div>
            <div className={`lr-amt d story-amt ${it.amount > 0 ? 'pos' : it.amount < 0 ? 'neg' : ''}`}>{it.amount ? unitFmt(it.round)(it.amount, { sign: true }) : 'Even'}</div>
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

        {!isMine && (
          <>
            {aliases.length > 0 && <div className="sec-label">Also shows up as</div>}
            {aliases.map(a => (
              <div key={a.id} className="ledger-row static same-row">
                <div className="lr-info">
                  <div className="lr-name" style={{ fontSize: 16 }}>{a.name}</div>
                  <div className="lr-status">{a.manual ? 'You said it’s the same person' : 'Took their seat from a round link'} · {sameSub(a.id)}</div>
                </div>
                <button className="link-btn" onClick={() => separate(a)}
                  aria-label={a.manual ? `Undo: ${a.name} is not ${name}` : `${a.name} is not the same person as ${name}`}>{a.manual ? 'Undo' : 'Not the same person'}</button>
              </div>
            ))}
            <button className="quiet-row" onClick={() => setMerging(true)}>
              <Icon name="users-three" /> <span>Two cards for {firstName}? <u>Same person as…</u></span>
            </button>
          </>
        )}
      </div>
      <SettleSheet debt={open} onClose={() => setOpen(null)} />
      <Sheet open={merging} onClose={() => setMerging(false)} title={`Same person as ${firstName}`}>
        <p className="sheet-text">Pick the other card for {firstName}. Their rounds, payments and head to head join this card. No money changes, and you can undo it here any time.</p>
        <div style={{ padding: '0 16px 16px' }}>
          {candidates.length === 0 && <p className="field-help">Nobody else to merge. People who played a round with {firstName} can’t be the same person, so they aren’t listed.</p>}
          {candidates.map(c => (
            <button key={c.id} className="list-item" onClick={() => merge(c)}>
              <Avatar id={c.id} name={c.name} />
              <div className="row-main"><div className="li-name">{c.name}</div><div className="li-sub">{sameSub(c.id, true)}</div></div>
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>
          ))}
          {candidates.length > 0 && <p className="field-help">People who played a round with {firstName} aren’t listed.</p>}
        </div>
      </Sheet>
    </Screen>
  );
}
