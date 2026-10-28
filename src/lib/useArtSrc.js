// A drawing on the page read as a picture a canvas can draw (the results image's reaction and game
// art, ResultsArt.jsx), the way Share.jsx hands the profile and rivalry cards their buddies.
import { useCallback, useRef, useState } from 'react';

const asDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * The SVG as one self-contained data link. An SVG drawn as a picture loads nothing from outside, so
 * the outside drawings it places (src/art files, as <image href>) are read in and inlined first, and
 * the dark theme's copies (.art-dark, hidden by the stylesheet on the page) are dropped. A drawing
 * that can't be read stays a link, so the rest still draws.
 */
export async function svgDataUrl(svg) {
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('.art-dark').forEach(n => n.remove());
  await Promise.all([...clone.querySelectorAll('image')].map(async img => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href');
    if (!href || href.startsWith('data:')) return;
    try {
      const res = await fetch(href);
      if (res.ok) img.setAttribute('href', await asDataUrl(await res.blob()));
    } catch { /* leave the link */ }
  }));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
}

/**
 * A drawing on the page as a picture the canvas can draw: [src, grab]. Put `grab` on the hidden
 * span that holds the SVG, keyed on what it shows so a change reads it again.
 */
export function useArtSrc() {
  const [src, setSrc] = useState(null);
  // Only the latest grab lands, if a newer drawing replaced the span while its files were read
  const last = useRef(0);
  const grab = useCallback(node => {
    const svg = node?.querySelector('svg');
    if (!svg || typeof XMLSerializer === 'undefined') return;
    const n = ++last.current;
    svgDataUrl(svg).then(url => { if (n === last.current) setSrc(url); }, () => {});
  }, []);
  return [src, grab];
}
