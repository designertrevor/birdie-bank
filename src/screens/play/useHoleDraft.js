// The scores and marks being entered on the hole on screen (Play.jsx), before Save: what each box
// starts at, what's been touched, the side games' marks, and the tap that sets a score.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES, POT_GAMES, gameView, potHoles, potMarksFor, sideGamesOf, teamCounting } from '../../lib/round.js';
import { keepsDraft } from '../../lib/hole-fix.js';
import { drivesNeeded } from '../../lib/scramble-drives.js';
import { scoreName } from '../../lib/golf.js';
import { buzz, confettiFrom } from '../../lib/delight.js';
import { sound } from '../../lib/sound-play.js';
import { scoreSound } from '../../lib/sounds.js';
import { startScore } from '../../lib/par-chips.js';
import { DRAFTS } from './shared.js';

/**
 * `units` are the score boxes (players still playing, or teams in a one-ball game); `main` is the main
 * game's own round. Returns the draft and its setters, plus the side games that put marks on the hole.
 */
export function useHoleDraft({ round, hole, units, main, game, editable, showToast }) {
  // Draft scores for this hole: saved scores, else par (in ink, with the Par chip outlined until touched)
  const saved = round.scores[hole.no] || {};
  const draftKey = `${round.id}:${hole.no}`;
  const kept = DRAFTS.get(draftKey);
  // Edits you made but haven't saved win over the saved score; otherwise the saved score (which may have come from another phone) wins.
  // Only scores you actually changed count as edits, so a score saved on another phone isn't reset to par.
  const wasDirty = !!kept?.dirty;
  // A score confirmed at par also stays when the hole's par was fixed before saving (see keepsDraft)
  const mine = id => keepsDraft(kept, id, saved, hole.par);
  const [dirty, setDirty] = useState(wasDirty);
  const [base] = useState(() => Object.fromEntries(units.map(p => [p.id, mine(p.id) ? kept.base[p.id] : startScore(saved, p.id, hole.par)])));
  const [draft, setDraft] = useState(() => Object.fromEntries(units.map(p => [p.id, mine(p.id) ? kept.draft[p.id] : startScore(saved, p.id, hole.par)])));
  const [touched, setTouched] = useState(() => Object.fromEntries(units.map(p => [p.id, saved[p.id] != null || (wasDirty && !!kept.touched[p.id])])));
  // Best ball and Shamble: whose scores count for each team on this hole (only scores entered, while entering)
  const counting = editable ? teamCounting(main, hole, Object.fromEntries(units.filter(u => touched[u.id]).map(u => [u.id, draft[u.id]]))) : teamCounting(main, hole);
  const emptyMarks = { bbb: { bingo: null, bango: null, bongo: null }, snake: { snake: [] }, hammer: { hammers: [], conceded: null } }[game] || {};
  // Junk as a side game: its dots are saved in the same marks object as the main game's marks
  const junk = useMemo(() => (sideGamesOf(round).some(sg => sg.game === 'dots') ? gameView(round, 'dots') : null), [round]);
  // ...and Snake as a side game: its three-putts go in there too, under `snake`
  const snakeSide = useMemo(() => (sideGamesOf(round).some(sg => sg.game === 'snake') ? gameView(round, 'snake') : null), [round]);
  // ...and the closest to the pin and long drive pots: who won each pot hole goes in there, under `ctp` or `drive`
  const pots = useMemo(() => sideGamesOf(round).filter(sg => POT_GAMES.includes(sg.game)).map(sg => gameView(round, sg.game)), [round]);
  const potHere = pots.some(v => potHoles(v, v.game).some(h => h.no === hole.no));
  const [marks, setMarks] = useState(() => {
    // A scramble playing for minimum drives saves whose drive each team used in the marks too
    if (!GAMES[game].marks && !junk && !snakeSide && !potHere && !drivesNeeded(round)) return null;
    // A pot hole saved with nobody tapped is saved as nobody's, so it counts (and carries) like one tapped
    const m = potMarksFor(round, hole, (wasDirty && kept.marks) || structuredClone(round.marks?.[hole.no] || emptyMarks));
    return snakeSide && !m.snake ? { ...m, snake: [] } : m;
  });
  useEffect(() => { DRAFTS.set(draftKey, { draft, base, touched, dirty, marks }); }, [draftKey, draft, base, touched, dirty, marks]);
  const numRefs = useRef({});
  // Whose score was tapped since this hole opened: only those get the birdie critter (ScoreCritter)
  const [tapped, setTapped] = useState(() => new Set());

  const setMarksDirty = m => { setDirty(true); setMarks(m); };
  const setScore = (pid, v) => {
    setDirty(true);
    setTapped(t => (t.has(pid) ? t : new Set(t).add(pid)));
    setDraft(d => ({ ...d, [pid]: v }));
    setTouched(t => ({ ...t, [pid]: true }));
    buzz(8);
    if (v !== 'X' && v <= hole.par - 1 && (draft[pid] === 'X' || v < draft[pid])) {
      const name = scoreName(v, hole.par);
      showToast(`${name}!`);
      confettiFrom(numRefs.current[pid], v <= hole.par - 2 ? 60 : 30);
      buzz([20, 40, 20]);
      sound(scoreSound(v, hole.par));
    }
  };

  return { saved, draftKey, dirty, draft, touched, counting, junk, snakeSide, pots, potHere, marks, setMarksDirty, numRefs, tapped, setScore };
}
