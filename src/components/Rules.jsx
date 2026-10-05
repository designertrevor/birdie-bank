import { Icon, Sheet, useUI } from './ui.jsx';
import { RULES } from './rules-content.jsx';
import { rulePath } from '../lib/rule-links.js';
import { shareOut } from '../lib/share-out.js';
import { shareToast } from '../lib/share.js';

/**
 * The rules sheet for `game`. `title` and `sub` replace the game's own, as for Junk as a side game.
 * `strokes` are this round's strokes lines (see strokesRulesLines), shown last under "Strokes this round".
 */
export function RulesSheet({ game, open, onClose, title, sub, strokes = [] }) {
  const { showToast } = useUI();
  const r = RULES[game];
  if (!r) return null;
  // The same rules as a web page anyone can open (rule-pages.js), for the group text
  const send = async () => {
    const url = `${location.origin}${rulePath(game)}`;
    const toast = shareToast(await shareOut({ title: r.title, text: `${r.title}:`, url }), 'Link');
    if (toast) showToast(toast);
  };
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
        <button className="text-link rules-send" onClick={send}><Icon name="paper-plane-tilt" /> Send these rules to the group</button>
      </div>
      <div style={{ padding: '0 16px' }}><button className="full-btn" onClick={onClose}>Got it</button></div>
    </Sheet>
  );
}
