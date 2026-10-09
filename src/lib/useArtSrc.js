// A drawing on the page read as a picture a canvas can draw (the results image's reaction and game
// art, ResultsArt.jsx), the way Share.jsx hands the profile and rivalry cards their buddies.
import { useCallback, useState } from 'react';

/**
 * A drawing on the page as a picture the canvas can draw: [src, grab]. Put `grab` on the hidden
 * span that holds the SVG, keyed on what it shows so a change reads it again.
 */
export function useArtSrc() {
  const [src, setSrc] = useState(null);
  const grab = useCallback(node => {
    const svg = node?.querySelector('svg');
    if (svg && typeof XMLSerializer !== 'undefined') setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`);
  }, []);
  return [src, grab];
}
