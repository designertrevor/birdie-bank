import { Sheet } from './ui.jsx';
import { RULES } from './rules-content.jsx';

/**
 * The rules sheet for `game`. `title` and `sub` replace the game's own, as for Junk as a side game.
 * `strokes` are this round's strokes lines (see strokesRulesLines), shown last under "Strokes this round".
 */
export function RulesSheet({ game, open, onClose, title, sub, strokes = [] }) {
  const r = RULES[game];
  if (!r) return null;
  return (
    <Sheet open={open} onClose={onClose} title={title || r.title} className="rules-sheet">
      <div className="rules-content">
        <div className="rules-sub">{sub || r.sub}</div>
        {r.sections.map(([h, body]) => (
          <div key={h}><div className="rules-section">{h}</div><div className="rules-body">{body}</div></div>
        ))}
        {strokes.length > 0 && (
          <div><div className="rules-section">Strokes this round</div><div className="rules-body">{strokes.map(l => <p key={l} className="strokes-line">{l}</p>)}</div></div>
        )}
      </div>
      <div style={{ padding: '0 16px' }}><button className="full-btn" onClick={onClose}>Got it</button></div>
    </Sheet>
  );
}
