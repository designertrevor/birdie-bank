// Either player in a side bet can add it, change it, take it off and tap its winners, not only the
// scorekeeper (Trevor's call, 2026-10-03). The server's keeper lock (supabase/2026-09-30-keeper-lock.sql)
// drops round meta from any phone but the keeper's, so a change from another phone travels the way a
// seat request does: a record under a negative hole number (open to anyone with the link, nothing new
// on the server), which the keeper's phone applies by itself, without asking, when it comes from one
// of the two players in the bet. Until it lands, the sender's phone shows it as waiting.
//
// A record: { betAsk: { by, at, op, id, bet?, hole?, pid?, status, why? } }
// - by: the seat asking (one of the two in the bet). at: when.
// - op 'add' (bet: the new bet, with the id the sender made, so sending twice adds it once),
//   'change' (bet: the whole bet as it should be now), 'remove', or 'winner' (hole, pid: a
//   closest-to-the-pin or custom winner; pid null clears it).
// - status: 'waiting', then 'done' once the keeper's phone applied it, or 'no' with `why`.
// The sender keeps its asks in round.betAsks (this phone only, never shared): [{ no, ask, status, why? }].
// Pure, unit tested.
import { MAX_BETS, addBet, betsOf, changeBet, cleanBet, removeBet, setBetWinner } from './pair-bets.js';
import { stable } from './sync-model.js';

export const ASK_OPS = ['add', 'change', 'remove', 'winner'];
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** A bet ask as sent: { betAsk }, or null when it isn't one the keeper could apply. */
export function buildBetAsk({ by, op, id, bet = null, hole = null, pid = null }, at = Date.now()) {
  if (!isStr(by) || !ASK_OPS.includes(op) || !isStr(id)) return null;
  const ask = { by, at, op, id, status: 'waiting' };
  if (op === 'add' || op === 'change') {
    if (!isObj(bet)) return null;
    ask.bet = { ...structuredClone(bet), id };
  }
  if (op === 'winner') { ask.hole = hole; ask.pid = pid ?? null; }
  return { betAsk: ask };
}

/** The ask inside a record if it's well formed, else null (a seat request, a real hole, anything else). */
export function readBetAsk(data) {
  const a = data?.betAsk;
  if (!isObj(a) || !isStr(a.by) || !ASK_OPS.includes(a.op) || !isStr(a.id) || !['waiting', 'done', 'no'].includes(a.status)) return null;
  if ((a.op === 'add' || a.op === 'change') && !(isObj(a.bet) && Array.isArray(a.bet.sides))) return null;
  if (a.op === 'winner' && !Number.isFinite(Number(a.hole))) return null;
  const out = { by: a.by, at: Number(a.at) || 0, op: a.op, id: a.id, status: a.status };
  if (a.bet) out.bet = a.bet;
  if (a.op === 'winner') { out.hole = Number(a.hole); out.pid = isStr(a.pid) ? a.pid : null; }
  if (isStr(a.why)) out.why = a.why;
  return out;
}

/**
 * Why the keeper's phone won't apply an ask, in a few words for the sender, or null when it will:
 * it has to come from one of the two players in the bet (before and after a change), about a bet
 * the round has, and be a bet the round could take.
 */
export function betAskProblem(round, ask) {
  if (!round || round.status === 'done') return 'The round is finished';
  if (!round.players?.some(p => p.id === ask.by)) return 'Only players in the round can change a side bet';
  const had = (Array.isArray(round.bets) ? round.bets : []).find(b => b?.id === ask.id);
  const valid = had && betsOf(round).some(b => b.id === ask.id);
  const inIt = b => Array.isArray(b?.sides) && b.sides.includes(ask.by);
  if (ask.op === 'add') {
    if (had) return null; // already added: sending it twice adds it once
    if (!inIt(ask.bet)) return 'You can only add a bet you’re in';
    if ((round.bets || []).length >= MAX_BETS) return 'This round has all the side bets it can take';
    if (!betsOf({ ...round, bets: [cleanBet(round, ask.bet)] }).length) return 'That bet doesn’t fit this round';
    return null;
  }
  if (!had) return ask.op === 'remove' ? null : 'That bet is gone';
  if (!inIt(had)) return 'Only the two players in a bet can change it';
  if (ask.op === 'change') {
    if (!inIt(ask.bet)) return 'You can’t hand your bet to two other players';
    if (!betsOf({ ...round, bets: [cleanBet(round, ask.bet)] }).length) return 'That bet doesn’t fit this round';
  }
  if (ask.op === 'winner') {
    if (!valid) return 'That bet is gone';
    if (ask.pid != null && !had.sides.includes(ask.pid)) return 'The winner has to be one of the two';
    if (!round.holes?.some(h => h.no === ask.hole)) return 'That hole isn’t in the round';
  }
  return null;
}

/** The round with an ask applied (a new round; `round` is not changed). Applying one twice changes nothing more. */
export function applyBetAsk(round, ask) {
  const has = (round.bets || []).some(b => b?.id === ask.id);
  if (ask.op === 'add') return has ? round : addBet(round, { ...ask.bet, id: ask.id });
  if (!has) return round;
  if (ask.op === 'change') return changeBet(round, ask.id, { ...ask.bet, id: ask.id });
  if (ask.op === 'remove') return removeBet(round, ask.id);
  return setBetWinner(round, ask.id, ask.hole, ask.pid);
}

/**
 * Whether the round already shows what an ask asked for (the keeper's phone applied it and the round
 * came back), so the sender can stop waiting even if the answer itself never arrives.
 */
export function askSettled(round, ask) {
  const b = (round?.bets || []).find(x => x?.id === ask.id);
  if (ask.op === 'remove') return !b;
  if (!b) return false;
  if (ask.op === 'add') return true;
  if (ask.op === 'change') {
    const want = applyBetAsk({ ...round, bets: [b] }, ask).bets[0];
    return stable(want) === stable(b);
  }
  if (b.kind === 'ctp') return (b.winners?.[ask.hole] ?? null) === ask.pid;
  if (b.kind === 'custom') return ask.pid == null ? b.winner == null : b.winner === ask.pid && b.at === ask.hole;
  return true;
}

/** The asks still waiting on this phone, oldest first. */
export function waitingAsks(round) {
  return (Array.isArray(round?.betAsks) ? round.betAsks : []).filter(x => x?.status === 'waiting' && x.ask).sort((a, b) => a.ask.at - b.ask.at);
}

/** The asks the keeper's phone said no to, still to be seen on this phone. */
export function refusedAsks(round) {
  return (Array.isArray(round?.betAsks) ? round.betAsks : []).filter(x => x?.status === 'no' && x.ask);
}

/**
 * The round as this phone shows it in the side bets sheet and on the hole: with its waiting asks
 * applied, so a change shows straight away, marked as waiting (see pendingIds). Never used for money.
 */
export function withAsks(round) {
  return waitingAsks(round).reduce((r, x) => (betAskProblem(r, x.ask) ? r : applyBetAsk(r, x.ask)), round);
}

/** Ids of the bets with an ask still waiting on this phone. */
export function pendingIds(round) {
  return new Set(waitingAsks(round).map(x => x.ask.id));
}

/** This phone's asks once the round came back from the server: the ones it already shows are dropped. */
export function keepAsks(round) {
  const list = Array.isArray(round?.betAsks) ? round.betAsks : [];
  return list.filter(x => x?.status !== 'waiting' || !askSettled(round, x.ask));
}
