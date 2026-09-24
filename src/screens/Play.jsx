import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Icon, Numpad, Screen, Sheet, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { getState, update, useStore } from '../lib/store.js';
import {
  GAMES, bankerHoleSetup, holeAtPos, holeComplete, nassauPressOptions, nassauWinners, nassauAmounts, roundLegs,
  roundResults, skinsTable, strokesFor, wolfFor,
} from '../lib/round.js';
import { money, nassauBets, scoreName, pickupGross } from '../lib/golf.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { useNav } from '../lib/nav.js';
import { Scorecard } from './RoundDetail.jsx';
import { LivePill, ShareSheet } from '../components/Live.jsx';
import { syncConfigured } from '../lib/sync.js';
import { uid } from '../lib/store.js';

export default function Play({ id }) {
  const round = useStore(s => s.rounds[id]);
  const nav = useNav();
  if (!round) {
    return (
      <Screen>
        <Empty title="Round not found" text="It may have been discarded." action={<button className="ec" onClick={() => nav.reset('history')}>Back to History</button>} />
      </Screen>
    );
  }
  // Remount when this hole changes on another phone so the fresh scores show
  const cur = round.holes[Math.min(round.current, round.holes.length - 1)];
  return <PlayRound key={`${round.current}:${round._remote?.[cur?.no] || 0}`} round={round} />;
}

function useWakeLock() {
  useEffect(() => {
    let lock = null, dead = false;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } };
    get();
    const vis = () => document.visibilityState === 'visible' && !dead && get();
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}); };
  }, []);
}

// Unsaved scores per hole ("roundId:holeNo"), kept while moving between holes so nothing typed is lost
const DRAFTS = new Map();

function PlayRound({ round }) {
  useWakeLock();
  const nav = useNav();
  const { ask, showToast } = useUI();
  const idx = Math.min(round.current, round.holes.length - 1);
  const hole = round.holes[idx];
  const isLast = idx === round.holes.length - 1;
  const game = round.game;

  // Draft scores for this hole: saved scores, else par (shown muted until touched)
  const saved = round.scores[hole.no] || {};
  const draftKey = `${round.id}:${hole.no}`;
  const kept = DRAFTS.get(draftKey);
  // Edits you made but haven't saved win over the saved score; otherwise the saved score (which may have come from another phone) wins
  const wasDirty = !!kept?.dirty;
  const [dirty, setDirty] = useState(wasDirty);
  const [draft, setDraft] = useState(() => Object.fromEntries(round.players.map(p => [p.id, (wasDirty ? kept.draft[p.id] : null) ?? saved[p.id] ?? hole.par])));
  const [touched, setTouched] = useState(() => Object.fromEntries(round.players.map(p => [p.id, saved[p.id] != null || (wasDirty && !!kept.touched[p.id])])));
  useEffect(() => { DRAFTS.set(draftKey, { draft, touched, dirty }); }, [draftKey, draft, touched, dirty]);
  const [banker, setBanker] = useState(() => (game === 'banker' ? structuredClone(bankerHoleSetup(round, idx)) : null));
  const [phase, setPhase] = useState(() => (game === 'banker' && !holeComplete(round, hole) ? 'bets' : 'scores'));
  const [wolf, setWolf] = useState(() => (game === 'wolf' ? (round.wolf[hole.no] || { wolf: wolfFor(round, idx), partner: undefined }) : null));
  const [menu, setMenu] = useState(false);
  const [card, setCard] = useState(false);
  const [rules, setRules] = useState(false);
  const [betPad, setBetPad] = useState(null);
  const [bankerPick, setBankerPick] = useState(false);
  const [live, setLive] = useState(false);
  const numRefs = useRef({});

  const setScore = (pid, v) => {
    setDirty(true);
    setDraft(d => ({ ...d, [pid]: v }));
    setTouched(t => ({ ...t, [pid]: true }));
    buzz(8);
    if (v !== 'X' && v <= hole.par - 1 && (draft[pid] === 'X' || v < draft[pid])) {
      const name = scoreName(v, hole.par);
      showToast(`${name}!`);
      confettiFrom(numRefs.current[pid], v <= hole.par - 2 ? 60 : 30);
      buzz([20, 40, 20]);
    }
  };


  // Where "Save" takes you: the next hole, or the first unscored hole after this one when fixing an earlier score
  const nextIdx = useMemo(() => {
    if (isLast) return idx;
    const later = round.holes.findIndex((h, i) => i > idx && !holeComplete(round, h));
    return later === -1 ? idx + 1 : later;
  }, [round, idx, isLast]);

  const saveHole = async () => {
    if (game === 'wolf' && wolf.partner === undefined) { showToast('Wolf needs to pick a partner or go lone'); return; }
    const scores = { ...draft };
    DRAFTS.delete(draftKey);
    update(s => {
      const r = s.rounds[round.id];
      r.scores[hole.no] = scores;
      if (game === 'banker') r.banker[hole.no] = banker;
      if (game === 'wolf') r.wolf[hole.no] = wolf;
      if (!isLast) r.current = nextIdx;
      // Auto presses before the next hole
      if (game === 'nassau' && r.settings.nassau.pressMode === 'auto' && !isLast) {
        const next = nextIdx + 1; // playing position of the hole we're going to
        for (const o of nassauPressOptions(r, next)) {
          r.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
        }
      }
    });
    if (game === 'nassau' && round.settings.nassau.pressMode === 'auto' && !isLast) {
      const r = getState().rounds[round.id];
      const legs = roundLegs(r);
      const fresh = r.presses.filter(p => p.start === nextIdx + 1);
      if (fresh.length) showToast(`Auto press: ${fresh.map(p => legs[p.leg].label).join(', ')}`);
    }
    if (isLast) finish();
  };

  const finish = async () => {
    const r = getState().rounds[round.id];
    const missing = r.holes.filter(h => !holeComplete(r, h));
    if (missing.length) {
      const go = await ask({
        title: `${missing.length} hole${missing.length === 1 ? '' : 's'} not scored`,
        text: `Hole${missing.length === 1 ? '' : 's'} ${missing.map(h => h.no).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no scores. Finish anyway and count only the holes played?`,
        actions: [{ label: 'Finish round', value: 'finish' }, { label: 'Go to first missing hole', value: 'goto', secondary: true }],
      });
      if (go === 'goto') { update(s => { s.rounds[round.id].current = r.holes.indexOf(missing[0]); }); return; }
      if (go !== 'finish') return;
    }
    update(s => {
      const rr = s.rounds[round.id];
      rr.status = 'done'; rr.finishedAt = Date.now();
      if (s.activeRoundId === round.id) s.activeRoundId = null;
    });
    nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
  };

  const endEarly = async () => {
    setMenu(false);
    const played = round.holes.filter(h => holeComplete(round, h)).length;
    const choice = await ask({
      title: 'End this round?',
      text: played ? `${played} of ${round.holes.length} holes scored.` : 'No holes have been scored yet.',
      actions: [
        ...(played ? [{ label: 'Finish with holes played', value: 'finish' }] : []),
        { label: 'Discard round', value: 'discard', danger: true },
      ],
      cancelLabel: 'Keep playing',
    });
    if (choice === 'finish') {
      update(s => { const rr = s.rounds[round.id]; rr.status = 'done'; rr.finishedAt = Date.now(); s.activeRoundId = null; });
      nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
    }
    if (choice === 'discard') {
      const sure = await ask({ title: 'Discard for good?', text: 'Scores and bets from this round will be deleted.', confirmLabel: 'Delete round', danger: true });
      if (!sure) return;
      update(s => { delete s.rounds[round.id]; if (s.activeRoundId === round.id) s.activeRoundId = null; });
      nav.reset('history');
    }
  };

  const goHole = i => update(s => { s.rounds[round.id].current = i; });

  const results = useMemo(() => roundResults(round), [round]);

  return (
    <Screen className="play">
      <div className="play-top">
        <button className="header-close" onClick={() => nav.pop()} aria-label="Leave round (it stays saved)"><Icon name="caret-down" /></button>
        <div className="play-title">
          <div className="play-course">{round.course.name}</div>
          <div className="play-progress">{GAMES[game].name} · Hole {idx + 1} of {round.holes.length} {round.shared && <button className="pill-link" onClick={() => setLive(true)}><LivePill round={round} /></button>}</div>
        </div>
        <button className="header-close" onClick={() => setMenu(true)} aria-label="Round menu"><Icon name="dots-three" /></button>
      </div>
      {round.status === 'done' && (
        <button className="finished-banner" onClick={() => nav.reset('history', ['roundDetail', { id: round.id }])}>
          <Icon name="flag-checkered" fill /> The scorekeeper finished this round — see results <Icon name="arrow-right" />
        </button>
      )}
      <div className="hole-meta" onClick={() => setCard(true)} role="button" tabIndex={0} aria-label="Open scorecard">
        <div className="mc"><span className="ml">Hole</span><span className="mv">{hole.no}</span></div>
        <div className="mc"><span className="ml">Par</span><span className="mv">{hole.par}</span></div>
        <div className="mc"><span className="ml">HDCP</span><span className="mv">{hole.hdcp ?? '—'}</span></div>
      </div>

      {game === 'banker' && (
        <BankerPanel round={round} banker={banker} setBanker={setBanker} phase={phase} setPhase={setPhase}
          onPick={() => setBankerPick(true)} onBet={pid => setBetPad(pid)} draft={draft} hole={hole} />
      )}
      {game === 'nassau' && <NassauPanel round={round} hole={hole} />}
      {game === 'skins' && <SkinsPanel round={round} hole={hole} />}
      {game === 'wolf' && <WolfPanel round={round} wolf={wolf} setWolf={setWolf} />}

      {phase === 'scores' && (
        <div className="scroll">
          {round.players.map(p => {
            const st = round.useHandicaps ? strokesFor(round, p, hole) : 0;
            const v = draft[p.id];
            const isBanker = banker?.banker === p.id;
            const isWolf = wolf?.wolf === p.id;
            const shown = v === 'X' ? pickupGross(hole.par, st) : v;
            return (
              <div key={p.id} className={`pcard score-row ${isBanker || isWolf ? 'bkr' : ''}`}>
                <div className="row-main">
                  <div className="pname" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.name}
                    {isBanker && <span className="bkr-badge"><Icon name="bank" fill /> Banker</span>}
                    {isWolf && <span className="bkr-badge"><Icon name="paw-print" fill /> Wolf</span>}
                  </div>
                  <div className="ps">
                    {st > 0 && <span className="stroke-dots" aria-label={`Gets ${st} stroke${st > 1 ? 's' : ''}`}>{'●'.repeat(st)} {st} stroke{st > 1 ? 's' : ''}</span>}
                    {st < 0 && <span className="stroke-dots">Gives {-st} stroke</span>}
                    {game === 'banker' && !isBanker && <span> Bet {money(banker.bets[p.id] || 0)}{banker.doubled[p.id] ? (banker.doubleBack ? ' · 4×' : ' · 2×') : ''}</span>}
                    {touched[p.id] && v !== 'X' && <span className={`score-name s${Math.max(-2, Math.min(2, v - hole.par))}`}> {scoreName(v, hole.par)}</span>}
                  </div>
                  <button className={`pickup-btn ${v === 'X' ? 'on' : ''}`} onClick={() => setScore(p.id, v === 'X' ? hole.par : 'X')} aria-pressed={v === 'X'}>
                    <Icon name="hand-grabbing" /> {v === 'X' ? `Picked up (counts ${shown})` : 'Picked up'}
                  </button>
                </div>
                <div className="score-ctrl">
                  <button className="sc-btn" aria-label={`${p.name} one less`} disabled={v !== 'X' && v <= 1}
                    onClick={() => setScore(p.id, v === 'X' ? hole.par : Math.max(1, v - 1))}><Icon name="minus" /></button>
                  <span ref={el => { numRefs.current[p.id] = el; }} className={`sc-num ${touched[p.id] ? '' : 'untouched'} ${v !== 'X' && v < hole.par ? 'birdie' : ''}`} aria-live="polite" aria-label={`${p.name} score`}>
                    {v === 'X' ? 'X' : v}
                  </span>
                  <button className="sc-btn" aria-label={`${p.name} one more`} disabled={v !== 'X' && v >= 15}
                    onClick={() => setScore(p.id, v === 'X' ? hole.par + 1 : Math.min(15, v + 1))}><Icon name="plus" /></button>
                </div>
              </div>
            );
          })}
          <RunningTotals round={round} results={results} />
        </div>
      )}

      <div className="cta-wrap play-cta">
        {phase === 'bets' ? (
          <button className="full-btn" onClick={() => setPhase('scores')}>Bets are in — enter scores <Icon name="arrow-right" /></button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="full-btn outline" style={{ width: 64, flex: 'none' }} disabled={idx === 0} onClick={() => goHole(idx - 1)} aria-label="Previous hole"><Icon name="arrow-left" /></button>
            <button className="full-btn" style={{ flex: 1 }} onClick={saveHole}>
              {isLast ? <>Finish round <Icon name="flag-pennant" fill /></> : nextIdx !== idx + 1 ? <>Save &amp; back to hole {round.holes[nextIdx].no} <Icon name="arrow-right" /></> : <>Save &amp; next hole <Icon name="arrow-right" /></>}
            </button>
          </div>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Round">
        <button className="sheet-item" onClick={() => { setMenu(false); setCard(true); }}><span><Icon name="table" /> Scorecard</span><Icon name="caret-right" /></button>
        <button className="sheet-item" onClick={() => { setMenu(false); setRules(true); }}><span><Icon name="book-open" /> {GAMES[game].name} rules</span><Icon name="caret-right" /></button>
        {syncConfigured && (
          <button className="sheet-item" onClick={() => { setMenu(false); setLive(true); }}>
            <span><Icon name="broadcast" /> {round.shared ? `Live scoring · ${round.shared.code}` : 'Share live scoring'}</span><Icon name="caret-right" />
          </button>
        )}
        <button className="sheet-item" onClick={endEarly}><span><Icon name="flag-checkered" /> End round</span><Icon name="caret-right" /></button>
      </Sheet>
      <Sheet open={card} onClose={() => setCard(false)} title="Scorecard" className="sc-sheet">
        <p className="sheet-text">Tap a hole to jump to it and fix scores.</p>
        <Scorecard round={round} current={hole.no} onHole={no => { setCard(false); goHole(round.holes.findIndex(h => h.no === no)); }} />
      </Sheet>
      <RulesSheet game={game} open={rules} onClose={() => setRules(false)} />
      <ShareSheet round={round} open={live} onClose={() => setLive(false)} />
      {game === 'banker' && (
        <>
          <Sheet open={bankerPick} onClose={() => setBankerPick(false)} title={`Banker · Hole ${hole.no}`}>
            {round.players.map(p => (
              <button key={p.id} className={`sheet-item ${banker.banker === p.id ? 'selected' : ''}`}
                onClick={() => {
                  const bets = {};
                  const def = round.settings.banker.defaultBet;
                  for (const q of round.players) if (q.id !== p.id) bets[q.id] = banker.bets[q.id] ?? def;
                  setBanker({ ...banker, banker: p.id, bets, doubled: {}, doubleBack: false });
                  setBankerPick(false);
                }}>
                {p.name}<span style={{ fontSize: 13 }}>{p.plays ? `Gets ${p.plays}` : 'Scratch'}</span>
              </button>
            ))}
          </Sheet>
          <Numpad open={!!betPad} title={`${round.players.find(p => p.id === betPad)?.name}'s bet`} prefix="$"
            initial={betPad ? banker.bets[betPad] : ''} min={round.settings.banker.min} max={round.settings.banker.max}
            onClose={() => setBetPad(null)} onDone={v => { setBanker({ ...banker, bets: { ...banker.bets, [betPad]: v } }); setBetPad(null); }} />
        </>
      )}
    </Screen>
  );
}

function RunningTotals({ round, results }) {
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  if (!played) return null;
  return (
    <div className="running-total">
      <div className="rt-lbl">Running total · {played} hole{played === 1 ? '' : 's'}</div>
      <div className="rt-items">
        {round.players.map(p => {
          const v = results.balances[p.id];
          return (
            <div key={p.id} className="rt-item">
              <div className="rt-p">{p.name}</div>
              <div className={`rt-a ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{money(v, { sign: true })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------- Banker ---------------------------------------

function BankerPanel({ round, banker, setBanker, phase, setPhase, onPick, onBet }) {
  const b = round.players.find(p => p.id === banker.banker);
  const others = round.players.filter(p => p.id !== banker.banker);
  const anyDoubled = others.some(p => banker.doubled[p.id]);
  const canPick = round.settings.banker.rotation === 'choice' || true;
  return (
    <>
      <div className="banker-bar">
        <div><div className="bl">Banker this hole</div><div className="bn"><Icon name="bank" fill /> {b?.name}</div></div>
        {phase === 'bets'
          ? canPick && <button className="change-btn" onClick={onPick}>Change</button>
          : <button className="change-btn" onClick={() => setPhase('bets')}><Icon name="coins" /> Bets</button>}
      </div>
      {phase === 'bets' && (
        <div className="scroll">
          <div style={{ padding: '6px 20px 8px' }}><div className="eyebrow">Step 1 of 2 — Bets &amp; doubles</div></div>
          {others.map(p => (
            <div key={p.id} className="pcard">
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 10px' }}>
                <div style={{ flex: 1 }}><div className="pname">{p.name}</div><div className="ps">{p.plays ? `Gets ${p.plays} stroke${p.plays > 1 ? 's' : ''} on the round` : 'Scratch'}</div></div>
                <button className="amt-btn" onClick={() => onBet(p.id)} aria-label={`${p.name}'s bet, ${money(banker.bets[p.id])}`}>{money(banker.bets[p.id] || 0)}</button>
              </div>
              <div style={{ padding: '0 16px 16px', display: 'flex' }}>
                <button className={`dbl-btn ${banker.doubled[p.id] ? 'on' : ''}`} style={{ flex: 1, height: 52, fontSize: 17 }} aria-pressed={!!banker.doubled[p.id]}
                  onClick={() => {
                    const doubled = { ...banker.doubled, [p.id]: !banker.doubled[p.id] };
                    const still = others.some(o => doubled[o.id]);
                    setBanker({ ...banker, doubled, doubleBack: still ? banker.doubleBack : false });
                  }}>
                  <Icon name="lightning" fill /> {banker.doubled[p.id] ? `Doubled · ${money(banker.bets[p.id] * (banker.doubleBack ? 4 : 2))}` : 'Double it'}
                </button>
              </div>
            </div>
          ))}
          <div className="block" style={{ background: 'var(--surface)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{b?.name} can double back</div>
            <button className={`dbl-btn ${banker.doubleBack ? 'on' : ''}`} style={{ width: '100%', height: 52, fontSize: 17 }} disabled={!anyDoubled} aria-pressed={banker.doubleBack}
              onClick={() => setBanker({ ...banker, doubleBack: !banker.doubleBack })}>
              <Icon name="lightning" fill /> {anyDoubled ? (banker.doubleBack ? 'Doubled back · 4×' : 'Double back to 4×') : 'Unlocks when someone doubles'}
            </button>
          </div>
          <BetExposure round={round} banker={banker} />
        </div>
      )}
    </>
  );
}

function BetExposure({ banker }) {
  const total = Object.entries(banker.bets).reduce((a, [pid, v]) => a + v * (banker.doubled[pid] ? (banker.doubleBack ? 4 : 2) : 1), 0);
  return <p className="hint-card"><Icon name="scales" fill /> Banker has {money(total)} riding on this hole.</p>;
}

// --------------------------- Nassau ---------------------------------------

function NassauPanel({ round, hole }) {
  const { showToast } = useUI();
  const winners = nassauWinners(round);
  const legsDef = roundLegs(round);
  const LEGS = legsDef;
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const bets = nassauBets(winners, round.presses, nassauAmounts(round), legsDef);
  const names = round.players.map(p => p.name);
  const legs = ['front', 'back', 'total'];
  const options = round.settings.nassau.pressMode === 'manual' && !holeComplete(round, hole) ? nassauPressOptions(round, pos) : [];
  const activePresses = bets.filter(b => b.press && pos >= b.start && pos <= b.end);
  const press = o => {
    update(s => { const r = s.rounds[round.id]; r.presses.push({ id: uid('pr_'), leg: o.leg, start: pos, by: o.trailing }); });
    showToast(`${names[o.trailing]} pressed the ${LEGS[o.leg].label.toLowerCase()}!`);
    buzz(30);
  };
  const tile = leg => {
    const b = bets.find(x => x.key === leg);
    const s = b.status;
    const notStarted = pos < b.start && s.played === 0;
    const val = notStarted ? '—' : s.leader === null ? 'AS' : `${names[s.leader].charAt(0).toUpperCase()} ${s.by} up`;
    const sub = notStarted ? `Starts H${holeAtPos(round, b.start)}` : s.left === 0 ? 'Final' : s.closed ? 'Won' : s.dormie ? 'Dormie' : `${s.left} left`;
    return (
      <div key={leg} className={`ms-tile ${s.leader === 0 ? 'ahead' : s.leader === 1 ? 'behind' : ''}`}>
        <span className="ms-lbl">{LEGS[leg].label}</span><span className="ms-val">{val}</span><span className="ms-sub">{sub}</span>
      </div>
    );
  };
  return (
    <>
      <div className="match-status">{legs.map(tile)}</div>
      {activePresses.length > 0 && (
        <div className="press-bar">
          <span className="press-bar-lbl">Presses</span>
          {activePresses.map(p => (
            <span key={p.key} className="press-chip">{LEGS[p.leg].label} from H{holeAtPos(round, p.start)}: {p.status.leader === null ? 'AS' : `${names[p.status.leader].charAt(0)} ${p.status.by} up`}</span>
          ))}
        </div>
      )}
      {options.length > 0 && (
        <div className="press-alert">
          {options.map(o => (
            <div key={o.leg} className="press-alert-row">
              <span className="press-alert-txt">{names[o.trailing]} is {o.by} down on the {LEGS[o.leg].label.toLowerCase()}</span>
              <button className="press-call-btn" onClick={() => press(o)}>Press <Icon name="lightning" fill /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --------------------------- Skins ----------------------------------------

function SkinsPanel({ round, hole }) {
  const t = skinsTable(round);
  const row = t.rows.find(r => r.hole.no === hole.no);
  const won = t.rows.filter(r => r.winner);
  const counts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  won.forEach(r => { counts[r.winner] += r.skins; });
  const pot = row?.pot ?? 1;
  return (
    <div className="banker-bar" style={{ background: 'var(--lav)' }}>
      <div>
        <div className="bl">This hole is worth</div>
        <div className="bn"><Icon name="coins" fill /> {pot} skin{pot > 1 ? 's' : ''} · {money(pot * t.value * (round.players.length - 1))}</div>
      </div>
      <div className="skin-counts">
        {round.players.map(p => <span key={p.id} className="press-chip">{p.name.split(' ')[0]} {counts[p.id]}</span>)}
      </div>
    </div>
  );
}

// --------------------------- Wolf -----------------------------------------

function WolfPanel({ round, wolf, setWolf }) {
  const w = round.players.find(p => p.id === wolf.wolf);
  const others = round.players.filter(p => p.id !== wolf.wolf);
  const mult = round.settings.wolf.loneMultiplier;
  return (
    <div className="wolf-panel">
      <div className="bl" style={{ marginBottom: 8 }}><Icon name="paw-print" fill /> <strong>{w?.name}</strong> is the wolf — pick a partner after tee shots</div>
      <div className="chip-row" style={{ padding: 0 }}>
        {others.map(p => (
          <button key={p.id} className={`pill-btn ${wolf.partner === p.id ? 'on' : ''}`} aria-pressed={wolf.partner === p.id}
            onClick={() => setWolf({ ...wolf, partner: p.id })}>{p.name}</button>
        ))}
        <button className={`pill-btn lone ${wolf.partner === null ? 'on' : ''}`} aria-pressed={wolf.partner === null}
          onClick={() => setWolf({ ...wolf, partner: null })}><Icon name="paw-print" fill /> Lone wolf {mult}×</button>
      </div>
    </div>
  );
}

