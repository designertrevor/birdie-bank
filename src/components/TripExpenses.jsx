// Trip expenses on the Trip page (trip-expenses.js): what's been spent, each expense with your part
// in it, everyone's whole trip all in, and the sheet that adds one, changes or deletes yours, or
// shows someone else's. Anyone on the trip adds one; only whoever added it changes or deletes it.
import { useEffect } from 'react';
import { dropKept, useKept, useKeptScope } from '../lib/kept.js';
import { Icon, Segmented, Sheet, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { AtScreen } from './Trips.jsx';
import { useStore } from '../lib/store.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { sortedPlayers } from '../lib/format.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { QUICK_WHATS, SPLITS, canEditExpense, parseAmount, shareCents, splitLine } from '../lib/trip-expenses.js';
import { deleteExpense, restoreExpense, saveExpense } from '../lib/trip-store.js';
import { expensesOn } from '../lib/trip-expense-sync.js';

const first = name => String(name || '').trim().split(/\s+/)[0];
const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const dollars = c => money(c / 100);
const MAX_CENTS = 9999999;
const MAX_SHARES = 99;

/** A picture for what it was: dinner, gas, the house, drinks, groceries, caddies, or a receipt. */
function iconFor(what) {
  const w = String(what || '').toLowerCase();
  if (/dinner|lunch|breakfast|food|meal|pizza|steak|restaurant/.test(w)) return 'fork-knife';
  if (/gas|fuel|car|uber|lyft|taxi|rental|parking/.test(w)) return 'gas-pump';
  if (/house|room|hotel|airbnb|lodg|cabin|condo|rent/.test(w)) return 'house-line';
  if (/drink|beer|bar|wine|whisk|round of/.test(w)) return 'beer-stein';
  if (/grocer|food run|store|supplies/.test(w)) return 'shopping-cart';
  if (/caddie|caddy|green fee|tee time|range|balls/.test(w)) return 'golf';
  return 'receipt';
}

/** "Sat, Oct 17" for when it was added. */
const dayOf = at => new Date(at || Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** A name for someone in an expense: this phone's name for them, or the one the expense came with. */
function useNames(st, me) {
  const state = useStore();
  const stored = {};
  for (const x of st.expenses) Object.assign(stored, x.names);
  const full = id => {
    if (id === me) return 'You';
    const n = nameOf(state, id);
    return n === 'Someone' && stored[id] ? stored[id] : n;
  };
  return { full, short: id => (id === me ? 'You' : first(full(id))) };
}

/**
 * The Expenses part of the Trip page: what's been spent and your part of it, Add an expense, each
 * expense newest first, and everyone's whole trip all in.
 */
export function TripExpensesView({ st, me, adding = false, onAdded }) {
  // 'new', or the id of the expense being looked at (kept by id, so it comes back as it is now)
  const [openId, setOpenId] = useKept('expenses:open', adding ? 'new' : null);
  const editing = openId === 'new' ? 'new' : st.expenses.find(x => x.id === openId) || null;
  const close = () => { setOpenId(null); onAdded?.(); };
  const { full, short } = useNames(st, me);
  const mine = st.spending.get(me);
  const offNote = st.expenses.some(x => x.by === me) && !expensesOn();
  return (
    <>
      {st.expenses.length > 0 && (
        <div className="block exp-sum">
          <div className="eyebrow">Spent on the trip</div>
          <div className="d exp-big">{money(st.spent)}</div>
          <div className="exp-sum-sub">
            {st.expenses.length} expense{st.expenses.length === 1 ? '' : 's'}
            {mine ? ` · you paid ${dollars(mine.paid)}, your share is ${dollars(mine.share)}` : ''}
          </div>
        </div>
      )}
      <button className="add-row" onClick={() => setOpenId('new')}>
        <div className="add-ci"><Icon name="receipt" /></div><span className="add-lbl">Add an expense</span>
      </button>
      {st.expenses.length === 0 && (
        <p className="field-help pad">Gas, dinner, the house: add what someone paid for the group and how to split it. It’s in everyone’s total on the Tab right away, and it settles with the rounds, once, at the end.</p>
      )}
      {st.expenses.map(x => <ExpenseRow key={x.id} x={x} me={me} short={short} onOpen={() => setOpenId(x.id)} />)}
      {st.expenses.length > 0 && <AllIn st={st} me={me} short={short} />}
      {offNote && <p className="hint-card"><Icon name="cloud-slash" /> Expenses you add stay on your phone and your account for now, so friends don’t see them on theirs yet. They still count here and on your Tab.</p>}
      {st.expenses.length > 0 && <p className="field-help pad">Anyone on the trip can add one. Only the person who added an expense changes or deletes it. Settle the trip squares the expenses and the rounds together, in the fewest payments.</p>}
      <ExpenseSheet open={!!editing} expense={editing === 'new' ? null : editing} st={st} me={me} full={full} short={short} onClose={close} />
    </>
  );
}

/** One expense: what, who paid and how it's split, the amount, and your part in it. */
function ExpenseRow({ x, me, short, onOpen }) {
  const myShare = x.parts.filter(p => p.id === me).reduce((a, p) => a + p.cents, 0);
  const owed = x.payer === me ? x.cents - myShare : 0;
  const line = owed > 0 ? `You’re owed ${dollars(owed)}` : x.payer !== me && myShare > 0 ? `Your share ${dollars(myShare)}` : null;
  const payer = short(x.payer);
  return (
    <button className="ledger-row exp-row" onClick={onOpen} aria-label={`${x.what}, ${money(x.amount)}. ${payer} paid. ${splitLine(x, short)}.${line ? ` ${line}.` : ''} See it`}>
      <div className="exp-ic"><Icon name={iconFor(x.what)} /></div>
      <div className="lr-info">
        <div className="exp-name">{x.what}</div>
        <div className="lr-status">{payer === 'You' ? 'You paid' : `${payer} paid`} · {splitLine(x, short)} · {dayOf(x.at)}</div>
        {line && <div className={`exp-mine ${owed > 0 ? 'pos' : 'neg'}`}>{line}</div>}
      </div>
      <div className="exp-amt">{money(x.amount)}</div>
    </button>
  );
}

/**
 * Everyone's whole trip: the rounds' money, the expenses, and both together (what Settle the trip
 * squares). Before any round has money on it: what each person paid, their share, and both together.
 */
function AllIn({ st, me, short }) {
  // A decided cup stake is in each person's golf total (trips.js standings), so the column says so
  const golf = st.money.length > 0 || !!st.cup?.stakeOn;
  const cols = golf ? [st.cup?.stakeOn ? 'Rounds and cup' : 'Rounds', 'Expenses', 'All in'] : ['Paid', 'Share', 'All in'];
  return (
    <>
      <div className="sec-label">Everyone, all in</div>
      <div className="block trip-games-wrap">
        <table className="trip-games">
          <thead><tr><th scope="col"><span className="sr-only">Player</span></th>{cols.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {st.totals.map(t => {
              const sp = st.spending.get(t.id) || { paid: 0, share: 0 };
              const cells = golf ? [money(t.golf, { sign: true }), money(t.expenses, { sign: true })] : [dollars(sp.paid), dollars(sp.share)];
              return (
                <tr key={t.id} className={t.id === me ? 'me' : ''}>
                  <th scope="row">{short(t.id)}</th>
                  {cells.map((c, i) => <td key={i} className={golf ? sign(i ? t.expenses : t.golf) : ''}>{c}</td>)}
                  <td className={`tot ${sign(t.amount)}`}>{money(t.amount, { sign: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="field-help pad">{golf ? `The rounds on this phone${st.cup?.stakeOn ? ', the cup stake' : ''} and every expense. ` : ''}Plus is what the trip owes them, minus what they owe. It all adds up to $0.</p>
    </>
  );
}

/** Add an expense, change or delete your own, or see someone else's. */
function ExpenseSheet({ open, onClose, expense, st, me, full, short }) {
  const state = useStore();
  const mine = !expense || canEditExpense(state, expense);
  const title = !expense ? 'Add an expense' : mine ? 'Change the expense' : expense.what;
  // The view sits in the page's scrolling list, so the sheet goes up to the screen to cover all of it
  return (
    <AtScreen>
      <Sheet open={open} onClose={onClose} title={title}>
        {open && (mine
          ? <ExpenseForm key={expense?.id || 'new'} expense={expense} st={st} me={me} full={full} short={short} onDone={onClose} />
          : <ExpenseView x={expense} me={me} short={short} full={full} onClose={onClose} />)}
      </Sheet>
    </AtScreen>
  );
}

/** Someone else's expense, as it is: only they change or delete it. */
function ExpenseView({ x, me, short, full, onClose }) {
  return (
    <div className="block exp-form">
      <div className="exp-view-top">
        <div className="exp-ic"><Icon name={iconFor(x.what)} /></div>
        <div className="row-main">
          <div className="d exp-big sm">{money(x.amount)}</div>
          <div className="exp-sum-sub">{short(x.payer) === 'You' ? 'You paid' : `${full(x.payer)} paid`} · {splitLine(x, short)} · {dayOf(x.at)}</div>
        </div>
      </div>
      <ul className="exp-people">
        {x.parts.map((p, i) => (
          <li key={`${p.id}-${i}`} className={`exp-person ${p.id === me ? 'me' : ''}`}>
            <span className="exp-who"><Avatar id={p.id} name={full(p.id)} /> <span className="exp-pname">{full(p.id)}</span>{x.split === 'shares' && <span className="exp-of">{p.part} share{p.part === 1 ? '' : 's'}</span>}</span>
            <span className="exp-share">{dollars(p.cents)}</span>
          </li>
        ))}
      </ul>
      <p className="field-help">Only {x.by === me ? 'you' : !x.by || full(x.by) === 'Someone' ? 'the person who added it' : first(full(x.by))} can change or delete it.</p>
      <button className="full-btn outline" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
    </div>
  );
}

/** "12.5" for 1250 cents, "12" for 1200: how an amount reads back in its box. */
const centsText = c => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

/**
 * The form: what it was (with one-tap picks), how much, who paid, and the split: equally among the
 * people ticked, by amount (they have to add up to the total), or by shares. Each person's part
 * shows as you go, to the cent.
 */
function ExpenseForm({ expense, st, me, full, short, onDone }) {
  const state = useStore();
  const { ask, showToast } = useUI();
  const who = canonicalOf(state);
  // Who can be in it: you, who's going, everyone who's played a round of the trip, and anyone already in an expense
  const base = [me, ...st.going, ...st.people.keys(), ...st.expenses.flatMap(x => [x.payer, ...x.parts.map(p => p.id)])];
  if (expense) base.push(expense.payer, ...expense.parts.map(p => p.id));
  // Half filled in stays filled in after switching apps (see kept.js), until the form closes
  const scope = useKeptScope();
  const at = `expense:${expense?.id || 'new'}:`;
  useEffect(() => () => { if (scope != null) dropKept(scope, at); }, [scope, at]);
  const [extra, setExtra] = useKept(`${at}extra`, []);
  const pool = [...new Set([...base, ...extra].filter(Boolean))];
  const [more, setMore] = useKept(`${at}more`, false);
  const others = sortedPlayers(state).map(p => who(p.id)).filter((id, i, a) => a.indexOf(id) === i && !pool.includes(id));

  const [what, setWhat] = useKept(`${at}what`, expense?.what || '');
  const [amountText, setAmountText] = useKept(`${at}amount`, expense ? centsText(expense.cents) : '');
  const [payer, setPayer] = useKept(`${at}payer`, expense?.payer || me);
  const [split, setSplit] = useKept(`${at}split`, expense?.split || 'equal');
  // Kept as a list (a Set doesn't save), used as a Set
  const [inList, setInList] = useKept(`${at}in`, () => (expense ? expense.parts.map(p => p.id) : pool));
  const inSplit = new Set(inList);
  const setInSplit = next => setInList(cur => [...(typeof next === 'function' ? next(new Set(cur)) : next)]);
  const [amounts, setAmounts] = useKept(`${at}amounts`, () => Object.fromEntries((expense?.split === 'amounts' ? expense.parts : []).map(p => [p.id, centsText(p.cents)])));
  const [shares, setShares] = useKept(`${at}shares`, () => Object.fromEntries(expense?.split === 'shares' ? expense.parts.map(p => [p.id, p.part]) : pool.map(id => [id, 1])));

  const total = parseAmount(amountText);
  const badAmount = amountText.trim() !== '' && (total == null || total <= 0 || total > MAX_CENTS);
  const badParts = split === 'amounts' && pool.some(id => (amounts[id] || '').trim() !== '' && parseAmount(amounts[id]) == null);
  const people = split === 'equal' ? pool.filter(id => inSplit.has(id)).map(id => ({ id, part: null }))
    : split === 'amounts' ? pool.filter(id => parseAmount(amounts[id]) > 0).map(id => ({ id, part: parseAmount(amounts[id]) }))
    : pool.filter(id => (shares[id] || 0) > 0).map(id => ({ id, part: shares[id] }));
  // Who's in goes along to the other kind of split: someone left out of an equal split gets no
  // shares (and the other way round), so nobody comes back in without a tap
  const changeSplit = next => {
    if (next === split) return;
    const inIt = new Set(people.map(p => p.id));
    if (inIt.size) {
      if (next === 'equal') setInSplit(inIt);
      if (next === 'shares') setShares(cur => Object.fromEntries(pool.map(id => [id, inIt.has(id) ? cur[id] || 1 : 0])));
    }
    setSplit(next);
  };
  const assigned = people.reduce((a, p) => a + (split === 'amounts' ? p.part : 0), 0);
  const left = split === 'amounts' && total ? total - assigned : 0;
  const ok = !!total && !badAmount && !badParts && people.length > 0 && !!payer && (split !== 'amounts' || left === 0);
  // Each person's part as it stands, to the cent (the odd cents go to the payer first)
  const parts = total && people.length ? shareCents({ amount: total / 100, split, payer: { id: payer }, people: people.map(p => ({ id: p.id, part: split === 'amounts' ? p.part / 100 : p.part })) }) : [];
  const partOf = id => { const i = people.findIndex(p => p.id === id); return i >= 0 && parts.length ? parts[i] : null; };

  const flip = id => setInSplit(cur => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const step = (id, d) => setShares(cur => ({ ...cur, [id]: Math.max(0, Math.min(MAX_SHARES, (cur[id] ?? 0) + d)) }));
  const addPerson = id => {
    setExtra(x => [...x, id]);
    setInSplit(cur => new Set([...cur, id]));
    setShares(cur => ({ ...cur, [id]: cur[id] ?? 1 }));
  };

  const status = !total ? null
    : split === 'equal' ? (people.length ? `Split ${people.length} way${people.length === 1 ? '' : 's'}${people.length > 1 && total % people.length === 1 && inSplit.has(payer) ? ', and whoever paid takes the odd cent' : ''}` : 'Tick who it’s for')
    : split === 'shares' ? (people.length ? `${people.reduce((a, p) => a + p.part, 0)} shares in all` : 'Give someone a share')
    : left > 0 ? `${dollars(left)} left to split` : left < 0 ? `${dollars(-left)} more than the total` : 'Adds up';

  const save = () => {
    if (!ok) return;
    const e = saveExpense({ id: expense?.id || null, tripId: st.trip.id, what, amount: total, payer, split, people });
    if (!e) { showToast('That doesn’t add up. Check the amounts and try again.'); return; }
    showToast(expense ? `${e.what} saved` : `${e.what} added${expensesOn() ? '. Everyone on the trip sees it.' : ''}`);
    onDone();
  };
  const del = async () => {
    if (!(await ask({ title: `Delete ${expense.what}?`, text: 'It comes off the trip and off everyone’s total on the Tab.', confirmLabel: 'Delete it', danger: true }))) return;
    const raw = expense.raw;
    if (!deleteExpense(expense.id)) return;
    onDone();
    showToast(`${expense.what} deleted`, { label: 'Undo', run: () => restoreExpense(raw) });
  };

  return (
    <div className="block exp-form">
      <label className="field-label" htmlFor="exp-what">What was it? <span className="opt">optional</span></label>
      <input id="exp-what" className="text-input" value={what} onChange={e => setWhat(e.target.value)} maxLength={40} placeholder="Dinner, gas, the house" autoFocus={!expense} />
      <div className="exp-chips" role="group" aria-label="Quick picks">
        {QUICK_WHATS.map(w => <button key={w} type="button" className={`pill-btn sm ${what === w ? 'on' : ''}`} aria-pressed={what === w} onClick={() => setWhat(w)}>{w}</button>)}
      </div>

      <label className="field-label" htmlFor="exp-amount">How much?</label>
      <div className="exp-money">
        <span className="exp-dollar" aria-hidden="true">$</span>
        <input id="exp-amount" className="text-input" inputMode="decimal" value={amountText} onChange={e => setAmountText(e.target.value)} placeholder="0.00" aria-invalid={badAmount || undefined} aria-describedby={badAmount ? 'exp-amount-help' : undefined} />
      </div>
      {badAmount && <p className="field-help err" id="exp-amount-help">An amount up to $99,999.99, to the cent.</p>}

      <div className="field-label" id="exp-payer">Who paid?</div>
      <div className="exp-chips" role="group" aria-labelledby="exp-payer">
        {pool.map(id => <button key={id} type="button" className={`pill-btn sm ${payer === id ? 'on' : ''}`} aria-pressed={payer === id} onClick={() => setPayer(id)}>{short(id)}</button>)}
      </div>

      <div className="field-label" id="exp-split">Split it</div>
      <Segmented label="Split it" className="press-mode-row" btn="pm-btn" value={split} onChange={changeSplit}
        options={Object.entries(SPLITS).map(([value, label]) => ({ value, label }))} />
      <ul className="exp-people" aria-labelledby="exp-split">
        {pool.map(id => {
          const share = partOf(id);
          const name = full(id);
          return (
            <li key={id} className={`exp-person ${id === me ? 'me' : ''}`}>
              {split === 'equal' ? (
                <button type="button" className="exp-who exp-tick" aria-pressed={inSplit.has(id)} onClick={() => flip(id)}>
                  <Icon name={inSplit.has(id) ? 'check-square' : 'square'} fill={inSplit.has(id)} />
                  <Avatar id={id} name={name} /> <span className="exp-pname">{name}</span>
                </button>
              ) : (
                <span className="exp-who"><Avatar id={id} name={name} /> <span className="exp-pname">{name}</span></span>
              )}
              {split === 'amounts' && (
                <span className="exp-money sm">
                  <span className="exp-dollar" aria-hidden="true">$</span>
                  <input className="text-input" inputMode="decimal" value={amounts[id] || ''} placeholder="0" aria-label={`${id === me ? 'Your' : `${first(name)}’s`} part`}
                    aria-invalid={((amounts[id] || '').trim() !== '' && parseAmount(amounts[id]) == null) || undefined}
                    onChange={e => setAmounts(cur => ({ ...cur, [id]: e.target.value }))} />
                </span>
              )}
              {split === 'shares' && (
                <span className="exp-step">
                  <button type="button" className="icon-btn sm" onClick={() => step(id, -1)} disabled={!shares[id]} aria-label={`One share less for ${id === me ? 'you' : first(name)}`}><Icon name="minus" /></button>
                  <span className="exp-n" aria-live="polite">{shares[id] || 0}</span>
                  <button type="button" className="icon-btn sm" onClick={() => step(id, 1)} disabled={(shares[id] || 0) >= MAX_SHARES} aria-label={`One share more for ${id === me ? 'you' : first(name)}`}><Icon name="plus" /></button>
                </span>
              )}
              {split !== 'amounts' && <span className={`exp-share ${share == null ? 'none' : ''}`}>{share == null ? '–' : dollars(share)}</span>}
            </li>
          );
        })}
      </ul>
      {split === 'equal' && pool.length > 2 && (
        <button type="button" className="link-btn exp-all" onClick={() => setInSplit(new Set(people.length === pool.length ? [] : pool))}>
          {people.length === pool.length ? 'Untick everyone' : 'Tick everyone'}
        </button>
      )}
      {status && <p className={`exp-status ${split === 'amounts' ? (left ? 'off' : 'ok') : ''}`} role="status">{split === 'amounts' && !left ? <Icon name="check-circle" fill /> : null} {status}</p>}

      {others.length > 0 && (more ? (
        <>
          <div className="field-label" id="exp-more">Someone else from Players</div>
          <div className="exp-chips" role="group" aria-labelledby="exp-more">
            {others.map(id => <button key={id} type="button" className="pill-btn sm" onClick={() => addPerson(id)} aria-label={`Add ${nameOf(state, id)} to it`}><Icon name="plus" /> {first(nameOf(state, id))}</button>)}
          </div>
        </>
      ) : (
        <button type="button" className="text-link" onClick={() => setMore(true)}><Icon name="user-plus" /> Someone else in it?</button>
      ))}

      <button className="full-btn" style={{ marginTop: 14 }} disabled={!ok} onClick={save}>
        {expense ? 'Save changes' : 'Add the expense'} <Icon name={expense ? 'check' : 'arrow-right'} />
      </button>
      {expense && <button type="button" className="text-link danger" onClick={del}><Icon name="trash" /> Delete this expense</button>}
    </div>
  );
}
