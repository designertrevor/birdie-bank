import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { GAMES } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import {
  defaultRange, headToHead, isLatest, lastResult, monthGroups, netSeries, rangeLabel, rangeOfKind, roundTime, roundsInRange, shiftRange,
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
  // Whole dollars while it counts, then the exact amount (cents too) once it lands
  if (v === value) return <>{money(value, { sign: true })}</>;
  const r = Math.round(v);
  return <>{(value > 0 ? '+' : value < 0 ? '−' : '') + '$' + Math.abs(r)}</>;
}

const isYear = n => Number.isInteger(n) && n > 1900 && n < 3000;
/** A range read back from storage, or null when it isn't one this screen can show. */
function validRange(r) {
  if (!r || typeof r !== 'object') return null;
  if (r.kind === 'season') return isYear(r.year) ? r : null;
  if (r.kind === 'month') return isYear(r.year) && Number.isInteger(r.month) && r.month >= 0 && r.month < 12 ? r : null;
  if (r.kind === 'custom') return typeof r.from === 'string' && typeof r.to === 'string' ? r : null;
  return null;
}

/**
 * The range you last looked at this visit, or this season. When this season has nothing yet
 * (say, early January) it opens on the season of your last finished round instead.
 */
function startRange(state) {
  try {
    const r = validRange(JSON.parse(sessionStorage.getItem(RANGE_KEY)));
    if (r) return r;
  } catch { /* ignore */ }
  const range = defaultRange();
  if (roundsInRange(state, range).length) return range;
  const last = lastResult(state);
  const t = last && roundTime(last.round);
  return t ? { kind: 'season', year: new Date(t).getFullYear() } : range;
}

export default function History() {
  const nav = useNav();
  const state = useStore();
  const [range, setRangeRaw] = useState(() => startRange(state));
  const [filter, setFilter] = useState('all');
  const setRange = r => { setRangeRaw(r); try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ } };

  const { rounds, me } = state;
  // Every round's money is worked out a few times over, so only redo it when the rounds or the range change
  const { anyDone, games, game, shown, groups, series, h2h } = useMemo(() => {
    const s = { rounds, me };
    const inRange = roundsInRange(s, range);
    const games = [...new Set(inRange.map(r => r.game))].filter(g => GAMES[g]);
    // A game picked for another range falls back to all games
    const game = games.includes(filter) ? filter : 'all';
    const shown = inRange.filter(r => game === 'all' || r.game === game);
    return {
      anyDone: Object.values(rounds).some(r => r.status === 'done'),
      games, game, shown,
      groups: monthGroups(shown, s),
      series: netSeries(shown, s),
      h2h: Object.entries(headToHead(shown, s)).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5),
    };
  }, [rounds, me, range, filter]);
  const net = series.at(-1)?.total ?? 0;
  const label = rangeLabel(range);

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
