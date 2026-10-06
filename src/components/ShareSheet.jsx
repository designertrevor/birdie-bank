// One share screen for every card: the image drawn ahead of time (iOS drops a share that waits),
// the Show amounts switch (off until you turn it on, remembered, the same for every card), and
// Share image / Share as text, all through share.js shareOut. The results image, the preview, the
// recap, trip standings and the cup use it, so they look and work the same.
import { useEffect, useState } from 'react';
import { Header, Icon, Toggle, useUI } from './ui.jsx';
import { useStore } from '../lib/store.js';
import { setShareAmounts } from '../lib/useShare.js';
import { IMAGE_H, IMAGE_W } from '../lib/shareImage.js';
import { amountsNote, amountsRule, shareAmountsOn, shareOut, shareToast } from '../lib/share.js';

/** A plain stand-in for the image while it's being drawn (or on a device that can't draw it). */
function CardStandIn({ model }) {
  return (
    <div className="share-card">
      <div className="sc-brand">{model.eyebrow}</div>
      <div className="sc-meta">{[model.title, model.meta].filter(Boolean).join(' · ')}</div>
      <div className="sc-big d">{model.headline}{model.sub && <><br />{model.sub}</>}</div>
      {model.accent && <div className="sc-meta">{model.accent}</div>}
      <div className="sc-list">
        {(model.rows || []).map((r, i) => <div key={i} className="sc-line"><span>{r.place}. {r.name}</span>{r.value && <span>{r.value}</span>}</div>)}
      </div>
    </div>
  );
}

/**
 * The share screen's body (Header, the card, the switch, the buttons) for a parent <Screen>.
 * - make(showAmounts): { model, text, alt }, the card worked out with amounts on or off.
 * - render(model): a promise of the PNG blob.
 * - money: whether the card has dollars on it; people: [{ id, name }] whose money is on it.
 * - link: the short link back to the round or plan; what: "Results", "Recap" for the toasts.
 * - onText / offText: the line under the switch. standIn(model): the stand-in, if not the plain one.
 * - square: a 1080 by 1080 image (the profile card) instead of a story-sized one.
 */
export function ShareView({ title, onBack, onDone, doneLabel = 'Done', make, render, fileName, link = null, what = 'It', money = true, people = [], onText, offText, standIn = null, children = null, small = false, square = false }) {
  const { showToast } = useUI();
  const state = useStore();
  const on = shareAmountsOn(state);
  const rule = amountsRule(state, { money, on, people });
  const card = make(rule.show);
  const key = JSON.stringify(card.model);
  const [img, setImg] = useState(null); // { blob, url, key }
  useEffect(() => {
    let alive = true;
    render(JSON.parse(key))
      .then(blob => { if (alive) setImg({ blob, url: URL.createObjectURL(blob), key }); })
      .catch(() => { if (alive) setImg(null); });
    return () => { alive = false; };
  // Drawn again only when what it says changes (render is a module's drawing function, never a new one)
  }, [key, render]);
  // Free each image once a newer one replaces it
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  const ready = img && img.key === key;
  const shareImage = async () => {
    if (!ready) return;
    const r = await shareOut({ text: card.text, url: link, image: { blob: img.blob, url: img.url, name: fileName } });
    const msg = shareToast(r, what);
    if (msg) showToast(msg);
  };
  const shareText = async () => {
    const r = await shareOut({ text: card.text, url: link });
    const msg = shareToast(r, what);
    if (msg) showToast(msg);
  };

  return (
    <>
      <Header title={title} small={small} onBack={onBack} />
      <div className="scroll">
        {img ? <img className={`share-img${square ? ' square' : ''}`} src={img.url} width={IMAGE_W} height={square ? IMAGE_W : IMAGE_H} alt={card.alt} />
          : standIn ? standIn(card.model, rule.show) : <CardStandIn model={card.model} />}
        {rule.money && (
          <div className="toggle-row share-toggle">
            <div><div className="toggle-lbl" id="share-amounts">Show amounts</div><div className={`toggle-sub ${rule.held.length ? 'share-held' : ''}`}>{amountsNote(rule, { onText, offText })}</div></div>
            <Toggle on={on} onChange={setShareAmounts} labelledBy="share-amounts" />
          </div>
        )}
        {children}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={shareImage} disabled={!ready}><Icon name="share-network" /> {ready ? 'Share image' : 'Making the image…'}</button>
        <div className="cta-row">
          <button className="full-btn outline" onClick={shareText}><Icon name="text-aa" /> Share as text</button>
          <button className="full-btn outline" onClick={onDone || onBack}>{doneLabel}</button>
        </div>
      </div>
    </>
  );
}
