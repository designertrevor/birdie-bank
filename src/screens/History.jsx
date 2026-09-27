import { useEffect, useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import {
  defaultRange, headToHead, isLatest, monthGroups, netSeries, rangeLabel, rangeOfKind, roundsInRange, shiftRange,
} from '../lib/history.js';
import { RoundRow } from '../components/RoundRow.jsx';
import { SeasonChart } from '../components/SeasonChart.jsx';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const RANGE_KEY = 'bb-history-range';

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

/** The range you last looked at on this phone, or this season. */
function savedRange() {
  try {
    const r = JSON.parse(sessionStorage.getItem(RANGE_KEY));
    if (r && ['season', 'month', 'custom'].includes(r.kind)) return r;
  } catch { /* ignore */ }
  return defaultRange();
}

export default function History() {
  const nav = useNav();
  const state = useStore();
  const [range, setRangeRaw] = useState(savedRange);
  const [filter, setFilter] = useState('all');
  const setRange = r => { setRangeRaw(r); try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ } };

  const anyDone = Object.values(state.rounds).some(r => r.status === 'done');
  const inRange = roundsInRange(state, range);
  const games = [...new Set(inRange.map(r => r.game))].filter(g => GAMES[g]);
  // A game picked for another range falls back to all games
  const game = games.includes(filter) ? filter : 'all';
  const shown = inRange.filter(r => game === 'all' || r.game === game);
  const groups = monthGroups(shown, state);
  const series = netSeries(shown, state);
  const net = series.at(-1)?.total ?? 0;
  const label = rangeLabel(range);
  const h2h = Object.entries(headToHead(shown, state)).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);

  return (
    <Screen>
      <Header title="History" right={<AvatarButton />} />
      <div className="scroll">
        {!anyDone ? (
          <Empty title="No rounds yet" text="Your wins, losses and bragging rights will live here. Go make some history."
            action={<button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            <div className="range-bar">
              <Segmented label="Time range" className="press-mode-row" btn="pm-btn" value={range.kind} onChange={k => setRange(rangeOfKind(k, range))}
                options={[{ value: 'season', label: 'Season' }, { value: 'month', label: 'Month' }, { value: 'custom', label: 'Custom' }]} />
              {range.kind === 'custom' ? (
                <div className="range-dates">
                  <label><span className="eyebrow">From</span>
                    <input type="date" className="text-input" value={range.from} max={range.to || undefined} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
                  <label><span className="eyebrow">To</span>
                    <input type="date" className="text-input" value={range.to} min={range.from || undefined} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
                </div>
              ) : (
                <div className="range-step">
                  <button className="icon-btn sm" onClick={() => setRange(shiftRange(range, -1))} aria-label={`Previous ${range.kind}`}><Icon name="caret-left" /></button>
                  <span className="range-label" aria-live="polite">{label}</span>
                  <button className="icon-btn sm" onClick={() => setRange(shiftRange(range, 1))} disabled={isLatest(range)} aria-label={`Next ${range.kind}`}><Icon name="caret-right" /></button>
                </div>
              )}
            </div>

            {games.length > 1 && (
              <div className="chip-row" role="group" aria-label="Filter by game">
                {['all', ...games].map(g => (
                  <button key={g} aria-pressed={game === g} className={`pill-btn ${game === g ? 'on' : ''}`} onClick={() => setFilter(g)}>
                    {g === 'all' ? 'All games' : GAMES[g].name}
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <Empty illo={false} title="No rounds here" text={range.kind === 'custom' ? 'Nothing finished between those dates. Try a wider range.' : `Nothing finished in ${range.kind === 'season' ? `the ${label}` : label}. Try another ${range.kind}.`} />
            ) : (
              <>
                {series.length > 0 && (
                  <div className="chart-card">
                    <div className="cc-head">
                      <div>
                        <div className="eyebrow">Your net</div>
                        <div className={`cc-big ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}><CountUp key={label + game} value={net} /></div>
                      </div>
                      <div className="cc-meta">{series.length} round{series.length === 1 ? '' : 's'}</div>
                    </div>
                    <SeasonChart series={series} label={label} />
                  </div>
                )}

                {h2h.length > 0 && (
                  <>
                    <div className="sec-label">Head to head</div>
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

                {groups.map(g => (
                  <section key={g.key} className="month-group" aria-label={g.label}>
                    <div className="month-head">
                      <span className="mh-name">{g.label}</span>
                      <span className="mh-meta">
                        {g.count} round{g.count === 1 ? '' : 's'}
                        {g.played > 0 && <> · <span className={g.net > 0 ? 'pos' : g.net < 0 ? 'neg' : ''}>{money(g.net, { sign: true })}</span></>}
                      </span>
                    </div>
                    <div className="month-rows">
                      {g.rounds.map(r => <RoundRow key={r.id} round={r} state={state} />)}
                    </div>
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </Screen>
  );
}
