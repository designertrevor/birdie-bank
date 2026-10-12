// The calm line on a record view when the Record Book limit hides older rounds (record-book.js).
// Never a pop-up, and never while a round is being played (the line is null then). Only shows with
// the paywall flag on, since the limit is off without it.
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';

export function RecordBookNote({ line }) {
  const nav = useNav();
  if (!line) return null;
  return (
    <p className="hint-card record-note">
      <Icon name="book-open" fill />
      <span>
        <b>{line.title}.</b> {line.text}{' '}
        <button className="link-btn" onClick={() => nav.push('paywall', { source: 'records' })}>See Pro</button>
      </span>
    </p>
  );
}
