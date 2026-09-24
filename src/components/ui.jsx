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

export function Sheet({ open, onClose, title, children, className = 'sheet' }) {
  useEffect(() => {
    if (!open) return;
    const k = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-overlay open" onClick={e => e.target === e.currentTarget && onClose?.()} role="dialog" aria-modal="true" aria-label={title}>
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
  return (
    <div className="numpad-overlay open" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="numpad-sheet">
        <div className="numpad-header">
          <div>
            <div className="numpad-title">{title}</div>
            <div className={`np-hint ${tooLow || tooHigh ? 'err' : ''}`} role="status">
              {tooLow ? `Minimum is ${prefix}${min}` : tooHigh ? `Maximum is ${prefix}${max}` : allowNegative ? 'Use ± for a plus handicap' : ' '}
            </div>
          </div>
          <div className="numpad-value" aria-live="polite">{prefix}{shown}{suffix}</div>
        </div>
        <div className="numpad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} className="np-btn" onClick={() => press(k)}>{k}</button>)}
          {allowNegative
            ? <button className={`np-btn del ${neg ? 'on' : ''}`} onClick={() => { setNeg(n => !n); setTouched(true); }} aria-label="Plus handicap">±</button>
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
      {confirm && (
        <div className="sheet-overlay open" onClick={e => e.target === e.currentTarget && close(null)} role="alertdialog" aria-modal="true" aria-label={confirm.title}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{confirm.title}</div>
            {confirm.text && <p className="sheet-text">{confirm.text}</p>}
            <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(confirm.actions || [{ label: confirm.confirmLabel || 'Confirm', value: true, danger: confirm.danger }]).map(a => (
                <button key={a.label} className={`full-btn ${a.danger ? 'danger' : ''} ${a.secondary ? 'outline' : ''}`} onClick={() => close(a.value)}>{a.label}</button>
              ))}
              <button className="full-btn outline" onClick={() => close(null)}>{confirm.cancelLabel || 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() { return useContext(UICtx); }

export function Toggle({ on, onChange, label }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`tog ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Segmented({ options, value, onChange, className = 'holes-toggle', btn = 'holes-btn' }) {
  return (
    <div className={className} role="radiogroup">
      {options.map(o => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} disabled={o.disabled}
          className={`${btn} ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
