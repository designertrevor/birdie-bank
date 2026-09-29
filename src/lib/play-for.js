// "Play for": what a round is played for. Money (every round until now), points (bragging
// rights: the same numbers the bets make, shown as points, nothing on the Tab) or a reward
// ("Lunch", "A drink" or one typed in) that the winner gets and last place (or everyone else) owes.
//
// It lives on the round as round.playFor = { kind, reward?, owes? }, and on plans and usuals.
// Absent means money, so every old round returns exactly the same money. The game math never
// changes: a points or reward round plays the same bets, and a $5 bet is simply 5 points.
// Every place that adds up dollars (the Tab, head to head, History, Season, Lately) keeps only
// the rounds where countsMoney() is true. Pure, unit tested.
import { money } from './golf.js';
import { roundResults } from './round.js';

/** The rewards to pick from; anything else is typed in. */
export const REWARDS = ['Lunch', 'A drink'];
export const REWARD_MAX = 40;
const EPS = 0.005;

/** A typed reward, tidied: single spaces, trimmed, at most REWARD_MAX characters. */
export function cleanReward(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, REWARD_MAX).trim();
}

/**
 * What a round (or a plan, or a usual) is played for, always well formed:
 * { kind: 'money' } | { kind: 'points' } | { kind: 'reward', reward, owes: 'last' | 'everyone' }.
 */
export function playForOf(round) {
  const p = round?.playFor;
  if (!p || typeof p !== 'object') return { kind: 'money' };
  if (p.kind === 'points') return { kind: 'points' };
  if (p.kind === 'reward') return { kind: 'reward', reward: cleanReward(p.reward) || REWARDS[0], owes: p.owes === 'everyone' ? 'everyone' : 'last' };
  return { kind: 'money' };
}

/** The value to store on a round, plan or usual: null for money, so money rounds look like they always did. */
export function storedPlayFor(p) {
  const pf = playForOf({ playFor: p });
  return pf.kind === 'money' ? null : pf;
}

/** Only money rounds put dollars on the Tab, in head to head, History, Season and Lately. */
export const countsMoney = round => playForOf(round).kind === 'money';

/** "12 pts", "+3 pts", "−1 pt": a round's numbers as points, one for each dollar the bets would make. */
export function points(v, { sign = false } = {}) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const s = Number.isInteger(abs) ? String(abs) : String(Math.round(abs * 100) / 100);
  const pre = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${pre}${s} ${abs === 1 ? 'pt' : 'pts'}`;
}

/** The formatter for a round's amounts: money() for money rounds, points() for the rest. */
export function unitFmt(round) {
  return countsMoney(round) ? money : points;
}

/** The reward as it reads in a sentence: "lunch", "a drink", "a round of beers", but "IPA" stays. */
export function rewardNoun(reward) {
  const r = cleanReward(reward) || REWARDS[0];
  return r.length > 1 && r[1] === r[1].toLowerCase() ? r[0].toLowerCase() + r.slice(1) : r;
}

/** "Playing for lunch", "For bragging rights", or null for money. */
export function playForLine(round) {
  const pf = playForOf(round);
  if (pf.kind === 'points') return 'For bragging rights';
  if (pf.kind === 'reward') return `Playing for ${rewardNoun(pf.reward)}`;
  return null;
}

/** The friendly-wagers note for a points or reward round: "No money on this one, just lunch." Null for money. */
export function noMoneyNote(round) {
  const pf = playForOf(round);
  if (pf.kind === 'money') return null;
  return `No money on this one, just ${pf.kind === 'points' ? 'bragging rights' : rewardNoun(pf.reward)}.`;
}

/** Short label for the choice: "Money", "Points", "Lunch". */
export function playForShort(round) {
  const pf = playForOf(round);
  return pf.kind === 'points' ? 'Points' : pf.kind === 'reward' ? pf.reward : 'Money';
}

/**
 * Bet lines in points instead of dollars ("$5 a side" reads "5 pts a side"), for a points or
 * reward round. Money rounds' lines come back as they are.
 */
export function pointsLines(round, lines) {
  if (countsMoney(round)) return lines;
  const swap = s => String(s).replace(/([−-]?)\$(\d+(?:\.\d+)?)/g, (_, neg, n) => `${neg ? '−' : ''}${n} ${Number(n) === 1 ? 'pt' : 'pts'}`);
  return lines.map(l => ({ ...l, line: swap(l.line) }));
}

/** One bet label in the round's unit: "$5 a side" stays for money, reads "5 pts a side" otherwise. */
export function inUnits(round, text) {
  return pointsLines(round, [{ line: text ?? '' }])[0].line;
}

const firstOf = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
function listNames(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * Who gets the reward and who owes it, from the round's standings (every game combined):
 * { winners: [ids], owers: [ids], lines: [{ from, to: [ids], split, with: [ids] }], text, win, buy }.
 * The top of the standings wins (a tie at the top shares it). Last place owes it (a tie at the
 * bottom splits it: `split`, and `with` names the others paying), or with owes 'everyone' each other player owes one. Everyone
 * level is all square and nobody's buying. A player who left before the first hole is left out.
 * Null when the round isn't played for a reward.
 */
export function rewardOutcome(round, res) {
  const pf = playForOf(round);
  if (pf.kind !== 'reward') return null;
  // Someone who left before the first hole never played, so they can't win it or owe it
  const standings = (res?.standings || []).filter(p => round.left?.[p.id] !== 0);
  const noun = rewardNoun(pf.reward);
  const name = id => firstOf(standings.find(p => p.id === id)?.name ?? round.players?.find(p => p.id === id)?.name);
  const amounts = standings.map(p => Number(p.amount) || 0);
  const top = Math.max(...amounts), bottom = Math.min(...amounts);
  if (!standings.length || top - bottom < EPS) {
    return { reward: pf.reward, noun, winners: [], owers: [], lines: [], win: 'All square.', buy: 'Nobody’s buying.', text: 'All square. Nobody’s buying.' };
  }
  const winners = standings.filter(p => top - p.amount < EPS).map(p => p.id);
  const owers = pf.owes === 'everyone'
    ? standings.filter(p => !winners.includes(p.id)).map(p => p.id)
    : standings.filter(p => p.amount - bottom < EPS).map(p => p.id);
  const split = pf.owes !== 'everyone' && owers.length > 1;
  const lines = owers.map(from => ({ from, to: [...winners], split, with: split ? owers.filter(x => x !== from) : [] }));
  const w = listNames(winners.map(name));
  const win = winners.length > 1 ? `${w} share ${noun}.` : `${w} wins ${noun}.`;
  const o = listNames(owers.map(name));
  const buy = owers.length === 1 ? `${o}’s buying.` : split ? `${o} split it.` : `${o} each buy one.`;
  return { reward: pf.reward, noun, winners, owers, lines, win, buy, text: `${win} ${buy}` };
}

/** The key a reward line's "Done" mark is saved under: "roundId:from>to". */
export const rewardKey = (roundId, from, to) => `${roundId}:${from}>${to}`;

/**
 * The rewards still open between you and anyone else, from finished reward rounds you played:
 * [{ key, keys, round, from, to, reward, noun, split, with, iOwe, other, at }], newest first. `from` owes `to`,
 * and `keys` are the Done marks the line clears (every share of a split bill owed to you).
 * A line marked Done on this phone (state.rewardsDone) is left out. `ids` is every id that means
 * you, and `canon` maps any of them to one. Never money: nothing here touches cents or balances.
 */
export function openRewards(state, { ids, canon = id => id, done = state?.rewardsDone } = {}) {
  const mine = ids instanceof Set ? ids : new Set(ids || []);
  const marks = done && typeof done === 'object' ? done : {};
  const out = [];
  for (const r of Object.values(state?.rounds || {})) {
    if (r?.status !== 'done' || playForOf(r).kind !== 'reward') continue;
    const me = r.localMe ?? state.me;
    if (!me || !r.players?.some(p => p.id === me)) continue; // a round you only watched
    const o = rewardOutcome(r, roundResults(r));
    for (const l of o.lines) for (const to of l.to) {
      const iOwe = mine.has(l.from), owedMe = mine.has(to);
      if (iOwe === owedMe) continue; // between two other people, or you and you
      // A split bill is one reward: owed to you, it shows once (on the first ower's card), and
      // Done marks every share of it, so it can't be half done.
      if (owedMe && l.split && l.from !== o.owers[0]) continue;
      const key = rewardKey(r.id, l.from, to);
      const keys = owedMe && l.split ? o.owers.map(f => rewardKey(r.id, f, to)) : [key];
      if (keys.some(k => marks[k])) continue;
      out.push({ key, keys, round: r, from: canon(l.from), to: canon(to), reward: o.reward, noun: o.noun, split: l.split, with: l.with.map(canon), iOwe, other: canon(iOwe ? to : l.from), at: r.finishedAt || r.createdAt || 0 });
    }
  }
  return out.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

/**
 * "You owe Sam lunch", "Dave owes you a drink". A shared bill says so: "You and Ann owe Sam lunch",
 * "Dave and Ann owe you lunch". `nameOf(id)` gives a player's name.
 */
export function rewardLineText(line, nameOf) {
  const n = id => firstOf(nameOf(id));
  const co = (line.with || []).map(n);
  if (line.iOwe) return `${listNames(['You', ...co])} owe ${n(line.to)} ${line.noun}`;
  return `${listNames([n(line.from), ...co])} ${co.length ? 'owe' : 'owes'} you ${line.noun}`;
}
