import { useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, Sheet, useUI } from '../components/ui.jsx';
import { Avatar, PayButton, RequestButton } from '../components/Pay.jsx';
import { useRemind } from '../lib/useRemind.js';
import { update, uid, useStore } from '../lib/store.js';
import { firstName, formatIndex, myIds, playerLabel, sortedPlayers } from '../lib/format.js';
import { mergePlayer, mergedInto, unmergePlayer } from '../lib/merge.js';
import { headToHeadSummary, nameOf, outstanding, tabWith } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { PAY_APPS, PAY_APP_IDS, handleText, payInfo, payInfoFor, profilePayInfo } from '../lib/pay.js';
import { theirName } from '../lib/their-profile.js';
import { savePlayerCard } from '../lib/player-save.js';
import { money } from '../lib/golf.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { roundsInProgress } from '../lib/rounds.js';
import { useNav } from '../lib/nav.js';
import { useKept } from '../lib/kept.js';
import { RSVP_LABEL, dayLabel, rsvpFor } from '../lib/plans.js';
import { nemesis } from '../lib/rivalry.js';
import { NemesisCard } from '../components/Rivalry.jsx';

/** "today", "tomorrow", "Saturday" or "Sat, Oct 10" for the RSVP tag. */
const dayName = iso => { const d = dayLabel(iso); return d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : d; };

/** Players as cards: your record and net with each person, newest friends from joined rounds too. */
export default function People() {
  const nav = useNav();
  const state = useStore();
  const mine = myIds(state);
  const h2h = headToHeadSummary(state, mine);
  const plan = outstanding(state);
  const remind = useRemind();
  const me = state.me && state.players[state.me];
  const myApp = payInfoFor(state, state.me);
  // Everyone you've added, plus people you've only met in a joined round. A friend with more than
  // one id (a claimed seat, "Same person as...") is one card, under the id kept for them
  const who = canonicalOf(state);
  const ids = new Set([...Object.keys(state.players), ...h2h.keys()].map(who));
  for (const id of mine) { ids.delete(id); ids.delete(who(id)); }
  const people = [...ids].map(id => ({ id, name: nameOf(state, id), h: h2h.get(id), p: state.players[id] }))
    .sort((a, b) => (b.h?.rounds || 0) - (a.h?.rounds || 0) || a.name.localeCompare(b.name));
  const crews = Object.values(state.crews).sort((a, b) => a.name.localeCompare(b.name));
  const myPay = me && payInfo(me);
  return (
    <Screen>
      <Header title="Players" right={<AvatarButton />} />
      <div className="scroll">
        {me && (
          <button className="set-row" onClick={() => nav.push('profile')}>
            <Avatar id={me.id} name={me.name} />
            <div className="row-main">
              <div className="set-name">{playerLabel(me, state.me)}</div>
              <div className="set-sub">{me.index == null ? 'No handicap' : `Index ${formatIndex(me.index)}`} · {myPay ? `${PAY_APPS[myPay.app].name} ${handleText(myPay)}` : 'Add how you get paid'}</div>
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}
        <NemesisCard n={nemesis(state, mine)} />
        <div className="sec-label">Your people</div>
        {people.map(({ id, name, h, p }) => {
          const tab = tabWith(plan, mine, id);
          const amount = Math.abs(tab);
          const first = name.split(' ')[0];
          const rsvp = rsvpFor(state, id);
          const row = (
            <button key={id} className={tab ? 'tab-person' : 'set-row person-row'} onClick={() => nav.push('person', { id })}>
              <Avatar id={id} name={name} />
              <div className="row-main">
                <div className={tab ? 'tp-name' : 'set-name'}>{name}</div>
                {rsvp && <div className={`rsvp-tag ${rsvp.status || 'none'}`}>{rsvp.status ? `${RSVP_LABEL[rsvp.status]} for ${dayName(rsvp.plan.date)}` : `No answer for ${dayName(rsvp.plan.date)} yet`}</div>}
                <div className={tab ? 'tp-sub' : 'set-sub'}>
                  {h ? `${h.rounds} round${h.rounds === 1 ? '' : 's'} · won ${h.won}, lost ${h.lost}${h.even ? `, even ${h.even}` : ''}` : p?.index != null ? `Index ${formatIndex(p.index)}` : 'No rounds together yet'}
                  {tab > 0 ? ` · owes you ${money(amount)}` : tab < 0 ? ` · you owe ${money(amount)}` : ''}
                </div>
              </div>
              <div className={`pr-amt d ${h?.net > 0 ? 'pos' : h?.net < 0 ? 'neg' : ''}`}>{h ? money(h.net, { sign: true }) : '\u2013'}</div>
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>
          );
          if (!tab) return row;
          // Money on the Tab between you: Remind and Request right on the card, or pay them in their app
          return (
            <div key={id} className="tab-card">
              {row}
              <div className="pay-acts">
                {tab > 0 ? (
                  <>
                    <button className="pay-btn" onClick={() => remind(id, amount)} aria-label={`Remind ${first} about ${money(amount)}`}><span className="pay-in"><Icon name="bell-ringing" fill /><span className="pay-lbl">Remind</span></span></button>
                    <RequestButton payer={payInfoFor(state, id)} mine={myApp} amount={amount} note="Golf" who={id} />
                  </>
                ) : <PayButton info={payInfoFor(state, id)} amount={amount} note="Golf" />}
              </div>
            </div>
          );
        })}
        {people.length < 1 && <p className="hint-card"><Icon name="lightbulb" fill /> Add the people you play with so you can pick them when you start a round.</p>}
        <button className="add-row" onClick={() => nav.push('playerEdit', {})}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a player</span></button>

        {crews.length > 0 ? (
          <>
            <div className="sec-label">Crews</div>
            {crews.map(c => (
              <button key={c.id} className="set-row" onClick={() => nav.push('crewEdit', { id: c.id })}>
                <div className="row-main">
                  <div className="set-name">{c.name}</div>
                  <div className="set-sub">{c.playerIds.map(id => state.players[id]?.name).filter(Boolean).join(', ') || 'No players'}</div>
                </div>
                <span className="chevron"><Icon name="caret-right" /></span>
              </button>
            ))}
            <button className="text-link" onClick={() => nav.push('crewEdit', {})}><Icon name="plus" /> Make a crew</button>
          </>
        ) : Object.keys(state.players).length > 2 && (
          <button className="text-link" onClick={() => nav.push('crewEdit', {})}>
            <Icon name="users-three" fill /> Play with the same group a lot? Save them as a crew
          </button>
        )}
      </div>
      <BottomNav />
    </Screen>
  );
}

export function PlayerEdit({ id, onSaved }) {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const state = useStore();
  // Someone you only met in a joined round has no saved player yet; saving gives them one
  const existing = id ? state.players[id] || { id, name: nameOf(state, id), joined: true } : null;
  const [merging, setMerging] = useState(false);
  const [name, setName] = useKept('player:name', existing?.name || '');
  const [index, setIndex] = useKept('player:index', existing?.index ?? null);
  const [payApp, setPayApp] = useKept('player:payApp', payInfo(existing)?.app || null);
  const [handle, setHandle] = useKept('player:handle', () => { const i = payInfo(existing); return i ? handleText(i) : ''; });
  const isMe = !!id && id === state.me;
  const [pad, setPad] = useState(false);
  const trimmed = name.trim();
  const duplicate = Object.values(state.players).some(p => p.id !== id && !p.mergedInto && p.name.toLowerCase() === trimmed.toLowerCase());
  const mine = myIds(state);
  const h2h = headToHeadSummary(state, mine);
  const roundsWith = (id && h2h.get(id)?.rounds) || 0;
  const merged = id ? mergedInto(state, id) : [];
  // Everyone this player could be: saved players and people from joined rounds, same first name first
  const first = firstName(existing?.name).toLowerCase();
  const candidates = [...new Set([...Object.values(state.players).filter(p => !p.mergedInto).map(p => p.id), ...h2h.keys()])]
    .filter(x => x !== id && !mine.has(x))
    .map(x => ({ id: x, name: nameOf(state, x), rounds: h2h.get(x)?.rounds || 0, saved: !!state.players[x], pay: payInfoFor(state, x) }))
    .sort((a, b) => (firstName(b.name).toLowerCase() === first) - (firstName(a.name).toLowerCase() === first) || a.name.localeCompare(b.name));
  const inActive = id && roundsInProgress(state).some(r => r.players.some(p => p.id === id));
  // Their own profile's name and app win over what you save here; yours is used when theirs has none
  const profName = id && !isMe ? theirName(state, id) : null;
  const profPay = id && !isMe ? profilePayInfo(state, id) : null;
  const who = firstName(profName || existing?.name) || 'They';

  const save = () => {
    const pid = id || uid('p_');
    update(s => savePlayerCard(s, pid, { name: trimmed, index, payApp, handle }));
    showToast(id ? 'Player saved' : `${trimmed} added`);
    if (onSaved) onSaved(pid); else nav.pop();
  };

  const merge = async target => {
    setMerging(false);
    const same = target.name.toLowerCase() === existing.name.toLowerCase();
    const ok = await ask({
      title: same ? `Merge the two ${target.name}s?` : `Merge into ${target.name}?`,
      text: `${same ? 'Their' : `${existing.name}’s`} rounds, record and anything on the Tab add up under ${same ? `one ${target.name}` : target.name}. No rounds change, and you can undo it from ${target.name}’s card.`,
      confirmLabel: 'Merge',
    });
    if (!ok) return;
    update(s => {
      if (!s.players[target.id]) s.players[target.id] = { id: target.id, name: target.name, createdAt: Date.now() };
      mergePlayer(s, id, target.id, { name: existing.name });
    });
    showToast(`Merged into ${target.name}`);
    nav.pop();
  };

  const unmerge = p => {
    update(s => unmergePlayer(s, p.id));
    showToast(`${p.name} is separate again`);
  };

  const remove = async () => {
    const text = roundsWith
      ? `They played ${roundsWith} round${roundsWith === 1 ? '' : 's'} with you, so they’ll still show in Players while ${roundsWith === 1 ? 'that round is' : 'those rounds are'} in History. To clear out test rounds, delete them from History. If this is a second copy of someone, merge them instead.`
      : 'Past rounds keep their scores, and anything they owe stays on the Tab. They’ll be taken out of any crews.';
    const ok = await ask({ title: `Remove ${existing.name}?`, text, confirmLabel: 'Remove player', danger: true });
    if (!ok) return;
    update(s => {
      delete s.players[id];
      for (const c of Object.values(s.crews)) c.playerIds = c.playerIds.filter(x => x !== id);
    });
    nav.pop();
  };

  return (
    <Screen>
      <Header title={existing ? 'Edit player' : 'New player'} onBack={nav.pop} />
      <div className="scroll">
        <div className="block">
          <label className="field-label" htmlFor="pe-name">Name</label>
          <input id="pe-name" className="name-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus={!existing}
            aria-invalid={duplicate || undefined} aria-describedby={duplicate ? 'pe-name-err' : undefined} />
          {profName && profName !== trimmed && <p className="field-help">{who}’s own profile says “{profName}”, so that’s the name you see everywhere. The name here is used if they ever take theirs off.</p>}
          {duplicate && <p className="field-error" id="pe-name-err" role="status">Someone already has that name. Add an initial so scorecards stay clear, or merge them below if it’s the same person.</p>}
          <div className="field-label">Handicap index <span className="opt">optional</span></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="amt-btn" onClick={() => setPad(true)} aria-label={index == null ? 'Handicap index: add one' : `Handicap index ${formatIndex(index)}. Change it`}>{index == null ? 'Add' : formatIndex(index)}</button>
            {index != null && <button className="header-btn" onClick={() => setIndex(null)} aria-label="Clear the handicap index">Clear</button>}
          </div>
          <p className="field-help">Their usual 18-hole index. Strokes are worked out from it for each course and tee.</p>
          <div className="field-label" id="pe-pay">{isMe ? 'How you get paid' : `How ${trimmed.split(' ')[0] || 'they'} ${trimmed ? 'gets' : 'get'} paid`} <span className="opt">optional</span></div>
          <div className="chip-row flush" role="group" aria-labelledby="pe-pay">
            {PAY_APP_IDS.map(app => (
              <button key={app} type="button" className={`pill-btn ${payApp === app ? 'on' : ''}`} aria-pressed={payApp === app}
                onClick={() => setPayApp(payApp === app ? null : app)}>{PAY_APPS[app].name}</button>
            ))}
          </div>
          {payApp && (
            <>
              <label className="sr-only" htmlFor="pe-handle">{PAY_APPS[payApp].label}</label>
              <input id="pe-handle" className="text-input" value={handle} onChange={e => setHandle(e.target.value)} placeholder={PAY_APPS[payApp].placeholder}
                autoCapitalize="none" autoCorrect="off" inputMode={payApp === 'zelle' ? 'email' : 'text'} />
            </>
          )}
          {profPay && <p className="field-help">{who}’s own profile says {PAY_APPS[profPay.app].name} {handleText(profPay)}, so Pay buttons use that. What you pick here is used only if their profile has none.</p>}
          <p className="field-help">
            {payApp === 'zelle'
              ? `Zelle has no pay link, so anyone who owes ${isMe ? 'you' : trimmed.split(' ')[0] || 'them'} sees this with a copy button.`
              : `So ${isMe ? 'people can pay you' : 'you can pay them'} in one tap. Birdie Bank never holds or moves money.`}
          </p>
        </div>
        {merged.length > 0 && (
          <>
            <div className="sec-label">Merged in</div>
            {merged.map(p => (
              <div key={p.id} className="set-row static">
                <div className="row-main">
                  <div className="set-name">{p.name}</div>
                  <div className="set-sub">{p.stub ? 'From a round you joined' : 'A saved player'}</div>
                </div>
                <button className="header-btn" onClick={() => unmerge(p)}>Undo</button>
              </div>
            ))}
          </>
        )}
        {existing && id !== state.me && candidates.length > 0 && (
          <button className="quiet-row" onClick={() => setMerging(true)}>
            <Icon name="git-merge" /> <span>Same person as someone else? <u>Merge</u></span>
          </button>
        )}
        {existing && !existing.joined && id !== state.me && (
          <button className="danger-link" onClick={remove} disabled={inActive}>
            <Icon name="trash" /> {inActive ? 'Can’t remove during a round they’re in' : 'Remove player'}
          </button>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!trimmed || duplicate} onClick={save}>{existing ? 'Save' : 'Add player'}</button>
      </div>
      <Sheet open={merging} onClose={() => setMerging(false)} title={`Who is ${existing?.name || 'this'}?`}>
        <p className="field-help" style={{ margin: '0 20px 8px' }}>Pick the player to keep. Everything with {existing?.name} adds up under them.</p>
        {candidates.map(c => (
          <button key={c.id} className="list-item" onClick={() => merge(c)}>
            <Avatar id={c.id} name={c.name} />
            <div className="row-main">
              <div className="li-name">{c.name}</div>
              <div className="li-sub">{c.rounds ? `${c.rounds} round${c.rounds === 1 ? '' : 's'} together` : 'No rounds together yet'}{c.pay ? ` · ${PAY_APPS[c.pay.app].name} ${handleText(c.pay)}` : ''}{c.saved ? '' : ' · from a round you joined'}</div>
            </div>
          </button>
        ))}
      </Sheet>
      <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </Screen>
  );
}

export function CrewEdit({ id }) {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  const existing = id ? state.crews[id] : null;
  const [name, setName] = useKept('crew:name', existing?.name || '');
  const [sel, setSel] = useKept('crew:sel', existing?.playerIds || []);
  const players = sortedPlayers(state);
  const toggle = pid => setSel(s => (s.includes(pid) ? s.filter(x => x !== pid) : [...s, pid]));

  const save = () => {
    const cid = id || uid('c_');
    update(s => { s.crews[cid] = { id: cid, name: name.trim(), playerIds: sel }; });
    nav.pop();
  };
  const remove = async () => {
    if (!(await ask({ title: `Delete ${existing.name}?`, text: 'Players stay. Only the group is removed.', confirmLabel: 'Delete crew', danger: true }))) return;
    update(s => { delete s.crews[id]; });
    nav.pop();
  };

  return (
    <Screen>
      <Header title={existing ? 'Edit crew' : 'New crew'} onBack={nav.pop} />
      <div className="scroll">
        <div className="block">
          <label className="field-label" htmlFor="ce-name">Crew name</label>
          <input id="ce-name" className="name-input" value={name} maxLength={28} onChange={e => setName(e.target.value)} placeholder="e.g. Saturday group" />
        </div>
        <div className="sec-label">Who’s in it · {sel.length} selected</div>
        <div style={{ padding: '0 16px' }}>
          {players.length === 0 && <Empty illo={false} title="No players yet" text="Add players first, then group them into a crew." />}
          {players.map(p => (
            <button key={p.id} className="list-item" onClick={() => toggle(p.id)} aria-pressed={sel.includes(p.id)}>
              <div className="row-main"><div className="li-name">{playerLabel(p, state.me)}</div><div className="li-sub">{p.index == null ? 'No handicap' : `Index ${formatIndex(p.index)}`}</div></div>
              <span className={`li-check ${sel.includes(p.id) ? 'on' : 'add'}`}><Icon name={sel.includes(p.id) ? 'check' : 'plus'} /></span>
            </button>
          ))}
        </div>
        {existing && <button className="danger-link" onClick={remove}><Icon name="trash" /> Delete crew</button>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!name.trim() || sel.length < 2} onClick={save}>
          {sel.length < 2 ? 'Pick at least 2 players' : existing ? 'Save crew' : 'Create crew'}
        </button>
      </div>
    </Screen>
  );
}
