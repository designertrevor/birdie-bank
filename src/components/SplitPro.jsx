// Split Pro with your group (pro-split.js): the sheet that offers it right after an organizer picks
// a plan (the paywall, or Your plan), and the row on Your plan that shows a split standing, with
// Undo. Behind the paywall flag: nothing here renders with it off. Confirm puts what each friend
// owes you on the Tab; the purchase stays yours and nothing is charged.
import { useMemo, useState } from 'react';
import { Icon, PickMark, Sheet, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { money } from '../lib/golf.js';
import { track } from '../lib/analytics.js';
import { canonicalOf } from '../lib/pair-debts.js';
import {
  MAX_SPLIT, activeSplit, eachCents, groupWord, newSplit, splitCandidates, splitIdFor, splitShares, splitsOn, undoneSplit,
} from '../lib/pro-split.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';
const dollars = c => money(c / 100);
const toCents = v => Math.round((Number(v) || 0) * 100);

/** Save a split (or write over an undone one for the same purchase). */
function saveSplit(split) {
  update(st => { st.proSplits = { ...(st.proSplits || {}), [split.id]: split }; });
}

/** Undo a split: its stub stays, so your other phones drop it too. Returns a function that puts it back. */
function undoSplit(split) {
  const before = split;
  update(st => { st.proSplits = { ...(st.proSplits || {}), [split.id]: undoneSplit(split) }; });
  track('pro_split_undone', { people: split.people.length });
  // Newer than the stub it replaces, so every phone takes it back, even in the same millisecond
  return () => saveSplit({ ...before, updatedAt: Math.max(Date.now(), undoneSplit(split).updatedAt + 1) });
}

/** "Sam, Jo and Al": the friends in a split, by first name. */
function friendsLine(split, me) {
  const names = split.people.filter(p => p.id !== me && p.id !== split.by).map(p => first(p.name));
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * The offer: "Split it with your group?", with who's in (ticked, editable), each one's share, and
 * Confirm. `plan` is the PLANS entry being split (its price), `onDone` runs after Confirm or Not now.
 */
export function SplitProSheet({ open, plan, onDone }) {
  if (!open || !splitsOn() || !plan) return null;
  return <SplitInner plan={plan} onDone={onDone} />;
}

function SplitInner({ plan, onDone }) {
  const { showToast } = useUI();
  const state = useStore();
  const me = state.me ? canonicalOf(state)(state.me) : null;
  const cand = useMemo(() => splitCandidates(getState()), []);
  const [picked, setPicked] = useState(() => new Set(cand.picked));
  const [meIn, setMeIn] = useState(true);
  const price = toCents(plan.price);
  const shares = splitShares(price, [...picked], { organizer: me, organizerIn: meIn });
  const shareOf = new Map((shares || []).map(s => [s.id, s.cents]));
  const n = (picked.size || 0) + (meIn ? 1 : 0);
  const full = n >= MAX_SPLIT;
  const flip = id => setPicked(cur => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else if (!full) next.add(id);
    return next;
  });
  const per = plan.per === 'year' ? 'the year' : 'this month';
  const headline = shares
    ? meIn ? `${dollars(eachCents(shares))} each for ${groupWord(shares.length)}` : `${dollars(eachCents(shares))} each for ${shares.length} friends`
    : 'Pick who’s in';
  const confirm = () => {
    const id = splitIdFor(getState());
    // One split stands at a time (activeSplit): a sheet left open on another phone adds nothing
    if (!id || !shares || activeSplit(getState())) { onDone?.(false); return; }
    const names = Object.fromEntries(cand.people.map(p => [p.id, p.name]));
    if (me) names[me] = getState().players?.[me]?.name || 'You';
    const split = newSplit({ id, purchase: getState().paywall?.at, plan: plan.id, price, by: me, friends: [...picked], organizerIn: meIn, names });
    if (!split) return;
    saveSplit(split);
    track('pro_split_confirmed', { people: split.people.length, organizer_in: meIn, plan: plan.id });
    const owing = split.people.filter(p => p.id !== me);
    showToast(`On the Tab: ${owing.length === 1 ? `${first(owing[0].name)} owes` : `${owing.length} friends owe`} you ${dollars(eachCents(owing))}${owing.length === 1 ? '' : ' each'}`,
      { label: 'Undo', run: () => undoSplit(split) }, { tone: 'money' });
    onDone?.(true);
  };

  return (
    <Sheet open onClose={() => onDone?.(false)} title="Split it with your group?">
      <div className="exp-form split-pro">
        <p className="li-sub split-lead">{plan.label} Pro is {dollars(price)} for {per}. Split it and each person’s share goes on the Tab as what they owe you. Pro stays yours.</p>
        <div className="split-head d" aria-live="polite">{headline}</div>
        {!cand.people.length ? (
          <p className="field-help">Add your group as players first, then split it from Your plan.</p>
        ) : (
          <ul className="exp-people" aria-label="Who’s in">
            <li className="exp-person me">
              <button type="button" className={`exp-who exp-tick ${meIn ? 'on' : ''}`} aria-pressed={meIn} onClick={() => setMeIn(v => !v)}>
                <Avatar id={me} name={state.players?.[me]?.name || 'You'} /> <span className="exp-pname">You</span>
                <span className={`exp-share ${meIn && shares ? '' : 'none'}`}>{meIn && shares ? dollars(shareOf.get(me)) : '–'}</span>
                <PickMark on={meIn} />
              </button>
            </li>
            {cand.people.map(p => {
              const on = picked.has(p.id);
              return (
                <li key={p.id} className="exp-person">
                  <button type="button" className={`exp-who exp-tick ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && full} onClick={() => flip(p.id)}>
                    <Avatar id={p.id} name={p.name} /> <span className="exp-pname">{p.name}</span>
                    <span className={`exp-share ${on && shares ? '' : 'none'}`}>{on && shares ? dollars(shareOf.get(p.id)) : '–'}</span>
                    <PickMark on={on} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {full && <p className="field-help">Up to {MAX_SPLIT} people in a split.</p>}
        <p className="field-help">Nothing is charged. They settle up with you on the Tab, like any other money, and Undo takes it all back off.</p>
        <button className="full-btn" style={{ marginTop: 12 }} disabled={!shares} onClick={confirm}>Put it on the Tab <Icon name="arrow-right" /></button>
        <button type="button" className="link-btn center" onClick={() => onDone?.(false)}>Not now</button>
      </div>
    </Sheet>
  );
}

/**
 * Your plan's row for the split: the split standing, with Undo, whatever the plan is now (the trial
 * over, Pro for life, or a second phone with no trial answer of its own: the friends still owe it on
 * the Tab, so Undo is always here), or "Split it with your group" to open the sheet when there's a
 * purchase to split (`plan`; Pro for life has nothing to pay). Nothing with the flag off.
 */
export function SplitProRow({ plan }) {
  const state = useStore();
  const { showToast } = useUI();
  const [open, setOpen] = useState(false);
  if (!splitsOn()) return null;
  const me = state.me ? canonicalOf(state)(state.me) : null;
  const split = activeSplit(state);
  if (!split && (!plan || !splitIdFor(state))) return null;
  if (split) {
    const owing = split.people.filter(p => p.id !== split.by);
    const undo = () => {
      const redo = undoSplit(split);
      showToast('Split taken off the Tab', { label: 'Undo', run: redo });
    };
    return (
      <div className="block split-row">
        <div className="set-icon"><Icon name="users-three" fill /></div>
        <div className="row-main">
          <div className="set-name">Split with your group</div>
          <div className="set-sub">{friendsLine(split, me)} {owing.length === 1 ? 'owes' : 'owe'} you {dollars(eachCents(owing))}{owing.length === 1 ? '' : ' each'} on the Tab, of {dollars(split.price)}.</div>
        </div>
        <button type="button" className="pill-btn sm" onClick={undo}>Undo</button>
      </div>
    );
  }
  return (
    <>
      <button className="set-row" onClick={() => setOpen(true)}>
        <div className="set-icon"><Icon name="users-three" fill /></div>
        <div className="row-main"><div className="set-name">Split it with your group</div><div className="set-sub">Each share goes on the Tab as what they owe you</div></div>
        <span className="chevron"><Icon name="caret-right" /></span>
      </button>
      <SplitProSheet open={open} plan={plan} onDone={() => setOpen(false)} />
    </>
  );
}
