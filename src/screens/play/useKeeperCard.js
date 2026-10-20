// Keeping score in a shared round (Play.jsx, see keeper.js): who has the card, asking for it, taking
// it after two minutes with no answer, handing it over, and the toasts when it moves.
import { useEffect } from 'react';
import { update } from '../../lib/store.js';
import { buzz } from '../../lib/delight.js';
import { firstName } from '../../lib/format.js';
import {
  askForCard, askLeft, canTakeCard, clearAsk, declineAsk, declinedAsk, handOff, hostKeeper, isKeeper, keeperName, keeperOf, openAsk, seatTaken, takeCard as takeCardPatch, tookFromMe,
} from '../../lib/keeper.js';
import { HANDED, useNow } from './shared.js';

/** `me` is this phone's player in the round; `onHandedOff` closes the Hand off sheet as the card goes. */
export function useKeeperCard({ round, me, isHost, hole, idx, showToast, onHandedOff }) {
  const keeper = keeperOf(round);
  const sharedLive = !!round.shared && !round.shared.ended;
  const amKeeper = sharedLive && isKeeper(round, me, isHost);
  const inRound = !!me && round.players.some(p => p.id === me);
  const cardAsk = openAsk(round);
  // A second tick while an ask is open (the countdown), else every 30 seconds for the notes
  const now = useNow(sharedLive && keeper ? (cardAsk ? 1000 : 30000) : 0);
  const left = sharedLive && inRound ? askLeft(round, me, now) : null;
  const declined = sharedLive && inRound ? declinedAsk(round, me, now) : null;
  const tookBy = sharedLive ? tookFromMe(round, me, isHost, now) : null;
  const tookName = tookBy ? firstName(round.players.find(p => p.id === tookBy)?.name || '') : '';
  const holderName = keeperName(round);
  // A round shared before keepers existed: the host phone takes the card when it opens it
  useEffect(() => {
    if (!round.shared?.host || round.shared.ended || round.status !== 'active' || keeperOf(round)) return;
    update(s => { const r = s.rounds[round.id]; if (r && !keeperOf(r)) Object.assign(r, hostKeeper(), seatTaken(r, s.me)); });
  }, [round]);
  // Someone handed this phone the card: say so, and go to the hole they were on
  useEffect(() => {
    // The phone that started the round holds the card from sharing (id null, by null): nobody handed it over
    if (!amKeeper || !keeper?.since || keeper.id == null || keeper.by === me || HANDED.has(`${round.id}:${keeper.since}`)) return;
    HANDED.add(`${round.id}:${keeper.since}`);
    if (Date.now() - keeper.since > 30 * 60000) return;
    const from = keeper.by ? firstName(round.players.find(p => p.id === keeper.by)?.name || '') : round.hostName ? firstName(round.hostName) : '';
    const at = keeper.hole != null ? round.holes.findIndex(h => h.no === keeper.hole) : -1;
    const no = at >= 0 ? keeper.hole : hole.no;
    showToast(`${from || 'The scorekeeper'} handed you the card. You’re on hole ${no}.`);
    if (at >= 0 && at !== idx) update(s => { s.rounds[round.id].current = at; });
  }, [amKeeper, keeper?.id, keeper?.since, keeper?.by, keeper?.hole, me, round, idx, hole.no, showToast]);
  const askCard = () => { update(s => { Object.assign(s.rounds[round.id], askForCard(me)); }); showToast(`Asked ${holderName} for the card`); };
  const takeBack = () => update(s => { Object.assign(s.rounds[round.id], clearAsk()); });
  // The keeper didn't answer in 2 minutes: one tap takes it. Taken, not handed: `by` is the taker,
  // so nobody is told they were handed it, and `from` lets the old keeper's phone say who took it
  const takeCard = () => {
    update(s => { const r = s.rounds[round.id]; if (r && canTakeCard(r, me, Date.now())) Object.assign(r, takeCardPatch(r, me, Date.now(), hole.no)); });
    showToast('You’re keeping score');
    buzz(20);
  };
  // The card was taken from this phone: say who took it, once
  useEffect(() => {
    if (!tookBy || !keeper?.since || HANDED.has(`${round.id}:took:${keeper.since}`)) return;
    HANDED.add(`${round.id}:took:${keeper.since}`);
    showToast(`${tookName || 'Someone'} took the card`);
  }, [tookBy, tookName, keeper?.since, round.id, showToast]);
  const giveCard = pid => {
    onHandedOff();
    update(s => { const r = s.rounds[round.id]; if (r && isKeeper(r, me, isHost)) Object.assign(r, handOff(pid, me ?? null, Date.now(), hole.no)); });
    const who = firstName(round.players.find(p => p.id === pid)?.name || '');
    showToast(`${who} is keeping score now`);
  };
  const keepCard = () => update(s => { Object.assign(s.rounds[round.id], declineAsk(s.rounds[round.id])); });

  return { keeper, sharedLive, amKeeper, inRound, cardAsk, now, left, declined, tookBy, tookName, holderName, askCard, takeBack, takeCard, giveCard, keepCard };
}
