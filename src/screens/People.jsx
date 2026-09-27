import { useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Pay.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { formatIndex, myIds, playerLabel, sortedPlayers } from '../lib/format.js';
import { headToHeadSummary, nameOf } from '../lib/ledger.js';
import { PAY_APPS, PAY_APP_IDS, cleanHandle, handleText, payInfo } from '../lib/pay.js';
import { money } from '../lib/golf.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';

/** Players as cards: your record and net with each person, newest friends from joined rounds too. */
export default function People() {
  const nav = useNav();
  const state = useStore();
  const mine = myIds(state);
  const h2h = headToHeadSummary(state, mine);
  const me = state.me && state.players[state.me];
  // Everyone you've added, plus people you've only met in a joined round
  const ids = new Set([...Object.keys(state.players), ...h2h.keys()]);
  for (const id of mine) ids.delete(id);
  const people = [...ids].map(id => ({ id, name: nameOf(state, id), h: h2h.get(id), p: state.players[id] }))
    .sort((a, b) => (b.h?.rounds || 0) - (a.h?.rounds || 0) || a.name.localeCompare(b.name));
  const crews = Object.values(state.crews).sort((a, b) => a.name.localeCompare(b.name));
  const myPay = me && payInfo(me);
  return (
    <Screen>
      <Header title="Players" />
      <div className="scroll">
        {me && (
          <button className="set-row" onClick={() => nav.push('playerEdit', { id: me.id })}>
            <Avatar name={me.name} />
            <div className="row-main">
              <div className="set-name">{playerLabel(me, state.me)}</div>
              <div className="set-sub">{me.index == null ? 'No handicap' : `Index ${formatIndex(me.index)}`} · {myPay ? `${PAY_APPS[myPay.app].name} ${handleText(myPay)}` : 'Add how you get paid'}</div>
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}
        <div className="sec-label">Your people</div>
        {people.map(({ id, name, h, p }) => (
          <button key={id} className="set-row person-row" onClick={() => nav.push('person', { id })}>
            <Avatar name={name} />
            <div className="row-main">
              <div className="set-name">{name}</div>
              <div className="set-sub">
                {h ? `${h.rounds} round${h.rounds === 1 ? '' : 's'} · won ${h.won}, lost ${h.lost}${h.even ? `, even ${h.even}` : ''}` : p?.index != null ? `Index ${formatIndex(p.index)}` : 'No rounds together yet'}
              </div>
            </div>
            <div className={`pr-amt d ${h?.net > 0 ? 'pos' : h?.net < 0 ? 'neg' : ''}`}>{h ? money(h.net, { sign: true }) : '\u2013'}</div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        ))}
        {people.length < 1 && <p className="hint-card"><Icon name="lightbulb" fill /> Add the people you play with so you can pick them when you start a round.</p>}
        <button className="add-row" onClick={() => nav.push('playerEdit', {})}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add player</span></button>

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
            <button className="text-link" onClick={() => nav.push('crewEdit', {})}><Icon name="plus" /> Add crew</button>
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
  const existing = id ? state.players[id] : null;
  const [name, setName] = useState(existing?.name || '');
  const [index, setIndex] = useState(existing?.index ?? null);
  const [payApp, setPayApp] = useState(payInfo(existing)?.app || null);
  const [handle, setHandle] = useState(() => { const i = payInfo(existing); return i ? handleText(i) : ''; });
  const isMe = !!id && id === state.me;
  const [pad, setPad] = useState(false);
  const trimmed = name.trim();
  const duplicate = Object.values(state.players).some(p => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase());
  const inActive = id && state.activeRoundId && state.rounds[state.activeRoundId]?.players.some(p => p.id === id);

  const save = () => {
    const pid = id || uid('p_');
    const cleaned = payApp ? cleanHandle(payApp, handle) : '';
    const pay = cleaned ? { payApp, payHandle: cleaned } : {};
    update(s => {
      const { venmo: _old, payApp: _a, payHandle: _h, ...rest } = s.players[pid] || { createdAt: Date.now() };
      s.players[pid] = { ...rest, id: pid, name: trimmed, index, ...pay };
      // Rounds still being played carry it too, so friends in a shared round get the new pay button
      const seats = pid === s.me ? new Set([pid, ...Object.values(s.rounds).map(r => r.localMe).filter(Boolean)]) : new Set([pid]);
      for (const r of Object.values(s.rounds)) {
        if (r.status !== 'active') continue;
        for (const p of r.players) {
          if (!seats.has(p.id)) continue;
          delete p.payApp; delete p.payHandle;
          Object.assign(p, pay);
        }
      }
    });
    showToast(id ? 'Player saved' : `${trimmed} added`);
    if (onSaved) onSaved(pid); else nav.pop();
  };

  const remove = async () => {
    const ok = await ask({ title: `Remove ${existing.name}?`, text: 'Past rounds keep their scores. They’ll be removed from any crews.', confirmLabel: 'Remove player', danger: true });
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
          <input id="pe-name" className="name-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus={!existing} />
          {duplicate && <p className="field-error">Someone already has that name. Add an initial so scorecards stay clear.</p>}
          <label className="field-label">Handicap index <span className="opt">optional</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="amt-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
            {index != null && <button className="header-btn" onClick={() => setIndex(null)}>Clear</button>}
          </div>
          <p className="field-help">Their usual 18-hole index. Course handicaps are worked out from this for each course and tee, and halved for 9-hole games.</p>
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
          <p className="field-help">
            {payApp === 'zelle'
              ? `Zelle has no pay link, so anyone who owes ${isMe ? 'you' : trimmed.split(' ')[0] || 'them'} sees this with a copy button.`
              : `Pay buttons open ${isMe ? 'your' : 'their'} app with the amount filled in. Birdie Bank never holds or moves money.`}
          </p>
        </div>
        {existing && id !== state.me && (
          <button className="danger-link" onClick={remove} disabled={inActive}>
            <Icon name="trash" /> {inActive ? 'In the current round, can’t remove' : 'Remove player'}
          </button>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!trimmed || duplicate} onClick={save}>{existing ? 'Save' : 'Add player'}</button>
      </div>
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
  const [name, setName] = useState(existing?.name || '');
  const [sel, setSel] = useState(existing?.playerIds || []);
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
          <input id="ce-name" className="name-input" value={name} maxLength={28} onChange={e => setName(e.target.value)} placeholder="e.g. Saturday Boys" />
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
