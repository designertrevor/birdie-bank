// First run for someone who opened a join link: an invite card (who asked you, the game, the
// bets, the course and who's in), then pick your seat, then check your strokes, then you're in.
// Not on the list? Ask the scorekeeper for a seat and wait here for them to let you in.
// No organizer onboarding. They become "me" using their player from the shared round.
import { useEffect, useMemo, useState } from 'react';
import { BallIllo, Icon, Screen } from '../components/ui.jsx';
import { getState, update, uid } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { afterJoin } from '../lib/join.js';
import { cancelSeatRequest, fetchShared, joinShared, requestSeat, watchSeatRequest } from '../lib/sync.js';
import { assemble, cleanRequestName } from '../lib/sync-model.js';
import { GAMES, addPlayerProblem } from '../lib/round.js';
import { stakeSummary } from '../lib/stakes.js';
import { firstName, strokesLabel } from '../lib/format.js';
import { payFields } from '../lib/pay.js';

// A seat request survives the page being closed, so reopening the link keeps waiting
const seatKey = code => `bb-seat:${code}`;
function loadSeat(code) { try { return JSON.parse(localStorage.getItem(seatKey(code))) || null; } catch { return null; } }
function saveSeat(code, v) { try { if (v) localStorage.setItem(seatKey(code), JSON.stringify(v)); else localStorage.removeItem(seatKey(code)); } catch { /* storage blocked */ } }

const TINTS = ['lav', 'peach', 'mint', 'ochre'];
function Avatar({ name, i = 0, size = '' }) {
  return <span className={`join-avatar ${TINTS[i % TINTS.length]} ${size}`} aria-hidden="true">{firstName(name).slice(0, 1).toUpperCase() || '?'}</span>;
}

/** The invite card as a pushed screen, for someone already set up (a join link, or a typed code). */
export function JoinInviteScreen({ code }) {
  const nav = useNav();
  return <JoinInvite code={code} setUp onJoined={(id, done) => nav.reset('upnext', afterJoin(id, done))} onSkip={nav.pop} />;
}

/**
 * `setUp`: this phone already has its own player (it's past onboarding), so joining keeps who
 * "you" are and just adds the round, the way the old join sheet did.
 */
export default function JoinInvite({ code, onJoined, onSkip, setUp = false }) {
  const [found, setFound] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  // card → seat → confirm, or watch, or ask → waiting → (in: join) | no | gone
  const [step, setStep] = useState(() => (loadSeat(code) ? 'waiting' : 'card'));
  const [seat, setSeat] = useState(null);
  // Someone already set up asks for a seat under their own name (they can still change it)
  const [name, setName] = useState(() => loadSeat(code)?.name || (setUp ? (() => { const s = getState(); return s.players?.[s.me]?.name || ''; })() : ''));
  const [askErr, setAskErr] = useState(false);
  const [joinErr, setJoinErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchShared(code)
      .then(r => { if (cancelled) return; if (r) { setFound(r); setErr(null); } else setErr('missing'); })
      .catch(() => { if (!cancelled) setErr('offline'); });
    return () => { cancelled = true; };
  }, [code, tries]);

  const round = useMemo(() => (found ? assemble(found.meta, found.holes) : null), [found]);

  const join = async (player, watcherName) => {
    setBusy(true); setJoinErr(false);
    try {
      if (setUp) {
        // Already have this round (picked a seat before): open it rather than join twice
        const have = Object.values(getState().rounds).find(r => r.shared?.code === code);
        if (have) { saveSeat(code, null); onJoined(have.id, have.status === 'done'); return; }
      } else update(s => {
        // Reuse the round's player id so this round's results are already "mine"
        const id = player?.id || uid('p_');
        s.players[id] = { id, name: player?.name || watcherName.trim(), index: player?.index ?? null, ...payFields(player), createdAt: Date.now() };
        s.me = id;
        s.onboarded = true;
      });
      const latest = (await fetchShared(code).catch(() => null)) || found;
      const id = await joinShared(code, latest, player?.id ?? null);
      saveSeat(code, null);
      onJoined(id, latest.meta.status === 'done');
    } catch {
      setBusy(false);
      setJoinErr(true);
    }
  };

  // Waiting on the scorekeeper: watch the request, and once they let you in, take the seat
  const pending = step === 'waiting' ? loadSeat(code) : null;
  const pendingNo = pending?.no ?? null;
  useEffect(() => {
    if (pendingNo == null) return;
    let done = false;
    const stop = watchSeatRequest(code, pendingNo, async r => {
      if (done) return;
      if (r.status === 'no' || r.status === 'gone') { done = true; saveSeat(code, null); setStep(r.status); return; }
      if (r.status !== 'in' || !r.playerId) return;
      done = true;
      // Their phone sends the round with you in it first; give it a moment to land
      for (let i = 0; i < 20; i++) {
        try {
          const latest = await fetchShared(code);
          const me = latest?.meta.players?.find(p => p.id === r.playerId);
          if (me) { setFound(latest); join(me); return; }
        } catch { /* no signal yet */ }
        await new Promise(res => setTimeout(res, 1500));
      }
      done = false; // keep watching; the next check tries again
    });
    return () => { done = true; stop(); };
    // join is recreated each render; the request number is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, pendingNo]);

  const meta = found?.meta;
  const game = meta && GAMES[meta.game];
  const host = typeof meta?.hostName === 'string' && meta.hostName.trim() ? firstName(meta.hostName) : null;
  const scorekeeper = host || 'the scorekeeper';

  if (!meta && step !== 'waiting') {
    const missing = err === 'missing';
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" face={!err} />
          <h1 className="onboard-title" style={{ fontSize: 34 }}>{err ? (missing ? 'Round not found' : 'No signal') : 'Finding your round…'}</h1>
          <p className="onboard-text">
            {!err && <>Code {code}</>}
            {missing && <>We can’t find round {code}. It may have finished, or the link is old. Ask the scorekeeper for a fresh one.</>}
            {err === 'offline' && <>Couldn’t reach Birdie Bank. Check your signal and try again.</>}
          </p>
        </div>
        {err && (
          <div className="cta-wrap">
            {!missing && <button className="full-btn" onClick={() => { setErr(null); setTries(t => t + 1); }}>Try again <Icon name="arrow-clockwise" /></button>}
            <button className={`full-btn ${missing ? '' : 'outline'}`} onClick={onSkip}>{setUp ? 'Back to Up next' : 'Start my own round instead'}</button>
          </div>
        )}
      </Screen>
    );
  }

  if (step === 'watch') {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body join-body">
          <h1 className="onboard-title join-h">Follow along</h1>
          <p className="onboard-text join-p">See every hole as it’s scored. Add your name so the group knows who’s watching.</p>
          <label className="field-label" htmlFor="ji-name">Your name</label>
          <input id="ji-name" className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Trevor" autoComplete="given-name" maxLength={24} />
        </div>
        <div className="cta-wrap">
          {joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t reach Birdie Bank. Check your signal and try again.</p>}
          <button className="full-btn" disabled={!name.trim() || busy} onClick={() => join(null, name)}>{busy ? 'Joining…' : <>Start watching <Icon name="eye" /></>}</button>
          <button className="full-btn outline" onClick={() => setStep('card')}>Back</button>
        </div>
      </Screen>
    );
  }

  if (step === 'ask') {
    const problem = round ? addPlayerProblem(round) : null;
    const send = async () => {
      setBusy(true); setAskErr(false);
      try {
        const clean = cleanRequestName(name);
        const no = await requestSeat(code, clean);
        saveSeat(code, { no, name: clean });
        setStep('waiting');
      } catch { setAskErr(true); }
      setBusy(false);
    };
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body join-body">
          <h1 className="onboard-title join-h">Not on the list?</h1>
          {problem ? (
            <>
              <p className="onboard-text join-p">{problem}</p>
              <p className="hint-card join-hint"><Icon name="info" fill /> You can still follow along live, or ask {scorekeeper} to start a new round with you in it.</p>
            </>
          ) : (
            <>
              <p className="onboard-text join-p">Tell {scorekeeper} who you are. They get a note on their phone and give you a seat, and your money counts from the hole you start on.</p>
              <label className="field-label" htmlFor="ji-ask">Your name</label>
              <input id="ji-ask" className="name-input" value={name} onChange={e => { setName(e.target.value); setAskErr(false); }} placeholder="e.g. Sam" autoComplete="given-name" maxLength={24} />
              {askErr && (
                <p className="hint-card join-hint" role="alert"><Icon name="warning" fill /> Couldn’t send that. Ask {scorekeeper} to add you from the round menu (Add a player), then pick your name from the seats.</p>
              )}
            </>
          )}
        </div>
        <div className="cta-wrap">
          {problem
            ? <button className="full-btn" onClick={() => (setUp ? join(null) : setStep('watch'))}>Watch instead <Icon name="eye" /></button>
            : askErr
              ? <button className="full-btn" onClick={() => { setAskErr(false); setTries(t => t + 1); setStep('seat'); }}>They added me, check again <Icon name="arrow-clockwise" /></button>
              : <button className="full-btn" disabled={!cleanRequestName(name) || busy} onClick={send}>{busy ? 'Sending…' : <>Ask to join <Icon name="paper-plane-tilt" /></>}</button>}
          <button className="full-btn outline" onClick={() => setStep('seat')}>Back to the seats</button>
        </div>
      </Screen>
    );
  }

  if (step === 'waiting' || step === 'no' || step === 'gone') {
    const cancel = async () => {
      const s = loadSeat(code);
      saveSeat(code, null);
      setStep('seat');
      if (s) await cancelSeatRequest(code, s.no);
    };
    const title = step === 'waiting' ? (busy ? 'You’re in' : `Waiting on ${scorekeeper}`) : step === 'no' ? 'Not this time' : 'Round closed';
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <BallIllo className="onboard-illo" face={step !== 'gone'} />
          <h1 className="onboard-title join-h" aria-live="polite">{title}</h1>
          <p className="onboard-text">
            {step === 'waiting' && (busy ? 'Taking you to your seat.' : <>Asked for a seat as {pending?.name || name}. Keep this open: you’ll go straight in when {scorekeeper} says yes.</>)}
            {step === 'no' && <>{host || 'The scorekeeper'} didn’t add you to this one. You can still follow along live.</>}
            {step === 'gone' && <>{host || 'The scorekeeper'} stopped sharing this round.</>}
          </p>
        </div>
        <div className="cta-wrap">
          {step === 'waiting' && !busy && <button className="full-btn outline" onClick={cancel}>Cancel request</button>}
          {step === 'no' && meta && <button className="full-btn" onClick={() => (setUp ? join(null) : setStep('watch'))}>Watch instead <Icon name="eye" /></button>}
          {step !== 'waiting' && <button className="full-btn outline" onClick={onSkip}>{setUp ? 'Back to Up next' : 'Start my own round instead'}</button>}
        </div>
      </Screen>
    );
  }

  const handicaps = !!meta.useHandicaps;
  const teamOf = pid => (meta.teams || []).find(t => t.players?.includes(pid));
  const done = meta.status === 'done';

  if (step === 'confirm' && seat) {
    const team = teamOf(seat.id);
    const mates = team ? team.players.filter(x => x !== seat.id).map(x => firstName(meta.players.find(p => p.id === x)?.name)).filter(Boolean) : [];
    const from = meta.joined?.[seat.id];
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body join-body">
          <div className="join-confirm">
            <Avatar name={seat.name} i={Math.max(0, meta.players.findIndex(p => p.id === seat.id))} size="lg" />
            <h1 className="onboard-title join-h">You’re {firstName(seat.name)}</h1>
            <ul className="join-facts">
              {handicaps && <li><Icon name="golf" fill /> {strokesLabel(seat.plays)}</li>}
              {team && <li><Icon name="users-three" fill /> {team.name}{mates.length ? ` with ${mates.join(' and ')}` : ''}</li>}
              {from != null && <li><Icon name="user-plus" fill /> Starts on hole {from}. Your money counts from there</li>}
              <li><Icon name={game?.icon || 'golf'} fill /> {game?.name || 'Golf'} · {stakeSummary(meta.game, meta.settings)}</li>
            </ul>
          </div>
          {handicaps && <p className="field-help">Strokes look wrong? Tell {scorekeeper} before you tee off.</p>}
        </div>
        <div className="cta-wrap">
          {joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t reach Birdie Bank. Check your signal and try again.</p>}
          <button className="full-btn" disabled={busy} onClick={() => join(seat)}>{busy ? 'Joining…' : done ? <>See the results <Icon name="arrow-right" /></> : <>Into the round <Icon name="arrow-right" /></>}</button>
          <button className="full-btn outline" disabled={busy} onClick={() => setStep('seat')}>That’s not me</button>
        </div>
      </Screen>
    );
  }

  if (step === 'seat') {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body join-body">
          <h1 className="onboard-title join-h">Pick your seat</h1>
          <p className="onboard-text join-p">Which one are you?</p>
          <div className="seat-grid">
            {meta.players.map((p, i) => {
              const team = teamOf(p.id);
              const from = meta.joined?.[p.id];
              const facts = [handicaps ? strokesLabel(p.plays) : null, team?.name, from != null ? `From hole ${from}` : null].filter(Boolean);
              return (
                <button key={p.id} className="seat-tile" aria-label={[`I’m ${p.name}`, ...facts].join(', ')} onClick={() => { setSeat(p); setStep('confirm'); }}>
                  <Avatar name={p.name} i={i} />
                  <span className="seat-name">{p.name}</span>
                  <span className="seat-sub">
                    {facts.join(' · ') || ' '}
                  </span>
                </button>
              );
            })}
            {!done && (
              <button className="seat-tile add" aria-label="Not on the list? Add me" onClick={() => setStep('ask')}>
                <span className="join-avatar add" aria-hidden="true"><Icon name="plus" /></span>
                <span className="seat-name">Not on the list?</span>
                <span className="seat-sub">Add me</span>
              </button>
            )}
          </div>
        </div>
        <div className="cta-wrap">
          <button className="full-btn outline" onClick={() => setStep('card')}>Back</button>
        </div>
      </Screen>
    );
  }

  // The invite card
  const names = meta.players.map(p => firstName(p.name));
  return (
    <Screen className="onboard">
      <div className="scroll onboard-body join-body">
        <div className="invite-card">
          <div className="ic-from">
            {host ? <><Avatar name={host} i={3} size="sm" /> <span><strong>{host}</strong> invited you</span></> : <span>You’re invited</span>}
          </div>
          <div className="ic-game"><Icon name={game?.icon || 'golf'} fill /> {game?.name || 'Golf'}</div>
          <div className="ic-course">{meta.course?.name} · {meta.holes.length} holes</div>
          <dl className="ic-facts">
            <div><dt>Bets</dt><dd>{stakeSummary(meta.game, meta.settings) || '–'}</dd></div>
            <div>
              <dt>Who’s in</dt>
              <dd>
                <span className="ic-stack">{meta.players.slice(0, 6).map((p, i) => <Avatar key={p.id} name={p.name} i={i} size="sm" />)}</span>
                <span>{names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`}</span>
              </dd>
            </div>
          </dl>
          {done && <p className="ic-note">This round is finished. Pick your seat to see how it ended.</p>}
        </div>
        <p className="field-help">Friendly wagers only. Birdie Bank never holds or moves money. You settle up yourselves.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => setStep('seat')}>Pick your seat <Icon name="arrow-right" /></button>
        <button className="full-btn outline" disabled={busy} onClick={() => (setUp ? join(null) : setStep('watch'))}>{busy ? 'Joining…' : 'I’m just watching'}</button>
        {setUp && <button className="sheet-cancel" style={{ width: '100%', margin: 0 }} onClick={onSkip}>Not now</button>}
        {setUp && joinErr && <p className="field-error" role="alert" style={{ textAlign: 'center' }}>Couldn’t reach Birdie Bank. Check your signal and try again.</p>}
      </div>
    </Screen>
  );
}
