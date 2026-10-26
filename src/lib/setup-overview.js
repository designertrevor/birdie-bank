// Round setup's overview (src/screens/newround/OverviewStep.jsx, Layout Lab A "Summary first"): one
// row for each choice with what's picked and a Change button, and what still stops Create round.
// Every step returns here. Display only: the round itself is built from the same picks in setup-round.js.
import { GAMES, holesInPlay, oneBall } from './round.js';
import { pickedCheck } from './just-playing.js';
import { optionsProblem, roundStakeLines, stakeSummary } from './stakes.js';
import { teamsCfg, teamsProblem } from './teams.js';
import { hcPctLabel } from './format.js';
import { halfStrokesOffered, pctsDiffer } from './allowances.js';
import { houseRulesFor } from './agreed.js';
import { inUnits, playForShort } from './play-for.js';

// Setup's screens by number: the four steps (0 to 3) and Round ready (4) as before, then the
// overview and the two choices that only the overview opens on their own
export const OVERVIEW = 5;
export const HANDICAPS_STEP = 6;
export const PLAY_FOR_STEP = 7;

const firstName = n => String(n || '').trim().split(/\s+/)[0] || '?';
const names = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

/**
 * Best two only counts with teams of three or four (createRound sets a pairs round back to best ball),
 * so the bet line says how it will be played (as the Bets step does).
 */
export function shownOpts(game, opts, teams) {
  return (game === 'bestball' || game === 'shamble') && opts[game]?.count === 2 && teams?.length && Math.min(...teams.map(t => t.length)) < 3
    ? { ...opts, [game]: { ...opts[game], count: 1 } } : opts;
}

/** What stops the Bets step's choices: a bet that can't be played, or teams that don't fit. Null when fine. */
export function betsProblem({ game, opts, sides = [], teams, betting }) {
  if (!GAMES[game]) return null;
  const opt = optionsProblem(game, opts) || sides.map(sg => optionsProblem(sg.game, { [sg.game]: sg.settings })).find(Boolean);
  if (opt) return opt;
  const cfg = teamsCfg(game, opts, betting.length);
  return teamsProblem(game, teams, betting, cfg || undefined) || null;
}

/**
 * The overview's rows. `p` is setup's picks (useSetupState and friends): game, course, holesCount,
 * nine, startHole, picked, casualIds, betting, tees, defaultTee, teams, opts, sides, bets, useHc,
 * playFor, names (player id to name), and `done`: the steps the first pass has finished (an array of
 * step numbers; every step once the pass is through). Each row:
 *   { key, step, label, value, sub, state: 'set' | 'todo' | 'fix', note, open }
 * `state` 'todo' is a choice not made yet, 'fix' one that stops Create round (`note` says why), and
 * `open` whether its Change button can be tapped yet (a step needs the ones before it).
 */
export function overviewRows(p) {
  const { game, course, holesCount, nine, startHole, picked = [], casualIds = [], betting = [], tees = {}, defaultTee = null, teams = null,
    opts = {}, sides = [], bets = [], useHc = false, playFor = null, done = [] } = p;
  const nameOf = pid => p.names?.[pid] || '?';
  const g = GAMES[game];
  const check = pickedCheck(game, picked, casualIds);
  const rows = [];

  rows.push({ key: 'game', step: 0, label: 'Game', value: g ? g.name : null, sub: g ? g.blurb : 'Skins, Nassau, Wolf and more', state: g ? 'set' : 'todo', open: true });

  // The course with the tees, holes and where it starts
  let courseSub = null;
  if (course) {
    const used = [...new Set(picked.map(pid => tees[pid] || defaultTee).filter(Boolean))];
    const holes = holesInPlay(course, holesCount, nine);
    const first = holes.some(h => h.no === startHole) ? startHole : holes[0]?.no;
    courseSub = [
      used.length === 1 ? `${used[0]} tees` : used.length > 1 ? 'Mixed tees' : null,
      `${holesCount} holes`,
      holesCount === 9 && course.holes.length === 18 ? `${nine === 'back' ? 'Back' : 'Front'} 9` : null,
      first !== holes[0]?.no ? `Starts on ${first}` : null,
    ].filter(Boolean).join(' · ');
  }
  rows.push({ key: 'course', step: 1, label: 'Course', value: course?.name || null, sub: courseSub || 'Tees and holes too', state: course ? 'set' : 'todo', open: !!g });

  // The players, anyone just playing, and the teams or sides
  const playersDone = done.includes(2);
  const teamLine = teams?.length && teamsCfg(game, opts, betting.length) ? teams.map(t => names(t.map(pid => firstName(nameOf(pid))))).join(' v ') : null;
  rows.push({
    key: 'players', step: 2, label: 'Players',
    value: playersDone || picked.length > 1 ? names(betting.map(pid => firstName(nameOf(pid)))) : null,
    sub: [
      playersDone || picked.length > 1 ? `${betting.length} ${betting.length === 1 ? 'player' : 'players'}` : 'Your group, their tees and handicaps',
      casualIds.length ? `${names(casualIds.map(pid => firstName(nameOf(pid))))} just playing` : null,
      teamLine,
    ].filter(Boolean).join(' · '),
    state: !playersDone ? 'todo' : check.valid ? 'set' : 'fix', note: playersDone && !check.valid ? check.text : null,
    open: !!g && !!course,
  });

  // The bet, side games, side bets and the house rules that are on
  const betsDone = done.includes(3);
  const problem = betsDone ? betsProblem({ game, opts, sides, teams, betting }) : null;
  let betValue = null;
  let betSub = 'Set after the players';
  if (g && betsDone) {
    const so = shownOpts(game, opts, teams);
    betValue = inUnits({ playFor }, stakeSummary(game, so, holesCount));
    const on = houseRulesFor(game, opts[game], holesCount).filter(r => r.on).length;
    betSub = [
      ...roundStakeLines({ game, settings: so, sideGames: sides, playFor }).slice(1).map(l => l.line),
      bets.length ? `${bets.length} side ${bets.length === 1 ? 'bet' : 'bets'}` : null,
      on ? `${on} house ${on === 1 ? 'rule' : 'rules'}` : null,
    ].filter(Boolean).join(' · ') || 'No side games';
  }
  rows.push({ key: 'bets', step: 3, label: 'Bets and side games', value: betValue, sub: betSub, state: !betsDone ? 'todo' : problem ? 'fix' : 'set', note: problem, open: !!g && !!course && check.valid });

  // Handicaps: off, or on at the percentage (and half strokes)
  const noHc = game === 'bbb';
  rows.push({
    key: 'handicaps', step: HANDICAPS_STEP, label: 'Handicaps',
    value: noHc ? 'Not used' : useHc ? (pctsDiffer({ hcPct: opts.hcPct, sideGames: sides }) ? 'On, set by game' : `On, ${hcPctLabel(opts.hcPct).toLowerCase()}`) : 'Off',
    sub: noHc ? `${g.name} is played without strokes` : useHc ? [opts.halfStrokes && halfStrokesOffered(game, sides) ? 'Half strokes' : null, oneBall(game) ? 'Strokes go to each team' : 'Strokes on the hardest holes'].filter(Boolean).join(' · ') : 'Everyone plays straight up',
    state: 'set', open: !!g && !noHc,
  });

  rows.push({ key: 'playFor', step: PLAY_FOR_STEP, label: 'Playing for', value: playForShort({ playFor }), sub: playFor?.kind === 'points' ? 'Bragging rights, no money' : playFor?.kind === 'reward' ? (playFor.owes === 'everyone' ? 'The winner gets one from everyone' : 'Last place buys the winner') : 'Settles up on the Tab', state: 'set', open: true });

  return rows;
}

/** The first step the first pass still needs, for the overview's main button: 0 to 3, or null when it's through. */
export function nextStep(rows) {
  const r = rows.find(x => x.step <= 3 && x.state === 'todo');
  return r ? r.step : null;
}

/** Whether Create round can go: every step done and nothing to fix. */
export const canCreate = rows => rows.every(r => r.state === 'set');
