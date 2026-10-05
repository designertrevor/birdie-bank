// What a quick jab can be about (talk.js JABS): a birdie or a three-putt in the round, how it went
// for you, a settle-up line still owed or paid, and where a challenge stands. Each function returns
// the moments for one thing, most fitting first, and the jab picker puts their jabs ahead of the
// thing's own list. Only ever read from what this phone already shows the person looking: a loss is
// their own, a line's paid state is the one on their round's page. No amounts, ever, and nothing
// here touches money. Pure, unit tested in jabs.test.js.
import { oneBall, roundResults, scoreSummary, scorers } from './round.js';
import { tabResults } from './play-for.js';
import { cents, codeOf, nettedOn, paidOn } from './pair-debts.js';
import { challengeState } from './challenges.js';

/** Whether anyone in a round made a birdie or better (a one-ball game's scores are a team's, so not there). */
export function anyBirdie(round) {
  if (!round?.holes || oneBall(round.game)) return false;
  return scorers(round).some(p => { const s = scoreSummary(round, p.id); return s.birdies + s.eagles > 0; });
}

/** Whether anyone three-putted, as marked for a Snake game. */
export function anyThreePutt(round) {
  return Object.values(round?.marks || {}).some(m => Array.isArray(m?.snake) && m.snake.length > 0);
}

/**
 * The moments on a finished round for `who` (your seat, or null when you only watched): how it
 * went for you ('win' or 'loss', in money, points or the reward, never shown), then 'birdie' and
 * 'threePutt' when someone made one. `res`: roundResults(round), when you have it.
 */
export function roundMoments(round, who, res = null) {
  if (!round?.players) return [];
  const out = [];
  if (who && round.players.some(p => p.id === who)) {
    const bal = (res || roundResults(round)).balances?.[who] || 0;
    if (bal > 0) out.push('win');
    else if (bal < 0) out.push('loss');
  }
  if (anyBirdie(round)) out.push('birdie');
  if (anyThreePutt(round)) out.push('threePutt');
  return out;
}

/**
 * Whether a settle-up line of a round (`from` pays `to`) is paid: marked paid in full on this
 * phone (or the shared Tab), or netted into a payment with the rest of the Tab. A line that isn't
 * on the Tab any more (the round changed) reads as paid, so nobody is told to pay what isn't owed.
 */
export function linePaid(state, round, from, to) {
  const t = tabResults(round).transfers.find(x => x.from === from && x.to === to);
  if (!t) return true;
  const code = codeOf(round);
  if (code && nettedOn(state, code, t)) return true;
  return paidOn(state, round, code, t) >= cents(t.amount);
}

/**
 * The moments on a settle-up line: 'paid' once it is, else 'owing' when `who` (your seat) is the
 * one who pays ("Check’s in the mail"), or 'owed' for everyone else ("Pay up, partner").
 */
export function settleMoments(state, round, from, to, who = null) {
  if (linePaid(state, round, from, to)) return ['paid'];
  return [who && who === from ? 'owing' : 'owed'];
}

/**
 * The moments on a challenge: waiting on an answer, agreed (or in the round), or passed. While it
 * waits, `side` ('from' or 'to', yours) whose call it is gets 'chAsked' ("Let me check my
 * calendar"); whoever asked, or set it up, gets 'chOpen' ("Tick tock. In or out?").
 */
export function challengeMoments(ch, side = null) {
  if (!ch) return [];
  const st = challengeState(ch);
  const s = st.status;
  if (s === 'open' || s === 'countered') return [side && (st.turn === side || st.turn === 'both') ? 'chAsked' : 'chOpen'];
  if (s === 'accepted' || s === 'on') return ['chAccepted'];
  if (s === 'declined') return ['chDeclined'];
  return [];
}
