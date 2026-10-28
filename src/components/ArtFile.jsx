// An outside drawing (src/art, see lib/art-files.js) placed inside one of the app's SVG boxes, so
// it takes the hand-drawn one's size, clipping and layout. Both themes' files are in the markup
// and the stylesheet shows the right one (.art-light / .art-dark).
/**
 * `file` from artFile(); `x`, `y`, `w`, `h` in the parent SVG's units. `slice` fills the box and crops, like the scenes.
 * `ring` is another outline class for the drawing (the buddies' .buddy-ring, see styles.css), used in place of `outline`.
 */
export function ArtImage({ file, x = 0, y = 0, w, h, slice = false, outline = true, ring = '' }) {
  const par = slice ? 'xMidYMax slice' : 'xMidYMid meet';
  // In the dark theme a drawing with no dark file gets a thin cream outline, like a sticker (styles.css .art-outline)
  const cls = [file.dark ? 'art-light' : '', outline && !file.dark ? 'art-outline' : '', ring].filter(Boolean).join(' ') || undefined;
  return (
    <>
      <image href={file.light} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className={cls} />
      {file.dark && <image href={file.dark} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className="art-dark" />}
    </>
  );
}
