// "The game you asked for is live": on Up next, once, when something you asked for or voted for on
// the roadmap ships (roadmap.js shippedNotes). There's no push yet, so this is how you hear. It
// loads nothing more until this phone has voted or sent an idea.
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { useNav } from '../lib/nav.js';
import { roadmapItems, shippedNotes } from '../lib/roadmap.js';
import { markNotesTold, refreshForUpNext, useRoadmap } from '../lib/roadmap-sync.js';

export function ShippedUpNext() {
  const nav = useNav();
  const { local, server } = useRoadmap();
  const interested = Object.keys(local.votes).length > 0 || local.sent.length > 0 || server.mine.length > 0;
  const [base, setBase] = useState(null);
  // What this visit shows, kept after it's marked as told so it stays put until you leave Up next
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!interested) return undefined;
    let live = true;
    refreshForUpNext();
    import('virtual:roadmap').then(m => { if (live) setBase(m.default); }, () => {});
    return () => { live = false; };
  }, [interested]);

  useEffect(() => {
    if (!base || shown) return;
    const notes = shippedNotes(roadmapItems(base, server.requests), { local, mine: server.mine, myVotes: server.myVotes });
    if (!notes.length) return;
    setShown(notes);
    markNotesTold(notes.map(n => n.key));
  }, [base, shown, local, server]);

  if (!shown?.length) return null;
  const [first, ...more] = shown;
  const sub = more.length ? `${first.title}, and ${more.length} more you were waiting on` : first.title;
  return (
    <div className="remind-card rm-live" role="status">
      <div className="rc-head">
        <span className="rc-ic" aria-hidden="true"><Icon name="confetti" fill /></span>
        <div className="row-main">
          <div className="eyebrow">It shipped</div>
          <div className="rc-title d">{first.line}</div>
          <div className="rc-sub">{sub}. Thanks for helping pick it.</div>
        </div>
      </div>
      <div className="rc-acts">
        <button className="rc-btn ink" onClick={() => nav.push('roadmap', { highlight: first.itemId })}><Icon name="signpost" fill /> See what shipped</button>
        <button className="rc-btn ghost" onClick={() => setShown([])}>Nice</button>
      </div>
    </div>
  );
}
