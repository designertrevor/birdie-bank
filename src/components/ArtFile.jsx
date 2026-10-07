// An outside drawing (src/art, see lib/art-files.js) placed inside one of the app's SVG boxes, so
// it takes the hand-drawn one's size, clipping and layout. Both themes' files are in the markup
// and the stylesheet shows the right one (.art-light / .art-dark).
/** `file` from artFile(); `x`, `y`, `w`, `h` in the parent SVG's units. `slice` fills the box and crops, like the scenes. */
export function ArtImage({ file, x = 0, y = 0, w, h, slice = false }) {
  const par = slice ? 'xMidYMax slice' : 'xMidYMid meet';
  return (
    <>
      <image href={file.light} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className={file.dark ? 'art-light' : undefined} />
      {file.dark && <image href={file.dark} x={x} y={y} width={w} height={h} preserveAspectRatio={par} className="art-dark" />}
    </>
  );
}
