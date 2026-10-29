// Setup's players step (NewRound.jsx): crews, handicaps on or off, each player's tees and HCP, the
// ⋯ menu (Just playing, take out), and adding a player (also used by the Big Game's setup).
import { useMemo, useState } from 'react';
import { Icon, Numpad, PickMark, Segmented, Sheet, Toggle, useUI } from '../../components/ui.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { update, uid, useStore } from '../../lib/store.js';
import { defaultTee as firstTee, teeDotStyle } from '../../lib/courses.js';
import { effectiveCourseHc, holesInPlay } from '../../lib/round.js';
import { JUST_PLAYING, canJustPlay, cantJustPlay, justPlayingWho, maxPicked, pickedCheck, pickedLine } from '../../lib/just-playing.js';
import { formatIndex, playerLabel, sortedPlayers } from '../../lib/format.js';
import { listNames } from '../../lib/setup-screen.js';

export function PlayersStep({ game, gameKey, course, holesCount, nine, picked, setPicked, tees, setTees, hcOverride, setHcOverride, justPlaying = [], setJustPlaying, useHc, setUseHc, noHandicaps = false, onNext, nextLabel = null }) {
  const state = useStore();
  const { showToast } = useUI();
  const players = sortedPlayers(state);
  const crews = Object.values(state.crews);
  const [adding, setAdding] = useState(false);
  const [indexFor, setIndexFor] = useState(null);
  const [teeFor, setTeeFor] = useState(null);
  const [moreFor, setMoreFor] = useState(null);
  const teeOf = pid => course.tees?.find(t => t.name === (tees[pid] || firstTee(course)?.name)) || firstTee(course);
  const holes = useMemo(() => holesInPlay(course, holesCount, nine), [course, holesCount, nine]);
  // Past the game's own cap when the extra people can be just playing (just-playing.js)
  const most = maxPicked(gameKey);
  const casualOk = canJustPlay(gameKey);
  const casualNow = casualOk ? picked.filter(pid => justPlaying.includes(pid)) : [];
  const toggleCasual = pid => setJustPlaying(l => (l.includes(pid) ? l.filter(x => x !== pid) : [...l, pid]));

  const toggle = pid => setPicked(p => {
    if (p.includes(pid)) return p.filter(x => x !== pid);
    // Past the game's own cap the extra people are just playing, so the cap is the round's, not the game's
    if (p.length >= most) { showToast(most > game.max ? `A round is for up to ${most} players` : `${game.name} takes up to ${most} players`); return p; }
    return [...p, pid];
  });
  const pickCrew = c => {
    const ids = c.playerIds.filter(id => state.players[id]);
    const merged = [...new Set([...picked, ...ids])];
    if (merged.length > most) { showToast(game.min === game.max && most === game.max ? `${game.name} is for exactly ${game.max}. Remove someone first` : most > game.max ? `A round is for up to ${most} players. Remove someone first` : `${game.name} takes up to ${most} players. Remove someone first`); return; }
    setPicked(merged);
  };
  const check = pickedCheck(gameKey, picked, justPlaying);
  const valid = check.valid;
  const needText = check.text;

  const showHc = useHc && !noHandicaps;
  // Someone just playing gets no strokes, so their handicap never matters
  const noHc = showHc ? picked.filter(pid => !justPlaying.includes(pid) && courseHc(pid).source === 'none') : [];
  const bettingCount = picked.length - justPlaying.length;
  function courseHc(pid) {
    const p = state.players[pid];
    const tee = course.tees?.find(t => t.name === (tees[pid] || firstTee(course)?.name));
    return effectiveCourseHc(p.index, tee, course, holes, holesCount, hcOverride[pid]);
  }

  return (
    <>
      <div className="scroll">
        {crews.length > 0 && (
          <>
            <div className="sec-label">Crews</div>
            <div className="chip-row">
              {crews.map(c => <button key={c.id} className="pill-btn" onClick={() => pickCrew(c)}><Icon name="users-three" fill /> {c.name}</button>)}
            </div>
          </>
        )}
        {!noHandicaps && (
          <div className="block hc-choice">
            <div className="eyebrow" id="hc-q" style={{ marginBottom: 10 }}>Play with handicaps?</div>
            <Segmented label="Play with handicaps" value={useHc ? 'on' : 'off'} onChange={v => setUseHc(v === 'on')}
              options={[{ value: 'off', label: 'No, play even' }, { value: 'on', label: 'Yes' }]} />
            <p className="field-help">{useHc ? 'Better players give strokes on the hardest holes. Check each handicap below.' : 'Everyone plays straight up, no strokes.'}</p>
          </div>
        )}
        <div className="sec-label">Players · {pickedLine(gameKey, picked, justPlaying)}</div>
        {/* Who's in, by name: picked rows stay where they are in the list (so nothing jumps under a
            tap), and this line saves scrolling the whole list to check */}
        {picked.length > 0 && <p className="field-help pad pk-in">In: {listNames(picked.map(pid => (pid === state.me ? 'you' : (state.players[pid]?.name || '?').split(' ')[0])))}</p>}
        {/* Up top, not under the list, so it's seen before Next (Trevor 2026-10-14) */}
        {noHc.length > 0 && (
          <p className="hint-card warn nohc-top"><Icon name="warning" fill /> {noHc.length === bettingCount
            ? 'Nobody has a handicap yet, so nobody gets strokes. Tap Add HCP on each player to set one.'
            : `${listNames(noHc.map(pid => state.players[pid]?.name || '?'))} ${noHc.length === 1 ? 'has' : 'have'} no handicap, so they play as scratch (0) and everyone else gets strokes from them. Tap Add HCP to set one.`}</p>
        )}
        {/* Who's just playing is said here, so the count above stays on one line */}
        {/* Most people in a round are betting, so Just playing lives in each player's ⋯ menu and only
            gets a line here once someone is (Trevor 2026-10-14) */}
        {casualNow.length > 0 && <p className="field-help pad jp-step-help">{justPlayingWho(casualNow, state.me, pid => state.players[pid]?.name)} just playing: on the card with everyone and out of every game.</p>}
        <div className="pick-list">
          {players.map(p => {
            const on = picked.includes(p.id);
            const casual = on && justPlaying.includes(p.id);
            return (
              <div key={p.id} className={`list-item pick player-pick ${on ? 'on' : ''}`}>
                <button className="pick-main" onClick={() => toggle(p.id)} aria-pressed={on}>
                  <Avatar id={p.id} name={p.name} />
                  <div className="row-main">
                    <div className="li-name">{playerLabel(p, state.me)}</div>
                    {/* Once picked, the HCP chip below says it, so the line only shows on the people not in yet */}
                    {(casual || !on || noHandicaps) && <div className="li-sub">{casual ? JUST_PLAYING : p.index == null ? 'No HCP' : `HCP ${formatIndex(p.index)}`}</div>}
                  </div>
                  <PickMark on={on} />
                </button>
                {on && (
                  <div className="pick-extra">
                    {/* One tee for the group is the usual, so it's a quiet dropdown, not a chip per tee (Trevor, 2026-10-14) */}
                    {course.tees?.length > 1 && (() => {
                      const cur = teeOf(p.id);
                      return (
                        <button className="hc-chip tee-select" onClick={() => setTeeFor(p.id)} aria-haspopup="dialog" aria-label={`${p.name}’s tees: ${cur.name}. Change them`}>
                          <span className="tee-dot" style={teeDotStyle(cur)} />{cur.name} tees <Icon name="caret-down" />
                        </button>
                      );
                    })()}
                    {/* Their index, set or fixed right here and kept on the player for next time, for friends without an account */}
                    {!noHandicaps && !casual && (
                      <button className={`hc-chip ${p.index == null && showHc ? 'missing' : ''}`} onClick={() => setIndexFor(p.id)}
                        aria-label={p.index == null ? `${p.name}’s handicap: add one` : `${p.name}’s handicap ${formatIndex(p.index)}. Change it`}>
                        {p.index == null ? <>Add HCP <Icon name="plus" /></> : <>HCP <strong>{formatIndex(p.index)}</strong> <Icon name="pencil-simple" /></>}
                      </button>
                    )}
                    {/* The rarer things for this player, out of the way in the corner */}
                    <button className="icon-btn sm player-more" onClick={() => setMoreFor(p.id)} aria-haspopup="dialog" aria-label={`More for ${p.name}`}><Icon name="dots-three" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-row" aria-label="Add a player" onClick={() => setAdding(true)}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a player</span></button>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!valid} onClick={onNext}>{valid ? <>{nextLabel || 'Next: Bets'} <Icon name={nextLabel ? 'check' : 'arrow-right'} /></> : needText}</button>
      </div>
      <QuickAddPlayer open={adding} onClose={() => setAdding(false)} onAdded={pid => { setAdding(false); if (picked.length < most) setPicked([...picked, pid]); }} />
      <PlayerMore pid={moreFor} onClose={() => setMoreFor(null)} name={moreFor === state.me ? 'You' : state.players[moreFor]?.name}
        casual={justPlaying.includes(moreFor)} canCasual={casualOk && (bettingCount > 1 || justPlaying.includes(moreFor))} whyNot={(casualOk ? 'Needs someone else betting first' : cantJustPlay(gameKey)) || 'Not in this game'}
        onCasual={() => toggleCasual(moreFor)} onRemove={() => { toggle(moreFor); setMoreFor(null); }} />
      {/* The tees as our own sheet, not the phone's wheel (Trevor 2026-10-14) */}
      <Sheet open={!!teeFor} onClose={() => setTeeFor(null)} title={teeFor === state.me ? 'Your tees' : `${state.players[teeFor]?.name}’s tees`}>
        <div className="tee-sheet" role="radiogroup" aria-label={`${state.players[teeFor]?.name}’s tees`}>
          {teeFor && course.tees.map(t => {
            const on = teeOf(teeFor).name === t.name;
            return (
              <button key={t.name} className={`list-item pick ${on ? 'on' : ''}`} role="radio" aria-checked={on} onClick={() => { setTees({ ...tees, [teeFor]: t.name }); setTeeFor(null); }}>
                <span className="tee-dot" style={teeDotStyle(t)} />
                <div className="row-main">
                  <div className="li-name">{t.name}</div>
                  <div className="li-sub">{t.slope ? [t.rating != null ? `Rating ${t.rating}` : null, `Slope ${t.slope}`].filter(Boolean).join(' · ') : 'No rating or slope on file'}</div>
                </div>
                <PickMark on={on} add={false} />
              </button>
            );
          })}
        </div>
      </Sheet>
      <Numpad open={!!indexFor} title={`${state.players[indexFor]?.name}’s handicap`} initial={indexFor ? state.players[indexFor]?.index ?? '' : ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setIndexFor(null)} onDone={v => {
          const pid = indexFor;
          // A new index replaces any course handicap typed in for this round, so the strokes follow it
          update(s => { if (s.players[pid]) s.players[pid].index = v; });
          if (hcOverride[pid] != null) { const { [pid]: _gone, ...rest } = hcOverride; setHcOverride(rest); }
          setIndexFor(null);
        }} />
    </>
  );
}

/** A picked player's ⋯ menu on the Players step: Just playing, and taking them out of the round. */
function PlayerMore({ pid, onClose, name, casual, canCasual, whyNot, onCasual, onRemove }) {
  return (
    <Sheet open={!!pid} onClose={onClose} title={name}>
      <div className="toggle-row pm-row">
        <div><div className="toggle-lbl" id="pm-jp">{JUST_PLAYING}</div><div className="toggle-sub" id="pm-jp-sub">{canCasual ? 'On the card with everyone, out of every game and bet' : whyNot}</div></div>
        <Toggle on={casual} onChange={onCasual} labelledBy="pm-jp" describedBy="pm-jp-sub" disabled={!canCasual} />
      </div>
      <div className="menu-group pm-group">
        <button className="menu-row danger" onClick={onRemove}><Icon name="user-minus" /><span className="mr-label">Take out of this round</span></button>
      </div>
    </Sheet>
  );
}

export function QuickAddPlayer({ open, onClose, onAdded }) {
  const state = useStore();
  const [name, setName] = useState('');
  const [index, setIndex] = useState(null);
  const [pad, setPad] = useState(false);
  const t = name.trim();
  const dup = Object.values(state.players).some(p => p.name.toLowerCase() === t.toLowerCase());
  const add = () => {
    const id = uid('p_');
    update(s => { s.players[id] = { id, name: t, index, venmo: '', createdAt: Date.now() }; });
    setName(''); setIndex(null);
    onAdded(id);
  };
  return (
    <>
      <Sheet open={open && !pad} onClose={onClose} title="Add a player">
        <div style={{ padding: '8px 16px 0' }}>
          <label className="field-label" htmlFor="qa-name">Name</label>
          <input id="qa-name" className="name-input" value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Name" autoFocus
            aria-invalid={dup || undefined} aria-describedby={dup ? 'qa-name-err' : undefined} />
          {dup && <p className="field-error" id="qa-name-err" role="status">Someone already has that name. Add an initial.</p>}
          <div className="field-label">Handicap <span className="opt">optional</span></div>
          <button className="amt-btn" onClick={() => setPad(true)} aria-label={index == null ? 'Handicap: add one' : `Handicap ${formatIndex(index)}. Change it`}>{index == null ? 'Add' : formatIndex(index)}</button>
          <p className="field-help">Their 18-hole handicap (HCP). We halve it for 9 holes.</p>
          <div style={{ marginTop: 16 }}><button className="full-btn" disabled={!t || dup} onClick={add}>Add to round</button></div>
        </div>
      </Sheet>
      <Numpad open={pad} title="Handicap" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </>
  );
}
