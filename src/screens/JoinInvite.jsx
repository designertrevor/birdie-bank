// First run for someone who opened a join link: see the round, pick your name, you're in.
// No organizer onboarding. They become "me" using their player from the shared round.
import { useEffect, useState } from 'react';
import { BallIllo, Icon, Screen } from '../components/ui.jsx';
import { update, uid } from '../lib/store.js';
import { fetchShared, joinShared } from '../lib/sync.js';
import { GAMES } from '../lib/round.js';

export default function JoinInvite({ code, onJoined, onSkip }) {
  const [found, setFound] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchShared(code)
      .then(r => { if (cancelled) return; if (r) { setFound(r); setErr(null); } else setErr('missing'); })
      .catch(() => { if (!cancelled) setErr('offline'); });
    return () => { cancelled = true; };
  }, [code, tries]);

  const join = async (player, watcherName) => {
    setBusy(true);
    try {
      update(s => {
        // Reuse the round's player id so this round's results are already "mine"
        const id = player?.id || uid('p_');
        s.players[id] = { id, name: player?.name || watcherName.trim(), index: player?.index ?? null, venmo: '', createdAt: Date.now() };
        s.me = id;
        s.onboarded = true;
      });
      const id = await joinShared(code, found, player?.id ?? null);
      onJoined(id, found.meta.status === 'done');
    } catch {
      setBusy(false);
      setErr('offline');
    }
  };

  const meta = found?.meta;
  const game = meta && GAMES[meta.game];

  if (!meta) {
    const missing = err === 'missing';
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" face={!err} />
          <h1 className="onboard-title" style={{ fontSize: 34 }}>{err ? (missing ? 'Round not found' : 'No signal') : 'Finding your round'}</h1>
          <p className="onboard-text">
            {!err && <>Code {code}</>}
            {missing && <>Nobody is sharing a round with code {code} right now. Ask the scorekeeper for a fresh link.</>}
            {err === 'offline' && <>Couldn’t reach Birdie Bank. Check your signal and try again.</>}
          </p>
        </div>
        {err && (
          <div className="cta-wrap">
            {!missing && <button className="full-btn" onClick={() => { setErr(null); setTries(t => t + 1); }}>Try again <Icon name="arrow-clockwise" /></button>}
            <button className={`full-btn ${missing ? '' : 'outline'}`} onClick={onSkip}>Set up Birdie Bank instead</button>
          </div>
        )}
      </Screen>
    );
  }

  if (watching) {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body" style={{ textAlign: 'left', alignItems: 'stretch' }}>
          <h1 className="onboard-title" style={{ fontSize: 34 }}>Watch the round</h1>
          <p className="onboard-text" style={{ textAlign: 'left' }}>Follow every hole live. Add your name so the app knows who you are.</p>
          <label className="field-label" htmlFor="ji-name">Your name</label>
          <input id="ji-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Trevor" autoComplete="given-name" maxLength={24} />
        </div>
        <div className="cta-wrap">
          <button className="full-btn" disabled={!name.trim() || busy} onClick={() => join(null, name)}>{busy ? 'Joining…' : <>Start watching <Icon name="eye" /></>}</button>
          <button className="full-btn outline" onClick={() => setWatching(false)}>Back</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="onboard">
      <div className="scroll onboard-body" style={{ textAlign: 'left', alignItems: 'stretch' }}>
        <div className="onboard-badge"><Icon name="golf" fill /></div>
        <h1 className="onboard-title" style={{ fontSize: 34 }}>You’re invited</h1>
        <div className="block summary-card" style={{ margin: '8px 0 4px' }}>
          <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{game?.name || 'Golf'} · {meta.course.name}</div>
          <div className="li-sub">{meta.holes.length} holes · {meta.players.map(p => p.name).join(', ')}</div>
        </div>
        <div className="sec-label" style={{ padding: '10px 4px 2px' }}>Which one are you?</div>
        {meta.players.map(p => (
          <button key={p.id} className="sheet-item" style={{ margin: 0, width: '100%' }} disabled={busy} onClick={() => join(p)}>
            <span><Icon name="user-circle" fill /> I’m {p.name}</span><Icon name="caret-right" />
          </button>
        ))}
        <p className="field-help" style={{ textAlign: 'center' }}>Friendly wagers only. Birdie Bank never holds or moves money. You settle up yourselves.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn outline" disabled={busy} onClick={() => setWatching(true)}>I’m just watching</button>
      </div>
    </Screen>
  );
}
