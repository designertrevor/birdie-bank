// The one-screen ask (screens/plan/PlanAsk.jsx): a new plan from a message, three optional details
// and who to ask. Nothing has to be set: the day can be set, a few days offered, or not sure yet;
// the course can wait; the group can pick the game and the bet. Pure, so it's easy to test.
import { GAMES } from './round.js';
import { MAX_BALLOT_GAMES, betChoices, betOf, newPlan } from './plans.js';
import { ASK_DEFAULT, ASK_MAX, MAX_DAY_OPTIONS, PARTS, validDay } from './plan-open.js';

/** The games most groups vote between, after the ones you've played most. */
export const GROUP_GAMES = ['skins', 'nassau', 'wolf', 'bestball'];

/**
 * The games on the ballot when the group picks: the ones you've played most (finished rounds),
 * then the usual favourites, four at most.
 */
export function groupGames(state, n = MAX_BALLOT_GAMES) {
  const count = new Map();
  for (const r of Object.values(state?.rounds || {})) {
    if (r?.status !== 'done' || !GAMES[r.game]) continue;
    count.set(r.game, (count.get(r.game) || 0) + 1);
  }
  const played = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return [...new Set([...played, ...GROUP_GAMES])].filter(k => GAMES[k]).slice(0, n);
}

/** The ask as typed: single spaces, trimmed, at most ASK_MAX characters, or the default when empty. */
export function cleanAsk(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, ASK_MAX) || ASK_DEFAULT;
}

/**
 * A plan from the ask. `when`: { mode: 'set' | 'options' | 'open', date, days, part }. `pick`:
 * { game, bet } the organizer set, each null for "the group picks". `games`: the ballot when the
 * group picks the game (groupGames). The organizer is in, and on a plan with days offered they can
 * make every one of them; they don't vote on what they left to the group.
 */
export function newAskPlan({ id, hostWho, hostName, ask, when = {}, course = null, people = [], pick = {}, games = GROUP_GAMES, settings = {}, now = Date.now() }) {
  const mode = ['set', 'options', 'open'].includes(when.mode) ? when.mode : 'open';
  const date = mode === 'set' && validDay(when.date) ? when.date : null;
  const days = mode === 'options' ? [...new Set((when.days || []).filter(validDay))].sort().slice(0, MAX_DAY_OPTIONS) : [];
  const groupGame = !GAMES[pick.game];
  const ballotGames = groupGame ? games.filter(k => GAMES[k]) : [pick.game];
  const game = ballotGames[0] || 'skins';
  const groupBet = !(Number(pick.bet) > 0);
  const usual = Number(betOf(game, settings)) || 5;
  const plan = newPlan({
    id, ...(hostWho ? { hostWho } : {}), hostName, game, holesCount: 18, nine: 'front', date, teeTime: null, course, people,
    ballot: { games: ballotGames.slice(1), bets: groupBet ? betChoices(usual) : [Number(pick.bet)] },
    suggestedBet: groupBet ? usual : Number(pick.bet), settings, useHc: false, now,
  });
  plan.ask = cleanAsk(ask);
  plan.when = { mode: date ? 'set' : mode === 'options' && days.length ? 'options' : 'open', days, part: PARTS.includes(when.part) ? when.part : null };
  plan.groupPicks = { game: groupGame, bet: groupBet };
  // The organizer's own answer: in, every day they offered, and no vote on what the group picks
  const mine = plan.answers[plan.hostWho];
  if (groupGame) delete mine.game;
  if (groupBet) { mine.bet = null; mine.betGame = null; }
  if (days.length) mine.days = days;
  return plan;
}
