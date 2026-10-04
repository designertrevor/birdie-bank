// Close the books (books.js): pick Paid or "Roll to next season" for each line still open on a
// crew's tab or the whole Tab, name the season, and close it. And one closed season: everyone's
// final net, how each line was settled, and its rounds. Rounds are never changed.
import { useMemo, useState } from 'react';
import { Header, Icon, Screen, Segmented, useUI } from '../components/ui.jsx';
import { Avatar } from '../components/Pay.jsx';
import { NetBars } from '../components/CrewTabs.jsx';
import { RoundRow } from '../components/RoundRow.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { canCarry } from '../lib/carry.js';
import { ALL, bookScopeName, cleanBookName, closePreview, defaultBookName, lastBook, lineKey, myBookNet } from '../lib/books.js';
import { closeTheBooks, reopenBooks, usePaymentsOff } from '../lib/tab-sync.js';
import { roundTime } from '../lib/history.js';

const first = name => String(name || '').split(' ')[0];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fullDay = t => {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export function CloseBooks({ scope = ALL }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  const off = usePaymentsOff();
  // The season shown ends when the screen opened; a payment that lands meanwhile updates the lines
  const [now] = useState(() => Date.now());
  const prev = useMemo(() => closePreview(state, scope, { now }), [state, scope, now]);
  const [name, setName] = useState(() => defaultBookName(state, scope, now));
  const [picks, setPicks] = useState({});
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const scopeName = scope === ALL ? 'Everyone on your Tab' : bookScopeName(state, { scope, crewName: null });
  const label = id => (id === me ? 'You' : first(nameOf(state, id)));
  const totals = prev.totals.map(t => ({ ...t, name: nameOf(state, t.id) }));
  const how = l => picks[lineKey(l)] || 'rolled';
  const paidN = prev.lines.filter(l => how(l) === 'paid').length;
  const rolledN = prev.lines.length - paidN;
  const title = cleanBookName(name) || defaultBookName(state, scope, now);

  const close = () => {
    const { book, undo } = closeTheBooks({ scope, name: title, picks });
    nav.pop();
    showToast(`${book.name} closed`, { label: 'Undo', run: undo });
  };

  return (
    <Screen>
      <Header title="Close the books" small onBack={nav.pop} />
      <div className="scroll">
        <div className="settle-lede">
          <div className="eyebrow">{scopeName}</div>
          <div className="d settle-count">{prev.rounds.length ? `${plural(prev.rounds.length, 'round')}${prev.since ? ` since ${fullDay(prev.since)}` : ''}` : 'No rounds since the last close'}</div>
          <p>Rounds stay just as they are. This keeps the season with everyone’s totals, and each balance still open is paid or rolled into the next season.</p>
        </div>

        <div className="block">
          <label className="eyebrow" htmlFor="book-name">Name this season</label>
          <input id="book-name" className="text-input book-name" value={name} maxLength={32} onChange={e => setName(e.target.value)} placeholder={defaultBookName(state, scope, now)} />
        </div>

        <div className="sec-label">Final net</div>
        <NetBars rows={totals} label="Each person’s final net for the season" />
        <p className="field-help pad">What each person won or lost in the season’s rounds, before anything was paid.</p>

        <div className="sec-label">Settle up or roll it</div>
        {prev.lines.length === 0 && <p className="field-help pad">Everyone’s square, so there’s nothing to settle.</p>}
        {prev.lines.map(l => {
          const mineLine = l.from === me || l.to === me;
          const other = l.from === me ? l.to : l.from;
          const text = l.from === me ? `You owe ${label(l.to)}` : l.to === me ? `${label(l.from)} owes you` : `${label(l.from)} owes ${label(l.to)}`;
          const asks = mineLine && !off && canCarry(state, me, other, now);
          const sub = how(l) === 'paid'
            ? (mineLine ? 'Marked paid when the books close, like I paid on the Tab.' : 'Marked paid for them when the books close.')
            : asks ? `${label(other)} gets a note to agree, like Roll to next time.` : 'Stays owed into the next season.';
          return (
            <div key={lineKey(l)} className="pay-card book-line">
              <div className="pay-who">
                <Avatar id={mineLine ? other : l.from} name={nameOf(state, mineLine ? other : l.from)} />
                <span className="trip-pay-name">{text}</span>
                <span className="pm">{money(l.amount)}</span>
              </div>
              <Segmented label={`${text} ${money(l.amount)}`} className="press-mode-row book-pick" btn="pm-btn" value={how(l)}
                onChange={v => setPicks(p => ({ ...p, [lineKey(l)]: v }))}
                options={[{ value: 'paid', label: 'Paid' }, { value: 'rolled', label: 'Roll to next season' }]} />
              <div className="trip-pay-sub">{sub}</div>
            </div>
          );
        })}
      </div>
      <div className="cta-wrap">
        {/* Nothing played and nothing owed since the last close: there's no season to keep */}
        <button className="full-btn" onClick={close} disabled={!prev.rounds.length && !prev.lines.length}>Close the {title} <Icon name="arrow-right" /></button>
        {!prev.rounds.length && !prev.lines.length && <p className="field-help" style={{ textAlign: 'center' }}>Play a round for money and there’s a season to close.</p>}
        {prev.lines.length > 0 && <p className="field-help" style={{ textAlign: 'center' }} role="status">{paidN ? `${paidN} paid` : ''}{paidN && rolledN ? ', ' : ''}{rolledN ? `${rolledN} rolled to next season` : ''}</p>}
      </div>
    </Screen>
  );
}

/** One closed season: everyone's final net, how each line was settled, and its rounds. */
export function Book({ id }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  const book = state.books?.[id];
  if (!book) {
    return (
      <Screen>
        <Header title="Closed season" small onBack={nav.pop} />
        <div className="scroll"><p className="field-help pad">This season was reopened, so its rounds are back in the season open now.</p></div>
      </Screen>
    );
  }
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const played = (book.totals || []).some(t => who(t.id) === me);
  const net = myBookNet(state, book);
  const label = (id, saved) => (who(id) === me ? 'You' : first(saved || nameOf(state, id)));
  const rounds = (book.rounds || []).map(r => state.rounds?.[r]).filter(Boolean).sort((a, b) => roundTime(b) - roundTime(a));
  const latest = lastBook(state, book.scope)?.id === book.id;
  const span = book.since ? `${fullDay(book.since)} to ${fullDay(book.closedAt)}` : `Closed ${fullDay(book.closedAt)}`;

  const reopen = async () => {
    const ok = await ask({ title: `Reopen the ${book.name}?`, text: 'Its rounds go back into the season open now. Payments and anything rolled over stay just as they are.', confirmLabel: 'Reopen' });
    if (!ok) return;
    reopenBooks(book.id);
    nav.pop();
    showToast(`${book.name} reopened`);
  };

  return (
    <Screen>
      <Header title={book.name} small onBack={nav.pop} />
      <div className="scroll">
        <div className="settle-lede">
          <div className="eyebrow">{bookScopeName(state, book)} · closed season</div>
          <div className={`d settle-count ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{played ? (net > 0 ? `You finished up ${money(net / 100)}` : net < 0 ? `You finished down ${money(-net / 100)}` : 'You finished even') : 'You weren’t in these rounds'}</div>
          <p>{span} · {plural((book.rounds || []).length, 'round')}</p>
        </div>
        <div className="sec-label">Final net</div>
        <NetBars rows={book.totals || []} label={`Each person’s final net for the ${book.name}`} />

        <div className="sec-label">How it was settled</div>
        {(book.lines || []).length === 0 && <p className="field-help pad">Everyone was square when the books closed.</p>}
        {(book.lines || []).map(l => (
          <div key={`${l.from}>${l.to}`} className="ledger-row static">
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{label(l.from, l.fromName)} {l.how === 'paid' ? 'paid' : who(l.from) === me ? 'owe' : 'owes'} {label(l.to, l.toName) === 'You' ? 'you' : label(l.to, l.toName)}</div>
              <div className="lr-status">{l.how === 'paid' ? 'Paid when the books closed' : 'Rolled to next season'}</div>
            </div>
            <div className="lr-amt">{money(l.cents / 100)}</div>
          </div>
        ))}

        {rounds.length > 0 && (
          <>
            <div className="sec-label">The rounds</div>
            <div className="month-rows">
              {rounds.map(r => <RoundRow key={r.id} round={r} state={state} withYear />)}
            </div>
          </>
        )}
        {rounds.length < (book.rounds || []).length && <p className="field-help pad">{plural((book.rounds || []).length - rounds.length, 'round')} from this season {(book.rounds || []).length - rounds.length === 1 ? 'is' : 'are'} no longer on this phone. The totals above still count {(book.rounds || []).length - rounds.length === 1 ? 'it' : 'them'}.</p>}
        <p className="field-help pad">Kept as it was the day the books closed. Only you see it.</p>
        {latest && <button className="text-link center book-reopen" onClick={reopen}><Icon name="arrow-counter-clockwise" /> Reopen this season</button>}
      </div>
    </Screen>
  );
}
