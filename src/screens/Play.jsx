import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Icon, Numpad, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { getState, update, useStore } from '../lib/store.js';
import {
  GAMES, bankerHoleSetup, defaultNine, holeComplete, livePreview, nassauPressOptions, pressMode, resizeRound, roundLegs,
  roundResults, scoredHolesDropped, scorers, skinsTable, strokesFor, wolfFor,
} from '../lib/round.js';
import { findCourse } from '../lib/courses.js';
import { money, scoreName, pickupGross } from '../lib/golf.js';
import { BBBPicker, DotsRow, MatchPanel, MoneyPanel, PointsPanel, RabbitPanel, SixesPanel, TotalsPanel, VegasPanel } from '../components/GamePanels.jsx';
import { GameOptions } from '../components/GameOptions.jsx';
import { optionsProblem, stakeSummary } from '../lib/stakes.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { useNav } from '../lib/nav.js';
import { Scorecard } from './RoundDetail.jsx';
import { LivePill, ShareSheet } from '../components/Live.jsx';
import { syncConfigured } from '../lib/sync.js';
import { holeMoneyLine } from '../lib/format.js';

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
  return <PlayRound key={`${round.holesCount}:${round.current}:${round._remote?.[cur?.no] || 0}`} round={round} />;
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
  const units = scorers(round); // players, or teams in a scramble

  // Draft scores for this hole: saved scores, else par (shown muted until touched)
  const saved = round.scores[hole.no] || {};
  const draftKey = `${round.id}:${hole.no}`;
  const kept = DRAFTS.get(draftKey);
  // Edits you made but haven't saved win over the saved score; otherwise the saved score (which may have come from another phone) wins
  const wasDirty = !!kept?.dirty;
  const [dirty, setDirty] = useState(wasDirty);
  const [draft, setDraft] = useState(() => Object.fromEntries(units.map(p => [p.id, (wasDirty ? kept.draft[p.id] : null) ?? saved[p.id] ?? hole.par])));
  const [touched, setTouched] = useState(() => Object.fromEntries(units.map(p => [p.id, saved[p.id] != null || (wasDirty && !!kept.touched[p.id])])));
  const [marks, setMarks] = useState(() => (GAMES[game].marks ? (wasDirty && kept.marks) || structuredClone(round.marks?.[hole.no] || (game === 'bbb' ? { bingo: null, bango: null, bongo: null } : {})) : null));
  useEffect(() => { DRAFTS.set(draftKey, { draft, touched, dirty, marks }); }, [draftKey, draft, touched, dirty, marks]);
  const [banker, setBanker] = useState(() => (game === 'banker' ? structuredClone(bankerHoleSetup(round, idx)) : null));
  const [phase, setPhase] = useState(() => (game === 'banker' && !holeComplete(round, hole) ? 'bets' : 'scores'));
  const [wolf, setWolf] = useState(() => (game === 'wolf' ? (round.wolf[hole.no] || { wolf: wolfFor(round, idx), partner: undefined }) : null));
  const [menu, setMenu] = useState(false);
  const [card, setCard] = useState(false);
  const [rules, setRules] = useState(false);
  const [betPad, setBetPad] = useState(null);
  const [bankerPick, setBankerPick] = useState(false);
  const [live, setLive] = useState(false);
  const [holesSheet, setHolesSheet] = useState(false);
  const [betsSheet, setBetsSheet] = useState(false);
  const numRefs = useRef({});

  const setMarksDirty = m => { setDirty(true); setMarks(m); };
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
    showToast(holeMoneyLine(round, hole, livePreview(round, hole, { scores, banker, wolf, marks }).delta));
    update(s => {
      const r = s.rounds[round.id];
      r.scores[hole.no] = scores;
      if (game === 'banker') r.banker[hole.no] = banker;
      if (game === 'wolf') r.wolf[hole.no] = wolf;
      if (marks) { if (!r.marks) r.marks = {}; r.marks[hole.no] = marks; }
      if (!isLast) r.current = nextIdx;
      // Auto presses before the next hole
      if (pressMode(r) === 'auto' && !isLast) {
        const next = nextIdx + 1; // playing position of the hole we're going to
        for (const o of nassauPressOptions(r, next)) {
          r.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
        }
      }
    });
    if (pressMode(round) === 'auto' && !isLast) {
      const r = getState().rounds[round.id];
      const legs = roundLegs(r);
      const fresh = r.presses.filter(p => p.start === nextIdx + 1);
      if (fresh.length) showToast(game === 'nassau' ? `Auto press: ${fresh.map(p => legs[p.leg].label).join(', ')}` : 'Auto press!');
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
  // Money with this hole counted as it's being entered, so totals move with every tap
  const preview = useMemo(() => {
    const counting = phase === 'scores' && dirty && !(game === 'wolf' && wolf.partner === undefined);
    return livePreview(round, hole, counting ? { scores: draft, banker, wolf, marks } : null);
  }, [round, hole, phase, dirty, game, draft, banker, wolf, marks]);

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
      <MoneyBar round={round} preview={preview} />
      {round.status === 'done' && (
        <button className="finished-banner" onClick={() => nav.reset('history', ['roundDetail', { id: round.id }])}>
          <Icon name="flag-checkered" fill /> The scorekeeper finished this round. See results <Icon name="arrow-right" />
        </button>
      )}
      <div className="hole-meta" onClick={() => setCard(true)} role="button" tabIndex={0} aria-label="Open scorecard">
        <div className="mc"><span className="ml">Hole</span><span className="mv">{hole.no}</span></div>
        <div className="mc"><span className="ml">Par</span><span className="mv">{hole.par}</span></div>
        <div className="mc"><span className="ml">HDCP</span><span className="mv">{hole.hdcp ?? '–'}</span></div>
      </div>

      {game === 'banker' && (
        <BankerPanel round={round} banker={banker} setBanker={setBanker} phase={phase} setPhase={setPhase}
          onPick={() => setBankerPick(true)} onBet={pid => setBetPad(pid)} draft={draft} hole={hole} />
      )}
      {(game === 'nassau' || game === 'match') && <MatchPanel round={round} hole={hole} />}
      {game === 'skins' && <SkinsPanel round={round} hole={hole} onChange={() => setBetsSheet(true)} />}
      {game === 'wolf' && <WolfPanel round={round} wolf={wolf} setWolf={setWolf} />}
      {game === 'vegas' && <VegasPanel round={round} hole={hole} draft={draft} touched={touched} />}
      {game === 'sixes' && <SixesPanel round={round} hole={hole} />}
      {(game === 'stroke' || game === 'stableford' || game === 'quota') && <TotalsPanel round={round} />}
      {(game === 'nines' || game === 'bbb' || game === 'dots') && <PointsPanel round={round} />}
      {game === 'aces' && <MoneyPanel round={round} results={results} icon="spade" label="Aces & deuces so far" />}
      {game === 'rabbit' && <RabbitPanel round={round} hole={hole} />}

      {phase === 'scores' && (
        <div className="scroll">
          {game === 'bbb' && <BBBPicker round={round} marks={marks} setMarks={setMarksDirty} />}
          {units.map(p => {
            const st = round.useHandicaps ? strokesFor(round, p, hole) : 0;
            const v = draft[p.id];
            const isBanker = banker?.banker === p.id;
            const isWolf = wolf?.wolf === p.id;
            const shown = v === 'X' ? pickupGross(hole.par, st) : v;
            return (
              <div key={p.id} className={`pcard score-row ${game === 'dots' ? 'with-dots' : ''} ${isBanker || isWolf ? 'bkr' : ''}`}>
                <div className="row-main">
                  <div className="pname" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.name}
                    {isBanker && <span className="bkr-badge"><Icon name="bank" fill /> Banker</span>}
                    {isWolf && <span className="bkr-badge"><Icon name="paw-print" fill /> Wolf</span>}
                    {round.teams && !p.team && <span className={`side-tag ${round.teams.findIndex(t => t.players.includes(p.id)) === 0 ? 'a' : 'b'}`}>{['A', 'B', 'C', 'D'][round.teams.findIndex(t => t.players.includes(p.id))]}</span>}
                  </div>
                  {p.team && <div className="ps">{p.players.map(pid => round.players.find(x => x.id === pid)?.name.split(' ')[0]).join(', ')} · team HC {p.courseHc ?? 0}</div>}
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
                {game === 'dots' && <DotsRow round={round} player={p} hole={hole} marks={marks} setMarks={setMarksDirty} gross={touched[p.id] ? v : null} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="cta-wrap play-cta">
        {phase === 'bets' ? (
          <button className="full-btn" onClick={() => setPhase('scores')}>Bets are in, enter scores <Icon name="arrow-right" /></button>
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
        <button className="sheet-item" onClick={() => { setMenu(false); setBetsSheet(true); }}>
          <span><Icon name="coins" /> Bets · {stakeSummary(game, round.settings)}</span><Icon name="caret-right" />
        </button>
        <button className="sheet-item" onClick={() => { setMenu(false); setHolesSheet(true); }}>
          <span><Icon name="flag-pennant" /> Round length · {round.holesCount} holes</span><Icon name="caret-right" />
        </button>
        <button className="sheet-item" onClick={endEarly}><span><Icon name="flag-checkered" /> End round</span><Icon name="caret-right" /></button>
      </Sheet>
      {holesSheet && <HolesSheet round={round} onClose={() => setHolesSheet(false)} />}
      {betsSheet && <BetsSheet round={round} onClose={() => setBetsSheet(false)} />}
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

// --------------------------- Round length ---------------------------------

/** Switch a round in progress between 9 and 18 holes. Mounted only while open so it starts fresh each time. */
function HolesSheet({ round, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const [count, setCount] = useState(round.holesCount);
  const [nine, setNine] = useState(() => defaultNine(round));
  const g = GAMES[round.game];
  const changed = count !== round.holesCount;
  const preview = useMemo(() => (course && changed ? resizeRound(round, course, count, nine) : null), [round, course, changed, count, nine]);
  const dropped = preview ? scoredHolesDropped(round, preview.holes) : [];
  const hcChanges = preview && round.useHandicaps
    ? round.players.map((p, i) => ({ name: p.name.split(' ')[0], from: p.plays, to: preview.players[i].plays })).filter(c => c.from !== c.to)
    : [];
  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      Object.assign(r, resizeRound(r, course, count, nine));
    });
    onClose();
    showToast(`Now playing ${count} holes`);
    buzz(20);
  };
  return (
    <Sheet open onClose={onClose} title="Round length">
      <p className="sheet-text">Scores you’ve entered stay put. Par, handicaps and strokes are worked out again for the new length.</p>
      <div style={{ padding: '0 20px 12px' }}>
        <Segmented value={count} onChange={setCount}
          options={[9, 18].map(n => ({ value: n, label: `${n} holes`, disabled: !g.holes.includes(n) }))} />
      </div>
      {changed && course && count === 9 && course.holes.length === 18 && (
        <div style={{ padding: '0 20px 12px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Which nine</div>
          <Segmented value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
        </div>
      )}
      {!course && <p className="hint-card"><Icon name="info" fill /> This phone doesn’t have {round.course.name} saved, so the round length can’t be changed here.</p>}
      {course && count === 18 && course.holes.length === 9 && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      {dropped.length > 0 && (
        <p className="hint-card"><Icon name="warning" fill /> Scores on hole{dropped.length === 1 ? '' : 's'} {dropped.map(h => h.no).join(', ')} won’t count. They’re kept if you switch back.</p>
      )}
      {hcChanges.length > 0 && (
        <p className="hint-card"><Icon name="scales" fill /> Strokes: {hcChanges.map(c => `${c.name} ${c.from} → ${c.to}`).join(', ')}</p>
      )}
      {preview && round.presses.length > 0 && (
        <p className="hint-card"><Icon name="lightning" fill /> Presses are cleared. The bets change with the round length.</p>
      )}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!preview} onClick={apply}>
          {changed ? <>Switch to {count} holes <Icon name="arrow-right" /></> : `Playing ${count} holes`}
        </button>
      </div>
    </Sheet>
  );
}

// --------------------------- Bets & stakes --------------------------------

/**
 * Change the bets in a round that's under way, so the group doesn't have to discard the round
 * when they agree a different stake on the 3rd tee. Money is always worked out from the round's
 * current settings, so a change applies to every hole, including ones already scored.
 * Mounted only while open so it starts fresh each time.
 */
function BetsSheet({ round, onClose }) {
  const { showToast } = useUI();
  const game = round.game;
  const [opts, setOpts] = useState(() => structuredClone(round.settings));
  const [pad, setPad] = useState(null); // { path, title, min, max }
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], opts);
  const problem = optionsProblem(game, opts);
  const changed = JSON.stringify(opts[game]) !== JSON.stringify(round.settings[game]);
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      r.settings = { ...r.settings, [game]: structuredClone(opts[game]) };
      // The agreed bet is next time's default too
      s.settings = { ...s.settings, [game]: structuredClone(opts[game]) };
    });
    onClose();
    showToast(`Bets updated · ${stakeSummary(game, opts)}`);
    buzz(20);
  };
  return (
    <>
      <Sheet open={!pad} onClose={onClose} title="Bets" className="sc-sheet">
        <p className="sheet-text">
          {played
            ? `Money is worked out again for the whole round, including the ${played} hole${played === 1 ? '' : 's'} already played.`
            : 'Change what’s on the line before the first hole is scored.'}
        </p>
        <GameOptions game={game} get={get} set={set} onAmount={(path, title, o) => setPad({ path, title, ...o })} holesCount={round.holesCount}
          firstName={game === 'banker' ? round.players[0]?.name : null} />
        {game === 'banker' && <p className="hint-card"><Icon name="info" fill /> The default bet fills in from the next hole. Bets on this hole are set from the Bets button.</p>}
        {(game === 'nassau' || game === 'match') && round.presses.length > 0 && <p className="hint-card"><Icon name="lightning" fill /> Presses already made pay at the new amounts too.</p>}
        <div className="cta-wrap">
          <button className="full-btn" disabled={!changed || !!problem} onClick={apply}>
            {changed ? <>Update bets <Icon name="arrow-right" /></> : 'No changes yet'}
          </button>
        </div>
      </Sheet>
      <Numpad open={!!pad} title={pad?.title} prefix="$" initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
    </>
  );
}

/** Everyone's money, pinned under the header from the first hole, updating as scores go in. */
function MoneyBar({ round, preview }) {
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const pending = Object.values(preview.delta).some(Boolean);
  const top = Math.max(...Object.values(preview.balances));
  // Pop the amounts that just changed
  const [prev, setPrev] = useState(preview.balances);
  const [changed, setChanged] = useState([]);
  if (prev !== preview.balances) {
    setChanged(round.players.filter(p => prev[p.id] !== preview.balances[p.id]).map(p => p.id));
    setPrev(preview.balances);
  }
  return (
    <div className="money-bar" role="status" aria-label="Money so far">
      <div className="mb-head">
        <span>Money</span>
        <span>{played ? `Thru ${played} hole${played === 1 ? '' : 's'}${pending ? ' + this one' : ''}` : pending ? 'This hole' : 'Starts at $0'}</span>
      </div>
      <div className="mb-items" style={{ gridTemplateColumns: `repeat(${round.players.length}, minmax(0, 1fr))` }}>
        {round.players.map(p => {
          const v = preview.balances[p.id];
          const d = preview.delta[p.id];
          return (
            <div key={p.id} className={`mb-item ${top > 0 && v === top ? 'lead' : ''}`}>
              <div className="mb-p">{p.name.split(' ')[0]}</div>
              <div key={changed.includes(p.id) ? v : 'same'} className={`mb-a ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''} ${changed.includes(p.id) ? 'bump' : ''}`}>{money(v, { sign: true })}</div>
              <div className="mb-d">{d ? `${money(d, { sign: true })} this hole` : '\u00a0'}</div>
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
          <div style={{ padding: '6px 20px 8px' }}><div className="eyebrow">Step 1 of 2: Bets &amp; doubles</div></div>
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

// --------------------------- Skins ----------------------------------------

function SkinsPanel({ round, hole, onChange }) {
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
        <button className="change-btn" onClick={onChange}>{money(t.value)} a skin</button>
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
      <div className="bl" style={{ marginBottom: 8 }}><Icon name="paw-print" fill /> <strong>{w?.name}</strong> is the wolf. Pick a partner after tee shots</div>
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

