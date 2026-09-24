import { useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, useUI } from '../components/ui.jsx';
import { update, uid, useStore } from '../lib/store.js';
import { formatIndex, playerLabel, sortedPlayers } from '../lib/format.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';

export default function People() {
  const nav = useNav();
  const state = useStore();
  const players = sortedPlayers(state);
  const crews = Object.values(state.crews).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Screen>
      <Header title="Players" />
      <div className="scroll">
        <div className="sec-label">Players</div>
        {players.map(p => (
          <button key={p.id} className="set-row" onClick={() => nav.push('playerEdit', { id: p.id })}>
            <div className="row-main">
              <div className="set-name">{playerLabel(p, state.me)}</div>
              <div className="set-sub">{p.index == null ? 'No handicap' : `Index ${formatIndex(p.index)}`}{p.venmo ? ` · @${p.venmo}` : ''}</div>
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        ))}
        {players.length < 2 && <p className="hint-card"><Icon name="lightbulb" fill /> Add the people you play with so you can pick them when you start a round.</p>}
        <button className="add-row" onClick={() => nav.push('playerEdit', {})}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add player</span></button>

        <div className="sec-label">Crews</div>
        {crews.length === 0 && (
          <p className="hint-card"><Icon name="users-three" fill /> A crew is a group you play with often. Pick a crew to add everyone to a round in one tap.</p>
        )}
        {crews.map(c => (
          <button key={c.id} className="set-row" onClick={() => nav.push('crewEdit', { id: c.id })}>
            <div className="row-main">
              <div className="set-name">{c.name}</div>
              <div className="set-sub">{c.playerIds.map(id => state.players[id]?.name).filter(Boolean).join(', ') || 'No players'}</div>
            </div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        ))}
        <button className="add-row" disabled={players.length < 2} onClick={() => nav.push('crewEdit', {})}>
          <div className="add-ci"><Icon name="plus" /></div>
          <span className="add-lbl">{players.length < 2 ? 'Add players first to make a crew' : 'Add crew'}</span>
        </button>
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
  const [venmo, setVenmo] = useState(existing?.venmo || '');
  const [pad, setPad] = useState(false);
  const trimmed = name.trim();
  const duplicate = Object.values(state.players).some(p => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase());
  const inActive = id && state.activeRoundId && state.rounds[state.activeRoundId]?.players.some(p => p.id === id);

  const save = () => {
    const pid = id || uid('p_');
    update(s => {
      s.players[pid] = { ...(s.players[pid] || { createdAt: Date.now() }), id: pid, name: trimmed, index, venmo: venmo.replace(/^@/, '').trim() };
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
          {duplicate && <p className="field-error">Someone already has that name — add an initial so scorecards stay clear.</p>}
          <label className="field-label">Handicap index <span className="opt">optional</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="amt-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
            {index != null && <button className="header-btn" onClick={() => setIndex(null)}>Clear</button>}
          </div>
          <p className="field-help">Their usual 18-hole index. Course handicaps are worked out from this for each course and tee, and halved for 9-hole games.</p>
          <label className="field-label" htmlFor="pe-venmo">Venmo username <span className="opt">optional</span></label>
          <input id="pe-venmo" className="text-input" value={venmo} onChange={e => setVenmo(e.target.value)} placeholder="@username" autoCapitalize="none" autoCorrect="off" />
        </div>
        {existing && id !== state.me && (
          <button className="danger-link" onClick={remove} disabled={inActive}>
            <Icon name="trash" /> {inActive ? 'In the current round — can’t remove' : 'Remove player'}
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
    if (!(await ask({ title: `Delete ${existing.name}?`, text: 'Players stay — only the group is removed.', confirmLabel: 'Delete crew', danger: true }))) return;
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
