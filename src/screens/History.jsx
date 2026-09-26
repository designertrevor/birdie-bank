import { useEffect, useRef, useState } from 'react';
import { BallIllo, Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES, holeComplete, roundResults } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { meFor, roundDate, seasonStats } from '../lib/format.js';
import { JoinSheet } from '../components/Live.jsx';
import { syncConfigured } from '../lib/sync.js';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CountUp({ value }) {
  const [v, setV] = useState(REDUCED ? value : 0);
  useEffect(() => {
    if (REDUCED) return;
    const t0 = performance.now();
    let raf;
    const tick = t => { const p = Math.min(1, (t - t0) / 900); setV(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const r = Math.round(v);
  return <>{(value > 0 ? '+' : value < 0 ? '−' : '') + '$' + Math.abs(r)}</>;
}

export default function History() {
  const nav = useNav();
  const state = useStore();
  const [filter, setFilter] = useState('all');
  const [joinCode] = useState(() => { try { const c = sessionStorage.getItem('bb-join'); sessionStorage.removeItem('bb-join'); return c; } catch { return null; } });
  const [joining, setJoining] = useState(!!joinCode);
  // Only a round that's still being played; a finished or discarded one never shows here
  const active = state.activeRoundId && state.rounds[state.activeRoundId]?.status === 'active' ? state.rounds[state.activeRoundId] : null;
  const done = Object.values(state.rounds).filter(r => r.status === 'done').sort((a, b) => (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt));
  const shown = done.filter(r => filter === 'all' || r.game === filter);
  const games = [...new Set(done.map(r => r.game))];
  const stats = seasonStats(state);
  const hero = useRef();

  // Group rounds by month
  const groups = [];
  for (const r of shown) {
    const d = new Date(r.finishedAt || r.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    if (!groups.length || groups.at(-1).label !== label) groups.push({ label, rounds: [] });
    groups.at(-1).rounds.push(r);
  }

  const h2h = Object.entries(stats.h2h).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);

  return (
    <Screen>
      <Header title="History" />
      <div className="scroll">
        {active && (
          <button className="resume-card" onClick={() => nav.push('play', { id: active.id })}>
            <div className="resume-pulse" aria-hidden="true" />
            <div className="row-main">
              <div className="bl" style={{ color: 'rgba(255,255,255,.8)' }}>Round in progress</div>
              <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{GAMES[active.game].name} · {active.course.name}</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{active.holes.filter(h => holeComplete(active, h)).length} of {active.holes.length} holes · {active.players.map(p => p.name).join(', ')}</div>
            </div>
            <span className="resume-go"><Icon name="play" fill /></span>
          </button>
        )}

        {syncConfigured && !active && (
          <button className="add-row join-row" onClick={() => setJoining(true)}>
            <div className="add-ci"><Icon name="broadcast" fill /></div><span className="add-lbl">Join a friend’s round</span>
          </button>
        )}

        {done.length === 0 && !active ? (
          <Empty title="No rounds yet" text="Your wins, losses and bragging rights will live here. Go make some history."
            action={<button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : done.length > 0 && (
          <>
            <div className="season-hero" ref={hero}>
              <BallIllo className="ball" face={false} />
              <small>{new Date().getFullYear()} season{state.me ? '' : ''}</small>
              <div className="season-big">{stats.rounds ? <CountUp value={stats.total} /> : '$0'}</div>
              <span className="chip ochre"><Icon name="flag-pennant" fill /> {stats.rounds} round{stats.rounds === 1 ? '' : 's'}</span>
              {stats.streak > 1 && <span className="chip pink"><Icon name="fire" fill /> {stats.streak} wins in a row</span>}
              {stats.birdies > 0 && <span className="chip pink"><Icon name="bird" fill /> {stats.birdies} birdie{stats.birdies === 1 ? '' : 's'}</span>}
            </div>

            {h2h.length > 0 && (
              <>
                <div className="sec-label">Head to head this season</div>
                <div className="h2h">
                  {h2h.map(([pid, v]) => (
                    <div key={pid} className="h2h-item">
                      <div className="h2h-name">{nameOf(state, pid)}</div>
                      <div className={`h2h-amt ${v > 0 ? 'pos' : 'neg'}`}>{money(v, { sign: true })}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {games.length > 1 && (
              <div className="chip-row" role="tablist" aria-label="Filter by game">
                {['all', ...games].map(g => (
                  <button key={g} role="tab" aria-selected={filter === g} className={`pill-btn ${filter === g ? 'on' : ''}`} onClick={() => setFilter(g)}>
                    {g === 'all' ? 'All games' : GAMES[g].name}
                  </button>
                ))}
              </div>
            )}

            {groups.map(g => (
              <div key={g.label}>
                <div className="sec-label">{g.label}</div>
                {g.rounds.map((r, i) => {
                  const res = roundResults(r);
                  const mine = res.balances[meFor(r, state)];
                  const top = res.standings[0];
                  return (
                    <button key={r.id} className={`round-card c${i % 3}`} onClick={() => nav.push('roundDetail', { id: r.id })}>
                      <div className="rc-top">
                        <div className="row-main">
                          <div className="rc-course">{r.course.name}</div>
                          <div className="rc-meta">{roundDate(r)} · {GAMES[r.game].name} · {r.holes.filter(h => holeComplete(r, h)).length} holes</div>
                          <div className="rc-players">{r.players.map(p => p.name).join(', ')}</div>
                        </div>
                        <div className="rc-result">{mine != null ? money(mine, { sign: true }) : money(top.amount, { sign: true })}</div>
                      </div>
                      {mine == null && <div className="rc-meta">Top: {top.name}</div>}
                    </button>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
      <BottomNav />
      {joining && <JoinSheet open initialCode={joinCode || ''} onClose={() => setJoining(false)} />}
    </Screen>
  );
}
