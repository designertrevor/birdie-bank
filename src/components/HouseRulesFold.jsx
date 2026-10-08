// Round setup, Bets: the game's bets stay up front and its house rules (the on/off switches) fold
// under one row that says how many are on, so the ones that change the money are always counted
// in plain sight. Each switch row (HouseRule) reports itself and whether it's on, so the fold
// counts from what's rendered rather than reading the page.
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from 'react';
import { Icon, Toggle } from './ui.jsx';

const Ctx = createContext(null);

export function HouseRulesFold({ children }) {
  // Each rule by its own id: whether it's on
  const [rules, setRules] = useState({});
  const [open, setOpen] = useState(false);
  const report = useCallback((id, on) => setRules(r => (r[id] === on ? r : { ...r, [id]: on })), []);
  const forget = useCallback(id => setRules(r => { if (!(id in r)) return r; const next = { ...r }; delete next[id]; return next; }), []);
  const value = useMemo(() => ({ report, forget }), [report, forget]);
  const all = Object.keys(rules).length;
  const on = Object.values(rules).filter(Boolean).length;
  return (
    <Ctx.Provider value={value}>
      <div className={`rules-fold ${open ? 'open' : ''} ${all ? 'has-rules' : ''}`}>
        {children}
        {all > 0 && (
          <button className="set-row rf-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            <div className="row-main">
              <div className="set-name">House rules</div>
              <div className="set-sub">{on ? `${on} on` : 'All off'} · {all} to choose from</div>
            </div>
            <span className="chevron"><Icon name={open ? 'caret-up' : 'caret-down'} /></span>
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}

/** A switch row: the label, a line under it and the switch. Inside a HouseRulesFold it counts as a house rule. */
export function HouseRule({ label, sub = null, on, onChange }) {
  const fold = useContext(Ctx);
  const id = useId();
  const report = fold?.report, forget = fold?.forget;
  useLayoutEffect(() => { report?.(id, !!on); }, [report, id, on]);
  useLayoutEffect(() => () => forget?.(id), [forget, id]);
  return (
    <div className="toggle-row">
      <div><div className="toggle-lbl">{label}</div>{sub && <div className="toggle-sub">{sub}</div>}</div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}
