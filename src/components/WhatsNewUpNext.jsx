// "What's new" on Up next: once, after an update brings newly shipped things (whats-new.js), and
// never while a round is going on. A calm card, not a popup: it says what landed and steps aside.
// The list loads only after Up next has painted (virtual:roadmap is its own chunk).
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';
import { useStore } from '../lib/store.js';
import { updateSafe } from '../lib/app-update.js';
import { roadmapItems } from '../lib/roadmap.js';
import { cardNotes, firstSeen, markSeen } from '../lib/whats-new.js';
import { loadSeen, saveSeen } from '../lib/whats-new-local.js';

export function WhatsNewUpNext() {
  const nav = useNav();
  const state = useStore();
  const safe = updateSafe(state);
  const [items, setItems] = useState(null);
  // What this visit shows, kept after it's marked as seen so it stays put until you leave Up next
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!safe || items) return undefined;
    let live = true;
    import('virtual:roadmap').then(m => { if (live) setItems(roadmapItems(m.default)); }, () => {});
    return () => { live = false; };
  }, [safe, items]);

  useEffect(() => {
    if (!items || shown || !safe) return;
    let rec = loadSeen();
    if (!rec.seen) {
      // First look on this phone: someone with rounds already hears about the last two weeks
      rec = firstSeen(items, { returning: Object.keys(state.rounds || {}).length > 0 });
      saveSeen(rec);
    }
    const notes = cardNotes(items, rec, { safe });
    if (!notes) return;
    setShown(notes);
    saveSeen(markSeen(items));
  }, [items, shown, safe, state.rounds]);

  if (!shown?.items.length || !safe) return null;
  const [first, ...rest] = shown.items;
  const names = [...rest.map(i => i.title), ...(shown.more ? [`${shown.more} more`] : [])];
  return (
    <div className="remind-card wn-card" role="status">
      <div className="rc-head">
        <span className="rc-ic" aria-hidden="true"><Icon name="sparkle" fill /></span>
        <div className="row-main">
          <div className="eyebrow">What’s new</div>
          <div className="rc-title d">{first.title}</div>
          <div className="rc-sub">{names.length ? `Also new: ${names.join(', ')}.` : first.blurb || 'New in this update.'}</div>
        </div>
      </div>
      <div className="rc-acts">
        <button className="rc-btn ink" onClick={() => { setShown({ items: [], more: 0, ids: [] }); nav.push('whatsNew', { fresh: shown.ids }); }}><Icon name="list-bullets" /> See what’s new</button>
        <button className="rc-btn ghost" onClick={() => setShown({ items: [], more: 0, ids: [] })}>Got it</button>
      </div>
    </div>
  );
}
