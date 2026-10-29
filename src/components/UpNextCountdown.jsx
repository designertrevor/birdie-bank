// The countdown strip on Up next (Layout Lab E, Formula 1 style): a thin ticking clock to the next
// planned round, so every open between rounds builds a little Saturday anticipation. Only with a
// round ahead you haven't said you're out of (nextPlan in upnext-first.js): no plan, no clock.
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';
import { GAMES } from '../lib/round.js';
import { planChoice } from '../lib/plan-basics.js';
import { weekdayOf } from '../lib/countdown.js';
import { daysUntil } from '../lib/plan-basics.js';
import { nextPlan, stripClock } from '../lib/upnext-first.js';

/** The strip for the first of `plans` still ahead, or nothing. Ticks once a minute. */
export function CountdownStrip({ plans }) {
  const nav = useNav();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const plan = nextPlan(plans, now);
  const clock = plan && stripClock(plan, now);
  if (!clock) return null;
  const { game } = planChoice(plan);
  // Today's round says Today, like its card, rather than today's weekday (home-11)
  const until = daysUntil(plan.date);
  const day = until === 0 ? 'Today' : until === 1 ? 'Tomorrow' : weekdayOf(plan).slice(0, 3);
  const name = GAMES[game]?.name || 'Golf';
  const said = clock.words || clock.parts.map(([n, u]) => `${Number(n)} ${{ d: 'days', h: 'hours', m: 'minutes' }[u]}`).join(', ');
  return (
    <button className="un-strip" onClick={() => nav.push('plan', { id: plan.id })} aria-label={`${name} ${until === 0 ? 'today' : until === 1 ? 'tomorrow' : `on ${weekdayOf(plan)}`}: ${said} to go`}>
      <Icon name="flag-pennant" fill className="un-strip-ic" />
      <span className="un-strip-what">{name} · {day}</span>
      <span className="un-strip-clock" aria-hidden="true">
        {clock.words || clock.parts.map(([n, u]) => <span key={u} className="un-strip-unit">{n}<small>{u}</small></span>)}
      </span>
    </button>
  );
}
