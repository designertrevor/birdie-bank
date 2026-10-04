// Callouts on Up next: a few fun lines from the Tab and your stats, each one tap to post in the
// group's own text thread. "Sam has won 3 in a row. Somebody stop Sam."
//
// Never mean-spirited. The rules, checked again on every line by neverMean() before it shows:
//  • A line about someone else only ever cheers them on: a win, a streak, skins, a birdie. Never a
//    loss, a drought, last place, or anything about their money.
//  • Money only ever shows in a line about you, the one sharing it: what you owe, how your season
//    is going. Nobody gets called out for what they owe you, not even without a name.
//  • Ribbing is for yourself only ("No skins for me in my last 3 skins games. I'm due.").
//  • Points and reward rounds are never dollars: season money is what the Tab has (tabResults).
// There's an off switch (settings.callouts) on the card and in Settings. Pure, unit tested in
// callouts.test.js.
import { gameKeys, gameView, roundResults, scoreSummary, scorers, skinsKinds, skinsTable } from './round.js';
import { myIds } from './format.js';
import { money } from './golf.js';
import { nameOf, outstanding } from './ledger.js';
import { canonicalOf } from './shared-tab.js';
import { roundTime } from './history.js';
import { onTab, playForOf, rewardNoun, tabResults } from './play-for.js';
import { myDoneRounds, recapPaid } from './recap.js';

/** Callouts show while your last round is this recent. */
export const CALLOUT_DAYS = 14;
/** At most this many lines on the card. */
export const CALLOUT_LIMIT = 3;
const DAY = 24 * 60 * 60 * 1000;
const EPS = 0.005;

/** Whether callouts are on for this phone (on unless you turned them off). */
export const calloutsOn = state => state?.settings?.callouts !== false;

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';

// Words a line about anyone else never uses: money, owing, losing, droughts
const NOT_ABOUT_OTHERS = /\$|\d+\s?pts?\b|\bowe|\bowed\b|\bowes\b|\bpaid\b|\bpay\b|\bpays\b|\blost\b|\blose|\blosing\b|\bdown\b|\bno skins\b|\bhasn|\bnever\b|\bdue\b|\bdrought|\blast place\b|\bbroke\b|\bbehind\b|\bbuying\b/i;
// Words no line ever uses, about anyone
const NEVER = /\bloser|\bworst\b|\bchok|\bterrible\b|\bawful\b|\bpathetic\b|\bsucks?\b|\bembarrass|\bshame/i;
// The long dash never goes in app copy (CLAUDE.md), so a line with one never ships either
const LONG_DASH = String.fromCharCode(0x2014);
// Nobody is called out for owing the person sharing
const OWED_TO_ME = /\bowes? me\b|\bowed to me\b|\byou owe\b|\bpay me\b|\bpay up\b/i;

/**
 * Whether a callout is fit to post: kind to everyone in it. `about` is 'me', 'group' or another
 * person's id; `tone` is 'cheer' or 'self' (ribbing yourself); `money` says it has an amount.
 */
export function neverMean(c) {
  if (!c || typeof c.text !== 'string' || !c.text.trim()) return false;
  if (NEVER.test(c.text) || OWED_TO_ME.test(c.text) || c.text.includes(LONG_DASH)) return false;
  if (c.about === 'me') return true;
  // Anyone else (or the whole group): cheering only, never money
  return c.tone === 'cheer' && !c.money && !NOT_ABOUT_OTHERS.test(c.text);
}

/** Who won a round: the ids at the top (a whole team when a team tops it), or [] when nobody did. */
function winnersOf(round) {
  let bal;
  try { bal = roundResults(round).balances; } catch { return []; }
  const top = Math.max(...round.players.map(p => bal[p.id] ?? 0));
  if (!(top > EPS)) return [];
  const tops = round.players.filter(p => top - (bal[p.id] ?? 0) < EPS).map(p => p.id);
  if (tops.length === 1) return tops;
  const team = round.teams?.find(t => t.players.length === tops.length && t.players.every(id => tops.includes(id)));
  return team ? tops : [];
}

/** Skins each player won in a round, across every Skins game in it (main or side): { id: n }. */
function skinsWon(round) {
  const out = {};
  let any = false;
  for (const key of gameKeys(round)) {
    const view = gameView(round, key);
    if (!view || view.game !== 'skins' || !view.settings?.skins) continue;
    any = true;
    for (const kind of skinsKinds(view)) {
      for (const row of skinsTable(view, kind).rows) if (row.winner && !row.pending) out[row.winner] = (out[row.winner] || 0) + row.skins;
    }
  }
  return any ? out : null;
}

/**
 * Every callout this phone could make right now, best first:
 * [{ id, kind, about, tone, money, text, rank }]. Unfiltered: callouts() keeps only the kind ones.
 */
export function calloutCandidates(state, now = Date.now()) {
  const rounds = myDoneRounds(state);
  const last = rounds[0];
  if (!last || now - roundTime(last) > CALLOUT_DAYS * DAY) return [];
  const ids = myIds(state);
  const who = canonicalOf(state);
  const isMe = id => ids.has(id) || ids.has(who(id));
  const name = id => first(nameOf(state, who(id)));
  const course = last.course?.name || 'the course';
  const year = new Date(now).getFullYear();
  const out = [];
  const add = (c) => out.push({ tone: 'cheer', money: false, ...c });

  // The last round: who took it (a reward round says what they won)
  const winners = winnersOf(last);
  if (winners.length) {
    const pf = playForOf(last);
    const prize = pf.kind === 'reward' ? rewardNoun(pf.reward) : 'the day';
    const mine = winners.some(isMe);
    const others = winners.filter(id => !isMe(id));
    const names = others.map(name);
    const lead = mine ? (names.length ? `${names.join(', ')} and I` : 'I') : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    const tail = mine ? (names.length ? 'Good team.' : 'Just saying.') : 'Tip of the cap.';
    add({
      id: `win:${last.id}`, kind: 'winner', about: mine ? 'me' : others.length === 1 ? who(others[0]) : 'group', people: others.map(who),
      text: `${lead} won ${prize} at ${course}. ${tail}`, rank: 80,
    });
  }

  // The last round: the most skins (2 or more, one player out in front)
  const skins = skinsWon(last);
  if (skins) {
    const best = Math.max(0, ...Object.values(skins));
    const tops = Object.keys(skins).filter(id => skins[id] === best);
    if (best >= 2 && tops.length === 1) {
      const id = tops[0];
      add({
        id: `skins:${last.id}`, kind: 'skins', about: isMe(id) ? 'me' : who(id), rank: 85,
        text: isMe(id) ? `I took ${best} skins at ${course}. Call me the skin collector.` : `${name(id)} took ${best} skins at ${course}. Skin collector.`,
      });
    }
  }

  // The last round: an eagle, or the most real birdies (a scramble's scores are a team's, so not there)
  if (last.game !== 'scramble') {
    let best = null;
    for (const p of scorers(last)) {
      const s = scoreSummary(last, p.id);
      const score = s.eagles * 10 + s.birdies;
      if (score > 0 && (!best || score > best.score)) best = { id: p.id, score, eagles: s.eagles, birdies: s.birdies };
      else if (best && score === best.score) best.tied = true;
    }
    if (best && !best.tied) {
      const me = isMe(best.id), n = name(best.id);
      const text = best.eagles
        ? (me ? `I made an eagle at ${course}. I’ll be telling this one for a while.` : `${n} made an eagle at ${course}. Take a bow.`)
        : best.birdies === 1
          ? (me ? `I made a birdie at ${course}. Still smiling.` : `${n} made a birdie at ${course}. Nice ball.`)
          : (me ? `I made ${best.birdies} birdies at ${course}. Hot putter.` : `${n} made ${best.birdies} birdies at ${course}. Hot putter.`);
      add({ id: `birdie:${last.id}`, kind: 'birdies', about: me ? 'me' : who(best.id), text, rank: best.eagles ? 95 : 75 });
    }
  }

  // The last round: everyone square (status only, never amounts)
  if (recapPaid(state, last, { now })?.allSquare) add({ id: `square:${last.id}`, kind: 'square', about: 'group', text: `Everyone’s square from ${course}. Clean books.`, rank: 78 });

  // Streaks: rounds won in a row, newest back, by anyone in your rounds
  const seen = new Set();
  for (const r of rounds) for (const p of r.players) {
    const k = isMe(p.id) ? 'me' : who(p.id);
    if (seen.has(k)) continue;
    seen.add(k);
    let streak = 0;
    for (const x of rounds) {
      const seat = x.players.find(q => (k === 'me' ? isMe(q.id) : who(q.id) === k));
      if (!seat) continue;
      if (!winnersOf(x).includes(seat.id)) break;
      streak++;
    }
    if (streak < 2) continue;
    add({
      id: `streak:${k}`, kind: 'streak', about: k === 'me' ? 'me' : k, rank: streak >= 3 ? 90 : 70,
      text: k === 'me' ? `I’ve won ${streak} in a row. Come and get me.` : `${name(k)} has won ${streak} in a row. Somebody stop ${name(k)}.`,
    });
  }

  // The season: the most rounds won (3 or more, one person out in front)
  const season = rounds.filter(r => new Date(roundTime(r)).getFullYear() === year);
  const wins = new Map();
  for (const r of season) for (const id of winnersOf(r)) {
    const k = isMe(id) ? 'me' : who(id);
    wins.set(k, (wins.get(k) || 0) + 1);
  }
  const most = Math.max(0, ...wins.values());
  const leaders = [...wins].filter(([, n]) => n === most);
  if (most >= 3 && leaders.length === 1) {
    const k = leaders[0][0];
    add({
      id: `wins:${year}`, kind: 'season', about: k === 'me' ? 'me' : k, rank: 65,
      text: k === 'me' ? `I’ve won ${most} rounds this season, the most in the group. Just saying.` : `${name(k)} has won ${most} rounds this season, the most in the group.`,
    });
  }
  if (season.length >= 5) add({ id: `rounds:${year}`, kind: 'rounds', about: 'group', text: `That’s ${season.length} rounds this season. Who’s in next time?`, rank: 40 });

  // About you only: what you owe (your own debt, yours to share), your season's money, your skins
  const owe = outstanding(state, { now }).filter(t => isMe(t.from) && !isMe(t.to)).sort((a, b) => b.amount - a.amount)[0];
  if (owe) add({ id: `owe:${who(owe.to)}`, kind: 'iowe', about: 'me', tone: 'self', money: true, text: `I owe ${name(owe.to)} ${money(owe.amount)}. It’s coming, promise.`, rank: 60 });
  let net = 0, moneyRounds = 0;
  for (const r of season) {
    if (!onTab(r)) continue;
    const seat = r.players.find(p => isMe(p.id));
    const v = seat ? tabResults(r).balances[seat.id] ?? 0 : 0;
    if (Math.abs(v) > EPS || playForOf(r).kind === 'money') moneyRounds++;
    net += v;
  }
  net = Math.round(net * 100) / 100;
  if (moneyRounds >= 2 && Math.abs(net) >= 1) {
    add({
      id: `net:${year}`, kind: 'net', about: 'me', tone: 'self', money: true, rank: 55,
      text: net > 0 ? `Up ${money(net)} on the season. I’ll take it.` : `Down ${money(-net)} on the season. Consider it my donation to the group.`,
    });
  }
  let dry = 0;
  for (const r of rounds) {
    const won = skinsWon(r);
    if (!won) continue;
    const seat = r.players.find(p => isMe(p.id));
    if (!seat || won[seat.id]) break;
    dry++;
  }
  if (dry >= 3) add({ id: 'dry', kind: 'drought', about: 'me', tone: 'self', text: `No skins for me in my last ${dry} skins games. I’m due.`, rank: 50 });

  return out.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}

/**
 * The callouts for the card, best first, at most `limit`: only lines neverMean() passes, at most one
 * with money in it, at most two about you, and none when callouts are off.
 */
export function callouts(state, now = Date.now(), { limit = CALLOUT_LIMIT } = {}) {
  if (!calloutsOn(state)) return [];
  let kind;
  // A round it can't read never takes Up next down with it
  try { kind = calloutCandidates(state, now).filter(neverMean); } catch { return []; }
  const out = [];
  let withMoney = 0, aboutMe = 0;
  const people = new Set();
  const subjects = c => (c.people?.length ? c.people : [c.about]);
  // Two passes: a line about someone new first, so one hot round doesn't fill the card with one name
  for (const fresh of [true, false]) {
    for (const c of kind) {
      if (out.length >= limit) break;
      if (out.includes(c)) continue;
      if (fresh && c.about !== 'group' && subjects(c).some(x => people.has(x))) continue;
      if (c.money && withMoney >= 1) continue;
      if (c.about === 'me' && aboutMe >= 2) continue;
      if (c.money) withMoney++;
      if (c.about === 'me') aboutMe++;
      for (const x of subjects(c)) people.add(x);
      out.push(c);
    }
  }
  return out.sort((a, b) => b.rank - a.rank);
}
