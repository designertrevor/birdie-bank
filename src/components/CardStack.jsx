// Up next's pile: reminders, It shipped and What's new share one slot. Only the top card shows,
// and a "2 more" button fans the rest out. The cards come and go on their own (each loads later
// and can be dismissed), so each one reports itself to the pile (useStackCard) and is told whether
// it waits behind the top card, rather than the pile reading the page: a card that re-renders
// keeps its waiting mark, and only a waiting card's own section label hides (useStackLabel).
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from 'react';
import { Icon } from './ui.jsx';

const Ctx = createContext(null);
// A card's place: its slot in the pile, then its place among the slot's cards
const byPlace = (a, b) => a.place[0] - b.place[0] || a.place[1] - b.place[1];
/** Whether the card at `at` in the pile's slot waits: the pile is shut and another card is on top. */
const waits = (pile, at) => !!pile && !pile.open && !!pile.top && (pile.top[0] !== pile.slot || pile.top[1] !== at);

export function CardStack({ children }) {
  const [cards, setCards] = useState([]);
  const [open, setOpen] = useState(false);
  // A card's hook calls this as it shows, and the cleanup it returns as it goes
  const register = useCallback((id, place) => {
    setCards(cs => [...cs.filter(c => c.id !== id), { id, place }].sort(byPlace));
    return () => setCards(cs => cs.filter(c => c.id !== id));
  }, []);
  const n = cards.length;
  const top = cards[0]?.place ?? null;
  const value = useMemo(() => ({ register, open, top, slot: 0 }), [register, open, top]);
  return (
    <Ctx.Provider value={value}>
      <div className={`card-stack ${n > 1 && !open ? 'piled' : ''}`}>
        {children}
        {n > 1 && (
          <button className="cs-more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Show less' : `${n - 1} more`} <Icon name={open ? 'caret-up' : 'caret-down'} />
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}

/** One slot of the pile, `at` its place: its cards come after the slots before it, whenever they load. */
export function StackSlot({ at, children }) {
  const pile = useContext(Ctx);
  const value = useMemo(() => (pile ? { ...pile, slot: at } : null), [pile, at]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * A card in the pile: `at` is its place among its slot's cards, `showing` false while it draws
 * nothing (so it isn't counted). Returns whether it waits behind the top card, so it hides itself
 * (the cs-wait class); false outside a pile.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStackCard({ at = 0, showing = true } = {}) {
  const pile = useContext(Ctx);
  const id = useId();
  const register = pile?.register;
  const slot = pile?.slot ?? 0;
  useLayoutEffect(() => (register && showing ? register(id, [slot, at]) : undefined), [register, showing, id, slot, at]);
  return showing && waits(pile, at);
}

/** Whether the section label before the card at `at` hides with it (the top card keeps its label). */
// eslint-disable-next-line react-refresh/only-export-components
export function useStackLabel(at = 0) {
  return waits(useContext(Ctx), at);
}
