// A quiet empty part of a busy screen with its drawing: the spot centred on top with room around it,
// the sentence under it. For a view inside a screen (a trip with no rounds yet, no expenses, no
// courses near you), where a full Empty would take over the page. Decorative art: screen readers
// read only the sentence.
import { Spot } from './Spot.jsx';
import '../art-places.css';

/** `spot` is a Spot kind (see art-manifest.js), `size` its box in px, `children` the sentence. */
export function ArtNote({ spot, size = 96, children, className = '' }) {
  return (
    <div className={`art-note ${className}`.trim()}>
      <Spot kind={spot} size={size} plate={false} className="art-note-spot" />
      <p className="art-note-text">{children}</p>
    </div>
  );
}
