// One honest sentence for each data screen (the Tab, Your stats, the handicap trend, a crew's hall
// of fame), the way Oura's "Trend detected" row reads: a direction, a short label and one plain
// line under it. Each is a pure function of numbers the screen already has, so it never invents a
// stat; under a few rounds it says so quietly instead of guessing. Display only: nothing here
// touches the money maths.
//
// Every insight is { kind, label, text } and the Tab's adds a `headline` for its hero:
//   kind   'up' | 'down' | 'flat' | 'wait' (which picks the arrow and its colour)
//   label  a few words in caps over the sentence ("Trending up")
//   text   one sentence
import { money } from './golf.js';
import { bestOf } from './deep-stats.js';
import { trendVsOfficial } from './hc-trend.js';
import { formatIndex } from './format.js';

/** Rounds before an insight says anything about a direction. */
export const INSIGHT_MIN = 3;
const EPS = 0.004;
const WORDS = ['no', 'one', 'two', 'three'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const cents = v => Math.round(v * 100) / 100;
const tenth = v => Math.round(v * 10) / 10;
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);

/** "Three more rounds and this starts to mean something." */
export function waitText(have, need = INSIGHT_MIN) {
  const n = Math.max(1, need - have);
  const word = WORDS[n] || String(n);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} more round${n === 1 ? '' : 's'} and this starts to mean something.`;
}

const wait = (have, extra = {}) => ({ kind: 'wait', label: 'Early days', text: waitText(have), ...extra });

/**
 * The Tab: where your net has gone over the last few rounds against the whole run. `series` is
 * netSeries() (history.js), oldest first, each point's `total` your running net. `scope` names the
 * run in the words ("this season", "overall").
 */
export function tabInsight(series, { window = 6, scope = 'this season' } = {}) {
  const n = series.length;
  const end = n ? series.at(-1).total : 0;
  const headline = !n ? 'Nothing on the line yet.' : end > EPS ? `Up ${scope}.` : end < -EPS ? `Down ${scope}.` : `Square ${scope}.`;
  if (n < INSIGHT_MIN) return wait(n, { headline });
  const k = Math.min(window, n);
  const from = k === n ? 0 : series[n - k - 1].total;
  const change = cents(end - from);
  const avg = series.reduce((a, p) => a + p.total, 0) / n;
  const vsAvg = end > avg + EPS ? 'above' : end < avg - EPS ? 'below' : 'level with';
  const span = `over the last ${plural(k, 'round')}`;
  if (change > EPS) {
    return { kind: 'up', label: 'Trending up', headline, text: `Your net has climbed ${money(change)} ${span} and is ${vsAvg} your ${scope === 'overall' ? 'overall' : 'season'} average.` };
  }
  if (change < -EPS) {
    const tail = vsAvg === 'above' ? 'but is still above' : `and is ${vsAvg}`;
    return { kind: 'down', label: 'Trending down', headline, text: `Your net has slipped ${money(-change)} ${span} ${tail} your ${scope === 'overall' ? 'overall' : 'season'} average.` };
  }
  return { kind: 'flat', label: 'Holding steady', headline, text: `Your net hasn’t moved ${span}.` };
}

/**
 * Your stats: your record over the range, and the game that's gone best (deep-stats.js bestOf).
 * `st` is deepStats().
 */
export function statsInsight(st) {
  if (st.rounds < INSIGHT_MIN) return wait(st.rounds);
  const r = st.record;
  const played = r.won + r.lost + r.even;
  if (!played) return { kind: 'wait', label: 'Early days', text: `${plural(st.rounds, 'round')} played, none with a result of your own yet.` };
  const best = bestOf(st.games);
  const rec = l => (l.record.even ? [l.record.won, l.record.lost, l.record.even] : [l.record.won, l.record.lost]).join('–');
  const bestLine = best
    ? `${best.line.name} has been your best game, ${best.by === 'dollars' ? money(best.line.dollars.net, { sign: true }) : rec(best.line)} over ${plural(best.line.rounds, 'round')}`
    : null;
  if (r.won > r.lost) return { kind: 'up', label: 'Winning record', text: `You’ve won ${r.won} of ${plural(played, 'round')}${bestLine ? `, and ${bestLine}` : ''}.` };
  if (r.won < r.lost) return { kind: 'down', label: 'Losing record', text: `You’ve lost ${r.lost} of ${plural(played, 'round')}${bestLine ? `, but ${bestLine}` : ''}.` };
  return { kind: 'flat', label: 'Even record', text: `You’ve won ${r.won} and lost ${r.lost} of ${plural(played, 'round')}${bestLine ? `, and ${bestLine}` : ''}.` };
}

/**
 * The handicap trend: which way your guide has gone over the last few rounds, and how it sits
 * against the official index (hc-trend.js trendVsOfficial). `trend` is handicapTrend().
 */
export function trendInsight(trend, { window = 5 } = {}) {
  const pts = (trend.points || []).filter(p => p.guide != null);
  if (trend.guide == null || !pts.length) return wait(trend.rounds || 0);
  const vs = trendVsOfficial(trend.guide, trend.official);
  const tail = vs ? `, and it’s ${lower(vs)}` : '';
  if (pts.length < 2) return { kind: 'flat', label: 'First guide', text: `Your first guide is ${formatIndex(trend.guide)}${tail}.` };
  const k = Math.min(window, pts.length - 1);
  const change = tenth(trend.guide - pts[pts.length - 1 - k].guide);
  const span = `over the last ${plural(k, 'round')}`;
  // A lower guide is the better way to go, so coming down is the up arrow; under three tenths is noise
  if (change <= -0.3) return { kind: 'up', label: 'Coming down', text: `Your guide has come down ${Math.abs(change).toFixed(1)} ${span}${tail}.` };
  if (change >= 0.3) return { kind: 'down', label: 'Slipping', text: `Your guide has gone up ${change.toFixed(1)} ${span}${tail}.` };
  return { kind: 'flat', label: 'Holding steady', text: `Your guide has held at about ${formatIndex(trend.guide)} ${span}${tail}.` };
}

/**
 * A crew's hall of fame: who leads the money list and by how much, and who's climbed the most over
 * the last few rounds. `season` is crewSeason() and `movers` recentMovers() (hall-of-fame.js);
 * `me` is your id on the list and `name(id)` a first name.
 */
export function hallInsight(season, movers = { rounds: 0, rows: [] }, { me = null, name = String } = {}) {
  if (season.rounds < INSIGHT_MIN) return wait(season.rounds);
  const [lead, second] = season.money;
  if (!season.champion || !lead) return { kind: 'flat', label: 'All level', text: `Nobody is up after ${plural(season.rounds, 'round')}.` };
  const who = id => (id === me ? 'You' : name(id));
  const verb = (id, one, many) => (id === me ? many : one);
  const gap = second ? lead.cents - second.cents : lead.cents;
  let text = second && gap > 0
    ? `${who(lead.id)} ${verb(lead.id, 'leads', 'lead')} ${second.id === me ? 'you' : name(second.id)} by ${money(gap / 100)}`
    : second
      ? `${who(lead.id)} and ${second.id === me ? 'you' : name(second.id)} are level at the top`
      : `${who(lead.id)} ${verb(lead.id, 'has', 'have')} the list to ${verb(lead.id, 'themselves', 'yourself')} at ${money(lead.cents / 100, { sign: true })}`;
  const mover = movers.rows.find(m => m.cents > 0);
  if (mover && movers.rounds) {
    const climb = `${money(mover.cents / 100, { sign: true })} over the last ${plural(movers.rounds, 'round')}`;
    text += mover.id === lead.id ? `, still climbing at ${climb}` : `, and ${mover.id === me ? 'you' : name(mover.id)} ${verb(mover.id, 'has', 'have')} climbed the most, ${climb}`;
  }
  text += '.';
  if (lead.id === me) return { kind: 'up', label: 'In front', text };
  if (mover && mover.id === me) return { kind: 'up', label: 'Climbing', text };
  if (season.money.some(r => r.id === me)) return { kind: 'down', label: 'Chasing', text };
  return { kind: 'flat', label: 'The season so far', text };
}
