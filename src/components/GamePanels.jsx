// Per-game panels shown above the score rows while playing.
import { Icon, useUI } from './ui.jsx';
import { update, uid } from '../lib/store.js';
import {
  holeAtPos, holeComplete, nassauAmounts, nassauPressOptions, nassauWinners, playersOn, pointsTable, pressMode, rabbitTable, roundLegs, sideNames, sides,
  sixesMatches, totalsTable, vegasPreview, vegasTable,
} from '../lib/round.js';
import { money, nassauBets } from '../lib/golf.js';
import { DOT_KINDS, scoreDots } from '../lib/games.js';
import { buzz } from '../lib/delight.js';

const firstName = n => (n || '').split(' ')[0];
const nameOf = (round, pid) => round.players.find(p => p.id === pid)?.name || '?';

// --------------------------- Nassau & match play ---------------------------

export function MatchPanel({ round, hole }) {
  const { showToast } = useUI();
  const winners = nassauWinners(round);
  const LEGS = roundLegs(round);
  const legs = Object.keys(LEGS);
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const bets = nassauBets(winners, round.presses, nassauAmounts(round), LEGS);
  const names = sideNames(round);
  const short = names.map((n, i) => (round.teams ? ['A', 'B'][i] : n.charAt(0).toUpperCase()));
  const options = pressMode(round) === 'manual' && !holeComplete(round, hole) ? nassauPressOptions(round, pos) : [];
  const activePresses = bets.filter(b => b.press && pos >= b.start && pos <= b.end);
  const press = o => {
    update(s => { const r = s.rounds[round.id]; r.presses.push({ id: uid('pr_'), leg: o.leg, start: pos, by: o.trailing }); });
    showToast(`${names[o.trailing]} pressed${round.game === 'nassau' ? ` the ${LEGS[o.leg].label.toLowerCase()}` : ''}!`);
    buzz(30);
  };
  const tile = leg => {
    const b = bets.find(x => x.key === leg);
    const s = b.status;
    const notStarted = pos < b.start && s.played === 0;
    const val = notStarted ? '–' : s.leader === null ? 'AS' : `${short[s.leader]} ${s.by} up`;
    const sub = notStarted ? `Starts H${holeAtPos(round, b.start)}` : s.left === 0 ? 'Final' : s.closed ? `Won ${s.by}&${s.left}` : s.dormie ? 'Dormie' : `${s.left} left`;
    return (
      <div key={leg} className={`ms-tile ${s.leader === 0 ? 'ahead' : s.leader === 1 ? 'behind' : ''}`}>
        <span className="ms-lbl">{LEGS[leg].label}</span><span className="ms-val">{val}</span><span className="ms-sub">{sub}</span>
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
            <span key={p.key} className="press-chip">{round.game === 'nassau' ? `${LEGS[p.leg].label} ` : ''}from H{holeAtPos(round, p.start)}: {p.status.leader === null ? 'AS' : `${short[p.status.leader]} ${p.status.by} up`}</span>
          ))}
        </div>
      )}
      {options.length > 0 && (
        <div className="press-alert">
          {options.map(o => (
            <div key={o.leg} className="press-alert-row">
              <span className="press-alert-txt">{names[o.trailing]} {sides(round)[o.trailing].length > 1 ? 'are' : 'is'} {o.by} down{round.game === 'nassau' ? ` on the ${LEGS[o.leg].label.toLowerCase()}` : ''}</span>
              <button className="press-call-btn" onClick={() => press(o)}>Press <Icon name="lightning" fill /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --------------------------- Vegas ----------------------------------------

export function VegasPanel({ round, hole, draft, touched }) {
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
            <span className="ms-sub">{pv?.flipped[i] ? 'Flipped by a birdie' : pv ? 'This hole' : 'Enter scores'}</span>
          </div>
        ))}
      </div>
      <div className="vegas-line">
        {pv ? (pv.diff === 0 ? 'Hole is a push' : `${pv.diff > 0 ? teams[0].name : teams[1].name} take${round.teams ? '' : 's'} ${Math.abs(pv.diff)} point${Math.abs(pv.diff) === 1 ? '' : 's'} · ${money(Math.abs(pv.diff) * point)} each`) : 'Low score first, high second: 4 and 5 make 45'}
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
          const val = m.off || notStarted ? '–' : s.leader === null ? 'AS' : `${s.by} up`;
          const sub = m.off ? 'Off: a player left' : notStarted ?`H${holeAtPos(round, m.seg.start)}–${holeAtPos(round, m.seg.end)}` : s.left === 0 ? (lead ? `${lead}` : 'Halved') : s.closed ? `${lead} won` : lead ? `${lead} · ${s.left} left` : `${s.left} left`;
          return (
            <div key={m.index} className={`ms-tile ${m === cur ? 'cur' : ''} ${s.leader != null && s.played ? 'ahead' : ''}`}>
              <span className="ms-lbl">Match {m.index + 1}</span><span className="ms-val">{val}</span><span className="ms-sub">{sub}</span>
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
  const fmt = x => (round.game === 'stroke' ? (x.toPar === 0 ? 'E' : x.toPar > 0 ? `+${x.toPar}` : String(x.toPar)) : round.game === 'quota' ? `${x.total}/${x.quota}` : `${x.total}`);
  const sorted = [...t].sort((a, b) => (lowerWins ? a.total - b.total : (round.game === 'quota' ? b.vsQuota - a.vsQuota : b.total - a.total)));
  const label = { stroke: 'Net to par', stableford: 'Stableford points', quota: 'Points / quota' }[round.game];
  const lead = played ? `${firstName(sorted[0].name)} leads` : 'Nobody yet';
  return <ChipsPanel icon={round.game === 'stroke' ? 'list-numbers' : round.game === 'quota' ? 'target' : 'star'} label={`${label} · ${played} hole${played === 1 ? '' : 's'}`} items={sorted.map((x, i) => ({ id: x.id, name: firstName(x.name), value: fmt(x), lead: i === 0 ? lead : null }))} />;
}

export function PointsPanel({ round }) {
  const rows = pointsTable(round);
  const pts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  for (const r of rows) for (const p of round.players) pts[p.id] += r.points[p.id] || 0;
  const sorted = [...round.players].sort((a, b) => pts[b.id] - pts[a.id]);
  const label = { nines: '5-3-1 points', bbb: 'Points so far', dots: 'Dots so far' }[round.game];
  const lead = rows.length ? (pts[sorted[0].id] === pts[sorted[1]?.id] ? 'Tied at the top' : `${firstName(sorted[0].name)} leads`) : 'Nobody yet';
  return <ChipsPanel icon={{ nines: 'number-circle-nine', bbb: 'confetti', dots: 'medal' }[round.game]} label={label} items={sorted.map((p, i) => ({ id: p.id, name: firstName(p.name), value: pts[p.id], lead: i === 0 ? lead : null }))} />;
}

export function MoneyPanel({ round, results, icon, label }) {
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
  const won = t.legs.filter(l => l.done && l.holder);
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

// --------------------------- Bingo Bango Bongo -----------------------------

const BBB = [
  { key: 'bingo', name: 'Bingo', help: 'First on the green' },
  { key: 'bango', name: 'Bango', help: 'Closest once everyone is on' },
  { key: 'bongo', name: 'Bongo', help: 'First in the hole' },
];

export function BBBPicker({ round, hole, marks, setMarks }) {
  return (
    <div className="marks-card">
      {BBB.map(b => (
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

export function DotsRow({ round, player, hole, marks, setMarks, gross }) {
  const s = round.settings.dots;
  const kinds = Object.keys(DOT_KINDS).filter(k => s.kinds?.[k]);
  const mine = marks[player.id] || [];
  const auto = s.auto ? scoreDots(gross, hole.par) : 0;
  const toggle = k => {
    const next = mine.includes(k) ? mine.filter(x => x !== k) : [...mine, k];
    setMarks({ ...marks, [player.id]: next });
    buzz(8);
  };
  return (
    <div className="dots-row">
      {auto > 0 && <span className="pill-btn sm auto"><Icon name="bird" fill /> {auto === 2 ? 'Eagle · 2 dots' : 'Birdie'}</span>}
      {kinds.map(k => (
        <button key={k} className={`pill-btn sm ${mine.includes(k) ? 'on' : ''}`} aria-pressed={mine.includes(k)} title={DOT_KINDS[k].help} onClick={() => toggle(k)}>{DOT_KINDS[k].name}</button>
      ))}
    </div>
  );
}
