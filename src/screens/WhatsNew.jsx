// What's new: the app's release notes, newest first, made from the shipped part of the roadmap
// (whats-new.js). From Settings any time, and from the card Up next shows once after an update.
// Opening it counts everything here as seen, so the card doesn't come back for the same news.
import { Spot } from '../components/Spot.jsx';
import { useEffect, useState } from 'react';
import BASE from 'virtual:roadmap';
import { Header, Icon, Screen } from '../components/ui.jsx';
import { useNav } from '../lib/nav.js';
import { roadmapItems, shippedLabel } from '../lib/roadmap.js';
import { markSeen, releaseGroups } from '../lib/whats-new.js';
import { loadSeen, saveSeen } from '../lib/whats-new-local.js';

/** The newest few months first; the rest behind "Show everything". */
const MONTHS_FIRST = 3;

/** `fresh`: the item ids the Up next card just showed, marked New here. */
export default function WhatsNew({ fresh = null }) {
  const nav = useNav();
  const [items] = useState(() => roadmapItems(BASE));
  // Worked out once, against what this phone had seen before opening, so "New" stays put this visit
  const [groups] = useState(() => releaseGroups(items, loadSeen(), fresh));
  const [all, setAll] = useState(false);
  useEffect(() => { saveSeen(markSeen(items)); }, [items]);
  const shown = all ? groups : groups.slice(0, MONTHS_FIRST);
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <Screen className="whats-new">
      <Header title="What’s new" onBack={nav.pop} />
      <div className="scroll">
        <p className="rm-intro">What’s landed in the app lately, newest first.</p>
        {groups.length === 0 && <div className="rm-empty"><Spot kind="sleep" size={96} /><p>Nothing here yet. New things land here after each update.</p></div>}
        {shown.map(g => (
          <section key={g.label} className="wn-month">
            <div className="sec-label">{g.label}</div>
            <ol className="rm-list" role="list">
              {g.items.map(i => (
                <li key={i.id} className="rm-card">
                  <div className="rm-main">
                    <span className="eyebrow rm-area">{i.area}</span>
                    <h3 className="rm-title">{i.title}</h3>
                    {i.blurb && <p className="rm-blurb">{i.blurb}</p>}
                    <div className="rm-meta">
                      <span className="rm-when"><Icon name="check-circle" fill /> {shippedLabel(i.shipped)}</span>
                      {i.fresh && <span className="rm-tag">New</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {!all && groups.length > MONTHS_FIRST && (
          <button className="lately-all rm-all" onClick={() => setAll(true)}>Show everything ({total}) <Icon name="caret-down" /></button>
        )}
        <button className="set-row rm-cta" onClick={() => nav.push('roadmap')}>
          <div className="set-icon"><Icon name="signpost" fill /></div>
          <div className="row-main"><div className="set-name">What’s coming next</div><div className="set-sub">Vote on the roadmap for what you want most</div></div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
      </div>
    </Screen>
  );
}
