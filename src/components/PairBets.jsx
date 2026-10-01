// Side bets between two players (pair-bets.js): the setup list and the round menu's sheet, the
// editor for one bet, the taps on a hole (closest to the pin, a custom bet's winner) and the
// results breakdown. Everyone in the round sees the bets; only the phone keeping score changes them.
import { useState } from 'react';
import { Icon, Numpad, Segmented, Sheet, useUI } from './ui.jsx';
import { update } from '../lib/store.js';
import { holeComplete } from '../lib/round.js';
import {
  BET_KINDS, BET_LABEL_MAX, MAX_BETS, MAX_BET_STROKES, BET_MAX, addBet, betKindsFor, betLine, betMoneyText, betName, betPeople, betRange, betResult,
  betStakeText, betStatusText, betsMoney, betsOf, betsToTap, changeBet, cleanBet, cleanBetLabel, ctpHoles, nextPos, nineRange, removeBet, setBetWinner, suggestedStrokes,
} from '../lib/pair-bets.js';
import { buzz } from '../lib/delight.js';
import { countsMoney, inUnits, noMoneyNote, padUnit, unitFmt } from '../lib/play-for.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || '?';
const nameIn = (round, id) => first(round.players.find(p => p.id === id)?.name);
const QUICK = [1, 2, 5, 10, 20];
const needsScores = kind => kind === 'match' || kind === 'hole';

/**
 * One bet, made or changed. `round` is the round (or, in setup, a round-shaped draft with its
 * players and holes); `fromPos` the hole a new bet starts from by default (the next hole to play).
 */
export function BetEditor({ round, bet = null, fromPos = 1, onSave, onRemove = null, onClose }) {
  const fmt = unitFmt(round);
  const unit = padUnit(round);
  const kinds = betKindsFor(round.game);
  const n = round.holes.length;
  const [kind, setKind] = useState(bet?.kind && kinds.includes(bet.kind) ? bet.kind : kinds[0]);
  const [sides, setSides] = useState(() => (bet?.sides ? [...bet.sides] : []));
  const [stake, setStake] = useState(bet?.stake ?? 5);
  const [label, setLabel] = useState(bet?.label ?? '');
  const [holes, setHoles] = useState(() => (bet ? betRange(round, bet) : [fromPos > 1 && fromPos <= n ? fromPos : 1, n]));
  const [strokes, setStrokes] = useState(() => (bet?.strokes?.to ? { to: bet.strokes.to, count: bet.strokes.count || 1 } : null));
  const [pad, setPad] = useState(false);

  const pick = id => setSides(s => {
    if (s.includes(id)) return s.filter(x => x !== id);
    return s.length < 2 ? [...s, id] : [s[0], id];
  });
  // Strokes only ever go to one of the two in the bet
  const st = strokes && sides.includes(strokes.to) ? strokes : null;
  const draft = { ...(bet || {}), kind, sides, stake, holes, label, strokes: needsScores(kind) && st ? st : undefined };
  const ready = sides.length === 2;
  const clean = ready ? cleanBet(round, draft) : null;
  const noPar3 = kind === 'ctp' && ready && !ctpHoles(round, clean).length;
  const noLabel = kind === 'custom' && !cleanBetLabel(label);
  const suggest = ready && needsScores(kind) ? suggestedStrokes(round, sides[0], sides[1]) : null;

  // Holes: the whole round, from the next hole on (once holes are played), each nine, or what the bet already has
  const range = (f, t) => ({ value: `${f}-${t}`, f, t });
  const noOf = pos => round.holes[pos - 1]?.no ?? pos;
  const options = [{ ...range(1, n), label: 'Whole round' }];
  if (fromPos > 1 && fromPos <= n) options.push({ ...range(fromPos, n), label: `From hole ${noOf(fromPos)}` });
  // Each nine by hole number (a round that starts on 10 plays the back nine first), once it's not all played
  for (const [which, label] of [['front', 'Front 9'], ['back', 'Back 9']]) {
    const r = n === 18 ? nineRange(round, which) : null;
    if (r && r[1] >= fromPos && !options.some(o => o.value === `${r[0]}-${r[1]}`)) options.push({ ...range(r[0], r[1]), label });
  }
  const cur = `${holes[0]}-${holes[1]}`;
  if (!options.some(o => o.value === cur)) options.push({ ...range(holes[0], holes[1]), label: holes[0] === holes[1] ? `Hole ${noOf(holes[0])}` : `Holes ${noOf(holes[0])}–${noOf(holes[1])}` });
  const holesN = holes[1] - holes[0] + 1;

  const save = () => { if (clean && !noPar3 && !noLabel) onSave(clean); };
  const editing = !!bet;
  return (
    <>
      <Sheet open={!pad} onClose={onClose} title={editing ? 'Change side bet' : 'Add a side bet'}>
        <p className="sheet-text">Just between two players. {needsScores(kind) ? 'Strokes here count only in this bet, never in the group’s games.' : 'It rides along with the round’s games.'}</p>
        {/* A points or reward round: side bets count in points with everything else, so nothing goes on the Tab */}
        {!countsMoney(round) && <p className="field-help pad">{noMoneyNote(round)} Side bets count in points, like the games.</p>}
        <div className="pb-edit">
          <div className="field-label" id="pb-kind">What’s the bet</div>
          <div className="chip-row flush" role="radiogroup" aria-labelledby="pb-kind">
            {kinds.map(k => (
              <button key={k} role="radio" aria-checked={kind === k} className={`pill-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                <Icon name={BET_KINDS[k].icon} fill={kind === k} /> {BET_KINDS[k].label}
              </button>
            ))}
          </div>
          <p className="field-help pb-help">{inUnits(round, BET_KINDS[kind].help)}</p>

          {kind === 'custom' && (
            <>
              <label className="field-label" htmlFor="pb-label">Call it</label>
              <input id="pb-label" className="name-input" value={label} maxLength={BET_LABEL_MAX} autoComplete="off" enterKeyHint="done"
                placeholder="e.g. Longest drive on 7" onChange={e => setLabel(e.target.value)} />
            </>
          )}

          <div className="field-label" id="pb-who">Between <span className="opt">· pick two</span></div>
          <div className="chip-row flush" role="group" aria-labelledby="pb-who">
            {round.players.map(p => {
              const on = sides.includes(p.id);
              return <button key={p.id} aria-pressed={on} className={`pill-btn ${on ? 'on' : ''}`} onClick={() => pick(p.id)}>{on && <Icon name="check" />} {p.name}</button>;
            })}
          </div>

          <div className="field-label" id="pb-stake">{kind === 'match' ? 'For' : kind === 'hole' ? 'A hole' : kind === 'ctp' ? 'A par 3' : 'For'}</div>
          <div className="chip-row flush" role="radiogroup" aria-labelledby="pb-stake">
            {QUICK.map(v => (
              <button key={v} role="radio" aria-checked={stake === v} className={`pill-btn ${stake === v ? 'on' : ''}`} onClick={() => setStake(v)}>{fmt(v)}</button>
            ))}
            <button className={`pill-btn ${QUICK.includes(stake) ? '' : 'on'}`} onClick={() => setPad(true)}>{QUICK.includes(stake) ? 'Other' : fmt(stake)}</button>
          </div>

          <div className="field-label" id="pb-holes">Holes</div>
          <Segmented label="Holes" className="press-mode-row game-pick" btn="pm-btn" value={cur}
            onChange={v => { const o = options.find(x => x.value === v); if (o) setHoles([o.f, o.t]); }} options={options} />
          {noPar3 && <p className="field-error">No par 3s in these holes. Pick other holes.</p>}

          {needsScores(kind) && ready && (
            <>
              <div className="field-label" id="pb-strokes">Strokes <span className="opt">· just between these two</span></div>
              <Segmented label="Strokes" className="press-mode-row game-pick" btn="pm-btn" value={st?.to ?? 'none'}
                onChange={v => setStrokes(v === 'none' ? null : { to: v, count: st?.count || suggest?.count || 1 })}
                options={[{ value: 'none', label: 'None' }, ...sides.map(id => ({ value: id, label: `${nameIn(round, id)} gets` }))]} />
              {st && (
                <div className="pb-count">
                  <button className="icon-btn sm" disabled={st.count <= 1} onClick={() => setStrokes({ ...st, count: st.count - 1 })} aria-label="One stroke fewer"><Icon name="minus" /></button>
                  <span className="pb-count-n" aria-live="polite">{st.count} stroke{st.count === 1 ? '' : 's'}</span>
                  <button className="icon-btn sm" disabled={st.count >= MAX_BET_STROKES} onClick={() => setStrokes({ ...st, count: st.count + 1 })} aria-label="One stroke more"><Icon name="plus" /></button>
                </div>
              )}
              {st && <p className="field-help">{st.count >= holesN
                ? `${nameIn(round, st.to)} gets a stroke on every hole${st.count > holesN ? ', and two on the hardest' : ''}.`
                : `On the ${st.count === 1 ? 'hardest hole' : `${st.count} hardest holes`} by HCP${holesN < n ? ' of these holes' : ''}.`}</p>}
              {suggest && !(st && st.to === suggest.to && st.count === suggest.count) && (
                <button className="quiet-row flush pb-suggest" onClick={() => setStrokes({ ...suggest })}>
                  <Icon name="scales" /> <span><u>From their handicaps:</u> {nameIn(round, suggest.to)} gets {suggest.count}</span>
                </button>
              )}
            </>
          )}
        </div>
        {clean && <p className="field-help pad pb-sum">{betLine(round, clean, fmt)}</p>}
        <div className="cta-wrap">
          <button className="full-btn" disabled={!ready || noPar3 || noLabel} onClick={save}>
            {!ready ? 'Pick two players' : noLabel ? 'Give it a name' : editing ? 'Save bet' : 'Add the bet'}
          </button>
          {onRemove && <button className="danger-link" onClick={onRemove}><Icon name="trash" /> Remove this bet</button>}
        </div>
      </Sheet>
      <Numpad open={pad} title={`${BET_KINDS[kind].label} bet`} {...unit} initial={stake} min={1} max={BET_MAX}
        onClose={() => setPad(false)} onDone={v => { setStake(v); setPad(false); }} />
    </>
  );
}

/** One bet in a list: what it is, who's in it, and (in a round) where it stands. */
function BetRow({ round, bet, result = null, onTap = null }) {
  const fmt = unitFmt(round);
  const Box = onTap ? 'button' : 'div';
  const meta = BET_KINDS[bet.kind];
  const sub = [betStakeText(bet, fmt), ...betLine(round, bet, fmt).split(' · ').slice(2)].join(' · ');
  // Nothing won yet says so once ("All square"), never "All square · Square"
  const status = result ? `${betStatusText(round, result)}${result.amount ? ` · ${betMoneyText(round, result, fmt)}` : ''}` : null;
  return (
    <Box className={`set-row pb-row ${onTap ? '' : 'static'}`} {...(onTap ? { onClick: onTap, 'aria-label': `${betName(bet)}, ${betPeople(round, bet)}: ${sub}${status ? `. ${status}` : ''}. Change` } : {})}>
      <div className="set-icon"><Icon name={meta.icon} fill /></div>
      <div className="row-main">
        <div className="set-name">{betName(bet)} · {betPeople(round, bet)}</div>
        <div className="set-sub">{sub}</div>
        {status && <div className="set-sub pb-status">{status}</div>}
      </div>
      {onTap && <span className="chevron"><Icon name="caret-right" /></span>}
    </Box>
  );
}

/**
 * The side bets part of setup's Bets step. `round` is a round-shaped draft (game, players, holes,
 * playFor); `bets` the list so far and `setBets` its setter.
 */
export function PairBetsSetup({ round, bets, setBets }) {
  const [editing, setEditing] = useState(null); // 'new' or a bet id
  const list = betsOf({ ...round, bets });
  const bet = editing && editing !== 'new' ? bets.find(b => b.id === editing) : null;
  const close = () => setEditing(null);
  if (round.players.length < 2) return null;
  return (
    <>
      <div className="sec-label">Side bets</div>
      {list.map(b => <BetRow key={b.id} round={round} bet={b} onTap={() => setEditing(b.id)} />)}
      {list.length < MAX_BETS && (
        <button className="set-row add-side" onClick={() => setEditing('new')}>
          <div className="set-icon"><Icon name="plus" /></div>
          <div className="row-main"><div className="set-name">Add a side bet</div><div className="set-sub">Two players, their own bet: a match, per hole, closest to the pin or your own</div></div>
        </button>
      )}
      {editing && (
        <BetEditor round={round} bet={bet} onClose={close}
          onSave={b => { setBets(l => (bet ? l.map(x => (x.id === bet.id ? b : x)) : [...l, b])); close(); }}
          onRemove={bet ? () => { setBets(l => l.filter(x => x.id !== bet.id)); close(); } : null} />
      )}
    </>
  );
}

/**
 * "Side bets" from the round menu: every bet in the round and where it stands. The phone keeping
 * score can add one (from the next hole on, or the whole round), change it or take it off.
 */
export function PairBetsSheet({ round, editable, onClose }) {
  const { showToast } = useUI();
  const [editing, setEditing] = useState(null);
  const { list } = betsMoney(round);
  const from = nextPos(round);
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const bet = editing && editing !== 'new' ? betsOf(round).find(b => b.id === editing) : null;
  const fmt = unitFmt(round);
  const write = fn => update(s => { const r = s.rounds[round.id]; if (r) s.rounds[round.id] = fn(r); });
  const save = b => {
    write(r => (bet ? changeBet(r, bet.id, b) : addBet(r, b)));
    setEditing(null);
    showToast(inUnits(round, bet ? `Side bet updated · ${betLine(round, b, fmt)}` : `Side bet on · ${betLine(round, b, fmt)}`));
    buzz(20);
  };
  const remove = () => {
    const was = structuredClone(round.bets || []);
    // Undo puts back what was agreed too, so What we agreed doesn't list it dropped and added again
    const agreedWas = round.agreed ? structuredClone(round.agreed) : null;
    write(r => removeBet(r, bet.id));
    setEditing(null);
    showToast('Side bet taken off', { label: 'Undo', run: () => write(r => ({ ...r, bets: was, ...(agreedWas ? { agreed: agreedWas } : {}) })) });
  };
  return (
    <>
      <Sheet open={!editing} onClose={onClose} title="Side bets" className="sc-sheet">
        <p className="sheet-text">
          Bets between two players, on top of the round’s games. {played ? 'A new one counts from the next hole unless you pick the whole round.' : 'Their strokes count only in their bet.'}
          {!editable ? ' The scorekeeper adds and changes them.' : ''}
        </p>
        {!list.length && <p className="hint-card"><Icon name="hand-coins" fill /> No side bets yet.{editable ? ' Two players can add their own match, a bet a hole, closest to the pin or anything else.' : ''}</p>}
        {list.map(r => <BetRow key={r.id} round={round} bet={r.bet} result={r} onTap={editable ? () => setEditing(r.id) : null} />)}
        {editable && list.length < MAX_BETS && (
          <button className="set-row add-side" onClick={() => setEditing('new')}>
            <div className="set-icon"><Icon name="plus" /></div>
            <div className="row-main"><div className="set-name">Add a side bet</div><div className="set-sub">{played ? `From hole ${round.holes[from - 1]?.no ?? from} on, or the whole round` : 'For the whole round, or some of it'}</div></div>
          </button>
        )}
        <div className="cta-wrap"><button className="full-btn outline" onClick={onClose}>Done</button></div>
      </Sheet>
      {editing && (
        <BetEditor round={round} bet={bet} fromPos={played ? from : 1} onClose={() => setEditing(null)} onSave={save} onRemove={bet ? remove : null} />
      )}
    </>
  );
}

/**
 * The side bets on the hole being played: the scorekeeper taps who was closest on a par 3 or who
 * won a custom bet, and everyone sees each match or per-hole bet that covers this hole.
 */
export function HoleBets({ round, hole, editable }) {
  const tap = betsToTap(round, hole);
  const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
  const running = betsOf(round).filter(b => {
    if (!needsScores(b.kind)) return false;
    const [f, t] = betRange(round, b);
    return pos >= f && pos <= t;
  });
  if (!tap.length && !running.length) return null;
  const fmt = unitFmt(round);
  const set = (b, pid) => {
    update(s => { const r = s.rounds[round.id]; if (r) s.rounds[round.id] = setBetWinner(r, b.id, hole.no, pid); });
    buzz(10);
  };
  return (
    <div className="block hole-bets" role="group" aria-label="Side bets on this hole">
      <div className="eyebrow">Side bets</div>
      {running.map(b => {
        const r = betResult(round, b);
        return (
          <div key={b.id} className="hb-line">
            <span className="hb-what">{betName(b)} · {betPeople(round, b)}</span>
            <span className="hb-state">{betStatusText(round, r)}{r.amount ? ` · ${betMoneyText(round, r, fmt)}` : ''}</span>
          </div>
        );
      })}
      {tap.map(b => {
        const won = b.kind === 'ctp' ? b.winners?.[hole.no] ?? null : b.winner ?? null;
        const q = b.kind === 'ctp' ? `Closest to the pin · ${fmt(b.stake)}` : `${betName(b)} · ${fmt(b.stake)}`;
        return (
          <div key={b.id} className="hb-tap">
            <div className="hb-q">{q}<span className="hb-who">{betPeople(round, b)}</span></div>
            {editable ? (
              <div className="chip-row flush" role="radiogroup" aria-label={`${q}: who ${b.kind === 'ctp' ? 'was closest' : 'won'}`}>
                {b.sides.map(id => (
                  <button key={id} role="radio" aria-checked={won === id} className={`pill-btn ${won === id ? 'on' : ''}`} onClick={() => set(b, won === id ? null : id)}>
                    {won === id && <Icon name="check" />} {nameIn(round, id)}
                  </button>
                ))}
                {b.kind === 'ctp' && (
                  <button role="radio" aria-checked={won == null} className={`pill-btn ${won == null ? 'on' : ''}`} onClick={() => set(b, null)}>Neither</button>
                )}
              </div>
            ) : (
              <div className="hb-state">{won ? `${nameIn(round, won)} ${b.kind === 'ctp' ? 'was closest' : 'won'}` : b.kind === 'ctp' ? 'Not tapped yet' : 'Not decided yet'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Each side bet's result, for the round's full breakdown. `g` is roundResults().detail.byGame.bets. */
export function BetsBreakdown({ round, g }) {
  const fmt = unitFmt(round);
  if (!g?.detail?.bets?.length) return null;
  return (
    <>
      <div className="sec-label">Side bets</div>
      {g.detail.bets.map(r => (
        <div key={r.id} className="set-row static pb-row">
          <div className="set-icon"><Icon name={BET_KINDS[r.kind].icon} fill /></div>
          <div className="row-main">
            <div className="set-name">{r.label} · {betPeople(round, r.bet)}</div>
            <div className="set-sub">{betStakeText(r.bet, fmt)} · {betStatusText(round, r)}</div>
          </div>
          <div className={`pb-amt ${r.amount ? 'pos' : ''}`}>{betMoneyText(round, r, fmt)}</div>
        </div>
      ))}
      {!countsMoney(round) && <p className="field-help pad">{noMoneyNote(round)} Side bets count in points, like the games.</p>}
    </>
  );
}
