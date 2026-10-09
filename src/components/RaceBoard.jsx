// The reveal's leaderboard as a race (lib/race.js): the rows line up in the round's order, every
// total counts up from zero, and the rows slide past each other as the totals pass, each Ball buddy
// riding its row, so the winner climbs to the top as the last total lands and takes the crown.
// Skipping, coming back, or reduced motion shows the final board straight away.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AvatarArt } from './Avatar.jsx';
import { Crown } from './Podium.jsx';
import { movedUp, racePlan, raceFrame } from '../lib/race.js';

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Milliseconds since the board appeared, every frame from the first total's turn until the race is
 * over (nothing moves before, while the bets resolve); Infinity once it is.
 */
function useRaceClock(first, end, still) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (still) return;
    const t0 = performance.now();
    let raf;
    const tick = now => {
      const el = now - t0;
      setT(el >= end ? Infinity : el);
      if (el < end) raf = requestAnimationFrame(tick);
    };
    const go = setTimeout(() => { raf = requestAnimationFrame(tick); }, Math.max(0, first - 20));
    // No animation frames (low-power mode, a background tab, a screenshot tool): land anyway
    const land = setTimeout(() => { cancelAnimationFrame(raf); setT(Infinity); }, end + 400);
    return () => { clearTimeout(go); cancelAnimationFrame(raf); clearTimeout(land); };
  }, [first, end, still]);
  return still ? Infinity : t;
}

/**
 * Slides the rows to their new places when the order changes (first, last, invert, play). Rows are
 * measured against the top of the board, so the bets card tightening above never reads as a move,
 * and a row already sliding carries on from where it is. A row that passed someone rides above the
 * others and its buddy gives a little hop.
 */
function useRaceFlip(scroller, order) {
  const last = useRef(null);
  const key = order.join('|');
  useLayoutEffect(() => {
    const rows = [...(scroller.current?.querySelectorAll('.reveal-row[data-race]') || [])];
    const tops = new Map(rows.map(el => [el.dataset.race, el.offsetTop]));
    const base = Math.min(...tops.values());
    const prev = last.current;
    last.current = { key, tops, base, order, anims: prev?.anims || new Map() };
    if (!prev || prev.key === key || reducedMotion() || !rows[0]?.animate) return;
    const anims = last.current.anims;
    const up = new Set(movedUp(prev.order, order));
    for (const el of rows) {
      const id = el.dataset.race;
      if (!prev.tops.has(id)) continue;
      const running = anims.get(id);
      let carry = 0;
      if (running?.playState === 'running') {
        carry = running.from * (1 - (running.effect.getComputedTiming().progress ?? 1));
        running.cancel();
      }
      const dy = prev.tops.get(id) - prev.base + carry - (tops.get(id) - base);
      if (Math.abs(dy) < 1) continue;
      const a = el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      a.from = dy;
      anims.set(id, a);
      if (up.has(id)) {
        // Above the rows it passes (React never sets z-index here, so a re-render leaves it be)
        el.style.zIndex = '2';
        const off = () => { el.style.zIndex = ''; };
        a.onfinish = off;
        a.oncancel = off;
        el.querySelector('.rv-av-wrap')?.animate(
          [{ transform: 'none' }, { transform: 'translateY(-7px) rotate(-8deg)', offset: 0.4 }, { transform: 'none' }],
          { duration: 380, easing: 'ease-out' },
        );
      }
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The board. `standings` is res.standings (where it ends), `start` the ids in the round's order,
 * `timing` revealTiming's. `crowned` lists who takes the crown when the last total lands.
 * `skip` jumps to the end. `faces`, `me`, `fmt` and `gamesFor(id)` draw each row as before.
 */
export function RaceBoard({ scroller, standings, start, timing, skip, faces, me, fmt, gamesFor, crowned = [] }) {
  const startKey = start.join('|');
  const plan = useMemo(() => racePlan(standings, { start: startKey.split('|'), stepsEnd: timing.stepsEnd, stagger: timing.stagger, count: timing.count }),
    [standings, startKey, timing.stepsEnd, timing.stagger, timing.count]);
  const still = skip || reducedMotion();
  const first = plan.lanes.reduce((m, l) => Math.min(m, l.delay), Infinity);
  const t = useRaceClock(Number.isFinite(first) ? first : 0, plan.end, still);
  const frame = raceFrame(plan, t);
  useRaceFlip(scroller, frame.order);
  const byId = useMemo(() => new Map(standings.map((p, i) => [p.id, { ...p, i }])), [standings]);
  const lane = useMemo(() => new Map(plan.lanes.map(l => [l.id, l])), [plan]);
  return frame.order.map(id => {
    const p = byId.get(id);
    const row = frame.rows[id];
    const done = row.phase === 'done';
    const finalPlace = 1 + standings.filter(q => q.amount > p.amount).length;
    // Motion hooks: the phase dims the number until its turn, then pops it when it lands
    const motion = `${row.phase}${done && p.amount !== 0 ? ' landed' : ''}`;
    const crown = frame.done && crowned.includes(id);
    const face = faces.get(id);
    const games = gamesFor(id);
    return (
      <div key={id} data-race={id} className={`reveal-row ${finalPlace === 1 && p.amount > 0 && done ? 'top' : ''}`} style={{ '--i': lane.get(id).start }}>
        {/* The place as it stands; an en dash until that total starts to count */}
        <div className="sr">{row.place ?? '–'}</div>
        {face && (
          <span className={`rv-av-wrap ${row.phase === 'count' ? 'racing' : ''}`}>
            {crown && <Crown className="crown-art rv-row-crown" />}
            <AvatarArt model={face} size="sm" className="rv-av" />
          </span>
        )}
        <div className="sn">{p.name}{id === me ? ' (you)' : ''}{games && <span className="rv-games">{games}</span>}</div>
        {/* Whole numbers while counting, then the exact amount: $2.50 used to land on "+$3" */}
        <div className={`reveal-amt ${motion} ${done && p.amount > 0 ? 'pos' : done && p.amount < 0 ? 'neg' : ''}`}>{fmt(row.shown, { sign: true })}</div>
      </div>
    );
  });
}
