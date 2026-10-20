// Print: the pairings to tape up, a sign for every cart, and the results sheet, for a trip, a Big
// Game or a finished round (print-sheets.js has the rows). Opened with nav.push('print', { kind:
// 'trip' | 'big' | 'round', id }), from the trip's page, the Big Game's page and a round's share
// sheet. The screen shows the pages small, in order, and Print hands them to the browser
// (window.print): on an iPhone that's the print options, where Share saves a PDF. On paper it's
// black on white Letter pages; the pages go to the printer from a copy put straight on the body,
// so none of the app's screens, bars or colours come with them (print.css).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Empty, Header, Icon, Screen, Segmented, useUI } from '../components/ui.jsx';
import { TimePicker } from '../components/DatePicker.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { APP_NAME } from '../lib/app-name.js';
import { applyStarts, cartSigns, firstSheet, metaLine, needsStarts, pairingPages, paginate, printEvent, resultBlocks, startText } from '../lib/print-sheets.js';
import './print.css';

const SHEETS = [
  { value: 'pairings', label: 'Pairings' },
  { value: 'carts', label: 'Cart signs' },
  { value: 'results', label: 'Results' },
];
const GAPS = [8, 10, 12];
const TODAY = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** A name sized for a cart sign: long names a step smaller so they stay on one line. */
const nameSize = n => (String(n).length > 20 ? 'xl' : String(n).length > 14 ? 'lg' : '');

export default function Print({ kind, id }) {
  const nav = useNav();
  const { showToast } = useUI();
  const state = useStore();
  const base = useMemo(() => printEvent(state, kind, id), [state, kind, id]);
  const [sheet, setSheet] = useState(() => firstSheet(base));
  const [starts, setStarts] = useState({ mode: 'none', first: '08:00', gap: 10 });
  // Printing shows only the sheet's pages (print.css): the class is on while this screen is
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('bb-print');
    return () => root.classList.remove('bb-print');
  }, []);
  if (!base) {
    return <Screen><Header title="Print" small onBack={nav.pop} /><div className="scroll"><Empty title="Nothing to print" text="It may have been deleted from this phone." action={<button className="ec" onClick={nav.pop}>Go back</button>} /></div></Screen>;
  }
  const event = applyStarts(base, starts);
  const pages = sheet === 'carts' ? cartPages(event) : sheet === 'results' ? resultPages(event) : pairingSheet(event);
  const count = pages.length;
  const doc = pages.map((p, i) => <Page key={p.key} event={event} sheet={sheet} at={i + 1} of={count} big={p.big}>{p.body}</Page>);
  const print = () => {
    try { window.print(); } catch { showToast('This browser can’t print. Try Safari or Chrome'); }
  };
  const what = SHEETS.find(s => s.value === sheet).label.toLowerCase();
  return (
    <Screen className="print-screen">
      <Header title="Print" small onBack={nav.pop} />
      <div className="scroll">
        <div className="tab-view">
          <Segmented label="Sheet" className="press-mode-row" btn="pm-btn" value={sheet} onChange={setSheet} options={SHEETS} />
        </div>
        <p className="field-help pad">{sheet === 'pairings' ? 'Every group, when and where it starts, with handicaps and the bets, to tape up by the first tee.'
          : sheet === 'carts' ? 'One page a cart, two names to a cart, big enough to read from a few feet.'
          : 'Standings, the podium, the money by game and who pays who: the same numbers as the app.'}</p>
        {sheet !== 'results' && needsStarts(base) && <StartPick starts={starts} onChange={setStarts} />}
        <div className="print-preview" role="region" aria-label={`Preview, ${count} page${count === 1 ? '' : 's'}`}>{doc}</div>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={print} disabled={!count}><Icon name="printer" /> Print the {what}{count > 1 ? `, ${count} pages` : ''}</button>
        <p className="field-help print-how">On an iPhone, Print opens the print options. To save a PDF instead, tap Share there.</p>
      </div>
      {createPortal(<div className="print-doc">{doc}</div>, document.body)}
    </Screen>
  );
}

/** Where the groups start, when nothing has set it: written in by hand, tee times, or a shotgun. */
function StartPick({ starts, onChange }) {
  const set = patch => onChange({ ...starts, ...patch });
  return (
    <div className="block print-starts">
      <div className="sec-label">Where groups start</div>
      <Segmented label="Where groups start" className="press-mode-row" btn="pm-btn" value={starts.mode} onChange={mode => set({ mode })}
        options={[{ value: 'none', label: 'Write in' }, { value: 'tee', label: 'Tee times' }, { value: 'shotgun', label: 'Shotgun' }]} />
      {starts.mode !== 'none' && (
        <div className="print-start-row">
          <TimePicker id="print-first" label={starts.mode === 'tee' ? 'First tee time' : 'Shotgun at'} className="name-input time-input print-time"
            value={starts.first} onChange={v => v && set({ first: v })} step={300} clearable={false} />
          {starts.mode === 'tee' && (
            <Segmented label="Minutes apart" className="press-mode-row print-gaps" btn="pm-btn" value={starts.gap} onChange={gap => set({ gap })}
              options={GAPS.map(g => ({ value: g, label: `${g} min` }))} />
          )}
        </div>
      )}
      <p className="field-help">{starts.mode === 'none' ? 'Each group gets a line to write its tee time on.' : starts.mode === 'tee' ? 'Every group off the first tee, one after another.' : 'Everyone starts at once, the groups spread around the course.'}</p>
    </div>
  );
}

/** One Letter page: the event at the top (in full on a sheet's first page), the app's name small at the foot. */
function Page({ event, sheet, at, of, big, children }) {
  const meta = metaLine(event);
  return (
    <section className={`pg pg-${sheet}`}>
      <div className="pg-pad">
        <div className="pg-in">
          {sheet !== 'carts' && (big
            ? <header className="pg-head"><div className="pg-kicker">{sheet === 'results' ? 'Results' : 'Pairings'}</div><h1 className="pg-title">{event.title}</h1>{meta && <div className="pg-meta">{meta}</div>}</header>
            : <header className="pg-head small"><span className="pg-title-s">{event.title}</span>{meta && <span className="pg-meta">{meta}</span>}</header>)}
          <div className="pg-body">{children}</div>
          <footer className="pg-foot"><span>{APP_NAME}</span><span>{[event.title, meta].filter(Boolean).join(' · ')}</span><span>{of > 1 ? `Page ${at} of ${of}` : `Printed ${TODAY()}`}</span></footer>
        </div>
      </div>
    </section>
  );
}

// --------------------------- pairings ---------------------------

function pairingSheet(event) {
  const pages = pairingPages(event);
  if (!pages.length) {
    return [{ key: 'none', big: true, body: <p className="pg-empty">{event.kind === 'trip' ? 'No groups yet. Plan the trip’s rounds or set its flights, and the pairings print from them.' : 'No groups yet.'}</p> }];
  }
  return pages.map((p, i) => ({
    key: p.key, big: i === 0,
    body: (
      <>
        {i === 0 && (event.line || event.hcNote) && <div className="pg-line">{event.line && <div><b>On the line:</b> {event.line}</div>}{event.hcNote && <div className="pg-note">{event.hcNote}</div>}</div>}
        {(p.session.label || p.session.date || p.session.course) && (
          <h2 className="pg-session">{[p.session.label, p.session.date, p.session.course].filter(Boolean).join(' · ')}{p.parts > 1 ? ` (${p.part} of ${p.parts})` : ''}</h2>
        )}
        <div className="pg-groups">{p.groups.map(g => <GroupCard key={g.key} g={g} />)}</div>
      </>
    ),
  }));
}

function GroupCard({ g }) {
  const start = startText(g);
  const line = [g.game, ...g.bets].filter(Boolean).join(' · ');
  const hc = g.players.some(p => p.hc);
  return (
    <div className="pg-group">
      <div className="pg-group-head">
        <span className="pg-group-name">{g.name}{g.sub && <span className="pg-group-sub"> · {g.sub}</span>}</span>
        <span className="pg-group-start">{start || <span className="pg-blank">Tee time</span>}</span>
      </div>
      <table className="pg-players">
        {hc && <thead><tr><th scope="col">Player</th><th scope="col" className="num">Hcp</th></tr></thead>}
        <tbody>{g.players.map(p => <tr key={p.id}><td>{p.name}</td>{hc && <td className="num">{p.hc || '–'}</td>}</tr>)}</tbody>
      </table>
      {g.matches && <div className="pg-group-line">{g.matches}</div>}
      {line && <div className="pg-group-line mute">{line}</div>}
      {g.keeper && <div className="pg-group-line mute">{g.keeper}</div>}
    </div>
  );
}

// --------------------------- cart signs ---------------------------

function cartPages(event) {
  const signs = cartSigns(event);
  if (!signs.length) return [{ key: 'none', big: false, body: <p className="pg-empty">No groups yet, so no carts to sign.</p> }];
  return signs.map(s => ({
    key: s.key, big: false,
    body: (
      <div className="cart">
        <div className="cart-top">
          <div className="cart-group">{s.group}</div>
          <div className="cart-no">Cart {s.cart} of {s.carts}</div>
        </div>
        <div className="cart-start">{s.start || <>Starts <span className="pg-blank wide" /></>}</div>
        {s.session && <div className="cart-session">{s.session}</div>}
        <div className="cart-names">{s.names.map(n => <div key={n} className={`cart-name ${nameSize(n)}`}>{n}</div>)}</div>
        {(s.matches || s.line) && (
          <div className="cart-line">
            {s.matches && <div className="cart-match">{s.matches}</div>}
            {s.line && <><div className="cart-label">On the line</div><div className="cart-bet">{s.line}</div></>}
          </div>
        )}
      </div>
    ),
  }));
}

// --------------------------- results ---------------------------

function resultPages(event) {
  if (!event.results) return [{ key: 'none', big: true, body: <p className="pg-empty">The results print once the round is finished.</p> }];
  return paginate(resultBlocks(event.results)).map((blocks, i) => ({
    key: `r${i}`, big: i === 0,
    body: blocks.map((b, j) => <ResultBlock key={`${b.kind}-${j}`} b={b} />),
  }));
}

function ResultBlock({ b }) {
  if (b.kind === 'empty') return <p className="pg-empty">{b.text}</p>;
  if (b.kind === 'headline') return <div className="res-head"><div className="res-big">{b.text}</div>{b.sub && <div className="pg-meta">{b.sub}</div>}</div>;
  if (b.kind === 'note') return <p className="res-note">{b.text}</p>;
  if (b.kind === 'podium') {
    const order = b.items.length === 3 ? [b.items[1], b.items[0], b.items[2]] : b.items;
    return (
      <div className="res-podium" role="list" aria-label="Top three">
        {order.map((p, k) => (
          <div key={p.id} className={`res-pod p${b.items.indexOf(p) + 1}`} role="listitem" style={{ order: k }}>
            <span className="res-pod-name">{p.name}</span>
            <span className="res-pod-val">{p.value}</span>
            <span className="res-pod-step">{p.place}</span>
          </div>
        ))}
      </div>
    );
  }
  if (b.kind === 'standings') {
    return (
      <section className="res-sec">
        <h2 className="pg-session">{b.title}</h2>
        <table className="res-table">
          <thead><tr><th scope="col" className="place">Place</th><th scope="col">Player</th>{b.scoreCol && <th scope="col" className="num">Score</th>}<th scope="col" className="num">{b.valueLabel || 'Total'}</th></tr></thead>
          <tbody>{b.rows.map(r => (
            <tr key={r.id}><td className="place">{r.place}</td><td>{r.name}{r.sub && <span className="res-sub">{r.sub}</span>}</td>{b.scoreCol && <td className="num">{r.score}</td>}<td className="num strong">{r.value}</td></tr>
          ))}</tbody>
        </table>
      </section>
    );
  }
  if (b.kind === 'owes') {
    return (
      <section className="res-sec">
        <h2 className="pg-session">{b.title}</h2>
        {b.rows[0]?.none ? <p className="res-note">Nobody owes anybody.</p> : (
          <table className="res-table owes">
            <tbody>{b.rows.map((t, k) => <tr key={k}><td>{t.from}</td><td className="pays">pays</td><td>{t.to}</td><td className="num strong">{t.amount}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    );
  }
  // A table: a row a player, a column a game (or part), the total last
  return (
    <section className="res-sec">
      <h2 className="pg-session">{b.title}</h2>
      <table className="res-table grid">
        <thead><tr><th scope="col"><span className="sr-only">Player</span></th>{b.columns.map(c => <th key={c} scope="col" className="num">{c}</th>)}</tr></thead>
        <tbody>{b.rows.map((r, k) => <tr key={k}><th scope="row">{r.name}</th>{r.cells.map((c, x) => <td key={x} className={`num${x === r.cells.length - 1 ? ' strong' : ''}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}

