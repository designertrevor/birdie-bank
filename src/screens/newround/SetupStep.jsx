// Setup's bets step (NewRound.jsx): the summary, play for, teams or order, the house rules, side
// games, side bets, and More options (handicaps and the starting hole), then Create round.
import { useEffect, useMemo, useState } from 'react';
import { Icon, Numpad, Toggle } from '../../components/ui.jsx';
import { HouseRulesFold } from '../../components/HouseRulesFold.jsx';
import { SideGamesSetup } from '../../components/SideGames.jsx';
import { PairBetsSetup } from '../../components/PairBets.jsx';
import { GameOptions, SixesPreview, TeamPicker } from '../../components/GameOptions.jsx';
import { StrokesSetup } from '../../components/StrokesSetup.jsx';
import PlayForPicker from '../../components/PlayFor.jsx';
import { useStore } from '../../lib/store.js';
import { GAMES, effectiveCourseHc, holesInPlay, oneBall } from '../../lib/round.js';
import { justPlayingWho } from '../../lib/just-playing.js';
import { optionsProblem, roundStakeLines, stakeSummary } from '../../lib/stakes.js';
import { defaultTeams, teamsCfg, teamsProblem } from '../../lib/teams.js';
import { carriedLine, carriedQuotas, myQuotaLine } from '../../lib/quota-carry.js';
import { calcuttaEntries } from '../../lib/calcutta.js';
import { halfStrokesOffered, pctsDiffer } from '../../lib/allowances.js';
import { gameLabel, hcPctLabel } from '../../lib/format.js';
import { countsMoney, inUnits, padUnit, playForLine } from '../../lib/play-for.js';
import { challengeIdOfBet } from '../../lib/challenges.js';
import { challengeNote } from '../../lib/setup-screen.js';
import { HolePicker } from './Pickers.jsx';

export function SetupStep({ game, course, holesCount, nine, picked, setPicked, casual = [], opts, setOpts, useHc, setUseHc, startHole, setStartHole, onStart, onLater = null, teams, setTeams, sideGames = [], setSideGames, playFor = null, setPlayFor,
  tees = {}, hcOverride = {}, defaultTee = null, pairBets = [], setPairBets, tripRow = null, tripLink = null }) {
  const state = useStore();
  const [pad, setPad] = useState(null); // {path, title, min, max}
  const [holePick, setHolePick] = useState(false);
  const [more, setMore] = useState(false);
  const holes = holesInPlay(course, holesCount, nine);
  const firstHole = holes.some(h => h.no === startHole) ? startHole : holes[0].no;
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], opts);
  const move = (i, d) => setPicked(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const optsBad = !!optionsProblem(game, opts) || sideGames.some(sg => optionsProblem(sg.game, { [sg.game]: sg.settings }));
  const names = Object.fromEntries(picked.map(pid => [pid, state.players[pid]?.name || '?']));
  // Team quota (a Quota house rule) gets the team picker when it's on, starting in pairs
  const tcfg = teamsCfg(game, opts, picked.length);
  const quotaTeams = !GAMES[game].teams && !!tcfg;
  const teamsBad = !!teamsProblem(game, teams, picked, tcfg || undefined);
  useEffect(() => {
    if (quotaTeams && teamsProblem(game, teams, picked, tcfg)) setTeams(defaultTeams(game, picked, tcfg));
  }, [quotaTeams, game, teams, picked, tcfg, setTeams]);
  // The Calcutta's lots: the players, or the teams the round will be played in (calcutta.js)
  const calcuttaLots = sideGames.some(sg => sg.game === 'calcutta')
    ? calcuttaEntries({ players: picked.map(pid => ({ id: pid, name: names[pid] })), teams: tcfg ? teams : null }) : [];
  // Quotas carried from last time under "Quota moves after the round", shown before the round is made
  const carried = game === 'quota' && (opts.quota?.adjust === 'one' || opts.quota?.adjust === 'half') ? carriedQuotas(state, picked, holesCount) : {};
  // A round-shaped draft for the side bets: the players picked (with course handicaps, for the
  // strokes it suggests) and the holes in play
  const betRound = useMemo(() => {
    const inPlay = holesInPlay(course, holesCount, nine, startHole);
    const players = picked.map(pid => {
      const p = state.players[pid] || {};
      const tee = course.tees?.find(t => t.name === (tees[pid] || defaultTee)) || course.tees?.[0] || null;
      return { id: pid, name: p.name || '?', index: p.index ?? null, courseHcOverride: hcOverride[pid] ?? null, courseHc: effectiveCourseHc(p.index, tee, course, inPlay, holesCount, hcOverride[pid]).value };
    });
    // A one-ball game's teams (arrays of player ids here), so a match or per-hole bet goes between players on different teams
    return { game, players, holes: inPlay, playFor, ...(oneBall(game) && teams ? { teams } : {}) };
  }, [course, holesCount, nine, startHole, picked, state.players, tees, defaultTee, hcOverride, game, playFor, teams]);
  // Best two only counts with teams of three or four (createRound sets a pairs round back to best ball),
  // so the bet line up top says how it will be played
  const shownOpts = (game === 'bestball' || game === 'shamble') && opts[game]?.count === 2 && teams?.length && Math.min(...teams.map(t => t.length)) < 3
    ? { ...opts, [game]: { ...opts[game], count: 1 } } : opts;
  const orderLabel = { wolf: 'Tee order: the wolf moves down this list', banker: 'Playing order', sixes: 'Order: sets who partners who' }[game] || 'Playing order';

  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">{gameLabel({ game, sideGames })} · {holesCount} holes</div>
          <div className="d stake-big">{inUnits({ playFor }, stakeSummary(game, shownOpts, holesCount))}</div>
          {sideGames.length > 0 && <div className="li-sub">{roundStakeLines({ game, settings: shownOpts, sideGames, playFor }).slice(1).map(l => l.line).join(' + ')}</div>}
          {playForLine({ playFor }) && <div className="li-sub">{playForLine({ playFor })}</div>}
          <div className="li-sub">{course.name}{holesCount === 9 && course.holes.length === 18 ? ` · ${nine === 'front' ? 'Front' : 'Back'} 9` : ''} · Par {holes.reduce((a, h) => a + h.par, 0)} · {picked.length} players{casual.length ? ` + ${casual.length} just playing` : ''}</div>
        </div>
        {/* Counting it for a trip (and its cup matches) sits up top in the page, so the footer keeps to its buttons */}
        {tripRow && <div className="trip-in-setup">{tripRow}</div>}
        {casual.length > 0 && (
          <p className="hint-card jp-setup-note"><Icon name="smiley" fill /> {justPlayingWho(casual, state.me, pid => state.players[pid]?.name)} just playing: on the card, out of the bets below.</p>
        )}

        {/* Play for first, so the bets below are read the right way. Side games follow the round's choice */}
        <PlayForPicker value={playFor} onChange={setPlayFor} />

        {GAMES[game].teams && teams && (
          <>
            <div className="sec-label">{game === 'nassau' || game === 'hammer' ? 'Sides' : 'Teams'}</div>
            {GAMES[game].teams.even && <p className="field-help" style={{ padding: '0 20px' }}>Two teams the same size: 2 v 2, 3 v 3 or 4 v 4.</p>}
            <TeamPicker game={game} picked={picked} names={names} teams={teams} setTeams={setTeams} />
          </>
        )}

        {GAMES[game].order && (
          <>
            <div className="sec-label">{orderLabel}</div>
            {picked.map((pid, i) => (
              <div key={pid} className="set-row static">
                <div className="order-num">{i + 1}</div>
                <div className="row-main set-name">{state.players[pid]?.name}</div>
                <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="caret-up" /></button>
                <button className="icon-btn sm" disabled={i === picked.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="caret-down" /></button>
              </div>
            ))}
            {game === 'sixes' && <SixesPreview names={picked.map(pid => names[pid].split(' ')[0])} holesCount={holesCount} />}
          </>
        )}

        <HouseRulesFold>
          <GameOptions game={game} get={get} set={set} onAmount={(path, title, o) => setPad({ path, title, ...o })} holesCount={holesCount}
            players={picked.length || null} firstName={game === 'banker' ? state.players[picked[0]]?.name : null} inPoints={!countsMoney({ playFor })}
            teamSize={teams?.length ? Math.min(...teams.map(t => t.length)) : null} />
        </HouseRulesFold>

        {quotaTeams && teams && (
          <>
            <div className="sec-label">Quota teams</div>
            <p className="field-help" style={{ padding: '0 20px' }}>Team quota is on: partners add up their points against their quotas.</p>
            <TeamPicker game={game} picked={picked} names={names} teams={teams} setTeams={setTeams} cfg={tcfg} />
          </>
        )}
        {Object.keys(carried).length > 0 && (
          <p className="hint-card"><Icon name="target" fill /> {/* One span: the card lays its children out in a row */}
            <span>Rolling quota. {myQuotaLine(carried, state.me) && <strong>{myQuotaLine(carried, state.me)} </strong>}
              {carriedLine(carried, pid => names[pid], state.me) && `${myQuotaLine(carried, state.me) ? 'The others' : 'From last time'}: ${carriedLine(carried, pid => names[pid], state.me)}.`}
              {Object.keys(carried).length < picked.length ? ' The rest come from handicaps.' : ''}</span></p>
        )}

        <SideGamesSetup game={game} sideGames={sideGames} setSideGames={setSideGames} defaults={opts} players={picked.length || 4} playFor={playFor} holes={holes} holesCount={holesCount}
          entries={calcuttaLots} buyers={picked.map(pid => ({ id: pid, name: names[pid] }))} />

        {setPairBets && pairBets.some(b => challengeIdOfBet(b.id)) && (
          <p className="hint-card ch-setup-note"><Icon name="sword" fill /> {challengeNote(betRound, pairBets)}</p>
        )}
        {setPairBets && <PairBetsSetup round={betRound} bets={pairBets} setBets={setPairBets} />}

        <button className="set-row more-opts" onClick={() => setMore(!more)} aria-expanded={more}>
          <div className="row-main">
            <div className="set-name">More options</div>
            <div className="set-sub">{game === 'bbb' ? '' : useHc ? `Handicaps on (${pctsDiffer({ hcPct: opts.hcPct, sideGames }) ? 'set by game' : hcPctLabel(opts.hcPct).toLowerCase()}${opts.halfStrokes && halfStrokesOffered(game, sideGames) ? ', half strokes' : ''}) · ` : 'Handicaps off · '}Start on hole {firstHole}</div>
          </div>
          <span className="chevron"><Icon name={more ? 'caret-up' : 'caret-down'} /></span>
        </button>
        {more && <>
        {game !== 'bbb' && <>
        <div className="sec-label">Handicaps</div>
        <div className="toggle-row">
          <div><div className="toggle-lbl">Use handicaps</div><div className="toggle-sub">{game === 'quota' ? 'Sets each player’s quota from their course handicap' : 'Better players give strokes to the others on the hardest holes'}</div></div>
          <Toggle on={useHc} onChange={setUseHc} label="Use handicaps" />
        </div>
        {useHc && <StrokesSetup game={game} teams={teams} players={picked.length} opts={opts} set={set} sideGames={sideGames} setSideGames={setSideGames} />}
        </>}

        <div className="sec-label">Starting hole</div>
        <div className="block">
          <button className="hole-pick-btn" onClick={() => setHolePick(true)} aria-label="Starting hole">
            <span>Hole {firstHole} · Par {holes.find(h => h.no === firstHole)?.par}</span><Icon name="caret-down" />
          </button>
          <p className="field-help">Starting somewhere else? Change the first hole.</p>
        </div>
        </>}
        {tripLink}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={optsBad || teamsBad} onClick={onStart}>Create round <Icon name="arrow-right" /></button>
        {onLater && <button className="text-link cta-link" disabled={optsBad} onClick={onLater}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
      <Numpad open={!!pad} title={pad?.title} {...padUnit({ playFor })} initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
      <HolePicker open={holePick} holes={holes} value={firstHole} onClose={() => setHolePick(false)} onPick={no => { setStartHole(no); setHolePick(false); }} />
    </>
  );
}
