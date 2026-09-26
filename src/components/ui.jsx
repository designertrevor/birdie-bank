import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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

export function Steps({ steps, current }) {
  return (
    <div className="step-bar" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <div key={s} className={`step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>{s}</div>
      ))}
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

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
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
    // Start at the sheet itself so its title is read, unless a field in it already took focus
    if (!inside) el?.focus({ preventScroll: true });
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

export function Sheet({ open, onClose, title, children, className = 'sheet' }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} className="sheet-overlay open" onClick={e => e.target === e.currentTarget && onClose?.()} role="dialog" aria-modal="true" aria-label={title}>
      <div className={className}>
        <div className="sheet-handle" />
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 4px 20px' }}>
            <span className="d" style={{ fontSize: 22, fontWeight: 800 }}>{title}</span>
            {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
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
  return <NumpadInner {...props} />;
}

function NumpadInner({ title, prefix = '', suffix = '', initial = '', min, max, allowDecimal = false, allowNegative = false, onDone, onClose }) {
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
  const ref = useDialog(true, onClose);
  return (
    <div ref={ref} tabIndex={-1} className="numpad-overlay open" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="numpad-sheet">
        <div className="numpad-header">
          <div>
            <div className="numpad-title">{title}</div>
            <div className={`np-hint ${tooLow || tooHigh ? 'err' : ''}`} role="status">
              {tooLow ? `Minimum is ${prefix}${min}` : tooHigh ? `Maximum is ${prefix}${max}` : allowNegative ? 'Use ± for a plus handicap' : ' '}
            </div>
          </div>
          <div className="numpad-value" aria-live="polite" aria-atomic="true">{prefix}{shown}{suffix}</div>
        </div>
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

// ---------------------------------------------------------------------------
// Toasts + confirm dialogs (global)
// ---------------------------------------------------------------------------

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const timer = useRef();
  const showToast = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast({ msg, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  const ask = useCallback(opts => new Promise(resolve => setConfirm({ ...opts, resolve })), []);
  const close = v => { confirm?.resolve(v); setConfirm(null); };
  return (
    <UICtx.Provider value={{ showToast, ask }}>
      {children}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast?.msg}</div>
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
          <button className="full-btn outline" onClick={() => close(null)}>{confirm.cancelLabel || 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() { return useContext(UICtx); }

export function Toggle({ on, onChange, label, labelledBy }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} className={`tog ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
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
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} disabled={o.disabled} tabIndex={tabbable ? 0 : -1}
            className={`${btn} ${on ? 'active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
        );
      })}
    </div>
  );
}
