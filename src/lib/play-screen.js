// Pure helpers for the round in progress (src/screens/Play.jsx and src/screens/play/): no React, no
// JSX, so node tests reach them (play-screen.test.js). Moved out of Play.jsx unchanged when it was
// split up (roadmap area 25), so the screen reads the same as before.
import { holeComplete } from './round.js';
import { betsOf } from './pair-bets.js';
import { BIG_FORMAT } from './big-format.js';

/**
 * What the hole on screen is keyed by, so it remounts when any of these change on this phone or
 * another: the side games (so Junk's dots have somewhere to go), the playing order and sides (so the
 * banker or wolf follows them), the length, the hole being played, a fresh score from another phone,
 * someone leaving, coming back or being added partway through, and the hole's par being fixed (so an
 * untouched score starts from the new par).
 */
export function holeMountKey(round) {
  const cur = round.holes[Math.min(round.current, round.holes.length - 1)];
  const left = Object.entries(round.left || {}).map(e => e.join('@')).sort().join(',');
  const joined = `${round.players.length}:${Object.entries(round.joined || {}).map(e => e.join('@')).sort().join(',')}`;
  const games = (round.sideGames || []).map(sg => sg.game).join('+');
  const lineup = `${round.players.map(p => p.id).join('.')}|${(round.teams || []).map(t => t.players.join('.')).join('/')}`;
  return `${games}:${lineup}:${round.holesCount}:${round.current}:${round._remote?.[cur?.no] || 0}:${left}:${joined}:${cur?.par}`;
}

/**
 * Where "Save" takes you from the hole at `idx`: the next hole, or the first unscored hole after this
 * one when fixing an earlier score. The last hole stays put.
 */
export function nextHoleIdx(round, idx) {
  if (idx === round.holes.length - 1) return idx;
  const later = round.holes.findIndex((h, i) => i > idx && !holeComplete(round, h));
  return later === -1 ? idx + 1 : later;
}

/**
 * The next hole opens under the same button with every score at par, so a double tap on Save would
 * save that hole too. `last` is this phone's last save in the round ({ hole, at }): a tap on another
 * hole's Save within `gapMs` of it, before any score on the new hole is touched, is the same tap.
 */
export function isSameTap(last, holeNo, dirty, now, gapMs) {
  return !!last && last.hole !== holeNo && !dirty && now - last.at < gapMs;
}

/** A round with money of its own: a game with a bet, side games or side bets (a Big Game's group round starts with none). */
export function ownMoney(round) {
  return (round.sideGames?.length || 0) > 0 || betsOf(round).length > 0 || round.game !== 'stroke' || (round.settings?.stroke?.stake || 0) > 0;
}

/** A Big Game group round with no money of its own: its board is the Big Game's (BigBar), not the round's. */
export function bigBoardOnly(round) {
  return round.trip?.format === BIG_FORMAT && !ownMoney(round);
}

/**
 * Whether the screen shows the live money view: a phone watching the round (someone else has the
 * card) with Live money picked (`watch`, 'money' or 'hole'). Never on a Big Game group round with no
 * money of its own, where it would show everyone at $0 and "No money moved" on every hole: that
 * phone opens on the hole with the Big Game board on top.
 */
export function showsLiveMoney(round, editable, watch) {
  return !editable && round.status === 'active' && watch === 'money' && !bigBoardOnly(round);
}

/**
 * What the banker has riding on the hole: every bet, at 2× or 4× where it's doubled (3× or 9× on a par 3
 * that triples). With "the banker presses everyone" in play on the hole (`all`), the press back doubles the rest too.
 */
export function onTheLine(banker, f = 2, all = false) {
  return Object.entries(banker?.bets || {}).reduce((a, [pid, v]) => a + (v || 0) * (banker.doubled?.[pid] ? (banker.doubleBack ? f * f : f) : banker.doubleBack && all ? f : 1), 0);
}
