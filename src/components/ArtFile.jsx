// An outside drawing (src/art, see lib/art-files.js) placed inside one of the app's SVG boxes, so
// it takes the hand-drawn one's size, clipping and layout. Both themes' files are in the markup
// and the stylesheet shows the right one (.art-light / .art-dark).
//
// Every illustration sits on the page like a die-cut sticker: an even white border follows its
// silhouette, so dark shoes and hats read on the dark canvas and the drawing looks cut out on the
// cream one (Trevor, 2026-10-29). It's an SVG filter in the drawing's own box rather than a CSS
// drop-shadow, so iOS Safari draws it on SVG content too and it travels with the drawing when a
// share card turns the SVG into a picture.
import { useId } from 'react';

/** A filter id that's safe inside url(#...) */
function useFilterId() {
  return `stk${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * The sticker filter: the drawing's shape blurred and cut at a low level is the same shape grown
 * by `r` evenly all round (and filled across gaps narrower than the border, as a die-cut sticker
 * is). That shape is filled white, with a hairline just outside it in the light theme so the white
 * edge still reads on a white card. `r` and the region are in the user units of whatever it's on.
 * The colours are set again in styles.css (.stk-edge, .stk-hair) so they follow the theme; the
 * attributes are what a share card's picture gets.
 */
function StickerFilter({ id, r, x, y, w, h }) {
  const s = r / 1.28;
  const pad = r * 3;
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation={s} result="spread" />
      {/* Cut at 0.1: a straight edge grows by 1.28 times the blur, which is r */}
      <feComponentTransfer in="spread" result="cut"><feFuncA type="linear" slope="16" intercept="-1.12" /></feComponentTransfer>
      {/* A little lower for the hairline, so it sits just outside the white */}
      <feComponentTransfer in="spread" result="ring"><feFuncA type="linear" slope="16" intercept="-0.5" /></feComponentTransfer>
      <feFlood className="stk-hair" floodColor="rgba(10,10,10,.14)" />
      <feComposite in2="ring" operator="in" result="hair" />
      <feFlood className="stk-edge" floodColor="#ffffff" />
      <feComposite in2="cut" operator="in" result="edge" />
      <feMerge><feMergeNode in="hair" /><feMergeNode in="edge" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  );
}

/**
 * Children drawn as one sticker, for a drawing made of several parts (a crowd of buddies, the high
 * five). `box` is the area they cover, [x, y, w, h] in the parent's units; `r` the border in those
 * units. `r={0}` draws them plain.
 */
export function Sticker({ r, box, children }) {
  const id = useFilterId();
  if (!r) return children;
  const [x, y, w, h] = box;
  return (
    <>
      <defs><StickerFilter id={id} r={r} x={x} y={y} w={w} h={h} /></defs>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
}

/**
 * `file` from artFile(); `x`, `y`, `w`, `h` in the parent SVG's units. `slice` fills the box and crops, like the scenes.
 * `sticker` is the white border's width in the parent's units: by default 2.2% of the box's short side,
 * `false` (or `outline={false}`, the older name) for a drawing that sits inside another sticker or on its own backdrop.
 */
export function ArtImage({ file, x = 0, y = 0, w, h, slice = false, sticker = null, outline = true }) {
  const id = useFilterId();
  const par = slice ? 'xMidYMax slice' : 'xMidYMid meet';
  const r = sticker === false || outline === false ? 0 : sticker ?? Math.min(w, h) * 0.022;
  const filter = r ? `url(#${id})` : undefined;
  return (
    <>
      {r ? <defs><StickerFilter id={id} r={r} x={x} y={y} w={w} h={h} /></defs> : null}
      <image href={file.light} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className={file.dark ? 'art-light' : undefined} filter={filter} />
      {file.dark && <image href={file.dark} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className="art-dark" filter={filter} />}
    </>
  );
}
