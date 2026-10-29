// Draws a Good Dog trial drawing (GdArt.jsx): the fills under a pencil grain, the ink line through a
// displacement filter so it wobbles and breaks like a scratchy pen. The line takes --gd-line (ink in
// light, cream in dark), so the same drawing sits on any band.
import { useId } from 'react';
import { GD_ART } from './gd-art-data.js';

export default function GdArtDraw({ name, w, h, className = '' }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const art = GD_ART[name] || GD_ART.nassau;
  const vw = Number(art.vb.split(' ')[2]);
  // Small drawings get a little less wobble, so a 44px icon still reads; a big drawing set small keeps
  // its line at screen pixels (non-scaling, CSS .gd-art.thin) so it never thins to a hair
  const wob = vw <= 64 ? 2.2 : 2.6;
  const thin = w / vw < 0.55;
  return (
    <svg className={`gd-art ${thin ? 'thin' : ''} ${className}`.replace(/\s+/g, ' ').trim()} viewBox={art.vb} width={w} height={h} aria-hidden="true" focusable="false">
      <defs>
        <filter id={`w${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale={wob} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`g${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="2" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 1.5" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </defs>
      <g className="gd-fill" filter={`url(#g${id})`} dangerouslySetInnerHTML={{ __html: art.fill }} />
      <g filter={`url(#w${id})`} fill="none" stroke="var(--gd-line)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: art.line }} />
    </svg>
  );
}
