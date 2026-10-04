// A tab for each crew or trip, and closed seasons (crew-tabs.js, books.js): the switch on the Tab
// (Everyone, then a chip for each crew or trip with money, one tap deep), one tab's own payments,
// the bars of everyone's final net, and the list of closed seasons Season and History keep.
import { Icon, useUI } from './ui.jsx';
import { Avatar, PayButton, RequestButton } from './Pay.jsx';
import { TripTabCard } from './Trips.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { payInfoFor } from '../lib/pay.js';
import { buzz } from '../lib/delight.js';
import { markCrewPayment } from '../lib/tab-sync.js';
import { bookScopeName, booksOf, lastBook, myBookNet, openRounds, rolledIn } from '../lib/books.js';

const first = name => String(name || '').split(' ')[0];
const shortDay = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayWithYear = t => {
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const upDown = (c, where) => (c > 0 ? `You’re up ${money(c / 100)}${where}` : c < 0 ? `You’re down ${money(-c / 100)}${where}` : `You’re even${where}`);

/** Everyone, then a chip for each crew or trip with money and Other rounds. Nothing when there's only Everyone. */
export function TabSwitch({ tabs, value, onChange }) {
  if (!tabs.length) return null;
  const opts = [{ key: 'everyone', name: 'Everyone' }, ...tabs];
  return (
    <div className="chip-row tab-switch" role="group" aria-label="Which tab">
      {opts.map(t => (
        <button key={t.key} className={`pill-btn ${value === t.key ? 'on' : ''}`} aria-pressed={value === t.key} onClick={() => onChange(t.key)}>
          {t.kind === 'crew' && <Icon name="users-three" fill />}
          {t.kind === 'trip' && <Icon name="suitcase-rolling" fill />}
          {t.name}
        </button>
      ))}
    </div>
  );
}

/** On Everyone, once the whole Tab's books have closed: since when, and what was rolled into this season. */
export function SinceBooks({ scope }) {
  const state = useStore();
  const book = lastBook(state, scope);
  if (!book) return null;
  const rolled = rolledIn(state, scope);
  const n = openRounds(state, scope).length;
  return (
    <p className="field-help pad books-since">
      {plural(n, 'round')} since the books closed on {dayWithYear(book.closedAt)} ({book.name}).
      {rolled ? ` ${rolled > 0 ? `${money(rolled / 100)} owed to you` : `${money(-rolled / 100)} you owe`} was rolled into this season.` : ''}
    </p>
  );
}

/** One crew's, trip's or Other rounds' tab: what each person owes on just its rounds. */
export function OneTab({ tab }) {
  const state = useStore();
  const nav = useNav();
  const { showToast } = useUI();
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const mine = tab.lines.filter(l => l.from === me || l.to === me);
  const others = tab.lines.filter(l => l.from !== me && l.to !== me);
  const myNet = tab.balances[me] || 0;
  const isCrew = tab.kind === 'crew';
  const note = tab.name;

  const mark = l => {
    const { shared, undo } = markCrewPayment({ crewId: tab.id, from: l.from, to: l.to });
    buzz(15);
    const text = l.from === me ? `You paid ${first(nameOf(state, l.to))}` : l.to === me ? `${first(nameOf(state, l.from))} paid you` : `${first(nameOf(state, l.from))} paid ${first(nameOf(state, l.to))}`;
    showToast(shared ? `${text}. Their phone sees it too.` : text, { label: 'Undo', run: undo });
  };

  if (tab.kind === 'trip') {
    const st = tab.status;
    return (
      <>
        <TripTabCard status={st} />
        {tab.lines.length > 0 && <div className="sec-label">The trip’s payments</div>}
        {tab.lines.map(l => (
          <div key={l.from + l.to} className="ledger-row static">
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{l.from === me ? 'You pay' : `${first(nameOf(state, l.from))} pays`} {l.to === me ? 'you' : first(nameOf(state, l.to))}</div>
            </div>
            <div className="lr-amt">{money(l.amount)}</div>
          </div>
        ))}
        <div className="cta-wrap tab-cta">
          {st.phase === 'ready'
            ? <button className="full-btn pink" onClick={() => nav.push('tripSettle', { id: tab.id })}>Settle the trip <Icon name="arrow-right" /></button>
            : <button className="full-btn outline" onClick={() => nav.push('trip', { id: tab.id })}>See the trip</button>}
        </div>
        <p className="field-help pad">Just the trip’s rounds{st.expenses.length ? ' and expenses' : ''}, settled once after the last round. With your other tabs it adds up to Everyone.</p>
      </>
    );
  }

  const book = isCrew ? lastBook(state, tab.key) : null;
  const n = isCrew ? openRounds(state, tab.key).length : tab.rounds.length;
  const sub = book ? `${plural(n, 'round')} since the books closed on ${dayWithYear(book.closedAt)}` : `${plural(n, 'round')}${tab.since ? ` since ${dayWithYear(tab.since)}` : ''}`;
  return (
    <>
      <div className="tab-overall">
        <div className="eyebrow">{tab.name} · {sub}</div>
        <div className={`tab-big d ${myNet > 0 ? 'pos' : myNet < 0 ? 'neg' : ''}`}>{tab.lines.length ? upDown(myNet, '') : 'All square'}</div>
      </div>
      {mine.map(l => {
        const other = l.from === me ? l.to : l.from;
        const owesMe = l.to === me;
        const name = nameOf(state, other);
        return (
          <div key={l.from + l.to} className="tab-card">
            <button className="tab-person" onClick={() => nav.push('person', { id: other })} aria-label={`${name}: ${owesMe ? 'owes you' : 'you owe'} ${money(l.amount)} on ${tab.name}. See the story`}>
              <Avatar id={other} name={name} />
              <div className="row-main">
                <div className="tp-name">{name}</div>
                <div className="tp-sub">{owesMe ? 'Owes you' : 'You owe'}</div>
              </div>
              <div className={`tp-amt ${owesMe ? 'pos' : 'neg'}`}>{money(l.amount)}</div>
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>
            {isCrew && (
              <div className="pay-acts wrap">
                {owesMe
                  ? <RequestButton payer={payInfoFor(state, other)} mine={payInfoFor(state, state.me)} amount={l.amount} note={note} />
                  : <PayButton info={payInfoFor(state, other)} amount={l.amount} note={note} />}
                <button className="pay-btn ink" onClick={() => mark(l)} aria-label={owesMe ? `${first(name)} paid me ${money(l.amount)}` : `I paid ${first(name)} ${money(l.amount)}`}>
                  <span className="pay-in"><Icon name="check-circle" fill /><span className="pay-lbl">{owesMe ? `${first(name)} paid me` : 'I paid'}</span></span>
                </button>
              </div>
            )}
          </div>
        );
      })}
      {others.length > 0 && (
        <>
          <div className="sec-label">{mine.length ? 'Everyone else' : 'Who owes who'}</div>
          {others.map(l => (
            <div key={l.from + l.to} className="ledger-row static trip-other">
              <div className="lr-info">
                <div className="lr-name" style={{ fontSize: 16 }}>{nameOf(state, l.from)} owes {nameOf(state, l.to)}</div>
              </div>
              <div className="lr-amt" style={{ marginRight: 8 }}>{money(l.amount)}</div>
              {isCrew && <button className="pill-btn sm" onClick={() => mark(l)}>Mark paid</button>}
            </div>
          ))}
        </>
      )}
      {isCrew && <SinceRolled scope={tab.key} />}
      {isCrew ? (
        <>
          <p className="field-help pad">Only rounds where everyone else who played is in this crew, squared in the fewest payments. With your other tabs it adds up to Everyone.</p>
          <button className="text-link stats-link" onClick={() => nav.push('closeBooks', { scope: tab.key })}>
            <Icon name="book-bookmark" fill /> <span className="row-main">Close the books<span className="sl-sub">Save the season with everyone’s totals, then settle up or roll each balance to next season</span></span> <Icon name="caret-right" />
          </button>
        </>
      ) : (
        <p className="field-help pad">Rounds outside your crews and trips. They settle with the rest on Everyone, and with your other tabs they add up to it.</p>
      )}
    </>
  );
}

/** What the last close rolled into this crew's season, for you. */
function SinceRolled({ scope }) {
  const state = useStore();
  const book = lastBook(state, scope);
  const rolled = book ? rolledIn(state, scope) : 0;
  if (!rolled) return null;
  return <p className="field-help pad">{rolled > 0 ? `${money(rolled / 100)} owed to you` : `${money(-rolled / 100)} you owe`} was rolled in from the {book.name}.</p>;
}

/** Everyone's final net as bars either side of zero, the amounts in the text. `rows` are { id, name, cents }. */
export function NetBars({ rows, label = 'Final net' }) {
  const state = useStore();
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  if (!rows.length) return <p className="field-help pad">Nobody won or lost any money in these rounds.</p>;
  const max = Math.max(1, ...rows.map(r => Math.abs(r.cents)));
  return (
    <ul className="block season-bals" aria-label={label}>
      {rows.map(r => {
        const isMe = who(r.id) === me;
        return (
          <li key={r.id} className={`season-bal ${isMe ? 'me' : ''}`}>
            <span className="sb-name">{isMe ? 'You' : r.name || nameOf(state, r.id)}</span>
            <span className="sb-track left" aria-hidden="true">{r.cents < 0 && <i style={{ width: `${(-r.cents / max) * 100}%` }} />}</span>
            <span className="sb-track right" aria-hidden="true">{r.cents > 0 && <i style={{ width: `${(r.cents / max) * 100}%` }} />}</span>
            <span className={`sb-amt ${r.cents > 0 ? 'pos' : r.cents < 0 ? 'neg' : ''}`}>{r.cents ? money(r.cents / 100, { sign: true }) : '$0'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** One line a closed season: its name, who it was for, its rounds and your final net. Opens the season. */
export function ClosedSeasons({ title = 'Closed seasons' }) {
  const state = useStore();
  const nav = useNav();
  const books = booksOf(state);
  if (!books.length) return null;
  return (
    <>
      <div className="sec-label">{title}</div>
      {books.map(b => {
        const net = myBookNet(state, b);
        const played = (b.totals || []).some(t => canonicalOf(state)(t.id) === canonicalOf(state)(state.me));
        return (
          <button key={b.id} className="ledger-row book-row" onClick={() => nav.push('book', { id: b.id })} aria-label={`${b.name}, ${bookScopeName(state, b)}: ${played ? `you finished ${money(net / 100, { sign: true })}` : 'you weren’t in it'}. See the season`}>
            <div className="lr-info">
              <div className="lr-name" style={{ fontSize: 16 }}>{b.name}</div>
              <div className="lr-status">{bookScopeName(state, b)} · {plural((b.rounds || []).length, 'round')} · closed {dayWithYear(b.closedAt)}</div>
            </div>
            <div className={`book-net ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{played ? money(net / 100, { sign: true }) : '–'}</div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        );
      })}
    </>
  );
}

/** A marker row in History where a season's books closed. */
export function BooksClosedRow({ book }) {
  const state = useStore();
  const nav = useNav();
  return (
    <button className="books-mark" onClick={() => nav.push('book', { id: book.id })}>
      <Icon name="book-bookmark" fill />
      <span className="row-main">Books closed · {book.name}<span className="bm-sub">{bookScopeName(state, book)} · {shortDay(book.closedAt)}</span></span>
      <Icon name="caret-right" />
    </button>
  );
}
