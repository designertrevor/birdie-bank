import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spot } from './Spot.jsx';

export function Icon({ name, fill = false, className = '', label }) {
  return <i className={`${fill ? 'ph-fill' : 'ph-bold'} ph-${name} ${className}`} aria-hidden={label ? undefined : true} aria-label={label} />;
}

export function Header({ title, onBack, onClose, right, small }) {
  return (
    <div className="screen-header">
      {onBack && <button className="header-back" onClick={onBack} aria-label="Back"><Icon name="arrow-left" /></button>}
      <span className="screen-title" style={small || onBack ? { fontSize: 20, letterSpacing: '-.01em', flex: 1 } : { flex: 1 }}>{title}</span>
      {right}
      {onClose && <button className="header-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
    </div>
  );
}

export function Screen({ children, className = '' }) {
  return <div className={`screen active ${className}`}>{children}</div>;
}

/**
 * The setup step bar. Steps before the current one are green with a check.
 * `canGo(i)` and `onGo(i)` make a step tappable. Five or more steps scroll sideways (the green says
 * done, so they drop the check), keeping the one you're on in view. Moving to a step starts it at
 * the top, with the title and this bar in view, wherever the last step was scrolled to.
 */
export function Steps({ steps, current, canGo, onGo }) {
  const ref = useRef(null);
  const moved = useRef(false);
  const many = steps.length > 4;
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const on = many ? bar.querySelector('.step.active') : null;
    if (on) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    if (!moved.current) { moved.current = true; return; }
    const box = bar.closest('.sheet') || bar.closest('.screen')?.querySelector('.scroll');
    box?.scrollTo?.({ top: 0 });
  }, [current, many]);
  return (
    <div ref={ref} className={`step-bar${many ? ' many' : ''}`} role="group" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => {
        const cls = `step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`;
        const label = <>{i < current && !many && <Icon name="check" className="step-check" />}{s}</>;
        return i !== current && onGo && canGo?.(i)
          ? <button key={s} type="button" className={`${cls} tappable`} onClick={() => onGo(i)} aria-label={`Go to ${s}`}>{label}</button>
          : <div key={s} className={cls} aria-current={i === current ? 'step' : undefined}>{label}</div>;
      })}
    </div>
  );
}

export function Empty({ title, text, action, illo = true }) {
  return (
    <div className="empty-state">
      {illo && <BallIllo />}
      <div className="et">{title}</div>
      {text && <div className="es">{text}</div>}
      {action}
    </div>
  );
}

/**
 * A callout: a spot illustration (see Spot.jsx), a bold line and a sentence or two, on a card. For the
 * notes worth stopping for (an invite, an idea, a first step). Quieter notes use .hint-card.
 * `action` goes under the words; `onDismiss` adds a close button.
 */
export function Callout({ spot = null, ids = null, title, children, action = null, onDismiss = null, big = false, soft = false, className = '' }) {
  return (
    <div className={`callout ${big ? 'big' : ''} ${soft ? 'soft' : ''} ${className}`.replace(/\s+/g, ' ').trim()}>
      {spot && <Spot kind={spot} ids={ids} />}
      <div className="co-body">
        {title && <div className="co-title">{title}</div>}
        {children && <div className="co-text">{children}</div>}
        {action}
      </div>
      {onDismiss && <button type="button" className="co-x" onClick={onDismiss} aria-label="Dismiss"><Icon name="x" /></button>}
    </div>
  );
}

export function BallIllo({ className = 'empty-illo', face = true }) {
  return (
    <svg className={className} viewBox="0 0 150 150" aria-hidden="true">
      <defs><radialGradient id={`bg-${className}`} cx="35%" cy="30%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d9d2bd" /></radialGradient></defs>
      <ellipse cx="75" cy="142" rx="34" ry="6" fill="#ebe6d6" />
      <path d="M62 108 L75 140 L88 108Z" fill="#ff6b5a" />
      <circle cx="75" cy="66" r="46" fill={`url(#bg-${className})`} />
      <g fill="rgba(0,0,0,.08)"><circle cx="58" cy="48" r="5" /><circle cx="80" cy="40" r="5" /><circle cx="98" cy="58" r="5" /><circle cx="54" cy="92" r="5" /><circle cx="96" cy="86" r="5" /></g>
      {face && <>
        <circle cx="64" cy="66" r="5" fill="#0a0a0a" /><circle cx="86" cy="66" r="5" fill="#0a0a0a" />
        <path d="M64 80 Q75 90 86 80" stroke="#0a0a0a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

// Only what Tab can reach: a roving list (radio chips, calendar days) keeps its other items at tabindex -1
const FOCUSABLE = ['button:not([disabled])', '[href]', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]']
  .map(s => `${s}:not([tabindex="-1"])`).join(', ');
const openDialogs = []; // topmost last, so Escape and Tab only act on the sheet in front
// The last two focused elements, so a sheet whose field autofocuses still knows what opened it
let focusNow = null, focusBefore = null;
if (typeof document !== 'undefined') document.addEventListener('focusin', e => { focusBefore = focusNow; focusNow = e.target; }, true);

/**
 * Dialog behaviour for sheets: moves focus into the sheet, keeps Tab inside it, closes on
 * Escape, and hands focus back to whatever opened it. Returns a ref for the dialog element.
 */
function useDialog(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const token = {};
    openDialogs.push(token);
    const el = ref.current;
    const inside = el?.contains(document.activeElement);
    const opener = inside ? focusBefore : document.activeElement;
    // Start at the sheet itself so its title is read, unless a field in it already took focus or
    // something in it asks for it (a calendar's cursor day, so the arrow keys work straight away)
    if (!inside) (el?.querySelector('[data-autofocus="true"]') || el)?.focus({ preventScroll: true });
    const onKey = e => {
      if (openDialogs[openDialogs.length - 1] !== token) return;
      const el = ref.current;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current?.(); return; }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      if (opener?.isConnected) opener.focus?.({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

/**
 * Renders a sheet at its screen, so it covers the whole screen from the bottom up. Left inside a
 * step's .scroll, iOS Safari clips it to the scroll's edges: cut off above the buttons below, sliding
 * under the title above, and the rest of it out of reach. It also stops picking up the scroll rows'
 * rise animation.
 */
function AtScreen({ children }) {
  const [target, setTarget] = useState(undefined);
  const ref = useCallback(el => { if (el) setTarget(el.closest('.screen')); }, []);
  return <><span ref={ref} hidden />{target === undefined ? null : target ? createPortal(children, target) : children}</>;
}

export function Sheet(props) {
  if (!props.open) return null;
  return <AtScreen><SheetInner {...props} /></AtScreen>;
}

function SheetInner({ onClose, title, children, className = 'sheet' }) {
  const ref = useDialog(true, onClose);
  return (
    <div ref={ref} tabIndex={-1} className="sheet-overlay open" onClick={e => e.target === e.currentTarget && onClose?.()} role="dialog" aria-modal="true" aria-label={title}>
      <div className={className}>
        <div className="sheet-handle" />
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 4px 16px' }}>
            <span className="d" style={{ fontSize: 22, fontWeight: 800 }}>{title}</span>
            {onClose && <button className="icon-btn sheet-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Number pad sheet. value is a string of digits; supports optional decimal. */
export function Numpad(props) {
  if (!props.open) return null;
  return <AtScreen><NumpadInner {...props} /></AtScreen>;
}

/**
 * `quick`: amounts shown above the keys that pick in one tap (an amount outside min and max is left out).
 * `suffix` is a string, or a function of the amount ("1 pt", "5 pts").
 */
function NumpadInner({ title, prefix = '', suffix = '', initial = '', min, max, allowDecimal = false, allowNegative = false, quick = null, onDone, onClose }) {
  const init = String(initial ?? '');
  const [v, setV] = useState(init.replace('-', ''));
  const [neg, setNeg] = useState(init.startsWith('-'));
  const [touched, setTouched] = useState(false);
  const press = k => {
    let cur = touched ? v : '';
    setTouched(true);
    if (k === 'del') { setV(cur.slice(0, -1)); return; }
    if (k === '.') { if (!allowDecimal || cur.includes('.')) { setV(cur); return; } setV((cur || '0') + '.'); return; }
    if (cur.includes('.') && cur.split('.')[1].length >= (allowDecimal ? 1 : 0)) { setV(cur); return; }
    if (cur.replace('.', '').length >= 3) { setV(cur); return; }
    setV(cur === '0' ? k : cur + k);
  };
  const num = v === '' ? null : parseFloat(v) * (neg ? -1 : 1);
  const tooLow = num != null && min != null && num < min;
  const tooHigh = num != null && max != null && num > max;
  const invalid = num == null || Number.isNaN(num) || tooLow || tooHigh;
  const shown = v === '' ? '–' : (neg ? '+' : '') + v;
  const sfx = n => (typeof suffix === 'function' ? suffix(n) : suffix);
  const ref = useDialog(true, onClose);
  return (
    <div ref={ref} tabIndex={-1} className="numpad-overlay open" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="numpad-sheet">
        <div className="numpad-header">
          <div>
            <div className="numpad-title">{title}</div>
            <div className={`np-hint ${tooLow || tooHigh ? 'err' : ''}`} role="status">
              {tooLow ? `Minimum is ${prefix}${min}${sfx(min)}` : tooHigh ? `Maximum is ${prefix}${max}${sfx(max)}` : allowNegative ? 'Use ± for a plus handicap' : ' '}
            </div>
          </div>
          <div className="numpad-value" aria-live="polite" aria-atomic="true">{prefix}{shown}{sfx(num ?? 0)}</div>
        </div>
        {quick?.length > 0 && (
          <div className="np-quick" role="group" aria-label="Quick picks">
            {quick.filter(q => (min == null || q >= min) && (max == null || q <= max)).map(q => (
              <button key={q} className={`np-quick-btn ${String(q) === init ? 'on' : ''}`} onClick={() => onDone(q)}>{prefix}{q}{sfx(q)}</button>
            ))}
          </div>
        )}
        <div className="numpad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} className="np-btn" onClick={() => press(k)}>{k}</button>)}
          {allowNegative
            ? <button className={`np-btn del ${neg ? 'on' : ''}`} onClick={() => { setNeg(n => !n); setTouched(true); }} aria-label="Plus handicap" aria-pressed={neg}>±</button>
            : allowDecimal
              ? <button className="np-btn del" onClick={() => press('.')} aria-label="Decimal point">.</button>
              : <button className="np-btn del" onClick={() => press('del')} aria-label="Delete"><Icon name="backspace" /></button>}
          <button className="np-btn" onClick={() => press('0')}>0</button>
          {allowNegative && allowDecimal
            ? <button className="np-btn del" onClick={() => press('.')} aria-label="Decimal point">.</button>
            : (allowNegative || allowDecimal)
              ? <button className="np-btn del" onClick={() => press('del')} aria-label="Delete"><Icon name="backspace" /></button>
              : <button className="np-btn confirm" disabled={invalid} onClick={() => onDone(num)}>Done</button>}
        </div>
        {(allowNegative || allowDecimal) && (
          <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8 }}>
            {allowNegative && allowDecimal && <button className="np-btn del" style={{ width: 88 }} onClick={() => press('del')} aria-label="Delete"><Icon name="backspace" /></button>}
            <button className="full-btn" style={{ flex: 1 }} disabled={invalid} onClick={() => onDone(num)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A button that opens the photo picker. The file input stays hidden; the button is a real button,
 * so it takes keyboard focus and Enter or Space like every other. `onPick` gets the change event.
 */
export function FileButton({ id, onPick, className = 'hc-chip', accept = 'image/*', children, ...rest }) {
  const input = useRef(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} {...rest}>{children}</button>
      <input ref={input} id={id} type="file" accept={accept} hidden tabIndex={-1} onChange={onPick} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Toasts + confirm dialogs (global)
// ---------------------------------------------------------------------------

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const timer = useRef();
  // An optional action ({ label, run }), like Undo, keeps the toast up a little longer
  // `tone` is 'money' (pink, money moved), 'win' (mint, good news) or nothing (ink, routine)
  const showToast = useCallback((msg, action = null, { tone = null } = {}) => {
    clearTimeout(timer.current);
    setToast({ msg, action, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 2000);
  }, []);
  const ask = useCallback(opts => new Promise(resolve => setConfirm({ ...opts, resolve })), []);
  const close = v => { confirm?.resolve(v); setConfirm(null); };
  // A screen with buttons pinned at the bottom (and no tab bar) raises the toast above them, so it
  // never sits on the button it's about
  const toastRef = useRef(null);
  useLayoutEffect(() => {
    const el = toastRef.current;
    if (!el || !toast) return;
    const screen = [...document.querySelectorAll('.device .screen.active')].pop();
    const foot = screen?.querySelector(':scope > .cta-wrap, :scope > .pin-btn');
    const top = foot?.getBoundingClientRect().top;
    el.style.bottom = top ? `${Math.max(0, window.innerHeight - top) + 12}px` : '';
  }, [toast]);
  return (
    <UICtx.Provider value={{ showToast, ask }}>
      {children}
      <div ref={toastRef} className={`toast ${toast ? 'show' : ''} ${toast?.action ? 'has-act' : ''}`} role="status" aria-live="polite">
        {/* Keyed, so the same words twice in a row are read out twice */}
        {toast && <span key={toast.key}>{toast.msg}</span>}
        {toast?.action && <button className="toast-act" onClick={() => { toast.action.run(); setToast(null); }}>{toast.action.label}</button>}
      </div>
      {confirm && <Confirm confirm={confirm} close={close} />}
    </UICtx.Provider>
  );
}

function Confirm({ confirm, close }) {
  const ref = useDialog(true, () => close(null));
  return (
    <div ref={ref} tabIndex={-1} className="sheet-overlay open" onClick={e => e.target === e.currentTarget && close(null)} role="alertdialog" aria-modal="true" aria-labelledby="bb-confirm-title" aria-describedby={confirm.text ? 'bb-confirm-text' : undefined}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-title" id="bb-confirm-title">{confirm.title}</div>
        {confirm.text && <p className="sheet-text" id="bb-confirm-text">{confirm.text}</p>}
        <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(confirm.actions || [{ label: confirm.confirmLabel || 'Confirm', value: true, danger: confirm.danger }]).map(a => (
            <button key={a.label} className={`full-btn ${a.danger ? 'danger' : ''} ${a.secondary ? 'outline' : ''}`} onClick={() => close(a.value)}>{a.label}</button>
          ))}
          {confirm.cancelLink
            ? <button className="link-btn center" onClick={() => close(null)}>{confirm.cancelLabel || 'Cancel'}</button>
            : <button className="full-btn outline" onClick={() => close(null)}>{confirm.cancelLabel || 'Cancel'}</button>}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() { return useContext(UICtx); }

export function Toggle({ on, onChange, label, labelledBy, describedBy, disabled = false }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} aria-describedby={describedBy} disabled={disabled} className={`tog ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

/** One-of-a-few picker. Arrow keys move between options like native radio buttons. */
export function Segmented({ options, value, onChange, className = 'holes-toggle', btn = 'holes-btn', label }) {
  const enabled = options.filter(o => !o.disabled);
  const hasValue = options.some(o => o.value === value);
  const onKey = e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || !enabled.length) return;
    e.preventDefault();
    const at = enabled.findIndex(o => o.value === value);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.value);
    const btns = e.currentTarget.querySelectorAll('[role="radio"]');
    btns[options.indexOf(next)]?.focus();
  };
  return (
    <div className={className} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map(o => {
        const on = value === o.value;
        // Only the chosen option is a Tab stop (the first one when nothing is chosen)
        const tabbable = on || (!hasValue && o === enabled[0]);
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} disabled={o.disabled} tabIndex={tabbable ? 0 : -1} aria-label={o.aria || undefined}
            className={`${btn} ${on ? 'active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picking from a list: one look everywhere a person or an option is chosen
// ---------------------------------------------------------------------------

/**
 * The round mark at the end of a pickable row: a plus while it can be added, a pink check once
 * it's picked. `add={false}` leaves an empty ring instead of the plus (one-of-a-list picks), and
 * `small` is the 28px size for a tile's corner or a tight row.
 */
export function PickMark({ on, add = true, busy = false, small = false }) {
  const name = busy ? 'circle-notch' : on ? 'check' : add ? 'plus' : null;
  return (
    <span className={`li-check ${small ? 'sm' : ''} ${on ? 'on' : add ? 'add' : ''}`} aria-hidden="true">
      {name && <Icon name={name} className={busy ? 'spin' : ''} />}
    </span>
  );
}

/**
 * A row picked from a list or a sheet: a name, an optional line under it, and the PickMark.
 * Picked rows take the pink tint and ring. `radio` makes it one of a list (role radio) rather
 * than a toggle; `lead` goes before the name (an avatar), `children` under the sub line.
 */
export function PickRow({ on, onClick, title, sub, lead, radio = false, add = !radio, busy = false, disabled, label, describedBy, className = '', children }) {
  const a11y = radio ? { role: 'radio', 'aria-checked': !!on } : { 'aria-pressed': !!on };
  return (
    <button type="button" className={`list-item pick pick-row ${on ? 'on' : ''} ${className}`} disabled={disabled} onClick={onClick}
      aria-label={label} aria-describedby={describedBy} {...a11y}>
      {lead}
      <div className="row-main">
        <div className="li-name">{title}</div>
        {sub && <div className="li-sub">{sub}</div>}
        {children}
      </div>
      <PickMark on={on} add={add} busy={busy} />
    </button>
  );
}

/**
 * A pill chip picked from a row of options: ink fill and a check once picked. `radio` for one of
 * a set (the parent holds role radiogroup), otherwise a toggle. `check={false}` for bare numbers
 * in a tight grid (hole numbers), where the fill alone reads and the width has to hold. An `icon`
 * shows while it's off and gives way to the check once picked, so a chip never wears two icons.
 */
export function PickChip({ on, onClick, radio = false, small = false, check = true, icon, disabled, label, title, className = '', children }) {
  const a11y = radio ? { role: 'radio', 'aria-checked': !!on } : { 'aria-pressed': !!on };
  return (
    <button type="button" className={`pill-btn pick-chip ${small ? 'sm' : ''} ${on ? 'on' : ''} ${className}`} disabled={disabled} onClick={onClick}
      aria-label={label} title={title} {...a11y}>
      {check && on ? <Icon name="check" className="pc-check" /> : icon ? <Icon name={icon} fill /> : null}
      {children}
    </button>
  );
}
