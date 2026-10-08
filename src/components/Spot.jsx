// A spot illustration's box. The drawings (SpotArt.jsx, with the Ball buddies they stand with) are
// most of the first screen's art, so they load right after the first paint, the way the buddy
// avatars do (Avatar.jsx): until then a spot is an empty box of the same size and class, so
// nothing moves, and a drawing that lands after its box was painted fades in.
import { Suspense, lazy, useState } from 'react';

const load = () => import('./SpotArt.jsx');
let ready = false;
const Box = ({ size = 96, className = '' }) => <svg className={`spot ${className}`.trim()} viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false" />;
// A drawing that can't load (no signal before the app was ever saved offline) leaves its box empty, never the screen broken
const Art = lazy(() => load().then(m => { ready = true; return { default: m.Spot }; }, () => ({ default: Box })));
if (typeof window !== 'undefined') load().then(() => { ready = true; }, () => {});

/**
 * One spot illustration: `kind` picks the scene, `ids` the buddies in a crowd or high five, `size`
 * the box, `plate` its colour (see SpotArt.jsx). Decorative: screen readers skip it.
 */
export function Spot({ size = 96, className = '', ...rest }) {
  // Whether the drawings were in before this spot first showed: one that lands later fades in
  const [late] = useState(() => !ready);
  return (
    <Suspense fallback={<Box size={size} className={className} />}>
      <Art size={size} className={`${className} ${late ? 'spot-late' : ''}`.trim()} {...rest} />
    </Suspense>
  );
}
