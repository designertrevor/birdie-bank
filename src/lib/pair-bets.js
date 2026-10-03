// Side bets between two players inside a bigger round (ROADMAP area 5), from Trevor's Banker round:
// Preston and Tyler play their own $10 match while the group plays Banker. Each bet is worked out
// on its own two-player view of the round, the way gameView() works out a side game, and its money
// adds into the round's byGame table and its head to head (see roundResults), so the money bar, the
// reveal, the fewest payments and the Tab all carry it.
//
// round.bets = [{ id, kind, sides: [a, b], stake, holes: [from, to], strokes: { to, count, on }, label, winners, winner, at }]
// - kind 'match': match play between the two over the holes, net of their own strokes. The stake goes
//   to whoever is ahead (while it's being played, to whoever is ahead right now, like a Nassau leg).
// - kind 'hole': the stake for every hole one of them wins outright, net of their strokes. Ties push.
// - kind 'ctp': closest to the pin, the stake on every par 3 in the holes. The scorekeeper (or either
//   of the two, see bet-asks.js) taps the winner on the hole: winners = { holeNo: pid } (a hole with
//   nobody tapped pays nothing).
// - kind 'custom': anything else ("Longest drive on 7", a label typed in), tapped once: winner = pid,
//   at = the hole it was tapped on.
// - holes: playing positions [from, to] (1-based, both counted); absent means the whole round.
// - strokes: strokes `to` gets from the other, only in this bet and never in the group's games.
//   count strokes go on the hardest holes of the bet's own holes by HCP (`on` absent or 'hdcp'),
//   or one on each hole number listed in `on`. Without strokes the bet is played gross: the round's
//   handicaps never count between the two, so the bet is exactly what the two of them agreed.
// - playFor: on a round played for a reward, 'money' (on the Tab, in dollars) or 'points' (counts
//   toward the reward with the games). Absent means points, which is how reward rounds counted every
//   bet before the choice existed, so those rounds keep their numbers. Money and points rounds ignore it.
// - A scramble's match and per-hole bets are between players on different teams, played on their
//   teams' scores (teammates share one score, so they can only have closest to the pin or custom).
// Rounds without bets have none, so their money is exactly what it always was. Pure, unit tested.
import { holeWinner, matchStatus, pickupGross, rankHoles, strokesOnHole } from './golf.js';
import { matchLabel } from './games.js';
import { holeComplete, playsHole } from './round.js';

export const BET_KINDS = {
  match: { label: 'Match', icon: 'sword', help: 'Match play between the two of you. Win more holes and the bet is yours.' },
  hole: { label: 'Per hole', icon: 'flag', help: 'The bet on every hole one of you wins outright. Ties push.' },
  ctp: { label: 'Closest to the pin', icon: 'target', help: 'The bet on every par 3. The scorekeeper taps who was closest.' },
  custom: { label: 'Custom', icon: 'pencil-simple', help: 'Anything else: longest drive, first to a birdie, who breaks 90. Tap the winner once.' },
};
export const BET_KIND_ORDER = ['match', 'hole', 'ctp', 'custom'];
/** Biggest bet and the most strokes one player can give another in a side bet. */
export const BET_MAX = 500;
export const MAX_BET_STROKES = 36;
/** The longest a custom bet's name can be. */
export const BET_LABEL_MAX = 32;
/** Side bets in one round, all pairs together. */
export const MAX_BETS = 12;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const c2 = v => Math.round(v * 100) / 100 || 0;
const first = n => String(n || '').trim().split(/\s+/)[0] || '?';
/** Match and per-hole bets are played on scores (a scramble's are by team). */
const needsScores = kind => kind === 'match' || kind === 'hole';

/** Why two teammates in a scramble can't have a match or per-hole bet, in one line for the editor. */
export const SAME_TEAM_REASON = 'Teammates share one score, so between them it’s closest to the pin or your own bet.';

/**
 * The team a player is on in a scramble: the team's id (round.teams is [{ id, players }], or setup's
 * arrays of player ids, which go by their place), or null when it isn't a scramble or they aren't on one.
 */
export function teamOf(round, pid) {
  if (round?.game !== 'scramble' || !Array.isArray(round.teams)) return null;
  const i = round.teams.findIndex(t => (Array.isArray(t) ? t : t?.players || []).includes(pid));
  if (i < 0) return null;
  const t = round.teams[i];
  return Array.isArray(t) || t.id == null ? `#${i}` : t.id;
}

/**
 * Whether a kind of bet can be played between two players: always, except a match or per-hole bet
 * in a scramble, which needs the two on different teams (it's played on their teams' scores).
 */
export function kindFits(round, kind, sides) {
  if (round?.game !== 'scramble' || !needsScores(kind)) return true;
  const [a, b] = sides || [];
  const ta = teamOf(round, a), tb = teamOf(round, b);
  return ta != null && tb != null && ta !== tb;
}

/** Whose score counts for a player in a bet: their own, or in a scramble their team's. */
const scoreKey = (round, pid) => (round.game === 'scramble' ? teamOf(round, pid) : pid);

/**
 * What a bet is played for, 'money' or 'points': everything on a money round is money and on a
 * points round points; on a reward round each bet says (absent is points, see the top of this file).
 */
export function betPlayFor(round, bet) {
  const kind = round?.playFor?.kind;
  if (kind === 'points') return 'points';
  if (kind === 'reward') return bet?.playFor === 'money' ? 'money' : 'points';
  return 'money';
}

/** A bet played for money on a reward round: its money goes on the Tab, apart from the reward's points. */
export const isCashBet = (round, bet) => round?.playFor?.kind === 'reward' && bet?.playFor === 'money';

/** A custom bet's name, tidied: single spaces, trimmed, at most BET_LABEL_MAX characters. */
export function cleanBetLabel(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, BET_LABEL_MAX).trim();
}

/**
 * Which kinds of side bet a round can take: every kind (a scramble's match and per-hole bets need the
 * two on different teams, see kindFits).
 */
export function betKindsFor() {
  return BET_KIND_ORDER;
}

/**
 * A round's side bets that can be worked out, in the order they were made. Anything setup could
 * never make is left out, so a garbled or hand-edited round can't move money: an unknown kind, a
 * side who isn't in the round, a player betting with themself, a stake that isn't a positive
 * number, the same id twice, and a match or per-hole bet between two teammates in a scramble
 * (they share one score).
 */
export function betsOf(round) {
  if (!round || !Array.isArray(round.bets) || !Array.isArray(round.players)) return [];
  const ids = new Set(round.players.map(p => p.id));
  const seen = new Set();
  const out = [];
  for (const b of round.bets) {
    if (!isObj(b) || typeof b.id !== 'string' || !b.id || seen.has(b.id) || !BET_KINDS[b.kind]) continue;
    if (!Array.isArray(b.sides) || b.sides.length !== 2) continue;
    const [a, c] = b.sides;
    if (a === c || !ids.has(a) || !ids.has(c)) continue;
    if (!(typeof b.stake === 'number' && Number.isFinite(b.stake) && b.stake > 0)) continue;
    if (!kindFits(round, b.kind, b.sides)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

/** The playing positions a bet covers, [from, to], kept inside the round (it may have been made shorter). */
export function betRange(round, bet) {
  const n = round.holes.length;
  const [f, t] = Array.isArray(bet?.holes) ? bet.holes : [];
  const from = Math.min(n, Math.max(1, Math.round(Number(f)) || 1));
  const to = Math.min(n, Math.max(from, t == null ? n : Math.round(Number(t)) || n));
  return [from, to];
}

/** Whether a bet covers every hole of the round. */
export const wholeRound = (round, bet) => { const [f, t] = betRange(round, bet); return f === 1 && t === round.holes.length; };

/**
 * The playing positions [from, to] of a nine by hole number ('front' is holes 1 to 9, 'back' 10 to
 * 18), or null when the round doesn't play all nine in a row. A round that starts on 10 plays the
 * back nine first, so its front nine is positions 10 to 18.
 */
export function nineRange(round, which) {
  const lo = which === 'front' ? 1 : 10;
  const pos = round.holes.map((h, i) => (h.no >= lo && h.no <= lo + 8 ? i + 1 : null)).filter(Boolean);
  if (pos.length !== 9 || pos[8] - pos[0] !== 8) return null;
  return [pos[0], pos[8]];
}

/** A bet's holes in playing order: [{ hole, pos }]. */
export function betHoles(round, bet) {
  const [from, to] = betRange(round, bet);
  return round.holes.slice(from - 1, to).map((hole, i) => ({ hole, pos: from + i }));
}

/** The par 3s a closest-to-the-pin bet is played on. */
export function ctpHoles(round, bet) {
  return betHoles(round, bet).filter(x => x.hole.par === 3);
}

/**
 * The strokes in a bet: { to: pid | null, by: { holeNo: strokes } }. Only the player getting them
 * has any, and only in this bet. More strokes than holes wrap round (two on the hardest, and so on).
 */
export function betStrokes(round, bet) {
  const s = bet?.strokes;
  if (!isObj(s) || !bet.sides.includes(s.to)) return { to: null, by: {} };
  const holes = betHoles(round, bet);
  const by = {};
  if (Array.isArray(s.on)) {
    const nos = new Set(holes.map(x => x.hole.no));
    for (const no of s.on) if (nos.has(no)) by[no] = 1;
  } else {
    const count = Math.min(MAX_BET_STROKES, Math.max(0, Math.floor(Number(s.count) || 0)));
    if (!count) return { to: null, by: {} };
    const ranks = rankHoles(holes.map(x => x.hole.hdcp));
    holes.forEach((x, i) => { const n = strokesOnHole(count, ranks[i], holes.length); if (n > 0) by[x.hole.no] = n; });
  }
  return Object.keys(by).length ? { to: s.to, by } : { to: null, by: {} };
}

/** How many strokes a bet gives in all (0 without strokes). */
export function strokesCount(round, bet) {
  return Object.values(betStrokes(round, bet).by).reduce((a, n) => a + n, 0);
}

/**
 * One player's score in a bet on a hole, net of the bet's own strokes (a pickup is net double bogey),
 * or null. In a scramble it's their team's score.
 */
function betNet(round, st, pid, hole) {
  const g = round.scores?.[hole.no]?.[scoreKey(round, pid)];
  if (g == null) return null;
  const k = st.to === pid ? st.by[hole.no] || 0 : 0;
  return (g === 'X' ? pickupGross(hole.par, k) : g) - k;
}

/**
 * One bet worked out on its own: { id, bet, kind, label, sides, stake, amount, balances, holes, wins, status, open }.
 * `amount` is what sides[0] won from sides[1] (negative when sides[1] came out ahead), in whole cents.
 * `holes`: the holes that counted, [{ no, pos, winner: 0 | 1 | null, nets? }]. `wins`: holes (or par 3s)
 * each side won. `status`: a match's status (see golf.js matchStatus). `open`: nothing decided yet.
 */
export function betResult(round, bet) {
  const [a, b] = bet.sides;
  const stake = bet.stake;
  const holes = [];
  const wins = [0, 0];
  let amount = 0;
  let status = null;
  const bothOn = h => playsHole(round, a, h) && playsHole(round, b, h);
  if (needsScores(bet.kind)) {
    const st = betStrokes(round, bet);
    const winners = {};
    for (const { hole, pos } of betHoles(round, bet)) {
      if (!holeComplete(round, hole) || !bothOn(hole)) continue;
      const nets = [betNet(round, st, a, hole), betNet(round, st, b, hole)];
      const w = holeWinner(nets[0], nets[1]);
      if (w === undefined) continue;
      winners[pos] = w;
      if (w !== null) wins[w]++;
      holes.push({ no: hole.no, pos, winner: w, nets });
    }
    if (bet.kind === 'hole') amount = (wins[0] - wins[1]) * stake;
    else {
      const [from, to] = betRange(round, bet);
      status = matchStatus(winners, from, to);
      amount = status.leader === 0 ? stake : status.leader === 1 ? -stake : 0;
    }
  } else if (bet.kind === 'ctp') {
    const won = isObj(bet.winners) ? bet.winners : {};
    for (const { hole, pos } of ctpHoles(round, bet)) {
      const w = won[hole.no];
      if ((w !== a && w !== b) || !bothOn(hole)) continue;
      const side = w === a ? 0 : 1;
      wins[side]++;
      holes.push({ no: hole.no, pos, winner: side });
    }
    amount = (wins[0] - wins[1]) * stake;
  } else {
    if (bet.winner === a) { amount = stake; wins[0] = 1; }
    if (bet.winner === b) { amount = -stake; wins[1] = 1; }
  }
  amount = c2(amount);
  return {
    id: bet.id, bet, kind: bet.kind, label: betName(bet), sides: [a, b], stake, amount,
    balances: { [a]: amount, [b]: c2(-amount) }, holes, wins, status, open: !holes.length && !wins[0] && !wins[1],
  };
}

/**
 * Every side bet in the round (or the ones in `bets`, from betsOf), worked out: { balances, pairs, list }.
 * `balances` has every player (0 for anyone without a bet), `pairs[a][b]` what a won from b across
 * their bets, and `list` each bet's betResult in the order they were made.
 */
export function betsMoney(round, bets = betsOf(round)) {
  const ids = round.players.map(p => p.id);
  const balances = Object.fromEntries(ids.map(id => [id, 0]));
  const pairs = Object.fromEntries(ids.map(id => [id, {}]));
  const list = bets.map(bet => betResult(round, bet));
  for (const r of list) {
    const [a, b] = r.sides;
    balances[a] = c2(balances[a] + r.amount);
    balances[b] = c2(balances[b] - r.amount);
    pairs[a][b] = c2((pairs[a][b] || 0) + r.amount);
    pairs[b][a] = c2((pairs[b][a] || 0) - r.amount);
  }
  return { balances, pairs, list };
}

// --------------------------- Making and changing bets ------------------------

/** A fresh bet id. */
export function newBetId() {
  return `b_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * A bet as it's saved: only the fields its kind uses, the stake a positive amount, the holes inside
 * the round (absent for the whole round), strokes only when there are any, and a custom bet's name
 * tidied. On a reward round it says what it's played for: points when it says so, else money (the
 * default for a new bet, decided 2026-10-03). Old reward rounds' bets are never cleaned again, so
 * theirs stay points.
 */
export function cleanBet(round, raw) {
  const bet = { id: raw.id || newBetId(), kind: raw.kind, sides: [...raw.sides], stake: Math.min(BET_MAX, Math.max(0, Number(raw.stake) || 0)) };
  if (round?.playFor?.kind === 'reward') bet.playFor = raw.playFor === 'points' ? 'points' : 'money';
  const n = round?.holes?.length || 18;
  if (Array.isArray(raw.holes)) {
    const [f, t] = betRange({ holes: { length: n } }, raw);
    if (f !== 1 || t !== n) bet.holes = [f, t];
  }
  if (needsScores(raw.kind) && isObj(raw.strokes) && raw.sides.includes(raw.strokes.to)) {
    const count = Math.min(MAX_BET_STROKES, Math.max(0, Math.floor(Number(raw.strokes.count) || 0)));
    if (Array.isArray(raw.strokes.on) && raw.strokes.on.length) bet.strokes = { to: raw.strokes.to, count: raw.strokes.on.length, on: [...raw.strokes.on] };
    else if (count) bet.strokes = { to: raw.strokes.to, count };
  }
  if (raw.kind === 'custom') bet.label = cleanBetLabel(raw.label) || 'Side bet';
  if (raw.kind === 'ctp' && isObj(raw.winners)) bet.winners = { ...raw.winners };
  if (raw.kind === 'custom' && raw.winner != null) { bet.winner = raw.winner; if (raw.at != null) bet.at = raw.at; }
  return bet;
}

/** The round with a bet added (a new round; `round` is not changed). */
export function addBet(round, raw) {
  const list = Array.isArray(round.bets) ? round.bets : [];
  if (list.length >= MAX_BETS) return round;
  return { ...round, bets: [...list, cleanBet(round, raw)] };
}

/**
 * The round with a bet changed. `raw` is the whole bet as it should be now (the editor's), so a
 * field it leaves out is gone: back to the whole round, or no strokes. A winner already tapped stays
 * (a closest-to-the-pin hole outside the new holes just stops counting), unless the players in it
 * or its kind changed, which starts it fresh. Without a `playFor` it keeps the bet's own.
 */
export function changeBet(round, id, raw) {
  const list = Array.isArray(round.bets) ? round.bets : [];
  return {
    ...round,
    bets: list.map(b => {
      if (b.id !== id) return b;
      const samePeople = b.sides.every(s => raw.sides.includes(s));
      const keep = samePeople && b.kind === raw.kind ? { winners: b.winners, winner: b.winner, at: b.at } : {};
      // A change that doesn't say what the bet is played for keeps what it was (an old reward
      // round's bet with none is points), so it never turns into money by being edited
      const playFor = raw.playFor ?? b.playFor ?? 'points';
      return cleanBet(round, { ...raw, id, playFor, winners: keep.winners, winner: keep.winner, at: keep.at });
    }),
  };
}

/** The round without a bet. */
export function removeBet(round, id) {
  const list = (Array.isArray(round.bets) ? round.bets : []).filter(b => b.id !== id);
  const next = { ...round, bets: list };
  if (!list.length) delete next.bets;
  return next;
}

/**
 * The round with a winner tapped on a hole: who was closest on a par 3 (a closest-to-the-pin bet),
 * or who won a custom bet. `pid` null clears it.
 */
export function setBetWinner(round, id, holeNo, pid) {
  return {
    ...round,
    bets: (round.bets || []).map(b => {
      if (b.id !== id) return b;
      if (b.kind === 'ctp') {
        const winners = { ...(isObj(b.winners) ? b.winners : {}) };
        if (pid == null) delete winners[holeNo]; else winners[holeNo] = pid;
        const next = { ...b, winners };
        if (!Object.keys(winners).length) delete next.winners;
        return next;
      }
      if (b.kind === 'custom') {
        const next = { ...b };
        if (pid == null) { delete next.winner; delete next.at; } else { next.winner = pid; next.at = holeNo; }
        return next;
      }
      return b;
    }),
  };
}

/**
 * The bets to tap on a hole, for the scorekeeper: closest to the pin on a par 3 the bet covers, and
 * a custom bet still to be decided (or decided on this hole, so it can be changed there).
 */
export function betsToTap(round, hole) {
  return betsOf(round).filter(b => {
    const pos = round.holes.findIndex(h => h.no === hole.no) + 1;
    const [from, to] = betRange(round, b);
    if (pos < from || pos > to) return false;
    if (!playsHole(round, b.sides[0], hole) || !playsHole(round, b.sides[1], hole)) return false;
    if (b.kind === 'ctp') return hole.par === 3;
    if (b.kind === 'custom') return b.winner == null || b.at === hole.no;
    return false;
  });
}

/** The next hole to play, as a playing position: the one after the last hole with every score in. */
export function nextPos(round) {
  const last = round.holes.reduce((a, h, i) => (holeComplete(round, h) ? i + 1 : a), 0);
  return Math.min(round.holes.length, last + 1);
}

/**
 * Setup's side bets after a change to the holes played (`shape`: 9 or 18, which nine, the course,
 * the first tee). Bets keep their holes by playing position, so a bet made for other holes goes back
 * to the whole round rather than shrinking (a Back 9 bet on a round cut to 9 holes would be decided
 * on hole 9 alone). Each bet carries the shape it was made for; one without a shape is left alone.
 */
export function fitSetupBets(list, shape) {
  return (list || []).map(b => {
    if (!Array.isArray(b?.holes) || b.shape == null || b.shape === shape) return b;
    const { holes: _HOLES, ...rest } = b;
    return { ...rest, shape };
  });
}

/**
 * Strokes the two would give each other from the round's handicaps, as a starting point:
 * { to, count } (the higher handicap gets the difference), or null when either has no handicap or
 * they're the same. The difference is at the round's handicap % and, for a bet on some of the
 * holes (`bet`), only that share of it: a Back 9 bet gets about half.
 */
export function suggestedStrokes(round, a, b, bet = null) {
  // A scramble plays off the teams' handicaps, so there's nothing between two players to suggest
  if (round.game === 'scramble') return null;
  const pa = round.players.find(p => p.id === a), pb = round.players.find(p => p.id === b);
  if (!pa || !pb) return null;
  const known = p => p.index != null || p.courseHcOverride != null;
  if (!known(pa) || !known(pb)) return null;
  const n = round.holes?.length || 18;
  const [f, t] = bet ? betRange(round, bet) : [1, n];
  const share = (t - f + 1) / n;
  const pct = (round.hcPct ?? 100) / 100;
  const d = Math.round(((pa.courseHc ?? 0) - (pb.courseHc ?? 0)) * pct * share);
  if (!d) return null;
  return { to: d > 0 ? a : b, count: Math.min(MAX_BET_STROKES, Math.abs(d)) };
}

// --------------------------- Words ------------------------------------------

/** What a bet is called: a custom bet's own name, else its kind ("Match", "Closest to the pin"). */
export function betName(bet) {
  if (bet?.kind === 'custom') return cleanBetLabel(bet.label) || 'Side bet';
  return BET_KINDS[bet?.kind]?.label || 'Side bet';
}

/** "Preston v Tyler", first names. */
export function betPeople(round, bet) {
  const name = id => first(round.players.find(p => p.id === id)?.name);
  return `${name(bet.sides[0])} v ${name(bet.sides[1])}`;
}

/** "Holes 10–18", "From hole 10" or '' for the whole round, by hole number. */
export function betHolesText(round, bet) {
  const [from, to] = betRange(round, bet);
  if (from === 1 && to === round.holes.length) return '';
  const a = round.holes[from - 1]?.no ?? from, b = round.holes[to - 1]?.no ?? to;
  if (to === round.holes.length) return `From hole ${a}`;
  return from === to ? `Hole ${a}` : `Holes ${a}–${b}`;
}

/** What the bet is for, with `fmt` for the amount: "$10 match", "$2 a hole", "$5 a par 3", "$5". */
export function betStakeText(bet, fmt) {
  const s = fmt(bet.stake);
  return { match: `${s} match`, hole: `${s} a hole`, ctp: `${s} a par 3`, custom: s }[bet.kind] || s;
}

/** "Tyler gets 3 strokes", or ''. */
export function betStrokesText(round, bet) {
  const st = betStrokes(round, bet);
  if (!st.to) return '';
  const n = Object.values(st.by).reduce((x, k) => x + k, 0);
  return `${first(round.players.find(p => p.id === st.to)?.name)} gets ${n} stroke${n === 1 ? '' : 's'}`;
}

/** "Preston +$10", "Tyler +$4", or "Square": who's ahead in a bet and by how much, with `fmt` for the unit. */
export function betMoneyText(round, r, fmt) {
  if (!r.amount) return 'Square';
  const [a, b] = r.sides;
  return `${first(round.players.find(p => p.id === (r.amount > 0 ? a : b))?.name)} ${fmt(Math.abs(r.amount), { sign: true })}`;
}

/** One line for a bet: "Preston v Tyler · $10 match · Holes 10–18 · Tyler gets 3 strokes". */
export function betLine(round, bet, fmt) {
  return [betPeople(round, bet), betStakeText(bet, fmt), betHolesText(round, bet), betStrokesText(round, bet)].filter(Boolean).join(' · ');
}

/**
 * Where a bet stands, in a few words: "Preston 2 up", "Tyler 3&2", "All square", "Preston 3 holes,
 * Tyler 1", "Preston 2 of 4 par 3s", "Tyler won", "Not decided yet".
 */
export function betStatusText(round, r) {
  const name = id => first(round.players.find(p => p.id === id)?.name);
  const [a, b] = r.sides;
  if (r.kind === 'match') {
    if (!r.status || !r.status.played) return 'Not started';
    return matchLabel(r.status, r.status.leader === null ? '' : name(r.sides[r.status.leader]));
  }
  if (r.kind === 'hole') {
    if (!r.holes.length) return 'Not started';
    if (!r.wins[0] && !r.wins[1]) return 'Every hole halved';
    const h = n => `${n} hole${n === 1 ? '' : 's'}`;
    return `${name(a)} ${h(r.wins[0])}, ${name(b)} ${r.wins[1]}`;
  }
  if (r.kind === 'ctp') {
    const n = ctpHoles(round, r.bet).length;
    if (!n) return 'No par 3s in these holes';
    if (!r.holes.length) return `${n} par 3${n === 1 ? '' : 's'} to play`;
    const lead = r.wins[0] === r.wins[1] ? null : r.wins[0] > r.wins[1] ? 0 : 1;
    if (lead === null) return `${name(a)} ${r.wins[0]}, ${name(b)} ${r.wins[1]}`;
    return `${name(r.sides[lead])} ${r.wins[lead]} of ${n} par 3${n === 1 ? '' : 's'}`;
  }
  if (r.bet.winner === a || r.bet.winner === b) return `${name(r.bet.winner)} won`;
  return 'Not decided yet';
}

/**
 * What saving a change to a bet does to the holes already played, for the editor. A bet is always
 * worked out from its first hole, so a new amount reprices every hole of it, the ones already played
 * too (Trevor's call, 2026-10-03): "This changes every hole of the bet, so Preston’s $6 becomes $12."
 * Null for a new bet, a bet with nothing decided yet, or a change that moves nothing. `fmtOf(bet)`
 * formats a bet's amounts (a reward round's bet can be money or points).
 */
export function repriceText(round, before, after, fmtOf) {
  if (!before || !after || after.sides?.length !== 2) return null;
  const rb = betResult(round, before);
  if (rb.open) return null;
  const ra = betResult(round, after);
  const fb = fmtOf(before), fa = fmtOf(after);
  const name = id => first(round.players.find(p => p.id === id)?.name);
  const lead = r => (r.amount > 0 ? r.sides[0] : r.amount < 0 ? r.sides[1] : null);
  const was = lead(rb), is = lead(ra);
  const whole = before.kind === 'custom' && after.kind === 'custom' ? 'This changes the whole bet' : 'This changes every hole of the bet';
  if (was === is && Math.abs(rb.amount) === Math.abs(ra.amount) && fb === fa) {
    return before.stake === after.stake ? null : `${whole}, the holes already played too.`;
  }
  const x = was ? `${name(was)}’s ${fb(Math.abs(rb.amount))}` : 'all square';
  const y = !is ? 'all square' : is === was ? fa(Math.abs(ra.amount)) : `${name(is)}’s ${fa(Math.abs(ra.amount))}`;
  return `${whole}, so ${x} becomes ${y}.`;
}

/** "Preston v Tyler, $5 match": a bet in a few words for the invite card. `fmt` formats its amount. */
export function betInviteLine(round, bet, fmt) {
  const holes = betHolesText(round, bet);
  return `${betPeople(round, bet)}, ${betStakeText(bet, fmt)}${bet.kind === 'custom' ? ` on ${betName(bet).toLowerCase() === 'side bet' ? 'a side bet' : betName(bet)}` : ''}${holes ? `, ${holes.charAt(0).toLowerCase()}${holes.slice(1)}` : ''}`;
}
