// Saving the hole on screen and ending the round (Play.jsx): Save & next hole, auto presses, Finish
// round (asking first when holes are missing), Done fixing scores, and End round from the menu.
import { useRef } from 'react';
import { useUI } from '../../components/ui.jsx';
import { getState, update } from '../../lib/store.js';
import { roundProps, track } from '../../lib/analytics.js';
import { gameView, holeComplete, livePreview, nassauPressOptions, potMarksFor, pressMode, roundLegs } from '../../lib/round.js';
import { markUsualPlayed } from '../../lib/usuals.js';
import { holeMoneyLine } from '../../lib/format.js';
import { KEEP_DAYS, restoreRound, softDeleteRound } from '../../lib/recently-deleted.js';
import { countsMoney } from '../../lib/play-for.js';
import { leaveRound } from '../../lib/rounds.js';
import { pushRoundFinished } from '../../lib/push-client.js';
import { challengesBack } from '../../lib/challenge-sync.js';
import { useNav } from '../../lib/nav.js';
import { isKeeper, keeperSaved } from '../../lib/keeper.js';
import { DRAFTS, FINISHED_HERE, markSaved, sameTap } from './shared.js';

/**
 * `draft`, `marks`, `banker` and `wolf` are the hole as entered; `nextIdx` is where Save goes
 * (nextHoleIdx); `closeMenu` puts the round menu away before ending or finishing a fix.
 */
export function useHoleSave({ round, hole, isLast, nextIdx, units, game, editable, me, isHost, solo, draftKey, dirty, draft, marks, banker, wolf, closeMenu }) {
  const nav = useNav();
  const { ask, showToast } = useUI();

  // One save at a time: the last hole waits on finishing, which can ask first
  const saving = useRef(false);
  const saveHole = async () => {
    if (!editable || saving.current) return;
    if (sameTap(round.id, hole.no, dirty)) return;
    saving.current = true;
    try { await saveThisHole(); } finally { saving.current = false; }
  };
  const saveThisHole = async () => {
    if (game === 'wolf' && wolf.partner === undefined) { showToast(`Pick ${round.players.find(p => p.id === wolf.wolf)?.name.split(' ')[0] || 'the wolf'}’s partner, or go lone wolf`); return; }
    const scores = Object.fromEntries(units.map(p => [p.id, draft[p.id]]));
    // ...and a pot added while this hole was open still saves the hole as nobody's when nobody's tapped
    const holeMarks = potMarksFor(round, hole, marks);
    DRAFTS.delete(draftKey);
    const moneyLine = holeMoneyLine(round, hole, livePreview(round, hole, { scores, banker, wolf, marks: holeMarks }).delta);
    // The last hole's line would sit over the reveal's buttons, so it only shows if the round does not finish
    const moneyTone = /No money moved/.test(moneyLine) ? {} : { tone: 'money' };
    if (!isLast) showToast(moneyLine, null, moneyTone);
    update(s => {
      const r = s.rounds[round.id];
      r.scores[hole.no] = scores;
      if (game === 'banker') r.banker[hole.no] = banker;
      if (game === 'wolf') r.wolf[hole.no] = wolf;
      if (holeMarks) { if (!r.marks) r.marks = {}; r.marks[hole.no] = holeMarks; }
      if (!isLast) r.current = nextIdx;
      // The keeper's phone saved a hole (kept for the record of who's been scoring)
      if (isKeeper(r, me, isHost)) Object.assign(r, keeperSaved(r));
      // Auto presses before the next hole
      if (pressMode(r) === 'auto' && !isLast) {
        const next = nextIdx + 1; // playing position of the hole we're going to
        // The main game's own players: a side-only player is never on a side
        for (const o of nassauPressOptions(gameView(r, 'main'), next)) {
          r.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
        }
      }
    });
    markSaved(round.id, hole.no);
    if (pressMode(round) === 'auto' && !isLast) {
      const r = getState().rounds[round.id];
      const legs = roundLegs(r);
      const fresh = r.presses.filter(p => p.start === nextIdx + 1);
      if (fresh.length) showToast(Object.keys(legs).length > 1 ? `Auto press on the ${fresh.map(p => legs[p.leg].label.replace(/^[A-Z]/, c => c.toLowerCase())).join(' and ')}` : 'Auto press!');
    }
    if (isLast && !(await finish())) showToast(moneyLine, null, moneyTone);
  };

  const finish = async () => {
    const r = getState().rounds[round.id];
    // Fixing a finished round: it never stopped counting, so just go back to the results (and, like
    // finishing, no "Hole 18 saved" toast over them)
    if (r.editing && r.status === 'done') { doneEditing(); return true; }
    const missing = r.holes.filter(h => !holeComplete(r, h));
    if (missing.length) {
      const one = missing.length === 1;
      const go = await ask({
        title: `${missing.length} hole${one ? '' : 's'} not fully scored`,
        text: solo ? `Hole${one ? '' : 's'} ${missing.map(h => h.no).join(', ')} ${one ? 'has' : 'have'} no score. Finish anyway? You can fill ${one ? 'it' : 'them'} in later from your card.`
          : `Hole${one ? '' : 's'} ${missing.map(h => h.no).join(', ')} ${one ? 'is' : 'are'} missing scores and won’t count for ${countsMoney(round) ? 'money' : 'points'}. Finish anyway? You can fix scores later from the results.`,
        actions: [{ label: 'Finish round', value: 'finish' }, { label: 'Go to first missing hole', value: 'goto', secondary: true }],
      });
      if (go === 'goto') { update(s => { s.rounds[round.id].current = r.holes.indexOf(missing[0]); }); return; }
      if (go !== 'finish') return;
    }
    FINISHED_HERE.add(round.id);
    update(s => {
      const rr = s.rounds[round.id];
      rr.status = 'done'; rr.finishedAt = Date.now();
      markUsualPlayed(s, rr, rr.finishedAt);
      leaveRound(s, round.id);
    });
    pushRoundFinished(getState().rounds[round.id]);
    track('round_finished', roundProps(getState().rounds[round.id], { early: false }));
    nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
    return true;
  };
  const doneEditing = () => {
    closeMenu();
    FINISHED_HERE.add(round.id);
    update(s => { delete s.rounds[round.id].editing; });
    nav.reset('history', ['roundDetail', { id: round.id }]);
  };

  const endEarly = async () => {
    closeMenu();
    const played = round.holes.filter(h => holeComplete(round, h)).length;
    const choice = await ask({
      title: 'End this round?',
      text: played ? `${played} of ${round.holes.length} holes scored.` : 'No holes have been scored yet.',
      actions: [
        ...(played ? [{ label: 'Finish and count holes played', value: 'finish' }] : []),
        // Not teed off yet on a round you set up: keep the setup as a plan for another day
        ...(!played && !round.localMe && !solo && round.shared?.host !== false ? [{ label: 'Schedule for later instead', value: 'later' }] : []),
        { label: 'Delete round', value: 'discard', danger: true },
      ],
      cancelLabel: 'Keep playing',
    });
    if (choice === 'finish') {
      FINISHED_HERE.add(round.id);
      update(s => { const rr = s.rounds[round.id]; rr.status = 'done'; rr.finishedAt = Date.now(); markUsualPlayed(s, rr, rr.finishedAt); leaveRound(s, round.id); });
      pushRoundFinished(getState().rounds[round.id]);
      track('round_finished', roundProps(getState().rounds[round.id], { early: true }));
      nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
    }
    if (choice === 'later') nav.push('newRound', { reschedule: round.id });
    if (choice === 'discard') {
      const sure = await ask({ title: 'Delete this round?', text: `It leaves Up next and the Tab. You can bring it back from Settings, Recently deleted, for ${KEEP_DAYS} days.`, confirmLabel: 'Delete round', danger: true });
      if (!sure) return;
      // A challenge that went into it is agreed again for the next round together
      challengesBack(getState().rounds[round.id]);
      // It waits in Settings, Recently deleted, for 30 days (recently-deleted.js)
      const id = round.id;
      update(s => { softDeleteRound(s, id); });
      nav.reset('upnext');
      showToast('Round deleted', { label: 'Undo', run: () => update(s => { restoreRound(s, id); }) });
    }
  };

  return { saveHole, doneEditing, endEarly };
}
