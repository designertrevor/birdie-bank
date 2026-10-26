// The par chips on the hole on screen (HoleScores.jsx): each box starts at par, a chip sets Eagle,
// Birdie, Par, Bogey or Double in one tap, and the last chip opens the number pad sheet for anything
// else (a hole in one, a 9, a pickup, one more or less). What a tap does is lib/par-chips.js; the
// score itself goes through useHoleDraft's setScore, as the old − / + did, so saving is unchanged.
import { Icon, Sheet } from '../../components/ui.jsx';
import { MAX_SCORE, MIN_SCORE, chipFor, parChips, scoreAfter } from '../../lib/par-chips.js';
import { pickupGross, scoreName } from '../../lib/golf.js';
import './play.css';

/**
 * One box's chips. `v` is the score shown, `touched` whether it's been entered (an untouched box
 * shows Par as the quiet default, the same muted par the stepper showed), `onScore` sets it, `onPad`
 * opens the pad. `name` is the player's or team's full name, for the buttons' labels.
 */
export function ParChipRow({ name, v, par, touched, onScore, onPad }) {
  const chips = parChips(par);
  const on = chipFor(v, par);
  const off = on == null; // a pickup or a number off the chips: the pad's chip shows it
  return (
    <div className="pc-chips" role="group" aria-label={`${name}’s score`}>
      {chips.map(c => {
        const sel = on === c.key;
        return (
          <button key={c.key} type="button" className={`pc-chip ${sel ? (touched ? 'on' : 'on soft') : ''} ${c.key}`}
            aria-pressed={sel} aria-label={`${name} ${c.label}, ${c.value}`} onClick={() => onScore(scoreAfter(v, { chip: c.key }, par))}>
            <span className="pc-l">{c.short}</span>
          </button>
        );
      })}
      <button type="button" className={`pc-chip more ${off ? 'on' : ''}`} aria-pressed={off} aria-haspopup="dialog"
        aria-label={off ? `${name}: ${v === 'X' ? 'picked up' : v}. Number pad` : `${name}: another score. Number pad`} onClick={onPad}>
        {off ? <span className="pc-l pc-v">{v === 'X' ? 'X' : v}</span> : <Icon name="plus" />}
      </button>
    </div>
  );
}

/**
 * The number pad sheet (Layout Lab's quick-pick sheet): the box's number big, − and + beside it, a
 * key for every score from 1 to 15 with the golf names on the ones near par, Picked up, and Next for
 * the next box. Every key sets the score straight away, so the money strip moves as it goes in.
 * `unit` is { id, name } for the box open; `strokes` its strokes here (a pickup counts as net double
 * bogey, so the pad says what it counts as); `next` the next box's first name, or null.
 */
export function ScorePadSheet({ open, unit, hole, v, strokes = 0, onScore, onNext, next = null, onClose }) {
  if (!open || !unit) return null;
  const par = hole.par;
  const keys = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);
  const label = v === 'X' ? `Picked up, counts ${pickupGross(par, strokes)}` : scoreName(v, par);
  const near = n => n === 1 ? 'Ace' : n - par >= -2 && n - par <= 2 ? scoreName(n, par).replace('Double', 'Dbl') : null;
  return (
    <Sheet open onClose={onClose} title={`${unit.name} · Hole ${hole.no}`} className="sheet score-pad">
      <p className="sheet-text sp-sub">Par {par}. Tap a number; it goes in straight away.</p>
      <div className="sp-now">
        <button type="button" className="sp-step" aria-label={`${unit.name} one less`} disabled={v !== 'X' && v <= MIN_SCORE}
          onClick={() => onScore(scoreAfter(v, { step: -1 }, par))}><Icon name="minus" /></button>
        <div className="sp-big">
          <span className={`sp-num ${v !== 'X' && v < par ? 'under' : ''}`} aria-live="polite" aria-atomic="true">
            <span className="sr-only">{unit.name} </span>{v === 'X' ? <><span aria-hidden="true">X</span><span className="sr-only">picked up</span></> : v}
          </span>
          <span className="sp-name">{label}</span>
        </div>
        <button type="button" className="sp-step plus" aria-label={`${unit.name} one more`} disabled={v !== 'X' && v >= MAX_SCORE}
          onClick={() => onScore(scoreAfter(v, { step: 1 }, par))}><Icon name="plus" /></button>
      </div>
      <div className="sp-keys" role="group" aria-label="Scores">
        {keys.map(n => (
          <button key={n} type="button" className={`sp-key ${v === n ? 'on' : ''}`} aria-pressed={v === n} aria-label={near(n) ? `${n}, ${near(n)}` : String(n)}
            onClick={() => onScore(scoreAfter(v, { pad: n }, par))}>
            <span className="sp-k">{n}</span>
            {near(n) && <span className="sp-kl" aria-hidden="true">{near(n)}</span>}
          </button>
        ))}
      </div>
      <div className="sp-foot">
        <button type="button" className={`sp-pickup ${v === 'X' ? 'on' : ''}`} aria-pressed={v === 'X'} onClick={() => onScore(scoreAfter(v, { pickup: true }, par))}>
          <Icon name="hand-grabbing" /> {v === 'X' ? 'Picked up' : 'Picked up?'}
        </button>
        <button type="button" className="full-btn sp-next" onClick={next ? onNext : onClose}>{next ? <>Next: {next} <Icon name="arrow-right" /></> : 'Done'}</button>
      </div>
    </Sheet>
  );
}
