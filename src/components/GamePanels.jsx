// Per-game panels shown above the score rows while playing.
import { useEffect, useState } from 'react';
import { Icon, useUI } from './ui.jsx';
import { update, uid } from '../lib/store.js';
import {
  hammerOptions, hammerTable, holeAtPos, holeComplete, nassauAmounts, nassauPressOptions, nassauWinners, playersOn, pointsTable, pressMode, rabbitTable,
  roundLegs, sideNames, sides, sixesMatches, snakeTable, totalsTable, vegasPreview, vegasTable, scorers, netFor, playsHole, posOf, settingsAt, teamTable,
  POT_NONE, potHoles, potTable, greenieCarryBefore,
} from '../lib/round.js';
import { nassauBets } from '../lib/golf.js';
import { DOT_KINDS, DOT_PARS, scoreDots } from '../lib/games.js';
import { buzz } from '../lib/delight.js';
import { unitFmt } from '../lib/play-for.js';

const firstName = n => (n || '').split(' ')[0];
const nameOf = (round, pid) => round.players.find(p => p.id === pid)?.name || '?';

// --------------------------- Nassau & match play ---------------------------

/** `readOnly`: a phone that isn't keeping score sees the match but can't press. */
// Each round's match scores as last shown, so a tile can pop when the score moves
const TILE_SEEN = new Map();
export function MatchPanel({ round, hole, readOnly = false }) {
  const { showToast } = useUI();
  const winners = nassauWinners(round);
  const LEGS = roundLegs(round);
  const legs = Object.keys(LEGS);
  // Three legs (a Nassau, or a team game bet like one) name the leg in presses and toasts
  const multi = legs.length > 1;
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const bets = nassauBets(winners, round.presses, nassauAmounts(round), LEGS);
  const names = sideNames(round);
  // One match fills the row, so it says the leader's name; Nassau's three tiles use a letter
  const short = names.map((n, i) => (round.teams ? ['A', 'B'][i] : round.game === 'match' ? n.split(' ')[0] : n.charAt(0).toUpperCase()));
  // Pop a tile when its score moved since this phone last showed it (the hole screen remounts on every save)
  const vals = legs.map(leg => { const s = bets.find(x => x.key === leg).status; return `${s.leader}:${s.by}`; });
  const [popped] = useState(() => { const was = TILE_SEEN.get(round.id); return was ? legs.filter((leg, i) => was[i] !== vals[i]) : []; });
  useEffect(() => { TILE_SEEN.set(round.id, vals); });
  // Manual presses, and the press at the turn when presses are off (auto presses are made on saving)
  const options = !readOnly && pressMode(round) !== 'auto' && !holeComplete(round, hole) ? nassauPressOptions(round, pos) : [];
  const activePresses = bets.filter(b => b.press && pos >= b.start && pos <= b.end);
  const press = o => {
    update(s => { const r = s.rounds[round.id]; r.presses.push({ id: uid('pr_'), leg: o.leg, start: pos, by: o.trailing }); });
    showToast(`${names[o.trailing]} pressed${multi ? ` the ${LEGS[o.leg].label.toLowerCase()}` : ''}!`);
    buzz(30);
  };
  const tile = leg => {
    const b = bets.find(x => x.key === leg);
    const s = b.status;
    const notStarted = pos < b.start && s.played === 0;
    const val = notStarted ? '–' : s.leader === null ? 'All square' : `${short[s.leader]} ${s.by} up`;
    const sub = notStarted ? `Starts H${holeAtPos(round, b.start)}` : s.left === 0 ? 'Final' : s.closed ? `Won ${s.by}&${s.left}` : s.dormie ? 'Dormie · can’t lose' : `${s.left} left`;
    // Dormie: up by as many holes as are left, so the leader can't lose (a tie at worst)
    const spoken = notStarted ? 'not started' : s.leader === null ? 'all square' : `${names[s.leader]} ${s.by} up`;
    const said = s.dormie && !s.closed && s.left > 0
      ? `${LEGS[leg].label}: ${spoken}, dormie. ${names[s.leader]} is up by as many holes as are left, so ${names[s.leader]} can’t lose it.`
      : `${LEGS[leg].label}: ${spoken}, ${sub}`;
    return (
      <div key={leg} role="group" aria-label={said} className={`ms-tile ${s.leader === 0 ? 'ahead' : s.leader === 1 ? 'behind' : ''} ${legs.length === 1 ? 'solo' : ''}`}>
        <span className="ms-lbl">{LEGS[leg].label}</span><span key={popped.includes(leg) ? val : 'same'} className={`ms-val ${val === 'All square' ? 'sq' : ''} ${popped.includes(leg) ? 'moved' : ''}`}>{val}</span><span className="ms-sub">{sub}</span>
      </div>
    );
  };
  return (
    <>
      {round.teams && <div className="sides-line"><span className="side-tag a">A</span> {names[0]} <span className="sides-v">v</span> <span className="side-tag b">B</span> {names[1]}</div>}
      <div className="match-status">{legs.map(tile)}</div>
      {activePresses.length > 0 && (
        <div className="press-bar">
          <span className="press-bar-lbl">Presses</span>
          {activePresses.map(p => (
            <span key={p.key} className="press-chip">{multi ? `${LEGS[p.leg].label} ` : ''}from H{holeAtPos(round, p.start)}: {p.status.leader === null ? 'All square' : `${short[p.status.leader]} ${p.status.by} up`}</span>
          ))}
        </div>
      )}
      {options.length > 0 && (
        <div className="press-alert">
          {options.map(o => (
            <div key={o.leg} className="press-alert-row">
              <span className="press-alert-txt">{o.turn
                ? `${names[o.trailing]} lost the ${LEGS.front.label.toLowerCase()}. Press the ${LEGS.back.label.toLowerCase()}?`
                : `${names[o.trailing]} ${sides(round)[o.trailing].length > 1 ? 'are' : 'is'} ${o.by} down${multi ? ` on the ${LEGS[o.leg].label.toLowerCase()}` : ''}`}</span>
              <button className="press-call-btn" onClick={() => press(o)}>Press <Icon name="lightning" fill /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --------------------------- Team games ------------------------------------

/**
 * A team game played as stroke play (a tile a leg: who's ahead and each team to par) or per hole (holes
 * won by each team and what it's worth). Played as a match it uses MatchPanel, presses and all.
 */
export function TeamPanel({ round, hole }) {
  const money = unitFmt(round); // points in a points or reward round
  const t = teamTable(round);
  const names = sideNames(round);
  const pos = posOf(round, hole);
  const sideLine = <div className="sides-line"><span className="side-tag a">A</span> {names[0]} <span className="sides-v">v</span> <span className="side-tag b">B</span> {names[1]}</div>;
  if (t.format === 'hole') {
    const line = t.lines[0];
    const each = Math.abs(line.value);
    return (
      <div className="vegas-panel">
        <div className="vegas-teams">
          {[0, 1].map(i => (
            <div key={i} className={`vegas-team ${line.won[i] > line.won[1 - i] ? 'ahead' : line.won[i] < line.won[1 - i] ? 'behind' : ''}`}>
              <div className="ms-lbl"><span className={`side-tag ${i ? 'b' : 'a'}`}>{i ? 'B' : 'A'}</span> {names[i]}</div>
              <div className="ms-val">{line.won[i]}</div>
            </div>
          ))}
        </div>
        <div className="vegas-line">
          <span>Holes won · {money(settingsAt(round, pos)[round.game]?.perHole ?? line.amount)} a hole</span>
          <span className="vegas-total">{!line.value ? 'All square' : `${names[line.value > 0 ? 0 : 1]} up ${money(each)} each`}</span>
        </div>
      </div>
    );
  }
  // Stroke play: each leg's team totals, to par on the holes both teams have played
  const fmt = v => (v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`);
  const tile = l => {
    const s = l.status;
    const part = t.rows.filter(r => r.pos >= l.start && r.pos <= l.end && r.winner !== undefined);
    const par = part.reduce((a, r) => a + r.hole.par * t.count, 0);
    const notStarted = pos < l.start && !s.played;
    const val = notStarted ? '–' : s.leader === null ? (s.played ? 'Level' : '–') : `${s.leader ? 'B' : 'A'} by ${s.by}`;
    const sub = notStarted ? `Starts H${holeAtPos(round, l.start)}` : s.played ? `A ${fmt(s.totals[0] - par)} · B ${fmt(s.totals[1] - par)}${s.left === 0 ? ' · Final' : ''}` : 'No holes yet';
    const said = `${l.label}: ${notStarted ? 'not started' : s.leader === null ? 'level' : `${names[s.leader]} ahead by ${s.by}`}. ${sub}`;
    return (
      <div key={l.key} role="group" aria-label={said} className={`ms-tile ${s.leader === 0 ? 'ahead' : s.leader === 1 ? 'behind' : ''} ${t.lines.length === 1 ? 'solo' : ''}`}>
        <span className="ms-lbl">{l.label}</span><span className={`ms-val ${val === 'Level' ? 'sq' : ''}`}>{val}</span><span className="ms-sub">{sub}</span>
      </div>
    );
  };
  return (
    <>
      {sideLine}
      <div className="match-status">{t.lines.map(tile)}</div>
    </>
  );
}

// --------------------------- Vegas ----------------------------------------

export function VegasPanel({ round, hole, draft, touched }) {
  const money = unitFmt(round); // points in a points or reward round
  const rows = vegasTable(round);
  const teams = round.teams || [];
  const point = round.settings.vegas.point;
  const total = rows.filter(r => r.played).reduce((a, r) => a + r.diff, 0);
  const ready = teams.every(t => t.players.every(pid => touched[pid]));
  const pv = ready ? vegasPreview(round, hole, draft) : null;
  return (
    <div className="vegas-panel">
      <div className="vegas-teams">
        {teams.map((t, i) => (
          <div key={t.id} className={`vegas-team ${(i === 0 ? total : -total) > 0 ? 'ahead' : (i === 0 ? total : -total) < 0 ? 'behind' : ''}`}>
            <span className="ms-lbl"><span className={`side-tag ${i === 0 ? 'a' : 'b'}`}>{['A', 'B'][i]}</span> {t.name}</span>
            <span className="ms-val">{pv ? pv.numbers[i] : '–'}</span>
            <span className="ms-sub">{pv?.flipped[i] ? 'Flipped by a birdie' : pv?.high?.[i] ? 'No par: high number first' : pv ? 'This hole' : 'Enter scores'}</span>
          </div>
        ))}
      </div>
      <div className="vegas-line">
        {pv ? (pv.diff === 0 ? 'Push. No points this hole' : `${pv.diff > 0 ? teams[0].name : teams[1].name} take${round.teams ? '' : 's'} ${Math.abs(pv.diff)} point${Math.abs(pv.diff) === 1 ? '' : 's'}${pv.mult > 1 ? ` (${pv.mult === 3 ? 'eagle' : 'birdie'} ${pv.mult}×)` : ''} · ${money(Math.abs(pv.diff) * point)} each`) : 'Low score first, high second: 4 and 5 make 45'}
        <span className="vegas-total">{total === 0 ? 'All square' : `${total > 0 ? teams[0].name : teams[1].name} +${Math.abs(total)} · ${money(Math.abs(total) * point)}`}</span>
      </div>
    </div>
  );
}

// --------------------------- Sixes ----------------------------------------

export function SixesPanel({ round, hole }) {
  const matches = sixesMatches(round);
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const cur = matches.find(m => pos >= m.seg.start && pos <= m.seg.end);
  const pair = side => side.map(pid => firstName(nameOf(round, pid))).join(' & ');
  return (
    <>
      {cur && <div className="sides-line"><Icon name="arrows-clockwise" fill /> Match {cur.index + 1} · <strong>{pair(cur.sides[0])}</strong> <span className="sides-v">v</span> <strong>{pair(cur.sides[1])}</strong></div>}
      <div className="match-status">
        {matches.map(m => {
          const s = m.status;
          const notStarted = pos < m.seg.start && s.played === 0;
          const lead = s.leader === null ? null : pair(m.sides[s.leader]);
          const val = m.off || notStarted ? '–' : s.leader === null ? 'All square' : `${s.by} up`;
          const sub = m.off ? 'Off: a player left' : notStarted ?`H${holeAtPos(round, m.seg.start)}–${holeAtPos(round, m.seg.end)}` : s.left === 0 ? (lead ? `${lead}` : 'Halved') : s.closed ? `${lead} won` : lead ? `${lead} · ${s.left} left` : `${s.left} left`;
          return (
            <div key={m.index} className={`ms-tile ${m === cur ? 'cur' : ''} ${s.leader != null && s.played ? 'ahead' : ''}`}>
              <span className="ms-lbl">Match {m.index + 1}</span><span className={`ms-val ${val === 'All square' ? 'sq' : ''}`}>{val}</span><span className="ms-sub">{sub}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// --------------------------- Totals & points -------------------------------

export function ChipsPanel({ icon, label, items, color = 'var(--lav)' }) {
  return (
    <div className="banker-bar" style={{ background: color }}>
      <div><div className="bl">{label}</div><div className="bn"><Icon name={icon} fill /> {items[0]?.lead || 'Even'}</div></div>
      <div className="skin-counts">{items.map(it => <span key={it.id} className="press-chip">{it.name} {it.value}</span>)}</div>
    </div>
  );
}

export function TotalsPanel({ round }) {
  const t = totalsTable(round);
  const played = Math.max(0, ...t.map(x => x.played));
  const lowerWins = round.game === 'stroke';
  // To par with a real minus sign, as the rest of the app writes it
  const fmt = x => (round.game === 'stroke' ? (x.toPar === 0 ? 'E' : x.toPar > 0 ? `+${x.toPar}` : `−${-x.toPar}`) : round.game === 'quota' ? `${x.total}/${x.quota}` : `${x.total}`);
  const sorted = [...t].sort((a, b) => (lowerWins ? a.total - b.total : (round.game === 'quota' ? b.vsQuota - a.vsQuota : b.total - a.total)));
  const label = { stroke: 'Net to par', stableford: 'Stableford points', quota: 'Points / quota' }[round.game];
  // Everyone level with the leader is tied for it, never "Sam leads" over two others on the same score
  const key = x => (round.game === 'quota' ? x.vsQuota : x.total);
  const tied = played ? sorted.filter(x => key(x) === key(sorted[0])) : [];
  const lead = !played ? 'Nobody’s ahead yet' : tied.length === sorted.length ? 'All level' : tied.length > 1 ? `${tied.length} tied for the lead` : `${firstName(sorted[0].name)} leads`;
  return <ChipsPanel icon={round.game === 'stroke' ? 'list-numbers' : round.game === 'quota' ? 'target' : 'star'} label={`${label} · ${played} hole${played === 1 ? '' : 's'}`} items={sorted.map((x, i) => ({ id: x.id, name: firstName(x.name), value: fmt(x), lead: i === 0 ? lead : null }))} />;
}

/**
 * Scramble pays the whole pot to the lowest net total, so the money only moves when the lead changes.
 * Show each team's net to par so a birdie that doesn't move the money still shows up somewhere.
 */
export function ScramblePanel({ round }) {
  const teams = scorers(round).map(t => {
    const holes = round.holes.filter(h => holeComplete(round, h) && t.players.some(pid => playsHole(round, pid, h)));
    const toPar = holes.reduce((a, h) => a + netFor(round, t, h) - h.par, 0);
    return { id: t.id, name: t.name, toPar, played: holes.length };
  }).sort((a, b) => a.toPar - b.toPar);
  const played = Math.max(0, ...teams.map(t => t.played));
  const fmt = v => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));
  const gap = teams.length > 1 ? teams[1].toPar - teams[0].toPar : 0;
  const lead = !played ? 'Nobody’s ahead yet' : gap === 0 ? 'Tied at the top' : `${teams[0].name} lead by ${gap}`;
  return <ChipsPanel icon="list-numbers" label={`Net to par · low team wins · ${played} hole${played === 1 ? '' : 's'}`} items={teams.map((t, i) => ({ id: t.id, name: t.name, value: fmt(t.toPar), lead: i === 0 ? lead : null }))} />;
}

export function PointsPanel({ round }) {
  const rows = pointsTable(round);
  const pts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  for (const r of rows) for (const p of round.players) pts[p.id] += r.points[p.id] || 0;
  const sorted = [...round.players].sort((a, b) => pts[b.id] - pts[a.id]);
  const label = { nines: '5-3-1 points', bbb: 'Points so far', dots: 'Dots so far' }[round.game];
  const lead = rows.length ? (pts[sorted[0].id] === pts[sorted[1]?.id] ? 'Tied at the top' : `${firstName(sorted[0].name)} leads`) : 'Nobody’s ahead yet';
  return <ChipsPanel icon={{ nines: 'number-circle-nine', bbb: 'confetti', dots: 'medal' }[round.game]} label={label} items={sorted.map((p, i) => ({ id: p.id, name: firstName(p.name), value: pts[p.id], lead: i === 0 ? lead : null }))} />;
}

export function MoneyPanel({ round, results, icon, label }) {
  const money = unitFmt(round); // points in a points or reward round
  const sorted = [...round.players].sort((a, b) => results.balances[b.id] - results.balances[a.id]);
  const any = sorted.some(p => results.balances[p.id] !== 0);
  return <ChipsPanel icon={icon} label={label} items={sorted.map((p, i) => ({ id: p.id, name: firstName(p.name), value: money(results.balances[p.id], { sign: true }), lead: i === 0 ? (any ? `${firstName(p.name)} up` : 'All square') : null }))} />;
}

// --------------------------- Rabbit ---------------------------------------

export function RabbitPanel({ round, hole }) {
  const t = rabbitTable(round);
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const leg = t.legs.find(l => pos >= l.seg.start && pos <= l.seg.end) || t.legs[0];
  const holder = leg?.holder;
  const won = t.legs.filter(l => l.done && l.pays);
  return (
    <div className="banker-bar" style={{ background: 'var(--lav)' }}>
      <div>
        <div className="bl">{leg?.seg.label} · ends H{holeAtPos(round, leg?.seg.end)}</div>
        <div className="bn"><Icon name="rabbit" fill /> {holder ? `${nameOf(round, holder)} has the rabbit` : 'The rabbit is loose'}</div>
      </div>
      <div className="skin-counts">
        {won.map(l => <span key={l.seg.label} className="press-chip">{l.seg.label}: {firstName(nameOf(round, l.holder))}</span>)}
      </div>
    </div>
  );
}

// --------------------------- Snake ----------------------------------------

/** Who has the snake, counting the three-putts tapped on this hole so far. */
export function SnakePanel({ round, hole, marks }) {
  const money = unitFmt(round); // points in a points or reward round
  const t = snakeTable(marks ? { ...round, marks: { ...round.marks, [hole.no]: marks } } : round);
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const leg = t.legs.find(l => pos >= l.seg.start && pos <= l.seg.end) || t.legs[0];
  const done = t.legs.filter(l => l.done && l !== leg && l.holder);
  return (
    <div className="banker-bar" style={{ background: 'var(--lav)' }}>
      <div>
        <div className="bl">{t.legs.length > 1 ? `${leg.seg.label} · ` : ''}{leg.count ? `${leg.count} three-putt${leg.count === 1 ? '' : 's'} · worth ${money(leg.value)}` : 'No three-putts yet'}</div>
        <div className="bn"><Icon name="wave-sine" fill /> {leg.holder ? `${firstName(nameOf(round, leg.holder))} has the snake` : 'Nobody has the snake'}</div>
      </div>
      <div className="skin-counts">
        {done.map(l => <span key={l.seg.label} className="press-chip">{l.seg.label}: {firstName(nameOf(round, l.holder))}</span>)}
      </div>
    </div>
  );
}

/** Tap who three-putted, in the order it happened: the last one takes the snake. */
export function SnakePicker({ round, hole, marks, setMarks }) {
  const putts = marks?.snake || [];
  // "Four-putts count twice" (house rule): a tapped player can be marked as a four-putt too
  const ss = settingsAt(round, posOf(round, hole)).snake || {};
  const can4 = !!ss.fourPutt && (ss.growth || 'flat') !== 'flat';
  const fours = (marks?.snake4 || []).filter(pid => putts.includes(pid));
  const toggle = pid => {
    const out = putts.includes(pid);
    setMarks({ ...marks, snake: out ? putts.filter(x => x !== pid) : [...putts, pid], ...(out && marks?.snake4 ? { snake4: marks.snake4.filter(x => x !== pid) } : {}) });
    buzz(8);
  };
  const toggle4 = pid => {
    setMarks({ ...marks, snake4: fours.includes(pid) ? fours.filter(x => x !== pid) : [...fours, pid] });
    buzz(8);
  };
  return (
    <div className="marks-card">
      <div className="marks-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div className="marks-lbl" style={{ width: 'auto' }}><strong>Three-putts</strong><span>{putts.length > 1 ? 'Tap in the order they happened. The last one takes the snake' : 'Tap anyone who three-putted'}</span></div>
        <div className="chip-row" style={{ padding: 0 }} role="group" aria-label="Three-putts">
          {playersOn(round, hole).map(p => {
            const k = putts.indexOf(p.id);
            return (
              <span key={p.id} className="snake4-pair">
                <button aria-pressed={k >= 0} className={`pill-btn sm ${k >= 0 ? 'on' : ''}`} onClick={() => toggle(p.id)}>
                  {k >= 0 && putts.length > 1 && <span aria-hidden="true">{k + 1}.</span>} {firstName(p.name)}{k >= 0 && k === putts.length - 1 ? ' · has it' : ''}
                </button>
                {can4 && k >= 0 && (
                  <button aria-pressed={fours.includes(p.id)} aria-label={`${firstName(p.name)} four-putted`} className={`pill-btn sm ${fours.includes(p.id) ? 'on' : ''}`} onClick={() => toggle4(p.id)}>4-putt</button>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --------------------------- Hammer ---------------------------------------

/** The hole's value, the hammer buttons, and folding. Marks: { hammers: [side, ...], conceded: side | null }. */
export function HammerPanel({ round, hole, marks, setMarks, readOnly = false }) {
  const money = unitFmt(round); // points in a points or reward round
  const mark = { hammers: marks?.hammers || [], conceded: marks?.conceded ?? null };
  const rows = hammerTable(round);
  const row = rows.find(r => r.hole.no === hole.no);
  const base = row?.base ?? round.settings.hammer.stake;
  const names = sideNames(round);
  const short = names.map(n => (round.teams ? n : firstName(n)));
  const plural = i => sides(round)[i].length > 1;
  const can = hammerOptions(round, hole, mark);
  const n = mark.hammers.length;
  const value = base * 2 ** n;
  // Birdie hammer (a house rule): the amount here is before the scores, so say a winning birdie doubles it
  const birdieRule = !!settingsAt(round, posOf(round, hole)).hammer?.birdie;
  const pending = n > 0 && mark.conceded == null ? 1 - mark.hammers.at(-1) : null;
  const before = rows.filter(r => r.pos < (row?.pos ?? 0)).reduce((a, r) => a + r.net, 0);
  const put = next => { setMarks({ ...marks, ...next }); buzz(next.hammers?.length > n ? [20, 40, 20] : 12); };
  const status = mark.conceded != null
    ? `${short[mark.conceded]} folded. ${short[1 - mark.conceded]} win${plural(1 - mark.conceded) ? '' : 's'} ${money(base * 2 ** (n - 1))}`
    : pending != null
      ? `${short[1 - pending]} hammered. ${short[pending]} play${plural(pending) ? '' : 's'} on at ${money(value)} or fold${plural(pending) ? '' : 's'} at ${money(value / 2)}`
      : n ? '' : row?.who === 'trailing' && row.behind != null ? `${short[row.behind]} can throw the first hammer` : 'Either side can hammer';
  return (
    <div className="wolf-panel">
      <div className="bl" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span><Icon name="hammer" fill /> This hole: <strong>{money(mark.conceded != null ? value / 2 : value)}</strong>{n ? ` · ${n} hammer${n === 1 ? '' : 's'}` : ''}{birdieRule && mark.conceded == null ? ' · a winning birdie doubles it' : ''}</span>
        <span>{before === 0 ? 'All square' : `${short[before > 0 ? 0 : 1]} +${money(Math.abs(before))}`}</span>
      </div>
      {status && <p className="bl" style={{ margin: '0 0 8px', fontWeight: 500 }} aria-live="polite">{status}</p>}
      {!readOnly && <div className="chip-row" style={{ padding: 0 }}>
        {[0, 1].map(i => can[i] && (
          <button key={i} className="pill-btn" style={{ minHeight: 44 }} onClick={() => put({ hammers: [...mark.hammers, i], conceded: null })}>
            <Icon name="hammer" fill /> {short[i]} hammer{plural(i) ? '' : 's'} · {money(value * 2)}
          </button>
        ))}
        {pending != null && (
          <button className="pill-btn lone" style={{ minHeight: 44 }} onClick={() => put({ conceded: pending })}>{short[pending]} fold{plural(pending) ? '' : 's'}</button>
        )}
        {n > 0 && (
          <button className="pill-btn sm" onClick={() => put(mark.conceded != null ? { conceded: null } : { hammers: mark.hammers.slice(0, -1) })}>
            <Icon name="arrow-counter-clockwise" /> Undo
          </button>
        )}
      </div>}
    </div>
  );
}

// --------------------------- Bingo Bango Bongo -----------------------------

const BBB = [
  { key: 'bingo', name: 'Bingo', help: 'First on the green' },
  { key: 'bango', name: 'Bango', help: 'Closest once everyone is on' },
  { key: 'bongo', name: 'Bongo', help: 'First in the hole' },
];

export function BBBPicker({ round, hole, marks, setMarks }) {
  // "Bongo is low net" (house rule): the third point comes from the scores, so there's nothing to tap
  const netBongo = !!settingsAt(round, posOf(round, hole)).bbb?.netBongo;
  return (
    <div className="marks-card">
      {netBongo && (
        <div className="marks-row">
          <div className="marks-lbl"><strong>Bongo</strong><span>Lowest net score, from the scores. A tie, nobody gets it</span></div>
        </div>
      )}
      {BBB.filter(b => !(netBongo && b.key === 'bongo')).map(b => (
        <div key={b.key} className="marks-row">
          <div className="marks-lbl"><strong>{b.name}</strong><span>{b.help}</span></div>
          <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label={b.name}>
            {playersOn(round, hole).map(p => (
              <button key={p.id} role="radio" aria-checked={marks[b.key] === p.id} className={`pill-btn sm ${marks[b.key] === p.id ? 'on' : ''}`}
                onClick={() => { setMarks({ ...marks, [b.key]: marks[b.key] === p.id ? null : p.id }); buzz(8); }}>{firstName(p.name)}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --------------------------- Dots -----------------------------------------

export function DotsRow({ round, player, hole, marks, setMarks, gross, label = null }) {
  // The junk in play on this hole: a hole fixed after the bet changed shows what it was played for
  const s = settingsAt(round, posOf(round, hole)).dots;
  // A greenie is a par 3 thing and an Arnie or a Hogan needs a fairway (par 4s and 5s), unless one was
  // already marked here. A dot missing from the round's kinds (Hogan on an older round) is off.
  const kinds = Object.keys(DOT_KINDS).filter(k => s.kinds?.[k] && (!DOT_PARS[k] || DOT_PARS[k].includes(hole.par) || (marks[player.id] || []).includes(k)));
  const mine = marks[player.id] || [];
  const auto = s.auto ? scoreDots(gross, hole.par) : 0;
  // "Greenies carry" (house rule): greenies missed on earlier par 3s ride on this one
  const riding = greenieCarryBefore(round, hole);
  const toggle = k => {
    const next = mine.includes(k) ? mine.filter(x => x !== k) : [...mine, k];
    const all = { ...marks, [player.id]: next };
    // Only the player closest to the pin gets the greenie, so marking it takes it off anyone else
    if (k === 'greenie' && !mine.includes(k)) {
      for (const pid of Object.keys(all)) if (pid !== player.id && Array.isArray(all[pid])) all[pid] = all[pid].filter(x => x !== 'greenie');
    }
    setMarks(all);
    buzz(8);
  };
  return (
    <div className="dots-row" role="group" aria-label={label || `${player.name.split(' ')[0]}’s dots`}>
      {auto > 0 && <span className="pill-btn sm auto"><Icon name="bird" fill /> {auto === 2 ? 'Eagle · 2 dots' : 'Birdie'}</span>}
      {kinds.map(k => (
        <button key={k} className={`pill-btn sm ${mine.includes(k) ? 'on' : ''}`} aria-pressed={mine.includes(k)} title={DOT_KINDS[k].help} onClick={() => toggle(k)}>{DOT_KINDS[k].name}{k === 'greenie' && riding ? ` ×${riding + 1}` : ''}</button>
      ))}
    </div>
  );
}

// --------------------------- Closest to the pin and long drive pots -------

/**
 * Who won the pot on this hole, for each closest to the pin or long drive pot played on it. `pots`
 * are the pots' game views (see gameView). The winner is saved in the hole's marks under the pot's key
 * (a player id, or 'none'); a hole saved with nothing tapped counts as nobody's, so Nobody shows
 * picked until someone is tapped. A phone that isn't keeping score sees who won (`readOnly`).
 */
export function PotPicker({ pots, hole, marks, setMarks, readOnly = false }) {
  const here = pots.filter(v => potHoles(v, v.game).some(h => h.no === hole.no));
  if (!here.length) return null;
  return (
    <div className="marks-card pot-card" role="group" aria-label="Pots on this hole">
      {here.map(v => {
        const key = v.game;
        const fmt = unitFmt(v);
        const t = potTable(v, key);
        // What this hole is played for: its share plus anything carried to it
        const row = potTable({ ...v, marks: { ...(v.marks || {}), [hole.no]: { ...(marks || {}), [key]: POT_NONE } } }, key).holes.find(h => h.no === hole.no);
        const split = t.unclaimed === 'split';
        const worth = split ? t.worth : row?.value ?? t.worth;
        const title = key === 'ctp' ? 'Closest to the pin' : 'Long drive';
        const sub = t.inPot.length < 2 ? 'Needs two players in the pot'
          : `${fmt(Math.round(worth * 100) / 100)}${split ? ' share' : ' on this hole'}${!split && row?.carried ? `, ${fmt(Math.round(row.carried * 100) / 100)} carried` : ''}`;
        const won = marks?.[key] ?? null;
        const players = v.players.filter(p => t.inPot.includes(p.id));
        const label = `${title}: who ${key === 'ctp' ? 'was closest' : 'hit it longest'}`;
        if (readOnly) {
          const who = won && won !== POT_NONE ? players.find(p => p.id === won) : null;
          return (
            <div key={key} className="marks-row pot-row">
              <div className="marks-lbl pot-lbl"><strong>{title}</strong><span>{sub}</span></div>
              <div className="hb-state">{who ? `${firstName(who.name)} ${key === 'ctp' ? 'was closest' : 'hit it longest'}` : won === POT_NONE ? 'Nobody won it' : 'Not tapped yet'}</div>
            </div>
          );
        }
        const pick = pid => { setMarks({ ...(marks || {}), [key]: pid }); buzz(8); };
        return (
          <div key={key} className="marks-row pot-row">
            <div className="marks-lbl pot-lbl"><strong>{title}</strong><span>{sub}</span></div>
            <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label={label}>
              {players.map(p => (
                <button key={p.id} role="radio" aria-checked={won === p.id} className={`pill-btn sm ${won === p.id ? 'on' : ''}`} onClick={() => pick(won === p.id ? POT_NONE : p.id)}>
                  {won === p.id && <Icon name="check" />} {firstName(p.name)}
                </button>
              ))}
              <button role="radio" aria-checked={!won || won === POT_NONE} className={`pill-btn sm ${!won || won === POT_NONE ? 'on' : ''}`} onClick={() => pick(POT_NONE)}>Nobody</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
