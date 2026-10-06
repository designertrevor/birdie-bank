// Your stats: results and net by game and by course, how your presses went, skins won and your
// biggest wins, over any time range (the same control as History, plus All time). Opened from your
// profile, from History (on the range you were looking at) and from Season. It's worked out on this
// phone from your own rounds; the all-time records (no money) go with your profile under its
// privacy setting (profile-model.js publicDeep), and the dollars here stay on this phone.
import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { RangeBar } from '../components/RangeBar.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { points } from '../lib/play-for.js';
import { rangeLabel, roundsInRange } from '../lib/history.js';
import { useMyProfile } from '../lib/profiles.js';
import { statsShareLine } from '../lib/profile-view.js';
import { deepStats, lineAmount, lineSub, pressCount, pressText, skinsText, winRate } from '../lib/deep-stats.js';
import { TREND_LABEL, handicapTrend, trendEmptyText, trendVsOfficial } from '../lib/hc-trend.js';
import { formatIndex } from '../lib/format.js';
import { TrendChart } from '../components/TrendChart.jsx';

const RANGE_KEY = 'bb-stats-range';
const KINDS = ['all', 'season', 'month', 'custom'];
const FMT = { money, points };
const shortDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });

const isYear = n => Number.isInteger(n) && n > 1900 && n < 3000;
/** A range this screen can show, or null. */
function validRange(r) {
  if (!r || typeof r !== 'object') return null;
  if (r.kind === 'all') return { kind: 'all' };
  if (r.kind === 'season') return isYear(r.year) ? r : null;
  if (r.kind === 'month') return isYear(r.year) && Number.isInteger(r.month) && r.month >= 0 && r.month < 12 ? r : null;
  if (r.kind === 'custom') return typeof r.from === 'string' && typeof r.to === 'string' ? r : null;
  return null;
}
/** The range it was opened on (History's, or Season's year), else the one you last looked at this visit, else All time. */
function startRange(given) {
  const r = validRange(given);
  if (r) return r;
  try {
    const saved = validRange(JSON.parse(sessionStorage.getItem(RANGE_KEY)));
    if (saved) return saved;
  } catch { /* ignore */ }
  return { kind: 'all' };
}

export default function Stats({ range: given = null }) {
  const nav = useNav();
  const state = useStore();
  const { privacy } = useMyProfile();
  const [range, setRangeRaw] = useState(() => startRange(given));
  const setRange = r => { setRangeRaw(r); try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ } };
  const { rounds, me, players, links, unlinks, accountOf } = state;
  // Who is who (links, unlinks, accounts) decides which seats are yours, so it's part of the key
  const st = useMemo(() => {
    const s = { rounds, me, players, links, unlinks, accountOf };
    return deepStats(s, roundsInRange(s, range));
  }, [rounds, me, players, links, unlinks, accountOf, range]);
  // The handicap trend looks at every round you've finished, whatever the range
  const { customCourses } = state;
  const trend = useMemo(
    () => handicapTrend({ rounds, me, players, links, unlinks, accountOf, customCourses }),
    [rounds, me, players, links, unlinks, accountOf, customCourses],
  );
  const label = rangeLabel(range);
  const made = st.presses.made;
  const rate = winRate(made);

  return (
    <Screen>
      <Header title="Your stats" onBack={nav.pop} />
      <div className="scroll">
        <RangeBar range={range} onChange={setRange} kinds={KINDS} />
        {range.kind === 'all' && <p className="range-label stats-all" aria-live="polite">Every round you’ve played</p>}

        {st.rounds === 0 ? (
          <>
            <Empty illo={false} title="No rounds here" text={emptyText(range, label)} />
            <Trend trend={trend} />
          </>
        ) : (
          <>
            <div className="pf-tiles stats-tiles">
              <Tile label="Rounds" value={String(st.rounds)} sub={recordLine(st.record)} />
              <Tile label="Net" value={st.dollars.rounds ? money(st.dollars.net, { sign: true }) : '–'} tone={tone(st.dollars.net)}
                sub={st.dollars.rounds ? `${st.dollars.rounds} round${st.dollars.rounds === 1 ? '' : 's'} for money` : 'No money rounds'} />
              <Tile label="Press win rate" value={rate == null ? '–' : `${rate}%`} sub={pressCount(made) ? `${made.won} of ${pressCount(made)} presses` : 'No presses yet'} />
              <Tile label="Skins won" value={st.skins.rounds ? skinsText(st.skins.won) : '–'} sub={st.skins.rounds ? `in ${st.skins.rounds} round${st.skins.rounds === 1 ? '' : 's'} with skins` : 'No skins games'} />
            </div>

            <Trend trend={trend} />

            <div className="sec-label">By game</div>
            <Lines lines={st.games} label="Results by game" />

            <div className="sec-label">By course</div>
            <Lines lines={st.courses} label="Results by course" place />

            {st.presses.rounds > 0 && (
              <>
                <div className="sec-label">Presses</div>
                <div className="block kv-block">
                  <Kv k="Your presses" v={`${pressText(made)}${rate == null ? '' : ` · ${rate}%`}`} />
                  <Kv k="Pressed against you" v={pressText(st.presses.against)} />
                  <Kv k="Rounds with a press" v={String(st.presses.rounds)} />
                </div>
                <p className="field-help pad">Nassau and match play. Your presses are the ones your side called, or that went on for you automatically. A press still level at the end is halved.</p>
              </>
            )}

            {st.skins.rounds > 0 && (
              <>
                <div className="sec-label">Skins</div>
                <div className="block kv-block">
                  <Kv k="Skins won" v={skinsText(st.skins.won)} />
                  <Kv k="Most in a round" v={st.skins.best ? `${skinsText(st.skins.best.skins)} · ${st.skins.best.course || shortDay(st.skins.best.at)}` : '–'} />
                  {st.skins.dollars.rounds > 0 && <Kv k="Your skins brought in" v={money(st.skins.dollars.net)} />}
                </div>
              </>
            )}

            {st.biggest.length > 0 && (
              <>
                <div className="sec-label">Biggest wins</div>
                <div className="block stats-wins">
                  {st.biggest.map(w => (
                    <button key={w.id} className="hist-row" onClick={() => nav.push('roundDetail', { id: w.id })}
                      aria-label={`${w.course || 'A round'}, ${w.game}, ${shortDay(w.at)}. You won ${money(w.amount)}${w.lunch ? ` on side bets in a round played for ${w.reward}` : ''}`}>
                      <span className="hr-day">{shortDay(w.at)}</span>
                      <span className="hr-main">
                        <span className="hr-course">{w.course || 'A round'}</span>
                        <span className="hr-game">{w.lunch ? 'Side bets' : w.game}</span>
                      </span>
                      <span className="hr-end"><span className="hr-amt pos">{money(w.amount, { sign: true })}</span></span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="field-help pad stats-foot"><Icon name={privacy.profile === 'hidden' ? 'lock-simple' : 'users-three'} fill /> {statsShareLine(privacy)} {moneyNote(st)}</p>
          </>
        )}
      </div>
    </Screen>
  );
}

/** Your handicap guide from your own rounds, next to the official index you entered. */
function Trend({ trend }) {
  const { guide, official, needed, used, byPar, points } = trend;
  const vs = trendVsOfficial(guide, official);
  return (
    <>
      <div className="sec-label">Handicap trend</div>
      {guide == null ? (
        <div className="block trend-empty">
          <p className="trend-empty-t">Your trend needs {needed} more round{needed === 1 ? '' : 's'}</p>
          <p className="field-help">{trendEmptyText(needed)}</p>
        </div>
      ) : (
        <div className="chart-card trend-card">
          <div className="cc-head">
            <div>
              <div className="eyebrow">From your rounds</div>
              <div className="cc-big">{formatIndex(guide)}</div>
            </div>
            <div className="trend-official">
              <div className="eyebrow">Official index</div>
              <div className="trend-official-v d">{formatIndex(official)}</div>
            </div>
          </div>
          {vs && <div className="cc-meta trend-vs">{vs}</div>}
          <TrendChart points={points} official={official} />
        </div>
      )}
      <p className="field-help pad">
        {TREND_LABEL}. {guide == null ? 'Your official index comes from GHIN or your club.' : `Your best rounds of the last ${used}, the way official handicaps count them, each hole capped at net double bogey.${byPar ? ` ${byPar === 1 ? 'One round was' : `${byPar} rounds were`} on a tee with no rating, so it goes by par.` : ''}`}
        {official == null && guide != null ? ' Add your official index on your profile to see them side by side.' : ''}
      </p>
    </>
  );
}

/** Why the range is empty, in the words History uses. */
function emptyText(range, label) {
  if (range.kind === 'all') return 'Your stats show up after your first finished round.';
  if (range.kind === 'custom') return 'You didn’t finish a round between those dates. Try a wider range.';
  return `You didn’t finish a round in ${range.kind === 'season' ? `the ${label}` : label}. Try another ${range.kind}.`;
}

const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const recordLine = r => `${r.won} won, ${r.lost} lost${r.even ? `, ${r.even} even` : ''}`;

/** What the dollars are, honestly. */
function moneyNote(st) {
  const lunch = st.lunchDollars ? ' and side bets for money in rounds played for a reward, like lunch' : '';
  const pts = st.points.rounds ? ' Rounds for points or a reward count in points, never dollars.' : '';
  return `Dollars come from rounds played for money${lunch}.${pts} Won and lost go by each game’s own result.`;
}

function Tile({ label, value, sub, tone: t = '' }) {
  return (
    <div className="pf-tile">
      <div className="eyebrow">{label}</div>
      <div className={`pf-v d ${t}`}>{value}</div>
      {sub && <div className="st-s">{sub}</div>}
    </div>
  );
}

const Kv = ({ k, v }) => (
  <div className="kv-row"><span className="kv-k">{k}</span><span className="kv-v">{v}</span></div>
);

/** One row a game or course: its name and record on the left, its money (or points) on the right. */
function Lines({ lines, label, place = false }) {
  return (
    <ul className="block stats-lines" aria-label={label}>
      {lines.map(l => {
        const amt = lineAmount(l, FMT);
        return (
          <li key={l.key} className="stats-line">
            <span className="row-main">
              <span className="sl-name">{l.name}{place && l.place ? <span className="sl-place"> · {l.place}</span> : null}</span>
              <span className="sl-sub">{lineSub(l, FMT)}</span>
            </span>
            <span className={`sl-amt d ${amt.tone}`}>{amt.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
