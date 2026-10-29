// One of the Good Dog trial's drawings (gd-art-data.js), drawn by GdArtDraw.jsx. Both are a chunk of
// their own that only the trial loads (main.jsx starts it early), so the overhaul look's first screen
// doesn't carry them; until it's in, the drawing's box holds its place.
import { Suspense, lazy } from 'react';
import { GD_BOXES } from './gd-art.js';

const Draw = lazy(() => import('./GdArtDraw.jsx'));

export function GdArt({ name, width, height, className = '' }) {
  const [vw, vh] = GD_BOXES[name] || GD_BOXES.nassau;
  const w = width || (height ? Math.round(height * vw / vh) : vw);
  const h = height || Math.round(w * vh / vw);
  const box = <svg className={`gd-art ${className}`.trim()} viewBox={`0 0 ${vw} ${vh}`} width={w} height={h} aria-hidden="true" focusable="false" />;
  return <Suspense fallback={box}><Draw name={name} w={w} h={h} className={className} /></Suspense>;
}
