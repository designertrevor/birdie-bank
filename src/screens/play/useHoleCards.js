// The two cards that come up over a hole (Play.jsx): the first-tee rules card (agreed.js) and
// "Any side bets on this hole?" (bet-prompt.js).
import { useEffect, useState } from 'react';
import { update, useStore } from '../../lib/store.js';
import { useKept } from '../../lib/kept.js';
import { holeAtPos, holeComplete } from '../../lib/round.js';
import { isLocked, lockAgreement, noteChanges, showFirstTee } from '../../lib/agreed.js';
import { betPromptFor, markPrompt } from '../../lib/bet-prompt.js';
import { buzz } from '../../lib/delight.js';
import { AGREED_SEEN } from './shared.js';

/**
 * The first-tee rules card. `at` is the hole's kept-state prefix, so "What we agreed" left open comes
 * back after a reload. `agreedSheet` is 'lock' on the keeper's phone before hole 1, or 'view' for
 * "What we agreed" from the menu.
 */
export function useFirstTee({ round, at, editable, solo, me, showToast }) {
  const [agreedSheet, setAgreedSheet] = useKept(`${at}agreedSheet`, null);
  const firstTee = editable && !solo && showFirstTee(round);
  // A phone that isn't keeping score sees the card when it's locked in, until it's closed or hole 1 is scored
  const [, seenCard] = useState(0);
  const watchCard = !editable && isLocked(round) && !holeComplete(round, round.holes[0]) && !AGREED_SEEN.has(round.id);
  // After locking, any change to what was agreed is listed against the hole (the keeper's phone writes it)
  useEffect(() => {
    if (!editable) return;
    const next = noteChanges(round);
    if (next) update(s => { const r = s.rounds[round.id]; if (r) r.agreed = next; });
  }, [round, editable]);
  const lockIn = calls => {
    update(s => {
      const r = s.rounds[round.id];
      if (r) r.agreed = lockAgreement(r, calls, me ?? null);
      s.firstTee = calls; // next round's card starts from the same calls
    });
    setAgreedSheet(null);
    showToast('Locked in. It’s in the round menu if anyone asks.');
    buzz(20);
  };
  const skipCard = () => {
    update(s => { const r = s.rounds[round.id]; if (r && !r.agreed) r.agreed = { skipped: Date.now() }; });
    setAgreedSheet(null);
  };
  const setCalls = calls => update(s => { const r = s.rounds[round.id]; if (r?.agreed?.at) Object.assign(r.agreed, calls); });
  // Closing "What we agreed" (or the card a watching phone was shown) puts it away for this round
  const closeView = () => { setAgreedSheet(null); AGREED_SEEN.add(round.id); seenCard(n => n + 1); };
  return { agreedSheet, setAgreedSheet, firstTee, watchCard, lockIn, skipCard, setCalls, closeView };
}

/**
 * "Any side bets on this hole?" for the hole at `idx`. It never comes up over the first-tee card
 * (`cardUp`) or a moment banner (`momentUp`). `onAdd` opens the side bet editor filled in.
 */
export function useBetPrompt({ round, idx, me, editable, momentUp, cardUp, dirty, showToast, onAdd }) {
  const promptOn = useStore(s => s.settings.betPrompt !== false);
  const promptSeen = useStore(s => s.betPrompts?.[round.id] || null);
  // It only comes up before a score on the hole is touched, but once up it stays while scores go in,
  // so the score rows never jump up under a finger (the hole remounts on save, which starts this over)
  const [promptShown, setPromptShown] = useState(false);
  const betPrompt = betPromptFor(round, idx + 1, { me, editable, on: promptOn, seen: promptSeen, moment: momentUp || cardUp, scoring: dirty && !promptShown });
  if (betPrompt && !promptShown) setPromptShown(true);
  const promptAdd = () => {
    update(s => markPrompt(s, round.id, { pos: betPrompt.pos }));
    onAdd({ kind: betPrompt.kind, holes: betPrompt.holes });
  };
  // "Not this hole": put off to later in the round (bet-prompt.js laterSpot says where), and the toast says when
  const promptLater = () => {
    const later = betPrompt.later;
    update(s => markPrompt(s, round.id, { pos: betPrompt.pos, later }));
    // A closest-to-the-pin ask names why that hole: it's the next par 3
    const at = holeAtPos(round, later.pos);
    showToast(later.kind === 'ctp' ? `Not this hole. It’ll ask again on the next par 3, hole ${at}` : `Not this hole. It’ll ask again on hole ${at}`);
  };
  const promptSkip = () => {
    update(s => markPrompt(s, round.id, { skip: true }));
    showToast('No more side bet asks this round');
  };
  const promptOff = () => {
    update(s => { s.settings.betPrompt = false; });
    showToast('Side bet asks are off. Turn them on again in Settings.', { label: 'Undo', run: () => update(s => { s.settings.betPrompt = true; }) });
  };
  return { betPrompt, promptAdd, promptLater, promptSkip, promptOff };
}
