// Counting a round for a trip, and a team points trip's matches for it (NewRound.jsx, cup.js).
// Moved out of NewRound.jsx unchanged when it was split up.
import { useKept } from '../../lib/kept.js';
import { isoDate } from '../../lib/plans.js';
import { startingCup } from '../../lib/cup-store.js';
import { planCupFor, scheduledCupFor, withSessionWorth } from '../../lib/trip-templates.js';
import { FOURSOMES_GAME, cleanRoundCup, cupCounts, cupOf } from '../../lib/cup.js';
import { countsByDefault, tripOf, tripOnDay } from '../../lib/trips.js';

/** The trip this round counts for (`tripPick`, or null), and its cup matches when it's a team points trip. */
export function useSetupTrip({ state, tripId, fromPlan, planning, date, invited, picked, betting, game, teams, setTeams }) {
  // "Count it for the trip?": a trip on the round's day (or the trip it was started from). Yes by
  // default when trip people are in it; the plan's own trip when it came from a planned round
  const fromPlanTrip = fromPlan ? state.plans?.[fromPlan]?.trip : null;
  const tripOn = tripId ? tripOf(state, tripId) : fromPlanTrip ? tripOf(state, fromPlanTrip.id) : tripOnDay(state, planning ? date : isoDate());
  const [countTrip, setCountTrip] = useKept('setup:countTrip', null); // null until changed: the default
  const countOn = countTrip ?? (!!tripOn && (!!tripId || !!fromPlanTrip || countsByDefault(state, tripOn.id, planning ? [state.me, ...invited] : picked)));
  const tripPick = tripOn && countOn ? tripOn : null;
  // A team points trip: the round's matches from the trip's teams, changeable here (cup.js)
  const [cupPick, setCupPick] = useKept('setup:cupPick', null); // { sig, cup } once changed
  const cupPlayers = betting.map(pid => state.players[pid]).filter(Boolean).map(p => ({ id: p.id, name: p.name }));
  const cupSig = `${game}|${betting.join(',')}|${tripPick?.id || ''}`;
  const tripCup = !planning && tripPick ? cupOf(tripPick) : null;
  // Foursomes (an Alternate shot round): the match is the round's two teams, so its partners are the teams
  const foursomes = !!tripCup && game === FOURSOMES_GAME;
  // From a round the trip's schedule planned (trip-templates.js): its group's matches, while they fit
  const planCup = tripCup && fromPlan ? planCupFor(state.plans?.[fromPlan], cupPlayers) : null;
  const fromSession = fromPlan ? state.plans?.[fromPlan]?.session || null : null;
  // Else a group of the trip's schedule today, from the trip's teams (a friend's group teeing off on their own phone)
  const schedHit = tripCup && !planCup && !(fromSession?.trip === tripPick.id) ? scheduledCupFor(state, tripPick, cupPlayers, { date: isoDate(), game, hour: new Date().getHours() }) : null;
  const cupStart = tripCup ? planCup || schedHit?.cup || withSessionWorth(startingCup(state, { game, players: cupPlayers }, tripPick), fromSession, tripPick.id) : null;
  const cupPairs = c => (c && c.sides.every(x => x.length === 2) && c.sides.flat().length === betting.length && c.sides.flat().every(pid => betting.includes(pid)) ? c.sides.map(x => [...x]) : null);
  const roundCup = !tripCup ? null
    : foursomes ? (teams ? cleanRoundCup({ game, players: cupPlayers, teams: teams.map(t => ({ players: t })), cup: cupStart || { kind: 'foursomes', sides: [[], []] } }) : cupStart) || { kind: 'foursomes', sides: [[], []] }
    : cupPick?.sig === cupSig ? cleanRoundCup({ game, players: cupPlayers, cup: cupPick.cup })
    : cupStart || (!cupCounts(game) ? { kind: 'singles', sides: [[], []] } : null);
  const onCup = c => {
    if (!foursomes) return setCupPick({ sig: cupSig, cup: c });
    const pairs = cupPairs(c);
    if (pairs) setTeams(pairs);
  };
  return { tripOn, countOn, setCountTrip, tripPick, tripCup, foursomes, cupPlayers, cupStart, cupPairs, roundCup, onCup, fromSession, schedHit };
}
