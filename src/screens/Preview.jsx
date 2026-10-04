// The Saturday preview: a planned round before anyone tees off. The countdown, who's in, the game
// and the bet the group voted for, the side games, who gets strokes on which holes and the
// head-to-head records between the people who are in, then "Share the preview" for the group text.
// Everything comes from preview.js; this screen only lays it out.
import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen, Toggle, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Pay.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { sendReminder } from '../lib/pay.js';
import { planPreview, previewCardModel, previewImageName, previewText, recordSentence, strokesLine } from '../lib/preview.js';
import { renderPreviewCard } from '../lib/preview-image.js';
import { IMAGE_H, IMAGE_W } from '../lib/shareImage.js';
import { planShareLink, usePlanLive } from '../lib/plan-sync.js';
import { pctWords } from '../lib/allowances.js';

const listNames = n => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);

export default function PreviewScreen({ id, fromPlan = false }) {
  const nav = useNav();
  const state = useStore();
  const plan = state.plans?.[id];
  // Answers and votes keep coming in while it's open
  usePlanLive(id, plan?.code);
  const [sharing, setSharing] = useState(false);
  // The clock moves on by itself: work the countdown out again each minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const pv = useMemo(() => (plan ? planPreview(state, plan, { now }) : null), [state, plan, now]);

  if (!plan) {
    return (
      <Screen>
        <Header title="Preview" small onBack={nav.pop} />
        <div className="scroll"><Empty title="This plan is gone" text="It was deleted from this phone." /></div>
      </Screen>
    );
  }
  if (sharing) return <PreviewShare plan={plan} pv={pv} onBack={() => setSharing(false)} />;

  const cd = pv.countdown;
  return (
    <Screen>
      <Header title={pv.weekday ? `${pv.weekday} preview` : 'Preview'} small onBack={nav.pop} />
      <div className="scroll">
        <div className="pv-hero">
          {cd && cd.days >= 0 && (
            <div className="pv-count" aria-hidden="true">
              {cd.unit ? <><span className="pv-count-n d">{cd.big}</span><span className="pv-count-u">{cd.unit}</span></> : <span className="pv-count-t d">{cd.big}</span>}
            </div>
          )}
          <div className="row-main">
            <div className="eyebrow pv-when">{cd ? cd.label : pv.when}</div>
            <div className="pv-game d"><Icon name={pv.gameIcon} fill /> {pv.gameName}</div>
            <div className="pv-sub">{pv.course} · {pv.when}{pv.holes ? ` · ${pv.holes} holes` : ''}</div>
          </div>
        </div>
        {plan.status === 'off' && <p className="hint-card"><Icon name="calendar-x" fill /> This round is called off.</p>}

        <div className="sec-label">Who’s in · {pv.ins.length}</div>
        <div className="block pv-block">
          {pv.ins.length ? <div className="pv-names">{listNames(pv.ins)}</div> : <div className="pv-names mute">Nobody’s in yet</div>}
          {(pv.maybes.length > 0 || pv.waiting > 0 || pv.out > 0) && (
            <div className="set-sub">
              {[pv.maybes.length ? `Maybe: ${listNames(pv.maybes)}` : '', pv.waiting ? `${pv.waiting} ${pv.waiting === 1 ? 'hasn’t' : 'haven’t'} answered` : '', pv.out ? `${pv.out} out` : ''].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        <div className="sec-label">The games</div>
        <div className="block pv-block">
          <div className="pv-line"><Icon name={pv.gameIcon} fill /><span className="row-main"><b>{pv.gameName}</b>{pv.betFull ? <span className="set-sub"> {pv.betFull}</span> : null}</span></div>
          {pv.sides.map(s => (
            <div key={s.key} className="pv-line"><Icon name="plus-circle" fill /><span className="row-main"><b>{s.label}</b>{s.bet ? <span className="set-sub"> {s.bet}</span> : null}</span></div>
          ))}
          {pv.playFor && <div className="pv-line"><Icon name={plan.playFor?.kind === 'reward' ? 'gift' : 'trophy'} fill /><span className="row-main">{pv.playFor}</span></div>}
          <p className="field-help">The group’s pick so far. Side bets between two players are set at the tee.</p>
        </div>

        <div className="sec-label">Strokes</div>
        <Strokes plan={plan} st={pv.strokes} hostName={plan.hostName} />

        <div className="sec-label">Head to head</div>
        <Records pv={pv} />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => setSharing(true)}><Icon name="share-network" /> Share the preview</button>
        {!fromPlan && <button className="full-btn outline" onClick={() => nav.push('plan', { id })}>See the plan</button>}
      </div>
    </Screen>
  );
}

/** Who gets strokes on which holes: a grid for each nine, then a line for each person. */
function Strokes({ plan, st, hostName }) {
  const [whatIf, setWhatIf] = useState(false);
  const why = {
    noStrokes: 'This game doesn’t use handicaps, so nobody gets strokes.',
    scramble: 'Scramble teams get their strokes when the teams are set at the tee.',
    noCourse: 'Strokes show once the course is on your phone.',
    few: 'Strokes show once two people are in.',
  }[st.status];
  if (why) return <p className="hint-card"><Icon name="info" fill /> {why}</p>;
  const off = st.status === 'off';
  const noIndex = st.rows.filter(r => r.noIndex).map(r => r.name);
  const show = !off || whatIf;
  return (
    <div className="block pv-block">
      {off && (
        <>
          <p className="pv-off">No strokes. You’re playing without handicaps, so everyone plays straight up.</p>
          <button className="text-link flush" onClick={() => setWhatIf(w => !w)} aria-expanded={whatIf}>
            <Icon name={whatIf ? 'caret-up' : 'caret-down'} /> {whatIf ? 'Hide' : 'See'} who’d get strokes with handicaps on
          </button>
        </>
      )}
      {show && (
        <>
          {chunks(st.holes, 9).map((nine, i) => <StrokeGrid key={i} holes={nine} rows={st.rows} />)}
          <ul className="pv-strokes">
            {st.rows.map(r => <li key={r.who}>{strokesLine(r, st.holes.length)}</li>)}
          </ul>
          <p className="field-help">
            {[
              st.pct < 100 ? `At ${pctWords(st.pct)}.` : '',
              st.half ? 'Half strokes: each stroke counts as half a shot in the matches and skins.' : '',
              ...st.notes.map(n => `${n}.`),
              noIndex.length ? `No handicap saved for ${listNames(noIndex)}, so ${noIndex.length === 1 ? `${noIndex[0]} plays` : 'each plays'} off 0 until one is added in Players.` : '',
              plan.host ? 'Strokes change if someone else shows up.' : `From the handicaps saved on your phone. ${hostName || 'The organizer'}’s phone sets the strokes at the tee.`,
            ].filter(Boolean).join(' ')}
          </p>
        </>
      )}
    </div>
  );
}

function chunks(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Nine holes across, a row for each person, a dot for each stroke. */
function StrokeGrid({ holes, rows }) {
  return (
    <table className="pv-grid">
      <thead>
        <tr><th scope="col" className="pv-gn">Hole</th>{holes.map(h => <th key={h.no} scope="col">{h.no}</th>)}</tr>
        <tr className="pv-hcp"><th scope="row" className="pv-gn">Hdcp</th>{holes.map(h => <td key={h.no}>{h.hdcp ?? '–'}</td>)}</tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.who}>
            <th scope="row" className="pv-gn">{r.me ? 'You' : r.name}</th>
            {holes.map(h => {
              const n = r.strokes.find(s => s.no === h.no)?.n || 0;
              return <td key={h.no} aria-label={n ? `${n} on ${h.no}` : undefined}>{n ? <span className={`pv-dot ${n > 1 ? 'two' : ''}`}>{n > 1 ? n : ''}</span> : null}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Head-to-head records between the people who are in. */
function Records({ pv }) {
  if (pv.ins.length < 2) return <p className="hint-card"><Icon name="info" fill /> Records show once two people are in.</p>;
  if (!pv.records.length) {
    return <p className="hint-card"><Icon name="sword" fill /> No rounds together yet between the people who are in. {pv.weekday ? `${pv.weekday} starts the record book.` : 'This round starts the record book.'}</p>;
  }
  return (
    <div className="who-list pv-recs">
      {pv.records.map(r => (
        <div key={`${r.a}|${r.b}`} className="who-row">
          <span className="pv-pair" aria-hidden="true"><Avatar id={r.aId} name={r.aName} /><Avatar id={r.bId} name={r.bName} /></span>
          <div className="row-main">
            <div className="set-name">{recordSentence(r.rec, r.aName, r.bName, { scope: r.scope, aIsYou: r.aMe, bIsYou: r.bMe })}</div>
            <div className="set-sub">{r.rec.rounds} round{r.rec.rounds === 1 ? '' : 's'} together{r.scope === 'season' ? ' this season' : ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The preview image for the group text. As with the results image, the PNG is drawn ahead of
 * time so the share sheet opens straight from the tap, and amounts start hidden.
 */
function PreviewShare({ plan, pv, onBack }) {
  const { showToast } = useUI();
  // Off every time it opens, so nobody posts the bets by accident
  const [moneyOn, setMoneyOn] = useState(false);
  const showAmounts = pv.money ? moneyOn : true;
  const [img, setImg] = useState(null); // { blob, url, key }
  // The preview is worked out again each minute and on every answer, so the image is drawn again
  // only when what it says changes (not every minute while the sheet sits open)
  const cardKey = useMemo(() => JSON.stringify(previewCardModel(pv, { showAmounts })), [pv, showAmounts]);
  useEffect(() => {
    let alive = true;
    renderPreviewCard(JSON.parse(cardKey))
      .then(blob => { if (alive) setImg({ blob, url: URL.createObjectURL(blob), key: cardKey }); })
      .catch(() => { if (alive) setImg(null); });
    return () => { alive = false; };
  }, [cardKey]);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  const ready = img && img.key === cardKey;
  const fileName = previewImageName(plan);
  const shareImage = async () => {
    if (!ready || typeof File === 'undefined') return;
    const file = new File([img.blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* closed the sheet */ }
      return;
    }
    const a = document.createElement('a');
    a.href = img.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Image saved to your downloads');
  };
  const shareText = async () => {
    const r = await sendReminder(previewText(pv, { showAmounts, link: planShareLink(plan) }));
    if (r === 'copied') showToast('Preview copied. Paste it in your group text');
    if (r === 'failed') showToast('Couldn’t share on this device');
  };

  return (
    <Screen>
      <Header title="Share the preview" small onBack={onBack} />
      <div className="scroll">
        {img ? (
          <img className="share-img" src={img.url} width={IMAGE_W} height={IMAGE_H}
            alt={`Preview card: ${pv.gameName} at ${pv.course}, ${pv.when}. In: ${listNames(pv.ins) || 'nobody yet'}.`} />
        ) : (
          <div className="share-card">
            <div className="sc-brand">{pv.weekday ? `${pv.weekday} preview` : 'Preview'}</div>
            <div className="sc-meta">{pv.course} · {pv.when}</div>
            <div className="sc-big d">{pv.gameName}</div>
            <div className="sc-list">
              {pv.ins.map(n => <div key={n} className="sc-line"><span>{n}</span></div>)}
            </div>
          </div>
        )}
        {pv.money && (
          <div className="toggle-row share-toggle">
            <div><div className="toggle-lbl">Show amounts</div><div className="toggle-sub">{showAmounts ? 'The bets and the money between players are on the image' : 'The game, who’s in, strokes and records, no money'}</div></div>
            <Toggle on={showAmounts} onChange={setMoneyOn} label="Show amounts" />
          </div>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={shareImage} disabled={!ready}><Icon name="share-network" /> {ready ? 'Share image' : 'Making the image…'}</button>
        <div className="cta-row">
          <button className="full-btn outline" onClick={shareText}><Icon name="text-aa" /> Share as text</button>
          <button className="full-btn outline" onClick={onBack}>Done</button>
        </div>
      </div>
    </Screen>
  );
}
