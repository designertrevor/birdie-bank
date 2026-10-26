// A quiet empty part of a busy screen with its drawing: the spot centred on top with room around it,
// the sentence under it. For a view inside a screen (a trip with no rounds yet, no expenses, no
// courses near you), where a full Empty would take over the page. Decorative art: screen readers
// read only the sentence.
import { Spot } from './Spot.jsx';
import '../art-places.css';

/**
 * `spot` is a Spot kind (see art-manifest.js), `size` its box in px, `children` the sentence.
 * `plated` sets the drawing on a cream disc with no outline, for the ones whose ball is cut out to
 * the sky (bragging, buying, agreed), so the dark theme never shows through the ball.
 */
export function ArtNote({ spot, size = 96, plated = false, children, className = '' }) {
  return (
    <div className={`art-note ${className}`.trim()}>
      <Spot kind={spot} size={size} plate={false} outline={!plated} className={`art-note-spot${plated ? ' art-plate' : ''}`} />
      <p className="art-note-text">{children}</p>
    </div>
  );
}
