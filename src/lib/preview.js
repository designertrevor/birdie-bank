// The Saturday preview: everything about a planned round before anyone tees off. The countdown on
// Up next ("Saturday, 2 days"), who's in, the game and the bet the group voted for, the side games,
// who gets strokes on which holes, and head-to-head records between the players who are in
// ("Mike is 3 and 1 against Dave this season"). Pure functions of plain data, unit tested.
//
// Strokes are worked out exactly as the roll call will start the round (plans.js planStart, then
// createRound): the same tees and handicap edits from the plan's setup, the same Strokes given %,
// strokes off the low player, ranked over the holes being played. So what the preview says is what the dots on the card will say.
// Records use the same round-by-round head to head as the rivalry card and the Players list
// (roundResults pairs, people-links for who is the same person). Points and reward rounds count in
// the record, never in dollars; dollars come only from rounds that put money on the Tab.
// Two-player side bets kept from the plan's setup and the plan's agreed challenges show as
// "Dave v Mike, $20 match" on the page, the image and the text (amounts hidden like the rest).
import { GAMES, SIDE_GAMES, createRound, oneBall, popsFor, roundResults } from './round.js';
import { findCourse } from './courses.js';
import { applySetup } from './plan-setup.js';
import { linksOf } from './people-links.js';
import { betLabel, betUnitLabel, dayLabel, planChoice, planPeople, planRules, planSides, timeLabel } from './plans.js';
import { sideBetLine } from './stakes.js';
import { countsMoney, inUnits, onTab, playForLine, playForOf, tabResults } from './play-for.js';
import { canonicalOf } from './pair-debts.js';
import { keptId } from './format.js';
import { roundTime } from './history.js';
import { money } from './golf.js';
import { countdown, weekdayOf } from './countdown.js';
import { STROKE_SIDE_GAMES, halfStrokesOffered, pctWords } from './allowances.js';
import { agreedOnPlan, challengeIdOfBet, challengeWhat, challengeWhatNoAmount } from './challenges.js';

// The countdown lives in countdown.js, so Up next shows it without loading the rest of this file
export { countdown, countdownLine, minutesToTee, toGoLabel, weekdayOf } from './countdown.js';

const first = name => String(name || '').trim().split(/\s+/)[0];
const listNames = n => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
const c = v => Math.round(v * 100) / 100 || 0;
const validPct = n => typeof n === 'number' && n > 0 && n <= 100;
/** Games scored without handicaps at all, so nobody gets strokes. */
const NO_STROKES = ['bbb'];

// --------------------------- who is who on this phone ------------------------

/**
 * The saved player on this phone a person on the plan stands for, or null. You are your own
 * player card. On the organizer's phone it is exactly the player the roll call will start the
 * round with (planStart): an invited friend by id, anyone from the group link by the same full
 * name, and nobody otherwise (the roll call saves them new, with no handicap). On a friend's phone
 * the plan's ids are the organizer's, so people are found by name: the same full name, or else
 * the only saved player with that first name.
 */
export function savedPlayerFor(state, plan, p) {
  const players = state?.players || {};
  const isMe = plan?.host ? p.who === plan.hostWho : p.who === plan?.localMe;
  if (isMe) return players[state.me] || null;
  const direct = players[p.who];
  const name = String(p.name || '').trim().toLowerCase();
  if (plan?.host) {
    if (direct) return direct;
    return name ? Object.values(players).find(x => String(x?.name || '').trim().toLowerCase() === name) || null : null;
  }
  if (direct) return players[keptId(state, p.who)] || direct;
  if (!name) return null;
  const pool = Object.values(players).filter(x => x && x.id !== state.me && !x.mergedInto);
  const exact = pool.find(x => String(x.name || '').trim().toLowerCase() === name);
  if (exact) return exact;
  const firsts = pool.filter(x => first(x.name).toLowerCase() === first(name).toLowerCase());
  return firsts.length === 1 ? firsts[0] : null;
}

/** The people who said they're in, each with the saved player they stand for: [{ who, name, me, player }]. */
export function previewPeople(state, plan) {
  const out = [];
  const seen = new Set();
  for (const p of planPeople(plan)) {
    if (p.status !== 'in') continue;
    const player = savedPlayerFor(state, plan, p);
    // Two answers for one saved player (a friend who answered twice) are one person
    if (player && seen.has(player.id)) continue;
    if (player) seen.add(player.id);
    const isMe = plan.host ? p.who === plan.hostWho : p.who === plan.localMe;
    out.push({ who: p.who, name: first(p.name) || first(player?.name) || 'Guest', me: isMe, player });
  }
  return out;
}

// --------------------------- strokes ----------------------------------------

/** The holes count the roll call will use: the plan's when the game can be played over it. */
function holesFor(game, plan) {
  const g = GAMES[game];
  return g && g.holes.includes(plan.holesCount) ? plan.holesCount : g?.holes[0] ?? 18;
}

/**
 * Who gets strokes on which holes, among the people who are in:
 * { status, pct, half, holes, rows, notes }
 * - status: 'on' (handicaps on), 'off' (the plan plays without handicaps; rows still say what
 *   handicaps would give), 'noStrokes' (a game scored without them), 'scramble' (team strokes are
 *   set with the teams at the tee), 'noCourse' (the course isn't on this phone) or 'few' (fewer
 *   than two in);
 * - holes: [{ no, par, hdcp, rank }] in playing order;
 * - rows: [{ who, name, me, index, noIndex, plays, strokes: [{ no, n }] }], most strokes first;
 * - notes: side games that play off their own %.
 * Everyone without a handicap index plays off 0, as the round will.
 */
export function previewStrokes(state, plan, { settings = state?.settings } = {}) {
  const { game } = planChoice(plan);
  const people = previewPeople(state, plan);
  const base = { status: 'on', pct: null, half: false, holes: [], rows: [], notes: [] };
  if (!GAMES[game]) return { ...base, status: 'noCourse' };
  if (NO_STROKES.includes(game)) return { ...base, status: 'noStrokes' };
  if (oneBall(game)) return { ...base, status: 'scramble' };
  const course = findCourse(state, plan.course?.id);
  if (!course?.holes?.length) return { ...base, status: 'noCourse' };
  if (people.length < 2) return { ...base, status: 'few' };
  const holesCount = holesFor(game, plan);
  const nine = plan.nine || 'front';
  // The same % the roll call starts with: a usual's own, else the house rules' (planStart)
  const rules = planRules(plan, settings);
  const pct = plan.hcPct ?? rules.hcPct ?? 100;
  const byId = new Map(people.map(p => [p.player?.id ?? p.who, p]));
  const saved = [...byId].map(([id, p]) => ({ id, name: p.name, index: p.player?.index ?? null }));
  // The setup made before it was scheduled (plan-setup.js), laid over who's in as planStart does:
  // each player's tee, handicap edits and the starting hole. It stays on the organizer's phone, so
  // a friend's plan has none and everyone plays the course's usual tee
  let links = null;
  const personOf = pid => (links ??= linksOf(state)).personOf(pid);
  const built = applySetup(plan.setup, {
    game, course, holesCount, nine, players: saved,
    sameAs: (a, b) => (a === plan.setup?.me && b === state?.me) || personOf(a) === personOf(b),
  });
  const round = createRound({ id: 'preview', game, course, holesCount, nine, startHole: built.startHole, players: built.players, settings: {}, hcPct: pct, useHandicaps: true });
  const rows = round.players.map(rp => {
    const p = byId.get(rp.id);
    return {
      who: p.who, name: p.name, me: p.me,
      // A handicap edit from setup counts as a handicap: only someone with neither plays off 0
      index: rp.index, noIndex: rp.index == null && rp.courseHcOverride == null, plays: rp.plays,
      // By hole number, so a round starting on 10 still reads "4, 7 and 14"
      strokes: round.holes.map(h => ({ no: h.no, n: popsFor(round, rp, h) })).filter(x => x.n > 0).sort((a, b) => a.no - b.no),
    };
  });
  rows.sort((a, b) => b.plays - a.plays);
  // The side games the round starts with, as planStart picks them (only those with house rules)
  const sides = planSides(plan, game).filter(k => rules[k]);
  const half = !!plan.halfStrokes && halfStrokesOffered(game, sides.map(k => ({ game: k })));
  const notes = sides
    .filter(k => STROKE_SIDE_GAMES.includes(k) && validPct(plan.sidePcts?.[k]) && plan.sidePcts[k] !== pct)
    .map(k => `${SIDE_GAMES[k].label} plays off ${pctWords(plan.sidePcts[k])}`);
  return {
    status: plan.useHc === false ? 'off' : 'on',
    pct, half, notes,
    holes: round.holes.map(h => ({ no: h.no, par: h.par, hdcp: h.hdcp, rank: h.rank })),
    rows,
  };
}

/**
 * The holes someone gets strokes on, in words: "1, 3, 5 and 7", "every hole", "every hole,
 * two on 1 and 3". Empty for no strokes.
 */
export function strokeHolesText(row, holeCount) {
  const ones = row.strokes.filter(s => s.n === 1).map(s => s.no);
  const twos = row.strokes.filter(s => s.n >= 2).map(s => s.no);
  if (!row.strokes.length) return '';
  if (row.strokes.length >= holeCount) return twos.length ? `every hole, two on ${listNames(twos.map(String))}` : 'every hole';
  const list = listNames(ones.map(String));
  return twos.length ? `${list}, two on ${listNames(twos.map(String))}` : list;
}

/** "Mike gets 7: 1, 3, 5, 7, 9, 12 and 15", "Dave plays off the low, no strokes". */
export function strokesLine(row, holeCount, { you = true } = {}) {
  const name = row.me && you ? 'You' : row.name;
  if (!row.plays) return `${name} ${row.me && you ? 'play' : 'plays'} off the low, no strokes`;
  const n = `${row.plays} stroke${row.plays === 1 ? '' : 's'}`;
  return `${name} ${row.me && you ? 'get' : 'gets'} ${n}: ${strokeHolesText(row, holeCount)}`;
}

// --------------------------- head-to-head records ---------------------------

const emptyRec = () => ({ rounds: 0, won: 0, lost: 0, even: 0, net: 0, moneyRounds: 0 });

/**
 * Head-to-head records between every two of `ids` (ids on this phone, any of a person's), from
 * finished rounds they both played: Map("a|b" -> { all, season }) with `a` and `b` the people's
 * own ids in the order given, and each record { rounds, won, lost, even, net, moneyRounds } from
 * a's side. The season is the calendar year of `now`, as the Season view counts it.
 */
export function pairRecords(state, ids, { now = new Date() } = {}) {
  const who = canonicalOf(state);
  const people = [...new Set(ids.filter(Boolean).map(who))];
  const seasonStart = new Date(now.getFullYear(), 0, 1).getTime();
  const out = new Map();
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    out.set(`${people[i]}|${people[j]}`, { a: people[i], b: people[j], all: emptyRec(), season: emptyRec() });
  }
  if (out.size === 0) return out;
  const wanted = new Set(people);
  for (const r of Object.values(state?.rounds || {})) {
    if (r?.status !== 'done') continue;
    // Who of the group played this round, by person, with the ids they had in it
    const inRound = new Map();
    for (const p of r.players || []) {
      const k = who(p.id);
      if (!wanted.has(k)) continue;
      if (!inRound.has(k)) inRound.set(k, []);
      inRound.get(k).push(p.id);
    }
    if (inRound.size < 2) continue;
    const pairs = roundResults(r).pairs || {};
    const isMoney = countsMoney(r);
    // A reward round's side bets for money are dollars on the Tab, apart from its points
    const cashPairs = !isMoney && onTab(r) ? tabResults(r).pairs || {} : null;
    const sum = (src, as, bs) => c(as.reduce((t, x) => t + bs.reduce((u, y) => u + (src[x]?.[y] ?? 0), 0), 0));
    const inSeason = roundTime(r) >= seasonStart;
    for (const rec of out.values()) {
      const as = inRound.get(rec.a), bs = inRound.get(rec.b);
      if (!as || !bs) continue;
      const amount = sum(pairs, as, bs);
      const dollars = isMoney ? amount : cashPairs ? sum(cashPairs, as, bs) : 0;
      const counts = isMoney || (cashPairs && dollars !== 0);
      for (const t of inSeason ? [rec.all, rec.season] : [rec.all]) {
        t.rounds++;
        if (amount > 0) t.won++; else if (amount < 0) t.lost++; else t.even++;
        t.net = c(t.net + dollars);
        if (counts) t.moneyRounds++;
      }
    }
  }
  return out;
}

/**
 * One record as a sentence, from a's side: "Mike is 3 and 1 against Dave", "You're 3 and 1
 * against Dave", "Dave is 2 and 0 against you", "Mike and Dave are all square, 2 and 2". Even
 * rounds go in brackets. With `amounts`, the money between them follows when there is any.
 */
export function recordSentence(rec, nameA, nameB, { scope = null, amounts = false, aIsYou = false, bIsYou = false } = {}) {
  const A = aIsYou ? 'You' : nameA, B = bIsYou ? 'you' : nameB;
  const lead = rec.won > rec.lost ? 'a' : rec.lost > rec.won ? 'b' : null;
  const when = scope === 'season' ? ' this season' : '';
  let text;
  if (lead === 'a') text = `${aIsYou ? 'You’re' : `${A} is`} ${rec.won} and ${rec.lost} against ${B}`;
  else if (lead === 'b') text = `${bIsYou ? 'You’re' : `${nameB} is`} ${rec.lost} and ${rec.won} against ${aIsYou ? 'you' : nameA}`;
  else if (rec.won) text = `${A} and ${bIsYou ? 'you' : nameB} are all square, ${rec.won} and ${rec.lost}`;
  else text = `${A} and ${bIsYou ? 'you' : nameB} are all square after ${rec.rounds} round${rec.rounds === 1 ? '' : 's'}`;
  text += when;
  if (rec.even && (rec.won || rec.lost)) text += ` (${rec.even} even)`;
  if (amounts && rec.moneyRounds && rec.net) {
    // Said from the leader's side, or a's when it's square
    const fromB = lead === 'b';
    const v = fromB ? -rec.net : rec.net;
    const who = lead ? '' : `${aIsYou ? 'you’re' : `${nameA}’s`} `;
    text += `, ${who}${v > 0 ? 'up' : 'down'} ${money(Math.abs(v))}`;
  }
  return text;
}

/**
 * The records between the people who are in, most rounds together first:
 * [{ a, b, aId, bId, aName, bName, aMe, bMe, scope: 'season' | 'all', rec }] (a and b are the plan's
 * ids, aId and bId the saved players, for their avatars). This season's record when
 * they've played this season, else all time. Pairs that never played together are left out.
 */
export function previewRecords(state, plan, { now = new Date() } = {}) {
  const people = previewPeople(state, plan).filter(p => p.player);
  const who = canonicalOf(state);
  const byPerson = new Map(people.map(p => [who(p.player.id), p]));
  const recs = pairRecords(state, people.map(p => p.player.id), { now });
  const out = [];
  for (const r of recs.values()) {
    if (!r.all.rounds) continue;
    const scope = r.season.rounds ? 'season' : 'all';
    const rec = r[scope];
    const pa = byPerson.get(r.a), pb = byPerson.get(r.b);
    // Said from the side that leads, so the sentence reads "Mike is 3 and 1 against Dave"
    const flip = rec.lost > rec.won || (rec.won === rec.lost && pb.me && !pa.me);
    const [x, y, rx] = flip ? [pb, pa, { ...rec, won: rec.lost, lost: rec.won, net: -rec.net || 0 }] : [pa, pb, rec];
    out.push({ a: x.who, b: y.who, aId: x.player.id, bId: y.player.id, aName: x.name, bName: y.name, aMe: x.me, bMe: y.me, scope, rec: rx });
  }
  out.sort((p, q) => q.rec.rounds - p.rec.rounds || Math.abs(q.rec.won - q.rec.lost) - Math.abs(p.rec.won - p.rec.lost) || p.aName.localeCompare(q.aName));
  return out;
}

// --------------------------- side bets --------------------------------------

/**
 * The two-player side bets on a plan, for the preview: the ones kept from setup (on the organizer's
 * phone, where the setup lives), then the agreed challenges. Only between two people neither of
 * whom said they're out (a bet goes in at the tee when both show).
 * [{ key, source: 'bet' | 'challenge', a, b, aName, bName, what, plain }]: `what` with the amount in
 * the plan's unit ("$20 match", "5 pts a hole"), `plain` without it ("match", "per hole").
 */
export function previewPairBets(state, plan, { now = new Date() } = {}) {
  const people = planPeople(plan);
  const byWho = new Map(people.map(p => [p.who, p]));
  const out = [];
  const outOf = who => byWho.get(who)?.status === 'out';
  const unit = playForOf(plan).kind === 'money' ? 'money' : 'points';
  const setup = plan?.setup;
  const agreed = agreedOnPlan(state, plan, now instanceof Date ? now.getTime() : now);
  // A setup bet that came from a challenge listed below (a round kept for another day keeps it): once
  const listed = new Set(agreed.map(x => x.ch.id));
  if (plan?.host && Array.isArray(setup?.bets) && setup.bets.length) {
    // Setup knows people by the organizer's own player ids; the plan by its keys
    let links = null;
    const personOf = pid => (links ??= linksOf(state)).personOf(pid);
    const keyOf = pid => (pid === setup.me || pid === state?.me ? plan.hostWho
      : people.find(p => p.who === pid)?.who ?? people.find(p => personOf(p.who) === personOf(pid))?.who ?? null);
    for (const b of setup.bets) {
      if (!Array.isArray(b?.sides) || b.sides.length !== 2 || !(Number(b.stake) > 0)) continue;
      if (listed.has(challengeIdOfBet(b.id))) continue;
      const [a, c] = b.sides.map(keyOf);
      if (!a || !c || a === c || outOf(a) || outOf(c)) continue;
      const kind = { kind: b.kind, label: b.label, unit };
      out.push({
        key: `bet:${b.id || out.length}`, source: 'bet', a, b: c,
        aName: first(byWho.get(a)?.name) || first(state?.players?.[b.sides[0]]?.name) || 'Guest',
        bName: first(byWho.get(c)?.name) || first(state?.players?.[b.sides[1]]?.name) || 'Guest',
        what: challengeWhat(kind, Number(b.stake)), plain: challengeWhatNoAmount(kind),
      });
    }
  }
  for (const x of agreed) {
    if (outOf(x.from) || outOf(x.to)) continue;
    out.push({ key: `ch:${x.ch.id}`, source: 'challenge', a: x.from, b: x.to, aName: x.fromName, bName: x.toName, what: x.what, plain: x.plain });
  }
  return out;
}

/** "Dave v Mike, $20 match", or with amounts hidden "Dave v Mike, match". */
export function pairBetLine(x, { amounts = true } = {}) {
  return `${x.aName} v ${x.bName}, ${amounts ? x.what : x.plain}`;
}

// --------------------------- the whole preview ------------------------------

/**
 * Everything the preview page and the image say about a plan:
 * { when, countdown, weekday, course, holes, game, gameName, gameIcon, bet, betFull, money, playFor,
 *   sides: [{ key, label, bet }], pairBets (previewPairBets), ins: [names], maybes: [names], waiting, out, strokes, records }
 * `bet` and each side's `bet` are in the plan's unit ("$5 a side", "5 pts a side"), `betFull` adds
 * the house rules ("$2 a skin · carryovers"); `money` says
 * whether they are dollars, which the image hides unless amounts are switched on.
 */
export function planPreview(state, plan, { now = new Date(), settings = state?.settings } = {}) {
  const { game, bet } = planChoice(plan);
  const rules = planRules(plan, settings);
  const people = planPeople(plan);
  const isMoney = playForOf(plan).kind === 'money';
  // The side games the round will start with: planStart leaves out any without house rules
  const sides = planSides(plan, game).filter(k => rules[k]).map(k => ({ key: k, label: SIDE_GAMES[k].label, bet: inUnits(plan, sideBetLine(k, rules[k])) }));
  const named = s => people.filter(p => p.status === s).map(p => first(p.name) || 'Guest');
  return {
    when: [dayLabel(plan.date, now), timeLabel(plan.teeTime)].filter(Boolean).join(' · '),
    countdown: countdown(plan, now),
    weekday: weekdayOf(plan),
    course: plan.course?.name || 'Course to be set',
    holes: GAMES[game] ? holesFor(game, plan) : plan.holesCount,
    game, gameName: GAMES[game]?.name || 'Golf', gameIcon: GAMES[game]?.icon || 'golf',
    bet: bet && rules[game] ? inUnits(plan, betUnitLabel(game, rules, bet)) : '',
    betFull: bet && rules[game] ? inUnits(plan, betLabel(game, rules, bet)) : '',
    money: isMoney,
    playFor: playForLine(plan),
    sides,
    pairBets: previewPairBets(state, plan, { now }),
    ins: named('in'), maybes: named('maybe'), out: named('out').length,
    waiting: people.filter(p => !p.status).length,
    strokes: previewStrokes(state, plan, { settings }),
    records: previewRecords(state, plan, { now }),
  };
}

// --------------------------- sharing ----------------------------------------

/** "Today", "Tomorrow", "2 days to go": the countdown for the image and the text. */
function toGo(cd) {
  if (!cd || cd.days < 0) return '';
  if (cd.days === 0) return 'Today';
  if (cd.days === 1) return 'Tomorrow';
  return `${cd.days} days to go`;
}

/** The strokes lines for sharing, names only (it goes to the group): only people who get strokes, plus the low player. */
function shareStrokes(st) {
  if (st.status === 'off') return { note: 'No handicaps, everyone plays straight up', lines: [] };
  if (st.status === 'noStrokes') return { note: 'No strokes in this game', lines: [] };
  if (st.status !== 'on') return { note: '', lines: [] };
  const n = st.holes.length;
  const getting = st.rows.filter(r => r.plays > 0);
  if (!getting.length) return { note: 'Nobody gets strokes', lines: [] };
  const low = st.rows.filter(r => !r.plays).map(r => r.name);
  return {
    note: [low.length ? `${listNames(low)} ${low.length === 1 ? 'plays' : 'play'} off the low` : '', st.pct < 100 ? pctWords(st.pct) : '', st.half ? 'half strokes' : ''].filter(Boolean).join(' · '),
    lines: getting.map(r => ({ name: r.name, count: `${r.plays}`, holes: strokeHolesText(r, n) })),
  };
}

/**
 * Everything the preview image says, as plain strings. With showAmounts off (the default), no
 * dollar figure appears anywhere: the game, the side games and the records still read, the money
 * does not. A points or reward plan is never money, so its points always show.
 */
export function previewCardModel(pv, { showAmounts: moneyOn = false } = {}) {
  const showAmounts = pv.money ? moneyOn : true;
  const main = pv.bet && showAmounts ? pv.bet : '';
  const bets = main ? [main] : [];
  if (pv.sides.length && showAmounts) bets.push(...pv.sides.map(s => (s.bet ? `${s.label}, ${s.bet}` : s.label)));
  else if (pv.sides.length) bets.push(`${main ? 'plus' : 'Plus'} ${listNames(pv.sides.map(s => s.label))}`);
  const strokes = shareStrokes(pv.strokes);
  return {
    eyebrow: `${pv.weekday || 'Next'} preview`,
    course: pv.course,
    meta: [pv.when, `${pv.holes} holes`].filter(Boolean).join(' · '),
    countBig: pv.countdown?.days > 0 ? pv.countdown.big : pv.countdown?.days === 0 ? 'Today' : '',
    countUnit: pv.countdown?.days > 0 ? pv.countdown.unit : '',
    toGo: toGo(pv.countdown),
    headline: pv.gameName,
    sub: bets.join(' · '),
    playFor: pv.playFor || null,
    ins: pv.ins,
    inLine: pv.ins.length ? `${pv.ins.length} in: ${listNames(pv.ins)}` : 'Nobody’s in yet',
    maybeLine: pv.maybes.length ? `Maybe: ${listNames(pv.maybes)}` : '',
    // Two-player side bets and agreed challenges: "Dave v Mike, $20 match" ("Dave v Mike, match" with amounts hidden)
    pairBets: (pv.pairBets || []).map(x => pairBetLine(x, { amounts: showAmounts })),
    strokesNote: strokes.note,
    strokes: strokes.lines,
    records: pv.records.map(r => recordSentence(r.rec, r.aName, r.bName, { scope: r.scope, amounts: showAmounts && pv.money })),
    footer: 'In, maybe or out? Answer from the group link.',
  };
}

/** The preview as a text for the group thread, with the link to answer when there is one. */
export function previewText(pv, { showAmounts = false, link = null } = {}) {
  const m = previewCardModel(pv, { showAmounts });
  const amounts = pv.money ? showAmounts : true;
  const strokes = m.strokes.map(s => `${s.name} gets ${s.count}: ${s.holes}`);
  const sides = pv.sides.map(s => (amounts && s.bet ? `${s.label} (${s.bet})` : s.label));
  return [
    `${m.toGo ? `${m.toGo}. ` : ''}${[pv.course, pv.when].filter(Boolean).join(', ')}.`,
    `Game: ${pv.gameName}${amounts && pv.bet ? `, ${pv.bet}` : ''}${sides.length ? `, plus ${listNames(sides)}` : ''}.`,
    m.playFor ? `${m.playFor}.` : null,
    m.pairBets.length ? `Side bets: ${m.pairBets.join('; ')}.` : null,
    `${m.inLine}.${m.maybeLine ? ` ${m.maybeLine}.` : ''}`,
    strokes.length ? `Strokes: ${strokes.join('; ')}.${m.strokesNote ? ` ${m.strokesNote.charAt(0).toUpperCase()}${m.strokesNote.slice(1)}.` : ''}` : m.strokesNote ? `${m.strokesNote}.` : null,
    ...m.records.slice(0, 4).map(r => `${r}.`),
    link,
  ].filter(Boolean).join('\n');
}

/** A file name for the image: preview-rancho-park-2026-10-04.png */
export function previewImageName(plan) {
  const slug = String(plan?.course?.name || 'round').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'round';
  return `preview-${slug}-${plan?.date || 'soon'}.png`;
}
