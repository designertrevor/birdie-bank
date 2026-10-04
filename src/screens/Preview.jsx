// The Saturday preview: a planned round before anyone tees off. The countdown, who's in, the game
// and the bet the group voted for, the side games, who gets strokes on which holes and the
// head-to-head records between the people who are in, then "Share the preview" for the group text.
// Everything comes from preview.js; this screen only lays it out.
import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Icon, Screen } from '../components/ui.jsx';
import { Avatar } from '../components/Pay.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { pairBetLine, planPreview, previewAlt, previewCardModel, previewImageName, previewText, recordSentence, strokesLine } from '../lib/preview.js';
import { amountsRule } from '../lib/share.js';
import { ShareView } from '../components/ShareSheet.jsx';
import { renderPreviewCard } from '../lib/preview-image.js';
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
          {pv.pairBets.map(x => (
            <div key={x.key} className="pv-line"><Icon name={x.source === 'challenge' ? 'sword' : 'handshake'} fill /><span className="row-main">{pairBetLine(x)}</span></div>
          ))}
          <p className="field-help">{pv.pairBets.length ? 'The group’s pick so far. Each side bet goes in at the tee when both of them show.' : 'The group’s pick so far. Side bets and agreed challenges between two players go in at the tee.'}</p>
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
    scramble: 'Each team gets its strokes when the teams are set at the tee.',
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
 * The preview image for the group text, on the same share screen as the results image
 * (ShareSheet.jsx): drawn ahead of time so the share sheet opens straight from the tap, amounts
 * start hidden (the one remembered switch), and the group link rides along. The money in a
 * head-to-head record stays off when either of the two keeps theirs private (share.js).
 */
function PreviewShare({ plan, pv, onBack }) {
  const state = useStore();
  const link = planShareLink(plan);
  const recordPeople = pv.records.flatMap(r => [{ id: r.aId, name: r.aName }, { id: r.bId, name: r.bName }]);
  const make = show => {
    const recordAmounts = amountsRule(state, { on: show, people: recordPeople }).show;
    const model = previewCardModel(pv, { showAmounts: show, recordAmounts });
    return { model, alt: previewAlt(model), text: previewText(pv, { showAmounts: show, recordAmounts }) };
  };
  return (
    <Screen>
      <ShareView title="Share the preview" small onBack={onBack} make={make} render={renderPreviewCard}
        fileName={previewImageName(plan)} link={link} what="The preview" money={pv.money}
        onText="The bets and the money between players are on the image" offText="The game, who’s in, strokes and records, no money"
        standIn={() => (
          <div className="share-card">
            <div className="sc-brand">{pv.weekday ? `${pv.weekday} preview` : 'Preview'}</div>
            <div className="sc-meta">{pv.course} · {pv.when}</div>
            <div className="sc-big d">{pv.gameName}</div>
            <div className="sc-list">
              {pv.ins.map(n => <div key={n} className="sc-line"><span>{n}</span></div>)}
            </div>
          </div>
        )} />
    </Screen>
  );
}
