// One player's total for the trial tops: the amount in the win or loss colour, popping when it moves
// (the same pop as today's strip). `m` is useMoneyStrip's state, `r` one of its rows.
export function Amount({ m, r, className = '' }) {
  return <span key={r.changed ? r.v : 'same'} className={`tp-amt ${r.tone} ${r.changed ? 'bump' : ''} ${className}`}>{m.fmt(r.v, { sign: true })}</span>;
}
