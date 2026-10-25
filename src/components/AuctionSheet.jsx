// The Calcutta's auction, on the organizer's phone: one lot at a time (each player, or each team in a
// team game), the winning bid in whole dollars (a quick amount or typed on the keypad) and who bought
// it, then the next. Every change is handed back at once (onChange), so the sheet it opens from keeps
// the sales with its own Save or Tee off. Loaded only when opened (SideGames.jsx), so setup's first
// screen doesn't carry it. The money is calcutta.js; this only records the sales.
import { useState } from 'react';
import { Icon, Numpad, PickChip, Sheet, Toggle } from './ui.jsx';
import { CALCUTTA_CHIPS, CALCUTTA_MAX_BID, liveSales, splitsLine } from '../lib/calcutta.js';
import { firstName } from '../lib/format.js';
import { money } from '../lib/golf.js';

/**
 * `entries` [{ id, name, players }], `buyers` [{ id, name }], `sales` { entryId: { buyer, bid, back? } },
 * `settings` the Calcutta's house rules, `fmt`/`unit` the round's money or points (padUnit).
 */
export function AuctionSheet({ entries, buyers, sales, settings, onChange, onClose, fmt = money, unit = { prefix: '$' } }) {
  const buyerIds = buyers.map(b => b.id);
  const live = liveSales(sales, entries, buyerIds);
  // Start on the first lot not sold yet (all sold: the first)
  const [at, setAt] = useState(() => Math.max(0, entries.findIndex(e => !live[e.id])));
  const [typing, setTyping] = useState(false);
  const i = Math.min(at, entries.length - 1);
  const lot = entries[i];
  if (!lot) return null;
  // A half-filled lot (a bid with no buyer yet, or the other way) is kept as typed, so nothing is lost
  const draft = sales?.[lot.id] || {};
  const pot = Object.values(live).reduce((a, x) => a + x.bid, 0);
  const soldCount = Object.keys(live).length;
  const setLot = patch => {
    const next = { ...(sales || {}) };
    const merged = { ...draft, ...patch };
    if (merged.bid == null && merged.buyer == null) delete next[lot.id];
    else next[lot.id] = merged;
    onChange(next);
  };
  const unsell = () => { const next = { ...(sales || {}) }; delete next[lot.id]; onChange(next); };
  const ownLot = draft.buyer != null && lot.players.includes(draft.buyer);
  const canBack = !!settings?.buyBack && draft.buyer != null && !ownLot;
  const last = i === entries.length - 1;
  const nameOf = id => firstName(buyers.find(b => b.id === id)?.name || '?');
  return (
    <>
      <Sheet open={!typing} onClose={onClose} title="Calcutta auction">
        <p className="sheet-text">Bid out loud, then put in the winning bid and who bought {lot.players.length > 1 ? 'them' : 'it'}. You can buy yourself.</p>
        <div className="auction-lot" aria-live="polite">
          <div className="eyebrow">Lot {i + 1} of {entries.length}</div>
          <div className="d auction-name">{lot.name}</div>
          <div className="li-sub">{soldCount ? `${fmt(pot)} pot so far · ${soldCount} sold` : 'Nothing sold yet'}</div>
        </div>

        <div className="block">
          <div className="eyebrow" id="auction-bid-lbl">Winning bid</div>
          <div className="chip-row auction-chips" role="radiogroup" aria-labelledby="auction-bid-lbl">
            {CALCUTTA_CHIPS.map(v => (
              <PickChip key={v} radio on={draft.bid === v} onClick={() => setLot({ bid: v })}>{fmt(v)}</PickChip>
            ))}
            <PickChip radio on={draft.bid != null && !CALCUTTA_CHIPS.includes(draft.bid)} onClick={() => setTyping(true)}
              label={draft.bid != null && !CALCUTTA_CHIPS.includes(draft.bid) ? `Other amount: ${fmt(draft.bid)}. Change` : 'Type another amount'}>
              {draft.bid != null && !CALCUTTA_CHIPS.includes(draft.bid) ? fmt(draft.bid) : <><Icon name="keyboard" /> Other</>}
            </PickChip>
          </div>
        </div>

        <div className="block">
          <div className="eyebrow" id="auction-buyer-lbl">Bought by</div>
          <div className="chip-row auction-chips" role="radiogroup" aria-labelledby="auction-buyer-lbl">
            {buyers.map(b => (
              <PickChip key={b.id} radio on={draft.buyer === b.id} onClick={() => setLot({ buyer: b.id, ...(lot.players.includes(b.id) ? { back: false } : {}) })}>
                {firstName(b.name)}{lot.players.includes(b.id) ? ' (self)' : ''}
              </PickChip>
            ))}
          </div>
          {canBack && (
            <div className="toggle-row flush auction-back">
              <div><div className="toggle-lbl" id="auction-back-lbl">{lot.players.length > 1 ? 'They bought back half' : `${firstName(lot.name)} bought back half`}</div>
                <div className="toggle-sub">{draft.bid ? `${fmt(draft.bid / 2)} to ${nameOf(draft.buyer)} for half of what ${lot.players.length > 1 ? 'they win' : `${firstName(lot.name)} wins`}` : 'Half the price for half the winnings'}</div></div>
              <Toggle on={!!draft.back} onChange={v => setLot({ back: v })} labelledBy="auction-back-lbl" />
            </div>
          )}
          {draft.bid != null && draft.buyer == null && <p className="field-help">Pick who bought {lot.players.length > 1 ? 'them' : 'it'}.</p>}
          {(draft.bid != null || draft.buyer != null) && <button className="text-link-btn" onClick={unsell}>Not sold</button>}
        </div>

        <div className="cta-wrap auction-nav">
          <button className="full-btn outline" disabled={i === 0} onClick={() => setAt(i - 1)} aria-label="Previous lot"><Icon name="arrow-left" /></button>
          <button className="full-btn" onClick={() => (last ? onClose() : setAt(i + 1))}>
            {last ? (soldCount >= 2 ? `Done · ${fmt(pot)} pot` : 'Done · needs 2 lots sold') : <>Next: {entries[i + 1].name} <Icon name="arrow-right" /></>}
          </button>
        </div>

        <div className="sec-label">All lots</div>
        <ul className="auction-list">
          {entries.map((e, k) => {
            const s = live[e.id];
            // A lot half filled in says what it's missing
            const part = !s ? sales?.[e.id] : null;
            const state = s ? `${nameOf(s.buyer)}${s.back ? ' · half back' : ''}` : part?.bid != null ? 'No buyer yet' : part?.buyer != null ? `${nameOf(part.buyer)} · no bid yet` : 'Not sold';
            return (
              <li key={e.id}>
                <button className={`auction-row ${k === i ? 'on' : ''}`} onClick={() => setAt(k)} aria-current={k === i ? 'true' : undefined}>
                  <span className="row-main">{e.name}</span>
                  <span className={`li-sub ${part ? 'auction-part' : ''}`}>{state}</span>
                  <strong>{s ? fmt(s.bid) : part?.bid != null ? fmt(part.bid) : '–'}</strong>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="field-help pad">{soldCount >= 2 ? `Pays ${splitsLine(soldCount, settings?.payout)} on the main game’s finish.` : 'Sell two or more to make a pot.'} A lot nobody buys is out of the pot.</p>
      </Sheet>
      <Numpad open={typing} title={`${lot.name}: winning bid`} {...unit} initial={draft.bid ?? ''} min={1} max={CALCUTTA_MAX_BID}
        onClose={() => setTyping(false)} onDone={v => { setLot({ bid: Math.round(v) }); setTyping(false); }} />
    </>
  );
}
