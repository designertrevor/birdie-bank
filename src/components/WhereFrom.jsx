// Where each amount comes from (where-from.js): the settle-up keeps the fewest payments, and tapping
// a person shows what's between you game by game and side bet by side bet, for one round (the
// settle-up and the results) or across every round (a person's card on the Tab).
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Sheet } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { useStore } from '../lib/store.js';
import { meFor, myIds, roundPlayerName } from '../lib/format.js';
import { nameOf } from '../lib/ledger.js';
import { money } from '../lib/golf.js';
import { shortDate } from '../lib/shared-tab.js';
import { breakdownLine, breakdownWith, pairBreakdown } from '../lib/where-from.js';
import { countsMoney, unitFmt } from '../lib/play-for.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || '?';
const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');

/** One line of a breakdown: "Banker +$4", a side bet marked as one. */
function Item({ x, fmt }) {
  return (
    <li className="wf-item">
      <span className="wf-lbl">{x.bet && <Icon name="hand-coins" />} {x.label}</span>
      <span className={`wf-amt ${cls(x.amount)}`}>{fmt(x.amount, { sign: true })}</span>
    </li>
  );
}

/**
 * "Where it comes from" for one round: a row for each other player (yours with them, from your side),
 * or for each payment when you only watched. Tapping a row opens the breakdown.
 */
export function RoundWhereFrom({ round, res }) {
  const me = useStore(s => meFor(round, s));
  const [open, setOpen] = useState(null); // { a, b }
  const fmt = unitFmt(round);
  const mine = round.players.some(p => p.id === me);
  const rows = mine
    ? round.players.filter(p => p.id !== me).map(p => ({ a: me, b: p.id }))
    : res.transfers.map(t => ({ a: t.to, b: t.from }));
  if (!rows.length) return null;
  const who = (a, b) => (a === me ? `${first(roundPlayerName(round, b))} and you` : `${first(roundPlayerName(round, a))} and ${first(roundPlayerName(round, b))}`);
  const bd = open ? pairBreakdown(round, open.a, open.b, res) : null;
  // For screen readers, in words: "Preston pays you $15", "you pay Preston $15", "square"
  const owesLine = (a, b, total) => {
    if (!total) return 'square';
    const nm = id => (id === me ? 'you' : first(roundPlayerName(round, id)));
    const [payer, payee] = total > 0 ? [b, a] : [a, b];
    return `${nm(payer)} ${payer === me ? 'pay' : 'pays'} ${nm(payee)} ${fmt(Math.abs(total))}`;
  };
  return (
    <>
      <div className="sec-label">Where it comes from</div>
      {rows.map(({ a, b }) => {
        const x = pairBreakdown(round, a, b, res);
        const name = roundPlayerName(round, b);
        return (
          <button key={`${a}>${b}`} className="set-row wf-row" onClick={() => setOpen({ a, b })}
            aria-label={`${who(a, b)}: ${owesLine(a, b, x.total)}. ${breakdownLine(x.items, fmt)}. See where it comes from`}>
            <Avatar id={b} name={name} />
            <div className="row-main">
              <div className="set-name">{who(a, b)}</div>
              <div className="set-sub">{breakdownLine(x.items, fmt)}</div>
            </div>
            <div className={`wf-total ${cls(x.total)}`}>{fmt(x.total, { sign: true })}</div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        );
      })}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? who(open.a, open.b) : ''}>
        {bd && (
          <>
            <p className="sheet-text">{open.a === me ? 'What you won or lost with them' : `What ${first(roundPlayerName(round, open.a))} won or lost with ${first(roundPlayerName(round, open.b))}`}, game by game and bet by bet.</p>
            <ul className="wf-list">{bd.items.map(x => <Item key={x.key} x={x} fmt={fmt} />)}</ul>
            <div className="wf-sum"><span>Between {open.a === me ? 'you two' : 'them'}</span><strong className={cls(bd.total)}>{fmt(bd.total, { sign: true })}</strong></div>
            {countsMoney(round) && <p className="field-help pad">The payments square everyone in as few as possible, so who pays whom can differ from this.</p>}
          </>
        )}
        <div className="cta-wrap"><button className="full-btn outline" onClick={() => setOpen(null)}>Close</button></div>
      </Sheet>
    </>
  );
}

/**
 * "Where it comes from" on a person's card on the Tab: a link that opens everything between you,
 * by game and side bet across your rounds, then round by round.
 */
export function TabWhereFrom({ other }) {
  const state = useStore();
  const [open, setOpen] = useState(false);
  // The sheet renders at the screen, so it covers the Tab like every other sheet instead of opening inside the card
  const [target, setTarget] = useState(null);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen')); }, []);
  const f = first(nameOf(state, other));
  const w = open ? breakdownWith(state, myIds(state), other) : null;
  return (
    <>
      <span ref={ref} hidden />
      <button className="link-btn tab-part" onClick={() => setOpen(true)}>Where it comes from</button>
      {target && createPortal(
        <Sheet open={open} onClose={() => setOpen(false)} title={`${f} and you`}>
          {w && (
            <>
              <p className="sheet-text">What you’ve won or lost with {f}, game by game and bet by bet, across the rounds you’ve finished together.</p>
              {w.totals.length > 0 ? <ul className="wf-list">{w.totals.map(x => <Item key={x.group} x={{ ...x, bet: x.group.startsWith('bet:') }} fmt={money} />)}</ul>
                : <p className="hint-card"><Icon name="handshake" fill /> All square on every game.</p>}
              <div className="wf-sum"><span>From your rounds</span><strong className={cls(w.net)}>{money(w.net, { sign: true })}</strong></div>
              {w.paid !== 0 && <div className="wf-sum sub"><span>{w.paid > 0 ? `${f} paid you` : `You paid ${f}`}</span><strong>{money(-w.paid, { sign: true })}</strong></div>}
              {w.paid !== 0 && <div className="wf-sum"><span>Still between you</span><strong className={cls(w.open)}>{money(w.open, { sign: true })}</strong></div>}
              <p className="field-help pad">The Tab squares everyone in the fewest payments, so the amount on {f}’s card can differ from this.</p>
              {w.rounds.length > 0 && <div className="sec-label">Round by round</div>}
              {w.rounds.map(x => (
                <div key={x.round.id} className="wf-round">
                  <div className="wf-rhead">
                    <span>{x.round.course?.name || 'Round'} · {shortDate(x.at)}</span>
                    <strong className={cls(x.total)}>{money(x.total, { sign: true })}</strong>
                  </div>
                  <div className="wf-rline">{breakdownLine(x.items, money)}</div>
                </div>
              ))}
            </>
          )}
          <div className="cta-wrap"><button className="full-btn outline" onClick={() => setOpen(false)}>Close</button></div>
        </Sheet>,
        target,
      )}
    </>
  );
}
