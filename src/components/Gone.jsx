// A screen whose thing is gone or was never on this phone (a round, a trip, a challenge, a person):
// one layout everywhere, the same as a link that finds nothing. The lone ball in the grass, the
// title in the display face, one line, and one way out at the foot of the screen in ink.
import './gone.css';
import { Spot } from './Spot.jsx';

/** `title`, `text`, and the way out: `action` (its label) and `onAction`. Goes after the screen's Header. */
export function Gone({ title, text, action = 'Go back', onAction }) {
  return (<>
    <div className="scroll gone-body">
      <Spot kind="loneball" size={150} className="gone-art" />
      <h1 className="gone-title d">{title}</h1>
      {text && <p className="gone-text">{text}</p>}
    </div>
    <div className="cta-wrap"><button className="full-btn" onClick={onAction}>{action}</button></div>
  </>);
}
