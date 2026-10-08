import { useEffect, useState } from 'react';

/** How long a leaving screen stays on stage: the exit animations in styles.css run --duration-fast (250ms) */
const STAGE_MS = 300;

/**
 * Screens leave the way they came. `id` names what's on stage; when it changes, the children from
 * the render before stay mounted for a beat with a leaving class while the new ones come in, then
 * go. `dir` says how the change happened:
 * - 'push': a new screen over this one. It slides in from the right over the old one, which waits
 *   underneath so nothing blank shows through.
 * - 'pop': back. The old one slides out to the right, on top, and the one under it comes in from the left.
 * - 'swap': a tab change or a replaced screen. The old one fades out over the new.
 * Each screen keeps the class it arrived with (in-push, in-pop, in-none), so its entrance never
 * restarts when the stage clears. Timed rather than animationend, so reduced motion (no animations
 * at all) still clears the stage, and so do nested stages (the end-of-round beats inside their screen).
 */
export function Stage({ id, dir = 'swap', children }) {
  // What's on stage and the last children rendered for it, kept so they can stay a beat after `id`
  // moves on; `leaving` is the one on its way out
  const [shown, setShown] = useState({ id, dir: 'none', node: children, leaving: null });
  if (shown.id !== id) {
    setShown({ id, dir, node: children, leaving: { id: shown.id, node: shown.node, dir } });
  } else if (shown.node !== children) {
    setShown({ ...shown, node: children });
  }
  // The one leaving goes after its beat (this very one: a quicker change already replaced it)
  const leaving = shown.id === id ? shown.leaving : null;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setShown(s => (s.leaving === leaving ? { ...s, leaving: null } : s)), STAGE_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  const arrived = shown.id === id ? shown.dir : dir;
  // Keyed on the screen, so the one leaving keeps its mounted instance as it moves to the leaving slot
  const items = [];
  if (leaving && leaving.dir === 'push') items.push(<div key={`s:${leaving.id}`} className="stage under">{leaving.node}</div>);
  items.push(<div key={`s:${id}`} className={`stage in-${arrived}`}>{children}</div>);
  if (leaving && leaving.dir !== 'push') items.push(<div key={`s:${leaving.id}`} className={`stage out-${leaving.dir}`}>{leaving.node}</div>);
  return items;
}
