// History (overhaul, 2026-10-26): Layout Lab A's compact chart and month list, with C's round
// cards so each round reads as a story (RoundCard.jsx). Same ranges, game filter, stats, head to
// head, closed seasons and round detail as before; Recently deleted is a quiet link at the end.
import { useEffect, useMemo, useState } from 'react';
import './history.css';
import { Empty, Header, Icon, PickChip, Screen } from '../components/ui.jsx';
import { RangeBar } from '../components/RangeBar.jsx';
import { useRecordBook } from '../lib/useRecordBook.js';
import { RecordBookNote } from '../components/RecordBookNote.jsx';
import { GAMES } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { AvatarButton, BottomNav } from '../nav.jsx';
import { useNav } from '../lib/nav.js';
import { useKept } from '../lib/kept.js';
import {
  defaultRange, headToHead, lastResult, monthGroups, myNet, netSeries, rangeLabel, roundTime, roundsInRange, statsLinkLabel, withClosedBooks,
} from '../lib/history.js';
import { BooksClosedRow, ClosedSeasons } from '../components/CrewTabs.jsx';
import { booksOf } from '../lib/books.js';
import { RoundCard } from '../components/RoundCard.jsx';
import { SeasonChart } from '../components/SeasonChart.jsx';
import { BOX } from '../lib/chart-axis.js';
import { bigDays } from '../lib/round-story.js';
import { deletedList } from '../lib/recently-deleted.js';

// A shorter drawing box than the Tab's old chart had, so the line sits over the rounds instead of
// filling the screen (Trevor: A "felt more compact and professionally designed")
const COMPACT = { ...BOX, h: 104, padT: 8, padB: 20 };
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
    // No animation frames (low-power mode, a tab in the background): land on the real amount anyway
    const land = setTimeout(() => { cancelAnimationFrame(raf); setV(value); }, 1300);
    return () => { cancelAnimationFrame(raf); clearTimeout(land); };
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
  // The Record Book limit (record-book.js): with the paywall flag on and no Pro, the last 10
  // finished rounds. With the flag off it's every round, the store's own state
  const { state, line } = useRecordBook();
  const [range, setRangeRaw] = useState(() => startRange(state));
  const [filter, setFilter] = useKept('history:filter', 'all');
  const setRange = r => { setRangeRaw(r); try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ } };

  const { rounds, me, players, links, unlinks } = state;
  // Every round's money is worked out a few times over, so only redo it when the rounds or the range change.
  // Players, links and unlinks say who is who, so a friend with two ids is one head to head (people-links.js)
  const { anyDone, games, game, shown, groups, series, h2h } = useMemo(() => {
    const s = { rounds, me, players, links, unlinks };
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
  }, [rounds, me, players, links, unlinks, range, filter]);
  const net = series.at(-1)?.total ?? 0;
  // Seasons whose books closed (books.js): a list of their own, and a marker where each closed
  const books = booksOf(state);
  const groupKeys = groups.map(g => g.key);
  const label = rangeLabel(range);
  // Your best win of each month gets the bigger card
  const big = useMemo(() => bigDays(groups, r => myNet(r, state)), [groups, state]);
  const trash = deletedList(state).length;

  return (
    <Screen>
      <Header title="History" right={<AvatarButton />} />
      <div className="scroll">
        {!anyDone ? (
          <Empty illo="card" title="No rounds yet" text="Your wins, losses and bragging rights will live here. Go make some history."
            action={<button className="ec" onClick={() => nav.push('newRound')}><Icon name="golf" fill /> Start a round</button>} />
        ) : (
          <>
            <RangeBar compact range={range} onChange={setRange} />

            {games.length > 1 && (
              <div className="chip-row hx-games" role="radiogroup" aria-label="Filter by game">
                {['all', ...games].map(g => (
                  <PickChip key={g} radio small on={game === g} onClick={() => setFilter(g)}>{g === 'all' ? 'All games' : GAMES[g].name}</PickChip>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <Empty illo="card" title="No rounds here" text={range.kind === 'custom' ? 'Nothing finished between those dates. Try a wider range.' : `Nothing finished in ${range.kind === 'season' ? `the ${label}` : label}. Try another ${range.kind}.`} />
            ) : (
              <>
                {/* The money line, compact: your net and the count on one line, the chart, then the stats a tap away */}
                <div className="chart-card hx-chart">
                  {series.length > 0 && (
                    <>
                      <div className="hx-head">
                        <span className="eyebrow">Your net</span>
                        <span className="hx-meta">{series.length < shown.length ? `${series.length} of ${shown.length} rounds for money` : `${series.length} round${series.length === 1 ? '' : 's'}`}</span>
                      </div>
                      <div className={`hx-big ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}><CountUp key={label + game} value={net} /></div>
                      {/* One round is a number, not a line from nowhere */}
                      {series.length >= 2 && <SeasonChart series={series} label={label} box={COMPACT} />}
                    </>
                  )}
                  {/* Deeper stats for the same range: by game, by course, presses, skins and biggest wins */}
                  <button className="hx-stats" onClick={() => nav.push('stats', { range })}>
                    <Icon name="chart-bar" fill /> <span className="row-main">{statsLinkLabel(range)}<span className="sl-sub">By game and course, presses, skins and biggest wins</span></span> <Icon name="caret-right" />
                  </button>
                </div>

                {h2h.length > 0 && (
                  <section className="hx-h2h" aria-label="Head to head">
                    <div className="hx-label">Head to head <span>What you won or lost against each person, bet by bet</span></div>
                    <div className="h2h">
                      {h2h.map(([pid, v]) => (
                        <div key={pid} className="h2h-item">
                          <div className="h2h-name">{nameOf(state, pid)}</div>
                          <div className={`h2h-amt ${v > 0 ? 'pos' : 'neg'}`}>{money(v, { sign: true })}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <ClosedSeasons />

                {groups.map(g => (
                  <section key={g.key} className="month-group hx-month" aria-label={g.label}>
                    <div className="month-head">
                      <span className="mh-name">{g.label}</span>
                      <span className="mh-meta">
                        {g.count} round{g.count === 1 ? '' : 's'}
                        {g.played > 0 && <> · <span className={g.net > 0 ? 'pos' : g.net < 0 ? 'neg' : ''}>{money(g.net, { sign: true })}</span></>}
                      </span>
                    </div>
                    <div className="hx-cards">
                      {withClosedBooks(g.rounds, books, g.key, range, groupKeys).map(x => (x.book
                        ? <BooksClosedRow key={x.book.id} book={x.book} />
                        : <RoundCard key={x.round.id} round={x.round} state={state} big={big.has(x.round.id)} />))}
                    </div>
                  </section>
                ))}
              </>
            )}
            <RecordBookNote line={line} />
            {/* Deleted rounds wait 30 days in Settings (recently-deleted.js): a way back from here too */}
            {trash > 0 && (
              <button className="quiet-row hx-trash" onClick={() => nav.push('recentlyDeleted')}>
                <Icon name="trash" /> <u>Recently deleted</u> <span>{trash} round{trash === 1 ? '' : 's'}</span>
              </button>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </Screen>
  );
}
